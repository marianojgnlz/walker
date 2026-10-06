/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'fs';
import path from 'path';
import cp from 'child_process';
const root = fs.realpathSync(path.dirname(path.dirname(import.meta.dirname)));

/** Filters installed dependency paths that npm identifies as extraneous, including their nested packages. */
export function filterExtraneousDependencies(dependencyPaths: string[], npmErrorOutput: string): string[] {
	const extraneousPaths = npmErrorOutput.split(/\r?\n/)
		.map(line => /^npm (?:ERR!|error) extraneous:\s+.+?\s+((?:[a-z]:)?[\\/].*)$/i.exec(line)?.[1])
		.filter((dependencyPath): dependencyPath is string => !!dependencyPath)
		.map(dependencyPath => path.resolve(dependencyPath));

	return dependencyPaths.filter(dependencyPath => {
		const resolvedDependencyPath = path.resolve(dependencyPath);
		return !extraneousPaths.some(extraneousPath => resolvedDependencyPath === extraneousPath || resolvedDependencyPath.startsWith(`${extraneousPath}${path.sep}`));
	});
}

function getNpmProductionDependencies(folder: string): string[] {
	let raw: string;
	let npmErrorOutput = '';

	try {
		raw = cp.execSync('npm ls --all --omit=dev --parseable', { cwd: folder, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' }, stdio: [null, null, null] });
	} catch (err) {
		const error = err as { message: string; stdout: string; stderr?: string | Buffer };
		npmErrorOutput = error.stderr?.toString() ?? error.message;
		const regex = /^npm ERR! .*$/gm;
		let match: RegExpExecArray | null;

		while (match = regex.exec(error.message)) {
			if (/ELSPROBLEMS/.test(match[0])) {
				continue;
			} else if (/extraneous:/.test(match[0])) {
				continue;
			} else if (/invalid: xterm/.test(match[0])) {
				continue;
			} else if (/A complete log of this run/.test(match[0])) {
				continue;
			} else {
				throw err;
			}
		}

		raw = error.stdout;
	}

	return filterExtraneousDependencies(raw.split(/\r?\n/).filter(line => {
		return !!line.trim() && path.relative(root, line) !== path.relative(root, folder);
	}), npmErrorOutput);
}

export function getProductionDependencies(folderPath: string): string[] {
	const result = getNpmProductionDependencies(folderPath);
	// Account for distro npm dependencies
	const realFolderPath = fs.realpathSync(folderPath);
	const relativeFolderPath = path.relative(root, realFolderPath);
	const distroFolderPath = `${root}/.build/distro/npm/${relativeFolderPath}`;

	if (fs.existsSync(distroFolderPath)) {
		result.push(...getNpmProductionDependencies(distroFolderPath));
	}

	return [...new Set(result)];
}

if (import.meta.main) {
	console.log(JSON.stringify(getProductionDependencies(root), null, '  '));
}
