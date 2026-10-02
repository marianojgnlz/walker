/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { type IProcessAdapter, type IProcessExecution, type IProcessExecutionResult } from './contracts';
import { DEFAULT_WINDOWS_SYSTEM_ROOT } from './platformArguments';

/** Per-command probe timeout from design D2; a non-positive `timeoutMs` selects this default. */
export const DEFAULT_PROBE_TIMEOUT_MS = 10_000;

/** Overall installer operation budget from design D4: 20 minutes. */
export const DOTNET_INSTALL_TIMEOUT_MS = 20 * 60 * 1000;

/** Bounded wait between process-tree TERM and KILL escalation (D4). */
export const DEFAULT_TREE_TERMINATION_GRACE_MS = 5_000;

/** Bounded wait for proven process-tree exit after a termination signal (D4). */
export const DEFAULT_TREE_TERMINATION_WAIT_MS = 10_000;

/** Poll interval used while waiting for proven process-tree exit (D4). */
export const DEFAULT_TREE_TERMINATION_POLL_MS = 100;

/** Maximum stdout bytes retained per invocation; further output is dropped and marked. */
export const MAX_PROCESS_STDOUT_BYTES = 1024 * 1024;

/** Maximum stderr bytes retained per invocation for diagnostics. */
export const MAX_PROCESS_STDERR_BYTES = 64 * 1024;

/** Inherited environment variables that can redirect .NET execution or source shell startup hooks. */
const STRIPPED_INHERITED_ENVIRONMENT_KEY = /^(?:DOTNET_|MSBUILD|BASH_ENV$|ENV$|SHELLOPTS$|BASHOPTS$|CDPATH$|GLOBIGNORE$|PS4$|PROMPT_COMMAND$|BASH_FUNC_)/i;

/** Shell startup hooks are forbidden even when supplied as per-invocation child overrides. */
const STRIPPED_SHELL_STARTUP_ENVIRONMENT_KEY = /^(?:BASH_ENV|ENV|SHELLOPTS|BASHOPTS|CDPATH|GLOBIGNORE|PS4|PROMPT_COMMAND|BASH_FUNC_.*)$/i;

/** Timer boundary injected so timeout behavior never depends on real time in tests. */
export interface IProcessRunnerClock {
	setTimeout(callback: () => void, timeoutMs: number): unknown;
	clearTimeout(handle: unknown): void;
	now(): number;
}

/** Minimal readable surface used to capture bounded child output. */
export interface IProcessRunnerStream {
	on(event: 'data', listener: (chunk: Buffer) => void): unknown;
	removeListener(event: 'data', listener: (chunk: Buffer) => void): void;
}

/** Minimal child-process surface required by the runner; Node's `ChildProcess` satisfies it. */
export interface IProcessRunnerChild {
	readonly stdout: IProcessRunnerStream | null;
	readonly stderr: IProcessRunnerStream | null;
	/** Platform process identifier; absent when Node could not create a process. */
	readonly pid?: number;
	on(event: 'error', listener: (error: Error) => void): unknown;
	on(event: 'close', listener: (code: number | null, signal: string | null) => void): unknown;
	removeListener(event: 'error', listener: (error: Error) => void): void;
	removeListener(event: 'close', listener: (code: number | null, signal: string | null) => void): void;
	kill(signal?: NodeJS.Signals): boolean;
}

/** Fixed spawn options; `shell: false` and hidden windows are probe safety invariants. */
export interface IProcessSpawnOptions {
	readonly cwd: string;
	readonly env: Readonly<Record<string, string>>;
	readonly shell: false;
	readonly windowsHide: true;
	readonly stdio: ['ignore', 'pipe', 'pipe'];
	/** Unix process-group creation for installer trees; false for probes and Windows installers. */
	readonly detached: boolean;
}

/** Injected spawn returning a child handle; the default wraps `child_process.spawn`. */
export type ProcessSpawn = (executable: string, args: readonly string[], options: IProcessSpawnOptions) => IProcessRunnerChild;

/** Construction options for {@link createProcessRunner}. */
export interface IProcessRunnerOptions {
	readonly spawn?: ProcessSpawn;
	readonly clock?: IProcessRunnerClock;
	/** Base environment copied and sanitized per invocation; defaults to `process.env`. */
	readonly baseEnv?: Readonly<Record<string, string | undefined>>;
	/** Overall budget shared by all invocations, measured from runner creation. */
	readonly overallBudgetMs?: number;
}

interface IBoundedOutput {
	push(chunk: Buffer): void;
	text(): string;
}

/** Collects at most `maxBytes` of one stream and marks dropped output. */
function createBoundedOutput(stream: 'stdout' | 'stderr', maxBytes: number): IBoundedOutput {
	const chunks: Buffer[] = [];
	let length = 0;
	let truncated = false;
	return {
		push: chunk => {
			const remaining = maxBytes - length;
			if (remaining <= 0) {
				truncated = true;
				return;
			}
			chunks.push(remaining < chunk.length ? chunk.subarray(0, remaining) : chunk);
			length += Math.min(remaining, chunk.length);
			truncated ||= remaining < chunk.length;
		},
		text: () => Buffer.concat(chunks, length).toString('utf8') + (truncated ? `\n[${stream} truncated at ${maxBytes} bytes]` : ''),
	};
}

/** Strips inherited .NET and shell startup overrides, then applies safe child-only values. */
function createChildEnvironment(baseEnv: Readonly<Record<string, string | undefined>>, childEnv: Readonly<Record<string, string>>): Record<string, string> {
	const environment: Record<string, string> = {};
	for (const [key, value] of Object.entries(baseEnv)) {
		if (value !== undefined && !STRIPPED_INHERITED_ENVIRONMENT_KEY.test(key)) {
			environment[key] = value;
		}
	}
	for (const [key, value] of Object.entries(childEnv)) {
		if (!STRIPPED_SHELL_STARTUP_ENVIRONMENT_KEY.test(key)) {
			environment[key] = value;
		}
	}
	return environment;
}

/** Builds the single fixed spawn-options shape every invocation uses. */
function createSpawnOptions(cwd: string, env: Readonly<Record<string, string>>, detached: boolean): IProcessSpawnOptions {
	return { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached };
}

/** Attaches bounded data capture to a spawned child and returns a disposer for its listeners. */
function attachBoundedOutput(child: IProcessRunnerChild, stdout: IBoundedOutput, stderr: IBoundedOutput): () => void {
	const onStdout = (chunk: Buffer): void => stdout.push(chunk);
	const onStderr = (chunk: Buffer): void => stderr.push(chunk);
	child.stdout?.on('data', onStdout);
	child.stderr?.on('data', onStderr);
	return () => {
		child.stdout?.removeListener('data', onStdout);
		child.stderr?.removeListener('data', onStderr);
	};
}

/** Removes the error/close listeners of one invocation; stream listeners use their own disposer. */
function detachChildListeners(child: IProcessRunnerChild | undefined, onError: (error: Error) => void, onClose: (code: number | null, signal: string | null) => void): void {
	child?.removeListener('error', onError);
	child?.removeListener('close', onClose);
}

const realClock: IProcessRunnerClock = {
	setTimeout: (callback, timeoutMs) => setTimeout(callback, timeoutMs),
	clearTimeout: handle => clearTimeout(handle as NodeJS.Timeout),
	now: () => Date.now(),
};

const defaultSpawn: ProcessSpawn = (executable, args, options) => spawn(executable, [...args], options);

/**
 * Creates the bounded probe adapter. Each invocation uses an absolute executable with
 * `shell: false`, hidden windows, the caller's owned working directory, a sanitized child
 * environment, and a per-command timeout bounded by the runner's overall budget. Expected
 * failures resolve as `IProcessExecutionResult` values, the runner never throws, kills the child
 * on timeout, and releases its timer and listeners before settling.
 */
export function createProcessRunner(options: IProcessRunnerOptions = {}): IProcessAdapter {
	const spawnImplementation = options.spawn ?? defaultSpawn;
	const clock = options.clock ?? realClock;
	const budgetDeadlineMs = options.overallBudgetMs === undefined ? undefined : clock.now() + options.overallBudgetMs;

	return {
		run: (execution: IProcessExecution): Promise<IProcessExecutionResult> => new Promise<IProcessExecutionResult>(resolve => {
			const stdout = createBoundedOutput('stdout', MAX_PROCESS_STDOUT_BYTES);
			const stderr = createBoundedOutput('stderr', MAX_PROCESS_STDERR_BYTES);
			let child: IProcessRunnerChild | undefined;
			let timer: unknown;
			let settled = false;
			let disposeOutput: (() => void) | undefined;

			const settle = (result: IProcessExecutionResult): void => {
				if (settled) {
					return;
				}
				settled = true;
				if (timer !== undefined) {
					clock.clearTimeout(timer);
				}
				detachChildListeners(child, onError, onClose);
				disposeOutput?.();
				resolve(result);
			};
			const failSpawn = (message: string): void => {
				stderr.push(Buffer.from(message));
				settle({ exitCode: 1, stdout: stdout.text(), stderr: stderr.text(), failure: 'spawn' });
			};
			const failTimeout = (message: string): void => {
				stderr.push(Buffer.from(message));
				child?.kill();
				settle({ exitCode: 1, stdout: stdout.text(), stderr: stderr.text(), failure: 'timeout' });
			};
			const onError = (error: Error): void => failSpawn(error.message);
			const onClose = (code: number | null, signal: string | null): void => {
				if (signal !== null) {
					stderr.push(Buffer.from(`terminated by signal ${signal}`));
				}
				settle({ exitCode: code ?? 1, stdout: stdout.text(), stderr: stderr.text() });
			};

			const requestedTimeoutMs = Number.isFinite(execution.timeoutMs) && execution.timeoutMs > 0 ? execution.timeoutMs : DEFAULT_PROBE_TIMEOUT_MS;
			const remainingBudgetMs = budgetDeadlineMs === undefined ? undefined : budgetDeadlineMs - clock.now();
			if (remainingBudgetMs !== undefined && remainingBudgetMs <= 0) {
				failTimeout('probe budget exhausted');
				return;
			}
			const timeoutMs = remainingBudgetMs === undefined ? requestedTimeoutMs : Math.max(1, Math.min(requestedTimeoutMs, remainingBudgetMs));
			timer = clock.setTimeout(() => failTimeout(`probe timed out after ${timeoutMs} ms`), timeoutMs);

			let spawned: IProcessRunnerChild;
			try {
				spawned = spawnImplementation(execution.executable, [...execution.args], createSpawnOptions(execution.cwd, createChildEnvironment(options.baseEnv ?? process.env, execution.env), false));
			} catch (error) {
				failSpawn(error instanceof Error ? error.message : String(error));
				return;
			}
			child = spawned;
			disposeOutput = attachBoundedOutput(spawned, stdout, stderr);
			spawned.on('error', onError);
			spawned.on('close', onClose);
		}),
	};
}

/** Process-tree boundary injected so termination tests never touch a real process group. */
export interface IProcessTreeAdapter {
	/** Sends a signal to the process group; returns false when the group is already gone. */
	signalGroup(pid: number, signal: NodeJS.Signals): boolean;
	/**
	 * `true` while the group still has live members, `false` once it is gone, and `undefined`
	 * when the platform cannot prove group liveness (Windows, where `taskkill` is authoritative).
	 */
	groupAlive(pid: number): boolean | undefined;
}

const unixProcessTree: IProcessTreeAdapter = {
	signalGroup: (pid, signal) => {
		try {
			process.kill(-pid, signal);
			return true;
		} catch {
			return false;
		}
	},
	groupAlive: pid => {
		try {
			process.kill(-pid, 0);
			return true;
		} catch (error) {
			return (error as NodeJS.ErrnoException).code === 'EPERM';
		}
	},
};

const windowsProcessTree: IProcessTreeAdapter = {
	signalGroup: () => false,
	groupAlive: () => undefined,
};

/** Absolute system `taskkill` path; PATH and `where.exe` are never consulted (D4). */
export function windowsTaskKillPath(systemRoot: string = DEFAULT_WINDOWS_SYSTEM_ROOT): string {
	return path.win32.join(systemRoot, 'System32', 'taskkill.exe');
}

/** One bounded installer invocation; the operation budget is separate from probe limits. */
export interface IDotnetInstallerExecution {
	readonly executable: string;
	readonly args: readonly string[];
	readonly cwd: string;
	readonly env: Readonly<Record<string, string>>;
	/** Optional per-execution bound; defaults to {@link DOTNET_INSTALL_TIMEOUT_MS}. */
	readonly timeoutMs?: number;
}

/** Why bounded process-tree termination was requested. */
export type DotnetInstallerTerminationReason = 'canceled' | 'deactivated' | 'timeout';

/**
 * Terminal classification of one installer execution. `terminated` means the requested
 * termination was proven clean, and `recovery-required` means the process tree could not be
 * proven gone, so callers must retain the lock and operation data instead of reporting a clean
 * stop or a successful installation.
 */
export type DotnetInstallerOutcome = 'exited' | 'spawn-failed' | 'terminated' | 'recovery-required';

/** One installer execution result; expected failures resolve instead of throwing. */
export interface IDotnetInstallerProcessResult {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
	readonly outcome: DotnetInstallerOutcome;
	/** Present when termination was requested; preserves the request while `outcome` classifies proof. */
	readonly terminationReason?: DotnetInstallerTerminationReason;
	/** True iff process-tree exit could not be proven; lock and operation data must be retained. */
	readonly recoveryRequired: boolean;
	/** Platform process identifier of the installer child when it spawned. */
	readonly pid?: number;
}

/** Cancellable installer process-tree runner; cancellation stops the whole tree, not one child. */
export interface IDotnetInstallerProcessRunner {
	/** Runs one installer invocation under the operation budget; never rejects. */
	run(execution: IDotnetInstallerExecution): Promise<IDotnetInstallerProcessResult>;
	/** Requests bounded process-tree termination of the active installer (user cancel); idle is a no-op. */
	cancel(): void;
	/** Requests bounded process-tree termination because the extension is deactivating; idle is a no-op. */
	deactivate(): void;
}

/** Construction options for {@link createInstallerProcessRunner}. */
export interface IInstallerProcessRunnerOptions {
	readonly spawn?: ProcessSpawn;
	readonly clock?: IProcessRunnerClock;
	/** Base environment copied and sanitized per invocation; defaults to `process.env`. */
	readonly baseEnv?: Readonly<Record<string, string | undefined>>;
	/** Local platform; defaults to `process.platform`. */
	readonly platform?: NodeJS.Platform;
	/** Windows system root used for the absolute `taskkill` path. */
	readonly systemRoot?: string;
	/** Overall operation budget shared by all invocations, measured from runner creation. */
	readonly overallBudgetMs?: number;
	readonly terminationGraceMs?: number;
	readonly terminationWaitMs?: number;
	readonly terminationPollMs?: number;
	/** Process-tree boundary; defaults to the platform's real implementation. */
	readonly processTree?: IProcessTreeAdapter;
}

/**
 * Creates the cancellable installer process-tree runner. Unix installers spawn as their own
 * process group and are stopped with a bounded TERM → KILL escalation; Windows installers are
 * stopped through the absolute system `taskkill` tool with a fixed numeric PID and `/T /F`.
 * Bounded capture and conservative exit proof are shared with the probe runner through the same
 * helpers, while limits stay separate: probes keep their 10-second/60-second bounds and
 * installers use the 20-minute operation budget. When process-tree exit cannot be proven, the
 * result is `recovery-required` so callers retain the lock and operation data.
 */
export function createInstallerProcessRunner(options: IInstallerProcessRunnerOptions = {}): IDotnetInstallerProcessRunner {
	const spawnImplementation = options.spawn ?? defaultSpawn;
	const clock = options.clock ?? realClock;
	const baseEnv = options.baseEnv ?? process.env;
	const platform = options.platform ?? process.platform;
	const processTree = options.processTree ?? (platform === 'win32' ? windowsProcessTree : unixProcessTree);
	const taskKillExecutable = windowsTaskKillPath(options.systemRoot);
	const budgetDeadlineMs = clock.now() + (options.overallBudgetMs ?? DOTNET_INSTALL_TIMEOUT_MS);
	const terminationGraceMs = options.terminationGraceMs ?? DEFAULT_TREE_TERMINATION_GRACE_MS;
	const terminationWaitMs = options.terminationWaitMs ?? DEFAULT_TREE_TERMINATION_WAIT_MS;
	const terminationPollMs = options.terminationPollMs ?? DEFAULT_TREE_TERMINATION_POLL_MS;

	interface IActiveInstaller {
		requestTermination(reason: DotnetInstallerTerminationReason): void;
	}
	let active: IActiveInstaller | undefined;

	return {
		run: execution => new Promise<IDotnetInstallerProcessResult>(resolve => {
			const stdout = createBoundedOutput('stdout', MAX_PROCESS_STDOUT_BYTES);
			const stderr = createBoundedOutput('stderr', MAX_PROCESS_STDERR_BYTES);
			let child: IProcessRunnerChild | undefined;
			let taskKillChild: IProcessRunnerChild | undefined;
			let disposeOutput: (() => void) | undefined;
			let budgetTimer: unknown;
			let terminationPollTimer: unknown;
			let taskKillTimer: unknown;
			let closureObserved = false;
			let terminationReason: DotnetInstallerTerminationReason | undefined;
			let terminationPhase: 'grace' | 'wait-after-kill' | 'wait-for-close' = 'grace';
			let phaseDeadlineMs = 0;
			let settled = false;

			const settle = (outcome: DotnetInstallerOutcome, recoveryRequired: boolean, exitCode: number): void => {
				if (settled) {
					return;
				}
				settled = true;
				for (const timer of [budgetTimer, terminationPollTimer, taskKillTimer]) {
					if (timer !== undefined) {
						clock.clearTimeout(timer);
					}
				}
				detachChildListeners(child, onChildError, onChildClose);
				detachChildListeners(taskKillChild, onTaskKillError, onTaskKillClose);
				taskKillChild?.stdout?.removeListener('data', drainTaskKillOutput);
				taskKillChild?.stderr?.removeListener('data', drainTaskKillOutput);
				disposeOutput?.();
				if (active === handle) {
					active = undefined;
				}
				resolve({ exitCode, stdout: stdout.text(), stderr: stderr.text(), outcome, terminationReason, recoveryRequired, pid: child?.pid });
			};
			const drainTaskKillOutput = (): void => {
				// `taskkill` output is not operation diagnostics; draining keeps its pipes clear.
			};
			const onChildError = (error: Error): void => {
				if (terminationReason !== undefined) {
					stderr.push(Buffer.from(`installer process error during termination: ${error.message}`));
					return;
				}
				stderr.push(Buffer.from(error.message));
				settle('spawn-failed', false, 1);
			};
			const onChildClose = (code: number | null, signal: string | null): void => {
				closureObserved = true;
				if (terminationReason !== undefined) {
					return; // The tree proof decides the outcome; the direct child's exit alone is not enough.
				}
				if (signal !== null) {
					stderr.push(Buffer.from(`terminated by signal ${signal}`));
				}
				settle('exited', false, code ?? 1);
			};
			const scheduleTerminationPoll = (): void => {
				terminationPollTimer = clock.setTimeout(checkTermination, terminationPollMs);
			};
			const signalUnixTree = (signal: NodeJS.Signals): void => {
				const pid = child?.pid;
				if (pid === undefined) {
					stderr.push(Buffer.from(`no installer process id available for ${signal}`));
					return;
				}
				stderr.push(Buffer.from(processTree.signalGroup(pid, signal)
					? `sent ${signal} to installer process group ${pid}`
					: `installer process group ${pid} was already gone before ${signal}`));
			};
			const unixTreeProvenGone = (): boolean => {
				const pid = child?.pid;
				if (pid === undefined) {
					return closureObserved;
				}
				return processTree.groupAlive(pid) === false;
			};
			const checkTermination = (): void => {
				terminationPollTimer = undefined;
				if (settled) {
					return;
				}
				if (platform === 'win32' ? closureObserved : unixTreeProvenGone()) {
					settle('terminated', false, 1);
					return;
				}
				if (clock.now() < phaseDeadlineMs) {
					scheduleTerminationPoll();
					return;
				}
				if (platform === 'win32') {
					stderr.push(Buffer.from(`taskkill did not prove installer process-tree exit for pid ${child?.pid ?? 'unknown'}; retain lock and operation data for recovery`));
					settle('recovery-required', true, 1);
					return;
				}
				if (terminationPhase === 'grace') {
					terminationPhase = 'wait-after-kill';
					signalUnixTree('SIGKILL');
					phaseDeadlineMs = clock.now() + terminationWaitMs;
					scheduleTerminationPoll();
					return;
				}
				stderr.push(Buffer.from(`could not prove installer process-tree exit for group ${child?.pid ?? 'unknown'}; retain lock and operation data for recovery`));
				settle('recovery-required', true, 1);
			};
			const onTaskKillError = (error: Error): void => {
				if (settled) {
					return;
				}
				stderr.push(Buffer.from(`taskkill could not run: ${error.message}; retain lock and operation data for recovery`));
				settle('recovery-required', true, 1);
			};
			const onTaskKillClose = (code: number | null): void => {
				if (settled) {
					return;
				}
				if (taskKillTimer !== undefined) {
					clock.clearTimeout(taskKillTimer);
					taskKillTimer = undefined;
				}
				if (code !== 0) {
					stderr.push(Buffer.from(`taskkill exited with code ${code ?? 1}; retain lock and operation data for recovery`));
					settle('recovery-required', true, 1);
					return;
				}
				terminationPhase = 'wait-for-close';
				phaseDeadlineMs = clock.now() + terminationWaitMs;
				scheduleTerminationPoll();
			};
			const beginWindowsTermination = (): void => {
				const pid = child?.pid;
				if (pid === undefined) {
					stderr.push(Buffer.from('no installer process id available for taskkill; retain lock and operation data for recovery'));
					settle('recovery-required', true, 1);
					return;
				}
				try {
					taskKillChild = spawnImplementation(taskKillExecutable, ['/PID', String(pid), '/T', '/F'], createSpawnOptions(execution.cwd, createChildEnvironment(baseEnv, {}), false));
				} catch (error) {
					stderr.push(Buffer.from(`taskkill could not be spawned: ${error instanceof Error ? error.message : String(error)}; retain lock and operation data for recovery`));
					settle('recovery-required', true, 1);
					return;
				}
				taskKillChild.stdout?.on('data', drainTaskKillOutput);
				taskKillChild.stderr?.on('data', drainTaskKillOutput);
				taskKillChild.on('error', onTaskKillError);
				taskKillChild.on('close', onTaskKillClose);
				taskKillTimer = clock.setTimeout(() => {
					taskKillTimer = undefined;
					taskKillChild?.kill('SIGKILL');
					stderr.push(Buffer.from('taskkill did not finish within the bounded wait; retain lock and operation data for recovery'));
					settle('recovery-required', true, 1);
				}, terminationWaitMs);
			};
			const requestTermination = (reason: DotnetInstallerTerminationReason): void => {
				if (settled || terminationReason !== undefined) {
					return;
				}
				terminationReason = reason;
				stderr.push(Buffer.from(reason === 'timeout' ? 'installer operation budget exhausted' : `installer ${reason} requested`));
				if (platform === 'win32') {
					beginWindowsTermination();
					return;
				}
				signalUnixTree('SIGTERM');
				terminationPhase = 'grace';
				phaseDeadlineMs = clock.now() + terminationGraceMs;
				scheduleTerminationPoll();
			};
			const handle: IActiveInstaller = { requestTermination };
			active = handle;

			const requestedBudgetMs = execution.timeoutMs !== undefined && Number.isFinite(execution.timeoutMs) && execution.timeoutMs > 0 ? execution.timeoutMs : DOTNET_INSTALL_TIMEOUT_MS;
			const remainingBudgetMs = budgetDeadlineMs - clock.now();
			if (remainingBudgetMs <= 0) {
				stderr.push(Buffer.from('installer operation budget exhausted before spawn'));
				terminationReason = 'timeout';
				settle('terminated', false, 1);
				return;
			}
			budgetTimer = clock.setTimeout(() => requestTermination('timeout'), Math.min(requestedBudgetMs, remainingBudgetMs));

			let spawned: IProcessRunnerChild;
			try {
				spawned = spawnImplementation(execution.executable, [...execution.args], createSpawnOptions(execution.cwd, createChildEnvironment(baseEnv, execution.env), platform !== 'win32'));
			} catch (error) {
				stderr.push(Buffer.from(error instanceof Error ? error.message : String(error)));
				settle('spawn-failed', false, 1);
				return;
			}
			child = spawned;
			disposeOutput = attachBoundedOutput(spawned, stdout, stderr);
			spawned.on('error', onChildError);
			spawned.on('close', onChildClose);
		}),
		cancel: () => active?.requestTermination('canceled'),
		deactivate: () => active?.requestTermination('deactivated'),
	};
}
