/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { McpServerType } from '../../common/mcpPlatformTypes.js';
import { normalizeMcpServerConfiguration } from '../../common/mcpServerConfigurationNormalizer.js';

suite('mcpServerConfigurationNormalizer', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('returns undefined for non-object input', () => {
		assert.strictEqual(normalizeMcpServerConfiguration(null), undefined);
		assert.strictEqual(normalizeMcpServerConfiguration('string'), undefined);
		assert.strictEqual(normalizeMcpServerConfiguration(42), undefined);
	});

	test('parses local server with command', () => {
		const result = normalizeMcpServerConfiguration({
			type: 'stdio',
			command: 'node',
			args: ['server.js'],
			env: { KEY: 'value' },
			cwd: '/workspace',
		});
		assert.ok(result);
		assert.strictEqual(result!.type, McpServerType.LOCAL);
		assert.strictEqual((result as { command: string }).command, 'node');
	});

	test('infers local type from command without explicit type', () => {
		const result = normalizeMcpServerConfiguration({ command: 'python' });
		assert.ok(result);
		assert.strictEqual(result!.type, McpServerType.LOCAL);
	});

	test('parses remote server with url', () => {
		const result = normalizeMcpServerConfiguration({
			type: 'sse',
			url: 'https://example.com',
			headers: { 'X-Key': 'val' },
		});
		assert.deepStrictEqual(result, {
			type: McpServerType.REMOTE,
			transport: 'sse',
			url: 'https://example.com',
			headers: { 'X-Key': 'val' },
			dev: undefined,
		});
	});

	test('preserves canonical SSE transport', () => {
		assert.deepStrictEqual(normalizeMcpServerConfiguration({
			type: 'http',
			transport: 'sse',
			url: 'https://example.com/sse',
		}), {
			type: McpServerType.REMOTE,
			transport: 'sse',
			url: 'https://example.com/sse',
			headers: undefined,
			dev: undefined,
		});
	});

	test('parses plain http type as remote without a transport override', () => {
		assert.deepStrictEqual(normalizeMcpServerConfiguration({
			type: 'http',
			url: 'https://example.com/mcp',
			headers: { 'X-Key': 'val' },
		}), {
			type: McpServerType.REMOTE,
			url: 'https://example.com/mcp',
			headers: { 'X-Key': 'val' },
			dev: undefined,
		});
	});

	test('preserves VS Code OAuth client configuration', () => {
		assert.deepStrictEqual(normalizeMcpServerConfiguration({
			type: 'http',
			url: 'https://mcp.slack.com/mcp',
			oauth: { clientId: 'vscode-client-id' },
		}), {
			type: McpServerType.REMOTE,
			url: 'https://mcp.slack.com/mcp',
			headers: undefined,
			oauth: { clientId: 'vscode-client-id' },
			dev: undefined,
		});
	});

	test('normalizes Copilot SDK OAuth client configuration', () => {
		assert.deepStrictEqual(normalizeMcpServerConfiguration({
			type: 'http',
			url: 'https://mcp.slack.com/mcp',
			oauthClientId: 'sdk-client-id',
		}), {
			type: McpServerType.REMOTE,
			url: 'https://mcp.slack.com/mcp',
			headers: undefined,
			oauth: { clientId: 'sdk-client-id' },
			dev: undefined,
		});
	});

	test('infers remote type from url without explicit type', () => {
		const result = normalizeMcpServerConfiguration({ url: 'https://example.com' });
		assert.ok(result);
		assert.strictEqual(result!.type, McpServerType.REMOTE);
	});

	test('rejects ws type', () => {
		const result = normalizeMcpServerConfiguration({ type: 'ws', url: 'ws://localhost:3000' });
		assert.strictEqual(result, undefined);
	});

	test('rejects local type without command', () => {
		const result = normalizeMcpServerConfiguration({ type: 'stdio' });
		assert.strictEqual(result, undefined);
	});

	test('filters non-string args', () => {
		const result = normalizeMcpServerConfiguration({
			command: 'test',
			args: ['valid', 42, null, 'also-valid'],
		});
		assert.ok(result);
		const args = (result as { args?: string[] }).args;
		assert.deepStrictEqual(args, ['valid', 'also-valid']);
	});

	test('keeps string, number and null env values and drops other types', () => {
		assert.deepStrictEqual(normalizeMcpServerConfiguration({
			command: 'node',
			env: { STR: 'value', NUM: 42, NIL: null, DROP: false, OBJ: {} },
		}), {
			type: McpServerType.LOCAL,
			command: 'node',
			args: undefined,
			env: { STR: 'value', NUM: 42, NIL: null },
			envFile: undefined,
			cwd: undefined,
			dev: undefined,
		});
	});

	test('keeps string headers and drops non-string header values', () => {
		assert.deepStrictEqual(normalizeMcpServerConfiguration({
			url: 'https://example.com/mcp',
			headers: { 'X-Key': 'val', 'X-Drop': 1 },
		}), {
			type: McpServerType.REMOTE,
			url: 'https://example.com/mcp',
			headers: { 'X-Key': 'val' },
			dev: undefined,
		});
	});
});
