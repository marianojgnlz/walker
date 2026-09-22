/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
	type IFileSystemAdapter,
	type IProcessAdapter,
	type IProcessExecution,
	type IProcessExecutionResult,
	type IToolchainUi,
} from '../contracts';

/**
 * One canned response for an exact executable and argument list.
 */
export interface IScriptedResponse {
	readonly executable: string;
	readonly args: readonly string[];
	readonly result: IProcessExecutionResult;
}

/**
 * Process adapter that replays canned responses; it never spawns a child process.
 */
export interface IScriptedProcessAdapter extends IProcessAdapter {
	readonly executions: readonly IProcessExecution[];
}

/**
 * Creates a deterministic process adapter. Unscripted invocations fail loudly instead of spawning.
 */
export function createScriptedProcessAdapter(responses: readonly IScriptedResponse[]): IScriptedProcessAdapter {
	const executions: IProcessExecution[] = [];
	return {
		executions,
		run: async (execution: IProcessExecution): Promise<IProcessExecutionResult> => {
			executions.push(execution);
			const matches = responses.filter(response => response.executable === execution.executable && response.args.join('\u0000') === execution.args.join('\u0000'));
			if (matches.length !== 1) {
				throw new Error(`unscripted or ambiguous invocation: ${execution.executable} ${execution.args.join(' ')}`);
			}
			return matches[0].result;
		},
	};
}

/** Detection outcomes a dotnet process fixture can replay. */
export type DotnetDetectionOutcome = 'absence' | 'runtimeOnly' | 'sdk' | 'error';

/** Inputs for the canonical `--list-sdks` / `--list-runtimes` fixtures. */
export interface IDotnetDetectionFixtureOptions {
	readonly executable: string;
	readonly outcome: DotnetDetectionOutcome;
	readonly runtimeVersion?: string;
	readonly sdkVersion?: string;
	readonly sdkRoot?: string;
}

function listResult(stdout: string): IProcessExecutionResult {
	return { exitCode: 0, stdout, stderr: '' };
}

/**
 * Canonical responses for one detection outcome: `absence` models a missing executable (spawn
 * failure), `error` models an inaccessible or incompatible host, and `sdk`/`runtimeOnly` model
 * successful `--list-sdks` output with and without a bracket-root SDK line.
 */
export function dotnetDetectionResponses(options: IDotnetDetectionFixtureOptions): readonly IScriptedResponse[] {
	const listSdks = (result: IProcessExecutionResult): IScriptedResponse => ({ executable: options.executable, args: ['--list-sdks'], result });
	const listRuntimes = (result: IProcessExecutionResult): IScriptedResponse => ({ executable: options.executable, args: ['--list-runtimes'], result });
	const runtimeLine = `Microsoft.NETCore.App ${options.runtimeVersion ?? '10.0.11'} [/usr/share/dotnet/shared/Microsoft.NETCore.App]\n`;
	const spawnFailure: IProcessExecutionResult = { exitCode: 1, stdout: '', stderr: 'spawn ENOENT', failure: 'spawn' };
	const hostError: IProcessExecutionResult = { exitCode: 1, stdout: '', stderr: 'hostfxr: incompatible host' };
	switch (options.outcome) {
		case 'absence':
			return [listSdks(spawnFailure), listRuntimes(spawnFailure)];
		case 'runtimeOnly':
			return [listSdks(listResult('')), listRuntimes(listResult(runtimeLine))];
		case 'sdk': {
			const sdkRoot = options.sdkRoot ?? '/home/test/.walker/dotnet/sdk';
			return [listSdks(listResult(`${options.sdkVersion ?? '10.0.401'} [${sdkRoot}]\n`)), listRuntimes(listResult(runtimeLine))];
		}
		case 'error':
			return [listSdks(hostError), listRuntimes(hostError)];
	}
}

/**
 * Process adapter replaying one canonical detection outcome.
 */
export function createDotnetDetectionAdapter(options: IDotnetDetectionFixtureOptions): IScriptedProcessAdapter {
	return createScriptedProcessAdapter(dotnetDetectionResponses(options));
}

/**
 * File system adapter backed by in-memory maps; `links` resolves an existing path to its target.
 */
export interface IInMemoryFileSystem extends IFileSystemAdapter {
	addFile(filePath: string): void;
	addLink(linkPath: string, target: string): void;
}

function normalizePath(filePath: string): string {
	return path.posix.normalize(filePath.replace(/\\/g, '/'));
}

/**
 * Creates an in-memory file system so candidate fixtures never touch the real home directory.
 */
export function createInMemoryFileSystem(): IInMemoryFileSystem {
	const files = new Set<string>();
	const links = new Map<string, string>();
	return {
		addFile: filePath => { files.add(normalizePath(filePath)); },
		addLink: (linkPath, target) => { links.set(normalizePath(linkPath), target); },
		exists: async filePath => files.has(normalizePath(filePath)) || links.has(normalizePath(filePath)),
		realpath: async filePath => {
			const normalized = normalizePath(filePath);
			return links.get(normalized) ?? (files.has(normalized) ? normalized : undefined);
		},
	};
}

/**
 * UI facade that records plain-text output and errors without importing `vscode`.
 */
export interface IRecordingUi extends IToolchainUi {
	readonly output: readonly string[];
	readonly errors: readonly string[];
}

/**
 * Creates a recording UI facade for injected-core tests.
 */
export function createRecordingUi(): IRecordingUi {
	const output: string[] = [];
	const errors: string[] = [];
	return {
		output,
		errors,
		appendOutput: line => { output.push(line); },
		showError: message => { errors.push(message); },
	};
}

/**
 * Runs `body` against a fresh directory inside the OS temporary root and removes it afterwards, even
 * when the body throws. Tests that need real filesystem work must never write to a user home.
 */
export async function withTempDirectory<T>(prefix: string, body: (directory: string) => Promise<T> | T): Promise<T> {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
	try {
		return await body(directory);
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
}
