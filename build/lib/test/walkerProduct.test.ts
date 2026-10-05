/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import es from 'event-stream';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { suite, test } from 'node:test';
import File from 'vinyl';
import { getBootstrapEntryPointsForTarget, type BuildTarget } from '../esbuild.ts';
import { inlineMeta } from '../inlineMeta.ts';
import { composeWalkerProduct } from '../walkerProduct.ts';

const expectedGallery = {
	serviceUrl: 'https://open-vsx.org/vscode/gallery',
	itemUrl: 'https://open-vsx.org/vscode/item',
	resourceUrlTemplate: 'https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}',
	controlUrl: 'https://open-vsx.org/vscode/gallery/control'
};

function readRootProduct(): Record<string, unknown> {
	const product: unknown = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../product.json'), 'utf8'));
	assert.ok(product && typeof product === 'object' && !Array.isArray(product));
	return product as Record<string, unknown>;
}

async function inlineProductForTarget(target: BuildTarget, productJson: string): Promise<File[]> {
	const stream = inlineMeta(es.readArray([new File({
		path: resolve(import.meta.dirname, 'bootstrap-fork.js'),
		contents: Buffer.from('export const product={BUILD_INSERT_PRODUCT_CONFIGURATION:"BUILD_INSERT_PRODUCT_CONFIGURATION"};')
	})]), {
		targetPaths: getBootstrapEntryPointsForTarget(target).map(entry => `${entry}.js`),
		packageJsonFn: () => '{}',
		productJsonFn: () => productJson
	});
	return new Promise<File[]>((resolveOutput, reject) => {
		stream.on('error', reject);
		stream.pipe(es.writeArray<File>((err, result) => {
			if (err) {
				reject(err);
			} else {
				resolveOutput(result);
			}
		}));
	});
}

suite('Walker packaged product composition', () => {
	test('maps the approved Open VSX quartet and preserves root Walker identity', () => {
		const rootProduct = readRootProduct();
		assert.ok(!('extensionsGallery' in rootProduct));

		const product = composeWalkerProduct(rootProduct);

		assert.deepStrictEqual(product.extensionsGallery, expectedGallery);
		assert.strictEqual(product.nameShort, rootProduct.nameShort);
		assert.strictEqual(product.applicationName, rootProduct.applicationName);
		assert.deepStrictEqual(product.builtInExtensions, rootProduct.builtInExtensions);
		assert.ok(!('extensionsGallery' in rootProduct));
	});

	test('serialized desktop product retains the effective gallery configuration', () => {
		const product = composeWalkerProduct(readRootProduct());
		const serializedProduct: unknown = JSON.parse(JSON.stringify(product));
		assert.ok(serializedProduct && typeof serializedProduct === 'object' && !Array.isArray(serializedProduct));
		assert.deepStrictEqual((serializedProduct as Record<string, unknown>).extensionsGallery, expectedGallery);
	});

	test('desktop bootstrap embeds the serialized Walker product and gallery quartet', async () => {
		const productJson = JSON.stringify(composeWalkerProduct(readRootProduct()));
		const output = await inlineProductForTarget('desktop', productJson);
		assert.strictEqual(output.length, 1);
		assert.strictEqual(output[0].contents?.toString(), `export const product=${productJson};`);
	});

	test('REH bootstrap embeds composed gallery config without losing remote build stamps', async () => {
		const rootProduct = readRootProduct();
		const remoteProduct = composeWalkerProduct({
			...rootProduct,
			commit: 'reh-test-commit',
			date: '2025-01-02T03:04:05Z',
			version: '1.2.3',
			agentSdks: { test: { version: '4.5.6' } }
		});
		const productJson = JSON.stringify(remoteProduct);
		const output = await inlineProductForTarget('server', productJson);

		assert.strictEqual(output.length, 1);
		assert.strictEqual(output[0].contents?.toString(), `export const product=${productJson};`);
		assert.deepStrictEqual(remoteProduct.extensionsGallery, expectedGallery);
		assert.strictEqual(remoteProduct.commit, 'reh-test-commit');
		assert.deepStrictEqual(remoteProduct.agentSdks, { test: { version: '4.5.6' } });
	});

	test('desktop entrypoints do not import the inert gallery account contribution', () => {
		const entrypoints = [
			'src/vs/workbench/workbench.desktop.main.ts',
			'src/vs/sessions/sessions.desktop.main.ts',
		];

		for (const entrypoint of entrypoints) {
			const source = readFileSync(resolve(import.meta.dirname, '../../../', entrypoint), 'utf8');
			assert.ok(!source.includes('extensionGalleryAccountService.js'), `${entrypoint} imports the inert gallery account contribution`);
		}
	});

	test('rejects missing, malformed, or provider-bearing gallery mixins', () => {
		const invalidMixins: unknown[] = [
			null,
			{},
			{
				serviceUrl: expectedGallery.serviceUrl,
				itemUrl: expectedGallery.itemUrl,
				resourceUrlTemplate: expectedGallery.resourceUrlTemplate,
				controlApiUrl: 'https://example.invalid/control'
			},
			{
				serviceUrl: expectedGallery.serviceUrl,
				itemUrl: expectedGallery.itemUrl,
				resourceUrlTemplate: expectedGallery.resourceUrlTemplate,
				controlApiUrl: expectedGallery.controlUrl,
				authenticationProvider: 'github'
			}
		];

		for (const mixin of invalidMixins) {
			assert.throws(() => composeWalkerProduct({}, mixin), /Invalid Walker Open VSX gallery mixin/);
		}
	});
});
