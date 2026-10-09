/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { toAction } from '../../../base/common/actions.js';
import { VSBuffer } from '../../../base/common/buffer.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { IConfigurationChangeEvent } from '../../../platform/configuration/common/configuration.js';
import { SerializedError, transformErrorFromSerialization } from '../../../base/common/errors.js';
import { FileAccess } from '../../../base/common/network.js';
import Severity from '../../../base/common/severity.js';
import { isUriComponents, URI, UriComponents } from '../../../base/common/uri.js';
import { localize } from '../../../nls.js';
import { ICommandService } from '../../../platform/commands/common/commands.js';
import { ILocalExtension } from '../../../platform/extensionManagement/common/extensionManagement.js';
import { areSameExtensions } from '../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { ExtensionIdentifier, IExtensionDescription } from '../../../platform/extensions/common/extensions.js';
import { INotificationService } from '../../../platform/notification/common/notification.js';
import { IRemoteConnectionData, ManagedRemoteConnection, RemoteConnection, RemoteConnectionType, ResolvedAuthority, WebSocketRemoteConnection } from '../../../platform/remote/common/remoteAuthorityResolver.js';
import { CSharpEditingAdmissionDenialReason, CSharpEditingAdmissionHostKind, CSharpEditingAdmissionResult, ExtHostContext, ExtHostExtensionServiceShape, MainContext, MainThreadExtensionServiceShape } from '../common/extHost.protocol.js';
import { IExtension, IExtensionsWorkbenchService } from '../../contrib/extensions/common/extensions.js';
import { IWorkbenchEnvironmentService } from '../../services/environment/common/environmentService.js';
import { EnablementState, IWorkbenchExtensionEnablementService } from '../../services/extensionManagement/common/extensionManagement.js';
import { ExtensionHostKind } from '../../services/extensions/common/extensionHostKind.js';
import { IExtensionDescriptionDelta } from '../../services/extensions/common/extensionHostProtocol.js';
import { IExtensionHostProxy, IResolveAuthorityResult } from '../../services/extensions/common/extensionHostProxy.js';
import { ActivationKind, ExtensionActivationReason, IExtensionService, IInternalExtensionService, MissingExtensionDependency } from '../../services/extensions/common/extensions.js';
import { extHostNamedCustomer, IExtHostContext, IInternalExtHostContext } from '../../services/extensions/common/extHostCustomers.js';
import { Dto } from '../../services/extensions/common/proxyIdentifier.js';
import { IHostService } from '../../services/host/browser/host.js';
import { ITimerService } from '../../services/timer/browser/timerService.js';

const csharpEditingAdmissionExtensionIds = new Set(['muhammad-sammy.csharp', 'ms-dotnettools.vscode-dotnet-runtime']);

export interface ICSharpEditingAdmissionRequest {
	readonly extensionId: string;
	readonly installedVersion: string;
	readonly extensionLocation: UriComponents;
	readonly hostKind: CSharpEditingAdmissionHostKind;
	readonly generation: number;
	readonly platform?: string;
	readonly architecture?: string;
	readonly inheritedEnvironmentVariableNames?: readonly string[];
}

export class CSharpEditingAdmissionCoordinator {
	private _generation = 0;
	private _blocked = false;
	private _pendingValidations = 0;
	private readonly _admittedExtensions = new Set<string>();

	constructor(private readonly _extensionHostKind: ExtensionHostKind) { }

	get generation(): number {
		return this._generation;
	}

	get isBlocked(): boolean {
		return this._blocked;
	}

	get hasAdmittedExtension(): boolean {
		return this._admittedExtensions.size > 0;
	}

	get hasPendingValidation(): boolean {
		return this._pendingValidations > 0;
	}

	beginValidation(): () => void {
		this._pendingValidations++;
		let completed = false;
		return () => {
			if (!completed) {
				completed = true;
				this._pendingValidations--;
			}
		};
	}

	revoke(block = true): void {
		this._generation++;
		this._blocked ||= block;
		this._admittedExtensions.clear();
	}

	check(request: ICSharpEditingAdmissionRequest, installed: Pick<IExtensionDescription, 'identifier' | 'version' | 'extensionLocation'> | undefined, permit = false): CSharpEditingAdmissionResult {
		const deny = (reason: CSharpEditingAdmissionDenialReason): CSharpEditingAdmissionResult => ({ allowed: false, generation: this._generation, reason });
		if (!request || typeof request.extensionId !== 'string' || !request.extensionId.trim()
			|| typeof request.installedVersion !== 'string' || !request.installedVersion
			|| !isUriComponents(request.extensionLocation)
			|| !['local', 'remote', 'web'].includes(request.hostKind)
			|| !Number.isSafeInteger(request.generation) || request.generation < 0) {
			return deny('invalid-request');
		}

		if (request.generation !== this._generation) {
			return deny('stale-generation');
		}
		if (this._blocked) {
			return deny('revoked');
		}
		const hostKind = this._extensionHostKind === ExtensionHostKind.LocalProcess ? 'local' : this._extensionHostKind === ExtensionHostKind.LocalWebWorker ? 'web' : 'remote';
		if (hostKind !== 'local' || request.hostKind !== hostKind) {
			return deny('unsupported-host');
		}

		const extensionId = ExtensionIdentifier.toKey(request.extensionId);
		if (!csharpEditingAdmissionExtensionIds.has(extensionId)) {
			return deny('not-protected');
		}
		if (!installed || ExtensionIdentifier.toKey(installed.identifier) !== extensionId
			|| installed.version !== request.installedVersion
			|| URI.revive(installed.extensionLocation).toString() !== URI.revive(request.extensionLocation).toString()) {
			return deny('identity-mismatch');
		}

		if (!permit) {
			return deny('no-permit');
		}
		this._admittedExtensions.add(extensionId);
		return { allowed: true, generation: this._generation };
	}
}

const csharpEditingAdmissionCoordinators = new WeakMap<IExtHostContext, CSharpEditingAdmissionCoordinator>();

export function revokeCSharpEditingAdmissionForExtensionChanges(
	coordinator: CSharpEditingAdmissionCoordinator,
	added: readonly Pick<IExtensionDescription, 'identifier'>[],
	removed: readonly Pick<IExtensionDescription, 'identifier'>[],
): void {
	if ([...added, ...removed].some(extension => csharpEditingAdmissionExtensionIds.has(ExtensionIdentifier.toKey(extension.identifier)))) {
		coordinator.revoke();
	}
}

export function getCSharpEditingAdmissionCoordinator(extHostContext: IExtHostContext): CSharpEditingAdmissionCoordinator {
	let coordinator = csharpEditingAdmissionCoordinators.get(extHostContext);
	if (!coordinator) {
		coordinator = new CSharpEditingAdmissionCoordinator(extHostContext.extensionHostKind);
		csharpEditingAdmissionCoordinators.set(extHostContext, coordinator);
	}
	return coordinator;
}

const csharpEditingSafetyConfigurationKeys = new Set([
	'dotnet.server.useOmnisharp', 'dotnet.server.path', 'dotnet.server.environmentVariables', 'dotnet.server.crashDumpPath',
	'dotnetAcquisitionExtension.existingDotnetPath', 'dotnetAcquisitionExtension.allowInvalidPaths', 'dotnetAcquisitionExtension.sharedExistingDotnetPath',
	'dotnetAcquisitionExtension.enableTelemetry',
	'chat.disableAIFeatures', 'dotnet.projects.enableAutomaticRestore', 'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources',
]);
const csharpEditingConfigurationStops = new WeakMap<IExtensionService, WeakMap<object, Promise<void>>>();

function hasActiveCSharpEditingExtension(extensionService: IExtensionService, coordinator: CSharpEditingAdmissionCoordinator): boolean {
	if (coordinator.hasAdmittedExtension) {
		return true;
	}
	try {
		return Object.values(extensionService.getExtensionsStatus()).some(status => status.activationTimes !== undefined && csharpEditingAdmissionExtensionIds.has(ExtensionIdentifier.toKey(status.id)));
	} catch {
		return true;
	}
}

function affectsCSharpEditingSafetyConfiguration(event: Pick<IConfigurationChangeEvent, 'affectedKeys'>): boolean {
	return [...event.affectedKeys].some(key => csharpEditingSafetyConfigurationKeys.has(key) || [...csharpEditingSafetyConfigurationKeys].some(setting => key.startsWith(`${setting}.`) || setting.startsWith(`${key}.`)));
}

/** Revokes in-flight admission checks and stops an active shared host before safety settings are forwarded. */
export async function forwardCSharpEditingConfigurationChange(
	coordinator: CSharpEditingAdmissionCoordinator,
	event: Pick<IConfigurationChangeEvent, 'affectedKeys'>,
	extensionService: IExtensionService,
	notificationService: INotificationService,
	hostService: IHostService,
	forward: () => void,
): Promise<boolean> {
	if (coordinator.isBlocked) {
		return false;
	}
	if (!affectsCSharpEditingSafetyConfiguration(event)) {
		forward();
		return true;
	}

	const mustStopHost = hasActiveCSharpEditingExtension(extensionService, coordinator);
	if (!mustStopHost && !coordinator.hasPendingValidation) {
		forward();
		return true;
	}
	// A pre-module validator may be in flight even when no extension module is active yet.
	coordinator.revoke();
	if (!mustStopHost) {
		forward();
		return true;
	}
	let stopsForService = csharpEditingConfigurationStops.get(extensionService);
	if (!stopsForService) {
		stopsForService = new WeakMap();
		csharpEditingConfigurationStops.set(extensionService, stopsForService);
	}
	let stop = stopsForService.get(event);
	if (!stop) {
		stop = (async () => {
			let stopAllowed = false;
			try {
				stopAllowed = await extensionService.stopExtensionHosts(localize('csharpEditingConfigChange', "Changing C# editing safety configuration"));
			} catch {
				// A failed stop is never evidence that changed settings are safe to deliver.
			}
			const stopped = stopAllowed && !hasActiveCSharpEditingExtension(extensionService, coordinator);
			notificationService.notify({
				severity: stopped ? Severity.Warning : Severity.Error,
				message: stopped
					? localize('csharpEditingHostStopped', "C# editing was paused because its safety configuration changed. The shared extension host was stopped, temporarily interrupting its other extensions. Repair the settings and reload the window to resume safely.")
					: localize('csharpEditingHostStopFailed', "C# editing could not be considered safe because its shared extension host did not stop. No changed configuration was sent to that host. Repair the settings and reload the window before using C# editing."),
				actions: {
					primary: [toAction({ id: 'reloadAfterCSharpEditingChange', label: localize('reloadWindow', "Reload Window"), run: () => hostService.reload() })]
				}
			});
		})();
		stopsForService.set(event, stop);
	}
	await stop;
	return false;
}

@extHostNamedCustomer(MainContext.MainThreadExtensionService)
export class MainThreadExtensionService implements MainThreadExtensionServiceShape {

	private readonly _extensionHostKind: ExtensionHostKind;
	private readonly _internalExtensionService: IInternalExtensionService;
	private readonly _csharpEditingAdmissionCoordinator: CSharpEditingAdmissionCoordinator;
	private readonly _disposables = new DisposableStore();

	constructor(
		extHostContext: IExtHostContext,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IExtensionsWorkbenchService private readonly _extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IHostService private readonly _hostService: IHostService,
		@IWorkbenchExtensionEnablementService private readonly _extensionEnablementService: IWorkbenchExtensionEnablementService,
		@ITimerService private readonly _timerService: ITimerService,
		@ICommandService private readonly _commandService: ICommandService,
		@IWorkbenchEnvironmentService protected readonly _environmentService: IWorkbenchEnvironmentService,
	) {
		this._extensionHostKind = extHostContext.extensionHostKind;
		this._csharpEditingAdmissionCoordinator = getCSharpEditingAdmissionCoordinator(extHostContext);
		this._disposables.add(this._extensionService.onWillStop(() => this._csharpEditingAdmissionCoordinator.revoke()));
		this._disposables.add(this._extensionService.onDidChangeExtensions(({ added, removed }) => revokeCSharpEditingAdmissionForExtensionChanges(this._csharpEditingAdmissionCoordinator, added, removed)));

		const internalExtHostContext = (<IInternalExtHostContext>extHostContext);
		this._internalExtensionService = internalExtHostContext.internalExtensionService;
		internalExtHostContext._setExtensionHostProxy(
			new ExtensionHostProxy(extHostContext.getProxy(ExtHostContext.ExtHostExtensionService))
		);
		// The ExtHostEmbeddings actor is intentionally disconnected (C2 removal), so its retained
		// MainContext identifier has no registered main-thread customer and must be excluded from
		// the ext-host proxy expectation. Every other MainContext identifier stays asserted.
		const disconnectedMainThreadIdentifiers: unknown[] = [MainContext.MainThreadEmbeddings];
		// eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
		internalExtHostContext._setAllMainProxyIdentifiers(Object.keys(MainContext).map((key) => (<any>MainContext)[key]).filter((identifier) => !disconnectedMainThreadIdentifiers.includes(identifier)));
	}

	public dispose(): void {
		this._csharpEditingAdmissionCoordinator.revoke();
		this._disposables.dispose();
	}

	$getExtension(extensionId: string) {
		return this._extensionService.getExtension(extensionId);
	}

	async $checkCSharpEditingAdmission(extensionId: string, installedVersion: string, extensionLocation: UriComponents, hostKind: CSharpEditingAdmissionHostKind, generation: number, platform: string, architecture: string | undefined, inheritedEnvironmentVariableNames: string[]): Promise<CSharpEditingAdmissionResult> {
		const request = { extensionId, installedVersion, extensionLocation, hostKind, generation, platform, architecture, inheritedEnvironmentVariableNames };
		let installed: IExtensionDescription | undefined;
		if (typeof extensionId === 'string' && extensionId.trim() && typeof installedVersion === 'string' && installedVersion && isUriComponents(extensionLocation)) {
			try {
				installed = await this._extensionService.getExtension(extensionId);
			} catch {
				// Missing or failed installed-metadata lookup remains a denial.
			}
		}
		const checked = this._csharpEditingAdmissionCoordinator.check(request, installed);
		if (checked.allowed || checked.reason !== 'no-permit') {
			return checked;
		}
		const completeValidation = this._csharpEditingAdmissionCoordinator.beginValidation();
		try {
			const client = await this._extensionService.getExtension('muhammad-sammy.csharp');
			const allowed = client && await this._commandService.executeCommand<boolean>('_walker.csharp.checkAdmission', {
				extensionId,
				hostKind,
				platform,
				architecture,
				inheritedEnvironmentVariableNames,
				clientVersion: client.version,
				clientLocation: client.extensionLocation,
				clientTargetPlatform: client.targetPlatform,
			});
			if (allowed === true) {
				return this._csharpEditingAdmissionCoordinator.check(request, installed, true);
			}
		} catch {
			// An absent early contribution, malformed result, or validator failure is a denial.
		} finally {
			completeValidation();
		}
		return this._csharpEditingAdmissionCoordinator.check(request, installed);
	}
	$activateExtension(extensionId: ExtensionIdentifier, reason: ExtensionActivationReason): Promise<void> {
		return this._internalExtensionService._activateById(extensionId, reason);
	}
	async $onWillActivateExtension(extensionId: ExtensionIdentifier): Promise<void> {
		this._internalExtensionService._onWillActivateExtension(extensionId);
	}
	$onDidActivateExtension(extensionId: ExtensionIdentifier, codeLoadingTime: number, activateCallTime: number, activateResolvedTime: number, activationReason: ExtensionActivationReason): void {
		this._internalExtensionService._onDidActivateExtension(extensionId, codeLoadingTime, activateCallTime, activateResolvedTime, activationReason);
	}
	$onExtensionRuntimeError(extensionId: ExtensionIdentifier, data: SerializedError): void {
		const error = transformErrorFromSerialization(data);
		this._internalExtensionService._onExtensionRuntimeError(extensionId, error);
		console.error(`[${extensionId.value}]${error.message}`);
		console.error(error.stack);
	}
	async $onExtensionActivationError(extensionId: ExtensionIdentifier, data: SerializedError, missingExtensionDependency: MissingExtensionDependency | null): Promise<void> {
		const error = transformErrorFromSerialization(data);

		if (missingExtensionDependency) {
			const extension = await this._extensionService.getExtension(extensionId.value);
			if (extension) {
				const local = await this._extensionsWorkbenchService.queryLocal();
				const installedDependency = local.find(i => areSameExtensions(i.identifier, { id: missingExtensionDependency.dependency }));
				if (installedDependency?.local) {
					await this._handleMissingInstalledDependency(extension, installedDependency.local);
					return;
				} else {
					await this._handleMissingNotInstalledDependency(extension, missingExtensionDependency.dependency);
					return;
				}
			}
		}

		const isDev = !this._environmentService.isBuilt || this._environmentService.isExtensionDevelopment;
		if (isDev) {
			this._notificationService.error(error);
			return;
		}

		console.error(error.message);
	}

	private async _handleMissingInstalledDependency(extension: IExtensionDescription, missingInstalledDependency: ILocalExtension): Promise<void> {
		const extName = extension.displayName || extension.name;
		if (this._extensionEnablementService.isEnabled(missingInstalledDependency)) {
			this._notificationService.notify({
				severity: Severity.Error,
				message: localize('reload window', "Cannot activate the '{0}' extension because it depends on the '{1}' extension, which is not loaded. Would you like to reload the window to load the extension?", extName, missingInstalledDependency.manifest.displayName || missingInstalledDependency.manifest.name),
				actions: {
					primary: [toAction({ id: 'reload', label: localize('reload', "Reload Window"), run: () => this._hostService.reload() })]
				}
			});
		} else {
			const enablementState = this._extensionEnablementService.getEnablementState(missingInstalledDependency);
			if (enablementState === EnablementState.DisabledByVirtualWorkspace) {
				this._notificationService.notify({
					severity: Severity.Error,
					message: localize('notSupportedInWorkspace', "Cannot activate the '{0}' extension because it depends on the '{1}' extension which is not supported in the current workspace", extName, missingInstalledDependency.manifest.displayName || missingInstalledDependency.manifest.name),
				});
			} else if (enablementState === EnablementState.DisabledByTrustRequirement) {
				this._notificationService.notify({
					severity: Severity.Error,
					message: localize('restrictedMode', "Cannot activate the '{0}' extension because it depends on the '{1}' extension which is not supported in Restricted Mode", extName, missingInstalledDependency.manifest.displayName || missingInstalledDependency.manifest.name),
					actions: {
						primary: [toAction({ id: 'manageWorkspaceTrust', label: localize('manageWorkspaceTrust', "Manage Workspace Trust"), run: () => this._commandService.executeCommand('workbench.trust.manage') })]
					}
				});
			} else if (this._extensionEnablementService.canChangeEnablement(missingInstalledDependency)) {
				this._notificationService.notify({
					severity: Severity.Error,
					message: localize('disabledDep', "Cannot activate the '{0}' extension because it depends on the '{1}' extension which is disabled. Would you like to enable the extension and reload the window?", extName, missingInstalledDependency.manifest.displayName || missingInstalledDependency.manifest.name),
					actions: {
						primary: [toAction({
							id: 'enable', label: localize('enable dep', "Enable and Reload"), enabled: true,
							run: () => this._extensionEnablementService.setEnablement([missingInstalledDependency], enablementState === EnablementState.DisabledGlobally ? EnablementState.EnabledGlobally : EnablementState.EnabledWorkspace)
								.then(() => this._hostService.reload(), e => this._notificationService.error(e))
						})]
					}
				});
			} else {
				this._notificationService.notify({
					severity: Severity.Error,
					message: localize('disabledDepNoAction', "Cannot activate the '{0}' extension because it depends on the '{1}' extension which is disabled.", extName, missingInstalledDependency.manifest.displayName || missingInstalledDependency.manifest.name),
				});
			}
		}
	}

	private async _handleMissingNotInstalledDependency(extension: IExtensionDescription, missingDependency: string): Promise<void> {
		const extName = extension.displayName || extension.name;
		let dependencyExtension: IExtension | null = null;
		try {
			dependencyExtension = (await this._extensionsWorkbenchService.getExtensions([{ id: missingDependency }], CancellationToken.None))[0];
		} catch (err) {
		}
		if (dependencyExtension) {
			this._notificationService.notify({
				severity: Severity.Error,
				message: localize('uninstalledDep', "Cannot activate the '{0}' extension because it depends on the '{1}' extension from '{2}', which is not installed. Would you like to install the extension and reload the window?", extName, dependencyExtension.displayName, dependencyExtension.publisherDisplayName),
				actions: {
					primary: [toAction({
						id: 'install',
						label: localize('install missing dep', "Install and Reload"),
						run: () => this._extensionsWorkbenchService.install(dependencyExtension)
							.then(() => this._hostService.reload(), e => this._notificationService.error(e))
					})]
				}
			});
		} else {
			this._notificationService.error(localize('unknownDep', "Cannot activate the '{0}' extension because it depends on an unknown '{1}' extension.", extName, missingDependency));
		}
	}

	async $setPerformanceMarks(marks: PerformanceMark[]): Promise<void> {
		if (this._extensionHostKind === ExtensionHostKind.LocalProcess) {
			this._timerService.setPerformanceMarks('localExtHost', marks);
		} else if (this._extensionHostKind === ExtensionHostKind.LocalWebWorker) {
			this._timerService.setPerformanceMarks('workerExtHost', marks);
		} else {
			this._timerService.setPerformanceMarks('remoteExtHost', marks);
		}
	}

	async $asBrowserUri(uri: UriComponents): Promise<UriComponents> {
		return FileAccess.uriToBrowserUri(URI.revive(uri));
	}
}

class ExtensionHostProxy implements IExtensionHostProxy {
	constructor(
		private readonly _actual: ExtHostExtensionServiceShape
	) { }

	async resolveAuthority(remoteAuthority: string, resolveAttempt: number): Promise<IResolveAuthorityResult> {
		const resolved = reviveResolveAuthorityResult(await this._actual.$resolveAuthority(remoteAuthority, resolveAttempt));
		return resolved;
	}
	async getCanonicalURI(remoteAuthority: string, uri: URI): Promise<URI | null> {
		const uriComponents = await this._actual.$getCanonicalURI(remoteAuthority, uri);
		return (uriComponents ? URI.revive(uriComponents) : uriComponents);
	}
	startExtensionHost(extensionsDelta: IExtensionDescriptionDelta): Promise<void> {
		return this._actual.$startExtensionHost(extensionsDelta);
	}
	extensionTestsExecute(): Promise<number> {
		return this._actual.$extensionTestsExecute();
	}
	activateByEvent(activationEvent: string, activationKind: ActivationKind): Promise<void> {
		return this._actual.$activateByEvent(activationEvent, activationKind);
	}
	activate(extensionId: ExtensionIdentifier, reason: ExtensionActivationReason): Promise<boolean> {
		return this._actual.$activate(extensionId, reason);
	}
	setRemoteEnvironment(env: { [key: string]: string | null }): Promise<void> {
		return this._actual.$setRemoteEnvironment(env);
	}
	updateRemoteConnectionData(connectionData: IRemoteConnectionData): Promise<void> {
		return this._actual.$updateRemoteConnectionData(connectionData);
	}
	deltaExtensions(extensionsDelta: IExtensionDescriptionDelta): Promise<void> {
		return this._actual.$deltaExtensions(extensionsDelta);
	}
	test_latency(n: number): Promise<number> {
		return this._actual.$test_latency(n);
	}
	test_up(b: VSBuffer): Promise<number> {
		return this._actual.$test_up(b);
	}
	test_down(size: number): Promise<VSBuffer> {
		return this._actual.$test_down(size);
	}
}

function reviveResolveAuthorityResult(result: Dto<IResolveAuthorityResult>): IResolveAuthorityResult {
	if (result.type === 'ok') {
		return {
			type: 'ok',
			value: {
				...result.value,
				authority: reviveResolvedAuthority(result.value.authority),
			}
		};
	} else {
		return result;
	}
}

function reviveResolvedAuthority(resolvedAuthority: Dto<ResolvedAuthority>): ResolvedAuthority {
	return {
		...resolvedAuthority,
		connectTo: reviveConnection(resolvedAuthority.connectTo),
	};
}

function reviveConnection(connection: Dto<RemoteConnection>): RemoteConnection {
	if (connection.type === RemoteConnectionType.WebSocket) {
		return new WebSocketRemoteConnection(connection.host, connection.port);
	}
	return new ManagedRemoteConnection(connection.id);
}
