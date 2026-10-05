/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { shouldShowSessionsWelcome } from '../../browser/sessionsSetUpService.js';

suite('Sessions - Setup Flow', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('first-run welcome is independent of account authentication', () => {
		assert.deepStrictEqual([
			shouldShowSessionsWelcome(true, false),
			shouldShowSessionsWelcome(true, true),
			shouldShowSessionsWelcome(false, false),
			shouldShowSessionsWelcome(false, true),
		], [true, false, false, false]);
	});
});
