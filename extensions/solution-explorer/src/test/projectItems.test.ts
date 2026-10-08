/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { parseProject } from '../projectParser';
import { projectProjectItems } from '../projectItems';

suite('project file item projection', () => {
	test('projects local Include, simple globs, Link, Exclude and Remove with duplicate and missing diagnostics', () => {
		const metadata = parseProject(`<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="src/*.cs" Exclude="src/skip.cs" /><Compile Include="src/app.cs"><Link>Linked/App.cs</Link></Compile><Compile Include="src/missing.cs" /><Content Include="assets/**/*.json" /><None Include="notes.txt" /><None Remove="notes.txt" /></ItemGroup></Project>`, '/workspace/app/app.csproj');
		const result = projectProjectItems(metadata, {
			projectDirectory: '/workspace/app', workspaceRoot: '/workspace', localFiles: [
				'/workspace/app/src/app.cs', '/workspace/app/src/other.cs', '/workspace/app/src/skip.cs',
				'/workspace/app/assets/data.json', '/workspace/app/assets/nested/data.json', '/workspace/app/notes.txt',
				'/workspace/app/bin/ignored.cs', '/workspace/app/obj/ignored.cs', '/workspace/app/.git/ignored.cs',
			],
		});
		assert.deepStrictEqual(result.files.map(file => [file.label, file.itemTypes, file.missing]).sort(), [
			['Linked/App.cs', ['Compile'], false], ['assets/data.json', ['Content'], false],
			['assets/nested/data.json', ['Content'], false], ['src/missing.cs', ['Compile'], true],
			['src/other.cs', ['Compile'], false],
		]);
		assert.deepStrictEqual(result.diagnostics.map(diagnostic => diagnostic.code).sort(), ['duplicate-project-file', 'missing-project-file']);
	});

	test('respects disabled and conditional SDK implicit-item controls without evaluating them', () => {
		const disabled = parseProject('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><EnableDefaultItems>false</EnableDefaultItems></PropertyGroup><ItemGroup><Compile Include="Explicit.cs" /></ItemGroup></Project>', '/workspace/app.csproj');
		const options = { projectDirectory: '/workspace', workspaceRoot: '/workspace', localFiles: ['/workspace/Explicit.cs', '/workspace/Implicit.cs', '/workspace/bin/Excluded.cs', '/workspace/obj/Excluded.cs', '/workspace/.git/Excluded.cs'] };
		assert.deepStrictEqual(projectProjectItems(disabled, options).files.map(file => file.label), ['Explicit.cs']);
		const implicit = projectProjectItems(parseProject('<Project Sdk="Microsoft.NET.Sdk" />', '/workspace/default.csproj'), options);
		assert.deepStrictEqual(implicit.files.map(file => [file.label, file.implicit]), [['Explicit.cs', true], ['Implicit.cs', true]]);
		const compileDisabled = parseProject('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup></Project>', '/workspace/app.csproj');
		assert.deepStrictEqual(projectProjectItems(compileDisabled, options).files, []);

		const conditional = parseProject('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><EnableDefaultCompileItems Condition="Exists(\'props\')">false</EnableDefaultCompileItems></PropertyGroup></Project>', '/workspace/app.csproj');
		const result = projectProjectItems(conditional, options);
		assert.deepStrictEqual([result.files.length, result.partial, result.diagnostics.map(diagnostic => diagnostic.code)], [0, true, ['unsupported-project-declaration', 'implicit-items-partial']]);
	});

	test('keeps external links display-only and labels unsupported patterns/transforms partial', () => {
		const metadata = parseProject('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="../outside/External.cs"><Link>External/External.cs</Link></Compile><Compile Include="src/[ab].cs" /><Compile Include="@(Compile-&gt;\'%(FullPath)\')" /></ItemGroup></Project>', '/workspace/app/app.csproj');
		const result = projectProjectItems(metadata, {
			projectDirectory: '/workspace/app', workspaceRoot: '/workspace/app', localFiles: ['/workspace/app/src/a.cs'],
		});
		assert.deepStrictEqual(result.files.map(file => [file.label, file.displayOnly, file.missing]), [['External/External.cs', true, false]]);
		assert.ok(result.partial);
		assert.deepStrictEqual(result.diagnostics.map(diagnostic => diagnostic.code).sort(), ['unsupported-project-item', 'unsupported-project-pattern']);
	});
});
