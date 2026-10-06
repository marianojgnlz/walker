/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { assertNever } from '../../../../base/common/assert.js';
import { disposableTimeout } from '../../../../base/common/async.js';
import { parse as parseJsonc } from '../../../../base/common/jsonc.js';
import { mnemonicButtonLabel } from '../../../../base/common/labels.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { autorunSelfDisposable } from '../../../../base/common/observable.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IMcpRemoteServerConfiguration, IMcpServerConfiguration, IMcpServerVariable, IMcpStdioServerConfiguration, McpServerType } from '../../../../platform/mcp/common/mcpPlatformTypes.js';
import { IGalleryMcpServerConfiguration, RegistryType } from '../../../../platform/mcp/common/mcpManagement.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService, IQuickPickItem, QuickPickInput } from '../../../../platform/quickinput/common/quickInput.js';
import { isWorkspaceFolder, IWorkspaceContextService, IWorkspaceFolder, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchLocalMcpServer, IWorkbenchMcpManagementService } from '../../../services/mcp/common/mcpWorkbenchManagementService.js';
import { McpCommandIds } from '../common/mcpCommandIds.js';
import { allDiscoverySources, ExternalDiscoverySource, mcpDiscoverySection, mcpWorkspaceRootConfig } from '../common/mcpConfiguration.js';
import { IMcpRegistry } from '../common/mcpRegistryTypes.js';
import { IMcpService, McpConnectionState } from '../common/mcpTypes.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IWorkspaceMcpConfigurationTarget, McpConfigurationDestination } from './mcpConfigurationDestination.js';

export const enum AddConfigurationType {
	Stdio,
	HTTP,
}

type McpInstallTarget = { kind: 'local'; target: ConfigurationTarget | IWorkspaceFolder };





export class McpAddConfigurationCommand {
	constructor(
		private readonly configurationTarget: IWorkspaceMcpConfigurationTarget | undefined,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@IWorkbenchMcpManagementService private readonly _mcpManagementService: IWorkbenchMcpManagementService,
		@IWorkspaceContextService private readonly _workspaceService: IWorkspaceContextService,
		@IWorkbenchEnvironmentService private readonly _environmentService: IWorkbenchEnvironmentService,
		@ICommandService private readonly _commandService: ICommandService,
		@IMcpRegistry private readonly _mcpRegistry: IMcpRegistry,
		@IEditorService private readonly _editorService: IEditorService,
		@IFileService private readonly _fileService: IFileService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IMcpService private readonly _mcpService: IMcpService,
		@ILabelService private readonly _label: ILabelService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) { }

	private async getServerType(): Promise<AddConfigurationType | undefined> {
		type TItem = { kind: AddConfigurationType | 'browse' | 'discovery' } & IQuickPickItem;
		const items: QuickPickInput<TItem>[] = [
			{ kind: AddConfigurationType.Stdio, label: localize('mcp.serverType.command', "Command (stdio)"), description: localize('mcp.serverType.command.description', "Run a local command that implements the MCP protocol") },
			{ kind: AddConfigurationType.HTTP, label: localize('mcp.serverType.http', "HTTP (HTTP or Server-Sent Events)"), description: localize('mcp.serverType.http.description', "Connect to a remote HTTP server that implements the MCP protocol") }
		];

		items.push({ type: 'separator' });

		const discovery = this._configurationService.getValue<{ [K in ExternalDiscoverySource]: boolean }>(mcpDiscoverySection);
		if (discovery && typeof discovery === 'object' && allDiscoverySources.some(d => !discovery[d])) {
			items.push({
				kind: 'discovery',
				label: localize('mcp.servers.discovery', "Add from another application..."),
			});
		}

		items.push({
			kind: 'browse',
			label: localize('mcp.servers.browse', "Browse MCP Servers..."),
		});

		const result = await this._quickInputService.pick<TItem>(items, {
			placeHolder: localize('mcp.serverType.placeholder', "Choose the type of MCP server to add"),
		});

		if (result?.kind === 'browse') {
			this._commandService.executeCommand(McpCommandIds.Browse);
			return undefined;
		}

		if (result?.kind === 'discovery') {
			this._commandService.executeCommand('workbench.action.openSettings', mcpDiscoverySection);
			return undefined;
		}

		return result?.kind;
	}

	private async getStdioConfig(): Promise<IMcpStdioServerConfiguration | undefined> {
		const command = await this._quickInputService.input({
			title: localize('mcp.command.title', "Enter Command"),
			placeHolder: localize('mcp.command.placeholder', "Command to run (with optional arguments)"),
			ignoreFocusLost: true,
		});

		if (!command) {
			return undefined;
		}

		// Split command into command and args, handling quotes
		const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g)!;
		return {
			type: McpServerType.LOCAL,
			command: parts[0].replace(/"/g, ''),

			args: parts.slice(1).map(arg => arg.replace(/"/g, ''))
		};
	}

	private async getSSEConfig(): Promise<IMcpRemoteServerConfiguration | undefined> {
		const url = await this._quickInputService.input({
			title: localize('mcp.url.title', "Enter Server URL"),
			placeHolder: localize('mcp.url.placeholder', "URL of the MCP server (e.g., http://localhost:3000)"),
			ignoreFocusLost: true,
		});

		if (!url) {
			return undefined;
		}

		return { url, type: McpServerType.REMOTE };
	}

	private async getServerId(suggestion = `my-mcp-server-${generateUuid().split('-')[0]}`): Promise<string | undefined> {
		const id = await this._quickInputService.input({
			title: localize('mcp.serverId.title', "Enter Server ID"),
			placeHolder: localize('mcp.serverId.placeholder', "Unique identifier for this server"),
			value: suggestion,
			ignoreFocusLost: true,
		});

		return id;
	}

	private async getConfigurationTarget(): Promise<ConfigurationTarget | IWorkspaceFolder | undefined> {
		const options: (IQuickPickItem & { target?: ConfigurationTarget | IWorkspaceFolder })[] = [
			{ target: ConfigurationTarget.USER_LOCAL, label: localize('mcp.target.user', "Global"), description: localize('mcp.target.user.description', "Available in all workspaces, runs locally") }
		];

		const raLabel = this._environmentService.remoteAuthority && this._label.getHostLabel(Schemas.vscodeRemote, this._environmentService.remoteAuthority);
		if (raLabel) {
			options.push({ target: ConfigurationTarget.USER_REMOTE, label: localize('mcp.target.remote', "Remote"), description: localize('mcp.target..remote.description', "Available on this remote machine, runs on {0}", raLabel) });
		}

		const workbenchState = this._workspaceService.getWorkbenchState();
		if (workbenchState !== WorkbenchState.EMPTY) {
			const target = workbenchState === WorkbenchState.FOLDER ? this._workspaceService.getWorkspace().folders[0] : ConfigurationTarget.WORKSPACE;
			if (this._environmentService.remoteAuthority) {
				options.push({ target, label: localize('mcp.target.workspace', "Workspace"), description: localize('mcp.target.workspace.description.remote', "Available in this workspace, runs on {0}", raLabel) });
			} else {
				options.push({ target, label: localize('mcp.target.workspace', "Workspace"), description: localize('mcp.target.workspace.description', "Available in this workspace, runs locally") });
			}
		}
		if (workbenchState === WorkbenchState.WORKSPACE && this._configurationService.getValue<boolean>(mcpWorkspaceRootConfig)) {
			for (const folder of this._workspaceService.getWorkspace().folders) {
				options.push({ target: folder, label: folder.name, description: localize('mcp.target.workspaceFolder', "Workspace Folder") });
			}
		}

		if (options.length === 1) {
			return options[0].target;
		}

		const targetPick = await this._quickInputService.pick(options, {
			title: localize('mcp.target.title', "Add MCP Server"),
			placeHolder: localize('mcp.target.placeholder', "Select the configuration target")
		});

		return targetPick?.target;
	}

	private async getInstallTarget(): Promise<McpInstallTarget | undefined> {
		if (this.configurationTarget) {
			return { kind: 'local', target: this.configurationTarget.folder };
		}

		const target = await this.getConfigurationTarget();
		return target ? { kind: 'local', target } : undefined;
	}

	/** Shows the location of a server config once it's discovered. */
	private showOnceDiscovered(installed: IWorkbenchLocalMcpServer) {
		const store = new DisposableStore();
		store.add(disposableTimeout(() => store.dispose(), 5000));
		const observer = autorunSelfDisposable(reader => {
			const servers = this._mcpService.servers.read(reader);
			const server = servers.find(s => s.definition.id === installed.id);

			if (server) {
				const collection = this._mcpRegistry.collections.read(reader).find(collection => collection.id === server.collection.id);
				const definition = collection?.serverDefinitions.read(reader).find(definition => definition.id === installed.id);
				this._editorService.openEditor({
					resource: installed.mcpResource,
					options: {
						selection: definition?.presentation?.origin?.range,
						preserveFocus: true,
					}
				});

				server.start({ promptType: 'all-untrusted' }).then(state => {
					if (state.state === McpConnectionState.Kind.Error) {
						server.showOutput();
					}
				});

				reader.dispose();
				store.dispose();
			}
		});
		if (!store.isDisposed) {
			store.add(observer);
		}
	}

	public async run(): Promise<void> {
		// Step 1: Choose server type
		const serverType = await this.getServerType();
		if (serverType === undefined) {
			return;
		}

		// Step 2: Get server details based on type
		let config: IMcpServerConfiguration | undefined;
		switch (serverType) {
			case AddConfigurationType.Stdio:
				config = await this.getStdioConfig();
				break;
			case AddConfigurationType.HTTP:
				config = await this.getSSEConfig();
				break;
			default:
				assertNever(serverType);
		}

		if (!config) {
			return;
		}

		// Step 3: Get server ID
		const name = await this.getServerId();
		if (!name) {
			return;
		}

		// Step 4: Choose configuration target
		const installTarget = await this.getInstallTarget();
		if (!installTarget) {
			return;
		}

		const { target } = installTarget;
		const installable = { name, config };
		const workspaceConfig = isWorkspaceFolder(target)
			? await this._instantiationService.createInstance(McpConfigurationDestination).selectForAdd(target, installable, this.configurationTarget?.kind)
			: undefined;
		if (isWorkspaceFolder(target) && workspaceConfig === undefined) {
			return;
		}
		const installed = await this._mcpManagementService.install(installable, { target, workspaceConfig });


		this.showOnceDiscovered(installed);
	}

	public async pickForUrlHandler(resource: URI, showIsPrimary = false): Promise<void> {
		const name = decodeURIComponent(basename(resource)).replace(/\.json$/, '');
		const placeHolder = localize('install.title', 'Install MCP server {0}', name);

		const items: IQuickPickItem[] = [
			{ id: 'install', label: localize('install.start', 'Install Server') },
			{ id: 'show', label: localize('install.show', 'Show Configuration', name) },
			{ id: 'rename', label: localize('install.rename', 'Rename "{0}"', name) },
			{ id: 'cancel', label: localize('cancel', 'Cancel') },
		];
		if (showIsPrimary) {
			[items[0], items[1]] = [items[1], items[0]];
		}

		const pick = await this._quickInputService.pick(items, { placeHolder, ignoreFocusLost: true });
		const getEditors = () => this._editorService.findEditors(resource);

		switch (pick?.id) {
			case 'show':
				await this._editorService.openEditor({ resource });
				break;
			case 'install':
				await this._editorService.save(getEditors());
				try {
					const contents = await this._fileService.readFile(resource);
					const { inputs, ...config }: IMcpServerConfiguration & { inputs?: IMcpServerVariable[] } = parseJsonc(contents.value.toString());
					const installed = await this._mcpManagementService.install({ name, config, inputs });
					this._editorService.closeEditors(getEditors());
					this.showOnceDiscovered(installed);
				} catch (e) {
					this._notificationService.error(localize('install.error', 'Error installing MCP server {0}: {1}', name, e.message));
					await this._editorService.openEditor({ resource });
				}
				break;
			case 'rename': {
				const newName = await this._quickInputService.input({ placeHolder: localize('install.newName', 'Enter new name'), value: name });
				if (newName) {
					const newURI = resource.with({ path: `/${encodeURIComponent(newName)}.json` });
					await this._editorService.save(getEditors());
					await this._fileService.move(resource, newURI);
					return this.pickForUrlHandler(newURI, showIsPrimary);
				}
				break;
			}
		}
	}

}

export class McpInstallFromManifestCommand {
	constructor(
		@IFileDialogService private readonly _fileDialogService: IFileDialogService,
		@IFileService private readonly _fileService: IFileService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IWorkbenchMcpManagementService private readonly _mcpManagementService: IWorkbenchMcpManagementService,
		@ILogService private readonly _logService: ILogService,
	) { }

	async run(): Promise<void> {
		// Step 1: Open file dialog to select the manifest file
		const result = await this._fileDialogService.showOpenDialog({
			title: localize('mcp.installFromManifest.title', "Select MCP Server Manifest"),
			filters: [{ name: localize('mcp.installFromManifest.filter', "MCP Manifest"), extensions: ['json'] }],
			canSelectFiles: true,
			canSelectMany: false,
			openLabel: mnemonicButtonLabel(localize({ key: 'mcp.installFromManifest.openLabel', comment: ['&& denotes a mnemonic'] }, "&&Install"))
		});

		if (!result?.[0]) {
			return;
		}

		const manifestUri = result[0];

		// Step 2: Read and parse the manifest file
		let manifest: unknown;
		try {
			const contents = await this._fileService.readFile(manifestUri);
			manifest = parseJsonc(contents.value.toString());
		} catch (e) {
			this._notificationService.error(localize('mcp.installFromManifest.readError', "Failed to read manifest file: {0}", e.message));
			return;
		}

		if (!manifest || typeof manifest !== 'object') {
			this._notificationService.error(localize('mcp.installFromManifest.invalidJson', "Invalid manifest file: expected a JSON object"));
			return;
		}

		// Step 3: Validate and extract configuration from gallery manifest
		const galleryManifest = manifest as IGalleryMcpServerConfiguration & { name?: string };

		// Determine package type from manifest
		let packageType: RegistryType;
		if (Array.isArray(galleryManifest.packages) && galleryManifest.packages.length > 0) {
			packageType = galleryManifest.packages[0].registryType;
		} else if (Array.isArray(galleryManifest.remotes) && galleryManifest.remotes.length > 0) {
			packageType = RegistryType.REMOTE;
		} else {
			this._notificationService.error(localize('mcp.installFromManifest.invalidManifest', "Invalid manifest: expected 'packages' or 'remotes' with at least one entry"));
			return;
		}

		let config: IMcpServerConfiguration;
		let inputs: IMcpServerVariable[] | undefined;
		try {
			const { mcpServerConfiguration, notices } = this._mcpManagementService.getMcpServerConfigurationFromManifest(galleryManifest, packageType);
			config = mcpServerConfiguration.config;
			inputs = mcpServerConfiguration.inputs;

			if (notices.length > 0) {
				this._logService.warn(`MCP Management Service: Warnings while installing the MCP server from ${manifestUri.path}`, notices);
			}
		} catch (e) {
			this._notificationService.error(localize('mcp.installFromManifest.parseError', "Failed to parse manifest: {0}", e.message));
			return;
		}

		// Step 4: Get server name from manifest or prompt user
		let name = galleryManifest.name;
		if (!name) {
			name = await this._quickInputService.input({
				title: localize('mcp.installFromManifest.serverId.title', "Enter Server ID"),
				placeHolder: localize('mcp.installFromManifest.serverId.placeholder', "Unique identifier for this server"),
				value: basename(manifestUri).replace(/\.json$/i, ''),
				ignoreFocusLost: true,
			});

			if (!name) {
				return;
			}
		}

		// Step 5: Install to user settings
		try {
			await this._mcpManagementService.install({ name, config, inputs });
			this._notificationService.info(localize('mcp.installFromManifest.success', "MCP server '{0}' installed successfully", name));
		} catch (e) {
			this._notificationService.error(localize('mcp.installFromManifest.installError', "Failed to install MCP server: {0}", e.message));
		}
	}
}
