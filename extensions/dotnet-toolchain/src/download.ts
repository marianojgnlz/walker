/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import * as tls from 'node:tls';
import { isAbsolutePath } from './candidates';
import { validateDotnetInstallScriptPin, type IDotnetInstallScriptPin } from './scriptSource';
import { parseSdkVersionInput } from './selection';

/** Maximum accepted size of the official installer script (D3: 1 MiB). */
export const MAX_SCRIPT_BYTES = 1024 * 1024;

/** Download budget for the script retrieval (D3: 60 seconds). */
export const SCRIPT_DOWNLOAD_TIMEOUT_MS = 60_000;

/** Mode of the exclusively written verified script; owner read/write only (D3). */
export const SCRIPT_FILE_MODE = 0o600;

/** Stable failure codes surfaced through the `download` failure stage. */
export type DotnetDownloadFailureCode =
	| 'invalid-pin'
	| 'unsupported-proxy'
	| 'redirect'
	| 'http-status'
	| 'too-large'
	| 'tls'
	| 'offline'
	| 'timeout'
	| 'transport'
	| 'hash-mismatch'
	| 'write-failed';

/** One actionable download failure; `diagnostic` is plain bounded text without credentials. */
export interface IDotnetDownloadFailure {
	readonly stage: 'download';
	readonly code: DotnetDownloadFailureCode;
	readonly diagnostic: string;
}

/** Download outcome; only `downloaded` carries a script path eligible for execution. */
export type DotnetScriptDownloadResult =
	| { readonly kind: 'downloaded'; readonly scriptPath: string; readonly sha256: string; readonly bytes: number }
	| { readonly kind: 'canceled' }
	| { readonly kind: 'failed'; readonly failure: IDotnetDownloadFailure };

/**
 * Raw user/machine proxy policy. The extension layer reads only user/machine configuration into
 * this shape; workspace-provided install settings are never an input (D3).
 */
export type DotnetProxySetting =
	| { readonly kind: 'none' }
	| { readonly kind: 'url'; readonly value: string }
	| { readonly kind: 'pac'; readonly value: string };

/** Stable reasons a proxy policy cannot be used. */
export type DotnetProxyUnsupportedReason = 'pac' | 'credentials' | 'scheme' | 'malformed';

/** One resolved HTTP CONNECT proxy target without credentials. */
export interface IDotnetProxyTarget {
	readonly host: string;
	readonly port: number;
	/** True when the proxy endpoint itself is reached over TLS. */
	readonly secure: boolean;
	/** Normalized credential-free proxy URL, safe for diagnostics and child environments. */
	readonly url: string;
}

/** Proxy resolution outcome; `unsupported` must fail before any network request. */
export type DotnetProxyResolution =
	| { readonly kind: 'direct' }
	| { readonly kind: 'proxy'; readonly target: IDotnetProxyTarget }
	| { readonly kind: 'unsupported'; readonly reason: DotnetProxyUnsupportedReason; readonly diagnostic: string };

/** Injected HTTP boundary; the default implementation is the node `https`/CONNECT transport. */
export interface IDotnetScriptHttpRequest {
	readonly url: string;
	readonly timeoutMs: number;
	readonly signal: AbortSignal;
	/** Present only for a supported explicit proxy; otherwise the request is direct. */
	readonly proxy?: IDotnetProxyTarget;
}

/** Response head plus a streamed body, so the byte cap can abort an oversized transfer. */
export interface IDotnetScriptHttpResponse {
	readonly statusCode: number;
	readonly headers: Readonly<Record<string, string | undefined>>;
	readonly body: AsyncIterable<Buffer>;
}

/** Injected transport; tests replay responses without touching the network. */
export interface IDotnetScriptTransport {
	get(request: IDotnetScriptHttpRequest): Promise<IDotnetScriptHttpResponse>;
}

/** Timer boundary so the download budget never depends on real time in tests. */
export interface IDotnetDownloadClock {
	setTimeout(callback: () => void, timeoutMs: number): unknown;
	clearTimeout(handle: unknown): void;
}

/** Exclusive private writer for the verified script. */
export interface IDotnetScriptFileWriter {
	/** Creates `filePath` exclusively with owner-only permissions; existing files are never overwritten. */
	writePrivateFile(filePath: string, data: Buffer): Promise<void>;
}

/** Inputs for {@link downloadDotnetInstallScript}; the caller owns the operation directory (D4). */
export interface IDotnetScriptDownloadOptions {
	readonly pin: IDotnetInstallScriptPin;
	/** Absolute owned operation directory that receives the verified script. */
	readonly operationDirectory: string;
	readonly transport: IDotnetScriptTransport;
	readonly fileWriter: IDotnetScriptFileWriter;
	readonly proxy?: DotnetProxyResolution;
	readonly signal?: AbortSignal;
	readonly timeoutMs?: number;
	readonly clock?: IDotnetDownloadClock;
}

/** Stable reasons a channel dry-run cannot resolve an unambiguous version (D2). */
export type DotnetDryRunUnresolvedReason = 'missing-repeatable-invocation' | 'missing-version' | 'invalid-version' | 'conflicting-version';

/** Channel dry-run metadata outcome; dry-run output is version data only, never a URL to fetch. */
export type DotnetDryRunMetadataResult =
	| { readonly kind: 'resolved'; readonly version: string }
	| { readonly kind: 'unresolved'; readonly reason: DotnetDryRunUnresolvedReason };

const SCRIPT_REQUEST_HEADERS: Readonly<Record<string, string>> = Object.freeze({ accept: 'text/plain', 'user-agent': 'walker-dotnet-toolchain' });

const TLS_FAILURE_CODES: ReadonlySet<string> = new Set([
	'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
	'CERT_HAS_EXPIRED',
	'DEPTH_ZERO_SELF_SIGNED_CERT',
	'SELF_SIGNED_CERT_IN_CHAIN',
	'CERT_UNTRUSTED',
	'ERR_TLS_CERT_ALTNAME_INVALID',
	'ERR_SSL_WRONG_VERSION_NUMBER',
]);

const OFFLINE_FAILURE_CODES: ReadonlySet<string> = new Set([
	'ECONNREFUSED',
	'ECONNRESET',
	'ENOTFOUND',
	'EAI_AGAIN',
	'ENETUNREACH',
	'EHOSTUNREACH',
	'EPIPE',
]);

const TIMEOUT_FAILURE_CODES: ReadonlySet<string> = new Set(['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

const realDownloadClock: IDotnetDownloadClock = {
	setTimeout: (callback, timeoutMs) => setTimeout(callback, timeoutMs),
	clearTimeout: handle => clearTimeout(handle as NodeJS.Timeout),
};

function failed(code: DotnetDownloadFailureCode, diagnostic: string): DotnetScriptDownloadResult {
	return { kind: 'failed', failure: { stage: 'download', code, diagnostic: boundDiagnostic(diagnostic) } };
}

/** Bounds one diagnostic line so output never grows with an untrusted error message. */
function boundDiagnostic(text: string): string {
	const single = text.replace(/\s+/g, ' ').trim();
	return single.length > 300 ? `${single.slice(0, 300)}…` : single;
}

/** Strips URL userinfo and bounds an error message for safe display. */
function errorDiagnostic(error: unknown): string {
	return boundDiagnostic(redactDotnetProxyUrl(error instanceof Error ? error.message : String(error)));
}

function errorCode(error: unknown): string | undefined {
	if (typeof error === 'object' && error !== null && 'code' in error) {
		const code = (error as { readonly code?: unknown }).code;
		return typeof code === 'string' ? code : undefined;
	}
	return undefined;
}

function classifyTransportFailure(error: unknown): DotnetDownloadFailureCode {
	const code = errorCode(error);
	if (code !== undefined && TLS_FAILURE_CODES.has(code)) {
		return 'tls';
	}
	if (code !== undefined && TIMEOUT_FAILURE_CODES.has(code)) {
		return 'timeout';
	}
	if (code !== undefined && OFFLINE_FAILURE_CODES.has(code)) {
		return 'offline';
	}
	return error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'transport';
}

/**
 * Removes userinfo from any URL in a diagnostic. Credentials must never reach output, and this is
 * the single redaction seam used for proxy settings and transport error text.
 */
export function redactDotnetProxyUrl(value: string): string {
	return value.replace(/\/\/[^/@\s]*@/g, '//');
}

/**
 * Resolves one user/machine proxy setting. Only credential-free `http://` and `https://` proxy
 * endpoints are supported; PAC and authenticated configurations return an explicit unsupported
 * diagnostic with retry advice instead of silently bypassing the proxy.
 */
export function resolveDotnetProxy(setting: DotnetProxySetting): DotnetProxyResolution {
	if (setting.kind === 'none') {
		return { kind: 'direct' };
	}
	if (setting.kind === 'pac') {
		return { kind: 'unsupported', reason: 'pac', diagnostic: 'automatic proxy configuration (PAC) is not supported; configure an explicit proxy URL or connect directly and retry' };
	}
	const raw = setting.value.trim();
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return { kind: 'unsupported', reason: 'malformed', diagnostic: `the configured proxy ${redactDotnetProxyUrl(raw)} is not a valid URL; correct the proxy setting or connect directly and retry` };
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return { kind: 'unsupported', reason: 'scheme', diagnostic: `the configured proxy scheme ${url.protocol} is not supported; use http:// or https:// or connect directly` };
	}
	if (url.username !== '' || url.password !== '') {
		return { kind: 'unsupported', reason: 'credentials', diagnostic: `authenticated proxies are not supported; remove the credentials from ${redactDotnetProxyUrl(url.href)} or use an unauthenticated proxy` };
	}
	if (url.hostname === '') {
		return { kind: 'unsupported', reason: 'malformed', diagnostic: 'the configured proxy has no host; correct the proxy setting or connect directly and retry' };
	}
	const port = url.port === '' ? (url.protocol === 'https:' ? 443 : 80) : Number(url.port);
	return { kind: 'proxy', target: { host: url.hostname, port, secure: url.protocol === 'https:', url: `${url.protocol}//${url.hostname}:${port}` } };
}

/** Shell environment for the pinned `.sh` script's curl/wget retrieval; empty for direct access. */
export function dotnetProxyEnvironment(resolution: DotnetProxyResolution): Readonly<Record<string, string>> {
	if (resolution.kind !== 'proxy') {
		return {};
	}
	const url = resolution.target.url;
	return { HTTP_PROXY: url, HTTPS_PROXY: url, http_proxy: url, https_proxy: url };
}

/** Vetted PowerShell options for the pinned `.ps1` script; default credentials are never delegated. */
export function dotnetProxyPowerShellArguments(resolution: DotnetProxyResolution): readonly string[] {
	return resolution.kind === 'proxy' ? ['-ProxyAddress', resolution.target.url] : [];
}

/** Node's `https` transport with zero redirects and an optional unauthenticated CONNECT tunnel. */
function responseHead(response: http.IncomingMessage): IDotnetScriptHttpResponse {
	const headers: Record<string, string | undefined> = {};
	for (const [name, value] of Object.entries(response.headers)) {
		headers[name] = Array.isArray(value) ? value[0] : value;
	}
	return { statusCode: response.statusCode ?? 0, headers, body: response };
}

function requestTimedOut(timeoutMs: number): Error {
	return Object.assign(new Error(`the script request timed out after ${timeoutMs} ms`), { code: 'ETIMEDOUT' });
}

function directRequest(request: IDotnetScriptHttpRequest): Promise<IDotnetScriptHttpResponse> {
	return new Promise((resolve, reject) => {
		const outgoing = https.get(request.url, { agent: false, headers: SCRIPT_REQUEST_HEADERS, signal: request.signal, timeout: request.timeoutMs }, response => resolve(responseHead(response)));
		outgoing.on('error', reject);
		outgoing.on('timeout', () => outgoing.destroy(requestTimedOut(request.timeoutMs)));
	});
}

function proxyTunnelRequest(request: IDotnetScriptHttpRequest, proxy: IDotnetProxyTarget): Promise<IDotnetScriptHttpResponse> {
	const target = new URL(request.url);
	const port = target.port === '' ? 443 : Number(target.port);
	const authority = `${target.hostname}:${port}`;
	return new Promise((resolve, reject) => {
		let settled = false;
		const fail = (error: Error): void => {
			if (!settled) {
				settled = true;
				reject(error);
			}
		};
		const connectModule = proxy.secure ? https : http;
		const connectRequest = connectModule.request({ host: proxy.host, port: proxy.port, method: 'CONNECT', path: authority, headers: { host: authority }, signal: request.signal, timeout: request.timeoutMs });
		connectRequest.on('error', fail);
		connectRequest.on('timeout', () => connectRequest.destroy(requestTimedOut(request.timeoutMs)));
		connectRequest.on('connect', (response, socket) => {
			if (response.statusCode !== 200) {
				socket.destroy();
				fail(Object.assign(new Error(`the configured proxy refused the CONNECT tunnel with HTTP ${response.statusCode}`), { code: 'EPROXY' }));
				return;
			}
			const secureSocket = tls.connect({ socket, servername: target.hostname }, () => {
				const outgoing = https.get(target, { agent: false, createConnection: () => secureSocket, headers: SCRIPT_REQUEST_HEADERS, signal: request.signal, timeout: request.timeoutMs }, tunneled => {
					settled = true;
					resolve(responseHead(tunneled));
				});
				outgoing.on('error', fail);
				outgoing.on('timeout', () => outgoing.destroy(requestTimedOut(request.timeoutMs)));
			});
			secureSocket.on('error', fail);
		});
		connectRequest.end();
	});
}

/** Creates the default transport: HTTPS-only, redirects surface as a 3xx status, proxies via CONNECT. */
export function createNodeScriptTransport(): IDotnetScriptTransport {
	return {
		get: request => request.proxy === undefined ? directRequest(request) : proxyTunnelRequest(request, request.proxy),
	};
}

/** Creates the default exclusive writer: mode-0600 create with `wx`, never overwriting a file. */
export function createNodeScriptFileWriter(): IDotnetScriptFileWriter {
	return {
		writePrivateFile: async (filePath, data) => {
			await fs.writeFile(filePath, data, { flag: 'wx', mode: SCRIPT_FILE_MODE });
		},
	};
}

type BodyCollection =
	| { readonly kind: 'body'; readonly bytes: Buffer }
	| { readonly kind: 'canceled' }
	| { readonly kind: 'timeout' }
	| { readonly kind: 'too-large' }
	| { readonly kind: 'failed'; readonly error: unknown };

/** Streams at most {@link MAX_SCRIPT_BYTES}, aborting the transfer as soon as limits are exceeded. */
async function collectBoundedBody(body: AsyncIterable<Buffer>, isCanceled: () => boolean, isTimedOut: () => boolean, abort: () => void): Promise<BodyCollection> {
	const chunks: Buffer[] = [];
	let length = 0;
	try {
		for await (const chunk of body) {
			if (isCanceled()) {
				abort();
				return { kind: 'canceled' };
			}
			if (isTimedOut()) {
				abort();
				return { kind: 'timeout' };
			}
			length += chunk.length;
			if (length > MAX_SCRIPT_BYTES) {
				abort();
				return { kind: 'too-large' };
			}
			chunks.push(chunk);
		}
	} catch (error) {
		if (isCanceled()) {
			return { kind: 'canceled' };
		}
		return isTimedOut() ? { kind: 'timeout' } : { kind: 'failed', error };
	}
	if (isCanceled()) {
		return { kind: 'canceled' };
	}
	return isTimedOut() ? { kind: 'timeout' } : { kind: 'body', bytes: Buffer.concat(chunks, length) };
}

function declaredLength(headers: Readonly<Record<string, string | undefined>>): number | undefined {
	const raw = headers['content-length'];
	if (raw === undefined) {
		return undefined;
	}
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function scriptPathFor(pin: IDotnetInstallScriptPin, operationDirectory: string): string {
	return (pin.kind === 'windows' ? path.win32 : path.posix).join(operationDirectory, pin.fileName);
}

/**
 * Retrieves one pinned official script: validates the trust policy, performs a bounded HTTPS
 * request with zero redirects, hashes the bytes, and only then writes an exclusive private file in
 * the caller-owned operation directory. Cancellation, offline, TLS, redirect, size, digest, and
 * write failures resolve as stable failures; only a `downloaded` result carries a script path, so
 * unvalidated bytes can never reach execution.
 */
export async function downloadDotnetInstallScript(options: IDotnetScriptDownloadOptions): Promise<DotnetScriptDownloadResult> {
	const { pin, operationDirectory, transport, fileWriter } = options;
	const pinValidation = validateDotnetInstallScriptPin(pin);
	if (pinValidation.kind === 'invalid') {
		return failed('invalid-pin', `refusing the pinned script source (${pinValidation.rejection}): ${pinValidation.diagnostic}`);
	}
	const platform: NodeJS.Platform = pin.kind === 'windows' ? 'win32' : 'linux';
	if (!isAbsolutePath(operationDirectory, platform)) {
		return failed('invalid-pin', 'the owned operation directory must be an absolute path');
	}
	const proxy = options.proxy ?? { kind: 'direct' };
	if (proxy.kind === 'unsupported') {
		return failed('unsupported-proxy', proxy.diagnostic);
	}
	const signal = options.signal;
	if (signal?.aborted) {
		return { kind: 'canceled' };
	}

	const timeoutMs = options.timeoutMs !== undefined && options.timeoutMs > 0 ? options.timeoutMs : SCRIPT_DOWNLOAD_TIMEOUT_MS;
	const clock = options.clock ?? realDownloadClock;
	const controller = new AbortController();
	const forwardAbort = (): void => controller.abort();
	signal?.addEventListener('abort', forwardAbort, { once: true });
	let timedOut = false;
	const timer = clock.setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);
	const isCanceled = (): boolean => signal?.aborted === true;
	const isTimedOut = (): boolean => timedOut;

	try {
		let response: IDotnetScriptHttpResponse;
		try {
			response = await transport.get({ url: pin.url, timeoutMs, signal: controller.signal, ...(proxy.kind === 'proxy' ? { proxy: proxy.target } : {}) });
		} catch (error) {
			if (isCanceled()) {
				return { kind: 'canceled' };
			}
			return isTimedOut() ? failed('timeout', `the script download did not finish within ${timeoutMs} ms`) : failed(classifyTransportFailure(error), errorDiagnostic(error));
		}
		if (response.statusCode !== 200) {
			controller.abort();
			return response.statusCode >= 300 && response.statusCode < 400
				? failed('redirect', `the script request was redirected (HTTP ${response.statusCode}); redirects are refused for reviewed immutable URLs`)
				: failed('http-status', `the script request failed with HTTP ${response.statusCode}`);
		}
		const length = declaredLength(response.headers);
		if (length !== undefined && length > MAX_SCRIPT_BYTES) {
			controller.abort();
			return failed('too-large', `the script response declares ${length} bytes, above the ${MAX_SCRIPT_BYTES}-byte limit`);
		}

		const collected = await collectBoundedBody(response.body, isCanceled, isTimedOut, () => controller.abort());
		if (collected.kind === 'canceled') {
			return { kind: 'canceled' };
		}
		if (collected.kind === 'timeout') {
			return failed('timeout', `the script download did not finish within ${timeoutMs} ms`);
		}
		if (collected.kind === 'too-large') {
			return failed('too-large', `the script response exceeds the ${MAX_SCRIPT_BYTES}-byte limit`);
		}
		if (collected.kind === 'failed') {
			return failed(classifyTransportFailure(collected.error), errorDiagnostic(collected.error));
		}

		const digest = createHash('sha256').update(collected.bytes).digest('hex');
		if (digest !== pin.sha256) {
			return failed('hash-mismatch', `the downloaded script digest ${digest} does not match the reviewed digest ${pin.sha256}`);
		}
		if (isCanceled()) {
			return { kind: 'canceled' };
		}
		const scriptPath = scriptPathFor(pin, operationDirectory);
		try {
			await fileWriter.writePrivateFile(scriptPath, collected.bytes);
		} catch (error) {
			return failed('write-failed', `the verified script could not be written to the owned operation directory: ${errorDiagnostic(error)}`);
		}
		return { kind: 'downloaded', scriptPath, sha256: digest, bytes: collected.bytes.length };
	} finally {
		clock.clearTimeout(timer);
		signal?.removeEventListener('abort', forwardAbort);
	}
}

const DRY_RUN_VERSION_PATTERN = /(?:--|-)[Vv]ersion\s+"([^"]*)"/;
const DRY_RUN_EFFECTIVE_VERSION_PATTERN = /would actually install with version '([^']*)'/;

/**
 * Parses the pinned script's channel dry-run output into the resolved version only. Both official
 * scripts print a `Repeatable invocation:` line whose `--version`/`-Version` value is the resolved
 * stable version; a PowerShell effective-version note must agree. Payload URLs in the output are
 * ignored as data, and any missing, malformed, prerelease, or conflicting version stays unresolved
 * so setup fails safely instead of installing an unrelated SDK (D2).
 */
export function parseDotnetInstallDryRunOutput(output: string): DotnetDryRunMetadataResult {
	const unresolved = (reason: DotnetDryRunUnresolvedReason): DotnetDryRunMetadataResult => ({ kind: 'unresolved', reason });
	const versions = new Set<string>();
	let sawInvocation = false;
	for (const line of output.split(/\r?\n/)) {
		if (!line.includes('Repeatable invocation:')) {
			continue;
		}
		sawInvocation = true;
		const match = DRY_RUN_VERSION_PATTERN.exec(line);
		if (match === null) {
			return unresolved('missing-version');
		}
		const parsed = parseSdkVersionInput(match[1]);
		if (parsed.kind !== 'valid') {
			return unresolved('invalid-version');
		}
		versions.add(parsed.version);
	}
	if (!sawInvocation) {
		return unresolved('missing-repeatable-invocation');
	}
	const effective = DRY_RUN_EFFECTIVE_VERSION_PATTERN.exec(output);
	if (effective !== null) {
		const parsed = parseSdkVersionInput(effective[1]);
		if (parsed.kind !== 'valid') {
			return unresolved('invalid-version');
		}
		versions.add(parsed.version);
	}
	if (versions.size > 1) {
		return unresolved('conflicting-version');
	}
	return { kind: 'resolved', version: [...versions][0] };
}
