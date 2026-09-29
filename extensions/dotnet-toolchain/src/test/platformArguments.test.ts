/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import type { IEnvironmentAdapter } from '../contracts';
import {
	DEFAULT_WINDOWS_SYSTEM_ROOT,
	buildDotnetInstallInvocation,
	mapDotnetInstallArchitecture,
	resolveDotnetPrerequisites,
	UNIX_BASH_INTERPRETERS,
	windowsPowerShellPath,
} from '../platformArguments';
import { createInMemoryFileSystem, type IInMemoryFileSystem } from './fixtures';

const SCRIPT_PATH = '/home/test/.walker/dotnet-install-a1b2c3/install.sh';
const STAGE_DIRECTORY = '/home/test/.walker/dotnet-install-a1b2c3/stage';

function linuxEnvironment(arch = 'x64'): IEnvironmentAdapter {
	return { home: '/home/test', platform: 'linux', arch, path: '/usr/bin' };
}

function windowsEnvironment(arch = 'x64'): IEnvironmentAdapter {
	return { home: 'C:\\Users\\test', platform: 'win32', arch, path: 'C:\\Windows\\System32' };
}

function bashFileSystem(): IInMemoryFileSystem {
	const fileSystem = createInMemoryFileSystem();
	fileSystem.addFile('/bin/bash');
	return fileSystem;
}

suite('dotnet install architecture mapping', () => {
	test('maps every supported host architecture to the official installer architecture', () => {
		assert.deepStrictEqual(
			[
				mapDotnetInstallArchitecture('linux', 'x64'),
				mapDotnetInstallArchitecture('linux', 'arm64'),
				mapDotnetInstallArchitecture('linux', 'arm'),
				mapDotnetInstallArchitecture('darwin', 'x64'),
				mapDotnetInstallArchitecture('darwin', 'arm64'),
				mapDotnetInstallArchitecture('win32', 'x64'),
				mapDotnetInstallArchitecture('win32', 'arm64'),
				mapDotnetInstallArchitecture('win32', 'ia32'),
			],
			['x64', 'arm64', 'arm', 'x64', 'arm64', 'x64', 'arm64', 'x86'],
		);
	});

	test('rejects unsupported architecture and platform combinations', () => {
		const unsupported: readonly (readonly [NodeJS.Platform, string])[] = [
			['linux', 'ia32'],
			['linux', 'ppc64'],
			['linux', 's390x'],
			['darwin', 'ia32'],
			['darwin', 'arm'],
			['win32', 'arm'],
			['win32', 'ppc64'],
			['freebsd', 'x64'],
		];
		for (const [platform, arch] of unsupported) {
			assert.strictEqual(mapDotnetInstallArchitecture(platform, arch), undefined, `${platform}/${arch} must be rejected before download`);
		}
	});
});

suite('dotnet install invocation', () => {
	test('builds a fixed-interpreter bash invocation for a channel selection', async () => {
		const result = await buildDotnetInstallInvocation({
			environment: linuxEnvironment(),
			fileSystem: bashFileSystem(),
			selection: { kind: 'channel', channel: 'LTS' },
			scriptPath: SCRIPT_PATH,
			stageDirectory: STAGE_DIRECTORY,
		});
		assert.deepStrictEqual(result, {
			kind: 'invocation',
			invocation: {
				executable: '/bin/bash',
				cwd: STAGE_DIRECTORY,
				args: [SCRIPT_PATH, '--channel', 'LTS', '--install-dir', STAGE_DIRECTORY, '--architecture', 'x64', '--no-path'],
			},
		});
	});

	test('builds an exact-version bash invocation instead of a channel', async () => {
		const result = await buildDotnetInstallInvocation({
			environment: linuxEnvironment(),
			fileSystem: bashFileSystem(),
			selection: { kind: 'version', version: '10.0.401' },
			scriptPath: SCRIPT_PATH,
			stageDirectory: STAGE_DIRECTORY,
		});
		assert.deepStrictEqual(result, {
			kind: 'invocation',
			invocation: {
				executable: '/bin/bash',
				cwd: STAGE_DIRECTORY,
				args: [SCRIPT_PATH, '--version', '10.0.401', '--install-dir', STAGE_DIRECTORY, '--architecture', 'x64', '--no-path'],
			},
		});
	});

	test('keeps spaced and non-ASCII paths as single unquoted arguments', async () => {
		const scriptPath = '/home/tëst user/.walker/dotnet-install-1/install script.sh';
		const stageDirectory = '/home/tëst user/.walker/dotnet-install-1/stage dir';
		const result = await buildDotnetInstallInvocation({
			environment: linuxEnvironment(),
			fileSystem: bashFileSystem(),
			selection: { kind: 'channel', channel: 'STS' },
			scriptPath,
			stageDirectory,
		});
		assert.strictEqual(result.kind, 'invocation');
		if (result.kind === 'invocation') {
			assert.strictEqual(result.invocation.args[0], scriptPath);
			assert.ok(result.invocation.args.includes(stageDirectory));
			assert.ok(result.invocation.args.every(argument => !argument.includes('"') && !argument.includes("'") && !argument.includes('\\ ')));
			assert.strictEqual(result.invocation.cwd, stageDirectory);
		}
	});

	test('resolves the first existing fixed bash interpreter without consulting PATH', async () => {
		const onlyUsrBin = createInMemoryFileSystem();
		onlyUsrBin.addFile('/usr/bin/bash');
		assert.deepStrictEqual(await resolveDotnetPrerequisites(linuxEnvironment(), onlyUsrBin), {
			kind: 'ready',
			prerequisites: { architecture: 'x64', interpreter: '/usr/bin/bash' },
		});

		const preferred = bashFileSystem();
		preferred.addFile('/usr/bin/bash');
		const hostilePath = await resolveDotnetPrerequisites({ ...linuxEnvironment(), path: '/evil/workspace/bin' }, preferred);
		assert.strictEqual(hostilePath.kind === 'ready' && hostilePath.prerequisites.interpreter, '/bin/bash');
	});

	test('fails with an actionable prerequisite when no fixed bash interpreter exists', async () => {
		const result = await resolveDotnetPrerequisites(linuxEnvironment(), createInMemoryFileSystem());
		assert.strictEqual(result.kind, 'failed');
		if (result.kind === 'failed') {
			assert.strictEqual(result.failure.code, 'missing-bash');
			assert.ok(result.failure.diagnostic.includes(UNIX_BASH_INTERPRETERS[0]));
		}
	});

	test('builds the PowerShell invocation with process-scoped execution policy', async () => {
		const powerShell = windowsPowerShellPath(DEFAULT_WINDOWS_SYSTEM_ROOT);
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile(powerShell);
		const scriptPath = 'C:\\Users\\test\\.walker\\dotnet-install-a1b2c3\\install.ps1';
		const stageDirectory = 'C:\\Users\\test\\.walker\\dotnet-install-a1b2c3\\stage';
		const result = await buildDotnetInstallInvocation({
			environment: windowsEnvironment('arm64'),
			fileSystem,
			selection: { kind: 'channel', channel: 'STS' },
			scriptPath,
			stageDirectory,
		});
		assert.deepStrictEqual(result, {
			kind: 'invocation',
			invocation: {
				executable: powerShell,
				cwd: stageDirectory,
				args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Channel', 'STS', '-InstallDir', stageDirectory, '-Architecture', 'arm64', '-NoPath'],
			},
		});
	});

	test('fails when the fixed PowerShell host is missing', async () => {
		const result = await buildDotnetInstallInvocation({
			environment: windowsEnvironment(),
			fileSystem: createInMemoryFileSystem(),
			selection: { kind: 'channel', channel: 'LTS' },
			scriptPath: 'C:\\x\\install.ps1',
			stageDirectory: 'C:\\x\\stage',
		});
		assert.strictEqual(result.kind, 'failed');
		if (result.kind === 'failed') {
			assert.strictEqual(result.failure.code, 'missing-powershell');
			assert.ok(result.failure.diagnostic.includes(windowsPowerShellPath(DEFAULT_WINDOWS_SYSTEM_ROOT)));
		}
	});

	test('builds an exact-version PowerShell invocation with a custom system root', async () => {
		const systemRoot = 'D:\\Windows';
		const powerShell = windowsPowerShellPath(systemRoot);
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile(powerShell);
		const result = await buildDotnetInstallInvocation({
			environment: windowsEnvironment(),
			fileSystem,
			systemRoot,
			selection: { kind: 'version', version: '8.0.100' },
			scriptPath: 'C:\\x\\install.ps1',
			stageDirectory: 'C:\\x\\stage',
		});
		assert.deepStrictEqual(result, {
			kind: 'invocation',
			invocation: {
				executable: powerShell,
				cwd: 'C:\\x\\stage',
				args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'C:\\x\\install.ps1', '-Version', '8.0.100', '-InstallDir', 'C:\\x\\stage', '-Architecture', 'x64', '-NoPath'],
			},
		});
	});

	test('keeps spaced Windows paths literal and never uses a shell wrapper', async () => {
		const powerShell = windowsPowerShellPath(DEFAULT_WINDOWS_SYSTEM_ROOT);
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile(powerShell);
		const scriptPath = 'C:\\Users\\tëst user\\.walker\\dotnet-install-1\\install script.ps1';
		const stageDirectory = 'C:\\Users\\tëst user\\.walker\\dotnet-install-1\\stage dir';
		const result = await buildDotnetInstallInvocation({
			environment: windowsEnvironment(),
			fileSystem,
			selection: { kind: 'channel', channel: 'LTS' },
			scriptPath,
			stageDirectory,
		});
		assert.strictEqual(result.kind, 'invocation');
		if (result.kind === 'invocation') {
			assert.strictEqual(result.invocation.args[6], scriptPath);
			assert.ok(result.invocation.args.includes(stageDirectory));
			assert.ok(result.invocation.args.every(argument => !['-Command', '-c', 'sh', '-e'].includes(argument) && !argument.includes('&&') && !argument.includes('||')));
		}
	});

	test('always appends the no-path switch last for both platforms', async () => {
		const linux = await buildDotnetInstallInvocation({
			environment: linuxEnvironment('arm'),
			fileSystem: bashFileSystem(),
			selection: { kind: 'channel', channel: 'STS' },
			scriptPath: SCRIPT_PATH,
			stageDirectory: STAGE_DIRECTORY,
		});
		assert.strictEqual(linux.kind === 'invocation' && linux.invocation.args[linux.invocation.args.length - 1], '--no-path');
		assert.ok(linux.kind === 'invocation' && linux.invocation.args.includes('arm'));

		const powerShell = windowsPowerShellPath(DEFAULT_WINDOWS_SYSTEM_ROOT);
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile(powerShell);
		const windows = await buildDotnetInstallInvocation({
			environment: windowsEnvironment(),
			fileSystem,
			selection: { kind: 'channel', channel: 'STS' },
			scriptPath: 'C:\\x\\install.ps1',
			stageDirectory: 'C:\\x\\stage',
		});
		assert.strictEqual(windows.kind === 'invocation' && windows.invocation.args[windows.invocation.args.length - 1], '-NoPath');
	});

	test('rejects unsupported architecture before resolving interpreters', async () => {
		const result = await resolveDotnetPrerequisites(linuxEnvironment('ppc64'), createInMemoryFileSystem());
		assert.strictEqual(result.kind === 'failed' && result.failure.code, 'unsupported-architecture');
	});

	test('appends the Unix dry-run switch and never leaks Windows proxy parameters', async () => {
		const result = await buildDotnetInstallInvocation({
			environment: linuxEnvironment(),
			fileSystem: bashFileSystem(),
			selection: { kind: 'channel', channel: 'LTS' },
			scriptPath: SCRIPT_PATH,
			stageDirectory: STAGE_DIRECTORY,
			dryRun: true,
			proxyArguments: ['-ProxyAddress', 'http://proxy.local:3128'],
		});
		assert.deepStrictEqual(result, {
			kind: 'invocation',
			invocation: {
				executable: '/bin/bash',
				cwd: STAGE_DIRECTORY,
				args: [SCRIPT_PATH, '--channel', 'LTS', '--install-dir', STAGE_DIRECTORY, '--architecture', 'x64', '--no-path', '--dry-run'],
			},
		});
	});

	test('passes vetted PowerShell proxy parameters after the official script path', async () => {
		const powerShell = windowsPowerShellPath(DEFAULT_WINDOWS_SYSTEM_ROOT);
		const fileSystem = createInMemoryFileSystem();
		fileSystem.addFile(powerShell);
		const result = await buildDotnetInstallInvocation({
			environment: windowsEnvironment(),
			fileSystem,
			selection: { kind: 'channel', channel: 'STS' },
			scriptPath: 'C:\\x\\install.ps1',
			stageDirectory: 'C:\\x\\stage',
			dryRun: true,
			proxyArguments: ['-ProxyAddress', 'http://proxy.local:3128'],
		});
		assert.deepStrictEqual(result, {
			kind: 'invocation',
			invocation: {
				executable: powerShell,
				cwd: 'C:\\x\\stage',
				args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', 'C:\\x\\install.ps1', '-Channel', 'STS', '-InstallDir', 'C:\\x\\stage', '-Architecture', 'x64', '-NoPath', '-DryRun', '-ProxyAddress', 'http://proxy.local:3128'],
			},
		});
	});

	test('rejects relative script or stage paths', async () => {
		const relativeScript = await buildDotnetInstallInvocation({
			environment: linuxEnvironment(),
			fileSystem: bashFileSystem(),
			selection: { kind: 'channel', channel: 'LTS' },
			scriptPath: 'install.sh',
			stageDirectory: STAGE_DIRECTORY,
		});
		assert.strictEqual(relativeScript.kind === 'failed' && relativeScript.failure.code, 'unsafe-path');

		const relativeStage = await buildDotnetInstallInvocation({
			environment: linuxEnvironment(),
			fileSystem: bashFileSystem(),
			selection: { kind: 'channel', channel: 'LTS' },
			scriptPath: SCRIPT_PATH,
			stageDirectory: 'stage',
		});
		assert.strictEqual(relativeStage.kind === 'failed' && relativeStage.failure.code, 'unsafe-path');
	});
});
