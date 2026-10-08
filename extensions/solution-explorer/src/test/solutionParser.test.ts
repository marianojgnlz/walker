/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { parseSolution } from '../solutionParser';

suite('solution parser', () => {
	test('preserves quoted project paths, escaped quotes and GUIDs as data', async () => {
		const fixture = await fs.readFile(path.resolve(__dirname, '../../src/test/fixtures/quoted-path.sln'), 'utf8');
		const result = parseSolution(fixture, 'file:///workspace/app.sln');
		assert.deepStrictEqual(result.projects.map(project => [project.name, project.relativePath, project.projectGuid]), [[
			'C# Core', 'src\\My, Project\\C# "Core".csproj', '{A29E6F12-77B1-4E6A-9C55-52A5E4D8E113}',
		]]);
		assert.deepStrictEqual(result.diagnostics, []);
		assert.strictEqual(result.sections[0].name, 'SolutionProperties');
	});

	test('reports malformed records, invalid GUIDs, missing entries and duplicate GUIDs', () => {
		const result = parseSolution([
			'Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "Broken", "broken.csproj"',
			'Project("not-a-guid") = "Invalid GUID", "invalid.csproj", "{11111111-1111-1111-1111-111111111111}"',
			'Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "Missing path", "", "{22222222-2222-2222-2222-222222222222}"',
			'Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "First", "first.csproj", "{33333333-3333-3333-3333-333333333333}"',
			'Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "Duplicate", "second.csproj", "{33333333-3333-3333-3333-333333333333}"',
		].join('\n'));
		assert.deepStrictEqual(result.projects.map(project => project.name), ['First']);
		assert.deepStrictEqual(result.diagnostics.map(diagnostic => diagnostic.code), [
			'malformed-project-record', 'invalid-project-guid', 'missing-project-entry', 'duplicate-project-guid',
		]);
	});

	test('preserves unsupported sections and project kinds as diagnostics without dropping records', () => {
		const result = parseSolution([
			'Project("{12345678-1234-1234-1234-123456789ABC}") = "Other", "other.proj", "{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}"',
			'EndProject',
			'Global',
			'  GlobalSection(CustomMetadata) = postSolution',
			'    Keep = visible',
			'  EndGlobalSection',
			'EndGlobal',
		].join('\n'));
		assert.strictEqual(result.projects[0].name, 'Other');
		assert.deepStrictEqual(result.sections[0], { name: 'CustomMetadata', entries: ['    Keep = visible'], line: 4 });
		assert.deepStrictEqual(result.diagnostics.map(diagnostic => diagnostic.code), ['unsupported-project-kind', 'unsupported-solution-section']);
	});

	test('keeps .slnx unsupported rather than interpreting it as a conventional solution', () => {
		const result = parseSolution('<Solution />', 'file:///workspace/app.slnx');
		assert.deepStrictEqual([result.projects.length, result.diagnostics[0].code], [0, 'unsupported-solution-format']);
	});
});
