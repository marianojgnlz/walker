/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { dotnetManagedRoot } from '../candidates';
import type { IEnvironmentAdapter } from '../contracts';
import type { IDotnetPrerequisiteFailure } from '../platformArguments';
import {
	MAX_SDK_VERSION_INPUT_LENGTH,
	createDotnetSelectionPrompter,
	parseSdkVersionInput,
	type DotnetChannelChoice,
	type DotnetVersionRejectionReason,
	type IDotnetChannelChooser,
	type IDotnetConfirmationPrompt,
	type IDotnetSelectionPrompter,
	type IDotnetSelectionUi,
	type IDotnetVersionRejection,
} from '../selection';
import { createInMemoryFileSystem, type IInMemoryFileSystem } from './fixtures';

type ChannelResponse = DotnetChannelChoice | undefined | Promise<DotnetChannelChoice | undefined>;
type VersionResponse = string | undefined | Promise<string | undefined>;
type ConfirmationResponse = boolean | Promise<boolean>;

/** One queued set of responses for the recording UI; an exhausted queue cancels the prompt. */
interface ISelectionScript {
	readonly channels?: readonly ChannelResponse[];
	readonly versions?: readonly VersionResponse[];
	readonly confirmations?: readonly ConfirmationResponse[];
}

/** Recording selection UI facade so tests never import runtime `vscode`. */
interface IRecordingSelectionUi extends IDotnetSelectionUi {
	readonly calls: readonly string[];
	readonly choosers: readonly IDotnetChannelChooser[];
	readonly confirmations: readonly IDotnetConfirmationPrompt[];
	readonly rejections: readonly IDotnetVersionRejection[];
	readonly failures: readonly IDotnetPrerequisiteFailure[];
	revealCount(): number;
}

function createRecordingSelectionUi(script: ISelectionScript): IRecordingSelectionUi {
	const calls: string[] = [];
	const choosers: IDotnetChannelChooser[] = [];
	const confirmations: IDotnetConfirmationPrompt[] = [];
	const rejections: IDotnetVersionRejection[] = [];
	const failures: IDotnetPrerequisiteFailure[] = [];
	const channels = [...(script.channels ?? [])];
	const versions = [...(script.versions ?? [])];
	const answers = [...(script.confirmations ?? [])];
	return {
		calls,
		choosers,
		confirmations,
		rejections,
		failures,
		revealCount: () => calls.filter(call => call === 'reveal').length,
		chooseChannel: async chooser => { calls.push('channel'); choosers.push(chooser); return await channels.shift(); },
		requestVersion: async () => { calls.push('version'); return await versions.shift(); },
		explainInvalidVersion: rejection => { calls.push('invalid'); rejections.push(rejection); },
		confirmSelection: async confirmation => { calls.push('confirm'); confirmations.push(confirmation); return (await answers.shift()) ?? false; },
		revealActiveSelection: () => { calls.push('reveal'); },
		reportFailure: failure => { calls.push('failure'); failures.push(failure); },
	};
}

function environment(platform: NodeJS.Platform = 'linux', arch = 'x64'): IEnvironmentAdapter {
	return { home: platform === 'win32' ? 'C:\\Users\\test' : '/home/test', platform, arch, path: '' };
}

function bashFileSystem(): IInMemoryFileSystem {
	const fileSystem = createInMemoryFileSystem();
	fileSystem.addFile('/bin/bash');
	return fileSystem;
}

function prompter(ui: IDotnetSelectionUi, platform: NodeJS.Platform = 'linux', fileSystem: IInMemoryFileSystem = bashFileSystem()): IDotnetSelectionPrompter {
	return createDotnetSelectionPrompter({ ui, environment: environment(platform), fileSystem });
}

/** Resolves once the recording UI has been asked for `call`, bounded by event-loop ticks. */
async function waitForCall(ui: IRecordingSelectionUi, call: string): Promise<void> {
	for (let attempt = 0; attempt < 50 && !ui.calls.includes(call); attempt++) {
		await new Promise<void>(resolve => setImmediate(resolve));
	}
	assert.ok(ui.calls.includes(call), `expected ${call} to be invoked`);
}

function assertRejection(input: string, reason: DotnetVersionRejectionReason): void {
	const result = parseSdkVersionInput(input);
	assert.strictEqual(result.kind, 'invalid', `${JSON.stringify(input)} must be rejected`);
	if (result.kind === 'invalid') {
		assert.strictEqual(result.rejection.reason, reason);
		assert.strictEqual(result.rejection.input, input);
	}
}

suite('dotnet SDK version input validation', () => {
	test('accepts trimmed stable major.minor.patch versions', () => {
		for (const input of ['10.0.401', ' 10.0.401 ', '8.0.100', '99.999999.1']) {
			const result = parseSdkVersionInput(input);
			assert.strictEqual(result.kind, 'valid', `${JSON.stringify(input)} must be accepted`);
			if (result.kind === 'valid') {
				assert.strictEqual(result.version, input.trim());
			}
		}
	});

	test('rejects empty, overlong, and whitespace-containing input', () => {
		assertRejection('', 'empty');
		assertRejection('   ', 'empty');
		assertRejection(`10.0.${'4'.repeat(MAX_SDK_VERSION_INPUT_LENGTH - 4)}`, 'length');
		assertRejection('10.0.401 beta', 'whitespace');
		assertRejection('10.0.\t401', 'whitespace');
	});

	test('rejects option prefixes, paths, wildcards, and shell metacharacters', () => {
		assertRejection('--version', 'option-prefix');
		assertRejection('-10.0.401', 'option-prefix');
		assertRejection('/usr/bin/dotnet', 'slash');
		assertRejection('..\\dotnet', 'slash');
		assertRejection('10.*', 'wildcard');
		assertRejection('10.0.?', 'wildcard');
		assertRejection('10.0.1;id', 'metacharacter');
		assertRejection('10.0.1&&id', 'metacharacter');
		assertRejection('$(id)', 'metacharacter');
		assertRejection('10.0.1`id`', 'metacharacter');
		assertRejection('10.0.1|id', 'metacharacter');
		assertRejection('10.0.1>out', 'metacharacter');
	});

	test('rejects prerelease, build metadata, and non-stable shapes', () => {
		assertRejection('10.0.401-preview.1', 'prerelease');
		assertRejection('10.0.401+abcdef', 'build-metadata');
		assertRejection('v10.0.401', 'format');
		assertRejection('latest', 'format');
		assertRejection('0.1.2', 'format');
		assertRejection('10.0', 'format');
		assertRejection('10.0.1.2', 'format');
		assertRejection('10.0.-1', 'format');
		assertRejection('१०.0.1', 'format');
	});

	test('rejects every shell metacharacter inside an otherwise valid version', () => {
		for (const character of [';', '&', '|', '<', '>', '$', '`', '(', ')', '[', ']', '{', '}', '!', '#', '~', '"', "'", '%', '=', '^', ',']) {
			assertRejection(`10.0.1${character}`, 'metacharacter');
		}
	});

	test('accepts only outer whitespace and enforces the length boundary', () => {
		for (const input of ['\t10.0.401\n', '\r\n10.0.401\r\n', '1.0.0']) {
			assert.strictEqual(parseSdkVersionInput(input).kind, 'valid', `${JSON.stringify(input)} must be accepted`);
		}
		assertRejection('10. 0.401', 'whitespace');
		assertRejection('10.0. 401', 'whitespace');
		const boundary = '1234567890.1234567890.1234567890';
		assert.strictEqual(boundary.length, MAX_SDK_VERSION_INPUT_LENGTH);
		assert.strictEqual(parseSdkVersionInput(boundary).kind, 'valid');
		assertRejection(`${boundary}0`, 'length');
	});
});

suite('dotnet setup selection flow', () => {
	test('selects a channel and shows the local destination before returning', async () => {
		for (const channel of ['LTS', 'STS'] as const) {
			const ui = createRecordingSelectionUi({ channels: [channel], confirmations: [true] });
			const result = await prompter(ui).select();
			assert.deepStrictEqual(result, {
				kind: 'selected',
				selection: { kind: 'channel', channel },
				destination: '/home/test/.walker/dotnet',
				architecture: 'x64',
			});
			assert.deepStrictEqual(ui.calls, ['channel', 'confirm']);
			assert.deepStrictEqual(
				[ui.choosers[0].destination, ui.choosers[0].locality, ui.choosers[0].architecture],
				['/home/test/.walker/dotnet', 'local', 'x64'],
			);
			assert.deepStrictEqual(
				[ui.confirmations[0].locality, ui.confirmations[0].networkUse, ui.confirmations[0].destination, ui.confirmations[0].architecture],
				['local', true, '/home/test/.walker/dotnet', 'x64'],
			);
		}
	});

	test('selects an exact validated stable version', async () => {
		const ui = createRecordingSelectionUi({ channels: ['specific'], versions: ['10.0.401'], confirmations: [true] });
		const result = await prompter(ui).select();
		assert.deepStrictEqual(result, {
			kind: 'selected',
			selection: { kind: 'version', version: '10.0.401' },
			destination: '/home/test/.walker/dotnet',
			architecture: 'x64',
		});
		assert.deepStrictEqual(ui.confirmations[0].selection, { kind: 'version', version: '10.0.401' });
	});

	test('explains invalid input and keeps the exact-version prompt correctable', async () => {
		const ui = createRecordingSelectionUi({ channels: ['specific'], versions: ['10.0.1;id', '10.0.401-preview.1', ' 10.0.401 '], confirmations: [true] });
		const result = await prompter(ui).select();
		assert.strictEqual(result.kind === 'selected' && result.selection.kind === 'version' && result.selection.version, '10.0.401');
		assert.deepStrictEqual(ui.rejections.map(rejection => rejection.reason), ['metacharacter', 'prerelease']);
		assert.deepStrictEqual(ui.calls, ['channel', 'version', 'invalid', 'version', 'invalid', 'version', 'confirm']);
	});

	test('canceling at the channel chooser, version prompt, or confirmation starts nothing', async () => {
		const channelUi = createRecordingSelectionUi({ channels: [undefined] });
		assert.deepStrictEqual(await prompter(channelUi).select(), { kind: 'canceled', stage: 'channel' });
		assert.deepStrictEqual(channelUi.calls, ['channel']);
		assert.strictEqual(channelUi.confirmations.length, 0);

		const versionUi = createRecordingSelectionUi({ channels: ['specific'], versions: [undefined] });
		assert.deepStrictEqual(await prompter(versionUi).select(), { kind: 'canceled', stage: 'version' });
		assert.deepStrictEqual(versionUi.calls, ['channel', 'version']);
		assert.strictEqual(versionUi.confirmations.length, 0);

		const confirmUi = createRecordingSelectionUi({ channels: ['LTS'], confirmations: [false] });
		assert.deepStrictEqual(await prompter(confirmUi).select(), { kind: 'canceled', stage: 'confirmation' });
		assert.deepStrictEqual(confirmUi.calls, ['channel', 'confirm']);
		assert.strictEqual(confirmUi.confirmations.length, 1);
	});

	test('canceling after an invalid version reports no selection and no confirmation', async () => {
		const ui = createRecordingSelectionUi({ channels: ['specific'], versions: ['nope', undefined] });
		assert.deepStrictEqual(await prompter(ui).select(), { kind: 'canceled', stage: 'version' });
		assert.deepStrictEqual(ui.rejections.map(rejection => rejection.reason), ['format']);
		assert.deepStrictEqual(ui.calls, ['channel', 'version', 'invalid', 'version']);
		assert.strictEqual(ui.confirmations.length, 0);
	});

	test('reports unsupported architecture and missing interpreters before opening the chooser', async () => {
		const unsupportedUi = createRecordingSelectionUi({ confirmations: [true] });
		const unsupported = await createDotnetSelectionPrompter({ ui: unsupportedUi, environment: environment('linux', 'ppc64'), fileSystem: bashFileSystem() }).select();
		assert.strictEqual(unsupported.kind === 'failed' && unsupported.failure.code, 'unsupported-architecture');
		assert.deepStrictEqual(unsupportedUi.calls, ['failure']);

		const missingBashUi = createRecordingSelectionUi({});
		const missingBash = await createDotnetSelectionPrompter({ ui: missingBashUi, environment: environment(), fileSystem: createInMemoryFileSystem() }).select();
		assert.strictEqual(missingBash.kind === 'failed' && missingBash.failure.code, 'missing-bash');
		assert.deepStrictEqual(missingBashUi.calls, ['failure']);

		const missingPowerShellUi = createRecordingSelectionUi({});
		const missingPowerShell = await createDotnetSelectionPrompter({ ui: missingPowerShellUi, environment: environment('win32'), fileSystem: createInMemoryFileSystem() }).select();
		assert.strictEqual(missingPowerShell.kind === 'failed' && missingPowerShell.failure.code, 'missing-powershell');
		assert.deepStrictEqual(missingPowerShellUi.calls, ['failure']);
	});

	test('repeated activation reveals the active chooser instead of opening a second one', async () => {
		let releaseChannel: ((choice: DotnetChannelChoice | undefined) => void) | undefined;
		const pendingChannel = new Promise<DotnetChannelChoice | undefined>(resolve => { releaseChannel = resolve; });
		const ui = createRecordingSelectionUi({ channels: [pendingChannel], confirmations: [true] });
		const selectionPrompter = prompter(ui);
		const first = selectionPrompter.select();
		await waitForCall(ui, 'channel');
		assert.deepStrictEqual(await selectionPrompter.select([{ channel: 'LTS', version: '1.2.3', installDir: '/tmp/evil' }]), { kind: 'active' });
		assert.deepStrictEqual(await selectionPrompter.select(), { kind: 'active' });
		assert.strictEqual(ui.revealCount(), 2);
		assert.strictEqual(ui.calls.filter(call => call === 'channel').length, 1);
		releaseChannel!('LTS');
		assert.deepStrictEqual(await first, {
			kind: 'selected',
			selection: { kind: 'channel', channel: 'LTS' },
			destination: '/home/test/.walker/dotnet',
			architecture: 'x64',
		});

		const secondUi = createRecordingSelectionUi({ channels: ['STS'], confirmations: [true] });
		const second = await prompter(secondUi).select([{ channel: 'LTS' }]);
		assert.deepStrictEqual(second, {
			kind: 'selected',
			selection: { kind: 'channel', channel: 'STS' },
			destination: '/home/test/.walker/dotnet',
			architecture: 'x64',
		});
		assert.deepStrictEqual(secondUi.calls, ['channel', 'confirm']);
	});

	test('ignores externally supplied command arguments and always prompts', async () => {
		const ui = createRecordingSelectionUi({ channels: ['LTS'], confirmations: [true] });
		const result = await prompter(ui).select([{ channel: 'LTS', version: '10.0.401', installDir: '/tmp/evil', scriptUrl: 'https://example.invalid' }]);
		assert.deepStrictEqual(result, {
			kind: 'selected',
			selection: { kind: 'channel', channel: 'LTS' },
			destination: '/home/test/.walker/dotnet',
			architecture: 'x64',
		});
		assert.deepStrictEqual(ui.calls, ['channel', 'confirm']);
	});

	test('shows the home-scoped destination for each platform', async () => {
		assert.strictEqual(dotnetManagedRoot('/home/test', 'linux'), '/home/test/.walker/dotnet');
		assert.strictEqual(dotnetManagedRoot('C:\\Users\\test', 'win32'), 'C:\\Users\\test\\.walker\\dotnet');

		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
		const ui = createRecordingSelectionUi({ channels: ['LTS'], confirmations: [true] });
		const result = await createDotnetSelectionPrompter({ ui, environment: environment('win32'), fileSystem }).select();
		assert.strictEqual(result.kind === 'selected' && result.destination, 'C:\\Users\\test\\.walker\\dotnet');
		assert.strictEqual(ui.confirmations[0].destination, 'C:\\Users\\test\\.walker\\dotnet');
	});
});
