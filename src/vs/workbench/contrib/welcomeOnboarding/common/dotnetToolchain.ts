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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
	return typeof value === 'string' && (allowed as readonly string[]).includes(value);
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
