/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ElicitationKind, ElicitResult, IMcpElicitationService, IMcpServer, IMcpToolCallContext } from '../common/mcpTypes.js';
import { MCP } from '../common/modelContextProtocol.js';

/**
 * Retained MCP elicitation service. Elicitation asks the user for input through
 * the chat UI, which is unavailable once the chat tree is removed, so this
 * service keeps the interface contract and declines every elicitation request.
 * The full implementation was removed with the chat tree.
 */
export class McpElicitationService implements IMcpElicitationService {
	declare readonly _serviceBrand: undefined;

	async elicit(_server: IMcpServer, _context: IMcpToolCallContext | undefined, _elicitation: MCP.ElicitRequest['params'], _token: CancellationToken): Promise<ElicitResult> {
		return {
			kind: ElicitationKind.Form,
			value: { action: 'decline' },
			dispose() { },
		};
	}
}
