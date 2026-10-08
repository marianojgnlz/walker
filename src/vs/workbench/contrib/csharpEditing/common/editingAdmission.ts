/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CSharpRuntimeMappingGuard, ICSharpRuntimeMappingInput, ICSharpRuntimeMappingResult } from './runtimeMapping.js';
import { evaluateCSharpEditingPolicy, ICSharpEditingPolicyInput, ICSharpEditingPolicyResult } from './editingPolicy.js';

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
