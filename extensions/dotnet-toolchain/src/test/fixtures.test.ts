/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { IProcessAdapter } from '../contracts';
import { createDotnetDetectionAdapter, createInMemoryFileSystem, createRecordingUi, withTempDirectory } from './fixtures';

async function execute(adapter: IProcessAdapter, executable: string, args: string[]) {
	return adapter.run({ executable, args, cwd: os.tmpdir(), env: {}, timeoutMs: 1000 });
}

suite('injected fixtures', () => {
	test('replays absence, runtime-only, SDK, and error outputs without spawning', async () => {
		const absence = createDotnetDetectionAdapter({ executable: '/usr/bin/dotnet', outcome: 'absence' });
		const runtimeOnly = createDotnetDetectionAdapter({ executable: '/usr/bin/dotnet', outcome: 'runtimeOnly', runtimeVersion: '10.0.11' });
		const withSdk = createDotnetDetectionAdapter({ executable: '/home/test/.walker/dotnet/dotnet', outcome: 'sdk', sdkVersion: '10.0.401', sdkRoot: '/home/test/.walker/dotnet/sdk' });
		const hostError = createDotnetDetectionAdapter({ executable: '/usr/bin/dotnet', outcome: 'error' });

		const [absenceSdks, runtimeSdks, runtimeRuntimes, sdkSdks, errorSdks] = [
			await execute(absence, '/usr/bin/dotnet', ['--list-sdks']),
			await execute(runtimeOnly, '/usr/bin/dotnet', ['--list-sdks']),
			await execute(runtimeOnly, '/usr/bin/dotnet', ['--list-runtimes']),
			await execute(withSdk, '/home/test/.walker/dotnet/dotnet', ['--list-sdks']),
			await execute(hostError, '/usr/bin/dotnet', ['--list-sdks']),
		];
		assert.deepStrictEqual(
			[absenceSdks.failure, runtimeSdks.stdout, runtimeRuntimes.stdout.trim(), sdkSdks.stdout.trim(), errorSdks.exitCode],
			['spawn', '', 'Microsoft.NETCore.App 10.0.11 [/usr/share/dotnet/shared/Microsoft.NETCore.App]', '10.0.401 [/home/test/.walker/dotnet/sdk]', 1],
		);
		assert.deepStrictEqual(absence.executions.map(execution => execution.args), [['--list-sdks']]);
	});

	test('in-memory file system resolves links and reports absence', async () => {
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile('/usr/lib/dotnet/dotnet');
		fileSystem.addLink('/usr/bin/dotnet', '/usr/lib/dotnet/dotnet');
		assert.deepStrictEqual(
			[await fileSystem.exists('/usr/bin/dotnet'), await fileSystem.realpath('/usr/bin/dotnet'), await fileSystem.exists('/opt/dotnet'), await fileSystem.realpath('/opt/dotnet')],
			[true, '/usr/lib/dotnet/dotnet', false, undefined],
		);
	});

	test('recording UI facade captures output without vscode', () => {
		const ui = createRecordingUi();
		ui.appendOutput('detect: runtime-only');
		ui.showError('Setup failed');
		assert.deepStrictEqual([ui.output, ui.errors], [['detect: runtime-only'], ['Setup failed']]);
	});
});

suite('isolated fixture disposal', () => {
	test('creates a temp directory under the OS temp root and removes it afterwards', async () => {
		let created = '';
		await withTempDirectory('dotnet-toolchain-test-', async directory => {
			created = directory;
			await fs.writeFile(path.join(directory, 'marker.txt'), 'fixture');
			assert.deepStrictEqual(await fs.readdir(directory), ['marker.txt']);
			assert.strictEqual(path.dirname(directory), path.resolve(os.tmpdir()));
		});
		await assert.rejects(fs.readdir(created), { code: 'ENOENT' });
	});

	test('removes the temp directory when the body throws', async () => {
		let created = '';
		await assert.rejects(
			withTempDirectory('dotnet-toolchain-test-', directory => {
				created = directory;
				throw new Error('fixture body failed');
			}),
			/fixture body failed/,
		);
		await assert.rejects(fs.readdir(created), { code: 'ENOENT' });
	});

	test('gives each body a distinct temp directory', async () => {
		const seen = await withTempDirectory('dotnet-toolchain-test-', async first => {
			const second = await withTempDirectory('dotnet-toolchain-test-', async inner => inner);
			return [first, second];
		});
		assert.strictEqual(new Set(seen).size, 2);
	});
});
