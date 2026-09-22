/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';

/** Host allowed for immutable reviewed script retrieval; redirects to anywhere else are refused (D3). */
export const DOTNET_INSTALL_SCRIPT_HOST = 'raw.githubusercontent.com';

/**
 * Reviewed immutable revision of Microsoft's `dotnet/install-scripts` repository (provenance:
 * `README.md`). This constant is not trusted by itself: {@link validateDotnetInstallScriptPin}
 * re-checks the URL shape, commit, and digest before any download.
 */
export const DOTNET_INSTALL_SCRIPTS_COMMIT = 'e5cf1dd2d1540ed05ac84f8eb8c5cdec2807621e';

/** Which official installer script serves a local platform. */
export type DotnetInstallScriptKind = 'unix' | 'windows';

/** One reviewed immutable script origin and its calculated SHA-256 digest. */
export interface IDotnetInstallScriptPin {
	readonly kind: DotnetInstallScriptKind;
	/** Plain file name written inside the owned operation directory; never a path. */
	readonly fileName: string;
	/** Reviewed 40-hex commit of `dotnet/install-scripts`. */
	readonly commit: string;
	/** Immutable HTTPS URL on the reviewed commit. */
	readonly url: string;
	/** SHA-256 of the reviewed upstream bytes, calculated locally during review. */
	readonly sha256: string;
}

/** Stable reasons a pin is refused; the caller turns them into a redacted diagnostic. */
export type DotnetScriptPinRejection = 'malformed' | 'scheme' | 'userinfo' | 'host' | 'path' | 'commit' | 'digest';

/** Pin validation outcome; only `valid` may be downloaded. */
export type DotnetScriptPinValidation =
	| { readonly kind: 'valid' }
	| { readonly kind: 'invalid'; readonly rejection: DotnetScriptPinRejection; readonly diagnostic: string };

/** Exact immutable URL shape: commit-pinned raw script on the reviewed repository. */
const SCRIPT_PATH_PATTERN = /^\/dotnet\/install-scripts\/([0-9a-f]{40})\/src\/(dotnet-install\.sh|dotnet-install\.ps1)$/;

/**
 * Reviewed pins for both official scripts. Digests were calculated with `sha256sum` from the
 * immutable raw.githubusercontent.com URLs at {@link DOTNET_INSTALL_SCRIPTS_COMMIT} during the B2
 * audit; retrieval date and re-verification steps are documented in `README.md`.
 */
export const DOTNET_INSTALL_SCRIPT_PINS: Readonly<Record<DotnetInstallScriptKind, IDotnetInstallScriptPin>> = Object.freeze({
	unix: Object.freeze({
		kind: 'unix',
		fileName: 'dotnet-install.sh',
		commit: DOTNET_INSTALL_SCRIPTS_COMMIT,
		url: `https://${DOTNET_INSTALL_SCRIPT_HOST}/dotnet/install-scripts/${DOTNET_INSTALL_SCRIPTS_COMMIT}/src/dotnet-install.sh`,
		sha256: '082f7685e156738a1b2e2ed8381a621870d4ce8e8c59278034556f05c186eb2e',
	}),
	windows: Object.freeze({
		kind: 'windows',
		fileName: 'dotnet-install.ps1',
		commit: DOTNET_INSTALL_SCRIPTS_COMMIT,
		url: `https://${DOTNET_INSTALL_SCRIPT_HOST}/dotnet/install-scripts/${DOTNET_INSTALL_SCRIPTS_COMMIT}/src/dotnet-install.ps1`,
		sha256: '3bb07bc8025211836c1e4f9d3f6a044e55b1fb6eec518a6c78851d04e210442b',
	}),
});

/** Selects the official script kind for a local platform; Windows is the only `.ps1` host. */
export function dotnetInstallScriptKind(platform: NodeJS.Platform): DotnetInstallScriptKind {
	return platform === 'win32' ? 'windows' : 'unix';
}

/** Returns the reviewed pin for a local platform. */
export function dotnetInstallScriptPin(platform: NodeJS.Platform): IDotnetInstallScriptPin {
	return DOTNET_INSTALL_SCRIPT_PINS[dotnetInstallScriptKind(platform)];
}

/**
 * Re-validates one pin against the D3 trust policy before any request: lowercase immutable commit,
 * lowercase SHA-256, plain file name, and an HTTPS URL without userinfo on the exact
 * `raw.githubusercontent.com/dotnet/install-scripts/<commit>/src/<file>` path. A pin that fails any
 * check must never be downloaded.
 */
export function validateDotnetInstallScriptPin(pin: IDotnetInstallScriptPin): DotnetScriptPinValidation {
	const invalid = (rejection: DotnetScriptPinRejection, diagnostic: string): DotnetScriptPinValidation => ({ kind: 'invalid', rejection, diagnostic });
	if (pin.kind !== 'unix' && pin.kind !== 'windows') {
		return invalid('malformed', `unknown script kind ${String(pin.kind)}`);
	}
	if (!/^[0-9a-f]{40}$/.test(pin.commit)) {
		return invalid('commit', 'the pinned commit must be a lowercase 40-character SHA');
	}
	if (!/^[0-9a-f]{64}$/.test(pin.sha256)) {
		return invalid('digest', 'the pinned digest must be a lowercase 64-character SHA-256');
	}
	if (pin.fileName === '' || path.basename(pin.fileName) !== pin.fileName) {
		return invalid('path', 'the script file name must be a plain file name without directories');
	}
	let url: URL;
	try {
		url = new URL(pin.url);
	} catch {
		return invalid('malformed', 'the pinned URL is not a valid absolute URL');
	}
	if (url.protocol !== 'https:') {
		return invalid('scheme', `the pinned URL must use HTTPS, not ${url.protocol}`);
	}
	if (url.username !== '' || url.password !== '') {
		return invalid('userinfo', 'the pinned URL must not contain userinfo');
	}
	if (url.hostname !== DOTNET_INSTALL_SCRIPT_HOST) {
		return invalid('host', `the pinned URL host ${url.hostname} is not ${DOTNET_INSTALL_SCRIPT_HOST}`);
	}
	const match = SCRIPT_PATH_PATTERN.exec(url.pathname);
	if (match === null) {
		return invalid('path', 'the pinned URL must be an immutable install-scripts revision path');
	}
	if (match[1] !== pin.commit) {
		return invalid('path', `the URL revision ${match[1]} does not match the pinned commit`);
	}
	if (match[2] !== pin.fileName) {
		return invalid('path', `the URL file ${match[2]} does not match the pinned file name`);
	}
	return { kind: 'valid' };
}
