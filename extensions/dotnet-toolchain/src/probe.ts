/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { isPathWithin, MAX_DISCOVERY_CANDIDATES, type IDotnetCandidate, type IDotnetCandidateDiscovery } from './candidates';
import { type IEnvironmentAdapter, type IProcessAdapter, type IProcessExecutionResult } from './contracts';

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

/** Per-command probe timeout from D2, passed to the injected bounded process adapter. */
export const DOTNET_PROBE_COMMAND_TIMEOUT_MS = 10_000;

/** Maximum diagnostic lines retained from one probe pass; further lines are suppressed. */
const MAX_PROBE_DIAGNOSTICS = 32;

/** Stable detection failure codes produced by probe aggregation. */
export type DotnetProbeFailureCode =
	| 'candidate-limit'
	| 'probe-budget'
	| 'inventory-error'
	| 'inventory-malformed'
	| 'sdk-path-outside-root'
	| 'sdk-not-executable'
	| 'expected-version-missing';

/** Aggregated readiness outcome of one ordered candidate probe pass. */
export type DotnetProbeOutcome =
	| { readonly kind: 'ready'; readonly executable: string; readonly sdkVersion: string }
	| { readonly kind: 'runtimeOnly' }
	| { readonly kind: 'missing' }
	| { readonly kind: 'failed'; readonly code: DotnetProbeFailureCode; readonly diagnostic: string };

/** One probe pass: the aggregated outcome plus bounded plain-text diagnostics. */
export interface IDotnetProbeResult {
	readonly outcome: DotnetProbeOutcome;
	/** Diagnostics include every probed candidate, not only the one that decided the outcome. */
	readonly diagnostics: readonly string[];
}

/** Injected adapters and the owned directory shared by every probe entry point in this module. */
export interface IDotnetProbeOptions {
	readonly process: IProcessAdapter;
	readonly environment: IEnvironmentAdapter;
	/** Owned temporary directory every invocation runs in; never a workspace directory. */
	readonly cwd: string;
	/** Wall-clock source for the overall budget; defaults to `Date.now`. */
	readonly now?: () => number;
	/** Overall budget for this probe pass; defaults to {@link DOTNET_PROBE_TOTAL_BUDGET_MS}. */
	readonly overallBudgetMs?: number;
}

/** Options for pinning one expected managed SDK version during install verification. */
export interface IExpectedSdkProbeOptions extends IDotnetProbeOptions {
	/** Pinned managed candidate; no other installation is considered. */
	readonly candidate: IDotnetCandidate;
	/** Exact SDK version the install must have produced and that must execute. */
	readonly expectedVersion: string;
}

/** Pinned verification result; an unrelated existing SDK never substitutes for the expected one. */
export type DotnetExpectedSdkVerificationResult =
	| { readonly kind: 'verified'; readonly executable: string; readonly sdkVersion: string; readonly diagnostics: readonly string[] }
	| { readonly kind: 'failed'; readonly code: DotnetProbeFailureCode; readonly diagnostic: string; readonly diagnostics: readonly string[] };

interface ICandidateProbeFailure {
	readonly code: DotnetProbeFailureCode;
	readonly diagnostic: string;
}

interface ICandidateProbeOutcome {
	readonly verified?: { readonly executable: string; readonly sdkVersion: string };
	readonly runtimeUsable: boolean;
	readonly failure?: ICandidateProbeFailure;
}

interface IProbeContext {
	readonly process: IProcessAdapter;
	readonly cwd: string;
	readonly platform: NodeJS.Platform;
	readonly now: () => number;
	readonly deadlineMs: number;
	readonly diagnostics: string[];
}

/** Selects the path implementation matching the injected local platform. */
function probePathApi(platform: NodeJS.Platform): path.PlatformPath {
	return platform === 'win32' ? path.win32 : path.posix;
}

/** Builds the per-pass probe context, including the overall budget deadline. */
function createProbeContext(options: IDotnetProbeOptions): IProbeContext {
	const now = options.now ?? (() => Date.now());
	return {
		process: options.process,
		cwd: options.cwd,
		platform: options.environment.platform,
		now,
		deadlineMs: now() + (options.overallBudgetMs ?? DOTNET_PROBE_TOTAL_BUDGET_MS),
		diagnostics: [],
	};
}

/** True once this probe pass has spent its overall budget. */
function probeBudgetExhausted(context: IProbeContext): boolean {
	return context.now() >= context.deadlineMs;
}

/** Appends one bounded diagnostic line, suppressing output beyond the diagnostic cap. */
function pushProbeDiagnostic(context: IProbeContext, line: string): void {
	if (context.diagnostics.length < MAX_PROBE_DIAGNOSTICS) {
		context.diagnostics.push(truncate(line));
	} else if (context.diagnostics.length === MAX_PROBE_DIAGNOSTICS) {
		context.diagnostics.push('[further probe diagnostics suppressed]');
	}
}

/** Bounds one candidate failure for diagnostics and snapshots. */
function boundedFailure(code: DotnetProbeFailureCode, diagnostic: string): ICandidateProbeFailure {
	return { code, diagnostic: truncate(diagnostic) };
}

/** Bounds one candidate failure and prefixes it with the candidate executable for diagnostics. */
function candidateFailure(candidate: IDotnetCandidate, failure: ICandidateProbeFailure): ICandidateProbeFailure {
	return boundedFailure(failure.code, `${candidate.executable}: ${failure.diagnostic}`);
}

/** D2 child environment: owned root plus telemetry, logo, and multilevel-lookup suppression. */
function probeChildEnvironment(installationRoot: string): Readonly<Record<string, string>> {
	return {
		DOTNET_ROOT: installationRoot,
		DOTNET_CLI_TELEMETRY_OPTOUT: '1',
		DOTNET_NOLOGO: '1',
		DOTNET_MULTILEVEL_LOOKUP: '0',
	};
}

/** Runs one bounded probe invocation in the owned directory with the probe child environment. */
function runProbeCommand(context: IProbeContext, candidate: IDotnetCandidate, installationRoot: string, args: readonly string[]): Promise<IProcessExecutionResult> {
	return context.process.run({
		executable: candidate.executable,
		args,
		cwd: context.cwd,
		env: probeChildEnvironment(installationRoot),
		timeoutMs: DOTNET_PROBE_COMMAND_TIMEOUT_MS,
	});
}

/** Maps a non-entry inventory outcome to a material failure; absence stays normal. */
function inventoryFailure(outcome: DotnetInventoryOutcome<unknown>): ICandidateProbeFailure | undefined {
	if (outcome.kind === 'malformed') {
		return { code: 'inventory-malformed', diagnostic: outcome.diagnostic };
	}
	if (outcome.kind === 'error') {
		return { code: 'inventory-error', diagnostic: outcome.diagnostic };
	}
	return undefined;
}

/** True when the runtime inventory proves a base runtime is usable, not merely a host version. */
function hasUsableRuntime(outcome: DotnetInventoryOutcome<IDotnetRuntimeInventoryEntry>): boolean {
	return outcome.kind === 'entries' && outcome.entries.some(entry => entry.runtime === 'Microsoft.NETCore.App');
}

/**
 * Probes one candidate: enumerates SDKs and runtimes independently, then proves a listed SDK by
 * executing its `MSBuild.dll` entrypoint through the same host. Listed SDK roots must stay inside
 * the candidate's resolved installation root, entries are tried newest first with older versions
 * as an internal fallback, and only one verified SDK is exposed. An optional expected version
 * narrows the probe to one exact SDK for install verification.
 */
async function probeCandidate(context: IProbeContext, candidate: IDotnetCandidate, expectedVersion?: string): Promise<ICandidateProbeOutcome> {
	const pathApi = probePathApi(context.platform);
	const installationRoot = pathApi.dirname(candidate.resolvedExecutable);
	const sdkInventory = interpretSdkInventory(await runProbeCommand(context, candidate, installationRoot, ['--list-sdks']));
	const runtimeInventory = interpretRuntimeInventory(await runProbeCommand(context, candidate, installationRoot, ['--list-runtimes']));
	const runtimeUsable = hasUsableRuntime(runtimeInventory);
	const sdkFailure = inventoryFailure(sdkInventory);
	if (sdkFailure !== undefined) {
		return { runtimeUsable, failure: candidateFailure(candidate, sdkFailure) };
	}
	const listed = sdkInventory.kind === 'entries' ? sdkInventory.entries : [];
	const expected = expectedVersion === undefined ? listed : listed.filter(entry => entry.version === expectedVersion);
	if (expectedVersion !== undefined && expected.length === 0) {
		return { runtimeUsable, failure: candidateFailure(candidate, { code: 'expected-version-missing', diagnostic: `does not list SDK ${expectedVersion}` }) };
	}
	const contained = expected.filter(entry => isPathWithin(installationRoot, pathApi.join(entry.root, entry.version, 'MSBuild.dll'), context.platform));
	if (expected.length > 0 && contained.length === 0) {
		return { runtimeUsable, failure: candidateFailure(candidate, { code: 'sdk-path-outside-root', diagnostic: `every listed SDK lies outside ${installationRoot}` }) };
	}
	for (const entry of contained) {
		const msbuildPath = pathApi.join(entry.root, entry.version, 'MSBuild.dll');
		const result = await runProbeCommand(context, candidate, installationRoot, ['exec', msbuildPath, '-nologo', '-version']);
		if (result.failure === undefined && result.exitCode === 0) {
			return { runtimeUsable, verified: { executable: candidate.executable, sdkVersion: entry.version } };
		}
		pushProbeDiagnostic(context, `${candidate.executable} could not execute SDK ${entry.version}: ${describeResult(result)}`);
	}
	if (contained.length === 0) {
		const runtimeFailure = inventoryFailure(runtimeInventory);
		return { runtimeUsable, failure: runtimeFailure === undefined ? undefined : candidateFailure(candidate, runtimeFailure) };
	}
	return { runtimeUsable, failure: candidateFailure(candidate, { code: 'sdk-not-executable', diagnostic: `listed ${contained.length} SDK(s) but none executed` }) };
}

/**
 * Probes every ordered candidate and aggregates one readiness outcome from D2: a verified SDK is
 * Ready at its actual path; without one an unverified candidate cap or a material probe failure is
 * a detection failure, a usable runtime is Runtime Only, and nothing usable is Not Installed.
 */
export async function probeDotnetCandidates(discovery: IDotnetCandidateDiscovery, options: IDotnetProbeOptions): Promise<IDotnetProbeResult> {
	const context = createProbeContext(options);
	let verified: { readonly executable: string; readonly sdkVersion: string } | undefined;
	let firstFailure: ICandidateProbeFailure | undefined;
	let runtimeExecutable: string | undefined;
	if (discovery.limitReached) {
		pushProbeDiagnostic(context, `candidate limit of ${MAX_DISCOVERY_CANDIDATES} reached during discovery; later candidates were not probed`);
	}
	for (const candidate of discovery.candidates) {
		if (probeBudgetExhausted(context)) {
			const budgetFailure = boundedFailure('probe-budget', `probe budget exhausted before probing ${candidate.executable}`);
			firstFailure ??= budgetFailure;
			pushProbeDiagnostic(context, budgetFailure.diagnostic);
			break;
		}
		const outcome = await probeCandidate(context, candidate);
		verified ??= outcome.verified;
		if (outcome.failure !== undefined) {
			firstFailure ??= outcome.failure;
			pushProbeDiagnostic(context, outcome.failure.diagnostic);
		}
		runtimeExecutable ??= outcome.runtimeUsable ? candidate.executable : undefined;
	}
	if (verified !== undefined) {
		return { outcome: { kind: 'ready', executable: verified.executable, sdkVersion: verified.sdkVersion }, diagnostics: context.diagnostics };
	}
	const failure = discovery.limitReached
		? boundedFailure('candidate-limit', `candidate limit of ${MAX_DISCOVERY_CANDIDATES} reached without a verified SDK`)
		: firstFailure;
	if (failure === undefined) {
		return { outcome: runtimeExecutable === undefined ? { kind: 'missing' } : { kind: 'runtimeOnly' }, diagnostics: context.diagnostics };
	}
	if (runtimeExecutable !== undefined) {
		pushProbeDiagnostic(context, `a usable runtime exists at ${runtimeExecutable} but no SDK verified`);
	}
	return { outcome: { kind: 'failed', code: failure.code, diagnostic: failure.diagnostic }, diagnostics: context.diagnostics };
}

/**
 * Pins readiness probing to one managed candidate and one expected SDK version for install
 * verification. Another installation or a different existing SDK never substitutes for the
 * expected version, so a zero installer exit code alone cannot be reported Ready.
 */
export async function verifyExpectedManagedSdk(options: IExpectedSdkProbeOptions): Promise<DotnetExpectedSdkVerificationResult> {
	const context = createProbeContext(options);
	const outcome = await probeCandidate(context, options.candidate, options.expectedVersion);
	if (outcome.verified !== undefined) {
		return { kind: 'verified', executable: outcome.verified.executable, sdkVersion: outcome.verified.sdkVersion, diagnostics: context.diagnostics };
	}
	if (outcome.failure !== undefined) {
		pushProbeDiagnostic(context, outcome.failure.diagnostic);
	}
	return {
		kind: 'failed',
		code: outcome.failure?.code ?? 'expected-version-missing',
		diagnostic: outcome.failure?.diagnostic ?? `${options.candidate.executable} did not verify SDK ${options.expectedVersion}`,
		diagnostics: context.diagnostics,
	};
}
