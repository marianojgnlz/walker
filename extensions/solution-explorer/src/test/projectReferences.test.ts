/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { parseProject } from '../projectParser';
import { projectProjectReferences } from '../projectReferences';

suite('project dependency projection', () => {
	test('projects and deduplicates project, package and assembly references as metadata', () => {
		const metadata = parseProject(`<Project><ItemGroup><ProjectReference Include="src/Local.csproj"><Name>Local project</Name></ProjectReference><ProjectReference Include="src/Missing.csproj" /><ProjectReference Include="src/Local.csproj" /><PackageReference Include="Example.Package" Version="2.3.4"><PrivateAssets>all</PrivateAssets></PackageReference><PackageReference Include="Example.Package" Version="9.0" /><Reference Include="Vendor, Version=1.2.3.4, Culture=neutral"><HintPath>../lib/Vendor.dll</HintPath></Reference></ItemGroup></Project>`, '/workspace/app/app.csproj');
		const result = projectProjectReferences(metadata, {
			projectDirectory: '/workspace/app', workspaceRoot: '/workspace', discoveredProjects: ['/workspace/app/src/Local.csproj'],
		});
		assert.deepStrictEqual(result.dependencies.map(dependency => [dependency.kind, dependency.label, dependency.version, dependency.missing, dependency.navigable, dependency.hintPath]).sort(), [
			['assembly', 'Vendor', '1.2.3.4', false, false, '../lib/Vendor.dll'],
			['package', 'Example.Package', '2.3.4', false, false, undefined],
			['project', 'Local project', undefined, false, true, undefined],
			['project', 'Missing.csproj', undefined, true, false, undefined],
		]);
		assert.deepStrictEqual(result.diagnostics.map(diagnostic => diagnostic.code).sort(), [
			'duplicate-package-reference', 'duplicate-project-reference', 'missing-project-reference',
		]);
		assert.deepStrictEqual(result.dependencies.filter(dependency => dependency.kind !== 'project').map(dependency => dependency.resourceUri), [undefined, undefined]);
		assert.strictEqual(result.partial, true);
	});

	test('keeps external project targets display-only and preserves unsupported declarations as partial', () => {
		const metadata = parseProject('<Project><ItemGroup><ProjectReference Include="../../outside/Other.csproj" /><ProjectReference Include="$(ProjectFiles)" /><PackageReference Include="Conditional.Package" Condition="Exists(\'packages.props\')"><Version>4.0</Version></PackageReference><PackageReference Include="Dynamic.Package" Version="$(PackageVersion)" /></ItemGroup></Project>', '/workspace/app/app.csproj');
		const result = projectProjectReferences(metadata, {
			projectDirectory: '/workspace/app', workspaceRoot: '/workspace/app', discoveredProjects: [],
		});
		assert.deepStrictEqual(result.dependencies.map(dependency => [dependency.kind, dependency.label, dependency.displayOnly, dependency.missing, dependency.navigable]), [
			['project', 'Other.csproj', true, false, false],
		]);
		assert.ok(result.partial);
		assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === 'unsupported-project-item'));
	});
});
