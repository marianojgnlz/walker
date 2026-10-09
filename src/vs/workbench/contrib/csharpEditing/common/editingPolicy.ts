/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const CSHARP_EDITING_CONFIGURATION_DEFAULTS = {
	'dotnet.server.useOmnisharp': false,
	'chat.disableAIFeatures': true,
	'dotnet.projects.enableAutomaticRestore': false,
	'dotnet.navigation.navigateToSourceLinkAndEmbeddedSources': false,
} as const;

export const CSHARP_EDITING_PROFILE_SETTINGS = {
	...CSHARP_EDITING_CONFIGURATION_DEFAULTS,
	'dotnetAcquisitionExtension.enableTelemetry': false,
} as const;

export const CSHARP_EDITING_CLIENT_ID = 'muhammad-sammy.csharp';
export const CSHARP_EDITING_CLIENT_VERSION = '2.145.21-g154a82fd27';
export const CSHARP_EDITING_RUNTIME_ID = 'ms-dotnettools.vscode-dotnet-runtime';
export const CSHARP_EDITING_RUNTIME_VERSION = '3.2.0';
export const CSHARP_EDITING_VALIDATED_PLATFORM = 'linux-x64';

export type CSharpEditingSettingKey = keyof typeof CSHARP_EDITING_PROFILE_SETTINGS;
export type CSharpEditingConfigurationScope = 'default' | 'user' | 'workspace' | 'workspaceFolder';

export interface IScopedCSharpEditingValue {
	readonly value: unknown;
	readonly scope: CSharpEditingConfigurationScope;
}

export interface ICSharpEditingPolicyInput {
	readonly host: {
		readonly uiKind: 'desktop' | 'web';
		readonly extensionHostKind: 'ui' | 'workspace' | 'unknown';
		readonly remoteAuthority?: string;
		readonly workspaceTrusted: boolean;
		readonly virtualWorkspace: boolean;
		readonly workspaceFolderSchemes: readonly string[];
	};
	readonly platform: string;
	readonly packages: {
		readonly client?: { readonly id: string; readonly version: string; readonly enabled: boolean };
		readonly runtime?: { readonly id: string; readonly version: string; readonly enabled: boolean };
	};
	readonly settings: Readonly<Partial<Record<CSharpEditingSettingKey, IScopedCSharpEditingValue>>>;
	readonly server: {
		readonly configuredPath: IScopedCSharpEditingValue;
		readonly auditedPath?: string;
		readonly crashDumpPath: IScopedCSharpEditingValue;
		readonly environmentVariables: IScopedCSharpEditingValue;
		readonly verifiedDotnetRoot?: string;
	};
	/** Names only are inspected; environment values, which may contain secrets, are never accepted. */
	readonly inheritedEnvironmentVariableNames: readonly string[];
}

export type CSharpEditingPolicyIssueCode =
	| 'host-web' | 'host-non-ui' | 'host-remote' | 'workspace-untrusted' | 'workspace-virtual' | 'workspace-non-file' | 'workspace-missing'
	| 'client-missing' | 'client-id-unvalidated' | 'client-disabled' | 'client-version-unvalidated'
	| 'runtime-missing' | 'runtime-id-unvalidated' | 'runtime-disabled' | 'runtime-version-unvalidated' | 'platform-unvalidated'
	| 'setting-unavailable' | 'setting-conflict' | 'unsafe-environment'
	| 'server-path-unvalidated' | 'server-path-conflict' | 'server-environment-conflict' | 'crash-reporting-enabled';

export interface ICSharpEditingPolicyIssue {
	readonly code: CSharpEditingPolicyIssueCode;
	readonly key?: string;
	readonly scope?: CSharpEditingConfigurationScope;
}

export interface ICSharpEditingPolicyResult {
	/** Eligibility facts only; this result is not an activation permit. */
	readonly eligible: boolean;
	readonly reasons: readonly ICSharpEditingPolicyIssue[];
}

const unsafeEnvironmentVariables = new Set([
	'COR_ENABLE_PROFILING', 'COR_PROFILER', 'COR_PROFILER_PATH',
	'CORECLR_ENABLE_PROFILING', 'CORECLR_PROFILER', 'CORECLR_PROFILER_PATH', 'CORECLR_PROFILER_PATH_32',
	'DOTNET_ADDITIONAL_DEPS', 'DOTNET_DbgEnableMiniDump', 'DOTNET_DbgMiniDumpName', 'DOTNET_DbgMiniDumpType',
	'DOTNET_EnableCrashReport', 'DOTNET_ROOT_USER', 'DOTNET_ROSLYN_SERVER_PATH', 'DOTNET_SHARED_STORE', 'DOTNET_STARTUP_HOOKS',
	'MSBUILD_EXE_PATH', 'MSBuildExtensionsPath', 'MSBuildExtensionsPath32', 'MSBuildExtensionsPath64', 'MSBuildSDKsPath', 'MSBuildToolsPath', 'MSBuildToolsPath32',
].map(name => name.toLowerCase()));

export function hasUnsafeCSharpEditingEnvironment(variableNames: readonly string[]): boolean {
	return variableNames.some(name => unsafeEnvironmentVariables.has(name.toLowerCase()));
}

const expectedChildEnvironment = {
	DOTNET_CLI_TELEMETRY_OPTOUT: '1',
	DOTNET_NOLOGO: '1',
	DOTNET_MULTILEVEL_LOOKUP: '0',
} as const;

/** Evaluates audited host and effective-configuration facts without granting activation. */
export function evaluateCSharpEditingPolicy(input: ICSharpEditingPolicyInput): ICSharpEditingPolicyResult {
	const reasons: ICSharpEditingPolicyIssue[] = [];
	const add = (code: CSharpEditingPolicyIssueCode, details: Omit<ICSharpEditingPolicyIssue, 'code'> = {}) => reasons.push({ code, ...details });

	if (input.host.uiKind !== 'desktop') {
		add('host-web');
	}
	if (input.host.extensionHostKind !== 'ui') {
		add('host-non-ui');
	}
	if (input.host.remoteAuthority) {
		add('host-remote');
	}
	if (!input.host.workspaceTrusted) {
		add('workspace-untrusted');
	}
	if (input.host.virtualWorkspace) {
		add('workspace-virtual');
	}
	if (input.host.workspaceFolderSchemes.length === 0) {
		add('workspace-missing');
	} else if (input.host.workspaceFolderSchemes.some(scheme => scheme !== 'file')) {
		add('workspace-non-file');
	}

	const client = input.packages.client;
	if (!client) {
		add('client-missing');
	} else {
		if (client.id !== CSHARP_EDITING_CLIENT_ID) {
			add('client-id-unvalidated');
		}
		if (!client.enabled) {
			add('client-disabled');
		}
		if (client.version !== CSHARP_EDITING_CLIENT_VERSION) {
			add('client-version-unvalidated');
		}
	}

	const runtime = input.packages.runtime;
	if (!runtime) {
		add('runtime-missing');
	} else {
		if (runtime.id !== CSHARP_EDITING_RUNTIME_ID) {
			add('runtime-id-unvalidated');
		}
		if (!runtime.enabled) {
			add('runtime-disabled');
		}
		if (runtime.version !== CSHARP_EDITING_RUNTIME_VERSION) {
			add('runtime-version-unvalidated');
		}
	}
	if (input.platform !== CSHARP_EDITING_VALIDATED_PLATFORM) {
		add('platform-unvalidated');
	}

	for (const [key, expected] of Object.entries(CSHARP_EDITING_PROFILE_SETTINGS) as [CSharpEditingSettingKey, boolean][]) {
		const setting = input.settings[key];
		if (!setting || typeof setting.value !== 'boolean') {
			add('setting-unavailable', { key });
		} else if (setting.value !== expected) {
			add('setting-conflict', { key, scope: setting.scope });
		}
	}

	const auditedPath = input.server.auditedPath;
	if (!auditedPath) {
		add('server-path-unvalidated');
	} else if (input.server.configuredPath.value && input.server.configuredPath.value !== auditedPath) {
		add('server-path-conflict', { scope: input.server.configuredPath.scope });
	}
	if (input.server.crashDumpPath.value) {
		add('crash-reporting-enabled', { scope: input.server.crashDumpPath.scope });
	}
	if (!hasSafeChildEnvironment(input.server.environmentVariables.value, input.server.verifiedDotnetRoot)) {
		add('server-environment-conflict', { scope: input.server.environmentVariables.scope });
	}

	for (const key of [...new Set(input.inheritedEnvironmentVariableNames.map(name => name.toLowerCase()))].sort()) {
		if (unsafeEnvironmentVariables.has(key)) {
			const originalName = input.inheritedEnvironmentVariableNames.find(name => name.toLowerCase() === key)!;
			add('unsafe-environment', { key: originalName });
		}
	}

	return { eligible: reasons.length === 0, reasons };
}

function hasSafeChildEnvironment(value: unknown, verifiedDotnetRoot: string | undefined): boolean {
	if (!value || typeof value !== 'object' || !verifiedDotnetRoot) {
		return false;
	}
	const environment = value as Record<string, unknown>;
	const expectedKeys = [...Object.keys(expectedChildEnvironment), 'DOTNET_ROOT'];
	if (Object.keys(environment).length !== expectedKeys.length || Object.keys(environment).some(key => !expectedKeys.includes(key))) {
		return false;
	}
	return Object.entries(expectedChildEnvironment).every(([key, expected]) => environment[key] === expected)
		&& environment.DOTNET_ROOT === verifiedDotnetRoot;
}
