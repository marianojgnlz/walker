/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { DOTNET_TOOLCHAIN_COMMANDS, DOTNET_TOOLCHAIN_SCHEMA_VERSION, isDotnetToolchainSnapshot, type DotnetToolchainFailureStage, type IDotnetToolchainSnapshot } from '../contracts';

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
		});
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
