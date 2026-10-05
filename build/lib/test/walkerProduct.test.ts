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

	test('product metadata and entrypoints do not expose account tunnel infrastructure', () => {
		const rootProduct = readRootProduct();
		assert.strictEqual(rootProduct.applicationName, 'walker');
		assert.ok(!('cliApplicationName' in rootProduct));
		assert.ok(!('tunnelApplicationName' in rootProduct));
		assert.ok(!('win32TunnelMutex' in rootProduct));
		assert.ok(!('win32TunnelServiceMutex' in rootProduct));

		const entrypoints = [
			'src/vs/workbench/workbench.desktop.main.ts',
		];

		for (const entrypoint of entrypoints) {
			const source = readFileSync(resolve(import.meta.dirname, '../../../', entrypoint), 'utf8');
			assert.ok(!source.includes('remoteTunnel'), `${entrypoint} wires account tunnel services`);
			assert.ok(!source.includes('tunnelAgentHost'), `${entrypoint} wires the account tunnel agent host`);
		}

		const remoteTunnelEntrypoints = [
			'src/vs/sessions/sessions.desktop.main.ts',
			'src/vs/sessions/sessions.web.main.ts',
			'src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts',
		];
		for (const entrypoint of remoteTunnelEntrypoints) {
			const source = readFileSync(resolve(import.meta.dirname, '../../../', entrypoint), 'utf8');
			assert.ok(!source.includes('remoteTunnel'), `${entrypoint} wires RemoteTunnel services or IPC`);
			if (entrypoint.endsWith('sharedProcessMain.ts')) {
				assert.ok(source.includes('ISharedTunnelsService'), 'shared process retains generic tunnel forwarding');
				assert.ok(source.includes('ISharedProcessTunnelService'), 'shared process retains its generic tunnel channel');
			}
			if (entrypoint.endsWith('sessions.desktop.main.ts')) {
				assert.ok(source.includes('sshAgentHost.contribution.js'), 'Sessions retains key-based SSH Agent Host connections');
			}
		}

		const cliEntrypoints = [
			'src/vs/code/node/cli.ts',
			'src/vs/platform/environment/common/argv.ts',
			'src/vs/platform/environment/node/argv.ts',
		];
		for (const entrypoint of cliEntrypoints) {
			const source = readFileSync(resolve(import.meta.dirname, '../../../', entrypoint), 'utf8');
			assert.ok(!source.includes("'tunnel'"), `${entrypoint} exposes the account tunnel command`);
		}

		const packagingFiles = [
			'build/azure-pipelines/darwin/steps/product-build-darwin-compile.yml',
			'build/azure-pipelines/linux/steps/product-build-linux-compile.yml',
			'build/azure-pipelines/win32/steps/product-build-win32-compile.yml',
			'build/gulpfile.vscode.win32.ts',
			'build/linux/dependencies-generator.ts',
			'build/win32/code.iss',
		];
		for (const packagingFile of packagingFiles) {
			const source = readFileSync(resolve(import.meta.dirname, '../../../', packagingFile), 'utf8');
			assert.ok(!source.includes('tunnelApplicationName'), `${packagingFile} packages a tunnel CLI`);
			assert.ok(!source.includes('TunnelApplicationName'), `${packagingFile} packages a tunnel CLI`);
		}

		const genericCliEntrypoints = [
			['src/vs/code/node/cli.ts', 'product.applicationName}-cli'],
			['build/azure-pipelines/darwin/steps/product-build-darwin-compile.yml', '${APP_NAME}-cli'],
			['build/azure-pipelines/linux/steps/product-build-linux-compile.yml', '${APP_NAME}-cli'],
			['build/azure-pipelines/win32/steps/product-build-win32-compile.yml', '$AppName-cli'],
			['build/gulpfile.vscode.win32.ts', 'CliApplicationName: `${product.applicationName}-cli`'],
			['build/linux/dependencies-generator.ts', '`${product.applicationName}-cli`'],
			['build/win32/code.iss', 'CliApplicationName'],
		] as const;
		for (const [entrypoint, marker] of genericCliEntrypoints) {
			const source = readFileSync(resolve(import.meta.dirname, '../../../', entrypoint), 'utf8');
			assert.ok(source.includes(marker), `${entrypoint} does not preserve the generic CLI name`);
		}

		for (const discoveryFile of ['build/npm/dirs.ts', 'build/gulpfile.extensions.ts', 'build/lib/extensions.ts']) {
			const source = readFileSync(resolve(import.meta.dirname, '../../../', discoveryFile), 'utf8');
			assert.ok(!source.includes('extensions/tunnel-forwarding'), `${discoveryFile} discovers cloud forwarding`);
		}
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
