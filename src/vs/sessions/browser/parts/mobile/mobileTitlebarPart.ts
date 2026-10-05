/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './mobileChatShell.css';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { $, addDisposableListener, append, EventType } from '../../../../base/browser/dom.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize } from '../../../../nls.js';
import { autorun } from '../../../../base/common/observable.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { HiddenItemStrategy, MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ISessionsService } from '../../../services/sessions/browser/sessionsService.js';
import { ISessionFileChange } from '../../../services/sessions/common/session.js';
import { IsNewChatSessionContext } from '../../../common/contextkeys.js';
import { SideBarVisibleContext } from '../../../../workbench/common/contextkeys.js';
import { Menus } from '../../menus.js';
import { MOBILE_OPEN_CHANGES_VIEW_COMMAND_ID } from './contributions/mobileChangesView.js';

/**
 * Mobile titlebar — prepended above the workbench grid on phone viewports
 * in place of the desktop titlebar.
 *
 * Layout (contextual right slot):
 *
 *  - **In a chat session** → `[toggle sidebar]  [session title]  [changes pill]  [+]`
 *  - **Welcome / new session** → `[toggle sidebar]  [host widget | title]`
 *
 * The center slot switches content based on whether the sessions welcome
 * (home/empty) screen is visible:
 *
 *  - **Welcome hidden** → shows the active session title (live, from
 *    {@link ISessionsService.activeSession}).
 *  - **Welcome visible** → shows whatever is contributed to the
 *    {@link Menus.MobileTitleBarCenter} menu. On web, the host filter
 *    contribution appends its host dropdown + connection button there.
 *
 * The switch is driven entirely by the menu: when the toolbar has no
 * items the title is shown; as soon as it has items the title is hidden
 * and the toolbar fills the slot.
 *
 * The new-session (+) button is shown when a chat session is active.
 */
export class MobileTitlebarPart extends Disposable {

	readonly element: HTMLElement;

	private readonly sessionTitleElement: HTMLElement;
	private readonly actionsContainer: HTMLElement;
	private readonly centerToolbar: MenuWorkbenchToolBar;

	private readonly _onDidClickHamburger = this._register(new Emitter<void>());
	readonly onDidClickHamburger: Event<void> = this._onDidClickHamburger.event;

	private readonly _onDidClickNewSession = this._register(new Emitter<void>());
	readonly onDidClickNewSession: Event<void> = this._onDidClickNewSession.event;

	private readonly _onDidClickTitle = this._register(new Emitter<void>());
	readonly onDidClickTitle: Event<void> = this._onDidClickTitle.event;

	// Changes pill state — kept here so the click handler can read the
	// latest set without re-deriving it on each tap.
	private latestChanges: readonly ISessionFileChange[] = [];

	constructor(
		parent: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService,
		@ISessionsService private readonly sessionsService: ISessionsService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.element = document.createElement('div');
		this.element.className = 'mobile-top-bar';

		// Register DOM removal before appending so that any exception
		// between this point and the end of the constructor still cleans
		// up the element via disposal.
		this._register(toDisposable(() => this.element.remove()));
		parent.prepend(this.element);

		// Sidebar toggle button. Uses the same icon as the desktop/web
		// agents-app sidebar toggle and reflects open/closed state via the
		// SideBarVisibleContext key.
		const hamburger = append(this.element, $('button.mobile-top-bar-button'));
		hamburger.setAttribute('aria-label', localize('mobileTopBar.openSessions', "Open sessions"));
		const hamburgerIcon = append(hamburger, $('span'));
		const closedIconClasses = ThemeIcon.asClassNameArray(Codicon.layoutSidebarLeftOff);
		const openIconClasses = ThemeIcon.asClassNameArray(Codicon.layoutSidebarLeft);
		hamburgerIcon.classList.add(...closedIconClasses);
		this._register(addDisposableListener(hamburger, EventType.CLICK, () => this._onDidClickHamburger.fire()));

		const sidebarVisibleKeySet = new Set([SideBarVisibleContext.key]);
		const updateSidebarIcon = () => {
			const isOpen = !!SideBarVisibleContext.getValue(contextKeyService);
			hamburgerIcon.classList.remove(...closedIconClasses, ...openIconClasses);
			hamburgerIcon.classList.add(...(isOpen ? openIconClasses : closedIconClasses));
			hamburger.setAttribute('aria-label', isOpen
				? localize('mobileTopBar.closeSessions', "Close sessions")
				: localize('mobileTopBar.openSessions', "Open sessions"));
		};
		updateSidebarIcon();

		// Center slot: title and/or actions container (mutually exclusive)
		const center = append(this.element, $('div.mobile-top-bar-center'));

		this.sessionTitleElement = append(center, $('button.mobile-session-title'));
		this.sessionTitleElement.setAttribute('type', 'button');
		this.sessionTitleElement.textContent = localize('mobileTopBar.newSession', "New Session");
		this._register(addDisposableListener(this.sessionTitleElement, EventType.CLICK, () => this._onDidClickTitle.fire()));

		this.actionsContainer = append(center, $('div.mobile-top-bar-actions'));

		// Right slot — laid out left-to-right in DOM order. The new-session
		// (+) button is appended LAST so it always sits at the right edge,
		// even when the changes pill is visible.

		// Changes pill — shown when in a chat that has produced changes.
		// Tap → opens a file picker; selecting a file invokes the
		// `sessions.mobile.openDiffView` command for that file's diff.
		const changesPill = append(this.element, $('button.mobile-top-bar-button.mobile-changes-pill', { type: 'button' })) as HTMLButtonElement;
		changesPill.setAttribute('aria-label', localize('mobileTopBar.changes', "View changes"));
		changesPill.style.display = 'none';
		const changesIcon = append(changesPill, $('span.mobile-changes-pill-icon'));
		changesIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.diffMultiple));
		const changesAddedEl = append(changesPill, $('span.mobile-changes-pill-added'));
		const changesRemovedEl = append(changesPill, $('span.mobile-changes-pill-removed'));
		this._register(addDisposableListener(changesPill, EventType.CLICK, () => this.showChangesPicker()));

		// New session button (+) — shown when in a chat, hidden on welcome.
		// Always rightmost when in a chat.
		const newSessionButton = append(this.element, $('button.mobile-top-bar-button.mobile-new-session-button'));
		newSessionButton.setAttribute('aria-label', localize('mobileTopBar.newSessionAria', "New session"));
		const newSessionIcon = append(newSessionButton, $('span'));
		newSessionIcon.classList.add(...ThemeIcon.asClassNameArray(Codicon.plus));
		this._register(addDisposableListener(newSessionButton, EventType.CLICK, () => this._onDidClickNewSession.fire()));

		// Keep the title in sync with the active session
		this._register(autorun(reader => {
			const session = this.sessionsService.activeSession.read(reader);
			const title = session?.title.read(reader);
			this.sessionTitleElement.textContent = title || localize('mobileTopBar.newSession', "New Session");
		}));

		// Keep the changes pill in sync with the active session's changes.
		// Hidden when there are no changes (counts are zero and list is empty).
		const isNewChatRef = { value: !!IsNewChatSessionContext.getValue(contextKeyService) };
		const renderChangesPill = () => {
			const changes = this.latestChanges;
			let added = 0;
			let removed = 0;
			for (const c of changes) {
				added += c.insertions;
				removed += c.deletions;
			}
			const hasChanges = changes.length > 0;
			// Hide on welcome / new-chat — no session changes to view there.
			const visible = hasChanges && !isNewChatRef.value;
			changesPill.style.display = visible ? '' : 'none';
			if (visible) {
				if (added > 0 || removed > 0) {
					changesAddedEl.textContent = `+${added}`;
					changesRemovedEl.textContent = `-${removed}`;
					changesPill.title = localize('mobileTopBar.changesTooltip', "{0} files changed (+{1} -{2})", changes.length, added, removed);
				} else {
					changesAddedEl.textContent = changes.length === 1
						? localize('mobileTopBar.singleFileChanged', "1 file")
						: localize('mobileTopBar.filesChangedCount', "{0} files", changes.length);
					changesRemovedEl.textContent = '';
					changesPill.title = changes.length === 1
						? localize('mobileTopBar.singleFileChangedTooltip', "1 file changed")
						: localize('mobileTopBar.filesChangedTooltip', "{0} files changed", changes.length);
				}
			}
		};
		this._register(autorun(reader => {
			const session = this.sessionsService.activeSession.read(reader);
			this.latestChanges = session?.changes.read(reader) ?? [];
			renderChangesPill();
		}));

		// Mount the center toolbar (host filter widget on web welcome, etc.)
		const toolbar = this._register(instantiationService.createInstance(MenuWorkbenchToolBar, this.actionsContainer, Menus.MobileTitleBarCenter, {
			hiddenItemStrategy: HiddenItemStrategy.NoHide,
			telemetrySource: 'mobileTitlebar.center',
			toolbarOptions: { primaryGroup: () => true },
		}));
		this.centerToolbar = toolbar;

		// Switch between title and toolbar based on whether a new (empty)
		// chat session is active AND whether the toolbar has anything to
		// show. The latter is important because on desktop/electron or
		// when no agent hosts are configured the toolbar can be empty —
		// in that case we keep the title visible.
		const newChatKeySet = new Set([IsNewChatSessionContext.key]);
		const updateCenterMode = () => {
			const isNewChat = !!IsNewChatSessionContext.getValue(contextKeyService);
			const hasActions = toolbar.getItemsLength() > 0;
			this.element.classList.toggle('show-actions', isNewChat && hasActions);

			newSessionButton.style.display = isNewChat ? 'none' : '';

			// Changes pill follows the in-chat state — hidden on welcome.
			isNewChatRef.value = isNewChat;
			renderChangesPill();
		};
		updateCenterMode();
		this._register(contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(newChatKeySet)) {
				updateCenterMode();
			}
			if (e.affectsSome(sidebarVisibleKeySet)) {
				updateSidebarIcon();
			}
		}));
		this._register(toolbar.onDidChangeMenuItems(() => updateCenterMode()));
	}

	focus(): void {
		if (this.element.classList.contains('show-actions')) {
			this.centerToolbar.focus();
		} else {
			this.sessionTitleElement.focus();
		}
	}

	/**
	 * Explicitly set the title shown in the center slot. Called only when
	 * overriding the live session title (tests, placeholders). The live
	 * subscription will overwrite this on the next session change.
	 */
	setTitle(title: string): void {
		this.sessionTitleElement.textContent = title;
	}

	// --- Changes Pill --- //

	/**
	 * Tap handler for the changes pill. Opens the dedicated mobile
	 * Changes overlay (a master list with file icons + add/remove
	 * counts) via {@link MOBILE_OPEN_CHANGES_VIEW_COMMAND_ID}. The
	 * overlay's own row taps fan out into per-file diff views with
	 * prev/next navigation.
	 *
	 * The list overlay handles its own single-file shortcut, so the
	 * caller just dispatches the command unconditionally.
	 */
	private showChangesPicker(): void {
		if (!this.latestChanges.length) {
			return;
		}
		this.commandService.executeCommand(MOBILE_OPEN_CHANGES_VIEW_COMMAND_ID);
	}

}
