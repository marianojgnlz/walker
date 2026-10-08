/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectProjectItems } from './projectItems';
import { projectProjectReferences } from './projectReferences';
import { parseProject, type IProjectMetadata } from './projectParser';
import { SCAN_LIMITS } from './scanLimits';
import { assembleWorkspaceGraph, type ISolutionGraphInput } from './graph';
import { parseSolution, type ISolutionParseResult } from './solutionParser';
import type { IGraphDiagnostic, IGraphNode, IWorkspaceGraph } from './model';
import { createWorkspaceReader, type IWorkspaceReaderOptions, type IWorkspaceRootScan, type IWorkspaceMetadataFile } from './workspaceReader';

export interface IGraphDocumentCache {
	getSolution(uri: string, source: string): ISolutionParseResult | undefined;
	setSolution(uri: string, source: string, parsed: ISolutionParseResult): void;
	getProject(uri: string, source: string): IProjectMetadata | undefined;
	setProject(uri: string, source: string, parsed: IProjectMetadata): void;
	invalidate(uri?: string): void;
}

export interface IWorkspaceGraphScanner {
	scan(roots: readonly string[], signal: AbortSignal, cache: IGraphDocumentCache): Promise<IWorkspaceGraph>;
}

export interface IGraphControllerOptions {
	readonly workspaceRoots: readonly string[];
	readonly scan: IWorkspaceGraphScanner['scan'];
	readonly publish: (graph: IWorkspaceGraph) => void;
}

export interface IGraphController {
	refresh(): Promise<void>;
	setWorkspaceRoots(roots: readonly string[]): Promise<void>;
	invalidate(resourceUri?: string): void;
	getCurrentGraph(): IWorkspaceGraph | undefined;
	getWorkspaceRoots(): readonly string[];
	dispose(): void;
}

interface IMutableGraphNode extends Omit<IGraphNode, 'childIds'> {
	readonly childIds: string[];
}

interface ICacheEntry {
	readonly uri: string;
	readonly source: string;
	readonly parsed: ISolutionParseResult | IProjectMetadata;
	readonly kind: 'solution' | 'project';
}

const maxCachedSourceCodeUnits = 4 * 1024 * 1024;

class GraphDocumentCache implements IGraphDocumentCache {
	private readonly entries = new Map<string, ICacheEntry>();
	private sourceCodeUnits = 0;

	getSolution(uri: string, source: string): ISolutionParseResult | undefined { return this.get(uri, source, 'solution')?.parsed as ISolutionParseResult | undefined; }
	getProject(uri: string, source: string): IProjectMetadata | undefined { return this.get(uri, source, 'project')?.parsed as IProjectMetadata | undefined; }
	setSolution(uri: string, source: string, parsed: ISolutionParseResult): void { this.set(uri, source, parsed, 'solution'); }
	setProject(uri: string, source: string, parsed: IProjectMetadata): void { this.set(uri, source, parsed, 'project'); }

	invalidate(uri?: string): void {
		for (const [key, entry] of this.entries) {
			if (uri === undefined || entry.uri === uri) { this.delete(key, entry); }
		}
	}

	private get(uri: string, source: string, kind: ICacheEntry['kind']): ICacheEntry | undefined {
		const key = `${kind}:${uri}`;
		const entry = this.entries.get(key);
		if (!entry || entry.source !== source || entry.kind !== kind) { return undefined; }
		this.entries.delete(key);
		this.entries.set(key, entry);
		return entry;
	}

	private set(uri: string, source: string, parsed: ICacheEntry['parsed'], kind: ICacheEntry['kind']): void {
		const key = `${kind}:${uri}`;
		const previous = this.entries.get(key);
		if (previous) { this.delete(key, previous); }
		if (source.length > maxCachedSourceCodeUnits) { return; }
		const entry: ICacheEntry = { uri, source, parsed, kind };
		this.entries.set(key, entry);
		this.sourceCodeUnits += source.length;
		while (this.sourceCodeUnits > maxCachedSourceCodeUnits) {
			const oldest = this.entries.entries().next().value as [string, ICacheEntry] | undefined;
			if (!oldest) { break; }
			this.delete(oldest[0], oldest[1]);
		}
	}

	private delete(key: string, entry: ICacheEntry): void {
		this.entries.delete(key);
		this.sourceCodeUnits -= entry.source.length;
	}
}

/** Owns one monotonic publication generation and invalidates old scans before replacement. */
export function createGraphController(options: IGraphControllerOptions): IGraphController {
	const cache = new GraphDocumentCache();
	let roots = [...options.workspaceRoots];
	let generation = 0;
	let active: AbortController | undefined;
	let current: IWorkspaceGraph | undefined;
	let disposed = false;

	const publish = (graph: IWorkspaceGraph): void => {
		current = graph;
		options.publish(graph);
	};
	const pendingGraph = (revision: number): IWorkspaceGraph => ({
		rootIds: [],
		nodes: [],
		diagnostics: [{ id: `workspace-pending:${revision}`, code: 'workspace-scan-pending', message: 'Workspace roots changed; a bounded scan is pending.', severity: 'warning' }],
	});
	const failedGraph = (previous: IWorkspaceGraph | undefined, revision: number, error: unknown): IWorkspaceGraph => {
		const base = previous ?? { rootIds: [], nodes: [], diagnostics: [] };
		const diagnostics = base.diagnostics.filter(value => value.code !== 'workspace-scan-failed' && value.code !== 'workspace-scan-pending');
		return { ...base, diagnostics: [...diagnostics, { id: `workspace-scan-failed:${revision}`, code: 'workspace-scan-failed', message: `Workspace scan failed: ${error instanceof Error ? error.message : String(error)}`, severity: 'warning' }] };
	};

	const refresh = async (): Promise<void> => {
		if (disposed) { return; }
		active?.abort();
		const requestGeneration = ++generation;
		const request = new AbortController();
		active = request;
		try {
			const graph = await options.scan([...roots], request.signal, cache);
			if (disposed || request.signal.aborted || requestGeneration !== generation) { return; }
			publish(graph);
		} catch (error) {
			if (disposed || request.signal.aborted || requestGeneration !== generation) { return; }
			publish(failedGraph(current, requestGeneration, error));
		} finally {
			if (active === request) { active = undefined; }
		}
	};

	return {
		refresh,
		setWorkspaceRoots: nextRoots => {
			if (disposed) { return Promise.resolve(); }
			if (roots.length !== nextRoots.length || roots.some((root, index) => root !== nextRoots[index])) {
				active?.abort();
				generation++;
				roots = [...nextRoots];
				cache.invalidate();
				publish(pendingGraph(generation));
			}
			return refresh();
		},
		invalidate: resourceUri => {
			if (disposed) { return; }
			cache.invalidate(resourceUri);
			active?.abort();
			active = undefined;
			generation++;
		},
		getCurrentGraph: () => current,
		getWorkspaceRoots: () => [...roots],
		dispose: () => {
			if (disposed) { return; }
			disposed = true;
			generation++;
			active?.abort();
			active = undefined;
			cache.invalidate();
		},
	};
}

/** Reads local metadata once per bounded scan and composes cached parses into a declared graph. */
export function createWorkspaceGraphScanner(readerOptions: IWorkspaceReaderOptions = {}): IWorkspaceGraphScanner {
	const reader = createWorkspaceReader(readerOptions);
	return {
		scan: async (roots, signal, cache) => {
			const scanned = await reader.scan(roots, signal);
			const parsedProjects: { readonly root: IWorkspaceRootScan; readonly file: IWorkspaceMetadataFile; readonly uri: string; readonly metadata: IProjectMetadata }[] = [];
			const graphInput: ISolutionGraphInput = {
				roots: scanned.roots.map(root => ({
					uri: pathToFileURL(root.realPath).href,
					projects: root.projects.map(file => {
						const uri = pathToFileURL(file.path).href;
						const source = new TextDecoder().decode(file.bytes);
						let metadata = cache.getProject(uri, source);
						if (!metadata) { metadata = parseProject(source, uri); cache.setProject(uri, source, metadata); }
						parsedProjects.push({ root, file, uri, metadata });
						return { uri };
					}),
					solutions: root.solutions.map(file => {
						const uri = pathToFileURL(file.path).href;
						const source = new TextDecoder().decode(file.bytes);
						let parsed = cache.getSolution(uri, source);
						if (!parsed) { parsed = parseSolution(source, uri); cache.setSolution(uri, source, parsed); }
						return { uri, parsed };
					}),
				})),
			};
			const graph = assembleWorkspaceGraph(graphInput);
			const nodes: IMutableGraphNode[] = graph.nodes.map(node => ({ ...node, childIds: [...node.childIds] }));
			const nodesById = new Map<string, IMutableGraphNode>(nodes.map(node => [node.id, node]));
			const diagnostics = [...graph.diagnostics, ...scanned.diagnostics.map(asUriDiagnostic)];
			let nodeLimitReported = false;
			const addChild = (parent: IMutableGraphNode, node: IGraphNode): void => {
				if (nodes.length >= SCAN_LIMITS.graphNodes) {
					if (!nodeLimitReported) { diagnostics.push({ id: `graph-controller:node-limit:${parent.id}`, code: 'graph-node-limit', message: `The graph exceeds ${SCAN_LIMITS.graphNodes} nodes.`, severity: 'warning', resourceUri: parent.resourceUri }); }
					nodeLimitReported = true;
					return;
				}
				const mutableNode: IMutableGraphNode = { ...node, childIds: [...node.childIds] };
				nodes.push(mutableNode);
				nodesById.set(node.id, mutableNode);
				parent.childIds.push(node.id);
			};

			for (const project of parsedProjects) {
				const projectNodes = nodes.filter(node => node.kind === 'project' && node.resourceUri === project.uri);
				for (const node of projectNodes) {
					for (const diagnostic of project.metadata.diagnostics) { diagnostics.push({ ...diagnostic, id: `${node.id}:${diagnostic.id}` }); }
					const items = projectProjectItems(project.metadata, { projectDirectory: path.dirname(project.file.path), workspaceRoot: project.root.realPath, localFiles: project.root.localFiles });
					const references = projectProjectReferences(project.metadata, { projectDirectory: path.dirname(project.file.path), workspaceRoot: project.root.realPath, discoveredProjects: project.root.projects.map(file => file.path) });
					for (const diagnostic of [...items.diagnostics, ...references.diagnostics]) { diagnostics.push({ ...diagnostic, id: `${node.id}:${diagnostic.id}` }); }
					for (const file of items.files) {
						addChild(node, { id: `${node.id}:${file.id}`, kind: 'file', label: file.label, resourceUri: file.resourceUri, parentId: node.id, childIds: [], displayOnly: file.displayOnly, missing: file.missing, navigable: !file.displayOnly });
					}
					for (const dependency of references.dependencies) {
						addChild(node, { id: `${node.id}:${dependency.id}`, kind: 'dependency', label: dependency.version ? `${dependency.label} ${dependency.version}` : dependency.label, ...(dependency.resourceUri === undefined ? {} : { resourceUri: dependency.resourceUri }), parentId: node.id, childIds: [], displayOnly: dependency.displayOnly, missing: dependency.missing, navigable: dependency.navigable });
					}
				}
			}
			return { ...graph, nodes, diagnostics };
		},
	};
}

function asUriDiagnostic(diagnostic: IGraphDiagnostic): IGraphDiagnostic {
	if (!diagnostic.resourceUri || !path.isAbsolute(diagnostic.resourceUri)) { return diagnostic; }
	return { ...diagnostic, resourceUri: pathToFileURL(diagnostic.resourceUri).href };
}
