/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import type { DotnetCandidateOrigin, IDotnetCandidate } from '../candidates';
import type { IEnvironmentAdapter, IProcessExecutionResult } from '../contracts';
import {
	DOTNET_PROBE_COMMAND_TIMEOUT_MS,
	DOTNET_PROBE_TOTAL_BUDGET_MS,
	compareDotnetVersions,
	interpretRuntimeInventory,
	interpretSdkInventory,
	parseRuntimeInventory,
	parseSdkInventory,
	probeDotnetCandidates,
	verifyExpectedManagedSdk,
} from '../probe';
import { createScriptedProcessAdapter, type IScriptedResponse } from './fixtures';

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
		assert.deepStrictEqual([DOTNET_PROBE_TOTAL_BUDGET_MS, DOTNET_PROBE_COMMAND_TIMEOUT_MS], [60_000, 10_000]);
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

suite('dotnet SDK execution readiness', () => {
	const environment: IEnvironmentAdapter = { home: '/home/tëst', platform: 'linux', arch: 'x64', path: '' };
	const ownedCwd = '/tmp/walker-dotnet-probe';
	const managedExecutable = '/home/tëst/.walker/dotnet/dotnet';
	const managedSdkRoot = '/home/tëst/.walker/dotnet/sdk';
	const pathExecutable = '/usr/bin/dotnet';
	const runtimeLine = 'Microsoft.NETCore.App 10.0.11 [/usr/share/dotnet/shared/Microsoft.NETCore.App]\n';

	const makeCandidate = (executable: string, resolvedExecutable = executable, origin: DotnetCandidateOrigin = 'managed'): IDotnetCandidate => ({ executable, resolvedExecutable, origin });
	const inaccessible = (executable: string): IProcessExecutionResult => processResult({ exitCode: 1, stderr: `spawn ${executable} EACCES`, failure: 'spawn' });
	const absent = (): IProcessExecutionResult => processResult({ exitCode: 1, stderr: 'spawn ENOENT', failure: 'spawn' });
	const listResponse = (executable: string, arg: string, result: IProcessExecutionResult): IScriptedResponse => ({ executable, args: [arg], result });
	const sdkList = (executable: string, versions: readonly string[], root = managedSdkRoot): IScriptedResponse =>
		listResponse(executable, '--list-sdks', processResult({ stdout: versions.map(version => `${version} [${root}]\n`).join('') }));
	const runtimeList = (executable: string, stdout = runtimeLine): IScriptedResponse => listResponse(executable, '--list-runtimes', processResult({ stdout }));
	const execSdk = (executable: string, version: string, result: IProcessExecutionResult, root = managedSdkRoot): IScriptedResponse =>
		({ executable, args: ['exec', `${root}/${version}/MSBuild.dll`, '-nologo', '-version'], result });
	const probe = async (responses: readonly IScriptedResponse[], candidates: readonly IDotnetCandidate[], limitReached = false) => {
		const process = createScriptedProcessAdapter(responses);
		const result = await probeDotnetCandidates({ candidates, exclusions: [], limitReached }, { process, environment, cwd: ownedCwd });
		return { process, result };
	};

	test('aggregates runtime-only, host-only, and absent candidates truthfully', async () => {
		const runtimeOnly = await probe([sdkList(pathExecutable, [], '/usr/share/dotnet/sdk'), runtimeList(pathExecutable)], [makeCandidate(pathExecutable, pathExecutable, 'path')]);
		const hostOnly = await probe([sdkList(pathExecutable, [], '/usr/share/dotnet/sdk'), runtimeList(pathExecutable, '')], [makeCandidate(pathExecutable, pathExecutable, 'path')]);
		const nonBase = await probe([sdkList(pathExecutable, [], '/usr/share/dotnet/sdk'), runtimeList(pathExecutable, 'Microsoft.AspNetCore.App 10.0.1 [/usr/share/dotnet/shared/Microsoft.AspNetCore.App]\n')], [makeCandidate(pathExecutable, pathExecutable, 'path')]);
		const missing = await probe([listResponse(pathExecutable, '--list-sdks', absent()), listResponse(pathExecutable, '--list-runtimes', absent())], [makeCandidate(pathExecutable, pathExecutable, 'path')]);
		assert.deepStrictEqual([runtimeOnly.result.outcome.kind, hostOnly.result.outcome.kind, nonBase.result.outcome.kind, missing.result.outcome.kind], ['runtimeOnly', 'missing', 'missing', 'missing']);
		assert.ok(runtimeOnly.process.executions.every(execution => execution.args[0] !== 'exec'));
	});

	test('verifies a listed managed SDK by executing its MSBuild entrypoint in the owned directory', async () => {
		const probed = await probe([sdkList(managedExecutable, ['10.0.401']), runtimeList(managedExecutable), execSdk(managedExecutable, '10.0.401', processResult({ stdout: '10.0.401\n' }))], [makeCandidate(managedExecutable)]);
		assert.deepStrictEqual(probed.result.outcome, { kind: 'ready', executable: managedExecutable, sdkVersion: '10.0.401' });
		assert.deepStrictEqual(probed.process.executions.map(execution => execution.args), [
			['--list-sdks'],
			['--list-runtimes'],
			['exec', `${managedSdkRoot}/10.0.401/MSBuild.dll`, '-nologo', '-version'],
		]);
		for (const execution of probed.process.executions) {
			assert.strictEqual(execution.cwd, ownedCwd);
			assert.strictEqual(execution.timeoutMs, DOTNET_PROBE_COMMAND_TIMEOUT_MS);
			assert.deepStrictEqual(execution.env, { DOTNET_ROOT: '/home/tëst/.walker/dotnet', DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_MULTILEVEL_LOOKUP: '0' });
		}
	});

	test('treats inaccessible, timed-out, and malformed candidates as detection failures', async () => {
		const cases: readonly [IProcessExecutionResult, string][] = [
			[inaccessible(pathExecutable), 'inventory-error'],
			[processResult({ exitCode: 1, stderr: 'probe timed out after 10000 ms', failure: 'timeout' }), 'inventory-error'],
			[processResult({ stdout: '10.0.401 relative-sdk\n' }), 'inventory-malformed'],
		];
		for (const [failureResult, expectedCode] of cases) {
			const probed = await probe([listResponse(pathExecutable, '--list-sdks', failureResult), runtimeList(pathExecutable)], [makeCandidate(pathExecutable, pathExecutable, 'path')]);
			const outcome = probed.result.outcome;
			assert.deepStrictEqual([outcome.kind, outcome.kind === 'failed' && outcome.code], ['failed', expectedCode]);
		}
	});

	test('reports a verified later SDK while retaining the earlier candidate diagnostic', async () => {
		const probed = await probe([
			listResponse(pathExecutable, '--list-sdks', inaccessible(pathExecutable)),
			listResponse(pathExecutable, '--list-runtimes', inaccessible(pathExecutable)),
			sdkList(managedExecutable, ['10.0.401']),
			runtimeList(managedExecutable),
			execSdk(managedExecutable, '10.0.401', processResult()),
		], [makeCandidate(pathExecutable, pathExecutable, 'path'), makeCandidate(managedExecutable)]);
		assert.deepStrictEqual([probed.result.outcome.kind, probed.result.outcome.kind === 'ready' && probed.result.outcome.executable], ['ready', managedExecutable]);
		assert.ok(probed.result.diagnostics.some(line => line.includes(pathExecutable) && line.includes('EACCES')));
	});

	test('keeps the verified SDK decision while later failing candidates still report', async () => {
		const probed = await probe([
			sdkList(managedExecutable, ['10.0.401']),
			runtimeList(managedExecutable),
			execSdk(managedExecutable, '10.0.401', processResult()),
			listResponse(pathExecutable, '--list-sdks', inaccessible(pathExecutable)),
			listResponse(pathExecutable, '--list-runtimes', inaccessible(pathExecutable)),
		], [makeCandidate(managedExecutable), makeCandidate(pathExecutable, pathExecutable, 'path')]);
		assert.deepStrictEqual([probed.result.outcome.kind, probed.result.outcome.kind === 'ready' && probed.result.outcome.sdkVersion, probed.result.diagnostics.some(line => line.includes(pathExecutable) && line.includes('EACCES'))], ['ready', '10.0.401', true]);
	});

	test('fails when listed SDKs cannot execute even though the host has a runtime', async () => {
		const probed = await probe([sdkList(managedExecutable, ['10.0.401']), runtimeList(managedExecutable), execSdk(managedExecutable, '10.0.401', processResult({ exitCode: 1, stderr: 'The framework was not found' }))], [makeCandidate(managedExecutable)]);
		const outcome = probed.result.outcome;
		assert.deepStrictEqual([outcome.kind, outcome.kind === 'failed' && outcome.code, probed.result.diagnostics.some(line => line.includes('usable runtime'))], ['failed', 'sdk-not-executable', true]);
	});

	test('falls back to an older usable SDK internally without exposing the failed newest entry', async () => {
		const probed = await probe([
			sdkList(managedExecutable, ['10.0.401', '9.0.100']),
			runtimeList(managedExecutable),
			execSdk(managedExecutable, '10.0.401', processResult({ exitCode: 1, stderr: 'hostfxr: incompatible host' })),
			execSdk(managedExecutable, '9.0.100', processResult()),
		], [makeCandidate(managedExecutable)]);
		assert.deepStrictEqual(probed.result.outcome, { kind: 'ready', executable: managedExecutable, sdkVersion: '9.0.100' });
		assert.strictEqual(probed.process.executions.filter(execution => execution.args[0] === 'exec').length, 2);
		assert.ok(probed.result.diagnostics.some(line => line.includes('10.0.401')));
	});

	test('never executes a listed SDK root outside the resolved installation root', async () => {
		for (const root of ['/etc/dotnet/sdk', `${managedSdkRoot}/../../../etc`]) {
			const probed = await probe([sdkList(pathExecutable, ['10.0.401'], root), runtimeList(pathExecutable)], [makeCandidate(pathExecutable, '/usr/share/dotnet/dotnet', 'path')]);
			const outcome = probed.result.outcome;
			assert.deepStrictEqual([outcome.kind, outcome.kind === 'failed' && outcome.code, probed.process.executions.some(execution => execution.args[0] === 'exec')], ['failed', 'sdk-path-outside-root', false]);
		}
	});

	test('turns unverified caps and exhausted budgets into truthful detection failures', async () => {
		const capped = await probe([], [], true);
		assert.deepStrictEqual([capped.result.outcome.kind, capped.result.outcome.kind === 'failed' && capped.result.outcome.code], ['failed', 'candidate-limit']);

		const budgetProcess = createScriptedProcessAdapter([]);
		const budgetResult = await probeDotnetCandidates({ candidates: [makeCandidate(managedExecutable)], exclusions: [], limitReached: false }, { process: budgetProcess, environment, cwd: ownedCwd, overallBudgetMs: 0 });
		assert.deepStrictEqual([budgetResult.outcome.kind, budgetResult.outcome.kind === 'failed' && budgetResult.outcome.code, budgetProcess.executions.length], ['failed', 'probe-budget', 0]);

		const cappedButReady = await probe([sdkList(managedExecutable, ['10.0.401']), runtimeList(managedExecutable), execSdk(managedExecutable, '10.0.401', processResult())], [makeCandidate(managedExecutable)], true);
		assert.deepStrictEqual([cappedButReady.result.outcome.kind, cappedButReady.result.diagnostics.some(line => line.includes('limit'))], ['ready', true]);
	});

	test('bounds probe diagnostics and marks suppression instead of growing without limit', async () => {
		const candidates = Array.from({ length: 40 }, (_, index) => makeCandidate(`/opt/c${index}/dotnet`, `/opt/c${index}/dotnet`, 'system'));
		const responses = candidates.flatMap(candidate => [listResponse(candidate.executable, '--list-sdks', inaccessible(candidate.executable)), listResponse(candidate.executable, '--list-runtimes', inaccessible(candidate.executable))]);
		const probed = await probe(responses, candidates);
		assert.deepStrictEqual([probed.result.outcome.kind, probed.result.diagnostics.length, probed.result.diagnostics[probed.result.diagnostics.length - 1]], ['failed', 33, '[further probe diagnostics suppressed]']);
		assert.ok(probed.result.diagnostics.every(line => line.length <= 200));
	});

	test('uses only the owned probe directory so a workspace global.json cannot influence execution', async () => {
		const probed = await probe([sdkList(managedExecutable, ['10.0.401']), runtimeList(managedExecutable), execSdk(managedExecutable, '10.0.401', processResult())], [makeCandidate(managedExecutable)]);
		assert.strictEqual(probed.result.outcome.kind, 'ready');
		for (const execution of probed.process.executions) {
			assert.strictEqual(execution.cwd, ownedCwd);
			assert.ok(execution.args.every(argument => !argument.includes('global.json') && !argument.includes('workspace')));
		}
	});

	test('pinned install verification accepts only the expected version of the managed candidate', async () => {
		const process = createScriptedProcessAdapter([sdkList(managedExecutable, ['10.0.401', '9.0.100']), runtimeList(managedExecutable), execSdk(managedExecutable, '9.0.100', processResult())]);
		const verified = await verifyExpectedManagedSdk({ candidate: makeCandidate(managedExecutable), expectedVersion: '9.0.100', process, environment, cwd: ownedCwd });
		assert.deepStrictEqual([verified.kind, verified.kind === 'verified' && verified.sdkVersion, process.executions.filter(execution => execution.args[0] === 'exec').length], ['verified', '9.0.100', 1]);

		const missingProcess = createScriptedProcessAdapter([sdkList(managedExecutable, ['10.0.401']), runtimeList(managedExecutable)]);
		const missing = await verifyExpectedManagedSdk({ candidate: makeCandidate(managedExecutable), expectedVersion: '8.0.100', process: missingProcess, environment, cwd: ownedCwd });
		assert.deepStrictEqual([missing.kind, missing.kind === 'failed' && missing.code, missingProcess.executions.some(execution => execution.args[0] === 'exec')], ['failed', 'expected-version-missing', false]);
	});
});
