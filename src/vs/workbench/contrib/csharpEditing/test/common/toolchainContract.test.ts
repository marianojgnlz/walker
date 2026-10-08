/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	classifyDotnetEditingHostArguments,
	classifyDotnetEditingHostRequest,
	DOTNET_EDITING_HOST_PROFILE,
	DOTNET_EDITING_HOST_SCHEMA_VERSION,
	DOTNET_TOOLCHAIN_COMMANDS,
	executeDotnetEditingHostCommand,
	isDotnetEditingHostRequest,
	isDotnetEditingHostResult,
} from '../../common/toolchainContract.js';

const request = { schemaVersion: 1, profile: 'roslyn-standalone-10' } as const;
const ready = {
	schemaVersion: 1,
	kind: 'ready',
	locality: 'local',
	profile: 'roslyn-standalone-10',
	executable: '/opt/dotnet/dotnet',
	root: '/opt/dotnet',
	sdkVersion: '10.0.401',
	runtimeVersion: '10.0.12',
} as const;

suite('C# editing toolchain wire-contract parity fixtures', () => {
	test('pins a separate schema, profile and command without changing snapshot v1', () => {
		assert.strictEqual(DOTNET_EDITING_HOST_SCHEMA_VERSION, 1);
		assert.strictEqual(DOTNET_EDITING_HOST_PROFILE, 'roslyn-standalone-10');
		assert.strictEqual(DOTNET_TOOLCHAIN_COMMANDS.resolveEditingHost, 'walker.dotnet.resolveEditingHost');
		assert.strictEqual(DOTNET_TOOLCHAIN_COMMANDS.getState, 'walker.dotnet.getState');
		assert.strictEqual(DOTNET_TOOLCHAIN_COMMANDS.runTemplateOperation, 'walker.dotnet.runTemplateOperation');
		assert.strictEqual(isDotnetEditingHostRequest(request), true);
		assert.deepStrictEqual([
			classifyDotnetEditingHostArguments([]),
			classifyDotnetEditingHostArguments([request]),
			classifyDotnetEditingHostArguments([request, request]),
		], ['malformed-request', 'supported', 'malformed-request']);
	});

	test('separates an unknown profile from malformed or process-capable requests', () => {
		assert.strictEqual(classifyDotnetEditingHostRequest({ schemaVersion: 1, profile: 'future-profile' }), 'unsupported-profile');
		const malformed: readonly unknown[] = [
			undefined, null, [], {}, { ...request, schemaVersion: 2 }, { schemaVersion: 1 },
			{ ...request, executable: '/bin/dotnet' }, { ...request, argv: ['--info'] }, { ...request, cwd: '/tmp' },
			{ ...request, url: 'https://example.invalid' }, { ...request, env: {} }, { ...request, profile: '' },
		];
		assert.deepStrictEqual(malformed.map(classifyDotnetEditingHostRequest), malformed.map(() => 'malformed-request'));
		assert.deepStrictEqual(malformed.map(isDotnetEditingHostRequest), malformed.map(() => false));
	});

	test('accepts only the ready observation and enumerated non-ready results', () => {
		const valid: readonly unknown[] = [
			ready,
			{ schemaVersion: 1, kind: 'unavailable', reason: 'unsupported-host' },
			{ schemaVersion: 1, kind: 'unavailable', reason: 'sdk-not-ready' },
			{ schemaVersion: 1, kind: 'unavailable', reason: 'runtime-incompatible' },
			{ schemaVersion: 1, kind: 'unavailable', reason: 'busy' },
			{ schemaVersion: 1, kind: 'invalid', reason: 'malformed-request' },
			{ schemaVersion: 1, kind: 'invalid', reason: 'unsupported-profile' },
			{ schemaVersion: 1, kind: 'failed', reason: 'recheck-failed' },
			{ schemaVersion: 1, kind: 'failed', reason: 'unsafe-installation' },
			{ schemaVersion: 1, kind: 'failed', reason: 'spawn' },
			{ schemaVersion: 1, kind: 'failed', reason: 'timeout' },
			{ schemaVersion: 1, kind: 'failed', reason: 'invalid-runtime-output' },
		];
		assert.deepStrictEqual(valid.map(value => isDotnetEditingHostResult(value, 'linux')), valid.map(() => true));
		assert.strictEqual(isDotnetEditingHostResult({ ...ready, executable: 'C:\\dotnet\\dotnet.exe', root: 'C:\\dotnet' }, 'win32'), true);
		assert.strictEqual(isDotnetEditingHostResult({ ...ready, executable: 'C:\\DOTNET\\dotnet.exe', root: 'c:\\dotnet' }, 'win32'), true);
	});

	test('core command client sends the fixed request and rejects an invalid result', async () => {
		const calls: unknown[][] = [];
		const result = await executeDotnetEditingHostCommand(async (command, payload) => {
			calls.push([command, payload]);
			return ready;
		}, 'linux');
		assert.deepStrictEqual(result, ready);
		assert.deepStrictEqual(calls, [[DOTNET_TOOLCHAIN_COMMANDS.resolveEditingHost, request]]);
		await assert.rejects(executeDotnetEditingHostCommand(async () => ({ ...ready, argv: ['--info'] }), 'linux'), /Invalid .NET editing-host result/);
		await assert.rejects(executeDotnetEditingHostCommand(async () => ({ schemaVersion: 1, kind: 'invalid', reason: 'unsupported-profile' }), 'linux'), /Invalid .NET editing-host result/);
	});

	test('rejects extra fields, unsafe paths and unstable or incompatible versions', () => {
		const invalid: readonly unknown[] = [
			{ ...ready, argv: ['--info'] }, { ...ready, cwd: '/tmp' }, { ...ready, url: 'https://example.invalid' }, { ...ready, env: {} },
			{ schemaVersion: 1, kind: 'ready', locality: 'local', profile: 'roslyn-standalone-10', executable: '/opt/dotnet/dotnet', sdkVersion: '10.0.401', runtimeVersion: '10.0.12' },
			{ ...ready, locality: 'remote' }, { ...ready, profile: 'other' }, { ...ready, schemaVersion: 2 },
			{ ...ready, executable: '/opt/dotnet-old/dotnet' }, { ...ready, executable: '/opt/dotnet/../outside/dotnet' },
			{ ...ready, root: 'relative/dotnet' }, { ...ready, executable: '/opt/dotnet/dotnet\n' },
			{ ...ready, sdkVersion: '10.0.401-preview.1' }, { ...ready, runtimeVersion: '10.0.4' },
			{ schemaVersion: 1, kind: 'unavailable', reason: 'busy', executable: '/bin/dotnet' },
			{ schemaVersion: 1, kind: 'failed', reason: 'unknown' },
		];
		assert.deepStrictEqual(invalid.map(value => isDotnetEditingHostResult(value, 'linux')), invalid.map(() => false));
		assert.strictEqual(isDotnetEditingHostResult({ ...ready, executable: '/opt/dotnet/dotnet.exe' }, 'win32'), false);
	});
});
