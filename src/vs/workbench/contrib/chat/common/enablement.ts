/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// The enablement model was extracted to the neutral `platform/mcp` layer so that
// the retained MCP tree does not depend on the chat tree. Only deletion-bound
// chat/sessions consumers import this module any more; this shim keeps them
// compiling until they are removed.
export * from '../../../../platform/mcp/common/contributionEnablement.js';
