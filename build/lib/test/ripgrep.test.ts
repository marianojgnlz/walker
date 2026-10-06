/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { suite, test } from 'node:test';
import { getRipgrepExcludeFilter } from '../ripgrep.ts';

/**
 * The platform-arch directories shipped by `@vscode/ripgrep-universal`.
 *
 * This is deliberately an independent fixture list instead of a re-export of
 * the utility's own list: adding a shipped platform must be a visible test
 * change, not something the implementation silently inherits.
 */
const RIPGREP_PLATFORM_ARCHES = [
	'darwin-arm64', 'darwin-x64',
	'linux-arm', 'linux-arm64', 'linux-ia32', 'linux-x64',
	'linux-ppc64', 'linux-riscv64', 'linux-s390x',
	'win32-arm64', 'win32-ia32', 'win32-x64',
];

const RIPGREP_BIN_ROOT = '**/node_modules/@vscode/ripgrep-universal/bin';

/** The expected filter for a target dir, or for a target the package does not ship. */
function expectedFilter(target: string | undefined): string[] {
	return [
		'**',
		...RIPGREP_PLATFORM_ARCHES
			.filter(platformArch => platformArch !== target)
			.map(platformArch => `!${RIPGREP_BIN_ROOT}/${platformArch}/**`),
	];
}

suite('ripgrep', () => {

	suite('getRipgrepExcludeFilter', () => {

		test('keeps the Linux x64 payload and strips every other platform directory', () => {
			assert.deepStrictEqual(getRipgrepExcludeFilter('linux', 'x64'), expectedFilter('linux-x64'));
		});

		test('keeps the Linux arm64, ia32 and armhf payloads', () => {
			assert.deepStrictEqual(getRipgrepExcludeFilter('linux', 'arm64'), expectedFilter('linux-arm64'));
			assert.deepStrictEqual(getRipgrepExcludeFilter('linux', 'ia32'), expectedFilter('linux-ia32'));
			// The build spells 32-bit ARM 'armhf' while Node reports process.arch === 'arm'.
			assert.deepStrictEqual(getRipgrepExcludeFilter('linux', 'armhf'), expectedFilter('linux-arm'));
		});

		test('keeps the macOS x64 and arm64 payloads', () => {
			assert.deepStrictEqual(getRipgrepExcludeFilter('darwin', 'x64'), expectedFilter('darwin-x64'));
			assert.deepStrictEqual(getRipgrepExcludeFilter('darwin', 'arm64'), expectedFilter('darwin-arm64'));
		});

		test('keeps the Windows x64, arm64 and ia32 payloads', () => {
			assert.deepStrictEqual(getRipgrepExcludeFilter('win32', 'x64'), expectedFilter('win32-x64'));
			assert.deepStrictEqual(getRipgrepExcludeFilter('win32', 'arm64'), expectedFilter('win32-arm64'));
			assert.deepStrictEqual(getRipgrepExcludeFilter('win32', 'ia32'), expectedFilter('win32-ia32'));
		});

		test('resolves alpine builds to the glibc linux payload', () => {
			// Alpine reuses the regular linux-* binaries in both spellings used by the build.
			assert.deepStrictEqual(getRipgrepExcludeFilter('alpine', 'x64'), expectedFilter('linux-x64'));
			assert.deepStrictEqual(getRipgrepExcludeFilter('linux', 'alpine'), expectedFilter('linux-x64'));
		});

		test('strips every shipped platform directory for an unsupported target', () => {
			// No @vscode/ripgrep-universal package exists for these build targets.
			assert.deepStrictEqual(getRipgrepExcludeFilter('freebsd', 'x64'), expectedFilter(undefined));
			assert.deepStrictEqual(getRipgrepExcludeFilter('darwin', 'ia32'), expectedFilter(undefined));
		});

		test('excludes only the ripgrep-universal bin root and never a Copilot payload', () => {
			const filter = getRipgrepExcludeFilter('linux', 'x64');

			assert.strictEqual(filter[0], '**', 'the filter must start by including everything');
			for (const pattern of filter.slice(1)) {
				assert.ok(pattern.startsWith(`!${RIPGREP_BIN_ROOT}/`), `unexpected exclude pattern: ${pattern}`);
				assert.ok(!pattern.includes('@github/'), `Copilot payload must not be reachable from this filter: ${pattern}`);
				assert.ok(!pattern.includes('@microsoft/'), `unrelated package must not be reachable from this filter: ${pattern}`);
			}
		});

		test('retains the ordinary Search payload: the target binary is never excluded', () => {
			for (const platformArch of RIPGREP_PLATFORM_ARCHES) {
				const [platform, arch] = platformArch.split('-');
				const filter = getRipgrepExcludeFilter(platform, arch);

				assert.ok(
					!filter.includes(`!${RIPGREP_BIN_ROOT}/${platformArch}/**`),
					`the shipped ${platformArch} ripgrep binary must survive packaging`
				);
				assert.strictEqual(filter.length, RIPGREP_PLATFORM_ARCHES.length, `${platformArch} must exclude every other platform directory exactly once`);
				assert.strictEqual(new Set(filter).size, filter.length, `${platformArch} must not emit duplicate patterns`);
			}
		});

		test('covers exactly the platform directories shipped by the installed package', () => {
			const binRoot = path.join(import.meta.dirname, '..', '..', '..', 'node_modules', '@vscode', 'ripgrep-universal', 'bin');
			if (!fs.existsSync(binRoot)) {
				return;
			}

			const shipped = fs.readdirSync(binRoot, { withFileTypes: true })
				.filter(entry => entry.isDirectory())
				.map(entry => entry.name)
				.sort();
			assert.deepStrictEqual(shipped, [...RIPGREP_PLATFORM_ARCHES].sort());
		});
	});
});
