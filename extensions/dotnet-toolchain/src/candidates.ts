/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { type IEnvironmentAdapter, type IFileSystemAdapter } from './contracts';

/** Maximum unique candidates discovery returns before reporting a deterministic limit (D2). */
export const MAX_DISCOVERY_CANDIDATES = 64;

/** Where a candidate executable came from; used for diagnostics and managed-pin lookups. */
export type DotnetCandidateOrigin = 'managed' | 'path' | 'user' | 'system';

/** Why a planned candidate was not returned; a missing executable is normal and not an exclusion. */
export type DotnetCandidateExclusionReason = 'empty-path-entry' | 'relative-path-entry' | 'workspace' | 'duplicate' | 'candidate-limit';

/** Local machine facts plus the Windows ProgramFiles variables used for conventional roots. */
export interface ICandidateEnvironment extends IEnvironmentAdapter {
	/** Windows `ProgramFiles`; defaults to `C:\Program Files` when absent. */
	readonly programFiles?: string;
	/** Windows `ProgramFiles(x86)`; defaults to `C:\Program Files (x86)` when absent. */
	readonly programFilesX86?: string;
}

/** One ordered dotnet executable candidate. */
export interface IDotnetCandidate {
	/** Absolute executable path to probe, exactly as discovered. */
	readonly executable: string;
	/** Real executable path when the injected filesystem resolves it, otherwise {@link executable}. */
	readonly resolvedExecutable: string;
	readonly origin: DotnetCandidateOrigin;
}

/** One excluded discovery input retained for diagnostics; never an executable to run. */
export interface IDotnetCandidateExclusion {
	readonly path: string;
	readonly reason: DotnetCandidateExclusionReason;
	/** Resolved path when the exclusion was decided after realpath resolution. */
	readonly resolvedPath?: string;
}

/** Deterministic result of candidate discovery. */
export interface IDotnetCandidateDiscovery {
	/** Ordered candidates; the probe layer selects the first successfully SDK-verified one. */
	readonly candidates: readonly IDotnetCandidate[];
	readonly exclusions: readonly IDotnetCandidateExclusion[];
	/** True when more unique candidates existed than {@link MAX_DISCOVERY_CANDIDATES}. */
	readonly limitReached: boolean;
}

/** Options for {@link discoverDotnetCandidates}. */
export interface ICandidateDiscoveryOptions {
	readonly environment: ICandidateEnvironment;
	readonly fileSystem: IFileSystemAdapter;
	/** Open local workspace roots; candidates inside them are untrusted and excluded (D2). */
	readonly workspaceRoots?: readonly string[];
}

type PlannedCandidate = { readonly executable: string; readonly origin: DotnetCandidateOrigin } | { readonly path: string; readonly reason: 'empty-path-entry' | 'relative-path-entry' };

/** Selects the path implementation matching the injected local platform. */
function platformPath(platform: NodeJS.Platform): path.PlatformPath {
	return platform === 'win32' ? path.win32 : path.posix;
}

/** True when `value` is an absolute path for the given platform. */
export function isAbsolutePath(value: string, platform: NodeJS.Platform): boolean {
	return platformPath(platform).isAbsolute(value);
}

/** True when `candidate` is the same path as, or nested below, `parent` on the given platform. */
export function isPathWithin(parent: string, candidate: string, platform: NodeJS.Platform): boolean {
	const pathApi = platformPath(platform);
	const normalizeCase = (value: string): string => platform === 'win32' ? value.toLowerCase() : value;
	const relative = pathApi.relative(normalizeCase(pathApi.resolve(parent)), normalizeCase(pathApi.resolve(candidate)));
	return relative === '' || (!relative.startsWith('..') && !pathApi.isAbsolute(relative));
}

/** Executable file name for the platform; Windows binaries carry the `.exe` suffix. */
function executableName(platform: NodeJS.Platform): string {
	return platform === 'win32' ? 'dotnet.exe' : 'dotnet';
}

/** Joins one installation root with the platform executable name. */
function executableIn(root: string, platform: NodeJS.Platform): string {
	return platformPath(platform).join(root, executableName(platform));
}

/** Expands every local process PATH entry into an ordered candidate or a recorded exclusion. */
function pathCandidates(environment: ICandidateEnvironment): readonly PlannedCandidate[] {
	const separator = environment.platform === 'win32' ? ';' : ':';
	return environment.path.split(separator).map(entry => {
		if (entry.trim() === '') {
			return { path: entry, reason: 'empty-path-entry' as const };
		}
		if (!isAbsolutePath(entry, environment.platform)) {
			return { path: entry, reason: 'relative-path-entry' as const };
		}
		return { executable: executableIn(entry, environment.platform), origin: 'path' as const };
	});
}

/** Conventional per-user installation roots; Windows also uses the LocalAppData dotnet root. */
function userRoots(environment: ICandidateEnvironment): readonly string[] {
	const pathApi = platformPath(environment.platform);
	return environment.platform === 'win32'
		? [pathApi.join(environment.home, '.dotnet'), pathApi.join(environment.home, 'AppData', 'Local', 'Microsoft', 'dotnet')]
		: [pathApi.join(environment.home, '.dotnet'), pathApi.join(environment.home, '.local', 'share', 'dotnet')];
}

/** Conventional system installation roots; ProgramFiles variables fall back to OS defaults. */
function systemRoots(environment: ICandidateEnvironment): readonly string[] {
	switch (environment.platform) {
		case 'win32': {
			const pathApi = platformPath('win32');
			return [pathApi.join(environment.programFiles ?? 'C:\\Program Files', 'dotnet'), pathApi.join(environment.programFilesX86 ?? 'C:\\Program Files (x86)', 'dotnet')];
		}
		case 'darwin':
			return ['/usr/local/share/dotnet', '/usr/local/share/dotnet/x64'];
		default:
			return ['/usr/share/dotnet', '/usr/lib/dotnet', '/usr/local/share/dotnet'];
	}
}

/**
 * Builds the fixed candidate order from D2: managed root, local PATH order, conventional user
 * roots, then conventional system roots. Path entries that are empty or relative stay in the
 * planned list so discovery can report them as exclusions.
 */
function plannedCandidates(environment: ICandidateEnvironment): readonly PlannedCandidate[] {
	const platform = environment.platform;
	return [
		{ executable: platformPath(platform).join(environment.home, '.walker', 'dotnet', executableName(platform)), origin: 'managed' },
		...pathCandidates(environment),
		...userRoots(environment).map(root => ({ executable: executableIn(root, platform), origin: 'user' as const })),
		...systemRoots(environment).map(root => ({ executable: executableIn(root, platform), origin: 'system' as const })),
	];
}

/**
 * Discovers ordered dotnet executable candidates from the injected local environment. Candidates
 * are deduplicated by real executable path (case-insensitive on Windows), candidates under an open
 * local workspace are excluded as untrusted, and discovery stops deterministically at
 * {@link MAX_DISCOVERY_CANDIDATES}. This layer never reads workspace files, `global.json`, or
 * DOTNET_ROOT overrides, and it never executes anything: a missing executable is left for the
 * probe layer to classify as normal absence.
 */
export async function discoverDotnetCandidates(options: ICandidateDiscoveryOptions): Promise<IDotnetCandidateDiscovery> {
	const { environment, fileSystem } = options;
	const platform = environment.platform;
	const pathApi = platformPath(platform);
	const workspaceRoots = options.workspaceRoots ?? [];
	const candidates: IDotnetCandidate[] = [];
	const exclusions: IDotnetCandidateExclusion[] = [];
	const seen = new Set<string>();
	let limitReached = false;

	for (const planned of plannedCandidates(environment)) {
		if ('reason' in planned) {
			exclusions.push({ path: planned.path, reason: planned.reason });
			continue;
		}
		const executable = pathApi.normalize(planned.executable);
		if (candidates.length >= MAX_DISCOVERY_CANDIDATES) {
			limitReached = true;
			exclusions.push({ path: executable, reason: 'candidate-limit' });
			break;
		}
		if (workspaceRoots.some(root => isPathWithin(root, executable, platform))) {
			exclusions.push({ path: executable, reason: 'workspace' });
			continue;
		}
		const resolvedExecutable = await fileSystem.realpath(executable);
		const resolved = resolvedExecutable === undefined ? undefined : pathApi.normalize(resolvedExecutable);
		if (resolved !== undefined && workspaceRoots.some(root => isPathWithin(root, resolved, platform))) {
			exclusions.push({ path: executable, reason: 'workspace', resolvedPath: resolved });
			continue;
		}
		const dedupeKey = platform === 'win32' ? (resolved ?? executable).toLowerCase() : (resolved ?? executable);
		if (seen.has(dedupeKey)) {
			exclusions.push({ path: executable, reason: 'duplicate', resolvedPath: resolved });
			continue;
		}
		seen.add(dedupeKey);
		candidates.push({ executable, resolvedExecutable: resolved ?? executable, origin: planned.origin });
	}
	return { candidates, exclusions, limitReached };
}
