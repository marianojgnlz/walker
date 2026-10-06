/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IOSProperties } from '../../../native/common/native.js';
import { IProductService } from '../../../product/common/productService.js';
import { createNativeAboutDialogDetails } from '../../electron-browser/dialog.js';

suite('Dialog', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const osProperties: IOSProperties = {
		type: 'Test OS',
		release: '1.0',
		arch: 'test-arch',
		platform: 'test',
		cpus: []
	};

	function productServiceWith(overrides: Partial<IProductService>): IProductService {
		return {
			_serviceBrand: undefined,
			nameLong: 'Test Product',
			version: '1.2.3',
			commit: 'abcdef0',
			date: '2026-01-02T03:04:05.000Z',
			...overrides
		} as IProductService;
	}

	test('reports the retained product, runtime and OS details', () => {
		const { title, details, detailsToCopy } = createNativeAboutDialogDetails(productServiceWith({}), osProperties);

		assert.strictEqual(title, 'Test Product');
		const lines = details.split('\n');
		assert.strictEqual(lines[0], 'Version: 1.2.3');
		assert.strictEqual(lines[1], 'Commit: abcdef0');
		assert.match(lines[2], /^Date: 2026-01-02T03:04:05\.000Z \([^)]+\)$/, 'the interactive details carry a relative time');
		assert.deepStrictEqual(lines.slice(3), [
			`Electron: ${process.versions['electron']}`,
			`ElectronBuildId: ${process.versions['microsoft-build']}`,
			`Chromium: ${process.versions['chrome']}`,
			`Node.js: ${process.versions['node']}`,
			`V8: ${process.versions['v8']}`,
			'OS: Test OS test-arch 1.0'
		]);
		// The copyable variant carries the same content without the relative time.
		assert.deepStrictEqual(detailsToCopy.split('\n').filter(line => line.startsWith('Date: ')), ['Date: 2026-01-02T03:04:05.000Z']);
	});

	test('keeps reporting versions with no product metadata available', () => {
		const { details } = createNativeAboutDialogDetails(productServiceWith({ commit: undefined, date: undefined }), osProperties);

		assert.deepStrictEqual(details.split('\n').filter(line => line.startsWith('Commit: ') || line.startsWith('Date: ')), [
			'Commit: Unknown',
			'Date: Unknown'
		]);
	});

	test('does not report removed Copilot runtime versions', () => {
		const { details, detailsToCopy } = createNativeAboutDialogDetails(productServiceWith({}), osProperties);

		for (const value of [details, detailsToCopy]) {
			assert.doesNotMatch(value, /@github\/copilot|@github\/copilot-sdk/, 'the About dialog must not report removed Copilot versions');
		}
	});

	test('marks target and universal builds in the version line', () => {
		assert.match(createNativeAboutDialogDetails(productServiceWith({ target: 'server' }), osProperties).details, /^Version: 1\.2\.3 \(server setup\)/);
		assert.match(createNativeAboutDialogDetails(productServiceWith({ darwinUniversalAssetId: 'universal' }), osProperties).details, /^Version: 1\.2\.3 \(Universal\)/);
	});
});
