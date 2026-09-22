/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { isAbsolutePath } from './candidates';
import { type IEnvironmentAdapter, type IFileSystemAdapter } from './contracts';

/** Install channel chosen explicitly by the user; never an implicit default (D3). */
export type DotnetInstallChannel = 'LTS' | 'STS';

/** One explicit, already-validated install choice. */
export type IDotnetInstallSelection =
	| { readonly kind: 'channel'; readonly channel: DotnetInstallChannel }
	| { readonly kind: 'version'; readonly version: string };

/** Official installer architecture switch values supported by this slice (D3). */
export type DotnetInstallArchitecture = 'x64' | 'arm64' | 'x86' | 'arm';

/** Fixed Unix bash locations, tried in order; PATH and shells are never consulted. */
export const UNIX_BASH_INTERPRETERS: readonly string[] = Object.freeze(['/bin/bash', '/usr/bin/bash', '/usr/local/bin/bash']);

/** Conventional Windows system root used when the injected environment cannot provide one. */
export const DEFAULT_WINDOWS_SYSTEM_ROOT = 'C:\\Windows';

/** Stable prerequisite failures; display text is owned by the localizing UI layer. */
export type DotnetPrerequisiteFailureCode = 'unsupported-architecture' | 'missing-bash' | 'missing-powershell' | 'unsafe-path';

/** One actionable setup prerequisite failure. */
export interface IDotnetPrerequisiteFailure {
	readonly code: DotnetPrerequisiteFailureCode;
	readonly diagnostic: string;
}

/** Resolved prerequisites shared by prompting and invocation construction. */
export interface IDotnetPrerequisites {
	readonly architecture: DotnetInstallArchitecture;
	/** Absolute fixed interpreter path; never resolved through PATH or a shell lookup. */
	readonly interpreter: string;
}

/** Prerequisite resolution outcome. */
export type DotnetPrerequisiteResult =
	| { readonly kind: 'ready'; readonly prerequisites: IDotnetPrerequisites }
	| { readonly kind: 'failed'; readonly failure: IDotnetPrerequisiteFailure };

/** One complete, shell-free official-installer invocation. */
export interface IDotnetInstallInvocation {
	/** Absolute interpreter or script host to spawn. */
	readonly executable: string;
	/** Argument array; each element stays a literal argument because the runner uses `shell: false`. */
	readonly args: readonly string[];
	/** Owned staging directory, never a workspace or user-visible destination. */
	readonly cwd: string;
}

/** Invocation construction outcome. */
export type DotnetInstallInvocationResult =
	| { readonly kind: 'invocation'; readonly invocation: IDotnetInstallInvocation }
	| { readonly kind: 'failed'; readonly failure: IDotnetPrerequisiteFailure };

/** Inputs for {@link buildDotnetInstallInvocation}; owned paths are absolute by contract. */
export interface IDotnetInstallInvocationRequest {
	readonly environment: IEnvironmentAdapter;
	readonly fileSystem: IFileSystemAdapter;
	readonly selection: IDotnetInstallSelection;
	/** Absolute path of the integrity-verified official installer script (B2). */
	readonly scriptPath: string;
	/** Absolute stage directory the installer fills; never the managed destination (D4). */
	readonly stageDirectory: string;
	/** Windows system root; defaults to {@link DEFAULT_WINDOWS_SYSTEM_ROOT}. */
	readonly systemRoot?: string;
}

/** Official-installer architecture per platform; absent entries are rejected before download. */
const ARCHITECTURE_BY_PLATFORM: Readonly<Partial<Record<NodeJS.Platform, Readonly<Record<string, DotnetInstallArchitecture>>>>> = Object.freeze({
	win32: Object.freeze({ x64: 'x64', arm64: 'arm64', ia32: 'x86' }),
	linux: Object.freeze({ x64: 'x64', arm64: 'arm64', arm: 'arm' }),
	darwin: Object.freeze({ x64: 'x64', arm64: 'arm64' }),
});

/**
 * Maps the local host architecture to the official installer architecture. Unsupported
 * combinations return `undefined` so setup fails before any download or prompt.
 */
export function mapDotnetInstallArchitecture(platform: NodeJS.Platform, arch: string): DotnetInstallArchitecture | undefined {
	return ARCHITECTURE_BY_PLATFORM[platform]?.[arch];
}

/** Fixed Windows PowerShell host below the system root; PATH and `where.exe` are never used. */
export function windowsPowerShellPath(systemRoot: string): string {
	return path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

/** First existing absolute interpreter from a fixed list. */
async function firstExistingPath(fileSystem: IFileSystemAdapter, paths: readonly string[]): Promise<string | undefined> {
	for (const candidate of paths) {
		if (await fileSystem.exists(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

/**
 * Resolves the install prerequisites before any prompt: a supported host architecture and the
 * fixed installer interpreter for the platform. An unsupported architecture or a missing
 * interpreter is an actionable failure, never a silent fallback to PATH or a shell.
 */
export async function resolveDotnetPrerequisites(environment: IEnvironmentAdapter, fileSystem: IFileSystemAdapter, systemRoot: string = DEFAULT_WINDOWS_SYSTEM_ROOT): Promise<DotnetPrerequisiteResult> {
	const architecture = mapDotnetInstallArchitecture(environment.platform, environment.arch);
	if (architecture === undefined) {
		return { kind: 'failed', failure: { code: 'unsupported-architecture', diagnostic: `unsupported architecture ${environment.arch} on ${environment.platform}` } };
	}
	if (environment.platform === 'win32') {
		const interpreter = windowsPowerShellPath(systemRoot);
		if (!(await fileSystem.exists(interpreter))) {
			return { kind: 'failed', failure: { code: 'missing-powershell', diagnostic: `PowerShell host is missing at the fixed path ${interpreter}` } };
		}
		return { kind: 'ready', prerequisites: { architecture, interpreter } };
	}
	const interpreter = await firstExistingPath(fileSystem, UNIX_BASH_INTERPRETERS);
	if (interpreter === undefined) {
		return { kind: 'failed', failure: { code: 'missing-bash', diagnostic: `no bash interpreter exists at the fixed paths ${UNIX_BASH_INTERPRETERS.join(', ')}` } };
	}
	return { kind: 'ready', prerequisites: { architecture, interpreter } };
}

/** Official-script switch spellings; only the prefix and casing differ per platform. */
interface IScriptSwitchNames {
	readonly channel: string;
	readonly version: string;
	readonly installDir: string;
	readonly architecture: string;
	readonly noPath: string;
}

/** Official-script switch spellings for one platform. */
function scriptSwitchNames(platform: NodeJS.Platform): IScriptSwitchNames {
	return platform === 'win32'
		? { channel: '-Channel', version: '-Version', installDir: '-InstallDir', architecture: '-Architecture', noPath: '-NoPath' }
		: { channel: '--channel', version: '--version', installDir: '--install-dir', architecture: '--architecture', noPath: '--no-path' };
}

/**
 * Builds the exact shell-free invocation for the verified official script: a fixed absolute
 * interpreter, array arguments only, the explicit mapped architecture, no-path installation, and
 * the owned stage directory as both install destination and working directory. No selection value
 * is ever interpolated into a command string, and relative script or stage paths are refused
 * because they could point into an untrusted workspace.
 */
export async function buildDotnetInstallInvocation(request: IDotnetInstallInvocationRequest): Promise<DotnetInstallInvocationResult> {
	const { environment, fileSystem, selection, scriptPath, stageDirectory } = request;
	if (!isAbsolutePath(scriptPath, environment.platform) || !isAbsolutePath(stageDirectory, environment.platform)) {
		return { kind: 'failed', failure: { code: 'unsafe-path', diagnostic: 'installer script and stage directory must be absolute owned paths' } };
	}
	const prerequisites = await resolveDotnetPrerequisites(environment, fileSystem, request.systemRoot);
	if (prerequisites.kind === 'failed') {
		return { kind: 'failed', failure: prerequisites.failure };
	}
	const names = scriptSwitchNames(environment.platform);
	const args = [
		...(environment.platform === 'win32' ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath] : [scriptPath]),
		...(selection.kind === 'channel' ? [names.channel, selection.channel] : [names.version, selection.version]),
		names.installDir, stageDirectory,
		names.architecture, prerequisites.prerequisites.architecture,
		names.noPath,
	];
	return { kind: 'invocation', invocation: { executable: prerequisites.prerequisites.interpreter, args, cwd: stageDirectory } };
}
