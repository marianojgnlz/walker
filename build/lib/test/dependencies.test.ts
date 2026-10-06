/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as path from 'path';
import { suite, test } from 'node:test';
import { filterExtraneousDependencies } from '../dependencies.ts';

suite('production dependency packaging', () => {
	test('omits extraneous package trees but keeps declared dependencies with version warnings', () => {
		const modules = path.resolve('node_modules');
		const copilot = path.join(modules, '@github', 'copilot-sdk');
		const nestedKoffi = path.join(copilot, 'node_modules', 'koffi');
		const invalidTunnel = path.join(modules, '@microsoft', 'dev-tunnels-ssh');
		const ripgrep = path.join(modules, '@vscode', 'ripgrep-universal');
		const npmOutput = [
			'npm error code ELSPROBLEMS',
			`npm error extraneous: @github/copilot-sdk@1.0.15 ${copilot}`,
			`npm error extraneous: koffi@3.2.1 ${nestedKoffi}`,
			`npm error invalid: @microsoft/dev-tunnels-ssh@3.12.22 ${invalidTunnel}`,
		].join('\n');

		assert.deepStrictEqual(
			filterExtraneousDependencies([copilot, nestedKoffi, invalidTunnel, ripgrep], npmOutput),
			[invalidTunnel, ripgrep]
		);
	});

	test('recognizes legacy npm error prefixes and leaves paths unchanged without extraneous entries', () => {
		const modules = path.resolve('node_modules');
		const removed = path.join(modules, 'obsolete-package');
		const retained = path.join(modules, 'retained-package');
		const npmOutput = `npm ERR! extraneous: obsolete-package@1.0.0 ${removed}`;

		assert.deepStrictEqual(filterExtraneousDependencies([removed, retained], npmOutput), [retained]);
		assert.deepStrictEqual(filterExtraneousDependencies([retained], 'npm error code ELSPROBLEMS'), [retained]);
	});
});
