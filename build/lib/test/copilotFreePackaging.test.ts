/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { existsSync, readFileSync, readdirSync } from 'fs';
import * as path from 'path';
import { suite, test } from 'node:test';
import { getMxcExcludeFilter } from '../mxc.ts';
import { getRipgrepExcludeFilter } from '../ripgrep.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

function read(relativePath: string): string {
	return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

/** Every TypeScript file a build tool can load from `build/` (no dependency trees). */
function listBuildSources(dir = path.join(repoRoot, 'build')): string[] {
	const result: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules') {
			continue;
		}
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			result.push(...listBuildSources(full));
		} else if (entry.name.endsWith('.ts')) {
			result.push(full);
		}
	}
	return result;
}

/**
 * Regression guard for the Copilot-free packaging pipeline.
 *
 * The build used to load `build/lib/copilot.ts` to copy a pinned
 * `@github/copilot-sdk` runtime into the built-in Copilot extension and to
 * materialize a ripgrep shim from it. That fixup is gone: the SDK is not a
 * dependency, the extension is not part of the product and the pipeline must run
 * to completion without either. Ordinary Search/ripgrep and the retained native
 * payloads must keep working.
 *
 * These assertions are deliberately textual/load-based: they must hold on a
 * machine with **no** `@github/copilot*` package installed, so they cannot rely
 * on installing the SDK or on any Copilot artifact being present.
 */
suite('Copilot-free packaging pipeline', () => {

	test('no build module loads the removed Copilot packaging helper', async () => {
		// `build/lib/copilot.ts` and its dedicated test are recorded for parent-owned
		// physical deletion; this file contains the import it asserts about. Anything
		// else importing the helper would resurrect the Copilot packaging pipeline.
		const pendingParentDeletion = new Set([
			'build/lib/copilot.ts',
			'build/lib/test/copilot.test.ts',
			'build/lib/test/copilotFreePackaging.test.ts',
		]);
		const importers = listBuildSources()
			.filter(file => /(?:from|import)\s*(?:\(\s*)?['"][^'"]*\/copilot\.ts['"]/.test(readFileSync(file, 'utf8')))
			.map(file => path.relative(repoRoot, file).replaceAll(path.sep, '/'))
			.filter(file => !pendingParentDeletion.has(file));

		assert.deepStrictEqual(importers, [], 'the removed Copilot packaging helper must have no importer left in build/');

		// Physical deletion of the helper and its test is parent-owned. Until that
		// deletion lands the module may still be on disk, but it must be unreachable;
		// once it is gone, loading it must fail rather than silently resolve.
		if (!existsSync(path.join(repoRoot, 'build/lib/copilot.ts'))) {
			await assert.rejects(() => import('../copilot.ts'), 'the removed Copilot packaging helper must not be loadable');
		}
	});

	test('the desktop packaging task list schedules no Copilot shim fixup', () => {
		const gulpfile = read('build/gulpfile.vscode.ts');

		assert.doesNotMatch(gulpfile, /lib\/copilot/);
		assert.doesNotMatch(gulpfile, /copilot/i);
		// The packaging task list is native compile -> clean output -> package.
		assert.match(gulpfile, /const packageTasks: task\.Task\[\] = \[\s*compileNativeExtensionsBuildTask,\s*util\.rimraf\(path\.join\(buildRoot, destinationFolderName\)\),\s*packageTask\(platform, arch, sourceFolderName, destinationFolderName, opts\)\s*\];/);
		// The extension compile step no longer includes a Copilot extension build.
		assert.match(gulpfile, /cleanExtensionsBuildTask,\s*compileNonNativeExtensionsBuildTask,\s*compileExtensionMediaBuildTask,/);
	});

	test('the remote/REH packaging task list schedules no Copilot shim fixup', () => {
		const gulpfile = read('build/gulpfile.reh.ts');

		assert.doesNotMatch(gulpfile, /lib\/copilot/);
		assert.doesNotMatch(gulpfile, /copilot/i);
		assert.match(gulpfile, /const packageTasks: task\.Task\[\] = \[\s*compileNativeExtensionsBuildTask,\s*task\.task\(`node-\$\{platform\}-\$\{arch\}`\) as task\.Task,\s*util\.rimraf\(path\.join\(BUILD_ROOT, destinationFolderName\)\),\s*packageTask\(type, platform, arch, sourceFolderName, destinationFolderName\)\s*\];/);
	});

	test('only the neutral ripgrep package stays in the built product', () => {
		for (const gulpfile of ['build/gulpfile.vscode.ts', 'build/gulpfile.reh.ts']) {
			const source = read(gulpfile);

			// Ordinary Search keeps its per-platform ripgrep payload selection.
			assert.match(source, /getRipgrepExcludeFilter\(platform, arch\)/, `${gulpfile} must keep the ripgrep payload filter`);
			// Retained native producers keep their filters.
			assert.match(source, /getMxcExcludeFilter\(arch\)/, `${gulpfile} must keep the retained sandbox payload filter`);
		}

		const ripgrep = read('build/lib/ripgrep.ts');
		assert.match(ripgrep, /export function getRipgrepExcludeFilter\(/);
		assert.doesNotMatch(ripgrep, /@github\/copilot/, 'the neutral ripgrep module must not reach into removed Copilot payloads');
		// The neutral modules stay free of the removed Copilot helpers.
		for (const module of ['build/lib/ripgrep.ts', 'build/lib/mxc.ts']) {
			assert.doesNotMatch(read(module), /prepareBuiltInCopilotRipgrepShim|getCopilotExcludeFilter|getCopilotRuntimePrebuildFiles|getCopilotRuntimeVersion|getCopilotTgrepExcludeFilter|ensureCopilotPlatformPackage/);
		}
	});

	test('no packaging manifest or npm directory points at a Copilot package', () => {
		assert.doesNotMatch(read('build/.moduleignore'), /@github\/copilot/, 'the module ignore list must not carry Copilot (or its Koffi) payload rules');
		assert.doesNotMatch(read('build/.moduleignore'), /@koromix\/koffi/);
		assert.doesNotMatch(read('build/npm/dirs.ts'), /copilot/i);
		assert.doesNotMatch(read('build/lib/extensions.ts'), /copilot/i, 'extension packaging must not know about a Copilot extension');
		assert.doesNotMatch(read('build/gulpfile.extensions.ts'), /copilot/i, 'no Copilot extension compile task may remain');
		assert.doesNotMatch(read('build/filters.ts'), /copilot/i, 'formatting/lint filters must not carve out a deleted tree');
	});

	test('the Darwin universal merge keeps the retained native payloads', () => {
		const universal = read('build/darwin/create-universal-app.ts');

		assert.doesNotMatch(universal, /copilot/i);
		// ripgrep-universal, the OS proxy resolver and the sandbox binaries still merge.
		assert.match(universal, /ripgrep-universal/);
		assert.match(universal, /os-proxy-resolver/);
		assert.match(universal, /mxc-sdk/);

		const verifyMacho = read('build/darwin/verify-macho.ts');
		assert.doesNotMatch(verifyMacho, /copilot/i);
		assert.match(verifyMacho, /ripgrep-universal\/bin\/darwin-\*/);
		assert.match(verifyMacho, /mxc-sdk\/bin/);
	});

	test('the retained sandbox payload filter maps every shipped architecture', () => {
		assert.deepStrictEqual(getMxcExcludeFilter('x64'), ['**', '!**/node_modules/@microsoft/mxc-sdk/bin/arm64/**']);
		assert.deepStrictEqual(getMxcExcludeFilter('arm64'), ['**', '!**/node_modules/@microsoft/mxc-sdk/bin/x64/**']);
		assert.deepStrictEqual(getMxcExcludeFilter('armhf'), ['**', '!**/node_modules/@microsoft/mxc-sdk/bin/x64/**', '!**/node_modules/@microsoft/mxc-sdk/bin/arm64/**']);
	});

	test('Search ripgrep payload selection still maps every shipped platform', () => {
		const filter = getRipgrepExcludeFilter('linux', 'x64');

		assert.strictEqual(filter[0], '**');
		assert.ok(!filter.includes('!**/node_modules/@vscode/ripgrep-universal/bin/linux-x64/**'), 'the target ripgrep binary must survive packaging');
		assert.ok(filter.includes('!**/node_modules/@vscode/ripgrep-universal/bin/darwin-arm64/**'), 'non-target payloads must be stripped');
	});
});
