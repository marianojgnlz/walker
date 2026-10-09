/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CSHARP_EDITING_CLIENT_ID, CSHARP_EDITING_CLIENT_VERSION, CSHARP_EDITING_CONFIGURATION_DEFAULTS, CSHARP_EDITING_PROFILE_SETTINGS, CSHARP_EDITING_RUNTIME_ID, CSHARP_EDITING_RUNTIME_VERSION, CSharpEditingSettingKey } from '../common/editingPolicy.js';

export type IProfileSettingSnapshot =
	| { readonly present: false }
	| { readonly present: true; readonly value: unknown };

export type CSharpEditingRuntimeSettingKey = 'dotnet.server.path' | 'dotnet.server.environmentVariables' | 'dotnet.server.crashDumpPath' | 'dotnetAcquisitionExtension.existingDotnetPath' | 'dotnetAcquisitionExtension.allowInvalidPaths';
export type CSharpEditingRuntimeTelemetrySettingKey = 'dotnetAcquisitionExtension.enableTelemetry';
export type CSharpEditingProfileSettingKey = CSharpEditingSettingKey | CSharpEditingRuntimeSettingKey;
export type CSharpEditingConfigurationOwner = 'solution-explorer' | 'csharp-client' | 'dotnet-runtime';

export const CSHARP_EDITING_CONFIGURATION_OWNERS = {
	'solution-explorer': { id: 'vscode.solution-explorer', version: '0.0.1' },
	'csharp-client': { id: CSHARP_EDITING_CLIENT_ID, version: CSHARP_EDITING_CLIENT_VERSION },
	'dotnet-runtime': { id: CSHARP_EDITING_RUNTIME_ID, version: CSHARP_EDITING_RUNTIME_VERSION },
} as const;

const configurationOwnerBySetting: Record<CSharpEditingProfileSettingKey, CSharpEditingConfigurationOwner> = {
	'dotnet.server.useOmnisharp': 'csharp-client',
	'chat.disableAIFeatures': 'solution-explorer',
	'dotnet.projects.enableAutomaticRestore': 'csharp-client',
	'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources': 'csharp-client',
	'dotnetAcquisitionExtension.enableTelemetry': 'dotnet-runtime',
	'dotnet.server.path': 'csharp-client',
	'dotnet.server.environmentVariables': 'csharp-client',
	'dotnet.server.crashDumpPath': 'csharp-client',
	'dotnetAcquisitionExtension.existingDotnetPath': 'dotnet-runtime',
	'dotnetAcquisitionExtension.allowInvalidPaths': 'dotnet-runtime',
};

export interface ICSharpEditingConfigurationJournalEntry {
	readonly value: unknown;
	readonly previous: IProfileSettingSnapshot;
}

export interface ICSharpEditingConfigurationJournal {
	readonly version: 1;
	readonly profileId: string;
	readonly settings: Partial<Record<CSharpEditingProfileSettingKey, ICSharpEditingConfigurationJournalEntry>>;
}

export interface IProfileConfigurationServices {
	readonly profileId: string;
	readonly configurationProfileId: string;
	readonly journalProfileId: string;
	readUserProfileSetting(key: CSharpEditingProfileSettingKey): Promise<IProfileSettingSnapshot>;
	writeUserProfileSetting(key: CSharpEditingProfileSettingKey, value: IProfileSettingSnapshot): Promise<void>;
	isConfigurationOwnerInstalled(owner: CSharpEditingConfigurationOwner): Promise<boolean>;
	isUserProfileSettingRegistered(key: CSharpEditingProfileSettingKey): Promise<boolean>;
	readProfileJournal(): Promise<unknown>;
	writeProfileJournal(journal: ICSharpEditingConfigurationJournal): Promise<void>;
	removeProfileJournal(): Promise<void>;
}

export type ProfileConfigurationResult =
	| { readonly kind: 'ready'; readonly pendingSettings?: readonly CSharpEditingProfileSettingKey[] }
	| { readonly kind: 'pending'; readonly pendingSettings: readonly CSharpEditingProfileSettingKey[] }
	| { readonly kind: 'refused'; readonly reason: 'profile-mismatch' | 'journal-invalid' | 'profile-setting-changed' | 'profile-setting-invalid' }
	| { readonly kind: 'failed'; readonly reason: 'configuration-failed' | 'storage-failed'; readonly rollback: 'not-needed' | 'complete' | 'incomplete' };

export type ProfileConfigurationRollbackResult = { readonly kind: 'complete' } | { readonly kind: 'incomplete' };

export interface ICSharpEditingRuntimeProfileValues {
	readonly serverPath: string;
	readonly dotnetRoot: string;
	readonly executable: string;
	readonly existingDotnetPath: readonly { readonly extensionId: string; readonly path: string }[];
}

/** Journals verified child/runtime values before touching only the active user profile. */
export async function configureCSharpEditingRuntimeProfile(services: IProfileConfigurationServices, values: ICSharpEditingRuntimeProfileValues): Promise<ProfileConfigurationResult> {
	if (!hasOneProfile(services) || !isValidRuntimeProfileValues(values)) {
		return { kind: 'refused', reason: 'profile-mismatch' };
	}
	let stored: unknown;
	try {
		stored = await services.readProfileJournal();
	} catch {
		return { kind: 'failed', reason: 'storage-failed', rollback: 'not-needed' };
	}
	if (stored !== undefined && !isJournalForProfile(stored, services.profileId)) {
		return { kind: 'refused', reason: isJournalForAnyProfile(stored) ? 'profile-mismatch' : 'journal-invalid' };
	}
	const previousJournal = stored as ICSharpEditingConfigurationJournal | undefined;
	const pendingSettings: CSharpEditingRuntimeSettingKey[] = [];
	const configuredSettings: CSharpEditingRuntimeSettingKey[] = [];
	try {
		for (const key of runtimeSettingKeys()) {
			if (await isSettingReady(services, key)) {
				configuredSettings.push(key);
			} else {
				pendingSettings.push(key);
			}
		}
	} catch {
		return { kind: 'failed', reason: 'configuration-failed', rollback: 'not-needed' };
	}
	if (configuredSettings.length === 0) {
		return { kind: 'pending', pendingSettings };
	}
	const valuesByKey: Record<CSharpEditingRuntimeSettingKey, unknown> = {
		'dotnet.server.path': values.serverPath,
		'dotnet.server.environmentVariables': { DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_ROOT: values.dotnetRoot, DOTNET_MULTILEVEL_LOOKUP: '0' },
		'dotnet.server.crashDumpPath': '',
		'dotnetAcquisitionExtension.existingDotnetPath': values.existingDotnetPath,
		'dotnetAcquisitionExtension.allowInvalidPaths': false,
	};
	const settings: ICSharpEditingConfigurationJournal['settings'] = { ...previousJournal?.settings };
	try {
		for (const key of configuredSettings) {
			const current = await services.readUserProfileSetting(key);
			if (!isProfileSettingSnapshot(current)) {
				return { kind: 'refused', reason: 'profile-setting-invalid' };
			}
			const previous = previousJournal?.settings[key];
			if (previous && !isUnchangedOrOwnedValue(current, previous)) {
				return { kind: 'refused', reason: 'profile-setting-changed' };
			}
			settings[key] = previous ? { ...previous, value: valuesByKey[key] } : { value: valuesByKey[key], previous: current };
		}
	} catch {
		return { kind: 'failed', reason: 'configuration-failed', rollback: 'not-needed' };
	}
	try {
		await services.writeProfileJournal({ version: 1, profileId: services.profileId, settings });
	} catch {
		return { kind: 'failed', reason: 'storage-failed', rollback: 'not-needed' };
	}
	try {
		for (const key of configuredSettings) {
			if (!await services.isConfigurationOwnerInstalled(configurationOwnerBySetting[key])) {
				const rollback = await rollbackCSharpEditingProfileConfiguration(services);
				return rollback.kind === 'complete'
					? { kind: 'pending', pendingSettings: [...new Set([...pendingSettings, key])] }
					: { kind: 'failed', reason: 'configuration-failed', rollback: rollback.kind };
			}
			await services.writeUserProfileSetting(key, { present: true, value: valuesByKey[key] });
		}
	} catch {
		const rollback = await rollbackCSharpEditingProfileConfiguration(services);
		return { kind: 'failed', reason: 'configuration-failed', rollback: rollback.kind };
	}
	return pendingSettings.length ? { kind: 'pending', pendingSettings } : { kind: 'ready' };
}

/** Applies runtime-extension telemetry suppression only after its exact dependency and setting schema exist. */
export async function configureCSharpEditingRuntimeTelemetryProfile(
	services: IProfileConfigurationServices,
	dependency: { readonly id: string; readonly version: string },
): Promise<ProfileConfigurationResult> {
	const key: CSharpEditingRuntimeTelemetrySettingKey = 'dotnetAcquisitionExtension.enableTelemetry';
	if (!hasOneProfile(services) || dependency.id !== CSHARP_EDITING_RUNTIME_ID || dependency.version !== CSHARP_EDITING_RUNTIME_VERSION) {
		return { kind: 'refused', reason: 'profile-mismatch' };
	}
	let stored: unknown;
	try {
		stored = await services.readProfileJournal();
	} catch {
		return { kind: 'failed', reason: 'storage-failed', rollback: 'not-needed' };
	}
	if (stored !== undefined && !isJournalForProfile(stored, services.profileId)) {
		return { kind: 'refused', reason: isJournalForAnyProfile(stored) ? 'profile-mismatch' : 'journal-invalid' };
	}
	try {
		if (!await isSettingReady(services, key)) {
			return { kind: 'pending', pendingSettings: [key] };
		}
	} catch {
		return { kind: 'failed', reason: 'configuration-failed', rollback: 'not-needed' };
	}
	const previousJournal = stored as ICSharpEditingConfigurationJournal | undefined;
	let current: IProfileSettingSnapshot;
	try {
		current = await services.readUserProfileSetting(key);
	} catch {
		return { kind: 'failed', reason: 'configuration-failed', rollback: 'not-needed' };
	}
	if (!isProfileSettingSnapshot(current) || (current.present && typeof current.value !== 'boolean')) {
		return { kind: 'refused', reason: 'profile-setting-invalid' };
	}
	const previous = previousJournal?.settings[key];
	if (previous && !isUnchangedOrOwnedValue(current, previous)) {
		return { kind: 'refused', reason: 'profile-setting-changed' };
	}
	const settings: ICSharpEditingConfigurationJournal['settings'] = {
		...previousJournal?.settings,
		[key]: previous ? { ...previous, value: false } : { value: false, previous: current },
	};
	try {
		await services.writeProfileJournal({ version: 1, profileId: services.profileId, settings });
	} catch {
		return { kind: 'failed', reason: 'storage-failed', rollback: 'not-needed' };
	}
	try {
		await services.writeUserProfileSetting(key, { present: true, value: false });
	} catch {
		const rollback = await rollbackCSharpEditingProfileConfiguration(services);
		return { kind: 'failed', reason: 'configuration-failed', rollback: rollback.kind };
	}
	return { kind: 'ready' };
}

/** Writes only allowlisted values to the current user profile after a write-ahead journal is durable. */
export async function configureCSharpEditingProfile(services: IProfileConfigurationServices): Promise<ProfileConfigurationResult> {
	if (!hasOneProfile(services)) {
		return { kind: 'refused', reason: 'profile-mismatch' };
	}

	const pendingSettings: CSharpEditingSettingKey[] = [];
	const configuredSettings: CSharpEditingSettingKey[] = [];
	try {
		for (const key of settingKeys()) {
			if (await isSettingReady(services, key)) {
				configuredSettings.push(key);
			} else {
				pendingSettings.push(key);
			}
		}
	} catch {
		return { kind: 'failed', reason: 'configuration-failed', rollback: 'not-needed' };
	}
	if (configuredSettings.length === 0) {
		return { kind: 'pending', pendingSettings };
	}

	let stored: unknown;
	try {
		stored = await services.readProfileJournal();
	} catch {
		return { kind: 'failed', reason: 'storage-failed', rollback: 'not-needed' };
	}
	if (stored !== undefined && !isJournalForProfile(stored, services.profileId)) {
		return { kind: 'refused', reason: isJournalForAnyProfile(stored) ? 'profile-mismatch' : 'journal-invalid' };
	}

	const previousJournal = stored as ICSharpEditingConfigurationJournal | undefined;
	const settings: ICSharpEditingConfigurationJournal['settings'] = { ...previousJournal?.settings };
	try {
		for (const key of configuredSettings) {
			const current = await services.readUserProfileSetting(key);
			if (!isProfileSettingSnapshot(current) || (current.present && typeof current.value !== typeof CSHARP_EDITING_PROFILE_SETTINGS[key])) {
				return { kind: 'refused', reason: 'profile-setting-invalid' };
			}
			const previous = previousJournal?.settings[key];
			if (previous && !isUnchangedOrOwnedValue(current, previous)) {
				return { kind: 'refused', reason: 'profile-setting-changed' };
			}
			settings[key] = previous ? { ...previous, value: CSHARP_EDITING_PROFILE_SETTINGS[key] } : { value: CSHARP_EDITING_PROFILE_SETTINGS[key], previous: current };
		}
	} catch {
		return { kind: 'failed', reason: 'configuration-failed', rollback: 'not-needed' };
	}

	try {
		await services.writeProfileJournal({ version: 1, profileId: services.profileId, settings });
	} catch {
		return { kind: 'failed', reason: 'storage-failed', rollback: 'not-needed' };
	}
	try {
		for (const key of configuredSettings) {
			if (!await services.isConfigurationOwnerInstalled(configurationOwnerBySetting[key])) {
				const rollback = await rollbackCSharpEditingProfileConfiguration(services);
				return rollback.kind === 'complete'
					? { kind: 'pending', pendingSettings: [...new Set([...pendingSettings, key])] }
					: { kind: 'failed', reason: 'configuration-failed', rollback: rollback.kind };
			}
			await services.writeUserProfileSetting(key, { present: true, value: CSHARP_EDITING_PROFILE_SETTINGS[key] });
		}
	} catch {
		const rollback = await rollbackCSharpEditingProfileConfiguration(services);
		return { kind: 'failed', reason: 'configuration-failed', rollback: rollback.kind };
	}
	return pendingSettings.length ? { kind: 'pending', pendingSettings } : { kind: 'ready' };
}

/** Restores unchanged owned values and keeps unresolved entries in the profile journal for retry. */
export async function rollbackCSharpEditingProfileConfiguration(services: IProfileConfigurationServices): Promise<ProfileConfigurationRollbackResult> {
	if (!hasOneProfile(services)) {
		return { kind: 'incomplete' };
	}

	let stored: unknown;
	try {
		stored = await services.readProfileJournal();
	} catch {
		return { kind: 'incomplete' };
	}
	if (stored === undefined) {
		return { kind: 'complete' };
	}
	if (!isJournalForProfile(stored, services.profileId)) {
		return { kind: 'incomplete' };
	}

	const remaining: ICSharpEditingConfigurationJournal['settings'] = {};
	for (const key of profileSettingKeys()) {
		const entry = stored.settings[key];
		if (!entry) {
			continue;
		}
		try {
			const current = await services.readUserProfileSetting(key);
			if (!isProfileSettingSnapshot(current)) {
				remaining[key] = entry;
			} else if (isOwnedValue(current, entry.value)) {
				await services.writeUserProfileSetting(key, entry.previous);
			}
		} catch {
			remaining[key] = entry;
		}
	}

	try {
		if (Object.keys(remaining).length > 0) {
			await services.writeProfileJournal({ ...stored, settings: remaining });
			return { kind: 'incomplete' };
		}
		await services.removeProfileJournal();
		return { kind: 'complete' };
	} catch {
		return { kind: 'incomplete' };
	}
}

function hasOneProfile(services: IProfileConfigurationServices): boolean {
	return services.profileId.length > 0 && services.profileId === services.configurationProfileId && services.profileId === services.journalProfileId;
}

function isOwnedValue(snapshot: IProfileSettingSnapshot, value: unknown): boolean {
	return snapshot.present && JSON.stringify(snapshot.value) === JSON.stringify(value);
}

function isUnchangedOrOwnedValue(snapshot: IProfileSettingSnapshot, entry: ICSharpEditingConfigurationJournalEntry): boolean {
	if (isOwnedValue(snapshot, entry.value)) {
		return true;
	}
	const previous = entry.previous;
	return snapshot.present === previous.present
		&& (!snapshot.present || (previous.present && JSON.stringify(snapshot.value) === JSON.stringify(previous.value)));
}

/** Schema readiness is preflighted before writes; commits only recheck ownership because revocation can unregister settings mid-batch. */
async function isSettingReady(services: IProfileConfigurationServices, key: CSharpEditingProfileSettingKey): Promise<boolean> {
	return await services.isConfigurationOwnerInstalled(configurationOwnerBySetting[key]) && await services.isUserProfileSettingRegistered(key);
}

function settingKeys(): CSharpEditingSettingKey[] {
	return Object.keys(CSHARP_EDITING_CONFIGURATION_DEFAULTS) as CSharpEditingSettingKey[];
}

function runtimeSettingKeys(): CSharpEditingRuntimeSettingKey[] {
	return ['dotnetAcquisitionExtension.existingDotnetPath', 'dotnetAcquisitionExtension.allowInvalidPaths', 'dotnet.server.path', 'dotnet.server.environmentVariables', 'dotnet.server.crashDumpPath'];
}

function profileSettingKeys(): CSharpEditingProfileSettingKey[] {
	return [...Object.keys(CSHARP_EDITING_PROFILE_SETTINGS) as CSharpEditingSettingKey[], ...runtimeSettingKeys()];
}

function isValidRuntimeProfileValues(values: ICSharpEditingRuntimeProfileValues): boolean {
	return values.serverPath.startsWith('/') && !/[\0\r\n]/.test(values.serverPath)
		&& values.dotnetRoot.startsWith('/') && !/[\0\r\n]/.test(values.dotnetRoot)
		&& values.executable.startsWith('/') && !/[\0\r\n]/.test(values.executable)
		&& Array.isArray(values.existingDotnetPath)
		&& values.existingDotnetPath.filter(entry => entry.extensionId === 'muhammad-sammy.csharp' && entry.path === values.executable).length === 1
		&& values.existingDotnetPath.every(entry => typeof entry.extensionId === 'string' && typeof entry.path === 'string');
}

function isJournalForProfile(value: unknown, profileId: string): value is ICSharpEditingConfigurationJournal {
	if (!isJournalForAnyProfile(value) || value.profileId !== profileId) {
		return false;
	}
	for (const key of Object.keys(value.settings)) {
		if (!profileSettingKeys().includes(key as CSharpEditingProfileSettingKey)) {
			return false;
		}
		const settingKey = key as CSharpEditingProfileSettingKey;
		const entry = value.settings[settingKey];
		const validValue = settingKeys().includes(settingKey as CSharpEditingSettingKey)
			? typeof entry?.value === 'boolean' && entry.value === CSHARP_EDITING_PROFILE_SETTINGS[settingKey as CSharpEditingSettingKey]
			: isJsonValue(entry?.value);
		if (!entry || !validValue || !isProfileSettingSnapshot(entry.previous)) {
			return false;
		}
	}
	return true;
}

function isJournalForAnyProfile(value: unknown): value is ICSharpEditingConfigurationJournal {
	if (!isRecord(value) || Object.keys(value).length !== 3 || value.version !== 1 || typeof value.profileId !== 'string' || !isRecord(value.settings)) {
		return false;
	}
	if (!Object.keys(value).every(key => ['version', 'profileId', 'settings'].includes(key))) {
		return false;
	}
	return Object.values(value.settings).every(entry => isRecord(entry) && Object.keys(entry).length === 2 && 'value' in entry && 'previous' in entry);
}

function isProfileSettingSnapshot(value: unknown): value is IProfileSettingSnapshot {
	if (!isRecord(value)) {
		return false;
	}
	return value.present === false
		? Object.keys(value).length === 1
		: value.present === true && Object.keys(value).length === 2 && isJsonValue(value.value);
}

function isJsonValue(value: unknown): boolean {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') {
		return true;
	}
	if (typeof value === 'number') {
		return Number.isFinite(value);
	}
	if (Array.isArray(value)) {
		return value.every(isJsonValue);
	}
	return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
