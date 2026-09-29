/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $ } from '../../../../../base/browser/dom.js';
import { Event as VSCodeEvent } from '../../../../../base/common/event.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IDefaultAccountService } from '../../../../../platform/defaultAccount/common/defaultAccount.js';
import { IExtensionGalleryService, IExtensionManagementService } from '../../../../../platform/extensionManagement/common/extensionManagement.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { INotification, INotificationHandle, INotificationService } from '../../../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../../../platform/notification/test/common/testNotificationService.js';
import product from '../../../../../platform/product/common/product.js';
import { ColorScheme } from '../../../../../platform/theme/common/theme.js';
import { IWorkbenchColorTheme, IWorkbenchThemeService } from '../../../../services/themes/common/workbenchThemeService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { OnboardingVariationA } from '../../browser/onboardingVariationA.js';

const chatSetupCommandId = 'workbench.action.chat.triggerSetup';

interface ICommandInvocation {
	readonly id: string;
	readonly args: readonly unknown[];
}

class RecordingConfigurationService extends TestConfigurationService {
	readonly updates: { readonly key: string; readonly value: unknown }[] = [];

	override updateValue(key: string, value: unknown): Promise<void> {
		this.updates.push({ key, value });
		return Promise.resolve();
	}
}

class RecordingNotificationService extends TestNotificationService {
	readonly messages: string[] = [];

	override notify(notification: INotification): INotificationHandle {
		this.messages.push(notification.message instanceof Error ? notification.message.message : notification.message);
		return super.notify(notification);
	}
}

/**
 * Records every property access on the account service so the first step can
 * prove it never depends on accounts. Method-like accesses stay callable so a
 * regression fails on the assertion instead of throwing mid-render.
 */
function createAccountServiceProbe(accesses: string[]): IDefaultAccountService {
	return new Proxy({}, {
		get: (_target, property) => {
			if (typeof property === 'symbol') {
				return undefined;
			}
			accesses.push(property);
			return property === 'resolveGitHubUrl'
				? (path: string) => `https://github.com/${path}`
				: () => Promise.resolve(null);
		},
	}) as IDefaultAccountService;
}

interface IOnboardingHarness {
	readonly container: HTMLElement;
	readonly service: OnboardingVariationA;
	readonly configurationService: RecordingConfigurationService;
	readonly notificationService: RecordingNotificationService;
	readonly executedCommands: ICommandInvocation[];
	readonly accountServiceAccesses: string[];
	readonly themesSet: string[];
}

function createColorTheme(settingsId: string): IWorkbenchColorTheme {
	return {
		id: settingsId,
		label: settingsId,
		settingsId,
		type: ColorScheme.DARK,
		semanticHighlighting: false,
		tokenColors: [],
		tokenColorMap: [],
		tokenFontMap: [],
		getColor: () => undefined,
		defines: () => false,
		getTokenStyleMetadata: () => undefined,
	};
}

function createHarness(store: Pick<DisposableStore, 'add'>): IOnboardingHarness {
	const container = document.body.appendChild($('div.onboarding-test-host'));
	store.add(toDisposable(() => container.remove()));

	const configurationService = new RecordingConfigurationService();
	const notificationService = new RecordingNotificationService();
	const executedCommands: ICommandInvocation[] = [];
	const accountServiceAccesses: string[] = [];
	const themesSet: string[] = [];
	const colorThemes = [createColorTheme('Dark 2026')];

	const instantiationService = workbenchInstantiationService(undefined, store);
	instantiationService.stub(ILayoutService, new class extends mock<ILayoutService>() {
		override get activeContainer(): HTMLElement { return container; }
	});
	instantiationService.stub(IConfigurationService, configurationService);
	instantiationService.stub(ICommandService, new class extends mock<ICommandService>() {
		override executeCommand<R = unknown>(id: string, ...args: unknown[]): Promise<R | undefined> {
			executedCommands.push({ id, args });
			return Promise.resolve(undefined);
		}
	});
	instantiationService.stub(IWorkbenchThemeService, new class extends mock<IWorkbenchThemeService>() {
		override getColorTheme(): IWorkbenchColorTheme { return colorThemes[0]; }
		override getColorThemes(): Promise<IWorkbenchColorTheme[]> { return Promise.resolve(colorThemes); }
		override setColorTheme(themeId: string | undefined | IWorkbenchColorTheme): Promise<IWorkbenchColorTheme | null> {
			themesSet.push(typeof themeId === 'string' ? themeId : themeId?.settingsId ?? 'unknown');
			return Promise.resolve(null);
		}
	});
	instantiationService.stub(IDefaultAccountService, createAccountServiceProbe(accountServiceAccesses));
	instantiationService.stub(IFileService, new class extends mock<IFileService>() {
		override exists(): Promise<boolean> { return Promise.resolve(false); }
	});
	instantiationService.stub(INotificationService, notificationService);
	instantiationService.stub(IExtensionGalleryService, new class extends mock<IExtensionGalleryService>() { });
	instantiationService.stub(IExtensionManagementService, new class extends mock<IExtensionManagementService>() { });

	const service = store.add(instantiationService.createInstance(OnboardingVariationA));
	return { container, service, configurationService, notificationService, executedCommands, accountServiceAccesses, themesSet };
}

function waitFor(event: VSCodeEvent<void>): Promise<void> {
	return new Promise<void>(resolve => {
		const listener = event(() => {
			listener.dispose();
			resolve();
		});
	});
}

function footerButtons(container: HTMLElement): [HTMLButtonElement, HTMLButtonElement] {
	const buttons = container.querySelectorAll<HTMLButtonElement>('.onboarding-a-footer-right button');
	assert.strictEqual(buttons.length, 2, 'expected back and next footer buttons');
	return [buttons[0], buttons[1]];
}

function overlayOf(container: HTMLElement): HTMLElement {
	const overlay = container.querySelector<HTMLElement>('.onboarding-a-overlay');
	assert.ok(overlay, 'expected the onboarding overlay to be rendered');
	return overlay;
}

function toolchainShellOf(container: HTMLElement): HTMLElement {
	const shell = container.querySelector<HTMLElement>('.onboarding-a-toolchain');
	assert.ok(shell, 'expected the account-free toolchain shell to be rendered');
	return shell;
}

/** DOM legacy `keyCode` value for the Escape key (`KeyCode.Escape` is the internal VS Code value). */
const DOM_KEY_CODE_ESCAPE = 27;

function pressEscape(container: HTMLElement): HTMLElement {
	const overlay = overlayOf(container);
	const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
	// `keyCode` is legacy and not applied from the event init dictionary by all engines.
	Object.defineProperty(event, 'keyCode', { get: () => DOM_KEY_CODE_ESCAPE });
	overlay.dispatchEvent(event);
	return overlay;
}

function closeButtonOf(container: HTMLElement): HTMLButtonElement {
	const close = container.querySelector<HTMLButtonElement>('.onboarding-a-close-btn');
	assert.ok(close, 'expected the close button to be rendered');
	return close;
}

function flushAsync(): Promise<void> {
	return new Promise<void>(resolve => setTimeout(resolve, 0));
}

function assertNoAccountActivity(harness: IOnboardingHarness): void {
	assert.deepStrictEqual(harness.configurationService.updates, [], 'no configuration write from the account-free step');
	assert.deepStrictEqual(harness.executedCommands.filter(command => command.id === chatSetupCommandId), [], 'no chat setup command invocation');
	assert.deepStrictEqual(harness.notificationService.messages, [], 'no notification was raised');
	assert.deepStrictEqual(harness.accountServiceAccesses, [], 'no default account service access');
}

suite('OnboardingVariationA — first step', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('renders the account-free toolchain shell instead of sign-in controls', () => {
		const harness = createHarness(disposables);
		harness.service.show();
		const { container } = harness;

		const shell = toolchainShellOf(container);
		assert.ok(shell.textContent?.includes('Set up .NET toolchain'), 'the first step is named Set up .NET toolchain');
		assert.ok(container.textContent?.includes(`Welcome to ${product.nameLong}`), 'the Walker welcome branding is preserved');
		assert.strictEqual(container.querySelector('.onboarding-a-provider-mark'), null, 'no provider marks');
		assert.strictEqual(container.querySelector('.onboarding-a-provider-mark.github-enterprise'), null, 'no GHE provider mark');
		assert.strictEqual(container.querySelector('.onboarding-a-signin-ghe-input'), null, 'no GHE instance input');
		assert.strictEqual(container.querySelector('.onboarding-a-signin-ghe-progress'), null, 'no GHE progress');
		assert.strictEqual(container.querySelector('button[aria-label="Continue with GitHub Enterprise"]'), null, 'no GHE entry point');
		assert.strictEqual(container.querySelector('.onboarding-a-signin-actions'), null, 'no provider action row');
		assert.strictEqual(container.querySelector('button.onboarding-a-signin-btn'), null, 'no provider sign-in button');
		assert.strictEqual(container.querySelector('.onboarding-a-signin-icon-btn'), null, 'no provider icon sign-in button');
		assert.strictEqual(container.querySelector('.onboarding-a-signin-disclaimer'), null, 'no sign-in disclaimer');
		assert.strictEqual(container.querySelector('.onboarding-a-signin-footer'), null, 'no sign-in footer');
		assert.strictEqual(container.querySelector('.onboarding-a-signin-nudge-btn'), null, 'no footer sign-in nudge');
		assert.strictEqual(container.querySelector('[aria-label="Continue with GitHub"]'), null, 'no GitHub sign-in control');
		assert.strictEqual(container.querySelector('.onboarding-a-body')?.getAttribute('aria-label'), 'Step 1 of 2: Set up .NET toolchain', 'the first step announces its account-free name');
		assert.strictEqual(footerButtons(container)[1].textContent, 'Continue Without Setup', 'the account-free fallback is offered');
		assertNoAccountActivity(harness);
	});

	test('never invokes account or chat setup from the first step', async () => {
		const harness = createHarness(disposables);
		harness.service.show();
		const { container } = harness;

		const completed = waitFor(harness.service.onDidComplete);
		const dismissed = waitFor(harness.service.onDidDismiss);
		footerButtons(container)[1].click();
		footerButtons(container)[0].click();
		footerButtons(container)[1].click();
		footerButtons(container)[1].click();
		await Promise.all([completed, dismissed]);

		assert.strictEqual(container.querySelector('.onboarding-a-overlay'), null, 'completion removes the overlay');
		assertNoAccountActivity(harness);
	});

	test('preserves personalization navigation, theme selection, and completion', async () => {
		const harness = createHarness(disposables);
		harness.service.show();
		const { container, themesSet } = harness;

		toolchainShellOf(container);
		assert.strictEqual(footerButtons(container)[0].style.display, 'none', 'back is hidden on the first step');
		assert.strictEqual(footerButtons(container)[1].textContent, 'Continue Without Setup');

		footerButtons(container)[1].click();
		assert.ok(container.querySelector('.onboarding-a-personalize'), 'the personalize step renders');
		assert.strictEqual(container.querySelector('.onboarding-a-body')?.getAttribute('aria-label'), 'Step 2 of 2: Make It Yours');
		const themeCards = container.querySelectorAll<HTMLElement>('.onboarding-a-theme-card');
		assert.strictEqual(themeCards.length, product.onboardingThemes?.length ?? 0, 'all theme options stay reachable');
		themeCards[0].click();
		await flushAsync();
		assert.deepStrictEqual(themesSet, ['Dark 2026'], 'selecting a theme applies it');

		footerButtons(container)[0].click();
		toolchainShellOf(container);
		assert.strictEqual(footerButtons(container)[1].textContent, 'Continue Without Setup', 'back returns to the account-free fallback');

		footerButtons(container)[1].click();
		const completed = waitFor(harness.service.onDidComplete);
		footerButtons(container)[1].click();
		await completed;

		assertNoAccountActivity(harness);
	});

	test('renders no sign-in nudge on the personalized step', async () => {
		const harness = createHarness(disposables);
		harness.service.show();
		const { container } = harness;

		footerButtons(container)[1].click();
		assert.ok(container.querySelector('.onboarding-a-personalize'), 'the personalize step renders');
		assert.strictEqual(container.querySelector('.onboarding-a-signin'), null, 'no sign-in hero outside the first step');
		assert.strictEqual(container.querySelector('.onboarding-a-signin-nudge-btn'), null, 'no footer sign-in nudge');
		assert.strictEqual(footerButtons(container)[0].style.display, '', 'back is available on personalization');
		assert.strictEqual(footerButtons(container)[1].textContent, 'Get Started');

		const completed = waitFor(harness.service.onDidComplete);
		footerButtons(container)[1].click();
		await completed;
		assertNoAccountActivity(harness);
	});

	test('escape during the first step dismisses and reopens cleanly', async () => {
		const harness = createHarness(disposables);
		harness.service.show();
		const { container } = harness;

		toolchainShellOf(container);
		const dismissed = waitFor(harness.service.onDidDismiss);
		const overlay = pressEscape(container);
		assert.ok(overlay.classList.contains('exiting'), 'escape starts the dismissal');
		overlay.dispatchEvent(new Event('transitionend'));
		await dismissed;

		assert.strictEqual(container.querySelector('.onboarding-a-overlay'), null, 'escape removes the overlay');
		assertNoAccountActivity(harness);

		harness.service.show();
		assert.strictEqual(container.querySelectorAll('.onboarding-a-overlay').length, 1, 'reopening renders exactly one overlay');
		assert.strictEqual(container.querySelectorAll('.onboarding-a-provider-mark').length, 0, 'no provider controls on reopen');
		assert.strictEqual(footerButtons(container)[0].style.display, 'none', 'back is hidden on the first step');
	});

	test('close during the first step performs no account work', async () => {
		const harness = createHarness(disposables);
		harness.service.show();
		const { container } = harness;

		toolchainShellOf(container);
		const dismissed = waitFor(harness.service.onDidDismiss);
		closeButtonOf(container).click();
		await dismissed;

		assert.strictEqual(container.querySelector('.onboarding-a-overlay'), null, 'close removes the overlay');
		assertNoAccountActivity(harness);
	});
});
