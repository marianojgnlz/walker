/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import es from 'event-stream';
import { existsSync, readFileSync } from 'fs';
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

		const removedSessionsEntrypoints = [
			'src/vs/sessions/sessions.desktop.main.ts',
			'src/vs/sessions/sessions.web.main.ts',
		];
		for (const entrypoint of removedSessionsEntrypoints) {
			assert.ok(!existsSync(resolve(import.meta.dirname, '../../../', entrypoint)), `${entrypoint} survived the Sessions tree removal`);
		}

		const sharedProcessEntrypoint = 'src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts';
		const sharedProcessSource = readFileSync(resolve(import.meta.dirname, '../../../', sharedProcessEntrypoint), 'utf8');
		assert.ok(!sharedProcessSource.includes('remoteTunnel'), `${sharedProcessEntrypoint} wires RemoteTunnel services or IPC`);
		assert.ok(sharedProcessSource.includes('ISharedTunnelsService'), 'shared process retains generic tunnel forwarding');
		assert.ok(sharedProcessSource.includes('ISharedProcessTunnelService'), 'shared process retains its generic tunnel channel');

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
		];

		for (const entrypoint of entrypoints) {
			const source = readFileSync(resolve(import.meta.dirname, '../../../', entrypoint), 'utf8');
			assert.ok(!source.includes('extensionGalleryAccountService.js'), `${entrypoint} imports the inert gallery account contribution`);
		}
		assert.ok(!existsSync(resolve(import.meta.dirname, '../../../src/vs/sessions/sessions.desktop.main.ts')), 'the Sessions desktop entrypoint survived the Sessions tree removal');
	});

	test('workbench and Sessions entrypoints do not register Chat integrations', () => {
		const entrypoints = [
			['src/vs/workbench/workbench.common.main.ts', ['services/chat/', 'contrib/chat/', 'contrib/inlineChat/', 'contrib/agentsVoice/', 'contrib/welcomeAgentSessions/']],
			['src/vs/workbench/workbench.desktop.main.ts', ['contrib/chat/', 'contrib/agentsVoice/']],
		] as const;

		for (const [entrypoint, forbiddenImports] of entrypoints) {
			const source = readFileSync(resolve(import.meta.dirname, '../../../', entrypoint), 'utf8');
			for (const forbiddenImport of forbiddenImports) {
				assert.ok(!source.includes(forbiddenImport), `${entrypoint} still references ${forbiddenImport}`);
			}
		}

		const removedSessionsEntrypoints = [
			'src/vs/sessions/sessions.common.main.ts',
			'src/vs/sessions/sessions.desktop.main.ts',
			'src/vs/sessions/sessions.web.main.ts',
		];
		for (const entrypoint of removedSessionsEntrypoints) {
			assert.ok(!existsSync(resolve(import.meta.dirname, '../../../', entrypoint)), `${entrypoint} survived the Sessions tree removal`);
		}

		const commonWorkbench = readFileSync(resolve(import.meta.dirname, '../../../src/vs/workbench/workbench.common.main.ts'), 'utf8');
		assert.ok(commonWorkbench.includes('./contrib/notebook/browser/notebook.contribution.js'), 'ordinary notebook contribution remains registered');
		assert.ok(!commonWorkbench.includes('agentHost'), 'Agent Host wiring is not retained in the workbench entrypoint');
	});

	test('code-OSS fallback and web startup omit Chat-owned product wiring', () => {
		const platformProduct = readFileSync(resolve(import.meta.dirname, '../../../src/vs/platform/product/common/product.ts'), 'utf8');
		assert.ok(!platformProduct.includes('defaultChatAgent:'), 'code-OSS fallback wires the default Chat agent');
		assert.ok(platformProduct.includes("nameShort: 'Code - OSS Dev'"), 'generic Code-OSS fallback identity remains');
		assert.ok(platformProduct.includes("applicationName: 'code-oss'"), 'generic Code-OSS application name remains');

		const workbenchWeb = readFileSync(resolve(import.meta.dirname, '../../../src/vs/workbench/workbench.web.main.ts'), 'utf8');
		assert.ok(!workbenchWeb.includes('BrowserAgentHostDebugLogsExportService'), 'browser entrypoint imports the Chat-owned Agent Host debug exporter');
		assert.ok(!workbenchWeb.includes('IAgentHostDebugLogsExportService'), 'browser entrypoint registers the Chat-owned Agent Host debug service');
		assert.ok(!workbenchWeb.includes('AgentHost'), 'browser entrypoint retains Agent Host wiring');
		assert.ok(!workbenchWeb.includes('agentHost'), 'browser entrypoint retains lower-case agent host wiring');
	});

	test('desktop startup does not construct or route to Chat/Agent Host windows', () => {
		const desktopStartup = readFileSync(resolve(import.meta.dirname, '../../../src/vs/code/electron-main/app.ts'), 'utf8');
		for (const removedRoute of ['ElectronAgentHostStarter', 'AgentHostProcessManager', 'parseExternalOpenSessionLinkUri', 'openAgentsWindow', "args['agents']"]) {
			assert.ok(!desktopStartup.includes(removedRoute), `desktop startup retains ${removedRoute}`);
		}
		assert.ok(desktopStartup.includes('windowsMainService.open({'), 'ordinary workbench windows remain openable');
		assert.ok(desktopStartup.includes('initialProtocolUrls.openables'), 'ordinary workspace/file protocol opening remains');
	});

	test('desktop CLI and history do not restore the Agents Window', () => {
		const launchService = readFileSync(resolve(import.meta.dirname, '../../../src/vs/platform/launch/electron-main/launchMainService.ts'), 'utf8');
		assert.ok(!launchService.includes("args['agents']"), 'CLI launch still selects the Agents Window');
		assert.ok(!launchService.includes('openAgentsWindow'), 'CLI launch still calls the Agents Window API');
		assert.ok(launchService.includes('this.windowsMainService.open({'), 'ordinary CLI workspaces still open');

		const workspacesHistory = readFileSync(resolve(import.meta.dirname, '../../../src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts'), 'utf8');
		assert.ok(!workspacesHistory.includes("localize('agentsWindowRecentWorkspace'"), 'legacy Agent sessions workspaces are still exposed as a recent Agents Window');
		assert.ok(!workspacesHistory.includes("title: localize('agentsWindow'"), 'Windows Jump List still offers an Agents Window task');
		assert.ok(workspacesHistory.includes('this.isAgentSessionsWorkspace(recent.workspace)'), 'legacy Agent sessions recents are not filtered');
		assert.ok(workspacesHistory.includes("localize('newWindow'"), 'ordinary Windows Jump List task was removed');
	});

	test('Agents Window native and main-window routes cannot open a session window', () => {
		const nativeHostMainService = readFileSync(resolve(import.meta.dirname, '../../../src/vs/platform/native/electron-main/nativeHostMainService.ts'), 'utf8');
		assert.ok(!nativeHostMainService.includes('this.windowsMainService.openAgentsWindow'), 'native host still routes to the Agents Window');
		assert.ok(nativeHostMainService.includes("error.name = 'AgentsWindowUnsupported'"), 'legacy native-host calls do not fail deterministically');

		const windowsApi = readFileSync(resolve(import.meta.dirname, '../../../src/vs/platform/windows/electron-main/windows.ts'), 'utf8');
		assert.ok(!windowsApi.includes('openAgentsWindow('), 'main window service still exposes an Agents Window API');
		const windowsMainService = readFileSync(resolve(import.meta.dirname, '../../../src/vs/platform/windows/electron-main/windowsMainService.ts'), 'utf8');
		assert.ok(!windowsMainService.includes('openAgentsWindow('), 'main window service still implements Agents Window opening');
		assert.ok(windowsMainService.includes('async open(openConfig: IOpenConfiguration)'), 'ordinary workbench window opening remains');

		assert.ok(!existsSync(resolve(import.meta.dirname, '../../../src/vs/sessions/sessions.desktop.main.ts')), 'the Sessions desktop entrypoint survived the Sessions tree removal');
	});

	test('Walker product has no default Chat agent or Agents Window extension allowlist', () => {
		const walkerProduct = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../product.json'), 'utf8'));
		assert.equal(walkerProduct.defaultChatAgent, undefined, 'Walker product still configures a default Chat agent');
		assert.equal(walkerProduct.sessionsWindowAllowedExtensions, undefined, 'Walker product still carries an Agents Window extension allowlist');
		assert.deepStrictEqual(walkerProduct.builtInExtensionsEnabledWithAutoUpdates, [], 'Copilot Chat remains in the product auto-update list');

		const productReaders = [
			'src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts',
			'src/vs/platform/extensionManagement/common/extensionGalleryService.ts',
			'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts',
		];
		for (const productReader of productReaders) {
			const source = readFileSync(resolve(import.meta.dirname, '../../../', productReader), 'utf8');
			assert.ok(!source.includes('defaultChatAgent'), `${productReader} retains Walker Chat product wiring`);
		}

		const workbenchConfiguration = readFileSync(resolve(import.meta.dirname, '../../../src/vs/workbench/browser/workbench.contribution.ts'), 'utf8');
		assert.ok(!workbenchConfiguration.includes('agentsWindow:'), 'workbench settings retain Agents Window-only defaults');
		assert.ok(!workbenchConfiguration.includes('workbench.commandPalette.experimental.askChatLocation'), 'command palette retains the Chat location setting');
		assert.ok(!workbenchConfiguration.includes('workbench.commandPalette.showAskInChat'), 'command palette retains the Ask in Chat setting');
	});

	test('extension-host Chat API no longer exposes a live participant bridge', () => {
		const apiImplementation = readFileSync(resolve(import.meta.dirname, '../../../src/vs/workbench/api/common/extHost.api.impl.ts'), 'utf8');
		const chatApiStart = apiImplementation.indexOf('const chat = createChatApiFacade();');
		assert.notEqual(chatApiStart, -1, 'Chat API facade is not connected to the public namespace');
		const languageModelApiStart = apiImplementation.indexOf('// namespace: lm', chatApiStart);
		assert.notEqual(languageModelApiStart, -1, 'language model API boundary could not be located');
		const chatApiImplementation = apiImplementation.slice(chatApiStart, languageModelApiStart);
		assert.doesNotMatch(chatApiImplementation, /extHostChatAgents2\.createChatAgent/, 'Chat participant registration still reaches the Chat bridge');
	});

	test('extension-host language model APIs no longer reach live providers', () => {
		const apiImplementation = readFileSync(resolve(import.meta.dirname, '../../../src/vs/workbench/api/common/extHost.api.impl.ts'), 'utf8');
		const languageModelApiStart = apiImplementation.indexOf('const lm = createLanguageModelApiFacade();');
		assert.notEqual(languageModelApiStart, -1, 'language model API facade is not connected to the public namespace');
		const speechApiStart = apiImplementation.indexOf('// namespace: speech', languageModelApiStart);
		assert.notEqual(speechApiStart, -1, 'language model API boundary could not be located');
		const languageModelApiImplementation = apiImplementation.slice(languageModelApiStart, speechApiStart);
		assert.doesNotMatch(languageModelApiImplementation, /extHostLanguageModels\.selectLanguageModels/, 'language model discovery still reaches the live provider service');
	});

	test('extension-host chat-session and agent-comment APIs cannot reach live bridges', () => {
		const apiImplementation = readFileSync(resolve(import.meta.dirname, '../../../src/vs/workbench/api/common/extHost.api.impl.ts'), 'utf8');
		assert.ok(apiImplementation.includes('const interactive: typeof vscode.interactive = createInteractiveApiFacade();'), 'interactive session API still delegates to the Chat bridge');
		assert.ok(apiImplementation.includes('const chatWindowApi = createChatWindowApiFacade();'), 'window chat and agent APIs still delegate to their bridges');
		assert.doesNotMatch(apiImplementation, /extHostChatAgents2\.transferActiveChat|extHostChatStatus\.createChatStatusItem|extHostAgentEditorComments\.createAgentEditorComments/, 'chat/session/agent API still invokes a live extension-host bridge');

		const extensionHostContribution = readFileSync(resolve(import.meta.dirname, '../../../src/vs/workbench/api/browser/extensionHost.contribution.ts'), 'utf8');
		assert.ok(!extensionHostContribution.includes('mainThreadAgentEditorComments.js'), 'Agent Editor Comments main-thread customer remains registered');

	});

	test('Walker product removes Chat auth, voice, and Copilot auto-update grants', () => {
		const walkerProduct = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../product.json'), 'utf8'));
		assert.equal(walkerProduct.trustedExtensionAuthAccess, undefined, 'Copilot Chat retains a product-level authentication grant');
		assert.deepStrictEqual(walkerProduct.builtInExtensionsEnabledWithAutoUpdates, [], 'Copilot Chat remains in the product auto-update list');
		assert.equal(walkerProduct.voiceWsUrl, undefined, 'the Walker product still configures the Chat voice endpoint');
		assert.equal(walkerProduct.agentsTelemetryAppName, 'agents', 'U07 Agent Host product identity remains protected');

		const webClientServer = readFileSync(resolve(import.meta.dirname, '../../../src/vs/server/node/webClientServer.ts'), 'utf8');
		assert.ok(!webClientServer.includes('voiceWsUrl: this._productService.voiceWsUrl'), 'server web product still exports the Chat voice endpoint');
		assert.ok(webClientServer.includes("embedderIdentifier: 'server-distro'"), 'generic server product composition remains');
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
