/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Feature-neutral build utility for the `@microsoft/mxc-sdk` payload used by the
 * terminal sandbox.
 *
 * This module must stay free of product/agent packaging concerns: it only
 * derives the packaging exclude globs that keep a single architecture's sandbox
 * binaries.
 */

const mxcArchitectures = ['x64', 'arm64'];

/**
 * Returns a glob filter that strips @microsoft/mxc-sdk `bin/<arch>` payload for
 * architectures other than the build target. `@microsoft/mxc-sdk` ships a full
 * set of sandbox binaries for every architecture under `bin/<arch>/`; only the
 * build target's architecture is needed. Architectures that mxc-sdk does not
 * ship (e.g. armhf) strip every `bin/<arch>` directory.
 */
export function getMxcExcludeFilter(arch: string): string[] {
	const target = mxcArchitectures.includes(arch) ? arch : undefined;
	const nonTargetArchitectures = mxcArchitectures.filter(a => a !== target);

	return [
		'**',
		...nonTargetArchitectures.map(a => `!**/node_modules/@microsoft/mxc-sdk/bin/${a}/**`),
	];
}
