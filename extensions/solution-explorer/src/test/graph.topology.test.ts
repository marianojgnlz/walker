/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { assembleWorkspaceGraph, type ISolutionGraphInput } from '../graph';
import { parseSolution } from '../solutionParser';

const CSHARP = '{9A19103F-16F7-4668-BE54-9A1E7A4F7556}';
const SHARED = '{D954291E-2A0B-460D-934E-DC6B0785DB48}';

function project(typeGuid: string, name: string, path: string, guid: string): string {
	return `Project("${typeGuid}") = "${name}", "${path}", "${guid}"\nEndProject`;
}

function solution(uri: string, records: string[]) {
	return { uri, parsed: parseSolution(records.join('\n'), uri) };
}

function nodeByLabel(graph: ReturnType<typeof assembleWorkspaceGraph>, label: string) {
	const node = graph.nodes.find(candidate => candidate.label === label);
	assert.ok(node, `expected graph node '${label}'`);
	return node;
}

suite('solution graph multi-root topology', () => {
	test('keeps shared projects distinct under multiple solutions and workspace roots', () => {
		const sharedGuid = '{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}';
		const shared = project(SHARED, 'Common', 'src/Common.shproj', sharedGuid);
		const app = project(CSHARP, 'App', 'src/App.csproj', '{BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB}');
		const graph = assembleWorkspaceGraph({
			roots: [
				{
					uri: 'file:///workspace/one',
					projects: [
						{ uri: 'file:///workspace/one/src/Common.shproj', label: 'Common' },
						{ uri: 'file:///workspace/one/src/App.csproj', label: 'App' },
						{ uri: 'file:///workspace/one/tools/Standalone.csproj', label: 'Standalone' },
					],
					solutions: [solution('file:///workspace/one/first.sln', [shared, app]), solution('file:///workspace/one/second.sln', [shared])],
				},
				{
					uri: 'file:///workspace/two',
					projects: [{ uri: 'file:///workspace/two/src/Common.shproj', label: 'Common' }],
					solutions: [solution('file:///workspace/two/third.sln', [shared])],
				},
			],
		} satisfies ISolutionGraphInput);
		const common = graph.nodes.filter(node => node.kind === 'project' && node.label === 'Common');
		assert.strictEqual(common.length, 3);
		assert.strictEqual(new Set(common.map(node => node.id)).size, 3);
		assert.strictEqual(new Set(common.map(node => node.parentId)).size, 3);
		assert.deepStrictEqual(common.map(node => node.resourceUri), [
			'file:///workspace/one/src/Common.shproj',
			'file:///workspace/one/src/Common.shproj',
			'file:///workspace/two/src/Common.shproj',
		]);
		const standalone = nodeByLabel(graph, 'Standalone');
		assert.deepStrictEqual([standalone.kind, standalone.parentId], ['project', graph.rootIds[0]]);
		assert.strictEqual(graph.nodes.filter(node => node.label === 'Common' && node.parentId === graph.rootIds[0]).length, 0);
	});

	test('canonicalizes aliases for membership without merging separate solution trees', () => {
		const aliasRecord = project(CSHARP, 'Alias', 'alias/../src/App.csproj', '{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}');
		const canonicalRecord = project(CSHARP, 'Canonical', 'src/App.csproj', '{BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB}');
		const graph = assembleWorkspaceGraph({
			roots: [{
				uri: 'file:///workspace',
				projects: [{ uri: 'file:///workspace/src/App.csproj', label: 'App' }],
				solutions: [
					solution('file:///workspace/first.sln', [aliasRecord]),
					solution('file:///workspace/second.sln', [canonicalRecord]),
				],
			}],
		}, { canonicalizeUri: uri => uri.replace('/alias/../', '/') });
		const appNodes = graph.nodes.filter(node => node.kind === 'project' && node.resourceUri === 'file:///workspace/src/App.csproj');
		assert.strictEqual(appNodes.length, 2);
		assert.notStrictEqual(appNodes[0].parentId, appNodes[1].parentId);
		assert.strictEqual(graph.nodes.filter(node => node.label === 'App' && node.parentId === graph.rootIds[0]).length, 0);
	});

	test('deduplicates aliases within one solution and reports missing project files', () => {
		const graph = assembleWorkspaceGraph({
			roots: [{
				uri: 'file:///workspace',
				projects: [{ uri: 'file:///workspace/src/Existing.csproj', label: 'Existing' }],
				solutions: [solution('file:///workspace/app.sln', [
					project(CSHARP, 'Existing', 'alias/Existing.csproj', '{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}'),
					project(CSHARP, 'Alias', 'src/Existing.csproj', '{BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB}'),
					project(CSHARP, 'Missing', 'src/Missing.csproj', '{CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC}'),
				])],
			}],
		}, { canonicalizeUri: uri => uri.replace('/alias/Existing.csproj', '/src/Existing.csproj') });
		assert.deepStrictEqual(graph.nodes.filter(node => node.kind === 'project').map(node => node.label), ['Existing', 'Missing']);
		assert.deepStrictEqual(graph.diagnostics.map(diagnostic => diagnostic.code), ['duplicate-project-uri', 'missing-project-file']);
	});

	test('retains missing solution projects and does not duplicate discovered members', () => {
		const graph = assembleWorkspaceGraph({
			roots: [{
				uri: 'file:///workspace',
				projects: [{ uri: 'file:///workspace/src/Existing.csproj', label: 'Existing' }],
				solutions: [solution('file:///workspace/app.sln', [
					project(CSHARP, 'Existing', 'src/Existing.csproj', '{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}'),
					project(CSHARP, 'Missing', 'src/Missing.csproj', '{BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB}'),
			])],
			}],
		});
		assert.deepStrictEqual(graph.nodes.filter(node => node.kind === 'project').map(node => node.label), ['Existing', 'Missing']);
		assert.strictEqual(graph.nodes.filter(node => node.label === 'Existing' && node.parentId === graph.rootIds[0]).length, 0);
		assert.deepStrictEqual(graph.diagnostics.map(diagnostic => diagnostic.code), ['missing-project-file']);
	});
});
