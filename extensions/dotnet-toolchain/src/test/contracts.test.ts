/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	DOTNET_EDITING_HOST_PROFILE,
	DOTNET_EDITING_HOST_SCHEMA_VERSION,
	DOTNET_NEW_TEMPLATE_IDS,
	DOTNET_TOOLCHAIN_COMMANDS,
	DOTNET_TOOLCHAIN_SCHEMA_VERSION,
	classifyDotnetEditingHostArguments,
	classifyDotnetEditingHostRequest,
	isDotnetEditingHostRequest,
	isDotnetEditingHostResult,
	isDotnetTemplateOperationRequest,
	isDotnetToolchainSnapshot,
	type DotnetToolchainFailureStage,
	type IDotnetToolchainSnapshot,
} from '../contracts';

// Local snapshot builders keep this contract suite self-contained; injected process/filesystem
// fixtures and their disposal tests are covered by the separate fixture suite.

/**
 * Builds a snapshot for a completed detection that found no usable toolchain.
 */
function missingSnapshot(revision = 1): IDotnetToolchainSnapshot {
	return { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, revision, state: 'missing', locality: 'local' };
}

/**
 * Builds a snapshot for a usable runtime without an SDK.
 */
function runtimeOnlySnapshot(revision = 1): IDotnetToolchainSnapshot {
	return { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, revision, state: 'runtimeOnly', locality: 'local' };
}

/**
 * Builds a snapshot for a verified SDK, including its actual executable path and version.
 */
function readySnapshot(sdkVersion = '10.0.401', executable = '/home/test/.walker/dotnet/dotnet', revision = 1): IDotnetToolchainSnapshot {
	return { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, revision, state: 'ready', locality: 'local', verified: { executable, sdkVersion } };
}

/**
 * Builds a snapshot for a detection or installation failure with a stage diagnostic.
 */
function failedSnapshot(stage: DotnetToolchainFailureStage = 'detect', code = 'probe-failed', revision = 1): IDotnetToolchainSnapshot {
	return { schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION, revision, state: 'failed', locality: 'local', failure: { stage, code } };
}

suite('dotnet toolchain snapshot v1', () => {
	test('accepts the absence, runtime-only, SDK, and error detection outputs', () => {
		const snapshots = [missingSnapshot(), runtimeOnlySnapshot(), readySnapshot(), failedSnapshot()];
		assert.deepStrictEqual(snapshots.map(snapshot => [snapshot.state, isDotnetToolchainSnapshot(snapshot)]), [
			['missing', true],
			['runtimeOnly', true],
			['ready', true],
			['failed', true],
		]);
	});

	test('accepts every declared state with and without progress detail', () => {
		const snapshots: readonly IDotnetToolchainSnapshot[] = [
			{ ...missingSnapshot(), state: 'checking' },
			missingSnapshot(),
			runtimeOnlySnapshot(),
			readySnapshot('10.0.401', '/home/test/.walker/dotnet/dotnet', 42),
			{ ...missingSnapshot(), state: 'installing', progress: { phase: 'downloading', otherWindow: false } },
			{ ...missingSnapshot(), state: 'verifying', progress: { phase: 'finalizing', otherWindow: true } },
			failedSnapshot('verify', 'sdk-not-usable'),
			{ ...missingSnapshot(), state: 'unavailable' },
		];
		assert.deepStrictEqual(snapshots.map(snapshot => [snapshot.state, isDotnetToolchainSnapshot(snapshot)]), snapshots.map(snapshot => [snapshot.state, true]));
	});

	test('pins the command ids and schema version from the design', () => {
		assert.strictEqual(DOTNET_TOOLCHAIN_SCHEMA_VERSION, 1);
		assert.deepStrictEqual(DOTNET_TOOLCHAIN_COMMANDS, {
			getState: 'walker.dotnet.getState',
			recheck: 'walker.dotnet.recheck',
			setup: 'walker.dotnet.setup',
			showOutput: 'walker.dotnet.showOutput',
			showActions: 'walker.dotnet.showActions',
			runTemplateOperation: 'walker.dotnet.runTemplateOperation',
			resolveEditingHost: 'walker.dotnet.resolveEditingHost',
		});
	});

	test('guards the internal wizard surface to approved templates and structured operations', () => {
		const valid: readonly unknown[] = [
			{ schemaVersion: 1, operation: 'listTemplates' },
			{ schemaVersion: 1, operation: 'help', template: 'webapi' },
			{ schemaVersion: 1, operation: 'help', template: 'razor' },
			{ schemaVersion: 1, operation: 'dryRun', template: 'webapi', name: 'CatalogApi', output: '/tmp/CatalogApi', options: [{ name: 'framework', value: 'net10.0' }] },
			{ schemaVersion: 1, operation: 'generate', template: 'console', name: 'Sample', output: '/tmp/Sample', options: [{ name: 'no-restore' }] },
		];
		const invalid: readonly unknown[] = [
			{ schemaVersion: 1, operation: 'search', query: 'template' },
			{ schemaVersion: 1, operation: 'help', template: 'https://example.invalid/template' },
			{ schemaVersion: 1, operation: 'generate', template: 'webapi', name: '--force', output: '/tmp/Sample', options: [] },
			{ schemaVersion: 1, operation: 'generate', template: 'webapi', name: 'Sample', output: '/tmp/Sample', executable: '/bin/sh', options: [] },
			{ schemaVersion: 1, operation: 'generate', template: 'webapi', name: 'Sample', output: '/tmp/Sample', options: [{ name: 'install', value: 'https://example.invalid/template' }] },
			{ schemaVersion: 1, operation: 'generate', template: 'webapi', name: 'Sample', output: '/tmp/Sample', options: [{ name: 'framework', value: '--force' }] },
		];
		assert.deepStrictEqual(DOTNET_NEW_TEMPLATE_IDS, ['console', 'classlib', 'webapi', 'webapiaot', 'mvc', 'webapp', 'razor', 'blazor', 'blazorwasm', 'worker', 'xunit', 'nunit']);
		assert.deepStrictEqual(valid.map(isDotnetTemplateOperationRequest), valid.map(() => true));
		assert.deepStrictEqual(invalid.map(isDotnetTemplateOperationRequest), invalid.map(() => false));
	});
});

suite('malformed snapshots', () => {
	test('rejects malformed and schema-mismatched snapshots', () => {
		const malformed: readonly unknown[] = [
			undefined,
			null,
			0,
			'ready',
			[],
			{},
			{ ...missingSnapshot(), schemaVersion: 2 },
			{ ...missingSnapshot(), schemaVersion: '1' },
			{ ...missingSnapshot(), revision: -1 },
			{ ...missingSnapshot(), revision: 0.5 },
			{ ...missingSnapshot(), revision: '1' },
			{ ...missingSnapshot(), state: 'done' },
			{ ...missingSnapshot(), state: 'Ready' },
			{ ...missingSnapshot(), locality: 'remote' },
			{ ...readySnapshot(), verified: undefined },
			{ ...readySnapshot(), verified: { executable: '', sdkVersion: '10.0.401' } },
			{ ...missingSnapshot(), verified: 'yes' },
			{ ...failedSnapshot(), failure: { stage: 'unknown' } },
			{ ...failedSnapshot(), failure: { stage: 'detect', code: 7 } },
			{ ...missingSnapshot(), progress: { phase: 'installing' } },
			{ ...missingSnapshot(), progress: { phase: 'waiting', otherWindow: false } },
			{ ...missingSnapshot(), progress: { phase: 'installing', otherWindow: 'no' } },
		];
		assert.deepStrictEqual(malformed.map(value => isDotnetToolchainSnapshot(value)), malformed.map(() => false));
	});
});

suite('dotnet editing-host wire contract v1', () => {
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

	test('uses an independent schema and one exact local-profile request', () => {
		assert.strictEqual(DOTNET_TOOLCHAIN_SCHEMA_VERSION, 1);
		assert.strictEqual(DOTNET_EDITING_HOST_SCHEMA_VERSION, 1);
		assert.strictEqual(DOTNET_EDITING_HOST_PROFILE, 'roslyn-standalone-10');
		assert.strictEqual(classifyDotnetEditingHostRequest(request), 'supported');
		assert.strictEqual(isDotnetEditingHostRequest(request), true);
		assert.deepStrictEqual([
			classifyDotnetEditingHostArguments([]),
			classifyDotnetEditingHostArguments([request]),
			classifyDotnetEditingHostArguments([request, request]),
		], ['malformed-request', 'supported', 'malformed-request']);
		assert.strictEqual(isDotnetToolchainSnapshot(missingSnapshot()), true);
		assert.strictEqual(isDotnetTemplateOperationRequest({ schemaVersion: 1, operation: 'listTemplates' }), true);
	});

	test('distinguishes unsupported profiles from malformed or process-capable requests', () => {
		assert.strictEqual(classifyDotnetEditingHostRequest({ schemaVersion: 1, profile: 'future-profile' }), 'unsupported-profile');
		assert.strictEqual(isDotnetEditingHostRequest({ schemaVersion: 1, profile: 'future-profile' }), false);
		const malformed: readonly unknown[] = [
			undefined, null, [], {}, { ...request, schemaVersion: 2 }, { schemaVersion: 1 },
			{ ...request, executable: '/bin/dotnet' }, { ...request, argv: ['--info'] }, { ...request, cwd: '/tmp' },
			{ ...request, url: 'https://example.invalid' }, { ...request, env: { DOTNET_ROOT: '/tmp' } }, { ...request, profile: '' },
		];
		assert.deepStrictEqual(malformed.map(classifyDotnetEditingHostRequest), malformed.map(() => 'malformed-request'));
		assert.deepStrictEqual(malformed.map(isDotnetEditingHostRequest), malformed.map(() => false));
	});

	test('accepts only exact result variants with a compatible stable local runtime', () => {
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

	test('rejects extra capability fields, unsafe path relations and unstable or too-old versions', () => {
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
		assert.strictEqual(isDotnetEditingHostResult({ ...ready, executable: '/opt/dotnet/dotnet.exe', root: '/opt/dotnet' }, 'win32'), false);
	});
});
