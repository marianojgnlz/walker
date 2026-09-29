/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { DOTNET_TOOLCHAIN_COMMANDS, type IEnvironmentAdapter, type IProcessAdapter, type IProcessExecution, type IToolchainUi, type IDotnetToolchainSnapshot } from '../contracts';
import { resolveDotnetProxy } from '../download';
import {
	activateDotnetToolchain,
	createDotnetSelectionUi,
	createVscodeExtensionHost,
	parseDotnetProxySetting,
	type IDotnetExtensionHost,
} from '../extension';
import { createDotnetInstallerController, type IDotnetInstallerController } from '../installer';
import type { IDotnetInstallerExecution, IDotnetInstallerProcessRunner } from '../processRunner';
import type { DotnetVersionRejectionReason } from '../selection';
import { createDotnetSelectionPrompter } from '../selection';
import type { DotnetPrerequisiteFailureCode } from '../platformArguments';
import type { IDotnetScriptHttpRequest, IDotnetScriptHttpResponse, IDotnetScriptTransport } from '../download';
import type { IDotnetDisposable } from '../status';
import { createInMemoryFileSystem, withTempDirectory, type IInMemoryFileSystem } from './fixtures';
import {
	createControllerStub,
	createDotnetHostHarness,
	createFakeVscodeApi,
	dotnetSnapshot,
	type IDotnetHostHarness,
} from './hostFixtures';

/** Waits for a real-filesystem detection to leave the initial checking state. */
async function waitForDetection(extension: { getSnapshot(): IDotnetToolchainSnapshot }): Promise<IDotnetToolchainSnapshot> {
	let snapshot = extension.getSnapshot();
	for (let attempt = 0; attempt < 500 && snapshot.state === 'checking'; attempt++) {
		await new Promise<void>(resolve => setImmediate(resolve));
		snapshot = extension.getSnapshot();
	}
	return snapshot;
}

interface IProbeFixture extends IProcessAdapter {
	readonly executions: IProcessExecution[];
}

interface IInstallerFixture extends IDotnetInstallerProcessRunner {
	readonly executions: IDotnetInstallerExecution[];
}

interface ITransportFixture extends IDotnetScriptTransport {
	readonly requests: IDotnetScriptHttpRequest[];
}

interface IControllerFixture {
	readonly home: string;
	readonly environment: IEnvironmentAdapter;
	readonly fileSystem: IInMemoryFileSystem;
	readonly probe: IProbeFixture;
	readonly installer: IInstallerFixture;
	readonly transport: ITransportFixture;
	createController(ui: IToolchainUi): IDotnetInstallerController;
}

/**
 * Runs one extension-boundary test against an isolated temporary home. Discovery uses an in-memory
 * filesystem and every probe is scripted to look absent, so no test spawns a real process, reaches
 * the network, or writes outside the OS temporary root.
 */
async function withControllerFixture(host: IDotnetHostHarness, body: (fixture: IControllerFixture) => Promise<void>): Promise<void> {
	await withTempDirectory('dotnet-extension-test-', async base => {
		const home = path.join(base, 'home');
		const temporaryDirectory = path.join(base, 'temporary');
		await fs.mkdir(home);
		await fs.mkdir(temporaryDirectory);
		const environment: IEnvironmentAdapter = { home, platform: 'linux', arch: 'x64', path: '/usr/bin' };
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile('/bin/bash');
		const probeExecutions: IProcessExecution[] = [];
		const probe: IProbeFixture = {
			executions: probeExecutions,
			run: async execution => {
				probeExecutions.push(execution);
				return { exitCode: 1, stdout: '', stderr: 'spawn ENOENT', failure: 'spawn' };
			},
		};
		const installerExecutions: IDotnetInstallerExecution[] = [];
		const installer: IInstallerFixture = {
			executions: installerExecutions,
			run: async execution => {
				installerExecutions.push(execution);
				throw new Error(`unexpected installer execution: ${execution.executable}`);
			},
			cancel: () => undefined,
			deactivate: () => undefined,
		};
		const transportRequests: IDotnetScriptHttpRequest[] = [];
		const transport: ITransportFixture = {
			requests: transportRequests,
			get: async (request: IDotnetScriptHttpRequest): Promise<IDotnetScriptHttpResponse> => {
				transportRequests.push(request);
				throw new Error('unexpected network request');
			},
		};
		const createController = (ui: IToolchainUi): IDotnetInstallerController => createDotnetInstallerController({
			ui,
			environment,
			fileSystem,
			selection: createDotnetSelectionPrompter({ ui: createDotnetSelectionUi(host), environment, fileSystem }),
			process: probe,
			installerProcess: installer,
			temporaryDirectory,
			transport,
			scriptFileWriter: { writePrivateFile: async () => undefined },
		});
		await body({ home, environment, fileSystem, probe, installer, transport, createController });
	});
}

suite('dotnet extension command boundary', () => {
	test('registers every command synchronously with immediate subscription ownership and starts detection only', () => {
		const host = createDotnetHostHarness();
		const subscriptions: IDotnetDisposable[] = [];
		const controller = createControllerStub(dotnetSnapshot('checking'));
		let factoryCalls = 0;
		let controllerUi: IToolchainUi | undefined;
		const extension = activateDotnetToolchain({
			host,
			extensionKind: 'ui',
			subscriptions,
			createController: ui => {
				factoryCalls += 1;
				controllerUi = ui;
				return controller;
			},
		});

		assert.strictEqual(factoryCalls, 1, 'the controller must be constructed once for a supported host');
		assert.deepStrictEqual([...host.commands.keys()].sort(), Object.values(DOTNET_TOOLCHAIN_COMMANDS).sort(), 'all commands must be registered synchronously');
		assert.strictEqual(host.registrations.length, 5);
		for (const registration of host.registrations) {
			assert.ok(subscriptions.includes(registration.disposable), `${registration.id} must be owned immediately`);
		}
		assert.strictEqual(subscriptions.length, 7, 'status, controller and five registrations must be owned');
		assert.strictEqual(controller.recheckCalls, 1, 'activation must start exactly one detection');
		assert.strictEqual(controller.setupRequests.length, 0, 'activation must never start setup');
		assert.ok(controllerUi !== undefined, 'the controller must receive the status UI');
		controllerUi.appendOutput('from-core');
		assert.deepStrictEqual([...host.output.lines].filter(line => line === 'from-core'), ['from-core'], 'core output must flow into the status channel');
		extension.dispose();
	});

	test('returns an immediate snapshot from getState while detection is pending', async () => {
		const host = createDotnetHostHarness();
		const subscriptions: IDotnetDisposable[] = [];
		const controller = createControllerStub(dotnetSnapshot('checking', { revision: 0 }));
		activateDotnetToolchain({ host, extensionKind: 'ui', subscriptions, createController: () => controller });
		const getState = host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.getState)!;
		assert.deepStrictEqual(getState(), dotnetSnapshot('checking', { revision: 0 }), 'getState must not wait for detection');
		assert.strictEqual(host.progressCalls.length, 0, 'getState must not present progress');
	});

	test('updates the status item on recheck and runs setup under progress with raw external arguments', async () => {
		const host = createDotnetHostHarness();
		const subscriptions: IDotnetDisposable[] = [];
		const controller = createControllerStub(dotnetSnapshot('checking'));
		activateDotnetToolchain({ host, extensionKind: 'ui', subscriptions, createController: () => controller });

		controller.setSnapshot(dotnetSnapshot('missing', { revision: 4 }));
		const recheck = host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.recheck)!;
		const rechecked = await recheck() as IDotnetToolchainSnapshot;
		assert.deepStrictEqual(rechecked, dotnetSnapshot('missing', { revision: 4 }));
		assert.strictEqual(host.statusItem.text, '«$(circle-slash) .NET SDK: Not Installed»', 'recheck must refresh the status item');

		controller.setSnapshot(dotnetSnapshot('failed', { revision: 5, failure: { stage: 'detect', code: 'inventory-error' } }));
		const setup = host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.setup)!;
		const terminal = await setup('--version', '9.9.9') as IDotnetToolchainSnapshot;
		assert.strictEqual(terminal.state, 'failed');
		assert.strictEqual(host.progressCalls.length, 1, 'setup must present progress');
		assert.deepStrictEqual(controller.setupRequests[0]?.externalArguments, ['--version', '9.9.9'], 'command arguments must be forwarded verbatim, never interpreted');
		assert.ok(controller.setupRequests[0]?.cancellation !== undefined, 'setup must receive the progress cancellation token');
		assert.strictEqual(host.statusItem.text, '«$(error) .NET SDK: Setup Failed»');
		host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.showOutput)!();
		assert.strictEqual(host.output.shown, 1);
	});

	test('host guard: desktop local and desktop remote UI hosts are available', () => {
		const cases: readonly { readonly label: string; readonly remoteName?: string }[] = [
			{ label: 'desktop local' },
			{ label: 'desktop remote UI', remoteName: 'ssh-remote' },
		];
		for (const entry of cases) {
			const host = createDotnetHostHarness({ uiKind: 'desktop', ...(entry.remoteName === undefined ? {} : { remoteName: entry.remoteName }) });
			const subscriptions: IDotnetDisposable[] = [];
			const controller = createControllerStub(dotnetSnapshot('checking'));
			let factoryCalls = 0;
			const extension = activateDotnetToolchain({ host, extensionKind: 'ui', subscriptions, createController: () => { factoryCalls += 1; return controller; } });
			assert.strictEqual(extension.available, true, `${entry.label} must be available`);
			assert.strictEqual(factoryCalls, 1, `${entry.label} must construct the local controller`);
			assert.strictEqual(controller.recheckCalls, 1);
			extension.dispose();
		}
	});

	test('host guard: browser and forced remote hosts are unavailable and never construct a controller', async () => {
		const cases: readonly { readonly label: string; readonly uiKind: 'desktop' | 'web'; readonly extensionKind: 'ui' | 'workspace' | undefined }[] = [
			{ label: 'browser', uiKind: 'web', extensionKind: 'ui' },
			{ label: 'forced remote workspace host', uiKind: 'desktop', extensionKind: 'workspace' },
			{ label: 'unknown extension host', uiKind: 'desktop', extensionKind: undefined },
		];
		for (const entry of cases) {
			const host = createDotnetHostHarness({ uiKind: entry.uiKind });
			const subscriptions: IDotnetDisposable[] = [];
			let factoryCalls = 0;
			const extension = activateDotnetToolchain({ host, extensionKind: entry.extensionKind, subscriptions, createController: () => { factoryCalls += 1; throw new Error('must not construct'); } });
			assert.strictEqual(extension.available, false, `${entry.label} must be unavailable`);
			assert.strictEqual(factoryCalls, 0, `${entry.label} must not construct a local controller`);
			assert.strictEqual(extension.getSnapshot().state, 'unavailable', `${entry.label} must report unavailable`);
			assert.strictEqual(host.progressCalls.length, 0);
			const getState = await host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.getState)!() as IDotnetToolchainSnapshot;
			const setup = await host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.setup)!() as IDotnetToolchainSnapshot;
			const recheck = await host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.recheck)!() as IDotnetToolchainSnapshot;
			assert.strictEqual(getState.state, 'unavailable');
			assert.strictEqual(setup.state, 'unavailable', `${entry.label} setup must not start a chooser or install`);
			assert.strictEqual(recheck.state, 'unavailable');
			assert.ok(host.output.lines.some(line => line.startsWith('«')), `${entry.label} must explain the unavailability in localized output`);
			assert.strictEqual(host.statusItem.text, '«$(circle-slash) .NET SDK: Unavailable Here»');
			assert.strictEqual(subscriptions.length, 6, 'unavailable hosts own the status and five registrations');
			extension.dispose();
		}
	});

	test('degrades to unavailable when the controller cannot be constructed', async () => {
		const host = createDotnetHostHarness();
		const subscriptions: IDotnetDisposable[] = [];
		const extension = activateDotnetToolchain({ host, extensionKind: 'ui', subscriptions, createController: () => { throw new Error('broken composition'); } });
		assert.strictEqual(extension.available, true, 'the host is supported even when composition fails');
		assert.strictEqual(extension.getSnapshot().state, 'unavailable', 'a construction failure must not report checking forever');
		const setup = await host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.setup)!() as IDotnetToolchainSnapshot;
		assert.strictEqual(setup.state, 'unavailable');
		assert.ok(host.output.lines.some(line => line.includes('«') && line.includes('broken composition')), 'the construction failure must be diagnosed truthfully');
		extension.dispose();
	});

	test('setup command arguments cannot bypass the explicit chooser', async () => {
		const host = createDotnetHostHarness();
		const subscriptions: IDotnetDisposable[] = [];
		await withControllerFixture(host, async fixture => {
			const extension = activateDotnetToolchain({ host, extensionKind: 'ui', subscriptions, createController: ui => fixture.createController(ui) });
			host.queueQuickPick(undefined);
			const setup = host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.setup)!;
			const result = await setup('--channel', 'STS', '--version', '1.2.3') as IDotnetToolchainSnapshot;

			assert.strictEqual(result.state, 'checking', 'a canceled chooser must not fabricate a terminal state');
			assert.strictEqual(fixture.installer.executions.length, 0, 'no installer may run without confirmation');
			assert.strictEqual(fixture.transport.requests.length, 0, 'no script may be downloaded without confirmation');
			const chooser = host.quickPicks.at(-1);
			assert.ok(chooser !== undefined, 'the chooser must open despite the supplied arguments');
			assert.deepStrictEqual(chooser.items.map(item => item.id), ['LTS', 'STS', 'specific']);
			assert.ok(chooser.placeHolder.includes('local machine'), 'the chooser must label the local machine');
			assert.ok(chooser.placeHolder.includes(path.join('.walker', 'dotnet')), 'the chooser must label the local destination');
			assert.strictEqual(host.inputBoxes.length, 0, 'a channel chooser must not auto-fill a version prompt');
			assert.strictEqual(await fs.stat(path.join(fixture.home, '.walker')).then(() => true, () => false), false, 'canceled setup must not touch the managed root');
			extension.dispose();
		});
	});

	test('cancelling the version and confirmation prompts leaves the machine untouched', async () => {
		const host = createDotnetHostHarness();
		const subscriptions: IDotnetDisposable[] = [];
		await withControllerFixture(host, async fixture => {
			const extension = activateDotnetToolchain({ host, extensionKind: 'ui', subscriptions, createController: ui => fixture.createController(ui) });
			const setup = host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.setup)!;

			host.queueQuickPick({ id: 'specific', label: 'queued' });
			host.queueInputBox(undefined);
			const canceledVersion = await setup('1.2.3') as IDotnetToolchainSnapshot;
			assert.strictEqual(canceledVersion.state, 'checking');
			assert.strictEqual(host.inputBoxes.length, 1, 'the exact-version prompt must open');
			assert.ok(!host.inputBoxes[0].prompt.includes('1.2.3'), 'supplied arguments must never become the version input');
			assert.strictEqual(host.warnings.length, 0, 'a canceled version must not reach confirmation');

			host.queueQuickPick({ id: 'LTS', label: 'queued' });
			host.queueWarning(undefined);
			const canceledConfirmation = await setup() as IDotnetToolchainSnapshot;
			assert.strictEqual(canceledConfirmation.state, 'checking');
			assert.strictEqual(host.warnings.length, 1, 'the confirmation must open for a selected channel');
			assert.deepStrictEqual(host.warnings[0].options, { modal: true }, 'confirmation must be an explicit modal choice');
			assert.ok(host.warnings[0].items.some(item => item.includes('Install')), 'confirmation must have a localized confirm label');
			assert.strictEqual(fixture.installer.executions.length, 0);
			assert.strictEqual(fixture.transport.requests.length, 0);
			extension.dispose();
		});
	});

	test('startup detection only reads the local machine and never installs', async () => {
		const host = createDotnetHostHarness();
		const subscriptions: IDotnetDisposable[] = [];
		await withControllerFixture(host, async fixture => {
			const extension = activateDotnetToolchain({ host, extensionKind: 'ui', subscriptions, createController: ui => fixture.createController(ui) });
			const detected = await waitForDetection(extension);
			assert.strictEqual(detected.state, 'missing', 'an absent local toolchain must be detected as missing');
			assert.ok(fixture.probe.executions.length > 0, 'startup must probe the local candidates');
			for (const execution of fixture.probe.executions) {
				assert.ok(['--list-sdks', '--list-runtimes'].includes(execution.args[0]), `startup probing must stay read-only: ${execution.args.join(' ')}`);
				assert.strictEqual(execution.cwd.startsWith(fixture.home), false, 'probes must not run in the home directory');
			}
			assert.strictEqual(fixture.installer.executions.length, 0, 'startup must never install');
			assert.strictEqual(fixture.transport.requests.length, 0, 'startup must never download');
			assert.strictEqual(await fs.stat(path.join(fixture.home, '.walker')).then(() => true, () => false), false, 'detection must not create managed data');
			extension.dispose();
		});
	});

	test('reports a stale lock as an actionable recovery failure instead of absence', async () => {
		const host = createDotnetHostHarness();
		const subscriptions: IDotnetDisposable[] = [];
		await withControllerFixture(host, async fixture => {
			await fs.mkdir(path.join(fixture.home, '.walker', 'dotnet-install.lock'), { recursive: true });
			const extension = activateDotnetToolchain({ host, extensionKind: 'ui', subscriptions, createController: ui => fixture.createController(ui) });
			const snapshot = await waitForDetection(extension);
			assert.strictEqual(snapshot.state, 'failed', 'an ambiguous lock must be a failure, not absence or readiness');
			assert.strictEqual(snapshot.failure?.stage, 'recovery');
			assert.strictEqual(fixture.probe.executions.length, 0, 'an ambiguous lock must be inspected before any probe');
			assert.strictEqual(host.statusItem.text, '«$(error) .NET SDK: Setup Failed»');
			assert.ok((host.statusItem.tooltipLines ?? []).join('\n').includes('recovery'), 'the recovery stage must be visible');
			await host.commands.get(DOTNET_TOOLCHAIN_COMMANDS.showActions)!();
			assert.deepStrictEqual(host.quickPicks.at(-1)?.items.map(item => item.id), ['setup', 'recheck', 'showOutput'], 'a recovery failure must offer retry, recheck and output');
			extension.dispose();
		});
	});

	test('disposes commands, status and controller exactly once', () => {
		const host = createDotnetHostHarness();
		const subscriptions: IDotnetDisposable[] = [];
		const controller = createControllerStub(dotnetSnapshot('checking'));
		const extension = activateDotnetToolchain({ host, extensionKind: 'ui', subscriptions, createController: () => controller });
		extension.dispose();
		extension.dispose();
		assert.strictEqual(controller.disposeCalls, 1, 'the controller must be disposed once');
		for (const registration of host.registrations) {
			assert.strictEqual(registration.disposable.disposed, true, `${registration.id} must be disposed`);
		}
		assert.strictEqual(host.statusItem.disposed, true);
		assert.strictEqual(host.output.disposed, true);
		assert.strictEqual(host.intervals.every(interval => interval.disposed), true);
	});
});

suite('dotnet selection UI binding', () => {
	test('localizes the channel, version, confirmation and reveal prompts', async () => {
		const host = createDotnetHostHarness();
		const ui = createDotnetSelectionUi(host);
		const destination = '/home/test/.walker/dotnet';
		const chooser = { destination, locality: 'local' as const, architecture: 'x64' as const };

		host.queueQuickPick({ id: 'STS', label: 'queued' });
		assert.strictEqual(await ui.chooseChannel(chooser), 'STS');
		const quickPick = host.quickPicks[0];
		assert.deepStrictEqual(quickPick.items.map(item => item.id), ['LTS', 'STS', 'specific']);
		for (const item of quickPick.items) {
			assert.ok(item.label.startsWith('«'), 'every chooser item must be localized');
			assert.ok((item.description ?? '').startsWith('«'), 'every chooser description must be localized');
		}
		assert.strictEqual(host.localizer.messages.includes('Choose the .NET SDK channel for this local machine ({0}), installing into {1}'), true);
		assert.strictEqual(quickPick.ignoreFocusOut, true);
		host.queueQuickPick(undefined);
		assert.strictEqual(await ui.chooseChannel(chooser), undefined, 'dismissing the chooser must cancel');

		host.queueInputBox('10.0.401');
		assert.strictEqual(await ui.requestVersion(), '10.0.401');
		assert.strictEqual(host.inputBoxes[0].prompt, '«Enter an exact stable .NET SDK version, for example 10.0.401»');

		const confirmation = { selection: { kind: 'channel' as const, channel: 'LTS' as const }, destination, architecture: 'x64' as const, locality: 'local' as const, networkUse: true as const };
		host.queueWarning(undefined);
		assert.strictEqual(await ui.confirmSelection(confirmation), false, 'a dismissed confirmation is not consent');
		host.queueWarning(host.localizer.t('Install'));
		assert.strictEqual(await ui.confirmSelection(confirmation), true, 'only the localized confirm label is consent');
		const warning = host.warnings.at(-1)!;
		assert.deepStrictEqual(warning.options, { modal: true });
		assert.ok(warning.message.includes(destination), 'the confirmation must show the local destination');
		assert.ok(warning.message.includes('LTS'), 'the confirmation must show the selected choice');
		assert.ok(warning.message.includes('network'), 'the confirmation must disclose network use');

		ui.revealActiveSelection();
		assert.ok(host.informations.length === 1 && host.informations[0].startsWith('«'), 'revealing an active chooser must be localized');
	});

	test('explains every rejection reason and prerequisite failure with localized text', () => {
		const host = createDotnetHostHarness();
		const ui = createDotnetSelectionUi(host);
		const expected: Readonly<Record<DotnetVersionRejectionReason, string>> = {
			empty: 'Enter a version.',
			length: 'The version is too long.',
			whitespace: 'The version cannot contain whitespace.',
			'option-prefix': 'The version cannot start with a dash.',
			slash: 'The version cannot contain a path separator.',
			wildcard: 'The version cannot contain wildcard characters.',
			metacharacter: 'The version contains characters that are not allowed.',
			prerelease: 'Preview versions are not supported here; enter a stable version.',
			'build-metadata': 'Build metadata is not supported here; enter a stable version.',
			format: 'Enter a stable version in major.minor.patch form.',
		};
		for (const reason of Object.keys(expected) as DotnetVersionRejectionReason[]) {
			ui.explainInvalidVersion({ reason, input: 'bad input' });
		}
		assert.deepStrictEqual([...host.errors], Object.values(expected).map(message => `«${message}»`));

		const failures: Readonly<Record<DotnetPrerequisiteFailureCode, string>> = {
			'unsupported-architecture': 'This machine\'s architecture is not supported for a managed .NET SDK installation.',
			'missing-bash': 'The official .NET install script requires bash, which was not found at a trusted absolute path.',
			'missing-powershell': 'The official .NET install script requires Windows PowerShell at its system location.',
			'unsafe-path': 'A required tool path is not safe to execute, so setup cannot continue.',
		};
		for (const code of Object.keys(failures) as DotnetPrerequisiteFailureCode[]) {
			ui.reportFailure({ code, diagnostic: 'fixture diagnostic' });
		}
		const reported = host.errors.slice(Object.keys(expected).length);
		assert.deepStrictEqual(reported, Object.values(failures).map(message => `«${message}»`));
	});
});

suite('dotnet extension manifest', () => {
	test('declares local/UI activation, command contributions and localized manifest strings', async () => {
		const root = path.join(__dirname, '..', '..');
		const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
		const nls = JSON.parse(await fs.readFile(path.join(root, 'package.nls.json'), 'utf8'));
		const registered: string[] = Object.values(DOTNET_TOOLCHAIN_COMMANDS);

		assert.strictEqual(manifest.main, './out/extension', 'development activation must point at the compiled entrypoint');
		assert.deepStrictEqual(manifest.extensionKind, ['ui'], 'the extension must prefer the UI extension host');
		assert.strictEqual(manifest.capabilities.untrustedWorkspaces.supported, true, 'no workspace executable or configuration is consumed');
		assert.strictEqual(manifest.capabilities.virtualWorkspaces, true, 'virtual workspaces do not change local machine semantics');
		assert.ok(manifest.activationEvents.includes('onStartupFinished'), 'startup detection needs the startup activation event');
		for (const id of registered) {
			assert.ok(manifest.activationEvents.includes(`onCommand:${id}`), `${id} needs an explicit activation event`);
		}

		const contributed: string[] = manifest.contributes.commands.map((command: { command: string }) => command.command);
		for (const id of contributed) {
			assert.ok(registered.includes(id), `${id} must exist in the shared command contract`);
		}
		assert.deepStrictEqual([...contributed].sort(), [
			DOTNET_TOOLCHAIN_COMMANDS.recheck,
			DOTNET_TOOLCHAIN_COMMANDS.setup,
			DOTNET_TOOLCHAIN_COMMANDS.showActions,
			DOTNET_TOOLCHAIN_COMMANDS.showOutput,
		].sort(), 'palette commands must be the user-facing four; getState stays programmatic only');

		assert.strictEqual(manifest.displayName, '%displayName%');
		assert.strictEqual(manifest.description, '%description%');
		for (const command of manifest.contributes.commands as readonly { readonly title: string; readonly category: string }[]) {
			for (const reference of [command.title, command.category]) {
				assert.ok(reference.startsWith('%') && reference.endsWith('%'), `${reference} must reference a localized key`);
				const key = reference.slice(1, -1);
				assert.strictEqual(typeof nls[key], 'string', `${key} must exist in package.nls.json`);
				assert.ok((nls[key] as string).length > 0);
			}
		}
		for (const key of ['displayName', 'description']) {
			assert.strictEqual(typeof nls[key], 'string', `${key} must exist in package.nls.json`);
		}
	});
});

suite('vscode host adapter', () => {
	test('maps localization, host kind, commands, surfaces, dialogs and progress to the vscode API', async () => {
		const fake = createFakeVscodeApi({ uiKind: 'desktop', remoteName: 'ssh-remote' });
		const host: IDotnetExtensionHost = createVscodeExtensionHost(fake.api);
		assert.strictEqual(host.uiKind, 'desktop');
		assert.strictEqual(host.remoteName, 'ssh-remote', 'a remote UI window must stay a local-machine host');
		assert.strictEqual(host.t('Local .NET SDK {0}', '10.0.401'), '«Local .NET SDK 10.0.401»');

		host.registerCommand(DOTNET_TOOLCHAIN_COMMANDS.getState, () => 'value');
		assert.strictEqual(fake.commands.has(DOTNET_TOOLCHAIN_COMMANDS.getState), true);

		const item = host.createStatusBarItem();
		assert.strictEqual(fake.statusItem.alignment, fake.api.StatusBarAlignment.Left);
		assert.strictEqual(fake.statusItem.priority, 100);
		item.text = 'label';
		item.command = DOTNET_TOOLCHAIN_COMMANDS.showActions;
		item.tooltip = { lines: ['line one', 'line two'] };
		assert.strictEqual(fake.statusItem.text, 'label');
		assert.strictEqual(fake.statusItem.command, DOTNET_TOOLCHAIN_COMMANDS.showActions);
		assert.strictEqual(fake.statusItem.tooltipText, 'line one\nline two', 'tooltips must render literally, not as markdown');
		item.show();
		item.hide();
		item.dispose();
		assert.deepStrictEqual([fake.statusItem.shown, fake.statusItem.hidden], [1, 1]);
		assert.strictEqual(fake.statusItem.disposed, true);

		const channel = host.createOutputChannel('.NET Toolchain');
		channel.appendLine('hello');
		channel.show(true);
		channel.dispose();
		assert.strictEqual(fake.outputChannel.name, '.NET Toolchain');
		assert.deepStrictEqual([...fake.outputChannel.lines], ['hello']);
		assert.deepStrictEqual([...fake.outputChannel.shown], [true]);
		assert.strictEqual(fake.outputChannel.disposed, true);

		fake.quickPickResult = { label: 'Alpha' };
		const picked = await host.showQuickPick([{ id: 'a', label: 'Alpha', description: 'first' }, { id: 'b', label: 'Beta' }], { placeHolder: 'choose', ignoreFocusOut: true });
		assert.deepStrictEqual(picked, { id: 'a', label: 'Alpha', description: 'first' }, 'the original item including its id must be returned');
		assert.deepStrictEqual({ ...fake.quickPicks[0].options }, { placeHolder: 'choose', ignoreFocusOut: true });

		fake.inputBoxResult = 'typed';
		assert.strictEqual(await host.showInputBox({ prompt: 'prompt', placeHolder: 'holder', ignoreFocusOut: true }), 'typed');
		fake.warningResult = 'Install';
		assert.strictEqual(await host.showWarningMessage('message', { modal: true }, 'Install'), 'Install');
		assert.deepStrictEqual({ ...fake.warnings[0].options }, { modal: true });
		assert.strictEqual(await host.showInformationMessage('info'), 'info');
		assert.strictEqual(await host.showErrorMessage('error'), 'error');

		await host.withProgress('Title', async (progress, token) => {
			assert.strictEqual(token.isCancellationRequested, false);
			const dispose = token.onCancellationRequested(() => undefined);
			dispose();
			progress.report({ message: 'installing' });
		});
		assert.strictEqual(fake.progress[0].location, fake.api.ProgressLocation.Notification);
		assert.strictEqual(fake.progress[0].cancellable, true);
		assert.deepStrictEqual([...fake.progress[0].reported], ['installing']);
		assert.strictEqual(fake.progress[0].tokenRegistrationDisposed(), 1, 'the progress token registration must be disposable');

		const observed: string[] = [];
		await host.withProgress('Again', async (_progress, token) => {
			token.onCancellationRequested(() => observed.push('canceled'));
			fake.cancelLastProgress();
			assert.strictEqual(token.isCancellationRequested, true, 'vscode cancellation must be observed truthfully');
		});
		assert.deepStrictEqual(observed, ['canceled']);
	});

	test('maps a web UI kind to the web host kind', () => {
		const fake = createFakeVscodeApi({ uiKind: 'web' });
		assert.strictEqual(createVscodeExtensionHost(fake.api).uiKind, 'web');
	});

	test('reads only the user/machine proxy value', () => {
		const ignored = createFakeVscodeApi({ proxyWorkspaceValue: 'http://workspace.proxy:8080' });
		assert.strictEqual(createVscodeExtensionHost(ignored.api).getHttpProxySetting(), undefined, 'workspace proxy values must never be used');
		const used = createFakeVscodeApi({ proxyGlobalValue: 'http://proxy.local:8080', proxyWorkspaceValue: 'http://workspace.proxy:8080' });
		assert.strictEqual(createVscodeExtensionHost(used.api).getHttpProxySetting(), 'http://proxy.local:8080');
	});

	test('classifies proxy settings without treating PAC or credentials as supported proxies', () => {
		assert.deepStrictEqual(parseDotnetProxySetting(undefined), { kind: 'none' });
		assert.deepStrictEqual(parseDotnetProxySetting('   '), { kind: 'none' });
		assert.deepStrictEqual(parseDotnetProxySetting('http://proxy.local:8080'), { kind: 'url', value: 'http://proxy.local:8080' });
		assert.deepStrictEqual(parseDotnetProxySetting('https://proxy.local:8080'), { kind: 'url', value: 'https://proxy.local:8080' });
		assert.deepStrictEqual(parseDotnetProxySetting('file:///etc/proxy.pac'), { kind: 'pac', value: 'file:///etc/proxy.pac' });
		assert.deepStrictEqual(parseDotnetProxySetting('http://wpad.local/wpad.dat'), { kind: 'pac', value: 'http://wpad.local/wpad.dat' });

		const credentials = resolveDotnetProxy(parseDotnetProxySetting('http://user:secret@proxy.local:8080'));
		assert.strictEqual(credentials.kind, 'unsupported');
		if (credentials.kind === 'unsupported') {
			assert.strictEqual(credentials.reason, 'credentials');
		}
		assert.strictEqual(JSON.stringify(credentials).includes('secret'), false, 'credentials must never be echoed in diagnostics');
		const pac = resolveDotnetProxy(parseDotnetProxySetting('file:///etc/proxy.pac'));
		assert.strictEqual(pac.kind, 'unsupported');
		if (pac.kind === 'unsupported') {
			assert.strictEqual(pac.reason, 'pac');
		}
	});
});
