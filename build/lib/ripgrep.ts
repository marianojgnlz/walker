/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Feature-neutral build utility for the `@vscode/ripgrep-universal` payload
 * that backs ordinary file Search.
 *
 * This module must stay free of product/agent packaging concerns: it only maps
 * VS Code build platform/arch values to the runtime `${platform}-${arch}`
 * directory names the package ships and derives the packaging exclude globs for
 * that mapping.
 */

/**
 * The platform-arch directories shipped by @vscode/ripgrep-universal.
 * These follow Node's `${process.platform}-${process.arch}` naming.
 * Alpine builds reuse the regular `linux-*` binaries (ripgrep is statically
 * linked enough to run on both glibc and musl).
 */
const ripgrepUniversalPlatforms = [
	'darwin-arm64', 'darwin-x64',
	'linux-arm', 'linux-arm64', 'linux-ia32', 'linux-x64',
	'linux-ppc64', 'linux-riscv64', 'linux-s390x',
	'win32-arm64', 'win32-ia32', 'win32-x64',
];

/**
 * Converts VS Code build platform/arch to the values that Node.js reports
 * at runtime via `process.platform` and `process.arch`.
 *
 * Built native payloads are looked up under `prebuilds/${process.platform}-${process.arch}/`
 * style directories, so the directory names must match the runtime values exactly.
 */
export function toNodePlatformArch(platform: string, arch: string): { nodePlatform: string; nodeArch: string } {
	// alpine is musl-linux; Node still reports process.platform === 'linux'
	let nodePlatform = platform === 'alpine' ? 'linux' : platform;
	let nodeArch = arch;

	if (arch === 'armhf') {
		// VS Code build uses 'armhf'; Node reports process.arch === 'arm'
		nodeArch = 'arm';
	} else if (arch === 'alpine') {
		// Legacy: { platform: 'linux', arch: 'alpine' } means alpine-x64
		nodePlatform = 'linux';
		nodeArch = 'x64';
	}

	return { nodePlatform, nodeArch };
}

/**
 * Returns a glob filter that strips @vscode/ripgrep-universal bin directories
 * for architectures other than the build target.
 */
export function getRipgrepExcludeFilter(platform: string, arch: string): string[] {
	const { nodePlatform, nodeArch } = toNodePlatformArch(platform, arch);
	const target = `${nodePlatform}-${nodeArch}`;
	const nonTargetPlatforms = ripgrepUniversalPlatforms.filter(p => p !== target);

	const excludes = nonTargetPlatforms.map(p => `!**/node_modules/@vscode/ripgrep-universal/bin/${p}/**`);

	return ['**', ...excludes];
}
