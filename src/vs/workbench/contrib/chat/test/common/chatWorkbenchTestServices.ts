/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IChatWidgetService } from '../../browser/chat.js';
import { IChatEntitlementService } from '../../../../services/chat/common/chatEntitlementService.js';
import { TestChatEntitlementService, TestChatWidgetService } from './chatTestServices.js';
import { workbenchInstantiationService as baseWorkbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';

/**
 * Chat-owned wrapper around the shared workbench test factory that restores the
 * Chat service defaults the shared factory used to install before they moved into
 * this tree. It lets `workbench/test/browser/workbenchTestServices.ts` stay free of
 * Chat imports so the C4 deletion of the Chat tree cannot break retained test infra.
 */
export function workbenchInstantiationService(...args: Parameters<typeof baseWorkbenchInstantiationService>): TestInstantiationService {
	const instantiationService = baseWorkbenchInstantiationService(...args);
	instantiationService.stub(IChatEntitlementService, new TestChatEntitlementService());
	instantiationService.stub(IChatWidgetService, instantiationService.createInstance(TestChatWidgetService));
	return instantiationService;
}
