/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { MAX_DISCOVERY_CANDIDATES, discoverDotnetCandidates, isPathWithin, type ICandidateEnvironment } from '../candidates';
import { createInMemoryFileSystem } from './fixtures';

/**
 * Builds one injected local environment; tests never read the real process environment or home.
 */
function createEnvironment(overrides: Partial<ICandidateEnvironment> = {}): ICandidateEnvironment {
	return { home: '/home/tëst user', platform: 'linux', arch: 'x64', path: '', ...overrides };
}

suite('dotnet candidate discovery', () => {
	test('orders managed, PATH, user, and system candidates on Linux', async () => {
		const environment = createEnvironment({ home: '/home/tëst user', path: '/usr/local/bin:/home/tëst user/.local/bin' });
		const discovery = await discoverDotnetCandidates({ environment, fileSystem: createInMemoryFileSystem() });
		assert.deepStrictEqual(discovery.candidates.map(candidate => candidate.executable), [
			'/home/tëst user/.walker/dotnet/dotnet',
			'/usr/local/bin/dotnet',
			'/home/tëst user/.local/bin/dotnet',
			'/home/tëst user/.dotnet/dotnet',
			'/home/tëst user/.local/share/dotnet/dotnet',
			'/usr/share/dotnet/dotnet',
			'/usr/lib/dotnet/dotnet',
			'/usr/local/share/dotnet/dotnet',
		]);
		assert.deepStrictEqual(discovery.candidates.map(candidate => candidate.origin), ['managed', 'path', 'path', 'user', 'user', 'system', 'system', 'system']);
		assert.deepStrictEqual([discovery.exclusions, discovery.limitReached], [[], false]);
	});

	test('keeps the Linux split-install SDK candidate after a runtime-only PATH candidate', async () => {
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile('/usr/bin/dotnet');
		fileSystem.addFile('/home/üser/.local/share/dotnet/dotnet');
		const discovery = await discoverDotnetCandidates({ environment: createEnvironment({ home: '/home/üser', path: '/usr/bin' }), fileSystem });
		const paths = discovery.candidates.map(candidate => candidate.executable);
		assert.deepStrictEqual([paths.indexOf('/usr/bin/dotnet'), paths.indexOf('/home/üser/.local/share/dotnet/dotnet')], [1, 3]);
	});

	test('covers Windows roots and deduplicates case-insensitively on the real executable path', async () => {
		const environment = createEnvironment({
			home: 'C:\\Users\\tëst',
			platform: 'win32',
			path: 'C:\\tools;relative\\bin;;C:\\Users\\tëst\\.DOTNET;C:\\Program Files\\dotnet',
			programFiles: 'C:\\Program Files',
			programFilesX86: 'C:\\Program Files (x86)',
		});
		const discovery = await discoverDotnetCandidates({ environment, fileSystem: createInMemoryFileSystem() });
		assert.deepStrictEqual(discovery.candidates.map(candidate => candidate.executable), [
			'C:\\Users\\tëst\\.walker\\dotnet\\dotnet.exe',
			'C:\\tools\\dotnet.exe',
			'C:\\Users\\tëst\\.DOTNET\\dotnet.exe',
			'C:\\Program Files\\dotnet\\dotnet.exe',
			'C:\\Users\\tëst\\AppData\\Local\\Microsoft\\dotnet\\dotnet.exe',
			'C:\\Program Files (x86)\\dotnet\\dotnet.exe',
		]);
		assert.deepStrictEqual(discovery.exclusions.map(exclusion => exclusion.reason), ['relative-path-entry', 'empty-path-entry', 'duplicate', 'duplicate']);
	});

	test('covers macOS roots including the x64 subroot', async () => {
		const environment = createEnvironment({ home: '/Users/tëst', platform: 'darwin', path: '/opt/homebrew/bin' });
		const discovery = await discoverDotnetCandidates({ environment, fileSystem: createInMemoryFileSystem() });
		assert.deepStrictEqual(discovery.candidates.map(candidate => candidate.executable), [
			'/Users/tëst/.walker/dotnet/dotnet',
			'/opt/homebrew/bin/dotnet',
			'/Users/tëst/.dotnet/dotnet',
			'/Users/tëst/.local/share/dotnet/dotnet',
			'/usr/local/share/dotnet/dotnet',
			'/usr/local/share/dotnet/x64/dotnet',
		]);
	});

	test('derives Windows ProgramFiles roots when the variables are absent', async () => {
		const environment = createEnvironment({ home: 'C:\\Users\\tëst', platform: 'win32', path: '' });
		const discovery = await discoverDotnetCandidates({ environment, fileSystem: createInMemoryFileSystem() });
		assert.deepStrictEqual(
			discovery.candidates.filter(candidate => candidate.origin === 'system').map(candidate => candidate.executable),
			['C:\\Program Files\\dotnet\\dotnet.exe', 'C:\\Program Files (x86)\\dotnet\\dotnet.exe'],
		);
	});

	test('deduplicates candidates that resolve to the same real executable', async () => {
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile('/opt/real/dotnet');
		fileSystem.addLink('/opt/first/dotnet', '/opt/real/dotnet');
		const discovery = await discoverDotnetCandidates({ environment: createEnvironment({ path: '/opt/first:/opt/real' }), fileSystem });
		assert.deepStrictEqual(
			[discovery.candidates[1].executable, discovery.candidates[1].resolvedExecutable],
			['/opt/first/dotnet', '/opt/real/dotnet'],
		);
		assert.strictEqual(discovery.candidates.filter(candidate => candidate.resolvedExecutable === '/opt/real/dotnet').length, 1);
		assert.deepStrictEqual(discovery.exclusions[0], { path: '/opt/real/dotnet', reason: 'duplicate', resolvedPath: '/opt/real/dotnet' });
	});

	test('excludes empty, relative, and workspace candidates without reading workspace files', async () => {
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile('/home/üser/project/global.json');
		fileSystem.addFile('/home/üser/project/tools/dotnet');
		fileSystem.addFile('/home/üser/project/private/dotnet');
		fileSystem.addLink('/opt/shared/dotnet', '/home/üser/project/private/dotnet');
		const environment = createEnvironment({ home: '/home/üser', path: '/usr/local/bin::relative/bin:/home/üser/project/tools:/opt/shared' });
		const discovery = await discoverDotnetCandidates({ environment, fileSystem, workspaceRoots: ['/home/üser/project/'] });
		assert.deepStrictEqual(discovery.exclusions, [
			{ path: '', reason: 'empty-path-entry' },
			{ path: 'relative/bin', reason: 'relative-path-entry' },
			{ path: '/home/üser/project/tools/dotnet', reason: 'workspace' },
			{ path: '/opt/shared/dotnet', reason: 'workspace', resolvedPath: '/home/üser/project/private/dotnet' },
		]);
		assert.strictEqual(
			discovery.candidates.some(candidate => isPathWithin('/home/üser/project', candidate.executable, 'linux') || isPathWithin('/home/üser/project', candidate.resolvedExecutable, 'linux')),
			false,
		);
		assert.deepStrictEqual(
			[fileSystem.realpaths.includes('/home/üser/project/tools/dotnet'), fileSystem.realpaths.includes('/opt/shared/dotnet'), fileSystem.realpaths.some(filePath => filePath.endsWith('global.json'))],
			[false, true, false],
		);
	});

	test('caps unique candidates at the deterministic limit and reports the limit', async () => {
		const path = Array.from({ length: 70 }, (_, index) => `/opt/sdk-${index}/bin`).join(':');
		const discovery = await discoverDotnetCandidates({ environment: createEnvironment({ path }), fileSystem: createInMemoryFileSystem() });
		assert.deepStrictEqual(
			[discovery.candidates.length, discovery.limitReached, discovery.candidates[63].executable, discovery.exclusions.at(-1)],
			[MAX_DISCOVERY_CANDIDATES, true, '/opt/sdk-62/bin/dotnet', { path: '/opt/sdk-63/bin/dotnet', reason: 'candidate-limit' }],
		);
		assert.strictEqual(discovery.candidates.some(candidate => candidate.origin === 'user' || candidate.origin === 'system'), false);
	});

	test('keeps missing and inaccessible executables for the probe layer to classify', async () => {
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile('/usr/bin/dotnet');
		const discovery = await discoverDotnetCandidates({ environment: createEnvironment({ home: '/home/üser', path: '/usr/bin' }), fileSystem });
		assert.deepStrictEqual(
			[
				discovery.candidates[0].executable,
				discovery.candidates[0].resolvedExecutable,
				discovery.candidates[1].resolvedExecutable,
				discovery.candidates[2].resolvedExecutable,
			],
			['/home/üser/.walker/dotnet/dotnet', '/home/üser/.walker/dotnet/dotnet', '/usr/bin/dotnet', '/home/üser/.dotnet/dotnet'],
		);
	});

	test('is architecture-independent and keeps the managed candidate first', async () => {
		const expected = [
			'/home/tëst user/.walker/dotnet/dotnet',
			'/usr/bin/dotnet',
			'/home/tëst user/.dotnet/dotnet',
			'/home/tëst user/.local/share/dotnet/dotnet',
			'/usr/share/dotnet/dotnet',
			'/usr/lib/dotnet/dotnet',
			'/usr/local/share/dotnet/dotnet',
		];
		for (const arch of ['x64', 'arm64', 'ppc64']) {
			const discovery = await discoverDotnetCandidates({ environment: createEnvironment({ arch, path: '/usr/bin' }), fileSystem: createInMemoryFileSystem() });
			assert.deepStrictEqual(discovery.candidates.map(candidate => candidate.executable), expected);
		}
	});
});
