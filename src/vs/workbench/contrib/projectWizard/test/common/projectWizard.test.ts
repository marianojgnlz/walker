/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getProjectNameValidationError } from '../../common/projectWizard.js';

suite('project wizard configuration', () => {
	test('accepts safe project names and rejects empty, malformed, traversal, and reserved names', () => {
		const results = [
			getProjectNameValidationError('CatalogApi'),
			getProjectNameValidationError('project-name_2.0'),
			getProjectNameValidationError(''),
			getProjectNameValidationError('  '),
			getProjectNameValidationError('--force'),
			getProjectNameValidationError('../outside'),
			getProjectNameValidationError('project name'),
			getProjectNameValidationError('CON.txt'),
			getProjectNameValidationError('project.'),
		];
		assert.deepStrictEqual(results, [undefined, undefined, 'empty', 'empty', 'format', 'format', 'format', 'reserved', 'format']);
	});
});
