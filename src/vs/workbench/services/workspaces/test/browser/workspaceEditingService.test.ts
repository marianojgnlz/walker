/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DidEnterWorkspaceEvent } from '../../browser/abstractWorkspaceEditingService.js';
import { BrowserWorkspaceEditingService } from '../../browser/workspaceEditingService.js';
import { IWorkspace, UNKNOWN_EMPTY_WINDOW_WORKSPACE } from '../../../../../platform/workspace/common/workspace.js';

const repositoryRoot = process.cwd();

function readSource(path: string): string {
	return readFileSync(join(repositoryRoot, path), 'utf8');
}

suite('WorkspaceEditingService', () => {

	suite('DidEnterWorkspaceEvent', () => {

		test('event captures old workspace and new workspace URI', () => {
			const oldWorkspace = { id: 'old-folder', uri: URI.file('/old/folder') };
			const newWorkspace = { id: 'new-workspace', configPath: URI.file('/test/workspace.code-workspace') };
			const event = new DidEnterWorkspaceEvent(oldWorkspace, newWorkspace);

			assert.strictEqual(event.oldWorkspace, oldWorkspace);
			assert.strictEqual(event.newWorkspace, newWorkspace);
		});

		test('join collects promises', async () => {
			const newWorkspace = { id: 'new-workspace', configPath: URI.file('/test/workspace.code-workspace') };
			const event = new DidEnterWorkspaceEvent(UNKNOWN_EMPTY_WINDOW_WORKSPACE, newWorkspace);

			let executed1 = false;
			let executed2 = false;

			event.join(
				(async () => { executed1 = true; })(),
			);

			event.join(
				(async () => { executed2 = true; })(),
			);

			await event.wait();

			assert.strictEqual(executed1, true, 'First promise should have executed');
			assert.strictEqual(executed2, true, 'Second promise should have executed');
		});

		test('wait resolves when all promises complete', async () => {
			const newWorkspace = { id: 'new-workspace', configPath: URI.file('/test/workspace.code-workspace') };
			const event = new DidEnterWorkspaceEvent(UNKNOWN_EMPTY_WINDOW_WORKSPACE, newWorkspace);

			let resolve1: () => void;
			let resolve2: () => void;
			const promise1 = new Promise<void>(r => { resolve1 = r; });
			const promise2 = new Promise<void>(r => { resolve2 = r; });

			event.join(promise1);
			event.join(promise2);

			let waitCompleted = false;
			const waitPromise = event.wait().then(() => { waitCompleted = true; });

			// Should not be completed yet
			await Promise.resolve();
			assert.strictEqual(waitCompleted, false);

			// Resolve first promise
			resolve1!();
			await Promise.resolve();
			assert.strictEqual(waitCompleted, false);

			// Resolve second promise
			resolve2!();
			await waitPromise;
			assert.strictEqual(waitCompleted, true);
		});

		test('wait resolves immediately when no promises are joined', async () => {
			const newWorkspace = { id: 'new-workspace', configPath: URI.file('/test/workspace.code-workspace') };
			const event = new DidEnterWorkspaceEvent(UNKNOWN_EMPTY_WINDOW_WORKSPACE, newWorkspace);

			await event.wait();
			// Should complete without error
		});
	});

	test('cloud edit-session activation and identity-provider API are disconnected', () => {
		const workbenchMain = readSource('src/vs/workbench/workbench.common.main.ts');
		assert.ok(!workbenchMain.includes('contrib/editSessions/browser/editSessions.contribution.js'));
		assert.ok(!workbenchMain.includes('services/workspaces/common/editSessionIdentityService.js'));

		const sessionsMain = readSource('src/vs/sessions/sessions.common.main.ts');
		assert.ok(!sessionsMain.includes('workbench/contrib/editSessions/browser/editSessions.contribution.js'));
		assert.ok(!sessionsMain.includes('workspaces/common/editSessionIdentityService.js'));

		assert.ok(!readSource('src/vs/workbench/api/browser/extensionHost.contribution.ts').includes('mainThreadEditSessionIdentityParticipant.js'));
		assert.ok(!readSource('src/vs/workbench/api/browser/mainThreadWorkspace.ts').includes('IEditSessionIdentityService'));
		assert.ok(!readSource('src/vs/workbench/api/common/extHostWorkspace.ts').includes('registerEditSessionIdentityProvider'));
		const extHostApiImpl = readSource('src/vs/workbench/api/common/extHost.api.impl.ts');
		assert.doesNotMatch(extHostApiImpl, /^\s*(?:registerEditSessionIdentityProvider|onWillCreateEditSessionIdentity|EditSessionIdentityMatch)\s*:/m);
		assert.ok(!readSource('src/vs/workbench/api/common/extHost.protocol.ts').includes('$registerEditSessionIdentityProvider'));

		const gitPackage = readSource('extensions/git/package.json');
		assert.ok(!gitPackage.includes('contribEditSessions'));
		assert.ok(!gitPackage.includes('editSessionIdentityProvider'));
		const gitTsConfig = readSource('extensions/git/tsconfig.json');
		assert.ok(!gitTsConfig.includes('vscode.proposed.editSessionIdentityProvider.d.ts'));
		const gitMain = readSource('extensions/git/src/main.ts');
		assert.ok(!gitMain.includes('GitEditSessionIdentityProvider'));
		assert.ok(gitMain.includes('new GitFileSystemProvider(model, logger)'));
		assert.ok(gitMain.includes('new GitTimelineProvider(model, cc)'));
		assert.ok(gitMain.includes('registerAPICommands'));
		assert.ok(gitMain.includes('new TerminalShellExecutionManager(model, logger)'));
		assert.ok(readSource('extensions/git/src/commands.ts').includes("@command('git.continueInLocalClone')"));
	});

	test('legacy edit-session API command is disconnected', () => {
		const apiCommands = readSource('src/vs/workbench/api/common/extHostApiCommands.ts');
		assert.ok(!apiCommands.includes('vscode.experimental.editSession.continue'));
	});

	test('edit-session launch transport fields are not forwarded', () => {
		const launchPathSources = [
			'src/vs/platform/environment/common/argv.ts',
			'src/vs/platform/environment/common/environment.ts',
			'src/vs/platform/environment/common/environmentService.ts',
			'src/vs/platform/environment/node/argv.ts',
			'src/vs/workbench/services/environment/browser/environmentService.ts',
			'src/vs/workbench/browser/web.api.ts',
			'src/vs/code/electron-main/app.ts',
			'src/vs/platform/windows/electron-main/windowsMainService.ts',
			'src/vs/platform/windows/electron-main/windowImpl.ts',
		];
		for (const path of launchPathSources) {
			assert.doesNotMatch(readSource(path), /\b(?:editSessionId|continueOn)\??\s*[:=]/, path);
		}

		assert.doesNotMatch(readSource('product.json'), /editSessions\.store/);
		assert.ok(readSource('src/vs/code/electron-main/app.ts').includes('handleProtocolUrl'));
	});

	test('local workspace entry still opens its workspace URI', async () => {
		assert.ok(readSource('src/vs/workbench/workbench.desktop.main.ts').includes('services/workspaces/electron-browser/workspaceEditingService.js'));
		assert.ok(readSource('src/vs/workbench/workbench.web.main.ts').includes('services/workspaces/browser/workspaceEditingService.js'));

		interface WorkspaceEditingHarness {
			enterWorkspace(workspaceUri: URI): Promise<void>;
			contextService: { getWorkspace(): IWorkspace };
			doEnterWorkspace(workspaceUri: URI): Promise<{ workspace: unknown } | undefined>;
			fireDidEnterWorkspace(oldWorkspace: unknown, newWorkspace: unknown): Promise<void>;
			hostService: {
				openWindow(openables: { workspaceUri: URI }[], options: { forceReuseWindow: boolean }): Promise<void>;
			};
		}

		const service = Object.create(BrowserWorkspaceEditingService.prototype) as WorkspaceEditingHarness;
		const target = URI.file('/test/local-project.code-workspace');
		let didEnterWorkspace = false;
		let openedWorkspace: { workspaceUri: URI; forceReuseWindow: boolean } | undefined;
		service.contextService = { getWorkspace: () => ({ id: 'current', folders: [] } as IWorkspace) };
		service.doEnterWorkspace = async workspaceUri => ({ workspace: { id: 'target', configPath: workspaceUri } });
		service.fireDidEnterWorkspace = async () => { didEnterWorkspace = true; };
		service.hostService = {
			openWindow: async (openables, options) => {
				openedWorkspace = { workspaceUri: openables[0].workspaceUri, forceReuseWindow: options.forceReuseWindow };
			}
		};

		await service.enterWorkspace(target);

		assert.ok(didEnterWorkspace);
		assert.deepStrictEqual(openedWorkspace, { workspaceUri: target, forceReuseWindow: true });
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
