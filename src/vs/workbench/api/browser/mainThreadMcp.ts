/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mapFindFirst } from '../../../base/common/arraysFind.js';
import { disposableTimeout, RunOnceScheduler } from '../../../base/common/async.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from '../../../base/common/lifecycle.js';
import { autorun, ISettableObservable, observableValue } from '../../../base/common/observable.js';
import { URI, UriComponents } from '../../../base/common/uri.js';
import { generateUuid } from '../../../base/common/uuid.js';
import { ContextKeyExpr, IContextKeyService } from '../../../platform/contextkey/common/contextkey.js';
import { ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { LogLevel } from '../../../platform/log/common/log.js';
import { IWorkbenchMcpGatewayService } from '../../contrib/mcp/common/mcpGatewayService.js';
import { IMcpMessageTransport, IMcpRegistry } from '../../contrib/mcp/common/mcpRegistryTypes.js';
import { extensionPrefixedIdentifier, McpCollectionDefinition, McpCollectionProvenance, McpCollectionSortOrder, McpConnectionState, McpServerDefinition, McpServerLaunch, McpServerTransportType, McpServerTrust } from '../../contrib/mcp/common/mcpTypes.js';
import { MCP } from '../../contrib/mcp/common/modelContextProtocol.js';
import { ExtensionHostKind, extensionHostKindToString } from '../../services/extensions/common/extensionHostKind.js';
import { IExtensionService } from '../../services/extensions/common/extensions.js';
import { IExtHostContext, extHostNamedCustomer } from '../../services/extensions/common/extHostCustomers.js';
import { Proxied } from '../../services/extensions/common/proxyIdentifier.js';
import { ExtHostContext, ExtHostMcpShape, MainContext, MainThreadMcpShape } from '../common/extHost.protocol.js';

@extHostNamedCustomer(MainContext.MainThreadMcp)
export class MainThreadMcp extends Disposable implements MainThreadMcpShape {

	private _serverIdCounter = 0;

	private readonly _servers = new Map<number, ExtHostMcpServerLaunch>();
	private readonly _serverDefinitions = new Map<number, McpServerDefinition>();
	private readonly _proxy: Proxied<ExtHostMcpShape>;
	private readonly _collectionDefinitions = this._register(new DisposableMap<string, {
		servers: ISettableObservable<readonly McpServerDefinition[]>;
		dispose(): void;
	}>());
	private readonly _gateways = this._register(new DisposableMap<string, DisposableStore>());

	constructor(
		private readonly _extHostContext: IExtHostContext,
		@IMcpRegistry private readonly _mcpRegistry: IMcpRegistry,
		@IExtensionService private readonly _extensionService: IExtensionService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
		@IWorkbenchMcpGatewayService private readonly _mcpGatewayService: IWorkbenchMcpGatewayService,
	) {
		super();
		const proxy = this._proxy = _extHostContext.getProxy(ExtHostContext.ExtHostMcp);
		this._register(this._mcpRegistry.registerDelegate({
			// Prefer Node.js extension hosts when they're available. No CORS issues etc.
			priority: _extHostContext.extensionHostKind === ExtensionHostKind.LocalWebWorker ? 0 : 1,
			waitForInitialProviderPromises() {
				return proxy.$waitForInitialCollectionProviders();
			},
			canStart(collection, serverDefinition) {
				if (collection.remoteAuthority !== _extHostContext.remoteAuthority) {
					return false;
				}
				if (serverDefinition.launch.type === McpServerTransportType.Stdio && _extHostContext.extensionHostKind === ExtensionHostKind.LocalWebWorker) {
					return false;
				}
				return true;
			},
			async substituteVariables(serverDefinition, launch) {
				const ser = await proxy.$substituteVariables(serverDefinition.variableReplacement?.folder?.uri, McpServerLaunch.toSerialized(launch));
				return McpServerLaunch.fromSerialized(ser);
			},
			start: (_collection, serverDefiniton, resolveLaunch, options) => {
				const id = ++this._serverIdCounter;
				const launch = new ExtHostMcpServerLaunch(
					_extHostContext.extensionHostKind,
					() => proxy.$stopMcp(id),
					msg => proxy.$sendMessage(id, JSON.stringify(msg)),
				);
				this._servers.set(id, launch);
				this._serverDefinitions.set(id, serverDefiniton);
				proxy.$startMcp(id, {
					launch: resolveLaunch,
					defaultCwd: serverDefiniton.defaultCwd ?? serverDefiniton.variableReplacement?.folder?.uri,
					errorOnUserInteraction: options?.errorOnUserInteraction,
				});

				return launch;
			},
		}));

		// Subscribe to MCP server definition changes and notify ext host
		const onDidChangeMcpServerDefinitionsTrigger = this._register(new RunOnceScheduler(() => this._publishServerDefinitions(), 500));
		this._register(autorun(reader => {
			const collections = this._mcpRegistry.collections.read(reader);
			// Read all server definitions to track changes
			for (const collection of collections) {
				collection.serverDefinitions.read(reader);
			}
			// Notify ext host that definitions changed (it will re-fetch if needed)
			if (!onDidChangeMcpServerDefinitionsTrigger.isScheduled()) {
				onDidChangeMcpServerDefinitionsTrigger.schedule();
			}
		}));

		onDidChangeMcpServerDefinitionsTrigger.schedule();
	}

	private _publishServerDefinitions() {
		const collections = this._mcpRegistry.collections.get();
		const allServers: McpServerDefinition.Serialized[] = [];

		for (const collection of collections) {
			const servers = collection.serverDefinitions.get();
			for (const server of servers) {
				allServers.push(McpServerDefinition.toSerialized(server));
			}
		}

		this._proxy.$onDidChangeMcpServerDefinitions(allServers);
	}

	$upsertMcpCollection(collection: McpCollectionDefinition.FromExtHost, serversDto: McpServerDefinition.Serialized[]): void {
		const servers = serversDto.map(McpServerDefinition.fromSerialized);
		const existing = this._collectionDefinitions.get(collection.id);
		if (existing) {
			existing.servers.set(servers, undefined);
		} else {
			const serverDefinitions = observableValue<readonly McpServerDefinition[]>('mcpServers', servers);
			const extensionId = new ExtensionIdentifier(collection.extensionId);
			const store = new DisposableStore();
			const handle = store.add(new MutableDisposable());
			const register = () => {
				handle.value ??= this._mcpRegistry.registerCollection({
					...collection,
					provenance: McpCollectionProvenance.Extension,
					source: extensionId,
					order: McpCollectionSortOrder.Extension,
					resolveServerLanch: collection.canResolveLaunch ? (async def => {
						const r = await this._proxy.$resolveMcpLaunch(collection.id, def.label);
						return r ? McpServerLaunch.fromSerialized(r) : undefined;
					}) : undefined,
					trustBehavior: collection.isTrustedByDefault ? McpServerTrust.Kind.Trusted : McpServerTrust.Kind.TrustedOnNonce,
					remoteAuthority: this._extHostContext.remoteAuthority,
					serverDefinitions,
				});
			};

			const whenClauseStr = mapFindFirst(this._extensionService.extensions, e =>
				ExtensionIdentifier.equals(extensionId, e.identifier)
					? e.contributes?.mcpServerDefinitionProviders?.find(p => extensionPrefixedIdentifier(extensionId, p.id) === collection.id)?.when
					: undefined);
			const whenClause = whenClauseStr && ContextKeyExpr.deserialize(whenClauseStr);

			if (!whenClause) {
				register();
			} else {
				const evaluate = () => {
					if (this._contextKeyService.contextMatchesRules(whenClause)) {
						register();
					} else {
						handle.clear();
					}
				};

				store.add(this._contextKeyService.onDidChangeContext(evaluate));
				evaluate();
			}

			this._collectionDefinitions.set(collection.id, {
				servers: serverDefinitions,
				dispose: () => store.dispose(),
			});
		}
	}

	$deleteMcpCollection(collectionId: string): void {
		this._collectionDefinitions.deleteAndDispose(collectionId);
	}

	$onDidChangeState(id: number, update: McpConnectionState): void {
		const server = this._servers.get(id);
		if (!server) {
			return;
		}

		server.state.set(update, undefined);
		if (!McpConnectionState.isRunning(update)) {
			server.dispose();
			this._servers.delete(id);
			this._serverDefinitions.delete(id);
		}
	}

	$onDidPublishLog(id: number, level: LogLevel, log: string): void {
		if (typeof level === 'string') {
			level = LogLevel.Info;
			log = level as unknown as string;
		}

		this._servers.get(id)?.pushLog(level, log);
	}

	$onDidReceiveMessage(id: number, message: string): void {
		this._servers.get(id)?.pushMessage(message);
	}

	async $startMcpGateway(chatSessionResource?: UriComponents): Promise<{ servers: { label: string; address: URI }[]; gatewayId: string } | undefined> {
		const result = await this._mcpGatewayService.createGateway(
			this._extHostContext.extensionHostKind === ExtensionHostKind.Remote,
			chatSessionResource ? URI.revive(chatSessionResource) : undefined,
		);
		if (!result) {
			return undefined;
		}

		if (this._store.isDisposed) {
			result.dispose();
			return undefined;
		}

		const gatewayId = generateUuid();
		const store = new DisposableStore();
		store.add(result);
		store.add(result.onDidChangeServers(servers => {
			this._proxy.$onDidChangeGatewayServers(gatewayId, servers.map(s => ({ label: s.label, address: s.address })));
		}));
		this._gateways.set(gatewayId, store);

		return {
			servers: result.servers.map(s => ({ label: s.label, address: s.address })),
			gatewayId,
		};
	}

	$disposeMcpGateway(gatewayId: string): void {
		this._gateways.deleteAndDispose(gatewayId);
	}

	override dispose(): void {
		for (const server of this._servers.values()) {
			server.extHostDispose();
		}
		this._servers.clear();
		this._serverDefinitions.clear();
		super.dispose();
	}
}


class ExtHostMcpServerLaunch extends Disposable implements IMcpMessageTransport {
	public readonly state = observableValue<McpConnectionState>('mcpServerState', { state: McpConnectionState.Kind.Starting });

	private readonly _onDidLog = this._register(new Emitter<{ level: LogLevel; message: string }>());
	public readonly onDidLog = this._onDidLog.event;

	private readonly _onDidReceiveMessage = this._register(new Emitter<MCP.JSONRPCMessage>());
	public readonly onDidReceiveMessage = this._onDidReceiveMessage.event;

	pushLog(level: LogLevel, message: string): void {
		this._onDidLog.fire({ message, level });
	}

	pushMessage(message: string): void {
		let parsed: MCP.JSONRPCMessage | undefined;
		try {
			parsed = JSON.parse(message);
		} catch (e) {
			this.pushLog(LogLevel.Warning, `Failed to parse message: ${JSON.stringify(message)}`);
		}

		if (parsed) {
			if (Array.isArray(parsed)) { // streamable HTTP supports batching
				parsed.forEach(p => this._onDidReceiveMessage.fire(p));
			} else {
				this._onDidReceiveMessage.fire(parsed);
			}
		}
	}

	constructor(
		extHostKind: ExtensionHostKind,
		public readonly stop: () => void,
		public readonly send: (message: MCP.JSONRPCMessage) => void,
	) {
		super();

		this._register(disposableTimeout(() => {
			this.pushLog(LogLevel.Info, `Starting server from ${extensionHostKindToString(extHostKind)} extension host`);
		}));
	}

	public extHostDispose() {
		if (McpConnectionState.isRunning(this.state.get())) {
			this.pushLog(LogLevel.Warning, 'Extension host shut down, server will stop.');
			this.state.set({ state: McpConnectionState.Kind.Stopped }, undefined);
		}
		this.dispose();
	}

	public override dispose(): void {
		if (McpConnectionState.isRunning(this.state.get())) {
			this.stop();
		}

		super.dispose();
	}
}

/**
 * The context needed to re-acquire a token for a tracked MCP server, captured when the
 * session was first established. The tracker holds this opaquely and replays it verbatim on
 * re-validation so the silent token request targets the same authority / resource / audience
 * that the original sign-in used. Dropping the authorization server here would let the provider
 * fall back to a default authority (e.g. the Microsoft provider's `organizations` tenant) and
 * request a token against the wrong tenant.
 */
export interface IMcpServerAuthContext {
	readonly authorizationServer?: URI;
	readonly clientId?: string;
	readonly resource?: string;
	readonly audience?: string;
}