/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IGraphDiagnostic } from './model';
import { readXmlProject, type IXmlAttribute, type IXmlElement } from './xmlReader';

export interface IProjectProvenance {
	readonly projectUri: string;
	readonly offset: number;
}

export interface IProjectItemMetadata {
	readonly name: string;
	readonly value: string;
}

/** An inert declaration from an ItemGroup; it is never evaluated by MSBuild. */
export interface IProjectItemDeclaration {
	readonly itemType: string;
	readonly operation: 'include' | 'remove' | 'update' | 'unsupported';
	readonly include?: string;
	readonly remove?: string;
	readonly update?: string;
	readonly exclude?: string;
	readonly attributes: readonly IProjectItemMetadata[];
	readonly metadata: readonly IProjectItemMetadata[];
	readonly provenance: IProjectProvenance;
	readonly unsupportedReason?: string;
}

export interface IUnsupportedProjectDeclaration {
	readonly elementName: string;
	readonly reason: string;
	readonly attributes: readonly IProjectItemMetadata[];
	readonly projectUri: string;
	readonly offset: number;
}

export interface IProjectMetadata {
	readonly navigationUri: string;
	readonly sdk?: string;
	readonly sdkStyle: boolean;
	readonly enableDefaultItems: boolean;
	readonly enableDefaultCompileItems: boolean;
	readonly implicitItemsPartial: boolean;
	readonly itemDeclarations: readonly IProjectItemDeclaration[];
	readonly unsupportedDeclarations: readonly IUnsupportedProjectDeclaration[];
	readonly diagnostics: readonly IGraphDiagnostic[];
	readonly partial: boolean;
}

const propertyPattern = /\$\(|%\(|@\(/;
const controlNames = new Set(['enabledefaultitems', 'enabledefaultcompileitems']);

function lowerName(name: string): string { return name.toLowerCase(); }

function attribute(element: IXmlElement, name: string): IXmlAttribute | undefined {
	return element.attributes.find(candidate => lowerName(candidate.localName) === lowerName(name));
}

function attributes(element: IXmlElement): IProjectItemMetadata[] {
	return element.attributes
		.filter(candidate => candidate.localName.toLowerCase() !== 'xmlns')
		.map(candidate => ({ name: candidate.localName, value: candidate.value }));
}

function hasCondition(element: IXmlElement): boolean {
	return attribute(element, 'Condition') !== undefined;
}

/** Projects literal metadata from an XML tree without evaluating conditions, imports, or expressions. */
export function parseProject(source: string, navigationUri: string): IProjectMetadata {
	const xml = readXmlProject(source, navigationUri);
	const diagnostics: IGraphDiagnostic[] = [...xml.diagnostics];
	const unsupportedDeclarations: IUnsupportedProjectDeclaration[] = [];
	const itemDeclarations: IProjectItemDeclaration[] = [];
	let partial = xml.partial;
	let sdk: string | undefined;
	let sdkStyle = false;
	let enableDefaultItems = true;
	let enableDefaultCompileItems = true;
	let implicitItemsPartial = false;
	let diagnosticIndex = 0;

	const report = (element: IXmlElement, code: string, reason: string): void => {
		diagnostics.push({
			id: `project:${navigationUri}:${code}:${element.offset}:${diagnosticIndex++}`,
			code,
			message: reason,
			severity: 'warning',
			resourceUri: navigationUri,
		});
		partial = true;
	};
	const preserveUnsupported = (element: IXmlElement, reason: string): void => {
		unsupportedDeclarations.push({
			elementName: element.localName,
			reason,
			attributes: attributes(element),
			projectUri: navigationUri,
			offset: element.offset,
		});
		report(element, 'unsupported-project-declaration', reason);
	};

	const root = xml.root;
	if (!root || root.localName.toLowerCase() !== 'project') {
		if (root) { preserveUnsupported(root, 'The XML root is not an MSBuild Project element.'); }
		else if (!xml.partial) {
			diagnostics.push({ id: `project:${navigationUri}:root-missing`, code: 'project-root-missing', message: 'The project file has no Project root element.', severity: 'warning', resourceUri: navigationUri });
			partial = true;
		}
		return { navigationUri, sdkStyle, enableDefaultItems, enableDefaultCompileItems, implicitItemsPartial, itemDeclarations, unsupportedDeclarations, diagnostics, partial };
	}

	const sdkAttribute = attribute(root, 'Sdk');
	if (sdkAttribute) {
		const value = sdkAttribute.value.trim();
		if (value.length > 0 && !propertyPattern.test(value)) {
			sdk = value;
			sdkStyle = true;
		} else {
			preserveUnsupported(root, 'The SDK declaration is not a non-empty literal value.');
		}
	}
	if (hasCondition(root)) {
		preserveUnsupported(root, 'A conditional Project declaration cannot be evaluated.');
		implicitItemsPartial = true;
	}

	for (const group of root.children) {
		const groupName = group.localName.toLowerCase();
		if (groupName === 'propertygroup') {
			if (hasCondition(group)) {
				if (group.children.some(property => controlNames.has(property.localName.toLowerCase()))) { implicitItemsPartial = true; }
				preserveUnsupported(group, 'A conditional PropertyGroup cannot be evaluated.');
				continue;
			}
			for (const property of group.children) {
				const propertyName = property.localName.toLowerCase();
				const isControl = controlNames.has(propertyName);
				if (hasCondition(property)) {
					if (isControl) { implicitItemsPartial = true; }
					preserveUnsupported(property, 'A conditional property cannot be evaluated.');
					continue;
				}
				const value = property.text.trim();
				if (propertyPattern.test(value) || property.children.length > 0) {
					if (isControl) { implicitItemsPartial = true; }
					preserveUnsupported(property, 'A property expression or nested property value cannot be evaluated.');
					continue;
				}
				if (isControl) {
					if (value.toLowerCase() === 'false') {
						if (propertyName === 'enabledefaultitems') { enableDefaultItems = false; }
						else { enableDefaultCompileItems = false; }
					} else if (value.toLowerCase() !== 'true') {
						implicitItemsPartial = true;
						preserveUnsupported(property, 'Only literal true or false implicit-item controls are understood.');
					}
				} else if (propertyPattern.test(value)) {
					preserveUnsupported(property, 'A property expression cannot be evaluated.');
				}
			}
			continue;
		}
		if (groupName === 'itemgroup') {
			const groupConditional = hasCondition(group);
			for (const item of group.children) {
				const operations = (['Include', 'Remove', 'Update'] as const)
					.map(name => ({ name, value: attribute(item, name)?.value }))
					.filter((entry): entry is { name: 'Include' | 'Remove' | 'Update'; value: string } => entry.value !== undefined);
				const operation = operations.length === 1 ? operations[0] : undefined;
				let unsupportedReason: string | undefined;
				if (groupConditional || hasCondition(item)) { unsupportedReason = 'A conditional item declaration cannot be evaluated.'; }
				else if (!operation) { unsupportedReason = 'An item must have exactly one Include, Remove, or Update attribute.'; }
				else if (item.attributes.some(candidate => lowerName(candidate.localName) !== 'condition' && propertyPattern.test(candidate.value))) {
					unsupportedReason = 'item expression is not a literal metadata declaration';
				}
				const itemMetadata = item.children.map(child => ({ name: child.localName, value: child.text.trim() }));
				if (!unsupportedReason && item.children.some(child => hasCondition(child) || propertyPattern.test(child.text))) {
					unsupportedReason = 'Conditional or expanded item metadata cannot be evaluated.';
				}
				const declaration: IProjectItemDeclaration = {
					itemType: item.localName,
					operation: operation ? operation.name.toLowerCase() as IProjectItemDeclaration['operation'] : 'unsupported',
					...(operation?.name === 'Include' ? { include: operation.value } : {}),
					...(operation?.name === 'Remove' ? { remove: operation.value } : {}),
					...(operation?.name === 'Update' ? { update: operation.value } : {}),
					...(attribute(item, 'Exclude') ? { exclude: attribute(item, 'Exclude')!.value } : {}),
					attributes: attributes(item),
					metadata: itemMetadata,
					provenance: { projectUri: navigationUri, offset: item.offset },
					...(unsupportedReason === undefined ? {} : { unsupportedReason }),
				};
				itemDeclarations.push(declaration);
				if (unsupportedReason) { report(item, 'unsupported-project-item', unsupportedReason); }
			}
			continue;
		}
		preserveUnsupported(group, `The '${group.localName}' project declaration is not interpreted.`);
	}

	return {
		navigationUri,
		...(sdk === undefined ? {} : { sdk }),
		sdkStyle,
		enableDefaultItems,
		enableDefaultCompileItems,
		implicitItemsPartial,
		itemDeclarations,
		unsupportedDeclarations,
		diagnostics,
		partial,
	};
}
