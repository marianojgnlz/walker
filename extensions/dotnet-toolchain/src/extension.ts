/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Command boundary for the .NET toolchain extension: host locality guard, synchronous command
 * registration, the localized selection UI, the local machine adapters, and the composition of the
 * installer controller with the status presenter. `extension.ts` may bind the runtime `vscode`
 * module through {@link createVscodeExtensionHost}, but every behavior below is exercised through
 * the injected facade so plain Node tests can cover it without importing `vscode`.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import type { ICandidateEnvironment } from './candidates';
import {
	DOTNET_TOOLCHAIN_COMMANDS,
	DOTNET_TOOLCHAIN_SCHEMA_VERSION,
	isDotnetTemplateOperationRequest,
	type DotnetToolchainState,
	type IDotnetTemplateOperationRequest,
	type IDotnetTemplateOperationResult,
	type IDotnetToolchainSnapshot,
	type IEnvironmentAdapter,
	type IFileSystemAdapter,
	type IProcessAdapter,
	type IToolchainUi,
} from './contracts';
import {
	createNodeScriptFileWriter,
	createNodeScriptTransport,
	resolveDotnetProxy,
	type DotnetProxySetting,
} from './download';
import { createDotnetInstallerController, type IDotnetInstallerController } from './installer';
import { createInstallerProcessRunner, createProcessRunner } from './processRunner';
import {
	createDotnetSelectionPrompter,
	type DotnetVersionRejectionReason,
	type IDotnetSelectionUi,
} from './selection';
import type { DotnetPrerequisiteFailureCode } from './platformArguments';
import {
	createDotnetStatusController,
	type IDotnetDisposable,
	type IDotnetStatusHost,
	type IDotnetToolchainStateSource,
} from './status';

/** Input box request used by the exact-version prompt. */
export interface IDotnetInputBoxOptions {
	readonly prompt: string;
	readonly placeHolder: string;
	readonly ignoreFocusOut: boolean;
}

/** Modal warning request used by the final install confirmation. */
export interface IDotnetWarningOptions {
	readonly modal: boolean;
}

/**
 * Narrow `vscode` facade for the extension boundary. The real module is bound by
 * {@link createVscodeExtensionHost}; tests inject recording facades.
 */
export interface IDotnetExtensionHost extends IDotnetStatusHost {
	/** Host where the extension actually runs: `web` hosts can never provision the local machine. */
	readonly uiKind: 'desktop' | 'web';
	/** Remote authority of the window, if any; never a rejection condition (D1). */
	readonly remoteName: string | undefined;
	/** Current local workspace roots; non-file remote roots are not local filesystem candidates. */
	getWorkspaceRoots(): readonly string[];
	registerCommand(id: string, handler: (...args: unknown[]) => unknown): IDotnetDisposable;
	showInputBox(options: IDotnetInputBoxOptions): Promise<string | undefined>;
	showWarningMessage(message: string, options: IDotnetWarningOptions, ...items: string[]): Promise<string | undefined>;
	showInformationMessage(message: string): Promise<unknown>;
	/** User/machine `http.proxy` value; workspace-provided proxy values are never used. */
	getHttpProxySetting(): string | undefined;
}

/** Activation inputs; the parent (or tests) supplies the facade and the controller factory. */
export interface IDotnetToolchainActivationOptions {
	readonly host: IDotnetExtensionHost;
	/** Running extension host kind (`vscode.ExtensionContext.extension.extensionKind`). */
	readonly extensionKind: 'ui' | 'workspace' | undefined;
	/** Disposal list the extension host owns (`vscode.ExtensionContext.subscriptions`). */
	readonly subscriptions: IDotnetDisposable[];
	/** Builds the local install controller; never called on an unsupported host. */
	readonly createController: (ui: IToolchainUi) => IDotnetInstallerController;
	/** Creates the bounded, sanitized process adapter for internal local template operations. */
	readonly createTemplateProcess?: () => IProcessAdapter;
	readonly refreshIntervalMs?: number;
}

/** Result of one activation; disposal is idempotent and owned by the extension host subscriptions. */
export interface IDotnetToolchainExtension extends IDotnetDisposable {
	/** True when the running host can provide local machine setup. */
	readonly available: boolean;
	getSnapshot(): IDotnetToolchainSnapshot;
}

/** Localized explanations for stable version-rejection reasons (B1 contract). */
const VERSION_REJECTION_MESSAGES: Readonly<Record<DotnetVersionRejectionReason, string>> = {
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

/** Localized, actionable explanations for prerequisite failures before any prompt or write. */
const PREREQUISITE_MESSAGES: Readonly<Record<DotnetPrerequisiteFailureCode, string>> = {
	'unsupported-architecture': 'This machine\'s architecture is not supported for a managed .NET SDK installation.',
	'missing-bash': 'The official .NET install script requires bash, which was not found at a trusted absolute path.',
	'missing-powershell': 'The official .NET install script requires Windows PowerShell at its system location.',
	'unsafe-path': 'A required tool path is not safe to execute, so setup cannot continue.',
};

/** Builds one immutable snapshot value. */
function createSnapshot(state: DotnetToolchainState, revision: number): IDotnetToolchainSnapshot {
	return { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, revision, state, locality: 'local' };
}

/** Plain-text description for an unexpected activation-time error. */
function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

const TEMPLATE_OPERATION_TIMEOUT_MS = 60_000;
const TEMPLATE_GENERATION_TIMEOUT_MS = 10 * 60 * 1000;
const TEMPLATE_CHILD_ENVIRONMENT = Object.freeze({ DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' });

function buildDotnetNewArguments(request: IDotnetTemplateOperationRequest): readonly string[] {
	switch (request.operation) {
		case 'listTemplates':
			return ['new', 'list'];
		case 'help':
			return ['new', request.template, '--help'];
		case 'dryRun':
		case 'generate': {
			const args = ['new', request.template, '--name', request.name, '--output', request.output];
			if (request.operation === 'dryRun') {
				args.push('--dry-run');
			}
			for (const option of request.options) {
				args.push(`--${option.name}`);
				if (option.value !== undefined) {
					args.push(option.value);
				}
			}
			return args;
		}
	}
}

function invalidTemplateOperation(reason: Extract<IDotnetTemplateOperationResult, { readonly kind: 'invalid' }>['reason']): IDotnetTemplateOperationResult {
	return { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, kind: 'invalid', reason };
}

function isNodeErrorCode(error: unknown, code: string): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

/**
 * Activates the command boundary. Commands are registered synchronously before any asynchronous
 * detection starts; startup performs detection only and never installs. Unsupported hosts (browser
 * windows or a non-UI extension host) never construct the installer controller, so no probe or
 * install process can start, and they report a localized `unavailable` state with output.
 */
export function activateDotnetToolchain(options: IDotnetToolchainActivationOptions): IDotnetToolchainExtension {
	const { host, subscriptions } = options;
	const available = host.uiKind === 'desktop' && options.extensionKind === 'ui';
	let snapshot = createSnapshot(available ? 'checking' : 'unavailable', 0);
	let controller: IDotnetInstallerController | undefined;
	let disposed = false;
	const registrations: IDotnetDisposable[] = [];
	let templateProcess: IProcessAdapter | undefined;

	const source: IDotnetToolchainStateSource = {
		getSnapshot: () => controller?.getSnapshot() ?? snapshot,
		recheck: async () => controller === undefined ? snapshot : await controller.recheck(),
		setup: async request => controller === undefined ? snapshot : await controller.setup(request),
		dispose: () => controller?.dispose(),
	};
	const status = createDotnetStatusController({
		host,
		source,
		...(options.refreshIntervalMs === undefined ? {} : { refreshIntervalMs: options.refreshIntervalMs }),
	});
	subscriptions.push(status);

	if (available) {
		try {
			controller = options.createController(status);
			subscriptions.push(controller);
		} catch (error) {
			snapshot = createSnapshot('unavailable', snapshot.revision + 1);
			status.update(snapshot);
			status.appendOutput(host.t('Local .NET SDK setup is unavailable because the extension could not start: {0}', describeError(error)));
		}
	}

	const register = (id: string, handler: (...args: unknown[]) => unknown): void => {
		const registration = host.registerCommand(id, handler);
		registrations.push(registration);
		subscriptions.push(registration);
	};
	register(DOTNET_TOOLCHAIN_COMMANDS.getState, () => source.getSnapshot());
	register(DOTNET_TOOLCHAIN_COMMANDS.recheck, async () => {
		const next = await source.recheck();
		status.update(next);
		return next;
	});
	// External command arguments are forwarded verbatim so the B1 chooser contract owns them.
	register(DOTNET_TOOLCHAIN_COMMANDS.setup, (...args) => status.runSetup(args.length === 0 ? undefined : args));
	register(DOTNET_TOOLCHAIN_COMMANDS.showOutput, () => { status.showOutput(); });
	register(DOTNET_TOOLCHAIN_COMMANDS.showActions, () => status.showActions());
	register(DOTNET_TOOLCHAIN_COMMANDS.runTemplateOperation, async (...args): Promise<IDotnetTemplateOperationResult> => {
		if (args.length !== 1 || !isDotnetTemplateOperationRequest(args[0])) {
			return invalidTemplateOperation('malformed-request');
		}
		const request = args[0];
		const active = await source.recheck();
		status.update(active);
		if (active.state !== 'ready' || active.verified === undefined || !available) {
			return { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, kind: 'unavailable', reason: 'sdk-not-ready' };
		}

		let outputPath: string | undefined;
		let cwd = os.tmpdir();
		if (request.operation === 'dryRun' || request.operation === 'generate') {
			const localPath = process.platform === 'win32' ? path.win32 : path.posix;
			if (!localPath.isAbsolute(request.output)) {
				return invalidTemplateOperation('unsafe-output');
			}
			outputPath = localPath.resolve(request.output);
			if (localPath.basename(outputPath).length === 0 || outputPath === localPath.parse(outputPath).root) {
				return invalidTemplateOperation('unsafe-output');
			}
			cwd = localPath.dirname(outputPath);
			try {
				const parentStat = await fs.stat(cwd);
				if (!parentStat.isDirectory()) {
					return invalidTemplateOperation('unsafe-output');
				}
			} catch {
				return invalidTemplateOperation('unsafe-output');
			}
			try {
				await fs.lstat(outputPath);
				return invalidTemplateOperation('unsafe-output');
			} catch (error) {
				if (!isNodeErrorCode(error, 'ENOENT')) {
					return invalidTemplateOperation('unsafe-output');
				}
			}
		}

		const normalizedRequest = outputPath === undefined ? request : { ...request, output: outputPath };
		try {
			templateProcess ??= options.createTemplateProcess?.() ?? createProcessRunner();
			const result = await templateProcess.run({
				executable: active.verified.executable,
				args: buildDotnetNewArguments(normalizedRequest),
				cwd,
				env: TEMPLATE_CHILD_ENVIRONMENT,
				timeoutMs: request.operation === 'generate' ? TEMPLATE_GENERATION_TIMEOUT_MS : TEMPLATE_OPERATION_TIMEOUT_MS,
			});
			return {
				schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION,
				kind: 'executed',
				operation: request.operation,
				exitCode: result.exitCode,
				stdout: result.stdout,
				stderr: result.stderr,
				...(result.failure === undefined ? {} : { failure: result.failure }),
			};
		} catch (error) {
			return {
				schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION,
				kind: 'executed',
				operation: request.operation,
				exitCode: 1,
				stdout: '',
				stderr: describeError(error),
				failure: 'spawn',
			};
		}
	});

	status.update(source.getSnapshot());
	if (available && controller !== undefined) {
		// Startup detection only: begin the coalesced first pass without waiting, never set up.
		void source.recheck().then(
			next => status.update(next),
			error => status.appendOutput(host.t('Detection failed to start: {0}', describeError(error))),
		);
	} else if (!available) {
		const reason = host.uiKind === 'web'
			? host.t('the desktop application is required')
			: host.t('the extension is not running in a local user-interface host');
		status.appendOutput(host.t('Local .NET SDK setup is unavailable in this window because {0}. No local probe or installation was started.', reason));
	}

	return {
		available,
		getSnapshot: () => source.getSnapshot(),
		dispose: () => {
			if (disposed) {
				return;
			}
			disposed = true;
			for (const registration of registrations) {
				registration.dispose();
			}
			status.dispose();
			source.dispose();
		},
	};
}

/**
 * Explicit LTS / STS / exact-version selection UI bound to `vscode.l10n.t`. Every prompt string is
 * localized here, the confirmation always shows the local machine destination and network use, and
 * a dismissed prompt is never consent. The core prompter owns single flight and prompt ordering.
 */
export function createDotnetSelectionUi(host: IDotnetExtensionHost): IDotnetSelectionUi {
	return {
		chooseChannel: async chooser => {
			const items = [
				{ id: 'LTS', label: host.t('LTS — Long Term Support'), description: host.t('Recommended stable release') },
				{ id: 'STS', label: host.t('STS — Standard Term Support'), description: host.t('Newest feature release') },
				{ id: 'specific', label: host.t('Specific version…'), description: host.t('Enter an exact stable SDK version') },
			];
			const picked = await host.showQuickPick(items, {
				placeHolder: host.t('Choose the .NET SDK channel for this local machine ({0}), installing into {1}', chooser.architecture, chooser.destination),
				ignoreFocusOut: true,
			});
			const id = picked?.id;
			return id === 'LTS' || id === 'STS' || id === 'specific' ? id : undefined;
		},
		requestVersion: () => host.showInputBox({
			prompt: host.t('Enter an exact stable .NET SDK version, for example 10.0.401'),
			placeHolder: host.t('major.minor.patch'),
			ignoreFocusOut: true,
		}),
		explainInvalidVersion: rejection => { void host.showErrorMessage(host.t(VERSION_REJECTION_MESSAGES[rejection.reason])); },
		confirmSelection: async confirmation => {
			const choice = confirmation.selection.kind === 'channel'
				? host.t('the {0} channel', confirmation.selection.channel)
				: host.t('SDK version {0}', confirmation.selection.version);
			const confirmLabel = host.t('Install');
			const picked = await host.showWarningMessage(
				host.t('Install {0} into {1} on this local machine? The official Microsoft install script is downloaded over the network, and no system-wide changes are made.', choice, confirmation.destination),
				{ modal: true },
				confirmLabel,
			);
			return picked === confirmLabel;
		},
		revealActiveSelection: () => { void host.showInformationMessage(host.t('A .NET SDK setup choice is already open. Complete or cancel it before starting another setup.')); },
		reportFailure: failure => { void host.showErrorMessage(host.t(PREREQUISITE_MESSAGES[failure.code])); },
	};
}

/**
 * Maps one `http.proxy` setting value to the download layer's policy input. Empty values mean a
 * direct connection; PAC endpoints are classified so they fail as explicitly unsupported rather
 * than being treated as a proxy URL. Credential rejection stays in `resolveDotnetProxy`.
 */
export function parseDotnetProxySetting(value: string | undefined): DotnetProxySetting {
	const trimmed = value?.trim() ?? '';
	if (trimmed.length === 0) {
		return { kind: 'none' };
	}
	const lower = trimmed.toLowerCase();
	if (lower.startsWith('file:') || lower.endsWith('.pac') || lower.endsWith('.dat')) {
		return { kind: 'pac', value: trimmed };
	}
	return { kind: 'url', value: trimmed };
}

/**
 * Binds the narrow extension facade to the real `vscode` module. Locality facts come from
 * `env.uiKind`, dialogs and localization use `l10n.t`/`window`, and the status tooltip renders as
 * literally appended markdown text so executable paths can never be interpreted as markup.
 */
export function createVscodeExtensionHost(vscodeApi: typeof import('vscode')): IDotnetExtensionHost {
	return {
		t: (message: string, ...args: Array<string | number | boolean>) => vscodeApi.l10n.t(message, ...args),
		uiKind: vscodeApi.env.uiKind === vscodeApi.UIKind.Desktop ? 'desktop' : 'web',
		remoteName: vscodeApi.env.remoteName,
		getWorkspaceRoots: () => (vscodeApi.workspace.workspaceFolders ?? []).flatMap(folder => folder.uri.scheme === 'file' ? [folder.uri.fsPath] : []),
		getHttpProxySetting: () => {
			const inspected = vscodeApi.workspace.getConfiguration('http').inspect<string>('proxy');
			const value = inspected?.globalValue;
			return typeof value === 'string' && value.length > 0 ? value : undefined;
		},
		registerCommand: (id, handler) => vscodeApi.commands.registerCommand(id, handler),
		createStatusBarItem: () => {
			const item = vscodeApi.window.createStatusBarItem(vscodeApi.StatusBarAlignment.Left, 100);
			let tooltip: { readonly lines: readonly string[] } | undefined;
			return {
				get text() { return item.text; },
				set text(value: string) { item.text = value; },
				get tooltip() { return tooltip; },
				set tooltip(value: { readonly lines: readonly string[] } | undefined) {
					tooltip = value;
					item.tooltip = value === undefined ? undefined : new vscodeApi.MarkdownString().appendText(value.lines.join('\n'));
				},
				get command() { return typeof item.command === 'string' ? item.command : undefined; },
				set command(value: string | undefined) { item.command = value; },
				show: () => item.show(),
				hide: () => item.hide(),
				dispose: () => item.dispose(),
			};
		},
		createOutputChannel: name => {
			const channel = vscodeApi.window.createOutputChannel(name);
			return {
				appendLine: line => channel.appendLine(line),
				show: preserveFocus => channel.show(preserveFocus),
				dispose: () => channel.dispose(),
			};
		},
		timers: {
			setInterval: (handler, intervalMs) => {
				const handle = setInterval(handler, intervalMs);
				return { dispose: () => clearInterval(handle) };
			},
		},
		showQuickPick: async (items, options) => {
			const picks = items.map(item => ({
				label: item.label,
				...(item.description === undefined ? {} : { description: item.description }),
				...(item.detail === undefined ? {} : { detail: item.detail }),
			}));
			const picked = await vscodeApi.window.showQuickPick(picks, { placeHolder: options.placeHolder, ignoreFocusOut: options.ignoreFocusOut });
			if (picked === undefined) {
				return undefined;
			}
			const index = picks.indexOf(picked);
			return index === -1 ? undefined : items[index];
		},
		showInputBox: async options => await vscodeApi.window.showInputBox({ prompt: options.prompt, placeHolder: options.placeHolder, ignoreFocusOut: options.ignoreFocusOut }),
		showWarningMessage: async (message, options, ...items) => await vscodeApi.window.showWarningMessage(message, { modal: options.modal }, ...items),
		showInformationMessage: async message => await vscodeApi.window.showInformationMessage(message),
		showErrorMessage: async message => await vscodeApi.window.showErrorMessage(message),
		withProgress: async (title, task) => await vscodeApi.window.withProgress(
			{ location: vscodeApi.ProgressLocation.Notification, title, cancellable: true },
			(progress, token) => task(
				{ report: value => progress.report({ message: value.message }) },
				{
					get isCancellationRequested() { return token.isCancellationRequested; },
					onCancellationRequested: listener => {
						const registration = token.onCancellationRequested(listener);
						return () => registration.dispose();
					},
				},
			),
		),
	};
}

/** Local machine facts for candidate discovery; never remote or workspace values (D2). */
function createLocalEnvironment(): ICandidateEnvironment {
	const programFiles = process.env['ProgramFiles'];
	const programFilesX86 = process.env['ProgramFiles(x86)'];
	return {
		home: os.homedir(),
		platform: process.platform,
		arch: process.arch,
		path: process.env['PATH'] ?? '',
		...(programFiles === undefined ? {} : { programFiles }),
		...(programFilesX86 === undefined ? {} : { programFilesX86 }),
	};
}

/** Real filesystem adapter; missing paths are `undefined`/`false` so probes classify absence. */
function createLocalFileSystem(): IFileSystemAdapter {
	return {
		exists: async candidate => {
			try {
				await fs.stat(candidate);
				return true;
			} catch {
				return false;
			}
		},
		realpath: async candidate => {
			try {
				return await fs.realpath(candidate);
			} catch {
				return undefined;
			}
		},
	};
}

/** Composes the real controller from the local machine adapters and the localized selection UI. */
function createLocalInstallerController(host: IDotnetExtensionHost, ui: IToolchainUi): IDotnetInstallerController {
	const environment: IEnvironmentAdapter = createLocalEnvironment();
	const fileSystem = createLocalFileSystem();
	return createDotnetInstallerController({
		ui,
		environment,
		fileSystem,
		workspaceRoots: () => host.getWorkspaceRoots(),
		selection: createDotnetSelectionPrompter({ ui: createDotnetSelectionUi(host), environment, fileSystem }),
		process: createProcessRunner(),
		installerProcess: createInstallerProcessRunner(),
		temporaryDirectory: os.tmpdir(),
		transport: createNodeScriptTransport(),
		scriptFileWriter: createNodeScriptFileWriter(),
		proxy: resolveDotnetProxy(parseDotnetProxySetting(host.getHttpProxySetting())),
	});
}

/** Extension entry point; the manifest main file. */
export function activate(context: vscode.ExtensionContext): void {
	const vscodeApi: typeof import('vscode') = require('vscode');
	const host = createVscodeExtensionHost(vscodeApi);
	const extensionKind = context.extension.extensionKind === vscodeApi.ExtensionKind.UI
		? 'ui' as const
		: context.extension.extensionKind === vscodeApi.ExtensionKind.Workspace
			? 'workspace' as const
			: undefined;
	activateDotnetToolchain({
		host,
		extensionKind,
		subscriptions: context.subscriptions,
		createController: ui => createLocalInstallerController(host, ui),
	});
}

/** Deactivation hook; owned disposables are registered in `context.subscriptions`. */
export function deactivate(): void {
	// Intentionally empty: the extension host disposes every registered subscription.
}
