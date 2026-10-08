/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import { createSolutionNavigationController, SOLUTION_EXPLORER_COMMANDS, type ISolutionNavigationDisposable } from './navigation';
import type { IGraphController } from './graphController';
import type { IGraphWatcherHost } from './graphWatcher';
import { SolutionTreeProvider, type ISolutionTreeProviderHost } from './treeProvider';

export const SOLUTION_EXPLORER_VIEW_ID = 'walkerSolutionExplorer';
export const SOLUTION_EXPLORER_CONFIGURE_COMMAND = SOLUTION_EXPLORER_COMMANDS.configureEditing;
export const CORE_CSHARP_CONFIGURE_COMMAND = 'walker.csharp.configureEditing';

export interface ISolutionExplorerDisposable {
	dispose(): void;
}

/** Injected extension-host boundary for the view, commands, and standard editor navigation. */
export interface ISolutionExplorerHost extends ISolutionTreeProviderHost {
	readonly graphWatcherHost?: IGraphWatcherHost;
	readonly uiKind: 'desktop' | 'web';
	readonly extensionKind: 'ui' | 'workspace' | undefined;
	readonly remoteName: string | undefined;
	readonly workspaceRootUris: readonly string[];
	readonly workspaceRootPaths: readonly string[];
	createTreeView(viewId: string, provider: SolutionTreeProvider): ISolutionExplorerDisposable;
	registerCommand(id: string, handler: (...args: unknown[]) => unknown): ISolutionExplorerDisposable;
	executeCommand(id: string, ...args: readonly unknown[]): Promise<unknown>;
	openDocument(resourceUri: string): Promise<void>;
}

export interface ISolutionExplorerActivationOptions {
	readonly host: ISolutionExplorerHost;
	readonly subscriptions: ISolutionExplorerDisposable[];
}

export interface ISolutionExplorerExtension extends ISolutionExplorerDisposable {
	readonly provider: SolutionTreeProvider;
	readonly graphController?: IGraphController;
}

function hasOnlyUnsupportedRoots(rootUris: readonly string[]): boolean {
	return rootUris.length > 0 && rootUris.every(uri => {
		try {
			const parsed = new URL(uri);
			return parsed.protocol !== 'file:' || (parsed.hostname !== '' && parsed.hostname.toLowerCase() !== 'localhost');
		} catch {
			return true;
		}
	});
}

/** Composes the view without querying language extensions, SDK state, or filesystem contents. */
export function activateSolutionExplorer(options: ISolutionExplorerActivationOptions): ISolutionExplorerExtension {
	const { host, subscriptions } = options;
	const owned: ISolutionExplorerDisposable[] = [];
	let disposed = false;
	const own = <T extends ISolutionExplorerDisposable>(disposable: T): T => {
		owned.push(disposable);
		subscriptions.push(disposable);
		return disposable;
	};

	const provider = own(new SolutionTreeProvider(host));
	own(host.createTreeView(SOLUTION_EXPLORER_VIEW_ID, provider));
	const navigation: ISolutionNavigationDisposable = createSolutionNavigationController({
		uiKind: host.uiKind,
		extensionKind: host.extensionKind,
		remoteName: host.remoteName,
		registerCommand: (id, handler) => host.registerCommand(id, (...args: unknown[]) => handler(...args)),
		openDocument: resourceUri => host.openDocument(resourceUri),
	});
	own(navigation);
	let graphController: IGraphController | undefined;
	if (host.uiKind !== 'desktop' || host.extensionKind !== 'ui' || host.remoteName !== undefined) {
		provider.setUnsupported('Solution Explorer requires a local desktop extension host.');
	} else if (hasOnlyUnsupportedRoots(host.workspaceRootUris)) {
		provider.setUnsupported('Solution Explorer supports local file workspaces only.');
	} else {
		const graphModules = require('./graphController') as typeof import('./graphController');
		graphController = own(graphModules.createGraphController({
			workspaceRoots: host.workspaceRootPaths,
			scan: graphModules.createWorkspaceGraphScanner().scan,
			publish: graph => provider.setGraph(graph),
		}));
		if (host.graphWatcherHost) {
			const watcherModules = require('./graphWatcher') as typeof import('./graphWatcher');
			own(watcherModules.createGraphWatcherStore({
				host: host.graphWatcherHost,
				getCurrentGraph: () => graphController?.getCurrentGraph(),
				refreshAffectedProjects: projectUris => {
					for (const projectUri of projectUris) { graphController?.invalidate(projectUri); }
					return graphController?.refresh();
				},
				fullRescan: () => graphController?.refresh(),
				onWorkspaceRootsChanged: (_rootUris, rootPaths) => { if (graphController) { void graphController.setWorkspaceRoots(rootPaths); } },
			}));
		}
		void graphController.refresh();
	}
	own(host.registerCommand(SOLUTION_EXPLORER_COMMANDS.refresh, () => {
		if (disposed) { return; }
		if (graphController) { return graphController.refresh(); }
		provider.refresh();
		return undefined;
	}));
	own(host.registerCommand(SOLUTION_EXPLORER_CONFIGURE_COMMAND, () => {
		if (disposed) { return undefined; }
		return host.executeCommand(CORE_CSHARP_CONFIGURE_COMMAND);
	}));

	return {
		provider,
		...(graphController === undefined ? {} : { graphController }),
		dispose: () => {
			if (disposed) { return; }
			disposed = true;
			for (const disposable of [...owned].reverse()) { disposable.dispose(); }
		},
	};
}

/** Creates the real extension host adapter lazily so package and behavior tests run in plain Node. */
export function createVscodeSolutionExplorerHost(vscodeApi: typeof import('vscode'), extensionKind: 'ui' | 'workspace' | undefined): ISolutionExplorerHost {
	return {
		get uiKind() { return vscodeApi.env.uiKind === vscodeApi.UIKind.Web ? 'web' : 'desktop'; },
		extensionKind,
		get remoteName() { return vscodeApi.env.remoteName; },
		get workspaceRootUris() { return vscodeApi.workspace.workspaceFolders?.map(folder => folder.uri.toString()) ?? []; },
		get workspaceRootPaths() { return vscodeApi.workspace.workspaceFolders?.filter(folder => folder.uri.scheme === 'file' && (folder.uri.authority === '' || folder.uri.authority.toLowerCase() === 'localhost')).map(folder => folder.uri.fsPath) ?? []; },
		collapsedState: vscodeApi.TreeItemCollapsibleState.Collapsed,
		noneState: vscodeApi.TreeItemCollapsibleState.None,
		createEventEmitter: <T>() => new vscodeApi.EventEmitter<T | undefined>(),
		createTreeItem: (label, collapsibleState) => new vscodeApi.TreeItem(label, collapsibleState),
		createThemeIcon: id => new vscodeApi.ThemeIcon(id),
		parseUri: value => vscodeApi.Uri.parse(value),
		localize: (message, ...args) => vscodeApi.l10n.t(message, ...args),
		createTreeView: (viewId, provider) => vscodeApi.window.createTreeView(viewId, { treeDataProvider: provider }),
		graphWatcherHost: {
			createFileSystemWatcher: pattern => {
				const watcher = vscodeApi.workspace.createFileSystemWatcher(pattern);
				return {
					onDidCreate: listener => watcher.onDidCreate(uri => listener(uri.toString())),
					onDidChange: listener => watcher.onDidChange(uri => listener(uri.toString())),
					onDidDelete: listener => watcher.onDidDelete(uri => listener(uri.toString())),
					dispose: () => watcher.dispose(),
				};
			},
			onDidChangeWorkspaceRoots: listener => vscodeApi.workspace.onDidChangeWorkspaceFolders(() => {
				const folders = vscodeApi.workspace.workspaceFolders ?? [];
				listener(
					folders.map(folder => folder.uri.toString()),
					folders.filter(folder => folder.uri.scheme === 'file' && (folder.uri.authority === '' || folder.uri.authority.toLowerCase() === 'localhost')).map(folder => folder.uri.fsPath),
				);
			}),
		},
		registerCommand: (id, handler) => vscodeApi.commands.registerCommand(id, handler),
		executeCommand: async (id, ...args) => await vscodeApi.commands.executeCommand(id, ...args),
		openDocument: async resourceUri => { await vscodeApi.commands.executeCommand('vscode.open', vscodeApi.Uri.parse(resourceUri)); },
	};
}

/** Extension entry point; tree availability is independent of C# and toolchain package activation. */
export function activate(context: vscode.ExtensionContext): void {
	const vscodeApi = require('vscode') as typeof import('vscode');
	const extensionKind = context.extension.extensionKind === vscodeApi.ExtensionKind.UI
		? 'ui'
		: context.extension.extensionKind === vscodeApi.ExtensionKind.Workspace ? 'workspace' : undefined;
	activateSolutionExplorer({
		host: createVscodeSolutionExplorerHost(vscodeApi, extensionKind),
		subscriptions: context.subscriptions,
	});
}
