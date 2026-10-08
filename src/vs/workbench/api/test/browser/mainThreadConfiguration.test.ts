/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { Emitter } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions, IConfigurationRegistry, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { TestInstantiationService } from '../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { MainThreadConfiguration } from '../../browser/mainThreadConfiguration.js';
import { SingleProxyRPCProtocol } from '../common/testRPCProtocol.js';
import { IConfigurationChangeEvent, IConfigurationService, ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { WorkspaceService } from '../../../services/configuration/browser/configurationService.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IExtensionsStatus, IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

suite('MainThreadConfiguration', function () {

	ensureNoDisposablesAreLeakedInTestSuite();

	const proxy = {
		$initializeConfiguration: () => { }
	};
	let instantiationService: TestInstantiationService;
	let target: sinon.SinonSpy;
	let configurationChanges: Emitter<IConfigurationChangeEvent>;

	suiteSetup(() => {
		Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
			'id': 'extHostConfiguration',
			'title': 'a',
			'type': 'object',
			'properties': {
				'extHostConfiguration.resource': {
					'description': 'extHostConfiguration.resource',
					'type': 'boolean',
					'default': true,
					'scope': ConfigurationScope.RESOURCE
				},
				'extHostConfiguration.window': {
					'description': 'extHostConfiguration.resource',
					'type': 'boolean',
					'default': true,
					'scope': ConfigurationScope.WINDOW
				}
			}
		});
	});

	setup(() => {
		target = sinon.spy();
		configurationChanges = new Emitter<IConfigurationChangeEvent>();

		instantiationService = new TestInstantiationService();
		instantiationService.stub(IConfigurationService, WorkspaceService);
		instantiationService.stub(IConfigurationService, 'onDidUpdateConfiguration', sinon.mock());
		instantiationService.stub(IConfigurationService, 'onDidChangeConfiguration', configurationChanges.event);
		instantiationService.stub(IConfigurationService, 'updateValue', target);
		instantiationService.stub(IEnvironmentService, {
			isBuilt: false
		});
		instantiationService.stub(IExtensionService, {
			getExtensionsStatus: () => Object.create(null),
			stopExtensionHosts: async () => true,
			onWillStop: () => ({ dispose() { } }),
			onDidChangeExtensions: () => ({ dispose() { } }),
		});
		instantiationService.stub(INotificationService, { notify: () => null! });
		instantiationService.stub(IHostService, { reload: async () => undefined });
	});

	teardown(() => {
		configurationChanges.dispose();
		instantiationService.dispose();
	});

	test('update resource configuration without configuration target defaults to workspace in multi root workspace when no resource is provided', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.WORKSPACE });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(null, 'extHostConfiguration.resource', 'value', undefined, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('update resource configuration without configuration target defaults to workspace in folder workspace when resource is provider', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(null, 'extHostConfiguration.resource', 'value', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('update resource configuration without configuration target defaults to workspace in folder workspace when no resource is provider', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(null, 'extHostConfiguration.resource', 'value', undefined, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('update window configuration without configuration target defaults to workspace in multi root workspace when no resource is provided', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.WORKSPACE });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(null, 'extHostConfiguration.window', 'value', undefined, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('update window configuration without configuration target defaults to workspace in multi root workspace when resource is provided', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.WORKSPACE });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(null, 'extHostConfiguration.window', 'value', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('update window configuration without configuration target defaults to workspace in folder workspace when resource is provider', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(null, 'extHostConfiguration.window', 'value', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('update window configuration without configuration target defaults to workspace in folder workspace when no resource is provider', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(null, 'extHostConfiguration.window', 'value', undefined, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('update resource configuration without configuration target defaults to folder', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.WORKSPACE });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(null, 'extHostConfiguration.resource', 'value', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE_FOLDER, target.args[0][3]);
	});

	test('update configuration with user configuration target', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(ConfigurationTarget.USER, 'extHostConfiguration.window', 'value', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.USER, target.args[0][3]);
	});

	test('update configuration with workspace configuration target', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(ConfigurationTarget.WORKSPACE, 'extHostConfiguration.window', 'value', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('update configuration with folder configuration target', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$updateConfigurationOption(ConfigurationTarget.WORKSPACE_FOLDER, 'extHostConfiguration.window', 'value', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE_FOLDER, target.args[0][3]);
	});

	test('remove resource configuration without configuration target defaults to workspace in multi root workspace when no resource is provided', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.WORKSPACE });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$removeConfigurationOption(null, 'extHostConfiguration.resource', undefined, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('remove resource configuration without configuration target defaults to workspace in folder workspace when resource is provider', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$removeConfigurationOption(null, 'extHostConfiguration.resource', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('remove resource configuration without configuration target defaults to workspace in folder workspace when no resource is provider', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$removeConfigurationOption(null, 'extHostConfiguration.resource', undefined, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('remove window configuration without configuration target defaults to workspace in multi root workspace when no resource is provided', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.WORKSPACE });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$removeConfigurationOption(null, 'extHostConfiguration.window', undefined, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('remove window configuration without configuration target defaults to workspace in multi root workspace when resource is provided', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.WORKSPACE });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$removeConfigurationOption(null, 'extHostConfiguration.window', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('remove window configuration without configuration target defaults to workspace in folder workspace when resource is provider', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$removeConfigurationOption(null, 'extHostConfiguration.window', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('remove window configuration without configuration target defaults to workspace in folder workspace when no resource is provider', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.FOLDER });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$removeConfigurationOption(null, 'extHostConfiguration.window', undefined, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE, target.args[0][3]);
	});

	test('remove configuration without configuration target defaults to folder', function () {
		instantiationService.stub(IWorkspaceContextService, <IWorkspaceContextService>{ getWorkbenchState: () => WorkbenchState.WORKSPACE });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol(proxy));

		testObject.$removeConfigurationOption(null, 'extHostConfiguration.resource', { resource: URI.file('abc') }, undefined);

		assert.strictEqual(ConfigurationTarget.WORKSPACE_FOLDER, target.args[0][3]);
	});

	test('stops an active C# host before configuration forwarding and withholds every later snapshot on failure', async () => {
		let active = true;
		const events: string[] = [];
		instantiationService.stub(IExtensionService, {
			getExtensionsStatus: () => ({ 'muhammad-sammy.csharp': { id: new ExtensionIdentifier('muhammad-sammy.csharp'), activationStarted: active } as IExtensionsStatus }),
			stopExtensionHosts: async () => { events.push('stop'); return false; },
		});
		instantiationService.stub(INotificationService, { notify: () => { events.push('notice'); return null!; } });
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol({
			...proxy,
			$acceptConfigurationChanged: () => events.push('forward'),
		}));
		const event = (keys: string[]): IConfigurationChangeEvent => ({
			source: ConfigurationTarget.USER,
			affectedKeys: new Set(keys),
			change: { keys, overrides: [] },
			affectsConfiguration: () => true,
		});

		configurationChanges.fire(event(['dotnet.server.useOmnisharp']));
		configurationChanges.fire(event(['editor.fontSize']));
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.deepStrictEqual(events, ['stop', 'notice']);
		testObject.dispose();
	});

	test('forwards unrelated configuration changes without restarting extension hosts', async () => {
		const events: string[] = [];
		instantiationService.stub(IExtensionService, {
			getExtensionsStatus: () => Object.create(null),
			stopExtensionHosts: async () => { events.push('stop'); return true; },
		});
		const testObject: MainThreadConfiguration = instantiationService.createInstance(MainThreadConfiguration, SingleProxyRPCProtocol({
			...proxy,
			$acceptConfigurationChanged: () => events.push('forward'),
		}));
		configurationChanges.fire({
			source: ConfigurationTarget.USER,
			affectedKeys: new Set(['editor.fontSize']),
			change: { keys: ['editor.fontSize'], overrides: [] },
			affectsConfiguration: () => true,
		});
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.deepStrictEqual(events, ['forward']);
		testObject.dispose();
	});
});
