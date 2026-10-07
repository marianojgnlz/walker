/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { DotnetNewTemplateId, IDotnetNewTemplateOption } from '../../welcomeOnboarding/common/dotnetToolchain.js';

export type ProjectTemplateFamily = 'console' | 'library' | 'web' | 'worker' | 'test';

export interface IProjectTemplate {
	readonly id: DotnetNewTemplateId;
	readonly label: string;
	readonly family: ProjectTemplateFamily;
}

export interface ITemplateOption {
	readonly name: string;
	readonly values: readonly string[];
}

export interface ITemplateOptionSurface {
	readonly recognized: boolean;
	readonly options: readonly ITemplateOption[];
}

const APPROVED_TEMPLATES: readonly IProjectTemplate[] = [
	{ id: 'console', label: localize('dotnetProject.template.console', "Console App"), family: 'console' },
	{ id: 'classlib', label: localize('dotnetProject.template.classlib', "Class Library"), family: 'library' },
	{ id: 'webapi', label: localize('dotnetProject.template.webapi', "Web API"), family: 'web' },
	{ id: 'webapiaot', label: localize('dotnetProject.template.webapiaot', "Web API (Native AOT)"), family: 'web' },
	{ id: 'mvc', label: localize('dotnetProject.template.mvc', "ASP.NET Core MVC"), family: 'web' },
	{ id: 'webapp', label: localize('dotnetProject.template.webapp', "Razor Pages"), family: 'web' },
	{ id: 'razor', label: localize('dotnetProject.template.razor', "Razor Pages"), family: 'web' },
	{ id: 'blazor', label: localize('dotnetProject.template.blazor', "Blazor Web App"), family: 'web' },
	{ id: 'blazorwasm', label: localize('dotnetProject.template.blazorwasm', "Blazor WebAssembly"), family: 'web' },
	{ id: 'worker', label: localize('dotnetProject.template.worker', "Worker Service"), family: 'worker' },
	{ id: 'xunit', label: localize('dotnetProject.template.xunit', "xUnit Test Project"), family: 'test' },
	{ id: 'nunit', label: localize('dotnetProject.template.nunit', "NUnit Test Project"), family: 'test' },
];

const OPTION_ROW = /^\s*(?:-[A-Za-z0-9](?:\s*,\s*|\s*\|\s*))?--(?<name>[A-Za-z][A-Za-z0-9-]*)(?<detail>.*)$/;
const FRAMEWORK_VALUE = /^net\d+(?:\.\d+)?(?:-[A-Za-z0-9.-]+)?$/i;

export type ProjectWebApiStyle = 'minimalApis' | 'controllers';

export interface ITemplateCapabilities {
	readonly frameworks: readonly string[];
	readonly webApiStyles: readonly ProjectWebApiStyle[];
	readonly includeTests: boolean;
	readonly noRestore: boolean;
}

export interface ITemplateConfiguration {
	readonly framework?: string;
	readonly webApiStyle?: ProjectWebApiStyle;
	readonly includeTests: boolean;
	readonly restore: boolean;
	readonly initializeGit?: boolean;
}

/** Returns only approved short names present in the active SDK's recognizable template table. */
function splitTemplateTableCells(line: string): string[] {
	return line.trim().split(/\t+|\s{2,}/).map(cell => cell.trim()).filter(cell => cell.length > 0);
}

export function parseInstalledTemplateList(output: string): readonly IProjectTemplate[] {
	const lines = output.split(/\r?\n/);
	const headerIndex = lines.findIndex(line => /\bShort\s+Name(?:\(s\))?\b/i.test(line));
	if (headerIndex < 0) {
		return [];
	}
	const headers = splitTemplateTableCells(lines[headerIndex]);
	const shortNameIndex = headers.findIndex(header => /^Short\s+Name(?:\(s\))?$/i.test(header));
	if (shortNameIndex < 0 || headers.length < 2) {
		return [];
	}

	const result: IProjectTemplate[] = [];
	const seen = new Set<string>();
	for (const row of lines.slice(headerIndex + 1)) {
		if (row.trim().length === 0 || /^\s*[-\s]+$/.test(row)) {
			continue;
		}
		const cells = splitTemplateTableCells(row);
		if (shortNameIndex >= cells.length) {
			return [];
		}
		const shortNames = cells[shortNameIndex].split(/\s*[,/|]\s*/).filter(alias => alias.length > 0);
		const template = shortNames
			.map(alias => APPROVED_TEMPLATES.find(candidate => candidate.id.toLowerCase() === alias.toLowerCase()))
			.find((candidate): candidate is IProjectTemplate => candidate !== undefined);
		if (template) {
			const familyKey = template.id === 'webapp' || template.id === 'razor' ? 'razorPages' : template.id;
			if (!seen.has(familyKey)) {
				seen.add(familyKey);
				result.push(template);
			}
		}
	}
	return result;
}

/** Parses option rows from one template's help output, failing closed on an unknown format. */
export function parseTemplateHelp(output: string): ITemplateOptionSurface {
	const lines = output.split(/\r?\n/);
	const optionsIndex = lines.findIndex(line => /^\s*Options:\s*$/i.test(line));
	if (optionsIndex < 0) {
		return { recognized: false, options: [] };
	}

	const options: ITemplateOption[] = [];
	const seen = new Set<string>();
	let malformed = false;
	for (const line of lines.slice(optionsIndex + 1)) {
		if (/^\S[^:]*:\s*$/.test(line)) {
			break;
		}
		const match = OPTION_ROW.exec(line);
		if (!match?.groups) {
			if (/^\s+-/.test(line)) {
				malformed = true;
			}
			continue;
		}
		const name = match.groups['name'];
		if (seen.has(name)) {
			malformed = true;
			continue;
		}
		seen.add(name);
		const valuesText = /<([^>]+)>/.exec(match.groups['detail'])?.[1];
		const values = valuesText?.split(/\s*[|,]\s*/).filter(value => FRAMEWORK_VALUE.test(value)) ?? [];
		options.push({ name, values });
	}

	return options.length > 0 && !malformed ? { recognized: true, options } : { recognized: false, options: [] };
}

/** Resolves the option metadata for a specific template without assuming cross-template parity. */
export function hasTemplateOption(surface: ITemplateOptionSurface, name: string): boolean {
	return surface.recognized && surface.options.some(option => option.name === name);
}

/** Returns only explicitly enumerated target frameworks from the selected template's help. */
export function getTemplateFrameworks(surface: ITemplateOptionSurface): readonly string[] {
	return surface.options.find(option => option.name === 'framework')?.values ?? [];
}

/** Derives the selectable controls from one template's recognized help surface. */
export function getTemplateCapabilities(templateId: string, surface: ITemplateOptionSurface): ITemplateCapabilities {
	const frameworks = surface.recognized ? getTemplateFrameworks(surface) : [];
	const isWebApi = templateId === 'webapi' || templateId === 'webapiaot';
	const webApiStyles: ProjectWebApiStyle[] = [];
	if (surface.recognized && isWebApi && hasTemplateOption(surface, 'use-minimal-apis')) {
		webApiStyles.push('minimalApis');
	}
	if (surface.recognized && isWebApi && hasTemplateOption(surface, 'use-controllers')) {
		webApiStyles.push('controllers');
	}
	return {
		frameworks,
		webApiStyles,
		includeTests: surface.recognized && hasTemplateOption(surface, 'include-tests'),
		noRestore: surface.recognized && hasTemplateOption(surface, 'no-restore'),
	};
}

/** Maps only user choices explicitly supported by the selected template's active help surface. */
export function createDotnetNewOptions(templateId: string, surface: ITemplateOptionSurface, configuration: ITemplateConfiguration): readonly IDotnetNewTemplateOption[] | undefined {
	const capabilities = getTemplateCapabilities(templateId, surface);
	if (configuration.framework !== undefined && !capabilities.frameworks.includes(configuration.framework)) {
		return undefined;
	}
	if (configuration.webApiStyle !== undefined && !capabilities.webApiStyles.includes(configuration.webApiStyle)) {
		return undefined;
	}
	if (configuration.includeTests && !capabilities.includeTests) {
		return undefined;
	}
	if (!configuration.restore && !capabilities.noRestore) {
		return undefined;
	}

	const options: IDotnetNewTemplateOption[] = [];
	if (configuration.framework !== undefined) {
		options.push({ name: 'framework', value: configuration.framework });
	}
	if (configuration.webApiStyle === 'minimalApis') {
		options.push({ name: 'use-minimal-apis' });
	} else if (configuration.webApiStyle === 'controllers') {
		options.push({ name: 'use-controllers' });
	}
	if (configuration.includeTests) {
		options.push({ name: 'include-tests' });
	}
	if (!configuration.restore) {
		options.push({ name: 'no-restore' });
	}
	return options;
}
