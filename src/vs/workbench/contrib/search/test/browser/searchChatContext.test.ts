/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IFileQuery, ISearchService } from '../../../../services/search/common/search.js';
import { MAX_CHAT_FILE_COMPLETION_RESULTS, searchFilesAndFolders } from '../../browser/searchChatContext.js';

function readSearchSource(file: string): string {
	return readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/search/browser', file), 'utf8');
}

suite('Search Chat Context', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('Search keeps ordinary quick access without chat integrations', () => {
		const contribution = readSearchSource('search.contribution.ts');
		assert.doesNotMatch(contribution, /SearchChatContextContribution|searchChatContext\.js/);
		assert.match(contribution, /searchWidgetContributions\(\);/);
		assert.match(contribution, /registerViews\(\[viewDescriptor\], viewContainer\)/);

		const anythingQuickAccess = readSearchSource('anythingQuickAccess.ts');
		assert.doesNotMatch(anythingQuickAccess, /ASK_QUICK_QUESTION_ACTION_ID|IQuickChatService|IChatWidgetService|quickChatService|chatWidgetService|attachmentModel/);
		assert.doesNotMatch(anythingQuickAccess, /attach:\s*\(/);
		assert.match(anythingQuickAccess, /class AnythingQuickAccessProvider/);
		assert.match(anythingQuickAccess, /accept:\s*\(/);

		const symbolsQuickAccess = readSearchSource('symbolsQuickAccess.ts');
		assert.doesNotMatch(symbolsQuickAccess, /IChatWidgetService|ISymbolVariableEntry|chatWidgetService|attachmentModel/);
		assert.doesNotMatch(symbolsQuickAccess, /attach:\s*\(/);
		assert.match(symbolsQuickAccess, /class SymbolsQuickAccessProvider/);
		assert.match(symbolsQuickAccess, /accept:\s*(?:async\s*)?\(/);
	});

	test('limits file completion search results', async () => {
		const instantiationService = store.add(new TestInstantiationService());
		let actualMaxResults: number | undefined;
		instantiationService.stub(ISearchService, {
			fileSearch: async (query: IFileQuery) => {
				actualMaxResults = query.maxResults;
				return { results: [], messages: [] };
			},
		});

		await searchFilesAndFolders(
			URI.file('/workspace'),
			'file',
			true,
			CancellationToken.None,
			undefined,
			new TestConfigurationService(),
			instantiationService.get(ISearchService),
			MAX_CHAT_FILE_COMPLETION_RESULTS
		);

		assert.strictEqual(actualMaxResults, 100);
	});
});
