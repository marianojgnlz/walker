/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { Schemas } from '../../../../base/common/network.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IProgressService, ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IWorkspacesService } from '../../../../platform/workspaces/common/workspaces.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { Extensions as OutputExtensions, IOutputChannelRegistry, IOutputService } from '../../../services/output/common/output.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { CREATE_PROJECT_COMMAND_ID } from '../common/projectWizard.js';
import { consumeDeferredGitInitialization, createDeferredGitInitialization, waitForWorkspaceFolder } from './deferredGitInitialization.js';
import { DOTNET_TOOLCHAIN_COMMANDS, type IDotnetTemplateOperationRequest } from '../../welcomeOnboarding/common/dotnetToolchain.js';
import { runProjectWizard, type IProjectWizardChoice } from './projectWizard.js';

export const DOTNET_PROJECT_OUTPUT_CHANNEL_ID = 'dotnetProject';

Registry.as<IOutputChannelRegistry>(OutputExtensions.OutputChannels).registerChannel({
	id: DOTNET_PROJECT_OUTPUT_CHANNEL_ID,
	label: localize('dotnetProject.outputChannel', ".NET Project"),
	log: false,
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: CREATE_PROJECT_COMMAND_ID,
			title: localize2('newDotnetProject', "New .NET Project"),
			category: Categories.File,
			f1: true,
			menu: {
				id: MenuId.MenubarFileMenu,
				group: '1_new',
				order: 2,
			},
			metadata: {
				description: localize2('newDotnetProject.description', "Create a project from a template installed with the verified local .NET SDK."),
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		const quickInputService = accessor.get(IQuickInputService);
		const fileDialogService = accessor.get(IFileDialogService);
		const fileService = accessor.get(IFileService);
		const progressService = accessor.get(IProgressService);
		const notificationService = accessor.get(INotificationService);
		const workspacesService = accessor.get(IWorkspacesService);
		const hostService = accessor.get(IHostService);
		const outputService = accessor.get(IOutputService);
		const storageService = accessor.get(IStorageService);
		const workspaceContextService = accessor.get(IWorkspaceContextService);

		await runProjectWizard({
			toolchain: {
				getState: () => commandService.executeCommand<unknown>(DOTNET_TOOLCHAIN_COMMANDS.getState),
				setup: () => commandService.executeCommand<unknown>(DOTNET_TOOLCHAIN_COMMANDS.setup),
				recheck: () => commandService.executeCommand<unknown>(DOTNET_TOOLCHAIN_COMMANDS.recheck),
				showOutput: () => commandService.executeCommand<unknown>(DOTNET_TOOLCHAIN_COMMANDS.showOutput),
				runTemplateOperation: (request: IDotnetTemplateOperationRequest) => commandService.executeCommand<unknown>(DOTNET_TOOLCHAIN_COMMANDS.runTemplateOperation, request),
			},
			initializeGit: async folder => {
				await waitForWorkspaceFolder(workspaceContextService, folder);
				await commandService.executeCommand('git.init', true);
			},
			deferGitInitialization: folder => createDeferredGitInitialization(storageService, folder),
			choose: async (choices, title, prompt) => {
				const selected = await quickInputService.pick<IProjectWizardChoice>([...choices], { title, prompt, placeHolder: prompt, ignoreFocusLost: true, canPickMany: false });
				return selected?.id;
			},
			input: options => quickInputService.input({
				title: options.title,
				placeHolder: options.placeHolder,
				prompt: options.prompt,
				ignoreFocusLost: true,
				validateInput: async value => {
					switch (options.validate(value)) {
						case 'empty': return localize('dotnetProject.name.empty', "Enter a project name.");
						case 'format': return localize('dotnetProject.name.format', "Use 1–100 letters or digits, with internal periods, dashes, or underscores only.");
						case 'reserved': return localize('dotnetProject.name.reserved', "This name is reserved on Windows. Choose another project name.");
						default: return undefined;
					}
				},
			}),
			chooseParentLocation: async () => {
				const defaultUri = await fileDialogService.defaultFolderPath(Schemas.file);
				const locations = await fileDialogService.showOpenDialog({
					title: localize('dotnetProject.location.title', "Choose Project Location"),
					openLabel: localize('dotnetProject.location.openLabel', "Choose Folder"),
					defaultUri,
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
				});
				return locations?.[0];
			},
			exists: resource => fileService.exists(resource),
			isDirectory: async resource => {
				try {
					return (await fileService.resolve(resource)).isDirectory;
				} catch {
					return false;
				}
			},
			withProgress: (title, task) => {
				const cancellation = new CancellationTokenSource();
				return progressService.withProgress(
					{ location: ProgressLocation.Notification, title, cancellable: true },
					reporter => task(message => reporter.report({ message }), cancellation.token),
					() => cancellation.cancel(),
				).finally(() => cancellation.dispose());
			},
			appendOutput: line => {
				const channel = outputService.getChannel(DOTNET_PROJECT_OUTPUT_CHANNEL_ID);
				channel?.append(`${line}\n`);
			},
			reportFailure: (message, details) => reportProjectFailure(commandService, notificationService, outputService, message, details),
			warn: message => notificationService.warn(message),
			info: message => notificationService.info(message),
			addRecentlyOpened: folder => workspacesService.addRecentlyOpened([{ folderUri: folder }]),
			open: (folder, newWindow) => hostService.openWindow([{ folderUri: folder }], { forceNewWindow: newWindow, forceReuseWindow: !newWindow }),
		});
	}
});

function reportProjectFailure(commandService: ICommandService, notificationService: INotificationService, outputService: IOutputService, message: string, details: string): void {
	const channel = outputService.getChannel(DOTNET_PROJECT_OUTPUT_CHANNEL_ID);
	channel?.append(`${message}\n${details}\n`);
	notificationService.prompt(Severity.Error, message, [
		{ label: localize('dotnetProject.showOutput', "Show Output"), run: () => { void outputService.showChannel(DOTNET_PROJECT_OUTPUT_CHANNEL_ID); } },
		{ label: localize('dotnetProject.reportIssue', "Report Issue"), run: () => { void commandService.executeCommand('workbench.action.openIssueReporter'); } },
	]);
}

export class DeferredProjectWizardGitInitializationContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.projectWizard.deferredGitInitialization';

	constructor(
		@IStorageService storageService: IStorageService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@ICommandService commandService: ICommandService,
		@INotificationService notificationService: INotificationService,
		@IOutputService outputService: IOutputService,
	) {
		super();
		const folders = workspaceContextService.getWorkspace().folders;
		if (folders.length !== 1 || folders[0].uri.scheme !== Schemas.file) {
			return;
		}
		void consumeDeferredGitInitialization(storageService, folders[0].uri, async () => {
			await commandService.executeCommand<void>('git.init', true);
			notificationService.info(localize('dotnetProject.git.initialized', "Git was initialized in the created project."));
		}).catch(error => {
			const details = error instanceof Error ? error.message : String(error);
			reportProjectFailure(commandService, notificationService, outputService, localize('dotnetProject.git.deferredFailure', "Git initialization failed in the new project window. The generated project was preserved."), details);
		});
	}
}

registerWorkbenchContribution2(DeferredProjectWizardGitInitializationContribution.ID, DeferredProjectWizardGitInitializationContribution, WorkbenchPhase.AfterRestored);
