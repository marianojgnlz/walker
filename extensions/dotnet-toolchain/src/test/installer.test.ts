/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
	isDotnetToolchainSnapshot,
	type IEnvironmentAdapter,
	type IProcessAdapter,
	type IProcessExecution,
	type IProcessExecutionResult,
} from '../contracts';
import {
	createNodeScriptFileWriter,
	type IDotnetScriptHttpRequest,
	type IDotnetScriptHttpResponse,
	type IDotnetScriptTransport,
} from '../download';
import {
	createDotnetInstallerController,
	type IDotnetInstallerController,
	type IDotnetInstallerControllerOptions,
	type IDotnetSetupCancellation,
} from '../installer';
import { acquireDotnetInstallLock, inspectDotnetInstallLock } from '../installLock';
import { type IDotnetPrerequisiteFailure } from '../platformArguments';
import type { IDotnetInstallerExecution, IDotnetInstallerProcessResult, IDotnetInstallerProcessRunner } from '../processRunner';
import { DOTNET_INSTALL_SCRIPT_PINS, type IDotnetInstallScriptPin } from '../scriptSource';
import {
	createDotnetSelectionPrompter,
	type DotnetChannelChoice,
	type DotnetSetupSelectionResult,
	type IDotnetSelectionPrompter,
	type IDotnetSelectionUi,
} from '../selection';
import { createInMemoryFileSystem, createRecordingUi, withTempDirectory, type IInMemoryFileSystem, type IRecordingUi } from './fixtures';

const SCRIPT_BODY = Buffer.from('#!/usr/bin/env bash\necho fixture install script\n', 'utf8');
const SCRIPT_PIN: IDotnetInstallScriptPin = { ...DOTNET_INSTALL_SCRIPT_PINS.unix, sha256: createHash('sha256').update(SCRIPT_BODY).digest('hex') };
const OPERATION_NAME = 'dotnet-install-fixture';
const EXPECTED_VERSION = '10.0.401';
const OTHER_OPERATION_NAME = 'dotnet-install-other';

const WALKER_ROOT = '.walker';

function walkerRoot(home: string): string {
	return path.join(home, WALKER_ROOT);
}

function operationRoot(home: string): string {
	return path.join(walkerRoot(home), OPERATION_NAME);
}

function stageDirectory(home: string): string {
	return path.join(operationRoot(home), 'stage');
}

function stageExecutable(home: string): string {
	return path.join(stageDirectory(home), 'dotnet');
}

function managedExecutable(home: string): string {
	return path.join(walkerRoot(home), 'dotnet', 'dotnet');
}

function managedRoot(home: string): string {
	return path.join(walkerRoot(home), 'dotnet');
}

async function pathExists(target: string): Promise<boolean> {
	return await fs.lstat(target).then(() => true, () => false);
}

/** Writes a real pre-existing managed SDK tree so staging and publication work on real bytes. */
async function writeManagedSdk(home: string, version: string): Promise<void> {
	const sdkPath = path.join(managedRoot(home), 'sdk', version);
	await fs.mkdir(sdkPath, { recursive: true });
	await fs.writeFile(managedExecutable(home), 'pre-existing managed host', { mode: 0o755 });
	await fs.writeFile(path.join(sdkPath, 'MSBuild.dll'), 'pre-existing managed sdk');
}

async function readManagedSdk(home: string, version: string): Promise<readonly string[]> {
	return [
		await fs.readFile(managedExecutable(home), 'utf8'),
		await fs.readFile(path.join(managedRoot(home), 'sdk', version, 'MSBuild.dll'), 'utf8'),
	];
}

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 200 && !predicate(); attempt++) {
		await new Promise<void>(resolve => setImmediate(resolve));
	}
	assert.ok(predicate(), 'the awaited condition was not reached');
}

interface IProbeRule {
	readonly match: (execution: IProcessExecution) => boolean;
	readonly respond: (execution: IProcessExecution) => IProcessExecutionResult | Promise<IProcessExecutionResult>;
	/** Removes the rule after its first match; used for deferred one-shot probe responses. */
	readonly once?: boolean;
}

interface IProbeHarness extends IProcessAdapter {
	readonly executions: IProcessExecution[];
	rule(rule: IProbeRule): void;
}

function processOk(stdout: string): IProcessExecutionResult {
	return { exitCode: 0, stdout, stderr: '' };
}

/** Probe boundary that replays scripted responses and treats unscripted hosts as absent. */
function createProbeHarness(): IProbeHarness {
	const executions: IProcessExecution[] = [];
	const rules: IProbeRule[] = [];
	return {
		executions,
		rule: rule => rules.push(rule),
		run: async execution => {
			executions.push(execution);
			const index = rules.findIndex(candidate => candidate.match(execution));
			if (index === -1) {
				return { exitCode: 1, stdout: '', stderr: 'spawn ENOENT', failure: 'spawn' };
			}
			const rule = rules[index];
			if (rule.once) {
				rules.splice(index, 1);
			}
			return await rule.respond(execution);
		},
	};
}

/** Scripts a usable SDK at one executable and installation root for the probe layer. */
function addSdkRules(probe: IProbeHarness, executable: string, version: string, root: string): void {
	const sdkRoot = path.join(root, 'sdk');
	const runtimeRoot = path.join(root, 'shared', 'Microsoft.NETCore.App');
	probe.rule({ match: execution => execution.executable === executable && execution.args.join(' ') === '--list-sdks', respond: () => processOk(`${version} [${sdkRoot}]\n`) });
	probe.rule({ match: execution => execution.executable === executable && execution.args.join(' ') === '--list-runtimes', respond: () => processOk(`Microsoft.NETCore.App 10.0.11 [${runtimeRoot}]\n`) });
	probe.rule({ match: execution => execution.executable === executable && execution.args[0] === 'exec', respond: () => processOk(`${version}\n`) });
}

/** Scripts a runtime-only host at one executable. */
function addRuntimeOnlyRules(probe: IProbeHarness, executable: string, root: string, once = false): void {
	probe.rule({ once, match: execution => execution.executable === executable && execution.args.join(' ') === '--list-sdks', respond: () => processOk('') });
	probe.rule({ once, match: execution => execution.executable === executable && execution.args.join(' ') === '--list-runtimes', respond: () => processOk(`Microsoft.NETCore.App 10.0.11 [${path.join(root, 'shared', 'Microsoft.NETCore.App')}]\n`) });
}

interface IInstallerRunnerHarness extends IDotnetInstallerProcessRunner {
	readonly executions: IDotnetInstallerExecution[];
	queue(result?: Partial<IDotnetInstallerProcessResult>): void;
	/** Queues one execution that stays in flight until the test resolves it. */
	queueDeferred(): { resolve(result?: Partial<IDotnetInstallerProcessResult>): void };
	readonly cancellationRequests: number;
}

/** Cancellable installer runner that replays queued outcomes and records every invocation. */
function createInstallerRunnerHarness(): IInstallerRunnerHarness {
	const executions: IDotnetInstallerExecution[] = [];
	const queued: Promise<IDotnetInstallerProcessResult>[] = [];
	let cancellations = 0;
	const settle = (result: Partial<IDotnetInstallerProcessResult> = {}): IDotnetInstallerProcessResult => ({ exitCode: 0, stdout: '', stderr: '', outcome: 'exited', recoveryRequired: false, ...result });
	return {
		executions,
		get cancellationRequests() {
			return cancellations;
		},
		queue: result => { queued.push(Promise.resolve(settle(result))); },
		queueDeferred: () => {
			let release!: (result: IDotnetInstallerProcessResult) => void;
			queued.push(new Promise<IDotnetInstallerProcessResult>(resolve => { release = resolve; }));
			return { resolve: result => release(settle(result)) };
		},
		run: async execution => {
			executions.push(execution);
			const next = queued.shift();
			if (next === undefined) {
				throw new Error(`unscripted installer execution: ${execution.executable} ${execution.args.join(' ')}`);
			}
			return await next;
		},
		cancel: () => { cancellations += 1; },
		deactivate: () => { cancellations += 1; },
	};
}

interface ITransportHarness {
	readonly transport: IDotnetScriptTransport;
	readonly requests: IDotnetScriptHttpRequest[];
	use(responder: (request: IDotnetScriptHttpRequest) => Promise<IDotnetScriptHttpResponse>): void;
}

function responseBody(chunks: readonly Buffer[]): IDotnetScriptHttpResponse {
	return {
		statusCode: 200,
		headers: {},
		body: {
			async *[Symbol.asyncIterator]() {
				for (const chunk of chunks) {
					yield chunk;
				}
			},
		},
	};
}

/** Transport harness whose default response is the reviewed-bytes fixture. */
function createTransportHarness(): ITransportHarness {
	const requests: IDotnetScriptHttpRequest[] = [];
	let responder: (request: IDotnetScriptHttpRequest) => Promise<IDotnetScriptHttpResponse> = async () => responseBody([SCRIPT_BODY]);
	return {
		requests,
		use: next => { responder = next; },
		transport: {
			get: async request => {
				requests.push(request);
				return await responder(request);
			},
		},
	};
}

/** Rejects exactly like an unreachable host so the download maps the `offline` failure. */
function offlineResponder(): Promise<IDotnetScriptHttpResponse> {
	return Promise.reject(Object.assign(new Error('offline fixture'), { code: 'ENOTFOUND' }));
}

/** Stays in flight until the composed download signal aborts, like a canceled node request. */
function abortableResponder(request: IDotnetScriptHttpRequest): Promise<IDotnetScriptHttpResponse> {
	return new Promise<IDotnetScriptHttpResponse>((_resolve, reject) => {
		request.signal.addEventListener('abort', () => reject(Object.assign(new Error('simulated abort'), { code: 'ABORT_ERR' })), { once: true });
	});
}

interface ISelectionHarness extends IDotnetSelectionPrompter {
	readonly selectCalls: number;
}

/** Explicit-selection prompter that replays queued results in call order. */
function createSelectionHarness(...results: readonly (DotnetSetupSelectionResult | Promise<DotnetSetupSelectionResult>)[]): ISelectionHarness {
	let calls = 0;
	return {
		get selectCalls() {
			return calls;
		},
		select: async (_externalArguments?: readonly unknown[]) => {
			const result = results[Math.min(calls, results.length - 1)];
			calls += 1;
			return await result;
		},
	};
}

interface ICancellationHarness extends IDotnetSetupCancellation {
	cancel(): void;
}

/** Cancellation source with the production subscribe shape used to abort downloads and children. */
function createCancellationHarness(): ICancellationHarness {
	let requested = false;
	const listeners = new Set<() => void>();
	return {
		get isCancellationRequested() {
			return requested;
		},
		onCancellationRequested: listener => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		cancel: () => {
			requested = true;
			for (const listener of [...listeners]) {
				listener();
			}
		},
	};
}

interface ISelectionUiHarness {
	readonly ui: IDotnetSelectionUi;
	readonly failures: IDotnetPrerequisiteFailure[];
}

/** Recording selection UI for the real explicit-selection prompter. */
function createSelectionUi(choice: DotnetChannelChoice | undefined, confirm = false, version?: string): ISelectionUiHarness {
	const failures: IDotnetPrerequisiteFailure[] = [];
	return {
		failures,
		ui: {
			chooseChannel: async () => choice,
			requestVersion: async () => version,
			explainInvalidVersion: () => undefined,
			confirmSelection: async () => confirm,
			revealActiveSelection: () => undefined,
			reportFailure: failure => { failures.push(failure); },
		},
	};
}

interface IHarnessContext {
	readonly home: string;
	readonly environment: IEnvironmentAdapter;
	readonly fileSystem: IInMemoryFileSystem;
}

interface IInstallerHarness {
	readonly home: string;
	readonly managedRoot: string;
	readonly environment: IEnvironmentAdapter;
	readonly fileSystem: IInMemoryFileSystem;
	readonly probe: IProbeHarness;
	readonly installer: IInstallerRunnerHarness;
	readonly transport: ITransportHarness;
	readonly ui: IRecordingUi;
	readonly selection: IDotnetSelectionPrompter;
	readonly controller: IDotnetInstallerController;
}

/**
 * Runs one test against an isolated temporary home. Detection and prerequisites use an in-memory
 * filesystem; the lock, stage, and publication layers use the real temporary home only, so no test
 * ever touches a user home or the network.
 */
async function withInstallerHarness(body: (harness: IInstallerHarness) => Promise<void>, configure?: (context: IHarnessContext) => Partial<IDotnetInstallerControllerOptions>): Promise<void> {
	await withTempDirectory('dotnet-installer-test-', async base => {
		const home = path.join(base, 'home');
		const temporaryDirectory = path.join(base, 'temporary');
		await fs.mkdir(home);
		await fs.mkdir(temporaryDirectory);

		const environment: IEnvironmentAdapter = { home, platform: 'linux', arch: 'x64', path: '/usr/bin' };
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile('/bin/bash');
		const probe = createProbeHarness();
		const installer = createInstallerRunnerHarness();
		const transport = createTransportHarness();
		const ui = createRecordingUi();
		const defaultSelection = createSelectionHarness({ kind: 'selected', selection: { kind: 'channel', channel: 'LTS' }, destination: managedRoot(home), architecture: 'x64' });

		const overrides = configure?.({ home, environment, fileSystem }) ?? {};
		const controller = createDotnetInstallerController({
			ui,
			environment,
			fileSystem,
			selection: defaultSelection,
			process: probe,
			installerProcess: installer,
			temporaryDirectory,
			transport: transport.transport,
			scriptFileWriter: createNodeScriptFileWriter(),
			scriptPin: SCRIPT_PIN,
			createOperationNonce: () => 'fixture',
			...overrides,
		});

		await body({
			home,
			managedRoot: managedRoot(home),
			environment: overrides.environment ?? environment,
			fileSystem,
			probe,
			installer,
			transport,
			ui,
			selection: overrides.selection ?? defaultSelection,
			controller,
		});
	});
}

suite('dotnet installer snapshots and detection', () => {
	test('starts in the checking state and reports a verified managed SDK as ready', async () => {
		await withInstallerHarness(async ({ home, probe, fileSystem, controller }) => {
			assert.deepStrictEqual(controller.getSnapshot(), {
				schemaVersion: 1,
				revision: 0,
				state: 'checking',
				locality: 'local',
			});

			fileSystem.addFile(managedExecutable(home));
			addSdkRules(probe, managedExecutable(home), EXPECTED_VERSION, managedRoot(home));
			const snapshot = await controller.recheck();

			assert.strictEqual(snapshot.state, 'ready');
			assert.deepStrictEqual(snapshot.verified, { executable: managedExecutable(home), sdkVersion: EXPECTED_VERSION });
			assert.ok(snapshot.revision > 0);
			assert.ok(isDotnetToolchainSnapshot(snapshot));
			assert.strictEqual(controller.getSnapshot(), snapshot);
		});
	});

	test('reports runtime-only and missing detection without inventing an SDK', async () => {
		await withInstallerHarness(async ({ home, probe, fileSystem, controller }) => {
			fileSystem.addFile(managedExecutable(home));
			addRuntimeOnlyRules(probe, managedExecutable(home), managedRoot(home), true);
			assert.strictEqual((await controller.recheck()).state, 'runtimeOnly');

			const missing = await controller.recheck();
			assert.strictEqual(missing.state, 'missing');
			assert.strictEqual(missing.verified, undefined);
			assert.ok(missing.revision > 0);
		});
	});

	test('reports a probe failure as a detection-stage failure rather than absence', async () => {
		await withInstallerHarness(async ({ home, probe, fileSystem, controller }) => {
			fileSystem.addFile(managedExecutable(home));
			probe.rule({ match: execution => execution.executable === managedExecutable(home) && execution.args.join(' ') === '--list-sdks', respond: () => ({ exitCode: 1, stdout: '', stderr: 'hostfxr: incompatible host' }) });
			probe.rule({ match: execution => execution.executable === managedExecutable(home) && execution.args.join(' ') === '--list-runtimes', respond: () => ({ exitCode: 1, stdout: '', stderr: 'hostfxr: incompatible host' }) });
			const snapshot = await controller.recheck();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'detect', code: 'inventory-error' });
		});
	});

	test('coalesces concurrent rechecks into one detection', async () => {
		await withInstallerHarness(async ({ controller }) => {
			const first = controller.recheck();
			const second = controller.recheck();
			assert.strictEqual(first, second);
			assert.strictEqual(await first, await second);
		});
	});

	test('reports a live lock from another window as busy progress and recovers after release', async () => {
		await withInstallerHarness(async ({ home, controller, probe }) => {
			const acquired = await acquireDotnetInstallLock({ home, platform: 'linux', operationDirectory: OTHER_OPERATION_NAME, phase: 'installing' });
			assert.strictEqual(acquired.kind, 'acquired');

			const busy = await controller.recheck();
			assert.strictEqual(busy.state, 'installing');
			assert.deepStrictEqual(busy.progress, { phase: 'installing', otherWindow: true });
			assert.strictEqual(probe.executions.length, 0);

			if (acquired.kind === 'acquired') {
				assert.deepStrictEqual(await acquired.lock.release(), { kind: 'applied' });
			}
			const recovered = await controller.recheck();
			assert.strictEqual(recovered.state, 'missing');
			assert.strictEqual(recovered.progress, undefined);
		});
	});

	test('reports an unreadable existing lock as recovery-required', async () => {
		await withInstallerHarness(async ({ home, controller, probe }) => {
			await fs.mkdir(path.join(walkerRoot(home), 'dotnet-install.lock'), { recursive: true });
			const snapshot = await controller.recheck();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'recovery', code: 'metadata-missing' });
			assert.strictEqual(probe.executions.length, 0);
		});
	});

	test('keeps a setup failure visible when a stale detection completes late', async () => {
		await withInstallerHarness(async ({ home, probe, transport, controller }) => {
			let resolveStaleProbe!: (result: IProcessExecutionResult) => void;
			probe.rule({
				once: true,
				match: execution => execution.executable === managedExecutable(home) && execution.args.join(' ') === '--list-sdks',
				respond: () => new Promise<IProcessExecutionResult>(resolve => {
					resolveStaleProbe = resolve;
				}),
			});

			const staleDetection = controller.recheck();
			await waitFor(() => resolveStaleProbe !== undefined);

			transport.use(offlineResponder);
			const failed = await controller.setup();
			assert.strictEqual(failed.state, 'failed');
			assert.deepStrictEqual(failed.failure, { stage: 'download', code: 'offline' });

			resolveStaleProbe(processOk(`${EXPECTED_VERSION} [${path.join(managedRoot(home), 'sdk')}]\n`));
			await staleDetection;
			assert.strictEqual(controller.getSnapshot().state, 'failed');

			probe.rule({ match: execution => execution.executable === managedExecutable(home) && execution.args.join(' ') === '--list-sdks', respond: () => processOk(`${EXPECTED_VERSION} [${path.join(managedRoot(home), 'sdk')}]\n`) });
			probe.rule({ match: execution => execution.executable === managedExecutable(home) && execution.args.join(' ') === '--list-runtimes', respond: () => processOk('') });
			probe.rule({ match: execution => execution.executable === managedExecutable(home) && execution.args[0] === 'exec', respond: () => processOk(`${EXPECTED_VERSION}\n`) });
			const recovered = await controller.recheck();
			assert.strictEqual(recovered.state, 'ready');
		});
	});
});

suite('dotnet installer setup authorization and failure transitions', () => {
	test('keeps the home directory untouched when the channel chooser is canceled', async () => {
		const selectionUi = createSelectionUi(undefined);
		await withInstallerHarness(async ({ home, probe, transport, installer, controller }) => {
			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'checking');
			assert.strictEqual(snapshot.revision, 0);
			assert.strictEqual(await pathExists(walkerRoot(home)), false);
			assert.deepStrictEqual([probe.executions.length, transport.requests.length, installer.executions.length], [0, 0, 0]);
		}, ({ environment, fileSystem }) => ({ selection: createDotnetSelectionPrompter({ ui: selectionUi.ui, environment, fileSystem }) }));
	});

	test('keeps the home directory untouched when the final confirmation is canceled', async () => {
		const selectionUi = createSelectionUi('LTS', false);
		await withInstallerHarness(async ({ home, probe, transport, installer, controller }) => {
			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'checking');
			assert.strictEqual(await pathExists(walkerRoot(home)), false);
			assert.deepStrictEqual([probe.executions.length, transport.requests.length, installer.executions.length], [0, 0, 0]);
		}, ({ environment, fileSystem }) => ({ selection: createDotnetSelectionPrompter({ ui: selectionUi.ui, environment, fileSystem }) }));
	});

	test('reports a prerequisite failure before any prompt, download, or write', async () => {
		const selectionUi = createSelectionUi('LTS', true);
		await withInstallerHarness(async ({ home, probe, transport, installer, ui, controller }) => {
			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'process', code: 'unsupported-architecture' });
			assert.strictEqual(await pathExists(walkerRoot(home)), false);
			assert.deepStrictEqual([probe.executions.length, transport.requests.length, installer.executions.length], [0, 0, 0]);
			assert.ok(selectionUi.failures.some(failure => failure.code === 'unsupported-architecture'));
			assert.ok(ui.output.some(line => line.includes('unsupported-architecture')));
		}, ({ home, fileSystem }) => {
			const environment: IEnvironmentAdapter = { home, platform: 'linux', arch: 'ppc64', path: '/usr/bin' };
			return { environment, selection: createDotnetSelectionPrompter({ ui: selectionUi.ui, environment, fileSystem }) };
		});
	});

	test('reveals the active chooser instead of starting a second operation', async () => {
		let releaseSelection!: (result: DotnetSetupSelectionResult) => void;
		const pending = new Promise<DotnetSetupSelectionResult>(resolve => { releaseSelection = resolve; });
		const selection = createSelectionHarness(pending, { kind: 'active' });
		await withInstallerHarness(async ({ controller, installer, transport }) => {
			const first = controller.setup();
			const repeated = await controller.setup();
			assert.strictEqual(repeated.state, 'checking');
			assert.strictEqual(selection.selectCalls, 2);
			assert.deepStrictEqual([installer.executions.length, transport.requests.length], [0, 0]);

			releaseSelection({ kind: 'canceled', stage: 'confirmation' });
			assert.strictEqual((await first).state, 'checking');
		}, () => ({ selection }));
	});

	test('reports another window holding the lock without starting an installer', async () => {
		await withInstallerHarness(async ({ home, controller, installer, transport }) => {
			const acquired = await acquireDotnetInstallLock({ home, platform: 'linux', operationDirectory: OTHER_OPERATION_NAME, phase: 'verifying' });
			assert.strictEqual(acquired.kind, 'acquired');

			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'verifying');
			assert.deepStrictEqual(snapshot.progress, { phase: 'verifying', otherWindow: true });
			assert.deepStrictEqual([installer.executions.length, transport.requests.length], [0, 0]);

			if (acquired.kind === 'acquired') {
				await acquired.lock.release();
			}
		});
	});

	test('installs the selected channel through dry-run resolution and reports the verified managed SDK', async () => {
		await withInstallerHarness(async ({ home, probe, installer, transport, controller }) => {
			addSdkRules(probe, stageExecutable(home), EXPECTED_VERSION, stageDirectory(home));
			addSdkRules(probe, managedExecutable(home), EXPECTED_VERSION, managedRoot(home));
			installer.queue({ stdout: `Repeatable invocation: ./dotnet-install.sh --version "${EXPECTED_VERSION}" --install-dir /stage --architecture x64 --no-path\n` });
			installer.queue({});

			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'ready');
			assert.deepStrictEqual(snapshot.verified, { executable: managedExecutable(home), sdkVersion: EXPECTED_VERSION });
			assert.ok(isDotnetToolchainSnapshot(snapshot));
			assert.strictEqual(transport.requests.length, 1);
			assert.strictEqual(installer.executions.length, 2);

			const scriptPath = path.join(operationRoot(home), SCRIPT_PIN.fileName);
			const fixed = ['--install-dir', stageDirectory(home), '--architecture', 'x64', '--no-path'];
			assert.deepStrictEqual(installer.executions[0].args, [scriptPath, '--channel', 'LTS', ...fixed, '--dry-run']);
			assert.deepStrictEqual(installer.executions[1].args, [scriptPath, '--channel', 'LTS', ...fixed]);
			assert.deepStrictEqual(installer.executions[1].env, {});
			assert.deepStrictEqual(installer.executions[1].cwd, stageDirectory(home));

			assert.deepStrictEqual(await inspectDotnetInstallLock({ home, platform: 'linux' }), { kind: 'free' });
			const journal = JSON.parse(await fs.readFile(path.join(operationRoot(home), 'journal.json'), 'utf8')) as { readonly step?: string };
			assert.strictEqual(journal.step, 'committed');
		});
	});

	test('installs an exact version without a channel dry-run', async () => {
		await withInstallerHarness(async ({ home, probe, installer, controller }) => {
			addSdkRules(probe, stageExecutable(home), EXPECTED_VERSION, stageDirectory(home));
			addSdkRules(probe, managedExecutable(home), EXPECTED_VERSION, managedRoot(home));
			installer.queue({});

			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'ready');
			assert.strictEqual(installer.executions.length, 1);
			assert.strictEqual(installer.executions[0].args[1], '--version');
			assert.strictEqual(installer.executions[0].args[2], EXPECTED_VERSION);
			assert.ok(!installer.executions[0].args.includes('--dry-run'));
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('releases the lock and preserves the prior managed SDK when the download fails', async () => {
		await withInstallerHarness(async ({ home, probe, transport, controller, installer }) => {
			await writeManagedSdk(home, EXPECTED_VERSION);
			const before = await readManagedSdk(home, EXPECTED_VERSION);
			transport.use(offlineResponder);

			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'download', code: 'offline' });
			assert.deepStrictEqual(await readManagedSdk(home, EXPECTED_VERSION), before);
			assert.strictEqual(installer.executions.length, 0);
			assert.strictEqual(await pathExists(operationRoot(home)), false);
			assert.deepStrictEqual(await inspectDotnetInstallLock({ home, platform: 'linux' }), { kind: 'free' });

			// The surviving managed SDK is reported again only by an explicit recheck.
			addSdkRules(probe, managedExecutable(home), EXPECTED_VERSION, managedRoot(home));
			const recovered = await controller.recheck();
			assert.strictEqual(recovered.state, 'ready');
			assert.deepStrictEqual(recovered.verified, { executable: managedExecutable(home), sdkVersion: EXPECTED_VERSION });
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('cancels an in-flight script download without publishing or leaving owned data', async () => {
		await withInstallerHarness(async ({ home, transport, controller }) => {
			const cancellation = createCancellationHarness();
			transport.use(abortableResponder);

			const setup = controller.setup({ cancellation });
			await waitFor(() => transport.requests.length === 1);
			cancellation.cancel();
			const snapshot = await setup;

			assert.strictEqual(snapshot.state, 'missing');
			assert.strictEqual(await pathExists(operationRoot(home)), false);
			assert.strictEqual(await pathExists(managedRoot(home)), false);
			assert.deepStrictEqual(await inspectDotnetInstallLock({ home, platform: 'linux' }), { kind: 'free' });
		});
	});

	test('discards owned data and reports a disk-full preparation failure', async () => {
		await withInstallerHarness(async ({ home, probe, controller, installer }) => {
			await writeManagedSdk(home, EXPECTED_VERSION);
			const before = await readManagedSdk(home, EXPECTED_VERSION);

			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'publish', code: 'disk-full' });
			assert.deepStrictEqual(await readManagedSdk(home, EXPECTED_VERSION), before);
			assert.strictEqual(await pathExists(operationRoot(home)), false);
			assert.deepStrictEqual([installer.executions.length, probe.executions.length], [0, 0]);
			assert.deepStrictEqual(await inspectDotnetInstallLock({ home, platform: 'linux' }), { kind: 'free' });
		}, ({ home }) => ({
			selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }),
			stageFileOperations: {
				copyFile: async () => {
					throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
				},
			},
		}));
	});
});

suite('dotnet installer verification and process transitions', () => {
	test('reports a nonzero installer exit as a process-stage failure', async () => {
		await withInstallerHarness(async ({ home, installer, controller }) => {
			installer.queue({ exitCode: 1, stderr: 'official installer failed' });
			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'process', code: 'installer-exit' });
			assert.strictEqual(await pathExists(managedRoot(home)), false);
			assert.strictEqual(await pathExists(operationRoot(home)), false);
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('reports a spawn failure as a process-stage failure', async () => {
		await withInstallerHarness(async ({ installer, controller }) => {
			installer.queue({ outcome: 'spawn-failed', exitCode: 1, stderr: 'spawn ENOENT' });
			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'process', code: 'spawn-failed' });
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('does not accept a zero exit code without the expected SDK', async () => {
		await withInstallerHarness(async ({ home, installer, controller }) => {
			installer.queue({});
			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'verify', code: 'expected-version-missing' });
			assert.strictEqual(await pathExists(managedRoot(home)), false);
			assert.strictEqual(await pathExists(operationRoot(home)), false);
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('fails verification when the channel moved between dry-run and install', async () => {
		await withInstallerHarness(async ({ home, probe, installer, controller }) => {
			addSdkRules(probe, stageExecutable(home), '10.0.402', stageDirectory(home));
			installer.queue({ stdout: `Repeatable invocation: ./dotnet-install.sh --version "${EXPECTED_VERSION}" --install-dir /stage\n` });
			installer.queue({});

			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'verify', code: 'expected-version-missing' });
			assert.strictEqual(installer.executions.length, 2);
			assert.strictEqual(await pathExists(managedRoot(home)), false);
			assert.strictEqual(await pathExists(operationRoot(home)), false);
		});
	});

	test('reports a listed but unexecutable staged SDK as a verification failure', async () => {
		await withInstallerHarness(async ({ home, probe, installer, controller }) => {
			probe.rule({ match: execution => execution.executable === stageExecutable(home) && execution.args.join(' ') === '--list-sdks', respond: () => processOk(`${EXPECTED_VERSION} [${path.join(stageDirectory(home), 'sdk')}]\n`) });
			probe.rule({ match: execution => execution.executable === stageExecutable(home) && execution.args.join(' ') === '--list-runtimes', respond: () => processOk('') });
			probe.rule({ match: execution => execution.executable === stageExecutable(home) && execution.args[0] === 'exec', respond: () => ({ exitCode: 1, stdout: '', stderr: 'msbuild host failed' }) });
			installer.queue({});

			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'verify', code: 'sdk-not-executable' });
			assert.strictEqual(await pathExists(managedRoot(home)), false);
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('cancels a running installer through the process-tree bridge and re-detects', async () => {
		await withInstallerHarness(async ({ home, installer, controller }) => {
			const cancellation = createCancellationHarness();
			const deferred = installer.queueDeferred();

			const setup = controller.setup({ cancellation });
			await waitFor(() => installer.executions.length === 1);
			cancellation.cancel();
			assert.strictEqual(installer.cancellationRequests, 1);
			// The production runner stops the process tree and resolves a proven cancel.
			deferred.resolve({ outcome: 'terminated', terminationReason: 'canceled', exitCode: 1, recoveryRequired: false });

			const snapshot = await setup;
			assert.strictEqual(snapshot.state, 'missing');
			assert.strictEqual(await pathExists(operationRoot(home)), false);
			assert.deepStrictEqual(await inspectDotnetInstallLock({ home, platform: 'linux' }), { kind: 'free' });
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('fails safely when the channel dry-run cannot resolve one version', async () => {
		await withInstallerHarness(async ({ home, installer, transport, controller }) => {
			installer.queue({ stdout: 'No repeatable invocation available\n' });
			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'download', code: 'channel-unresolved' });
			assert.strictEqual(installer.executions.length, 1);
			assert.strictEqual(transport.requests.length, 1);
			assert.strictEqual(await pathExists(operationRoot(home)), false);
		});
	});

	test('cancels during verification without publishing the staged SDK', async () => {
		await withInstallerHarness(async ({ home, probe, installer, controller }) => {
			let resolveStageProbe!: (result: IProcessExecutionResult) => void;
			probe.rule({
				once: true,
				match: execution => execution.executable === stageExecutable(home) && execution.args.join(' ') === '--list-sdks',
				respond: () => new Promise<IProcessExecutionResult>(resolve => { resolveStageProbe = resolve; }),
			});
			const cancellation = createCancellationHarness();
			installer.queue({});

			const setup = controller.setup({ cancellation });
			await waitFor(() => resolveStageProbe !== undefined);
			cancellation.cancel();
			resolveStageProbe(processOk(`${EXPECTED_VERSION} [${path.join(stageDirectory(home), 'sdk')}]\n`));
			const snapshot = await setup;

			assert.strictEqual(snapshot.state, 'missing');
			assert.strictEqual(await pathExists(managedRoot(home)), false);
			assert.strictEqual(await pathExists(operationRoot(home)), false);
			assert.deepStrictEqual(await inspectDotnetInstallLock({ home, platform: 'linux' }), { kind: 'free' });
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('retains the lock and owned data when the installer process tree cannot be proven gone', async () => {
		await withInstallerHarness(async ({ home, installer, controller }) => {
			installer.queue({ outcome: 'recovery-required', recoveryRequired: true, exitCode: 1, stderr: 'process-tree exit unproven' });
			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'recovery', code: 'process-tree-recovery-required' });
			assert.strictEqual(await pathExists(operationRoot(home)), true);
			const lock = await inspectDotnetInstallLock({ home, platform: 'linux' });
			assert.strictEqual(lock.kind, 'busy');
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('reports a timeout as a process-stage failure', async () => {
		await withInstallerHarness(async ({ installer, controller }) => {
			installer.queue({ outcome: 'terminated', terminationReason: 'timeout', exitCode: 1, stderr: 'budget exhausted' });
			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'process', code: 'timeout' });
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});
});

suite('dotnet installer publication and recovery', () => {
	test('publishes over a pre-existing managed SDK and retains its bytes in the backup', async () => {
		await withInstallerHarness(async ({ home, probe, installer, controller }) => {
			await writeManagedSdk(home, EXPECTED_VERSION);
			addSdkRules(probe, stageExecutable(home), EXPECTED_VERSION, stageDirectory(home));
			addSdkRules(probe, managedExecutable(home), EXPECTED_VERSION, managedRoot(home));
			installer.queue({});

			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'ready');
			assert.deepStrictEqual(await readManagedSdk(home, EXPECTED_VERSION), ['pre-existing managed host', 'pre-existing managed sdk']);
			assert.strictEqual(await fs.readFile(path.join(operationRoot(home), 'backup', 'dotnet'), 'utf8'), 'pre-existing managed host');
			assert.deepStrictEqual(await inspectDotnetInstallLock({ home, platform: 'linux' }), { kind: 'free' });
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('restores the prior SDK when the final managed verification fails', async () => {
		await withInstallerHarness(async ({ home, probe, installer, controller }) => {
			await writeManagedSdk(home, EXPECTED_VERSION);
			addSdkRules(probe, stageExecutable(home), EXPECTED_VERSION, stageDirectory(home));
			installer.queue({});

			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'verify', code: 'verify-failed' });
			assert.deepStrictEqual(await readManagedSdk(home, EXPECTED_VERSION), ['pre-existing managed host', 'pre-existing managed sdk']);
			assert.strictEqual(await pathExists(operationRoot(home)), true);
			assert.deepStrictEqual(await inspectDotnetInstallLock({ home, platform: 'linux' }), { kind: 'free' });
		}, ({ home }) => ({ selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }) }));
	});

	test('retains the lock and every tree when publication restoration cannot be proven', async () => {
		await withInstallerHarness(async ({ home, probe, installer, controller }) => {
			await writeManagedSdk(home, EXPECTED_VERSION);
			addSdkRules(probe, stageExecutable(home), EXPECTED_VERSION, stageDirectory(home));
			addSdkRules(probe, managedExecutable(home), EXPECTED_VERSION, managedRoot(home));
			installer.queue({});

			const snapshot = await controller.setup();
			assert.strictEqual(snapshot.state, 'failed');
			assert.deepStrictEqual(snapshot.failure, { stage: 'recovery', code: 'sharing-violation' });
			assert.strictEqual(await pathExists(operationRoot(home)), true);
			const lock = await inspectDotnetInstallLock({ home, platform: 'linux' });
			assert.strictEqual(lock.kind, 'busy');
		}, ({ home }) => ({
			selection: createSelectionHarness({ kind: 'selected', selection: { kind: 'version', version: EXPECTED_VERSION }, destination: managedRoot(home), architecture: 'x64' }),
			publicationFileOperations: {
				rename: async (source, destination) => {
					if (source === stageDirectory(home)) {
						throw Object.assign(new Error('sharing violation'), { code: 'EBUSY' });
					}
					if (source === path.join(operationRoot(home), 'backup')) {
						throw Object.assign(new Error('restore denied'), { code: 'EACCES' });
					}
					await fs.rename(source, destination);
				},
			},
		}));
	});

	test('dispose discards late detections and stops owned installer children', async () => {
		await withInstallerHarness(async ({ controller, installer }) => {
			const pending = controller.recheck();
			controller.dispose();
			await pending;
			assert.strictEqual(controller.getSnapshot().state, 'checking');
			assert.strictEqual(installer.cancellationRequests, 1);
		});
	});
});
