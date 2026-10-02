/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { constants as fsConstants, promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { IEnvironmentAdapter } from './contracts';

/** Private operation-owned directory prepended only to an official shell-installer child PATH. */
export const DOTNET_DOWNLOADER_SHIM_DIRECTORY_NAME = 'downloader-bin';

/** Child-only absolute path to the original curl executable, captured before PATH is changed. */
export const DOTNET_REAL_CURL_ENVIRONMENT_VARIABLE = 'WALKER_DOTNET_REAL_CURL';

/** Child-only absolute path to the original wget executable, captured before PATH is changed. */
export const DOTNET_REAL_WGET_ENVIRONMENT_VARIABLE = 'WALKER_DOTNET_REAL_WGET';

/**
 * Static curl wrapper. Policy options come last so script arguments cannot widen the allowed
 * protocols; --disable also prevents user curlrc configuration from changing redirect policy.
 */
export const DOTNET_CURL_SHIM_CONTENT = `#!/bin/sh
exec "$WALKER_DOTNET_REAL_CURL" --disable "$@" --proto '=https' --proto-redir '=https'
`;

/** Static wget wrapper. --no-config and --https-only make redirects fail closed unless HTTPS. */
export const DOTNET_WGET_SHIM_CONTENT = `#!/bin/sh
exec "$WALKER_DOTNET_REAL_WGET" --no-config --https-only "$@"
`;

/** Filesystem capabilities used to resolve host downloaders and write private executable shims. */
export interface IDotnetDownloaderShimFileOperations {
	/** True only for an executable regular file. */
	isExecutable(filePath: string): Promise<boolean>;
	/** Resolved executable path, or undefined when it cannot be resolved. */
	realpath(filePath: string): Promise<string | undefined>;
	/** Creates the operation-owned shim directory exclusively with the requested mode. */
	mkdir(directory: string, mode: number): Promise<void>;
	/** Creates one executable file exclusively with the requested mode. */
	writeExecutableFile(filePath: string, content: string, mode: number): Promise<void>;
}

/** Captured secure process environment for the official shell installer. */
export interface IDotnetDownloaderShim {
	readonly directory: string;
	readonly environment: Readonly<Record<string, string>>;
}

/** Stable preparation failure; callers report it before executing the pinned script. */
export interface IDotnetDownloaderShimFailure {
	readonly code: 'missing-download-tool' | 'shim-create-failed';
	readonly diagnostic: string;
}

/** Shim preparation result; PowerShell uses its own transport and is not covered by these wrappers. */
export type DotnetDownloaderShimResult =
	| { readonly kind: 'prepared'; readonly shim: IDotnetDownloaderShim }
	| { readonly kind: 'not-applicable' }
	| { readonly kind: 'failed'; readonly failure: IDotnetDownloaderShimFailure };

/** Inputs to {@link prepareDotnetDownloaderShim}. */
export interface IPrepareDotnetDownloaderShimOptions {
	readonly operationDirectory: string;
	readonly environment: IEnvironmentAdapter;
	/** Optional filesystem seam for deterministic offline construction tests. */
	readonly fileOperations?: Partial<IDotnetDownloaderShimFileOperations>;
}

const defaultFileOperations: IDotnetDownloaderShimFileOperations = {
	isExecutable: async filePath => {
		try {
			if (!(await fs.stat(filePath)).isFile()) {
				return false;
			}
			await fs.access(filePath, fsConstants.X_OK);
			return true;
		} catch {
			return false;
		}
	},
	realpath: async filePath => {
		try {
			return await fs.realpath(filePath);
		} catch {
			return undefined;
		}
	},
	mkdir: async (directory, mode) => {
		await fs.mkdir(directory, { mode });
	},
	writeExecutableFile: async (filePath, content, mode) => {
		await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx', mode });
		await fs.chmod(filePath, mode);
	},
};

/** Finds the first absolute executable in the original local PATH without invoking a shell. */
async function findExecutable(name: 'curl' | 'wget', originalPath: string, fileOperations: IDotnetDownloaderShimFileOperations): Promise<string | undefined> {
	for (const directory of originalPath.split(path.posix.delimiter)) {
		if (!path.posix.isAbsolute(directory)) {
			continue;
		}
		const candidate = path.posix.join(directory, name);
		if (!(await fileOperations.isExecutable(candidate))) {
			continue;
		}
		const resolved = await fileOperations.realpath(candidate);
		if (resolved !== undefined && path.posix.isAbsolute(resolved)) {
			// Preserve the original command name (including symlinks such as /usr/bin/curl) in argv[0].
			return candidate;
		}
	}
	return undefined;
}

/**
 * Prepares HTTPS-only curl/wget wrappers inside the already-owned install operation directory.
 * The wrappers are only exposed through the child environment, leave the parent PATH unchanged,
 * and use fixed script contents plus quoted executable-path environment values (never interpolation).
 * Windows PowerShell uses HttpClient directly and does not pass through these wrappers.
 */
export async function prepareDotnetDownloaderShim(options: IPrepareDotnetDownloaderShimOptions): Promise<DotnetDownloaderShimResult> {
	const { operationDirectory, environment } = options;
	if (environment.platform === 'win32') {
		return { kind: 'not-applicable' };
	}
	if (!path.posix.isAbsolute(operationDirectory)) {
		return { kind: 'failed', failure: { code: 'shim-create-failed', diagnostic: 'the owned downloader shim directory must be absolute' } };
	}

	const fileOperations: IDotnetDownloaderShimFileOperations = { ...defaultFileOperations, ...options.fileOperations };
	const [curl, wget] = await Promise.all([
		findExecutable('curl', environment.path, fileOperations),
		findExecutable('wget', environment.path, fileOperations),
	]);
	if (curl === undefined && wget === undefined) {
		return { kind: 'failed', failure: { code: 'missing-download-tool', diagnostic: 'neither curl nor wget is available in an absolute local PATH directory' } };
	}

	const directory = path.posix.join(operationDirectory, DOTNET_DOWNLOADER_SHIM_DIRECTORY_NAME);
	const wrappers = [
		...(curl === undefined ? [] : [{ name: 'curl', executable: curl, content: DOTNET_CURL_SHIM_CONTENT, environmentVariable: DOTNET_REAL_CURL_ENVIRONMENT_VARIABLE }]),
		...(wget === undefined ? [] : [{ name: 'wget', executable: wget, content: DOTNET_WGET_SHIM_CONTENT, environmentVariable: DOTNET_REAL_WGET_ENVIRONMENT_VARIABLE }]),
	];
	try {
		await fileOperations.mkdir(directory, 0o700);
		for (const wrapper of wrappers) {
			await fileOperations.writeExecutableFile(path.posix.join(directory, wrapper.name), wrapper.content, 0o700);
		}
	} catch {
		return { kind: 'failed', failure: { code: 'shim-create-failed', diagnostic: 'the HTTPS-only downloader shim could not be created in the owned operation directory' } };
	}

	const childPath = environment.path.length === 0 ? directory : `${directory}${path.posix.delimiter}${environment.path}`;
	return {
		kind: 'prepared',
		shim: {
			directory,
			environment: {
				PATH: childPath,
				...(curl === undefined ? {} : { [DOTNET_REAL_CURL_ENVIRONMENT_VARIABLE]: curl }),
				...(wget === undefined ? {} : { [DOTNET_REAL_WGET_ENVIRONMENT_VARIABLE]: wget }),
			},
		},
	};
}
