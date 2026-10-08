/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { CSHARP_VSWEBASSEMBLYBRIDGE_URL, guardCSharpComponentFetchModule } from '../../node/proxyResolver.js';

suite('Extension host C# component-fetch deny rule', () => {
	function fixture(identity = 'muhammad-sammy.csharp', evaluate?: (args: readonly unknown[]) => boolean) {
		const calls: unknown[][] = [];
		const logs: unknown[][] = [];
		const module = {
			request(...args: unknown[]) { calls.push(args); return 'request'; },
			get(...args: unknown[]) { calls.push(args); return 'get'; },
		};
		const guarded = guardCSharpComponentFetchModule(module, identity, {
			info: (...args: unknown[]) => { logs.push(args); },
		}, evaluate);
		return { guarded, calls, logs };
	}

	test('blocks only the audited extension and exact bridge destination before calling HTTP', () => {
		const { guarded, calls, logs } = fixture();
		assert.throws(() => guarded.get(CSHARP_VSWEBASSEMBLYBRIDGE_URL), /installation is disabled/);
		assert.strictEqual(calls.length, 0);
		assert.deepStrictEqual(logs, [[
			'CSharpEditingComponentFetchDenied',
			{ extensionId: 'muhammad-sammy.csharp', destination: CSHARP_VSWEBASSEMBLYBRIDGE_URL, reason: 'policy' },
		]]);
	});

	test('allows near-match destinations and unrelated extension traffic unchanged', () => {
		const { guarded, calls, logs } = fixture();
		assert.strictEqual(guarded.request('https://vsdebugger.blob.core.windows.net.evil/vswebassemblybridge-9-0-705702/vswebassemblybridge.zip'), 'request');
		assert.strictEqual(guarded.get('https://vsdebugger.blob.core.windows.net/vswebassemblybridge-9-0-705702/other.zip'), 'get');
		assert.strictEqual(calls.length, 2);
		assert.strictEqual(logs.length, 0);

		const unrelated = fixture('other.publisher');
		assert.strictEqual(unrelated.guarded.get(CSHARP_VSWEBASSEMBLYBRIDGE_URL), 'get');
		assert.strictEqual(unrelated.calls.length, 1);
		assert.strictEqual(unrelated.logs.length, 0);
	});

	test('supports the audited HTTPS request-options shape', () => {
		const { guarded, calls } = fixture();
		assert.throws(() => guarded.request({ hostname: 'vsdebugger.blob.core.windows.net', path: '/vswebassemblybridge-9-0-705702/vswebassemblybridge.zip' }));
		assert.strictEqual(calls.length, 0);
	});

	test('fails closed and logs if rule evaluation throws', () => {
		const { guarded, calls, logs } = fixture('muhammad-sammy.csharp', () => { throw new Error('fixture failure'); });
		assert.throws(() => guarded.request('https://example.com/not-the-bridge.zip'), /installation is disabled/);
		assert.strictEqual(calls.length, 0);
		assert.deepStrictEqual(logs[0], [
			'CSharpEditingComponentFetchDenied',
			{ extensionId: 'muhammad-sammy.csharp', destination: CSHARP_VSWEBASSEMBLYBRIDGE_URL, reason: 'rule-evaluation-failed' },
		]);
	});
});
