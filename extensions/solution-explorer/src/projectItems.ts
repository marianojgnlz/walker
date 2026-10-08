/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IGraphDiagnostic } from './model';
import { SCAN_LIMITS } from './scanLimits';
import type { IProjectItemDeclaration, IProjectMetadata, IProjectProvenance } from './projectParser';

export interface IProjectItemsOptions {
	readonly projectDirectory: string;
	readonly workspaceRoot: string;
	/** Already-discovered local paths; this projection never stats or reads them. */
	readonly localFiles: readonly string[];
}

export interface IProjectedProjectFile {
	readonly id: string;
	readonly path: string;
	readonly resourceUri: string;
	readonly label: string;
	readonly itemTypes: readonly string[];
	readonly displayOnly: boolean;
	readonly missing: boolean;
	readonly implicit: boolean;
	readonly provenance: readonly IProjectProvenance[];
}

export interface IProjectItemsResult {
	readonly files: readonly IProjectedProjectFile[];
	readonly diagnostics: readonly IGraphDiagnostic[];
	readonly partial: boolean;
}

interface IMutableProjectFile {
	readonly path: string;
	label: string;
	readonly itemTypes: Set<string>;
	readonly displayOnly: boolean;
	missing: boolean;
	implicit: boolean;
	readonly provenance: IProjectProvenance[];
}

interface IGlob {
	readonly regex: RegExp;
	readonly value: string;
}

const excludedDirectoryNames = new Set(['.git', 'bin', 'obj']);
const maxPatternLength = 512;
const maxPatternsPerDeclaration = 128;

function isWithin(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function relativePath(root: string, candidate: string): string {
	return path.relative(root, candidate).split(path.sep).join('/');
}

function isExcludedPath(relative: string): boolean {
	return relative.split('/').some(segment => excludedDirectoryNames.has(segment.toLowerCase()));
}

function compileGlob(value: string): IGlob | undefined {
	const normalized = value.replace(/\\/g, '/');
	if (normalized.length === 0 || normalized.length > maxPatternLength || /[\[\]{}!]/.test(normalized)) { return undefined; }
	let source = '^';
	for (let index = 0; index < normalized.length; index++) {
		const character = normalized[index];
		if (character === '*' && normalized[index + 1] === '*') {
			if (normalized[index + 2] === '/') {
				source += '(?:.*/)?';
				index += 2;
			} else {
				source += '.*';
				index++;
			}
		} else if (character === '*') {
			source += '[^/]*';
		} else if (character === '?') {
			source += '[^/]';
		} else {
			source += /[.+^$()|\\]/.test(character) ? `\\${character}` : character;
		}
	}
	return { regex: new RegExp(`${source}$`), value: normalized };
}

function splitPatterns(value: string): string[] | undefined {
	const patterns = value.split(';').map(pattern => pattern.trim()).filter(pattern => pattern.length > 0);
	return patterns.length > 0 && patterns.length <= maxPatternsPerDeclaration ? patterns : undefined;
}

function metadataValue(declaration: IProjectItemDeclaration, name: string): string | undefined {
	return declaration.metadata.find(item => item.name.toLowerCase() === name.toLowerCase())?.value;
}

function uriForLocalPath(value: string): string {
	return pathToFileURL(value).href;
}

/** Projects declared file items against bounded local paths without filesystem or build-system access. */
export function projectProjectItems(project: IProjectMetadata, options: IProjectItemsOptions): IProjectItemsResult {
	const projectDirectory = path.resolve(options.projectDirectory);
	const workspaceRoot = path.resolve(options.workspaceRoot);
	const availableFiles = new Map<string, string>();
	for (const value of options.localFiles) {
		const absolute = path.resolve(value);
		if (!isWithin(workspaceRoot, absolute)) { continue; }
		if (isExcludedPath(relativePath(workspaceRoot, absolute))) { continue; }
		availableFiles.set(absolute, absolute);
	}

	const diagnostics: IGraphDiagnostic[] = [...project.diagnostics];
	const files = new Map<string, IMutableProjectFile>();
	let partial = project.partial;
	let diagnosticIndex = 0;
	let globChecks = 0;
	let globLimitReached = false;
	let nodeLimitReached = false;
	const report = (code: string, message: string, provenance?: IProjectProvenance, affectsPartial = true): void => {
		diagnostics.push({
			id: `project-items:${project.navigationUri}:${code}:${provenance?.offset ?? 'scan'}:${diagnosticIndex++}`,
			code,
			message,
			severity: 'warning',
			resourceUri: project.navigationUri,
		});
		if (affectsPartial) { partial = true; }
	};
	const withinBudget = (provenance: IProjectProvenance): boolean => {
		if (globChecks < SCAN_LIMITS.directoryEntries) {
			globChecks++;
			return true;
		}
		if (!globLimitReached) {
			report('project-item-glob-limit', `Project item matching exceeds ${SCAN_LIMITS.directoryEntries} path checks.`, provenance);
			globLimitReached = true;
		}
		return false;
	};
	const addFile = (absolute: string, itemType: string, label: string, missing: boolean, displayOnly: boolean, implicit: boolean, provenance?: IProjectProvenance): void => {
		const existing = files.get(absolute);
		if (existing) {
			if (existing.itemTypes.has(itemType)) {
				report('duplicate-project-file', `Project file '${absolute}' is declared more than once.`, provenance, false);
			} else {
				existing.itemTypes.add(itemType);
			}
			if (label !== relativePath(projectDirectory, absolute)) { existing.label = label; }
			existing.missing = existing.missing && missing;
			existing.implicit = existing.implicit || implicit;
			if (provenance) { existing.provenance.push(provenance); }
			return;
		}
		if (files.size >= SCAN_LIMITS.graphNodes) {
			if (!nodeLimitReached) { report('project-item-node-limit', `Project items exceed ${SCAN_LIMITS.graphNodes} nodes.`, provenance); }
			nodeLimitReached = true;
			return;
		}
		files.set(absolute, {
			path: absolute,
			label,
			itemTypes: new Set([itemType]),
			displayOnly,
			missing,
			implicit,
			provenance: provenance ? [provenance] : [],
		});
	};
	const removeFileType = (absolute: string, itemType: string): void => {
		const existing = files.get(absolute);
		if (!existing) { return; }
		existing.itemTypes.delete(itemType);
		if (existing.itemTypes.size === 0) { files.delete(absolute); }
	};
	const excludedByPatterns = (candidate: string, patterns: readonly IGlob[], provenance: IProjectProvenance): boolean | undefined => {
		const candidatePath = relativePath(projectDirectory, candidate);
		for (const pattern of patterns) {
			if (!withinBudget(provenance)) { return undefined; }
			if (pattern.regex.test(candidatePath)) { return true; }
		}
		return false;
	};
	const compilePatterns = (value: string, provenance: IProjectProvenance): IGlob[] | undefined => {
		const values = splitPatterns(value);
		if (!values) {
			report('unsupported-project-pattern', 'The project item has an empty or excessive pattern list.', provenance);
			return undefined;
		}
		const result: IGlob[] = [];
		for (const pattern of values) {
			const compiled = compileGlob(pattern);
			if (!compiled) {
				report('unsupported-project-pattern', `Project item pattern '${pattern}' is unsupported.`, provenance);
				return undefined;
			}
			result.push(compiled);
		}
		return result;
	};
	const resolveTarget = (value: string): string | undefined => {
		const normalized = value.replace(/\\/g, path.sep);
		if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(normalized) || /^[A-Za-z]:[\\/]/.test(value)) { return undefined; }
		return path.resolve(projectDirectory, normalized);
	};

	for (const declaration of project.itemDeclarations) {
		if (globLimitReached || nodeLimitReached) { break; }
		const itemType = declaration.itemType.toLowerCase();
		if (itemType !== 'compile' && itemType !== 'content' && itemType !== 'none') { continue; }
		if (declaration.unsupportedReason || declaration.operation === 'unsupported') { continue; }
		if (declaration.operation === 'update') {
			report('unsupported-project-item', 'Update item declarations are preserved but not projected.', declaration.provenance);
			continue;
		}
		const value = declaration.operation === 'remove' ? declaration.remove : declaration.include;
		if (value === undefined) { continue; }
		const patterns = compilePatterns(value, declaration.provenance);
		if (!patterns) { continue; }
		const excludePatterns = declaration.exclude ? compilePatterns(declaration.exclude, declaration.provenance) : [];
		if (!excludePatterns) { continue; }

		if (declaration.operation === 'remove') {
			for (const pattern of patterns) {
				if (globLimitReached) { break; }
				const matcher = compileGlob(pattern.value)!;
				for (const file of [...files.values()]) {
					if (!file.itemTypes.has(declaration.itemType)) { continue; }
					if (!withinBudget(declaration.provenance)) { break; }
					if (matcher.regex.test(relativePath(projectDirectory, file.path))) { removeFileType(file.path, declaration.itemType); }
				}
			}
			continue;
		}

		for (const pattern of patterns) {
			if (globLimitReached) { break; }
			const hasGlob = /[*?]/.test(pattern.value);
			if (hasGlob) {
				if (path.isAbsolute(pattern.value) || /^[A-Za-z]:[\\/]/.test(pattern.value)) {
					report('unsupported-project-pattern', 'Absolute glob patterns are not supported.', declaration.provenance);
					continue;
				}
				const matcher = compileGlob(pattern.value)!;
				for (const candidate of availableFiles.values()) {
					if (!withinBudget(declaration.provenance)) { break; }
					const relative = relativePath(projectDirectory, candidate);
					if (!matcher.regex.test(relative) || isExcludedPath(relativePath(workspaceRoot, candidate))) { continue; }
					const excluded = excludedByPatterns(candidate, excludePatterns, declaration.provenance);
					if (excluded === undefined) { break; }
					if (excluded) { continue; }
					const link = metadataValue(declaration, 'Link');
					addFile(candidate, declaration.itemType, link ?? relative, false, false, false, declaration.provenance);
				}
				continue;
			}
			const target = resolveTarget(pattern.value);
			if (!target) {
				report('unsupported-project-pattern', `Project item path '${pattern.value}' is not a local filesystem path.`, declaration.provenance);
				continue;
			}
			const excluded = excludedByPatterns(target, excludePatterns, declaration.provenance);
			if (excluded === undefined || excluded) { continue; }
			const relativeToRoot = relativePath(workspaceRoot, target);
			if (!isWithin(workspaceRoot, target)) {
				const link = metadataValue(declaration, 'Link');
				addFile(target, declaration.itemType, link ?? path.basename(target), false, true, false, declaration.provenance);
				continue;
			}
			if (isExcludedPath(relativeToRoot)) { continue; }
			const exists = availableFiles.has(target);
			addFile(target, declaration.itemType, metadataValue(declaration, 'Link') ?? relativePath(projectDirectory, target), !exists, false, false, declaration.provenance);
			if (!exists) { report('missing-project-file', `Declared project file '${pattern.value}' was not discovered locally.`, declaration.provenance); }
		}
	}

	if (project.sdkStyle && project.enableDefaultItems && project.enableDefaultCompileItems) {
		if (project.implicitItemsPartial) {
			report('implicit-items-partial', 'SDK implicit Compile items are partial because a default-item control is conditional or unsupported.');
		} else {
			for (const candidate of availableFiles.values()) {
				if (!isWithin(projectDirectory, candidate) || path.extname(candidate).toLowerCase() !== '.cs') { continue; }
				if (isExcludedPath(relativePath(workspaceRoot, candidate))) { continue; }
				addFile(candidate, 'Compile', relativePath(projectDirectory, candidate), false, false, true);
			}
		}
	}

	return {
		files: [...files.values()].map(file => ({
			id: `project-file:${uriForLocalPath(file.path)}`,
			path: file.path,
			resourceUri: uriForLocalPath(file.path),
			label: file.label,
			itemTypes: [...file.itemTypes],
			displayOnly: file.displayOnly,
			missing: file.missing,
			implicit: file.implicit,
			provenance: [...file.provenance],
		})),
		diagnostics,
		partial,
	};
}
