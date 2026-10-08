/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IExtHostWorkspaceProvider } from '../common/extHostWorkspace.js';
import { ConfigurationInspect, ExtHostConfigProvider } from '../common/extHostConfiguration.js';
import { IExtensionHostInitData } from '../../services/extensions/common/extensionHostProtocol.js';
import { ExtHostExtensionService } from './extHostExtensionService.js';
import { URI } from '../../../base/common/uri.js';
import { ILogService, LogLevel as LogServiceLevel } from '../../../platform/log/common/log.js';
import { ExtensionIdentifier, IExtensionDescription } from '../../../platform/extensions/common/extensions.js';
import { LogLevel, createHttpPatch, createProxyAuthorizationLookup, createProxyResolver, createTlsPatch, ProxySupportSetting, ProxyAgentParams, createNetPatch, loadSystemCertificates, ResolveProxyWithRequest } from '@vscode/proxy-agent';
import { systemCertificatesNodeDefault } from '../../../platform/request/common/request.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { createRequire } from 'node:module';
import type * as undiciType from 'undici-types';
import type * as tlsType from 'tls';
import { lookupKerberosAuthorization } from '../../../platform/request/node/requestService.js';
import * as proxyAgent from '@vscode/proxy-agent';

const require = createRequire(import.meta.url);
const http = require('http');
const https = require('https');
const tls: typeof tlsType = require('tls');
const net = require('net');

const systemCertificatesV2Default = false;
const useElectronFetchDefault = false;

export function connectProxyResolver(
	extHostWorkspace: IExtHostWorkspaceProvider,
	configProvider: ExtHostConfigProvider,
	extensionService: ExtHostExtensionService,
	extHostLogService: ILogService,
	initData: IExtensionHostInitData,
	disposables: DisposableStore,
) {

	const isRemote = initData.remote.isRemote;
	const useHostProxyDefault = initData.environment.useHostProxy ?? !isRemote;
	const fallbackToLocalKerberos = useHostProxyDefault;
	const loadLocalCertificates = useHostProxyDefault;
	const isUseHostProxyEnabled = () => !isRemote || configProvider.getConfiguration('http').get<boolean>('useLocalProxyConfiguration', useHostProxyDefault);
	const params: ProxyAgentParams = {
		resolveProxy: url => extHostWorkspace.resolveProxy(url),
		lookupProxyAuthorization: createProxyAuthorizationLookup({
			log: extHostLogService,
			lookupKerberosAuthorization: async proxyURL => {
				try {
					const spnConfig = getExtHostConfigValue<string>(configProvider, isRemote, 'http.proxyKerberosServicePrincipal');
					const response = await lookupKerberosAuthorization(proxyURL, spnConfig, extHostLogService, 'ProxyResolver#lookupProxyAuthorization');
					return 'Negotiate ' + response;
				} catch (err) {
					extHostLogService.debug('ProxyResolver#lookupProxyAuthorization Kerberos authentication failed', err);
				}

				if (isRemote && fallbackToLocalKerberos) {
					extHostLogService.debug('ProxyResolver#lookupProxyAuthorization Kerberos authentication lookup on host', `proxyURL:${proxyURL}`);
					const auth = await extHostWorkspace.lookupKerberosAuthorization(proxyURL);
					if (auth) {
						return auth;
					}
				}
				return undefined;
			},
			lookupAuthorization: authInfo => extHostWorkspace.lookupAuthorization(authInfo),
			onDidRequestAuthentication: () => { },
		}),
		getProxyURL: () => getExtHostConfigValue<string>(configProvider, isRemote, 'http.proxy'),
		getProxySupport: () => getExtHostConfigValue<ProxySupportSetting>(configProvider, isRemote, 'http.proxySupport') || 'off',
		getNoProxyConfig: () => getExtHostConfigValue<string[]>(configProvider, isRemote, 'http.noProxy') || [],
		isAdditionalFetchSupportEnabled: () => getExtHostConfigValue<boolean>(configProvider, isRemote, 'http.fetchAdditionalSupport', true),
		isWebSocketPatchEnabled: () => getExtHostConfigValue<boolean>(configProvider, isRemote, 'http.webSocketAdditionalSupport', true),
		addCertificatesV1: () => certSettingV1(configProvider, isRemote),
		addCertificatesV2: () => certSettingV2(configProvider, isRemote),
		loadSystemCertificatesFromNode: () => getExtHostConfigValue<boolean>(configProvider, isRemote, 'http.systemCertificatesNode', systemCertificatesNodeDefault),
		log: extHostLogService,
		getLogLevel: () => {
			const level = extHostLogService.getLevel();
			switch (level) {
				case LogServiceLevel.Trace: return LogLevel.Trace;
				case LogServiceLevel.Debug: return LogLevel.Debug;
				case LogServiceLevel.Info: return LogLevel.Info;
				case LogServiceLevel.Warning: return LogLevel.Warning;
				case LogServiceLevel.Error: return LogLevel.Error;
				case LogServiceLevel.Off: return LogLevel.Off;
				default: return never(level);
			}
			function never(level: never) {
				extHostLogService.error('Unknown log level', level);
				return LogLevel.Debug;
			}
		},
		proxyResolveTelemetry: () => { },
		isUseHostProxyEnabled,
		getNetworkInterfaceCheckInterval: () => {
			const intervalSeconds = getExtHostConfigValue<number>(configProvider, isRemote, 'http.experimental.networkInterfaceCheckInterval', 300);
			return intervalSeconds * 1000;
		},
		loadAdditionalCertificates: async () => {
			const useNodeSystemCerts = getExtHostConfigValue<boolean>(configProvider, isRemote, 'http.systemCertificatesNode', systemCertificatesNodeDefault);
			const promises: Promise<string[]>[] = [];
			if (isRemote) {
				promises.push(loadSystemCertificates({
					loadSystemCertificatesFromNode: () => useNodeSystemCerts,
					log: extHostLogService,
				}));
			}
			if (loadLocalCertificates) {
				if (!isRemote && useNodeSystemCerts) {
					promises.push(loadSystemCertificates({
						loadSystemCertificatesFromNode: () => useNodeSystemCerts,
						log: extHostLogService,
					}));
				} else {
					extHostLogService.trace('ProxyResolver#loadAdditionalCertificates: Loading certificates from main process');
					const certs = extHostWorkspace.loadCertificates(); // Loading from main process to share cache.
					certs.then(certs => extHostLogService.trace('ProxyResolver#loadAdditionalCertificates: Loaded certificates from main process', certs.length));
					promises.push(certs);
				}
			}
			const result = (await Promise.all(promises)).flat();
			return result;
		},
		env: process.env,
	};
	const { resolveProxyWithRequest, resolveProxyURL, resolveProxyByURL } = createProxyResolver(params);
	// eslint-disable-next-line local/code-no-any-casts
	const target = (proxyAgent as any).default || proxyAgent;
	target.resolveProxyURL = resolveProxyURL;
	target.resolveProxyByURL = resolveProxyByURL;

	patchGlobalFetch(params, configProvider, initData, resolveProxyURL, disposables);
	patchGlobalWebSocket(params, resolveProxyURL);

	const lookup = createPatchedModules(params, resolveProxyWithRequest);
	return configureModuleLoading(extensionService, lookup, extHostLogService);
}

const unsafeHeaders = [
	'content-length',
	'host',
	'trailer',
	'te',
	'upgrade',
	'cookie2',
	'keep-alive',
	'transfer-encoding',
	'set-cookie',
];

function patchGlobalFetch(params: ProxyAgentParams, configProvider: ExtHostConfigProvider, initData: IExtensionHostInitData, resolveProxyURL: (url: string) => Promise<string | undefined>, disposables: DisposableStore) {
	// eslint-disable-next-line local/code-no-any-casts
	if (!(globalThis as any).__vscodeOriginalFetch) {
		const originalFetch = globalThis.fetch;
		// eslint-disable-next-line local/code-no-any-casts
		(globalThis as any).__vscodeOriginalFetch = originalFetch;
		const createPatchedFetch = (options?: proxyAgent.CreateFetchPatchOptions) => proxyAgent.createFetchPatch(params, originalFetch, resolveProxyURL, options);
		const patchedFetch = createPatchedFetch();
		// eslint-disable-next-line local/code-no-any-casts
		(globalThis as any).__vscodePatchedFetch = patchedFetch;
		// eslint-disable-next-line local/code-no-any-casts
		(globalThis as any).__vscodeCreateFetchPatch = createPatchedFetch;
		let useElectronFetch = false;
		if (!initData.remote.isRemote) {
			useElectronFetch = configProvider.getConfiguration('http').get<boolean>('electronFetch', useElectronFetchDefault);
			disposables.add(configProvider.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration('http.electronFetch')) {
					useElectronFetch = configProvider.getConfiguration('http').get<boolean>('electronFetch', useElectronFetchDefault);
				}
			}));
		}
		// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
		globalThis.fetch = async function fetch(input: string | URL | Request, init?: RequestInit) {
			function getRequestProperty(name: keyof Request & keyof RequestInit) {
				return init && name in init ? init[name] : typeof input === 'object' && 'cache' in input ? input[name] : undefined;
			}
			// Limitations: https://github.com/electron/electron/pull/36733#issuecomment-1405615494
			// net.fetch fails on manual redirect: https://github.com/electron/electron/issues/43715
			const urlString = typeof input === 'string' ? input : 'cache' in input ? input.url : input.toString();
			const isDataUrl = urlString.startsWith('data:');
			const isBlobUrl = urlString.startsWith('blob:');
			const isManualRedirect = getRequestProperty('redirect') === 'manual';
			const integrity = getRequestProperty('integrity');
			if (!useElectronFetch || isDataUrl || isBlobUrl || isManualRedirect || integrity) {
				const response = await patchedFetch(input, init);
				return monitorResponseProperties(response, urlString);
			}
			// Unsupported headers: https://source.chromium.org/chromium/chromium/src/+/main:services/network/public/cpp/header_util.cc;l=32;drc=ee7299f8961a1b05a3554efcc496b6daa0d7f6e1
			if (init?.headers) {
				const headers = new Headers(init.headers);
				for (const header of unsafeHeaders) {
					headers.delete(header);
				}
				init = { ...init, headers };
			}
			// Support for URL: https://github.com/electron/electron/issues/43712
			const electronInput = input instanceof URL ? input.toString() : input;
			const electron = require('electron');
			const response = await electron.net.fetch(electronInput, init);
			return monitorResponseProperties(response, urlString);
		};
	}
}

function patchGlobalWebSocket(params: ProxyAgentParams, resolveProxyURL: (url: string) => Promise<string | undefined>) {
	// eslint-disable-next-line local/code-no-any-casts
	if (!(globalThis as any).__vscodeOriginalWebSocket) {
		const originalWebSocket = globalThis.WebSocket;
		// eslint-disable-next-line local/code-no-any-casts
		(globalThis as any).__vscodeOriginalWebSocket = originalWebSocket;
		globalThis.WebSocket = proxyAgent.createWebSocketPatch(params, originalWebSocket, resolveProxyURL);
	}
}

function monitorResponseProperties(response: Response, urlString: string): Response {
	const originalUrl = response.url;
	Object.defineProperty(response, 'url', {
		get() {
			return originalUrl || urlString;
		}
	});
	const originalType = response.type;
	Object.defineProperty(response, 'type', {
		get() {
			return originalType !== 'default' ? originalType : 'basic';
		}
	});
	return response;
}

function createPatchedModules(params: ProxyAgentParams, resolveProxy: ResolveProxyWithRequest) {

	function mergeModules(module: any, patch: any) {
		const target = module.default || module;
		target.__vscodeOriginal = Object.assign({}, target);
		return Object.assign(target, patch);
	}

	return {
		http: mergeModules(http, createHttpPatch(params, http, resolveProxy)),
		https: mergeModules(https, createHttpPatch(params, https, resolveProxy)),
		net: mergeModules(net, createNetPatch(params, net)),
		tls: mergeModules(tls, createTlsPatch(params, tls))
	};
}

function certSettingV1(configProvider: ExtHostConfigProvider, isRemote: boolean) {
	return !getExtHostConfigValue<boolean>(configProvider, isRemote, 'http.experimental.systemCertificatesV2', systemCertificatesV2Default) && !!getExtHostConfigValue<boolean>(configProvider, isRemote, 'http.systemCertificates');
}

function certSettingV2(configProvider: ExtHostConfigProvider, isRemote: boolean) {
	return !!getExtHostConfigValue<boolean>(configProvider, isRemote, 'http.experimental.systemCertificatesV2', systemCertificatesV2Default) && !!getExtHostConfigValue<boolean>(configProvider, isRemote, 'http.systemCertificates');
}

export const CSHARP_VSWEBASSEMBLYBRIDGE_URL = 'https://vsdebugger.blob.core.windows.net/vswebassemblybridge-9-0-705702/vswebassemblybridge.zip';

export function guardCSharpComponentFetchModule<T extends object>(
	module: T,
	extensionId: string,
	logService: Pick<ILogService, 'info'>,
	evaluate?: (args: readonly unknown[]) => boolean,
	defaultProtocol: 'http:' | 'https:' = 'https:',
): T {
	if (ExtensionIdentifier.toKey(extensionId) !== 'muhammad-sammy.csharp') {
		return module;
	}
	const guarded = Object.assign(Object.create(Object.getPrototypeOf(module)), module) as T;
	for (const method of ['request', 'get'] as const) {
		const original = Reflect.get(module, method);
		if (typeof original !== 'function') {
			continue;
		}
		Reflect.set(guarded, method, function (this: unknown, ...args: unknown[]) {
			let denied: boolean;
			try {
				denied = evaluate ? evaluate(args) : isVSWebAssemblyBridgeRequest(args, defaultProtocol);
			} catch {
				logService.info('CSharpEditingComponentFetchDenied', { extensionId: 'muhammad-sammy.csharp', destination: CSHARP_VSWEBASSEMBLYBRIDGE_URL, reason: 'rule-evaluation-failed' });
				throw componentFetchDeniedError();
			}
			if (denied) {
				logService.info('CSharpEditingComponentFetchDenied', { extensionId: 'muhammad-sammy.csharp', destination: CSHARP_VSWEBASSEMBLYBRIDGE_URL, reason: 'policy' });
				throw componentFetchDeniedError();
			}
			return Reflect.apply(original, this, args);
		});
	}
	return guarded;
}

function isVSWebAssemblyBridgeRequest(args: readonly unknown[], defaultProtocol: 'http:' | 'https:'): boolean {
	const first = args[0];
	const second = args[1];
	const options = isRecord(second) ? second : isRecord(first) ? first : undefined;
	const input = typeof first === 'string' ? first : first instanceof URL ? first.toString() : undefined;
	let url: URL;
	if (input) {
		const host = typeof options?.hostname === 'string' ? options.hostname : typeof options?.host === 'string' ? options.host : undefined;
		const protocol = typeof options?.protocol === 'string' ? options.protocol : undefined;
		url = host && protocol ? new URL(input, `${protocol}//${host}`) : new URL(input);
		if (options) {
			url.protocol = typeof options.protocol === 'string' ? options.protocol : url.protocol;
			if (typeof options.hostname === 'string') {
				url.hostname = options.hostname;
			} else if (typeof options.host === 'string') {
				url.host = options.host;
			}
			url.port = typeof options.port === 'string' || typeof options.port === 'number' ? String(options.port) : url.port;
			url.pathname = typeof options.path === 'string' ? options.path.split('?')[0]! : url.pathname;
		}
	} else if (options) {
		const protocol = typeof options.protocol === 'string' ? options.protocol : defaultProtocol;
		const hostname = typeof options.hostname === 'string' ? options.hostname : typeof options.host === 'string' ? options.host : '';
		const requestPath = typeof options.path === 'string' ? options.path : '/';
		url = new URL(`${protocol}//${hostname}${requestPath}`);
		url.port = typeof options.port === 'string' || typeof options.port === 'number' ? String(options.port) : url.port;
	} else {
		return false;
	}
	return url.protocol === 'https:'
		&& url.hostname === 'vsdebugger.blob.core.windows.net'
		&& (url.port === '' || url.port === '443')
		&& url.pathname === '/vswebassemblybridge-9-0-705702/vswebassemblybridge.zip';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function componentFetchDeniedError(): Error {
	const error = new Error('VSWebAssemblyBridge installation is disabled for C# editing');
	(error as Error & { code: string }).code = 'ERR_CSHARP_COMPONENT_FETCH_DENIED';
	return error;
}

const modulesCache = new Map<IExtensionDescription | undefined, { http?: typeof http; https?: typeof https; undici?: typeof undiciType }>();
function configureModuleLoading(extensionService: ExtHostExtensionService, lookup: ReturnType<typeof createPatchedModules>, logService: ILogService): Promise<void> {
	return extensionService.getExtensionPathIndex()
		.then(extensionPaths => {
			const node_module = require('module');
			const original = node_module._load;
			node_module._load = function load(request: string, parent: { filename: string }, isMain: boolean) {
				const moduleRequest = request.startsWith('node:') ? request.slice(5) : request;
				if (moduleRequest === 'net') {
					return lookup.net;
				}

				if (moduleRequest === 'tls') {
					return lookup.tls;
				}

				if (moduleRequest !== 'http' && moduleRequest !== 'https' && moduleRequest !== 'undici') {
					return original.apply(this, arguments);
				}

				const ext = extensionPaths.findSubstr(URI.file(parent.filename));
				let cache = modulesCache.get(ext);
				if (!cache) {
					modulesCache.set(ext, cache = {});
				}
				if (!cache[moduleRequest]) {
					if (moduleRequest === 'undici') {
						const undici = original.apply(this, arguments);
						proxyAgent.patchUndici(undici);
						cache[moduleRequest] = undici;
					} else {
						const mod = { ...lookup[moduleRequest] }; // Copy to work around #93167.
						cache[moduleRequest] = ext && ExtensionIdentifier.toKey(ext.identifier) === 'muhammad-sammy.csharp'
							? guardCSharpComponentFetchModule(mod, ext.identifier.value, logService, undefined, moduleRequest === 'https' ? 'https:' : 'http:')
							: mod;
					}
				}
				return cache[moduleRequest];
			};
		});
}

function getExtHostConfigValue<T>(configProvider: ExtHostConfigProvider, isRemote: boolean, key: string, fallback: T): T;
function getExtHostConfigValue<T>(configProvider: ExtHostConfigProvider, isRemote: boolean, key: string): T | undefined;
function getExtHostConfigValue<T>(configProvider: ExtHostConfigProvider, isRemote: boolean, key: string, fallback?: T): T | undefined {
	if (isRemote) {
		return configProvider.getConfiguration().get<T>(key) ?? fallback;
	}
	const values: ConfigurationInspect<T> | undefined = configProvider.getConfiguration().inspect<T>(key);
	return values?.globalLocalValue ?? values?.defaultValue ?? fallback;
}
