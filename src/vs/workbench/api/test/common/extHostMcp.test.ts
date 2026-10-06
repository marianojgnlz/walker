/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import { DeferredPromise } from '../../../../base/common/async.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { mock } from '../../../../base/test/common/mock.js';
import { LogLevel, NullLogService } from '../../../../platform/log/common/log.js';
import { MainThreadMcpShape } from '../../common/extHost.protocol.js';
import { CommonRequestInit, CommonResponse, McpHTTPHandle } from '../../common/extHostMcp.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { McpServerTransportType } from '../../../contrib/mcp/common/mcpTypes.js';

// Test constants to avoid magic strings
const TEST_MCP_URL = 'https://example.com/mcp';

/**
 * Creates a mock CommonResponse for testing.
 */
function createMockResponse(options: {
	status?: number;
	statusText?: string;
	url?: string;
	headers?: Record<string, string>;
	body?: string;
}): CommonResponse {
	const headers = new Headers(options.headers ?? {});
	return {
		status: options.status ?? 200,
		statusText: options.statusText ?? 'OK',
		url: options.url ?? TEST_MCP_URL,
		headers,
		body: null,
		json: async () => JSON.parse(options.body ?? '{}'),
		text: async () => options.body ?? '',
	};
}


suite('ExtHostMcp', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	suite('McpHTTPHandle stream cleanup', () => {
		teardown(() => sinon.restore());

		const createStreamingHandle = async () => {
			const reading = new DeferredPromise<void>();
			const backchannelStopped = new DeferredPromise<void>();
			let controller!: ReadableStreamDefaultController<Uint8Array>;
			const stream = new ReadableStream<Uint8Array>({
				start: value => { controller = value; },
				pull: () => { void reading.complete(); },
			}, { highWaterMark: 0 });
			const reader = stream.getReader();
			sinon.stub(stream, 'getReader').returns(reader);
			const cancel = sinon.spy(reader, 'cancel');
			const warnings: string[] = [];
			const proxy = new class extends mock<MainThreadMcpShape>() {
				override $onDidChangeState(): void { }
				override $onDidPublishLog(_id: number, level: LogLevel, message: string): void {
					if (level === LogLevel.Warning) {
						warnings.push(message);
					}
					if (message.startsWith('405 status connecting')) {
						void backchannelStopped.complete();
					}
				}
			};
			const handle = store.add(new class extends McpHTTPHandle {
				protected override async _fetchInternal(_url: string, init?: CommonRequestInit): Promise<CommonResponse> {
					if (init?.method === 'GET') {
						return createMockResponse({ status: 405 });
					}
					assert.strictEqual(init?.method, 'POST');
					const signal = init?.signal;
					assert.ok(signal);
					const onAbort = () => controller.error(signal.reason);
					signal.addEventListener('abort', onAbort, { once: true });
					store.add(toDisposable(() => signal.removeEventListener('abort', onAbort)));
					return { ...createMockResponse({ headers: { 'Content-Type': 'text/event-stream' } }), body: stream };
				}
			}(1, { type: McpServerTransportType.HTTP, uri: URI.parse(TEST_MCP_URL), headers: [] }, proxy, store.add(new NullLogService())));
			store.add(toDisposable(() => reader.releaseLock()));
			const sending = handle.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
			await Promise.all([reading.p, backchannelStopped.p]);
			return { handle, controller, cancel, sending, warnings };
		};

		test('does not cancel an already-aborted reader when disposed', async () => {
			const { handle, cancel, sending, warnings } = await createStreamingHandle();
			handle.dispose();
			await sending;
			// Observe any redundant cancellation rejection so the regression fails on the assertion below.
			await Promise.all(cancel.returnValues.map(result => assert.rejects(result, { name: 'AbortError' })));
			assert.deepStrictEqual({ cancellations: cancel.callCount, warnings }, { cancellations: 0, warnings: [] });
		});

		test('still reports a stream read failure while the handle is active', async () => {
			const { controller, cancel, sending, warnings } = await createStreamingHandle();
			const error = new Error('fixture stream read failed');
			controller.error(error);
			await sending;
			await Promise.all(cancel.returnValues.map(result => assert.rejects(result, candidate => candidate === error)));
			assert.deepStrictEqual({ cancellations: cancel.callCount, warnings }, {
				cancellations: 1,
				warnings: ['Error reading SSE stream: Error: fixture stream read failed'],
			});
		});
	});
});
