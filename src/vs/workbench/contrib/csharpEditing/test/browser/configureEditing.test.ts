/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	configureCSharpEditing,
	configureCSharpEditingWithToolchainPreflight,
	getCSharpEditingFailureRepairAction,
	ICSharpEditingAcquisitionServices,
	ICSharpEditingInstalledPackages,
} from '../../browser/configureEditing.js';
import { CSharpEditingConfigurationOwner, IProfileSettingSnapshot } from '../../browser/profileConfiguration.js';
import {
	CSHARP_EDITING_CLIENT_ID,
	CSHARP_EDITING_CLIENT_VERSION,
	CSHARP_EDITING_CONFIGURATION_DEFAULTS,
	CSHARP_EDITING_RUNTIME_ID,
	CSHARP_EDITING_RUNTIME_VERSION,
} from '../../common/editingPolicy.js';

const profileId = 'profile-1';
const existingPackages: ICSharpEditingInstalledPackages = {
	client: { id: CSHARP_EDITING_CLIENT_ID, version: CSHARP_EDITING_CLIENT_VERSION, enabled: true },
	runtime: { id: CSHARP_EDITING_RUNTIME_ID, version: CSHARP_EDITING_RUNTIME_VERSION, enabled: true },
};

function services(options: {
	packages?: ICSharpEditingInstalledPackages;
	galleryFailure?: string;
	installFailure?: string;
	galleryEntry?: { readonly id: string; readonly version: string; readonly handle: object };
	configurationProfileId?: string;
	journalProfileId?: string;
	unregisteredSettings?: readonly string[];
	uninstalledOwners?: readonly CSharpEditingConfigurationOwner[];
	journal?: unknown;
} = {}): ICSharpEditingAcquisitionServices & {
	settings: Map<string, IProfileSettingSnapshot>;
	journal: unknown;
	unrelated: Map<string, string>;
	calls: string[];
} {
	const settings = new Map<string, IProfileSettingSnapshot>();
	const unrelated = new Map([['editor.fontSize', '14'], ['unrelated.secret', 'sentinel']]);
	const calls: string[] = [];
	let journal: unknown = options.journal;
	let packageState = options.packages ?? { client: undefined, runtime: undefined };
	const galleryEntry = options.galleryEntry ?? { id: CSHARP_EDITING_CLIENT_ID, version: CSHARP_EDITING_CLIENT_VERSION, handle: {} };

	return {
		profileId,
		configurationProfileId: options.configurationProfileId ?? profileId,
		journalProfileId: options.journalProfileId ?? profileId,
		settings,
		get journal() { return journal; },
		unrelated,
		calls,
		async readInstalledPackages() {
			calls.push('packages:read');
			return packageState;
		},
		async getAnonymousOpenVSXExtension(id, version) {
			calls.push(`gallery:${id}@${version}`);
			if (options.galleryFailure) {
				throw { code: options.galleryFailure };
			}
			return galleryEntry;
		},
		async installPinnedExtension(extension, request) {
			calls.push(`install:${extension.id}@${extension.version}:${request.profileId}:${request.pinnedVersion}:${request.includeDependencies}:${request.applicationScoped}:${request.workspaceScoped}`);
			if (options.installFailure) {
				throw { code: options.installFailure };
			}
			packageState = existingPackages;
		},
		async readUserProfileSetting(key) {
			calls.push(`config:read:${key}`);
			return settings.get(key) ?? { present: false };
		},
		async writeUserProfileSetting(key, value) {
			calls.push(`config:write:${key}`);
			if (value.present) {
				settings.set(key, value);
			} else {
				settings.delete(key);
			}
		},
		async isConfigurationOwnerInstalled(owner) {
			calls.push(`config:owner:${owner}`);
			if (options.uninstalledOwners?.includes(owner)) {
				return false;
			}
			if (owner === 'solution-explorer') {
				return true;
			}
			const packageInfo = owner === 'csharp-client' ? packageState.client : packageState.runtime;
			const expectedId = owner === 'csharp-client' ? CSHARP_EDITING_CLIENT_ID : CSHARP_EDITING_RUNTIME_ID;
			const expectedVersion = owner === 'csharp-client' ? CSHARP_EDITING_CLIENT_VERSION : CSHARP_EDITING_RUNTIME_VERSION;
			return !!packageInfo?.enabled && packageInfo.id === expectedId && packageInfo.version === expectedVersion;
		},
		async isUserProfileSettingRegistered(key) {
			calls.push(`config:registered:${key}`);
			return !options.unregisteredSettings?.includes(key);
		},
		async readProfileJournal() {
			calls.push('journal:read');
			return journal;
		},
		async writeProfileJournal(value) {
			calls.push('journal:write');
			journal = structuredClone(value);
		},
		async removeProfileJournal() {
			calls.push('journal:remove');
			journal = undefined;
		},
	};
}

suite('C# editing explicit configuration and acquisition', () => {
	test('installs the anonymous pinned client and declared dependencies before journaling registered profile settings', async () => {
		const service = services();
		const result = await configureCSharpEditing(service);

		assert.deepStrictEqual(result, { kind: 'configured', installation: 'installed' });
		assert.deepStrictEqual(Object.fromEntries(Object.keys(CSHARP_EDITING_CONFIGURATION_DEFAULTS).map(key => [key, service.settings.get(key)])), {
			'dotnet.server.useOmnisharp': { present: true, value: false },
			'chat.disableAIFeatures': { present: true, value: true },
			'dotnet.projects.enableAutomaticRestore': { present: true, value: false },
			'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources': { present: true, value: false },
		});
		assert.deepStrictEqual(service.settings.get('dotnetAcquisitionExtension.enableTelemetry'), { present: true, value: false });
		const galleryIndex = service.calls.findIndex(call => call === 'gallery:muhammad-sammy.csharp@2.145.21-g154a82fd27');
		const installIndex = service.calls.findIndex(call => call.startsWith('install:muhammad-sammy.csharp@2.145.21-g154a82fd27'));
		assert.ok(galleryIndex < installIndex && installIndex < service.calls.indexOf('journal:write'));
		assert.ok(installIndex < service.calls.indexOf('config:owner:csharp-client'));
		assert.ok(installIndex < service.calls.indexOf('config:owner:dotnet-runtime'));
		assert.deepStrictEqual(service.unrelated, new Map([['editor.fontSize', '14'], ['unrelated.secret', 'sentinel']]));
	});

	test('runs the local toolchain preflight before package acquisition or profile writes', async () => {
		const service = services();
		const order: string[] = [];
		const toolchain = {
			schemaVersion: 1,
			kind: 'ready',
			locality: 'local',
			profile: 'roslyn-standalone-10',
			executable: '/home/test/dotnet/dotnet',
			root: '/home/test/dotnet',
			sdkVersion: '10.0.401',
			runtimeVersion: '10.0.12',
		} as const;
		const result = await configureCSharpEditingWithToolchainPreflight(
			async () => {
				order.push('toolchain-preflight');
				assert.strictEqual(service.calls.length, 0);
				return toolchain;
			},
			async () => {
				order.push('package-and-profile-configuration');
				return configureCSharpEditing(service);
			},
		);

		assert.deepStrictEqual(order, ['toolchain-preflight', 'package-and-profile-configuration']);
		assert.deepStrictEqual(result, {
			kind: 'configured',
			toolchain,
			configuration: { kind: 'configured', installation: 'installed' },
		});
		assert.ok(service.calls.indexOf('journal:write') > service.calls.indexOf('packages:read'));
	});

	test('reports an absent SDK before package acquisition or profile writes', async () => {
		const service = services();
		let configurationCalled = false;
		const toolchain = { schemaVersion: 1, kind: 'unavailable', reason: 'sdk-not-ready' } as const;
		const result = await configureCSharpEditingWithToolchainPreflight(
			async () => toolchain,
			async () => {
				configurationCalled = true;
				return configureCSharpEditing(service);
			},
		);

		assert.deepStrictEqual(result, { kind: 'toolchain-not-ready', toolchain });
		assert.strictEqual(configurationCalled, false);
		assert.deepStrictEqual(service.calls, []);
	});

	test('does not acquire an already installed supported package or silently enable a disabled profile', async () => {
		const installed = services({ packages: existingPackages });
		assert.deepStrictEqual(await configureCSharpEditing(installed), { kind: 'configured', installation: 'existing' });
		assert.ok(!installed.calls.some(call => call.startsWith('gallery:') || call.startsWith('install:')));

		const disabled = services({ packages: { ...existingPackages, client: { ...existingPackages.client!, enabled: false } } });
		assert.deepStrictEqual(await configureCSharpEditing(disabled), { kind: 'refused', reason: 'client-disabled' });
		assert.strictEqual(disabled.calls.some(call => call.startsWith('config:write:')), false);
	});

	test('stages registered owner settings and reports unregistered schemas pending', async () => {
		const service = services({ unregisteredSettings: ['dotnet.server.useOmnisharp'] });
		assert.deepStrictEqual(await configureCSharpEditing(service), {
			kind: 'pending', installation: 'installed', pendingSettings: ['dotnet.server.useOmnisharp'],
		});
		assert.ok(service.calls.findIndex(call => call.startsWith('install:muhammad-sammy.csharp@2.145.21-g154a82fd27')) < service.calls.indexOf('config:owner:csharp-client'));
		assert.ok(service.calls.findIndex(call => call.startsWith('install:muhammad-sammy.csharp@2.145.21-g154a82fd27')) < service.calls.indexOf('config:owner:dotnet-runtime'));
		assert.strictEqual(service.settings.has('dotnet.server.useOmnisharp'), false);
		assert.deepStrictEqual(service.settings.get('chat.disableAIFeatures'), { present: true, value: true });
		assert.deepStrictEqual(service.settings.get('dotnetAcquisitionExtension.enableTelemetry'), { present: true, value: false });
		assert.ok(service.journal && 'chat.disableAIFeatures' in (service.journal as { settings: Record<string, unknown> }).settings);
	});

	test('keeps the runtime telemetry stage pending until its exact owner registers the schema', async () => {
		const service = services({ unregisteredSettings: ['dotnetAcquisitionExtension.enableTelemetry'] });
		assert.deepStrictEqual(await configureCSharpEditing(service), {
			kind: 'pending', installation: 'installed', pendingSettings: ['dotnetAcquisitionExtension.enableTelemetry'],
		});
		assert.deepStrictEqual(service.settings.get('dotnet.server.useOmnisharp'), { present: true, value: false });
		assert.deepStrictEqual(service.settings.get('chat.disableAIFeatures'), { present: true, value: true });
		assert.strictEqual(service.settings.has('dotnetAcquisitionExtension.enableTelemetry'), false);
		assert.ok(service.journal && !('dotnetAcquisitionExtension.enableTelemetry' in (service.journal as { settings: Record<string, unknown> }).settings));

		const retry = services({ packages: existingPackages, journal: service.journal });
		for (const [key, value] of service.settings) {
			retry.settings.set(key, value);
		}
		assert.deepStrictEqual(await configureCSharpEditing(retry), { kind: 'configured', installation: 'existing' });
		assert.deepStrictEqual(retry.settings.get('dotnetAcquisitionExtension.enableTelemetry'), { present: true, value: false });
		assert.ok(retry.journal && 'dotnetAcquisitionExtension.enableTelemetry' in (retry.journal as { settings: Record<string, unknown> }).settings);
	});

	test('does not write any profile settings when anonymous gallery acquisition fails', async () => {
		for (const service of [services({ galleryFailure: 'Offline' }), services({ installFailure: 'SignatureVerificationFailed' })]) {
			const result = await configureCSharpEditing(service);
			assert.ok(result.kind === 'failed');
			assert.strictEqual(service.calls.some(call => call.startsWith('config:write:')), false);
			assert.strictEqual(service.calls.includes('journal:write'), false);
			assert.strictEqual(service.settings.size, 0);
			assert.strictEqual(service.journal, undefined);
		}
	});

	test('maps gallery and install failures to explicit actions and rolls back profile settings', async () => {
		const galleryFailure = services({ galleryFailure: 'Offline' });
		assert.deepStrictEqual(await configureCSharpEditing(galleryFailure), {
			kind: 'failed', reason: 'offline', action: 'retry-when-online', rollback: 'complete',
		});
		assert.strictEqual(galleryFailure.settings.size, 0);

		const cancelledGallery = services({ galleryFailure: 'AbortError' });
		assert.deepStrictEqual(await configureCSharpEditing(cancelledGallery), {
			kind: 'failed', reason: 'cancelled', action: 'retry-install', rollback: 'complete',
		});
		assert.strictEqual(cancelledGallery.settings.size, 0);

		for (const [code, expected] of [
			['Cancelled', 'retry-install'],
			['Offline', 'retry-when-online'],
			['SignatureVerificationFailed', 'review-profile-signature-workaround'],
			['NotAllowed', 'review-gallery-access'],
		] as const) {
			const service = services({ installFailure: code });
			const result = await configureCSharpEditing(service);
			assert.deepStrictEqual(result, {
				kind: 'failed',
				reason: code === 'Cancelled' ? 'cancelled' : code === 'Offline' ? 'offline' : code === 'SignatureVerificationFailed' ? 'signature-verification' : 'access-denied',
				action: expected,
				rollback: 'complete',
			});
			if (expected === 'review-profile-signature-workaround') {
				assert.strictEqual(getCSharpEditingFailureRepairAction(expected), 'openSignatureSettings');
			}
			assert.strictEqual(service.journal, undefined);
			assert.strictEqual(service.settings.size, 0);
		}
	});

});
