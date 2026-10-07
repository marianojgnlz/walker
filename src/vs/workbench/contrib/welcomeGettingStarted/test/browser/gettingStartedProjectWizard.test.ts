/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { IWindowOpenable, IOpenWindowOptions } from '../../../../../platform/window/common/window.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { BrowserWorkspacesService } from '../../../../services/workspaces/browser/workspacesService.js';
import { CREATE_PROJECT_COMMAND_ID } from '../../../projectWizard/common/projectWizard.js';
import { createRecentWorkspaceLink } from '../../browser/gettingStarted.js';
import { startEntries } from '../../common/gettingStartedContent.js';

function createCanonicalHistory(): { readonly service: BrowserWorkspacesService; getStoredValue(): string | undefined } {
	let storedValue: string | undefined;
	const service = Object.create(BrowserWorkspacesService.prototype) as BrowserWorkspacesService;
	Object.defineProperties(service, {
		storageService: {
			value: {
				get: () => storedValue,
				store: async (_key: string, value: string) => { storedValue = value; },
			},
		},
		logService: { value: { warn: () => undefined } },
		contextService: { value: { getWorkspace: () => ({ configuration: URI.from({ scheme: 'tmp', path: '/temporary' }) }) } },
	});
	return { service, getStoredValue: () => storedValue };
}

suite('Welcome project creation and recent workspaces', () => {
	test('exposes the shared localized project wizard command from the Welcome page', () => {
		const entry = startEntries.find(candidate => candidate.id === 'topLevelNewDotnetProject');
		assert.ok(entry);
		assert.strictEqual(entry.title, 'New .NET Project');
		assert.strictEqual(entry.when, '!isWeb');
		assert.strictEqual(entry.content.type, 'startEntry');
		assert.strictEqual(entry.content.command, `command:${CREATE_PROJECT_COMMAND_ID}`);
	});

	test('uses canonical recent-workspace ordering and deduplication for created projects', async () => {
		const history = createCanonicalHistory();
		const first = URI.file('/projects/first');
		const second = URI.file('/projects/second');
		await history.service.addRecentlyOpened([{ folderUri: first }, { folderUri: second }, { folderUri: first }]);

		const recent = await history.service.getRecentlyOpened();
		assert.deepStrictEqual(recent.workspaces.map(entry => 'folderUri' in entry ? entry.folderUri.fsPath : entry.workspace.configPath.fsPath), [first.fsPath, second.fsPath]);
		assert.ok(history.getStoredValue(), 'the canonical service owns recent-workspace storage');
	});

	test('opens a recent folder through normal window navigation and remains keyboard focusable', () => {
		const folder = URI.file('/projects/catalog');
		const opened: { readonly openables: readonly IWindowOpenable[]; readonly options: IOpenWindowOptions | undefined }[] = [];
		const errors: string[] = [];
		const link = createRecentWorkspaceLink('Catalog', '/projects', { folderUri: folder }, { folderUri: folder }, {
			openWindow: async (openables: IWindowOpenable[], options?: IOpenWindowOptions) => { opened.push({ openables, options }); },
		} as Pick<IHostService, 'openWindow'>, {
			error: message => { errors.push(message as string); },
		} as Pick<INotificationService, 'error'>);
		document.body.appendChild(link);
		link.focus();
		link.click();

		assert.strictEqual(link.tagName, 'BUTTON');
		assert.strictEqual(link.tabIndex, 0);
		assert.strictEqual(document.activeElement, link);
		assert.deepStrictEqual(opened.map(entry => [entry.openables[0], entry.options?.forceNewWindow]), [[{ folderUri: folder }, false]]);
		assert.deepStrictEqual(errors, []);
		link.remove();
	});

	test('honors the new-window modifier when opening a recent folder', () => {
		const folder = URI.file('/projects/catalog');
		let forceNewWindow: boolean | undefined;
		const link = createRecentWorkspaceLink('Catalog', '/projects', { folderUri: folder }, { folderUri: folder }, {
			openWindow: async (_openables: IWindowOpenable[], options?: IOpenWindowOptions) => { forceNewWindow = options?.forceNewWindow; },
		} as Pick<IHostService, 'openWindow'>, {
			error: () => undefined,
		} as Pick<INotificationService, 'error'>);
		document.body.appendChild(link);
		link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
		assert.strictEqual(forceNewWindow, true);
		link.remove();
	});

	test('reports a missing recent path when normal workspace opening fails without changing history', async () => {
		const folder = URI.file('/projects/deleted');
		const errors: string[] = [];
		const history = createCanonicalHistory();
		await history.service.addRecentlyOpened([{ folderUri: folder }]);
		const historyBeforeOpen = history.getStoredValue();
		const link = createRecentWorkspaceLink('Deleted', '/projects', { folderUri: folder }, { folderUri: folder }, {
			openWindow: async (_openables: IWindowOpenable[], _options?: IOpenWindowOptions) => { throw new Error('missing folder'); },
		} as Pick<IHostService, 'openWindow'>, {
			error: message => { errors.push(message as string); },
		} as Pick<INotificationService, 'error'>);
		document.body.appendChild(link);
		link.click();
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(errors.length, 1);
		assert.ok(errors[0].includes('Remove it from Recent'));
		assert.strictEqual(history.getStoredValue(), historyBeforeOpen, 'open failure leaves canonical history unchanged for explicit user removal');
		link.remove();
	});
});
