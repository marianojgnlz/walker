/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IMcpServerSamplingConfiguration } from './mcpConfiguration.js';
import { IMcpSamplingService, IMcpServer, ISamplingOptions, ISamplingResult, McpError } from './mcpTypes.js';

/**
 * Retained MCP sampling service. Sampling requires a language-model service,
 * which is unavailable once the chat tree is removed, so this service keeps the
 * interface contract, rejects sampling requests and reports no sampling logs.
 * The full implementation (model selection, approvals, sampling log) was
 * removed with the chat tree.
 */
export class McpSamplingService implements IMcpSamplingService {
	declare readonly _serviceBrand: undefined;

	async sample(_opts: ISamplingOptions, _token = CancellationToken.None): Promise<ISamplingResult> {
		throw McpError.notAllowed();
	}

	hasLogs(_server: IMcpServer): boolean {
		return false;
	}

	getLogText(_server: IMcpServer): string {
		return '';
	}

	getConfig(_server: IMcpServer): IMcpServerSamplingConfiguration {
		return {};
	}

	async updateConfig(_server: IMcpServer, mutate: (r: IMcpServerSamplingConfiguration) => unknown): Promise<IMcpServerSamplingConfiguration> {
		const config: IMcpServerSamplingConfiguration = {};
		mutate(config);
		return config;
	}
}
