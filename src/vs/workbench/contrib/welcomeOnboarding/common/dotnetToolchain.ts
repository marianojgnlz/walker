/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Version of the command snapshot contract; snapshots with another version are rejected. */
export const DOTNET_TOOLCHAIN_SCHEMA_VERSION = 1;

/** Command identifiers exposed by the built-in .NET Toolchain extension. */
export const DOTNET_TOOLCHAIN_COMMANDS = Object.freeze({
	getState: 'walker.dotnet.getState',
	recheck: 'walker.dotnet.recheck',
	setup: 'walker.dotnet.setup',
	showOutput: 'walker.dotnet.showOutput',
	showActions: 'walker.dotnet.showActions',
	runTemplateOperation: 'walker.dotnet.runTemplateOperation',
} as const);

/** States in snapshot v1, kept in parity with the extension contract. */
export type DotnetToolchainState = 'checking' | 'ready' | 'runtimeOnly' | 'missing' | 'installing' | 'verifying' | 'failed' | 'unavailable';
export const DOTNET_TOOLCHAIN_STATES: readonly DotnetToolchainState[] = Object.freeze([
	'checking', 'ready', 'runtimeOnly', 'missing', 'installing', 'verifying', 'failed', 'unavailable',
]);

const FAILURE_STAGES = ['detect', 'download', 'process', 'publish', 'verify', 'recovery'] as const;
const PROGRESS_PHASES = ['preparing', 'downloading', 'installing', 'verifying', 'finalizing'] as const;

/** Version and executable path verified by executing the local SDK. */
export interface IDotnetToolchainVerified {
	readonly executable: string;
	readonly sdkVersion: string;
}

/** Optional stable failure diagnostic from the extension. */
export interface IDotnetToolchainFailure {
	readonly stage: (typeof FAILURE_STAGES)[number];
	readonly code?: string;
}

/** Optional install progress; it contains no command output or sensitive values. */
export interface IDotnetToolchainProgress {
	readonly phase: (typeof PROGRESS_PHASES)[number];
	readonly otherWindow: boolean;
}

/** Versioned snapshot returned by `walker.dotnet.getState`. */
export interface IDotnetToolchainSnapshot {
	readonly schemaVersion: typeof DOTNET_TOOLCHAIN_SCHEMA_VERSION;
	readonly revision: number;
	readonly state: DotnetToolchainState;
	readonly locality: 'local';
	readonly verified?: IDotnetToolchainVerified;
	readonly failure?: IDotnetToolchainFailure;
	readonly progress?: IDotnetToolchainProgress;
}

/** Wizard-only identities and switches forwarded to the verified local SDK. */
export const DOTNET_NEW_TEMPLATE_IDS = Object.freeze([
	'console', 'classlib', 'webapi', 'webapiaot', 'mvc', 'webapp', 'razor', 'blazor', 'blazorwasm', 'worker', 'xunit', 'nunit',
] as const);
export const DOTNET_NEW_OPTION_NAMES = Object.freeze(['framework', 'use-minimal-apis', 'use-controllers', 'include-tests', 'no-restore'] as const);

export type DotnetNewTemplateId = (typeof DOTNET_NEW_TEMPLATE_IDS)[number];
export type DotnetNewOptionName = (typeof DOTNET_NEW_OPTION_NAMES)[number];
export type DotnetTemplateOperation = 'listTemplates' | 'help' | 'dryRun' | 'generate';

export interface IDotnetNewTemplateOption {
	readonly name: DotnetNewOptionName;
	readonly value?: string;
}

export type IDotnetTemplateOperationRequest =
	| { readonly schemaVersion: typeof DOTNET_TOOLCHAIN_SCHEMA_VERSION; readonly operation: 'listTemplates' }
	| { readonly schemaVersion: typeof DOTNET_TOOLCHAIN_SCHEMA_VERSION; readonly operation: 'help'; readonly template: DotnetNewTemplateId }
	| {
		readonly schemaVersion: typeof DOTNET_TOOLCHAIN_SCHEMA_VERSION;
		readonly operation: 'dryRun' | 'generate';
		readonly template: DotnetNewTemplateId;
		readonly name: string;
		readonly output: string;
		readonly options: readonly IDotnetNewTemplateOption[];
	};

export type IDotnetTemplateOperationResult =
	| {
		readonly schemaVersion: typeof DOTNET_TOOLCHAIN_SCHEMA_VERSION;
		readonly kind: 'executed';
		readonly operation: DotnetTemplateOperation;
		readonly exitCode: number;
		readonly stdout: string;
		readonly stderr: string;
		readonly failure?: 'spawn' | 'timeout';
	}
	| { readonly schemaVersion: typeof DOTNET_TOOLCHAIN_SCHEMA_VERSION; readonly kind: 'unavailable'; readonly reason: 'sdk-not-ready' }
	| {
		readonly schemaVersion: typeof DOTNET_TOOLCHAIN_SCHEMA_VERSION;
		readonly kind: 'invalid';
		readonly reason: 'malformed-request' | 'unsupported-template' | 'unsafe-name' | 'unsafe-output' | 'unsupported-option';
	};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
	return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
	return Object.keys(value).every(key => allowed.includes(key));
}

function isDotnetNewTemplateOption(value: unknown): value is IDotnetNewTemplateOption {
	if (!isRecord(value) || !hasOnlyKeys(value, ['name', 'value']) || !isOneOf(value.name, DOTNET_NEW_OPTION_NAMES)) {
		return false;
	}
	if (value.name === 'framework') {
		return typeof value.value === 'string' && /^net\d+(?:\.\d+)?(?:-[A-Za-z0-9.-]+)?$/i.test(value.value);
	}
	return value.value === undefined;
}

/** Validates a wizard request before it crosses the extension command boundary. */
export function isDotnetTemplateOperationRequest(value: unknown): value is IDotnetTemplateOperationRequest {
	if (!isRecord(value) || value.schemaVersion !== DOTNET_TOOLCHAIN_SCHEMA_VERSION || typeof value.operation !== 'string') {
		return false;
	}
	if (value.operation === 'listTemplates') {
		return hasOnlyKeys(value, ['schemaVersion', 'operation']);
	}
	if (value.operation === 'help') {
		return hasOnlyKeys(value, ['schemaVersion', 'operation', 'template']) && isOneOf(value.template, DOTNET_NEW_TEMPLATE_IDS);
	}
	if (value.operation !== 'dryRun' && value.operation !== 'generate') {
		return false;
	}
	if (!hasOnlyKeys(value, ['schemaVersion', 'operation', 'template', 'name', 'output', 'options']) || !isOneOf(value.template, DOTNET_NEW_TEMPLATE_IDS)) {
		return false;
	}
	if (typeof value.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value.name)) {
		return false;
	}
	if (typeof value.output !== 'string' || value.output.length === 0 || /[\0\r\n]/.test(value.output)) {
		return false;
	}
	if (!Array.isArray(value.options)) {
		return false;
	}
	const options: IDotnetNewTemplateOption[] = [];
	for (const option of value.options as unknown[]) {
		if (!isDotnetNewTemplateOption(option)) {
			return false;
		}
		options.push(option);
	}
	return new Set(options.map(option => option.name)).size === options.length;
}

/** Validates the toolchain extension's bounded operation result before the wizard consumes it. */
export function isDotnetTemplateOperationResult(value: unknown): value is IDotnetTemplateOperationResult {
	if (!isRecord(value) || value.schemaVersion !== DOTNET_TOOLCHAIN_SCHEMA_VERSION || typeof value.kind !== 'string') {
		return false;
	}
	if (value.kind === 'unavailable') {
		return hasOnlyKeys(value, ['schemaVersion', 'kind', 'reason']) && value.reason === 'sdk-not-ready';
	}
	if (value.kind === 'invalid') {
		return hasOnlyKeys(value, ['schemaVersion', 'kind', 'reason']) && isOneOf(value.reason, ['malformed-request', 'unsupported-template', 'unsafe-name', 'unsafe-output', 'unsupported-option'] as const);
	}
	return value.kind === 'executed'
		&& hasOnlyKeys(value, ['schemaVersion', 'kind', 'operation', 'exitCode', 'stdout', 'stderr', 'failure'])
		&& isOneOf(value.operation, ['listTemplates', 'help', 'dryRun', 'generate'] as const)
		&& typeof value.exitCode === 'number' && Number.isInteger(value.exitCode)
		&& typeof value.stdout === 'string' && typeof value.stderr === 'string'
		&& (value.failure === undefined || isOneOf(value.failure, ['spawn', 'timeout'] as const));
}

/** Validates the extension's snapshot v1 structure without importing extension implementation code. */
export function isDotnetToolchainSnapshot(value: unknown): value is IDotnetToolchainSnapshot {
	if (!isRecord(value) || value.schemaVersion !== DOTNET_TOOLCHAIN_SCHEMA_VERSION || value.locality !== 'local' || typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 0 || !isOneOf(value.state, DOTNET_TOOLCHAIN_STATES)) {
		return false;
	}
	const verified = value.verified;
	if (verified !== undefined && (!isRecord(verified) || typeof verified.executable !== 'string' || verified.executable.length === 0 || typeof verified.sdkVersion !== 'string' || verified.sdkVersion.length === 0)) {
		return false;
	}
	if (value.state === 'ready' && verified === undefined) {
		return false;
	}
	const failure = value.failure;
	if (failure !== undefined && (!isRecord(failure) || !isOneOf(failure.stage, FAILURE_STAGES) || (failure.code !== undefined && typeof failure.code !== 'string'))) {
		return false;
	}
	const progress = value.progress;
	if (progress !== undefined && (!isRecord(progress) || !isOneOf(progress.phase, PROGRESS_PHASES) || typeof progress.otherWindow !== 'boolean')) {
		return false;
	}
	return true;
}
