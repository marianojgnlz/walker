/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import {
	DOTNET_TOOLCHAIN_COMMANDS,
	DOTNET_TOOLCHAIN_SCHEMA_VERSION,
	DOTNET_TOOLCHAIN_STATES,
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
