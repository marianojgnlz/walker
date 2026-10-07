/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { DOTNET_TOOLCHAIN_SCHEMA_VERSION, type IDotnetTemplateOperationRequest, type IDotnetTemplateOperationResult } from '../../../welcomeOnboarding/common/dotnetToolchain.js';
import { runProjectWizard, type IProjectWizardChoice, type IProjectWizardServices } from '../../browser/projectWizard.js';

interface IWizardTestHarness {
	readonly services: IProjectWizardServices;
	readonly requests: IDotnetTemplateOperationRequest[];
	readonly choices: { readonly title: string; readonly items: readonly IProjectWizardChoice[] }[];
	readonly failures: string[];
	readonly warnings: string[];
	readonly infos: string[];
	readonly output: string[];
	readonly toolchainOutputCalls: number[];
	readonly gitInitializationCalls: URI[];
	readonly deferredGitInitializationCalls: URI[];
	readonly deferredGitCancellationCalls: string[];
	readonly recents: URI[];
	readonly opened: { readonly folder: URI; readonly newWindow: boolean }[];
	setState(value: unknown): void;
	setOutputExists(value: boolean): void;
	setOutputExistsAfterGeneration(value: boolean): void;
	setOperationResult(operation: 'dryRun' | 'generate', result: IDotnetTemplateOperationResult): void;
	setOpenError(error: Error): void;
	setExistsError(error: Error): void;
	setOutputVerificationError(error: Error): void;
	setGitInitializationError(error: Error): void;
	setDeferredGitInitializationError(error: Error): void;
	setSetupEffect(effect: () => void): void;
	setCancelDuringGeneration(value: boolean): void;
	setCancelDuringValidation(value: boolean): void;
	setRecentError(error: Error): void;
	setCatalogResult(result: unknown): void;
}

function executed(operation: IDotnetTemplateOperationRequest['operation'], stdout = '', stderr = '', exitCode = 0): IDotnetTemplateOperationResult {
	return { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, kind: 'executed', operation, stdout, stderr, exitCode };
}

function createHarness(answerIds: readonly string[] = ['console', 'net10.0', 'restore', 'skipGit', 'same']): IWizardTestHarness {
	const requests: IDotnetTemplateOperationRequest[] = [];
	const choices: { readonly title: string; readonly items: readonly IProjectWizardChoice[] }[] = [];
	const failures: string[] = [];
	const warnings: string[] = [];
	const infos: string[] = [];
	const output: string[] = [];
	const toolchainOutputCalls: number[] = [];
	const gitInitializationCalls: URI[] = [];
	const deferredGitInitializationCalls: URI[] = [];
	const deferredGitCancellationCalls: string[] = [];
	const recents: URI[] = [];
	const opened: { readonly folder: URI; readonly newWindow: boolean }[] = [];
	const answers = [...answerIds];
	const parent = URI.file('/tmp');
	const outputFolder = URI.joinPath(parent, 'SampleApp');
	let state: unknown = {
		schemaVersion: 1,
		revision: 1,
		state: 'ready',
		locality: 'local',
		verified: { executable: '/home/test/.walker/dotnet/dotnet', sdkVersion: '10.0.401' },
	};
	let outputExists = false;
	let outputExistsAfterGeneration: boolean | undefined;
	let catalogResult: unknown = executed('listTemplates', 'Template Name\tShort Name\tLanguage\tTags\nConsole App\tconsole\t[C#]\tCommon/Console');
	let dryRunResult: IDotnetTemplateOperationResult = executed('dryRun');
	let generateResult: IDotnetTemplateOperationResult = executed('generate');
	let openError: Error | undefined;
	let existsError: Error | undefined;
	let outputVerificationError: Error | undefined;
	let gitInitializationError: Error | undefined;
	let deferredGitInitializationError: Error | undefined;
	let deferredGitInitializationId = 0;
	let cancelDuringGeneration = false;
	let cancelDuringValidation = false;
	let recentError: Error | undefined;
	const progressCancellation = new CancellationTokenSource();
	let setupEffect = (): void => undefined;

	const services: IProjectWizardServices = {
		toolchain: {
			getState: async () => state,
			setup: async () => { setupEffect(); return state; },
			recheck: async () => state,
			showOutput: async () => { toolchainOutputCalls.push(1); },
			runTemplateOperation: async request => {
				requests.push(request);
				switch (request.operation) {
					case 'listTemplates': return catalogResult;
					case 'help': return executed('help', 'Usage: dotnet new console [options]\nOptions:\n  --framework <net9.0|net10.0>  Target framework.\n  --no-restore                 Skip restore.');
					case 'dryRun':
						if (cancelDuringValidation) { progressCancellation.cancel(); }
						return dryRunResult;
					case 'generate':
						if (generateResult.kind === 'executed' && generateResult.exitCode === 0) {
							outputExists = outputExistsAfterGeneration ?? true;
						} else if (outputExistsAfterGeneration !== undefined) {
							outputExists = outputExistsAfterGeneration;
						}
						if (cancelDuringGeneration) {
							progressCancellation.cancel();
						}
						return generateResult;
				}
			},
		},
		initializeGit: async folder => {
			gitInitializationCalls.push(folder);
			if (gitInitializationError) { throw gitInitializationError; }
		},
		deferGitInitialization: async folder => {
			deferredGitInitializationCalls.push(folder);
			if (deferredGitInitializationError) { throw deferredGitInitializationError; }
			const id = `deferred-${++deferredGitInitializationId}`;
			return { id, cancel: async () => { deferredGitCancellationCalls.push(id); } };
		},
		choose: async (items, title) => {
			choices.push({ title, items });
			return answers.shift();
		},
		input: async options => {
			assert.strictEqual(options.validate('SampleApp'), undefined);
			return 'SampleApp';
		},
		chooseParentLocation: async () => parent,
		exists: async resource => {
			if (resource.toString() === outputFolder.toString() && existsError) { throw existsError; }
			if (resource.toString() === outputFolder.toString() && requests.some(request => request.operation === 'generate') && outputVerificationError) { throw outputVerificationError; }
			return resource.toString() === outputFolder.toString() && outputExists;
		},
		isDirectory: async resource => resource.toString() === parent.toString() || (resource.toString() === outputFolder.toString() && outputExists),
		withProgress: async (_title, task) => task(() => undefined, progressCancellation.token),
		appendOutput: line => output.push(line),
		reportFailure: (message, details) => failures.push(`${message}\n${details}`),
		warn: message => warnings.push(message),
		info: message => infos.push(message),
		addRecentlyOpened: async folder => {
			if (recentError) { throw recentError; }
			recents.push(folder);
		},
		open: async (folder, newWindow) => {
			if (openError) { throw openError; }
			opened.push({ folder, newWindow });
		},
	};

	return {
		services,
		requests,
		choices,
		failures,
		warnings,
		infos,
		output,
		toolchainOutputCalls,
		gitInitializationCalls,
		deferredGitInitializationCalls,
		deferredGitCancellationCalls,
		recents,
		opened,
		setState: value => { state = value; },
		setOutputExists: value => { outputExists = value; },
		setOutputExistsAfterGeneration: value => { outputExistsAfterGeneration = value; },
		setOperationResult: (operation, result) => {
			if (operation === 'dryRun') { dryRunResult = result; } else { generateResult = result; }
		},
		setOpenError: error => { openError = error; },
		setExistsError: error => { existsError = error; },
		setOutputVerificationError: error => { outputVerificationError = error; },
		setGitInitializationError: error => { gitInitializationError = error; },
		setDeferredGitInitializationError: error => { deferredGitInitializationError = error; },
		setSetupEffect: effect => { setupEffect = effect; },
		setCancelDuringGeneration: value => { cancelDuringGeneration = value; },
		setCancelDuringValidation: value => { cancelDuringValidation = value; },
		setRecentError: error => { recentError = error; },
		setCatalogResult: result => { catalogResult = result; },
	};
}

suite('project wizard orchestration', () => {
	test('reports an unavailable toolchain template operation with actionable output', async () => {
		const harness = createHarness();
		harness.setCatalogResult({ schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, kind: 'unavailable', reason: 'sdk-not-ready' });
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.requests.map(request => request.operation), ['listTemplates']);
		assert.ok(harness.failures.some(message => message.includes('sdk-not-ready')));
	});

	test('reports a malformed template operation response without choosing a template', async () => {
		const harness = createHarness();
		harness.setCatalogResult({ schemaVersion: 999, kind: 'executed', operation: 'listTemplates', exitCode: 0, stdout: '', stderr: '' });
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.requests.map(request => request.operation), ['listTemplates']);
		assert.ok(harness.failures.some(message => message.includes('malformed template-operation response')));
	});

	test('offers Git initialization as an explicit configuration choice', async () => {
		const harness = createHarness();
		await runProjectWizard(harness.services);
		const gitChoice = harness.choices.find(choice => choice.items.some(item => item.id === 'initializeGit'));
		assert.ok(gitChoice, 'Git initialization must be an explicit opt-in before generation');
	});

	test('runs discovery, advertised configuration, dry-run, generation, canonical recents, and new-window opening', async () => {
		const harness = createHarness(['console', 'net10.0', 'restore', 'skipGit', 'new']);
		await runProjectWizard(harness.services);

		assert.deepStrictEqual(harness.requests.map(request => request.operation), ['listTemplates', 'help', 'dryRun', 'generate']);
		assert.deepStrictEqual(harness.requests.filter((request): request is Extract<IDotnetTemplateOperationRequest, { readonly operation: 'dryRun' | 'generate' }> => request.operation === 'dryRun' || request.operation === 'generate').map(request => request.options), [
			[{ name: 'framework', value: 'net10.0' }],
			[{ name: 'framework', value: 'net10.0' }],
		]);
		assert.deepStrictEqual(harness.recents.map(folder => folder.fsPath), ['/tmp/SampleApp']);
		assert.deepStrictEqual(harness.opened.map(open => [open.folder.fsPath, open.newWindow]), [['/tmp/SampleApp', true]]);
		assert.deepStrictEqual(harness.failures, []);
	});

	test('opens a generated project in the current window when selected', async () => {
		const harness = createHarness(['console', 'net10.0', 'restore', 'skipGit', 'same']);
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.opened.map(open => [open.folder.fsPath, open.newWindow]), [['/tmp/SampleApp', false]]);
	});

	test('maps the restore opt-out to the selected template’s advertised --no-restore switch', async () => {
		const harness = createHarness(['console', 'net10.0', 'skip', 'skipGit', 'same']);
		await runProjectWizard(harness.services);
		const configuredRequests = harness.requests.filter((request): request is Extract<IDotnetTemplateOperationRequest, { readonly operation: 'dryRun' | 'generate' }> => request.operation === 'dryRun' || request.operation === 'generate');
		assert.deepStrictEqual(configuredRequests.map(request => request.options), [
			[{ name: 'framework', value: 'net10.0' }, { name: 'no-restore' }],
			[{ name: 'framework', value: 'net10.0' }, { name: 'no-restore' }],
		]);
	});

	test('initializes Git after opening in the current window and omits Open Later when requested', async () => {
		const harness = createHarness(['console', 'net10.0', 'restore', 'initializeGit', 'same']);
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.opened.map(open => [open.folder.fsPath, open.newWindow]), [['/tmp/SampleApp', false]]);
		assert.deepStrictEqual(harness.gitInitializationCalls.map(folder => folder.fsPath), ['/tmp/SampleApp']);
		assert.deepStrictEqual(harness.deferredGitInitializationCalls, []);
		assert.ok(!harness.choices.at(-1)?.items.some(item => item.id === 'later'));
		assert.deepStrictEqual(harness.failures, []);
	});

	test('defers Git initialization to the target new-window continuation', async () => {
		const harness = createHarness(['console', 'net10.0', 'restore', 'initializeGit', 'new']);
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.opened.map(open => [open.folder.fsPath, open.newWindow]), [['/tmp/SampleApp', true]]);
		assert.deepStrictEqual(harness.deferredGitInitializationCalls.map(folder => folder.fsPath), ['/tmp/SampleApp']);
		assert.deepStrictEqual(harness.gitInitializationCalls, []);
		assert.ok(harness.infos.some(message => message.includes('run in the new project window')));
	});

	test('cancels the deferred Git intent when opening the new window fails', async () => {
		const harness = createHarness(['console', 'net10.0', 'restore', 'initializeGit', 'new']);
		harness.setOpenError(new Error('window failed'));
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.deferredGitCancellationCalls, ['deferred-1']);
		assert.ok(harness.failures.some(message => message.includes('window failed')));
		assert.ok(harness.failures.some(message => message.includes('Git initialization was not started')));
	});

	test('reports same-window Git failure separately while preserving the opened project', async () => {
		const harness = createHarness(['console', 'net10.0', 'restore', 'initializeGit', 'same']);
		harness.setGitInitializationError(new Error('git init failed'));
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.opened.map(open => open.newWindow), [false]);
		assert.ok(harness.failures.some(message => message.includes('Git initialization failed')));
		assert.ok(harness.failures.some(message => message.includes('git init failed')));
		assert.ok(harness.infos.some(message => message.includes('opened in this window')));
	});

	test('reports deferred scheduling failure but still opens the created project', async () => {
		const harness = createHarness(['console', 'net10.0', 'restore', 'initializeGit', 'new']);
		harness.setDeferredGitInitializationError(new Error('storage failed'));
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.opened.map(open => open.newWindow), [true]);
		assert.ok(harness.failures.some(message => message.includes('could not be scheduled')));
		assert.ok(!harness.infos.some(message => message.includes('Git initialization will run')));
	});

	test('reuses the existing SDK setup command and refreshes readiness before template discovery', async () => {
		const harness = createHarness(['setup', 'console', 'net10.0', 'restore', 'skipGit', 'same']);
		harness.setState({ schemaVersion: 1, revision: 1, state: 'missing', locality: 'local' });
		harness.setSetupEffect(() => harness.setState({ schemaVersion: 1, revision: 2, state: 'ready', locality: 'local', verified: { executable: '/sdk/dotnet', sdkVersion: '10.0.401' } }));
		await runProjectWizard(harness.services);

		assert.deepStrictEqual(harness.requests.map(request => request.operation), ['listTemplates', 'help', 'dryRun', 'generate']);
		assert.deepStrictEqual(harness.warnings, []);
	});

	test('offers the existing toolchain output action while the verified SDK is unavailable', async () => {
		const harness = createHarness(['output']);
		harness.setState({ schemaVersion: 1, revision: 1, state: 'missing', locality: 'local' });
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.toolchainOutputCalls, [1]);
		assert.deepStrictEqual(harness.requests, []);
	});

	test('does not invoke templates when SDK setup is cancelled', async () => {
		const harness = createHarness(['cancel']);
		harness.setState({ schemaVersion: 1, revision: 1, state: 'missing', locality: 'local' });
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.requests, []);
		assert.deepStrictEqual(harness.recents, []);
	});

	test('stops after a canceled dry-run without starting generation', async () => {
		const harness = createHarness();
		harness.setCancelDuringValidation(true);
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.requests.map(request => request.operation), ['listTemplates', 'help', 'dryRun']);
		assert.deepStrictEqual(harness.recents, []);
		assert.deepStrictEqual(harness.opened, []);
		assert.ok(harness.infos.some(message => message.includes('validation was canceled')));
	});

	test('reports a destination-check error without starting template creation', async () => {
		const harness = createHarness();
		harness.setExistsError(new Error('permission denied'));
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.requests.map(request => request.operation), ['listTemplates', 'help']);
		assert.ok(harness.failures.some(message => message.includes('permission denied')));
		assert.deepStrictEqual(harness.recents, []);
	});

	test('refuses an existing output path before dry-run or generation', async () => {
		const harness = createHarness();
		harness.setOutputExists(true);
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.requests.map(request => request.operation), ['listTemplates', 'help']);
		assert.ok(harness.warnings.some(message => message.includes('already exists')));
		assert.deepStrictEqual(harness.recents, []);
	});

	test('a failed dry-run prevents generation and reports the bounded diagnostic', async () => {
		const harness = createHarness();
		harness.setOperationResult('dryRun', executed('dryRun', '', 'unsupported framework', 1));
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.requests.map(request => request.operation), ['listTemplates', 'help', 'dryRun']);
		assert.strictEqual(harness.failures.length, 1);
		assert.ok(harness.failures[0].includes('unsupported framework'));
		assert.deepStrictEqual(harness.recents, []);
	});

	test('reports a bounded generation timeout without opening or adding an unconfirmed project to recents', async () => {
		const harness = createHarness();
		harness.setOperationResult('generate', {
			schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION,
			kind: 'executed',
			operation: 'generate',
			exitCode: 1,
			stdout: '',
			stderr: 'dotnet new timed out',
			failure: 'timeout',
		});
		await runProjectWizard(harness.services);
		assert.ok(harness.failures.some(message => message.includes('timed out')));
		assert.deepStrictEqual(harness.recents, []);
		assert.deepStrictEqual(harness.opened, []);
	});

	test('preserves partial template output and never claims success after a failed generation', async () => {
		const harness = createHarness();
		harness.setOutputExistsAfterGeneration(true);
		harness.setOperationResult('generate', executed('generate', '', 'restore failed', 1));
		await runProjectWizard(harness.services);
		assert.strictEqual(harness.requests.at(-1)?.operation, 'generate');
		assert.ok(harness.failures[0].includes('Generated output, if any, was preserved.'));
		assert.deepStrictEqual(harness.recents, []);
		assert.deepStrictEqual(harness.opened, []);
		assert.deepStrictEqual(harness.infos, []);
	});

	test('does not mark an absent generated directory as successful', async () => {
		const harness = createHarness();
		harness.setOutputExists(false);
		harness.setOutputExistsAfterGeneration(false);
		await runProjectWizard(harness.services);
		assert.strictEqual(harness.failures.length, 1);
		assert.ok(harness.failures[0].includes('No project directory was confirmed.'));
		assert.deepStrictEqual(harness.recents, []);
		assert.deepStrictEqual(harness.opened, []);
	});

	test('reports a post-generation output check failure without claiming success', async () => {
		const harness = createHarness();
		harness.setOutputVerificationError(new Error('file service unavailable'));
		await runProjectWizard(harness.services);
		assert.ok(harness.failures.some(message => message.includes('file service unavailable')));
		assert.ok(harness.failures.some(message => message.includes('preserved')));
		assert.deepStrictEqual(harness.recents, []);
		assert.deepStrictEqual(harness.opened, []);
	});

	test('preserves a project completed during cancellation and skips the open flow', async () => {
		const harness = createHarness();
		harness.setCancelDuringGeneration(true);
		await runProjectWizard(harness.services);
		assert.strictEqual(harness.requests.at(-1)?.operation, 'generate');
		assert.deepStrictEqual(harness.recents.map(folder => folder.fsPath), ['/tmp/SampleApp']);
		assert.deepStrictEqual(harness.opened, []);
		assert.ok(harness.infos.some(message => message.includes('after cancellation was requested')));
	});

	test('does not claim canceled output is in Recent when the recents update failed', async () => {
		const harness = createHarness();
		harness.setCancelDuringGeneration(true);
		harness.setRecentError(new Error('recent history unavailable'));
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.recents, []);
		assert.deepStrictEqual(harness.opened, []);
		assert.ok(harness.failures.some(message => message.includes('recent history unavailable')));
		assert.ok(harness.infos.some(message => message.includes('could not be added to Recent')));
		assert.ok(!harness.infos.some(message => message.includes('preserved in Recent')));
	});

	test('records a created project but reports an actual workspace-open failure', async () => {
		const harness = createHarness();
		harness.setOpenError(new Error('window failed'));
		await runProjectWizard(harness.services);
		assert.deepStrictEqual(harness.recents.map(folder => folder.fsPath), ['/tmp/SampleApp']);
		assert.strictEqual(harness.failures.length, 1);
		assert.ok(harness.failures[0].includes('window failed'));
		assert.deepStrictEqual(harness.infos, []);
	});
});
