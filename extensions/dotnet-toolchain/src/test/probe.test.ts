/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import type { IProcessExecutionResult } from '../contracts';
import { DOTNET_PROBE_TOTAL_BUDGET_MS, compareDotnetVersions, interpretRuntimeInventory, interpretSdkInventory, parseRuntimeInventory, parseSdkInventory } from '../probe';

/**
 * Builds one completed probe result; tests never spawn a real process.
 */
function processResult(overrides: Partial<IProcessExecutionResult> = {}): IProcessExecutionResult {
	return { exitCode: 0, stdout: '', stderr: '', ...overrides };
}

suite('dotnet inventory parsing', () => {
	test('parses SDK inventories and orders entries newest first', () => {
		const stdout = '9.0.100 [/usr/share/dotnet/sdk]\n10.0.401 [/home/tëst/.local/share/dotnet/sdk]\n10.0.100-rc.2.25502.107 [/opt/dotnet/sdk]\n10.0.100 [/home/tëst/.walker/dotnet/sdk]\n';
		assert.deepStrictEqual(parseSdkInventory(stdout), {
			kind: 'entries',
			entries: [
				{ version: '10.0.401', root: '/home/tëst/.local/share/dotnet/sdk' },
				{ version: '10.0.100', root: '/home/tëst/.walker/dotnet/sdk' },
				{ version: '10.0.100-rc.2.25502.107', root: '/opt/dotnet/sdk' },
				{ version: '9.0.100', root: '/usr/share/dotnet/sdk' },
			],
		});
	});

	test('parses runtime inventories and ignores blank lines and CRLF', () => {
		const stdout = 'Microsoft.NETCore.App 10.0.11 [/usr/share/dotnet/shared/Microsoft.NETCore.App]\r\n\r\nMicrosoft.AspNetCore.App 10.0.1 [/usr/share/dotnet/shared/Microsoft.AspNetCore.App]\n';
		assert.deepStrictEqual(interpretRuntimeInventory(processResult({ stdout })), {
			kind: 'entries',
			entries: [
				{ runtime: 'Microsoft.NETCore.App', version: '10.0.11', root: '/usr/share/dotnet/shared/Microsoft.NETCore.App' },
				{ runtime: 'Microsoft.AspNetCore.App', version: '10.0.1', root: '/usr/share/dotnet/shared/Microsoft.AspNetCore.App' },
			],
		});
	});

	test('treats empty output as an empty inventory', () => {
		assert.deepStrictEqual(parseSdkInventory(''), { kind: 'entries', entries: [] });
		assert.deepStrictEqual(parseSdkInventory('\n  \n'), { kind: 'entries', entries: [] });
	});

	test('deduplicates identical version and root pairs while keeping distinct roots', () => {
		const stdout = '10.0.401 [/a/sdk]\n10.0.401 [/a/sdk]\n10.0.401 [/b/sdk]\n10.0.401 [/a/sdk]\n';
		assert.deepStrictEqual(parseSdkInventory(stdout), {
			kind: 'entries',
			entries: [
				{ version: '10.0.401', root: '/a/sdk' },
				{ version: '10.0.401', root: '/b/sdk' },
			],
		});
	});

	test('orders versions deterministically across releases and prereleases', () => {
		assert.deepStrictEqual(
			[
				compareDotnetVersions('10.0.100', '10.0.100-rc.2.25502.107'),
				compareDotnetVersions('10.0.100-rc.10', '10.0.100-rc.2'),
				compareDotnetVersions('10.0.100+build.1', '10.0.100'),
				compareDotnetVersions('9.0.100', '10.0.401'),
				compareDotnetVersions('10.0.401', '10.0.401'),
			],
			[1, 1, 0, -1, 0],
		);
	});
});

suite('dotnet inventory interpretation', () => {
	test('classifies a missing executable as absence instead of an error', () => {
		assert.deepStrictEqual(interpretSdkInventory(processResult({ exitCode: 1, stderr: 'spawn /opt/dotnet/dotnet ENOENT', failure: 'spawn' })), { kind: 'absent' });
		assert.deepStrictEqual(interpretRuntimeInventory(processResult({ exitCode: 1, stderr: 'spawn /opt/dotnet/dotnet ENOTDIR', failure: 'spawn' })), { kind: 'absent' });
	});

	test('classifies inaccessible, timed-out, and nonzero-exit probes as errors with diagnostics', () => {
		const cases: readonly [IProcessExecutionResult, string][] = [
			[processResult({ exitCode: 1, stderr: 'spawn /usr/bin/dotnet EACCES', failure: 'spawn' }), 'EACCES'],
			[processResult({ exitCode: 1, stderr: 'probe timed out after 10000 ms', failure: 'timeout' }), 'timed out'],
			[processResult({ exitCode: 126, stderr: 'cannot execute binary file: Exec format error' }), 'exited with code 126'],
			[processResult({ exitCode: 1, stderr: 'hostfxr: incompatible host' }), 'exited with code 1'],
		];
		for (const [result, expected] of cases) {
			const outcome = interpretSdkInventory(result);
			assert.deepStrictEqual([outcome.kind, outcome.kind === 'error' && outcome.diagnostic.includes(expected)], ['error', true]);
		}
	});

	test('rejects malformed successful output rather than assuming absence', () => {
		for (const stdout of ['not-a-version [/usr/share/dotnet/sdk]\n', '10.0.401 /usr/share/dotnet/sdk\n', '10.0.401 [relative/sdk]\n', '10.0.401 [/a/sdk] extra\n']) {
			const outcome = parseSdkInventory(stdout);
			assert.deepStrictEqual([outcome.kind, outcome.kind === 'malformed' && outcome.diagnostic.includes('line 1')], ['malformed', true]);
		}
		assert.deepStrictEqual(interpretSdkInventory(processResult({ stdout: 'garbage\n', exitCode: 1 })).kind, 'error');
	});

	test('pins the deterministic probe budget', () => {
		assert.strictEqual(DOTNET_PROBE_TOTAL_BUDGET_MS, 60_000);
	});

	test('reports the offending line for malformed SDK and runtime output', () => {
		const sdkCases: readonly [string, string][] = [
			['10.0.401 [/a/sdk]\n10.0.401 []\n', 'line 2'],
			['10.0.401 [/a/sdk]\n../../etc/passwd\n', 'line 2'],
			['10.0.401 [/a/sdk]\n10.0.401 [/b/sdk] /etc/shadow\n', 'line 2'],
			['MISSING-VERSION [/a/sdk]\n', 'line 1'],
		];
		for (const [stdout, expected] of sdkCases) {
			const outcome = parseSdkInventory(stdout);
			assert.deepStrictEqual([outcome.kind, outcome.kind === 'malformed' && outcome.diagnostic.includes(expected)], ['malformed', true]);
		}
		for (const stdout of ['Microsoft.NETCore.App [/a/r]\n', 'Microsoft.NETCore.App 10.0.11 [relative]\n', '10.0.11 [/a/r]\n']) {
			assert.strictEqual(parseRuntimeInventory(stdout).kind, 'malformed');
		}
	});

	test('keeps duplicate versions with distinct roots in stable host order', () => {
		assert.deepStrictEqual(parseSdkInventory('10.0.401 [/z/sdk]\n10.0.401 [/z/sdk]\n10.0.401 [/a/sdk]\n'), {
			kind: 'entries',
			entries: [
				{ version: '10.0.401', root: '/z/sdk' },
				{ version: '10.0.401', root: '/a/sdk' },
			],
		});
	});

	test('bounds diagnostics and never treats a spawn failure without ENOENT as absence', () => {
		const outcome = interpretSdkInventory(processResult({ exitCode: 1, stderr: `spawn /opt/dotnet/dotnet EACCES ${'x'.repeat(5000)}`, failure: 'spawn' }));
		assert.deepStrictEqual(
			[outcome.kind, outcome.kind === 'error' && outcome.diagnostic.length <= 256, interpretSdkInventory(processResult({ exitCode: 1, failure: 'spawn' })).kind],
			['error', true, 'error'],
		);
	});

	test('classifies a wrong-architecture binary as a probe error rather than absence', () => {
		const outcome = interpretSdkInventory(processResult({ exitCode: 126, stderr: 'cannot execute binary file: Exec format error' }));
		assert.deepStrictEqual([outcome.kind, outcome.kind === 'error' && outcome.diagnostic.includes('Exec format error')], ['error', true]);
	});

	test('ranks numeric prerelease identifiers below alphanumeric ones', () => {
		assert.deepStrictEqual(
			[
				compareDotnetVersions('10.0.100-rc.1', '10.0.100-rc.beta'),
				compareDotnetVersions('10.0.100-alpha', '10.0.100-beta'),
				compareDotnetVersions('10.0.100-rc', '10.0.100-rc.1'),
			],
			[-1, -1, -1],
		);
	});
});
