/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { isDisposable } from '../../../../../base/common/lifecycle.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IConstructorSignature } from '../../../../../platform/instantiation/common/instantiation.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IWorkbenchExtensionEnablementService } from '../../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { LifecyclePhase } from '../../../../services/lifecycle/common/lifecycle.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IStatusbarEntry, IStatusbarEntryPriority, IStatusbarService, StatusbarAlignment } from '../../../../services/statusbar/browser/statusbar.js';
import { IUserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { IWorkbenchContribution, WorkbenchContributionsRegistry } from '../../../../common/contributions.js';
import { IExtensionsWorkbenchService } from '../../../extensions/common/extensions.js';
import { DOTNET_TOOLCHAIN_COMMANDS } from '../../common/toolchainContract.js';
import '../../browser/csharpEditing.contribution.js';

const contributionId = 'workbench.contrib.csharpEditing';
const configureCommandId = 'walker.csharp.configureEditing';

interface IWorkbenchContributionRegistration {
	readonly id: string | undefined;
	readonly ctor: IConstructorSignature<IWorkbenchContribution>;
}

interface IWorkbenchContributionsRegistryForTest {
	readonly contributionsByPhase: Map<LifecyclePhase, IWorkbenchContributionRegistration[]>;
}

suite('C# editing workbench contribution', () => {
	test('registers Configure C# Editing and installs its status item at startup', () => {
		assert.ok(CommandsRegistry.getCommand(configureCommandId));
		assert.ok(CommandsRegistry.getCommand('_walker.csharp.checkAdmission'));

		const registry = WorkbenchContributionsRegistry.INSTANCE as unknown as IWorkbenchContributionsRegistryForTest;
		const startupRegistration = registry.contributionsByPhase.get(LifecyclePhase.Starting)?.find(entry => entry.id === contributionId);
		assert.ok(startupRegistration, 'The admission coordinator must be registered in the startup phase');

		const entries: { entry: IStatusbarEntry; id: string; alignment: StatusbarAlignment; priority: unknown }[] = [];
		let entryDisposed = false;
		const instantiationService = new TestInstantiationService();
		instantiationService.stub(IStatusbarService, {
			addEntry(entry: IStatusbarEntry, id: string, alignment: StatusbarAlignment, priority?: number | IStatusbarEntryPriority) {
				entries.push({ entry, id, alignment, priority });
				return { update: () => undefined, dispose: () => entryDisposed = true };
			},
		} as unknown as IStatusbarService);
		instantiationService.stub(IExtensionsWorkbenchService, {
			onChange: Event.None,
			whenInitialized: Promise.resolve(),
			queryLocal: async () => [],
		} as unknown as IExtensionsWorkbenchService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, { isEnabled: () => false });
		instantiationService.stub(IExtensionService, {
			onDidChangeExtensions: Event.None,
			getExtensionsStatus: () => ({}),
		} as unknown as IExtensionService);

		const contribution = instantiationService.createInstance(startupRegistration.ctor);
		assert.deepStrictEqual(entries.map(({ entry, id, alignment, priority }) => ({
			id,
			alignment,
			name: entry.name,
			text: entry.text,
			ariaLabel: entry.ariaLabel,
			tooltip: entry.tooltip,
			command: entry.command,
			priority,
		})), [{
			id: 'csharpEditing.status',
			alignment: StatusbarAlignment.RIGHT,
			name: 'C# Editing',
			text: '$(dotnet)',
			ariaLabel: 'C# Editing is not installed.',
			tooltip: 'C# Editing is not installed.',
			command: configureCommandId,
			priority: { location: { id: 'status.host', priority: 110 }, alignment: StatusbarAlignment.RIGHT },
		}]);
		if (isDisposable(contribution)) {
			contribution.dispose();
		}
		instantiationService.dispose();
		assert.strictEqual(entryDisposed, true);
	});

	test('reports the durable signature-verification outcome without claiming rejection', async () => {
		const notifications: string[] = [];
		const instantiationService = new TestInstantiationService();
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
		instantiationService.stub(ICommandService, {
			executeCommand: async (id: string) => {
				assert.strictEqual(id, DOTNET_TOOLCHAIN_COMMANDS.resolveEditingHost);
				return toolchain;
			},
		} as unknown as ICommandService);
		instantiationService.stub(INotificationService, {
			notify: (notification: { readonly message: string }) => notifications.push(notification.message),
		} as unknown as INotificationService);
		instantiationService.stub(IHostService, { reload: async () => undefined } as unknown as IHostService);
		instantiationService.stub(IConfigurationService, {} as unknown as IConfigurationService);
		instantiationService.stub(IStorageService, {} as unknown as IStorageService);
		instantiationService.stub(IUserDataProfileService, { currentProfile: { id: 'test-profile' } } as unknown as IUserDataProfileService);
		instantiationService.stub(IExtensionService, {
			onDidChangeExtensions: Event.None,
		} as unknown as IExtensionService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, { isEnabled: () => true });
		instantiationService.stub(IProductService, {
			extensionsGallery: { serviceUrl: 'https://open-vsx.org/vscode/gallery' },
		} as unknown as IProductService);
		instantiationService.stub(IExtensionsWorkbenchService, {
			onChange: Event.None,
			whenInitialized: Promise.resolve(),
			queryLocal: async () => [],
			getExtensions: async () => [{ identifier: { id: 'muhammad-sammy.csharp' }, version: '2.145.21-g154a82fd27' }],
			install: async () => {
				throw Object.assign(new Error('Signature verification was not executed'), { code: 'SignatureVerificationFailed' });
			},
		} as unknown as IExtensionsWorkbenchService);

		const command = CommandsRegistry.getCommand(configureCommandId);
		assert.ok(command);
		await command.handler(instantiationService);
		instantiationService.dispose();

		assert.strictEqual(notifications.length, 1);
		assert.match(notifications[0], /Signature verification was not executed/);
		assert.doesNotMatch(notifications[0], /Open VSX rejected the C# package signature/);
	});
});
