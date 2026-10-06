/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMcpServerConfiguration, IMcpStdioServerConfiguration, McpServerType } from './mcpPlatformTypes.js';

// ---------------------------------------------------------------------------
// MCP server configuration normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes a raw JSON value into a typed MCP server configuration.
 */
export function normalizeMcpServerConfiguration(rawConfig: unknown): IMcpServerConfiguration | undefined {
	if (!rawConfig || typeof rawConfig !== 'object') {
		return undefined;
	}

	const candidate = rawConfig as Record<string, unknown>;
	const type = typeof candidate['type'] === 'string' ? candidate['type'] : undefined;
	const transport = candidate['transport'] === 'sse' || candidate['transport'] === 'http' ? candidate['transport'] : undefined;

	const command = typeof candidate['command'] === 'string' ? candidate['command'] : undefined;
	const url = typeof candidate['url'] === 'string' ? candidate['url'] : undefined;
	const args = Array.isArray(candidate['args']) ? candidate['args'].filter((value): value is string => typeof value === 'string') : undefined;
	const env = candidate['env'] && typeof candidate['env'] === 'object'
		? Object.fromEntries(Object.entries(candidate['env'] as Record<string, unknown>)
			.filter(([, value]) => typeof value === 'string' || typeof value === 'number' || value === null)
			.map(([key, value]) => [key, value as string | number | null]))
		: undefined;
	const envFile = typeof candidate['envFile'] === 'string' ? candidate['envFile'] : undefined;
	const cwd = typeof candidate['cwd'] === 'string' ? candidate['cwd'] : undefined;
	const headers = candidate['headers'] && typeof candidate['headers'] === 'object'
		? Object.fromEntries(Object.entries(candidate['headers'] as Record<string, unknown>)
			.filter(([, value]) => typeof value === 'string')
			.map(([key, value]) => [key, value as string]))
		: undefined;
	const rawOAuth = candidate['oauth'] && typeof candidate['oauth'] === 'object' ? candidate['oauth'] as Record<string, unknown> : undefined;
	const oauthClientId = (typeof rawOAuth?.['clientId'] === 'string' ? rawOAuth['clientId'] : undefined)
		?? (typeof candidate['oauthClientId'] === 'string' ? candidate['oauthClientId'] : undefined);
	const oauth = oauthClientId ? { clientId: oauthClientId } : undefined;
	const dev = candidate['dev'] && typeof candidate['dev'] === 'object' ? candidate['dev'] as IMcpStdioServerConfiguration['dev'] : undefined;

	if (type === 'ws') {
		return undefined;
	}

	if (type === McpServerType.LOCAL || (!type && command)) {
		if (!command) {
			return undefined;
		}
		return { type: McpServerType.LOCAL, command, args, env, envFile, cwd, dev };
	}

	if (type === McpServerType.REMOTE || type === 'streamable-http' || type === 'sse' || (!type && url)) {
		if (!url) {
			return undefined;
		}
		return { type: McpServerType.REMOTE, ...(type === 'sse' || transport === 'sse' ? { transport: 'sse' as const } : {}), url, headers, ...(oauth ? { oauth } : {}), dev };
	}

	return undefined;
}
