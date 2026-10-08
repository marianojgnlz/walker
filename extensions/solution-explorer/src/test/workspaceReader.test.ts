/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as path from 'node:path';
import { createWorkspaceReader } from '../workspaceReader';
import { SCAN_LIMITS } from '../scanLimits';
import { createFileSystem } from './workspaceReaderFixtures';

suite('bounded workspace discovery and reads', () => {
	test('discovers local solution/project metadata and excludes bin, obj and .git', async () => {
		const fileSystem = createFileSystem();
		fileSystem.addDirectory('/workspace/src');
		fileSystem.addDirectory('/workspace/bin');
		fileSystem.addDirectory('/workspace/obj');
		fileSystem.addDirectory('/workspace/.git');
		fileSystem.addFile('/workspace/app.sln');
		fileSystem.addFile('/workspace/src/app.csproj');
		fileSystem.addFile('/workspace/src/Common.shproj');
		fileSystem.addFile('/workspace/bin/ignored.csproj');
		fileSystem.addFile('/workspace/obj/ignored.sln');
		fileSystem.addFile('/workspace/.git/ignored.csproj');
		const result = await createWorkspaceReader({ fileSystem }).scan(['/workspace']);
		assert.deepStrictEqual(result.roots[0].solutions.map(file => file.path), ['/workspace/app.sln']);
		assert.deepStrictEqual(result.roots[0].projects.map(file => file.path), ['/workspace/src/app.csproj', '/workspace/src/Common.shproj']);
	});

	test('rejects stat and read overflow while accepting the exact 2 MiB boundary', async () => {
		const fileSystem = createFileSystem();
		const max = SCAN_LIMITS.metadataFileBytes;
		fileSystem.addFile('/workspace/stat-large.csproj', max + 1);
		fileSystem.addFile('/workspace/grows.sln', 1, new Uint8Array(max + 1));
		fileSystem.addFile('/workspace/exact.csproj', max, new Uint8Array(max));
		const result = await createWorkspaceReader({ fileSystem }).scan(['/workspace']);
		assert.deepStrictEqual(result.roots[0].projects.map(file => file.path), ['/workspace/exact.csproj']);
		assert.deepStrictEqual(result.diagnostics.map(diagnostic => diagnostic.code), ['metadata-file-too-large', 'metadata-read-overflow']);
		assert.deepStrictEqual(fileSystem.readRequests.map(request => [path.posix.basename(request.path), request.maxBytes]), [
			['grows.sln', max], ['exact.csproj', max],
		]);
	});

	test('caps solution and project discovery at their exact limits', async () => {
		const fileSystem = createFileSystem();
		for (let index = 0; index < SCAN_LIMITS.solutions + 1; index++) { fileSystem.addFile(`/workspace/s${index}.sln`); }
		for (let index = 0; index < SCAN_LIMITS.projects + 1; index++) { fileSystem.addFile(`/workspace/p${index}.csproj`); }
		const result = await createWorkspaceReader({ fileSystem }).scan(['/workspace']);
		assert.deepStrictEqual([result.roots[0].solutions.length, result.roots[0].projects.length], [64, 256]);
		assert.deepStrictEqual(result.diagnostics.map(diagnostic => diagnostic.code).sort(), ['project-limit', 'solution-limit']);
	});

	test('bounds directory entries and discovers files only through depth 32', async () => {
		const large = createFileSystem();
		for (let index = 0; index <= SCAN_LIMITS.directoryEntries; index++) { large.addFile(`/workspace/n${index}.txt`); }
		const bounded = await createWorkspaceReader({ fileSystem: large }).scan(['/workspace']);
		assert.deepStrictEqual(bounded.diagnostics.map(diagnostic => diagnostic.code), ['directory-entry-limit']);

		const deep = createFileSystem();
		let directory = '/workspace';
		for (let depth = 1; depth <= SCAN_LIMITS.directoryDepth + 1; depth++) {
			directory += `/d${depth}`;
			deep.addDirectory(directory);
			if (depth === SCAN_LIMITS.directoryDepth) { deep.addFile(`${directory}/at-limit.csproj`); }
		}
		deep.addFile(`${directory}/too-deep.csproj`);
		const result = await createWorkspaceReader({ fileSystem: deep }).scan(['/workspace']);
		assert.deepStrictEqual(result.roots[0].projects.map(file => path.posix.basename(file.path)), ['at-limit.csproj']);
		assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === 'directory-depth-limit'));
	});

	test('caps total graph nodes across distinct roots', async () => {
		const fileSystem = createFileSystem();
		const roots: string[] = [];
		for (let index = 0; index <= SCAN_LIMITS.graphNodes; index++) {
			const root = `/workspace/r${index}`;
			fileSystem.addDirectory(root);
			roots.push(root);
		}
		const result = await createWorkspaceReader({ fileSystem, clock: { now: () => 0 } }).scan(roots);
		assert.strictEqual(result.roots.length, SCAN_LIMITS.graphNodes);
		assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === 'graph-node-limit'));
	});
});
