/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
	MAX_SCRIPT_BYTES,
	SCRIPT_DOWNLOAD_TIMEOUT_MS,
	createNodeScriptFileWriter,
	dotnetProxyEnvironment,
	dotnetProxyPowerShellArguments,
	downloadDotnetInstallScript,
	parseDotnetInstallDryRunOutput,
	redactDotnetProxyUrl,
	resolveDotnetProxy,
	type DotnetProxySetting,
	type IDotnetDownloadClock,
	type IDotnetScriptDownloadOptions,
	type IDotnetScriptFileWriter,
	type IDotnetScriptHttpRequest,
	type IDotnetScriptHttpResponse,
	type IDotnetScriptTransport,
} from '../download';
import { DOTNET_INSTALL_SCRIPTS_COMMIT, DOTNET_INSTALL_SCRIPT_PINS, type IDotnetInstallScriptPin } from '../scriptSource';
import { withTempDirectory } from './fixtures';

const SCRIPT_BODY = Buffer.from('#!/usr/bin/env bash\necho reviewed-script\n', 'utf8');
const SCRIPT_SHA256 = createHash('sha256').update(SCRIPT_BODY).digest('hex');
const OPERATION_DIRECTORY = '/home/test/.walker/dotnet-install-fixture';
const PROXY_TARGET = { host: 'proxy.local', port: 3128, secure: false, url: 'http://proxy.local:3128' };

function fixturePin(overrides: Partial<IDotnetInstallScriptPin> = {}): IDotnetInstallScriptPin {
	return { ...DOTNET_INSTALL_SCRIPT_PINS.unix, sha256: SCRIPT_SHA256, ...overrides };
}

interface IRecordingTransport extends IDotnetScriptTransport {
	readonly requests: IDotnetScriptHttpRequest[];
}

type TransportResponder = (request: IDotnetScriptHttpRequest) => Promise<IDotnetScriptHttpResponse>;

function createRecordingTransport(responder: TransportResponder): IRecordingTransport {
	const requests: IDotnetScriptHttpRequest[] = [];
	return {
		requests,
		get: async request => {
			requests.push(request);
			return await responder(request);
		},
	};
}

/** Rejects exactly like the composed abort signal would reject an in-flight node request. */
function createAbortableFailureTransport(): IRecordingTransport {
	return createRecordingTransport(request => new Promise<IDotnetScriptHttpResponse>((_resolve, reject) => {
		request.signal.addEventListener('abort', () => reject(Object.assign(new Error('simulated abort'), { code: 'ABORT_ERR' })), { once: true });
	}));
}

function bodyOf(chunks: readonly Buffer[]): AsyncIterable<Buffer> {
	return {
		async *[Symbol.asyncIterator]() {
			for (const chunk of chunks) {
				yield chunk;
			}
		},
	};
}

function responseWith(chunks: readonly Buffer[], statusCode: number = 200, headers: Record<string, string | undefined> = {}): IDotnetScriptHttpResponse {
	return { statusCode, headers, body: bodyOf(chunks) };
}

interface IRecordingWriter extends IDotnetScriptFileWriter {
	readonly writes: readonly { readonly filePath: string; readonly data: Buffer }[];
}

function createRecordingWriter(): IRecordingWriter {
	const writes: { filePath: string; data: Buffer }[] = [];
	return {
		writes,
		writePrivateFile: async (filePath, data) => { writes.push({ filePath, data }); },
	};
}

interface IRecordingClock extends IDotnetDownloadClock {
	readonly timeouts: readonly { readonly timeoutMs: number; readonly callback: () => void }[];
	fire(): void;
	clearCount(): number;
}

function createRecordingClock(): IRecordingClock {
	const timeouts: { timeoutMs: number; callback: () => void }[] = [];
	let clears = 0;
	return {
		timeouts,
		setTimeout: (callback, timeoutMs) => { timeouts.push({ timeoutMs, callback }); return timeouts.length; },
		clearTimeout: () => { clears++; },
		fire: () => { for (const entry of timeouts.splice(0)) entry.callback(); },
		clearCount: () => clears,
	};
}

function tick(): Promise<void> {
	return new Promise<void>(resolve => setImmediate(resolve));
}

function downloadOptions(overrides: Partial<IDotnetScriptDownloadOptions> & { readonly transport: IDotnetScriptTransport }): IDotnetScriptDownloadOptions {
	return { pin: fixturePin(), operationDirectory: OPERATION_DIRECTORY, fileWriter: createRecordingWriter(), ...overrides };
}

function assertFailureResult(result: { readonly kind: string; readonly failure?: { readonly stage: string; readonly code: string; readonly diagnostic: string } }, code: string): void {
	assert.strictEqual(result.kind, 'failed', `expected a ${code} failure`);
	if (result.kind === 'failed' && result.failure !== undefined) {
		assert.strictEqual(result.failure.code, code);
		assert.strictEqual(result.failure.stage, 'download');
		assert.ok(result.failure.diagnostic.length > 0, 'a failure must carry a diagnostic');
	}
}

async function expectFailure(options: IDotnetScriptDownloadOptions, code: string): Promise<void> {
	assertFailureResult(await downloadDotnetInstallScript(options), code);
}

suite('trusted script download policy', () => {
	test('downloads, validates, and writes only the reviewed script bytes', async () => {
		const writer = createRecordingWriter();
		const transport = createRecordingTransport(async () => responseWith([SCRIPT_BODY]));
		const result = await downloadDotnetInstallScript(downloadOptions({ transport, fileWriter: writer }));

		assert.strictEqual(result.kind, 'downloaded');
		if (result.kind === 'downloaded') {
			assert.strictEqual(result.scriptPath, `${OPERATION_DIRECTORY}/dotnet-install.sh`);
			assert.strictEqual(result.sha256, SCRIPT_SHA256);
			assert.strictEqual(result.bytes, SCRIPT_BODY.length);
		}
		assert.strictEqual(writer.writes.length, 1);
		assert.strictEqual(writer.writes[0].filePath, `${OPERATION_DIRECTORY}/dotnet-install.sh`);
		assert.deepStrictEqual(writer.writes[0].data, SCRIPT_BODY);
		assert.strictEqual(transport.requests.length, 1);
		assert.strictEqual(transport.requests[0].url, DOTNET_INSTALL_SCRIPT_PINS.unix.url);
		assert.strictEqual(transport.requests[0].timeoutMs, SCRIPT_DOWNLOAD_TIMEOUT_MS);
		assert.strictEqual(transport.requests[0].proxy, undefined);
	});

	test('never writes or returns a script path when the digest does not match the pin', async () => {
		const writer = createRecordingWriter();
		const transport = createRecordingTransport(async () => responseWith([SCRIPT_BODY]));
		const result = await downloadDotnetInstallScript(downloadOptions({ transport, fileWriter: writer, pin: fixturePin({ sha256: 'a'.repeat(64) }) }));

		assertFailureResult(result, 'hash-mismatch');
		assert.strictEqual(writer.writes.length, 0);
		assert.ok(!('scriptPath' in result), 'a failed digest must never expose a script path');
	});

	test('refuses redirects instead of following the immutable URL', async () => {
		for (const statusCode of [301, 302, 307, 308]) {
			const writer = createRecordingWriter();
			const transport = createRecordingTransport(async () => responseWith([], statusCode, { location: 'https://evil.example.com/dotnet-install.sh' }));
			await expectFailure(downloadOptions({ transport, fileWriter: writer }), 'redirect');
			assert.strictEqual(writer.writes.length, 0, `HTTP ${statusCode} must not write a script`);
			assert.strictEqual(transport.requests.length, 1, `HTTP ${statusCode} must not be retried`);
		}
	});

	test('maps certificate and connection failures to TLS and offline failures', async () => {
		const cases: readonly { readonly code: string; readonly expected: string }[] = [
			{ code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', expected: 'tls' },
			{ code: 'CERT_HAS_EXPIRED', expected: 'tls' },
			{ code: 'ERR_TLS_CERT_ALTNAME_INVALID', expected: 'tls' },
			{ code: 'ECONNREFUSED', expected: 'offline' },
			{ code: 'ENOTFOUND', expected: 'offline' },
			{ code: 'ENETUNREACH', expected: 'offline' },
			{ code: 'ETIMEDOUT', expected: 'timeout' },
		];
		for (const { code, expected } of cases) {
			const transport = createRecordingTransport(async () => { throw Object.assign(new Error(`simulated ${code}`), { code }); });
			await expectFailure(downloadOptions({ transport }), expected);
		}
	});

	test('rejects non-200 responses other than redirects', async () => {
		for (const statusCode of [204, 400, 404, 500]) {
			const transport = createRecordingTransport(async () => responseWith([], statusCode));
			await expectFailure(downloadOptions({ transport }), 'http-status');
		}
	});

	test('bounds the response at 1 MiB using declared and streamed sizes', async () => {
		const declared = createRecordingTransport(async () => responseWith([], 200, { 'content-length': String(MAX_SCRIPT_BYTES + 1) }));
		await expectFailure(downloadOptions({ transport: declared }), 'too-large');

		const oversizedChunk = Buffer.alloc(MAX_SCRIPT_BYTES / 2 + 1, 0x61);
		const streamed = createRecordingTransport(async () => responseWith([oversizedChunk, oversizedChunk]));
		await expectFailure(downloadOptions({ transport: streamed }), 'too-large');
		assert.strictEqual(streamed.requests[0].signal.aborted, true, 'an oversized stream must be aborted');
	});

	test('accepts a body exactly at the byte limit', async () => {
		const exact = Buffer.alloc(MAX_SCRIPT_BYTES, 0x62);
		const transport = createRecordingTransport(async () => responseWith([exact]));
		const result = await downloadDotnetInstallScript(downloadOptions({ transport, pin: fixturePin({ sha256: createHash('sha256').update(exact).digest('hex') }) }));

		assert.strictEqual(result.kind, 'downloaded');
		if (result.kind === 'downloaded') {
			assert.strictEqual(result.bytes, MAX_SCRIPT_BYTES);
		}
	});

	test('ignores a non-numeric declared length and still applies the streamed cap', async () => {
		const transport = createRecordingTransport(async () => responseWith([SCRIPT_BODY], 200, { 'content-length': 'unknown' }));
		const result = await downloadDotnetInstallScript(downloadOptions({ transport }));

		assert.strictEqual(result.kind, 'downloaded');
	});

	test('refuses untrusted URLs and relative operation directories before any request', async () => {
		const transport = createRecordingTransport(async () => responseWith([SCRIPT_BODY]));
		const untrustedUrls = [
			DOTNET_INSTALL_SCRIPT_PINS.unix.url.replace('https:', 'http:'),
			DOTNET_INSTALL_SCRIPT_PINS.unix.url.replace('raw.githubusercontent.com', 'evil.example.com'),
			DOTNET_INSTALL_SCRIPT_PINS.unix.url.replace('https://', 'https://alice@'),
			DOTNET_INSTALL_SCRIPT_PINS.unix.url.replace(DOTNET_INSTALL_SCRIPTS_COMMIT, 'f'.repeat(40)),
		];
		for (const url of untrustedUrls) {
			await expectFailure(downloadOptions({ transport, pin: fixturePin({ url }) }), 'invalid-pin');
		}
		await expectFailure(downloadOptions({ transport, operationDirectory: 'relative/dir' }), 'invalid-pin');
		assert.strictEqual(transport.requests.length, 0, 'no request may precede pin validation');
	});

	test('returns canceled without a request when the caller has already canceled', async () => {
		const controller = new AbortController();
		controller.abort();
		const transport = createRecordingTransport(async () => responseWith([SCRIPT_BODY]));
		const writer = createRecordingWriter();
		const result = await downloadDotnetInstallScript(downloadOptions({ transport, fileWriter: writer, signal: controller.signal }));

		assert.strictEqual(result.kind, 'canceled');
		assert.strictEqual(transport.requests.length, 0);
		assert.strictEqual(writer.writes.length, 0);
	});

	test('returns canceled without writing when the caller cancels during the download', async () => {
		const controller = new AbortController();
		const writer = createRecordingWriter();
		const transport = createRecordingTransport(async () => ({
			statusCode: 200,
			headers: {},
			body: {
				async *[Symbol.asyncIterator]() {
					yield SCRIPT_BODY.subarray(0, 4);
					controller.abort();
					yield SCRIPT_BODY.subarray(4);
				},
			},
		}));
		const result = await downloadDotnetInstallScript(downloadOptions({ transport, fileWriter: writer, signal: controller.signal }));

		assert.strictEqual(result.kind, 'canceled');
		assert.strictEqual(writer.writes.length, 0);
		assert.strictEqual(transport.requests[0].signal.aborted, true);
	});

	test('reports a write failure instead of returning an unverified script path', async () => {
		const writer: IDotnetScriptFileWriter = { writePrivateFile: async () => { throw new Error('EACCES: permission denied'); } };
		const transport = createRecordingTransport(async () => responseWith([SCRIPT_BODY]));
		await expectFailure(downloadOptions({ transport, fileWriter: writer }), 'write-failed');
	});

	test('enforces the pinned download budget through the injected clock and clears it after success', async () => {
		const clock = createRecordingClock();
		const writer = createRecordingWriter();
		const transport = createAbortableFailureTransport();
		const pending = downloadDotnetInstallScript(downloadOptions({ transport, fileWriter: writer, clock }));
		await tick();

		assert.strictEqual(clock.timeouts.length, 1);
		assert.strictEqual(clock.timeouts[0].timeoutMs, SCRIPT_DOWNLOAD_TIMEOUT_MS);
		assert.strictEqual(transport.requests.length, 1);
		clock.fire();
		assertFailureResult(await pending, 'timeout');
		assert.strictEqual(writer.writes.length, 0);

		const successClock = createRecordingClock();
		const success = createRecordingTransport(async () => responseWith([SCRIPT_BODY]));
		await downloadDotnetInstallScript(downloadOptions({ transport: success, clock: successClock }));
		assert.strictEqual(successClock.clearCount(), 1, 'a finished download must release its budget timer');
	});
});

suite('dotnet proxy policy', () => {
	test('resolves a direct connection when no proxy is configured', () => {
		assert.deepStrictEqual(resolveDotnetProxy({ kind: 'none' }), { kind: 'direct' });
		assert.deepStrictEqual(dotnetProxyEnvironment({ kind: 'direct' }), {});
		assert.deepStrictEqual(dotnetProxyPowerShellArguments({ kind: 'direct' }), []);
	});

	test('resolves credential-free HTTP and HTTPS proxy settings', () => {
		assert.deepStrictEqual(resolveDotnetProxy({ kind: 'url', value: 'http://proxy.local:3128' }), { kind: 'proxy', target: PROXY_TARGET });
		assert.deepStrictEqual(resolveDotnetProxy({ kind: 'url', value: 'https://proxy.local:8443' }), {
			kind: 'proxy',
			target: { host: 'proxy.local', port: 8443, secure: true, url: 'https://proxy.local:8443' },
		});
	});

	test('maps a supported proxy to shell environment and PowerShell arguments', () => {
		const resolution = resolveDotnetProxy({ kind: 'url', value: 'http://proxy.local:3128' });
		assert.deepStrictEqual(dotnetProxyEnvironment(resolution), {
			HTTP_PROXY: 'http://proxy.local:3128',
			HTTPS_PROXY: 'http://proxy.local:3128',
			http_proxy: 'http://proxy.local:3128',
			https_proxy: 'http://proxy.local:3128',
		});
		const args = dotnetProxyPowerShellArguments(resolution);
		assert.deepStrictEqual(args, ['-ProxyAddress', 'http://proxy.local:3128']);
		assert.ok(!args.includes('-ProxyUseDefaultCredentials'), 'default credentials must never be delegated');
	});

	test('rejects PAC, credentialed, and non-HTTP proxies without leaking credentials', () => {
		const cases: readonly { readonly setting: DotnetProxySetting; readonly reason: string }[] = [
			{ setting: { kind: 'pac', value: 'https://proxy.local/proxy.pac' }, reason: 'pac' },
			{ setting: { kind: 'url', value: 'http://alice:s3cret@proxy.local:3128' }, reason: 'credentials' },
			{ setting: { kind: 'url', value: 'socks5://proxy.local:1080' }, reason: 'scheme' },
			{ setting: { kind: 'url', value: 'not a url' }, reason: 'malformed' },
		];
		for (const { setting, reason } of cases) {
			const resolution = resolveDotnetProxy(setting);
			assert.strictEqual(resolution.kind, 'unsupported', `${JSON.stringify(setting)} must be unsupported`);
			if (resolution.kind === 'unsupported') {
				assert.strictEqual(resolution.reason, reason);
				assert.ok(resolution.diagnostic.length > 0);
				assert.ok(!resolution.diagnostic.includes('s3cret'), 'credentials must never appear in diagnostics');
				assert.ok(!/\/\/[^/@\s]*@/.test(resolution.diagnostic), 'diagnostics must not contain URL userinfo');
			}
		}
	});

	test('redacts credentials from proxy URLs', () => {
		assert.strictEqual(redactDotnetProxyUrl('http://alice:s3cret@proxy.local:3128'), 'http://proxy.local:3128');
		assert.strictEqual(redactDotnetProxyUrl('https://proxy.local:8443'), 'https://proxy.local:8443');
	});

	test('refuses an unsupported proxy before any network request', async () => {
		const transport = createRecordingTransport(async () => responseWith([SCRIPT_BODY]));
		const proxy = resolveDotnetProxy({ kind: 'pac', value: 'https://proxy.local/proxy.pac' });
		await expectFailure(downloadOptions({ transport, proxy }), 'unsupported-proxy');
		assert.strictEqual(transport.requests.length, 0);
	});

	test('passes a supported proxy target to the transport', async () => {
		const transport = createRecordingTransport(async () => responseWith([SCRIPT_BODY]));
		const proxy = resolveDotnetProxy({ kind: 'url', value: 'http://proxy.local:3128' });
		const result = await downloadDotnetInstallScript(downloadOptions({ transport, proxy }));

		assert.strictEqual(result.kind, 'downloaded');
		assert.deepStrictEqual(transport.requests[0].proxy, PROXY_TARGET);
	});
});

suite('node script file writer', () => {
	test('writes the verified script exclusively with owner-only permissions and never overwrites', async () => {
		const writer = createNodeScriptFileWriter();
		await withTempDirectory('dotnet-script-writer-', async directory => {
			const filePath = path.posix.join(directory, 'dotnet-install.sh');
			await writer.writePrivateFile(filePath, SCRIPT_BODY);
			const handle = await fs.open(filePath, 'r');
			const written = await handle.readFile();
			const stats = await handle.stat();
			await handle.close();
			assert.deepStrictEqual(written, SCRIPT_BODY);
			if (process.platform !== 'win32') {
				assert.strictEqual(stats.mode & 0o777, 0o600);
			}
			await assert.rejects(writer.writePrivateFile(filePath, Buffer.from('tampered')), /EEXIST/);
			assert.deepStrictEqual(await fs.readFile(filePath), SCRIPT_BODY, 'an existing script must never be overwritten');
		});
	});
});

suite('dotnet install dry-run metadata', () => {
	const shellDryRun = [
		'dotnet-install: Payload URLs:',
		'dotnet-install: URL #0 - aka.ms: https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.401/dotnet-sdk-10.0.401-linux-x64.tar.gz',
		'dotnet-install: Repeatable invocation: ./dotnet-install.sh --version "10.0.401" --install-dir "/home/test/.walker/dotnet-stage" --architecture "x64" --os "linux"',
	].join('\n');
	const windowsDryRun = [
		'dotnet-install: Payload URLs:',
		'dotnet-install: URL #0 - aka.ms: https://builds.dotnet.microsoft.com/dotnet/Sdk/10.0.401/dotnet-sdk-10.0.401-win-x64.zip',
		'dotnet-install: Repeatable invocation: .\\dotnet-install.ps1 -Version "10.0.401" -InstallDir "C:\\Users\\test\\.walker\\dotnet-stage" -Architecture "x64"',
	].join('\n');

	test('parses the resolved version from shell and PowerShell dry-run metadata', () => {
		assert.deepStrictEqual(parseDotnetInstallDryRunOutput(shellDryRun), { kind: 'resolved', version: '10.0.401' });
		assert.deepStrictEqual(parseDotnetInstallDryRunOutput(windowsDryRun), { kind: 'resolved', version: '10.0.401' });
	});

	test('keeps repeated identical metadata resolved and refuses conflicting versions', () => {
		assert.deepStrictEqual(parseDotnetInstallDryRunOutput(`${shellDryRun}\n${shellDryRun}`), { kind: 'resolved', version: '10.0.401' });
		const conflictingInvocation = shellDryRun.replace('"10.0.401"', '"10.0.402"');
		assert.deepStrictEqual(parseDotnetInstallDryRunOutput(`${shellDryRun}\n${conflictingInvocation}`), { kind: 'unresolved', reason: 'conflicting-version' });
	});

	test('reports unresolved channel metadata without guessing a version', () => {
		assert.deepStrictEqual(parseDotnetInstallDryRunOutput('dotnet-install: Downloading...'), { kind: 'unresolved', reason: 'missing-repeatable-invocation' });
		assert.deepStrictEqual(parseDotnetInstallDryRunOutput('dotnet-install: Repeatable invocation: ./dotnet-install.sh --install-dir "/tmp/stage"'), { kind: 'unresolved', reason: 'missing-version' });
		assert.deepStrictEqual(parseDotnetInstallDryRunOutput(shellDryRun.replace('"10.0.401"', '"11.0.100-preview.1"')), { kind: 'unresolved', reason: 'invalid-version' });
		assert.deepStrictEqual(
			parseDotnetInstallDryRunOutput(`${windowsDryRun}\ndotnet-install: NOTE: Due to finding a version manifest with this runtime, it would actually install with version '10.0.402'`),
			{ kind: 'unresolved', reason: 'conflicting-version' },
		);
	});
});
