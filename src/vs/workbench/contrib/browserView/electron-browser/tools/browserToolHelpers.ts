/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { isBrowserViewAssociatedResourceNavigation } from '../../../../../platform/browserView/common/browserView.js';
import { IAgentNetworkFilterService } from '../../../../../platform/networkFilter/common/networkFilterService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { BrowserEditorInput } from '../../common/browserEditorInput.js';

export interface FormatBrowserEditorLinesOptions {
	indent?: string;
	numbered?: boolean;
	excludeIds?: boolean;
	agentNetworkFilterService?: IAgentNetworkFilterService;
}

/**
 * Formats a list of browser editors as summary lines such as
 * `- [pageId] Title (url) (active)`. Active/visible hints are
 * derived from the editor service automatically.
 *
 * When {@link FormatBrowserEditorLinesOptions.agentNetworkFilterService} is
 * provided, pages whose URL is blocked by network policy are masked to avoid
 * leaking title or URL to the model.
 */
export function formatBrowserEditorList(editorService: IEditorService, editors: readonly BrowserEditorInput[], options?: FormatBrowserEditorLinesOptions): string {
	const activeEditor = editorService.activeEditor;
	const visibleEditors = new Set(editorService.visibleEditors);
	const indent = options?.indent ?? '';
	const filterService = options?.agentNetworkFilterService;
	return editors.map((editor, index) => {
		const url = editor.url || 'about:blank';

		// If the page URL is blocked by network policy, mask its details.
		let blocked = false;
		if (filterService && url !== 'about:blank') {
			try { blocked = !filterService.isUriAllowed(URI.parse(url)); } catch { }
		}

		const title = blocked ? localize('browser.blockedByPolicy', "Blocked by network domain policy") : (editor.title || 'Untitled');
		const displayUrl = blocked ? '' : ` (${url})`;
		const resourceNavigationHint = editor.associatedResource ? ' (resource-backed; navigation is limited to this resource)' : '';
		const hint = editor === activeEditor ? ' (active)' : visibleEditors.has(editor) ? ' (visible)' : ' (not visible)';
		const id = options?.excludeIds ? '' : `[${editor.id}] `;

		// By default, use numbers only if we're excluding IDs, so models don't get confused about which ID to use.
		const bullet = (options?.numbered ?? options?.excludeIds) ? `${index + 1}. ` : '- ';
		return `${indent}${bullet}${id}${title}${displayUrl}${resourceNavigationHint}${hint}`;
	}).join('\n');
}

export function getBrowserPageResourceNavigationError(editor: BrowserEditorInput | undefined, target: string): string | undefined {
	if (!editor?.associatedResource || isBrowserViewAssociatedResourceNavigation(editor.associatedResource, target)) {
		return undefined;
	}

	return 'This browser page is associated with a resource and cannot be navigated to a different resource. Only query and fragment changes are allowed. Use a different page or open a new one with the open_browser_page tool.';
}
