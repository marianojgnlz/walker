/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type IEnvironmentAdapter, type IFileSystemAdapter } from './contracts';
import { dotnetManagedRoot } from './candidates';
import {
	resolveDotnetPrerequisites,
	type DotnetInstallArchitecture,
	type IDotnetInstallSelection,
	type IDotnetPrerequisiteFailure,
} from './platformArguments';

/** Maximum accepted length of an exact SDK version input (D3). */
export const MAX_SDK_VERSION_INPUT_LENGTH = 32;

/** Stable reasons a submitted SDK version is rejected; the UI turns them into localized text. */
export type DotnetVersionRejectionReason =
	| 'empty'
	| 'length'
	| 'whitespace'
	| 'option-prefix'
	| 'slash'
	| 'wildcard'
	| 'metacharacter'
	| 'prerelease'
	| 'build-metadata'
	| 'format';

/** One rejected version input, kept verbatim so the user can correct it. */
export interface IDotnetVersionRejection {
	readonly reason: DotnetVersionRejectionReason;
	readonly input: string;
}

/** Version input validation outcome. */
export type DotnetVersionValidationResult =
	| { readonly kind: 'valid'; readonly version: string }
	| { readonly kind: 'invalid'; readonly rejection: IDotnetVersionRejection };

/** Stable versions only: positive major and numeric minor/patch, no suffix or metadata. */
const STABLE_VERSION_PATTERN = /^[1-9]\d*\.\d+\.\d+$/;

/** Path separators; a version is never a path. */
const PATH_SEPARATOR_PATTERN = /[\\/]/;

/** Wildcard characters; a version is never a range. */
const WILDCARD_PATTERN = /[*?]/;

/** Shell metacharacters that must never reach a command line or shell. */
const SHELL_METACHARACTER_PATTERN = /[;|&$`<>()\[\]{}!#~"'%=^,]/;

/** Numeric core of a version, used to distinguish prerelease suffixes from malformed input. */
const NUMERIC_CORE_PATTERN = /^\d+(?:\.\d+)*$/;

/**
 * Validates one exact SDK version input for stable installation. Outer whitespace is trimmed,
 * everything else must match a bounded numeric `major.minor.patch` grammar; prereleases, wildcards,
 * paths, option prefixes, shell metacharacters, and overlong input are rejected with a stable
 * reason so the UI can explain the problem and keep the prompt correctable.
 */
export function parseSdkVersionInput(input: string): DotnetVersionValidationResult {
	const trimmed = input.trim();
	const invalid = (reason: DotnetVersionRejectionReason): DotnetVersionValidationResult => ({ kind: 'invalid', rejection: { reason, input } });
	if (trimmed.length === 0) {
		return invalid('empty');
	}
	if (trimmed.length > MAX_SDK_VERSION_INPUT_LENGTH) {
		return invalid('length');
	}
	if (/\s/.test(trimmed)) {
		return invalid('whitespace');
	}
	if (trimmed.startsWith('-')) {
		return invalid('option-prefix');
	}
	if (PATH_SEPARATOR_PATTERN.test(trimmed)) {
		return invalid('slash');
	}
	if (WILDCARD_PATTERN.test(trimmed)) {
		return invalid('wildcard');
	}
	if (SHELL_METACHARACTER_PATTERN.test(trimmed)) {
		return invalid('metacharacter');
	}
	const suffixIndex = trimmed.search(/[-+]/);
	if (suffixIndex !== -1 && NUMERIC_CORE_PATTERN.test(trimmed.slice(0, suffixIndex))) {
		return invalid(trimmed.includes('+') ? 'build-metadata' : 'prerelease');
	}
	if (!STABLE_VERSION_PATTERN.test(trimmed)) {
		return invalid('format');
	}
	return { kind: 'valid', version: trimmed };
}

/** One chooser result: an explicit channel or the request to type an exact version. */
export type DotnetChannelChoice = 'LTS' | 'STS' | 'specific';

/** Context the chooser must show so remote desktop windows label the local machine and destination. */
export interface IDotnetChannelChooser {
	/** Home-scoped local destination the chosen channel would install into. */
	readonly destination: string;
	readonly locality: 'local';
	readonly architecture: DotnetInstallArchitecture;
}

/** Final confirmation data; the UI layer owns all user-facing text (D3, D5). */
export interface IDotnetConfirmationPrompt {
	readonly selection: IDotnetInstallSelection;
	/** Home-scoped managed destination `<home>/.walker/dotnet`. */
	readonly destination: string;
	readonly architecture: DotnetInstallArchitecture;
	readonly locality: 'local';
	/** Setup retrieves the official script over the network after confirmation. */
	readonly networkUse: true;
}

/**
 * Narrow selection UI surface. The implementation owns every prompt string and localizes it with
 * `vscode.l10n.t`; this facade carries only structured data so the flow stays free of runtime
 * `vscode` imports and tests can record exact payloads.
 */
export interface IDotnetSelectionUi {
	/** Shows the explicit LTS / STS / specific-version chooser; `undefined` means the user canceled. */
	chooseChannel(chooser: IDotnetChannelChooser): Promise<DotnetChannelChoice | undefined>;
	/** Requests an exact SDK version; `undefined` means the user canceled. */
	requestVersion(): Promise<string | undefined>;
	/** Explains a rejected version so the input remains correctable. */
	explainInvalidVersion(rejection: IDotnetVersionRejection): void;
	/** Shows the final confirmation; resolves true only on explicit confirmation. */
	confirmSelection(confirmation: IDotnetConfirmationPrompt): Promise<boolean>;
	/** Reveals the already-active chooser instead of opening a second one. */
	revealActiveSelection(): void;
	/** Reports an actionable prerequisite failure. */
	reportFailure(failure: IDotnetPrerequisiteFailure): void;
}

/** Prompt at which the user canceled; cancellation means no download, lock, or install change. */
export type DotnetSelectionCancelStage = 'channel' | 'version' | 'confirmation';

/** Result of one explicit setup selection request. */
export type DotnetSetupSelectionResult =
	| { readonly kind: 'selected'; readonly selection: IDotnetInstallSelection; readonly destination: string; readonly architecture: DotnetInstallArchitecture }
	| { readonly kind: 'canceled'; readonly stage: DotnetSelectionCancelStage }
	| { readonly kind: 'active' }
	| { readonly kind: 'failed'; readonly failure: IDotnetPrerequisiteFailure };

/** Single-flight explicit-selection entry point. */
export interface IDotnetSelectionPrompter {
	/**
	 * Runs the required prompts and always requires explicit confirmation. Externally supplied
	 * command arguments are ignored by contract: they never become a channel, version, or
	 * destination (D3), so `walker.dotnet.setup` cannot bypass the chooser.
	 */
	select(externalArguments?: readonly unknown[]): Promise<DotnetSetupSelectionResult>;
}

/** Construction inputs; the environment is the local machine, never the workspace. */
export interface IDotnetSelectionPrompterOptions {
	readonly ui: IDotnetSelectionUi;
	readonly environment: IEnvironmentAdapter;
	readonly fileSystem: IFileSystemAdapter;
}

/** Exact-version prompt outcome; cancellation never becomes a selection. */
type VersionPromptResult =
	| { readonly kind: 'resolved'; readonly selection: IDotnetInstallSelection }
	| { readonly kind: 'canceled' };

/**
 * Creates the explicit-selection prompter. Every setup entry action opens LTS / STS / specific
 * version, credentials nothing from external arguments, shows the local destination and network use
 * before returning, and supports at most one active chooser per extension host: repeated activation
 * reveals the active chooser instead of opening another one.
 */
export function createDotnetSelectionPrompter(options: IDotnetSelectionPrompterOptions): IDotnetSelectionPrompter {
	const { ui, environment, fileSystem } = options;
	const destination = dotnetManagedRoot(environment.home, environment.platform);
	let active: Promise<DotnetSetupSelectionResult> | undefined;

	const promptForVersion = async (): Promise<VersionPromptResult> => {
		for (;;) {
			const input = await ui.requestVersion();
			if (input === undefined) {
				return { kind: 'canceled' };
			}
			const parsed = parseSdkVersionInput(input);
			if (parsed.kind === 'invalid') {
				ui.explainInvalidVersion(parsed.rejection);
				continue;
			}
			return { kind: 'resolved', selection: { kind: 'version', version: parsed.version } };
		}
	};

	const promptForSelection = async (): Promise<DotnetSetupSelectionResult> => {
		const prerequisites = await resolveDotnetPrerequisites(environment, fileSystem);
		if (prerequisites.kind === 'failed') {
			ui.reportFailure(prerequisites.failure);
			return { kind: 'failed', failure: prerequisites.failure };
		}
		const { architecture } = prerequisites.prerequisites;
		const choice = await ui.chooseChannel({ destination, locality: 'local', architecture });
		if (choice === undefined) {
			return { kind: 'canceled', stage: 'channel' };
		}
		let selection: IDotnetInstallSelection;
		if (choice === 'specific') {
			const version = await promptForVersion();
			if (version.kind === 'canceled') {
				return { kind: 'canceled', stage: 'version' };
			}
			selection = version.selection;
		} else {
			selection = { kind: 'channel', channel: choice };
		}
		const confirmed = await ui.confirmSelection({ selection, destination, architecture, locality: 'local', networkUse: true });
		if (!confirmed) {
			return { kind: 'canceled', stage: 'confirmation' };
		}
		return { kind: 'selected', selection, destination, architecture };
	};

	return {
		select: (_externalArguments?: readonly unknown[]): Promise<DotnetSetupSelectionResult> => {
			if (active !== undefined) {
				ui.revealActiveSelection();
				return Promise.resolve({ kind: 'active' });
			}
			const started = promptForSelection().finally(() => {
				active = undefined;
			});
			active = started;
			return started;
		},
	};
}
