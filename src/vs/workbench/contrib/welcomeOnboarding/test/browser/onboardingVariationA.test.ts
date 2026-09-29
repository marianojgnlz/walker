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
import { DotnetToolchainStep, type IDotnetToolchainStepScheduler } from '../../browser/dotnetToolchainStep.js';
import { DOTNET_TOOLCHAIN_COMMANDS, DOTNET_TOOLCHAIN_SCHEMA_VERSION, type IDotnetToolchainSnapshot } from '../../common/dotnetToolchain.js';

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

function createHarness(store: Pick<DisposableStore, 'add'>, handleCommand: (id: string, ...args: unknown[]) => Promise<unknown> = () => Promise.resolve(undefined)): IOnboardingHarness {
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
			return handleCommand(id, ...args).then(value => value as R | undefined);
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

interface IDeferred<T> {
	readonly promise: Promise<T>;
	resolve(value: T): void;
	reject(error: Error): void;
}

function deferred<T>(): IDeferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function toolchainSnapshot(state: IDotnetToolchainSnapshot['state'], revision: number): IDotnetToolchainSnapshot {
	return {
		schemaVersion: DOTNET_TOOLCHAIN_SCHEMA_VERSION,
		revision,
		state,
		locality: 'local',
		...(state === 'ready' ? { verified: { executable: '/home/test/.walker/dotnet/dotnet', sdkVersion: '10.0.401' } } : {}),
	};
}

class TestToolchainScheduler implements IDotnetToolchainStepScheduler {
	private now = 0;
	private nextId = 0;
	private readonly scheduled = new Map<number, { readonly due: number; readonly callback: () => void }>();

	schedule(callback: () => void, delayMs: number): { dispose(): void } {
		const id = ++this.nextId;
		this.scheduled.set(id, { due: this.now + delayMs, callback });
		return toDisposable(() => this.scheduled.delete(id));
	}

	get pendingCount(): number {
		return this.scheduled.size;
	}

	advanceBy(milliseconds: number): void {
		const target = this.now + milliseconds;
		while (true) {
			const next = [...this.scheduled.entries()].sort((a, b) => a[1].due - b[1].due)[0];
			if (!next || next[1].due > target) {
				break;
			}
			this.now = next[1].due;
			this.scheduled.delete(next[0]);
			next[1].callback();
		}
		this.now = target;
	}
}

function createToolchainStepHarness(
	store: Pick<DisposableStore, 'add'>,
	handleCommand: (id: string) => Promise<unknown>,
): { readonly root: HTMLElement; readonly status: HTMLElement; readonly details: HTMLElement; readonly setup: HTMLButtonElement; readonly recheck: HTMLButtonElement; readonly output: HTMLButtonElement; readonly calls: string[]; readonly scheduler: TestToolchainScheduler; readonly step: DotnetToolchainStep } {
	const root = document.body.appendChild($('div.dotnet-toolchain-step-test'));
	store.add(toDisposable(() => root.remove()));
	const status = root.appendChild($('div'));
	const details = root.appendChild($('div'));
	const setup = root.appendChild($<HTMLButtonElement>('button'));
	const recheck = root.appendChild($<HTMLButtonElement>('button'));
	const output = root.appendChild($<HTMLButtonElement>('button'));
	const calls: string[] = [];
	const commandService = new class extends mock<ICommandService>() {
		override executeCommand<R = unknown>(id: string, ..._args: unknown[]): Promise<R | undefined> {
			calls.push(id);
			return handleCommand(id).then(value => value as R);
		}
	};
	const scheduler = new TestToolchainScheduler();
	const step = store.add(new DotnetToolchainStep(commandService, { status, details, setup, recheck, output }, {
		scheduler,
		pollIntervalMs: 1000,
		stateReadTimeoutMs: 5000,
	}));
	return { root, status, details, setup, recheck, output, calls, scheduler, step };
}

suite('DotnetToolchainStep command client', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('polls visible busy and terminal states without moving focus', async () => {
		const states = [
			toolchainSnapshot('installing', 1),
			toolchainSnapshot('verifying', 2),
			toolchainSnapshot('failed', 3),
			toolchainSnapshot('ready', 4),
		];
		const harness = createToolchainStepHarness(disposables, id => Promise.resolve(id === DOTNET_TOOLCHAIN_COMMANDS.getState ? states.shift() ?? toolchainSnapshot('ready', 4) : undefined));
		await flushAsync();
		assert.ok(harness.status.textContent?.includes('Installing'));
		harness.recheck.focus();
		for (const expected of ['Verifying', 'failed', 'SDK ready']) {
			harness.scheduler.advanceBy(1000);
			await flushAsync();
			assert.ok(harness.status.textContent?.includes(expected), `expected status label to include ${expected}`);
			assert.strictEqual(document.activeElement, harness.recheck, 'state updates do not steal focus');
		}
		assert.ok(harness.details.textContent?.includes('/home/test/.walker/dotnet/dotnet'), 'ready state shows the verified executable');
		assert.ok(harness.calls.filter(id => id === DOTNET_TOOLCHAIN_COMMANDS.getState).length >= 4, 'terminal states keep polling while visible');
		harness.step.dispose();
		assert.strictEqual(harness.scheduler.pendingCount, 0, 'disposing the visible step clears its poll timer');
	});

	test('times out slow state reads and ignores stale responses after retry', async () => {
		const staleRead = deferred<unknown>();
		let stateReads = 0;
		const harness = createToolchainStepHarness(disposables, id => {
			if (id === DOTNET_TOOLCHAIN_COMMANDS.getState) {
				stateReads++;
				return stateReads === 1 ? staleRead.promise : Promise.resolve(toolchainSnapshot('ready', 2));
			}
			if (id === DOTNET_TOOLCHAIN_COMMANDS.recheck) {
				return Promise.resolve(toolchainSnapshot('ready', 2));
			}
			return Promise.reject(new Error('extension activation failed'));
		});
		harness.scheduler.advanceBy(5000);
		assert.ok(harness.status.textContent?.includes('unavailable'), 'a read timeout explains the unavailable state');
		harness.recheck.click();
		await flushAsync();
		assert.ok(harness.status.textContent?.includes('SDK ready'), 'Retry can recover after extension activation becomes available');
		staleRead.resolve(toolchainSnapshot('failed', 1));
		await flushAsync();
		assert.ok(harness.status.textContent?.includes('SDK ready'), 'a late older response cannot overwrite the newer state');
		harness.step.dispose();
	});

	test('shows unavailable after activation failure and retries a restarted extension revision', async () => {
		let activated = true;
		let stateReads = 0;
		const harness = createToolchainStepHarness(disposables, id => {
			if (id === DOTNET_TOOLCHAIN_COMMANDS.getState) {
				stateReads++;
				if (stateReads === 1) {
					return Promise.resolve(toolchainSnapshot('ready', 10));
				}
				if (!activated) {
					return Promise.reject(new Error('extension activation failed'));
				}
				return Promise.resolve(toolchainSnapshot('missing', 0));
			}
			return activated ? Promise.resolve(toolchainSnapshot('missing', 0)) : Promise.reject(new Error('extension activation failed'));
		});
		await flushAsync();
		assert.ok(harness.status.textContent?.includes('SDK ready'));
		activated = false;
		harness.scheduler.advanceBy(1000);
		await flushAsync();
		assert.ok(harness.status.textContent?.includes('unavailable'));
		assert.strictEqual(harness.recheck.textContent, 'Retry');
		activated = true;
		harness.recheck.click();
		await flushAsync();
		assert.ok(harness.status.textContent?.includes('No .NET SDK'), 'Retry accepts the restarted extension’s lower initial revision');
		assert.ok(harness.calls.includes(DOTNET_TOOLCHAIN_COMMANDS.recheck));
		harness.step.dispose();
	});

	test('shows setup progress and terminal refresh while the step is visible', async () => {
		const setupResult = deferred<unknown>();
		let current = toolchainSnapshot('missing', 1);
		const harness = createToolchainStepHarness(disposables, id => {
			if (id === DOTNET_TOOLCHAIN_COMMANDS.getState) {
				return Promise.resolve(current);
			}
			if (id === DOTNET_TOOLCHAIN_COMMANDS.setup) {
				current = toolchainSnapshot('installing', 2);
				return setupResult.promise;
			}
			return Promise.resolve(current);
		});
		await flushAsync();
		harness.setup.click();
		await flushAsync();
		assert.ok(harness.calls.includes(DOTNET_TOOLCHAIN_COMMANDS.setup), 'the setup action uses the extension command');
		harness.scheduler.advanceBy(1000);
		await flushAsync();
		assert.ok(harness.status.textContent?.includes('Installing'), 'polling reflects setup started from the visible onboarding step');
		harness.recheck.focus();
		current = toolchainSnapshot('verifying', 3);
		harness.scheduler.advanceBy(1000);
		await flushAsync();
		assert.ok(harness.status.textContent?.includes('Verifying'));
		assert.strictEqual(document.activeElement, harness.recheck, 'progress updates do not move focus');
		current = toolchainSnapshot('ready', 4);
		setupResult.resolve(current);
		await flushAsync();
		assert.ok(harness.status.textContent?.includes('SDK ready'), 'setup completion immediately refreshes terminal state');
		harness.step.dispose();
	});

	test('disposes polling while setup remains active and ignores its late callback', async () => {
		const setupResult = deferred<unknown>();
		const harness = createToolchainStepHarness(disposables, id => id === DOTNET_TOOLCHAIN_COMMANDS.setup
			? setupResult.promise
			: Promise.resolve(toolchainSnapshot('missing', 1)));
		await flushAsync();
		harness.setup.click();
		await flushAsync();
		assert.ok(harness.calls.includes(DOTNET_TOOLCHAIN_COMMANDS.setup), 'setup has started before disposal');
		harness.step.dispose();
		assert.strictEqual(harness.scheduler.pendingCount, 0, 'step exit releases all timers without canceling setup');
		setupResult.resolve(toolchainSnapshot('ready', 2));
		await flushAsync();
		assert.ok(harness.status.textContent?.includes('No .NET SDK'), 'late setup completion cannot update the dismissed step');
		assert.strictEqual(harness.calls.filter(id => id === DOTNET_TOOLCHAIN_COMMANDS.setup).length, 1);
	});
});

suite('OnboardingVariationA — first step', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('renders the account-free toolchain shell instead of sign-in controls', async () => {
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
		await flushAsync();
		assert.ok(harness.executedCommands.some(command => command.id === DOTNET_TOOLCHAIN_COMMANDS.getState), 'the visible step reads the extension state');
		assertNoAccountActivity(harness);
	});

	test('dispatches visible setup through the injected command service without moving focus', async () => {
		let snapshot = toolchainSnapshot('missing', 1);
		const harness = createHarness(disposables, id => {
			if (id === DOTNET_TOOLCHAIN_COMMANDS.setup) {
				snapshot = toolchainSnapshot('ready', 2);
			}
			return Promise.resolve(snapshot);
		});
		harness.service.show();
		await flushAsync();
		const setup = harness.container.querySelector<HTMLButtonElement>('.onboarding-a-toolchain-actions button');
		const actions = harness.container.querySelectorAll<HTMLButtonElement>('.onboarding-a-toolchain-actions button');
		assert.strictEqual(actions.length, 3, 'setup, recheck, and diagnostics actions are connected');
		const recheck = actions[1];
		recheck.focus();
		setup?.click();
		await flushAsync();
		assert.ok(harness.executedCommands.some(command => command.id === DOTNET_TOOLCHAIN_COMMANDS.setup), 'setup invokes the extension command');
		assert.ok(harness.container.querySelector('.onboarding-a-toolchain-status')?.textContent?.includes('SDK ready'), 'the terminal setup snapshot is shown');
		assert.strictEqual(document.activeElement, recheck, 'command completion does not steal focus');
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
		assert.strictEqual(container.querySelector('.onboarding-a-overlay'), null, 'completion removes onboarding');
		await flushAsync();
		assert.strictEqual(container.querySelector('.onboarding-a-overlay'), null, 'completion does not automatically replay onboarding');

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
		let completed = false;
		disposables.add(harness.service.onDidComplete(() => { completed = true; }));
		const dismissed = waitFor(harness.service.onDidDismiss);
		closeButtonOf(container).click();
		await dismissed;

		assert.strictEqual(container.querySelector('.onboarding-a-overlay'), null, 'close removes the overlay');
		assert.strictEqual(completed, false, 'skipping does not fire the completion event');
		assertNoAccountActivity(harness);
	});
});
