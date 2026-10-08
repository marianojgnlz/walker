/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	configureCSharpEditing,
	ICSharpEditingAcquisitionServices,
	ICSharpEditingInstalledPackages,
} from '../../browser/configureEditing.js';
import { IProfileSettingSnapshot } from '../../browser/profileConfiguration.js';
import {
	CSHARP_EDITING_CLIENT_ID,
	CSHARP_EDITING_CLIENT_VERSION,
	CSHARP_EDITING_PROFILE_SETTINGS,
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
} = {}): ICSharpEditingAcquisitionServices & {
	settings: Map<string, IProfileSettingSnapshot>;
	journal: unknown;
	unrelated: Map<string, string>;
	calls: string[];
} {
	const settings = new Map<string, IProfileSettingSnapshot>();
	const unrelated = new Map([['editor.fontSize', '14'], ['unrelated.secret', 'sentinel']]);
	const calls: string[] = [];
	let journal: unknown;
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
	test('installs only the anonymous pinned client and declared dependencies after journaling profile settings', async () => {
		const service = services();
		const result = await configureCSharpEditing(service);

		assert.deepStrictEqual(result, { kind: 'configured', installation: 'installed' });
		assert.deepStrictEqual(Object.fromEntries(Object.keys(CSHARP_EDITING_PROFILE_SETTINGS).map(key => [key, service.settings.get(key)])), {
			'dotnet.server.useOmnisharp': { present: true, value: false },
			'chat.disableAIFeatures': { present: true, value: true },
			'dotnet.projects.enableAutomaticRestore': { present: true, value: false },
			'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources': { present: true, value: false },
			'dotnetAcquisitionExtension.enableTelemetry': { present: true, value: false },
		});
		assert.ok(service.calls.indexOf('journal:write') < service.calls.indexOf('gallery:muhammad-sammy.csharp@2.145.21-g154a82fd27'));
		assert.deepStrictEqual(service.unrelated, new Map([['editor.fontSize', '14'], ['unrelated.secret', 'sentinel']]));
	});

	test('does not acquire an already installed supported package or silently enable a disabled profile', async () => {
		const installed = services({ packages: existingPackages });
		assert.deepStrictEqual(await configureCSharpEditing(installed), { kind: 'configured', installation: 'existing' });
		assert.ok(!installed.calls.some(call => call.startsWith('gallery:') || call.startsWith('install:')));

		const disabled = services({ packages: { ...existingPackages, client: { ...existingPackages.client!, enabled: false } } });
		assert.deepStrictEqual(await configureCSharpEditing(disabled), { kind: 'refused', reason: 'client-disabled' });
		assert.strictEqual(disabled.calls.some(call => call.startsWith('config:write:')), false);
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
			assert.strictEqual(service.journal, undefined);
			assert.strictEqual(service.settings.size, 0);
		}
	});

});
