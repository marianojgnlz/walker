/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VIEW_CONTAINER } from '../../browser/extensions.contribution.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { ILabelService } from '../../../../../platform/label/common/label.js';
import { ExtensionsViewletViewsContribution } from '../../browser/extensionsViewlet.js';
import { Extension } from '../../browser/extensionsWorkbenchService.js';
import { Extensions as ViewExtensions, IViewsRegistry } from '../../../../common/views.js';
import { IExtensionManagementServerService } from '../../../../services/extensionManagement/common/extensionManagement.js';
import { IExtension, ExtensionState } from '../../common/extensions.js';
import { ExtensionHoverWidget, RatingsWidget } from '../../browser/extensionsWidgets.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import * as ExtensionGalleryAccountServiceModule from '../../../../services/extensionManagement/electron-browser/extensionGalleryAccountService.js';
import * as ExtensionGalleryAccountContractModule from '../../../../services/extensionManagement/common/extensionGalleryAccount.js';

suite('Extensions Gallery Account UI', () => {

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not register authenticated marketplace account providers', () => {
		assert.strictEqual(Object.hasOwn(ExtensionGalleryAccountServiceModule, 'GitHubGalleryAccountProvider'), false);
		assert.strictEqual(Object.hasOwn(ExtensionGalleryAccountServiceModule, 'MicrosoftGalleryAccountProvider'), false);
		assert.strictEqual(Object.hasOwn(ExtensionGalleryAccountServiceModule, 'ExtensionGalleryAccountProviderContribution'), false);
	});

	test('does not register the marketplace authentication provider setting', () => {
		const properties = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).getExcludedConfigurationProperties();
		assert.strictEqual(properties['extensions.gallery.authProvider'], undefined);
	});

	test('does not export a marketplace account-service contract', () => {
		assert.strictEqual(Object.hasOwn(ExtensionGalleryAccountContractModule, 'IExtensionGalleryAccountService'), false);
	});

	test('does not register a marketplace sign-in command', () => {
		assert.strictEqual(CommandsRegistry.getCommand('workbench.extensions.actions.gallery.signIn'), undefined);
	});

	test('does not register an account-required marketplace access view', () => {
		const servers = {
			localExtensionManagementServer: null,
			remoteExtensionManagementServer: null,
			webExtensionManagementServer: null,
		} as unknown as IExtensionManagementServerService;
		const labelService = { onDidChangeFormatters: Event.None } as ILabelService;
		const contextKeyService = disposableStore.add(new MockContextKeyService());
		const views = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const existingViews = new Set(views.getViews(VIEW_CONTAINER));
		disposableStore.add(new ExtensionsViewletViewsContribution(servers, labelService, contextKeyService));

		try {
			assert.ok(views.getView('workbench.views.extensions.marketplace'));
			assert.strictEqual(views.getView('workbench.views.extensions.marketplaceAccess'), null);
			assert.deepStrictEqual(views.getViewWelcomeContent('workbench.views.extensions.marketplaceAccess'), []);
		} finally {
			const addedViews = views.getViews(VIEW_CONTAINER).filter(view => !existingViews.has(view));
			views.deregisterViews(addedViews, VIEW_CONTAINER);
		}
	});

	test('does not expose the obsolete rating URL accessor', () => {
		assert.strictEqual(Object.getOwnPropertyDescriptor(Extension.prototype, 'ratingUrl'), undefined);
	});

	test('keeps extension ratings read-only', () => {
		const extension = {
			identifier: { id: 'publisher.extension' },
			state: ExtensionState.Installed,
			displayName: 'Extension',
			version: '1.0.0',
			rating: 4.5,
			ratingCount: 100,
			ratingUrl: 'https://open-vsx.org/extension/publisher/extension',
			url: 'https://open-vsx.org/extension/publisher/extension',
			hasPreReleaseVersion: false,
		} as unknown as IExtension;
		const container = document.createElement('div');
		const hoverService = {
			setupManagedHover: () => ({ update: () => undefined, dispose: () => undefined })
		} as unknown as IHoverService;
		disposableStore.add(new RatingsWidget(container, false, hoverService)).extension = extension;

		const rating = container.querySelector('.rating');
		assert.ok(rating);
		assert.strictEqual(rating.querySelectorAll('span').length, 6);
		assert.ok(container.textContent?.includes('100'));
		assert.strictEqual(rating.getAttribute('role'), null);
		assert.strictEqual((rating as HTMLElement).tabIndex, -1);
		assert.strictEqual(rating.classList.contains('clickable'), false);

		const hoverWidget = Object.assign(Object.create(ExtensionHoverWidget.prototype), {
			_extension: extension,
			extensionsWorkbenchService: { getExtensionRuntimeStatus: () => undefined },
			extensionFeaturesManagementService: { getAllAccessDataForExtension: () => new Map() },
			extensionStatusAction: { status: [] },
		}) as { getHoverMarkdown(): { value: string } | undefined };
		const hover = hoverWidget.getHoverMarkdown();
		assert.ok(hover?.value.includes('4.5'));
		assert.ok(!hover?.value.includes('#review-details'));
	});
});
