/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IGraphDiagnostic, IGraphNode, IWorkspaceGraph } from './model';
import { SCAN_LIMITS } from './scanLimits';
import type { ISolutionParseResult, ISolutionProjectRecord, ISolutionSection } from './solutionParser';

export const SOLUTION_FOLDER_TYPE_GUID = '{66A26720-8FB5-11D2-AA7E-00C04F688DDE}';
const guidPattern = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i;
const solutionFolderType = SOLUTION_FOLDER_TYPE_GUID.toUpperCase();

export interface IDiscoveredProject {
	readonly uri: string;
	readonly label?: string;
}

export interface ISolutionGraphEntry {
	readonly uri: string;
	readonly parsed: ISolutionParseResult;
}

export interface IWorkspaceGraphRootInput {
	readonly uri: string;
	readonly label?: string;
	readonly projects: readonly IDiscoveredProject[];
	readonly solutions: readonly ISolutionGraphEntry[];
}

export interface ISolutionGraphInput {
	readonly roots: readonly IWorkspaceGraphRootInput[];
}

export interface ISolutionGraphOptions {
	/** Canonical real-path aliases supplied by the bounded reader; node identity remains ancestry-based. */
	readonly canonicalizeUri?: (uri: string) => string;
}

interface IMutableGraphNode {
	readonly id: string;
	readonly kind: IGraphNode['kind'];
	readonly label: string;
	readonly resourceUri?: string;
	parentId?: string;
	readonly childIds: string[];
}

function normalizeUri(uri: string): string {
	const normalized = new URL(uri);
	if (normalized.protocol === 'file:' && normalized.hostname.toLowerCase() === 'localhost') {
		normalized.hostname = '';
	}
	return normalized.href;
}

function canonicalUri(uri: string, options: ISolutionGraphOptions): string {
	return normalizeUri(options.canonicalizeUri?.(uri) ?? uri);
}

function encode(value: string): string {
	return encodeURIComponent(value);
}

function displayName(uri: string): string {
	try {
		const name = new URL(uri).pathname.split('/').filter(part => part.length > 0).at(-1);
		return name ? decodeURIComponent(name) : uri;
	} catch {
		return uri;
	}
}

function encodeProjectPath(value: string): string {
	return value.split('/').map(part => part === '.' || part === '..' ? part : encodeURIComponent(part)).join('/');
}

/** Resolves only the path value in a solution record; it never probes the resulting URI. */
function resolveProjectUri(solutionUri: string, projectPath: string): string {
	const value = projectPath.replace(/\\/g, '/');
	if (/^[A-Za-z]:\//.test(value)) {
		return normalizeUri(`file:///${value}`);
	}
	if (value.startsWith('//')) {
		return normalizeUri(`file:${encodeProjectPath(value)}`);
	}
	if (value.startsWith('/')) {
		return normalizeUri(`file://${encodeProjectPath(value)}`);
	}
	if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) {
		return normalizeUri(value);
	}
	return normalizeUri(new URL(encodeProjectPath(value), solutionUri).href);
}

function diagnostic(code: string, message: string, scope: string, resourceUri?: string): IGraphDiagnostic {
	return {
		id: `${scope}:${code}`,
		code,
		message,
		severity: 'warning',
		...(resourceUri === undefined ? {} : { resourceUri }),
	};
}

function parseNestedParents(sections: readonly ISolutionSection[], records: ReadonlyMap<string, ISolutionProjectRecord>, scope: string, resourceUri: string, diagnostics: IGraphDiagnostic[]): Map<string, string> {
	const parents = new Map<string, string>();
	for (const section of sections) {
		if (section.name !== 'NestedProjects') {
			continue;
		}
		for (const entry of section.entries) {
			const match = /^\s*(\{[^}]+\})\s*=\s*(\{[^}]+\})\s*$/.exec(entry);
			if (!match || !guidPattern.test(match[1]) || !guidPattern.test(match[2])) {
				diagnostics.push(diagnostic('malformed-nested-project-entry', 'A NestedProjects entry has malformed GUIDs.', `${scope}:${section.line}:${diagnostics.length}`, resourceUri));
				continue;
			}
			const childGuid = match[1].toUpperCase();
			const parentGuid = match[2].toUpperCase();
			if (!records.has(childGuid)) {
				diagnostics.push(diagnostic('missing-nested-child', `Nested project '${childGuid}' has no Project record.`, `${scope}:${section.line}:${diagnostics.length}`, resourceUri));
				continue;
			}
			const parent = records.get(parentGuid);
			if (!parent) {
				diagnostics.push(diagnostic('missing-nested-parent', `Nested parent '${parentGuid}' has no Project record.`, `${scope}:${section.line}:${diagnostics.length}`, resourceUri));
				continue;
			}
			if (parent.typeGuid !== solutionFolderType) {
				diagnostics.push(diagnostic('nested-parent-not-folder', `Nested parent '${parentGuid}' is not a solution folder.`, `${scope}:${section.line}:${diagnostics.length}`, resourceUri));
				continue;
			}
			if (parents.has(childGuid)) {
				diagnostics.push(diagnostic('duplicate-nested-parent', `Project '${childGuid}' has more than one nested parent.`, `${scope}:${section.line}:${diagnostics.length}`, resourceUri));
				continue;
			}
			let ancestor: string | undefined = parentGuid;
			let cycle = false;
			while (ancestor !== undefined) {
				if (ancestor === childGuid) {
					cycle = true;
					break;
				}
				ancestor = parents.get(ancestor);
			}
			if (cycle) {
				diagnostics.push(diagnostic('nested-project-cycle', `NestedProjects contains a cycle involving '${childGuid}'.`, `${scope}:${section.line}:${diagnostics.length}`, resourceUri));
				continue;
			}
			parents.set(childGuid, parentGuid);
		}
	}
	return parents;
}

/** Builds per-root, per-solution tree ancestry from already-discovered local metadata. */
export function assembleWorkspaceGraph(input: ISolutionGraphInput, options: ISolutionGraphOptions = {}): IWorkspaceGraph {
	const nodes: IMutableGraphNode[] = [];
	const nodesById = new Map<string, IMutableGraphNode>();
	const rootIds: string[] = [];
	const diagnostics: IGraphDiagnostic[] = [];
	let nodeLimitReported = false;

	const addNode = (node: IMutableGraphNode): boolean => {
		if (nodes.length >= SCAN_LIMITS.graphNodes) {
			if (!nodeLimitReported) {
				diagnostics.push(diagnostic('graph-node-limit', `The graph exceeds ${SCAN_LIMITS.graphNodes} nodes.`, 'graph-limit'));
				nodeLimitReported = true;
			}
			return false;
		}
		nodes.push(node);
		nodesById.set(node.id, node);
		if (node.parentId) {
			nodesById.get(node.parentId)?.childIds.push(node.id);
		}
		return true;
	};

	const addScopedDiagnostic = (value: IGraphDiagnostic, scope: string): void => {
		diagnostics.push({ ...value, id: `${scope}:${value.id}` });
	};

	for (let rootIndex = 0; rootIndex < input.roots.length; rootIndex++) {
		const root = input.roots[rootIndex];
		const rootId = `workspace:${rootIndex}:${encode(root.uri)}`;
		if (!addNode({ id: rootId, kind: 'workspace', label: root.label ?? displayName(root.uri), childIds: [] })) {
			continue;
		}
		rootIds.push(rootId);

		const discovered = new Map<string, IDiscoveredProject>();
		for (const project of root.projects) {
			try {
				const uri = canonicalUri(project.uri, options);
				if (!discovered.has(uri)) {
					discovered.set(uri, { ...project, uri });
				}
			} catch {
				diagnostics.push(diagnostic('invalid-discovered-project-uri', 'A discovered project has an invalid local URI.', `${rootId}:project:${diagnostics.length}`, project.uri));
			}
		}
		const solutionMembership = new Set<string>();

		for (let solutionIndex = 0; solutionIndex < root.solutions.length; solutionIndex++) {
			const solution = root.solutions[solutionIndex];
			const solutionId = `solution:${rootId}:${solutionIndex}:${encode(solution.uri)}`;
			if (!addNode({ id: solutionId, kind: 'solution', label: displayName(solution.uri), resourceUri: solution.uri, parentId: rootId, childIds: [] })) {
				break;
			}
			for (const value of solution.parsed.diagnostics) {
				addScopedDiagnostic(value, solutionId);
			}

			const records = new Map<string, ISolutionProjectRecord>();
			const nodesByGuid = new Map<string, string>();
			const pathsInSolution = new Set<string>();
			for (const record of solution.parsed.projects) {
				const projectGuid = record.projectGuid.toUpperCase();
				records.set(projectGuid, record);
				if (record.typeGuid.toUpperCase() === solutionFolderType) {
					const folderId = `folder:${solutionId}:${encode(projectGuid)}`;
					if (addNode({ id: folderId, kind: 'solutionFolder', label: record.name, parentId: solutionId, childIds: [] })) {
						nodesByGuid.set(projectGuid, folderId);
					}
					continue;
				}

				let projectUri: string | undefined;
				try {
					projectUri = canonicalUri(resolveProjectUri(solution.uri, record.relativePath), options);
				} catch {
					diagnostics.push(diagnostic('invalid-solution-project-uri', `Project '${record.name}' has an invalid path.`, `${solutionId}:${projectGuid}`, solution.uri));
				}
				if (projectUri && pathsInSolution.has(projectUri)) {
					diagnostics.push(diagnostic('duplicate-project-uri', `Multiple solution records resolve to '${projectUri}'.`, `${solutionId}:${projectGuid}`, projectUri));
					continue;
				}
				if (projectUri) {
					pathsInSolution.add(projectUri);
					solutionMembership.add(projectUri);
					if (!discovered.has(projectUri)) {
						diagnostics.push(diagnostic('missing-project-file', `Project '${record.name}' was not found during workspace discovery.`, `${solutionId}:${projectGuid}`, projectUri));
					}
				}
				const projectId = `project:${solutionId}:${encode(projectGuid)}`;
				if (addNode({
					id: projectId,
					kind: 'project',
					label: record.name,
					...(projectUri === undefined ? {} : { resourceUri: projectUri }),
					parentId: solutionId,
					childIds: [],
				})) {
					nodesByGuid.set(projectGuid, projectId);
				}
			}

			const nestedParents = parseNestedParents(solution.parsed.sections, records, solutionId, solution.uri, diagnostics);
			for (const [childGuid, parentGuid] of nestedParents) {
				const child = nodesById.get(nodesByGuid.get(childGuid) ?? '');
				const parent = nodesById.get(nodesByGuid.get(parentGuid) ?? '');
				if (!child || !parent) {
					continue;
				}
				const oldParent = child.parentId ? nodesById.get(child.parentId) : undefined;
				if (oldParent) {
					const childIndex = oldParent.childIds.indexOf(child.id);
					if (childIndex >= 0) {
						oldParent.childIds.splice(childIndex, 1);
					}
				}
				child.parentId = parent.id;
				parent.childIds.push(child.id);
			}
		}

		const standaloneUris = new Set<string>();
		for (let projectIndex = 0; projectIndex < root.projects.length; projectIndex++) {
			const project = root.projects[projectIndex];
			let uri: string;
			try {
				uri = canonicalUri(project.uri, options);
			} catch {
				continue;
			}
			if (solutionMembership.has(uri) || standaloneUris.has(uri)) {
				continue;
			}
			standaloneUris.add(uri);
			addNode({
				id: `standalone:${rootId}:${projectIndex}:${encode(uri)}`,
				kind: 'project',
				label: project.label ?? displayName(uri),
				resourceUri: uri,
				parentId: rootId,
				childIds: [],
			});
		}
	}

	return {
		rootIds,
		nodes: nodes.map(node => ({ ...node, childIds: [...node.childIds] })),
		diagnostics,
	};
}
