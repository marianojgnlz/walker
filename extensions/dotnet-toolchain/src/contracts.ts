/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Wire contract shared by the .NET toolchain core, the extension command boundary, and the
 * onboarding client, plus the narrow adapters they inject. This module must stay free of runtime
 * `vscode` imports so it can be exercised from plain Node tests.
 */

/** Version of the command snapshot contract; snapshots with another version are rejected. */
export const DOTNET_TOOLCHAIN_SCHEMA_VERSION = 1;

/** Command identifiers exposed by the built-in extension. */
export const DOTNET_TOOLCHAIN_COMMANDS = Object.freeze({
	getState: 'walker.dotnet.getState',
	recheck: 'walker.dotnet.recheck',
	setup: 'walker.dotnet.setup',
	showOutput: 'walker.dotnet.showOutput',
	showActions: 'walker.dotnet.showActions',
} as const);

/** Identifier of one `.NET Toolchain` command. */
export type DotnetToolchainCommandId = (typeof DOTNET_TOOLCHAIN_COMMANDS)[keyof typeof DOTNET_TOOLCHAIN_COMMANDS];

/** User-visible toolchain states shared by the extension and the onboarding client. */
export type DotnetToolchainState =
	| 'checking'
	| 'ready'
	| 'runtimeOnly'
	| 'missing'
	| 'installing'
	| 'verifying'
	| 'failed'
	| 'unavailable';

/** Every declared state, used by parity checks and validation. */
export const DOTNET_TOOLCHAIN_STATES: readonly DotnetToolchainState[] = Object.freeze([
	'checking',
	'ready',
	'runtimeOnly',
	'missing',
	'installing',
	'verifying',
	'failed',
	'unavailable',
]);

/** Failure origin stages reported by a `failed` snapshot. */
export type DotnetToolchainFailureStage = 'detect' | 'download' | 'process' | 'publish' | 'verify' | 'recovery';

/** Every declared failure stage. */
export const DOTNET_TOOLCHAIN_FAILURE_STAGES: readonly DotnetToolchainFailureStage[] = Object.freeze([
	'detect',
	'download',
	'process',
	'publish',
	'verify',
	'recovery',
]);

/** Coarse progress phases; never a raw command line or localized prose. */
export type DotnetToolchainProgressPhase = 'preparing' | 'downloading' | 'installing' | 'verifying' | 'finalizing';

/** Every declared progress phase. */
export const DOTNET_TOOLCHAIN_PROGRESS_PHASES: readonly DotnetToolchainProgressPhase[] = Object.freeze([
	'preparing',
	'downloading',
	'installing',
	'verifying',
	'finalizing',
]);

/** Locality of a snapshot; toolchain readiness always describes the local machine. */
export type DotnetToolchainLocality = 'local';

/** Verified SDK detail; present on `ready` snapshots and never an inventory. */
export interface IDotnetToolchainVerified {
	/** Actual executable path that passed the execution probe. */
	readonly executable: string;
	/** SDK version reported by the verified SDK itself. */
	readonly sdkVersion: string;
}

/** Failure detail attached to a `failed` snapshot. */
export interface IDotnetToolchainFailure {
	readonly stage: DotnetToolchainFailureStage;
	/** Stable diagnostic code; display text stays in the extension layer. */
	readonly code?: string;
}

/** Progress detail attached while installation or verification is active. */
export interface IDotnetToolchainProgress {
	readonly phase: DotnetToolchainProgressPhase;
	/** True when another local Walker window owns the active operation. */
	readonly otherWindow: boolean;
}

/** Versioned snapshot returned by `walker.dotnet.getState`. */
export interface IDotnetToolchainSnapshot {
	readonly schemaVersion: typeof DOTNET_TOOLCHAIN_SCHEMA_VERSION;
	/** Monotonically increases within one extension activation. */
	readonly revision: number;
	readonly state: DotnetToolchainState;
	readonly locality: DotnetToolchainLocality;
	/** Required for `ready`, which must identify the verified executable and version. */
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

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

/**
 * Structural guard for snapshot v1. Unknown schema versions, states, or nested shapes are rejected
 * so a client can fall back to `unavailable` instead of rendering unexpected data.
 */
export function isDotnetToolchainSnapshot(value: unknown): value is IDotnetToolchainSnapshot {
	if (!isRecord(value)) {
		return false;
	}
	if (value.schemaVersion !== DOTNET_TOOLCHAIN_SCHEMA_VERSION || typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 0) {
		return false;
	}
	if (!isOneOf(value.state, DOTNET_TOOLCHAIN_STATES) || value.locality !== 'local') {
		return false;
	}
	const verified = value.verified;
	if (verified !== undefined && (!isRecord(verified) || !isNonEmptyString(verified.executable) || !isNonEmptyString(verified.sdkVersion))) {
		return false;
	}
	if (value.state === 'ready' && verified === undefined) {
		return false;
	}
	const failure = value.failure;
	if (failure !== undefined && (!isRecord(failure) || !isOneOf(failure.stage, DOTNET_TOOLCHAIN_FAILURE_STAGES) || (failure.code !== undefined && typeof failure.code !== 'string'))) {
		return false;
	}
	const progress = value.progress;
	if (progress !== undefined && (!isRecord(progress) || !isOneOf(progress.phase, DOTNET_TOOLCHAIN_PROGRESS_PHASES) || typeof progress.otherWindow !== 'boolean')) {
		return false;
	}
	return true;
}

/** Result of one bounded child-process invocation; expected failures resolve instead of throwing. */
export interface IProcessExecutionResult {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
	/** Set when the invocation ended without a usable exit code. */
	readonly failure?: 'spawn' | 'timeout';
}

/** One absolute, shell-free child-process invocation. */
export interface IProcessExecution {
	readonly executable: string;
	readonly args: readonly string[];
	readonly cwd: string;
	readonly env: Readonly<Record<string, string>>;
	readonly timeoutMs: number;
}

/** Injected process boundary; implementations must resolve bounded results, not throw, for probes. */
export interface IProcessAdapter {
	run(execution: IProcessExecution): Promise<IProcessExecutionResult>;
}

/** Injected filesystem boundary used by candidate discovery and trust checks. */
export interface IFileSystemAdapter {
	/** True when the path exists as a file, directory, or link. */
	exists(path: string): Promise<boolean>;
	/** Resolved target for an existing path, or `undefined` when it does not exist. */
	realpath(path: string): Promise<string | undefined>;
}

/** Local machine facts used by candidate discovery; never a remote or workspace environment. */
export interface IEnvironmentAdapter {
	readonly home: string;
	readonly platform: NodeJS.Platform;
	readonly arch: string;
	/** Raw local process `PATH`, not a workspace terminal environment. */
	readonly path: string;
}

/**
 * Narrow UI surface available to the toolchain core. The extension implements it with localized
 * `vscode` APIs; tests inject a recording fake. Diagnostics are plain text, never trusted markdown.
 */
export interface IToolchainUi {
	/** Appends one plain-text diagnostic line to the toolchain output. */
	appendOutput(line: string): void;
	/** Shows a user-facing error; the implementation owns localization and redaction. */
	showError(message: string): void;
}
