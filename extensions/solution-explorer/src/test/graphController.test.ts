/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { createGraphController, createWorkspaceGraphScanner, type IGraphDocumentCache } from '../graphController';
import type { IGraphDiagnostic, IWorkspaceGraph } from '../model';
import { createFileSystem } from './workspaceReaderFixtures';

function graph(name: string, diagnostics: readonly IGraphDiagnostic[] = []): IWorkspaceGraph {
	const id = `workspace:${name}`;
	return { rootIds: [id], nodes: [{ id, kind: 'workspace', label: name, resourceUri: `file:///${name}`, childIds: [] }], diagnostics };
}

suite('workspace graph controller', () => {
	test('caches parsed documents by URI and exact content and clears them on root topology changes', async () => {
		let source = '<Project Sdk="First.Sdk" />';
		let parses = 0;
		const uri = 'file:///workspace/App.csproj';
		const controller = createGraphController({
			workspaceRoots: ['/workspace'],
			scan: async (roots, _signal, cache: IGraphDocumentCache) => {
				let parsed = cache.getProject(uri, source);
				if (!parsed) {
					parses++;
					parsed = { navigationUri: uri, sdk: source, sdkStyle: true, enableDefaultItems: true, enableDefaultCompileItems: true, implicitItemsPartial: false, itemDeclarations: [], unsupportedDeclarations: [], diagnostics: [], partial: false };
					cache.setProject(uri, source, parsed);
				}
				return graph(roots[0], [{ id: `sdk:${parsed.sdk}`, code: 'partial-project-metadata', message: 'A source declaration remains partial.', severity: 'warning', resourceUri: uri }]);
			},
			publish: () => undefined,
		});
		await controller.refresh();
		await controller.refresh();
		assert.strictEqual(parses, 1);
		source = '<Project Sdk="Second.Sdk" />';
		await controller.refresh();
		assert.strictEqual(parses, 2, 'changed document content invalidates the parsed value');
		await controller.setWorkspaceRoots(['/workspace/other']);
		assert.strictEqual(parses, 3, 'root topology changes clear cached membership and parsed documents');
		controller.dispose();
	});

	test('assembles bounded solution, project, file, dependency, and missing-reference nodes', async () => {
		const fileSystem = createFileSystem();
		fileSystem.addDirectory('/workspace/src');
		const solutionText = 'Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "App", "src/App.csproj", "{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}"\nEndProject';
		const projectText = '<Project Sdk="Microsoft.NET.Sdk"><ItemGroup><Compile Include="Program.cs" /><PackageReference Include="Example.Package" Version="1.2.3" /><ProjectReference Include="Missing.csproj" /></ItemGroup></Project>';
		for (const [path, content] of [
			['/workspace/App.sln', solutionText],
			['/workspace/src/App.csproj', projectText],
			['/workspace/src/Program.cs', 'class Program {}'],
		] as const) {
			const bytes = new TextEncoder().encode(content);
			fileSystem.addFile(path, bytes.byteLength, bytes);
		}
		const published: IWorkspaceGraph[] = [];
		const controller = createGraphController({
			workspaceRoots: ['/workspace'],
			scan: createWorkspaceGraphScanner({ fileSystem }).scan,
			publish: value => published.push(value),
		});
		await controller.refresh();
		const result = published.at(-1);
		assert.ok(result);
		assert.deepStrictEqual(result.nodes.map(node => [node.kind, node.label]), [
			['workspace', 'workspace'],
			['solution', 'App.sln'],
			['project', 'App'],
			['file', 'Program.cs'],
			['dependency', 'Example.Package 1.2.3'],
			['dependency', 'Missing.csproj'],
		]);
		assert.ok(result.nodes.some(node => node.kind === 'dependency' && node.missing === true && node.navigable === false));
		controller.dispose();
	});
});
