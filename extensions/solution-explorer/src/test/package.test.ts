/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { SCAN_LIMITS } from '../scanLimits';

interface IExtensionManifest {
	readonly main: string;
	readonly displayName: string;
	readonly description: string;
	readonly activationEvents?: readonly string[];
	readonly capabilities?: { readonly virtualWorkspaces?: boolean; readonly untrustedWorkspaces?: { readonly supported: boolean } };
	readonly contributes?: {
		readonly configuration?: { readonly properties?: Readonly<Record<string, unknown>> };
		readonly configurationDefaults?: Readonly<Record<string, unknown>>;
		readonly views?: Readonly<Record<string, readonly { readonly id: string; readonly name: string }[]>>;
		readonly viewsWelcome?: readonly { readonly view: string; readonly contents: string }[];
		readonly commands?: readonly { readonly command: string; readonly title: string }[];
		readonly menus?: Readonly<Record<string, readonly { readonly command: string; readonly when: string }[]>>;
	};
}

suite('solution-explorer package manifest', () => {
	test('resolves its localized view and packaged entry while retaining ordinary Explorer', async () => {
		const extensionRoot = path.resolve(__dirname, '..', '..');
		const repositoryRoot = path.resolve(extensionRoot, '..', '..');
		const [manifestContents, localizationContents, ignoreContents, buildContents, localPackageBuildContents] = await Promise.all([
			fs.readFile(path.join(extensionRoot, 'package.json'), 'utf8'),
			fs.readFile(path.join(extensionRoot, 'package.nls.json'), 'utf8'),
			fs.readFile(path.join(extensionRoot, '.vscodeignore'), 'utf8'),
			fs.readFile(path.join(repositoryRoot, 'build', 'gulpfile.extensions.ts'), 'utf8'),
			fs.readFile(path.join(repositoryRoot, 'build', 'lib', 'extensions.ts'), 'utf8'),
		]);
		const manifest = JSON.parse(manifestContents) as IExtensionManifest;
		const localization = JSON.parse(localizationContents) as Record<string, unknown>;

		assert.strictEqual(manifest.main, './out/extension');
		assert.strictEqual(manifest.displayName, '%displayName%');
		assert.strictEqual(manifest.description, '%description%');
		assert.strictEqual(typeof localization.displayName, 'string');
		assert.strictEqual(typeof localization.description, 'string');
		assert.strictEqual(manifest.capabilities?.virtualWorkspaces, true, 'virtual workspaces activate only to display the localized unsupported state');
		assert.strictEqual(manifest.capabilities?.untrustedWorkspaces?.supported, true);
		assert.ok(manifest.activationEvents?.includes('onView:walkerSolutionExplorer'));
		assert.ok(manifest.activationEvents?.includes('onCommand:walker.solutionExplorer.configureEditing'));
		assert.deepStrictEqual(manifest.contributes?.views?.explorer, [{ id: 'walkerSolutionExplorer', name: '%view.name%' }]);
		assert.strictEqual(manifest.contributes?.viewsWelcome?.[0]?.view, 'walkerSolutionExplorer');
		assert.deepStrictEqual(manifest.contributes?.commands?.map(command => command.command), [
			'walker.solutionExplorer.refresh',
			'walker.solutionExplorer.open',
			'walker.solutionExplorer.openExternal',
			'walker.solutionExplorer.configureEditing',
		]);
		assert.ok(manifest.contributes?.menus?.['view/item/context']?.some(menu => menu.command === 'walker.solutionExplorer.openExternal' && menu.when.includes('solution-explorer-external')));
		assert.ok(!('viewsContainers' in (manifest.contributes ?? {})), 'the view augments Explorer instead of replacing it or adding a container');
		assert.deepStrictEqual(manifest.contributes?.configurationDefaults, {
			'dotnet.server.useOmnisharp': false,
			'chat.disableAIFeatures': true,
			'dotnet.projects.enableAutomaticRestore': false,
			'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources': false,
		}, 'companion defaults yield to effective user, workspace and folder values');
		assert.deepStrictEqual(manifest.contributes?.configuration?.properties?.['chat.disableAIFeatures'], {
			type: 'boolean',
			default: true,
			description: '%configuration.chat.disableAIFeatures%',
		}, 'the owner contribution registers the AI-suppression setting schema for profile writes');
		assert.strictEqual(typeof localization['configuration.title'], 'string');
		assert.strictEqual(typeof localization['configuration.chat.disableAIFeatures'], 'string');
		assert.ok(Object.keys(localization).includes('command.configureEditing'));
		assert.ok(Object.keys(localization).includes('view.name'));

		const entryPath = require.resolve(path.resolve(extensionRoot, manifest.main));
		assert.strictEqual(entryPath, path.join(extensionRoot, 'out', 'extension.js'));
		assert.strictEqual(typeof (require(entryPath) as { readonly activate?: unknown }).activate, 'function');

		const ignoredPaths = ignoreContents.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
		for (const exclusion of ['src/**', 'out/test/**', 'tsconfig*.json', '**/*.tsbuildinfo']) {
			assert.ok(ignoredPaths.includes(exclusion), `${exclusion} should not ship`);
		}
		assert.ok(!ignoredPaths.includes('out/**'), 'the declared runtime entry must remain packageable');
		assert.ok(buildContents.includes("'extensions/solution-explorer/tsconfig.json'"), 'the repository extension compiler must emit the manifest entry');
		assert.ok(localPackageBuildContents.includes("glob.sync('extensions/*/package.json')"), 'local built-in packages are discovered from extension manifests');
	});

	test('pins the initial D5 scan budgets', () => {
		assert.deepStrictEqual(SCAN_LIMITS, {
			metadataFileBytes: 2 * 1024 * 1024,
			solutions: 64,
			projects: 256,
			directoryEntries: 20_000,
			graphNodes: 20_000,
			directoryDepth: 32,
			xmlDepth: 64,
			xmlTokens: 100_000,
			concurrentReads: 4,
			workDurationMs: 5_000,
		});
	});
});
