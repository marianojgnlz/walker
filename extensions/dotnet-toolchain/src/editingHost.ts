/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { isAbsolutePath, isPathWithin } from './candidates';
import {
	DOTNET_EDITING_HOST_PROFILE,
	DOTNET_EDITING_HOST_SCHEMA_VERSION,
	type IDotnetEditingHostResult,
	type IDotnetToolchainSnapshot,
	type IFileSystemAdapter,
	type IProcessAdapter,
	type IProcessExecutionResult,
} from './contracts';
import { compareDotnetVersions, parseRuntimeInventory } from './probe';

export const DOTNET_EDITING_HOST_TIMEOUT_MS = 10_000;
export const DOTNET_EDITING_HOST_MAX_OUTPUT_BYTES = 64 * 1024;
const MINIMUM_RUNTIME_VERSION = '10.0.5';
const CHILD_ENVIRONMENT_KEYS = ['DOTNET_ROOT', 'DOTNET_MULTILEVEL_LOOKUP', 'DOTNET_CLI_TELEMETRY_OPTOUT', 'DOTNET_NOLOGO'] as const;

type SupportedPlatform = 'win32' | 'darwin' | 'linux';

export interface IDotnetEditingHostResolverOptions {
	readonly platform: NodeJS.Platform;
	readonly recheck: () => Promise<IDotnetToolchainSnapshot>;
	readonly isBusy: () => boolean;
	readonly fileSystem: IFileSystemAdapter;
	readonly process: IProcessAdapter;
	readonly workspaceRoots: () => readonly string[];
	readonly temporaryDirectory: string;
}

export interface IDotnetEditingHostResolver {
	resolve(): Promise<IDotnetEditingHostResult>;
}

function platformPath(platform: SupportedPlatform): path.PlatformPath {
	return platform === 'win32' ? path.win32 : path.posix;
}

function isSupportedPlatform(platform: NodeJS.Platform): platform is SupportedPlatform {
	return platform === 'win32' || platform === 'darwin' || platform === 'linux';
}

function samePath(left: string, right: string, platform: SupportedPlatform): boolean {
	const api = platformPath(platform);
	const normalize = (value: string): string => platform === 'win32' ? api.resolve(value).toLowerCase() : api.resolve(value);
	return normalize(left) === normalize(right);
}

function isStableVersion(value: string): boolean {
	return /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value)
		&& value.split('.').every(part => Number.isSafeInteger(Number(part)));
}

function isCompatibleRuntime(value: string): boolean {
	return isStableVersion(value) && compareDotnetVersions(value, MINIMUM_RUNTIME_VERSION) >= 0;
}

function baseResult(kind: 'unavailable' | 'failed', reason: string): IDotnetEditingHostResult {
	return { schemaVersion: DOTNET_EDITING_HOST_SCHEMA_VERSION, kind, reason } as IDotnetEditingHostResult;
}

function processFailure(result: IProcessExecutionResult): IDotnetEditingHostResult | undefined {
	if (result.failure === 'spawn') {
		return baseResult('failed', 'spawn');
	}
	if (result.failure === 'timeout') {
		return baseResult('failed', 'timeout');
	}
	if (result.exitCode !== 0 || result.stdout.includes('truncated at') || result.stderr.includes('truncated at')) {
		return baseResult('failed', 'invalid-runtime-output');
	}
	return undefined;
}

function findSectionVersion(output: string, section: 'sdk' | 'host'): string | undefined {
	const pattern = section === 'sdk'
		? /^\.NET SDK:\r?\n\s+Version:\s*(\S+)/m
		: /^Host:\r?\n\s+Version:\s*(\S+)/m;
	return pattern.exec(output)?.[1];
}

function findSdkBasePath(output: string): string | undefined {
	return /^\s+Base Path:\s*(\S+)/m.exec(output)?.[1];
}

function containedInside(root: string, candidate: string, platform: SupportedPlatform): boolean {
	return isPathWithin(root, candidate, platform);
}

/** Creates the fixed-profile resolver; no caller-provided command, argv, environment or cwd is accepted. */
export function createDotnetEditingHostResolver(options: IDotnetEditingHostResolverOptions): IDotnetEditingHostResolver {
	const resolve = async (): Promise<IDotnetEditingHostResult> => {
		if (!isSupportedPlatform(options.platform)) {
			return baseResult('unavailable', 'unsupported-host');
		}
		const platform = options.platform;
		const api = platformPath(platform);
		const isBusy = (): boolean => {
			try {
				return options.isBusy();
			} catch {
				return true;
			}
		};
		if (isBusy()) {
			return baseResult('unavailable', 'busy');
		}

		let snapshot: IDotnetToolchainSnapshot;
		try {
			snapshot = await options.recheck();
		} catch {
			return baseResult('failed', 'recheck-failed');
		}
		if (isBusy() || snapshot.state === 'installing' || snapshot.state === 'verifying') {
			return baseResult('unavailable', 'busy');
		}
		const verified = snapshot.verified;
		if (snapshot.state !== 'ready' || verified === undefined) {
			return baseResult('unavailable', 'sdk-not-ready');
		}
		if (!isStableVersion(verified.sdkVersion) || !isAbsolutePath(verified.executable, platform) || /[\0\r\n]/.test(verified.executable)) {
			return baseResult('failed', 'unsafe-installation');
		}

		try {
			const executable = await options.fileSystem.realpath(verified.executable);
			if (executable === undefined || !isAbsolutePath(executable, platform) || /[\0\r\n]/.test(executable) || !await options.fileSystem.exists(executable)) {
				return baseResult('failed', 'unsafe-installation');
			}
			const root = api.dirname(api.normalize(executable));
			const resolvedRoot = await options.fileSystem.realpath(root);
			const expectedName = platform === 'win32' ? 'dotnet.exe' : 'dotnet';
			if (resolvedRoot === undefined || !samePath(root, resolvedRoot, platform) || !samePath(api.dirname(executable), root, platform)
				|| api.basename(executable).toLowerCase() !== expectedName || !await options.fileSystem.exists(root)) {
				return baseResult('failed', 'unsafe-installation');
			}

			if (!isAbsolutePath(options.temporaryDirectory, platform) || /[\0\r\n]/.test(options.temporaryDirectory)) {
				return baseResult('failed', 'unsafe-installation');
			}
			const temporaryDirectory = await options.fileSystem.realpath(options.temporaryDirectory);
			if (temporaryDirectory === undefined || !isAbsolutePath(temporaryDirectory, platform) || !await options.fileSystem.exists(temporaryDirectory)
				|| containedInside(root, temporaryDirectory, platform) || containedInside(temporaryDirectory, root, platform)) {
				return baseResult('failed', 'unsafe-installation');
			}
			for (const workspace of options.workspaceRoots()) {
				if (!isAbsolutePath(workspace, platform)) {
					return baseResult('failed', 'unsafe-installation');
				}
				const resolvedWorkspace = await options.fileSystem.realpath(workspace);
				if (resolvedWorkspace === undefined || !isAbsolutePath(resolvedWorkspace, platform) || containedInside(workspace, root, platform) || containedInside(resolvedWorkspace, root, platform)
					|| containedInside(workspace, temporaryDirectory, platform) || containedInside(resolvedWorkspace, temporaryDirectory, platform)) {
					return baseResult('failed', 'unsafe-installation');
				}
			}

			const runtimeRoot = api.join(root, 'shared', 'Microsoft.NETCore.App');
			const realRuntimeRoot = await options.fileSystem.realpath(runtimeRoot);
			if (realRuntimeRoot === undefined || !samePath(realRuntimeRoot, runtimeRoot, platform) || !containedInside(root, realRuntimeRoot, platform)
				|| !await options.fileSystem.exists(runtimeRoot)) {
				return baseResult('failed', 'unsafe-installation');
			}
			const run = async (args: readonly ['--list-runtimes'] | readonly ['--info']): Promise<IProcessExecutionResult> => {
				try {
					return await options.process.run({
						executable,
						args,
						cwd: temporaryDirectory,
						env: {
							[CHILD_ENVIRONMENT_KEYS[0]]: root,
							[CHILD_ENVIRONMENT_KEYS[1]]: '0',
							[CHILD_ENVIRONMENT_KEYS[2]]: '1',
							[CHILD_ENVIRONMENT_KEYS[3]]: '1',
						},
						timeoutMs: DOTNET_EDITING_HOST_TIMEOUT_MS,
						maxOutputBytes: DOTNET_EDITING_HOST_MAX_OUTPUT_BYTES,
					});
				} catch {
					return { exitCode: 1, stdout: '', stderr: 'process adapter failed', failure: 'spawn' };
				}
			};
			if (isBusy()) {
				return baseResult('unavailable', 'busy');
			}
			const inventory = await run(['--list-runtimes']);
			const inventoryFailure = processFailure(inventory);
			if (inventoryFailure !== undefined) {
				return inventoryFailure;
			}
			const parsed = parseRuntimeInventory(inventory.stdout);
			if (parsed.kind === 'malformed') {
				return baseResult('failed', 'invalid-runtime-output');
			}
			const entries = parsed.entries.filter(entry => entry.runtime === 'Microsoft.NETCore.App');
			if (entries.some(entry => !samePath(entry.root, runtimeRoot, platform))) {
				return baseResult('failed', 'invalid-runtime-output');
			}
			const compatible = entries.map(entry => entry.version).filter(isCompatibleRuntime).sort((left, right) => compareDotnetVersions(right, left));
			if (compatible.length === 0) {
				return baseResult('unavailable', 'runtime-incompatible');
			}
			for (const version of compatible) {
				const runtimeDirectory = api.join(runtimeRoot, version);
				const runtimeArtifact = api.join(runtimeDirectory, 'System.Private.CoreLib.dll');
				const realDirectory = await options.fileSystem.realpath(runtimeDirectory);
				const realArtifact = await options.fileSystem.realpath(runtimeArtifact);
				if (realDirectory === undefined || realArtifact === undefined || !containedInside(runtimeRoot, realDirectory, platform)
					|| !containedInside(realDirectory, realArtifact, platform) || !await options.fileSystem.exists(runtimeArtifact)) {
					return baseResult('failed', 'invalid-runtime-output');
				}
			}
			if (isBusy()) {
				return baseResult('unavailable', 'busy');
			}
			const info = await run(['--info']);
			const infoFailure = processFailure(info);
			if (infoFailure !== undefined) {
				return infoFailure;
			}
			const reportedSdk = findSectionVersion(info.stdout, 'sdk');
			const hostVersion = findSectionVersion(info.stdout, 'host');
			const sdkBasePath = findSdkBasePath(info.stdout);
			if (reportedSdk !== verified.sdkVersion || !isStableVersion(reportedSdk) || hostVersion === undefined || !isStableVersion(hostVersion)
				|| sdkBasePath === undefined || !isAbsolutePath(sdkBasePath, platform) || /[\0\r\n]/.test(sdkBasePath)) {
				return baseResult('failed', 'invalid-runtime-output');
			}
			const expectedSdkPath = api.join(root, 'sdk', verified.sdkVersion);
			const resolvedSdkPath = await options.fileSystem.realpath(sdkBasePath);
			if (resolvedSdkPath === undefined || !samePath(resolvedSdkPath, expectedSdkPath, platform) || !containedInside(root, resolvedSdkPath, platform)
				|| !await options.fileSystem.exists(sdkBasePath)) {
				return baseResult('failed', 'invalid-runtime-output');
			}
			return {
				schemaVersion: DOTNET_EDITING_HOST_SCHEMA_VERSION,
				kind: 'ready',
				locality: 'local',
				profile: DOTNET_EDITING_HOST_PROFILE,
				executable,
				root,
				sdkVersion: verified.sdkVersion,
				runtimeVersion: compatible[0]!,
			};
		} catch {
			return baseResult('failed', 'unsafe-installation');
		}
	};
	return { resolve };
}
