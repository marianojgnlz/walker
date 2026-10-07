/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import type { IStorageService } from '../../../../../platform/storage/common/storage.js';
import type { IWorkspaceContextService, IWorkspaceFoldersChangeEvent } from '../../../../../platform/workspace/common/workspace.js';
import {
	consumeDeferredGitInitialization,
	createDeferredGitInitialization,
	DEFERRED_GIT_INITIALIZATION_STORAGE_PREFIX,
	waitForWorkspaceFolder,
} from '../../browser/deferredGitInitialization.js';

function createStorage(): { readonly service: IStorageService; readonly values: Map<string, string>; readonly flushes: number[]; setFlushError(error: Error | undefined): void } {
	const values = new Map<string, string>();
	const flushes: number[] = [];
	let flushError: Error | undefined;
	const service = {
		get: (key: string, _scope: unknown, fallback?: string) => values.get(key) ?? fallback,
		keys: () => [...values.keys()],
		store: (key: string, value: string | undefined) => {
			if (value === undefined) { values.delete(key); } else { values.set(key, value); }
		},
		remove: (key: string) => values.delete(key),
		flush: async () => { flushes.push(1); if (flushError) { throw flushError; } },
	} as unknown as IStorageService;
	return { service, values, flushes, setFlushError: error => { flushError = error; } };
}

suite('deferred project Git initialization', () => {
	test('persists an expiring, versioned intent and cancels only its own record', async () => {
		const storage = createStorage();
		const folder = URI.file('/projects/Catalog');
		const deferred = await createDeferredGitInitialization(storage.service, folder, 1000);

		assert.deepStrictEqual([...storage.values.keys()], [`${DEFERRED_GIT_INITIALIZATION_STORAGE_PREFIX}${deferred.id}`]);
		const payload = JSON.parse(storage.values.get([...storage.values.keys()][0])!);
		assert.deepStrictEqual([payload.schemaVersion, payload.operation, payload.folder, payload.expiresAt], [1, 'initializeGit', folder.toString(), 1000 + 10 * 60 * 1000]);
		assert.deepStrictEqual(storage.flushes, [1]);

		await deferred.cancel();
		assert.strictEqual(storage.values.size, 0);
		assert.deepStrictEqual(storage.flushes, [1, 1]);
	});

	test('clears a partially persisted intent when storage flush fails', async () => {
		const storage = createStorage();
		storage.setFlushError(new Error('database unavailable'));
		await assert.rejects(createDeferredGitInitialization(storage.service, URI.file('/projects/Catalog'), 1000), /database unavailable/);
		assert.strictEqual(storage.values.size, 0);
		assert.deepStrictEqual(storage.flushes, [1, 1]);
	});

	test('consumes only a matching local folder intent and removes it before running Git once', async () => {
		const storage = createStorage();
		const folder = URI.file('/projects/Catalog');
		await createDeferredGitInitialization(storage.service, folder, 1000);
		let initialized = 0;

		assert.strictEqual(await consumeDeferredGitInitialization(storage.service, URI.file('/projects/Other'), async () => { initialized++; }, 2000), false);
		assert.strictEqual(initialized, 0);
		assert.strictEqual(await consumeDeferredGitInitialization(storage.service, folder, async () => {
			assert.strictEqual(storage.values.size, 0, 'the one-shot intent is cleared before Git can prompt or fail');
			initialized++;
		}, 2000), true);
		assert.strictEqual(await consumeDeferredGitInitialization(storage.service, folder, async () => { initialized++; }, 2000), false);
		assert.strictEqual(initialized, 1);
	});

	test('expires stale and malformed records without running their operation', async () => {
		const storage = createStorage();
		await createDeferredGitInitialization(storage.service, URI.file('/projects/Catalog'), 1000);
		storage.values.set(`${DEFERRED_GIT_INITIALIZATION_STORAGE_PREFIX}malformed`, '{');
		let initialized = false;

		assert.strictEqual(await consumeDeferredGitInitialization(storage.service, URI.file('/projects/Catalog'), async () => { initialized = true; }, 1000 + 10 * 60 * 1000), false);
		assert.strictEqual(initialized, false);
		assert.strictEqual(storage.values.size, 0);
	});

	test('rejects non-local project targets', async () => {
		const storage = createStorage();
		await assert.rejects(createDeferredGitInitialization(storage.service, URI.parse('vscode-remote://host/projects/Catalog'), 1000), /local folder/);
		assert.strictEqual(storage.values.size, 0);
	});

	test('waits for the requested folder to become the active workspace', async () => {
		const changes = new Emitter<IWorkspaceFoldersChangeEvent>();
		let current = false;
		const context = {
			isCurrentWorkspace: () => current,
			onDidChangeWorkbenchState: Event.None,
			onDidChangeWorkspaceFolders: changes.event,
		} as unknown as IWorkspaceContextService;
		const folder = URI.file('/projects/Catalog');
		const waiting = waitForWorkspaceFolder(context, folder, 100);
		current = true;
		changes.fire({} as IWorkspaceFoldersChangeEvent);
		await waiting;
		changes.dispose();
	});

	test('times out rather than initializing Git in a different workspace', async () => {
		const changes = new Emitter<IWorkspaceFoldersChangeEvent>();
		const context = {
			isCurrentWorkspace: () => false,
			onDidChangeWorkbenchState: Event.None,
			onDidChangeWorkspaceFolders: changes.event,
		} as unknown as IWorkspaceContextService;
		await assert.rejects(waitForWorkspaceFolder(context, URI.file('/projects/Catalog'), 1), /did not become the active workspace/);
		changes.dispose();
	});
});
