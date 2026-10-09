/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CSharpRuntimeMappingGuard, ICSharpRuntimeMappingInput, ICSharpRuntimeMappingResult } from './runtimeMapping.js';
import { CSHARP_EDITING_RUNTIME_ID, CSHARP_EDITING_RUNTIME_VERSION, evaluateCSharpEditingPolicy, hasUnsafeCSharpEditingEnvironment, ICSharpEditingPolicyInput, ICSharpEditingPolicyResult } from './editingPolicy.js';

export interface ICSharpRuntimeDependencyAdmissionInput {
	readonly runtimeDependency?: { readonly id: string; readonly version: string; readonly enabled: boolean };
	readonly hostKind: 'local' | 'remote' | 'web';
	readonly platform: string;
	readonly architecture: string | undefined;
	readonly telemetrySetting: { readonly registered: boolean; readonly profileValue: unknown; readonly effectiveValues: readonly unknown[] };
	readonly runtimeMapping: Pick<ICSharpRuntimeMappingResult, 'eligible'>;
	readonly inheritedEnvironmentVariableNames: readonly string[];
}

export type CSharpRuntimeDependencyAdmissionEvaluation =
	| { readonly eligible: true }
	| { readonly eligible: false; readonly reason: 'runtime-dependency-unvalidated' | 'unsupported-host' | 'telemetry-unavailable' | 'telemetry-enabled' | 'runtime-mapping-unavailable' | 'unsafe-environment' };

/** Checks the dependency's own telemetry and preverified mapping without granting the C# client's full profile permit. */
export function evaluateCSharpRuntimeDependencyAdmission(input: ICSharpRuntimeDependencyAdmissionInput): CSharpRuntimeDependencyAdmissionEvaluation {
	const deny = (reason: Exclude<CSharpRuntimeDependencyAdmissionEvaluation, { readonly eligible: true }>['reason']): CSharpRuntimeDependencyAdmissionEvaluation => ({ eligible: false, reason });
	const dependency = input.runtimeDependency;
	if (!dependency || dependency.id !== CSHARP_EDITING_RUNTIME_ID || dependency.version !== CSHARP_EDITING_RUNTIME_VERSION || !dependency.enabled) {
		return deny('runtime-dependency-unvalidated');
	}
	if (input.hostKind !== 'local' || input.platform !== 'linux' || input.architecture !== 'x64') {
		return deny('unsupported-host');
	}
	if (!input.telemetrySetting.registered) {
		return deny('telemetry-unavailable');
	}
	if (input.telemetrySetting.profileValue !== false || input.telemetrySetting.effectiveValues.some(value => value !== false)) {
		return deny('telemetry-enabled');
	}
	if (hasUnsafeCSharpEditingEnvironment(input.inheritedEnvironmentVariableNames)) {
		return deny('unsafe-environment');
	}
	if (!input.runtimeMapping.eligible) {
		return deny('runtime-mapping-unavailable');
	}
	return { eligible: true };
}

export type CSharpEditingAdmissionEvaluation =
	| { readonly eligible: true; readonly policy: ICSharpEditingPolicyResult; readonly mapping: ICSharpRuntimeMappingResult }
	| { readonly eligible: false; readonly reason: 'configuration-conflict'; readonly policy: ICSharpEditingPolicyResult }
	| { readonly eligible: false; readonly reason: 'runtime-mapping-conflict'; readonly policy: ICSharpEditingPolicyResult; readonly mapping: ICSharpRuntimeMappingResult };

/** Triangulates effective safety configuration with the independently verified requester mapping. */
export function evaluateCSharpEditingAdmission(input: {
	readonly policy: ICSharpEditingPolicyInput;
	readonly runtimeMapping: ICSharpRuntimeMappingInput;
}): CSharpEditingAdmissionEvaluation {
	const policy = evaluateCSharpEditingPolicy(input.policy);
	if (!policy.eligible) {
		return { eligible: false, reason: 'configuration-conflict', policy };
	}
	const mapping = CSharpRuntimeMappingGuard(input.runtimeMapping);
	if (!mapping.eligible) {
		return { eligible: false, reason: 'runtime-mapping-conflict', policy, mapping };
	}
	return { eligible: true, policy, mapping };
}
