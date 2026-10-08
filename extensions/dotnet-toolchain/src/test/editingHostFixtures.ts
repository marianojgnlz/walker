/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { createDotnetEditingHostResolver } from '../editingHost';
import type { IDotnetToolchainSnapshot, IFileSystemAdapter, IProcessAdapter, IProcessExecution, IProcessExecutionResult } from '../contracts';

export const root = '/opt/dotnet';
export const executable = `${root}/dotnet`;
export const runtimeRoot = `${root}/shared/Microsoft.NETCore.App`;
export const runtimeDirectory = `${runtimeRoot}/10.0.12`;
export const runtimeArtifact = `${runtimeDirectory}/System.Private.CoreLib.dll`;
export const sdkVersion = '10.0.401';
export const runtimeOutput = `Microsoft.NETCore.App 10.0.12 [${runtimeRoot}]\n`;
export const infoOutput = `.NET SDK:\n Version:   ${sdkVersion}\n Base Path: ${root}/sdk/${sdkVersion}/\nHost:\n Version:   10.0.12\n`;

export function readySnapshot(overrides: Partial<IDotnetToolchainSnapshot> = {}): IDotnetToolchainSnapshot {
	return { schemaVersion: 1, revision: 4, state: 'ready', locality: 'local', verified: { executable, sdkVersion }, ...overrides };
}

interface IFixtureOptions {
	readonly platform?: NodeJS.Platform;
	readonly snapshot?: IDotnetToolchainSnapshot;
	readonly recheck?: () => Promise<IDotnetToolchainSnapshot>;
	readonly busy?: boolean;
	readonly workspaceRoots?: readonly string[];
	readonly runtimeResult?: IProcessExecutionResult;
	readonly infoResult?: IProcessExecutionResult;
	readonly realpaths?: ReadonlyMap<string, string | undefined>;
	readonly missing?: readonly string[];
}

export function fixture(options: IFixtureOptions = {}) {
	const executions: IProcessExecution[] = [];
	const paths = new Set([executable, root, `${root}/sdk/${sdkVersion}`, runtimeRoot, runtimeDirectory, runtimeArtifact, '/tmp', '/tmp/walker-dotnet-probe']);
	const normalize = (value: string): string => (options.platform === 'win32' ? path.win32 : path.posix).resolve(value);
	for (const version of ['10.0.5', '9.0.9']) {
		paths.add(`${runtimeRoot}/${version}`);
		paths.add(`${runtimeRoot}/${version}/System.Private.CoreLib.dll`);
	}
	for (const missing of options.missing ?? []) { paths.delete(missing); }
	const fileSystem: IFileSystemAdapter = {
		exists: async value => paths.has(normalize(value)),
		realpath: async value => options.realpaths?.has(value) ? options.realpaths.get(value) : paths.has(normalize(value)) ? normalize(value) : undefined,
	};
	const process: IProcessAdapter = {
		run: async execution => {
			executions.push(execution);
			return execution.args[0] === '--list-runtimes'
				? options.runtimeResult ?? { exitCode: 0, stdout: runtimeOutput, stderr: '' }
				: options.infoResult ?? { exitCode: 0, stdout: infoOutput, stderr: '' };
		},
	};
	const snapshot = options.snapshot ?? readySnapshot();
	const resolver = createDotnetEditingHostResolver({
		platform: options.platform ?? 'linux',
		recheck: options.recheck ?? (async () => snapshot),
		isBusy: () => options.busy ?? false,
		fileSystem,
		process,
		workspaceRoots: () => options.workspaceRoots ?? [],
		temporaryDirectory: '/tmp/walker-dotnet-probe',
	});
	return { resolver, executions };
}
