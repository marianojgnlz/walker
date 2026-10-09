/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ExtensionIdentifier, IExtensionDescription } from '../../../../platform/extensions/common/extensions.js';
import { IConfigurationChangeEvent } from '../../../../platform/configuration/common/configuration.js';
import { ExtensionHostKind } from '../../../services/extensions/common/extensionHostKind.js';
import { IExtensionService, IExtensionsStatus } from '../../../services/extensions/common/extensions.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { CSharpEditingAdmissionCoordinator, forwardCSharpEditingConfigurationChange, revokeCSharpEditingAdmissionForExtensionChanges } from '../../browser/mainThreadExtensionService.js';

const clientId = 'muhammad-sammy.csharp';
const runtimeId = 'ms-dotnettools.vscode-dotnet-runtime';

function extension(id: string): Pick<IExtensionDescription, 'identifier' | 'version' | 'extensionLocation'> {
	return {
		identifier: new ExtensionIdentifier(id),
		version: id === clientId ? '2.145.21-g154a82fd27' : '3.2.0',
		extensionLocation: URI.file(`/extensions/${id}`),
	};
}

suite('C# editing main-thread admission coordinator', () => {
	test('denies protected identities until an A7 validated permit is supplied', () => {
		const coordinator = new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess);
		for (const id of [clientId, runtimeId]) {
			const installed = extension(id);
			assert.deepStrictEqual(coordinator.check({
				extensionId: id,
				installedVersion: installed.version,
				extensionLocation: installed.extensionLocation,
				hostKind: 'local',
				generation: 0,
			}, installed), { allowed: false, generation: 0, reason: 'no-permit' });
		}
	});

	test('accepts a validated permit only for the current generation', () => {
		const coordinator = new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess);
		const installed = extension(clientId);
		const request = {
			extensionId: clientId,
			installedVersion: installed.version,
			extensionLocation: installed.extensionLocation,
			hostKind: 'local' as const,
			generation: 0,
		};

		assert.deepStrictEqual(coordinator.check(request, installed, true), { allowed: true, generation: 0 });
		coordinator.revoke();
		assert.deepStrictEqual(coordinator.check(request, installed, true), { allowed: false, generation: 1, reason: 'stale-generation' });
	});

	test('checks host locality, package identity, version and location against installed metadata', () => {
		const coordinator = new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess);
		const installed = extension(clientId);
		const request = {
			extensionId: clientId,
			installedVersion: installed.version,
			extensionLocation: installed.extensionLocation,
			hostKind: 'local' as const,
			generation: 0,
		};

		assert.deepStrictEqual(coordinator.check({ ...request, extensionId: 'publisher.other' }, installed), { allowed: false, generation: 0, reason: 'not-protected' });
		assert.deepStrictEqual(coordinator.check({ ...request, installedVersion: '2.145.20' }, installed), { allowed: false, generation: 0, reason: 'identity-mismatch' });
		assert.deepStrictEqual(coordinator.check({ ...request, extensionLocation: URI.file('/elsewhere') }, installed), { allowed: false, generation: 0, reason: 'identity-mismatch' });
		assert.deepStrictEqual(coordinator.check({ ...request, hostKind: 'remote' }, installed), { allowed: false, generation: 0, reason: 'unsupported-host' });
		assert.deepStrictEqual(new CSharpEditingAdmissionCoordinator(ExtensionHostKind.Remote).check(request, installed), { allowed: false, generation: 0, reason: 'unsupported-host' });
	});

	test('rejects stale generations, missing installed metadata and malformed requests', () => {
		const coordinator = new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess);
		const installed = extension(runtimeId);
		const request = {
			extensionId: runtimeId,
			installedVersion: installed.version,
			extensionLocation: installed.extensionLocation,
			hostKind: 'local' as const,
			generation: 0,
		};

		coordinator.revoke();
		assert.deepStrictEqual(coordinator.check(request, installed), { allowed: false, generation: 1, reason: 'stale-generation' });
		assert.deepStrictEqual(coordinator.check({ ...request, generation: 1 }, undefined), { allowed: false, generation: 1, reason: 'revoked' });
		const unblockedCoordinator = new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess);
		assert.deepStrictEqual(unblockedCoordinator.check(request, undefined), { allowed: false, generation: 0, reason: 'identity-mismatch' });
		assert.deepStrictEqual(coordinator.check({ ...request, generation: Number.NaN }, installed), { allowed: false, generation: 1, reason: 'invalid-request' });
	});

	test('revokes stale admission generations when a protected package changes', () => {
		const coordinator = new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess);
		revokeCSharpEditingAdmissionForExtensionChanges(coordinator, [extension('publisher.other')], []);
		assert.strictEqual(coordinator.generation, 0);

		for (const id of [clientId, runtimeId]) {
			revokeCSharpEditingAdmissionForExtensionChanges(coordinator, [], [extension(id)]);
			assert.strictEqual(coordinator.generation, id === clientId ? 1 : 2);
		}
	});

	test('does not stop the shared host for an activation attempt denied before module loading', async () => {
		const coordinator = new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess);
		const events: string[] = [];
		let stops = 0;
		const extensionService = {
			getExtensionsStatus: () => ({ [runtimeId]: { id: new ExtensionIdentifier(runtimeId), activationStarted: true } as IExtensionsStatus }),
			stopExtensionHosts: async () => { stops++; return true; },
		} as unknown as IExtensionService;
		const notifications = { notify: () => events.push('notice') } as unknown as INotificationService;
		const hostService = { reload: () => events.push('reload') } as unknown as IHostService;
		const change = { affectedKeys: new Set(['dotnetAcquisitionExtension.existingDotnetPath']) } as Pick<IConfigurationChangeEvent, 'affectedKeys'>;

		const forwarded = await forwardCSharpEditingConfigurationChange(coordinator, change, extensionService, notifications, hostService, () => events.push('forward'));

		assert.deepStrictEqual({ events, stops, forwarded, blocked: coordinator.isBlocked, generation: coordinator.generation }, { events: ['forward'], stops: 0, forwarded: true, blocked: false, generation: 0 });
	});

	test('revokes an in-flight admission before forwarding safety configuration without stopping the host', async () => {
		const coordinator = new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess);
		const completeValidation = coordinator.beginValidation();
		const events: string[] = [];
		let stops = 0;
		const extensionService = {
			getExtensionsStatus: () => ({ [runtimeId]: { id: new ExtensionIdentifier(runtimeId), activationStarted: true } as IExtensionsStatus }),
			stopExtensionHosts: async () => { stops++; return true; },
		} as unknown as IExtensionService;
		const notifications = { notify: () => events.push('notice') } as unknown as INotificationService;
		const hostService = { reload: () => events.push('reload') } as unknown as IHostService;
		const change = { affectedKeys: new Set(['dotnetAcquisitionExtension.existingDotnetPath']) } as Pick<IConfigurationChangeEvent, 'affectedKeys'>;

		const forwarded = await forwardCSharpEditingConfigurationChange(coordinator, change, extensionService, notifications, hostService, () => events.push('forward'));
		assert.deepStrictEqual({ events, stops, forwarded, blocked: coordinator.isBlocked, generation: coordinator.generation }, { events: ['forward'], stops: 0, forwarded: true, blocked: true, generation: 1 });
		completeValidation();
		const installed = extension(runtimeId);
		assert.deepStrictEqual(coordinator.check({
			extensionId: runtimeId,
			installedVersion: installed.version,
			extensionLocation: installed.extensionLocation,
			hostKind: 'local',
			generation: 0,
		}, installed, true), { allowed: false, generation: 1, reason: 'stale-generation' });
	});

	test('revokes admission after changes to runtime mapping constraints', async () => {
		for (const key of ['dotnetAcquisitionExtension.allowInvalidPaths', 'dotnetAcquisitionExtension.sharedExistingDotnetPath']) {
			const coordinator = new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess);
			const admitted = extension(clientId);
			coordinator.check({ extensionId: clientId, installedVersion: admitted.version, extensionLocation: admitted.extensionLocation, hostKind: 'local', generation: 0 }, admitted, true);
			const events: string[] = [];
			const extensionService = {
				getExtensionsStatus: () => ({}),
				stopExtensionHosts: async () => {
					events.push(`stop:${coordinator.isBlocked}:${coordinator.generation}`);
					return true;
				},
			} as unknown as IExtensionService;
			const notifications = { notify: () => events.push('notice') } as unknown as INotificationService;
			const hostService = { reload: () => events.push('reload') } as unknown as IHostService;
			const change = { affectedKeys: new Set([key]) } as Pick<IConfigurationChangeEvent, 'affectedKeys'>;
			const forwarded = await forwardCSharpEditingConfigurationChange(coordinator, change, extensionService, notifications, hostService, () => events.push('forward'));

			assert.deepStrictEqual({ events, forwarded, blocked: coordinator.isBlocked, generation: coordinator.generation }, {
				events: ['stop:true:1', 'notice'], forwarded: false, blocked: true, generation: 1,
			}, key);
		}
	});

	test('withholds unsafe and subsequent snapshots if stopping fails, but forwards unrelated changes', async () => {
		const coordinator = new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess);
		const admitted = extension(runtimeId);
		coordinator.check({ extensionId: runtimeId, installedVersion: admitted.version, extensionLocation: admitted.extensionLocation, hostKind: 'local', generation: 0 }, admitted, true);
		let stops = 0;
		const extensionService = {
			getExtensionsStatus: () => ({ [runtimeId]: { id: new ExtensionIdentifier(runtimeId), activationStarted: true } as IExtensionsStatus }),
			stopExtensionHosts: async () => { stops++; return false; },
		} as unknown as IExtensionService;
		const notifications = { notify: () => { } } as unknown as INotificationService;
		const hostService = { reload: () => { } } as unknown as IHostService;
		const safetyChange = { affectedKeys: new Set(['dotnetAcquisitionExtension.enableTelemetry']) } as Pick<IConfigurationChangeEvent, 'affectedKeys'>;
		let forwards = 0;

		assert.strictEqual(await forwardCSharpEditingConfigurationChange(coordinator, safetyChange, extensionService, notifications, hostService, () => forwards++), false);
		assert.strictEqual(await forwardCSharpEditingConfigurationChange(coordinator, { affectedKeys: new Set(['editor.fontSize']) }, extensionService, notifications, hostService, () => forwards++), false);
		assert.strictEqual(await forwardCSharpEditingConfigurationChange(new CSharpEditingAdmissionCoordinator(ExtensionHostKind.LocalProcess), { affectedKeys: new Set(['editor.fontSize']) }, extensionService, notifications, hostService, () => forwards++), true);
		assert.deepStrictEqual({ stops, forwards, blocked: coordinator.isBlocked }, { stops: 1, forwards: 1, blocked: true });
	});
});
