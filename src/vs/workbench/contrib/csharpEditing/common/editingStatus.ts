import { localize } from '../../../../nls.js';

export type CSharpEditingStatus = 'missing' | 'disabled' | 'conflict' | 'unsupported' | 'toolchain' | 'starting' | 'error' | 'ready';

export type CSharpEditingRepairAction = 'configure' | 'openExtension' | 'openSettings' | 'openSignatureSettings' | 'setupSdk' | 'recheckSdk' | 'showOutput' | 'reload';

export interface ICSharpEditingStatusFacts {
	readonly clientInstalled: boolean;
	readonly clientEnabled: boolean;
	readonly supportedHost: boolean;
	readonly configurationEligible: boolean;
	readonly toolchainReady: boolean;
	/** True only after a language-server or language-feature health check, not extension activation alone. */
	readonly languageReady: boolean;
	readonly error?: boolean;
}

/** Orders localized status states without treating installation as language readiness. */
export function getCSharpEditingStatus(facts: ICSharpEditingStatusFacts): CSharpEditingStatus {
	if (facts.error) {
		return 'error';
	}
	if (!facts.clientInstalled) {
		return 'missing';
	}
	if (!facts.clientEnabled) {
		return 'disabled';
	}
	if (!facts.supportedHost) {
		return 'unsupported';
	}
	if (!facts.toolchainReady) {
		return 'toolchain';
	}
	if (!facts.configurationEligible) {
		return 'conflict';
	}
	return facts.languageReady ? 'ready' : 'starting';
}

export function getCSharpEditingRepairActions(status: CSharpEditingStatus): readonly CSharpEditingRepairAction[] {
	switch (status) {
		case 'missing': return ['configure'];
		case 'disabled': return ['openExtension'];
		case 'conflict': return ['configure', 'openSettings', 'reload'];
		case 'unsupported': return ['showOutput'];
		case 'toolchain': return ['setupSdk', 'recheckSdk', 'showOutput'];
		case 'starting': return ['showOutput', 'reload'];
		case 'error': return ['configure', 'showOutput', 'reload'];
		case 'ready': return [];
	}
}

/** User-facing status text is centralized so every state has a localization key and test. */
export function getCSharpEditingStatusLabel(status: CSharpEditingStatus): string {
	switch (status) {
		case 'missing': return localize('csharpEditing.status.missing', "C# Editing is not installed.");
		case 'disabled': return localize('csharpEditing.status.disabled', "The installed C# Editing extension is disabled.");
		case 'conflict': return localize('csharpEditing.status.conflict', "C# Editing configuration conflicts with the validated profile.");
		case 'unsupported': return localize('csharpEditing.status.unsupported', "C# Editing is supported only on the validated local Linux x64 profile.");
		case 'toolchain': return localize('csharpEditing.status.toolchain', "A compatible verified .NET SDK/runtime is not ready.");
		case 'starting': return localize('csharpEditing.status.starting', "C# Editing is configured and starting.");
		case 'error': return localize('csharpEditing.status.error', "C# Editing could not be configured or validated.");
		case 'ready': return localize('csharpEditing.status.ready', "C# Editing is ready.");
	}
}
