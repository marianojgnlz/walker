/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStringDictionary } from '../../../../base/common/collections.js';
import { IPolicyData } from '../../../../base/common/defaultAccount.js';
import { Emitter } from '../../../../base/common/event.js';
import { equals } from '../../../../base/common/objects.js';
import { ManagedSettingValue, ManagedSettingsData } from '../../../../base/common/policy.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INativeManagedSettingsService, IFileManagedSettingsService, IManagedSettingsPick, IManagedSettingsService, MANAGED_SETTINGS_CHANNELS, ManagedSettingsChannel, collectManagedSettingsDefinitions, hasManagedSettingsDefinitions, hasRawManagedSettings, projectManagedSettings, pickManagedSettings } from '../../../../platform/policy/common/copilotManagedSettings.js';
import { AbstractPolicyService, IPolicyService, PolicyDefinition, PolicyValue, PolicyValueSource } from '../../../../platform/policy/common/policy.js';

interface IResolvedPolicyData {
	readonly policyData: IPolicyData;
	readonly managedSettingResolutions: IManagedSettingsPick['resolutions'];
	readonly activeManagedSettingsSources: readonly ManagedSettingsChannel[];
}

export class AccountPolicyService extends AbstractPolicyService implements IPolicyService, IManagedSettingsService {

	declare readonly _serviceBrand: undefined;

	private _managedSettings: ManagedSettingsData = {};
	private readonly _onDidChangeManagedSettings = this._register(new Emitter<void>());
	readonly onDidChangeManagedSettings = this._onDidChangeManagedSettings.event;

	getManagedSettingValue(key: string): ManagedSettingValue | undefined {
		return this._managedSettings[key];
	}

	private readonly nativeManagedSettingsService?: INativeManagedSettingsService;
	private readonly fileManagedSettingsService?: IFileManagedSettingsService;

	constructor(
		@ILogService private readonly logService: ILogService,
		nativeManagedSettingsService?: INativeManagedSettingsService,
		fileManagedSettingsService?: IFileManagedSettingsService,
	) {
		super();

		this.nativeManagedSettingsService = nativeManagedSettingsService;
		this.fileManagedSettingsService = fileManagedSettingsService;

		this._updatePolicyDefinitions(this.policyDefinitions);
		if (this.nativeManagedSettingsService) {
			this._register(this.nativeManagedSettingsService.onDidChangeManagedSettings(() => {
				this._updatePolicyDefinitions(this.policyDefinitions);
			}));
		}
		if (this.fileManagedSettingsService) {
			this._register(this.fileManagedSettingsService.onDidChangeRawManagedSettings(() => {
				this._updatePolicyDefinitions(this.policyDefinitions);
			}));
		}
	}

	protected async _updatePolicyDefinitions(policyDefinitions: IStringDictionary<PolicyDefinition>): Promise<void> {
		this.logService.trace(`AccountPolicyService#_updatePolicyDefinitions: Got ${Object.keys(policyDefinitions).length} policy definitions`);
		const managedSettings = await this.updateCopilotManagedSettingDefinitions(policyDefinitions);

		const updated: string[] = [];
		const resolvedPolicyData = this.getPolicyData(managedSettings);

		for (const key in policyDefinitions) {
			const resolvedPolicy = this.resolvePolicyValue(policyDefinitions[key], resolvedPolicyData);
			if (this.updatePolicyValue(key, resolvedPolicy?.value, resolvedPolicy?.source)) {
				updated.push(key);
			}
		}

		if (updated.length) {
			this._onDidChange.fire(updated);
		}
	}

	private resolvePolicyValue(policy: PolicyDefinition, resolvedPolicyData: IResolvedPolicyData | undefined): { value: PolicyValue; source: PolicyValueSource } | undefined {
		const valueProvider = policy.value;
		if (!resolvedPolicyData || !valueProvider) {
			return undefined;
		}

		const { policyData, managedSettingResolutions, activeManagedSettingsSources } = resolvedPolicyData;
		const value = valueProvider(policyData);
		if (value === undefined) {
			return undefined;
		}

		let source = PolicyValueSource.Account;
		if (policy.managedSettings) {
			const managedSettings = policyData.managedSettings ?? {};
			const appliedKeys = Object.keys(policy.managedSettings).filter(key => Object.hasOwn(managedSettings, key));
			if (appliedKeys.length > 0) {
				const withoutManagedSettingKeys = (keys: ReadonlySet<string>): IPolicyData => ({
					...policyData,
					managedSettings: Object.fromEntries(Object.entries(managedSettings).filter(([key]) => !keys.has(key))),
				});
				const allAppliedKeys = new Set(appliedKeys);
				if (valueProvider(withoutManagedSettingKeys(allAppliedKeys)) !== value) {
					const contributingChannels = new Set<ManagedSettingsChannel>();
					for (const key of appliedKeys) {
						const channel = managedSettingResolutions.get(key)?.source;
						if (channel) {
							contributingChannels.add(channel);
						}
					}

					const causalChannels = new Set<ManagedSettingsChannel>();
					for (const channel of contributingChannels) {
						const channelKeys = new Set(appliedKeys.filter(key => managedSettingResolutions.get(key)?.source === channel));
						if (valueProvider(withoutManagedSettingKeys(channelKeys)) !== value) {
							causalChannels.add(channel);
						}
					}

					const channels = causalChannels.size > 0 ? causalChannels : contributingChannels;
					source = channels.size === 1
						? policyValueSourceForManagedSettingsChannel(Array.from(channels)[0])
						: PolicyValueSource.MixedManagedSettings;
				}
			}
		}

		// A policy can also react to the mere *presence* of managed settings rather than to a
		// declared key, so probe for that too and attribute it to the governing channels.
		if (source === PolicyValueSource.Account && policyData.managedSettingsActive === true
			&& valueProvider({ ...policyData, managedSettingsActive: false }) !== value) {
			if (activeManagedSettingsSources.length > 0) {
				source = activeManagedSettingsSources.length === 1
					? policyValueSourceForManagedSettingsChannel(activeManagedSettingsSources[0])
					: PolicyValueSource.MixedManagedSettings;
			}
		}

		return { value, source };
	}

	private async updateCopilotManagedSettingDefinitions(policyDefinitions: IStringDictionary<PolicyDefinition>): Promise<ManagedSettingsData | undefined> {
		if (!this.nativeManagedSettingsService || !hasManagedSettingsDefinitions(policyDefinitions)) {
			return this.nativeManagedSettingsService?.managedSettings;
		}

		return this.nativeManagedSettingsService.updatePolicyDefinitions(policyDefinitions);
	}

	private getPolicyData(mdmManagedSettings?: ManagedSettingsData): IResolvedPolicyData | undefined {
		const nativeManagedSettings = mdmManagedSettings ?? this.nativeManagedSettingsService?.managedSettings;
		const fileManagedSettings = this.fileManagedSettingsService?.managedSettings;

		// Share channel resolution, including the force-on sandbox floor, with Policy Diagnostics.
		const pick = pickManagedSettings(nativeManagedSettings, undefined, fileManagedSettings);
		const activeSources = new Set(pick.activeSources);
		if (hasRawManagedSettings(this.fileManagedSettingsService?.rawManagedSettings)) {
			activeSources.add('file');
		}
		const activeManagedSettingsSources = MANAGED_SETTINGS_CHANNELS.filter(source => activeSources.has(source));
		if (!equals(this._managedSettings, pick.values)) {
			this._managedSettings = pick.values;
			this._onDidChangeManagedSettings.fire();
		}
		if (activeManagedSettingsSources.length === 0) {
			return undefined;
		}

		const declaredManagedSettings = collectManagedSettingsDefinitions(this.policyDefinitions);
		const managedSettingsData = projectManagedSettings(
			pick.values,
			declaredManagedSettings,
			msg => this.logService.warn(`[AccountPolicy] ${msg}`)
		);

		return {
			policyData: {
				managedSettings: managedSettingsData,
				managedSettingsActive: true,
			},
			managedSettingResolutions: pick.resolutions,
			activeManagedSettingsSources,
		};
	}
}

function policyValueSourceForManagedSettingsChannel(channel: ManagedSettingsChannel): PolicyValueSource {
	switch (channel) {
		case 'nativeMdm':
			return PolicyValueSource.NativeMdm;
		case 'server':
			return PolicyValueSource.ServerManagedSettings;
		case 'file':
			return PolicyValueSource.FileManagedSettings;
	}
}
