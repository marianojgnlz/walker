/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import '../../browser/projectWizard.contribution.js';
import { CREATE_PROJECT_COMMAND_ID } from '../../common/projectWizard.js';
import { createDotnetNewOptions, getTemplateCapabilities, parseInstalledTemplateList, parseTemplateHelp } from '../../common/templates.js';

suite('project wizard contribution', () => {
	test('registers one shared command for the File menu and command palette', () => {
		const fileMenuItem = MenuRegistry.getMenuItems(MenuId.MenubarFileMenu).find(item => 'command' in item && item.command.id === CREATE_PROJECT_COMMAND_ID);
		const paletteItem = MenuRegistry.getMenuItems(MenuId.CommandPalette).find(item => 'command' in item && item.command.id === CREATE_PROJECT_COMMAND_ID);
		assert.ok(MenuRegistry.getCommand(CREATE_PROJECT_COMMAND_ID));
		assert.ok(fileMenuItem);
		assert.ok(paletteItem);
	});
});

suite('project wizard template metadata', () => {
	test('filters the active SDK catalog to approved template identities and preserves SDK order', () => {
		const output = [
			'Template Name                 Short Name       Language  Tags',
			'----------------------------- ---------------- --------- ----------------',
			'Class Library                 classlib         [C#]      Common/Library',
			'Console App                   console          [C#]      Common/Console',
			'Blazor Web App                blazor           [C#]      Web/Blazor',
			'ASP.NET Core Web API (AOT)    webapiaot        [C#]      Web/WebAPI',
			'ASP.NET Core Web API          webapi           [C#]      Web/WebAPI',
			'Unrelated custom template     custom-api       [C#]      Other',
			'',
		].join('\n');

		assert.deepStrictEqual(parseInstalledTemplateList(output).map(template => template.id), [
			'classlib', 'console', 'blazor', 'webapiaot', 'webapi',
		]);
	});

	test('maps every approved SDK 10 template family without inventing unavailable entries', () => {
		const ids = ['console', 'classlib', 'webapi', 'webapiaot', 'mvc', 'webapp', 'blazor', 'blazorwasm', 'worker', 'xunit', 'nunit'];
		const output = ['Template Name\tShort Name\tLanguage\tTags', ...ids.map(id => `Installed ${id}\t${id}\t[C#]\tCommon`), 'custom\tcustom-api\t[C#]\tOther'].join('\n');
		assert.deepStrictEqual(parseInstalledTemplateList(output).map(template => template.id), ids);
	});

	test('recognizes webapp and razor aliases without showing duplicate Razor Pages entries', () => {
		const aliasTable = [
			'Template Name\tShort Name\tLanguage\tTags',
			'ASP.NET Core Razor Pages\trazor, webapp\t[C#]\tWeb/Razor',
			'Razor Pages\twebapp\t[C#]\tWeb/Razor',
		].join('\n');
		const canonicalTable = 'Template Name\tShort Name\tLanguage\tTags\nRazor Pages\trazor\t[C#]\tWeb/Razor';
		assert.deepStrictEqual(parseInstalledTemplateList(aliasTable).map(template => template.id), ['razor']);
		assert.deepStrictEqual(parseInstalledTemplateList(canonicalTable).map(template => template.id), ['razor']);
	});

	test('fails closed when the SDK catalog has no recognizable short-name table', () => {
		assert.deepStrictEqual(parseInstalledTemplateList('Templates are unavailable right now.'), []);
	});

	test('matches approved identities only in a recognizable short-name column', () => {
		const table = [
			'Template Name\tShort Name\tLanguage\tTags',
			'Custom Console Helper\tcustom-api\t[C#]\tA console template helper',
			'ASP.NET Core Web API\twebapi\t[C#]\tWeb/WebAPI',
		].join('\n');
		assert.deepStrictEqual(parseInstalledTemplateList(table).map(template => template.id), ['webapi']);
		assert.deepStrictEqual(parseInstalledTemplateList('Template Name Short Name Language Tags\nConsole App console [C#] Common/Console'), []);
	});

	test('parses only options and framework values advertised by the selected template', () => {
		const webApiHelp = [
			'Usage: dotnet new webapi [options]',
			'',
			'Options:',
			'  -n, --name <name>                 The name for the output.',
			'  -o, --output <output>             The output location.',
			'      --framework <net8.0|net10.0>  The target framework.',
			'      --use-minimal-apis            Use minimal API endpoints.',
			'      --use-controllers              Use controller endpoints.',
			'      --no-restore                   Skip package restore.',
			'',
			'Examples:',
			'  dotnet new webapi --name Sample',
		].join('\n');
		const classLibraryHelp = [
			'Usage: dotnet new classlib [options]',
			'Options:',
			'      --framework <net10.0>  The target framework.',
			'      --no-restore           Skip package restore.',
		].join('\n');

		const webApi = parseTemplateHelp(webApiHelp);
		const classLibrary = parseTemplateHelp(classLibraryHelp);
		assert.deepStrictEqual({
			webApiRecognized: webApi.recognized,
			webApiOptions: webApi.options.map(option => [option.name, option.values]),
			classLibraryOptions: classLibrary.options.map(option => [option.name, option.values]),
		}, {
			webApiRecognized: true,
			webApiOptions: [
				['name', []], ['output', []], ['framework', ['net8.0', 'net10.0']],
				['use-minimal-apis', []], ['use-controllers', []], ['no-restore', []],
			],
			classLibraryOptions: [['framework', ['net10.0']], ['no-restore', []]],
		});
	});

	test('exposes only selected-template option capabilities and omits absent switches', () => {
		const webApi = parseTemplateHelp([
			'Usage: dotnet new webapi [options]',
			'Options:',
			'      --framework <net9.0|net10.0>  The target framework.',
			'      --use-controllers              Use controller endpoints.',
		].join('\n'));
		const classLibrary = parseTemplateHelp('Usage: dotnet new classlib [options]\nOptions:\n      --framework <net10.0>  The target framework.');
		const webApiCapabilities = getTemplateCapabilities('webapi', webApi);
		const classLibraryCapabilities = getTemplateCapabilities('classlib', classLibrary);
		assert.deepStrictEqual({ webApiCapabilities, classLibraryCapabilities }, {
			webApiCapabilities: { frameworks: ['net9.0', 'net10.0'], webApiStyles: ['controllers'], includeTests: false, noRestore: false },
			classLibraryCapabilities: { frameworks: ['net10.0'], webApiStyles: [], includeTests: false, noRestore: false },
		});
		assert.deepStrictEqual(createDotnetNewOptions('webapi', webApi, { framework: 'net10.0', webApiStyle: 'controllers', includeTests: false, restore: true }), [
			{ name: 'framework', value: 'net10.0' }, { name: 'use-controllers' },
		]);
		assert.strictEqual(createDotnetNewOptions('classlib', classLibrary, { includeTests: true, restore: true }), undefined, 'unsupported choices cannot become invocation arguments');
	});

	test('does not invent options when help output is malformed or lacks an options section', () => {
		assert.deepStrictEqual(parseTemplateHelp('A template help page with no option table.'), { recognized: false, options: [] });
		assert.deepStrictEqual(parseTemplateHelp('Options:\n  this is not an option row'), { recognized: false, options: [] });
		assert.deepStrictEqual(parseTemplateHelp('Options:\n  --framework <net10.0>  Framework\n  -broken option row'), { recognized: false, options: [] });
	});
});
