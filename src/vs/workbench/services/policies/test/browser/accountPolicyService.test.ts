/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ManagedSettingsData, PolicyCategory } from '../../../../../base/common/policy.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Extensions, IConfigurationNode, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { DefaultConfiguration, PolicyConfiguration } from '../../../../../platform/configuration/common/configurations.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY, COPILOT_ENABLED_PLUGINS_KEY, COPILOT_SANDBOX_ENABLED_KEY, INativeManagedSettingsService, IFileManagedSettingsService, RawManagedSettingsData, managedSettingsDisabledValue } from '../../../../../platform/policy/common/copilotManagedSettings.js';
import { PolicyDefinition, PolicyValueSource } from '../../../../../platform/policy/common/policy.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { AccountPolicyService } from '../../common/accountPolicyService.js';

suite('AccountPolicyService', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	const logService = new NullLogService();

	const policyConfigurationNode: IConfigurationNode = {
		'id': 'policyConfiguration',
		'order': 1,
		'title': 'a',
		'type': 'object',
		'properties': {
			'setting.A': {
				'type': 'string',
				'default': 'defaultValueA',
				policy: {
					name: 'PolicySettingA',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' } }
				}
			},
			'setting.E': {
				'type': 'boolean',
				'default': true,
			},
			'setting.F': {
				'type': 'boolean',
				'default': true,
				policy: {
					name: 'PolicySettingF',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' } },
					value: policyData => policyData.managedSettings?.[COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY] === 'disable' ? false : undefined,
					managedSettings: {
						[COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: { type: 'string' },
					}
				}
			},
			'setting.G': {
				'type': 'object',
				'additionalProperties': { 'type': 'boolean' },
				'default': {},
				policy: {
					name: 'PolicySettingG',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' } },
					value: policyData => policyData.managedSettings?.[COPILOT_ENABLED_PLUGINS_KEY],
					managedSettings: {
						[COPILOT_ENABLED_PLUGINS_KEY]: { type: 'string' },
					}
				}
			},
			'setting.H': {
				'type': 'boolean',
				'default': true,
				policy: {
					name: 'PolicySettingH',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' } },
					value: managedSettingsDisabledValue,
				}
			},
			'setting.I': {
				'type': 'boolean',
				'default': true,
				policy: {
					name: 'PolicySettingI',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' } },
					value: policyData => policyData.managedSettings?.[COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY] === 'disable'
						&& policyData.managedSettings?.[COPILOT_ENABLED_PLUGINS_KEY] !== undefined ? false : undefined,
					managedSettings: {
						[COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: { type: 'string' },
						[COPILOT_ENABLED_PLUGINS_KEY]: { type: 'string' },
					}
				}
			}
		}
	};

	suiteSetup(() => Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration(policyConfigurationNode));
	suiteTeardown(() => Registry.as<IConfigurationRegistry>(Extensions.Configuration).deregisterConfigurations([policyConfigurationNode]));

	async function createService(nativeManagedSettingsService?: INativeManagedSettingsService, fileManagedSettingsService?: IFileManagedSettingsService) {
		const policyService = disposables.add(new AccountPolicyService(logService, nativeManagedSettingsService, fileManagedSettingsService));
		const defaultConfiguration = disposables.add(new DefaultConfiguration(new NullLogService()));
		await defaultConfiguration.initialize();
		const policyConfiguration = disposables.add(new PolicyConfiguration(defaultConfiguration, policyService, new NullLogService()));
		await policyConfiguration.initialize();
		return { policyService, policyConfiguration };
	}

	test('no managed settings: every managed-settings-driven policy value stays unset', async () => {
		const { policyService, policyConfiguration } = await createService();

		assert.deepStrictEqual({
			A: policyService.getPolicyValue('PolicySettingA'),
			F: policyService.getPolicyValue('PolicySettingF'),
			G: policyService.getPolicyValue('PolicySettingG'),
			H: policyService.getPolicyValue('PolicySettingH'),
			I: policyService.getPolicyValue('PolicySettingI'),
		}, { A: undefined, F: undefined, G: undefined, H: undefined, I: undefined });

		assert.deepStrictEqual({
			A: policyConfiguration.configurationModel.getValue('setting.A'),
			F: policyConfiguration.configurationModel.getValue('setting.F'),
			G: policyConfiguration.configurationModel.getValue('setting.G'),
			H: policyConfiguration.configurationModel.getValue('setting.H'),
		}, { A: undefined, F: undefined, G: undefined, H: undefined });
	});

	test('managed settings: native MDM values drive declared policies', async () => {
		const nativeManagedSettingsService = disposables.add(new FakeNativeManagedSettingsService({ [COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: 'disable' }));
		const { policyService, policyConfiguration } = await createService(nativeManagedSettingsService);

		assert.deepStrictEqual({
			policy: policyService.getPolicyValue('PolicySettingF'),
			source: policyService.getPolicyValueSource('PolicySettingF'),
			configuration: policyConfiguration.configurationModel.getValue('setting.F'),
			registeredManagedSettings: nativeManagedSettingsService.registeredManagedSettings,
		}, {
			policy: false,
			source: PolicyValueSource.NativeMdm,
			configuration: false,
			registeredManagedSettings: {
				[COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: { type: 'string' },
				[COPILOT_ENABLED_PLUGINS_KEY]: { type: 'string' },
			},
		});
	});

	test('managed settings: file-based values drive declared policies', async () => {
		const fileManagedSettingsService = disposables.add(new FakeFileManagedSettingsService({ [COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: 'disable' }));
		const { policyService, policyConfiguration } = await createService(undefined, fileManagedSettingsService);

		assert.deepStrictEqual({
			policy: policyService.getPolicyValue('PolicySettingF'),
			source: policyService.getPolicyValueSource('PolicySettingF'),
			configuration: policyConfiguration.configurationModel.getValue('setting.F'),
		}, {
			policy: false,
			source: PolicyValueSource.FileManagedSettings,
			configuration: false,
		});
	});

	test('managed settings: native MDM value wins over the file for the same declared key', async () => {
		const nativeManagedSettingsService = disposables.add(new FakeNativeManagedSettingsService({ [COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: 'disable' }));
		const fileManagedSettingsService = disposables.add(new FakeFileManagedSettingsService({ [COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: 'enable' }));
		const { policyService } = await createService(nativeManagedSettingsService, fileManagedSettingsService);

		assert.strictEqual(policyService.getPolicyValue('PolicySettingF'), false);
		assert.strictEqual(policyService.getPolicyValueSource('PolicySettingF'), PolicyValueSource.NativeMdm);
	});

	test('managed settings: two-channel precedence preserves the sandbox force-on exception', async () => {
		// Both channels provide the same keys with different values. Native MDM is the higher
		// precedence channel for the gated key, but the runtime-owned sandbox control still wins
		// from the lower channel when it is `true`.
		const fileManagedSettingsService = disposables.add(new FakeFileManagedSettingsService({ [COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: 'file-value', [COPILOT_SANDBOX_ENABLED_KEY]: true }));
		const nativeManagedSettingsService = disposables.add(new FakeNativeManagedSettingsService({ [COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: 'disable', [COPILOT_SANDBOX_ENABLED_KEY]: false }));
		const { policyService } = await createService(nativeManagedSettingsService, fileManagedSettingsService);

		assert.deepStrictEqual({
			policy: policyService.getPolicyValue('PolicySettingF'),
			source: policyService.getPolicyValueSource('PolicySettingF'),
			sandbox: policyService.getManagedSettingValue(COPILOT_SANDBOX_ENABLED_KEY),
		}, {
			policy: false,
			source: PolicyValueSource.NativeMdm,
			sandbox: true,
		});
	});

	test('managed settings: per-key precedence merges across channels — different keys win from different channels', async () => {
		// Native MDM supplies only the disableBypass key; the file supplies only the enabledPlugins
		// key. Neither overrides the other, so BOTH reach policy evaluation: setting F resolves from
		// native MDM and setting G resolves from the file. This is the per-key fill-down behavior.
		const enabledPluginsJson = '{"assign-issue@skills":true}';
		const fileManagedSettingsService = disposables.add(new FakeFileManagedSettingsService({ [COPILOT_ENABLED_PLUGINS_KEY]: enabledPluginsJson }));
		const nativeManagedSettingsService = disposables.add(new FakeNativeManagedSettingsService({ [COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: 'disable' }));
		const { policyService, policyConfiguration } = await createService(nativeManagedSettingsService, fileManagedSettingsService);

		assert.deepStrictEqual({
			settingF: policyConfiguration.configurationModel.getValue('setting.F'),
			settingG: policyConfiguration.configurationModel.getValue('setting.G'),
			sourceF: policyService.getPolicyValueSource('PolicySettingF'),
			sourceG: policyService.getPolicyValueSource('PolicySettingG'),
		}, {
			settingF: false,
			settingG: { 'assign-issue@skills': true },
			sourceF: PolicyValueSource.NativeMdm,
			sourceG: PolicyValueSource.FileManagedSettings,
		});
	});

	test('managed settings: attributes policies caused by multiple channels as mixed', async () => {
		const enabledPluginsJson = '{"assign-issue@skills":true}';
		const fileManagedSettingsService = disposables.add(new FakeFileManagedSettingsService({ [COPILOT_ENABLED_PLUGINS_KEY]: enabledPluginsJson }));
		const nativeManagedSettingsService = disposables.add(new FakeNativeManagedSettingsService({ [COPILOT_DISABLE_BYPASS_PERMISSIONS_MODE_KEY]: 'disable' }));
		const { policyService } = await createService(nativeManagedSettingsService, fileManagedSettingsService);

		assert.deepStrictEqual({
			value: policyService.getPolicyValue('PolicySettingI'),
			source: policyService.getPolicyValueSource('PolicySettingI'),
		}, {
			value: false,
			source: PolicyValueSource.MixedManagedSettings,
		});
	});

	test('managed settings: raw permission rules disable presence-gated settings', async () => {
		const fileManagedSettingsService = disposables.add(new FakeFileManagedSettingsService({}, { permissions: { deny: ['Shell'] } }));
		const { policyService, policyConfiguration } = await createService(undefined, fileManagedSettingsService);

		assert.deepStrictEqual({
			setting: policyConfiguration.configurationModel.getValue('setting.H'),
			value: policyService.getPolicyValue('PolicySettingH'),
			source: policyService.getPolicyValueSource('PolicySettingH'),
		}, {
			setting: false,
			value: false,
			source: PolicyValueSource.FileManagedSettings,
		});
	});

	test('managed settings: removing raw permission rules releases presence-gated settings', async () => {
		const fileManagedSettingsService = disposables.add(new FakeFileManagedSettingsService({}, { permissions: { deny: ['Shell'] } }));
		const { policyService, policyConfiguration } = await createService(undefined, fileManagedSettingsService);

		const change = Event.toPromise(policyService.onDidChange);
		fileManagedSettingsService.setManagedSettings({}, {});
		assert.deepStrictEqual({
			changed: await change,
			setting: policyConfiguration.configurationModel.getValue('setting.H'),
			value: policyService.getPolicyValue('PolicySettingH'),
		}, {
			changed: ['PolicySettingH'],
			setting: undefined,
			value: undefined,
		});
	});

	test('managed settings: sandbox settings disable presence-gated settings even when false', async () => {
		const fileManagedSettingsService = disposables.add(new FakeFileManagedSettingsService({ [COPILOT_SANDBOX_ENABLED_KEY]: false }));
		const { policyService, policyConfiguration } = await createService(undefined, fileManagedSettingsService);

		assert.deepStrictEqual({
			setting: policyConfiguration.configurationModel.getValue('setting.H'),
			value: policyService.getPolicyValue('PolicySettingH'),
			source: policyService.getPolicyValueSource('PolicySettingH'),
		}, {
			setting: false,
			value: false,
			source: PolicyValueSource.FileManagedSettings,
		});
	});

	test('managed settings: an object-typed setting parses an MDM JSON string', async () => {
		// Structured-setting invariant: a canonical JSON string delivered by native MDM is parsed
		// back into the typed object for an `object`-typed setting.
		const json = '{"assign-issue@skills":true,"other@acme":false}';
		const expected = { 'assign-issue@skills': true, 'other@acme': false };
		const nativeManagedSettingsService = disposables.add(new FakeNativeManagedSettingsService({ [COPILOT_ENABLED_PLUGINS_KEY]: json }));
		const { policyConfiguration } = await createService(nativeManagedSettingsService);

		assert.deepStrictEqual(policyConfiguration.configurationModel.getValue('setting.G'), expected);
	});

	class FakeNativeManagedSettingsService implements INativeManagedSettingsService {
		readonly _serviceBrand: undefined;
		private readonly _onDidChangeManagedSettings = new Emitter<ManagedSettingsData>();
		readonly onDidChangeManagedSettings = this._onDidChangeManagedSettings.event;
		registeredManagedSettings: Record<string, { type: 'string' | 'number' | 'boolean' }> = {};

		constructor(public managedSettings: ManagedSettingsData = {}) { }

		async initialize(): Promise<ManagedSettingsData> {
			return this.managedSettings;
		}

		async updatePolicyDefinitions(policyDefinitions: Record<string, PolicyDefinition>): Promise<ManagedSettingsData> {
			this.registeredManagedSettings = {};
			for (const policyName in policyDefinitions) {
				const managedSettings = policyDefinitions[policyName].managedSettings;
				if (managedSettings) {
					for (const key in managedSettings) {
						this.registeredManagedSettings[key] = managedSettings[key];
					}
				}
			}
			return this.managedSettings;
		}

		setManagedSettings(managedSettings: ManagedSettingsData): void {
			this.managedSettings = managedSettings;
			this._onDidChangeManagedSettings.fire(this.managedSettings);
		}

		dispose(): void {
			this._onDidChangeManagedSettings.dispose();
		}
	}

	class FakeFileManagedSettingsService extends Disposable implements IFileManagedSettingsService {
		readonly _serviceBrand: undefined;
		private readonly _onDidChangeRawManagedSettings = this._register(new Emitter<RawManagedSettingsData>());
		readonly onDidChangeRawManagedSettings = this._onDidChangeRawManagedSettings.event;
		readonly onDidChangeManagedSettings = Event.None;

		constructor(
			public managedSettings: ManagedSettingsData = {},
			public rawManagedSettings: RawManagedSettingsData = managedSettings,
		) {
			super();
		}

		async initialize(): Promise<ManagedSettingsData> { return this.managedSettings; }

		setManagedSettings(managedSettings: ManagedSettingsData, rawManagedSettings: RawManagedSettingsData = managedSettings): void {
			this.managedSettings = managedSettings;
			this.rawManagedSettings = rawManagedSettings;
			this._onDidChangeRawManagedSettings.fire(this.rawManagedSettings);
		}
	}
});
