/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { DOTNET_EDITING_HOST_MAX_OUTPUT_BYTES, DOTNET_EDITING_HOST_TIMEOUT_MS } from '../editingHost';
import { executable, fixture, infoOutput, readySnapshot, root, runtimeOutput, sdkVersion } from './editingHostFixtures';

suite('editing-host process-probe boundary', () => {
	test('uses only the two fixed bounded local probes with a sanitized child environment', async () => {
		let rechecks = 0;
		const { resolver, executions } = fixture({ recheck: async () => { rechecks++; return readySnapshot(); } });
		const result = await resolver.resolve();
		assert.deepStrictEqual(result, {
			schemaVersion: 1,
			kind: 'ready',
			locality: 'local',
			profile: 'roslyn-standalone-10',
			executable,
			root,
			sdkVersion,
			runtimeVersion: '10.0.12',
		});
		assert.strictEqual(rechecks, 1);
		assert.deepStrictEqual(executions.map(({ executable: used, args, cwd, env, timeoutMs, maxOutputBytes }) => ({ used, args, cwd, env, timeoutMs, maxOutputBytes })), [
			{ used: executable, args: ['--list-runtimes'], cwd: '/tmp/walker-dotnet-probe', env: { DOTNET_ROOT: root, DOTNET_MULTILEVEL_LOOKUP: '0', DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' }, timeoutMs: DOTNET_EDITING_HOST_TIMEOUT_MS, maxOutputBytes: DOTNET_EDITING_HOST_MAX_OUTPUT_BYTES },
			{ used: executable, args: ['--info'], cwd: '/tmp/walker-dotnet-probe', env: { DOTNET_ROOT: root, DOTNET_MULTILEVEL_LOOKUP: '0', DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' }, timeoutMs: DOTNET_EDITING_HOST_TIMEOUT_MS, maxOutputBytes: DOTNET_EDITING_HOST_MAX_OUTPUT_BYTES },
		]);
	});

	test('rejects malformed or truncated runtime and info output', async () => {
		for (const runtimeResult of [
			{ exitCode: 0, stdout: 'not a runtime record\n', stderr: '' },
			{ exitCode: 0, stdout: `${runtimeOutput}\n[stdout truncated at 65536 bytes]`, stderr: '' },
		]) {
			assert.deepStrictEqual(await fixture({ runtimeResult }).resolver.resolve(), { schemaVersion: 1, kind: 'failed', reason: 'invalid-runtime-output' });
		}
		for (const infoResult of [
			{ exitCode: 0, stdout: '.NET SDK:\n no host section\n', stderr: '' },
			{ exitCode: 0, stdout: infoOutput.replace(sdkVersion, '9.0.100'), stderr: '' },
		]) {
			assert.deepStrictEqual(await fixture({ infoResult }).resolver.resolve(), { schemaVersion: 1, kind: 'failed', reason: 'invalid-runtime-output' });
		}
	});

	test('preserves spawn and timeout outcomes from either fixed probe', async () => {
		for (const failure of ['spawn', 'timeout'] as const) {
			const result = await fixture({ runtimeResult: { exitCode: 1, stdout: '', stderr: 'failed', failure } }).resolver.resolve();
			assert.deepStrictEqual(result, { schemaVersion: 1, kind: 'failed', reason: failure });
		}
		for (const failure of ['spawn', 'timeout'] as const) {
			const result = await fixture({ infoResult: { exitCode: 1, stdout: '', stderr: 'failed', failure } }).resolver.resolve();
			assert.deepStrictEqual(result, { schemaVersion: 1, kind: 'failed', reason: failure });
		}
	});
});
