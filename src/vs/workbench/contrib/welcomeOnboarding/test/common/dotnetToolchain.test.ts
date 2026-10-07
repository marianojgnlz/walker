/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import {
	DOTNET_TOOLCHAIN_COMMANDS,
	DOTNET_TOOLCHAIN_SCHEMA_VERSION,
	DOTNET_TOOLCHAIN_STATES,
	isDotnetTemplateOperationRequest,
	isDotnetTemplateOperationResult,
	isDotnetToolchainSnapshot,
	type IDotnetToolchainSnapshot,
} from '../../common/dotnetToolchain.js';

function snapshot(state: IDotnetToolchainSnapshot['state'], revision = 1): IDotnetToolchainSnapshot {
	return {
		schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION,
		revision,
		state,
		locality: 'local',
		...(state === 'ready' ? { verified: { executable: '/home/test/.walker/dotnet/dotnet', sdkVersion: '10.0.401' } } : {}),
	};
}

suite('welcome onboarding .NET toolchain command contract', () => {
	test('matches the extension command ids and snapshot v1 state names', () => {
		assert.deepStrictEqual(DOTNET_TOOLCHAIN_COMMANDS, {
			getState: 'walker.dotnet.getState',
			recheck: 'walker.dotnet.recheck',
			setup: 'walker.dotnet.setup',
			showOutput: 'walker.dotnet.showOutput',
			showActions: 'walker.dotnet.showActions',
			runTemplateOperation: 'walker.dotnet.runTemplateOperation',
		});
		assert.strictEqual(DOTNET_TOOLCHAIN_SCHEMA_VERSION, 1);
		assert.deepStrictEqual(DOTNET_TOOLCHAIN_STATES, [
			'checking', 'ready', 'runtimeOnly', 'missing', 'installing', 'verifying', 'failed', 'unavailable',
		]);
	});

	test('accepts every extension snapshot state and requires verified ready details', () => {
		assert.deepStrictEqual(DOTNET_TOOLCHAIN_STATES.map(state => isDotnetToolchainSnapshot(snapshot(state))), DOTNET_TOOLCHAIN_STATES.map(() => true));
		assert.strictEqual(isDotnetToolchainSnapshot({ ...snapshot('ready'), verified: { executable: '', sdkVersion: '10.0.401' } }), false);
		assert.strictEqual(isDotnetToolchainSnapshot({ ...snapshot('ready'), verified: { executable: '/dotnet', sdkVersion: '' } }), false);
	});

	test('rejects unknown schemas, states, locality, and malformed snapshot details', () => {
		const missing = snapshot('missing');
		const malformed: readonly unknown[] = [
			{ ...missing, schemaVersion: 2 },
			{ ...missing, state: 'complete' },
			{ ...missing, locality: 'remote' },
			{ ...missing, revision: -1 },
			{ ...missing, revision: 1.5 },
			{ ...missing, progress: { phase: 'waiting', otherWindow: false } },
			{ ...missing, failure: { stage: 'unknown', code: 'bad' } },
		];
		assert.deepStrictEqual(malformed.map(isDotnetToolchainSnapshot), malformed.map(() => false));
	});
});

suite('wizard-only template operation contract', () => {
	test('accepts only approved structured operation requests', () => {
		const valid: readonly unknown[] = [
			{ schemaVersion: 1, operation: 'listTemplates' },
			{ schemaVersion: 1, operation: 'help', template: 'webapi' },
			{ schemaVersion: 1, operation: 'help', template: 'razor' },
			{ schemaVersion: 1, operation: 'dryRun', template: 'webapi', name: 'CatalogApi', output: '/tmp/CatalogApi', options: [{ name: 'framework', value: 'net10.0' }] },
			{ schemaVersion: 1, operation: 'generate', template: 'console', name: 'Sample', output: '/tmp/Sample', options: [{ name: 'no-restore' }] },
		];
		const invalid: readonly unknown[] = [
			{ schemaVersion: 1, operation: 'search', query: 'templates' },
			{ schemaVersion: 1, operation: 'help', template: 'https://example.invalid/template' },
			{ schemaVersion: 1, operation: 'generate', template: 'webapi', name: '--force', output: '/tmp/Sample', options: [] },
			{ schemaVersion: 1, operation: 'generate', template: 'webapi', name: 'Sample', output: '/tmp/Sample', executable: '/bin/sh', options: [] },
			{ schemaVersion: 1, operation: 'generate', template: 'webapi', name: 'Sample', output: '/tmp/Sample', options: [{ name: 'install', value: 'https://example.invalid/template' }] },
		];
		assert.deepStrictEqual(valid.map(isDotnetTemplateOperationRequest), valid.map(() => true));
		assert.deepStrictEqual(invalid.map(isDotnetTemplateOperationRequest), invalid.map(() => false));
	});

	test('accepts bounded operation results and rejects malformed output contracts', () => {
		const valid: readonly unknown[] = [
			{ schemaVersion: 1, kind: 'executed', operation: 'listTemplates', exitCode: 0, stdout: 'templates', stderr: '' },
			{ schemaVersion: 1, kind: 'executed', operation: 'generate', exitCode: 1, stdout: '', stderr: 'failed', failure: 'timeout' },
			{ schemaVersion: 1, kind: 'unavailable', reason: 'sdk-not-ready' },
			{ schemaVersion: 1, kind: 'invalid', reason: 'malformed-request' },
		];
		const invalid: readonly unknown[] = [
			{ schemaVersion: 1, kind: 'executed', operation: 'install', exitCode: 0, stdout: '', stderr: '' },
			{ schemaVersion: 1, kind: 'executed', operation: 'help', exitCode: '0', stdout: '', stderr: '' },
			{ schemaVersion: 1, kind: 'executed', operation: 'help', exitCode: 0, stdout: '', stderr: '', environment: { SECRET: 'value' } },
			{ schemaVersion: 1, kind: 'unavailable', reason: 'network' },
		];
		assert.deepStrictEqual(valid.map(isDotnetTemplateOperationResult), valid.map(() => true));
		assert.deepStrictEqual(invalid.map(isDotnetTemplateOperationResult), invalid.map(() => false));
	});
});
