/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { createWorkspaceReader } from '../workspaceReader';
import { SCAN_LIMITS } from '../scanLimits';
import { createSafetyFileSystem, FakeClock } from './workspaceReaderSafetyFixtures';

suite('workspace reader containment and cancellation', () => {
	test('skips symlink entries and rejects metadata realpaths outside the root', async () => {
		const fileSystem = createSafetyFileSystem();
		fileSystem.addSymlink('/workspace/linked', '/outside');
		fileSystem.addDirectory('/workspace/escaped-dir');
		fileSystem.addFile('/workspace/escaped-dir/ignored.csproj');
		fileSystem.aliasRealpath('/workspace/escaped-dir', '/outside/escaped-dir');
		fileSystem.addFile('/workspace/escape.csproj');
		fileSystem.aliasRealpath('/workspace/escape.csproj', '/outside/escape.csproj');
		const result = await createWorkspaceReader({ fileSystem }).scan(['/workspace']);
		assert.ok(!fileSystem.realpaths.includes('/workspace/linked'));
		assert.ok(!fileSystem.readRequests.some(request => request.path.includes('escape') || request.path.includes('ignored')));
		assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === 'workspace-escape'));
	});

	test('limits reads to four concurrent operations and cancels in-flight reads cooperatively', async () => {
		const fileSystem = createSafetyFileSystem();
		for (let index = 0; index < 8; index++) { fileSystem.addFile(`/workspace/p${index}.csproj`); }
		fileSystem.readGate = new Promise(resolve => { fileSystem.releaseReads = resolve; });
		const running = createWorkspaceReader({ fileSystem }).scan(['/workspace']);
		for (let attempt = 0; attempt < 30 && fileSystem.maxConcurrentReads < 4; attempt++) {
			await new Promise(resolve => setImmediate(resolve));
		}
		assert.strictEqual(fileSystem.maxConcurrentReads, SCAN_LIMITS.concurrentReads);
		fileSystem.releaseReads?.();
		assert.strictEqual((await running).roots[0].projects.length, 8);

		const inFlightFs = createSafetyFileSystem();
		inFlightFs.addFile('/workspace/slow.csproj');
		inFlightFs.readGate = new Promise(resolve => { inFlightFs.releaseReads = resolve; });
		const controller = new AbortController();
		const inFlight = createWorkspaceReader({ fileSystem: inFlightFs }).scan(['/workspace'], controller.signal);
		for (let attempt = 0; attempt < 30 && inFlightFs.activeReads === 0; attempt++) {
			await new Promise(resolve => setImmediate(resolve));
		}
		controller.abort();
		inFlightFs.releaseReads?.();
		assert.strictEqual((await inFlight).diagnostics[0].code, 'scan-cancelled');

		const openingFs = createSafetyFileSystem();
		const directoryController = new AbortController();
		openingFs.onOpenDirectory = () => directoryController.abort();
		const directoryCancelled = await createWorkspaceReader({ fileSystem: openingFs }).scan(['/workspace'], directoryController.signal);
		assert.strictEqual(directoryCancelled.diagnostics[0].code, 'scan-cancelled');
		assert.strictEqual(openingFs.closedDirectories, 1);
	});

	test('enforces the five-second budget only beyond the exact boundary and closes handles', async () => {
		for (const elapsed of [SCAN_LIMITS.workDurationMs, SCAN_LIMITS.workDurationMs + 1]) {
			const fileSystem = createSafetyFileSystem();
			const clock = new FakeClock();
			fileSystem.onOpenDirectory = () => clock.advance(elapsed);
			const result = await createWorkspaceReader({ fileSystem, clock }).scan(['/workspace']);
			assert.strictEqual(result.diagnostics.some(diagnostic => diagnostic.code === 'work-time-budget'), elapsed > SCAN_LIMITS.workDurationMs);
			assert.strictEqual(fileSystem.closedDirectories, 1);
		}
	});
});
