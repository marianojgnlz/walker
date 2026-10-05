/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { isIMenuItem, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { Menus } from '../../../../browser/menus.js';

suite('Sessions - Account UI registration', () => {
	test('does not register account menu or titlebar actions', () => {
		const menuCommandIds = [Menus.AccountMenu, Menus.TitleBarRightLayout]
			.flatMap(menu => MenuRegistry.getMenuItems(menu))
			.filter(isIMenuItem)
			.map(item => item.command.id);

		assert.ok(!menuCommandIds.includes('workbench.action.agenticSignIn'));
		assert.ok(!menuCommandIds.includes('workbench.action.agenticSignOut'));
		assert.ok(!menuCommandIds.includes('workbench.action.openSettings'));
		assert.strictEqual(CommandsRegistry.getCommand('sessions.action.titleBarAccountWidget'), undefined);
	});
});
