/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { readXmlProject } from '../xmlReader';
import { SCAN_LIMITS } from '../scanLimits';

suite('structural XML project reader', () => {
	test('builds matched elements with default MSBuild namespaces and decoded attributes', () => {
		const result = readXmlProject(`<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><ItemGroup><Compile Include="src/a&amp;b.cs" /></ItemGroup></Project>`, '/workspace/app.csproj');
		assert.strictEqual(result.partial, false);
		assert.strictEqual(result.navigationUri, '/workspace/app.csproj');
		assert.strictEqual(result.root?.localName, 'Project');
		assert.strictEqual(result.root?.namespaceUri, 'http://schemas.microsoft.com/developer/msbuild/2003');
		const item = result.root?.children[0].children[0];
		assert.strictEqual(item?.name, 'Compile');
		assert.strictEqual(item?.attributes.find(attribute => attribute.localName === 'Include')?.value, 'src/a&b.cs');
		assert.deepStrictEqual(result.diagnostics, []);
	});

	test('resolves qualified element and attribute names while leaving unqualified attributes unnamespaced', () => {
		const result = readXmlProject(`<b:Project xmlns:b="urn:build" xmlns:i="urn:items"><i:Compile i:Kind="source" Include="a.cs" /></b:Project>`, '/workspace/qualified.csproj');
		const item = result.root?.children[0];
		assert.deepStrictEqual([result.root?.localName, result.root?.namespaceUri, item?.localName, item?.namespaceUri], ['Project', 'urn:build', 'Compile', 'urn:items']);
		assert.deepStrictEqual(item?.attributes.map(attribute => [attribute.localName, attribute.namespaceUri, attribute.value]), [
			['Kind', 'urn:items', 'source'], ['Include', '', 'a.cs'],
		]);
		assert.deepStrictEqual(result.diagnostics, []);
	});

	test('accepts namespace-free legacy XML and retains text and comments without changing nesting', () => {
		const result = readXmlProject(`<Project><!-- legacy --><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>`, '/workspace/legacy.csproj');
		assert.strictEqual(result.partial, false);
		assert.strictEqual(result.root?.namespaceUri, '');
		assert.strictEqual(result.root?.children[0].localName, 'PropertyGroup');
		assert.strictEqual(result.root?.children[0].children[0].text, 'net10.0');
	});

	test('returns a partial project-file diagnostic for mismatched or unbound namespace markup', () => {
		const mismatch = readXmlProject('<Project><Item></Project>', '/workspace/broken.csproj');
		assert.deepStrictEqual([mismatch.partial, mismatch.root?.children[0].localName, mismatch.navigationUri], [true, 'Item', '/workspace/broken.csproj']);
		assert.deepStrictEqual(mismatch.diagnostics.map(diagnostic => [diagnostic.code, diagnostic.resourceUri]), [['xml-mismatched-tag', '/workspace/broken.csproj']]);

		const unbound = readXmlProject('<p:Project/>', '/workspace/unbound.csproj');
		assert.deepStrictEqual([unbound.partial, unbound.root, unbound.diagnostics[0].code, unbound.diagnostics[0].resourceUri], [true, undefined, 'xml-namespace-unbound', '/workspace/unbound.csproj']);
	});

	test('accepts XML depth 64 and reports depth 65 as partial with navigation retained', () => {
		const atLimit = readXmlProject('<P>'.repeat(SCAN_LIMITS.xmlDepth) + '</P>'.repeat(SCAN_LIMITS.xmlDepth), '/workspace/depth64.csproj');
		assert.strictEqual(atLimit.partial, false);

		const overLimit = readXmlProject('<P>'.repeat(SCAN_LIMITS.xmlDepth + 1) + '</P>'.repeat(SCAN_LIMITS.xmlDepth + 1), '/workspace/depth65.csproj');
		assert.deepStrictEqual([overLimit.partial, overLimit.root?.localName, overLimit.navigationUri], [true, 'P', '/workspace/depth65.csproj']);
		assert.deepStrictEqual(overLimit.diagnostics.map(diagnostic => [diagnostic.code, diagnostic.resourceUri]), [['xml-depth-limit', '/workspace/depth65.csproj']]);
	});

	test('token exhaustion remains a partial project diagnostic rather than empty success', () => {
		const source = '<Project>' + '<!-- bounded -->'.repeat(SCAN_LIMITS.xmlTokens - 1) + '</Project>';
		const result = readXmlProject(source, '/workspace/large.csproj');
		assert.deepStrictEqual([result.partial, result.root?.localName, result.navigationUri], [true, 'Project', '/workspace/large.csproj']);
		assert.deepStrictEqual(result.diagnostics.map(diagnostic => [diagnostic.code, diagnostic.resourceUri]), [['xml-token-limit', '/workspace/large.csproj']]);
	});

	test('rejects oversized XML while retaining the project-file navigation target', () => {
		const source = 'x'.repeat(SCAN_LIMITS.metadataFileBytes + 1);
		const result = readXmlProject(source, '/workspace/oversized.csproj');
		assert.deepStrictEqual([result.partial, result.root, result.navigationUri], [true, undefined, '/workspace/oversized.csproj']);
		assert.deepStrictEqual(result.diagnostics.map(diagnostic => [diagnostic.code, diagnostic.resourceUri]), [['xml-file-too-large', '/workspace/oversized.csproj']]);
	});
});
