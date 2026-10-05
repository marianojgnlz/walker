/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const repositoryRoot = process.cwd();

suite('Removed Sync-only extension scope', () => {
	test('does not retain machine-scoped install metadata or the Sync exclusion service', () => {
		const paths = [
			'src/vs/platform/extensionManagement/common/extensionManagement.ts',
			'src/vs/platform/extensionManagement/node/extensionManagementService.ts',
			'src/vs/platform/extensionManagement/common/unsupportedExtensionsMigration.ts',
			'src/vs/workbench/services/extensionManagement/common/webExtensionManagementService.ts',
			'src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts',
			'src/vs/workbench/api/browser/mainThreadCLICommands.ts',
			'src/vs/workbench/services/localization/electron-browser/localeService.ts',
			'src/vs/workbench/contrib/themes/browser/themes.contribution.ts',
			'src/vs/workbench/contrib/remote/browser/remoteIndicator.ts',
			'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupController.ts',
			'extensions/copilot/test/scenarios/test-tools/workspace/chatSetup.ts',
			'extensions/copilot/src/platform/parser/test/node/fixtures/chatSetup.ts',
			'src/vs/workbench/services/userDataProfile/browser/extensionsResource.ts',
			'src/vs/workbench/contrib/extensions/browser/extensionsActions.ts',
			'src/vs/workbench/contrib/extensions/browser/extensionRecommendationNotificationService.ts',
			'src/vs/server/node/remoteExtensionsScanner.ts',
			'src/vs/workbench/test/browser/workbenchTestServices.ts',
		];

		for (const path of paths) {
			const source = readFileSync(join(repositoryRoot, path), 'utf8');
			assert.ok(!source.includes('isMachineScoped'), `${path} still references Sync-only machine scope`);
		}

		const service = readFileSync(join(repositoryRoot, 'src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts'), 'utf8');
		assert.ok(!service.includes('IgnoredExtensionsManagementService'));
		assert.ok(!service.includes('settingsSync.ignoredExtensions'));
		assert.ok(service.includes('isApplicationScoped'), 'application-scoped installation metadata should remain');
		assert.ok(service.includes('profileLocation'), 'profile-scoped installation behavior should remain');

		for (const path of ['src/vs/workbench/workbench.common.main.ts', 'src/vs/sessions/sessions.common.main.ts']) {
			assert.ok(!readFileSync(join(repositoryRoot, path), 'utf8').includes('IgnoredExtensionsManagementService'), `${path} still registers Sync extension scope`);
		}
	});
});
