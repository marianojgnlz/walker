/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PassThrough } from 'node:stream';
import type { IProcessExecution } from '../contracts';
import {
	DEFAULT_PROBE_TIMEOUT_MS,
	DOTNET_INSTALL_TIMEOUT_MS,
	MAX_PROCESS_STDERR_BYTES,
	MAX_PROCESS_STDOUT_BYTES,
	createInstallerProcessRunner,
	createProcessRunner,
	type IDotnetInstallerExecution,
	type IInstallerProcessRunnerOptions,
	type IProcessRunnerChild,
	type IProcessRunnerClock,
	type IProcessSpawnOptions,
	type IProcessTreeAdapter,
	type ProcessSpawn,
} from '../processRunner';
import { withTempDirectory } from './fixtures';

/** Controllable child fake: emits stream data and close/error events on demand, never spawns. */
class FakeChild extends EventEmitter implements IProcessRunnerChild {
	readonly stdout = new PassThrough();
	readonly stderr = new PassThrough();
	readonly killSignals: Array<string | undefined> = [];
	pid: number | undefined;
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
		child.pid = 4321 + this.children.length;
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

/** Process-tree fake recording signals and reporting controlled group liveness. */
class FakeProcessTree implements IProcessTreeAdapter {
	alive: boolean | undefined = true;
	readonly signals: Array<{ readonly pid: number; readonly signal: NodeJS.Signals }> = [];
	signalGroup(pid: number, signal: NodeJS.Signals): boolean {
		this.signals.push({ pid, signal });
		return this.alive !== false;
	}
	groupAlive(): boolean | undefined {
		return this.alive;
	}
}

function installerExecution(overrides: Partial<IDotnetInstallerExecution> = {}): IDotnetInstallerExecution {
	return { executable: '/home/tëst user/dotnet/dotnet-install.sh', args: ['--channel', 'LTS', '--no-path'], cwd: '/tmp/owned-stage', env: {}, ...overrides };
}

function startInstaller(spawn: RecordingSpawn, clock: FakeClock, tree: FakeProcessTree, options: IInstallerProcessRunnerOptions = {}) {
	return createInstallerProcessRunner({ spawn: spawn.spawn, clock, baseEnv: {}, platform: 'linux', processTree: tree, ...options });
}

function installerSignals(tree: FakeProcessTree): string[] {
	return tree.signals.map(entry => entry.signal);
}

suite('installer process execution', () => {
	test('spawns the installer in a detached group with shell disabled, hidden windows, and sanitized environment', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const baseEnv = Object.freeze({ PATH: '/usr/bin', DOTNET_ROOT: '/hostile' });
		const runner = createInstallerProcessRunner({ spawn: spawn.spawn, clock, baseEnv, platform: 'linux', processTree: new FakeProcessTree() });
		const running = runner.run(installerExecution({ env: { DOTNET_CLI_TELEMETRY_OPTOUT: '1' } }));
		const child = spawn.children[0];
		child.data(Buffer.from('installing\n'));
		child.close(0);
		const result = await running;
		assert.deepStrictEqual(
			[spawn.invocations[0].executable, spawn.invocations[0].args, spawn.invocations[0].options.shell, spawn.invocations[0].options.windowsHide, spawn.invocations[0].options.detached, spawn.invocations[0].options.stdio, spawn.invocations[0].options.cwd],
			['/home/tëst user/dotnet/dotnet-install.sh', ['--channel', 'LTS', '--no-path'], false, true, true, ['ignore', 'pipe', 'pipe'], '/tmp/owned-stage'],
		);
		assert.deepStrictEqual(spawn.invocations[0].options.env, { PATH: '/usr/bin', DOTNET_CLI_TELEMETRY_OPTOUT: '1' });
		assert.deepStrictEqual([result.outcome, result.exitCode, result.stdout, result.recoveryRequired, result.pid, result.terminationReason], ['exited', 0, 'installing\n', false, child.pid, undefined]);
		assert.deepStrictEqual([clock.pendingDelays().length, child.listenerCount('close'), child.stdout.listenerCount('data')], [0, 0, 0]);
	});

	test('spawns Windows installers without a Unix process group', async () => {
		const spawn = new RecordingSpawn();
		const runner = startInstaller(spawn, new FakeClock(), new FakeProcessTree(), { platform: 'win32' });
		const running = runner.run(installerExecution());
		spawn.children[0].close(0);
		const result = await running;
		assert.deepStrictEqual([spawn.invocations[0].options.detached, result.outcome], [false, 'exited']);
	});

	test('applies the 20-minute operation budget, per-execution overrides, and the remaining runner budget', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const runner = startInstaller(spawn, clock, new FakeProcessTree());
		const first = runner.run(installerExecution());
		assert.deepStrictEqual([DOTNET_INSTALL_TIMEOUT_MS, clock.pendingDelays()], [1_200_000, [DOTNET_INSTALL_TIMEOUT_MS]]);
		spawn.children[0].close(0);
		await first;
		const second = runner.run(installerExecution({ timeoutMs: 5_000 }));
		assert.deepStrictEqual(clock.pendingDelays(), [5_000]);
		spawn.children[1].close(0);
		await second;
		const bounded = startInstaller(spawn, clock, new FakeProcessTree(), { overallBudgetMs: 30_000 });
		const third = bounded.run(installerExecution({ timeoutMs: 60_000 }));
		assert.deepStrictEqual(clock.pendingDelays(), [30_000]);
		clock.advance(25_000);
		spawn.children[2].close(0);
		await third;
		const fourth = bounded.run(installerExecution());
		assert.deepStrictEqual(clock.pendingDelays(), [5_000]);
		spawn.children[3].close(0);
		await fourth;
	});

	test('fails as a timeout before spawning once the runner budget is already exhausted', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const runner = startInstaller(spawn, clock, new FakeProcessTree(), { overallBudgetMs: 1_000 });
		clock.advance(1_000);
		const result = await runner.run(installerExecution());
		assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired, spawn.invocations.length, result.stderr.includes('budget')], ['terminated', 'timeout', false, 0, true]);
	});

	test('captures bounded installer logs and marks truncated output', async () => {
		const spawn = new RecordingSpawn();
		const running = startInstaller(spawn, new FakeClock(), new FakeProcessTree()).run(installerExecution());
		const child = spawn.children[0];
		child.data(Buffer.alloc(MAX_PROCESS_STDOUT_BYTES + 4096, 97));
		child.error(Buffer.alloc(MAX_PROCESS_STDERR_BYTES + 4096, 98));
		child.close(7);
		const result = await running;
		assert.deepStrictEqual([result.outcome, result.exitCode], ['exited', 7]);
		assert.deepStrictEqual(
			[result.stdout.length >= MAX_PROCESS_STDOUT_BYTES, result.stdout.length <= MAX_PROCESS_STDOUT_BYTES + 64, result.stderr.length >= MAX_PROCESS_STDERR_BYTES, result.stderr.length <= MAX_PROCESS_STDERR_BYTES + 64],
			[true, true, true, true],
		);
		assert.deepStrictEqual([result.stdout.endsWith(`[stdout truncated at ${MAX_PROCESS_STDOUT_BYTES} bytes]`), result.stderr.endsWith(`[stderr truncated at ${MAX_PROCESS_STDERR_BYTES} bytes]`)], [true, true]);
	});

	test('resolves installer spawn failures without throwing', async () => {
		const spawn = new RecordingSpawn();
		const failed = startInstaller(spawn, new FakeClock(), new FakeProcessTree()).run(installerExecution());
		spawn.children[0].emit('error', new Error('spawn EACCES'));
		const failedResult = await failed;
		const throwing = createInstallerProcessRunner({ spawn: () => { throw new Error('invalid installer spawn options'); }, clock: new FakeClock(), baseEnv: {}, platform: 'linux', processTree: new FakeProcessTree() });
		const thrownResult = await throwing.run(installerExecution());
		assert.deepStrictEqual(
			[failedResult.outcome, failedResult.stderr, failedResult.recoveryRequired, thrownResult.outcome, thrownResult.stderr, thrownResult.recoveryRequired],
			['spawn-failed', 'spawn EACCES', false, 'spawn-failed', 'invalid installer spawn options', false],
		);
	});
});

suite('installer process tree termination', () => {
	test('escalates from SIGTERM to SIGKILL when a timed-out process tree survives', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const tree = new FakeProcessTree();
		const runner = startInstaller(spawn, clock, tree, { terminationGraceMs: 1_000, terminationWaitMs: 2_000, terminationPollMs: 100 });
		const running = runner.run(installerExecution({ timeoutMs: 30_000 }));
		const child = spawn.children[0];
		clock.firePending();
		assert.deepStrictEqual(installerSignals(tree), ['SIGTERM']);
		assert.strictEqual(child.killSignals.length, 0);
		clock.advance(1_000);
		clock.firePending();
		assert.deepStrictEqual(installerSignals(tree), ['SIGTERM', 'SIGKILL']);
		tree.alive = false;
		clock.firePending();
		const result = await running;
		assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired, result.exitCode], ['terminated', 'timeout', false, 1]);
		assert.deepStrictEqual([clock.pendingDelays().length, child.listenerCount('close'), child.stdout.listenerCount('data')], [0, 0, 0]);
	});

	test('terminates the whole process tree on user cancellation and reports cancellation', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const tree = new FakeProcessTree();
		const runner = startInstaller(spawn, clock, tree);
		const running = runner.run(installerExecution());
		const child = spawn.children[0];
		child.data(Buffer.from('downloading\n'));
		runner.cancel();
		assert.deepStrictEqual(tree.signals, [{ pid: child.pid, signal: 'SIGTERM' }]);
		tree.alive = false;
		clock.firePending();
		const result = await running;
		assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired, result.stdout], ['terminated', 'canceled', false, 'downloading\n']);
	});

	test('treats deactivation as the same bounded termination and stays idle-safe', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const tree = new FakeProcessTree();
		const runner = startInstaller(spawn, clock, tree);
		runner.cancel();
		runner.deactivate();
		const running = runner.run(installerExecution());
		runner.deactivate();
		runner.cancel();
		assert.deepStrictEqual(installerSignals(tree), ['SIGTERM']);
		tree.alive = false;
		clock.firePending();
		const result = await running;
		assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired, spawn.invocations.length], ['terminated', 'deactivated', false, 1]);
	});

	test('uses the absolute taskkill tool with a fixed numeric PID and tree flags on Windows', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const tree = new FakeProcessTree();
		const runner = startInstaller(spawn, clock, tree, { platform: 'win32' });
		const running = runner.run(installerExecution());
		runner.cancel();
		assert.deepStrictEqual(
			[spawn.invocations[1].executable, spawn.invocations[1].args, spawn.invocations[1].options.shell, spawn.invocations[1].options.windowsHide, spawn.invocations[1].options.detached, tree.signals.length],
			['C:\\Windows\\System32\\taskkill.exe', ['/PID', '4321', '/T', '/F'], false, true, false, 0],
		);
		spawn.children[1].close(0);
		spawn.children[0].close(139);
		clock.firePending();
		const result = await running;
		assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired], ['terminated', 'canceled', false]);
	});

	test('reports recovery-required when the Windows taskkill proof fails', async () => {
		const spawn = new RecordingSpawn();
		const runner = startInstaller(spawn, new FakeClock(), new FakeProcessTree(), { platform: 'win32' });
		const running = runner.run(installerExecution());
		runner.cancel();
		spawn.children[1].close(128);
		const result = await running;
		assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired, result.stderr.includes('taskkill exited with code 128')], ['recovery-required', 'canceled', true, true]);
	});

	test('reports recovery-required when taskkill cannot be spawned or does not finish', async () => {
		const spawn = new RecordingSpawn();
		const refusing: ProcessSpawn = (executable, args, options) => {
			if (executable.endsWith('taskkill.exe')) {
				throw new Error('taskkill unavailable');
			}
			return spawn.spawn(executable, args, options);
		};
		const refusingRunner = startInstaller(spawn, new FakeClock(), new FakeProcessTree(), { platform: 'win32', spawn: refusing });
		const refusingRun = refusingRunner.run(installerExecution());
		refusingRunner.cancel();
		const refusingResult = await refusingRun;
		const hanging = new RecordingSpawn();
		const hangingClock = new FakeClock();
		const hangingRunner = startInstaller(hanging, hangingClock, new FakeProcessTree(), { platform: 'win32', terminationWaitMs: 500 });
		const hangingRun = hangingRunner.run(installerExecution());
		hangingRunner.cancel();
		hangingClock.advance(500);
		hangingClock.firePending();
		const hangingResult = await hangingRun;
		assert.deepStrictEqual(
			[refusingResult.outcome, refusingResult.recoveryRequired, refusingResult.stderr.includes('taskkill could not be spawned'), hangingResult.outcome, hangingResult.recoveryRequired, hangingResult.stderr.includes('did not finish')],
			['recovery-required', true, true, 'recovery-required', true, true],
		);
	});

	test('reports recovery-required when the Unix process tree survives the KILL escalation', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const tree = new FakeProcessTree();
		const runner = startInstaller(spawn, clock, tree, { terminationGraceMs: 100, terminationWaitMs: 200, terminationPollMs: 50 });
		const running = runner.run(installerExecution());
		const child = spawn.children[0];
		runner.cancel();
		clock.advance(100);
		clock.firePending();
		clock.advance(200);
		clock.firePending();
		const result = await running;
		assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired, installerSignals(tree)], ['recovery-required', 'canceled', true, ['SIGTERM', 'SIGKILL']]);
		assert.strictEqual(result.stderr.includes('recovery'), true);
		assert.deepStrictEqual([clock.pendingDelays().length, child.listenerCount('close')], [0, 0]);
	});

	test('keeps an observed exit when the installer closes before cancellation is requested', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const tree = new FakeProcessTree();
		const runner = startInstaller(spawn, clock, tree);
		const running = runner.run(installerExecution());
		spawn.children[0].close(0);
		const result = await running;
		runner.cancel();
		assert.deepStrictEqual([result.outcome, result.exitCode, result.terminationReason, tree.signals.length], ['exited', 0, undefined, 0]);
	});

	test('treats a cancellation requested before closure as a termination even when the child exits afterwards', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const tree = new FakeProcessTree();
		const runner = startInstaller(spawn, clock, tree);
		const running = runner.run(installerExecution());
		const child = spawn.children[0];
		runner.cancel();
		child.close(0);
		tree.alive = false;
		clock.firePending();
		const result = await running;
		assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired], ['terminated', 'canceled', false]);
	});

	test('keeps cancellation cleanup from racing a flooding child', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const tree = new FakeProcessTree();
		const runner = startInstaller(spawn, clock, tree);
		const running = runner.run(installerExecution());
		const child = spawn.children[0];
		child.data(Buffer.alloc(MAX_PROCESS_STDOUT_BYTES + 8192, 120));
		child.error(Buffer.alloc(MAX_PROCESS_STDERR_BYTES + 8192, 121));
		runner.cancel();
		tree.alive = false;
		clock.firePending();
		const result = await running;
		const bounded = result.stdout.length >= MAX_PROCESS_STDOUT_BYTES && result.stdout.length <= MAX_PROCESS_STDOUT_BYTES + 128 && result.stderr.length >= MAX_PROCESS_STDERR_BYTES && result.stderr.length <= MAX_PROCESS_STDERR_BYTES + 128;
		child.data(Buffer.from('late flood\n'));
		assert.deepStrictEqual([result.outcome, bounded, result.stdout.includes('[stdout truncated at'), result.stdout.includes('late flood')], ['terminated', true, true, false]);
	});

	test('ignores a late exit after a timeout settlement that could not prove tree closure', async () => {
		const spawn = new RecordingSpawn();
		const clock = new FakeClock();
		const tree = new FakeProcessTree();
		const runner = startInstaller(spawn, clock, tree, { terminationGraceMs: 100, terminationWaitMs: 100, terminationPollMs: 10 });
		const running = runner.run(installerExecution({ timeoutMs: 5_000 }));
		const child = spawn.children[0];
		child.data(Buffer.from('before timeout\n'));
		clock.firePending();
		clock.advance(100);
		clock.firePending();
		clock.advance(100);
		clock.firePending();
		const result = await running;
		child.data(Buffer.from('late output\n'));
		child.error(Buffer.from('late error\n'));
		child.close(0);
		assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired, result.stdout, result.stderr.includes('late')], ['recovery-required', 'timeout', true, 'before timeout\n', false]);
		assert.deepStrictEqual([clock.pendingDelays().length, child.listenerCount('close'), child.listenerCount('error'), child.stdout.listenerCount('data'), child.stderr.listenerCount('data')], [0, 0, 0, 0, 0]);
	});
});

/** Resolves after `milliseconds` real time; used only by the real process-tree fixtures. */
function delay(milliseconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** True while the OS still reports the process identifier as live. */
function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === 'EPERM';
	}
}

/** Best-effort `SIGKILL` used only to guarantee fixture cleanup. */
function killIfAlive(pid: number | undefined): void {
	if (pid === undefined) {
		return;
	}
	try {
		process.kill(pid, 'SIGKILL');
	} catch {
		// already gone
	}
}

/** Waits for a file written by a fixture child and returns its trimmed content. */
async function waitForChildFile(filePath: string, timeoutMs: number): Promise<string> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const content = (await fs.readFile(filePath, 'utf8')).trim();
			if (content.length > 0) {
				return content;
			}
		} catch {
			// not written yet
		}
		await delay(20);
	}
	throw new Error(`fixture child did not write ${filePath} within ${timeoutMs} ms`);
}

/** Waits until the OS reports the process identifier as gone. */
async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (!isProcessAlive(pid)) {
			return true;
		}
		await delay(20);
	}
	return !isProcessAlive(pid);
}

/** Fixture parent that keeps one descendant alive and reports its identifier. */
const DESCENDANT_FIXTURE_SCRIPT = `
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
fs.writeFileSync(process.env.WALKER_TEST_PID_FILE, String(descendant.pid));
setInterval(() => {}, 1000);
`;

/** Fixture child that ignores `SIGTERM` so only KILL escalation can stop it. */
const IGNORE_TERM_FIXTURE_SCRIPT = `
process.on('SIGTERM', () => {});
require('node:fs').writeFileSync(process.env.WALKER_TEST_READY_FILE, 'ready');
setInterval(() => {}, 1000);
`;

/** Fixture child that floods bounded stdout as soon as it starts. */
const FLOOD_FIXTURE_SCRIPT = `
process.stdout.write('x'.repeat(1024 * 1024 + 4096));
require('node:fs').writeFileSync(process.env.WALKER_TEST_READY_FILE, 'ready');
setInterval(() => process.stdout.write('y'.repeat(4096)), 5);
`;

/** Real installer runner with short, bounded termination windows for fixture children. */
function startRealInstaller() {
	return createInstallerProcessRunner({ terminationGraceMs: 250, terminationWaitMs: 10_000, terminationPollMs: 20, overallBudgetMs: 120_000 });
}

suite('installer process trees with real child processes', () => {
	test('terminates a real descendant process tree on cancellation', async function () {
		this.timeout(30_000);
		if (process.platform === 'win32') {
			this.skip();
		}
		await withTempDirectory('dotnet-install-tree-', async directory => {
			const pidFile = path.join(directory, 'descendant.pid');
			const runner = startRealInstaller();
			const running = runner.run({ executable: process.execPath, args: ['-e', DESCENDANT_FIXTURE_SCRIPT], cwd: directory, env: { WALKER_TEST_PID_FILE: pidFile } });
			let directPid: number | undefined;
			let descendantPid: number | undefined;
			try {
				descendantPid = Number.parseInt(await waitForChildFile(pidFile, 10_000), 10);
				runner.cancel();
				const result = await running;
				directPid = result.pid;
				assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired], ['terminated', 'canceled', false]);
				assert.strictEqual(await waitForProcessExit(descendantPid, 10_000), true);
			} finally {
				runner.cancel();
				const cleanup = await running.catch(() => undefined);
				directPid ??= cleanup?.pid;
				killIfAlive(directPid);
				killIfAlive(descendantPid);
			}
		});
	});

	test('escalates a real SIGTERM-ignoring installer child to SIGKILL', async function () {
		this.timeout(30_000);
		if (process.platform === 'win32') {
			this.skip();
		}
		await withTempDirectory('dotnet-install-kill-', async directory => {
			const readyFile = path.join(directory, 'ready');
			const runner = startRealInstaller();
			const running = runner.run({ executable: process.execPath, args: ['-e', IGNORE_TERM_FIXTURE_SCRIPT], cwd: directory, env: { WALKER_TEST_READY_FILE: readyFile } });
			try {
				await waitForChildFile(readyFile, 10_000);
				runner.cancel();
				const result = await running;
				assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired], ['terminated', 'canceled', false]);
				assert.notStrictEqual(result.pid, undefined);
				assert.strictEqual(await waitForProcessExit(result.pid as number, 10_000), true);
			} finally {
				runner.cancel();
				const cleanup = await running.catch(() => undefined);
				killIfAlive(cleanup?.pid);
			}
		});
	});

	test('cancels a real flooding installer child without unbounded capture', async function () {
		this.timeout(30_000);
		await withTempDirectory('dotnet-install-flood-', async directory => {
			const readyFile = path.join(directory, 'ready');
			const runner = startRealInstaller();
			const running = runner.run({ executable: process.execPath, args: ['-e', FLOOD_FIXTURE_SCRIPT], cwd: directory, env: { WALKER_TEST_READY_FILE: readyFile } });
			try {
				await waitForChildFile(readyFile, 10_000);
				runner.cancel();
				const result = await running;
				assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired], ['terminated', 'canceled', false]);
				assert.deepStrictEqual([result.stdout.length >= MAX_PROCESS_STDOUT_BYTES, result.stdout.length <= MAX_PROCESS_STDOUT_BYTES + 128, result.stdout.includes('[stdout truncated at')], [true, true, true]);
				assert.notStrictEqual(result.pid, undefined);
				assert.strictEqual(await waitForProcessExit(result.pid as number, 10_000), true);
			} finally {
				runner.cancel();
				const cleanup = await running.catch(() => undefined);
				killIfAlive(cleanup?.pid);
			}
		});
	});
});
