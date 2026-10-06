/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMarkdownString } from '../../../base/common/htmlContent.js';
import { URI } from '../../../base/common/uri.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { IProgress } from '../../../platform/progress/common/progress.js';

/**
 * Progress reporting contract for a running tool invocation. Extracted from the
 * chat language-model tool service so retained MCP tool plumbing does not
 * depend on the chat tree.
 */
export interface IToolProgressStep {
	readonly message: string | IMarkdownString | undefined;
	/** 0-1 progress of the tool call */
	readonly progress?: number;
}

export type ToolProgress = IProgress<IToolProgressStep>;

/**
 * Identifies where a tool came from. Extracted with {@link ToolProgress}.
 */
export type ToolDataSource =
	| {
		type: 'extension';
		label: string;
		extensionId: ExtensionIdentifier;
	}
	| {
		type: 'mcp';
		label: string;
		serverLabel: string | undefined;
		instructions: string | undefined;
		collectionId: string;
		definitionId: string;
	}
	| {
		type: 'user';
		label: string;
		file: URI;
	}
	| {
		type: 'internal';
		label: string;
	} | {
		type: 'external';
		label: string;
	};
