/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CSHARP_EDITING_PROFILE_SETTINGS, CSharpEditingSettingKey } from '../common/editingPolicy.js';

export type IProfileSettingSnapshot =
	| { readonly present: false }
	| { readonly present: true; readonly value: unknown };

export type CSharpEditingRuntimeSettingKey = 'dotnet.server.path' | 'dotnet.server.environmentVariables' | 'dotnet.server.crashDumpPath' | 'dotnetAcquisitionExtension.existingDotnetPath' | 'dotnetAcquisitionExtension.allowInvalidPaths';
type CSharpEditingProfileSettingKey = CSharpEditingSettingKey | CSharpEditingRuntimeSettingKey;

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
	readProfileJournal(): Promise<unknown>;
	writeProfileJournal(journal: ICSharpEditingConfigurationJournal): Promise<void>;
	removeProfileJournal(): Promise<void>;
}

export type ProfileConfigurationResult =
	| { readonly kind: 'ready' }
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
	const valuesByKey: Record<CSharpEditingRuntimeSettingKey, unknown> = {
		'dotnet.server.path': values.serverPath,
		'dotnet.server.environmentVariables': { DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_ROOT: values.dotnetRoot, DOTNET_MULTILEVEL_LOOKUP: '0' },
		'dotnet.server.crashDumpPath': '',
		'dotnetAcquisitionExtension.existingDotnetPath': values.existingDotnetPath,
		'dotnetAcquisitionExtension.allowInvalidPaths': false,
	};
	const settings: ICSharpEditingConfigurationJournal['settings'] = { ...previousJournal?.settings };
	try {
		for (const key of runtimeSettingKeys()) {
			const current = await services.readUserProfileSetting(key);
			if (!isProfileSettingSnapshot(current)) {
				return { kind: 'refused', reason: 'profile-setting-invalid' };
			}
			const previous = previousJournal?.settings[key];
			if (previous && !isOwnedValue(current, previous.value)) {
				return { kind: 'refused', reason: 'profile-setting-changed' };
			}
			settings[key] = previous ?? { value: valuesByKey[key], previous: current };
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
		for (const key of runtimeSettingKeys()) {
			await services.writeUserProfileSetting(key, { present: true, value: valuesByKey[key] });
		}
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
		for (const key of settingKeys()) {
			const current = await services.readUserProfileSetting(key);
			if (!isProfileSettingSnapshot(current) || (current.present && typeof current.value !== typeof CSHARP_EDITING_PROFILE_SETTINGS[key])) {
				return { kind: 'refused', reason: 'profile-setting-invalid' };
			}
			const previous = previousJournal?.settings[key];
			if (previous && !isOwnedValue(current, previous.value)) {
				return { kind: 'refused', reason: 'profile-setting-changed' };
			}
			settings[key] = previous ?? { value: CSHARP_EDITING_PROFILE_SETTINGS[key], previous: current };
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
		for (const key of settingKeys()) {
			await services.writeUserProfileSetting(key, { present: true, value: CSHARP_EDITING_PROFILE_SETTINGS[key] });
		}
	} catch {
		const rollback = await rollbackCSharpEditingProfileConfiguration(services);
		return { kind: 'failed', reason: 'configuration-failed', rollback: rollback.kind };
	}
	return { kind: 'ready' };
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

function settingKeys(): CSharpEditingSettingKey[] {
	return Object.keys(CSHARP_EDITING_PROFILE_SETTINGS) as CSharpEditingSettingKey[];
}

function runtimeSettingKeys(): CSharpEditingRuntimeSettingKey[] {
	return ['dotnet.server.path', 'dotnet.server.environmentVariables', 'dotnet.server.crashDumpPath', 'dotnetAcquisitionExtension.existingDotnetPath', 'dotnetAcquisitionExtension.allowInvalidPaths'];
}

function profileSettingKeys(): CSharpEditingProfileSettingKey[] {
	return [...settingKeys(), ...runtimeSettingKeys()];
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
