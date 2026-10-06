/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { UserDataProfileManagementService } from '../../browser/userDataProfileManagement.js';
import { IUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';

const repositoryRoot = process.cwd();

function assertNoSyncStartup(relativePath: string): void {
	const source = readFileSync(join(repositoryRoot, 'src/vs', relativePath), 'utf8');
	const syncReference = source.match(/IUserDataSync|UserDataSync|userDataSync|ISettingsSyncOptions|settingsSyncOptions|SyncResource|SyncStatus|SyncIgnored|ToggleSync|CONTEXT_SYNC|donotSync/);
	assert.ok(!syncReference, `${relativePath} still references ${syncReference?.[0]}`);
}

function assertFileAbsent(relativePath: string): void {
	assert.ok(!existsSync(join(repositoryRoot, 'src/vs', relativePath)), `${relativePath} should be physically absent`);
}

function createProfile(id: string, name: string, isDefault: boolean): IUserDataProfile {
	return {
		id,
		name,
		isDefault,
		location: URI.file(id),
		globalStorageHome: URI.file(`${id}/globalStorage`),
		settingsResource: URI.file(`${id}/settings.json`),
		keybindingsResource: URI.file(`${id}/keybindings.json`),
		tasksResource: URI.file(`${id}/tasks.json`),
		snippetsHome: URI.file(`${id}/snippets`),
		promptsHome: URI.file(`${id}/prompts`),
		extensionsResource: URI.file(`${id}/extensions.json`),
		mcpResource: URI.file(`${id}/mcp.json`),
		languageModelsResource: URI.file(`${id}/languageModels.json`),
		agentPluginsHome: URI.file(`${id}/agentPlugins`),
		cacheHome: URI.file(`${id}/cache`),
	};
}

suite('User data profile Sync boundary', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('shared workbench startup does not construct Sync services', () => {
		assertNoSyncStartup('workbench/workbench.common.main.ts');
	});

	test('local profile settings export has no Sync service dependency', () => {
		const source = readFileSync(join(repositoryRoot, 'src/vs/workbench/services/userDataProfile/browser/settingsResource.ts'), 'utf8');
		const syncReference = source.match(/platform\/userDataSync|IUserDataSync/);
		assert.ok(!syncReference, `settingsResource.ts still references ${syncReference?.[0]}`);
	});

	test('desktop and web startup do not register Sync services', () => {
		assertNoSyncStartup('workbench/workbench.desktop.main.ts');
		assertNoSyncStartup('workbench/workbench.web.main.ts');
		assertNoSyncStartup('workbench/browser/web.main.ts');
	});

	test('web startup options do not expose Sync configuration', () => {
		assertNoSyncStartup('workbench/browser/web.api.ts');
	});

	test('web server and embedder do not forward Sync options', () => {
		assertNoSyncStartup('server/node/webClientServer.ts');
		assertNoSyncStartup('code/browser/workbench/workbench.ts');
		const serverEnvironment = readFileSync(join(repositoryRoot, 'src/vs/server/node/serverEnvironmentService.ts'), 'utf8');
		assert.ok(!serverEnvironment.includes('enable-sync'), 'server CLI still exposes enable-sync');
	});

	test('shared process and server do not register Sync channels', () => {
		assertNoSyncStartup('code/electron-utility/sharedProcess/sharedProcessMain.ts');
		assertNoSyncStartup('server/node/serverServices.ts');

		const sharedProcess = readFileSync(join(repositoryRoot, 'src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts'), 'utf8');
		assert.ok(sharedProcess.includes('services.set(IGlobalExtensionEnablementService,'));
		assert.ok(sharedProcess.includes('services.set(IExtensionStorageService,'));
		assert.ok(sharedProcess.includes("this.server.registerChannel('extensions', channel)"));
	});

	test('Sessions entrypoints do not construct Sync services', () => {
		assertNoSyncStartup('sessions/sessions.common.main.ts');
		assertNoSyncStartup('sessions/sessions.desktop.main.ts');
		assertNoSyncStartup('sessions/sessions.web.main.ts');
	});

	test('legacy state remains inert without a Sync bootstrap reader', () => {
		const sharedProcess = readFileSync(join(repositoryRoot, 'src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts'), 'utf8');
		const syncStateReader = sharedProcess.match(/userDataSync\.enable|UserDataSyncEnablementService|UserDataAutoSyncService/);
		assert.ok(!syncStateReader, `shared process still reads legacy state through ${syncStateReader?.[0]}`);
	});

	test('CLI no longer exposes Sync override flags', () => {
		const source = (path: string) => readFileSync(join(repositoryRoot, 'src/vs', path), 'utf8');
		const commonArgs = source('platform/environment/common/argv.ts');
		assert.ok(!commonArgs.includes("'do-not-sync'"));
		assert.ok(!commonArgs.includes("'sync'?: 'on' | 'off'"));

		const nodeArgs = source('platform/environment/node/argv.ts');
		assert.ok(!nodeArgs.includes("'do-not-sync':"));
		assert.ok(!nodeArgs.includes("'sync': { type: 'string'"));
		assert.ok(!source('platform/environment/common/environment.ts').includes("sync: 'on' | 'off'"));
		assert.ok(!source('platform/environment/common/environmentService.ts').includes('get sync():'));
		for (const path of [
			'platform/environment/common/environment.ts',
			'platform/environment/common/environmentService.ts',
			'workbench/services/environment/browser/environmentService.ts',
		]) {
			assert.ok(!source(path).includes('userDataSyncHome'), `${path} still declares a Sync home`);
		}
		assert.ok(!source('workbench/services/environment/browser/environmentService.ts').includes('get sync():'));

		const standaloneEnvironment = source('editor/standalone/browser/standaloneServices.ts');
		for (const field of ['userDataSyncHome', 'readonly sync:', 'continueOn', 'editSessionId']) {
			assert.ok(!standaloneEnvironment.includes(field), `standalone environment still declares ${field}`);
		}

		for (const path of [
			'code/node/cliProcessMain.ts',
			'server/node/serverEnvironmentService.ts',
			'server/node/remoteExtensionsScanner.ts',
			'server/node/remoteExtensionHostAgentCli.ts',
		]) {
			assert.ok(!source(path).includes('do-not-sync'), `${path} still maps the removed Sync-only CLI flag`);
		}
	});

	test('extension management services do not depend on Sync', () => {
		for (const path of [
			'workbench/services/extensionManagement/common/extensionManagementService.ts',
			'workbench/services/extensionManagement/electron-browser/extensionManagementService.ts',
			'workbench/services/extensionManagement/browser/extensionEnablementService.ts',
		]) {
			assertNoSyncStartup(path);
		}
	});

	test('remote extension initialization does not bootstrap from Sync', () => {
		assertNoSyncStartup('workbench/contrib/extensions/electron-browser/remoteExtensionsInit.ts');
		const contribution = readFileSync(join(repositoryRoot, 'src/vs/workbench/contrib/extensions/electron-browser/extensions.contribution.ts'), 'utf8');
		assert.ok(!contribution.includes('RemoteExtensionsInitializerContribution'));
		assert.ok(contribution.includes('InstallRemoteExtensionsContribution'));
	});

	test('extension install prompts do not offer Sync choices', () => {
		const extensionManagement = readFileSync(join(repositoryRoot, 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts'), 'utf8');
		const installPromptReference = extensionManagement.match(/IUserDataSyncEnablementService|SyncResource|syncCheck/);
		assert.ok(!installPromptReference, `extensionsWorkbenchService.ts still has ${installPromptReference?.[0]} in install prompts`);
		assertNoSyncStartup('workbench/contrib/extensions/browser/extensionRecommendationNotificationService.ts');
	});

	test('extension views and actions do not expose Sync policy controls', () => {
		for (const path of [
			'workbench/contrib/extensions/browser/extensionsWorkbenchService.ts',
			'workbench/contrib/extensions/browser/extensionsActions.ts',
			'workbench/contrib/extensions/test/electron-browser/extensionsActions.test.ts',
			'workbench/contrib/extensions/browser/extensionsList.ts',
			'workbench/contrib/extensions/browser/extensionsWidgets.ts',
			'workbench/contrib/extensions/browser/extensions.contribution.ts',
		]) {
			assertNoSyncStartup(path);
		}

		const extensionApi = readFileSync(join(repositoryRoot, 'src/vs/workbench/contrib/extensions/common/extensions.ts'), 'utf8');
		const syncActionReference = extensionApi.match(/TOGGLE_IGNORE_EXTENSION_ACTION_ID|isExtensionIgnoredToSync|toggleExtensionIgnoredToSync/);
		assert.ok(!syncActionReference, `extensions/common/extensions.ts still exposes ${syncActionReference?.[0]}`);
	});

	test('preferences do not expose Settings Sync controls', () => {
		for (const path of [
			'workbench/contrib/preferences/browser/settingsEditor2.ts',
			'workbench/contrib/preferences/browser/settingsEditorSettingIndicators.ts',
			'workbench/contrib/preferences/browser/settingsLayout.ts',
			'workbench/contrib/preferences/browser/settingsTree.ts',
			'workbench/contrib/preferences/test/browser/settingsEditor2.test.ts',
		]) {
			assertNoSyncStartup(path);
		}
	});

	test('prompt creation and Getting Started do not offer Sync actions', () => {
		for (const path of [
			'workbench/contrib/welcomeGettingStarted/browser/gettingStartedService.ts',
			'workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts',
		]) {
			assertNoSyncStartup(path);
		}
	});

	test('relaunch and updater flows do not wait for Sync', () => {
		assertNoSyncStartup('workbench/contrib/relauncher/browser/relauncher.contribution.ts');
		assertNoSyncStartup('workbench/contrib/update/browser/update.ts');

		const relauncher = readFileSync(join(repositoryRoot, 'src/vs/workbench/contrib/relauncher/browser/relauncher.contribution.ts'), 'utf8');
		assert.ok(relauncher.includes('this.update(e.source !== ConfigurationTarget.DEFAULT'));
		const updater = readFileSync(join(repositoryRoot, 'src/vs/workbench/contrib/update/browser/update.ts'), 'utf8');
		assert.ok(updater.includes('dialogService.confirm({'));
		assert.ok(updater.includes('productQualityChangeHandler(newQuality)'));
	});

	test('deleted workspace identity service stays absent', () => {
		assertFileAbsent('workbench/services/workspaces/common/workspaceIdentityService.ts');
	});

	test('switches between local profiles without consulting Sync state', async () => {
		const defaultProfile = createProfile('default', 'Default', true);
		const localProfile = createProfile('local', 'Local', false);
		let currentProfile = defaultProfile;
		let selectedProfile: IUserDataProfile | undefined;
		let extensionHostStarts = 0;
		const profilesService = {
			_serviceBrand: undefined,
			profiles: [defaultProfile, localProfile],
			defaultProfile,
			onDidChangeProfiles: Event.None,
			setProfileForWorkspace: async (_workspace: unknown, profile: IUserDataProfile) => { selectedProfile = profile; },
		};
		const profileService = {
			_serviceBrand: undefined,
			get currentProfile() { return currentProfile; },
			onDidChangeCurrentProfile: Event.None,
			updateCurrentProfile: async (profile: IUserDataProfile) => { currentProfile = profile; },
		};
		const extensionService = {
			stopExtensionHosts: async () => true,
			startExtensionHosts: async () => { extensionHostStarts++; },
		};
		const constructorArguments: ConstructorParameters<typeof UserDataProfileManagementService> = [
			profilesService as unknown as ConstructorParameters<typeof UserDataProfileManagementService>[0],
			profileService as unknown as ConstructorParameters<typeof UserDataProfileManagementService>[1],
			{} as ConstructorParameters<typeof UserDataProfileManagementService>[2],
			{} as ConstructorParameters<typeof UserDataProfileManagementService>[3],
			{ getWorkspace: () => ({ id: 'empty-window', folders: [] }) } as unknown as ConstructorParameters<typeof UserDataProfileManagementService>[4],
			extensionService as unknown as ConstructorParameters<typeof UserDataProfileManagementService>[5],
			{} as ConstructorParameters<typeof UserDataProfileManagementService>[6],
			{} as ConstructorParameters<typeof UserDataProfileManagementService>[7],
			{} as ConstructorParameters<typeof UserDataProfileManagementService>[8],
			{ getValue: () => undefined } as unknown as ConstructorParameters<typeof UserDataProfileManagementService>[9],
			{} as ConstructorParameters<typeof UserDataProfileManagementService>[10],
			new NullLogService(),
		];
		const service = disposables.add(new UserDataProfileManagementService(...constructorArguments));

		await service.switchProfile(localProfile);

		assert.strictEqual(selectedProfile, localProfile);
		assert.strictEqual(currentProfile, localProfile);
		assert.strictEqual(extensionHostStarts, 1);
	});
});
