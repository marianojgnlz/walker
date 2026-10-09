/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { toAction } from '../../../../base/common/actions.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService, ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IStatusbarEntry, IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IUserDataProfileService } from '../../../services/userDataProfile/common/userDataProfile.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IExtensionsWorkbenchService, IExtension } from '../../extensions/common/extensions.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { CSharpEditingAdmissionHostKind } from '../../../api/common/extHost.protocol.js';
import { CSHARP_EDITING_CLIENT_ID, CSHARP_EDITING_CLIENT_VERSION, CSHARP_EDITING_PROFILE_SETTINGS, CSHARP_EDITING_RUNTIME_ID, CSHARP_EDITING_RUNTIME_VERSION, CSHARP_EDITING_VALIDATED_PLATFORM, CSharpEditingSettingKey } from '../common/editingPolicy.js';
import { evaluateCSharpEditingAdmission, evaluateCSharpRuntimeDependencyAdmission } from '../common/editingAdmission.js';
import { CSharpRuntimeMappingGuard } from '../common/runtimeMapping.js';
import { DOTNET_TOOLCHAIN_COMMANDS, executeDotnetEditingHostCommand } from '../common/toolchainContract.js';
import { CSharpEditingRepairAction, CSharpEditingStatus, getCSharpEditingRepairActions, getCSharpEditingStatus, getCSharpEditingStatusLabel } from '../common/editingStatus.js';
import { configureCSharpEditing, configureCSharpEditingWithToolchainPreflight, CSharpEditingFailureAction, CSharpEditingFailureReason, getCSharpEditingFailureRepairAction, ICSharpEditingAcquisitionServices } from './configureEditing.js';
import { configureCSharpEditingRuntimeProfile, CSHARP_EDITING_CONFIGURATION_OWNERS, CSharpEditingConfigurationOwner, IProfileSettingSnapshot } from './profileConfiguration.js';
import { platform, arch } from '../../../../base/common/process.js';

export const CSHARP_EDITING_CONFIGURE_COMMAND = 'walker.csharp.configureEditing';
export const CSHARP_EDITING_INTERNAL_ADMISSION_COMMAND = '_walker.csharp.checkAdmission';
const journalKey = 'walker.csharpEditing.configurationJournal.v1';
const statusChanged = new Emitter<CSharpEditingStatus>();
let currentStatus: CSharpEditingStatus = 'missing';
let admissionValidated = false;

interface IAdmissionRequest {
	readonly extensionId: string;
	readonly hostKind: CSharpEditingAdmissionHostKind;
	readonly platform: string;
	readonly architecture: string | undefined;
	readonly inheritedEnvironmentVariableNames: readonly string[];
	readonly clientVersion: string;
	readonly clientLocation: unknown;
	readonly clientTargetPlatform: string;
}

interface ICSharpEditingRepairServices {
	readonly notifications: INotificationService;
	readonly command: ICommandService;
	readonly host: IHostService;
}

function setStatus(status: CSharpEditingStatus): void {
	if (status !== 'starting' && status !== 'ready') {
		admissionValidated = false;
	}
	if (currentStatus !== status) {
		currentStatus = status;
		statusChanged.fire(status);
	}
}

function isAdmissionRequest(value: unknown): value is IAdmissionRequest {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}
	const request = value as Partial<IAdmissionRequest>;
	return typeof request.extensionId === 'string' && typeof request.hostKind === 'string'
		&& typeof request.platform === 'string' && Array.isArray(request.inheritedEnvironmentVariableNames)
		&& request.inheritedEnvironmentVariableNames.every(name => typeof name === 'string')
		&& typeof request.clientVersion === 'string' && typeof request.clientTargetPlatform === 'string';
}

function extensionId(extension: IExtension | undefined): string | undefined {
	return extension ? ExtensionIdentifier.toKey(extension.identifier.id) : undefined;
}

function getProfileSettings(accessor: ServicesAccessor) {
	const configuration = accessor.get(IConfigurationService);
	const storage = accessor.get(IStorageService);
	const workbenchExtensions = accessor.get(IExtensionsWorkbenchService);
	const enablement = accessor.get(IWorkbenchExtensionEnablementService);
	const extensionService = accessor.get(IExtensionService);
	const profile = accessor.get(IUserDataProfileService).currentProfile;
	let registeredSettings: ReadonlySet<string> | undefined;
	const read = async (key: string): Promise<IProfileSettingSnapshot> => {
		const value = configuration.inspect<unknown>(key).userLocal;
		return value ? { present: true, value: value.value } : { present: false };
	};
	const write = async (key: string, value: IProfileSettingSnapshot): Promise<void> => {
		await configuration.updateValue(key, value.present ? value.value : undefined, ConfigurationTarget.USER_LOCAL);
	};
	const isRegistered = async (key: string): Promise<boolean> => {
		if (!registeredSettings) {
			await extensionService.whenInstalledExtensionsRegistered();
			registeredSettings = new Set(Object.keys(Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).getConfigurationProperties()));
		}
		return registeredSettings.has(key);
	};
	return {
		profileId: profile.id,
		configurationProfileId: profile.id,
		journalProfileId: profile.id,
		readUserProfileSetting: read,
		writeUserProfileSetting: write,
		async isConfigurationOwnerInstalled(owner: CSharpEditingConfigurationOwner) {
			const expected = CSHARP_EDITING_CONFIGURATION_OWNERS[owner];
			const local = await workbenchExtensions.queryLocal();
			const extension = local.find(candidate => extensionId(candidate) === expected.id);
			return !!extension?.local && extension.version === expected.version && enablement.isEnabled(extension.local);
		},
		isUserProfileSettingRegistered: isRegistered,
		async readProfileJournal() {
			const stored = storage.get(journalKey, StorageScope.PROFILE);
			return stored === undefined ? undefined : JSON.parse(stored);
		},
		async writeProfileJournal(value: unknown) {
			storage.store(journalKey, JSON.stringify(value), StorageScope.PROFILE, StorageTarget.MACHINE);
		},
		async removeProfileJournal() {
			storage.remove(journalKey, StorageScope.PROFILE);
		},
	};
}

function acquisitionServices(accessor: ServicesAccessor): ICSharpEditingAcquisitionServices {
	const workbenchExtensions = accessor.get(IExtensionsWorkbenchService);
	const enablement = accessor.get(IWorkbenchExtensionEnablementService);
	const product = accessor.get(IProductService);
	return {
		...getProfileSettings(accessor),
		async readInstalledPackages() {
			const local = await workbenchExtensions.queryLocal();
			const find = (id: string) => local.find(extension => extensionId(extension) === id);
			const client = find(CSHARP_EDITING_CLIENT_ID);
			const runtime = find(CSHARP_EDITING_RUNTIME_ID);
			return {
				client: client && { id: CSHARP_EDITING_CLIENT_ID, version: client.version, enabled: !!client.local && enablement.isEnabled(client.local) },
				runtime: runtime && { id: CSHARP_EDITING_RUNTIME_ID, version: runtime.version, enabled: !!runtime.local && enablement.isEnabled(runtime.local) },
			};
		},
		async getAnonymousOpenVSXExtension(id, version) {
			const gallery = product.extensionsGallery?.serviceUrl;
			if (!gallery || new URL(gallery).hostname !== 'open-vsx.org') {
				throw Object.assign(new Error('Open VSX is unavailable'), { code: 'Offline' });
			}
			const extension = (await workbenchExtensions.getExtensions([{ id, version }], CancellationToken.None))[0];
			return extension && { id: extension.identifier.id, version: extension.version, handle: extension };
		},
		async installPinnedExtension(extension, request) {
			await workbenchExtensions.install(extension.handle as IExtension, {
				version: extension.version,
				pinned: request.pinnedVersion,
				isWorkspaceScoped: request.workspaceScoped,
				isApplicationScoped: request.applicationScoped,
				donotIncludePackAndDependencies: !request.includeDependencies,
			});
		},
	};
}

function resourceValue<T>(configuration: IConfigurationService, key: string, resource: URI | undefined): { value: T; scope: 'default' | 'user' | 'workspace' | 'workspaceFolder' } {
	const inspect = resource ? configuration.inspect<T>(key, { resource }) : configuration.inspect<T>(key);
	const scope = inspect.workspaceFolderValue !== undefined ? 'workspaceFolder'
		: inspect.workspaceValue !== undefined ? 'workspace'
			: inspect.userLocalValue !== undefined || inspect.userRemoteValue !== undefined ? 'user' : 'default';
	const value = resource ? configuration.getValue<T>(key, { resource }) : configuration.getValue<T>(key);
	return { value, scope };
}

async function validateRuntimeDependencyAdmission(accessor: ServicesAccessor, request: IAdmissionRequest): Promise<boolean> {
	try {
		const extensionService = accessor.get(IExtensionService);
		const extensions = accessor.get(IExtensionsWorkbenchService);
		const enablement = accessor.get(IWorkbenchExtensionEnablementService);
		const configuration = accessor.get(IConfigurationService);
		const workspace = accessor.get(IWorkspaceContextService);
		const command = accessor.get(ICommandService);
		const profile = getProfileSettings(accessor);
		const runtime = await extensionService.getExtension(CSHARP_EDITING_RUNTIME_ID);
		const client = await extensionService.getExtension(CSHARP_EDITING_CLIENT_ID);
		const local = await extensions.queryLocal();
		const runtimeLocal = local.find(extension => extensionId(extension) === CSHARP_EDITING_RUNTIME_ID);
		const clientLocal = local.find(extension => extensionId(extension) === CSHARP_EDITING_CLIENT_ID);
		const telemetrySettingKey = 'dotnetAcquisitionExtension.enableTelemetry';
		const telemetrySetting = await profile.readUserProfileSetting(telemetrySettingKey);
		const telemetryRegistered = await profile.isUserProfileSettingRegistered(telemetrySettingKey);
		const folders = workspace.getWorkspace().folders;
		const resources = folders.length ? folders.map(folder => folder.uri) : [undefined];
		const effectiveTelemetryValues = resources.map(resource => resourceValue(configuration, telemetrySettingKey, resource).value);
		const baseAdmission = evaluateCSharpRuntimeDependencyAdmission({
			runtimeDependency: runtime && {
				id: ExtensionIdentifier.toKey(runtime.identifier),
				version: runtime.version,
				enabled: !!runtimeLocal?.local && runtimeLocal.version === runtime.version && enablement.isEnabled(runtimeLocal.local),
			},
			hostKind: request.hostKind,
			platform: request.platform,
			architecture: request.architecture,
			telemetrySetting: {
				registered: telemetryRegistered,
				profileValue: telemetrySetting.present ? telemetrySetting.value : undefined,
				effectiveValues: effectiveTelemetryValues,
			},
			runtimeMapping: { eligible: false },
			inheritedEnvironmentVariableNames: request.inheritedEnvironmentVariableNames,
		});
		if (baseAdmission.eligible || baseAdmission.reason !== 'runtime-mapping-unavailable') {
			setStatus(baseAdmission.eligible ? 'starting' : baseAdmission.reason === 'unsupported-host' ? 'unsupported' : 'conflict');
			return false;
		}
		if (!client || client.version !== CSHARP_EDITING_CLIENT_VERSION || client.targetPlatform !== CSHARP_EDITING_VALIDATED_PLATFORM
			|| !clientLocal?.local || clientLocal.version !== client.version || !enablement.isEnabled(clientLocal.local)) {
			setStatus('conflict');
			return false;
		}

		const mappingSettingKey = 'dotnetAcquisitionExtension.existingDotnetPath';
		const allowInvalidPathsKey = 'dotnetAcquisitionExtension.allowInvalidPaths';
		const mappingProfile = await profile.readUserProfileSetting(mappingSettingKey);
		const allowInvalidPathsProfile = await profile.readUserProfileSetting(allowInvalidPathsKey);
		const [mappingRegistered, allowInvalidPathsRegistered] = await Promise.all([
			profile.isUserProfileSettingRegistered(mappingSettingKey),
			profile.isUserProfileSettingRegistered(allowInvalidPathsKey),
		]);
		if (!mappingRegistered || !allowInvalidPathsRegistered || !mappingProfile.present || !allowInvalidPathsProfile.present || allowInvalidPathsProfile.value !== false) {
			setStatus('conflict');
			return false;
		}

		const host = await executeDotnetEditingHostCommand((id, payload) => command.executeCommand(id, payload), request.platform as 'linux');
		if (host.kind !== 'ready') {
			setStatus('toolchain');
			return false;
		}
		const mappingEligible = resources.every(resource => CSharpRuntimeMappingGuard({
			client: { id: CSHARP_EDITING_CLIENT_ID, version: client.version, targetPlatform: client.targetPlatform },
			runtimeDependency: runtime && { id: ExtensionIdentifier.toKey(runtime.identifier), version: runtime.version },
			platform: request.platform,
			architecture: request.architecture,
			host,
			existingDotnetPath: resourceValue(configuration, mappingSettingKey, resource).value,
			sharedExistingDotnetPath: resourceValue(configuration, 'dotnetAcquisitionExtension.sharedExistingDotnetPath', resource).value,
			allowInvalidPaths: resourceValue(configuration, allowInvalidPathsKey, resource).value,
		}).eligible);
		const admission = evaluateCSharpRuntimeDependencyAdmission({
			runtimeDependency: runtime && {
				id: ExtensionIdentifier.toKey(runtime.identifier),
				version: runtime.version,
				enabled: !!runtimeLocal?.local && runtimeLocal.version === runtime.version && enablement.isEnabled(runtimeLocal.local),
			},
			hostKind: request.hostKind,
			platform: request.platform,
			architecture: request.architecture,
			telemetrySetting: {
				registered: telemetryRegistered,
				profileValue: telemetrySetting.present ? telemetrySetting.value : undefined,
				effectiveValues: effectiveTelemetryValues,
			},
			runtimeMapping: { eligible: mappingEligible },
			inheritedEnvironmentVariableNames: request.inheritedEnvironmentVariableNames,
		});
		if (!admission.eligible) {
			setStatus(admission.reason === 'unsupported-host' ? 'unsupported' : 'conflict');
			return false;
		}
		return true;
	} catch {
		setStatus('error');
		return false;
	}
}

async function validateAdmission(accessor: ServicesAccessor, value: unknown): Promise<boolean> {
	if (!isAdmissionRequest(value)) {
		setStatus('error');
		return false;
	}
	const request = value;
	const requestedExtensionId = ExtensionIdentifier.toKey(request.extensionId);
	if (!['muhammad-sammy.csharp', CSHARP_EDITING_RUNTIME_ID].includes(requestedExtensionId) || request.hostKind !== 'local' || request.platform !== 'linux' || request.architecture !== 'x64') {
		setStatus('unsupported');
		return false;
	}
	if (requestedExtensionId === CSHARP_EDITING_RUNTIME_ID) {
		return validateRuntimeDependencyAdmission(accessor, request);
	}
	try {
		const extensionService = accessor.get(IExtensionService);
		const extensions = accessor.get(IExtensionsWorkbenchService);
		const enablement = accessor.get(IWorkbenchExtensionEnablementService);
		const configuration = accessor.get(IConfigurationService);
		const workspace = accessor.get(IWorkspaceContextService);
		const trust = accessor.get(IWorkspaceTrustManagementService);
		const environment = accessor.get(IWorkbenchEnvironmentService);
		const command = accessor.get(ICommandService);
		const client = await extensionService.getExtension(CSHARP_EDITING_CLIENT_ID);
		const runtime = await extensionService.getExtension(CSHARP_EDITING_RUNTIME_ID);
		if (!client || client.version !== request.clientVersion || ExtensionIdentifier.toKey(client.identifier) !== CSHARP_EDITING_CLIENT_ID) {
			setStatus('missing');
			return false;
		}
		const local = await extensions.queryLocal();
		const clientLocal = local.find(extension => extensionId(extension) === CSHARP_EDITING_CLIENT_ID);
		const runtimeLocal = local.find(extension => extensionId(extension) === CSHARP_EDITING_RUNTIME_ID);
		if (!clientLocal?.local || !enablement.isEnabled(clientLocal.local) || !runtimeLocal?.local || !enablement.isEnabled(runtimeLocal.local)) {
			setStatus('disabled');
			return false;
		}
		if (!runtime || runtime.version !== CSHARP_EDITING_RUNTIME_VERSION) {
			setStatus('conflict');
			return false;
		}
		const host = await executeDotnetEditingHostCommand((id, payload) => command.executeCommand(id, payload), request.platform as 'linux');
		if (host.kind !== 'ready') {
			setStatus('toolchain');
			return false;
		}
		const folders = workspace.getWorkspace().folders;
		const resources = folders.length ? folders.map(folder => folder.uri) : [undefined];
		const workspaceFolderSchemes = folders.map(folder => folder.uri.scheme);
		const serverPath = joinPath(URI.revive(client.extensionLocation), '.roslyn', 'Microsoft.CodeAnalysis.LanguageServer.dll').fsPath;
		for (const resource of resources) {
			const settings = Object.fromEntries(Object.keys(CSHARP_EDITING_PROFILE_SETTINGS).map(key => [key, resourceValue(configuration, key, resource)])) as Partial<Record<CSharpEditingSettingKey, ReturnType<typeof resourceValue>>>;
			const admission = evaluateCSharpEditingAdmission({
				policy: {
					host: {
						uiKind: 'desktop',
						extensionHostKind: request.hostKind === 'local' ? 'ui' : 'workspace',
						remoteAuthority: environment.remoteAuthority,
						workspaceTrusted: trust.isWorkspaceTrusted(),
						virtualWorkspace: workspaceFolderSchemes.some(scheme => scheme !== 'file'),
						workspaceFolderSchemes,
					},
					platform: `${request.platform}-${request.architecture}`,
					packages: {
						client: { id: CSHARP_EDITING_CLIENT_ID, version: client.version, enabled: true },
						runtime: { id: CSHARP_EDITING_RUNTIME_ID, version: runtime.version, enabled: true },
					},
					settings,
					server: {
						configuredPath: resourceValue(configuration, 'dotnet.server.path', resource),
						auditedPath: serverPath,
						crashDumpPath: resourceValue(configuration, 'dotnet.server.crashDumpPath', resource),
						environmentVariables: resourceValue(configuration, 'dotnet.server.environmentVariables', resource),
						verifiedDotnetRoot: host.root,
					},
					inheritedEnvironmentVariableNames: request.inheritedEnvironmentVariableNames,
				},
				runtimeMapping: {
					client: { id: CSHARP_EDITING_CLIENT_ID, version: client.version, targetPlatform: request.clientTargetPlatform },
					runtimeDependency: { id: CSHARP_EDITING_RUNTIME_ID, version: runtime.version },
					platform: request.platform,
					architecture: request.architecture,
					host,
					existingDotnetPath: resourceValue(configuration, 'dotnetAcquisitionExtension.existingDotnetPath', resource).value,
					sharedExistingDotnetPath: resourceValue(configuration, 'dotnetAcquisitionExtension.sharedExistingDotnetPath', resource).value,
					allowInvalidPaths: resourceValue(configuration, 'dotnetAcquisitionExtension.allowInvalidPaths', resource).value,
				},
			});
			if (!admission.eligible) {
				setStatus('conflict');
				return false;
			}
		}
		admissionValidated = true;
		setStatus('starting');
		return true;
	} catch {
		setStatus('error');
		return false;
	}
}

async function configureEditing(accessor: ServicesAccessor): Promise<void> {
	// ServicesAccessor is valid only during command invocation; retain every service before the first await.
	const repairServices: ICSharpEditingRepairServices = {
		notifications: accessor.get(INotificationService),
		command: accessor.get(ICommandService),
		host: accessor.get(IHostService),
	};
	const configuration = accessor.get(IConfigurationService);
	const extensionService = accessor.get(IExtensionService);
	const services = acquisitionServices(accessor);
	admissionValidated = false;
	try {
		const configurationResult = await configureCSharpEditingWithToolchainPreflight(
			() => executeDotnetEditingHostCommand((id, payload) => repairServices.command.executeCommand(id, payload), platform as 'linux' | 'darwin' | 'win32'),
			() => configureCSharpEditing(services),
		);
		if (configurationResult.kind === 'toolchain-not-ready') {
			setStatus(configurationResult.toolchain.kind === 'unavailable' && configurationResult.toolchain.reason === 'unsupported-host' ? 'unsupported' : 'toolchain');
			showStatus(repairServices, currentStatus);
			return;
		}
		const { toolchain: host, configuration: result } = configurationResult;
		if (result.kind === 'pending') {
			setStatus('starting');
			showPendingConfiguration(repairServices, result.pendingSettings);
			return;
		}
		if (result.kind !== 'configured') {
			const status = result.kind === 'refused' && result.reason === 'client-disabled' ? 'disabled'
				: result.kind === 'refused' ? 'conflict' : 'error';
			setStatus(status);
			if (result.kind === 'failed') {
				showAcquisitionFailure(repairServices, result.reason, result.action, result.rollback);
			} else {
				showStatus(repairServices, currentStatus);
			}
			return;
		}
		const runtime = await extensionService.getExtension(CSHARP_EDITING_RUNTIME_ID);
		if (!runtime) {
			setStatus('starting');
			showPendingConfiguration(repairServices, ['dotnetAcquisitionExtension.enableTelemetry']);
			return;
		}
		if (runtime.version !== CSHARP_EDITING_RUNTIME_VERSION) {
			setStatus('conflict');
			showStatus(repairServices, currentStatus);
			return;
		}
		const client = await extensionService.getExtension(CSHARP_EDITING_CLIENT_ID);
		if (!client) {
			setStatus('starting');
			showPendingConfiguration(repairServices, ['C# client configuration schema']);
			return;
		}
		if (client.version !== CSHARP_EDITING_CLIENT_VERSION || client.targetPlatform !== CSHARP_EDITING_VALIDATED_PLATFORM) {
			setStatus('conflict');
			showStatus(repairServices, currentStatus);
			return;
		}
		if (platform !== 'linux' || arch !== 'x64') {
			setStatus('unsupported');
			showStatus(repairServices, currentStatus);
			return;
		}
		const current = await services.readUserProfileSetting('dotnetAcquisitionExtension.existingDotnetPath');
		const existing = current.present ? current.value : [];
		if (!Array.isArray(existing) || existing.some(entry => !isRecord(entry) || typeof entry.extensionId !== 'string' || typeof entry.path !== 'string')) {
			setStatus('conflict');
			showStatus(repairServices, currentStatus);
			return;
		}
		const mapping = existing.filter(entry => (entry as { extensionId: string }).extensionId !== CSHARP_EDITING_CLIENT_ID) as { extensionId: string; path: string }[];
		mapping.push({ extensionId: CSHARP_EDITING_CLIENT_ID, path: host.executable });
		const serverPath = joinPath(URI.revive(client.extensionLocation), '.roslyn', 'Microsoft.CodeAnalysis.LanguageServer.dll').fsPath;
		const guarded = CSharpRuntimeMappingGuard({
			client: { id: CSHARP_EDITING_CLIENT_ID, version: client.version, targetPlatform: client.targetPlatform },
			runtimeDependency: { id: CSHARP_EDITING_RUNTIME_ID, version: runtime.version },
			platform,
			architecture: arch,
			host,
			existingDotnetPath: mapping,
			sharedExistingDotnetPath: configuration.getValue('dotnetAcquisitionExtension.sharedExistingDotnetPath'),
			allowInvalidPaths: configuration.getValue('dotnetAcquisitionExtension.allowInvalidPaths'),
		});
		if (!guarded.eligible) {
			setStatus('conflict');
			showStatus(repairServices, currentStatus);
			return;
		}
		const configured = await configureCSharpEditingRuntimeProfile(services, { serverPath, dotnetRoot: host.root, executable: host.executable, existingDotnetPath: mapping });
		if (configured.kind === 'pending') {
			setStatus('starting');
			showPendingConfiguration(repairServices, configured.pendingSettings);
			return;
		}
		if (configured.kind !== 'ready') {
			setStatus(configured.kind === 'refused' ? 'conflict' : 'error');
			showStatus(repairServices, currentStatus);
			return;
		}
		setStatus('starting');
		repairServices.notifications.notify({
			severity: Severity.Info,
			message: localize('csharpEditing.reloadForAdmission', "C# editing was configured for the verified local Linux toolchain. Reload the window to apply the profile and recheck admission."),
			actions: { primary: [toAction({ id: 'reloadCSharpEditing', label: localize('csharpEditing.reload', "Reload Window"), run: () => repairServices.host.reload() })] },
		});
	} catch {
		setStatus('error');
		showStatus(repairServices, currentStatus);
	}
}

function showAcquisitionFailure(
	repairServices: ICSharpEditingRepairServices,
	reason: CSharpEditingFailureReason,
	action: CSharpEditingFailureAction,
	rollback: 'not-needed' | 'complete' | 'incomplete',
): void {
	const { command, host, notifications } = repairServices;
	const message = reason === 'signature-verification'
		? localize('csharpEditing.install.signatureFailure', "Open VSX rejected the C# package signature. Walker left extensions.verifySignature unchanged; review the explicit profile-level workaround and its security trade-off before deciding whether to proceed. Runtime telemetry configuration remains pending, and no C# language session was admitted.")
		: reason === 'offline'
			? localize('csharpEditing.install.offlineFailure', "The Open VSX gallery could not be reached. C# Editing was not installed; retry when the gallery is available.")
			: reason === 'access-denied'
				? localize('csharpEditing.install.accessFailure', "Open VSX denied access to the pinned C# package. Review gallery access before retrying.")
				: reason === 'cancelled'
					? localize('csharpEditing.install.cancelled', "C# Editing installation was cancelled. No supported editing session was started.")
					: localize('csharpEditing.install.failure', "C# Editing could not be installed or its profile could not be verified.");
	const rollbackNotice = rollback === 'incomplete'
		? localize('csharpEditing.install.rollbackIncomplete', " Some Walker-owned settings could not be restored; review the profile settings before retrying.")
		: '';
	const repairAction = getCSharpEditingFailureRepairAction(action);
	notifications.notify({
		severity: Severity.Error,
		message: message + rollbackNotice,
		actions: {
			primary: [toAction({
				id: `csharpEditing.install.${action}`,
				label: actionLabel(repairAction),
				run: () => runRepairAction(repairAction, command, host),
			})],
		},
	});
}

function showPendingConfiguration(repairServices: ICSharpEditingRepairServices, settings: readonly string[]): void {
	const settingList = settings.length ? settings.join(', ') : 'runtime profile settings';
	const hasRuntimeTelemetryPending = settings.includes('dotnetAcquisitionExtension.enableTelemetry');
	const hasOtherSettingsPending = settings.some(setting => setting !== 'dotnetAcquisitionExtension.enableTelemetry');
	const message = hasRuntimeTelemetryPending && !hasOtherSettingsPending
		? localize('csharpEditing.install.pendingRuntimeSetting', "C# Editing is not ready. Profile setting {0} remains pending until the declared .NET runtime dependency is installed and registers its schema; no unregistered setting was written. Retry after the dependency is available.", settingList)
		: localize('csharpEditing.install.pendingSettings', "C# Editing is not ready. Profile settings {0} remain pending until each owning extension is installed and registers its schema; registered settings may already be configured, but admission remains denied until all settings are validated.", settingList);
	repairServices.notifications.notify({
		severity: Severity.Warning,
		message,
		actions: {
			primary: [toAction({
				id: 'csharpEditing.retryPendingConfiguration',
				label: actionLabel('configure'),
				run: () => runRepairAction('configure', repairServices.command, repairServices.host),
			})],
		},
	});
}

function showStatus(repairServices: ICSharpEditingRepairServices, status: CSharpEditingStatus): void {
	const { notifications, command, host } = repairServices;
	const actions = getCSharpEditingRepairActions(status).map(action => toAction({
		id: `csharpEditing.${action}`,
		label: actionLabel(action),
		run: () => runRepairAction(action, command, host),
	}));
	notifications.notify({
		severity: status === 'error' || status === 'conflict' ? Severity.Error : Severity.Warning,
		message: getCSharpEditingStatusLabel(status),
		actions: { primary: actions },
	});
}

function actionLabel(action: CSharpEditingRepairAction): string {
	switch (action) {
		case 'configure': return localize('csharpEditing.action.configure', "Configure C# Editing");
		case 'openExtension': return localize('csharpEditing.action.extension', "Review C# Extension");
		case 'openSettings': return localize('csharpEditing.action.settings', "Review C# Settings");
		case 'openSignatureSettings': return localize('csharpEditing.action.signatureSettings', "Review Signature Verification Setting");
		case 'setupSdk': return localize('csharpEditing.action.setup', "Set Up .NET SDK");
		case 'recheckSdk': return localize('csharpEditing.action.recheck', "Recheck .NET SDK");
		case 'showOutput': return localize('csharpEditing.action.output', "Show .NET Toolchain Output");
		case 'reload': return localize('csharpEditing.action.reload', "Reload Window");
	}
}

function runRepairAction(action: CSharpEditingRepairAction, command: ICommandService, host: IHostService): Promise<unknown> {
	switch (action) {
		case 'configure': return command.executeCommand(CSHARP_EDITING_CONFIGURE_COMMAND);
		case 'openExtension': return command.executeCommand('extension.open', CSHARP_EDITING_CLIENT_ID);
		case 'openSettings': return command.executeCommand('workbench.action.openSettings', 'dotnetAcquisitionExtension.existingDotnetPath');
		case 'openSignatureSettings': return command.executeCommand('workbench.action.openSettings', 'extensions.verifySignature');
		case 'setupSdk': return command.executeCommand(DOTNET_TOOLCHAIN_COMMANDS.setup);
		case 'recheckSdk': return command.executeCommand(DOTNET_TOOLCHAIN_COMMANDS.recheck);
		case 'showOutput': return command.executeCommand(DOTNET_TOOLCHAIN_COMMANDS.showOutput);
		case 'reload': return host.reload();
	}
}

function statusEntry(status: CSharpEditingStatus): IStatusbarEntry {
	return {
		name: localize('csharpEditing.status.name', "C# Editing"),
		ariaLabel: getCSharpEditingStatusLabel(status),
		tooltip: getCSharpEditingStatusLabel(status),
		text: status === 'ready' ? '$(check)' : status === 'error' || status === 'conflict' ? '$(warning)' : '$(dotnet)',
		command: CSHARP_EDITING_CONFIGURE_COMMAND,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

CommandsRegistry.registerCommand(CSHARP_EDITING_INTERNAL_ADMISSION_COMMAND, (accessor, request: unknown) => validateAdmission(accessor, request));
CommandsRegistry.registerCommand(CSHARP_EDITING_CONFIGURE_COMMAND, accessor => configureEditing(accessor));

class CSharpEditingWorkbenchContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.csharpEditing';
	private readonly _entry: IStatusbarEntryAccessor;

	constructor(
		@IStatusbarService statusbar: IStatusbarService,
		@IExtensionsWorkbenchService private readonly _extensions: IExtensionsWorkbenchService,
		@IWorkbenchExtensionEnablementService private readonly _enablement: IWorkbenchExtensionEnablementService,
		@IExtensionService private readonly _extensionService: IExtensionService,
	) {
		super();
		this._entry = statusbar.addEntry(statusEntry(currentStatus), 'csharpEditing.status', StatusbarAlignment.RIGHT, { location: { id: 'status.host', priority: 110 }, alignment: StatusbarAlignment.RIGHT });
		this._register(statusChanged.event(status => this._entry.update(statusEntry(status))));
		this._register(this._extensions.onChange(() => void this._refresh()));
		this._register(this._extensionService.onDidChangeExtensions(() => void this._refresh()));
		void this._refresh();
	}

	override dispose(): void {
		this._entry.dispose();
		super.dispose();
	}

	private async _refresh(): Promise<void> {
		try {
			await this._extensions.whenInitialized;
			const local = await this._extensions.queryLocal();
			const client = local.find(extension => extensionId(extension) === CSHARP_EDITING_CLIENT_ID);
			const runtime = local.find(extension => extensionId(extension) === CSHARP_EDITING_RUNTIME_ID);
			const extensionStatuses = Object.values(this._extensionService.getExtensionsStatus());
			const clientStatus = extensionStatuses.find(status => ExtensionIdentifier.toKey(status.id) === CSHARP_EDITING_CLIENT_ID);
			const runtimeStatus = extensionStatuses.find(status => ExtensionIdentifier.toKey(status.id) === CSHARP_EDITING_RUNTIME_ID);
			const runtimeFailure = !!clientStatus?.runtimeErrors.length || !!runtimeStatus?.runtimeErrors.length;
			const packageValidated = client?.version === CSHARP_EDITING_CLIENT_VERSION && runtime?.version === CSHARP_EDITING_RUNTIME_VERSION;
			const runtimeEnabled = !!runtime?.local && this._enablement.isEnabled(runtime.local);
			setStatus(getCSharpEditingStatus({
				clientInstalled: !!client,
				clientEnabled: !!client?.local && this._enablement.isEnabled(client.local),
				supportedHost: platform === 'linux' && arch === 'x64',
				configurationEligible: packageValidated && runtimeEnabled && (admissionValidated || currentStatus === 'starting' || currentStatus === 'ready'),
				toolchainReady: currentStatus !== 'toolchain',
				languageReady: false,
				error: currentStatus === 'error' || runtimeFailure,
			}));
		} catch {
			setStatus('error');
		}
	}
}

registerWorkbenchContribution2(CSharpEditingWorkbenchContribution.ID, CSharpEditingWorkbenchContribution, WorkbenchPhase.BlockStartup);
