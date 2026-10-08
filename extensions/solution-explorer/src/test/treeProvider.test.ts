/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import type * as vscode from 'vscode';
import { assembleWorkspaceGraph } from '../graph';
import type { IGraphDiagnostic, IGraphNode, IWorkspaceGraph } from '../model';
import { parseSolution } from '../solutionParser';
import { SOLUTION_EXPLORER_COMMANDS } from '../navigation';
import { SolutionTreeProvider, type ISolutionTreeProviderHost, type ISolutionTreeEmitter, type SolutionTreeElement } from '../treeProvider';

class TestEmitter<T> implements ISolutionTreeEmitter<T> {
	readonly changes: (T | undefined)[] = [];
	readonly event: vscode.Event<T | undefined> = () => ({ dispose: () => undefined });

	fire(value: T | undefined): void {
		this.changes.push(value);
	}

	dispose(): void { }
}

interface ITestTreeItem {
	readonly label: string;
	id?: string;
	description?: string;
	contextValue?: string;
	iconPath?: vscode.ThemeIcon;
	resourceUri?: vscode.Uri;
	command?: vscode.Command;
	collapsibleState: vscode.TreeItemCollapsibleState;
}

function createHost(): { readonly host: ISolutionTreeProviderHost; readonly emitters: TestEmitter<SolutionTreeElement | undefined>[]; readonly items: ITestTreeItem[]; readonly icons: string[]; readonly uris: string[] } {
	const emitters: TestEmitter<SolutionTreeElement | undefined>[] = [];
	const items: ITestTreeItem[] = [];
	const icons: string[] = [];
	const uris: string[] = [];
	const host: ISolutionTreeProviderHost = {
		collapsedState: 1 as vscode.TreeItemCollapsibleState,
		noneState: 0 as vscode.TreeItemCollapsibleState,
		createEventEmitter: <T>() => {
			const emitter = new TestEmitter<T>();
			emitters.push(emitter as TestEmitter<SolutionTreeElement | undefined>);
			return emitter;
		},
		createTreeItem: (label, collapsibleState) => {
			const item: ITestTreeItem = { label, collapsibleState };
			items.push(item);
			return item as vscode.TreeItem;
		},
		createThemeIcon: id => {
			icons.push(id);
			return { id } as vscode.ThemeIcon;
		},
		parseUri: value => {
			uris.push(value);
			return { toString: () => value } as vscode.Uri;
		},
		localize: (message, ...args) => `localized:${args.reduce((result, value, index) => result.replace(`{${index}}`, value), message)}`,
	};
	return { host, emitters, items, icons, uris };
}

function graphWithTreeDetails(): IWorkspaceGraph {
	const root: IGraphNode = { id: 'workspace:0', kind: 'workspace', label: 'Workspace', resourceUri: 'file:///workspace', childIds: ['solution:0'] };
	const solution: IGraphNode = { id: 'solution:0', kind: 'solution', label: 'App.sln', resourceUri: 'file:///workspace/App.sln', parentId: root.id, childIds: ['project:0'] };
	const project: IGraphNode = { id: 'project:0', kind: 'project', label: 'App', resourceUri: 'file:///workspace/App.csproj', parentId: solution.id, childIds: ['file:0', 'dependency:0'] };
	const file: IGraphNode = { id: 'file:0', kind: 'file', label: 'Program.cs', resourceUri: 'file:///workspace/Program.cs', parentId: project.id, childIds: [] };
	const dependency: IGraphNode = { id: 'dependency:0', kind: 'dependency', label: 'Example.Package 1.0', parentId: project.id, childIds: [] };
	const diagnostics: readonly IGraphDiagnostic[] = [
		{ id: 'partial:0', code: 'conditional-project-metadata', message: 'Some declarations are unresolved.', severity: 'warning', resourceUri: project.resourceUri },
		{ id: 'missing:0', code: 'missing-project-file', message: 'A declared project is missing.', severity: 'warning', resourceUri: solution.resourceUri },
		{ id: 'unsupported:0', code: 'unsupported-project-pattern', message: 'A project pattern is unsupported.', severity: 'warning', resourceUri: file.resourceUri },
	];
	return { rootIds: [root.id], nodes: [root, solution, project, file, dependency], diagnostics };
}

suite('solution tree provider', () => {
	test('uses graph ancestry IDs, resource labels, standard icons, and localized diagnostic states', async () => {
		const { host, emitters, items, icons, uris } = createHost();
		const provider = new SolutionTreeProvider(host);
		const graph = graphWithTreeDetails();
		provider.setGraph(graph);
		const root = (await provider.getChildren())[0];
		assert.ok(root);
		const solution = (await provider.getChildren(root))[0];
		assert.ok(solution);
		const project = (await provider.getChildren(solution))[0];
		assert.ok(project);
		assert.deepStrictEqual((await provider.getChildren(project)).map(element => element.id), ['file:0', 'dependency:0', 'diagnostic:partial:0']);
		assert.strictEqual((await provider.getChildren(solution)).find(element => element.kind === 'diagnostic')?.id, 'diagnostic:missing:0');
		assert.strictEqual((await provider.getChildren((await provider.getChildren(project))[0])).find(element => element.kind === 'diagnostic')?.id, 'diagnostic:unsupported:0');

		const projectItem = provider.getTreeItem(project) as ITestTreeItem;
		assert.deepStrictEqual([projectItem.id, projectItem.description, projectItem.resourceUri?.toString(), projectItem.collapsibleState], [project.id, 'localized:Partial', 'file:///workspace/App.csproj', host.collapsedState]);
		const fileNode = (await provider.getChildren(project))[0];
		assert.ok(fileNode);
		const fileItem = provider.getTreeItem(fileNode) as ITestTreeItem;
		assert.deepStrictEqual([fileItem.id, fileItem.iconPath, fileItem.resourceUri?.toString()], ['file:0', { id: 'file' }, 'file:///workspace/Program.cs']);
		assert.deepStrictEqual([fileItem.command?.command, fileItem.command?.title, fileItem.command?.arguments], [SOLUTION_EXPLORER_COMMANDS.open, 'localized:Open', [{ kind: 'file', resourceUri: 'file:///workspace/Program.cs' }]]);
		const diagnostic = (await provider.getChildren(solution)).find(element => element.kind === 'diagnostic');
		assert.ok(diagnostic);
		assert.strictEqual(provider.getTreeItem(diagnostic).label, 'localized:Missing: A declared project is missing.');
		assert.deepStrictEqual(icons, ['project', 'file', 'warning']);
		assert.deepStrictEqual(uris, ['file:///workspace/App.csproj', 'file:///workspace/Program.cs', 'file:///workspace/App.sln']);
		assert.strictEqual(emitters[0].changes.length, 1);
		assert.strictEqual(items.length, 3);
		provider.dispose();
	});

	test('keeps multi-root and multi-solution ancestry distinct without any language-toolchain state', async () => {
		const parsed = parseSolution('', 'file:///one/empty.sln');
		const graph = assembleWorkspaceGraph({
			roots: [
				{ uri: 'file:///one', projects: [], solutions: [{ uri: 'file:///one/first.sln', parsed }, { uri: 'file:///one/second.sln', parsed }] },
				{ uri: 'file:///two', projects: [], solutions: [{ uri: 'file:///two/third.sln', parsed }] },
			],
		});
		const { host } = createHost();
		const provider = new SolutionTreeProvider(host);
		provider.setGraph(graph);
		const roots = await provider.getChildren();
		assert.deepStrictEqual(roots.map(node => node.id), graph.rootIds);
		const rootChildren = await Promise.all(roots.map(node => provider.getChildren(node)));
		assert.deepStrictEqual(rootChildren.map(nodes => nodes.map(node => node.id)), [
			['solution:workspace:0:file%3A%2F%2F%2Fone:0:file%3A%2F%2F%2Fone%2Ffirst.sln', 'solution:workspace:0:file%3A%2F%2F%2Fone:1:file%3A%2F%2F%2Fone%2Fsecond.sln'],
			['solution:workspace:1:file%3A%2F%2F%2Ftwo:0:file%3A%2F%2F%2Ftwo%2Fthird.sln'],
		]);
		assert.strictEqual(provider.getTreeItem(roots[0]).resourceUri?.toString(), 'file:///one');
		provider.dispose();
	});

	test('keeps display-only graph nodes behind the explicit external-open command', async () => {
		const { host } = createHost();
		const graph = graphWithTreeDetails();
		const external: IGraphNode = { id: 'dependency:external', kind: 'dependency', label: 'External', resourceUri: 'file:///outside/Shared.csproj', displayOnly: true, navigable: false, parentId: 'project:0', childIds: [] };
		const project = graph.nodes.find(node => node.id === 'project:0')!;
		const provider = new SolutionTreeProvider(host);
		provider.setGraph({ ...graph, nodes: [...graph.nodes.map(node => node.id === project.id ? { ...node, childIds: [...node.childIds, external.id] } : node), external] });
		const roots = await provider.getChildren();
		const solutions = await provider.getChildren(roots[0]);
		const projects = await provider.getChildren(solutions[0]);
		const children = await provider.getChildren(projects[0]);
		const externalElement = children.find(node => node.id === external.id);
		assert.ok(externalElement);
		const item = provider.getTreeItem(externalElement) as ITestTreeItem;
		assert.deepStrictEqual([item.contextValue, item.command], ['solution-explorer-external', undefined]);
		provider.dispose();
	});

	test('shows unsupported local-host states and remains usable for untrusted read-only graphs', async () => {
		const { host } = createHost();
		const provider = new SolutionTreeProvider(host);
		provider.setUnsupported('Local graph scanning is unavailable in this host.');
		const [unsupported] = await provider.getChildren();
		assert.ok(unsupported);
		assert.strictEqual(provider.getTreeItem(unsupported).description, 'localized:Unsupported');
		provider.setGraph(graphWithTreeDetails());
		assert.strictEqual((await provider.getChildren()).length, 1, 'graph availability does not depend on trust or an SDK state');
		provider.dispose();
	});
});
