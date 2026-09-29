/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { constants as fsConstants, promises as fs, type Dirent } from 'node:fs';
import * as path from 'node:path';
import { dotnetManagedRoot, isPathWithin } from './candidates';
import type { DotnetToolchainFailureStage, DotnetToolchainProgressPhase } from './contracts';
import {
	dotnetInstallWalkerRoot,
	isValidDotnetOperationDirectory,
	type DotnetInstallLockMutationResult,
	type IDotnetInstallLockMetadata,
	type IDotnetInstallLockUpdatePatch,
} from './installLock';
import { dotnetInstallScriptPin } from './scriptSource';

/**
 * Stage preparation and journaled publication for the install transaction (D4 steps 1, 3–5). A
 * confirmed setup owns exactly one private sibling operation directory
 * `<home>/.walker/dotnet-install-<nonce>/` whose basename is recorded in the cross-window lock
 * metadata. Preparation reserves `stage/`, `backup/`, the installer-script name, and a versioned
 * journal inside that directory, then copies any pre-existing managed SDK tree into `stage/` with
 * real copies (never hard links; copy-on-write reflinks are allowed) so a later installer run
 * cannot alter the originals.
 *
 * Publication is the only moment the managed destination changes. It persists the journal step
 * before every rename, moves the pre-existing managed tree into `backup/` instead of deleting it,
 * renames the staged tree into `<home>/.walker/dotnet`, and executes the published managed SDK
 * through an injected verifier. Finalization is short and non-interruptible: cancellation is
 * honored only before the first rename. A failure restores the pre-publication managed state and
 * retains the operation directory — the backup is never silently discarded, and an ambiguous
 * restoration reports recovery-required instead of erasing evidence.
 *
 * Cleanup in this module only ever removes the operation directory this call created (or the
 * reserved backup directory it validated as an empty owned directory). A pre-existing directory,
 * a symlink, or anything outside `<home>/.walker` is refused or retained, and the managed
 * destination itself is never a cleanup target.
 */

/** Journal file name reserved inside the owned operation directory. */
export const DOTNET_TRANSACTION_JOURNAL_FILE = 'journal.json';

/** Schema version of the transaction journal; recovery trusts only this version (B6). */
export const DOTNET_TRANSACTION_SCHEMA_VERSION = 1;

/** Owned stage directory name inside the operation directory. */
export const DOTNET_TRANSACTION_STAGE_DIRECTORY_NAME = 'stage';

/** Owned backup directory name inside the operation directory. */
export const DOTNET_TRANSACTION_BACKUP_DIRECTORY_NAME = 'backup';

/** Owned directory that retains a just-published tree moved aside during restoration. */
export const DOTNET_TRANSACTION_FAILED_PUBLICATION_DIRECTORY_NAME = 'failed-publication';

/** Longest retained transaction diagnostic; filesystem error text must not grow output. */
export const MAX_TRANSACTION_DIAGNOSTICS_LENGTH = 300;

/** Selects the path implementation matching the injected local platform. */
function platformPath(platform: NodeJS.Platform): path.PlatformPath {
	return platform === 'win32' ? path.win32 : path.posix;
}

/** Bounds one diagnostic so output never grows with an untrusted error message. */
function boundDiagnostic(text: string): string {
	const single = text.replace(/\s+/g, ' ').trim();
	return single.length > MAX_TRANSACTION_DIAGNOSTICS_LENGTH ? `${single.slice(0, MAX_TRANSACTION_DIAGNOSTICS_LENGTH)}…` : single;
}

function errorCode(error: unknown): string | undefined {
	if (typeof error === 'object' && error !== null && 'code' in error) {
		const code = (error as { readonly code?: unknown }).code;
		return typeof code === 'string' ? code : undefined;
	}
	return undefined;
}

/** `ENOENT`/`ENOTDIR` mean "absent"; every other filesystem error is a real failure. */
function isNotFound(error: unknown): boolean {
	const code = errorCode(error);
	return code === 'ENOENT' || code === 'ENOTDIR';
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Human-readable reason a lock mutation was refused; shared by preparation and publication. */
function describeLockMutation(result: DotnetInstallLockMutationResult): string {
	return result.kind === 'retained' ? `${result.reason}: ${result.detail}` : 'the lock is no longer owned';
}

/** Maps a filesystem fault to the most specific stable code, falling back to the stage's own code. */
function classifyFault(error: unknown, fallback: DotnetStagePreparationFailureCode): DotnetStagePreparationFailureCode {
	const code = errorCode(error);
	if (code === 'ENOSPC') {
		return 'disk-full';
	}
	if (code === 'EACCES' || code === 'EPERM') {
		return 'permission-denied';
	}
	return fallback;
}

/**
 * Publication progress persisted in the journal before the matching rename. `preparing` is the
 * scaffold state written by {@link prepareDotnetInstallStage}; recovery reads the step to decide
 * which manual action is safe.
 */
export type DotnetPublicationStep = 'preparing' | 'backup-pending' | 'publish-pending' | 'verify-pending' | 'committed' | 'rollback-pending' | 'rolled-back';

/**
 * Versioned journal scaffold persisted before any staged content is copied (D4 step 1). Every
 * path in it is an operation-owned relative name; later B6 phases update `phase` before each
 * publication rename and never record caller input.
 */
export interface IDotnetTransactionJournal {
	readonly schemaVersion: typeof DOTNET_TRANSACTION_SCHEMA_VERSION;
	/** Owner token copied from the lock metadata; binds the journal to this operation. */
	readonly token: string;
	readonly phase: DotnetToolchainProgressPhase;
	/** Publication progress persisted before the matching rename; absent on the prepared scaffold. */
	readonly step?: DotnetPublicationStep;
	/** Relative name of the live managed directory this transaction publishes to. */
	readonly managedDirectory: string;
	readonly stageDirectory: string;
	readonly backupDirectory: string;
	readonly scriptFile: string;
}

/** Absolute owned paths derived from a home and one lock-recorded operation-directory basename. */
export interface IDotnetTransactionPaths {
	readonly operationDirectory: string;
	readonly stageDirectory: string;
	readonly backupDirectory: string;
	readonly journalPath: string;
	/** Reserved path of the verified installer script; the download layer writes it later. */
	readonly scriptPath: string;
}

/** Stable failure codes for stage preparation; callers map them to retry/recovery guidance. */
export type DotnetStagePreparationFailureCode =
	| 'unsafe-walker-root'
	| 'unsafe-operation-directory'
	| 'operation-directory-exists'
	| 'operation-directory-failed'
	| 'unsafe-managed-root'
	| 'lock-update-failed'
	| 'journal-failed'
	| 'stage-create-failed'
	| 'copy-failed'
	| 'disk-full'
	| 'permission-denied'
	| 'external-link'
	| 'unresolvable-link'
	| 'unsupported-entry'
	| 'unexpected-publication-state'
	| 'backup-rename-failed'
	| 'stage-rename-failed'
	| 'sharing-violation'
	| 'cross-device'
	| 'verify-failed';

/** Failure detail for stage preparation; display text stays in the extension layer. */
export interface IDotnetStagePreparationFailure {
	readonly stage: DotnetToolchainFailureStage;
	readonly code: DotnetStagePreparationFailureCode;
	readonly diagnostic: string;
}

/** What the stage copy produced; evidence for tests and truthful progress output. */
export interface IDotnetStageCopySummary {
	readonly files: number;
	readonly directories: number;
	readonly links: number;
	readonly bytes: number;
}

/** One prepared install stage; all paths are absolute and inside the owned operation directory. */
export interface IDotnetStagedInstall {
	readonly operationDirectory: string;
	readonly stageDirectory: string;
	readonly backupDirectory: string;
	readonly journalPath: string;
	readonly scriptPath: string;
	readonly copied: IDotnetStageCopySummary;
}

/**
 * Result of stage preparation. `failed` carries the stable failure code and whether the owned
 * operation directory was retained for manual inspection; `canceled` reports whether the owned
 * directory was removed before the caller re-detects.
 */
export type DotnetStagePreparationResult =
	| { readonly kind: 'prepared'; readonly prepared: IDotnetStagedInstall }
	| { readonly kind: 'canceled'; readonly operationDirectory: string; readonly removed: boolean; readonly copied: IDotnetStageCopySummary }
	| { readonly kind: 'failed'; readonly failure: IDotnetStagePreparationFailure; readonly retained: boolean; readonly operationDirectory: string };

/**
 * Injected file operations. Production uses the real filesystem; tests inject faults (disk-full,
 * permission, cleanup failure) instead of risking a damaged host filesystem.
 */
export interface IDotnetStageFileOperations {
	/** Copies one regular file; the default uses `fs.copyFile` with `COPYFILE_EXCL` (never a hard link). */
	copyFile(source: string, destination: string): Promise<void>;
	/** Writes one file with the requested mode; the default uses `fs.writeFile`. */
	writeFile(filePath: string, content: string, mode: number): Promise<void>;
	/** Removes one owned directory recursively; the default uses `fs.rm(..., { recursive: true, force: false })`. */
	remove(directory: string): Promise<void>;
}

const defaultFileOperations: IDotnetStageFileOperations = {
	copyFile: async (source, destination) => {
		await fs.copyFile(source, destination, fsConstants.COPYFILE_EXCL);
	},
	writeFile: async (filePath, content, mode) => {
		await fs.writeFile(filePath, content, { encoding: 'utf8', mode });
	},
	remove: async directory => {
		await fs.rm(directory, { recursive: true, force: false });
	},
};

/** Caller-owned cancellation signal; checked before every managed entry is copied. */
export interface IDotnetStageCancellation {
	readonly isCancellationRequested: boolean;
}

/** Minimal lock surface stage preparation needs; satisfied by `IDotnetInstallLock`. */
export interface IDotnetStagePreparationLock {
	readonly metadata: IDotnetInstallLockMetadata;
	update(patch: IDotnetInstallLockUpdatePatch): Promise<DotnetInstallLockMutationResult>;
}

/** Inputs for {@link prepareDotnetInstallStage}; the caller owns the acquired lock. */
export interface IPrepareDotnetInstallStageOptions {
	readonly home: string;
	readonly lock: IDotnetStagePreparationLock;
	/** Local platform; defaults to `process.platform`. */
	readonly platform?: NodeJS.Platform;
	readonly cancellation?: IDotnetStageCancellation;
	/** Fault-injection seam; defaults to the real filesystem. */
	readonly fileOperations?: Partial<IDotnetStageFileOperations>;
}

type MutableCopySummary = { -readonly [K in keyof IDotnetStageCopySummary]: IDotnetStageCopySummary[K] };

interface ICopyManagedTreeOptions {
	readonly sourceRoot: string;
	readonly sourceResolvedRoot: string;
	readonly destinationRoot: string;
	readonly platform: NodeJS.Platform;
	readonly summary: MutableCopySummary;
	readonly copyFile: (source: string, destination: string) => Promise<void>;
	readonly isCanceled: () => boolean;
}

type CopyWalkOutcome =
	| { readonly kind: 'copied' }
	| { readonly kind: 'canceled' }
	| { readonly kind: 'failed'; readonly code: DotnetStagePreparationFailureCode; readonly diagnostic: string };

/** Absolute owned transaction paths derived from a home and one operation-directory basename. */
export function dotnetTransactionPaths(home: string, operationDirectory: string, platform: NodeJS.Platform = process.platform): IDotnetTransactionPaths {
	const pathApi = platformPath(platform);
	const operationRoot = pathApi.join(dotnetInstallWalkerRoot(home, platform), operationDirectory);
	return {
		operationDirectory: operationRoot,
		stageDirectory: pathApi.join(operationRoot, DOTNET_TRANSACTION_STAGE_DIRECTORY_NAME),
		backupDirectory: pathApi.join(operationRoot, DOTNET_TRANSACTION_BACKUP_DIRECTORY_NAME),
		journalPath: pathApi.join(operationRoot, DOTNET_TRANSACTION_JOURNAL_FILE),
		scriptPath: pathApi.join(operationRoot, dotnetInstallScriptPin(platform).fileName),
	};
}

/** Replaces the journal atomically: a token-suffixed temporary file is renamed over the target. */
async function writeJournalAtomically(journalPath: string, journal: IDotnetTransactionJournal, writeFile: (filePath: string, content: string, mode: number) => Promise<void>): Promise<void> {
	const temporary = `${journalPath}.tmp-${journal.token}`;
	await writeFile(temporary, JSON.stringify(journal), 0o600);
	try {
		await fs.rename(temporary, journalPath);
	} catch (error) {
		await fs.rm(temporary, { force: true }).catch(() => undefined);
		throw error;
	}
}

/** Writes the journal scaffold atomically through the injected operations seam. */
async function writeJournalScaffold(journalPath: string, journal: IDotnetTransactionJournal, operations: IDotnetStageFileOperations): Promise<void> {
	await writeJournalAtomically(journalPath, journal, operations.writeFile);
}

/** Removes only the operation directory this call created; a missing directory is already clean. */
async function removeOwnedOperationDirectory(operationDirectory: string, remove: (directory: string) => Promise<void>): Promise<boolean> {
	try {
		await remove(operationDirectory);
		return true;
	} catch (error) {
		return isNotFound(error);
	}
}

/**
 * Copies one managed tree into the owned stage without following unsafe links. Regular files are
 * copied and their modes preserved, directories are recreated, and links are preserved as links
 * only when they resolve to an existing target inside the managed tree. Absolute targets that
 * resolve inside the managed tree stay valid because the stage is later published to that same
 * managed path. Cancellation is checked before every entry.
 */
async function copyManagedTree(options: ICopyManagedTreeOptions): Promise<CopyWalkOutcome> {
	const pathApi = platformPath(options.platform);
	const failed = (code: DotnetStagePreparationFailureCode, diagnostic: string): CopyWalkOutcome => ({ kind: 'failed', code, diagnostic });

	const copyLink = async (sourcePath: string, destinationPath: string, relative: string): Promise<CopyWalkOutcome | undefined> => {
		let linkTarget: string;
		try {
			linkTarget = await fs.readlink(sourcePath);
		} catch (error) {
			return failed(classifyFault(error, 'copy-failed'), `could not read the managed link ${relative}: ${describeError(error)}`);
		}
		const targetPath = pathApi.isAbsolute(linkTarget) ? linkTarget : pathApi.resolve(pathApi.dirname(sourcePath), linkTarget);
		let resolvedTarget: string;
		let targetStats: Awaited<ReturnType<typeof fs.stat>>;
		try {
			resolvedTarget = await fs.realpath(targetPath);
			targetStats = await fs.stat(resolvedTarget);
		} catch (error) {
			return failed('unresolvable-link', `the managed link ${relative} cannot be resolved to an existing target: ${describeError(error)}`);
		}
		if (!isPathWithin(options.sourceResolvedRoot, resolvedTarget, options.platform)) {
			return failed('external-link', `the managed link ${relative} resolves to ${resolvedTarget} outside the managed directory; refusing to follow it`);
		}
		try {
			await fs.symlink(linkTarget, destinationPath, targetStats.isDirectory() ? 'dir' : 'file');
		} catch (error) {
			return failed(classifyFault(error, 'copy-failed'), `could not preserve the managed link ${relative}: ${describeError(error)}`);
		}
		options.summary.links += 1;
		return undefined;
	};

	const walk = async (sourceDirectory: string, destinationDirectory: string, relativeDirectory: string): Promise<CopyWalkOutcome> => {
		let entries: Dirent[];
		try {
			entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
		} catch (error) {
			return failed(classifyFault(error, 'copy-failed'), `could not read the managed directory ${relativeDirectory || '.'}: ${describeError(error)}`);
		}
		entries.sort((left, right) => left.name.localeCompare(right.name));
		for (const entry of entries) {
			if (options.isCanceled()) {
				return { kind: 'canceled' };
			}
			const relative = relativeDirectory === '' ? entry.name : `${relativeDirectory}/${entry.name}`;
			const sourcePath = pathApi.join(sourceDirectory, entry.name);
			const destinationPath = pathApi.join(destinationDirectory, entry.name);
			let stats: Awaited<ReturnType<typeof fs.lstat>>;
			try {
				stats = await fs.lstat(sourcePath);
			} catch (error) {
				return failed(classifyFault(error, 'copy-failed'), `could not inspect the managed entry ${relative}: ${describeError(error)}`);
			}
			if (stats.isSymbolicLink()) {
				const outcome = await copyLink(sourcePath, destinationPath, relative);
				if (outcome !== undefined) {
					return outcome;
				}
				continue;
			}
			if (stats.isDirectory()) {
				try {
					await fs.mkdir(destinationPath, { mode: stats.mode & 0o7777 });
					await fs.chmod(destinationPath, stats.mode & 0o7777);
				} catch (error) {
					return failed(classifyFault(error, 'copy-failed'), `could not create the staged directory ${relative}: ${describeError(error)}`);
				}
				options.summary.directories += 1;
				const nested = await walk(sourcePath, destinationPath, relative);
				if (nested.kind !== 'copied') {
					return nested;
				}
				continue;
			}
			if (stats.isFile()) {
				try {
					await options.copyFile(sourcePath, destinationPath);
					await fs.chmod(destinationPath, stats.mode & 0o7777);
				} catch (error) {
					return failed(classifyFault(error, 'copy-failed'), `could not copy the managed file ${relative}: ${describeError(error)}`);
				}
				options.summary.files += 1;
				options.summary.bytes += stats.size;
				continue;
			}
			return failed('unsupported-entry', `the managed entry ${relative} is not a regular file, directory, or link; refusing to copy it`);
		}
		return { kind: 'copied' };
	};

	return walk(options.sourceRoot, options.destinationRoot, '');
}

/**
 * Prepares the owned install stage for a confirmed, lock-holding operation. The function never
 * touches the managed destination: it validates the lock's operation directory against the walker
 * root, claims the lock's `preparing` phase, creates the private operation directory exclusively,
 * writes the versioned journal scaffold, reserves `stage/` and `backup/`, and copies any
 * pre-existing managed SDK bytes into `stage/` without hard links.
 */
export async function prepareDotnetInstallStage(options: IPrepareDotnetInstallStageOptions): Promise<DotnetStagePreparationResult> {
	const platform = options.platform ?? process.platform;
	const walkerRoot = dotnetInstallWalkerRoot(options.home, platform);
	const operationDirectory = options.lock.metadata.operationDirectory;
	const paths = dotnetTransactionPaths(options.home, operationDirectory, platform);
	const operations: IDotnetStageFileOperations = {
		copyFile: options.fileOperations?.copyFile ?? defaultFileOperations.copyFile,
		writeFile: options.fileOperations?.writeFile ?? defaultFileOperations.writeFile,
		remove: options.fileOperations?.remove ?? defaultFileOperations.remove,
	};
	const copied: MutableCopySummary = { files: 0, directories: 0, links: 0, bytes: 0 };
	const isCanceled = (): boolean => options.cancellation?.isCancellationRequested === true;

	const fail = (code: DotnetStagePreparationFailureCode, diagnostic: string, retained = false): DotnetStagePreparationResult => ({
		kind: 'failed',
		failure: { stage: 'publish', code, diagnostic: boundDiagnostic(diagnostic) },
		retained,
		operationDirectory: paths.operationDirectory,
	});
	const failAfterCreation = async (code: DotnetStagePreparationFailureCode, diagnostic: string): Promise<DotnetStagePreparationResult> => {
		const removed = await removeOwnedOperationDirectory(paths.operationDirectory, operations.remove);
		return fail(code, removed ? diagnostic : `${diagnostic}; the owned operation directory is retained for manual inspection`, !removed);
	};
	const cancelAfterCreation = async (): Promise<DotnetStagePreparationResult> => {
		const removed = await removeOwnedOperationDirectory(paths.operationDirectory, operations.remove);
		return { kind: 'canceled', operationDirectory: paths.operationDirectory, removed, copied };
	};

	// The operation directory must be exactly one owned basename inside this home's walker root.
	if (!isValidDotnetOperationDirectory(operationDirectory) || !isPathWithin(walkerRoot, paths.operationDirectory, platform)) {
		return fail('unsafe-operation-directory', `the lock operation directory ${JSON.stringify(operationDirectory)} is not an owned operation-directory name inside ${walkerRoot}`);
	}

	// The walker root must be the real directory the lock was acquired in, never a symlink.
	let walkerStats: Awaited<ReturnType<typeof fs.lstat>>;
	try {
		walkerStats = await fs.lstat(walkerRoot);
	} catch (error) {
		return fail('unsafe-walker-root', `${walkerRoot} could not be inspected: ${describeError(error)}`);
	}
	if (!walkerStats.isDirectory() || walkerStats.isSymbolicLink()) {
		return fail('unsafe-walker-root', walkerStats.isSymbolicLink() ? `${walkerRoot} is a symbolic link; refusing to follow it` : `${walkerRoot} is not a directory; refusing to use it`);
	}

	// The managed destination is copied, never followed through a link or reparse point.
	const managedRoot = dotnetManagedRoot(options.home, platform);
	let managedSource: { readonly root: string; readonly resolvedRoot: string } | undefined;
	let managedStats: Awaited<ReturnType<typeof fs.lstat>> | undefined;
	try {
		managedStats = await fs.lstat(managedRoot);
	} catch (error) {
		if (!isNotFound(error)) {
			return fail('unsafe-managed-root', `${managedRoot} could not be inspected: ${describeError(error)}`);
		}
	}
	if (managedStats !== undefined) {
		if (managedStats.isSymbolicLink() || !managedStats.isDirectory()) {
			return fail('unsafe-managed-root', `${managedRoot} is not a real managed directory; refusing to copy it`);
		}
		let resolvedRoot: string;
		try {
			resolvedRoot = await fs.realpath(managedRoot);
		} catch (error) {
			return fail('unsafe-managed-root', `${managedRoot} could not be resolved: ${describeError(error)}`);
		}
		managedSource = { root: managedRoot, resolvedRoot };
	}

	if (isCanceled()) {
		return { kind: 'canceled', operationDirectory: paths.operationDirectory, removed: true, copied };
	}

	// Claim the owned phase before creating anything; a foreign lock aborts with no writes.
	const claimed = await options.lock.update({ phase: 'preparing', diagnostics: 'preparing the owned install stage' });
	if (claimed.kind !== 'applied') {
		return fail('lock-update-failed', `could not claim the install lock phase (${describeLockMutation(claimed)})`);
	}

	// Exclusive creation proves the operation directory is ours; anything pre-existing is retained.
	try {
		await fs.mkdir(paths.operationDirectory, { mode: 0o700 });
	} catch (error) {
		if (errorCode(error) === 'EEXIST') {
			const stats = await fs.lstat(paths.operationDirectory).catch(() => undefined);
			return stats?.isSymbolicLink() === true
				? fail('unsafe-operation-directory', `${paths.operationDirectory} is a symbolic link; refusing to write through it`, true)
				: fail('operation-directory-exists', `${paths.operationDirectory} already exists; preserve it and retry after manual inspection`, true);
		}
		return fail(classifyFault(error, 'operation-directory-failed'), `could not create the owned operation directory ${paths.operationDirectory}: ${describeError(error)}`);
	}

	const journal: IDotnetTransactionJournal = {
		schemaVersion: DOTNET_TRANSACTION_SCHEMA_VERSION,
		token: options.lock.metadata.token,
		phase: 'preparing',
		managedDirectory: platformPath(platform).basename(managedRoot),
		stageDirectory: DOTNET_TRANSACTION_STAGE_DIRECTORY_NAME,
		backupDirectory: DOTNET_TRANSACTION_BACKUP_DIRECTORY_NAME,
		scriptFile: platformPath(platform).basename(paths.scriptPath),
	};
	try {
		await writeJournalScaffold(paths.journalPath, journal, operations);
	} catch (error) {
		return await failAfterCreation(classifyFault(error, 'journal-failed'), `could not write the transaction journal ${paths.journalPath}: ${describeError(error)}`);
	}

	try {
		await fs.mkdir(paths.stageDirectory, { mode: 0o700 });
		await fs.chmod(paths.stageDirectory, 0o700);
		await fs.mkdir(paths.backupDirectory, { mode: 0o700 });
		await fs.chmod(paths.backupDirectory, 0o700);
	} catch (error) {
		return await failAfterCreation(classifyFault(error, 'stage-create-failed'), `could not reserve the stage and backup directories: ${describeError(error)}`);
	}

	if (managedSource !== undefined) {
		const outcome = await copyManagedTree({
			sourceRoot: managedSource.root,
			sourceResolvedRoot: managedSource.resolvedRoot,
			destinationRoot: paths.stageDirectory,
			platform,
			summary: copied,
			copyFile: operations.copyFile,
			isCanceled,
		});
		if (outcome.kind === 'canceled') {
			return await cancelAfterCreation();
		}
		if (outcome.kind === 'failed') {
			return await failAfterCreation(outcome.code, outcome.diagnostic);
		}
	}

	return {
		kind: 'prepared',
		prepared: {
			operationDirectory: paths.operationDirectory,
			stageDirectory: paths.stageDirectory,
			backupDirectory: paths.backupDirectory,
			journalPath: paths.journalPath,
			scriptPath: paths.scriptPath,
			copied,
		},
	};
}

/** Absolute managed executable path that final verification executes (D4 step 4). */
export function dotnetManagedExecutablePath(home: string, platform: NodeJS.Platform = process.platform): string {
	return platformPath(platform).join(dotnetManagedRoot(home, platform), platform === 'win32' ? 'dotnet.exe' : 'dotnet');
}

/** One published-SDK verification outcome; produced by the injected final-path verifier. */
export type DotnetPublishedSdkVerification =
	| { readonly kind: 'verified'; readonly executable: string; readonly sdkVersion: string }
	| { readonly kind: 'failed'; readonly code: string; readonly diagnostic: string };

/** Injected final-path verification context; the verifier must execute exactly this managed SDK. */
export interface IDotnetPublishedSdkVerificationContext {
	readonly home: string;
	readonly managedDirectory: string;
	readonly executable: string;
}

/** Executes the published managed SDK; a successful rename or installer exit code is not readiness. */
export type DotnetPublishedSdkVerifier = (context: IDotnetPublishedSdkVerificationContext) => Promise<DotnetPublishedSdkVerification>;

/** Publication fault seam; production uses the real filesystem and atomic journal replacement. */
export interface IDotnetPublicationFileOperations {
	/** Atomically replaces the journal before the corresponding rename. */
	writeJournal(journalPath: string, journal: IDotnetTransactionJournal): Promise<void>;
	/** Same-volume rename of one owned or managed path. */
	rename(source: string, destination: string): Promise<void>;
	/** Removes one owned directory; only owned paths are ever passed. */
	remove(directory: string): Promise<void>;
}

/** Default publication operations: real filesystem, atomic journal replacement. */
const defaultPublicationFileOperations: IDotnetPublicationFileOperations = {
	writeJournal: async (journalPath, journal) => {
		await writeJournalAtomically(journalPath, journal, async (filePath, content, mode) => {
			await fs.writeFile(filePath, content, { encoding: 'utf8', mode });
		});
	},
	rename: async (source, destination) => {
		await fs.rename(source, destination);
	},
	remove: async directory => {
		await fs.rm(directory, { recursive: true, force: false });
	},
};

/** Inputs for {@link publishDotnetInstallStage}; the caller owns the acquired lock. */
export interface IPublishDotnetInstallStageOptions {
	readonly home: string;
	readonly lock: IDotnetStagePreparationLock;
	/** The stage prepared by {@link prepareDotnetInstallStage}; paths must match the owned transaction. */
	readonly prepared: IDotnetStagedInstall;
	/** Final managed executable execution; publication alone never proves readiness. */
	readonly verifyPublished: DotnetPublishedSdkVerifier;
	readonly platform?: NodeJS.Platform;
	readonly cancellation?: IDotnetStageCancellation;
	/** Fault-injection seam; defaults to the real filesystem. */
	readonly fileOperations?: Partial<IDotnetPublicationFileOperations>;
}

/** One verified published managed install; the pre-existing tree is retained in `backupDirectory`. */
export interface IDotnetPublishedInstall {
	readonly operationDirectory: string;
	readonly managedDirectory: string;
	readonly executable: string;
	readonly sdkVersion: string;
	readonly backupDirectory: string;
	/** True when a pre-existing managed tree was moved into `backupDirectory` and retained. */
	readonly backupRetained: boolean;
	readonly scriptPath: string;
}

/** How the pre-publication managed state stands after a publication failure. */
export type DotnetPublicationRestoration = 'none-needed' | 'restored' | 'recovery-required';

/**
 * Result of journaled publication. `published` reports a verified managed SDK whose backup is
 * retained; `canceled` reports a publication stopped before finalization with owned data removed;
 * `failed` reports the stable failure plus whether the managed path is unchanged, restored, or
 * requires manual recovery.
 */
export type DotnetStagePublicationResult =
	| { readonly kind: 'published'; readonly published: IDotnetPublishedInstall }
	| { readonly kind: 'canceled'; readonly operationDirectory: string; readonly removed: boolean }
	| { readonly kind: 'failed'; readonly failure: IDotnetStagePreparationFailure; readonly restoration: DotnetPublicationRestoration; readonly retained: boolean; readonly operationDirectory: string; readonly backupDirectory: string };

/** Maps a rename fault to the most specific stable code; `EXDEV` proves same-volume renames failed. */
function classifyRenameFault(error: unknown, fallback: DotnetStagePreparationFailureCode): DotnetStagePreparationFailureCode {
	const code = errorCode(error);
	if (code === 'EXDEV') {
		return 'cross-device';
	}
	if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
		return 'sharing-violation';
	}
	if (code === 'EEXIST' || code === 'ENOTEMPTY') {
		return 'unexpected-publication-state';
	}
	if (code === 'ENOSPC') {
		return 'disk-full';
	}
	return fallback;
}

/** True when the path exists as a real directory that is not a link. */
async function realDirectoryExists(target: string): Promise<boolean> {
	const stats = await fs.lstat(target).catch(() => undefined);
	return stats !== undefined && stats.isDirectory() && !stats.isSymbolicLink();
}

/** True when the directory exists and has at least one entry; unreadable content counts as data. */
async function directoryHasData(target: string): Promise<boolean> {
	if (!(await realDirectoryExists(target))) {
		return false;
	}
	const entries = await fs.readdir(target).catch(() => undefined);
	return entries === undefined || entries.length > 0;
}

/** Disk-discovered publication state; restoration classifies from disk, not from call intent. */
interface IPublicationDiskState {
	readonly managedPresent: boolean;
	readonly stagePresent: boolean;
	readonly failedPublicationPresent: boolean;
	readonly backupHasData: boolean;
}

/** Inspects the owned and managed paths without following links. */
async function inspectPublicationDiskState(managedDirectory: string, stageDirectory: string, backupDirectory: string, failedPublicationDirectory: string): Promise<IPublicationDiskState> {
	return {
		managedPresent: await realDirectoryExists(managedDirectory),
		stagePresent: await realDirectoryExists(stageDirectory),
		failedPublicationPresent: await realDirectoryExists(failedPublicationDirectory),
		backupHasData: await directoryHasData(backupDirectory),
	};
}

/**
 * Publishes the prepared, installer-populated stage to the managed destination under a journaled,
 * same-volume rename sequence, then executes the published managed SDK through the injected
 * verifier. The pre-existing managed tree moves into the reserved `backup/` directory and is
 * retained. When publication or verification fails the pre-publication managed state is restored;
 * when restoration cannot be proven the result is `recovery-required`, every owned artifact is
 * retained, and diagnostics name the backup location for the documented manual procedure.
 */
export async function publishDotnetInstallStage(options: IPublishDotnetInstallStageOptions): Promise<DotnetStagePublicationResult> {
	const platform = options.platform ?? process.platform;
	const pathApi = platformPath(platform);
	const home = options.home;
	const expected = dotnetTransactionPaths(home, options.lock.metadata.operationDirectory, platform);
	const managedDirectory = dotnetManagedRoot(home, platform);
	const failedPublicationDirectory = pathApi.join(expected.operationDirectory, DOTNET_TRANSACTION_FAILED_PUBLICATION_DIRECTORY_NAME);
	const operations: IDotnetPublicationFileOperations = {
		writeJournal: options.fileOperations?.writeJournal ?? defaultPublicationFileOperations.writeJournal,
		rename: options.fileOperations?.rename ?? defaultPublicationFileOperations.rename,
		remove: options.fileOperations?.remove ?? defaultPublicationFileOperations.remove,
	};

	const fail = (stage: DotnetToolchainFailureStage, code: DotnetStagePreparationFailureCode, diagnostic: string, retained: boolean, restoration: DotnetPublicationRestoration = 'none-needed'): DotnetStagePublicationResult => ({
		kind: 'failed',
		failure: { stage, code, diagnostic: boundDiagnostic(diagnostic) },
		restoration,
		retained,
		operationDirectory: expected.operationDirectory,
		backupDirectory: expected.backupDirectory,
	});

	// Publication trusts the lock's operation directory and never caller-provided paths.
	if (options.prepared.operationDirectory !== expected.operationDirectory
		|| options.prepared.stageDirectory !== expected.stageDirectory
		|| options.prepared.backupDirectory !== expected.backupDirectory
		|| options.prepared.journalPath !== expected.journalPath) {
		return fail('publish', 'unexpected-publication-state', 'the prepared install paths do not match the owned transaction for this lock; refusing to publish', false);
	}

	// The staged install must be a real directory; a link or missing stage is never published.
	if (!(await realDirectoryExists(expected.stageDirectory))) {
		return fail('publish', 'unexpected-publication-state', `${expected.stageDirectory} is missing or is not a real staged directory; refusing to publish`, true);
	}

	// The managed destination may be absent or a real directory, never a link or file.
	const managedStats = await fs.lstat(managedDirectory).catch(() => undefined);
	if (managedStats !== undefined && (managedStats.isSymbolicLink() || !managedStats.isDirectory())) {
		return fail('publish', 'unsafe-managed-root', managedStats.isSymbolicLink()
			? `${managedDirectory} is a symbolic link; refusing to replace it`
			: `${managedDirectory} is not a real managed directory; refusing to replace it`, true);
	}

	// The reserved backup must be a real, empty directory; content means an earlier publication
	// may have been interrupted, so recovery wins over any further write.
	if (!(await realDirectoryExists(expected.backupDirectory))) {
		return fail('publish', 'unexpected-publication-state', `${expected.backupDirectory} is missing or is not the reserved backup directory; refusing to publish`, true);
	}
	if (await directoryHasData(expected.backupDirectory)) {
		return fail('publish', 'unexpected-publication-state', `${expected.backupDirectory} already contains data; a previous publication may have been interrupted. Preserve it and follow the manual recovery steps in the extension README before retrying`, true, 'recovery-required');
	}

	if (options.cancellation?.isCancellationRequested === true) {
		const removed = await removeOwnedOperationDirectory(expected.operationDirectory, operations.remove);
		return { kind: 'canceled', operationDirectory: expected.operationDirectory, removed };
	}

	let journal: IDotnetTransactionJournal = {
		schemaVersion: DOTNET_TRANSACTION_SCHEMA_VERSION,
		token: options.lock.metadata.token,
		phase: 'finalizing',
		step: 'preparing',
		managedDirectory: pathApi.basename(managedDirectory),
		stageDirectory: DOTNET_TRANSACTION_STAGE_DIRECTORY_NAME,
		backupDirectory: DOTNET_TRANSACTION_BACKUP_DIRECTORY_NAME,
		scriptFile: pathApi.basename(expected.scriptPath),
	};
	const writeStep = async (step: DotnetPublicationStep, phase: DotnetToolchainProgressPhase): Promise<void> => {
		journal = { ...journal, step, phase };
		await operations.writeJournal(expected.journalPath, journal);
	};
	const journalBestEffort = async (step: DotnetPublicationStep, phase: DotnetToolchainProgressPhase): Promise<void> => {
		await writeStep(step, phase).catch(() => undefined);
	};

	// Restores the pre-publication managed state from what is actually on disk, so a rename that
	// completed before its fault is still undone instead of being mistaken for "nothing moved".
	const settle = async (stage: DotnetToolchainFailureStage, code: DotnetStagePreparationFailureCode, diagnostic: string): Promise<DotnetStagePublicationResult> => {
		const state = await inspectPublicationDiskState(managedDirectory, expected.stageDirectory, expected.backupDirectory, failedPublicationDirectory);
		if (!state.backupHasData && !state.failedPublicationPresent && state.stagePresent) {
			// The managed path was never touched; only owned disposable data exists here.
			const removed = await removeOwnedOperationDirectory(expected.operationDirectory, operations.remove);
			return fail(stage, code, diagnostic, !removed);
		}
		await journalBestEffort('rollback-pending', 'verifying');
		let blocked: string | undefined;
		if (state.backupHasData) {
			if (state.managedPresent && !state.failedPublicationPresent) {
				try {
					await operations.rename(managedDirectory, failedPublicationDirectory);
				} catch (error) {
					blocked = `the just-published managed directory could not be moved aside: ${describeError(error)}`;
				}
			} else if (state.managedPresent) {
				blocked = `${managedDirectory} and ${failedPublicationDirectory} both contain trees; refusing to guess which one is the failed publication`;
			}
			if (blocked === undefined) {
				try {
					await operations.rename(expected.backupDirectory, managedDirectory);
				} catch (error) {
					blocked = `the pre-existing managed SDK could not be restored from ${expected.backupDirectory}: ${describeError(error)}`;
				}
			}
		} else if (state.managedPresent && !state.stagePresent) {
			// No pre-existing SDK existed, so restoring means removing the just-published tree again.
			try {
				await operations.rename(managedDirectory, failedPublicationDirectory);
			} catch (error) {
				blocked = `the just-published managed directory could not be moved aside: ${describeError(error)}`;
			}
		} else if (!state.failedPublicationPresent) {
			blocked = `the managed state at ${managedDirectory} could not be classified safely`;
		}
		if (blocked !== undefined) {
			return fail(stage, code, `${diagnostic}; ${blocked}; recovery is required. Keep ${expected.operationDirectory} (including ${expected.backupDirectory}) intact and follow the manual recovery steps in the extension README before retrying`, true, 'recovery-required');
		}
		await journalBestEffort('rolled-back', 'verifying');
		return fail(stage, code, `${diagnostic}; the pre-publication managed state was restored`, true, 'restored');
	};

	// Claim finalization on the lock before any rename; a foreign lock stops publication.
	const claimed = await options.lock.update({ phase: 'finalizing', diagnostics: 'publishing the verified managed SDK' });
	if (claimed.kind !== 'applied') {
		const removed = await removeOwnedOperationDirectory(expected.operationDirectory, operations.remove);
		return fail('publish', 'lock-update-failed', `could not claim the install lock for finalization (${describeLockMutation(claimed)})`, !removed);
	}

	// Everything from here on is the short, non-interruptible finalization: cancellation is no
	// longer consulted, and every step persists its journal record before the matching rename.
	try {
		await writeStep('backup-pending', 'finalizing');
	} catch (error) {
		const removed = await removeOwnedOperationDirectory(expected.operationDirectory, operations.remove);
		return fail('publish', classifyFault(error, 'journal-failed'), `could not persist the transaction journal before the backup rename: ${describeError(error)}`, !removed);
	}

	if (managedStats !== undefined) {
		try {
			// Replace the empty reservation with the live tree; no managed byte is deleted.
			await operations.remove(expected.backupDirectory);
			await operations.rename(managedDirectory, expected.backupDirectory);
		} catch (error) {
			// A rename fault is evaluated from disk: the backup rename may already have completed.
			return await settle('publish', classifyRenameFault(error, 'backup-rename-failed'), `could not move the existing managed directory into ${expected.backupDirectory}: ${describeError(error)}`);
		}
	}

	try {
		await writeStep('publish-pending', 'finalizing');
	} catch (error) {
		return await settle('publish', classifyFault(error, 'journal-failed'), `could not persist the transaction journal before publication: ${describeError(error)}`);
	}

	try {
		await operations.rename(expected.stageDirectory, managedDirectory);
	} catch (error) {
		return await settle('publish', classifyRenameFault(error, 'stage-rename-failed'), `could not publish the staged install to ${managedDirectory}: ${describeError(error)}`);
	}

	try {
		await writeStep('verify-pending', 'verifying');
	} catch (error) {
		return await settle('publish', classifyFault(error, 'journal-failed'), `could not persist the transaction journal before verification: ${describeError(error)}`);
	}

	const verifying = await options.lock.update({ phase: 'verifying', diagnostics: 'verifying the published managed SDK' });
	if (verifying.kind !== 'applied') {
		return await settle('publish', 'lock-update-failed', `could not claim the install lock for verification (${describeLockMutation(verifying)})`);
	}

	const executable = dotnetManagedExecutablePath(home, platform);
	let verification: DotnetPublishedSdkVerification;
	try {
		verification = await options.verifyPublished({ home, managedDirectory, executable });
	} catch (error) {
		verification = { kind: 'failed', code: 'verify-failed', diagnostic: `the final managed SDK verification failed unexpectedly: ${describeError(error)}` };
	}
	if (verification.kind !== 'verified') {
		return await settle('verify', 'verify-failed', `the published managed SDK did not verify (${verification.code}): ${verification.diagnostic}`);
	}

	try {
		await writeStep('committed', 'verifying');
	} catch (error) {
		return await settle('publish', classifyFault(error, 'journal-failed'), `could not mark the transaction committed: ${describeError(error)}`);
	}

	return {
		kind: 'published',
		published: {
			operationDirectory: expected.operationDirectory,
			managedDirectory,
			executable,
			sdkVersion: verification.sdkVersion,
			backupDirectory: expected.backupDirectory,
			backupRetained: managedStats !== undefined,
			scriptPath: expected.scriptPath,
		},
	};
}
