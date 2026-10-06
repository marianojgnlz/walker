/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as assignmentFilters from '../../common/assignmentFilters.js';

suite('Assignment filter account boundary', () => {
	test('does not export account-backed GitHub TAS filters', () => {
		assert.strictEqual('GitHubAssignmentsFilter' in assignmentFilters, false);
		assert.strictEqual('GitHubCoreAssignmentsFilterProvider' in assignmentFilters, false);
	});

	test('does not export installed-Copilot assignment filters', () => {
		assert.strictEqual('CopilotAssignmentFilterProvider' in assignmentFilters, false);
		assert.strictEqual('ExtensionsFilter' in assignmentFilters, false);
	});
});
