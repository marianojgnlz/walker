/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Injected `vscode`-module facades for the extension command/status layer. Nothing in this module
 * imports the runtime `vscode` module, so plain Node Mocha can exercise `extension.ts` and
 * `status.ts` through the same narrow surface the extension host adapter binds.
 */

import type {
	DotnetToolchainState,
	IDotnetToolchainFailure,
	IDotnetToolchainProgress,
	IDotnetToolchainSnapshot,
	IDotnetToolchainVerified,
} from '../contracts';
import type { IDotnetExtensionHost, IDotnetInputBoxOptions, IDotnetWarningOptions } from '../extension';
import type { IDotnetInstallerController, IDotnetSetupRequest } from '../installer';
import type {
	IDotnetCancellationToken,
	IDotnetDisposable,
	IDotnetLocalizer,
	IDotnetOutputChannel,
	IDotnetQuickPickItem,
	IDotnetStatusBarItem,
	IDotnetStatusItemTooltip,
	IDotnetToolchainStateSource,
} from '../status';

/** Builds one snapshot with optional verified/failure/progress detail for presenter fixtures. */
export function dotnetSnapshot(state: DotnetToolchainState, detail: {
	readonly revision?: number;
	readonly verified?: IDotnetToolchainVerified;
	readonly failure?: IDotnetToolchainFailure;
	readonly progress?: IDotnetToolchainProgress;
} = {}): IDotnetToolchainSnapshot {
	return {
		schemaVersion: 1,
		revision: detail.revision ?? 0,
		state,
		locality: 'local',
		...(detail.verified === undefined ? {} : { verified: detail.verified }),
		...(detail.failure === undefined ? {} : { failure: detail.failure }),
		...(detail.progress === undefined ? {} : { progress: detail.progress }),
	};
}

/** Deferred promise resolved explicitly by a test. */
export interface IDeferred<T> {
	readonly promise: Promise<T>;
	resolve(value: T): void;
}

/** Creates one manually resolved promise. */
export function createDeferred<T>(): IDeferred<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(innerResolve => { resolve = innerResolve; });
	return { promise, resolve };
}

/** Disposable that records whether it was disposed. */
export interface IRecordedDisposable extends IDotnetDisposable {
	readonly disposed: boolean;
}

/** Creates one recording disposable. */
export function createRecordedDisposable(): IRecordedDisposable {
	let disposed = false;
	return {
		get disposed() { return disposed; },
		dispose: () => { disposed = true; },
	};
}

/** Localizer recorder that wraps every message so tests can prove text went through `l10n.t`. */
export interface IRecordingLocalizer {
	readonly t: IDotnetLocalizer;
	readonly messages: readonly string[];
	readonly args: readonly (readonly (string | number | boolean)[])[];
}

/** Creates a recording localizer with index substitution and a visible localization marker. */
export function createRecordingLocalizer(): IRecordingLocalizer {
	const messages: string[] = [];
	const args: (readonly (string | number | boolean)[])[] = [];
	const t: IDotnetLocalizer = (message, ...values) => {
		messages.push(message);
		args.push(values);
		let rendered = message;
		values.forEach((value, index) => { rendered = rendered.split(`{${index}}`).join(String(value)); });
		return `«${rendered}»`;
	};
	return { t, messages, args };
}

/** Recorded status bar item with visible interaction counts. */
export interface IRecordedStatusBarItem extends IDotnetStatusBarItem {
	readonly shown: number;
	readonly hidden: number;
	readonly disposed: boolean;
	readonly tooltipLines: readonly string[] | undefined;
}

function createRecordedStatusBarItem(): IRecordedStatusBarItem {
	let text = '';
	let command: string | undefined;
	let tooltip: IDotnetStatusItemTooltip | undefined;
	let shown = 0;
	let hidden = 0;
	let disposed = false;
	return {
		get text() { return text; },
		set text(value: string) { text = value; },
		get command() { return command; },
		set command(value: string | undefined) { command = value; },
		get tooltip() { return tooltip; },
		set tooltip(value: IDotnetStatusItemTooltip | undefined) { tooltip = value; },
		get tooltipLines() { return tooltip?.lines; },
		get shown() { return shown; },
		get hidden() { return hidden; },
		get disposed() { return disposed; },
		show: () => { shown += 1; },
		hide: () => { hidden += 1; },
		dispose: () => { disposed = true; },
	};
}

/** Recorded output channel with captured lines. */
export interface IRecordedOutputChannel extends IDotnetOutputChannel {
	readonly lines: readonly string[];
	readonly shown: number;
	readonly disposed: boolean;
}

function createRecordedOutputChannel(): IRecordedOutputChannel {
	const lines: string[] = [];
	let shown = 0;
	let disposed = false;
	return {
		get lines() { return lines; },
		get shown() { return shown; },
		get disposed() { return disposed; },
		appendLine: line => { lines.push(line); },
		show: () => { shown += 1; },
		dispose: () => { disposed = true; },
	};
}

/** Recorded fake interval owned by the harness timer surface. */
export interface IRecordedInterval extends IDotnetDisposable {
	readonly intervalMs: number;
	readonly disposed: boolean;
	fire(): void;
}

/** Recorded quick-pick invocation. */
export interface IRecordedQuickPickCall {
	readonly items: readonly IDotnetQuickPickItem[];
	readonly placeHolder: string;
	readonly ignoreFocusOut: boolean;
}

/** Recorded warning message invocation. */
export interface IRecordedWarningCall {
	readonly message: string;
	readonly options: IDotnetWarningOptions;
	readonly items: readonly string[];
}

/** Cancellation token whose request can be triggered by the test. */
export interface IFakeCancellationToken extends IDotnetCancellationToken {
	cancel(): void;
}

/** Creates one fake cancellation token. */
export function createFakeCancellationToken(): IFakeCancellationToken {
	let requested = false;
	const listeners = new Set<() => void>();
	return {
		get isCancellationRequested() { return requested; },
		onCancellationRequested: listener => {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		cancel: () => {
			requested = true;
			for (const listener of [...listeners]) {
				listener();
			}
		},
	};
}

/** Recorded progress invocation with its fake token. */
export interface IRecordedProgressCall {
	readonly title: string;
	readonly messages: readonly string[];
	readonly token: IFakeCancellationToken;
}

/** Options for the injected extension host facade. */
export interface IDotnetHostHarnessOptions {
	readonly uiKind?: 'desktop' | 'web';
	readonly remoteName?: string;
	readonly proxySetting?: string;
}

/** Recording extension host facade covering every `vscode` surface the extension layer uses. */
export interface IDotnetHostHarness extends IDotnetExtensionHost {
	readonly localizer: IRecordingLocalizer;
	readonly statusItem: IRecordedStatusBarItem;
	readonly output: IRecordedOutputChannel;
	readonly intervals: readonly IRecordedInterval[];
	readonly commands: Map<string, (...args: unknown[]) => unknown>;
	readonly registrations: readonly { readonly id: string; readonly disposable: IRecordedDisposable }[];
	readonly quickPicks: readonly IRecordedQuickPickCall[];
	readonly inputBoxes: readonly IDotnetInputBoxOptions[];
	readonly warnings: readonly IRecordedWarningCall[];
	readonly informations: readonly string[];
	readonly errors: readonly string[];
	readonly progressCalls: readonly IRecordedProgressCall[];
	queueQuickPick(...items: readonly (IDotnetQuickPickItem | undefined)[]): void;
	queueInputBox(...values: readonly (string | undefined)[]): void;
	queueWarning(...values: readonly (string | undefined)[]): void;
	fireIntervals(): void;
}

/** Creates the recording extension host facade; nothing here touches the real `vscode` module. */
export function createDotnetHostHarness(options: IDotnetHostHarnessOptions = {}): IDotnetHostHarness {
	const localizer = createRecordingLocalizer();
	const statusItem = createRecordedStatusBarItem();
	const output = createRecordedOutputChannel();
	const intervals: IRecordedInterval[] = [];
	const registrations: { id: string; disposable: IRecordedDisposable }[] = [];
	const commands = new Map<string, (...args: unknown[]) => unknown>();
	const quickPicks: IRecordedQuickPickCall[] = [];
	const inputBoxes: IDotnetInputBoxOptions[] = [];
	const warnings: IRecordedWarningCall[] = [];
	const informations: string[] = [];
	const errors: string[] = [];
	const progressCalls: IRecordedProgressCall[] = [];
	const quickPickQueue: (IDotnetQuickPickItem | undefined)[] = [];
	const inputBoxQueue: (string | undefined)[] = [];
	const warningQueue: (string | undefined)[] = [];
	return {
		localizer,
		t: localizer.t,
		uiKind: options.uiKind ?? 'desktop',
		remoteName: options.remoteName,
		statusItem,
		output,
		intervals,
		commands,
		registrations,
		quickPicks,
		inputBoxes,
		warnings,
		informations,
		errors,
		progressCalls,
		getHttpProxySetting: () => options.proxySetting,
		registerCommand: (id, handler) => {
			const disposable = createRecordedDisposable();
			commands.set(id, handler);
			registrations.push({ id, disposable });
			return disposable;
		},
		createStatusBarItem: () => statusItem,
		createOutputChannel: () => output,
		timers: {
			setInterval: (handler, intervalMs) => {
				const interval: IRecordedInterval = {
					intervalMs,
					get disposed() { return disposed; },
					fire: () => { if (!disposed) { handler(); } },
					dispose: () => { disposed = true; },
				};
				let disposed = false;
				intervals.push(interval);
				return interval;
			},
		},
		showQuickPick: async (items, pickOptions) => {
			quickPicks.push({
				items: items.map(item => ({ id: item.id, label: item.label, ...(item.description === undefined ? {} : { description: item.description }), ...(item.detail === undefined ? {} : { detail: item.detail }) })),
				placeHolder: pickOptions.placeHolder,
				ignoreFocusOut: pickOptions.ignoreFocusOut,
			});
			return quickPickQueue.shift() as typeof items[number] | undefined;
		},
		showInputBox: async inputOptions => {
			inputBoxes.push(inputOptions);
			return inputBoxQueue.shift();
		},
		showWarningMessage: async (message, warningOptions, ...items) => {
			warnings.push({ message, options: warningOptions, items: [...items] });
			return warningQueue.shift();
		},
		showInformationMessage: async message => {
			informations.push(message);
			return message;
		},
		showErrorMessage: async message => {
			errors.push(message);
			return message;
		},
		withProgress: async (title, task) => {
			const token = createFakeCancellationToken();
			const messages: string[] = [];
			progressCalls.push({ title, messages, token });
			return await task({ report: value => { if (value.message !== undefined) { messages.push(value.message); } } }, token);
		},
		queueQuickPick: (...items) => { quickPickQueue.push(...items); },
		queueInputBox: (...values) => { inputBoxQueue.push(...values); },
		queueWarning: (...values) => { warningQueue.push(...values); },
		fireIntervals: () => { for (const interval of intervals) { interval.fire(); } },
	};
}

/** State source whose snapshot and handlers are controlled by the test. */
export interface IStateSourceHarness extends IDotnetToolchainStateSource {
	readonly recheckCalls: number;
	readonly setupRequests: readonly (IDotnetSetupRequest | undefined)[];
	readonly disposeCalls: number;
	setSnapshot(snapshot: IDotnetToolchainSnapshot): void;
	setRecheck(handler: () => Promise<IDotnetToolchainSnapshot>): void;
	setSetup(handler: (request: IDotnetSetupRequest | undefined) => Promise<IDotnetToolchainSnapshot>): void;
}

/** Creates a state source harness for presenter tests. */
export function createStateSourceHarness(initial: IDotnetToolchainSnapshot): IStateSourceHarness {
	let snapshot = initial;
	let recheckCalls = 0;
	let disposeCalls = 0;
	const setupRequests: (IDotnetSetupRequest | undefined)[] = [];
	let recheck: () => Promise<IDotnetToolchainSnapshot> = async () => snapshot;
	let setup: (request: IDotnetSetupRequest | undefined) => Promise<IDotnetToolchainSnapshot> = async () => snapshot;
	return {
		get recheckCalls() { return recheckCalls; },
		get setupRequests() { return setupRequests; },
		get disposeCalls() { return disposeCalls; },
		getSnapshot: () => snapshot,
		recheck: async () => { recheckCalls += 1; return await recheck(); },
		setup: async request => { setupRequests.push(request); return await setup(request); },
		dispose: () => { disposeCalls += 1; },
		setSnapshot: value => { snapshot = value; },
		setRecheck: handler => { recheck = handler; },
		setSetup: handler => { setup = handler; },
	};
}

/** Controller stub recording the command-boundary calls without running the installer pipeline. */
export interface IControllerStub extends IDotnetInstallerController {
	readonly recheckCalls: number;
	readonly setupRequests: readonly (IDotnetSetupRequest | undefined)[];
	readonly disposeCalls: number;
	setSnapshot(snapshot: IDotnetToolchainSnapshot): void;
}

/** Creates a controller stub seeded with one snapshot. */
export function createControllerStub(initial: IDotnetToolchainSnapshot): IControllerStub {
	let snapshot = initial;
	let recheckCalls = 0;
	let disposeCalls = 0;
	const setupRequests: (IDotnetSetupRequest | undefined)[] = [];
	return {
		get recheckCalls() { return recheckCalls; },
		get setupRequests() { return setupRequests; },
		get disposeCalls() { return disposeCalls; },
		getSnapshot: () => snapshot,
		recheck: async () => { recheckCalls += 1; return snapshot; },
		setup: async request => { setupRequests.push(request); return snapshot; },
		dispose: () => { disposeCalls += 1; },
		setSnapshot: value => { snapshot = value; },
	};
}

/** Options for the fake `vscode` module used to exercise the host adapter. */
export interface IFakeVscodeApiOptions {
	readonly uiKind?: 'desktop' | 'web';
	readonly remoteName?: string;
	readonly proxyGlobalValue?: string;
	readonly proxyWorkspaceValue?: string;
}

/** Recording fake `vscode` module surface. */
export interface IFakeVscodeApi {
	readonly api: typeof import('vscode');
	readonly localized: readonly string[];
	readonly commands: Map<string, (...args: unknown[]) => unknown>;
	readonly statusItem: {
		text: string;
		tooltipText: string | undefined;
		command: string | undefined;
		alignment: number | undefined;
		priority: number | undefined;
		shown: number;
		hidden: number;
		disposed: boolean;
	};
	readonly outputChannel: { readonly name: string; readonly lines: string[]; readonly shown: readonly (boolean | undefined)[]; readonly disposed: boolean };
	readonly quickPicks: readonly { readonly items: readonly { readonly label: string; readonly description?: string }[]; readonly options: { readonly placeHolder?: string; readonly ignoreFocusOut?: boolean } }[];
	readonly inputBoxes: readonly { readonly prompt?: string; readonly placeHolder?: string; readonly ignoreFocusOut?: boolean }[];
	readonly warnings: readonly { readonly message: string; readonly options: { readonly modal?: boolean }; readonly items: readonly string[] }[];
	readonly informations: readonly string[];
	readonly errors: readonly string[];
	readonly progress: readonly { readonly title: string | { readonly value: string }; readonly cancellable: boolean | undefined; readonly location: number; readonly reported: readonly string[]; readonly tokenRegistrationDisposed: () => number }[];
	/** Value returned by the next `showQuickPick`; set before calling the adapter. */
	quickPickResult: { readonly label: string } | undefined;
	/** Value returned by the next `showInputBox`. */
	inputBoxResult: string | undefined;
	/** Value returned by the next `showWarningMessage`. */
	warningResult: string | undefined;
	cancelLastProgress(): void;
}

/** Creates a fake `vscode` module that records every call the host adapter makes. */
export function createFakeVscodeApi(options: IFakeVscodeApiOptions = {}): IFakeVscodeApi {
	const localized: string[] = [];
	const commands = new Map<string, (...args: unknown[]) => unknown>();
	const statusItem = { text: '', tooltipText: undefined as string | undefined, command: undefined as string | undefined, alignment: undefined as number | undefined, priority: undefined as number | undefined, shown: 0, hidden: 0, disposed: false };
	const outputChannel = { name: '', lines: [] as string[], shown: [] as (boolean | undefined)[], disposed: false };
	const quickPicks: { items: { label: string; description?: string }[]; options: { placeHolder?: string; ignoreFocusOut?: boolean } }[] = [];
	const inputBoxes: { prompt?: string; placeHolder?: string; ignoreFocusOut?: boolean }[] = [];
	const warnings: { message: string; options: { modal?: boolean }; items: string[] }[] = [];
	const informations: string[] = [];
	const errors: string[] = [];
	const progress: { title: string | { value: string }; cancellable: boolean | undefined; location: number; reported: string[]; tokenRegistrationDisposed: () => number }[] = [];
	let cancelLastProgress: () => void = () => undefined;
	let quickPickResult: { readonly label: string } | undefined;
	let inputBoxResult: string | undefined;
	let warningResult: string | undefined;
	const substitute = (message: string, values: readonly (string | number | boolean)[]): string => {
		let rendered = message;
		values.forEach((value, index) => { rendered = rendered.split(`{${index}}`).join(String(value)); });
		return rendered;
	};
	const api = {
		UIKind: { Desktop: 1, Web: 2 },
		ExtensionKind: { UI: 1, Workspace: 2 },
		StatusBarAlignment: { Left: 1, Right: 2 },
		ProgressLocation: { Notification: 15 },
		MarkdownString: class {
			text = '';
			appendText(value: string) { this.text = value; return this; }
		},
		env: {
			uiKind: options.uiKind === 'web' ? 2 : 1,
			remoteName: options.remoteName,
		},
		l10n: {
			t: (message: string, ...args: (string | number | boolean)[]) => {
				localized.push(message);
				return `«${substitute(message, args)}»`;
			},
		},
		commands: {
			registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => {
				commands.set(id, handler);
				return { dispose: () => undefined };
			},
		},
		window: {
			createStatusBarItem: (alignment: number, priority: number) => {
				statusItem.alignment = alignment;
				statusItem.priority = priority;
				return {
					get text() { return statusItem.text; },
					set text(value: string) { statusItem.text = value; },
					get command() { return statusItem.command; },
					set command(value: string | undefined) { statusItem.command = value; },
					get tooltip() { return statusItem.tooltipText; },
					set tooltip(value: { text?: string } | string | undefined) {
						statusItem.tooltipText = typeof value === 'string' ? value : value?.text;
					},
					show: () => { statusItem.shown += 1; },
					hide: () => { statusItem.hidden += 1; },
					dispose: () => { statusItem.disposed = true; },
				};
			},
			createOutputChannel: (name: string) => {
				outputChannel.name = name;
				return {
					appendLine: (line: string) => { outputChannel.lines.push(line); },
					show: (preserveFocus?: boolean) => { outputChannel.shown.push(preserveFocus); },
					dispose: () => { outputChannel.disposed = true; },
				};
			},
			showQuickPick: async (items: readonly { label: string }[], pickOptions: { placeHolder?: string; ignoreFocusOut?: boolean }) => {
				quickPicks.push({ items: items.map(item => ({ ...item })), options: pickOptions });
				if (quickPickResult === undefined) {
					return undefined as never;
				}
				return (items.find(item => item.label === quickPickResult?.label) ?? quickPickResult) as never;
			},
			showInputBox: async (inputOptions: { prompt?: string; placeHolder?: string; ignoreFocusOut?: boolean }) => {
				inputBoxes.push(inputOptions);
				return inputBoxResult as never;
			},
			showWarningMessage: async (message: string, warningOptions: { modal?: boolean }, ...items: string[]) => {
				warnings.push({ message, options: warningOptions, items });
				return warningResult as never;
			},
			showInformationMessage: async (message: string) => {
				informations.push(message);
				return message;
			},
			showErrorMessage: async (message: string) => {
				errors.push(message);
				return message;
			},
			withProgress: async (progressOptions: { location: number; title: string | { value: string }; cancellable?: boolean }, task: (progress: { report: (value: { message?: string }) => void }, token: { isCancellationRequested: boolean; onCancellationRequested: (listener: () => void) => { dispose(): void } }) => Promise<unknown>) => {
				let requested = false;
				let registrationDisposed = 0;
				const listeners = new Set<() => void>();
				const call = { title: progressOptions.title, cancellable: progressOptions.cancellable, location: progressOptions.location, reported: [] as string[], tokenRegistrationDisposed: () => registrationDisposed };
				progress.push(call);
				cancelLastProgress = () => {
					requested = true;
					for (const listener of [...listeners]) {
						listener();
					}
				};
				return await task(
					{ report: value => { if (value.message !== undefined) { call.reported.push(value.message); } } },
					{
						get isCancellationRequested() { return requested; },
						onCancellationRequested: (listener: () => void) => {
							listeners.add(listener);
							return { dispose: () => { registrationDisposed += 1; listeners.delete(listener); } };
						},
					},
				);
			},
		},
		workspace: {
			getConfiguration: () => ({
				inspect: () => ({
					globalValue: options.proxyGlobalValue,
					workspaceValue: options.proxyWorkspaceValue,
				}),
			}),
		},
	};
	const record: IFakeVscodeApi = {
		api: api as unknown as typeof import('vscode'),
		localized,
		commands,
		statusItem,
		outputChannel,
		quickPicks,
		inputBoxes,
		warnings,
		informations,
		errors,
		progress,
		get quickPickResult() { return quickPickResult; },
		set quickPickResult(value) { quickPickResult = value; },
		get inputBoxResult() { return inputBoxResult; },
		set inputBoxResult(value) { inputBoxResult = value; },
		get warningResult() { return warningResult; },
		set warningResult(value) { warningResult = value; },
		cancelLastProgress: () => cancelLastProgress(),
	};
	return record;
}
