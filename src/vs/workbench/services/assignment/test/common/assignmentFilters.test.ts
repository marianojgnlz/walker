/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IExtensionDescription } from '../../../../../platform/extensions/common/extensions.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IStorageService, InMemoryStorageService } from '../../../../../platform/storage/common/storage.js';
import { IExtensionService } from '../../../extensions/common/extensions.js';
import { TestExtensionService, mock } from '../../../../test/common/workbenchTestServices.js';
import { CopilotAssignmentFilterProvider, ExtensionsFilter } from '../../common/assignmentFilters.js';
import * as assignmentFilters from '../../common/assignmentFilters.js';

suite('Assignment filter account boundary', () => {
	test('does not export account-backed GitHub TAS filters', () => {
		assert.strictEqual('GitHubAssignmentsFilter' in assignmentFilters, false);
		assert.strictEqual('GitHubCoreAssignmentsFilterProvider' in assignmentFilters, false);
	});
});

suite('CopilotAssignmentFilterProvider', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('exposes only extension-version filters without reading account state', () => {
		const instantiationService = disposables.add(new TestInstantiationService());
		instantiationService.stub(IExtensionService, new TestExtensionService());
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IStorageService, disposables.add(new InMemoryStorageService()));

		const provider = disposables.add(instantiationService.createInstance(CopilotAssignmentFilterProvider));

		assert.deepStrictEqual([...provider.getFilters().keys()], [
			ExtensionsFilter.CopilotExtensionVersion,
			ExtensionsFilter.CopilotChatExtensionVersion,
			ExtensionsFilter.CompletionsVersionInCopilotChat,
		]);
	});

	test('retains Copilot extension versions as assignment filters', async () => {
		const extension = new class extends mock<IExtensionDescription>() {
			override readonly version = '0.68.0-insider';
		}();
		const extensionService = new class extends mock<IExtensionService>() {
			override readonly onDidChangeExtensionsStatus = Event.None;
			override async getExtension(id: string): Promise<IExtensionDescription | undefined> {
				return id === 'github.copilot-chat' ? extension : undefined;
			}
		}();
		const instantiationService = disposables.add(new TestInstantiationService());
		instantiationService.stub(IExtensionService, extensionService);
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IStorageService, disposables.add(new InMemoryStorageService()));

		const provider = disposables.add(instantiationService.createInstance(CopilotAssignmentFilterProvider));
		await Event.toPromise(provider.onDidChangeFilters);

		assert.deepStrictEqual([...provider.getFilters()], [
			[ExtensionsFilter.CopilotExtensionVersion, null],
			[ExtensionsFilter.CopilotChatExtensionVersion, '0.68.0'],
			[ExtensionsFilter.CompletionsVersionInCopilotChat, null],
		]);
	});
});
