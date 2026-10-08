/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { createSolutionNavigationController, SOLUTION_EXPLORER_COMMANDS, type ISolutionNavigationHost } from '../navigation';

interface IHostHarness extends ISolutionNavigationHost {
	readonly handlers: Map<string, (...args: readonly unknown[]) => Promise<boolean>>;
	readonly opened: string[];
	readonly disposedRegistrations: string[];
}

function createHost(overrides: Partial<Pick<ISolutionNavigationHost, 'uiKind' | 'extensionKind' | 'remoteName'>> = {}): IHostHarness {
	const handlers = new Map<string, (...args: readonly unknown[]) => Promise<boolean>>();
	const opened: string[] = [];
	const disposedRegistrations: string[] = [];
	return {
		uiKind: overrides.uiKind ?? 'desktop',
		extensionKind: overrides.extensionKind ?? 'ui',
		remoteName: overrides.remoteName,
		handlers,
		opened,
		disposedRegistrations,
		registerCommand: (id, handler) => {
			handlers.set(id, handler);
			return { dispose: () => { disposedRegistrations.push(id); handlers.delete(id); } };
		},
		openDocument: async uri => { opened.push(uri); },
	};
}

suite('solution navigation locality', () => {
	test('opens local document targets through the normal editor command boundary', async () => {
		const host = createHost();
		const navigation = createSolutionNavigationController(host);
		assert.deepStrictEqual([...host.handlers.keys()].sort(), [SOLUTION_EXPLORER_COMMANDS.open, SOLUTION_EXPLORER_COMMANDS.openExternal].sort());
		const opened = await host.handlers.get(SOLUTION_EXPLORER_COMMANDS.open)!({ kind: 'file', resourceUri: 'file:///workspace/App.cs', navigable: true });
		assert.strictEqual(opened, true);
		assert.deepStrictEqual(host.opened, ['file:///workspace/App.cs']);
		navigation.dispose();
	});

	test('blocks display-only external references on ordinary open and opens them only through the explicit action', async () => {
		const host = createHost();
		const navigation = createSolutionNavigationController(host);
		const external = { kind: 'dependency', resourceUri: 'file:///outside/Shared.csproj', displayOnly: true, navigable: false };
		assert.strictEqual(await host.handlers.get(SOLUTION_EXPLORER_COMMANDS.open)!(external), false);
		assert.deepStrictEqual(host.opened, [], 'ordinary tree activation must not open display-only references');
		assert.strictEqual(await host.handlers.get(SOLUTION_EXPLORER_COMMANDS.openExternal)!(external), true);
		assert.deepStrictEqual(host.opened, ['file:///outside/Shared.csproj'], 'explicit opening delegates directly to the document API without probing the target');
		navigation.dispose();
	});

	test('rejects browser, remote, virtual, malformed and non-navigable targets without filesystem probes', async () => {
		const cases = [
			{ host: createHost({ uiKind: 'web' }), target: { kind: 'file', resourceUri: 'file:///workspace/a.cs' } },
			{ host: createHost({ extensionKind: 'workspace' }), target: { kind: 'file', resourceUri: 'file:///workspace/a.cs' } },
			{ host: createHost({ remoteName: 'ssh-remote' }), target: { kind: 'file', resourceUri: 'file:///workspace/a.cs' } },
			{ host: createHost(), target: { kind: 'file', resourceUri: 'vscode-remote://ssh-remote/workspace/a.cs' } },
			{ host: createHost(), target: { kind: 'dependency', resourceUri: 'file:///workspace/pkg', navigable: false } },
			{ host: createHost(), target: { kind: 'diagnostic', resourceUri: 'file:///workspace/a.cs' } },
		] as const;
		for (const entry of cases) {
			const navigation = createSolutionNavigationController(entry.host);
			assert.strictEqual(await entry.host.handlers.get(SOLUTION_EXPLORER_COMMANDS.open)!(entry.target), false);
			assert.strictEqual(await entry.host.handlers.get(SOLUTION_EXPLORER_COMMANDS.openExternal)!(entry.target), false);
			assert.deepStrictEqual(entry.host.opened, []);
			navigation.dispose();
		}
	});

	test('disposes both command registrations idempotently', () => {
		const host = createHost();
		const navigation = createSolutionNavigationController(host);
		navigation.dispose();
		navigation.dispose();
		assert.deepStrictEqual(host.disposedRegistrations.sort(), [SOLUTION_EXPLORER_COMMANDS.open, SOLUTION_EXPLORER_COMMANDS.openExternal].sort());
		assert.strictEqual(host.handlers.size, 0);
	});
});
