/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomBytes } from 'node:crypto';
import * as path from 'node:path';
import { discoverDotnetCandidates, type IDotnetCandidate } from './candidates';
import {
	DOTNET_TOOLCHAIN_SCHEMA_VERSION,
	type DotnetToolchainFailureStage,
	type DotnetToolchainProgressPhase,
	type DotnetToolchainState,
	type IEnvironmentAdapter,
	type IFileSystemAdapter,
	type IDotnetToolchainFailure,
	type IDotnetToolchainProgress,
	type IDotnetToolchainSnapshot,
	type IDotnetToolchainVerified,
	type IProcessAdapter,
	type IToolchainUi,
} from './contracts';
import {
	dotnetProxyEnvironment,
	dotnetProxyPowerShellArguments,
	downloadDotnetInstallScript,
	parseDotnetInstallDryRunOutput,
	type DotnetProxyResolution,
	type IDotnetScriptFileWriter,
	type IDotnetScriptTransport,
} from './download';
import {
	prepareDotnetDownloaderShim,
	type DotnetDownloaderShimResult,
	type IPrepareDotnetDownloaderShimOptions,
} from './downloaderShim';
import {
	acquireDotnetInstallLock,
	DOTNET_INSTALL_OPERATION_PREFIX,
	inspectDotnetInstallLock,
	isValidDotnetOperationDirectory,
	type DotnetInstallLockStatus,
	type IDotnetInstallLock,
} from './installLock';
import { buildDotnetInstallInvocation, type IDotnetInstallSelection } from './platformArguments';
import { probeDotnetCandidates, verifyExpectedManagedSdk } from './probe';
import { type IDotnetInstallerProcessResult, type IDotnetInstallerProcessRunner } from './processRunner';
import { dotnetInstallScriptPin, type IDotnetInstallScriptPin } from './scriptSource';
import { type IDotnetSelectionPrompter } from './selection';
import {
	dotnetTransactionPaths,
	prepareDotnetInstallStage,
	publishDotnetInstallStage,
	removeOwnedOperationDirectory,
	type DotnetPublishedSdkVerification,
	type IDotnetPublicationFileOperations,
	type IDotnetPublishedSdkVerificationContext,
	type IDotnetStageFileOperations,
} from './transaction';

/** Bound for the channel dry-run metadata invocation; separate from the install operation budget. */
export const DOTNET_DRY_RUN_TIMEOUT_MS = 60_000;

/** Longest retained installer process diagnostic; script output must not grow toolchain output. */
const MAX_INSTALLER_DIAGNOSTICS_LENGTH = 300;

/**
 * Cancellation source owned by the caller (the command layer bridges a `vscode.CancellationToken`
 * into this shape). Cancellation never mutates state on its own: the controller checks it at every
 * phase boundary, aborts in-flight script retrieval, and stops owned installer process trees.
 */
export interface IDotnetSetupCancellation {
	readonly isCancellationRequested: boolean;
	/** Registers one listener for the cancellation request; returns a disposer. */
	onCancellationRequested?(listener: () => void): () => void;
}

/** One explicit setup invocation; command arguments are accepted only to be ignored (D3). */
export interface IDotnetSetupRequest {
	readonly cancellation?: IDotnetSetupCancellation;
	/** Raw command arguments; the chooser never turns them into a channel, version, or destination. */
	readonly externalArguments?: readonly unknown[];
}

/** Snapshot source and orchestration entry points consumed by the command/status layer (B8). */
export interface IDotnetInstallerController {
	/** Immediate versioned snapshot; it never starts or waits for work. */
	getSnapshot(): IDotnetToolchainSnapshot;
	/** Coalesced fresh detection; reports the active operation instead of racing publication. */
	recheck(): Promise<IDotnetToolchainSnapshot>;
	/** Runs the required prompts and the install pipeline; never rejects. */
	setup(request?: IDotnetSetupRequest): Promise<IDotnetToolchainSnapshot>;
	/** Marks the controller disposed, discards late completions, and stops owned installer children. */
	dispose(): void;
}

/** Construction inputs; every boundary the pipeline touches is injected and never inferred. */
export interface IDotnetInstallerControllerOptions {
	readonly ui: IToolchainUi;
	/** Local machine facts; the home is the local user home, never a workspace path. */
	readonly environment: IEnvironmentAdapter;
	readonly fileSystem: IFileSystemAdapter;
	/** Current local workspace roots, read for every detection pass so workspace candidates are excluded. */
	readonly workspaceRoots: () => readonly string[];
	/** Explicit LTS / STS / exact-version prompter; own the single-flight chooser (B1). */
	readonly selection: IDotnetSelectionPrompter;
	/** Probe boundary for detection and install verification; `node:child_process` stays in B2/B3. */
	readonly process: IProcessAdapter;
	/** Cancellable installer process-tree runner (B3). */
	readonly installerProcess: IDotnetInstallerProcessRunner;
	/** Owned temporary directory every probe invocation runs in; never a workspace directory. */
	readonly temporaryDirectory: string;
	/** Bounded, digest-validated script retrieval (B2). */
	readonly transport: IDotnetScriptTransport;
	readonly scriptFileWriter: IDotnetScriptFileWriter;
	/** Process-scoped HTTPS-only curl/wget shim factory; defaults to the owned operation-directory implementation. */
	readonly createDownloaderShim?: (options: IPrepareDotnetDownloaderShimOptions) => Promise<DotnetDownloaderShimResult>;
	/** Resolved user/machine proxy policy; defaults to a direct connection. */
	readonly proxy?: DotnetProxyResolution;
	/** Test-only pin seam; defaults to the reviewed pin for the local platform. */
	readonly scriptPin?: IDotnetInstallScriptPin;
	/** Injected owner-liveness proof for lock inspection; defaults to a real PID check. */
	readonly isProcessAlive?: (pid: number) => boolean;
	/** Owned operation-directory nonce; defaults to 16 random bytes in hexadecimal. */
	readonly createOperationNonce?: () => string;
	/** Fault-injection seam for stage preparation; defaults to the real filesystem (B5). */
	readonly stageFileOperations?: Partial<IDotnetStageFileOperations>;
	/** Fault-injection seam for journaled publication; defaults to the real filesystem (B6). */
	readonly publicationFileOperations?: Partial<IDotnetPublicationFileOperations>;
}

/** Snapshot fields one transition may carry. */
interface ISnapshotDetail {
	readonly verified?: IDotnetToolchainVerified;
	readonly failure?: IDotnetToolchainFailure;
	readonly progress?: IDotnetToolchainProgress;
}

/** Selects the path implementation matching the local platform. */
function platformPath(platform: NodeJS.Platform): path.PlatformPath {
	return platform === 'win32' ? path.win32 : path.posix;
}

/** Executable inside one owned directory; the stage uses the same binary name as the managed root. */
function executableInDirectory(directory: string, platform: NodeJS.Platform): string {
	return platformPath(platform).join(directory, platform === 'win32' ? 'dotnet.exe' : 'dotnet');
}

/** One managed candidate pinned to an owned executable; no other installation may substitute (D2). */
function managedCandidate(executable: string): IDotnetCandidate {
	return { executable, resolvedExecutable: executable, origin: 'managed' };
}

/** Bounds one installer process diagnostic so output never grows with script logs. */
function processDiagnostic(result: IDotnetInstallerProcessResult): string {
	const text = `${result.stderr}\n${result.stdout}`.replace(/\s+/g, ' ').trim();
	return text.length > MAX_INSTALLER_DIAGNOSTICS_LENGTH ? `…${text.slice(-MAX_INSTALLER_DIAGNOSTICS_LENGTH)}` : text;
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Creates the install state machine: explicit selection, exclusive lock, owned stage preparation,
 * trusted script download, official-script execution, expected-version verification, journaled
 * publication, and a fresh re-detection after cancellation. A generation counter discards stale
 * detection completions, setup failures stay visible until an explicit recheck, and a recheck during
 * an active operation reports the current snapshot instead of racing publication (D4).
 */
export function createDotnetInstallerController(options: IDotnetInstallerControllerOptions): IDotnetInstallerController {
	const { ui, environment, fileSystem, selection, installerProcess, temporaryDirectory, transport, scriptFileWriter } = options;
	const probeProcess = options.process;
	const home = environment.home;
	const platform = environment.platform;
	const pin = options.scriptPin ?? dotnetInstallScriptPin(platform);
	const proxy = options.proxy ?? { kind: 'direct' };
	const createNonce = options.createOperationNonce ?? (() => randomBytes(16).toString('hex'));
	const isProcessAlive = options.isProcessAlive === undefined ? {} : { isProcessAlive: options.isProcessAlive };

	let generation = 0;
	let revision = 0;
	let disposed = false;
	let setupPhase: 'idle' | 'selecting' | 'working' = 'idle';
	let detection: Promise<IDotnetToolchainSnapshot> | undefined;
	let detectionGeneration = -1;
	let snapshot: IDotnetToolchainSnapshot = { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, revision: 0, state: 'checking', locality: 'local' };

	/** Applies one transition only while it still belongs to the newest generation. */
	const updateSnapshot = (state: DotnetToolchainState, detail: ISnapshotDetail, guard: number): IDotnetToolchainSnapshot => {
		if (disposed || guard !== generation) {
			return snapshot;
		}
		revision += 1;
		snapshot = {
			schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION,
			revision,
			state,
			locality: 'local',
			...(detail.verified === undefined ? {} : { verified: detail.verified }),
			...(detail.failure === undefined ? {} : { failure: detail.failure }),
			...(detail.progress === undefined ? {} : { progress: detail.progress }),
		};
		return snapshot;
	};

	const failSnapshot = (stage: DotnetToolchainFailureStage, code: string, diagnostic: string | undefined, guard: number): IDotnetToolchainSnapshot => {
		ui.appendOutput(`[${stage}] ${code}${diagnostic === undefined || diagnostic === '' ? '' : `: ${diagnostic}`}`);
		return updateSnapshot('failed', { failure: { stage, code } }, guard);
	};

	/** Installing covers every pre-publication phase; verifying covers verification and finalization. */
	const phaseState = (phase: DotnetToolchainProgressPhase): DotnetToolchainState =>
		phase === 'verifying' || phase === 'finalizing' ? 'verifying' : 'installing';

	/** Turns a non-free lock inspection into busy progress or an explicit recovery failure. */
	const lockStatusSnapshot = (status: Exclude<DotnetInstallLockStatus, { readonly kind: 'free' }>, guard: number): IDotnetToolchainSnapshot => {
		if (status.kind === 'busy') {
			return updateSnapshot(phaseState(status.owner.phase), { progress: { phase: status.owner.phase, otherWindow: true } }, guard);
		}
		const code = status.kind === 'recovery-required' ? status.reason : status.kind === 'unsafe' ? 'unsafe-lock' : 'lock-inspection-failed';
		return failSnapshot('recovery', code, status.detail, guard);
	};

	/** Starts one detection pass; every completion is generation-guarded before it can change state. */
	const startDetection = (): Promise<IDotnetToolchainSnapshot> => {
		if (disposed) {
			return Promise.resolve(snapshot);
		}
		const guard = ++generation;
		const run = (async (): Promise<IDotnetToolchainSnapshot> => {
			try {
				const lockStatus = await inspectDotnetInstallLock({ home, platform, ...isProcessAlive });
				if (disposed || guard !== generation) {
					return snapshot;
				}
				if (lockStatus.kind !== 'free') {
					return lockStatusSnapshot(lockStatus, guard);
				}
				const discovery = await discoverDotnetCandidates({ environment, fileSystem, workspaceRoots: options.workspaceRoots() });
				const probed = await probeDotnetCandidates(discovery, { process: probeProcess, environment, cwd: temporaryDirectory });
				if (disposed || guard !== generation) {
					return snapshot;
				}
				for (const line of probed.diagnostics) {
					ui.appendOutput(line);
				}
				switch (probed.outcome.kind) {
					case 'ready':
						return updateSnapshot('ready', { verified: { executable: probed.outcome.executable, sdkVersion: probed.outcome.sdkVersion } }, guard);
					case 'runtimeOnly':
						return updateSnapshot('runtimeOnly', {}, guard);
					case 'missing':
						return updateSnapshot('missing', {}, guard);
					case 'failed':
						return failSnapshot('detect', probed.outcome.code, probed.outcome.diagnostic, guard);
				}
			} catch (error) {
				return failSnapshot('detect', 'unexpected-error', describeError(error), guard);
			}
		})();
		const clear = (): void => {
			if (detectionGeneration === guard) {
				detection = undefined;
				detectionGeneration = -1;
			}
		};
		detection = run;
		detectionGeneration = guard;
		void run.then(clear, clear);
		return run;
	};

	const recheck = (): Promise<IDotnetToolchainSnapshot> => {
		if (disposed || setupPhase !== 'idle') {
			return Promise.resolve(snapshot);
		}
		return detection ?? startDetection();
	};

	const setup = (request?: IDotnetSetupRequest): Promise<IDotnetToolchainSnapshot> => {
		if (disposed) {
			return Promise.resolve(snapshot);
		}
		if (setupPhase === 'selecting') {
			// The prompter owns in-process single flight: this reveals the open chooser (B1).
			return selection.select(request?.externalArguments).then(() => snapshot);
		}
		if (setupPhase === 'working') {
			return Promise.resolve(snapshot);
		}
		setupPhase = 'selecting';
		detection = undefined;
		detectionGeneration = -1;
		const guard = ++generation;
		return runSetup(guard, request)
			.catch(error => failSnapshot('process', 'unexpected-error', describeError(error), guard))
			.finally(() => {
				setupPhase = 'idle';
			});
	};

	const runSetup = async (guard: number, request?: IDotnetSetupRequest): Promise<IDotnetToolchainSnapshot> => {
		const selected = await selection.select(request?.externalArguments);
		if (disposed || guard !== generation) {
			return snapshot;
		}
		if (selected.kind !== 'selected') {
			return selected.kind === 'failed'
				? failSnapshot('process', selected.failure.code, selected.failure.diagnostic, guard)
				: snapshot;
		}
		setupPhase = 'working';
		return await runInstall(guard, selected.selection, request?.cancellation);
	};

	/** Executes exactly this managed executable and version; another SDK never substitutes (D2). */
	const verifyPublishedManagedSdk = async (context: IDotnetPublishedSdkVerificationContext, expectedVersion: string): Promise<DotnetPublishedSdkVerification> => {
		const verification = await verifyExpectedManagedSdk({
			process: probeProcess,
			environment,
			cwd: temporaryDirectory,
			candidate: managedCandidate(context.executable),
			expectedVersion,
		});
		return verification.kind === 'verified'
			? { kind: 'verified', executable: verification.executable, sdkVersion: verification.sdkVersion }
			: { kind: 'failed', code: verification.code, diagnostic: verification.diagnostic };
	};

	const runInstall = async (guard: number, selected: IDotnetInstallSelection, cancellation?: IDotnetSetupCancellation): Promise<IDotnetToolchainSnapshot> => {
		const operationDirectory = `${DOTNET_INSTALL_OPERATION_PREFIX}${createNonce()}`;
		if (!isValidDotnetOperationDirectory(operationDirectory)) {
			return failSnapshot('publish', 'operation-directory-invalid', 'the generated operation directory is not a valid owned name', guard);
		}
		const paths = dotnetTransactionPaths(home, operationDirectory, platform);
		const acquired = await acquireDotnetInstallLock({
			home,
			platform,
			operationDirectory,
			phase: 'preparing',
			diagnostics: 'preparing the managed .NET SDK installation',
			...isProcessAlive,
		});
		if (acquired.kind !== 'acquired') {
			return lockStatusSnapshot(acquired, guard);
		}
		const lock: IDotnetInstallLock = acquired.lock;
		const abort = new AbortController();
		const disposeCancellation = cancellation?.onCancellationRequested?.(() => {
			abort.abort();
			installerProcess.cancel();
		});
		const cancellationOption = cancellation === undefined ? {} : { cancellation };
		const canceled = (): boolean => cancellation?.isCancellationRequested === true;
		let releaseLock = true;

		try {
			/** Claims one lock phase and publishes the matching progress snapshot. */
			const enterPhase = async (phase: DotnetToolchainProgressPhase, diagnostics: string): Promise<IDotnetToolchainSnapshot | undefined> => {
				const applied = await lock.update({ phase, diagnostics });
				if (applied.kind !== 'applied') {
					releaseLock = false;
					return failSnapshot('recovery', 'lock-update-failed', `the install lock could not be updated (${applied.reason}): ${applied.detail}`, guard);
				}
				updateSnapshot(phaseState(phase), { progress: { phase, otherWindow: false } }, guard);
				return undefined;
			};

			/** Releases only this operation's token; a retained lock becomes an explicit recovery failure. */
			const releaseOwnedLock = async (): Promise<IDotnetToolchainSnapshot | undefined> => {
				releaseLock = false;
				const released = await lock.release();
				return released.kind === 'applied' ? undefined : failSnapshot('recovery', `lock-${released.reason}`, released.detail, guard);
			};

			/** Stops a safely terminated operation: discard owned data, release, then re-detect (D4). */
			const cancelOperation = async (): Promise<IDotnetToolchainSnapshot> => {
				await removeOwnedOperationDirectory(paths.operationDirectory);
				const releaseFailure = await releaseOwnedLock();
				return releaseFailure ?? await startDetection();
			};

			/** Discards owned pre-publication data after an ordinary failure and reports the failure. */
			const failBeforePublication = async (stage: DotnetToolchainFailureStage, code: string, diagnostic: string): Promise<IDotnetToolchainSnapshot> => {
				await removeOwnedOperationDirectory(paths.operationDirectory);
				return failSnapshot(stage, code, diagnostic, guard);
			};

			/** Classifies one installer execution; `undefined` means a clean zero exit and work continues. */
			const classifyExecution = async (result: IDotnetInstallerProcessResult, stage: DotnetToolchainFailureStage, exitCode: string): Promise<IDotnetToolchainSnapshot | undefined> => {
				const diagnostic = processDiagnostic(result);
				if (result.outcome === 'terminated') {
					return result.terminationReason === 'timeout'
						? await failBeforePublication(stage, 'timeout', `the operation exceeded its time budget: ${diagnostic}`)
						: await cancelOperation();
				}
				if (result.outcome === 'recovery-required') {
					// Process-tree exit could not be proven: retain the lock and every owned artifact.
					releaseLock = false;
					return failSnapshot('recovery', 'process-tree-recovery-required', diagnostic, guard);
				}
				if (result.outcome === 'spawn-failed') {
					return await failBeforePublication(stage, 'spawn-failed', diagnostic);
				}
				return result.exitCode === 0 ? undefined : await failBeforePublication(stage, exitCode, diagnostic);
			};

			const preparing = await enterPhase('preparing', 'preparing the owned install stage');
			if (preparing !== undefined) {
				return preparing;
			}
			const staged = await prepareDotnetInstallStage({
				home,
				lock,
				platform,
				...cancellationOption,
				...(options.stageFileOperations === undefined ? {} : { fileOperations: options.stageFileOperations }),
			});
			if (staged.kind === 'canceled') {
				return await cancelOperation();
			}
			if (staged.kind === 'failed') {
				// Stage preparation already decided whether owned data is retained or removed (B5).
				return failSnapshot(staged.failure.stage, staged.failure.code, staged.failure.diagnostic, guard);
			}
			const prepared = staged.prepared;

			if (canceled()) {
				return await cancelOperation();
			}
			const downloading = await enterPhase('downloading', 'downloading the reviewed official install script');
			if (downloading !== undefined) {
				return downloading;
			}
			const script = await downloadDotnetInstallScript({
				pin,
				operationDirectory: paths.operationDirectory,
				transport,
				fileWriter: scriptFileWriter,
				proxy,
				signal: abort.signal,
			});
			if (script.kind === 'canceled') {
				return await cancelOperation();
			}
			if (script.kind === 'failed') {
				return await failBeforePublication(script.failure.stage, script.failure.code, script.failure.diagnostic);
			}
			if (script.scriptPath !== prepared.scriptPath) {
				return await failBeforePublication('download', 'unexpected-script-path', 'the verified script was not written to the reserved owned path');
			}

			const downloaderShim = await (options.createDownloaderShim ?? prepareDotnetDownloaderShim)({ operationDirectory: paths.operationDirectory, environment });
			if (downloaderShim.kind === 'failed') {
				return await failBeforePublication('process', downloaderShim.failure.code, downloaderShim.failure.diagnostic);
			}
			const installerEnvironment = {
				...dotnetProxyEnvironment(proxy),
				...(downloaderShim.kind === 'prepared' ? downloaderShim.shim.environment : {}),
			};

			const proxyArguments = dotnetProxyPowerShellArguments(proxy);
			const buildInvocation = (dryRun: boolean) => buildDotnetInstallInvocation({
				environment,
				fileSystem,
				selection: selected,
				scriptPath: prepared.scriptPath,
				stageDirectory: prepared.stageDirectory,
				...(dryRun ? { dryRun: true } : {}),
				...(proxyArguments.length === 0 ? {} : { proxyArguments }),
			});
			const invocation = await buildInvocation(false);
			if (invocation.kind === 'failed') {
				return await failBeforePublication('process', invocation.failure.code, invocation.failure.diagnostic);
			}

			let expectedVersion: string;
			if (selected.kind === 'version') {
				expectedVersion = selected.version;
			} else {
				// Resolve the channel to one version with the official dry-run, then install that channel.
				const dryRun = await buildInvocation(true);
				if (dryRun.kind === 'failed') {
					return await failBeforePublication('process', dryRun.failure.code, dryRun.failure.diagnostic);
				}
				const dryRunResult = await installerProcess.run({ ...dryRun.invocation, env: installerEnvironment, timeoutMs: DOTNET_DRY_RUN_TIMEOUT_MS });
				const dryRunFailure = await classifyExecution(dryRunResult, 'download', 'channel-resolution-failed');
				if (dryRunFailure !== undefined) {
					return dryRunFailure;
				}
				const resolved = parseDotnetInstallDryRunOutput(dryRunResult.stdout);
				if (resolved.kind !== 'resolved') {
					return await failBeforePublication('download', 'channel-unresolved', `the channel dry-run did not resolve one unambiguous version (${resolved.reason})`);
				}
				expectedVersion = resolved.version;
			}

			if (canceled()) {
				return await cancelOperation();
			}
			const installing = await enterPhase('installing', 'running the official install script into the owned stage');
			if (installing !== undefined) {
				return installing;
			}
			const installed = await installerProcess.run({ ...invocation.invocation, env: installerEnvironment });
			const installFailure = await classifyExecution(installed, 'process', 'installer-exit');
			if (installFailure !== undefined) {
				return installFailure;
			}

			const verifying = await enterPhase('verifying', 'verifying the staged managed SDK');
			if (verifying !== undefined) {
				return verifying;
			}
			const stageVerification = await verifyExpectedManagedSdk({
				process: probeProcess,
				environment,
				cwd: temporaryDirectory,
				candidate: managedCandidate(executableInDirectory(prepared.stageDirectory, platform)),
				expectedVersion,
			});
			if (canceled()) {
				return await cancelOperation();
			}
			if (stageVerification.kind !== 'verified') {
				return await failBeforePublication('verify', stageVerification.code, stageVerification.diagnostic);
			}

			const publication = await publishDotnetInstallStage({
				home,
				lock,
				prepared,
				verifyPublished: context => verifyPublishedManagedSdk(context, expectedVersion),
				platform,
				...cancellationOption,
				...(options.publicationFileOperations === undefined ? {} : { fileOperations: options.publicationFileOperations }),
			});
			if (publication.kind === 'published') {
				ui.appendOutput(`published the managed .NET SDK ${publication.published.sdkVersion} at ${publication.published.executable}`);
				return updateSnapshot('ready', { verified: { executable: publication.published.executable, sdkVersion: publication.published.sdkVersion } }, guard);
			}
			if (publication.kind === 'canceled') {
				return await cancelOperation();
			}
			if (publication.restoration === 'recovery-required') {
				// The pre-publication managed state could not be proven; keep lock, journal, and backup.
				releaseLock = false;
				return failSnapshot('recovery', publication.failure.code, publication.failure.diagnostic, guard);
			}
			return failSnapshot(publication.failure.stage, publication.failure.code, publication.failure.diagnostic, guard);
		} catch (error) {
			releaseLock = false;
			return failSnapshot('recovery', 'unexpected-error', describeError(error), guard);
		} finally {
			disposeCancellation?.();
			if (releaseLock) {
				await lock.release();
			}
		}
	};

	return {
		getSnapshot: () => snapshot,
		recheck,
		setup,
		dispose: () => {
			disposed = true;
			generation += 1;
			installerProcess.deactivate();
		},
	};
}
