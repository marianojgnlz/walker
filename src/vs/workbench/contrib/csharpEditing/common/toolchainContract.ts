/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Existing snapshot schema; the editing-host observation uses its own independent version. */
export const DOTNET_TOOLCHAIN_SCHEMA_VERSION = 1;
export const DOTNET_EDITING_HOST_SCHEMA_VERSION = 1;
export const DOTNET_EDITING_HOST_PROFILE = 'roslyn-standalone-10' as const;

/** Command identifiers mirrored structurally from the built-in .NET Toolchain extension. */
export const DOTNET_TOOLCHAIN_COMMANDS = Object.freeze({
	getState: 'walker.dotnet.getState',
	recheck: 'walker.dotnet.recheck',
	setup: 'walker.dotnet.setup',
	showOutput: 'walker.dotnet.showOutput',
	showActions: 'walker.dotnet.showActions',
	runTemplateOperation: 'walker.dotnet.runTemplateOperation',
	resolveEditingHost: 'walker.dotnet.resolveEditingHost',
} as const);

export type DotnetEditingHostPlatform = 'win32' | 'darwin' | 'linux';
export interface IDotnetEditingHostRequest {
	readonly schemaVersion: typeof DOTNET_EDITING_HOST_SCHEMA_VERSION;
	readonly profile: typeof DOTNET_EDITING_HOST_PROFILE;
}
export type DotnetEditingHostRequestClassification = 'supported' | 'unsupported-profile' | 'malformed-request';
export type IDotnetEditingHostResult =
	| { readonly schemaVersion: typeof DOTNET_EDITING_HOST_SCHEMA_VERSION; readonly kind: 'ready'; readonly locality: 'local'; readonly profile: typeof DOTNET_EDITING_HOST_PROFILE; readonly executable: string; readonly root: string; readonly sdkVersion: string; readonly runtimeVersion: string }
	| { readonly schemaVersion: typeof DOTNET_EDITING_HOST_SCHEMA_VERSION; readonly kind: 'unavailable'; readonly reason: 'unsupported-host' | 'sdk-not-ready' | 'runtime-incompatible' | 'busy' }
	| { readonly schemaVersion: typeof DOTNET_EDITING_HOST_SCHEMA_VERSION; readonly kind: 'invalid'; readonly reason: 'malformed-request' | 'unsupported-profile' }
	| { readonly schemaVersion: typeof DOTNET_EDITING_HOST_SCHEMA_VERSION; readonly kind: 'failed'; readonly reason: 'recheck-failed' | 'unsafe-installation' | 'spawn' | 'timeout' | 'invalid-runtime-output' };

const UNAVAILABLE_REASONS = ['unsupported-host', 'sdk-not-ready', 'runtime-incompatible', 'busy'] as const;
const INVALID_REASONS = ['malformed-request', 'unsupported-profile'] as const;
const FAILURE_REASONS = ['recheck-failed', 'unsafe-installation', 'spawn', 'timeout', 'invalid-runtime-output'] as const;
const READY_KEYS = ['schemaVersion', 'kind', 'locality', 'profile', 'executable', 'root', 'sdkVersion', 'runtimeVersion'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
	return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
	const keys = Object.keys(value);
	return keys.length === expected.length && keys.every(key => expected.includes(key));
}

function isStableVersion(value: unknown): value is string {
	if (typeof value !== 'string') {
		return false;
	}
	const parts = value.split('.');
	return parts.length === 3 && parts.every(part => /^(0|[1-9][0-9]*)$/.test(part) && Number.isSafeInteger(Number(part)));
}

function isRuntimeCompatible(value: string): boolean {
	const actual = value.split('.').map(Number);
	const minimum = [10, 0, 5];
	for (let index = 0; index < minimum.length; index++) {
		if (actual[index] !== minimum[index]) {
			return actual[index]! > minimum[index]!;
		}
	}
	return true;
}

function editingHostPathParts(value: unknown, platform: DotnetEditingHostPlatform): string[] | undefined {
	if (typeof value !== 'string' || value.length === 0 || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
		return undefined;
	}
	if (platform === 'win32') {
		const drive = /^([A-Za-z]):/.exec(value);
		const separator = String.fromCharCode(92);
		if (!drive || (value[2] !== '/' && value[2] !== separator)) {
			return undefined;
		}
		const parts = value.slice(3).split(separator).join('/').split('/').filter(Boolean);
		if (parts.some(part => part === '.' || part === '..')) {
			return undefined;
		}
		return [`${drive[1]!.toLowerCase()}:`, ...parts.map(part => part.toLowerCase())];
	}
	if (!value.startsWith('/') || value.startsWith('//')) {
		return undefined;
	}
	const parts = value.slice(1).split('/').filter(Boolean);
	if (parts.some(part => part === '.' || part === '..')) {
		return undefined;
	}
	return ['/', ...parts];
}

function isExecutableInsideRoot(executable: unknown, root: unknown, platform: DotnetEditingHostPlatform): boolean {
	const executableParts = editingHostPathParts(executable, platform);
	const rootParts = editingHostPathParts(root, platform);
	return executableParts !== undefined && rootParts !== undefined
		&& executableParts.length > rootParts.length
		&& rootParts.every((part, index) => executableParts[index] === part);
}

/** Classifies the exact request envelope while preserving unsupported-profile as a distinct result. */
export function classifyDotnetEditingHostRequest(value: unknown): DotnetEditingHostRequestClassification {
	if (!isRecord(value) || !hasExactKeys(value, ['schemaVersion', 'profile']) || value.schemaVersion !== DOTNET_EDITING_HOST_SCHEMA_VERSION || typeof value.profile !== 'string' || value.profile.length === 0) {
		return 'malformed-request';
	}
	return value.profile === DOTNET_EDITING_HOST_PROFILE ? 'supported' : 'unsupported-profile';
}

/** Classifies the exact command arity and request envelope before any resolver work. */
export function classifyDotnetEditingHostArguments(args: readonly unknown[]): DotnetEditingHostRequestClassification {
	return args.length === 1 ? classifyDotnetEditingHostRequest(args[0]) : 'malformed-request';
}

/** Validates the one supported request. */
export function isDotnetEditingHostRequest(value: unknown): value is IDotnetEditingHostRequest {
	return classifyDotnetEditingHostRequest(value) === 'supported';
}

/** Validates a local SDK/runtime observation; these paths are not a general launcher capability. */
export function isDotnetEditingHostResult(value: unknown, platform: DotnetEditingHostPlatform): value is IDotnetEditingHostResult {
	if (!isRecord(value) || value.schemaVersion !== DOTNET_EDITING_HOST_SCHEMA_VERSION || typeof value.kind !== 'string') {
		return false;
	}
	if (value.kind === 'ready') {
		return hasExactKeys(value, READY_KEYS)
			&& value.locality === 'local' && value.profile === DOTNET_EDITING_HOST_PROFILE
			&& isExecutableInsideRoot(value.executable, value.root, platform)
			&& isStableVersion(value.sdkVersion) && isStableVersion(value.runtimeVersion)
			&& isRuntimeCompatible(value.runtimeVersion);
	}
	if (value.kind === 'unavailable') {
		return hasExactKeys(value, ['schemaVersion', 'kind', 'reason']) && isOneOf(value.reason, UNAVAILABLE_REASONS);
	}
	if (value.kind === 'invalid') {
		return hasExactKeys(value, ['schemaVersion', 'kind', 'reason']) && isOneOf(value.reason, INVALID_REASONS);
	}
	return value.kind === 'failed'
		&& hasExactKeys(value, ['schemaVersion', 'kind', 'reason'])
		&& isOneOf(value.reason, FAILURE_REASONS);
}

/** Narrow executor supplied by the workbench command client; the wrapper owns the fixed command and payload. */
export type DotnetEditingHostCommandExecutor = (command: string, request: IDotnetEditingHostRequest) => Promise<unknown>;

/** Requests the one supported profile and rejects malformed or semantically invalid replies. */
export async function executeDotnetEditingHostCommand(executeCommand: DotnetEditingHostCommandExecutor, platform: DotnetEditingHostPlatform): Promise<IDotnetEditingHostResult> {
	const result = await executeCommand(DOTNET_TOOLCHAIN_COMMANDS.resolveEditingHost, {
		schemaVersion: DOTNET_EDITING_HOST_SCHEMA_VERSION,
		profile: DOTNET_EDITING_HOST_PROFILE,
	});
	if (!isDotnetEditingHostResult(result, platform) || result.kind === 'invalid') {
		throw new TypeError('Invalid .NET editing-host result');
	}
	return result;
}
