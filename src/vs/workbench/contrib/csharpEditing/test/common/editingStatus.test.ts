import * as assert from 'assert';
import { getCSharpEditingRepairActions, getCSharpEditingStatus, getCSharpEditingStatusLabel, ICSharpEditingStatusFacts } from '../../common/editingStatus.js';

const eligible: ICSharpEditingStatusFacts = {
	clientInstalled: true,
	clientEnabled: true,
	supportedHost: true,
	configurationEligible: true,
	toolchainReady: true,
	languageReady: false,
};

suite('C# editing contribution status', () => {
	test('distinguishes missing, disabled, unsupported, conflicted, toolchain, starting, ready, and error', () => {
		assert.strictEqual(getCSharpEditingStatus({ ...eligible, clientInstalled: false }), 'missing');
		assert.strictEqual(getCSharpEditingStatus({ ...eligible, clientEnabled: false }), 'disabled');
		assert.strictEqual(getCSharpEditingStatus({ ...eligible, supportedHost: false }), 'unsupported');
		assert.strictEqual(getCSharpEditingStatus({ ...eligible, configurationEligible: false }), 'conflict');
		assert.strictEqual(getCSharpEditingStatus({ ...eligible, toolchainReady: false }), 'toolchain');
		assert.strictEqual(getCSharpEditingStatus(eligible), 'starting');
		assert.strictEqual(getCSharpEditingStatus({ ...eligible, languageReady: true }), 'ready');
		assert.strictEqual(getCSharpEditingStatus({ ...eligible, error: true }), 'error');
	});

	test('offers explicit repair actions without enabling a disabled extension or adding a debug fallback', () => {
		assert.deepStrictEqual(getCSharpEditingRepairActions('missing'), ['configure']);
		assert.deepStrictEqual(getCSharpEditingRepairActions('disabled'), ['openExtension']);
		assert.deepStrictEqual(getCSharpEditingRepairActions('conflict'), ['configure', 'openSettings', 'reload']);
		assert.deepStrictEqual(getCSharpEditingRepairActions('toolchain'), ['setupSdk', 'recheckSdk', 'showOutput']);
		assert.deepStrictEqual(getCSharpEditingRepairActions('starting'), ['showOutput', 'reload']);
		assert.deepStrictEqual(getCSharpEditingRepairActions('error'), ['configure', 'showOutput', 'reload']);
		assert.deepStrictEqual(getCSharpEditingRepairActions('unsupported'), ['showOutput']);
		assert.deepStrictEqual(getCSharpEditingRepairActions('ready'), []);
	});

	test('provides localized text for every user-visible state', () => {
		for (const status of ['missing', 'disabled', 'conflict', 'unsupported', 'toolchain', 'starting', 'error', 'ready'] as const) {
			const label = getCSharpEditingStatusLabel(status);
			assert.ok(label.length > 0, `${status} must have a localized status label`);
		}
		assert.match(getCSharpEditingStatusLabel('unsupported'), /Linux x64/);
		assert.match(getCSharpEditingStatusLabel('toolchain'), /SDK\/runtime/);
	});
});
