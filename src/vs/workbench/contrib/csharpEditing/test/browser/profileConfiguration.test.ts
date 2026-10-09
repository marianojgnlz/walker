/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { loadExtensionModuleAfterCSharpEditingAdmission } from '../../../../api/common/extHostExtensionService.js';
import { evaluateCSharpRuntimeDependencyAdmission } from '../../common/editingAdmission.js';
import {
	configureCSharpEditingProfile,
	configureCSharpEditingRuntimeProfile,
	configureCSharpEditingRuntimeTelemetryProfile,
	ICSharpEditingConfigurationJournal,
	IProfileConfigurationServices,
	IProfileSettingSnapshot,
	CSharpEditingConfigurationOwner,
	rollbackCSharpEditingProfileConfiguration,
} from '../../browser/profileConfiguration.js';
import { CSHARP_EDITING_CONFIGURATION_DEFAULTS, CSHARP_EDITING_RUNTIME_ID, CSHARP_EDITING_RUNTIME_VERSION } from '../../common/editingPolicy.js';

const profileId = 'profile-1';

function profileServices(options: {
	storageFailure?: 'read' | 'write' | 'remove';
	configurationFailure?: 'read' | 'write';
	journal?: unknown;
	configurationProfileId?: string;
	journalProfileId?: string;
	unregisteredSettings?: readonly string[];
	uninstalledOwners?: readonly CSharpEditingConfigurationOwner[];
	unregisterAfterWrite?: string;
	uninstallOwnerAfterWrite?: { readonly key: string; readonly owner: CSharpEditingConfigurationOwner };
	schemaSnapshot?: boolean;
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
	let settingSchemasRegistered = true;
	const unavailableOwners = new Set(options.uninstalledOwners ?? []);

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
			if (key === options.unregisterAfterWrite) {
				settingSchemasRegistered = false;
			}
			if (key === options.uninstallOwnerAfterWrite?.key) {
				unavailableOwners.add(options.uninstallOwnerAfterWrite.owner);
			}
		},
		async isConfigurationOwnerInstalled(owner) {
			calls.push(`owner:${owner}`);
			return !unavailableOwners.has(owner);
		},
		async isUserProfileSettingRegistered(key) {
			calls.push(`registered:${key}`);
			return (options.schemaSnapshot || settingSchemasRegistered) && !options.unregisteredSettings?.includes(key);
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
		assert.deepStrictEqual(Object.fromEntries(Object.keys(CSHARP_EDITING_CONFIGURATION_DEFAULTS).map(key => {
			const value = service.settings.get(key);
			return [key, value?.present ? value.value : undefined];
		})), {
			'dotnet.server.useOmnisharp': false,
			'chat.disableAIFeatures': true,
			'dotnet.projects.enableAutomaticRestore': false,
			'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources': false,
		});
		assert.strictEqual(service.settings.has('dotnetAcquisitionExtension.enableTelemetry'), false);
		assert.ok(!('dotnetAcquisitionExtension.enableTelemetry' in (service.journal as ICSharpEditingConfigurationJournal).settings));
		const journal = service.journal as ICSharpEditingConfigurationJournal;
		assert.deepStrictEqual(journal.settings['dotnet.server.useOmnisharp'], {
			value: false,
			previous: { present: true, value: true },
		});
		assert.deepStrictEqual(service.unrelated, new Map([['editor.fontSize', '14'], ['unrelated.secret', 'sentinel']]));
	});

	test('stages registered C# settings while leaving an unregistered owner setting pending', async () => {
		const service = profileServices({ unregisteredSettings: ['dotnet.server.useOmnisharp'] });
		assert.deepStrictEqual(await configureCSharpEditingProfile(service), {
			kind: 'pending', pendingSettings: ['dotnet.server.useOmnisharp'],
		});
		assert.strictEqual(service.settings.has('dotnet.server.useOmnisharp'), false);
		assert.deepStrictEqual(service.settings.get('chat.disableAIFeatures'), { present: true, value: true });
		assert.deepStrictEqual(service.settings.get('dotnet.projects.enableAutomaticRestore'), { present: true, value: false });
		assert.deepStrictEqual(service.settings.get('dotnet.navigation.navigateToSourceLinkAndEmbeddedSources'), { present: true, value: false });
		assert.ok(service.journal && 'chat.disableAIFeatures' in (service.journal as ICSharpEditingConfigurationJournal).settings);

		const retry = profileServices({ journal: service.journal });
		for (const [key, value] of service.settings) {
			retry.settings.set(key, value);
		}
		assert.deepStrictEqual(await configureCSharpEditingProfile(retry), { kind: 'ready' });
		assert.deepStrictEqual(retry.settings.get('dotnet.server.useOmnisharp'), { present: true, value: false });
		assert.ok(retry.journal && Object.keys((retry.journal as ICSharpEditingConfigurationJournal).settings).length === 4);
	});

	test('finishes the preflighted profile batch when admission revocation temporarily unregisters setting schemas', async () => {
		const service = profileServices({ unregisterAfterWrite: 'dotnet.server.useOmnisharp' });

		assert.deepStrictEqual(await configureCSharpEditingProfile(service), { kind: 'ready' });
		assert.deepStrictEqual(Object.fromEntries(Object.keys(CSHARP_EDITING_CONFIGURATION_DEFAULTS).map(key => [key, service.settings.get(key)])), {
			'dotnet.server.useOmnisharp': { present: true, value: false },
			'chat.disableAIFeatures': { present: true, value: true },
			'dotnet.projects.enableAutomaticRestore': { present: true, value: false },
			'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources': { present: true, value: false },
		});
		assert.strictEqual(Object.keys((service.journal as ICSharpEditingConfigurationJournal).settings).length, 4);
	});

	test('rolls back the staged batch if an extension setting owner is removed during writes', async () => {
		const service = profileServices({
			schemaSnapshot: true,
			uninstallOwnerAfterWrite: { key: 'dotnet.server.useOmnisharp', owner: 'csharp-client' },
		});

		assert.deepStrictEqual(await configureCSharpEditingProfile(service), {
			kind: 'pending', pendingSettings: ['dotnet.projects.enableAutomaticRestore'],
		});
		assert.strictEqual(service.settings.size, 0);
		assert.strictEqual(service.journal, undefined);
	});

	test('does not write an extension setting before its exact owner is installed', async () => {
		const service = profileServices({ uninstalledOwners: ['csharp-client'] });
		assert.deepStrictEqual(await configureCSharpEditingProfile(service), {
			kind: 'pending', pendingSettings: [
				'dotnet.server.useOmnisharp',
				'dotnet.projects.enableAutomaticRestore',
				'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources',
			],
		});
		assert.deepStrictEqual(service.settings.get('chat.disableAIFeatures'), { present: true, value: true });
		assert.strictEqual(service.settings.has('dotnet.server.useOmnisharp'), false);
		assert.strictEqual(service.calls.includes('registered:dotnet.server.useOmnisharp'), false);
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
		assert.ok(service.calls.indexOf('journal:write') < service.calls.indexOf('write:dotnetAcquisitionExtension.existingDotnetPath'));
		assert.ok(service.calls.indexOf('write:dotnetAcquisitionExtension.existingDotnetPath') < service.calls.indexOf('write:dotnet.server.path'));
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

	test('persists the requester mapping before dependency module admission', async () => {
		const values = {
			serverPath: '/extensions/csharp/.roslyn/Microsoft.CodeAnalysis.LanguageServer.dll',
			dotnetRoot: '/opt/dotnet',
			executable: '/opt/dotnet/dotnet',
			existingDotnetPath: [{ extensionId: 'muhammad-sammy.csharp', path: '/opt/dotnet/dotnet' }],
		};
		const service = profileServices();
		service.settings.set('dotnetAcquisitionExtension.enableTelemetry', { present: true, value: false });
		assert.deepStrictEqual(await configureCSharpEditingRuntimeProfile(service, values), { kind: 'ready' });
		assert.ok(service.calls.indexOf('write:dotnetAcquisitionExtension.existingDotnetPath') < service.calls.indexOf('write:dotnetAcquisitionExtension.allowInvalidPaths'));
		assert.ok(service.calls.indexOf('write:dotnetAcquisitionExtension.allowInvalidPaths') < service.calls.indexOf('write:dotnet.server.path'));

		const order: string[] = [];
		const runtime = {
			identifier: new ExtensionIdentifier(CSHARP_EDITING_RUNTIME_ID),
			version: CSHARP_EDITING_RUNTIME_VERSION,
			extensionLocation: URI.file('/extensions/dotnet-runtime'),
			displayName: '.NET Install Tool',
		};
		const loaded = await loadExtensionModuleAfterCSharpEditingAdmission(runtime, {
			$checkCSharpEditingAdmission: async () => {
				const mapping = service.settings.get('dotnetAcquisitionExtension.existingDotnetPath');
				const allowInvalidPaths = service.settings.get('dotnetAcquisitionExtension.allowInvalidPaths');
				const mappingPersisted = mapping?.present === true && allowInvalidPaths?.present === true && allowInvalidPaths.value === false;
				order.push(mappingPersisted ? 'mapping-persisted-before-admission' : 'mapping-missing');
				const admission = evaluateCSharpRuntimeDependencyAdmission({
					runtimeDependency: { id: CSHARP_EDITING_RUNTIME_ID, version: CSHARP_EDITING_RUNTIME_VERSION, enabled: true },
					hostKind: 'local', platform: 'linux', architecture: 'x64',
					telemetrySetting: { registered: true, profileValue: false, effectiveValues: [false] },
					runtimeMapping: { eligible: mappingPersisted },
					inheritedEnvironmentVariableNames: [],
				});
				return admission.eligible ? { allowed: true, generation: 0 } : { allowed: false, generation: 0, reason: 'no-permit' };
			},
		}, 'local', 0, async () => {
			order.push('dependency-module-loaded');
			return 'runtime-module';
		});

		assert.deepStrictEqual({ module: loaded.module, order }, {
			module: 'runtime-module',
			order: ['mapping-persisted-before-admission', 'dependency-module-loaded'],
		});
	});

	test('resumes a partially persisted runtime profile without overwriting user edits', async () => {
		const values = {
			serverPath: '/extensions/csharp/.roslyn/Microsoft.CodeAnalysis.LanguageServer.dll',
			dotnetRoot: '/opt/dotnet',
			executable: '/opt/dotnet/dotnet',
			existingDotnetPath: [{ extensionId: 'muhammad-sammy.csharp', path: '/opt/dotnet/dotnet' }],
		};
		const environment = { DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_ROOT: values.dotnetRoot, DOTNET_MULTILEVEL_LOOKUP: '0' };
		const journal: ICSharpEditingConfigurationJournal = {
			version: 1,
			profileId,
			settings: {
				'dotnetAcquisitionExtension.existingDotnetPath': { value: values.existingDotnetPath, previous: { present: false } },
				'dotnetAcquisitionExtension.allowInvalidPaths': { value: false, previous: { present: false } },
				'dotnet.server.path': { value: values.serverPath, previous: { present: false } },
				'dotnet.server.environmentVariables': { value: environment, previous: { present: false } },
				'dotnet.server.crashDumpPath': { value: '', previous: { present: false } },
			},
		};
		const service = profileServices({ journal });
		service.settings.set('dotnet.server.path', { present: true, value: values.serverPath });
		service.settings.set('dotnet.server.environmentVariables', { present: true, value: environment });

		assert.deepStrictEqual(await configureCSharpEditingRuntimeProfile(service, values), { kind: 'ready' });
		assert.deepStrictEqual(service.settings.get('dotnetAcquisitionExtension.existingDotnetPath'), { present: true, value: values.existingDotnetPath });
		assert.deepStrictEqual(service.settings.get('dotnetAcquisitionExtension.allowInvalidPaths'), { present: true, value: false });
		assert.ok(service.calls.indexOf('write:dotnetAcquisitionExtension.existingDotnetPath') < service.calls.indexOf('write:dotnet.server.path'));

		const changed = profileServices({ journal });
		changed.settings.set('dotnetAcquisitionExtension.existingDotnetPath', { present: true, value: [{ extensionId: 'muhammad-sammy.csharp', path: '/user/changed/dotnet' }] });
		assert.deepStrictEqual(await configureCSharpEditingRuntimeProfile(changed, values), { kind: 'refused', reason: 'profile-setting-changed' });
		assert.strictEqual(changed.calls.some(call => call.startsWith('write:')), false);
	});

	test('stages owner-registered runtime settings while mapping remains pending', async () => {
		const service = profileServices({ unregisteredSettings: ['dotnetAcquisitionExtension.existingDotnetPath'] });
		const values = {
			serverPath: '/extensions/csharp/.roslyn/Microsoft.CodeAnalysis.LanguageServer.dll',
			dotnetRoot: '/opt/dotnet',
			executable: '/opt/dotnet/dotnet',
			existingDotnetPath: [{ extensionId: 'muhammad-sammy.csharp', path: '/opt/dotnet/dotnet' }],
		};

		assert.deepStrictEqual(await configureCSharpEditingRuntimeProfile(service, values), {
			kind: 'pending', pendingSettings: ['dotnetAcquisitionExtension.existingDotnetPath'],
		});
		assert.deepStrictEqual(service.settings.get('dotnet.server.path'), { present: true, value: values.serverPath });
		assert.deepStrictEqual(service.settings.get('dotnetAcquisitionExtension.allowInvalidPaths'), { present: true, value: false });
		assert.strictEqual(service.settings.has('dotnetAcquisitionExtension.existingDotnetPath'), false);
		assert.ok(service.journal && 'dotnet.server.path' in (service.journal as ICSharpEditingConfigurationJournal).settings);
	});

	test('finishes preflighted runtime mapping writes after admission revocation unregisters extension schemas', async () => {
		const service = profileServices({ unregisterAfterWrite: 'dotnet.server.path' });
		const values = {
			serverPath: '/extensions/csharp/.roslyn/Microsoft.CodeAnalysis.LanguageServer.dll',
			dotnetRoot: '/opt/dotnet',
			executable: '/opt/dotnet/dotnet',
			existingDotnetPath: [{ extensionId: 'muhammad-sammy.csharp', path: '/opt/dotnet/dotnet' }],
		};

		assert.deepStrictEqual(await configureCSharpEditingRuntimeProfile(service, values), { kind: 'ready' });
		assert.deepStrictEqual(service.settings.get('dotnet.server.path'), { present: true, value: values.serverPath });
		assert.deepStrictEqual(service.settings.get('dotnet.server.environmentVariables'), {
			present: true,
			value: { DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_ROOT: '/opt/dotnet', DOTNET_MULTILEVEL_LOOKUP: '0' },
		});
		assert.deepStrictEqual(service.settings.get('dotnetAcquisitionExtension.existingDotnetPath'), { present: true, value: values.existingDotnetPath });
		assert.strictEqual(Object.keys((service.journal as ICSharpEditingConfigurationJournal).settings).length, 5);
	});

	test('reuses the preflighted schema snapshot across profile, telemetry, and runtime mapping stages', async () => {
		const service = profileServices({ unregisterAfterWrite: 'dotnet.server.useOmnisharp', schemaSnapshot: true });
		const values = {
			serverPath: '/extensions/csharp/.roslyn/Microsoft.CodeAnalysis.LanguageServer.dll',
			dotnetRoot: '/opt/dotnet',
			executable: '/opt/dotnet/dotnet',
			existingDotnetPath: [{ extensionId: 'muhammad-sammy.csharp', path: '/opt/dotnet/dotnet' }],
		};

		assert.deepStrictEqual(await configureCSharpEditingProfile(service), { kind: 'ready' });
		assert.deepStrictEqual(await configureCSharpEditingRuntimeTelemetryProfile(service, {
			id: CSHARP_EDITING_RUNTIME_ID, version: CSHARP_EDITING_RUNTIME_VERSION,
		}), { kind: 'ready' });
		assert.deepStrictEqual(await configureCSharpEditingRuntimeProfile(service, values), { kind: 'ready' });
		assert.deepStrictEqual(service.settings.get('dotnetAcquisitionExtension.enableTelemetry'), { present: true, value: false });
		assert.deepStrictEqual(service.settings.get('dotnet.server.path'), { present: true, value: values.serverPath });
		assert.deepStrictEqual(service.settings.get('dotnetAcquisitionExtension.existingDotnetPath'), { present: true, value: values.existingDotnetPath });
		assert.strictEqual(Object.keys((service.journal as ICSharpEditingConfigurationJournal).settings).length, 10);
	});

	test('defers telemetry until the exact runtime dependency and its setting are available', async () => {
		const missingSetting = profileServices({ unregisteredSettings: ['dotnetAcquisitionExtension.enableTelemetry'] });
		assert.deepStrictEqual(await configureCSharpEditingRuntimeTelemetryProfile(missingSetting, {
			id: CSHARP_EDITING_RUNTIME_ID, version: CSHARP_EDITING_RUNTIME_VERSION,
		}), { kind: 'pending', pendingSettings: ['dotnetAcquisitionExtension.enableTelemetry'] });
		assert.strictEqual(missingSetting.calls.some(call => call.startsWith('write:')), false);
		assert.strictEqual(missingSetting.journal, undefined);

		const wrongDependency = profileServices();
		assert.deepStrictEqual(await configureCSharpEditingRuntimeTelemetryProfile(wrongDependency, {
			id: 'other.runtime', version: CSHARP_EDITING_RUNTIME_VERSION,
		}), { kind: 'refused', reason: 'profile-mismatch' });
		assert.strictEqual(wrongDependency.calls.length, 0);

		const missingOwner = profileServices({ uninstalledOwners: ['dotnet-runtime'] });
		assert.deepStrictEqual(await configureCSharpEditingRuntimeTelemetryProfile(missingOwner, {
			id: CSHARP_EDITING_RUNTIME_ID, version: CSHARP_EDITING_RUNTIME_VERSION,
		}), { kind: 'pending', pendingSettings: ['dotnetAcquisitionExtension.enableTelemetry'] });
		assert.strictEqual(missingOwner.calls.some(call => call.startsWith('write:')), false);
		assert.strictEqual(missingOwner.journal, undefined);

		const registered = profileServices();
		registered.settings.set('dotnetAcquisitionExtension.enableTelemetry', { present: true, value: true });
		assert.deepStrictEqual(await configureCSharpEditingRuntimeTelemetryProfile(registered, {
			id: CSHARP_EDITING_RUNTIME_ID, version: CSHARP_EDITING_RUNTIME_VERSION,
		}), { kind: 'ready' });
		assert.deepStrictEqual(registered.settings.get('dotnetAcquisitionExtension.enableTelemetry'), { present: true, value: false });
		const journal = registered.journal as ICSharpEditingConfigurationJournal;
		assert.deepStrictEqual(journal.settings['dotnetAcquisitionExtension.enableTelemetry'], {
			value: false,
			previous: { present: true, value: true },
		});
		assert.ok(registered.calls.indexOf('journal:write') < registered.calls.indexOf('write:dotnetAcquisitionExtension.enableTelemetry'));
		assert.deepStrictEqual(await rollbackCSharpEditingProfileConfiguration(registered), { kind: 'complete' });
		assert.deepStrictEqual(registered.settings.get('dotnetAcquisitionExtension.enableTelemetry'), { present: true, value: true });
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
