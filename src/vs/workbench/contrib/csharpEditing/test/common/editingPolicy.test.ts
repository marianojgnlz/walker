/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { evaluateCSharpEditingPolicy, ICSharpEditingPolicyInput } from '../../common/editingPolicy.js';

function validInput(): ICSharpEditingPolicyInput {
	return {
		host: {
			uiKind: 'desktop',
			extensionHostKind: 'ui',
			workspaceTrusted: true,
			virtualWorkspace: false,
			workspaceFolderSchemes: ['file'],
		},
		platform: 'linux-x64',
		packages: {
			client: { id: 'muhammad-sammy.csharp', version: '2.145.21-g154a82fd27', enabled: true },
			runtime: { id: 'ms-dotnettools.vscode-dotnet-runtime', version: '3.2.0', enabled: true },
		},
		settings: {
			'dotnet.server.useOmnisharp': { value: false, scope: 'default' },
			'chat.disableAIFeatures': { value: true, scope: 'default' },
			'dotnet.projects.enableAutomaticRestore': { value: false, scope: 'default' },
			'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources': { value: false, scope: 'default' },
			'dotnetAcquisitionExtension.enableTelemetry': { value: false, scope: 'default' },
		},
		server: {
			configuredPath: { value: undefined, scope: 'default' },
			auditedPath: '/extensions/csharp/.roslyn/Microsoft.CodeAnalysis.LanguageServer.dll',
			crashDumpPath: { value: undefined, scope: 'default' },
			environmentVariables: {
				value: {
					DOTNET_CLI_TELEMETRY_OPTOUT: '1',
					DOTNET_NOLOGO: '1',
					DOTNET_ROOT: '/dotnet',
					DOTNET_MULTILEVEL_LOOKUP: '0',
				},
				scope: 'default',
			},
			verifiedDotnetRoot: '/dotnet',
		},
		inheritedEnvironmentVariableNames: [],
	};
}

suite('C# editing effective policy', () => {
	test('accepts only an audited local Linux profile without issuing an activation permit', () => {
		const result = evaluateCSharpEditingPolicy(validInput());

		assert.deepStrictEqual(result, { eligible: true, reasons: [] });
	});

	test('honors safe user, workspace and folder overrides but reports unsafe effective values with scope', () => {
		let input = validInput();
		input = {
			...input,
			settings: {
				...input.settings,
				'dotnet.server.useOmnisharp': { value: false, scope: 'user' },
				'chat.disableAIFeatures': { value: true, scope: 'workspace' },
				'dotnet.projects.enableAutomaticRestore': { value: true, scope: 'workspaceFolder' },
			},
		};

		assert.deepStrictEqual(evaluateCSharpEditingPolicy(input).reasons, [
			{ code: 'setting-conflict', key: 'dotnet.projects.enableAutomaticRestore', scope: 'workspaceFolder' },
		]);

		input = { ...input, settings: { ...input.settings, 'dotnet.projects.enableAutomaticRestore': { value: false, scope: 'workspaceFolder' } } };
		assert.deepStrictEqual(evaluateCSharpEditingPolicy(input), { eligible: true, reasons: [] });
	});

	test('denies untrusted, virtual, remote, non-file, web and missing-folder workspaces', () => {
		let input = validInput();
		input = {
			...input,
			host: {
				...input.host,
				uiKind: 'web',
				extensionHostKind: 'workspace',
				workspaceTrusted: false,
				virtualWorkspace: true,
				remoteAuthority: 'ssh-remote+host',
				workspaceFolderSchemes: ['vscode-remote'],
			},
		};

		assert.deepStrictEqual(evaluateCSharpEditingPolicy(input).reasons.map(reason => reason.code), [
			'host-web', 'host-non-ui', 'host-remote', 'workspace-untrusted', 'workspace-virtual', 'workspace-non-file',
		]);

		input = { ...validInput(), host: { ...validInput().host, workspaceFolderSchemes: [] } };
		assert.deepStrictEqual(evaluateCSharpEditingPolicy(input).reasons.map(reason => reason.code), ['workspace-missing']);
	});

	test('denies missing, disabled, unvalidated and unsupported platform packages', () => {
		let input = validInput();
		input = { ...input, packages: { client: undefined, runtime: undefined } };
		assert.deepStrictEqual(evaluateCSharpEditingPolicy(input).reasons.map(reason => reason.code), [
			'client-missing', 'runtime-missing',
		]);

		input = {
			...input,
			packages: {
				client: { id: 'muhammad-sammy.csharp', version: '2.145.21-g154a82fd27', enabled: false },
				runtime: { id: 'ms-dotnettools.vscode-dotnet-runtime', version: '3.2.0', enabled: true },
			},
			platform: 'win32-x64',
		};
		assert.deepStrictEqual(evaluateCSharpEditingPolicy(input).reasons.map(reason => reason.code), [
			'client-disabled', 'platform-unvalidated',
		]);

		input = {
			...input,
			packages: {
				client: { id: 'muhammad-sammy.csharp', version: 'newer', enabled: true },
				runtime: { id: 'wrong.runtime', version: '4.0.0', enabled: true },
			},
		};
		assert.deepStrictEqual(evaluateCSharpEditingPolicy(input).reasons.map(reason => reason.code), [
			'client-version-unvalidated', 'runtime-id-unvalidated', 'runtime-version-unvalidated', 'platform-unvalidated',
		]);
	});

	test('denies hostile inherited hooks, unexpected server/environment overrides and crash reporting', () => {
		const base = validInput();
		const input: ICSharpEditingPolicyInput = {
			...base,
			inheritedEnvironmentVariableNames: ['DOTNET_ROSLYN_SERVER_PATH', 'CORECLR_ENABLE_PROFILING'],
			server: {
				...base.server,
				configuredPath: { value: '/workspace/server.dll', scope: 'workspace' },
				crashDumpPath: { value: '/tmp/dump', scope: 'user' },
				environmentVariables: {
					value: { DOTNET_ROOT: '/other-dotnet', DOTNET_STARTUP_HOOKS: '/tmp/hook.dll' },
					scope: 'workspaceFolder',
				},
			},
		};

		assert.deepStrictEqual(evaluateCSharpEditingPolicy(input).reasons, [
			{ code: 'server-path-conflict', scope: 'workspace' },
			{ code: 'crash-reporting-enabled', scope: 'user' },
			{ code: 'server-environment-conflict', scope: 'workspaceFolder' },
			{ code: 'unsafe-environment', key: 'CORECLR_ENABLE_PROFILING' },
			{ code: 'unsafe-environment', key: 'DOTNET_ROSLYN_SERVER_PATH' },
		]);
	});
});
