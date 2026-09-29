/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { dotnetManagedRoot } from '../candidates';
import type { DotnetToolchainProgressPhase } from '../contracts';
import {
	DOTNET_INSTALL_OPERATION_PREFIX,
	acquireDotnetInstallLock,
	inspectDotnetInstallLock,
	type DotnetInstallLockMutationResult,
	type IDotnetInstallLock,
	type IDotnetInstallLockMetadata,
	type IDotnetInstallLockUpdatePatch,
} from '../installLock';
import { dotnetInstallScriptPin } from '../scriptSource';
import {
	DOTNET_TRANSACTION_BACKUP_DIRECTORY_NAME,
	DOTNET_TRANSACTION_JOURNAL_FILE,
	DOTNET_TRANSACTION_SCHEMA_VERSION,
	DOTNET_TRANSACTION_STAGE_DIRECTORY_NAME,
	dotnetTransactionPaths,
	prepareDotnetInstallStage,
	type DotnetStagePreparationFailureCode,
	type DotnetStagePreparationResult,
	type IDotnetStagePreparationLock,
	type IDotnetStagedInstall,
} from '../transaction';
import { withTempDirectory } from './fixtures';

const OWNER_TOKEN = 'token-transaction-0001';
const OPERATION_DIRECTORY = `${DOTNET_INSTALL_OPERATION_PREFIX}txn-0001`;

/** Narrows a preparation result to `prepared`, failing loudly on any other outcome. */
function expectPrepared(result: DotnetStagePreparationResult): IDotnetStagedInstall {
	if (result.kind !== 'prepared') {
		throw new Error(`expected a prepared stage, received ${result.kind}`);
	}
	return result.prepared;
}

/** Narrows a preparation result to one expected failure code. */
function expectFailed(result: DotnetStagePreparationResult, code: DotnetStagePreparationFailureCode): Extract<DotnetStagePreparationResult, { kind: 'failed' }> {
	if (result.kind !== 'failed') {
		throw new Error(`expected failure ${code}, received ${result.kind}`);
	}
	assert.strictEqual(result.failure.code, code);
	assert.strictEqual(result.failure.stage, 'publish');
	assert.strictEqual(result.failure.diagnostic.length > 0, true);
	return result;
}

/** True when a path exists as any node type. */
async function pathExists(candidate: string): Promise<boolean> {
	try {
		await fs.lstat(candidate);
		return true;
	} catch {
		return false;
	}
}

/** Permission bits of one path. */
async function modeOf(candidate: string): Promise<number> {
	return (await fs.stat(candidate)).mode & 0o7777;
}

/** Writes one managed-tree file with exact contents and mode, defeating the process umask. */
async function writeManagedFile(root: string, relative: string, contents: string, mode = 0o644): Promise<void> {
	const target = path.join(root, relative);
	await fs.mkdir(path.dirname(target), { recursive: true });
	await fs.writeFile(target, contents, { mode });
	await fs.chmod(target, mode);
}

/** Creates a managed SDK tree whose bytes later assertions compare against. */
async function seedManagedSdk(home: string): Promise<string> {
	const managedRoot = dotnetManagedRoot(home, process.platform);
	await writeManagedFile(managedRoot, 'dotnet', '#!/bin/sh\nexit 0\n', 0o755);
	await writeManagedFile(managedRoot, path.join('sdk', '10.0.401', 'MSBuild.dll'), 'MSBUILD-BYTES');
	await writeManagedFile(managedRoot, path.join('shared', 'Microsoft.NETCore.App', '10.0.11', 'libcoreclr.so'), 'CORE-BYTES');
	return managedRoot;
}

/** Canonical fingerprint of a tree: names, node kinds, modes, link targets, and file bytes. */
async function snapshotTree(root: string): Promise<string> {
	const lines: string[] = [];
	const walk = async (directory: string, relative: string): Promise<void> => {
		const entries = await fs.readdir(directory, { withFileTypes: true });
		entries.sort((left, right) => left.name.localeCompare(right.name));
		for (const entry of entries) {
			const fullPath = path.join(directory, entry.name);
			const entryName = relative === '' ? entry.name : `${relative}/${entry.name}`;
			const stats = await fs.lstat(fullPath);
			if (stats.isSymbolicLink()) {
				lines.push(`${entryName} link ${await fs.readlink(fullPath)}`);
			} else if (stats.isDirectory()) {
				lines.push(`${entryName} dir ${stats.mode & 0o7777}`);
				await walk(fullPath, entryName);
			} else {
				lines.push(`${entryName} file ${stats.mode & 0o7777} ${await fs.readFile(fullPath, 'utf8')}`);
			}
		}
	};
	await walk(root, '');
	return lines.join('\n');
}

/** Acquires the real install lock with a fixed operation directory and token. */
async function acquireLock(home: string, phase: DotnetToolchainProgressPhase = 'installing', operationDirectory = OPERATION_DIRECTORY): Promise<IDotnetInstallLock> {
	const result = await acquireDotnetInstallLock({ home, phase, operationDirectory, createToken: () => OWNER_TOKEN });
	if (result.kind !== 'acquired') {
		throw new Error(`expected an acquired lock, received ${result.kind}`);
	}
	return result.lock;
}

/** In-memory lock surface for path-safety cases that real acquisition refuses to create. */
function forgedLock(
	overrides: Partial<IDotnetInstallLockMetadata> = {},
	update: (patch: IDotnetInstallLockUpdatePatch) => Promise<DotnetInstallLockMutationResult> = async () => ({ kind: 'applied' }),
): IDotnetStagePreparationLock {
	return {
		metadata: { schemaVersion: 1, token: OWNER_TOKEN, pid: process.pid, phase: 'preparing', operationDirectory: OPERATION_DIRECTORY, ...overrides },
		update,
	};
}

suite('dotnet install stage preparation', () => {
	test('prepares an empty owned stage with a versioned journal when no managed SDK exists', async () => {
		await withTempDirectory('dotnet-txn-empty-', async home => {
			const lock = await acquireLock(home, 'verifying');
			const result = await prepareDotnetInstallStage({ home, lock });
			const prepared = expectPrepared(result);

			assert.strictEqual(prepared.operationDirectory, path.join(home, '.walker', OPERATION_DIRECTORY));
			assert.strictEqual(prepared.stageDirectory, path.join(prepared.operationDirectory, DOTNET_TRANSACTION_STAGE_DIRECTORY_NAME));
			assert.strictEqual(prepared.backupDirectory, path.join(prepared.operationDirectory, DOTNET_TRANSACTION_BACKUP_DIRECTORY_NAME));
			assert.strictEqual(prepared.journalPath, path.join(prepared.operationDirectory, DOTNET_TRANSACTION_JOURNAL_FILE));
			assert.strictEqual(prepared.scriptPath, path.join(prepared.operationDirectory, dotnetInstallScriptPin(process.platform).fileName));
			assert.deepStrictEqual(prepared.copied, { files: 0, directories: 0, links: 0, bytes: 0 });

			assert.strictEqual(await modeOf(prepared.operationDirectory), 0o700);
			assert.strictEqual(await modeOf(prepared.stageDirectory), 0o700);
			assert.strictEqual(await modeOf(prepared.backupDirectory), 0o700);

			const journalText = await fs.readFile(prepared.journalPath, 'utf8');
			assert.deepStrictEqual(JSON.parse(journalText), {
				schemaVersion: DOTNET_TRANSACTION_SCHEMA_VERSION,
				token: OWNER_TOKEN,
				phase: 'preparing',
				managedDirectory: 'dotnet',
				stageDirectory: DOTNET_TRANSACTION_STAGE_DIRECTORY_NAME,
				backupDirectory: DOTNET_TRANSACTION_BACKUP_DIRECTORY_NAME,
				scriptFile: dotnetInstallScriptPin(process.platform).fileName,
			});
			assert.strictEqual(journalText.includes(home), false);

			const busy = await inspectDotnetInstallLock({ home });
			assert.strictEqual(busy.kind, 'busy');
			if (busy.kind === 'busy') {
				assert.strictEqual(busy.owner.phase, 'preparing');
			}
			await lock.release();
		});
	});

	test('copies a pre-existing managed SDK into the stage without hard links or mode loss', async () => {
		await withTempDirectory('dotnet-txn-copy-', async home => {
			const managedRoot = await seedManagedSdk(home);
			const before = await snapshotTree(managedRoot);
			const lock = await acquireLock(home);
			const prepared = expectPrepared(await prepareDotnetInstallStage({ home, lock }));

			const expectedBytes = Buffer.byteLength('#!/bin/sh\nexit 0\n') + Buffer.byteLength('MSBUILD-BYTES') + Buffer.byteLength('CORE-BYTES');
			assert.deepStrictEqual(prepared.copied, { files: 3, directories: 5, links: 0, bytes: expectedBytes });
			assert.strictEqual(await fs.readFile(path.join(prepared.stageDirectory, 'dotnet'), 'utf8'), '#!/bin/sh\nexit 0\n');
			assert.strictEqual(await fs.readFile(path.join(prepared.stageDirectory, 'sdk', '10.0.401', 'MSBuild.dll'), 'utf8'), 'MSBUILD-BYTES');
			assert.strictEqual(await fs.readFile(path.join(prepared.stageDirectory, 'shared', 'Microsoft.NETCore.App', '10.0.11', 'libcoreclr.so'), 'utf8'), 'CORE-BYTES');
			assert.strictEqual(await modeOf(path.join(prepared.stageDirectory, 'dotnet')), 0o755);
			assert.strictEqual(await modeOf(path.join(prepared.stageDirectory, 'sdk')), await modeOf(path.join(managedRoot, 'sdk')));

			const originalStats = await fs.stat(path.join(managedRoot, 'dotnet'));
			const stagedStats = await fs.stat(path.join(prepared.stageDirectory, 'dotnet'));
			assert.notStrictEqual(stagedStats.ino, originalStats.ino);
			assert.strictEqual(await snapshotTree(managedRoot), before);
			await lock.release();
		});
	});

	test('cancels during copy, removes only the owned operation directory, and preserves the managed tree', async () => {
		await withTempDirectory('dotnet-txn-cancel-', async home => {
			const managedRoot = await seedManagedSdk(home);
			const before = await snapshotTree(managedRoot);
			const lock = await acquireLock(home);
			let copies = 0;
			let canceled = false;
			const result = await prepareDotnetInstallStage({
				home,
				lock,
				cancellation: { get isCancellationRequested() { return canceled; } },
				fileOperations: {
					copyFile: async (source, destination) => {
						await fs.copyFile(source, destination);
						copies += 1;
						if (copies === 1) {
							canceled = true;
						}
					},
				},
			});

			assert.strictEqual(result.kind, 'canceled');
			if (result.kind === 'canceled') {
				assert.strictEqual(result.removed, true);
				assert.deepStrictEqual(result.copied, { files: 1, directories: 0, links: 0, bytes: Buffer.byteLength('#!/bin/sh\nexit 0\n') });
			}
			assert.strictEqual(await pathExists(dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory), false);
			assert.strictEqual(await snapshotTree(managedRoot), before);
			await lock.release();
		});
	});

	test('cancels before any write when cancellation is already requested', async () => {
		await withTempDirectory('dotnet-txn-cancel-early-', async home => {
			const lock = await acquireLock(home);
			const result = await prepareDotnetInstallStage({ home, lock, cancellation: { isCancellationRequested: true } });

			assert.strictEqual(result.kind, 'canceled');
			if (result.kind === 'canceled') {
				assert.strictEqual(result.removed, true);
				assert.deepStrictEqual(result.copied, { files: 0, directories: 0, links: 0, bytes: 0 });
			}
			assert.strictEqual(await pathExists(dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory), false);
			await lock.release();
		});
	});

	test('reports an injected copy failure and removes the owned operation directory', async () => {
		await withTempDirectory('dotnet-txn-copyfail-', async home => {
			const managedRoot = await seedManagedSdk(home);
			const before = await snapshotTree(managedRoot);
			const lock = await acquireLock(home);
			let copies = 0;
			const result = await prepareDotnetInstallStage({
				home,
				lock,
				fileOperations: {
					copyFile: async (source, destination) => {
						copies += 1;
						if (copies === 2) {
							throw Object.assign(new Error('copy failed'), { code: 'EIO' });
						}
						await fs.copyFile(source, destination);
					},
				},
			});

			const failed = expectFailed(result, 'copy-failed');
			assert.strictEqual(failed.retained, false);
			assert.strictEqual(await pathExists(dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory), false);
			assert.strictEqual(await snapshotTree(managedRoot), before);
			await lock.release();
		});
	});

	test('classifies disk-full and permission faults from injected copy failures', async () => {
		const cases: readonly { readonly name: string; readonly code: string; readonly expected: DotnetStagePreparationFailureCode }[] = [
			{ name: 'disk full', code: 'ENOSPC', expected: 'disk-full' },
			{ name: 'access denied', code: 'EACCES', expected: 'permission-denied' },
			{ name: 'operation denied', code: 'EPERM', expected: 'permission-denied' },
		];
		for (const testCase of cases) {
			await withTempDirectory('dotnet-txn-fault-', async home => {
				const managedRoot = await seedManagedSdk(home);
				const before = await snapshotTree(managedRoot);
				const lock = await acquireLock(home);
				const result = await prepareDotnetInstallStage({
					home,
					lock,
					fileOperations: {
						copyFile: async () => {
							throw Object.assign(new Error(testCase.name), { code: testCase.code });
						},
					},
				});

				const failed = expectFailed(result, testCase.expected);
				assert.strictEqual(failed.retained, false, testCase.name);
				assert.strictEqual(await pathExists(dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory), false, testCase.name);
				assert.strictEqual(await snapshotTree(managedRoot), before, testCase.name);
				await lock.release();
			});
		}
	});

	test('cleans up when the versioned journal cannot be written', async () => {
		await withTempDirectory('dotnet-txn-journal-', async home => {
			const lock = await acquireLock(home);
			const result = await prepareDotnetInstallStage({
				home,
				lock,
				fileOperations: {
					writeFile: async () => {
						throw Object.assign(new Error('journal io'), { code: 'EIO' });
					},
				},
			});

			const failed = expectFailed(result, 'journal-failed');
			assert.strictEqual(failed.retained, false);
			assert.strictEqual(await pathExists(dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory), false);
			await lock.release();
		});
	});

	test('retains the owned operation directory when cleanup itself fails', async () => {
		await withTempDirectory('dotnet-txn-retain-', async home => {
			const managedRoot = await seedManagedSdk(home);
			const before = await snapshotTree(managedRoot);
			const lock = await acquireLock(home);
			const operationDirectory = dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory;
			const result = await prepareDotnetInstallStage({
				home,
				lock,
				fileOperations: {
					copyFile: async () => {
						throw Object.assign(new Error('copy failed'), { code: 'EIO' });
					},
					remove: async () => {
						throw Object.assign(new Error('busy'), { code: 'EBUSY' });
					},
				},
			});

			const failed = expectFailed(result, 'copy-failed');
			assert.strictEqual(failed.retained, true);
			assert.strictEqual(failed.failure.diagnostic.includes('retained'), true);
			assert.strictEqual(await pathExists(operationDirectory), true);
			assert.strictEqual(await snapshotTree(managedRoot), before);
			await lock.release();
		});
	});

	test('never reuses a pre-existing operation directory', async () => {
		await withTempDirectory('dotnet-txn-existing-', async home => {
			const paths = dotnetTransactionPaths(home, OPERATION_DIRECTORY);
			await fs.mkdir(paths.operationDirectory, { recursive: true });
			await fs.writeFile(path.join(paths.operationDirectory, 'keep.txt'), 'KEEP', 'utf8');
			const lock = await acquireLock(home);
			const failed = expectFailed(await prepareDotnetInstallStage({ home, lock }), 'operation-directory-exists');

			assert.strictEqual(failed.retained, true);
			assert.strictEqual(await fs.readFile(path.join(paths.operationDirectory, 'keep.txt'), 'utf8'), 'KEEP');
			assert.strictEqual(await pathExists(paths.journalPath), false);
			await lock.release();
		});
	});

	test('refuses a symlinked operation directory without writing through it', async () => {
		await withTempDirectory('dotnet-txn-opsymlink-', async home => {
			const external = path.join(home, 'external');
			await fs.mkdir(external);
			const paths = dotnetTransactionPaths(home, OPERATION_DIRECTORY);
			await fs.mkdir(path.dirname(paths.operationDirectory), { recursive: true });
			await fs.symlink(external, paths.operationDirectory, 'dir');
			const lock = await acquireLock(home);
			await expectFailed(await prepareDotnetInstallStage({ home, lock }), 'unsafe-operation-directory');

			assert.deepStrictEqual(await fs.readdir(external), []);
			assert.strictEqual((await fs.lstat(paths.operationDirectory)).isSymbolicLink(), true);
			await lock.release();
		});
	});

	test('refuses a symlinked managed root without touching its target', async () => {
		await withTempDirectory('dotnet-txn-managedlink-', async home => {
			const external = path.join(home, 'external-sdk');
			await fs.mkdir(external, { recursive: true });
			await fs.writeFile(path.join(external, 'dotnet'), 'EXTERNAL', 'utf8');
			const managedRoot = dotnetManagedRoot(home, process.platform);
			await fs.mkdir(path.dirname(managedRoot), { recursive: true });
			await fs.symlink(external, managedRoot, 'dir');
			const lock = await acquireLock(home);
			await expectFailed(await prepareDotnetInstallStage({ home, lock }), 'unsafe-managed-root');

			assert.strictEqual(await fs.readFile(path.join(external, 'dotnet'), 'utf8'), 'EXTERNAL');
			assert.strictEqual(await pathExists(dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory), false);
			await lock.release();
		});

		await withTempDirectory('dotnet-txn-managedfile-', async home => {
			const managedRoot = dotnetManagedRoot(home, process.platform);
			await fs.mkdir(path.dirname(managedRoot), { recursive: true });
			await fs.writeFile(managedRoot, 'NOT-A-DIRECTORY', 'utf8');
			const lock = await acquireLock(home);
			await expectFailed(await prepareDotnetInstallStage({ home, lock }), 'unsafe-managed-root');

			assert.strictEqual(await fs.readFile(managedRoot, 'utf8'), 'NOT-A-DIRECTORY');
			await lock.release();
		});
	});

	test('refuses managed links that escape the managed directory or cannot be resolved', async () => {
		await withTempDirectory('dotnet-txn-external-link-', async home => {
			const managedRoot = dotnetManagedRoot(home, process.platform);
			const outside = path.join(home, 'outside');
			await fs.mkdir(outside, { recursive: true });
			await fs.writeFile(path.join(outside, 'system.dll'), 'SYSTEM', 'utf8');
			await writeManagedFile(managedRoot, path.join('sdk', '10.0.401', 'MSBuild.dll'), 'MSBUILD');
			await fs.symlink(outside, path.join(managedRoot, 'escape'), 'dir');
			const before = await snapshotTree(managedRoot);
			const lock = await acquireLock(home);
			await expectFailed(await prepareDotnetInstallStage({ home, lock }), 'external-link');

			assert.strictEqual(await snapshotTree(managedRoot), before);
			assert.strictEqual(await pathExists(dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory), false);
			assert.strictEqual(await fs.readFile(path.join(outside, 'system.dll'), 'utf8'), 'SYSTEM');
			await lock.release();
		});

		await withTempDirectory('dotnet-txn-broken-link-', async home => {
			const managedRoot = dotnetManagedRoot(home, process.platform);
			await writeManagedFile(managedRoot, 'dotnet', 'HOST');
			await fs.symlink('missing-target', path.join(managedRoot, 'broken'), 'file');
			const before = await snapshotTree(managedRoot);
			const lock = await acquireLock(home);
			await expectFailed(await prepareDotnetInstallStage({ home, lock }), 'unresolvable-link');

			assert.strictEqual(await snapshotTree(managedRoot), before);
			assert.strictEqual(await pathExists(dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory), false);
			await lock.release();
		});
	});

	test('refuses a symlinked walker root before creating any operation directory', async () => {
		await withTempDirectory('dotnet-txn-rootlink-', async home => {
			const external = path.join(home, 'external-walker');
			await fs.mkdir(external);
			await fs.symlink(external, path.join(home, '.walker'), 'dir');
			await expectFailed(await prepareDotnetInstallStage({ home, lock: forgedLock() }), 'unsafe-walker-root');

			assert.deepStrictEqual(await fs.readdir(external), []);
		});
	});

	test('refuses forged operation-directory names outside the walker root', async () => {
		await withTempDirectory('dotnet-txn-opnames-', async home => {
			const operationDirectories = ['../escape', '/absolute/path', 'sdk-stage', `${DOTNET_INSTALL_OPERATION_PREFIX}a/b`, `${DOTNET_INSTALL_OPERATION_PREFIX}..`, `${DOTNET_INSTALL_OPERATION_PREFIX}${'x'.repeat(64)}`, ''];
			for (const operationDirectory of operationDirectories) {
				await expectFailed(await prepareDotnetInstallStage({ home, lock: forgedLock({ operationDirectory }) }), 'unsafe-operation-directory');
			}
			assert.strictEqual(await pathExists(path.join(home, '.walker')), false);
		});
	});

	test('reports a lock that no longer belongs to the operation before creating anything', async () => {
		await withTempDirectory('dotnet-txn-lockgone-', async home => {
			await fs.mkdir(path.join(home, '.walker'), { recursive: true });
			const lock = forgedLock({}, async () => ({ kind: 'retained', reason: 'token-mismatch', detail: 'another owner now holds the lock' }));
			await expectFailed(await prepareDotnetInstallStage({ home, lock }), 'lock-update-failed');

			assert.strictEqual(await pathExists(dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory), false);
		});
	});

	test('derives owned transaction paths inside the walker root on every supported platform', () => {
		const linux = dotnetTransactionPaths('/home/dev', OPERATION_DIRECTORY, 'linux');
		assert.deepStrictEqual(linux, {
			operationDirectory: `/home/dev/.walker/${OPERATION_DIRECTORY}`,
			stageDirectory: `/home/dev/.walker/${OPERATION_DIRECTORY}/${DOTNET_TRANSACTION_STAGE_DIRECTORY_NAME}`,
			backupDirectory: `/home/dev/.walker/${OPERATION_DIRECTORY}/${DOTNET_TRANSACTION_BACKUP_DIRECTORY_NAME}`,
			journalPath: `/home/dev/.walker/${OPERATION_DIRECTORY}/${DOTNET_TRANSACTION_JOURNAL_FILE}`,
			scriptPath: `/home/dev/.walker/${OPERATION_DIRECTORY}/dotnet-install.sh`,
		});
		assert.strictEqual(dotnetTransactionPaths('/Users/dev', OPERATION_DIRECTORY, 'darwin').operationDirectory, `/Users/dev/.walker/${OPERATION_DIRECTORY}`);
		const windows = dotnetTransactionPaths('C:\\Users\\dev', OPERATION_DIRECTORY, 'win32');
		assert.strictEqual(windows.operationDirectory, `C:\\Users\\dev\\.walker\\${OPERATION_DIRECTORY}`);
		assert.strictEqual(windows.stageDirectory, `C:\\Users\\dev\\.walker\\${OPERATION_DIRECTORY}\\stage`);
		assert.strictEqual(windows.backupDirectory, `C:\\Users\\dev\\.walker\\${OPERATION_DIRECTORY}\\backup`);
		assert.strictEqual(windows.journalPath, `C:\\Users\\dev\\.walker\\${OPERATION_DIRECTORY}\\journal.json`);
		assert.strictEqual(windows.scriptPath, `C:\\Users\\dev\\.walker\\${OPERATION_DIRECTORY}\\dotnet-install.ps1`);
	});

	test('mutates staged copies without changing managed originals', async () => {
		await withTempDirectory('dotnet-txn-isolation-', async home => {
			const managedRoot = await seedManagedSdk(home);
			const before = await snapshotTree(managedRoot);
			const lock = await acquireLock(home);
			const prepared = expectPrepared(await prepareDotnetInstallStage({ home, lock }));

			await fs.writeFile(path.join(prepared.stageDirectory, 'dotnet'), 'MUTATED', 'utf8');
			await fs.writeFile(path.join(prepared.stageDirectory, 'sdk', '10.0.401', 'MSBuild.dll'), 'TAMPERED', 'utf8');
			await fs.rm(path.join(prepared.stageDirectory, 'shared'), { recursive: true });
			await fs.writeFile(path.join(prepared.stageDirectory, 'added.txt'), 'NEW', 'utf8');

			assert.strictEqual(await snapshotTree(managedRoot), before);
			assert.strictEqual(await fs.readFile(path.join(managedRoot, 'dotnet'), 'utf8'), '#!/bin/sh\nexit 0\n');
			assert.strictEqual(await fs.readFile(path.join(managedRoot, 'sdk', '10.0.401', 'MSBuild.dll'), 'utf8'), 'MSBUILD-BYTES');
			assert.strictEqual(await pathExists(path.join(managedRoot, 'added.txt')), false);
			await lock.release();
		});
	});

	test('preserves relative links inside the managed tree without following them', async () => {
		await withTempDirectory('dotnet-txn-internal-link-', async home => {
			const managedRoot = dotnetManagedRoot(home, process.platform);
			await writeManagedFile(managedRoot, path.join('sdk', '10.0.401', 'MSBuild.dll'), 'MSBUILD');
			await fs.symlink('10.0.401', path.join(managedRoot, 'sdk', 'current'), 'dir');
			const before = await snapshotTree(managedRoot);
			const lock = await acquireLock(home);
			const prepared = expectPrepared(await prepareDotnetInstallStage({ home, lock }));

			assert.strictEqual(prepared.copied.links, 1);
			const stagedLink = path.join(prepared.stageDirectory, 'sdk', 'current');
			assert.strictEqual((await fs.lstat(stagedLink)).isSymbolicLink(), true);
			assert.strictEqual(await fs.readlink(stagedLink), '10.0.401');
			assert.strictEqual(await fs.readFile(path.join(prepared.stageDirectory, 'sdk', '10.0.401', 'MSBuild.dll'), 'utf8'), 'MSBUILD');
			assert.strictEqual(await snapshotTree(managedRoot), before);
			await lock.release();
		});
	});

	test('prepares a stage for a home path containing spaces', async () => {
		await withTempDirectory('dotnet-txn-spaces-', async directory => {
			const home = path.join(directory, 'walker home with spaces');
			const managedRoot = await seedManagedSdk(home);
			const before = await snapshotTree(managedRoot);
			const lock = await acquireLock(home);
			const prepared = expectPrepared(await prepareDotnetInstallStage({ home, lock }));

			assert.strictEqual(prepared.operationDirectory.startsWith(home), true);
			assert.strictEqual(await modeOf(prepared.operationDirectory), 0o700);
			assert.strictEqual(await fs.readFile(path.join(prepared.stageDirectory, 'dotnet'), 'utf8'), '#!/bin/sh\nexit 0\n');
			assert.strictEqual(await snapshotTree(managedRoot), before);
			await lock.release();
		});
	});

	test('reports a failed cleanup truthfully when cancellation races a removal fault', async () => {
		await withTempDirectory('dotnet-txn-cancel-retain-', async home => {
			const managedRoot = await seedManagedSdk(home);
			const before = await snapshotTree(managedRoot);
			const lock = await acquireLock(home);
			const operationDirectory = dotnetTransactionPaths(home, OPERATION_DIRECTORY).operationDirectory;
			let copies = 0;
			let canceled = false;
			const result = await prepareDotnetInstallStage({
				home,
				lock,
				cancellation: { get isCancellationRequested() { return canceled; } },
				fileOperations: {
					copyFile: async (source, destination) => {
						await fs.copyFile(source, destination);
						copies += 1;
						if (copies === 1) {
							canceled = true;
						}
					},
					remove: async () => {
						throw Object.assign(new Error('busy'), { code: 'EBUSY' });
					},
				},
			});

			assert.strictEqual(result.kind, 'canceled');
			if (result.kind === 'canceled') {
				assert.strictEqual(result.removed, false);
			}
			assert.strictEqual(await pathExists(operationDirectory), true);
			assert.strictEqual(await snapshotTree(managedRoot), before);
			await lock.release();
		});
	});
});
