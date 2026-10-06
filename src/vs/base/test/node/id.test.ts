/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { virtualMachineHint } from '../../node/id.js';
import { flakySuite } from './testUtils.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../common/utils.js';

flakySuite('ID', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('virtualMachineHint', async function () {
		const hint = virtualMachineHint.value();
		assert.ok(typeof hint === 'number' && hint >= 0 && hint <= 1, `Expected a VM likelihood ratio, got: ${hint}`);
	});
});
