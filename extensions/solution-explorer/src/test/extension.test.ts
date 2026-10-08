/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import type * as vscode from 'vscode';
import { activateSolutionExplorer, CORE_CSHARP_CONFIGURE_COMMAND, SOLUTION_EXPLORER_CONFIGURE_COMMAND, SOLUTION_EXPLORER_VIEW_ID, type ISolutionExplorerDisposable, type ISolutionExplorerHost } from '../extension';
import type { ISolutionTreeEmitter } from '../treeProvider';

class TestEmitter<T> implements ISolutionTreeEmitter<T> {
	readonly fires: (T | undefined)[] = [];
	isDisposed = false;
	readonly event: vscode.Event<T | undefined> = () => ({ dispose: () => undefined });
	fire(value: T | undefined): void { this.fires.push(value); }
	dispose(): void { this.isDisposed = true; }
}

class TestDisposable implements ISolutionExplorerDisposable {
	isDisposed = false;
	dispose(): void { this.isDisposed = true; }
}

interface IHostHarness extends ISolutionExplorerHost {
	readonly commands: Map<string, (...args: unknown[]) => unknown>;
	readonly execution: { readonly command: string; readonly args: readonly unknown[] }[];
	readonly opened: string[];
	readonly views: string[];
	readonly emitters: TestEmitter<unknown>[];
	readonly registrations: TestDisposable[];
}

function createHost(overrides: Partial<Pick<ISolutionExplorerHost, 'uiKind' | 'extensionKind' | 'remoteName' | 'workspaceRootUris'>> = {}): IHostHarness {
	const commands = new Map<string, (...args: unknown[]) => unknown>();
	const execution: { readonly command: string; readonly args: readonly unknown[] }[] = [];
	const opened: string[] = [];
	const views: string[] = [];
	const emitters: TestEmitter<unknown>[] = [];
	const registrations: TestDisposable[] = [];
	return {
		uiKind: overrides.uiKind ?? 'desktop',
		extensionKind: overrides.extensionKind ?? 'ui',
		remoteName: overrides.remoteName,
		workspaceRootUris: overrides.workspaceRootUris ?? ['file:///workspace'],
		workspaceRootPaths: [],
		commands,
		execution,
		opened,
		views,
		emitters,
		registrations,
		collapsedState: 1 as vscode.TreeItemCollapsibleState,
		noneState: 0 as vscode.TreeItemCollapsibleState,
		createEventEmitter: <T>() => {
			const emitter = new TestEmitter<T>();
			emitters.push(emitter as TestEmitter<unknown>);
			return emitter;
		},
		createTreeItem: (label, collapsibleState) => ({ label, collapsibleState } as vscode.TreeItem),
		createThemeIcon: id => ({ id } as vscode.ThemeIcon),
		parseUri: value => ({ toString: () => value } as vscode.Uri),
		localize: (message, ...args) => `localized:${args.reduce((result, value, index) => result.replace(`{${index}}`, value), message)}`,
		createTreeView: (viewId, _provider) => {
			views.push(viewId);
			const disposable = new TestDisposable();
			registrations.push(disposable);
			return disposable;
		},
		registerCommand: (id, handler) => {
			commands.set(id, handler);
			const disposable = new TestDisposable();
			registrations.push(disposable);
			return { dispose: () => { disposable.dispose(); commands.delete(id); } };
		},
		executeCommand: async (command, ...args) => {
			execution.push({ command, args });
			return undefined;
		},
		openDocument: async uri => { opened.push(uri); },
	};
}

suite('solution-explorer activation', () => {
	test('activates the tree without language packages and forwards Configure to the core command', async () => {
		const host = createHost();
		const subscriptions: ISolutionExplorerDisposable[] = [];
		const extension = activateSolutionExplorer({ host, subscriptions });
		assert.deepStrictEqual(host.views, [SOLUTION_EXPLORER_VIEW_ID]);
		assert.deepStrictEqual([...host.commands.keys()].sort(), [
			'walker.solutionExplorer.open',
			'walker.solutionExplorer.openExternal',
			'walker.solutionExplorer.refresh',
			SOLUTION_EXPLORER_CONFIGURE_COMMAND,
		].sort());
		assert.strictEqual(await host.commands.get(SOLUTION_EXPLORER_CONFIGURE_COMMAND)?.(), undefined);
		assert.deepStrictEqual(host.execution, [{ command: CORE_CSHARP_CONFIGURE_COMMAND, args: [] }]);
		await host.commands.get('walker.solutionExplorer.refresh')?.();
		assert.ok((host.emitters[0]?.fires.length ?? 0) >= 1, 'refresh and the initial scan notify the tree view');
		assert.strictEqual((await extension.provider.getChildren()).length, 0);
		assert.strictEqual(subscriptions.length, 6, 'provider, view, navigation, graph controller and both local commands are owned immediately');
		extension.dispose();
		extension.dispose();
		assert.ok(host.registrations.every(disposable => disposable.isDisposed));
		assert.strictEqual(host.emitters[0]?.isDisposed, true);
		assert.strictEqual(host.commands.size, 0);
	});

	test('keeps a read-only local graph available without SDK or language-extension state', async () => {
		const host = createHost();
		const extension = activateSolutionExplorer({ host, subscriptions: [] });
		extension.provider.setGraph({
			rootIds: ['workspace:root'],
			nodes: [{ id: 'workspace:root', kind: 'workspace', label: 'Workspace', resourceUri: 'file:///workspace', childIds: [] }],
			diagnostics: [],
		});
		assert.deepStrictEqual((await extension.provider.getChildren()).map(element => element.id), ['workspace:root']);
		assert.deepStrictEqual(host.opened, []);
		extension.dispose();
	});

	test('shows unsupported locality without creating any filesystem access path', async () => {
		const host = createHost({ uiKind: 'web', workspaceRootUris: ['vscode-remote://authority/workspace'] });
		const extension = activateSolutionExplorer({ host, subscriptions: [] });
		const [status] = await extension.provider.getChildren();
		assert.ok(status);
		assert.strictEqual(extension.provider.getTreeItem(status).description, 'localized:Unsupported');
		assert.deepStrictEqual(host.opened, []);
		assert.deepStrictEqual(host.execution, []);
		extension.dispose();
	});
});
