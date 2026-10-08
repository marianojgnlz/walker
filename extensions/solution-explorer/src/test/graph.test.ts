/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { assembleWorkspaceGraph, SOLUTION_FOLDER_TYPE_GUID, type ISolutionGraphInput } from '../graph';
import { parseSolution } from '../solutionParser';

const CSHARP = '{9A19103F-16F7-4668-BE54-9A1E7A4F7556}';
const SHARED = '{D954291E-2A0B-460D-934E-DC6B0785DB48}';
const FOLDER = SOLUTION_FOLDER_TYPE_GUID;

function project(typeGuid: string, name: string, path: string, guid: string): string {
	return `Project("${typeGuid}") = "${name}", "${path}", "${guid}"\nEndProject`;
}

function solution(uri: string, records: string[], nested: string[] = []) {
	const section = nested.length === 0 ? '' : `\nGlobal\nGlobalSection(NestedProjects) = preSolution\n${nested.join('\n')}\nEndGlobalSection\nEndGlobal`;
	return { uri, parsed: parseSolution(`${records.join('\n')}${section}`, uri) };
}

function nodeByLabel(graph: ReturnType<typeof assembleWorkspaceGraph>, label: string) {
	const node = graph.nodes.find(candidate => candidate.label === label);
	assert.ok(node, `expected graph node '${label}'`);
	return node;
}

suite('solution graph core', () => {
	test('nests C# and shared projects under folders without duplicate root membership', () => {
		const folderGuid = '{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}';
		const projectGuid = '{BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB}';
		const sharedGuid = '{CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC}';
		const input: ISolutionGraphInput = {
			roots: [{
				uri: 'file:///workspace',
				projects: [
					{ uri: 'file:///workspace/src/app.csproj', label: 'App' },
					{ uri: 'file:///workspace/src/Common.shproj', label: 'Common' },
				],
				solutions: [solution('file:///workspace/app.sln', [
					project(FOLDER, 'Services', 'Services', folderGuid),
					project(CSHARP, 'App', 'src/app.csproj', projectGuid),
					project(SHARED, 'Common', 'src/Common.shproj', sharedGuid),
				], [`${projectGuid} = ${folderGuid}`, `${sharedGuid} = ${folderGuid}`])],
			}],
		};
		const graph = assembleWorkspaceGraph(input);
		const folder = nodeByLabel(graph, 'Services');
		const app = nodeByLabel(graph, 'App');
		const common = nodeByLabel(graph, 'Common');
		const solutionNode = nodeByLabel(graph, 'app.sln');
		assert.deepStrictEqual([folder.kind, folder.parentId, app.parentId, folder.childIds], ['solutionFolder', solutionNode.id, folder.id, [app.id, common.id]]);
		assert.deepStrictEqual([app.resourceUri, common.kind, common.resourceUri, graph.diagnostics.length], ['file:///workspace/src/app.csproj', 'project', 'file:///workspace/src/Common.shproj', 0]);
		assert.strictEqual(graph.nodes.filter(node => node.kind === 'project' && node.parentId === graph.rootIds[0]).length, 0);
	});

	test('breaks nested-folder cycles and diagnoses missing parents without losing nodes', () => {
		const first = '{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}';
		const second = '{BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB}';
		const child = '{CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC}';
		const missing = '{DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD}';
		const graph = assembleWorkspaceGraph({
			roots: [{
				uri: 'file:///workspace', projects: [{ uri: 'file:///workspace/child.csproj', label: 'Child' }],
				solutions: [solution('file:///workspace/cycle.sln', [
					project(FOLDER, 'First', 'First', first),
					project(FOLDER, 'Second', 'Second', second),
					project(CSHARP, 'Child', 'child.csproj', child),
				], [`${first} = ${second}`, `${second} = ${first}`, `${child} = ${missing}`])],
			}],
		});
		const firstNode = nodeByLabel(graph, 'First');
		const secondNode = nodeByLabel(graph, 'Second');
		const childNode = nodeByLabel(graph, 'Child');
		assert.deepStrictEqual([firstNode.parentId, secondNode.parentId], [secondNode.id, nodeByLabel(graph, 'cycle.sln').id]);
		assert.strictEqual(childNode.parentId, nodeByLabel(graph, 'cycle.sln').id);
		assert.deepStrictEqual(graph.diagnostics.map(diagnostic => diagnostic.code), ['nested-project-cycle', 'missing-nested-parent']);
	});

});
