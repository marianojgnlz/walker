/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	DOTNET_INSTALL_SCRIPTS_COMMIT,
	DOTNET_INSTALL_SCRIPT_HOST,
	DOTNET_INSTALL_SCRIPT_PINS,
	dotnetInstallScriptKind,
	dotnetInstallScriptPin,
	validateDotnetInstallScriptPin,
	type DotnetScriptPinRejection,
	type IDotnetInstallScriptPin,
} from '../scriptSource';

function fabricatedPin(overrides: Partial<IDotnetInstallScriptPin>): IDotnetInstallScriptPin {
	return { ...DOTNET_INSTALL_SCRIPT_PINS.unix, ...overrides };
}

function assertRejected(pin: IDotnetInstallScriptPin, rejection: DotnetScriptPinRejection): void {
	const result = validateDotnetInstallScriptPin(pin);
	assert.strictEqual(result.kind, 'invalid', `${pin.url} must be rejected`);
	if (result.kind === 'invalid') {
		assert.strictEqual(result.rejection, rejection);
		assert.ok(result.diagnostic.length > 0, 'a rejection must carry a diagnostic');
	}
}

suite('dotnet install script pins', () => {
	test('pins both official scripts to a reviewed immutable commit with calculated digests', () => {
		for (const pin of [DOTNET_INSTALL_SCRIPT_PINS.unix, DOTNET_INSTALL_SCRIPT_PINS.windows]) {
			assert.match(pin.commit, /^[0-9a-f]{40}$/);
			assert.strictEqual(pin.commit, DOTNET_INSTALL_SCRIPTS_COMMIT);
			assert.match(pin.sha256, /^[0-9a-f]{64}$/);
			assert.strictEqual(pin.url, `https://${DOTNET_INSTALL_SCRIPT_HOST}/dotnet/install-scripts/${pin.commit}/src/${pin.fileName}`);
			assert.strictEqual(validateDotnetInstallScriptPin(pin).kind, 'valid');
		}
		assert.strictEqual(DOTNET_INSTALL_SCRIPT_PINS.unix.fileName, 'dotnet-install.sh');
		assert.strictEqual(DOTNET_INSTALL_SCRIPT_PINS.windows.fileName, 'dotnet-install.ps1');
	});

	test('selects the script kind from the local platform', () => {
		assert.strictEqual(dotnetInstallScriptKind('win32'), 'windows');
		for (const platform of ['linux', 'darwin', 'freebsd'] as const) {
			assert.strictEqual(dotnetInstallScriptKind(platform), 'unix');
		}
		assert.strictEqual(dotnetInstallScriptPin('win32'), DOTNET_INSTALL_SCRIPT_PINS.windows);
		assert.strictEqual(dotnetInstallScriptPin('linux'), DOTNET_INSTALL_SCRIPT_PINS.unix);
	});

	test('accepts only the reviewed HTTPS URL on the immutable commit path', () => {
		assertRejected(fabricatedPin({ url: DOTNET_INSTALL_SCRIPT_PINS.unix.url.replace('https:', 'http:') }), 'scheme');
		assertRejected(fabricatedPin({ url: `https://evil.example.com/dotnet/install-scripts/${DOTNET_INSTALL_SCRIPTS_COMMIT}/src/dotnet-install.sh` }), 'host');
		assertRejected(fabricatedPin({ url: DOTNET_INSTALL_SCRIPT_PINS.unix.url.replace('https://', 'https://alice@') }), 'userinfo');
		assertRejected(fabricatedPin({ url: DOTNET_INSTALL_SCRIPT_PINS.unix.url.replace('/src/dotnet-install.sh', '/src/other.sh') }), 'path');
		assertRejected(fabricatedPin({ url: DOTNET_INSTALL_SCRIPT_PINS.unix.url.replace(DOTNET_INSTALL_SCRIPTS_COMMIT, 'f'.repeat(40)) }), 'path');
		assertRejected(fabricatedPin({ url: 'not a url' }), 'malformed');
	});

	test('rejects malformed commit, digest, and file-name fields', () => {
		assertRejected(fabricatedPin({ commit: DOTNET_INSTALL_SCRIPTS_COMMIT.toUpperCase() }), 'commit');
		assertRejected(fabricatedPin({ commit: DOTNET_INSTALL_SCRIPTS_COMMIT.slice(0, 39) }), 'commit');
		assertRejected(fabricatedPin({ sha256: 'abc' }), 'digest');
		assertRejected(fabricatedPin({ fileName: '../dotnet-install.sh' }), 'path');
	});
});
