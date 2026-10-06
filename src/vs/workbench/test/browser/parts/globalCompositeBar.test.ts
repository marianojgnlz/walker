/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { GlobalCompositeBar } from '../../../browser/parts/globalCompositeBar.js';
import * as GlobalCompositeBarModule from '../../../browser/parts/globalCompositeBar.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { Action } from '../../../../base/common/actions.js';
import { GLOBAL_ACTIVITY_ID } from '../../../common/activity.js';
import { ActivityService } from '../../../services/activity/browser/activityService.js';

interface IGlobalCompositeBarTestHarness {
	globalActivityActionBar: ActionBar;
	getHeight: typeof GlobalCompositeBar.prototype.getHeight;
	getContextMenuActions: typeof GlobalCompositeBar.prototype.getContextMenuActions;
}

const getGlobalContextMenuActions = Reflect.get(GlobalCompositeBar.prototype, 'getContextMenuActions') as (this: IGlobalCompositeBarTestHarness) => ReturnType<typeof GlobalCompositeBar.prototype.getContextMenuActions>;

suite('GlobalCompositeBar', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createGlobalBar(additionalActions = 0): IGlobalCompositeBarTestHarness {
		const globalActivityActionBar = store.add(new ActionBar(document.createElement('div')));
		for (let index = 0; index < additionalActions; index++) {
			globalActivityActionBar.push(store.add(new Action(`test.activity.${index}`)));
		}
		globalActivityActionBar.push(store.add(new Action(GLOBAL_ACTIVITY_ID)));
		return {
			globalActivityActionBar,
			getHeight: GlobalCompositeBar.prototype.getHeight,
			getContextMenuActions: getGlobalContextMenuActions,
		};
	}

	test('counts only gaps between rendered actions', () => {
		const bar = createGlobalBar(1);
		const twoActions = bar.getHeight(36, 8);
		bar.globalActivityActionBar.pull(0);
		const oneAction = bar.getHeight(36, 8);
		bar.globalActivityActionBar.clear();
		const empty = bar.getHeight(36, 8);

		assert.deepStrictEqual({ twoActions, oneAction, empty }, { twoActions: 80, oneAction: 36, empty: 0 });
	});

	test('does not expose an Accounts visibility toggle in the global-bar context menu', () => {
		const bar = createGlobalBar();

		assert.deepStrictEqual(bar.getContextMenuActions(), []);
	});

	test('does not export an Accounts visibility preference helper', () => {
		assert.strictEqual(Object.prototype.hasOwnProperty.call(GlobalCompositeBarModule, 'isAccountsActionVisible'), false);
	});

	test('does not export Accounts activity action view items', () => {
		assert.strictEqual(Object.prototype.hasOwnProperty.call(GlobalCompositeBarModule, 'AccountsActivityActionViewItem'), false);
		assert.strictEqual(Object.prototype.hasOwnProperty.call(GlobalCompositeBarModule, 'SimpleAccountActivityActionViewItem'), false);
	});

	test('activity service exposes generic but not account badge activity', () => {
		assert.strictEqual(typeof Reflect.get(ActivityService.prototype, 'showGlobalActivity'), 'function');
		assert.strictEqual(Reflect.get(ActivityService.prototype, 'showAccountsActivity'), undefined);
	});

});
