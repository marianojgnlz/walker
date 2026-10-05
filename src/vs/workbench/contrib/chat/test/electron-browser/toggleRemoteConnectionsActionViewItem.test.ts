/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';

suite('Chat Remote Tunnel toggle removal', () => {
	test('does not register a Sessions remote tunnel toggle menu item', () => {
		const toggle = MenuRegistry.getMenuItems(MenuId.ChatInputSecondary)
			.filter(isIMenuItem)
			.find(item => item.command.id === 'sessions.tunnelHost.toggleSharing');
		assert.strictEqual(toggle, undefined);
	});

	test('does not expose a Chat Remote Tunnel command dispatcher', async () => {
		const contribution = await import('../../electron-browser/tunnelHost.contribution.js');
		assert.strictEqual('executeToggleRemoteConnections' in contribution, false);
	});

	test('does not expose a Chat RemoteTunnel view item', async () => {
		const viewItem = await import('../../electron-browser/toggleRemoteConnectionsActionViewItem.js');
		assert.deepStrictEqual(Object.keys(viewItem), []);
	});
});
