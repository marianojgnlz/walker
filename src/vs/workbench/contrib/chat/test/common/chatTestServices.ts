/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { Event } from '../../../../../base/common/event.js';
import { Lazy } from '../../../../../base/common/lazy.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { IChatWidget, IChatWidgetService } from '../../browser/chat.js';
import { IChatEditorOptions } from '../../browser/widgetHosts/editor/chatEditor.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { PreferredGroup } from '../../../../services/editor/common/editorService.js';
import { ChatEntitlement, ChatEntitlementContext, IChatEntitlementService } from '../../../../services/chat/common/chatEntitlementService.js';

export class TestChatEntitlementService implements IChatEntitlementService {

	_serviceBrand: undefined;

	context: Lazy<ChatEntitlementContext> | undefined;

	readonly organisations: undefined;
	readonly isInternal: boolean = false;
	readonly sku = undefined;
	readonly copilotTrackingId = undefined;

	readonly onDidChangeQuotaExceeded = Event.None;
	readonly onDidChangeQuotaRemaining = Event.None;
	readonly onDidChangeUsageBasedBilling = Event.None;
	readonly quotas = {};

	update(token: CancellationToken): Promise<void> {
		throw new Error('Method not implemented.');
	}

	readonly onDidChangeSentiment = Event.None;
	readonly sentimentObs = observableValue({}, {});
	readonly sentiment = {};

	readonly onDidChangeEntitlement = Event.None;
	entitlement: ChatEntitlement = ChatEntitlement.Unknown;
	readonly entitlementObs = observableValue({}, ChatEntitlement.Unknown);

	readonly anonymous = false;
	onDidChangeAnonymous = Event.None;
	readonly anonymousObs = observableValue({}, false);

	acceptQuotas(): void { }
	clearQuotas(): void { }
	markAnonymousRateLimited(): void { }
	markSetupCompleted(): void { }
	setForceHidden(_hidden: boolean): void { }

	readonly clientByokEnabled = false;
	readonly hasByokModels = false;
}

export class TestChatWidgetService implements IChatWidgetService {

	_serviceBrand: undefined;

	lastFocusedWidget: IChatWidget | undefined;

	onDidAddWidget = Event.None;
	onDidRemoveWidget = Event.None;
	onDidChangeWidgetVisibility = Event.None;
	onDidBackgroundSession = Event.None;
	onDidChangeFocusedWidget = Event.None;
	onDidChangeFocusedSession = Event.None;

	async reveal(widget: IChatWidget, preserveFocus?: boolean): Promise<boolean> { return false; }
	async revealWidget(preserveFocus?: boolean): Promise<IChatWidget | undefined> { return undefined; }
	getAllWidgets(): ReadonlyArray<IChatWidget> { return []; }
	getWidgetByInputUri(uri: URI): IChatWidget | undefined { return undefined; }
	openSession(sessionResource: URI): Promise<IChatWidget | undefined>;
	openSession(sessionResource: URI, target?: PreferredGroup, options?: IChatEditorOptions): Promise<IChatWidget | undefined>;
	async openSession(sessionResource: unknown, target?: unknown, options?: unknown): Promise<IChatWidget | undefined> { return undefined; }
	getWidgetBySessionResource(sessionResource: URI): IChatWidget | undefined { return undefined; }
	getWidgetsByLocations(location: ChatAgentLocation): ReadonlyArray<IChatWidget> { return []; }
	register(newWidget: IChatWidget): IDisposable { return Disposable.None; }
}
