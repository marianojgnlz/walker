/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { toAction } from '../../../../base/common/actions.js';
import Severity from '../../../../base/common/severity.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService, IWorkspaceTrustTransitionParticipant } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IHostService } from '../../../services/host/browser/host.js';

export async function stopExtensionHostForWorkspaceTrustTransition(
	extensionService: Pick<IExtensionService, 'stopExtensionHosts' | 'startExtensionHosts'>,
	hostService: Pick<IHostService, 'reload'>,
	extensionEnablementService: Pick<IWorkbenchExtensionEnablementService, 'updateExtensionsEnablementsWhenWorkspaceTrustChanges'>,
	notificationService: Pick<INotificationService, 'notify'>,
): Promise<void> {
	const stopped = await extensionService.stopExtensionHosts(localize('restartExtensionHost.reason', "Changing workspace trust; other extensions sharing the host may be interrupted"));
	await extensionEnablementService.updateExtensionsEnablementsWhenWorkspaceTrustChanges();
	if (stopped) {
		extensionService.startExtensionHosts();
	} else {
		notificationService.notify({
			severity: Severity.Error,
			message: localize('csharpEditingTrustStopFailed', "The shared extension host could not be stopped after workspace trust changed, so C# editing may still be running. Reload the window before using C# editing again."),
			actions: {
				primary: [toAction({ id: 'reloadAfterTrustChange', label: localize('reloadWindow', "Reload Window"), run: () => hostService.reload() })]
			}
		});
	}
}

export class ExtensionEnablementWorkspaceTrustTransitionParticipant extends Disposable implements IWorkbenchContribution {
	constructor(
		@IExtensionService extensionService: IExtensionService,
		@IHostService hostService: IHostService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IWorkbenchExtensionEnablementService extensionEnablementService: IWorkbenchExtensionEnablementService,
		@IWorkspaceTrustEnablementService workspaceTrustEnablementService: IWorkspaceTrustEnablementService,
		@IWorkspaceTrustManagementService workspaceTrustManagementService: IWorkspaceTrustManagementService,
		@INotificationService notificationService: INotificationService,
	) {
		super();

		if (workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
			// The extension enablement participant will be registered only after the
			// workspace trust state has been initialized. There is no need to execute
			// the participant as part of the initialization process, as the workspace
			// trust state is initialized before starting the extension host.
			workspaceTrustManagementService.workspaceTrustInitialized.then(() => {
				const workspaceTrustTransitionParticipant = new class implements IWorkspaceTrustTransitionParticipant {
					async participate(trusted: boolean): Promise<void> {
						if (trusted) {
							// Untrusted -> Trusted
							await extensionEnablementService.updateExtensionsEnablementsWhenWorkspaceTrustChanges();
						} else {
							// Trusted -> Untrusted
							if (environmentService.remoteAuthority) {
								hostService.reload();
							} else {
								await stopExtensionHostForWorkspaceTrustTransition(extensionService, hostService, extensionEnablementService, notificationService);
							}
						}
					}
				};

				// Execute BEFORE the workspace trust transition completes
				this._register(workspaceTrustManagementService.addWorkspaceTrustTransitionParticipant(workspaceTrustTransitionParticipant));
			});
		}
	}
}
