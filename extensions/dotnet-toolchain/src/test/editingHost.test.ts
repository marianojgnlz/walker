/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { executable, fixture, infoOutput, readySnapshot, root, runtimeArtifact, runtimeRoot } from './editingHostFixtures';

suite('fixed .NET editing-host verification core', () => {
	test('returns busy or unsupported before recheck or process creation', async () => {
		let rechecks = 0;
		const busy = fixture({ busy: true, recheck: async () => { rechecks++; return readySnapshot(); } });
		assert.deepStrictEqual(await busy.resolver.resolve(), { schemaVersion: 1, kind: 'unavailable', reason: 'busy' });
		const unsupported = fixture({ platform: 'aix', recheck: async () => { rechecks++; return readySnapshot(); } });
		assert.deepStrictEqual(await unsupported.resolver.resolve(), { schemaVersion: 1, kind: 'unavailable', reason: 'unsupported-host' });
		assert.deepStrictEqual([rechecks, busy.executions.length, unsupported.executions.length], [0, 0, 0]);
	});

	test('maps a non-ready recheck to unavailable and a rejected recheck to failure', async () => {
		const missing = fixture({ snapshot: { schemaVersion: 1, revision: 5, state: 'runtimeOnly', locality: 'local' } });
		assert.deepStrictEqual(await missing.resolver.resolve(), { schemaVersion: 1, kind: 'unavailable', reason: 'sdk-not-ready' });
		const failed = fixture({ recheck: async () => { throw new Error('probe failed'); } });
		assert.deepStrictEqual(await failed.resolver.resolve(), { schemaVersion: 1, kind: 'failed', reason: 'recheck-failed' });
		assert.deepStrictEqual([missing.executions.length, failed.executions.length], [0, 0]);
	});

	test('rejects noncanonical, missing, workspace and mis-rooted installations before probing', async () => {
		const cases = [
			fixture({ workspaceRoots: [root] }),
			fixture({ workspaceRoots: ['/tmp'] }),
			fixture({ realpaths: new Map([[executable, '/opt/other/dotnet']]) }),
			fixture({ realpaths: new Map([[root, '/opt/other']]) }),
		];
		for (const { resolver, executions } of cases) {
			const result = await resolver.resolve();
			assert.deepStrictEqual([result.kind, result.kind === 'failed' && result.reason, executions.length], ['failed', 'unsafe-installation', 0]);
		}
		const missingArtifact = fixture({ missing: [runtimeArtifact] });
		assert.deepStrictEqual(await missingArtifact.resolver.resolve(), { schemaVersion: 1, kind: 'failed', reason: 'invalid-runtime-output' });
		assert.strictEqual(missingArtifact.executions.length, 1);
	});

	test('requires a stable contained base runtime meeting 10.0.5', async () => {
		const runtime = (version: string, location = runtimeRoot) => `Microsoft.NETCore.App ${version} [${location}]\n`;
		const compatible = fixture({ runtimeResult: { exitCode: 0, stdout: runtime('10.0.5') + runtime('9.0.9'), stderr: '' }, infoResult: { exitCode: 0, stdout: infoOutput.replace('10.0.12', '10.0.5'), stderr: '' } });
		assert.strictEqual((await compatible.resolver.resolve()).kind, 'ready');
		const tooOld = fixture({ runtimeResult: { exitCode: 0, stdout: runtime('10.0.4'), stderr: '' } });
		assert.deepStrictEqual(await tooOld.resolver.resolve(), { schemaVersion: 1, kind: 'unavailable', reason: 'runtime-incompatible' });
		const previewOnly = fixture({ runtimeResult: { exitCode: 0, stdout: runtime('10.0.12-preview.1'), stderr: '' } });
		assert.deepStrictEqual(await previewOnly.resolver.resolve(), { schemaVersion: 1, kind: 'unavailable', reason: 'runtime-incompatible' });
		const outside = fixture({ runtimeResult: { exitCode: 0, stdout: runtime('10.0.12', '/other/shared/Microsoft.NETCore.App'), stderr: '' } });
		assert.deepStrictEqual(await outside.resolver.resolve(), { schemaVersion: 1, kind: 'failed', reason: 'invalid-runtime-output' });
	});
});
