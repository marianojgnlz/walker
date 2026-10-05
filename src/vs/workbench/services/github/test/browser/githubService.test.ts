/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { WorkbenchGitHubService, WorkbenchGitHubTokenProvider } from '../../browser/githubService.js';

suite('Workbench GitHub service', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('does not request authentication or default-account data for GitHub link enrichment', async () => {
		const tokenProvider = new WorkbenchGitHubTokenProvider();
		const service = new WorkbenchGitHubService(new NullLogService());
		const controller = new AbortController();

		assert.deepStrictEqual({
			token: await tokenProvider.getToken(controller.signal),
			api: service.endpoint.getApiBaseUri(),
			graphql: service.endpoint.getGraphQlUri(),
		}, {
			token: undefined,
			api: 'https://api.github.com',
			graphql: 'https://api.github.com/graphql',
		});
		await assert.rejects(service.credentials.getCredential(controller.signal), /authentication is required/i);
		service.dispose();
	});
});
