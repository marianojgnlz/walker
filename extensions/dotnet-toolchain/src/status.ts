/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Local status, output, and progress presentation for the .NET toolchain extension. This module is
 * a pure Node presenter: every `vscode` surface arrives through {@link IDotnetStatusHost}, so the
 * presenter can be exercised from plain Node tests and never imports the runtime `vscode` module.
 */

import {
	DOTNET_TOOLCHAIN_COMMANDS,
	type DotnetToolchainFailureStage,
	type DotnetToolchainProgressPhase,
	type DotnetToolchainState,
	type IDotnetToolchainSnapshot,
	type IToolchainUi,
} from './contracts';
import type { IDotnetSetupRequest } from './installer';

/** One owned disposable; mirrors the structural `vscode.Disposable` shape. */
export interface IDotnetDisposable {
	dispose(): void;
}

/** Message lookup bound to `vscode.l10n.t` by the extension host; tests inject a recording translator. */
export interface IDotnetLocalizer {
	(message: string, ...args: Array<string | number | boolean>): string;
}

/** One action the status menu can offer. */
export type DotnetToolchainActionId = 'setup' | 'recheck' | 'showOutput';

/** One quick-pick entry; `id` survives the round trip through the vscode quick pick. */
export interface IDotnetQuickPickItem {
	readonly id: string;
	readonly label: string;
	readonly description?: string;
	readonly detail?: string;
}

/** Plain-text tooltip content; the host renders it literally, never as trusted markdown. */
export interface IDotnetStatusItemTooltip {
	readonly lines: readonly string[];
}

/** Narrow status bar item surface. */
export interface IDotnetStatusBarItem extends IDotnetDisposable {
	text: string;
	tooltip: IDotnetStatusItemTooltip | undefined;
	command: string | undefined;
	show(): void;
	hide(): void;
}

/** Narrow output channel surface; diagnostics are appended as plain text lines. */
export interface IDotnetOutputChannel extends IDotnetDisposable {
	appendLine(value: string): void;
	show(preserveFocus?: boolean): void;
}

/** Injectable timer surface so the busy refresh is deterministic and disposable in tests. */
export interface IDotnetStatusTimers {
	setInterval(handler: () => void, intervalMs: number): IDotnetDisposable;
}

/** Narrow progress reporter mirroring `vscode.Progress`. */
export interface IDotnetProgress {
	report(value: { readonly message?: string }): void;
}

/** Narrow cancellation token mirroring `vscode.CancellationToken`. */
export interface IDotnetCancellationToken {
	readonly isCancellationRequested: boolean;
	onCancellationRequested(listener: () => void): () => void;
}

/** Narrow `vscode` surface used by the local status/output/progress presenter. */
export interface IDotnetStatusHost {
	readonly t: IDotnetLocalizer;
	createStatusBarItem(): IDotnetStatusBarItem;
	createOutputChannel(name: string): IDotnetOutputChannel;
	readonly timers: IDotnetStatusTimers;
	showQuickPick<T extends IDotnetQuickPickItem>(items: readonly T[], options: { readonly placeHolder: string; readonly ignoreFocusOut: boolean }): Promise<T | undefined>;
	showErrorMessage(message: string): Promise<unknown>;
	withProgress<T>(title: string, task: (progress: IDotnetProgress, cancellation: IDotnetCancellationToken) => Promise<T>): Promise<T>;
}

/**
 * Controller surface the presenter drives. The extension supplies the real installer controller, or
 * a constant `unavailable` source when the running host cannot provide local setup.
 */
export interface IDotnetToolchainStateSource {
	/** Immediate snapshot; it never starts or waits for work. */
	getSnapshot(): IDotnetToolchainSnapshot;
	/** Coalesced fresh detection; reads state and never writes. */
	recheck(): Promise<IDotnetToolchainSnapshot>;
	/** Explicit chooser plus install pipeline; resolves with the terminal snapshot. */
	setup(request?: IDotnetSetupRequest): Promise<IDotnetToolchainSnapshot>;
	dispose(): void;
}

/** Presenter construction inputs. */
export interface IDotnetStatusControllerOptions {
	readonly host: IDotnetStatusHost;
	readonly source: IDotnetToolchainStateSource;
	/** Busy/progress refresh period; defaults to {@link DEFAULT_DOTNET_STATUS_REFRESH_MS}. */
	readonly refreshIntervalMs?: number;
}

/** Local presenter owned by the extension activation. */
export interface IDotnetStatusController extends IDotnetDisposable, IToolchainUi {
	/** Presents one snapshot on the status item, logs transitions, and re-arms busy refresh. */
	update(snapshot: IDotnetToolchainSnapshot): void;
	showOutput(): void;
	showActions(): Promise<void>;
	/** Runs setup under a cancellable progress notification; arguments are forwarded verbatim. */
	runSetup(externalArguments?: readonly unknown[]): Promise<IDotnetToolchainSnapshot>;
}

/** Default busy/progress refresh period; polling reads state, never repeated filesystem probes. */
export const DEFAULT_DOTNET_STATUS_REFRESH_MS = 1000;

/** Localized status-bar labels per state; only `ready` carries the verified version. */
const STATUS_LABELS: Readonly<Record<DotnetToolchainState, string>> = {
	checking: '$(sync~spin) .NET SDK: Checking…',
	ready: '$(check) .NET SDK {0}',
	runtimeOnly: '$(warning) .NET SDK: Runtime Only',
	missing: '$(circle-slash) .NET SDK: Not Installed',
	installing: '$(sync~spin) .NET SDK: Installing…',
	verifying: '$(sync~spin) .NET SDK: Verifying…',
	failed: '$(error) .NET SDK: Setup Failed',
	unavailable: '$(circle-slash) .NET SDK: Unavailable Here',
};

/** Localized progress-phase names embedded in tooltips and output. */
const PROGRESS_LABELS: Readonly<Record<DotnetToolchainProgressPhase, string>> = {
	preparing: 'preparing',
	downloading: 'downloading',
	installing: 'installing',
	verifying: 'verifying',
	finalizing: 'finalizing',
};

/** Localized failure-stage names embedded in tooltips and output. */
const STAGE_LABELS: Readonly<Record<DotnetToolchainFailureStage, string>> = {
	detect: 'detection',
	download: 'download',
	process: 'installation',
	publish: 'publication',
	verify: 'verification',
	recovery: 'recovery',
};

/** Actions applicable to each state; busy and unavailable states stay read-only. */
const STATE_ACTIONS: Readonly<Record<DotnetToolchainState, readonly DotnetToolchainActionId[]>> = {
	checking: ['showOutput'],
	ready: ['setup', 'recheck', 'showOutput'],
	runtimeOnly: ['setup', 'recheck', 'showOutput'],
	missing: ['setup', 'recheck', 'showOutput'],
	installing: ['showOutput'],
	verifying: ['showOutput'],
	failed: ['setup', 'recheck', 'showOutput'],
	unavailable: ['showOutput'],
};

/** Localized action labels and descriptions for the status actions menu. */
const ACTION_LABELS: Readonly<Record<DotnetToolchainActionId, { readonly label: string; readonly description: string }>> = {
	setup: { label: 'Set Up Local .NET SDK…', description: 'Choose LTS, STS, or an exact version' },
	recheck: { label: 'Check Again', description: 'Re-detect the local .NET SDK' },
	showOutput: { label: 'Show Output', description: 'Open the .NET Toolchain output' },
};

/** True while another Walker window owns an active install operation. */
function isForeignOperation(snapshot: IDotnetToolchainSnapshot): boolean {
	return (snapshot.state === 'installing' || snapshot.state === 'verifying') && snapshot.progress?.otherWindow === true;
}

/** Localized stage name and stable code suffix shared by tooltips and output lines. */
function failureParts(snapshot: IDotnetToolchainSnapshot, t: IDotnetLocalizer): { readonly stage: string; readonly codeSuffix: string } {
	return {
		stage: t(STAGE_LABELS[snapshot.failure?.stage ?? 'detect']),
		codeSuffix: snapshot.failure?.code === undefined ? '' : ` (${snapshot.failure.code})`,
	};
}

/** Builds the localized status-bar label for one snapshot. */
function statusLabel(snapshot: IDotnetToolchainSnapshot, t: IDotnetLocalizer): string {
	if (isForeignOperation(snapshot)) {
		return t(snapshot.state === 'installing' ? '$(sync~spin) .NET SDK: Installing in another window…' : '$(sync~spin) .NET SDK: Verifying in another window…');
	}
	return t(STATUS_LABELS[snapshot.state], snapshot.verified?.sdkVersion ?? '');
}

/** Builds localized plain-text tooltip lines; verified detail is never fabricated. */
function tooltipLines(snapshot: IDotnetToolchainSnapshot, t: IDotnetLocalizer): readonly string[] {
	switch (snapshot.state) {
		case 'checking':
			return [t('Checking the local .NET SDK. Readiness always describes this local machine.')];
		case 'ready':
			return [
				t('Local .NET SDK {0}', snapshot.verified?.sdkVersion ?? ''),
				t('Executable: {0}', snapshot.verified?.executable ?? ''),
				t('Readiness describes this local machine.'),
			];
		case 'runtimeOnly':
			return [t('A .NET runtime is present, but no usable SDK was verified. Set up a local .NET SDK to enable SDK features.')];
		case 'missing':
			return [t('No local .NET SDK was found. Set up a local .NET SDK for this machine.')];
		case 'installing':
			return [t('Installing the local .NET SDK ({0}).', t(PROGRESS_LABELS[snapshot.progress?.phase ?? 'preparing']))];
		case 'verifying':
			return [t('Verifying the local .NET SDK ({0}).', t(PROGRESS_LABELS[snapshot.progress?.phase ?? 'verifying']))];
		case 'failed': {
			const parts = failureParts(snapshot, t);
			return [t('Setup failed during {0}{1}. See the .NET Toolchain output for details and a safe retry.', parts.stage, parts.codeSuffix)];
		}
		case 'unavailable':
			return [t('Local .NET SDK setup is unavailable in this window. It requires desktop Walker with a local user-interface extension host.')];
	}
}

/** Builds one localized plain-text output line describing a state transition. */
function transitionLine(snapshot: IDotnetToolchainSnapshot, t: IDotnetLocalizer): string {
	switch (snapshot.state) {
		case 'checking':
			return t('Checking the local .NET SDK…');
		case 'ready':
			return t('Local .NET SDK {0} at {1}', snapshot.verified?.sdkVersion ?? '', snapshot.verified?.executable ?? '');
		case 'runtimeOnly':
			return t('A .NET runtime is present, but no usable SDK was verified.');
		case 'missing':
			return t('No local .NET SDK was found.');
		case 'installing':
			return snapshot.progress?.otherWindow === true
				? t('Another Walker window is installing the local .NET SDK ({0}).', t(PROGRESS_LABELS[snapshot.progress?.phase ?? 'preparing']))
				: t('Installing the local .NET SDK ({0}).', t(PROGRESS_LABELS[snapshot.progress?.phase ?? 'preparing']));
		case 'verifying':
			return snapshot.progress?.otherWindow === true
				? t('Another Walker window is verifying the local .NET SDK ({0}).', t(PROGRESS_LABELS[snapshot.progress?.phase ?? 'verifying']))
				: t('Verifying the local .NET SDK ({0}).', t(PROGRESS_LABELS[snapshot.progress?.phase ?? 'verifying']));
		case 'failed': {
			const parts = failureParts(snapshot, t);
			return t('Setup failed during {0}{1}.', parts.stage, parts.codeSuffix);
		}
		case 'unavailable':
			return t('Local .NET SDK setup is unavailable in this window.');
	}
}

/** Localized progress-notification message for the current controller phase. */
function progressMessage(snapshot: IDotnetToolchainSnapshot, t: IDotnetLocalizer): string {
	switch (snapshot.state) {
		case 'installing':
			return t('Installing the local .NET SDK…');
		case 'verifying':
			return t('Verifying the local .NET SDK…');
		case 'checking':
			return t('Checking the local .NET SDK…');
		default:
			return t('Setting Up the Local .NET SDK');
	}
}

/**
 * Creates the local presenter: a status item with a localized label, a plain-text tooltip, the
 * actions command, one output line per revision, a cancellable progress notification during setup,
 * and a bounded read-only refresh while another window owns the lock. Every owned surface is
 * disposed together; the presenter never writes toolchain state and never fabricates readiness.
 */
export function createDotnetStatusController(options: IDotnetStatusControllerOptions): IDotnetStatusController {
	const { host, source } = options;
	const refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_DOTNET_STATUS_REFRESH_MS;
	const statusItem = host.createStatusBarItem();
	const output = host.createOutputChannel('.NET Toolchain');
	let snapshot = source.getSnapshot();
	let disposed = false;
	let operationActive = false;
	let lastLoggedRevision = -1;
	let refresh: IDotnetDisposable | undefined;

	const clearRefresh = (): void => {
		refresh?.dispose();
		refresh = undefined;
	};

	const update = (next: IDotnetToolchainSnapshot): void => {
		if (disposed) {
			return;
		}
		snapshot = next;
		statusItem.text = statusLabel(next, host.t);
		statusItem.tooltip = { lines: tooltipLines(next, host.t) };
		statusItem.command = DOTNET_TOOLCHAIN_COMMANDS.showActions;
		statusItem.show();
		if (next.revision !== lastLoggedRevision) {
			lastLoggedRevision = next.revision;
			output.appendLine(transitionLine(next, host.t));
		}
		clearRefresh();
		if (!operationActive && isForeignOperation(next)) {
			refresh = host.timers.setInterval(() => {
				void source.recheck().then(updated => update(updated), () => clearRefresh());
			}, refreshIntervalMs);
		}
	};

	const showOutput = (): void => {
		output.show(false);
	};

	const runSetup = async (externalArguments?: readonly unknown[]): Promise<IDotnetToolchainSnapshot> => {
		if (disposed) {
			return snapshot;
		}
		return await host.withProgress(host.t('Setting Up the Local .NET SDK'), async (progress, cancellation) => {
			clearRefresh();
			operationActive = true;
			update(source.getSnapshot());
			const track = host.timers.setInterval(() => {
				if (disposed) {
					return;
				}
				const current = source.getSnapshot();
				if (current.revision !== snapshot.revision) {
					update(current);
				}
				progress.report({ message: progressMessage(current, host.t) });
			}, refreshIntervalMs);
			try {
				const terminal = await source.setup({
					cancellation,
					...(externalArguments === undefined ? {} : { externalArguments }),
				});
				update(terminal);
				return terminal;
			} finally {
				operationActive = false;
				track.dispose();
				update(source.getSnapshot());
			}
		});
	};

	const showActions = async (): Promise<void> => {
		if (disposed) {
			return;
		}
		update(source.getSnapshot());
		const items = STATE_ACTIONS[snapshot.state].map(action => ({
			id: action,
			label: host.t(ACTION_LABELS[action].label),
			description: host.t(ACTION_LABELS[action].description),
		}));
		const picked = await host.showQuickPick(items, { placeHolder: host.t('Select a .NET toolchain action'), ignoreFocusOut: true });
		if (picked === undefined || disposed) {
			return;
		}
		switch (picked.id) {
			case 'setup':
				await runSetup();
				return;
			case 'recheck':
				update(await source.recheck());
				return;
			case 'showOutput':
				showOutput();
				return;
		}
	};

	return {
		update,
		showOutput,
		showActions,
		runSetup,
		appendOutput: line => output.appendLine(line),
		showError: message => { void host.showErrorMessage(message); },
		dispose: () => {
			if (disposed) {
				return;
			}
			disposed = true;
			clearRefresh();
			statusItem.dispose();
			output.dispose();
		},
	};
}
