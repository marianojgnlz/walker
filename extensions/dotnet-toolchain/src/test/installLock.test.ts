/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { DotnetToolchainProgressPhase } from '../contracts';
import {
	DOTNET_INSTALL_LOCK_DIRECTORY_NAME,
	DOTNET_INSTALL_LOCK_METADATA_FILE,
	DOTNET_INSTALL_OPERATION_PREFIX,
	acquireDotnetInstallLock,
	dotnetInstallLockPath,
	dotnetInstallWalkerRoot,
	inspectDotnetInstallLock,
	type DotnetInstallLockAcquireResult,
	type DotnetInstallLockStatus,
	type IDotnetInstallLock,
} from '../installLock';
import { withTempDirectory } from './fixtures';
import { createInstallerProcessRunner } from '../processRunner';

const OWNER_TOKEN = 'token-owner-0001';
const OTHER_TOKEN = 'token-owner-0002';
const OPERATION_DIRECTORY = `${DOTNET_INSTALL_OPERATION_PREFIX}unit-0001`;

/** File path of the owner metadata inside one lock directory. */
function metadataFile(lockPath: string): string {
	return path.join(lockPath, DOTNET_INSTALL_LOCK_METADATA_FILE);
}

/** Serialized valid metadata with focused overrides; `undefined` values drop the key. */
function lockMetadataJson(overrides: Record<string, unknown> = {}): string {
	return JSON.stringify({ schemaVersion: 1, token: OWNER_TOKEN, pid: process.pid, phase: 'installing', operationDirectory: OPERATION_DIRECTORY, ...overrides });
}

/** Narrows an acquisition result, failing loudly on busier or unsafe outcomes. */
function expectAcquired(result: DotnetInstallLockAcquireResult): IDotnetInstallLock {
	if (result.kind !== 'acquired') {
		throw new Error(`expected an acquired lock, received ${result.kind}`);
	}
	return result.lock;
}

/** Narrows an acquisition or inspection result to one kind for property assertions. */
function expectStatus<TKind extends DotnetInstallLockStatus['kind']>(status: DotnetInstallLockStatus | DotnetInstallLockAcquireResult, kind: TKind): Extract<DotnetInstallLockStatus, { kind: TKind }> {
	if (status.kind !== kind) {
		throw new Error(`expected ${kind}, received ${status.kind}`);
	}
	return status as unknown as Extract<DotnetInstallLockStatus, { kind: TKind }>;
}

/** True when a path exists as any node type; used for "was anything written" assertions. */
async function pathExists(candidate: string): Promise<boolean> {
	try {
		await fs.lstat(candidate);
		return true;
	} catch {
		return false;
	}
}

/** Reads and parses the persisted owner metadata without any validation. */
async function readMetadataFile(lockPath: string): Promise<Record<string, unknown>> {
	return JSON.parse(await fs.readFile(metadataFile(lockPath), 'utf8'));
}

/** Creates the lock directory and optionally writes raw metadata content into it. */
async function createLock(lockPath: string, metadataContent?: string): Promise<void> {
	await fs.mkdir(lockPath, { recursive: true });
	if (metadataContent !== undefined) {
		await fs.writeFile(metadataFile(lockPath), metadataContent, 'utf8');
	}
}

suite('install lock acquisition', () => {
	test('acquires an exclusive home-scoped lock and releases only its own metadata', async () => {
		await withTempDirectory('dotnet-lock-', async home => {
			const walkerRoot = dotnetInstallWalkerRoot(home, process.platform);
			const lockPath = dotnetInstallLockPath(home, process.platform);
			assert.strictEqual(lockPath, path.join(home, '.walker', DOTNET_INSTALL_LOCK_DIRECTORY_NAME));
			assert.strictEqual(lockPath.startsWith(`${walkerRoot}${path.sep}`), true);

			const acquired = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: OPERATION_DIRECTORY, createToken: () => OWNER_TOKEN }));
			assert.deepStrictEqual(await readMetadataFile(lockPath), {
				schemaVersion: 1,
				token: OWNER_TOKEN,
				pid: process.pid,
				phase: 'installing',
				operationDirectory: OPERATION_DIRECTORY,
			});
			const busy = expectStatus(await inspectDotnetInstallLock({ home }), 'busy');
			assert.strictEqual(busy.owner.token, OWNER_TOKEN);

			assert.deepStrictEqual(await acquired.release(), { kind: 'applied' });
			assert.strictEqual(await pathExists(lockPath), false);
			assert.strictEqual((await inspectDotnetInstallLock({ home })).kind, 'free');
		});
	});

	test('reports a live competing owner as busy and never creates a second lock', async () => {
		await withTempDirectory('dotnet-lock-busy-', async home => {
			const lockPath = dotnetInstallLockPath(home, process.platform);
			const first = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: OPERATION_DIRECTORY, createToken: () => OWNER_TOKEN }));

			const competing = await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: `${DOTNET_INSTALL_OPERATION_PREFIX}other`, createToken: () => OTHER_TOKEN });
			const busy = expectStatus(competing, 'busy');
			assert.deepStrictEqual(busy.owner, { schemaVersion: 1, token: OWNER_TOKEN, pid: process.pid, phase: 'installing', operationDirectory: OPERATION_DIRECTORY });
			assert.strictEqual((await readMetadataFile(lockPath)).token, OWNER_TOKEN);

			assert.deepStrictEqual(await first.release(), { kind: 'applied' });
			const successor = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: `${DOTNET_INSTALL_OPERATION_PREFIX}other`, createToken: () => OTHER_TOKEN }));
			assert.strictEqual((await readMetadataFile(lockPath)).token, OTHER_TOKEN);
			await successor.release();
		});
	});

	test('treats repeated acquisition and repeated release conservatively', async () => {
		await withTempDirectory('dotnet-lock-repeat-', async home => {
			const lockPath = dotnetInstallLockPath(home, process.platform);
			const acquired = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'preparing', operationDirectory: OPERATION_DIRECTORY, createToken: () => OWNER_TOKEN }));

			const repeated = await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: OPERATION_DIRECTORY, createToken: () => OTHER_TOKEN });
			expectStatus(repeated, 'busy');

			assert.deepStrictEqual(await acquired.release(), { kind: 'applied' });
			assert.deepStrictEqual(await acquired.release(), { kind: 'applied' });
			assert.strictEqual(await pathExists(lockPath), false);
		});
	});

	test('updates owner phase metadata for the same token and retains it for a foreign token', async () => {
		await withTempDirectory('dotnet-lock-update-', async home => {
			const lockPath = dotnetInstallLockPath(home, process.platform);
			const acquired = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'preparing', operationDirectory: OPERATION_DIRECTORY, createToken: () => OWNER_TOKEN }));
			assert.deepStrictEqual(await acquired.update({ phase: 'verifying', diagnostics: 'finalizing publication' }), { kind: 'applied' });
			const persisted = await readMetadataFile(lockPath);
			assert.strictEqual(persisted.phase, 'verifying');
			assert.strictEqual(persisted.diagnostics, 'finalizing publication');

			await fs.rm(lockPath, { recursive: true });
			const replacement = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: `${DOTNET_INSTALL_OPERATION_PREFIX}other`, createToken: () => OTHER_TOKEN }));

			const retained = await acquired.update({ phase: 'installing' });
			assert.strictEqual(retained.kind, 'retained');
			if (retained.kind === 'retained') {
				assert.strictEqual(retained.reason, 'token-mismatch');
			}
			assert.strictEqual((await readMetadataFile(lockPath)).token, OTHER_TOKEN);
			const replacementState = expectStatus(await inspectDotnetInstallLock({ home }), 'busy');
			assert.strictEqual(replacementState.owner.token, OTHER_TOKEN);
			await replacement.release();
		});
	});

	test('retains a lock that no longer carries the releasing owner token', async () => {
		await withTempDirectory('dotnet-lock-mismatch-', async home => {
			const lockPath = dotnetInstallLockPath(home, process.platform);
			const acquired = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: OPERATION_DIRECTORY, createToken: () => OWNER_TOKEN }));

			await fs.rm(lockPath, { recursive: true });
			const replacement = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: `${DOTNET_INSTALL_OPERATION_PREFIX}other`, createToken: () => OTHER_TOKEN }));

			const released = await acquired.release();
			assert.strictEqual(released.kind, 'retained');
			if (released.kind === 'retained') {
				assert.strictEqual(released.reason, 'token-mismatch');
			}
			assert.strictEqual(await pathExists(metadataFile(lockPath)), true);
			assert.strictEqual((await readMetadataFile(lockPath)).token, OTHER_TOKEN);
			await replacement.release();
		});
	});

	test('rejects unvalidated operation directory and phase inputs before touching the home', async () => {
		await withTempDirectory('dotnet-lock-input-', async home => {
			const walkerRoot = dotnetInstallWalkerRoot(home, process.platform);
			const lockPath = dotnetInstallLockPath(home, process.platform);
			for (const operationDirectory of ['../escape', '/absolute/path', 'sdk-stage', `${DOTNET_INSTALL_OPERATION_PREFIX}a/b`, `${DOTNET_INSTALL_OPERATION_PREFIX}..`, `${DOTNET_INSTALL_OPERATION_PREFIX}${'x'.repeat(64)}`, '']) {
				const result = await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory });
				assert.strictEqual(result.kind, 'failed', `expected rejection for operation directory ${JSON.stringify(operationDirectory)}`);
			}
			const invalidPhase = await acquireDotnetInstallLock({ home, phase: 'reconciling' as DotnetToolchainProgressPhase, operationDirectory: OPERATION_DIRECTORY });
			assert.strictEqual(invalidPhase.kind, 'failed');
			assert.strictEqual(await pathExists(walkerRoot), false);
			assert.strictEqual(await pathExists(lockPath), false);
		});
	});

	test('refuses a symlinked lock path without writing through it', async () => {
		await withTempDirectory('dotnet-lock-symlink-', async home => {
			const walkerRoot = dotnetInstallWalkerRoot(home, process.platform);
			const lockPath = dotnetInstallLockPath(home, process.platform);
			const redirected = path.join(home, 'redirected');
			await fs.mkdir(walkerRoot, { recursive: true });
			await fs.mkdir(redirected);
			await fs.symlink(redirected, lockPath, 'dir');

			assert.strictEqual((await inspectDotnetInstallLock({ home })).kind, 'unsafe');
			assert.strictEqual((await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: OPERATION_DIRECTORY })).kind, 'unsafe');
			assert.strictEqual(await pathExists(metadataFile(redirected)), false);
			assert.deepStrictEqual(await fs.readdir(redirected), []);
			assert.strictEqual((await fs.lstat(lockPath)).isSymbolicLink(), true);
		});
	});

	test('refuses a symlinked walker root without creating a redirected lock', async () => {
		await withTempDirectory('dotnet-lock-root-symlink-', async home => {
			const walkerRoot = dotnetInstallWalkerRoot(home, process.platform);
			const redirected = path.join(home, 'redirected');
			await fs.mkdir(redirected);
			await fs.symlink(redirected, walkerRoot, 'dir');

			assert.strictEqual((await inspectDotnetInstallLock({ home })).kind, 'unsafe');
			assert.strictEqual((await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: OPERATION_DIRECTORY })).kind, 'unsafe');
			assert.deepStrictEqual(await fs.readdir(redirected), []);
		});
	});

	test('derives the same home-scoped lock location on every supported platform', () => {
		assert.strictEqual(dotnetInstallWalkerRoot('/home/dev', 'linux'), '/home/dev/.walker');
		assert.strictEqual(dotnetInstallLockPath('/home/dev', 'linux'), '/home/dev/.walker/dotnet-install.lock');
		assert.strictEqual(dotnetInstallLockPath('/Users/dev', 'darwin'), '/Users/dev/.walker/dotnet-install.lock');
		assert.strictEqual(dotnetInstallLockPath('C:\\Users\\dev', 'win32'), 'C:\\Users\\dev\\.walker\\dotnet-install.lock');
	});
});

suite('install lock status inspection', () => {
	test('reports a verified live owner as busy and an unconvincing live pid conservatively', async () => {
		await withTempDirectory('dotnet-lock-live-', async home => {
			const lockPath = dotnetInstallLockPath(home, process.platform);
			assert.strictEqual((await inspectDotnetInstallLock({ home })).kind, 'free');

			const acquired = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'verifying', operationDirectory: OPERATION_DIRECTORY, createToken: () => OWNER_TOKEN }));
			const busy = expectStatus(await inspectDotnetInstallLock({ home }), 'busy');
			assert.strictEqual(busy.owner.pid, process.pid);
			assert.strictEqual(busy.owner.phase, 'verifying');
			await acquired.release();

			await createLock(lockPath, lockMetadataJson({ pid: 2147483646 }));
			const ambiguous = expectStatus(await inspectDotnetInstallLock({ home, isProcessAlive: () => true }), 'busy');
			assert.strictEqual(ambiguous.owner.pid, 2147483646);
			const blocked = await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: OPERATION_DIRECTORY, isProcessAlive: () => true });
			expectStatus(blocked, 'busy');
		});
	});

	test('never reclaims a stale lock whose owner may have left children behind', async () => {
		await withTempDirectory('dotnet-lock-stale-', async home => {
			const lockPath = dotnetInstallLockPath(home, process.platform);
			await createLock(lockPath, lockMetadataJson({ pid: 2147483646, phase: 'installing' }));

			const stale = expectStatus(await inspectDotnetInstallLock({ home, isProcessAlive: () => false }), 'recovery-required');
			assert.strictEqual(stale.reason, 'owner-not-live');
			assert.strictEqual(stale.detail.includes('children'), true);

			const blocked = await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: OPERATION_DIRECTORY, isProcessAlive: () => false });
			expectStatus(blocked, 'recovery-required');

			assert.strictEqual(await pathExists(metadataFile(lockPath)), true);
			assert.strictEqual((await readMetadataFile(lockPath)).pid, 2147483646);
		});
	});

	test('reports partial or malformed metadata as recovery-required without reclaiming', async () => {
		await withTempDirectory('dotnet-lock-partial-', async home => {
			const lockPath = dotnetInstallLockPath(home, process.platform);
			const cases: readonly { readonly name: string; readonly reason: 'metadata-missing' | 'metadata-invalid'; readonly prepare?: (lockPathToPrepare: string) => Promise<unknown>; readonly metadata?: string }[] = [
				{ name: 'missing owner metadata', reason: 'metadata-missing' },
				{ name: 'temporary metadata file only', reason: 'metadata-missing', prepare: async lock => fs.writeFile(`${metadataFile(lock)}.tmp-${OWNER_TOKEN}`, lockMetadataJson(), 'utf8') },
				{ name: 'empty metadata file', reason: 'metadata-invalid', metadata: '' },
				{ name: 'truncated metadata json', reason: 'metadata-invalid', metadata: '{"schemaVersion":1,"token":"' },
				{ name: 'unknown schema version', reason: 'metadata-invalid', metadata: lockMetadataJson({ schemaVersion: 2 }) },
				{ name: 'missing owner token', reason: 'metadata-invalid', metadata: lockMetadataJson({ token: undefined }) },
				{ name: 'blank owner token', reason: 'metadata-invalid', metadata: lockMetadataJson({ token: '' }) },
				{ name: 'traversal operation directory', reason: 'metadata-invalid', metadata: lockMetadataJson({ operationDirectory: '../escape' }) },
				{ name: 'absolute operation directory', reason: 'metadata-invalid', metadata: lockMetadataJson({ operationDirectory: '/tmp/escape' }) },
				{ name: 'unexpected operation directory prefix', reason: 'metadata-invalid', metadata: lockMetadataJson({ operationDirectory: 'sdk-stage' }) },
				{ name: 'unknown phase', reason: 'metadata-invalid', metadata: lockMetadataJson({ phase: 'reconciling' }) },
				{ name: 'non-numeric owner pid', reason: 'metadata-invalid', metadata: lockMetadataJson({ pid: '123' }) },
				{ name: 'zero owner pid', reason: 'metadata-invalid', metadata: lockMetadataJson({ pid: 0 }) },
				{ name: 'non-string diagnostics', reason: 'metadata-invalid', metadata: lockMetadataJson({ diagnostics: { note: 'unexpected' } }) },
				{ name: 'unknown metadata field', reason: 'metadata-invalid', metadata: lockMetadataJson({ heartbeat: 42 }) },
				{ name: 'directory instead of metadata file', reason: 'metadata-invalid', prepare: async lock => fs.mkdir(metadataFile(lock), { recursive: true }) },
			];

			for (const testCase of cases) {
				await fs.rm(lockPath, { recursive: true, force: true });
				await fs.mkdir(lockPath, { recursive: true });
				if (testCase.metadata !== undefined) {
					await fs.writeFile(metadataFile(lockPath), testCase.metadata, 'utf8');
				}
				if (testCase.prepare !== undefined) {
					await testCase.prepare(lockPath);
				}

				const inspected = await inspectDotnetInstallLock({ home });
				const recovery = expectStatus(inspected, 'recovery-required');
				assert.strictEqual(recovery.reason, testCase.reason, testCase.name);
				assert.strictEqual(recovery.detail.length > 0, true, testCase.name);

				const blocked = await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: OPERATION_DIRECTORY });
				expectStatus(blocked, 'recovery-required');
				assert.strictEqual(await pathExists(lockPath), true, testCase.name);
			}
		});
	});
});

/** Resolves after `milliseconds` real time; used only by the cross-process fixtures. */
function delay(milliseconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/** True while the OS still reports the process identifier as live. */
function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === 'EPERM';
	}
}

/** Best-effort `SIGKILL` used only to guarantee fixture cleanup. */
function killIfAlive(pid: number | undefined): void {
	if (pid === undefined) {
		return;
	}
	try {
		process.kill(pid, 'SIGKILL');
	} catch {
		// already gone
	}
}

/** Waits for a file written by a fixture child and returns its trimmed content. */
async function waitForFile(filePath: string, timeoutMs: number): Promise<string> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const content = (await fs.readFile(filePath, 'utf8')).trim();
			if (content.length > 0) {
				return content;
			}
		} catch {
			// not written yet
		}
		await delay(20);
	}
	throw new Error(`fixture child did not write ${filePath} within ${timeoutMs} ms`);
}

/** Waits until the OS reports the process identifier as gone. */
async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (!isProcessAlive(pid)) {
			return true;
		}
		await delay(20);
	}
	return !isProcessAlive(pid);
}

/** Environment for the real lock-holder child; the module path points at compiled output. */
function lockHolderEnvironment(home: string): Record<string, string> {
	return {
		WALKER_LOCK_MODULE: path.join(__dirname, '..', 'installLock.js'),
		WALKER_TEST_HOME: home,
		WALKER_READY_FILE: path.join(home, 'ready.json'),
		WALKER_HELD_FILE: path.join(home, 'held'),
		WALKER_RELEASE_FILE: path.join(home, 'release'),
		WALKER_RELEASED_FILE: path.join(home, 'released'),
	};
}

/** Real independent controller: acquires the lock, reports readiness, waits, then releases. */
const LOCK_HOLDER_SCRIPT = `
const fs = require('node:fs');
const lock = require(process.env.WALKER_LOCK_MODULE);
(async () => {
	const result = await lock.acquireDotnetInstallLock({ home: process.env.WALKER_TEST_HOME, phase: 'installing', operationDirectory: 'dotnet-install-holder' });
	fs.writeFileSync(process.env.WALKER_READY_FILE, JSON.stringify({ kind: result.kind }));
	if (result.kind !== 'acquired') { process.exit(3); }
	fs.writeFileSync(process.env.WALKER_HELD_FILE, String(result.lock.metadata.pid));
	while (!fs.existsSync(process.env.WALKER_RELEASE_FILE)) { await new Promise(resolve => setTimeout(resolve, 20)); }
	const released = await result.lock.release();
	fs.writeFileSync(process.env.WALKER_RELEASED_FILE, released.kind + (released.reason ? ':' + released.reason : ''));
	process.exit(released.kind === 'applied' ? 0 : 4);
})().catch(error => { console.error(error); process.exit(5); });
`;

suite('install lock across independent controllers and processes', () => {
	test('frees the lock for the next controller after a canceled owner releases', async () => {
		await withTempDirectory('dotnet-lock-cancel-', async home => {
			const lockPath = dotnetInstallLockPath(home, process.platform);
			const canceled = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: OPERATION_DIRECTORY, createToken: () => OWNER_TOKEN }));
			assert.deepStrictEqual(await canceled.update({ phase: 'verifying', diagnostics: 'cancel requested' }), { kind: 'applied' });
			assert.deepStrictEqual(await canceled.release(), { kind: 'applied' });
			assert.strictEqual((await inspectDotnetInstallLock({ home })).kind, 'free');

			const successor = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: `${DOTNET_INSTALL_OPERATION_PREFIX}successor`, createToken: () => OTHER_TOKEN }));
			assert.strictEqual((await readMetadataFile(lockPath)).token, OTHER_TOKEN);
			assert.deepStrictEqual(await successor.release(), { kind: 'applied' });
		});
	});

	test('keeps every concurrent metadata read valid while the owner updates phases', async () => {
		await withTempDirectory('dotnet-lock-race-', async home => {
			const lockPath = dotnetInstallLockPath(home, process.platform);
			const acquired = expectAcquired(await acquireDotnetInstallLock({ home, phase: 'preparing', operationDirectory: OPERATION_DIRECTORY, createToken: () => OWNER_TOKEN }));
			const phases: readonly DotnetToolchainProgressPhase[] = ['preparing', 'downloading', 'installing', 'verifying', 'finalizing'];
			const observed: DotnetInstallLockStatus[] = [];
			const updater = (async () => {
				for (const phase of phases) {
					assert.deepStrictEqual(await acquired.update({ phase }), { kind: 'applied' });
				}
			})();
			const reader = (async () => {
				for (let index = 0; index < 30; index++) {
					observed.push(await inspectDotnetInstallLock({ home }));
					await delay(1);
				}
			})();
			await Promise.all([updater, reader]);

			assert.strictEqual(observed.length, 30);
			for (const status of observed) {
				const busy = expectStatus(status, 'busy');
				assert.strictEqual(busy.owner.token, OWNER_TOKEN);
				assert.strictEqual(phases.includes(busy.owner.phase), true);
			}
			assert.strictEqual((await readMetadataFile(lockPath)).phase, 'finalizing');
			assert.deepStrictEqual(await acquired.release(), { kind: 'applied' });
		});
	});

	test('reports a separate process owner as busy and free again after it releases', async function () {
		this.timeout(30_000);
		if (process.platform === 'win32') {
			this.skip();
		}
		await withTempDirectory('dotnet-lock-process-', async home => {
			const runner = createInstallerProcessRunner({ terminationGraceMs: 250, terminationWaitMs: 10_000, terminationPollMs: 20, overallBudgetMs: 120_000 });
			const running = runner.run({ executable: process.execPath, args: ['-e', LOCK_HOLDER_SCRIPT], cwd: home, env: lockHolderEnvironment(home) });
			try {
				assert.deepStrictEqual(JSON.parse(await waitForFile(path.join(home, 'ready.json'), 15_000)), { kind: 'acquired' });
				const holderPid = Number.parseInt(await waitForFile(path.join(home, 'held'), 15_000), 10);
				const busy = expectStatus(await inspectDotnetInstallLock({ home }), 'busy');
				assert.strictEqual(busy.owner.pid, holderPid);
				assert.strictEqual(busy.owner.phase, 'installing');
				assert.strictEqual(busy.owner.operationDirectory, `${DOTNET_INSTALL_OPERATION_PREFIX}holder`);

				await fs.writeFile(path.join(home, 'release'), 'release', 'utf8');
				assert.strictEqual(await waitForFile(path.join(home, 'released'), 15_000), 'applied');
				const result = await running;
				assert.deepStrictEqual([result.outcome, result.recoveryRequired], ['exited', false]);
				assert.strictEqual((await inspectDotnetInstallLock({ home })).kind, 'free');
			} finally {
				await fs.writeFile(path.join(home, 'release'), 'release', 'utf8').catch(() => undefined);
				runner.cancel();
				await running.catch(() => undefined);
			}
		});
	});

	test('retains a canceled process owner lock as recovery-required instead of reclaiming it', async function () {
		this.timeout(30_000);
		if (process.platform === 'win32') {
			this.skip();
		}
		await withTempDirectory('dotnet-lock-orphan-', async home => {
			const lockPath = dotnetInstallLockPath(home, process.platform);
			const runner = createInstallerProcessRunner({ terminationGraceMs: 250, terminationWaitMs: 10_000, terminationPollMs: 20, overallBudgetMs: 120_000 });
			const running = runner.run({ executable: process.execPath, args: ['-e', LOCK_HOLDER_SCRIPT], cwd: home, env: lockHolderEnvironment(home) });
			let holderPid: number | undefined;
			try {
				await waitForFile(path.join(home, 'ready.json'), 15_000);
				holderPid = Number.parseInt(await waitForFile(path.join(home, 'held'), 15_000), 10);
				runner.cancel();
				const result = await running;
				assert.deepStrictEqual([result.outcome, result.terminationReason, result.recoveryRequired], ['terminated', 'canceled', false]);
				assert.strictEqual(await waitForProcessExit(holderPid, 10_000), true);

				const stale = expectStatus(await inspectDotnetInstallLock({ home }), 'recovery-required');
				assert.strictEqual(stale.reason, 'owner-not-live');
				assert.strictEqual(await pathExists(metadataFile(lockPath)), true);
				const blocked = await acquireDotnetInstallLock({ home, phase: 'installing', operationDirectory: `${DOTNET_INSTALL_OPERATION_PREFIX}successor` });
				expectStatus(blocked, 'recovery-required');
				assert.strictEqual((await readMetadataFile(lockPath)).pid, holderPid);
			} finally {
				runner.cancel();
				await running.catch(() => undefined);
				killIfAlive(holderPid);
			}
		});
	});
});
