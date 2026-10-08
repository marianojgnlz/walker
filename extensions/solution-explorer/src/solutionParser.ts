/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IGraphDiagnostic } from './model';

export interface ISolutionProjectRecord {
	readonly typeGuid: string;
	readonly name: string;
	readonly relativePath: string;
	readonly projectGuid: string;
	readonly line: number;
}

export interface ISolutionSection {
	readonly name: string;
	readonly entries: readonly string[];
	readonly line: number;
}

export interface ISolutionParseResult {
	readonly projects: readonly ISolutionProjectRecord[];
	readonly sections: readonly ISolutionSection[];
	readonly diagnostics: readonly IGraphDiagnostic[];
}

const guidPattern = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i;
const projectPattern = /^\s*Project\s*\(\s*"([^"]*)"\s*\)\s*=\s*"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"\s*,\s*"([^"]*)"\s*$/;
const sectionPattern = /^\s*GlobalSection\(\s*([^)]+?)\s*\)\s*=\s*([A-Za-z]+)\s*$/;
const supportedProjectTypes = new Set([
	'{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}', // C# (legacy)
	'{9A19103F-16F7-4668-BE54-9A1E7A4F7556}', // C# (SDK-style)
	'{66A26720-8FB5-11D2-AA7E-00C04F688DDE}', // Solution folder
	'{D954291E-2A0B-460D-934E-DC6B0785DB48}', // Shared project
]);
const supportedSections = new Set([
	'NestedProjects',
	'SolutionConfigurationPlatforms',
	'ProjectConfigurationPlatforms',
	'SolutionProperties',
	'ExtensibilityGlobals',
]);

function diagnostic(code: string, message: string, sourceUri: string | undefined, line: number): IGraphDiagnostic {
	return {
		id: `solution:${sourceUri ?? 'unknown'}:${code}:${line}`,
		code,
		message,
		severity: 'warning',
		...(sourceUri === undefined ? {} : { resourceUri: sourceUri }),
	};
}

function decodeQuoted(value: string): string {
	return value.replace(/""/g, '"');
}

function freezeSection(name: string, entries: string[], line: number): ISolutionSection {
	return { name, entries: [...entries], line };
}

/** Parses conventional Project records as inert data; no project path is opened or evaluated. */
export function parseSolution(text: string, sourceUri?: string): ISolutionParseResult {
	if (sourceUri?.toLowerCase().endsWith('.slnx')) {
		return {
			projects: [],
			sections: [],
			diagnostics: [diagnostic('unsupported-solution-format', '.slnx solutions are not supported by the conventional solution parser.', sourceUri, 1)],
		};
	}

	const projects: ISolutionProjectRecord[] = [];
	const sections: ISolutionSection[] = [];
	const diagnostics: IGraphDiagnostic[] = [];
	const seenProjectGuids = new Set<string>();
	let activeSection: { name: string; entries: string[]; line: number } | undefined;
	const lines = text.split(/\r\n|\n|\r/);

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const lineNumber = index + 1;
		if (activeSection) {
			if (/^\s*EndGlobalSection\s*$/.test(line)) {
				sections.push(freezeSection(activeSection.name, activeSection.entries, activeSection.line));
				if (!supportedSections.has(activeSection.name)) {
					diagnostics.push(diagnostic('unsupported-solution-section', `Solution section '${activeSection.name}' is retained but not interpreted.`, sourceUri, activeSection.line));
				}
				activeSection = undefined;
			} else {
				activeSection.entries.push(line);
			}
			continue;
		}

		const sectionMatch = sectionPattern.exec(line);
		if (sectionMatch) {
			activeSection = { name: sectionMatch[1], entries: [], line: lineNumber };
			continue;
		}
		if (/^\s*GlobalSection\b/.test(line)) {
			diagnostics.push(diagnostic('malformed-solution-section', 'A solution section header is malformed.', sourceUri, lineNumber));
			continue;
		}
		if (!/^\s*Project\s*\(/.test(line)) {
			continue;
		}

		const match = projectPattern.exec(line);
		if (!match) {
			diagnostics.push(diagnostic('malformed-project-record', 'A Project record is malformed and was not interpreted.', sourceUri, lineNumber));
			continue;
		}
		const typeGuid = match[1].toUpperCase();
		const name = decodeQuoted(match[2]);
		const relativePath = decodeQuoted(match[3]);
		const projectGuid = match[4].toUpperCase();
		if (!guidPattern.test(typeGuid) || !guidPattern.test(projectGuid)) {
			diagnostics.push(diagnostic('invalid-project-guid', 'A Project record contains an invalid type or project GUID.', sourceUri, lineNumber));
			continue;
		}
		if (name.length === 0 || relativePath.length === 0) {
			diagnostics.push(diagnostic('missing-project-entry', 'A Project record is missing its name or path.', sourceUri, lineNumber));
			continue;
		}
		if (seenProjectGuids.has(projectGuid)) {
			diagnostics.push(diagnostic('duplicate-project-guid', `Project GUID '${projectGuid}' is duplicated.`, sourceUri, lineNumber));
			continue;
		}
		seenProjectGuids.add(projectGuid);
		projects.push({ typeGuid, name, relativePath, projectGuid, line: lineNumber });
		if (!supportedProjectTypes.has(typeGuid)) {
			diagnostics.push(diagnostic('unsupported-project-kind', `Project kind '${typeGuid}' is retained as data but not interpreted.`, sourceUri, lineNumber));
		}
	}

	if (activeSection) {
		sections.push(freezeSection(activeSection.name, activeSection.entries, activeSection.line));
		diagnostics.push(diagnostic('unterminated-solution-section', `Solution section '${activeSection.name}' is not terminated.`, sourceUri, activeSection.line));
	}
	return { projects, sections, diagnostics };
}
