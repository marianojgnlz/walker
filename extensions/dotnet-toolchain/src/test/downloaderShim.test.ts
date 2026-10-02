/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import type { IEnvironmentAdapter } from '../contracts';
import {
	DOTNET_CURL_SHIM_CONTENT,
	DOTNET_REAL_CURL_ENVIRONMENT_VARIABLE,
	DOTNET_REAL_WGET_ENVIRONMENT_VARIABLE,
	DOTNET_WGET_SHIM_CONTENT,
	prepareDotnetDownloaderShim,
	type IDotnetDownloaderShimFileOperations,
} from '../downloaderShim';

interface IShimWrite {
	readonly filePath: string;
	readonly content: string;
	readonly mode: number;
}

function createFileOperations(executables: Readonly<Record<string, string>>, writes: IShimWrite[], failWrite = false): IDotnetDownloaderShimFileOperations {
	return {
		isExecutable: async filePath => filePath in executables,
		realpath: async filePath => executables[filePath],
		mkdir: async (_directory, mode) => assert.strictEqual(mode, 0o700),
		writeExecutableFile: async (filePath, content, mode) => {
			if (failWrite) {
				throw new Error('fixture write failure');
			}
			writes.push({ filePath, content, mode });
		},
	};
}

function environment(platform: NodeJS.Platform = 'linux', searchPath = '/usr/bin:/opt/tools:relative::/bin'): IEnvironmentAdapter {
	return { home: '/home/test', platform, arch: 'x64', path: searchPath };
}

suite('HTTPS-only official installer downloader shim', () => {
	test('constructs child PATH and absolute downloader variables from executable PATH entries', async () => {
		const writes: IShimWrite[] = [];
		const result = await prepareDotnetDownloaderShim({
			operationDirectory: '/home/test/.walker/dotnet-install-owned',
			environment: environment(),
			fileOperations: createFileOperations({
				'/usr/bin/curl': '/usr/lib/curl',
				'/opt/tools/wget': '/opt/tools/wget',
			}, writes),
		});

		assert.strictEqual(result.kind, 'prepared');
		if (result.kind !== 'prepared') {
			return;
		}
		assert.strictEqual(result.shim.directory, '/home/test/.walker/dotnet-install-owned/downloader-bin');
		assert.deepStrictEqual(result.shim.environment, {
			PATH: '/home/test/.walker/dotnet-install-owned/downloader-bin:/usr/bin:/opt/tools:relative::/bin',
			[DOTNET_REAL_CURL_ENVIRONMENT_VARIABLE]: '/usr/bin/curl',
			[DOTNET_REAL_WGET_ENVIRONMENT_VARIABLE]: '/opt/tools/wget',
		});
		assert.deepStrictEqual(writes, [
			{ filePath: '/home/test/.walker/dotnet-install-owned/downloader-bin/curl', content: DOTNET_CURL_SHIM_CONTENT, mode: 0o700 },
			{ filePath: '/home/test/.walker/dotnet-install-owned/downloader-bin/wget', content: DOTNET_WGET_SHIM_CONTENT, mode: 0o700 },
		]);
	});

	test('injects fixed HTTPS-only options without interpolating paths or changing argument construction', async () => {
		const writes: IShimWrite[] = [];
		const result = await prepareDotnetDownloaderShim({
			operationDirectory: '/tmp/home with spaces/owned',
			environment: environment('linux', '/usr/bin'),
			fileOperations: createFileOperations({ '/usr/bin/curl': '/usr/bin/curl' }, writes),
		});
		assert.strictEqual(result.kind, 'prepared');
		assert.strictEqual(writes.length, 1);
		assert.match(writes[0].content, /--disable "\$@" --proto '=https' --proto-redir '=https'$/m);
		assert.match(writes[0].content, /"\$WALKER_DOTNET_REAL_CURL"/);
		assert.ok(!writes[0].content.includes('/tmp/home with spaces'));
		assert.ok(!writes[0].content.includes('-c '), 'the installer remains an argv-based shell:false child');
	});

	test('uses only an available downloader and ignores relative PATH entries while finding it', async () => {
		const writes: IShimWrite[] = [];
		const result = await prepareDotnetDownloaderShim({
			operationDirectory: '/owned',
			environment: environment('darwin', 'relative::/usr/local/bin'),
			fileOperations: createFileOperations({ '/usr/local/bin/wget': '/usr/local/bin/wget' }, writes),
		});
		assert.strictEqual(result.kind, 'prepared');
		if (result.kind === 'prepared') {
			assert.deepStrictEqual(result.shim.environment, {
				PATH: '/owned/downloader-bin:relative::/usr/local/bin',
				[DOTNET_REAL_WGET_ENVIRONMENT_VARIABLE]: '/usr/local/bin/wget',
			});
		}
		assert.deepStrictEqual(writes.map(write => write.filePath), ['/owned/downloader-bin/wget']);
		assert.match(writes[0].content, /--no-config --https-only "\$@"/);
	});

	test('fails closed when neither downloader exists or shim creation fails', async () => {
		const writes: IShimWrite[] = [];
		const missing = await prepareDotnetDownloaderShim({
			operationDirectory: '/owned',
			environment: environment('linux', 'relative::'),
			fileOperations: createFileOperations({}, writes),
		});
		assert.deepStrictEqual(missing, {
			kind: 'failed',
			failure: { code: 'missing-download-tool', diagnostic: 'neither curl nor wget is available in an absolute local PATH directory' },
		});
		assert.deepStrictEqual(writes, []);

		const failed = await prepareDotnetDownloaderShim({
			operationDirectory: '/owned',
			environment: environment('linux', '/usr/bin'),
			fileOperations: createFileOperations({ '/usr/bin/curl': '/usr/bin/curl' }, writes, true),
		});
		assert.deepStrictEqual(failed, {
			kind: 'failed',
			failure: { code: 'shim-create-failed', diagnostic: 'the HTTPS-only downloader shim could not be created in the owned operation directory' },
		});
	});

	test('does not claim curl/wget shim coverage for the PowerShell installer', async () => {
		const writes: IShimWrite[] = [];
		const result = await prepareDotnetDownloaderShim({
			operationDirectory: 'C:\\Users\\test\\.walker\\dotnet-install-owned',
			environment: environment('win32', 'C:\\Windows\\System32'),
			fileOperations: createFileOperations({ 'C:\\Windows\\System32\\curl.exe': 'C:\\Windows\\System32\\curl.exe' }, writes),
		});
		assert.deepStrictEqual(result, { kind: 'not-applicable' });
		assert.deepStrictEqual(writes, []);
	});
});
