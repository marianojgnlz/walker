/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IGraphDiagnostic } from './model';
import { SCAN_LIMITS } from './scanLimits';
import type { IProjectItemDeclaration, IProjectItemMetadata, IProjectMetadata, IProjectProvenance } from './projectParser';

export type ProjectDependencyKind = 'project' | 'package' | 'assembly';

export interface IProjectDependency {
	readonly id: string;
	readonly kind: ProjectDependencyKind;
	readonly label: string;
	readonly resourceUri?: string;
	readonly version?: string;
	readonly hintPath?: string;
	readonly metadata: readonly IProjectItemMetadata[];
	readonly provenance: IProjectProvenance;
	readonly missing: boolean;
	readonly displayOnly: boolean;
	readonly navigable: boolean;
}

export interface IProjectReferencesOptions {
	readonly projectDirectory: string;
	readonly workspaceRoot: string;
	/** Bounded project paths already discovered under workspace roots; targets are never probed here. */
	readonly discoveredProjects: readonly string[];
}

export interface IProjectReferencesResult {
	readonly dependencies: readonly IProjectDependency[];
	readonly diagnostics: readonly IGraphDiagnostic[];
	readonly partial: boolean;
}

const maxReferencesPerDeclaration = 128;

function isWithin(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function metadataValue(declaration: IProjectItemDeclaration, name: string): string | undefined {
	return declaration.metadata.find(item => item.name.toLowerCase() === name.toLowerCase())?.value
		?? declaration.attributes.find(item => item.name.toLowerCase() === name.toLowerCase())?.value;
}

function splitReferences(value: string): string[] | undefined {
	const references = value.split(';').map(reference => reference.trim()).filter(reference => reference.length > 0);
	return references.length > 0 && references.length <= maxReferencesPerDeclaration ? references : undefined;
}

function fileUri(value: string): string { return pathToFileURL(value).href; }

function targetPath(projectDirectory: string, include: string): string | undefined {
	const normalized = include.replace(/\\/g, path.sep);
	const foreignDrivePath = /^[A-Za-z]:[\\/]/.test(include) && !path.isAbsolute(normalized);
	if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(normalized) || foreignDrivePath || /[*?]/.test(include)) { return undefined; }
	return path.resolve(projectDirectory, normalized);
}

function versionFromAssemblyIdentity(include: string): string | undefined {
	return /(?:^|,)\s*Version\s*=\s*([^,\s]+)/i.exec(include)?.[1];
}

/** Projects declared references as metadata; it never reads targets, resolves packages, or runs tools. */
export function projectProjectReferences(project: IProjectMetadata, options: IProjectReferencesOptions): IProjectReferencesResult {
	const projectDirectory = path.resolve(options.projectDirectory);
	const workspaceRoot = path.resolve(options.workspaceRoot);
	const discoveredProjects = new Set(options.discoveredProjects.map(value => path.resolve(value)).filter(value => isWithin(workspaceRoot, value)));
	const dependencies = new Map<string, IProjectDependency>();
	const diagnostics: IGraphDiagnostic[] = [...project.diagnostics];
	let partial = project.partial;
	let diagnosticIndex = 0;
	let nodeLimitReported = false;

	const report = (code: string, message: string, provenance: IProjectProvenance, affectsPartial = true): void => {
		diagnostics.push({
			id: `project-references:${project.navigationUri}:${code}:${provenance.offset}:${diagnosticIndex++}`,
			code,
			message,
			severity: 'warning',
			resourceUri: project.navigationUri,
		});
		if (affectsPartial) { partial = true; }
	};
	const add = (identity: string, dependency: IProjectDependency): void => {
		if (dependencies.has(identity)) {
			report(`duplicate-${dependency.kind}-reference`, `The ${dependency.kind} reference '${dependency.label}' is declared more than once.`, dependency.provenance, false);
			return;
		}
		if (dependencies.size >= SCAN_LIMITS.graphNodes) {
			if (!nodeLimitReported) { report('project-reference-node-limit', `Project references exceed ${SCAN_LIMITS.graphNodes} nodes.`, dependency.provenance); }
			nodeLimitReported = true;
			return;
		}
		dependencies.set(identity, dependency);
	};
	const base = (kind: ProjectDependencyKind, label: string, provenance: IProjectProvenance, declaration: IProjectItemDeclaration, identity: string): Pick<IProjectDependency, 'id' | 'kind' | 'label' | 'metadata' | 'provenance'> => ({
		id: `dependency:${kind}:${encodeURIComponent(identity)}`,
		kind,
		label,
		metadata: [...declaration.attributes, ...declaration.metadata],
		provenance,
	});

	for (const declaration of project.itemDeclarations) {
		if (nodeLimitReported) { break; }
		const itemType = declaration.itemType.toLowerCase();
		if (itemType !== 'projectreference' && itemType !== 'packagereference' && itemType !== 'reference') { continue; }
		if (declaration.unsupportedReason) { continue; }
		if (declaration.operation !== 'include') {
			report('unsupported-project-reference', `${declaration.itemType} ${declaration.operation} declarations are not projected.`, declaration.provenance);
			continue;
		}
		if (declaration.include === undefined) { continue; }
		const references = splitReferences(declaration.include);
		if (!references) {
			report('unsupported-project-reference', 'The reference list is empty or exceeds the bounded limit.', declaration.provenance);
			continue;
		}

		for (const include of references) {
			if (itemType === 'projectreference') {
				const resolved = targetPath(projectDirectory, include);
				if (!resolved) {
					report('unsupported-project-reference', `Project reference '${include}' is not a literal local path.`, declaration.provenance);
					continue;
				}
				const local = isWithin(workspaceRoot, resolved);
				const missing = local && !discoveredProjects.has(resolved);
				const name = metadataValue(declaration, 'Name');
				const label = name ?? path.basename(resolved);
				const identity = `project:${resolved}`;
				const common = base('project', label, declaration.provenance, declaration, identity);
				add(identity, {
					...common,
					resourceUri: fileUri(resolved),
					missing,
					displayOnly: !local,
					navigable: local && !missing,
				});
				if (missing) { report('missing-project-reference', `Referenced project '${include}' was not discovered locally.`, declaration.provenance); }
				continue;
			}

			if (itemType === 'packagereference') {
				const label = include.trim();
				const identity = `package:${label.toLowerCase()}`;
				const common = base('package', label, declaration.provenance, declaration, identity);
				const version = metadataValue(declaration, 'Version') ?? metadataValue(declaration, 'VersionOverride');
				add(identity, { ...common, ...(version === undefined ? {} : { version }), missing: false, displayOnly: false, navigable: false });
				continue;
			}

			const label = include.split(',')[0].trim();
			const identity = `assembly:${include.toLowerCase()}`;
			const common = base('assembly', label, declaration.provenance, declaration, identity);
			const version = metadataValue(declaration, 'Version') ?? versionFromAssemblyIdentity(include);
			const hintPath = metadataValue(declaration, 'HintPath');
			add(identity, {
				...common,
				...(version === undefined ? {} : { version }),
				...(hintPath === undefined ? {} : { hintPath }),
				missing: false,
				displayOnly: false,
				navigable: false,
			});
		}
	}

	return { dependencies: [...dependencies.values()], diagnostics, partial };
}
