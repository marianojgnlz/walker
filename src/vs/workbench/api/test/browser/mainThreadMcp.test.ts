/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { observableValue } from '../../../../base/common/observable.js';
import { URI } from '../../../../base/common/uri.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { StorageScope } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchMcpGatewayService } from '../../../contrib/mcp/common/mcpGatewayService.js';
import { IMcpHostDelegate, IMcpRegistry } from '../../../contrib/mcp/common/mcpRegistryTypes.js';
import { McpCollectionDefinition, McpCollectionSortOrder, McpServerDefinition, McpServerLaunch, McpServerTransportType, McpServerTrust } from '../../../contrib/mcp/common/mcpTypes.js';
import { TestExtensionService } from '../../../test/common/workbenchTestServices.js';
import { MainThreadMcp } from '../../browser/mainThreadMcp.js';
import { ExtHostMcpShape } from '../../common/extHost.protocol.js';
import { SingleProxyRPCProtocol } from '../common/testRPCProtocol.js';

suite('MainThreadMcp - launch', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('forwards the definition default cwd to the extension host', () => {
		let startOptions: Parameters<ExtHostMcpShape['$startMcp']>[1] | undefined;
		const proxy: Partial<ExtHostMcpShape> = {
			$startMcp(_id, options) {
				startOptions = options;
			},
			$stopMcp() { },
			$sendMessage() { },
			$onDidChangeMcpServerDefinitions() { },
		};

		let capturedDelegate: IMcpHostDelegate | undefined;
		const mcpRegistry = new class extends mock<IMcpRegistry>() {
			override readonly collections = observableValue<readonly McpCollectionDefinition[]>('collections', []);
			override registerDelegate(delegate: IMcpHostDelegate) {
				capturedDelegate = delegate;
				return { dispose() { } };
			}
		};

		disposables.add(new MainThreadMcp(
			SingleProxyRPCProtocol(proxy),
			mcpRegistry,
			new TestExtensionService(),
			new class extends mock<IContextKeyService>() { },
			new class extends mock<IWorkbenchMcpGatewayService>() { },
		));

		const launch: McpServerLaunch = {
			type: McpServerTransportType.HTTP,
			uri: URI.parse('https://myserver.example/mcp'),
			headers: [],
		};
		const defaultCwd = URI.parse('vscode-remote://ssh-remote+linux/home/test/workspace');
		const serverDefinition: McpServerDefinition = {
			id: 'my-server',
			label: 'My Server',
			launch,
			defaultCwd,
			cacheNonce: 'nonce-1',
			variableReplacement: {
				folder: { uri: URI.file('/fallback'), name: 'fallback', index: 0 },
				target: ConfigurationTarget.WORKSPACE_FOLDER,
			},
		};
		const collection: McpCollectionDefinition = {
			remoteAuthority: 'ssh-remote+linux',
			id: 'collection-1',
			label: 'Collection',
			serverDefinitions: observableValue<readonly McpServerDefinition[]>('serverDefinitions', [serverDefinition]),
			trustBehavior: McpServerTrust.Kind.Trusted,
			scope: StorageScope.WORKSPACE,
			configTarget: ConfigurationTarget.WORKSPACE_FOLDER,
			order: McpCollectionSortOrder.WorkspaceFolder,
		};

		assert.ok(capturedDelegate);
		capturedDelegate.start(collection, serverDefinition, launch, {});
		assert.ok(startOptions?.defaultCwd);
		assert.strictEqual(URI.revive(startOptions.defaultCwd).toString(), defaultCwd.toString());
	});
});
