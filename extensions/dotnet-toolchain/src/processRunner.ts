/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'node:child_process';
import { type IProcessAdapter, type IProcessExecution, type IProcessExecutionResult } from './contracts';

/** Per-command probe timeout from design D2; a non-positive `timeoutMs` selects this default. */
export const DEFAULT_PROBE_TIMEOUT_MS = 10_000;

/** Maximum stdout bytes retained per invocation; further output is dropped and marked. */
export const MAX_PROCESS_STDOUT_BYTES = 1024 * 1024;

/** Maximum stderr bytes retained per invocation for diagnostics. */
export const MAX_PROCESS_STDERR_BYTES = 64 * 1024;

/** Inherited environment variable prefixes removed from every child invocation (D2). */
const STRIPPED_ENVIRONMENT_PREFIX = /^(DOTNET_|MSBUILD)/i;

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

/** Copies the base environment without DOTNET_/MSBUILD overrides, then applies child-only values. */
function createChildEnvironment(baseEnv: Readonly<Record<string, string | undefined>>, childEnv: Readonly<Record<string, string>>): Record<string, string> {
	const environment: Record<string, string> = {};
	for (const [key, value] of Object.entries(baseEnv)) {
		if (value !== undefined && !STRIPPED_ENVIRONMENT_PREFIX.test(key)) {
			environment[key] = value;
		}
	}
	return { ...environment, ...childEnv };
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

			const onStdout = (chunk: Buffer): void => stdout.push(chunk);
			const onStderr = (chunk: Buffer): void => stderr.push(chunk);
			const settle = (result: IProcessExecutionResult): void => {
				if (settled) {
					return;
				}
				settled = true;
				if (timer !== undefined) {
					clock.clearTimeout(timer);
				}
				child?.removeListener('error', onError);
				child?.removeListener('close', onClose);
				child?.stdout?.removeListener('data', onStdout);
				child?.stderr?.removeListener('data', onStderr);
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
				spawned = spawnImplementation(execution.executable, [...execution.args], {
					cwd: execution.cwd,
					env: createChildEnvironment(options.baseEnv ?? process.env, execution.env),
					shell: false,
					windowsHide: true,
					stdio: ['ignore', 'pipe', 'pipe'],
				});
			} catch (error) {
				failSpawn(error instanceof Error ? error.message : String(error));
				return;
			}
			child = spawned;
			spawned.stdout?.on('data', onStdout);
			spawned.stderr?.on('data', onStderr);
			spawned.on('error', onError);
			spawned.on('close', onClose);
		}),
	};
}
