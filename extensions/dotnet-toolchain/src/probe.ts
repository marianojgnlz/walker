/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { type IProcessExecutionResult } from './contracts';

/** Overall budget shared by all candidate probes of one discovery pass (D2). */
export const DOTNET_PROBE_TOTAL_BUDGET_MS = 60_000;

/** Longest diagnostic detail retained from one probe result. */
const MAX_DIAGNOSTIC_LENGTH = 200;

/** Bounded SDK version grammar: numeric core plus optional prerelease and build metadata. */
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?(?:\+[0-9A-Za-z][0-9A-Za-z.-]*)?$/;

/** One `dotnet --list-sdks` line: `<version> [<absolute sdk root>]`. */
const SDK_LINE_PATTERN = /^(\S+)\s+\[([^\[\]]*)\]$/;

/** One `dotnet --list-runtimes` line: `<runtime> <version> [<absolute runtime root>]`. */
const RUNTIME_LINE_PATTERN = /^([A-Za-z][A-Za-z0-9.]*)\s+(\S+)\s+\[([^\[\]]*)\]$/;

/** One SDK entry parsed from `dotnet --list-sdks`; exposed only for internal verification. */
export interface IDotnetSdkInventoryEntry {
	readonly version: string;
	/** Absolute SDK root directory printed by the host, validated before any execution. */
	readonly root: string;
}

/** One runtime entry parsed from `dotnet --list-runtimes`. */
export interface IDotnetRuntimeInventoryEntry {
	readonly runtime: string;
	readonly version: string;
	readonly root: string;
}

/** Structured parse outcome of one successful inventory invocation. */
export type DotnetInventoryParseResult<T> =
	| { readonly kind: 'entries'; readonly entries: readonly T[] }
	| { readonly kind: 'malformed'; readonly diagnostic: string };

/**
 * Full interpretation of one inventory invocation; `absent` is normal missing-executable absence
 * while `error`, `malformed`, and `timeout` stay diagnostics.
 */
export type DotnetInventoryOutcome<T> =
	| DotnetInventoryParseResult<T>
	| { readonly kind: 'absent' }
	| { readonly kind: 'error'; readonly diagnostic: string };

/** True when the value is an absolute POSIX or Windows path, regardless of the host platform. */
function isAbsoluteInventoryRoot(value: string): boolean {
	return path.posix.isAbsolute(value) || path.win32.isAbsolute(value);
}

/** Truncates one diagnostic fragment so failures stay bounded in snapshots and output. */
function truncate(value: string): string {
	return value.length <= MAX_DIAGNOSTIC_LENGTH ? value : `${value.slice(0, MAX_DIAGNOSTIC_LENGTH - 3)}...`;
}

/** First non-empty diagnostic line from stderr, then stdout, bounded for display. */
function describeResult(result: IProcessExecutionResult): string {
	for (const stream of [result.stderr, result.stdout]) {
		const line = stream.split(/\r?\n/).find(candidate => candidate.trim() !== '');
		if (line !== undefined) {
			return truncate(line.trim());
		}
	}
	return 'no diagnostic output';
}

/** Splits a version into numeric core parts and an optional prerelease string. */
function splitVersion(version: string): { numbers: readonly number[]; prerelease?: string } {
	const withoutMetadata = version.split('+', 1)[0];
	const dashIndex = withoutMetadata.indexOf('-');
	return {
		numbers: (dashIndex === -1 ? withoutMetadata : withoutMetadata.slice(0, dashIndex)).split('.').map(part => Number.parseInt(part, 10)),
		prerelease: dashIndex === -1 ? undefined : withoutMetadata.slice(dashIndex + 1),
	};
}

/** Semver-style prerelease comparison: numeric identifiers rank below alphanumeric ones. */
function comparePrerelease(left: string, right: string): number {
	const leftIdentifiers = left.split('.');
	const rightIdentifiers = right.split('.');
	for (let index = 0; index < Math.max(leftIdentifiers.length, rightIdentifiers.length); index++) {
		const leftIdentifier = leftIdentifiers[index];
		const rightIdentifier = rightIdentifiers[index];
		if (leftIdentifier === undefined) {
			return -1;
		}
		if (rightIdentifier === undefined) {
			return 1;
		}
		const leftNumeric = /^\d+$/.test(leftIdentifier);
		const rightNumeric = /^\d+$/.test(rightIdentifier);
		if (leftNumeric && rightNumeric) {
			const difference = Number(leftIdentifier) - Number(rightIdentifier);
			if (difference !== 0) {
				return difference > 0 ? 1 : -1;
			}
		} else if (leftNumeric !== rightNumeric) {
			return leftNumeric ? -1 : 1;
		} else if (leftIdentifier !== rightIdentifier) {
			return leftIdentifier < rightIdentifier ? -1 : 1;
		}
	}
	return 0;
}

/**
 * Compares two validated .NET version strings; releases rank above prereleases of the same core
 * and build metadata is ignored. Newest-first ordering is `compareDotnetVersions(right, left)`.
 */
export function compareDotnetVersions(left: string, right: string): number {
	const leftParts = splitVersion(left);
	const rightParts = splitVersion(right);
	for (let index = 0; index < 3; index++) {
		const difference = (leftParts.numbers[index] ?? 0) - (rightParts.numbers[index] ?? 0);
		if (difference !== 0) {
			return difference > 0 ? 1 : -1;
		}
	}
	if (leftParts.prerelease === undefined && rightParts.prerelease === undefined) {
		return 0;
	}
	if (leftParts.prerelease === undefined) {
		return 1;
	}
	if (rightParts.prerelease === undefined) {
		return -1;
	}
	return comparePrerelease(leftParts.prerelease, rightParts.prerelease);
}

/** Parses non-empty lines into deduplicated entries, rejecting malformed successful output. */
function parseInventoryLines<T>(stream: string, stdout: string, parseLine: (line: string) => T | undefined, dedupeKey: (entry: T) => string): DotnetInventoryParseResult<T> {
	const lines = stdout.split(/\r?\n/);
	const entries: T[] = [];
	const seen = new Set<string>();
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index].trim();
		if (line === '') {
			continue;
		}
		const entry = parseLine(line);
		if (entry === undefined) {
			return { kind: 'malformed', diagnostic: `unrecognized ${stream} line ${index + 1}: ${truncate(line)}` };
		}
		const key = dedupeKey(entry);
		if (!seen.has(key)) {
			seen.add(key);
			entries.push(entry);
		}
	}
	return { kind: 'entries', entries };
}

/**
 * Parses `dotnet --list-sdks` output. Successfully parsed entries are deduplicated by version and
 * root and ordered newest first so the probe layer tries the newest SDK first. Empty output is an
 * empty inventory; a structurally invalid line is malformed output rather than absence.
 */
export function parseSdkInventory(stdout: string): DotnetInventoryParseResult<IDotnetSdkInventoryEntry> {
	const parsed = parseInventoryLines(
		'SDK inventory',
		stdout,
		line => {
			const match = SDK_LINE_PATTERN.exec(line);
			return match !== null && VERSION_PATTERN.test(match[1]) && isAbsoluteInventoryRoot(match[2]) ? { version: match[1], root: match[2] } : undefined;
		},
		entry => `${entry.version}\u0000${entry.root}`,
	);
	return parsed.kind === 'entries' ? { kind: 'entries', entries: [...parsed.entries].sort((left, right) => compareDotnetVersions(right.version, left.version)) } : parsed;
}

/**
 * Parses `dotnet --list-runtimes` output, deduplicating identical runtime/version/root entries while
 * preserving host order. A structurally invalid line is malformed output rather than absence.
 */
export function parseRuntimeInventory(stdout: string): DotnetInventoryParseResult<IDotnetRuntimeInventoryEntry> {
	return parseInventoryLines(
		'runtime inventory',
		stdout,
		line => {
			const match = RUNTIME_LINE_PATTERN.exec(line);
			return match !== null && VERSION_PATTERN.test(match[2]) && isAbsoluteInventoryRoot(match[3]) ? { runtime: match[1], version: match[2], root: match[3] } : undefined;
		},
		entry => `${entry.runtime}\u0000${entry.version}\u0000${entry.root}`,
	);
}

/** Classifies a failed inventory invocation, distinguishing missing executables from diagnostics. */
function classifyInventoryFailure(result: IProcessExecutionResult): DotnetInventoryOutcome<never> | undefined {
	if (result.failure === 'spawn') {
		return /\b(?:ENOENT|ENOTDIR)\b/.test(result.stderr) ? { kind: 'absent' } : { kind: 'error', diagnostic: `probe could not start: ${describeResult(result)}` };
	}
	if (result.failure === 'timeout') {
		return { kind: 'error', diagnostic: `probe timed out: ${describeResult(result)}` };
	}
	if (result.exitCode !== 0) {
		return { kind: 'error', diagnostic: `probe exited with code ${result.exitCode}: ${describeResult(result)}` };
	}
	return undefined;
}

/** Interprets one completed `dotnet --list-sdks` invocation end to end. */
export function interpretSdkInventory(result: IProcessExecutionResult): DotnetInventoryOutcome<IDotnetSdkInventoryEntry> {
	return classifyInventoryFailure(result) ?? parseSdkInventory(result.stdout);
}

/** Interprets one completed `dotnet --list-runtimes` invocation end to end. */
export function interpretRuntimeInventory(result: IProcessExecutionResult): DotnetInventoryOutcome<IDotnetRuntimeInventoryEntry> {
	return classifyInventoryFailure(result) ?? parseRuntimeInventory(result.stdout);
}
