/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	CSHARP_EDITING_CLIENT_ID,
	CSHARP_EDITING_CLIENT_VERSION,
	CSHARP_EDITING_RUNTIME_ID,
	CSHARP_EDITING_RUNTIME_VERSION,
} from './editingPolicy.js';
import type { IDotnetEditingHostResult } from './toolchainContract.js';

/** Audited Linux-only compatibility record; hashes identify the A1 package inputs. */
export const CSHARP_EDITING_COMPATIBILITY_RECORD = Object.freeze({
	client: Object.freeze({
		id: CSHARP_EDITING_CLIENT_ID,
		version: CSHARP_EDITING_CLIENT_VERSION,
		platform: 'linux-x64',
		vsixSha256: '78bc006683cc998e9fd1a6f2760d8cb3da63096464a217bbd192ecfb490a5516',
		manifestSha256: '2873747ff47368feae8014e509825681dec8445c1c99b0255e4c2d26f07291b4',
		roslynVersion: '5.9.0-1.26318.9',
	}),
	runtimeDependency: Object.freeze({
		id: CSHARP_EDITING_RUNTIME_ID,
		version: CSHARP_EDITING_RUNTIME_VERSION,
		vsixSha256: 'a4cff5409f66e3827ee2c6a727ae59382290a182a653ca0f9ac97c63536ee541',
	}),
	runtime: Object.freeze({ profile: 'roslyn-standalone-10', minimumStableVersion: '10.0.5' }),
	requesterMapping: Object.freeze({
		setting: 'dotnetAcquisitionExtension.existingDotnetPath',
		requester: CSHARP_EDITING_CLIENT_ID,
		entryShape: Object.freeze(['extensionId', 'path']),
		requestMode: 'runtime',
		requestVersion: '10.0.5',
		versionRequirement: 'greater_than_or_equal',
		requestArchitecture: 'x64',
		precedesSharedPath: true,
		configuredPathPreviewCheckMissing: true,
		fallbackCommands: Object.freeze(['dotnet.acquireStatus', 'dotnet.acquire', 'dotnet.ensureDotnetDependencies']),
	}),
});

export interface ICSharpRuntimeMappingInput {
	readonly client: { readonly id: string; readonly version: string; readonly targetPlatform: string } | undefined;
	readonly runtimeDependency: { readonly id: string; readonly version: string } | undefined;
	readonly platform: string;
	readonly architecture: string | undefined;
	readonly host: IDotnetEditingHostResult;
	readonly existingDotnetPath: unknown;
	readonly sharedExistingDotnetPath?: unknown;
	readonly allowInvalidPaths?: unknown;
}

export type CSharpRuntimeMappingIssue = 'client-unvalidated' | 'runtime-dependency-unvalidated' | 'unsupported-platform' | 'host-unverified' | 'runtime-incompatible' | 'mapping-missing' | 'mapping-conflict' | 'invalid-path-bypass';
export interface ICSharpRuntimeMappingResult {
	readonly eligible: boolean;
	readonly reason?: CSharpRuntimeMappingIssue;
	readonly executable?: string;
}

/** Validates the dependency's requester-specific mapping independently of its preview check. */
export function CSharpRuntimeMappingGuard(input: ICSharpRuntimeMappingInput): ICSharpRuntimeMappingResult {
	const deny = (reason: CSharpRuntimeMappingIssue): ICSharpRuntimeMappingResult => ({ eligible: false, reason });
	if (input.client?.id !== CSHARP_EDITING_COMPATIBILITY_RECORD.client.id
		|| input.client.version !== CSHARP_EDITING_COMPATIBILITY_RECORD.client.version
		|| input.client.targetPlatform !== CSHARP_EDITING_COMPATIBILITY_RECORD.client.platform) {
		return deny('client-unvalidated');
	}
	if (input.runtimeDependency?.id !== CSHARP_EDITING_COMPATIBILITY_RECORD.runtimeDependency.id
		|| input.runtimeDependency.version !== CSHARP_EDITING_COMPATIBILITY_RECORD.runtimeDependency.version) {
		return deny('runtime-dependency-unvalidated');
	}
	if (input.platform !== 'linux' || input.architecture !== 'x64') {
		return deny('unsupported-platform');
	}
	if (input.host.schemaVersion !== 1 || input.host.kind !== 'ready' || input.host.locality !== 'local'
		|| input.host.profile !== CSHARP_EDITING_COMPATIBILITY_RECORD.runtime.profile
		|| !isExecutableInsideRoot(input.host.executable, input.host.root)) {
		return deny('host-unverified');
	}
	if (!isStableCompatibleRuntime(input.host.runtimeVersion) || !isStableCompatibleRuntime(input.host.sdkVersion)) {
		return deny('runtime-incompatible');
	}
	if (input.allowInvalidPaths !== undefined && input.allowInvalidPaths !== false) {
		return deny('invalid-path-bypass');
	}
	if (!Array.isArray(input.existingDotnetPath)) {
		return deny('mapping-missing');
	}
	const matching = input.existingDotnetPath.filter((entry): entry is { extensionId: string; path: string } => isRecord(entry) && entry.extensionId === CSHARP_EDITING_CLIENT_ID && typeof entry.path === 'string');
	if (matching.length !== 1 || matching[0]!.path !== input.host.executable) {
		return deny(matching.length === 0 ? 'mapping-missing' : 'mapping-conflict');
	}
	if (input.existingDotnetPath.some(entry => isRecord(entry) && entry.extensionId === CSHARP_EDITING_CLIENT_ID && typeof entry.path !== 'string')) {
		return deny('mapping-conflict');
	}
	if (input.sharedExistingDotnetPath !== undefined && input.sharedExistingDotnetPath !== '' && input.sharedExistingDotnetPath !== input.host.executable) {
		return deny('mapping-conflict');
	}
	return { eligible: true, executable: input.host.executable };
}

function isStableCompatibleRuntime(value: string): boolean {
	const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(value);
	if (!match || match.slice(1).some(part => !Number.isSafeInteger(Number(part)))) {
		return false;
	}
	const actual = match.slice(1).map(Number);
	return actual[0]! > 10 || (actual[0] === 10 && (actual[1]! > 0 || (actual[1] === 0 && actual[2]! >= 5)));
}

function isExecutableInsideRoot(executable: string, root: string): boolean {
	const parts = (value: string): string[] | undefined => {
		if (!value.startsWith('/') || value.startsWith('//') || /[\0\r\n]/.test(value)) {
			return undefined;
		}
		const result = value.slice(1).split('/');
		return result.some(part => !part || part === '.' || part === '..') ? undefined : result;
	};
	const executableParts = parts(executable);
	const rootParts = parts(root);
	return !!executableParts && !!rootParts && executableParts.at(-1) === 'dotnet'
		&& executableParts.length === rootParts.length + 1
		&& rootParts.every((part, index) => executableParts[index] === part);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
