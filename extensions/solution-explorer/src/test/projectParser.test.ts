/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { parseProject } from '../projectParser';

suite('project metadata parser', () => {
	test('preserves conditions, imports, property expansion and custom transforms as partial declarations', () => {
		const source = `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup Condition="'$(Configuration)' == 'Debug'"><EnableDefaultItems>false</EnableDefaultItems></PropertyGroup><Import Project="$(SharedProps)" /><ItemGroup><Compile Include="@(Compile->'%(FullPath)')" /></ItemGroup></Project>`;
		const result = parseProject(source, '/workspace/app.csproj');
		assert.strictEqual(result.partial, true);
		assert.strictEqual(result.sdkStyle, true);
		assert.strictEqual(result.enableDefaultItems, true, 'conditional controls are not evaluated');
		assert.deepStrictEqual(result.unsupportedDeclarations.map(declaration => declaration.elementName), ['PropertyGroup', 'Import']);
		assert.strictEqual(result.unsupportedDeclarations[1].projectUri, '/workspace/app.csproj');
		assert.deepStrictEqual(result.itemDeclarations.map(declaration => [declaration.itemType, declaration.include, declaration.unsupportedReason]), [
			['Compile', "@(Compile->'%(FullPath)')", 'item expression is not a literal metadata declaration'],
		]);
		assert.strictEqual(result.itemDeclarations[0].provenance.offset, source.indexOf('<Compile'));
	});

	test('reads only literal SDK and implicit-item disabling controls', () => {
		const result = parseProject('<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><EnableDefaultItems>false</EnableDefaultItems><EnableDefaultCompileItems>true</EnableDefaultCompileItems></PropertyGroup></Project>', '/workspace/app.csproj');
		assert.deepStrictEqual([result.sdk, result.sdkStyle, result.enableDefaultItems, result.enableDefaultCompileItems, result.implicitItemsPartial, result.partial], [
			'Microsoft.NET.Sdk', true, false, true, false, false,
		]);
	});

	test('marks conditional or expanded controls partial without guessing their effective values', () => {
		const result = parseProject('<Project Sdk="$(ProjectSdk)"><PropertyGroup><EnableDefaultItems Condition="Exists(\'props\')">false</EnableDefaultItems><EnableDefaultCompileItems>$(UseDefaultCompile)</EnableDefaultCompileItems></PropertyGroup></Project>', '/workspace/app.csproj');
		assert.deepStrictEqual([result.sdk, result.sdkStyle, result.enableDefaultItems, result.enableDefaultCompileItems, result.implicitItemsPartial, result.partial], [
			undefined, false, true, true, true, true,
		]);
		assert.deepStrictEqual(result.unsupportedDeclarations.map(declaration => declaration.elementName), ['Project', 'EnableDefaultItems', 'EnableDefaultCompileItems']);
	});
});
