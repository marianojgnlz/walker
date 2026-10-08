/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ExtensionIdentifier, IExtensionDescription } from '../../../../platform/extensions/common/extensions.js';
import { loadExtensionModuleAfterCSharpEditingAdmission } from '../../common/extHostExtensionService.js';
import { CSHARP_VSWEBASSEMBLYBRIDGE_URL, guardCSharpComponentFetchModule } from '../../node/proxyResolver.js';

const clientId = 'muhammad-sammy.csharp';
const runtimeId = 'ms-dotnettools.vscode-dotnet-runtime';

function extension(id: string): Pick<IExtensionDescription, 'identifier' | 'version' | 'extensionLocation' | 'displayName'> {
	return {
		identifier: new ExtensionIdentifier(id),
		version: id === clientId ? '2.145.21-g154a82fd27' : '3.2.0',
		extensionLocation: URI.file(`/extensions/${id}`),
		displayName: id,
	};
}

suite('C# editing pre-module admission', () => {
	test('unrelated extensions keep the existing module-loading path without an RPC', async () => {
		let rpcCalls = 0;
		let loadCalls = 0;
		const result = await loadExtensionModuleAfterCSharpEditingAdmission(extension('publisher.other'), {
			$checkCSharpEditingAdmission: async () => {
				rpcCalls++;
				return { allowed: false, generation: 0, reason: 'not-protected' };
			}
		}, 'local', 0, async () => ++loadCalls);

		assert.deepStrictEqual({ result, rpcCalls, loadCalls }, { result: { module: 1, generation: 0 }, rpcCalls: 0, loadCalls: 1 });
	});

	for (const id of [clientId, runtimeId]) {
		test(`denies ${id} before its CommonJS or ESM module loader runs`, async () => {
			let loadCalls = 0;
			await assert.rejects(loadExtensionModuleAfterCSharpEditingAdmission(extension(id), {
				$checkCSharpEditingAdmission: async () => ({ allowed: false, generation: 0, reason: 'no-permit' })
			}, 'local', 0, async () => ++loadCalls), /not activated/i);
			assert.strictEqual(loadCalls, 0);
		});
	}

	test('integrates admission with pre-connection Bridge denial and benign diagnostics/completion', async () => {
		const events: string[] = [];
		const connections: unknown[][] = [];
		const logs: unknown[][] = [];
		const guarded = guardCSharpComponentFetchModule({
			get(...args: unknown[]) { connections.push(args); return 'connected'; },
			request(...args: unknown[]) { connections.push(args); return 'connected'; },
		}, clientId, { info: (...args: unknown[]) => { logs.push(args); } });

		const loaded = await loadExtensionModuleAfterCSharpEditingAdmission(extension(clientId), {
			$checkCSharpEditingAdmission: async () => ({ allowed: true, generation: 0 }),
		}, 'local', 0, async () => {
			events.push('module-loaded');
			assert.throws(() => guarded.get(CSHARP_VSWEBASSEMBLYBRIDGE_URL), /installation is disabled/);
			events.push('diagnostics', 'completion');
			return 'language-module';
		});

		assert.strictEqual(loaded.module, 'language-module');
		assert.deepStrictEqual(events, ['module-loaded', 'diagnostics', 'completion']);
		assert.strictEqual(connections.length, 0);
		assert.strictEqual(logs[0]?.[0], 'CSharpEditingComponentFetchDenied');
	});

	test('waits for admission before invoking either module format and accepts only the same generation', async () => {
		for (const format of ['commonjs', 'esm']) {
			const order: string[] = [];
			const loading = loadExtensionModuleAfterCSharpEditingAdmission(extension(clientId), {
				$checkCSharpEditingAdmission: async () => {
					order.push('admission');
					return { allowed: true, generation: 0 };
				}
			}, 'local', 0, async () => {
				order.push(`load-${format}`);
				return format;
			});

			assert.deepStrictEqual(await loading, { module: format, generation: 0 });
			assert.deepStrictEqual(order, ['admission', `load-${format}`]);
		}
	});

	test('denies malformed, stale, timed out and unavailable admission checks without loading modules', async () => {
		const invalidResponses: unknown[] = [
			{ allowed: true, generation: 0, extra: true },
			{ allowed: true, generation: 1 },
			{ allowed: false, generation: 0, reason: 'unknown' },
		];
		for (const response of invalidResponses) {
			let loadCalls = 0;
			await assert.rejects(loadExtensionModuleAfterCSharpEditingAdmission(extension(runtimeId), {
				$checkCSharpEditingAdmission: async () => response as never
			}, 'local', 0, async () => ++loadCalls), /not activated/i);
			assert.strictEqual(loadCalls, 0);
		}

		let loadCalls = 0;
		await assert.rejects(loadExtensionModuleAfterCSharpEditingAdmission(extension(clientId), {
			$checkCSharpEditingAdmission: () => new Promise(() => { })
		}, 'local', 0, async () => ++loadCalls, 1), /not activated/i);
		await assert.rejects(loadExtensionModuleAfterCSharpEditingAdmission(extension(clientId), {
			$checkCSharpEditingAdmission: async () => { throw new Error('missing coordinator'); }
		}, 'local', 0, async () => ++loadCalls), /not activated/i);
		assert.strictEqual(loadCalls, 0);
	});
});
