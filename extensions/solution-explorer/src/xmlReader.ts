/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IGraphDiagnostic } from './model';
import { SCAN_LIMITS } from './scanLimits';
import { scanXml, type XmlToken } from './xmlScanner';

const xmlNamespace = 'http://www.w3.org/XML/1998/namespace';
const xmlnsNamespace = 'http://www.w3.org/2000/xmlns/';

export interface IXmlAttribute {
	readonly name: string;
	readonly localName: string;
	readonly namespaceUri: string;
	readonly value: string;
}

export interface IXmlElement {
	readonly name: string;
	readonly localName: string;
	readonly namespaceUri: string;
	readonly attributes: readonly IXmlAttribute[];
	readonly children: readonly IXmlElement[];
	readonly text: string;
	readonly offset: number;
}

export interface IXmlProjectReadResult {
	readonly root?: IXmlElement;
	readonly diagnostics: readonly IGraphDiagnostic[];
	readonly partial: boolean;
	readonly navigationUri: string;
}

interface IQualifiedName {
	readonly prefix: string;
	readonly localName: string;
}

interface IMutableXmlElement {
	readonly name: string;
	readonly localName: string;
	readonly namespaceUri: string;
	readonly namespaceBindings: ReadonlyMap<string, string>;
	readonly attributes: IXmlAttribute[];
	readonly children: IMutableXmlElement[];
	readonly text: string[];
	readonly offset: number;
}

function splitName(name: string): IQualifiedName | undefined {
	const separator = name.indexOf(':');
	if (separator < 0) { return { prefix: '', localName: name }; }
	if (separator === 0 || separator === name.length - 1 || name.indexOf(':', separator + 1) >= 0) { return undefined; }
	return { prefix: name.slice(0, separator), localName: name.slice(separator + 1) };
}

function freezeElement(element: IMutableXmlElement): IXmlElement {
	return {
		name: element.name,
		localName: element.localName,
		namespaceUri: element.namespaceUri,
		attributes: [...element.attributes],
		children: element.children.map(freezeElement),
		text: element.text.join(''),
		offset: element.offset,
	};
}

/** Reads XML structure only; project metadata interpretation and evaluation are separate concerns. */
export function readXmlProject(source: string, navigationUri: string): IXmlProjectReadResult {
	const scanned = scanXml(source);
	const diagnostics: IGraphDiagnostic[] = [];
	const stack: IMutableXmlElement[] = [];
	let root: IMutableXmlElement | undefined;
	let partial = false;
	let structuralFailure = false;

	const addDiagnostic = (code: string, message: string, offset: number): void => {
		diagnostics.push({
			id: `xml:${navigationUri}:${code}:${offset}:${diagnostics.length}`,
			code,
			message,
			severity: 'warning',
			resourceUri: navigationUri,
		});
		partial = true;
	};
	const fail = (code: string, message: string, offset: number): void => {
		if (!structuralFailure) {
			addDiagnostic(code, message, offset);
			structuralFailure = true;
		}
	};
	const qualified = (name: string, namespaces: ReadonlyMap<string, string>, isAttribute: boolean, offset: number): { localName: string; namespaceUri: string } | undefined => {
		const parts = splitName(name);
		if (!parts || parts.prefix === 'xmlns' || (!parts.prefix && parts.localName === 'xmlns')) {
			fail('xml-namespace-invalid', `Qualified name '${name}' is invalid or reserved.`, offset);
			return undefined;
		}
		if (parts.prefix) {
			const namespaceUri = namespaces.get(parts.prefix);
			if (namespaceUri === undefined) {
				fail('xml-namespace-unbound', `Namespace prefix '${parts.prefix}' is not declared.`, offset);
				return undefined;
			}
			return { localName: parts.localName, namespaceUri };
		}
		return { localName: parts.localName, namespaceUri: isAttribute ? '' : namespaces.get('') ?? '' };
	};
	const readStart = (token: Extract<XmlToken, { kind: 'start' }>): IMutableXmlElement | undefined => {
		if (stack.length >= SCAN_LIMITS.xmlDepth) {
			fail('xml-depth-limit', `XML nesting exceeds depth ${SCAN_LIMITS.xmlDepth}.`, token.offset);
			return undefined;
		}
		const namespaces = new Map(stack.at(-1)?.namespaceBindings ?? [['xml', xmlNamespace]]);
		for (const [name, value] of token.attributes) {
			if (name !== 'xmlns' && !name.startsWith('xmlns:')) { continue; }
			const prefix = name === 'xmlns' ? '' : name.slice('xmlns:'.length);
			if ((prefix && (!splitName(prefix) || prefix.includes(':'))) || prefix === 'xmlns' || value === xmlnsNamespace || (prefix !== 'xml' && value === xmlNamespace) || (prefix === 'xml' && value !== xmlNamespace) || (prefix !== '' && value === '')) {
				fail('xml-namespace-invalid', `Namespace declaration '${name}' uses a reserved or invalid binding.`, token.offset);
				return undefined;
			}
			namespaces.set(prefix, value);
		}

		const elementName = qualified(token.name, namespaces, false, token.offset);
		if (!elementName) { return undefined; }
		const attributes: IXmlAttribute[] = [];
		const expandedNames = new Set<string>();
		for (const [name, value] of token.attributes) {
			let attributeName: { localName: string; namespaceUri: string } | undefined;
			if (name === 'xmlns') {
				attributeName = { localName: 'xmlns', namespaceUri: xmlnsNamespace };
			} else if (name.startsWith('xmlns:')) {
				attributeName = { localName: name.slice('xmlns:'.length), namespaceUri: xmlnsNamespace };
			} else {
				attributeName = qualified(name, namespaces, true, token.offset);
			}
			if (!attributeName) { return undefined; }
			const expandedName = `${attributeName.namespaceUri}\0${attributeName.localName}`;
			if (expandedNames.has(expandedName)) {
				fail('xml-attribute-duplicate', `Attribute '${name}' duplicates an expanded attribute name.`, token.offset);
				return undefined;
			}
			expandedNames.add(expandedName);
			attributes.push({ name, ...attributeName, value });
		}

		const element: IMutableXmlElement = {
			name: token.name,
			...elementName,
			namespaceBindings: namespaces,
			attributes,
			children: [],
			text: [],
			offset: token.offset,
		};
		if (stack.length > 0) {
			stack[stack.length - 1].children.push(element);
		} else if (root) {
			fail('xml-multiple-roots', 'An XML document must contain exactly one root element.', token.offset);
			return undefined;
		} else {
			root = element;
		}
		if (!token.selfClosing) { stack.push(element); }
		return element;
	};

	for (const token of scanned.tokens) {
		if (structuralFailure) { break; }
		switch (token.kind) {
			case 'start':
				readStart(token);
				break;
			case 'end': {
				const open = stack.at(-1);
				if (!open) {
					fail('xml-unexpected-end-tag', `Closing tag '${token.name}' has no matching start tag.`, token.offset);
				} else if (open.name !== token.name) {
					fail('xml-mismatched-tag', `Closing tag '${token.name}' does not match '${open.name}'.`, token.offset);
				} else {
					stack.pop();
				}
				break;
			}
			case 'text':
				if (stack.length > 0) {
					stack[stack.length - 1].text.push(token.value);
				} else if (token.value.trim().length > 0) {
					fail('xml-text-outside-root', 'Non-whitespace XML text appears outside the root element.', token.offset);
				}
				break;
			case 'comment':
			case 'processingInstruction':
				break;
		}
	}

	if (scanned.error) {
		addDiagnostic(scanned.error.code, scanned.error.message, scanned.error.offset);
	} else if (!structuralFailure && stack.length > 0) {
		const open = stack.at(-1)!;
		fail('xml-unclosed-element', `Element '${open.name}' is not closed.`, open.offset);
	} else if (!structuralFailure && !root) {
		fail('xml-document-empty', 'The XML document has no root element.', 0);
	}

	return {
		...(root === undefined ? {} : { root: freezeElement(root) }),
		diagnostics,
		partial,
		navigationUri,
	};
}
