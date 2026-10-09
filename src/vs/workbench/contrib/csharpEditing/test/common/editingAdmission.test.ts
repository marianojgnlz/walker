/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { CSHARP_EDITING_PROFILE_SETTINGS, CSHARP_EDITING_CLIENT_ID, CSHARP_EDITING_CLIENT_VERSION, CSHARP_EDITING_RUNTIME_ID, CSHARP_EDITING_RUNTIME_VERSION } from '../../common/editingPolicy.js';
import { evaluateCSharpEditingAdmission, evaluateCSharpRuntimeDependencyAdmission, ICSharpRuntimeDependencyAdmissionInput } from '../../common/editingAdmission.js';
import { ICSharpEditingPolicyInput } from '../../common/editingPolicy.js';
import { ICSharpRuntimeMappingInput } from '../../common/runtimeMapping.js';

function validAdmissionInput(): { policy: ICSharpEditingPolicyInput; runtimeMapping: ICSharpRuntimeMappingInput } {
	const executable = '/opt/dotnet/dotnet';
	const root = '/opt/dotnet';
	return {
		policy: {
			host: {
				uiKind: 'desktop',
				extensionHostKind: 'ui',
				workspaceTrusted: true,
				virtualWorkspace: false,
				workspaceFolderSchemes: ['file'],
			},
			platform: 'linux-x64',
			packages: {
				client: { id: CSHARP_EDITING_CLIENT_ID, version: CSHARP_EDITING_CLIENT_VERSION, enabled: true },
				runtime: { id: CSHARP_EDITING_RUNTIME_ID, version: CSHARP_EDITING_RUNTIME_VERSION, enabled: true },
			},
			settings: Object.fromEntries(Object.entries(CSHARP_EDITING_PROFILE_SETTINGS).map(([key, value]) => [key, { value, scope: 'user' }])) as ICSharpEditingPolicyInput['settings'],
			server: {
				configuredPath: { value: undefined, scope: 'default' },
				auditedPath: '/extensions/csharp/.roslyn/Microsoft.CodeAnalysis.LanguageServer.dll',
				crashDumpPath: { value: '', scope: 'user' },
				environmentVariables: {
					value: { DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_ROOT: root, DOTNET_MULTILEVEL_LOOKUP: '0' },
					scope: 'user',
				},
				verifiedDotnetRoot: root,
			},
			inheritedEnvironmentVariableNames: [],
		},
		runtimeMapping: {
			client: { id: CSHARP_EDITING_CLIENT_ID, version: CSHARP_EDITING_CLIENT_VERSION, targetPlatform: 'linux-x64' },
			runtimeDependency: { id: CSHARP_EDITING_RUNTIME_ID, version: CSHARP_EDITING_RUNTIME_VERSION },
			platform: 'linux',
			architecture: 'x64',
			host: {
				schemaVersion: 1,
				kind: 'ready',
				locality: 'local',
				profile: 'roslyn-standalone-10',
				executable,
				root,
				sdkVersion: '10.0.401',
				runtimeVersion: '10.0.12',
			},
			existingDotnetPath: [{ extensionId: CSHARP_EDITING_CLIENT_ID, path: executable }],
			allowInvalidPaths: false,
		},
	};
}

function validRuntimeDependencyAdmissionInput(overrides: Partial<ICSharpRuntimeDependencyAdmissionInput> = {}): ICSharpRuntimeDependencyAdmissionInput {
	return {
		runtimeDependency: { id: CSHARP_EDITING_RUNTIME_ID, version: CSHARP_EDITING_RUNTIME_VERSION, enabled: true },
		hostKind: 'local',
		platform: 'linux',
		architecture: 'x64',
		telemetrySetting: { registered: true, profileValue: false, effectiveValues: [false] },
		runtimeMapping: { eligible: true },
		inheritedEnvironmentVariableNames: [],
		...overrides,
	};
}

type RuntimeDependencyDenialReason = Extract<ReturnType<typeof evaluateCSharpRuntimeDependencyAdmission>, { readonly eligible: false }>['reason'];

function assertRuntimeDependencyDenied(input: ICSharpRuntimeDependencyAdmissionInput, reason: RuntimeDependencyDenialReason): void {
	const result = evaluateCSharpRuntimeDependencyAdmission(input);
	assert.strictEqual(result.eligible, false);
	if (!result.eligible) {
		assert.strictEqual(result.reason, reason);
	}
}

suite('C# editing integrated admission', () => {
	test('requires the persisted runtime mapping before dependency admission while C# remains independently gated', () => {
		assert.deepStrictEqual(evaluateCSharpRuntimeDependencyAdmission(validRuntimeDependencyAdmissionInput()), { eligible: true });
		assertRuntimeDependencyDenied(validRuntimeDependencyAdmissionInput({ runtimeMapping: { eligible: false } }), 'runtime-mapping-unavailable');

		const input = validAdmissionInput();
		assert.strictEqual(evaluateCSharpEditingAdmission({
			...input,
			runtimeMapping: { ...input.runtimeMapping, existingDotnetPath: [] },
		}).eligible, false);
		assert.strictEqual(evaluateCSharpEditingAdmission({
			...input,
			policy: { ...input.policy, host: { ...input.policy.host, workspaceTrusted: false } },
		}).eligible, false);
	});

	test('denies the runtime dependency unless its exact identity, own telemetry setting, and environment pass', () => {
		assertRuntimeDependencyDenied(validRuntimeDependencyAdmissionInput({
			runtimeDependency: { id: CSHARP_EDITING_RUNTIME_ID, version: '3.2.1', enabled: true },
		}), 'runtime-dependency-unvalidated');
		assertRuntimeDependencyDenied(validRuntimeDependencyAdmissionInput({
			telemetrySetting: { registered: false, profileValue: false, effectiveValues: [false] },
		}), 'telemetry-unavailable');
		assertRuntimeDependencyDenied(validRuntimeDependencyAdmissionInput({
			telemetrySetting: { registered: true, profileValue: true, effectiveValues: [true] },
		}), 'telemetry-enabled');
		assertRuntimeDependencyDenied(validRuntimeDependencyAdmissionInput({ runtimeMapping: { eligible: false } }), 'runtime-mapping-unavailable');
		assertRuntimeDependencyDenied(validRuntimeDependencyAdmissionInput({
			inheritedEnvironmentVariableNames: ['DOTNET_STARTUP_HOOKS'],
		}), 'unsafe-environment');
	});

	test('grants eligibility only when effective policy and the requester mapping both match the audited profile', () => {
		const input = validAdmissionInput();
		assert.strictEqual(evaluateCSharpEditingAdmission(input).eligible, true);

		const settingConflict = {
			...input,
			policy: {
				...input.policy,
				settings: {
					...input.policy.settings,
					'dotnet.projects.enableAutomaticRestore': { value: true, scope: 'workspaceFolder' as const },
				},
			},
		};
		assert.deepStrictEqual(evaluateCSharpEditingAdmission(settingConflict), {
			eligible: false,
			reason: 'configuration-conflict',
			policy: { eligible: false, reasons: [{ code: 'setting-conflict', key: 'dotnet.projects.enableAutomaticRestore', scope: 'workspaceFolder' }] },
		});

		for (const [key, value] of [
			['dotnet.server.useOmnisharp', true],
			['chat.disableAIFeatures', false],
			['dotnet.projects.enableAutomaticRestore', true],
			['dotnet.navigation.navigateToSourceLinkAndEmbeddedSources', true],
			['dotnetAcquisitionExtension.enableTelemetry', true],
		] as const) {
			const overridden = {
				...input,
				policy: { ...input.policy, settings: { ...input.policy.settings, [key]: { value, scope: 'workspaceFolder' as const } } },
			};
			assert.strictEqual(evaluateCSharpEditingAdmission(overridden).eligible, false, `${key} must be checked at its effective scope`);
		}

		const childEnvironmentConflict = {
			...input,
			policy: {
				...input.policy,
				server: {
					...input.policy.server,
					environmentVariables: { value: { DOTNET_ROOT: '/unverified' }, scope: 'user' as const },
				},
			},
		};
		assert.strictEqual(evaluateCSharpEditingAdmission(childEnvironmentConflict).eligible, false);

		const mappingConflict = {
			...input,
			runtimeMapping: { ...input.runtimeMapping, existingDotnetPath: [] },
		};
		const result = evaluateCSharpEditingAdmission(mappingConflict);
		assert.strictEqual(result.eligible, false);
		assert.strictEqual(result.reason, 'runtime-mapping-conflict');
	});

});
