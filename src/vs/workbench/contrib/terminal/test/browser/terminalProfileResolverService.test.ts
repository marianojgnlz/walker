/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { OperatingSystem } from '../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationResolverService } from '../../../../services/configurationResolver/common/configurationResolver.js';
import { IHistoryService } from '../../../../services/history/common/history.js';
import { IRemoteAgentService } from '../../../../services/remote/common/remoteAgentService.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ITerminalLogService, ITerminalProfile } from '../../../../../platform/terminal/common/terminal.js';
import { ITerminalInstanceService } from '../../browser/terminal.js';
import { ITerminalProfileService } from '../../common/terminal.js';
import { BrowserTerminalProfileResolverService } from '../../browser/terminalProfileResolverService.js';

suite('BrowserTerminalProfileResolverService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('ignores legacy Agent Host profile settings and retains generic profile resolution', async () => {
		const configurationService = new TestConfigurationService({
			terminal: {
				integrated: {
					agentHostProfile: { linux: { path: '/agent-only-shell' } },
					automationProfile: { linux: { path: '/task-shell' } }
				}
			}
		});
		const defaultProfile: ITerminalProfile = { profileName: 'Bash', path: '/bin/bash', args: [], isDefault: true };
		const profileChange = store.add(new Emitter<ITerminalProfile[]>());
		const profileService = {
			profilesReady: Promise.resolve(),
			availableProfiles: [defaultProfile],
			getDefaultProfile: () => defaultProfile,
			onDidChangeAvailableProfiles: profileChange.event
		} as unknown as ITerminalProfileService;
		const backend = {
			getEnvironment: async () => ({}),
			getDefaultSystemShell: async () => '/bin/sh'
		};
		const instanceService = { getBackend: async () => backend } as unknown as ITerminalInstanceService;
		const remoteAgentService = {
			getConnection: () => undefined,
			getEnvironment: async () => null
		} as unknown as IRemoteAgentService;
		const resolver = store.add(new BrowserTerminalProfileResolverService(
			{ resolveWithEnvironment: async (_environment: unknown, _workspace: unknown, value: string) => value } as unknown as IConfigurationResolverService,
			configurationService,
			{ getLastActiveWorkspaceRoot: () => undefined } as unknown as IHistoryService,
			{ error: () => undefined } as unknown as ITerminalLogService,
			instanceService,
			profileService,
			{ getWorkspaceFolder: () => undefined } as unknown as IWorkspaceContextService,
			remoteAgentService
		));

		const defaultResolved = await resolver.getDefaultProfile({ os: OperatingSystem.Linux, remoteAuthority: undefined });
		strictEqual(defaultResolved.path, '/bin/bash');

		const automationResolved = await resolver.getDefaultProfile({ os: OperatingSystem.Linux, remoteAuthority: undefined, allowAutomationShell: true });
		strictEqual(automationResolved.path, '/task-shell');
	});
});
