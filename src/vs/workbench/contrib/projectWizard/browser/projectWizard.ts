/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../../base/common/cancellation.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import type { IDeferredGitInitialization } from './deferredGitInitialization.js';
import {
	DOTNET_TOOLCHAIN_SCHEMA_VERSION,
	isDotnetTemplateOperationResult,
	isDotnetToolchainSnapshot,
	type IDotnetTemplateOperationRequest,
	type IDotnetTemplateOperationResult,
	type IDotnetToolchainSnapshot,
} from '../../welcomeOnboarding/common/dotnetToolchain.js';
import { getProjectNameValidationError } from '../common/projectWizard.js';
import {
	createDotnetNewOptions,
	getTemplateCapabilities,
	parseInstalledTemplateList,
	parseTemplateHelp,
	type ITemplateConfiguration,
	type ITemplateOptionSurface,
} from '../common/templates.js';

export interface IProjectWizardChoice {
	readonly id: string;
	readonly label: string;
	readonly description?: string;
}

export interface IProjectWizardServices {
	readonly toolchain: {
		getState(): Promise<unknown>;
		setup(): Promise<unknown>;
		recheck(): Promise<unknown>;
		showOutput(): Promise<unknown>;
		runTemplateOperation(request: IDotnetTemplateOperationRequest): Promise<unknown>;
	};
	initializeGit(folder: URI): Promise<void>;
	deferGitInitialization(folder: URI): Promise<IDeferredGitInitialization>;
	choose(choices: readonly IProjectWizardChoice[], title: string, prompt: string): Promise<string | undefined>;
	input(options: {
		readonly title: string;
		readonly placeHolder: string;
		readonly prompt: string;
		readonly validate: (value: string) => ReturnType<typeof getProjectNameValidationError>;
	}): Promise<string | undefined>;
	chooseParentLocation(): Promise<URI | undefined>;
	exists(resource: URI): Promise<boolean>;
	isDirectory(resource: URI): Promise<boolean>;
	withProgress<T>(title: string, task: (report: (message: string) => void, token: CancellationToken) => Promise<T>): Promise<T>;
	appendOutput(line: string): void;
	reportFailure(message: string, details: string): void;
	warn(message: string): void;
	info(message: string): void;
	addRecentlyOpened(folder: URI): Promise<void>;
	open(folder: URI, newWindow: boolean): Promise<void>;
}

const FILE_SCHEME = 'file';

function isReadySnapshot(value: unknown): value is IDotnetToolchainSnapshot {
	return isDotnetToolchainSnapshot(value) && value.state === 'ready' && value.verified !== undefined;
}

function isSuccessful(result: IDotnetTemplateOperationResult | undefined, operation: IDotnetTemplateOperationRequest['operation']): result is Extract<IDotnetTemplateOperationResult, { readonly kind: 'executed' }> {
	return result?.kind === 'executed' && result.operation === operation && result.exitCode === 0;
}

function formatOperationDetails(result: IDotnetTemplateOperationResult | undefined): string {
	if (!result) {
		return localize('dotnetProject.operation.malformed', "The .NET Toolchain extension returned a malformed template-operation response.");
	}
	if (result.kind !== 'executed') {
		return localize('dotnetProject.operation.notRun', "The .NET Toolchain extension did not run the requested operation ({0}: {1}).", result.kind, result.reason);
	}
	return [result.stderr, result.stdout].filter(value => value.length > 0).join('\n') || localize('dotnetProject.operation.exitCode', "The operation exited with code {0}.", result.exitCode);
}

async function runTemplateOperation(services: IProjectWizardServices, request: IDotnetTemplateOperationRequest): Promise<IDotnetTemplateOperationResult | undefined> {
	try {
		const value = await services.toolchain.runTemplateOperation(request);
		return isDotnetTemplateOperationResult(value) ? value : undefined;
	} catch (error) {
		return {
			schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION,
			kind: 'executed',
			operation: request.operation,
			exitCode: 1,
			stdout: '',
			stderr: error instanceof Error ? error.message : String(error),
			failure: 'spawn',
		};
	}
}

async function requireReadySdk(services: IProjectWizardServices): Promise<IDotnetToolchainSnapshot | undefined> {
	let state: unknown;
	try {
		state = await services.toolchain.getState();
	} catch (error) {
		services.appendOutput(localize('dotnetProject.toolchain.readStateFailure', "Could not read .NET Toolchain state: {0}", error instanceof Error ? error.message : String(error)));
	}
	if (isReadySnapshot(state)) {
		return state;
	}

	const choice = await services.choose([
		{ id: 'setup', label: localize('dotnetProject.setupSdk', "Set Up .NET SDK") },
		{ id: 'retry', label: localize('dotnetProject.recheckSdk', "Recheck .NET SDK") },
		{ id: 'output', label: localize('dotnetProject.toolchainOutput', "Show .NET Toolchain Output") },
		{ id: 'cancel', label: localize('dotnetProject.cancel', "Cancel") },
	], localize('dotnetProject.sdkRequired.title', ".NET SDK Required"), localize('dotnetProject.sdkRequired.prompt', "Project templates require a verified local .NET SDK."));
	if (choice === 'output') {
		try {
			await services.toolchain.showOutput();
		} catch (error) {
			services.appendOutput(localize('dotnetProject.toolchain.outputFailure', "Could not show .NET Toolchain output: {0}", error instanceof Error ? error.message : String(error)));
		}
		return undefined;
	}
	if (choice !== 'setup' && choice !== 'retry') {
		return undefined;
	}
	if (choice === 'setup') {
		try {
			await services.toolchain.setup();
		} catch (error) {
			services.appendOutput(localize('dotnetProject.setupFailure', "The .NET SDK setup command failed: {0}", error instanceof Error ? error.message : String(error)));
		}
	}
	try {
		state = await services.toolchain.recheck();
	} catch (error) {
		services.appendOutput(localize('dotnetProject.toolchain.refreshFailure', "Could not refresh .NET Toolchain state: {0}", error instanceof Error ? error.message : String(error)));
	}
	if (isReadySnapshot(state)) {
		return state;
	}
	services.warn(localize('dotnetProject.sdkNotReady', "A verified local .NET SDK is not ready. Project creation was not started."));
	return undefined;
}

async function chooseConfiguration(services: IProjectWizardServices, templateId: string, surface: ITemplateOptionSurface): Promise<ITemplateConfiguration | undefined> {
	const capabilities = getTemplateCapabilities(templateId, surface);
	const configuration: { framework?: string; webApiStyle?: ITemplateConfiguration['webApiStyle']; includeTests: boolean; restore: boolean; initializeGit: boolean } = {
		includeTests: false,
		restore: true,
		initializeGit: false,
	};

	if (capabilities.frameworks.length > 0) {
		const choices: IProjectWizardChoice[] = [
			{ id: 'sdk-default', label: localize('dotnetProject.framework.default', "Use SDK Default Framework") },
			...capabilities.frameworks.map(framework => ({ id: framework, label: framework })),
		];
		const choice = await services.choose(choices, localize('dotnetProject.framework.title', "Target Framework"), localize('dotnetProject.framework.prompt', "Choose a framework advertised by this template."));
		if (choice === undefined) {
			return undefined;
		}
		if (choice !== 'sdk-default') {
			configuration.framework = choice;
		}
	}

	if (capabilities.webApiStyles.length > 0) {
		const choices: IProjectWizardChoice[] = [
			{ id: 'sdk-default', label: localize('dotnetProject.apiStyle.default', "Use SDK Default API Style") },
			...(capabilities.webApiStyles.includes('minimalApis') ? [{ id: 'minimalApis', label: localize('dotnetProject.apiStyle.minimal', "Minimal APIs") }] : []),
			...(capabilities.webApiStyles.includes('controllers') ? [{ id: 'controllers', label: localize('dotnetProject.apiStyle.controllers', "Controllers") }] : []),
		];
		const choice = await services.choose(choices, localize('dotnetProject.apiStyle.title', "Web API Style"), localize('dotnetProject.apiStyle.prompt', "Choose only from styles supported by this template."));
		if (choice === undefined) {
			return undefined;
		}
		if (choice === 'minimalApis' || choice === 'controllers') {
			configuration.webApiStyle = choice;
		}
	}

	if (capabilities.includeTests) {
		const choice = await services.choose([
			{ id: 'no', label: localize('dotnetProject.tests.no', "Do Not Include Tests") },
			{ id: 'yes', label: localize('dotnetProject.tests.yes', "Include Tests") },
		], localize('dotnetProject.tests.title', "Include Tests"), localize('dotnetProject.tests.prompt', "Choose whether this template should include tests."));
		if (choice === undefined) {
			return undefined;
		}
		configuration.includeTests = choice === 'yes';
	}

	if (capabilities.noRestore) {
		const choice = await services.choose([
			{ id: 'restore', label: localize('dotnetProject.restore.yes', "Restore Dependencies") },
			{ id: 'skip', label: localize('dotnetProject.restore.no', "Skip Restore") },
		], localize('dotnetProject.restore.title', "Restore Dependencies"), localize('dotnetProject.restore.prompt', "Restore is enabled by default."));
		if (choice === undefined) {
			return undefined;
		}
		configuration.restore = choice !== 'skip';
	}

	const gitChoice = await services.choose([
		{ id: 'skipGit', label: localize('dotnetProject.git.skip', "Do Not Initialize Git") },
		{ id: 'initializeGit', label: localize('dotnetProject.git.initialize', "Initialize a Git Repository") },
	], localize('dotnetProject.git.title', "Git Repository"), localize('dotnetProject.git.prompt', "Git initialization runs after the project is opened."));
	if (gitChoice === undefined) {
		return undefined;
	}
	configuration.initializeGit = gitChoice === 'initializeGit';

	return configuration;
}

/** Runs the wizard through explicit service boundaries so every operation is mockable in tests. */
export async function runProjectWizard(services: IProjectWizardServices): Promise<void> {
	const sdk = await requireReadySdk(services);
	if (!sdk) {
		return;
	}

	const catalogRequest: IDotnetTemplateOperationRequest = { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, operation: 'listTemplates' };
	const catalogResult = await runTemplateOperation(services, catalogRequest);
	if (!isSuccessful(catalogResult, 'listTemplates')) {
		services.reportFailure(localize('dotnetProject.catalogFailure', "Could not discover installed .NET templates."), formatOperationDetails(catalogResult));
		return;
	}
	const templates = parseInstalledTemplateList(catalogResult.stdout);
	if (templates.length === 0) {
		services.warn(localize('dotnetProject.noTemplates', "No approved .NET templates are installed for the verified SDK. Walker did not download or install templates."));
		return;
	}

	const templateId = await services.choose(templates.map(template => ({ id: template.id, label: template.label, description: template.id })), localize('dotnetProject.newProject.title', "New .NET Project"), localize('dotnetProject.template.prompt', "Choose an installed template."));
	const selectedTemplate = templates.find(template => template.id === templateId);
	if (!selectedTemplate) {
		return;
	}

	const helpRequest: IDotnetTemplateOperationRequest = { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, operation: 'help', template: selectedTemplate.id };
	const helpResult = await runTemplateOperation(services, helpRequest);
	let optionSurface: ITemplateOptionSurface = { recognized: false, options: [] };
	if (isSuccessful(helpResult, 'help')) {
		optionSurface = parseTemplateHelp(`${helpResult.stdout}\n${helpResult.stderr}`);
	}
	if (!optionSurface.recognized) {
		services.appendOutput(localize('dotnetProject.help.unrecognized', "Template option help was unavailable or unrecognized for '{0}'. Specialized options were hidden.", selectedTemplate.id));
		if (helpResult && !isSuccessful(helpResult, 'help')) {
			services.appendOutput(formatOperationDetails(helpResult));
		}
		services.warn(localize('dotnetProject.help.hidden', "Walker could not safely read the '{0}' option surface. Only the basic project settings will be offered.", selectedTemplate.label));
	}

	const name = await services.input({
		title: localize('dotnetProject.name.title', "Project Name"),
		placeHolder: localize('dotnetProject.name.placeholder', "Example: CatalogApi"),
		prompt: localize('dotnetProject.name.prompt', "Enter a folder-safe .NET project name."),
		validate: getProjectNameValidationError,
	});
	if (name === undefined) {
		return;
	}

	const parent = await services.chooseParentLocation();
	if (!parent) {
		return;
	}
	if (parent.scheme !== FILE_SCHEME || !(await services.isDirectory(parent))) {
		services.warn(localize('dotnetProject.location.invalid', "Choose an existing local folder as the project location."));
		return;
	}
	const output = URI.joinPath(parent, name);
	let outputAlreadyExists: boolean;
	try {
		outputAlreadyExists = await services.exists(output);
	} catch (error) {
		services.reportFailure(localize('dotnetProject.output.checkFailure', "Walker could not verify that the project destination is available. No template operation was started."), error instanceof Error ? error.message : String(error));
		return;
	}
	if (outputAlreadyExists) {
		services.warn(localize('dotnetProject.output.exists', "A file or folder with that project name already exists. Choose another name or location; existing data will not be overwritten."));
		return;
	}

	const configuration = await chooseConfiguration(services, selectedTemplate.id, optionSurface);
	if (!configuration) {
		return;
	}
	const options = createDotnetNewOptions(selectedTemplate.id, optionSurface, configuration);
	if (!options) {
		services.warn(localize('dotnetProject.options.unsupported', "One of the selected options is not supported by this template. No project files were created."));
		return;
	}

	const requestBase = {
		schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION,
		template: selectedTemplate.id,
		name,
		output: output.fsPath,
		options,
	} as const;
	const dryRunRequest: IDotnetTemplateOperationRequest = { ...requestBase, operation: 'dryRun' };
	const dryRunOutcome = await services.withProgress(localize('dotnetProject.progress.validationTitle', "Validating .NET Project"), async (report, token) => {
		if (token.isCancellationRequested) {
			return { result: undefined, cancelled: true };
		}
		report(localize('dotnetProject.progress.validate', "Validating '{0}' options", selectedTemplate.id));
		const result = await runTemplateOperation(services, dryRunRequest);
		return { result, cancelled: token.isCancellationRequested };
	});
	if (!dryRunOutcome.result && dryRunOutcome.cancelled) {
		services.info(localize('dotnetProject.progress.validationCancelled', "Project validation was canceled. No project files were created."));
		return;
	}
	if (!isSuccessful(dryRunOutcome.result, 'dryRun')) {
		services.reportFailure(localize('dotnetProject.dryRun.failure', "The .NET template validation failed."), formatOperationDetails(dryRunOutcome.result));
		return;
	}
	if (dryRunOutcome.cancelled) {
		services.info(localize('dotnetProject.progress.validationCancelled', "Project validation was canceled. No project files were created."));
		return;
	}

	const generateRequest: IDotnetTemplateOperationRequest = { ...requestBase, operation: 'generate' };
	const generateOutcome = await services.withProgress(localize('dotnetProject.progress.createTitle', "Creating .NET Project"), async (report, token) => {
		if (token.isCancellationRequested) {
			return { result: undefined, cancelled: true };
		}
		report(localize('dotnetProject.progress.create', "Creating '{0}' project", selectedTemplate.id));
		const result = await runTemplateOperation(services, generateRequest);
		return { result, cancelled: token.isCancellationRequested };
	});
	if (!generateOutcome.result && generateOutcome.cancelled) {
		services.info(localize('dotnetProject.progress.generationCancelled', "Project generation was canceled before it started. No project files were created."));
		return;
	}
	let outputIsDirectory = false;
	try {
		const outputExists = await services.exists(output);
		outputIsDirectory = outputExists && await services.isDirectory(output);
	} catch (error) {
		services.reportFailure(localize('dotnetProject.output.verifyFailure', "The template finished, but Walker could not verify the generated project. Any generated output was preserved."), error instanceof Error ? error.message : String(error));
		return;
	}
	if (!isSuccessful(generateOutcome.result, 'generate') || !outputIsDirectory) {
		const outcome = outputIsDirectory
			? localize('dotnetProject.output.preserved', "Generated output, if any, was preserved.")
			: localize('dotnetProject.output.unconfirmed', "No project directory was confirmed.");
		services.reportFailure(localize('dotnetProject.generation.failure', "The .NET template command did not complete successfully."), `${formatOperationDetails(generateOutcome.result)}\n${outcome}`);
		return;
	}

	let addedToRecent = false;
	try {
		await services.addRecentlyOpened(output);
		addedToRecent = true;
	} catch (error) {
		services.reportFailure(localize('dotnetProject.recent.failure', "The project was created but could not be added to recent workspaces."), error instanceof Error ? error.message : String(error));
	}

	if (generateOutcome.cancelled) {
		services.info(addedToRecent
			? localize('dotnetProject.progress.generationFinishedAfterCancel', "The template operation finished after cancellation was requested. The project is preserved in Recent and was not opened.")
			: localize('dotnetProject.progress.generationFinishedAfterCancelWithoutRecent', "The template operation finished after cancellation was requested. The project was preserved but could not be added to Recent; it was not opened."));
		return;
	}

	const openChoices: IProjectWizardChoice[] = [
		{ id: 'same', label: localize('dotnetProject.open.same', "Open in This Window") },
		{ id: 'new', label: localize('dotnetProject.open.new', "Open in New Window") },
		...(configuration.initializeGit ? [] : [{ id: 'later', label: localize('dotnetProject.open.later', "Open Later") }]),
	];
	const openChoice = await services.choose(openChoices, localize('dotnetProject.created.title', "Project Created"), localize('dotnetProject.created.prompt', "The project was created and added to recent workspaces."));
	if (openChoice === 'same' || openChoice === 'new') {
		let deferredGitInitialization: IDeferredGitInitialization | undefined;
		if (openChoice === 'new' && configuration.initializeGit) {
			try {
				deferredGitInitialization = await services.deferGitInitialization(output);
			} catch (error) {
				services.reportFailure(localize('dotnetProject.git.deferFailure', "The project was created, but Git initialization could not be scheduled for the new window."), error instanceof Error ? error.message : String(error));
			}
		}
		try {
			await services.open(output, openChoice === 'new');
		} catch (error) {
			if (deferredGitInitialization) {
				try {
					await deferredGitInitialization.cancel();
				} catch (cancelError) {
					services.appendOutput(localize('dotnetProject.git.cancelDeferredFailure', "Could not clear the deferred Git initialization intent: {0}", cancelError instanceof Error ? cancelError.message : String(cancelError)));
				}
			}
			const gitNote = configuration.initializeGit ? localize('dotnetProject.git.notStarted', " Git initialization was not started.") : '';
			services.reportFailure(localize('dotnetProject.open.failure', "The project was created, but the workspace could not be opened."), `${error instanceof Error ? error.message : String(error)}${gitNote}`);
			return;
		}
		if (openChoice === 'new') {
			services.info(localize('dotnetProject.opened.new', "The project was opened in a new window."));
			if (configuration.initializeGit && deferredGitInitialization) {
				services.info(localize('dotnetProject.git.deferred', "Git initialization will run in the new project window."));
			}
		} else {
			if (configuration.initializeGit) {
				try {
					await services.initializeGit(output);
					services.info(localize('dotnetProject.git.initialized', "Git was initialized in the created project."));
				} catch (error) {
					services.reportFailure(localize('dotnetProject.git.failure', "The project was opened, but Git initialization failed. The generated project was preserved."), error instanceof Error ? error.message : String(error));
				}
			}
			services.info(localize('dotnetProject.opened.same', "The project was opened in this window."));
		}
	} else if (configuration.initializeGit) {
		services.info(localize('dotnetProject.git.skipped', "The project was created and added to Recent. Git initialization was skipped because the open step was canceled."));
	} else {
		services.info(localize('dotnetProject.open.later.info', "The project was created and is available in recent workspaces."));
	}
}
