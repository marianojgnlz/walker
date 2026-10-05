/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import es from 'event-stream';
import path from 'path';
import { suite, test } from 'node:test';
import File from 'vinyl';
import { getBootstrapEntryPointsForTarget, type BuildTarget } from '../esbuild.ts';
import { composeWalkerProduct } from '../walkerProduct.ts';
import { inlineMeta } from '../inlineMeta.ts';

suite('Bootstrap package metadata', () => {
	const targets: { target: BuildTarget; files: string[] }[] = [
		{ target: 'desktop', files: ['main.js', 'cli.js', 'bootstrap-fork.js'] },
		{ target: 'server', files: ['server-main.js', 'server-cli.js', 'bootstrap-fork.js'] },
		{ target: 'server-web', files: ['server-main.js', 'server-cli.js', 'bootstrap-fork.js'] },
		{ target: 'web', files: [] },
	];

	for (const { target, files } of targets) {
		test(`${target} uses the bundler's bootstrap files for metadata injection`, async () => {
			const filenames = ['main.js', 'cli.js', 'server-main.js', 'server-cli.js', 'bootstrap-fork.js', 'other.js'];
			const original = 'export const config={BUILD_INSERT_PACKAGE_CONFIGURATION:"BUILD_INSERT_PACKAGE_CONFIGURATION"};';
			const packageJson = JSON.stringify({ name: 'Code - OSS', version: '1.0.0' });
			const stream = inlineMeta(es.readArray(filenames.map(filename => new File({
				path: path.join(import.meta.dirname, filename),
				contents: Buffer.from(original)
			}))), {
				targetPaths: getBootstrapEntryPointsForTarget(target).map(entry => `${entry}.js`),
				packageJsonFn: () => packageJson,
				productJsonFn: () => '{}'
			});
			const output = await new Promise<File[]>((resolve, reject) => {
				stream.on('error', reject);
				stream.pipe(es.writeArray<File>((err, result) => {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				}));
			});
			assert.deepStrictEqual(output.map(file => ({
				name: file.basename,
				contents: file.contents?.toString()
			})), filenames.map(name => ({
				name,
				contents: files.includes(name) ? `export const config=${packageJson};` : original
			})));
		});
	}

	test('desktop and REH bootstrap entries embed the serialized Walker gallery product', async () => {
		const targets: BuildTarget[] = ['desktop', 'server', 'server-web'];
		const filenames = ['main.js', 'cli.js', 'server-main.js', 'server-cli.js', 'bootstrap-fork.js', 'other.js'];
		const original = 'export const product={BUILD_INSERT_PRODUCT_CONFIGURATION:"BUILD_INSERT_PRODUCT_CONFIGURATION"};';
		const productJson = JSON.stringify(composeWalkerProduct({
			nameShort: 'Walker',
			applicationName: 'walker',
			builtInExtensions: []
		}));

		for (const target of targets) {
			const stream = inlineMeta(es.readArray(filenames.map(filename => new File({
				path: path.join(import.meta.dirname, filename),
				contents: Buffer.from(original)
			}))), {
				targetPaths: getBootstrapEntryPointsForTarget(target).map(entry => `${entry}.js`),
				packageJsonFn: () => '{}',
				productJsonFn: () => productJson
			});
			const output = await new Promise<File[]>((resolve, reject) => {
				stream.on('error', reject);
				stream.pipe(es.writeArray<File>((err, result) => {
					if (err) {
						reject(err);
					} else {
						resolve(result);
					}
				}));
			});
			assert.deepStrictEqual(output.map(file => ({
				name: file.basename,
				contents: file.contents?.toString()
			})), filenames.map(name => ({
				name,
				contents: getBootstrapEntryPointsForTarget(target).some(entry => `${entry}.js` === name) ? `export const product=${productJson};` : original
			})));
		}
	});

	test('injects the packaged product and package metadata together', async () => {
		const filenames = ['main.js', 'other.js'];
		const original = 'export const config={BUILD_INSERT_PACKAGE_CONFIGURATION:"BUILD_INSERT_PACKAGE_CONFIGURATION"}; export const product={BUILD_INSERT_PRODUCT_CONFIGURATION:"BUILD_INSERT_PRODUCT_CONFIGURATION"};';
		const packageJson = JSON.stringify({ name: 'Walker', version: '1.0.0' });
		const productJson = JSON.stringify(composeWalkerProduct({ nameShort: 'Walker', applicationName: 'walker', builtInExtensions: [] }));
		let packageCalls = 0;
		let productCalls = 0;
		const stream = inlineMeta(es.readArray(filenames.map(filename => new File({
			path: path.join(import.meta.dirname, filename),
			contents: Buffer.from(original)
		}))), {
			targetPaths: getBootstrapEntryPointsForTarget('desktop').map(entry => `${entry}.js`),
			packageJsonFn: () => {
				packageCalls++;
				return packageJson;
			},
			productJsonFn: () => {
				productCalls++;
				return productJson;
			}
		});
		const output = await new Promise<File[]>((resolve, reject) => {
			stream.on('error', reject);
			stream.pipe(es.writeArray<File>((err, result) => {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}));
		});

		assert.deepStrictEqual(output.map(file => file.contents?.toString()), [
			`export const config=${packageJson}; export const product=${productJson};`,
			original
		]);
		assert.strictEqual(packageCalls, 1);
		assert.strictEqual(productCalls, 1);
	});
});
