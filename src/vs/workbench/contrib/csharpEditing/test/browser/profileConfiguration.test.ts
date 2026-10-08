/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	configureCSharpEditingProfile,
	configureCSharpEditingRuntimeProfile,
	ICSharpEditingConfigurationJournal,
	IProfileConfigurationServices,
	IProfileSettingSnapshot,
	rollbackCSharpEditingProfileConfiguration,
} from '../../browser/profileConfiguration.js';
import { CSHARP_EDITING_PROFILE_SETTINGS } from '../../common/editingPolicy.js';

const profileId = 'profile-1';

function profileServices(options: {
	storageFailure?: 'read' | 'write' | 'remove';
	configurationFailure?: 'read' | 'write';
	journal?: unknown;
	configurationProfileId?: string;
	journalProfileId?: string;
} = {}): IProfileConfigurationServices & {
	settings: Map<string, IProfileSettingSnapshot>;
	journal: unknown;
	unrelated: Map<string, string>;
	calls: string[];
} {
	const settings = new Map<string, IProfileSettingSnapshot>();
	const unrelated = new Map([['editor.fontSize', '14'], ['unrelated.secret', 'sentinel']]);
	const calls: string[] = [];
	let journal = options.journal;
	let failedWrite = false;

	return {
		profileId,
		configurationProfileId: options.configurationProfileId ?? profileId,
		journalProfileId: options.journalProfileId ?? profileId,
		settings,
		get journal() { return journal; },
		unrelated,
		calls,
		async readUserProfileSetting(key) {
			calls.push(`read:${key}`);
			if (options.configurationFailure === 'read') {
				throw new Error('configuration read failed');
			}
			return settings.get(key) ?? { present: false };
		},
		async writeUserProfileSetting(key, value) {
			calls.push(`write:${key}`);
			if (options.configurationFailure === 'write' && !failedWrite && key === 'chat.disableAIFeatures') {
				failedWrite = true;
				throw new Error('configuration write failed');
			}
			if (value.present) {
				settings.set(key, value);
			} else {
				settings.delete(key);
			}
		},
		async readProfileJournal() {
			calls.push('journal:read');
			if (options.storageFailure === 'read') {
				throw new Error('journal read failed');
			}
			return journal;
		},
		async writeProfileJournal(value) {
			calls.push('journal:write');
			if (options.storageFailure === 'write') {
				throw new Error('journal write failed');
			}
			journal = structuredClone(value);
		},
		async removeProfileJournal() {
			calls.push('journal:remove');
			if (options.storageFailure === 'remove') {
				throw new Error('journal remove failed');
			}
			journal = undefined;
		},
	};
}

suite('C# editing profile configuration journal', () => {
	test('journals allowlisted values before writing only the active user profile', async () => {
		const service = profileServices();
		service.settings.set('dotnet.server.useOmnisharp', { present: true, value: true });

		assert.deepStrictEqual(await configureCSharpEditingProfile(service), { kind: 'ready' });
		assert.ok(service.calls.indexOf('journal:write') < service.calls.indexOf('write:dotnet.server.useOmnisharp'));
		assert.deepStrictEqual(Object.fromEntries(Object.keys(CSHARP_EDITING_PROFILE_SETTINGS).map(key => {
			const value = service.settings.get(key);
			return [key, value?.present ? value.value : undefined];
		})), {
			'dotnet.server.useOmnisharp': false,
			'chat.disableAIFeatures': true,
			'dotnet.projects.enableAutomaticRestore': false,
			'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources': false,
			'dotnetAcquisitionExtension.enableTelemetry': false,
		});
		const journal = service.journal as ICSharpEditingConfigurationJournal;
		assert.deepStrictEqual(journal.settings['dotnet.server.useOmnisharp'], {
			value: false,
			previous: { present: true, value: true },
		});
		assert.deepStrictEqual(service.unrelated, new Map([['editor.fontSize', '14'], ['unrelated.secret', 'sentinel']]));
	});

	test('fails closed on profile and storage errors and restores partial configuration writes', async () => {
		const profileMismatch = profileServices({ configurationProfileId: 'other-profile' });
		assert.deepStrictEqual(await configureCSharpEditingProfile(profileMismatch), { kind: 'refused', reason: 'profile-mismatch' });
		assert.strictEqual(profileMismatch.calls.length, 0);

		const configurationRead = profileServices({ configurationFailure: 'read' });
		assert.deepStrictEqual(await configureCSharpEditingProfile(configurationRead), {
			kind: 'failed', reason: 'configuration-failed', rollback: 'not-needed',
		});
		const storageRead = profileServices({ storageFailure: 'read' });
		assert.deepStrictEqual(await configureCSharpEditingProfile(storageRead), {
			kind: 'failed', reason: 'storage-failed', rollback: 'not-needed',
		});
		const storageWrite = profileServices({ storageFailure: 'write' });
		assert.deepStrictEqual(await configureCSharpEditingProfile(storageWrite), {
			kind: 'failed', reason: 'storage-failed', rollback: 'not-needed',
		});
		assert.strictEqual(storageWrite.calls.some(call => call.startsWith('write:')), false);

		const configurationWrite = profileServices({ configurationFailure: 'write' });
		assert.deepStrictEqual(await configureCSharpEditingProfile(configurationWrite), {
			kind: 'failed', reason: 'configuration-failed', rollback: 'complete',
		});
		assert.strictEqual(configurationWrite.settings.size, 0);
		assert.strictEqual(configurationWrite.journal, undefined);
	});

	test('rejects invalid journal and non-boolean owned settings without overwriting user state', async () => {
		const invalidJournal = profileServices({ journal: { version: 1, profileId, settings: {}, extra: 'unowned' } });
		assert.deepStrictEqual(await configureCSharpEditingProfile(invalidJournal), { kind: 'refused', reason: 'journal-invalid' });
		const invalidSetting = profileServices();
		invalidSetting.settings.set('chat.disableAIFeatures', { present: true, value: 'user-data' });
		assert.deepStrictEqual(await configureCSharpEditingProfile(invalidSetting), { kind: 'refused', reason: 'profile-setting-invalid' });
		assert.deepStrictEqual(invalidSetting.settings.get('chat.disableAIFeatures'), { present: true, value: 'user-data' });
	});

	test('journals verified child/runtime values and rollback preserves later edits', async () => {
		const service = profileServices();
		const values = {
			serverPath: '/extensions/csharp/.roslyn/Microsoft.CodeAnalysis.LanguageServer.dll',
			dotnetRoot: '/opt/dotnet',
			executable: '/opt/dotnet/dotnet',
			existingDotnetPath: [
				{ extensionId: 'other.publisher', path: '/other/dotnet' },
				{ extensionId: 'muhammad-sammy.csharp', path: '/opt/dotnet/dotnet' },
			],
		};
		const invalidPathService = profileServices();
		assert.deepStrictEqual(await configureCSharpEditingRuntimeProfile(invalidPathService, { ...values, serverPath: `${values.serverPath}\0` }), {
			kind: 'refused', reason: 'profile-mismatch',
		});
		assert.strictEqual(invalidPathService.calls.length, 0);

		assert.deepStrictEqual(await configureCSharpEditingRuntimeProfile(service, values), { kind: 'ready' });
		assert.ok(service.calls.indexOf('journal:write') < service.calls.indexOf('write:dotnet.server.path'));
		assert.deepStrictEqual(service.settings.get('dotnetAcquisitionExtension.existingDotnetPath'), { present: true, value: values.existingDotnetPath });
		assert.deepStrictEqual(service.settings.get('dotnet.server.environmentVariables'), {
			present: true,
			value: { DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_ROOT: '/opt/dotnet', DOTNET_MULTILEVEL_LOOKUP: '0' },
		});
		service.settings.set('dotnet.server.path', { present: true, value: '/user/changed.dll' });

		assert.deepStrictEqual(await rollbackCSharpEditingProfileConfiguration(service), { kind: 'complete' });
		assert.deepStrictEqual(service.settings.get('dotnet.server.path'), { present: true, value: '/user/changed.dll' });
		assert.strictEqual(service.settings.has('dotnetAcquisitionExtension.existingDotnetPath'), false);
		assert.deepStrictEqual(service.unrelated, new Map([['editor.fontSize', '14'], ['unrelated.secret', 'sentinel']]));
	});

	test('rollback restores only unchanged owned values and preserves later edits and unrelated state', async () => {
		const service = profileServices();
		service.settings.set('dotnet.server.useOmnisharp', { present: true, value: true });
		await configureCSharpEditingProfile(service);
		service.settings.set('chat.disableAIFeatures', { present: true, value: false });

		assert.deepStrictEqual(await rollbackCSharpEditingProfileConfiguration(service), { kind: 'complete' });
		assert.deepStrictEqual(service.settings.get('dotnet.server.useOmnisharp'), { present: true, value: true });
		assert.deepStrictEqual(service.settings.get('chat.disableAIFeatures'), { present: true, value: false });
		assert.deepStrictEqual(service.unrelated, new Map([['editor.fontSize', '14'], ['unrelated.secret', 'sentinel']]));
		assert.strictEqual(service.settings.size, 2);
		assert.strictEqual(service.journal, undefined);
	});
});
