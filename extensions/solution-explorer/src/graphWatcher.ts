/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IGraphNode, IWorkspaceGraph } from './model';

export interface IGraphFileWatcher {
	onDidCreate(listener: (resourceUri: string) => void): { dispose(): void };
	onDidChange(listener: (resourceUri: string) => void): { dispose(): void };
	onDidDelete(listener: (resourceUri: string) => void): { dispose(): void };
	dispose(): void;
}

export interface IGraphWatcherHost {
	createFileSystemWatcher(pattern: string): IGraphFileWatcher;
	onDidChangeWorkspaceRoots(listener: (rootUris: readonly string[], rootPaths: readonly string[]) => void): { dispose(): void };
}

export interface IGraphWatcherScheduler {
	setTimeout(callback: () => void, delayMs: number): unknown;
	clearTimeout(handle: unknown): void;
}

export interface IGraphWatcherStoreOptions {
	readonly host: IGraphWatcherHost;
	readonly getCurrentGraph: () => IWorkspaceGraph | undefined;
	readonly refreshAffectedProjects: (projectUris: readonly string[]) => void | Promise<void>;
	readonly fullRescan: () => void | Promise<void>;
	readonly onWorkspaceRootsChanged: (rootUris: readonly string[], rootPaths: readonly string[]) => void;
	readonly scheduler?: IGraphWatcherScheduler;
}

export interface IGraphWatcherStore {
	dispose(): void;
}

export const GRAPH_WATCHER_DEBOUNCE_MS = 150;
export const GRAPH_WATCHER_MAX_QUEUED_EVENTS = 256;
export const GRAPH_WATCHER_PATTERNS = ['**/*.{sln,slnx,csproj,props,targets}', '**/*.{cs,csx,razor,cshtml}'] as const;

const defaultScheduler: IGraphWatcherScheduler = {
	setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
	clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Owns bounded watcher registrations and coalesces local metadata/source changes. */
export function createGraphWatcherStore(options: IGraphWatcherStoreOptions): IGraphWatcherStore {
	const scheduler = options.scheduler ?? defaultScheduler;
	const queuedUris = new Set<string>();
	let overflow = false;
	let timer: unknown;
	let disposed = false;
	let watcherDisposables: { dispose(): void }[] = [];

	const clearQueuedEvents = (): void => {
		if (timer !== undefined) { scheduler.clearTimeout(timer); timer = undefined; }
		queuedUris.clear();
		overflow = false;
	};
	const scheduleFlush = (): void => {
		if (timer !== undefined) { scheduler.clearTimeout(timer); }
		timer = scheduler.setTimeout(flush, GRAPH_WATCHER_DEBOUNCE_MS);
	};
	const enqueue = (resourceUri: string): void => {
		if (disposed || !isLocalFileUri(resourceUri)) { return; }
		if (!queuedUris.has(resourceUri)) {
			if (queuedUris.size >= GRAPH_WATCHER_MAX_QUEUED_EVENTS) { overflow = true; }
			else { queuedUris.add(resourceUri); }
		}
		scheduleFlush();
	};
	const flush = (): void => {
		timer = undefined;
		if (disposed || queuedUris.size === 0) { return; }
		const events = [...queuedUris];
		const requiresFullRescan = overflow || events.some(requiresWorkspaceRescan);
		clearQueuedEvents();
		if (requiresFullRescan) { void options.fullRescan(); return; }
		const affectedProjects = resolveAffectedProjects(events, options.getCurrentGraph());
		if (!affectedProjects || affectedProjects.length === 0) { void options.fullRescan(); return; }
		void options.refreshAffectedProjects(affectedProjects);
	};
	const replaceWatchers = (): void => {
		clearQueuedEvents();
		for (const disposable of watcherDisposables.reverse()) { disposable.dispose(); }
		watcherDisposables = [];
		for (const pattern of GRAPH_WATCHER_PATTERNS) {
			const watcher = options.host.createFileSystemWatcher(pattern);
			const listeners = [watcher.onDidCreate(enqueue), watcher.onDidChange(enqueue), watcher.onDidDelete(enqueue)];
			watcherDisposables.push({ dispose: () => {
				for (const listener of listeners.reverse()) { listener.dispose(); }
				watcher.dispose();
			} });
		}
	};
	const workspaceRoots = options.host.onDidChangeWorkspaceRoots((rootUris, rootPaths) => {
		if (disposed) { return; }
		replaceWatchers();
		options.onWorkspaceRootsChanged(rootUris, rootPaths);
	});
	replaceWatchers();

	return {
		dispose: () => {
			if (disposed) { return; }
			disposed = true;
			clearQueuedEvents();
			for (const disposable of watcherDisposables.reverse()) { disposable.dispose(); }
			watcherDisposables = [];
			workspaceRoots.dispose();
		},
	};
}

function isLocalFileUri(resourceUri: string): boolean {
	try {
		const uri = new URL(resourceUri);
		return uri.protocol === 'file:' && (uri.hostname === '' || uri.hostname.toLowerCase() === 'localhost');
	} catch {
		return false;
	}
}

function requiresWorkspaceRescan(resourceUri: string): boolean {
	try {
		const extension = path.extname(fileURLToPath(new URL(resourceUri))).toLowerCase();
		return extension === '.sln' || extension === '.slnx' || extension === '.props' || extension === '.targets';
	} catch {
		return true;
	}
}

function resolveAffectedProjects(resourceUris: readonly string[], graph: IWorkspaceGraph | undefined): string[] | undefined {
	if (!graph) { return undefined; }
	const projects = graph.nodes.filter(node => node.kind === 'project' && node.resourceUri !== undefined);
	const affected = new Set<string>();
	for (const resourceUri of resourceUris) {
		const extension = path.extname(fileURLToPath(new URL(resourceUri))).toLowerCase();
		if (extension !== '.csproj' && extension !== '.cs' && extension !== '.csx' && extension !== '.razor' && extension !== '.cshtml') { return undefined; }
		const projectUri = findAffectedProject(resourceUri, projects, graph.nodes);
		if (!projectUri) { return undefined; }
		affected.add(projectUri);
	}
	return [...affected];
}

function findAffectedProject(resourceUri: string, projects: readonly IGraphNode[], nodes: readonly IGraphNode[]): string | undefined {
	const resourceNode = nodes.find(node => node.resourceUri === resourceUri);
	if (resourceNode?.kind === 'project') { return resourceNode.resourceUri; }
	let ancestor = resourceNode;
	while (ancestor?.parentId) {
		ancestor = nodes.find(node => node.id === ancestor?.parentId);
		if (ancestor?.kind === 'project') { return ancestor.resourceUri; }
	}
	const resourcePath = fileURLToPath(new URL(resourceUri));
	const matches = projects.flatMap(project => {
		if (!project.resourceUri) { return []; }
		const projectPath = fileURLToPath(new URL(project.resourceUri));
		const relativePath = path.relative(path.dirname(projectPath), resourcePath);
		return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath) ? [{ uri: project.resourceUri, depth: path.dirname(projectPath).length }] : [];
	});
	return matches.sort((left, right) => right.depth - left.depth)[0]?.uri;
}

