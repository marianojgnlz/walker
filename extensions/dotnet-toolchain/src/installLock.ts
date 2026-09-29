/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { isPathWithin } from './candidates';
import { DOTNET_TOOLCHAIN_PROGRESS_PHASES, type DotnetToolchainProgressPhase } from './contracts';

/**
 * Cross-window install ownership (D4). The lock is an atomically created directory under
 * `<home>/.walker`, so it is shared by every Walker window and profile on the local machine and
 * never depends on workspace or `globalState` storage. Acquisition is an exclusive `mkdir`;
 * release only removes a lock whose persisted metadata still carries the acquiring owner's token.
 *
 * This module is deliberately read-only about liveness: it never reclaims a lock because of
 * elapsed time, PID absence, or a heartbeat. A lock whose metadata is missing, invalid, or whose
 * PID is not running is reported as `recovery-required`, because a killed extension host can
 * leave installer descendants alive and reused PIDs cannot prove ownership. Only the owner
 * releases its own lock; stale locks stay in place for manual recovery (D4).
 */

/** Directory name of the cross-window install lock inside `<home>/.walker` (D4). */
export const DOTNET_INSTALL_LOCK_DIRECTORY_NAME = 'dotnet-install.lock';

/** File name of the owner metadata written atomically inside the lock directory (D4). */
export const DOTNET_INSTALL_LOCK_METADATA_FILE = 'owner.json';

/** Schema version of the lock metadata; unknown versions are ambiguous and never trusted. */
export const DOTNET_INSTALL_LOCK_SCHEMA_VERSION = 1;

/** Required prefix of the owned operation-directory basename recorded in lock metadata (D4). */
export const DOTNET_INSTALL_OPERATION_PREFIX = 'dotnet-install-';

/** Longest accepted owner token; production tokens are 32 hexadecimal characters. */
export const MAX_OWNER_TOKEN_LENGTH = 128;

/** Longest retained diagnostic string in lock metadata. */
export const MAX_LOCK_DIAGNOSTICS_LENGTH = 512;

/** Newest accepted owner PID; keeps persisted metadata inside the platform PID range. */
const MAX_OWNER_PID = 2147483647;

/** One owned operation-directory basename: the reserved prefix plus a bounded safe segment. */
const OPERATION_DIRECTORY_PATTERN = new RegExp(`^${DOTNET_INSTALL_OPERATION_PREFIX}[A-Za-z0-9][A-Za-z0-9._-]{0,47}$`);

/** Owner tokens are opaque single words; whitespace or control characters are corruption. */
const OWNER_TOKEN_PATTERN = new RegExp(`^\\S{1,${MAX_OWNER_TOKEN_LENGTH}}$`);

/** Every key the persisted metadata is allowed to contain (D4). */
const METADATA_KEYS: readonly string[] = ['schemaVersion', 'token', 'pid', 'phase', 'operationDirectory', 'diagnostics'];

/** Persisted owner metadata for the exclusive install lock (D4). */
export interface IDotnetInstallLockMetadata {
	/** Contract version; only {@link DOTNET_INSTALL_LOCK_SCHEMA_VERSION} is accepted. */
	readonly schemaVersion: typeof DOTNET_INSTALL_LOCK_SCHEMA_VERSION;
	/** Random owner token; the only value that authorizes release. */
	readonly token: string;
	/** PID of the owning extension host process. */
	readonly pid: number;
	/** Coarse operation phase for truthful other-window progress reporting. */
	readonly phase: DotnetToolchainProgressPhase;
	/** Basename of the operation directory this owner reserved under `<home>/.walker`. */
	readonly operationDirectory: string;
	/** Optional bounded plain-text diagnostic; never localized prose or secrets. */
	readonly diagnostics?: string;
}

/** Why an existing lock cannot be used or reclaimed without manual recovery. */
export type DotnetInstallLockRecoveryReason = 'metadata-missing' | 'metadata-invalid' | 'owner-not-live';

/**
 * Read-only lock status. `free` means no lock exists; `busy` means a validated live owner;
 * `recovery-required` means an existing lock cannot be validated safely; `unsafe` means a lock
 * or walker root is a symlink/reparse point or resolves outside the walker root; `failed` is an
 * unexpected filesystem error.
 */
export type DotnetInstallLockStatus =
	| { readonly kind: 'free' }
	| { readonly kind: 'busy'; readonly owner: IDotnetInstallLockMetadata }
	| { readonly kind: 'recovery-required'; readonly reason: DotnetInstallLockRecoveryReason; readonly detail: string }
	| { readonly kind: 'unsafe'; readonly detail: string }
	| { readonly kind: 'failed'; readonly detail: string };

/** Acquisition result: the acquired handle plus every non-free inspection status. */
export type DotnetInstallLockAcquireResult = { readonly kind: 'acquired'; readonly lock: IDotnetInstallLock } | Exclude<DotnetInstallLockStatus, { readonly kind: 'free' }>;

/** Why a mutation left the lock in place instead of applying it. */
export type DotnetInstallLockRetentionReason = 'token-mismatch' | 'metadata-missing' | 'metadata-invalid' | 'unsafe-lock-path' | 'unexpected-contents' | 'io-error';

/** Outcome of an owner-only mutation (`update`/`release`). */
export type DotnetInstallLockMutationResult =
	| { readonly kind: 'applied' }
	| { readonly kind: 'retained'; readonly reason: DotnetInstallLockRetentionReason; readonly detail: string };

/** Owner-updatable metadata fields; token/pid/operation directory are fixed at acquisition. */
export interface IDotnetInstallLockUpdatePatch {
	readonly phase?: DotnetToolchainProgressPhase;
	readonly diagnostics?: string;
}

/** Handle for one acquired lock; only this handle's token authorizes mutation. */
export interface IDotnetInstallLock {
	/** Absolute lock directory path, inside `<home>/.walker`. */
	readonly lockPath: string;
	/** Metadata snapshot taken at acquisition. */
	readonly metadata: IDotnetInstallLockMetadata;
	/** Rewrites the owned metadata after re-validating the token; foreign locks are retained. */
	update(patch: IDotnetInstallLockUpdatePatch): Promise<DotnetInstallLockMutationResult>;
	/** Removes only the owned lock directory; a missing lock is an idempotent success. */
	release(): Promise<DotnetInstallLockMutationResult>;
}

/** Options shared by lock inspection, acquisition, and owner handles. */
export interface IDotnetInstallLockOptions {
	readonly home: string;
	/** Local platform; defaults to `process.platform`. */
	readonly platform?: NodeJS.Platform;
	/** Injected owner-liveness proof; defaults to `process.kill(pid, 0)` semantics. */
	readonly isProcessAlive?: (pid: number) => boolean;
}

/** Acquisition options; phase and operation directory are validated before any write. */
export interface IDotnetInstallLockAcquireOptions extends IDotnetInstallLockOptions {
	readonly phase: DotnetToolchainProgressPhase;
	readonly operationDirectory: string;
	readonly diagnostics?: string;
	/** Injected owner-token factory; defaults to 16 random bytes in hexadecimal. */
	readonly createToken?: () => string;
}

/** Selects the path implementation matching the injected local platform. */
function platformPath(platform: NodeJS.Platform): path.PlatformPath {
	return platform === 'win32' ? path.win32 : path.posix;
}

/** Walker-owned root that contains both the managed SDK and the install lock: `<home>/.walker`. */
export function dotnetInstallWalkerRoot(home: string, platform: NodeJS.Platform = process.platform): string {
	return platformPath(platform).join(home, '.walker');
}

/** Home-scoped cross-window lock path: `<home>/.walker/dotnet-install.lock` (D4). */
export function dotnetInstallLockPath(home: string, platform: NodeJS.Platform = process.platform): string {
	return platformPath(platform).join(dotnetInstallWalkerRoot(home, platform), DOTNET_INSTALL_LOCK_DIRECTORY_NAME);
}

/** `ENOENT`/`ENOTDIR` mean "absent"; every other filesystem error is a real failure. */
function isNotFound(error: unknown): boolean {
	const code = (error as NodeJS.ErrnoException | undefined)?.code;
	return code === 'ENOENT' || code === 'ENOTDIR';
}

/** `EEXIST` from the exclusive `mkdir` means another owner may hold the lock. */
function isAlreadyExists(error: unknown): boolean {
	return (error as NodeJS.ErrnoException | undefined)?.code === 'EEXIST';
}

/** Bounded plain-text diagnostic for one unexpected filesystem error. */
function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProgressPhase(value: unknown): value is DotnetToolchainProgressPhase {
	return typeof value === 'string' && (DOTNET_TOOLCHAIN_PROGRESS_PHASES as readonly string[]).includes(value);
}

/** Validation shared by acquisition inputs and persisted metadata. */
function isValidOperationDirectory(value: unknown): value is string {
	return typeof value === 'string' && OPERATION_DIRECTORY_PATTERN.test(value);
}

/** Default token source: 128 bits of local randomness, never derived from time or paths. */
function createOwnerToken(): string {
	return randomBytes(16).toString('hex');
}

/** Conservative owner-liveness proof: an existing PID is treated as the owner even after reuse. */
function defaultIsProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === 'EPERM';
	}
}

/**
 * Structural validation of persisted metadata. Unknown schema versions, unknown keys, and any
 * malformed field make the lock ambiguous rather than trusted; the caller must preserve it.
 */
function parseLockMetadata(text: string): IDotnetInstallLockMetadata | undefined {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return undefined;
	}
	if (!isRecord(value) || Object.keys(value).some(key => !METADATA_KEYS.includes(key))) {
		return undefined;
	}
	if (value.schemaVersion !== DOTNET_INSTALL_LOCK_SCHEMA_VERSION) {
		return undefined;
	}
	if (typeof value.token !== 'string' || !OWNER_TOKEN_PATTERN.test(value.token)) {
		return undefined;
	}
	if (typeof value.pid !== 'number' || !Number.isInteger(value.pid) || value.pid < 1 || value.pid > MAX_OWNER_PID) {
		return undefined;
	}
	if (!isProgressPhase(value.phase) || !isValidOperationDirectory(value.operationDirectory)) {
		return undefined;
	}
	if (value.diagnostics !== undefined && (typeof value.diagnostics !== 'string' || value.diagnostics.length > MAX_LOCK_DIAGNOSTICS_LENGTH)) {
		return undefined;
	}
	return value as unknown as IDotnetInstallLockMetadata;
}

/** Writes metadata atomically: a private temporary file is renamed over `owner.json`. */
async function writeLockMetadata(lockDirectory: string, metadata: IDotnetInstallLockMetadata): Promise<void> {
	const target = path.join(lockDirectory, DOTNET_INSTALL_LOCK_METADATA_FILE);
	const temporary = `${target}.tmp-${metadata.token}`;
	try {
		await fs.writeFile(temporary, JSON.stringify(metadata), { encoding: 'utf8', mode: 0o600 });
		await fs.rename(temporary, target);
	} catch (error) {
		await fs.rm(temporary, { force: true }).catch(() => undefined);
		throw error;
	}
}

type LockPathResolution =
	| { readonly kind: 'free' }
	| { readonly kind: 'unsafe'; readonly detail: string }
	| { readonly kind: 'failed'; readonly detail: string }
	| { readonly kind: 'resolved'; readonly resolvedPath: string };

/** Human-readable refusal for a lock/root that is a symlink or not a real directory. */
function unsafeShapeDetail(target: string, stats: Awaited<ReturnType<typeof fs.lstat>>): string {
	return stats.isSymbolicLink()
		? `${target} is a symbolic link; refusing to follow it`
		: `${target} is not a directory; refusing to use it for install ownership`;
}

/**
 * Resolves the lock path without ever following a symlinked walker root or lock, requiring both
 * to be real directories and the lock to resolve inside the walker root. A missing lock/root is
 * normal absence, not an error.
 */
async function resolveLockPath(lockPath: string, walkerRoot: string, platform: NodeJS.Platform): Promise<LockPathResolution> {
	let rootStats: Awaited<ReturnType<typeof fs.lstat>>;
	try {
		rootStats = await fs.lstat(walkerRoot);
	} catch (error) {
		return isNotFound(error) ? { kind: 'free' } : { kind: 'failed', detail: describeError(error) };
	}
	if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
		return { kind: 'unsafe', detail: unsafeShapeDetail(walkerRoot, rootStats) };
	}
	let rootResolved: string;
	let lockStats: Awaited<ReturnType<typeof fs.lstat>>;
	try {
		rootResolved = await fs.realpath(walkerRoot);
		lockStats = await fs.lstat(lockPath);
	} catch (error) {
		return isNotFound(error) ? { kind: 'free' } : { kind: 'failed', detail: describeError(error) };
	}
	if (!lockStats.isDirectory() || lockStats.isSymbolicLink()) {
		return { kind: 'unsafe', detail: unsafeShapeDetail(lockPath, lockStats) };
	}
	let resolvedPath: string;
	try {
		resolvedPath = await fs.realpath(lockPath);
	} catch (error) {
		return isNotFound(error) ? { kind: 'free' } : { kind: 'failed', detail: describeError(error) };
	}
	if (!isPathWithin(rootResolved, resolvedPath, platform)) {
		return { kind: 'unsafe', detail: `resolved lock path ${resolvedPath} is outside ${rootResolved}; refusing to use it` };
	}
	return { kind: 'resolved', resolvedPath };
}

type MetadataRead =
	| { readonly kind: 'read'; readonly metadata: IDotnetInstallLockMetadata }
	| { readonly kind: 'missing' }
	| { readonly kind: 'invalid'; readonly detail: string };

/** Reads and validates `owner.json` inside an already-resolved lock directory. */
async function readLockMetadata(resolvedLockPath: string): Promise<MetadataRead> {
	const metadataPath = path.join(resolvedLockPath, DOTNET_INSTALL_LOCK_METADATA_FILE);
	let text: string;
	try {
		text = await fs.readFile(metadataPath, 'utf8');
	} catch (error) {
		return isNotFound(error)
			? { kind: 'missing' }
			: { kind: 'invalid', detail: `${metadataPath} could not be read: ${describeError(error)}` };
	}
	const metadata = parseLockMetadata(text);
	return metadata === undefined
		? { kind: 'invalid', detail: `${metadataPath} does not contain valid install-lock metadata` }
		: { kind: 'read', metadata };
}

/** Read-only status of the home-scoped install lock for other-window busy/recovery reporting. */
export async function inspectDotnetInstallLock(options: IDotnetInstallLockOptions): Promise<DotnetInstallLockStatus> {
	const platform = options.platform ?? process.platform;
	const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
	const lockPath = dotnetInstallLockPath(options.home, platform);
	const walkerRoot = dotnetInstallWalkerRoot(options.home, platform);

	const resolution = await resolveLockPath(lockPath, walkerRoot, platform);
	if (resolution.kind !== 'resolved') {
		return resolution;
	}
	const metadata = await readLockMetadata(resolution.resolvedPath);
	switch (metadata.kind) {
		case 'missing':
			return { kind: 'recovery-required', reason: 'metadata-missing', detail: `${lockPath} has no owner metadata; a previous writer may have left installer children running. Stop all Walker windows, confirm no installer remains, then remove the stale lock manually before retrying` };
		case 'invalid':
			return { kind: 'recovery-required', reason: 'metadata-invalid', detail: `${metadata.detail}; the lock is preserved for manual inspection` };
		case 'read':
			if (!isProcessAlive(metadata.metadata.pid)) {
				return { kind: 'recovery-required', reason: 'owner-not-live', detail: `owner pid ${metadata.metadata.pid} is not running; installer children may survive it. Stop all Walker windows, confirm no installer remains, then remove the stale lock manually before retrying` };
			}
			return { kind: 'busy', owner: metadata.metadata };
	}
}

/** Loads the lock for an owner mutation, requiring the persisted token to match. */
async function loadOwnedLock(lockPath: string, token: string, platform: NodeJS.Platform): Promise<{ readonly kind: 'missing-lock' } | { readonly kind: 'owned'; readonly resolvedPath: string; readonly metadata: IDotnetInstallLockMetadata } | { readonly kind: 'retained'; readonly reason: DotnetInstallLockRetentionReason; readonly detail: string }> {
	const walkerRoot = path.dirname(lockPath);
	const resolution = await resolveLockPath(lockPath, walkerRoot, platform);
	if (resolution.kind === 'free') {
		return { kind: 'missing-lock' };
	}
	if (resolution.kind !== 'resolved') {
		return resolution.kind === 'unsafe'
			? { kind: 'retained', reason: 'unsafe-lock-path', detail: resolution.detail }
			: { kind: 'retained', reason: 'io-error', detail: resolution.detail };
	}
	const metadata = await readLockMetadata(resolution.resolvedPath);
	if (metadata.kind !== 'read') {
		return { kind: 'retained', reason: metadata.kind === 'missing' ? 'metadata-missing' : 'metadata-invalid', detail: metadata.kind === 'missing' ? `the install lock at ${lockPath} lost its owner metadata` : metadata.detail };
	}
	if (metadata.metadata.token !== token) {
		return { kind: 'retained', reason: 'token-mismatch', detail: `the install lock at ${lockPath} is owned by another token; refusing to modify it` };
	}
	return { kind: 'owned', resolvedPath: resolution.resolvedPath, metadata: metadata.metadata };
}

/** Creates the owner handle whose token authorizes `update` and `release`. */
function createLockHandle(lockPath: string, metadata: IDotnetInstallLockMetadata, platform: NodeJS.Platform): IDotnetInstallLock {
	return {
		lockPath,
		metadata,
		update: async (patch: IDotnetInstallLockUpdatePatch): Promise<DotnetInstallLockMutationResult> => {
			if ((patch.phase !== undefined && !isProgressPhase(patch.phase)) || (patch.diagnostics !== undefined && (typeof patch.diagnostics !== 'string' || patch.diagnostics.length > MAX_LOCK_DIAGNOSTICS_LENGTH))) {
				return { kind: 'retained', reason: 'metadata-invalid', detail: 'refusing to persist invalid owner metadata' };
			}
			const owned = await loadOwnedLock(lockPath, metadata.token, platform);
			if (owned.kind === 'missing-lock') {
				return { kind: 'retained', reason: 'metadata-missing', detail: `the install lock at ${lockPath} no longer exists` };
			}
			if (owned.kind === 'retained') {
				return owned;
			}
			const next: IDotnetInstallLockMetadata = { ...owned.metadata, phase: patch.phase ?? owned.metadata.phase, diagnostics: patch.diagnostics ?? owned.metadata.diagnostics };
			try {
				await writeLockMetadata(owned.resolvedPath, next);
				return { kind: 'applied' };
			} catch (error) {
				return { kind: 'retained', reason: 'io-error', detail: describeError(error) };
			}
		},
		release: async (): Promise<DotnetInstallLockMutationResult> => {
			const owned = await loadOwnedLock(lockPath, metadata.token, platform);
			if (owned.kind === 'missing-lock') {
				return { kind: 'applied' };
			}
			if (owned.kind === 'retained') {
				return owned;
			}
			const allowedEntries = new Set([DOTNET_INSTALL_LOCK_METADATA_FILE, `${DOTNET_INSTALL_LOCK_METADATA_FILE}.tmp-${metadata.token}`]);
			let entries: string[];
			try {
				entries = await fs.readdir(owned.resolvedPath);
			} catch (error) {
				return { kind: 'retained', reason: 'io-error', detail: describeError(error) };
			}
			const unexpected = entries.filter(entry => !allowedEntries.has(entry));
			if (unexpected.length > 0) {
				return { kind: 'retained', reason: 'unexpected-contents', detail: `${lockPath} contains unexpected entries (${unexpected.join(', ')}); leaving the lock for manual inspection` };
			}
			try {
				await fs.rm(owned.resolvedPath, { recursive: true, force: false });
				return { kind: 'applied' };
			} catch (error) {
				return isNotFound(error) ? { kind: 'applied' } : { kind: 'retained', reason: 'io-error', detail: describeError(error) };
			}
		},
	};
}

/**
 * Acquires the exclusive home-scoped install lock with an atomic `mkdir` and atomically written
 * owner metadata. When another live owner holds the lock the result is `busy`; when an existing
 * lock cannot be validated the result is `recovery-required` and the lock is preserved. Acquired
 * input is validated before any filesystem write, and only the returned handle can release the
 * lock it created.
 */
export async function acquireDotnetInstallLock(options: IDotnetInstallLockAcquireOptions): Promise<DotnetInstallLockAcquireResult> {
	const platform = options.platform ?? process.platform;
	const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
	const createToken = options.createToken ?? createOwnerToken;
	const walkerRoot = dotnetInstallWalkerRoot(options.home, platform);
	const lockPath = dotnetInstallLockPath(options.home, platform);

	if (!isValidOperationDirectory(options.operationDirectory) || !isProgressPhase(options.phase)
		|| (options.diagnostics !== undefined && (typeof options.diagnostics !== 'string' || options.diagnostics.length > MAX_LOCK_DIAGNOSTICS_LENGTH))) {
		return { kind: 'failed', detail: 'refusing to acquire the install lock without valid owner metadata inputs' };
	}

	try {
		await fs.mkdir(walkerRoot, { recursive: true });
	} catch (error) {
		return { kind: 'failed', detail: `could not create ${walkerRoot}: ${describeError(error)}` };
	}
	const rootStats = await fs.lstat(walkerRoot).catch(() => undefined);
	if (rootStats === undefined) {
		return { kind: 'failed', detail: `could not inspect ${walkerRoot}` };
	}
	if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
		return { kind: 'unsafe', detail: unsafeShapeDetail(walkerRoot, rootStats) };
	}

	try {
		await fs.mkdir(lockPath);
	} catch (error) {
		if (isAlreadyExists(error)) {
			const competing = await inspectDotnetInstallLock({ home: options.home, platform, isProcessAlive });
			return competing.kind === 'free'
				? { kind: 'failed', detail: `the install lock at ${lockPath} changed while acquiring; retry setup` }
				: competing;
		}
		return { kind: 'failed', detail: `could not create the install lock at ${lockPath}: ${describeError(error)}` };
	}

	const metadata: IDotnetInstallLockMetadata = {
		schemaVersion: DOTNET_INSTALL_LOCK_SCHEMA_VERSION,
		token: createToken(),
		pid: process.pid,
		phase: options.phase,
		operationDirectory: options.operationDirectory,
		...(options.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
	};
	try {
		await writeLockMetadata(lockPath, metadata);
	} catch (error) {
		// This call created the directory, so removing it cannot disturb another owner.
		await fs.rm(lockPath, { recursive: true, force: true }).catch(() => undefined);
		return { kind: 'failed', detail: `could not write install-lock metadata: ${describeError(error)}` };
	}
	return { kind: 'acquired', lock: createLockHandle(lockPath, metadata, platform) };
}
