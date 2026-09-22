/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IProcessExecution } from '../contracts';
import {
	DEFAULT_PROBE_TIMEOUT_MS,
	MAX_PROCESS_STDERR_BYTES,
	MAX_PROCESS_STDOUT_BYTES,
	createProcessRunner,
	type IProcessRunnerChild,
	type IProcessRunnerClock,
	type IProcessSpawnOptions,
	type ProcessSpawn,
} from '../processRunner';
import { withTempDirectory } from './fixtures';

/** Controllable child fake: emits stream data and close/error events on demand, never spawns. */
class FakeChild extends EventEmitter implements IProcessRunnerChild {
	readonly stdout = new PassThrough();
	readonly stderr = new PassThrough();
	readonly killSignals: Array<string | undefined> = [];
	kill(signal?: NodeJS.Signals): boolean {
		this.killSignals.push(signal);
		return true;
	}
	data(chunk: Buffer): void {
		this.stdout.emit('data', chunk);
	}
	error(chunk: Buffer): void {
		this.stderr.emit('data', chunk);
	}
	close(code: number | null, signal: string | null = null): void {
		this.emit('close', code, signal);
	}
}

interface IScheduledTimer {
	readonly delayMs: number;
	readonly callback: () => void;
	cancelled: boolean;
}

/** Manual clock recording scheduled timers so timeout tests never wait ten real seconds. */
class FakeClock implements IProcessRunnerClock {
	nowMs = 0;
	private readonly timers: IScheduledTimer[] = [];
	setTimeout(callback: () => void, timeoutMs: number): IScheduledTimer {
		const timer: IScheduledTimer = { delayMs: timeoutMs, callback, cancelled: false };
		this.timers.push(timer);
		return timer;
	}
	clearTimeout(handle: unknown): void {
		(handle as IScheduledTimer).cancelled = true;
	}
	now(): number {
		return this.nowMs;
	}
	advance(milliseconds: number): void {
		this.nowMs += milliseconds;
	}
	pendingDelays(): number[] {
		return this.timers.filter(timer => !timer.cancelled).map(timer => timer.delayMs);
	}
	firePending(): void {
		for (const timer of this.timers.filter(candidate => !candidate.cancelled)) {
			timer.cancelled = true;
			timer.callback();
		}
	}
}

interface IRecordedInvocation {
	readonly executable: string;
	readonly args: readonly string[];
	readonly options: IProcessSpawnOptions;
}

/** Spawn fake returning a fresh controllable child per invocation and recording its options. */
class RecordingSpawn {
	readonly invocations: IRecordedInvocation[] = [];
	readonly children: FakeChild[] = [];
	readonly spawn: ProcessSpawn = (executable, args, options) => {
		this.invocations.push({ executable, args, options });
		const child = new FakeChild();
		this.children.push(child);
		return child;
	};
}

function probeExecution(overrides: Partial<IProcessExecution> = {}): IProcessExecution {
	return { executable: '/home/tëst user/dotnet tools/dotnet', args: ['--list-sdks'], cwd: '/tmp/owned-probe', env: {}, timeoutMs: DEFAULT_PROBE_TIMEOUT_MS, ...overrides };
}

function start(spawn: RecordingSpawn, clock: FakeClock, baseEnv: Readonly<Record<string, string | undefined>> = {}) {
	return createProcessRunner({ spawn: spawn.spawn, clock, baseEnv });
}

suite('bounded probe process runner', () => {
	test('spawns the exact absolute executable with shell disabled and hidden windows', async () => {
		const spawn = new RecordingSpawn();
		const running = start(spawn, new FakeClock()).run(probeExecution({ args: ['--list-sdks', '--arch', 'x64'] }));
		spawn.children[0].close(0);
		const result = await running;
		assert.deepStrictEqual([result.exitCode, result.failure], [0, undefined]);
		assert.deepStrictEqual(
			[spawn.invocations[0].executable, spawn.invocations[0].args, spawn.invocations[0].options.shell, spawn.invocations[0].options.windowsHide, spawn.invocations[0].options.stdio],
			['/home/tëst user/dotnet tools/dotnet', ['--list-sdks', '--arch', 'x64'], false, true, ['ignore', 'pipe', 'pipe']],
		);
	});

	test('runs the child in the caller-owned safe working directory', async () => {
		await withTempDirectory('dotnet-probe-cwd-', async directory => {
			const spawn = new RecordingSpawn();
			const running = start(spawn, new FakeClock()).run(probeExecution({ cwd: directory }));
			spawn.children[0].data(Buffer.from('probe output'));
			spawn.children[0].close(0);
			const result = await running;
			assert.deepStrictEqual([spawn.invocations[0].options.cwd, result.stdout], [directory, 'probe output']);
			assert.notStrictEqual(directory, process.cwd());
		});
	});

	test('strips inherited DOTNET_/MSBUILD overrides and never mutates the parent environment', async () => {
		const baseEnv = Object.freeze({
			PATH: '/usr/bin',
			HOME: '/home/test',
			DOTNET_ROOT: '/hostile',
			DOTNET_STARTUP_HOOKS: '/hostile/hook.dll',
			DOTNET_CLI_TELEMETRY_OPTOUT: '0',
			MSBuildSDKsPath: '/hostile/sdks',
		});
		const ambient = { ...process.env };
		const spawn = new RecordingSpawn();
		const childEnv = { DOTNET_ROOT: '/home/test/.walker/dotnet', DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_MULTILEVEL_LOOKUP: '0' };
		const running = start(spawn, new FakeClock(), baseEnv).run(probeExecution({ env: childEnv }));
		spawn.children[0].close(0);
		await running;
		assert.deepStrictEqual(spawn.invocations[0].options.env, { PATH: '/usr/bin', HOME: '/home/test', ...childEnv });
		assert.deepStrictEqual([baseEnv.DOTNET_STARTUP_HOOKS, baseEnv.DOTNET_CLI_TELEMETRY_OPTOUT, { ...process.env }], ['/hostile/hook.dll', '0', ambient]);
	});

	test('caps stdout and stderr and marks truncated output', async () => {
		const spawn = new RecordingSpawn();
		const running = start(spawn, new FakeClock()).run(probeExecution());
		const child = spawn.children[0];
		child.data(Buffer.alloc(MAX_PROCESS_STDOUT_BYTES + 4096, 97));
		child.error(Buffer.alloc(MAX_PROCESS_STDERR_BYTES + 4096, 98));
		child.close(0);
		const result = await running;
		assert.deepStrictEqual(
			[result.stdout.length >= MAX_PROCESS_STDOUT_BYTES, result.stdout.length <= MAX_PROCESS_STDOUT_BYTES + 64, result.stderr.length >= MAX_PROCESS_STDERR_BYTES, result.stderr.length <= MAX_PROCESS_STDERR_BYTES + 64],
			[true, true, true, true],
		);
		assert.deepStrictEqual([result.stdout.endsWith(`[stdout truncated at ${MAX_PROCESS_STDOUT_BYTES} bytes]`), result.stderr.endsWith(`[stderr truncated at ${MAX_PROCESS_STDERR_BYTES} bytes]`)], [true, true]);
	});

	test('resolves nonzero exit codes with captured diagnostics instead of throwing', async () => {
		const spawn = new RecordingSpawn();
		const running = start(spawn, new FakeClock()).run(probeExecution());
		spawn.children[0].data(Buffer.from('partial inventory\n'));
		spawn.children[0].error(Buffer.from('hostfxr: missing framework\n'));
		spawn.children[0].close(214);
		const result = await running;
		assert.deepStrictEqual([result.exitCode, result.stdout, result.stderr, result.failure], [214, 'partial inventory\n', 'hostfxr: missing framework\n', undefined]);
	});

	test('resolves spawn failures and synchronous spawn errors without throwing', async () => {
		const spawn = new RecordingSpawn();
		const failed = start(spawn, new FakeClock()).run(probeExecution());
		spawn.children[0].emit('error', new Error('spawn ENOENT'));
		const failedResult = await failed;
		const throwing = createProcessRunner({ spawn: () => { throw new Error('invalid spawn options'); }, clock: new FakeClock(), baseEnv: {} });
		const thrownResult = await throwing.run(probeExecution());
		assert.deepStrictEqual([failedResult.failure, failedResult.stderr, thrownResult.failure, thrownResult.stderr], ['spawn', 'spawn ENOENT', 'spawn', 'invalid spawn options']);
	});
});

suite('probe process bounds and termination', () => {
	test('applies the ten-second default per-command timeout and kills the child', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const running = start(spawn, clock).run(probeExecution({ timeoutMs: 0 }));
		const child = spawn.children[0];
		child.data(Buffer.from('partial\n'));
		assert.deepStrictEqual(clock.pendingDelays(), [DEFAULT_PROBE_TIMEOUT_MS]);
		clock.firePending();
		const result = await running;
		assert.deepStrictEqual(
			[DEFAULT_PROBE_TIMEOUT_MS, result.failure, result.exitCode, result.stdout, child.killSignals.length, result.stderr.includes('timed out')],
			[10_000, 'timeout', 1, 'partial\n', 1, true],
		);
	});

	test('bounds each command by the overall budget and stops spawning once exhausted', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const runner = createProcessRunner({ spawn: spawn.spawn, clock, baseEnv: {}, overallBudgetMs: 30_000 });
		const first = runner.run(probeExecution());
		spawn.children[0].close(0);
		await first;
		clock.advance(25_000);
		const second = runner.run(probeExecution());
		assert.deepStrictEqual(clock.pendingDelays(), [5_000]);
		clock.firePending();
		const secondResult = await second;
		clock.advance(10_000);
		const thirdResult = await runner.run(probeExecution());
		assert.deepStrictEqual([secondResult.failure, thirdResult.failure, spawn.invocations.length, clock.pendingDelays().length], ['timeout', 'timeout', 2, 0]);
	});

	test('reports a process killed by another signal as a failed exit with diagnostics', async () => {
		const spawn = new RecordingSpawn();
		const running = start(spawn, new FakeClock()).run(probeExecution());
		spawn.children[0].emit('close', null, 'SIGKILL');
		const result = await running;
		assert.deepStrictEqual([result.exitCode, result.failure, result.stderr], [1, undefined, 'terminated by signal SIGKILL']);
	});

	test('releases timers and listeners after a normal exit', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const running = start(spawn, clock).run(probeExecution());
		const child = spawn.children[0];
		child.data(Buffer.from('done\n'));
		child.close(0);
		await running;
		assert.deepStrictEqual([clock.pendingDelays().length, child.listenerCount('close'), child.listenerCount('error'), child.stdout.listenerCount('data'), child.stderr.listenerCount('data')], [0, 0, 0, 0, 0]);
	});

	test('ignores stale data and close callbacks after a timeout settlement', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const running = start(spawn, clock).run(probeExecution());
		const child = spawn.children[0];
		child.data(Buffer.from('before timeout\n'));
		clock.firePending();
		const result = await running;
		child.data(Buffer.from('late output\n'));
		child.emit('close', 0, null);
		assert.deepStrictEqual([result.failure, result.stdout, child.killSignals.length], ['timeout', 'before timeout\n', 1]);
		assert.deepStrictEqual([clock.pendingDelays().length, child.listenerCount('close'), child.stdout.listenerCount('data'), child.stderr.listenerCount('data')], [0, 0, 0, 0]);
	});
});
