/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { createGraphWatcherStore, GRAPH_WATCHER_DEBOUNCE_MS, GRAPH_WATCHER_PATTERNS, type IGraphFileWatcher, type IGraphWatcherHost, type IGraphWatcherScheduler } from '../graphWatcher';
import type { IWorkspaceGraph } from '../model';

class TestWatcher implements IGraphFileWatcher {
	private readonly listeners = new Map<'create' | 'change' | 'delete', Set<(uri: string) => void>>([
		['create', new Set()], ['change', new Set()], ['delete', new Set()],
	]);
	isDisposed = false;
	activeListeners = 0;

	onDidCreate(listener: (uri: string) => void) { return this.listen('create', listener); }
	onDidChange(listener: (uri: string) => void) { return this.listen('change', listener); }
	onDidDelete(listener: (uri: string) => void) { return this.listen('delete', listener); }

	fire(kind: 'create' | 'change' | 'delete', uri: string): void {
		for (const listener of this.listeners.get(kind) ?? []) { listener(uri); }
	}

	dispose(): void { this.isDisposed = true; }

	private listen(kind: 'create' | 'change' | 'delete', listener: (uri: string) => void) {
		const listeners = this.listeners.get(kind)!;
		listeners.add(listener);
		this.activeListeners++;
		return { dispose: () => { if (listeners.delete(listener)) { this.activeListeners--; } } };
	}
}

class TestScheduler implements IGraphWatcherScheduler {
	private current = 0;
	private nextId = 0;
	private readonly timers = new Map<number, { readonly due: number; readonly callback: () => void }>();
	setTimeout(callback: () => void, delayMs: number): unknown {
		const id = ++this.nextId;
		this.timers.set(id, { due: this.current + delayMs, callback });
		return id;
	}
	clearTimeout(handle: unknown): void { this.timers.delete(handle as number); }
	get activeTimers(): number { return this.timers.size; }
	advance(milliseconds: number): void {
		this.current += milliseconds;
		while (true) {
			const due = [...this.timers.entries()].filter(([, timer]) => timer.due <= this.current).sort((left, right) => left[1].due - right[1].due)[0];
			if (!due) { return; }
			this.timers.delete(due[0]);
			due[1].callback();
		}
	}
}

class TestHost implements IGraphWatcherHost {
	readonly patterns: string[] = [];
	readonly watchers: TestWatcher[] = [];
	readonly rootListeners = new Set<(uris: readonly string[], paths: readonly string[]) => void>();
	createFileSystemWatcher(pattern: string): IGraphFileWatcher {
		this.patterns.push(pattern);
		const watcher = new TestWatcher();
		this.watchers.push(watcher);
		return watcher;
	}
	onDidChangeWorkspaceRoots(listener: (uris: readonly string[], paths: readonly string[]) => void) {
		this.rootListeners.add(listener);
		return { dispose: () => this.rootListeners.delete(listener) };
	}
	changeWorkspaceRoots(uris: readonly string[], paths: readonly string[]): void {
		for (const listener of this.rootListeners) { listener(uris, paths); }
	}
	get activeListeners(): number { return this.watchers.reduce((count, watcher) => count + watcher.activeListeners, 0); }
}

function graph(): IWorkspaceGraph {
	return {
		rootIds: ['workspace:root'],
		nodes: [
			{ id: 'workspace:root', kind: 'workspace', label: 'Workspace', resourceUri: 'file:///workspace', childIds: ['project:app'] },
			{ id: 'project:app', kind: 'project', label: 'App', resourceUri: 'file:///workspace/App/App.csproj', parentId: 'workspace:root', childIds: ['file:program'] },
			{ id: 'file:program', kind: 'file', label: 'Program.cs', resourceUri: 'file:///workspace/App/Program.cs', parentId: 'project:app', childIds: [] },
		],
		diagnostics: [],
	};
}

suite('solution graph watcher lifecycle', () => {
	test('watches metadata and relevant source files, coalescing affected-project refresh at 150 ms', () => {
		const host = new TestHost();
		const scheduler = new TestScheduler();
		const affected: string[][] = [];
		let fullRescans = 0;
		createGraphWatcherStore({
			host,
			getCurrentGraph: graph,
			refreshAffectedProjects: projects => { affected.push([...projects]); },
			fullRescan: () => { fullRescans++; },
			onWorkspaceRootsChanged: () => undefined,
			scheduler,
		});
		assert.deepStrictEqual(host.patterns, GRAPH_WATCHER_PATTERNS);
		assert.strictEqual(GRAPH_WATCHER_DEBOUNCE_MS, 150);
		const [metadata, source] = host.watchers;
		assert.ok(metadata);
		assert.ok(source);
		source.fire('change', 'file:///workspace/App/Program.cs');
		scheduler.advance(100);
		source.fire('change', 'file:///workspace/App/Program.cs');
		scheduler.advance(149);
		assert.deepStrictEqual(affected, []);
		scheduler.advance(1);
		assert.deepStrictEqual(affected, [['file:///workspace/App/App.csproj']]);
		assert.strictEqual(fullRescans, 0);
		metadata.fire('change', 'file:///workspace/App/App.csproj');
		scheduler.advance(150);
		assert.deepStrictEqual(affected[1], ['file:///workspace/App/App.csproj'], 'a later metadata event refreshes the same affected project without replacing watchers');
		assert.strictEqual(host.activeListeners, 6, 'repeated refreshes do not accumulate watcher listeners');
		metadata.fire('change', 'file:///workspace/App.sln');
		scheduler.advance(150);
		assert.strictEqual(fullRescans, 1, 'solution membership changes request a full bounded graph scan');
	});

	test('bounds the event queue at 256 and falls back to one full bounded rescan on overflow', () => {
		const host = new TestHost();
		const scheduler = new TestScheduler();
		let affectedCalls = 0;
		let fullRescans = 0;
		createGraphWatcherStore({
			host,
			getCurrentGraph: graph,
			refreshAffectedProjects: () => { affectedCalls++; },
			fullRescan: () => { fullRescans++; },
			onWorkspaceRootsChanged: () => undefined,
			scheduler,
		});
		const source = host.watchers[1];
		assert.ok(source);
		for (let index = 0; index < 257; index++) { source.fire('create', `file:///workspace/App/source-${index}.cs`); }
		assert.strictEqual(scheduler.activeTimers, 1, 'coalescing owns one debounce timer regardless of event volume');
		scheduler.advance(GRAPH_WATCHER_DEBOUNCE_MS);
		assert.strictEqual(affectedCalls, 0, 'overflow discards the partial dirty-project set');
		assert.strictEqual(fullRescans, 1);
	});

	test('replaces watchers on workspace changes and disposes listeners and queued work idempotently', () => {
		const host = new TestHost();
		const scheduler = new TestScheduler();
		const roots: string[][] = [];
		let affectedCalls = 0;
		const store = createGraphWatcherStore({
			host,
			getCurrentGraph: graph,
			refreshAffectedProjects: () => { affectedCalls++; },
			fullRescan: () => undefined,
			onWorkspaceRootsChanged: (_uris, paths) => roots.push([...paths]),
			scheduler,
		});
		const oldWatchers = [...host.watchers];
		assert.strictEqual(host.activeListeners, 6);
		host.changeWorkspaceRoots(['file:///workspace/next'], ['/workspace/next']);
		assert.ok(oldWatchers.every(watcher => watcher.isDisposed));
		assert.deepStrictEqual(roots, [['/workspace/next']]);
		assert.strictEqual(host.watchers.length, 4);
		assert.strictEqual(host.activeListeners, 6, 'replacement releases old listener registrations before adding the new set');
		oldWatchers[1]?.fire('change', 'file:///workspace/App/Program.cs');
		assert.strictEqual(scheduler.activeTimers, 0, 'disposed watcher callbacks cannot enqueue work');
		host.watchers[3]?.fire('change', 'file:///workspace/App/Program.cs');
		assert.strictEqual(scheduler.activeTimers, 1);
		store.dispose();
		store.dispose();
		assert.strictEqual(host.activeListeners, 0);
		assert.ok(host.watchers.every(watcher => watcher.isDisposed));
		assert.strictEqual(host.rootListeners.size, 0);
		assert.strictEqual(scheduler.activeTimers, 0);
		scheduler.advance(GRAPH_WATCHER_DEBOUNCE_MS);
		assert.strictEqual(affectedCalls, 0, 'deactivation cancels queued refresh work');
	});
});
