/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sessionsTunnelHostContribution from '../../electron-browser/tunnelHost.contribution.js';

suite('Sessions - Tunnel Host Contribution', () => {
	test('does not expose a RemoteTunnel titlebar contribution', () => {
		assert.deepStrictEqual(Object.keys(sessionsTunnelHostContribution), []);
	});
});
