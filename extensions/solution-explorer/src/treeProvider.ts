/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { IGraphDiagnostic, IGraphNode, IWorkspaceGraph } from './model';
import { SOLUTION_EXPLORER_COMMANDS, type ISolutionNavigationTarget } from './navigation';

export type SolutionTreeDiagnosticState = 'Partial' | 'Missing' | 'Unsupported';

export type SolutionTreeElement =
	| { readonly kind: 'graph'; readonly id: string; readonly node: IGraphNode; readonly parentId?: string }
	| { readonly kind: 'diagnostic'; readonly id: string; readonly diagnostic: IGraphDiagnostic; readonly state: SolutionTreeDiagnosticState; readonly parentId?: string }
	| { readonly kind: 'status'; readonly id: string; readonly message: string; readonly state: SolutionTreeDiagnosticState };

export interface ISolutionTreeEmitter<T> extends vscode.Disposable {
	readonly event: vscode.Event<T | undefined>;
	fire(value: T | undefined): void;
}

/** Small injected VS Code surface so tree behavior can be tested in plain Node. */
export interface ISolutionTreeProviderHost {
	readonly collapsedState: vscode.TreeItemCollapsibleState;
	readonly noneState: vscode.TreeItemCollapsibleState;
	createEventEmitter<T>(): ISolutionTreeEmitter<T>;
	createTreeItem(label: string, collapsibleState: vscode.TreeItemCollapsibleState): vscode.TreeItem;
	createThemeIcon(id: string): vscode.ThemeIcon;
	parseUri(value: string): vscode.Uri;
	localize(message: string, ...args: readonly string[]): string;
}

function diagnosticState(diagnostic: IGraphDiagnostic): SolutionTreeDiagnosticState {
	if (/unsupported|malformed|invalid/i.test(diagnostic.code)) { return 'Unsupported'; }
	if (/missing|not-found/i.test(diagnostic.code)) { return 'Missing'; }
	return 'Partial';
}

function statePriority(state: SolutionTreeDiagnosticState): number {
	switch (state) {
		case 'Unsupported': return 3;
		case 'Missing': return 2;
		case 'Partial': return 1;
	}
}

function uriContains(rootUri: string, resourceUri: string): boolean {
	try {
		const root = new URL(rootUri);
		const resource = new URL(resourceUri);
		if (root.protocol !== resource.protocol || root.host !== resource.host) { return false; }
		const rootPath = root.pathname.endsWith('/') ? root.pathname : `${root.pathname}/`;
		return resource.pathname === root.pathname || resource.pathname.startsWith(rootPath);
	} catch {
		return false;
	}
}

/** Presents read-only graph snapshots with stable ancestry and localized diagnostic children. */
export class SolutionTreeProvider implements vscode.TreeDataProvider<SolutionTreeElement>, vscode.Disposable {
	private readonly emitter: ISolutionTreeEmitter<SolutionTreeElement>;
	private graph: IWorkspaceGraph | undefined;
	private nodesById = new Map<string, IGraphNode>();
	private diagnosticsByParent = new Map<string, IGraphDiagnostic[]>();
	private unsupported: Extract<SolutionTreeElement, { readonly kind: 'status' }> | undefined;
	private disposed = false;

	readonly onDidChangeTreeData: vscode.Event<SolutionTreeElement | undefined>;

	constructor(private readonly host: ISolutionTreeProviderHost) {
		this.emitter = host.createEventEmitter<SolutionTreeElement>();
		this.onDidChangeTreeData = this.emitter.event;
	}

	/** Replaces the displayed snapshot; graph node IDs are retained as TreeItem IDs. */
	setGraph(graph: IWorkspaceGraph): void {
		if (this.disposed) { return; }
		this.graph = graph;
		this.unsupported = undefined;
		this.nodesById = new Map(graph.nodes.map(node => [node.id, node]));
		this.diagnosticsByParent = this.indexDiagnostics(graph);
		this.emitter.fire(undefined);
	}

	/** Requests the view to re-read its current snapshot. */
	refresh(): void {
		if (!this.disposed) { this.emitter.fire(undefined); }
	}

	/** Shows an unsupported-host explanation without attempting to scan remote or virtual paths. */
	setUnsupported(message: string): void {
		if (this.disposed) { return; }
		this.graph = undefined;
		this.nodesById.clear();
		this.diagnosticsByParent.clear();
		this.unsupported = { kind: 'status', id: 'solution-explorer:unsupported', message, state: 'Unsupported' };
		this.emitter.fire(undefined);
	}

	getChildren(element?: SolutionTreeElement): Promise<SolutionTreeElement[]> {
		if (this.unsupported) { return Promise.resolve(element ? [] : [this.unsupported]); }
		if (!this.graph) { return Promise.resolve([]); }
		const parentId = element?.kind === 'graph' ? element.node.id : undefined;
		if (element && element.kind !== 'graph') { return Promise.resolve([]); }
		const nodes = parentId === undefined
			? this.graph.rootIds.map(id => this.nodesById.get(id)).filter((node): node is IGraphNode => node !== undefined)
			: (this.nodesById.get(parentId)?.childIds ?? []).map(id => this.nodesById.get(id)).filter((node): node is IGraphNode => node !== undefined);
		const graphElements = nodes.map(node => this.graphElement(node));
		const diagnosticElements = parentId === undefined
			? this.graph.rootIds.length === 0 ? this.graph.diagnostics.map(diagnostic => this.diagnosticElement(diagnostic)) : []
			: (this.diagnosticsByParent.get(parentId) ?? []).map(diagnostic => this.diagnosticElement(diagnostic, parentId));
		return Promise.resolve([...graphElements, ...diagnosticElements]);
	}

	getTreeItem(element: SolutionTreeElement): vscode.TreeItem {
		if (element.kind === 'status') {
			const item = this.host.createTreeItem(this.host.localize(element.message), this.host.noneState);
			item.id = element.id;
			item.contextValue = 'solution-explorer-status';
			item.description = this.host.localize(element.state);
			item.iconPath = this.host.createThemeIcon('warning');
			return item;
		}
		if (element.kind === 'diagnostic') {
			const item = this.host.createTreeItem(this.host.localize('{0}: {1}', element.state, element.diagnostic.message), this.host.noneState);
			item.id = element.id;
			item.contextValue = 'solution-explorer-diagnostic';
			item.description = this.host.localize(element.state);
			item.iconPath = this.host.createThemeIcon('warning');
			if (element.diagnostic.resourceUri) {
				item.resourceUri = this.host.parseUri(element.diagnostic.resourceUri);
			}
			return item;
		}

		const node = element.node;
		const children = (node.childIds.length > 0 ? node.childIds.length : 0) + (this.diagnosticsByParent.get(node.id)?.length ?? 0);
		const item = this.host.createTreeItem(node.label, children > 0 ? this.host.collapsedState : this.host.noneState);
		item.id = node.id;
		item.contextValue = node.displayOnly === true ? 'solution-explorer-external' : `solution-explorer-${node.kind}`;
		const state = this.nodeState(node);
		if (state) { item.description = this.host.localize(state); }
		item.iconPath = this.host.createThemeIcon(this.iconFor(node));
		if (node.resourceUri) { item.resourceUri = this.host.parseUri(node.resourceUri); }
		if (node.kind !== 'workspace' && node.kind !== 'solutionFolder'
			&& node.displayOnly !== true && node.navigable !== false
			&& (node.kind !== 'dependency' || node.navigable === true)
			&& node.resourceUri !== undefined) {
			const target: ISolutionNavigationTarget = {
				kind: node.kind,
				resourceUri: node.resourceUri,
				...(node.displayOnly === undefined ? {} : { displayOnly: node.displayOnly }),
				...(node.navigable === undefined ? {} : { navigable: node.navigable }),
			};
			item.command = { command: SOLUTION_EXPLORER_COMMANDS.open, title: this.host.localize('Open'), arguments: [target] };
		}
		return item;
	}

	getParent(element: SolutionTreeElement): Promise<SolutionTreeElement | undefined> {
		if (element.kind === 'status' || element.parentId === undefined) { return Promise.resolve(undefined); }
		const parent = this.nodesById.get(element.parentId);
		return Promise.resolve(parent ? this.graphElement(parent) : undefined);
	}

	dispose(): void {
		if (this.disposed) { return; }
		this.disposed = true;
		this.graph = undefined;
		this.nodesById.clear();
		this.diagnosticsByParent.clear();
		this.unsupported = undefined;
		this.emitter.dispose();
	}

	private graphElement(node: IGraphNode): Extract<SolutionTreeElement, { readonly kind: 'graph' }> {
		return { kind: 'graph', id: node.id, node, ...(node.parentId === undefined ? {} : { parentId: node.parentId }) };
	}

	private diagnosticElement(diagnostic: IGraphDiagnostic, parentId?: string): Extract<SolutionTreeElement, { readonly kind: 'diagnostic' }> {
		return { kind: 'diagnostic', id: `diagnostic:${diagnostic.id}`, diagnostic, state: diagnosticState(diagnostic), ...(parentId === undefined ? {} : { parentId }) };
	}

	private indexDiagnostics(graph: IWorkspaceGraph): Map<string, IGraphDiagnostic[]> {
		const result = new Map<string, IGraphDiagnostic[]>();
		const roots = graph.rootIds.map(id => this.nodesById.get(id)).filter((node): node is IGraphNode => node !== undefined);
		for (const diagnostic of graph.diagnostics) {
			const uriMatches = diagnostic.resourceUri === undefined ? [] : graph.nodes.filter(node => node.resourceUri === diagnostic.resourceUri);
			const scopedMatch = uriMatches.filter(node => diagnostic.id.includes(node.id)).sort((left, right) => right.id.length - left.id.length)[0];
			const exact = scopedMatch ?? uriMatches[0];
			const root = diagnostic.resourceUri === undefined ? roots[0] : roots
				.filter(node => node.resourceUri !== undefined && uriContains(node.resourceUri, diagnostic.resourceUri!))
				.sort((left, right) => (right.resourceUri?.length ?? 0) - (left.resourceUri?.length ?? 0))[0];
			const parent = exact ?? root ?? roots[0];
			if (!parent) { continue; }
			const values = result.get(parent.id) ?? [];
			values.push(diagnostic);
			result.set(parent.id, values);
		}
		return result;
	}


	private nodeState(node: IGraphNode): SolutionTreeDiagnosticState | undefined {
		if (node.missing) { return 'Missing'; }
		const states = (this.diagnosticsByParent.get(node.id) ?? []).map(diagnosticState);
		return states.sort((left, right) => statePriority(right) - statePriority(left))[0];
	}

	private iconFor(node: IGraphNode): string {
		switch (node.kind) {
			case 'workspace': return 'root-folder';
			case 'solutionFolder': return 'folder';
			case 'solution': return 'file-code';
			case 'project': return 'project';
			case 'file': return 'file';
			case 'dependency': return 'references';
		}
	}
}
