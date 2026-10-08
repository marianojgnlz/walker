/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SCAN_LIMITS } from './scanLimits';

export type XmlToken =
	| { readonly kind: 'start'; readonly name: string; readonly attributes: ReadonlyMap<string, string>; readonly selfClosing: boolean; readonly offset: number }
	| { readonly kind: 'end'; readonly name: string; readonly offset: number }
	| { readonly kind: 'text'; readonly value: string; readonly offset: number }
	| { readonly kind: 'comment'; readonly value: string; readonly offset: number }
	| { readonly kind: 'processingInstruction'; readonly target: string; readonly value: string; readonly offset: number };

export interface IXmlScanError {
	readonly code: string;
	readonly message: string;
	readonly offset: number;
}

export interface IXmlScanResult {
	readonly tokens: readonly XmlToken[];
	readonly error?: IXmlScanError;
}

class XmlScanFailure extends Error {
	constructor(readonly code: string, message: string, readonly offset: number) {
		super(message);
	}
}

function validXmlCharacter(codePoint: number): boolean {
	return codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd ||
		(codePoint >= 0x20 && codePoint <= 0xd7ff) ||
		(codePoint >= 0xe000 && codePoint <= 0xfffd) ||
		(codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function nameStart(codePoint: number): boolean {
	return codePoint === 0x3a || codePoint === 0x5f ||
		(codePoint >= 0x41 && codePoint <= 0x5a) || (codePoint >= 0x61 && codePoint <= 0x7a) ||
		(codePoint >= 0xc0 && codePoint <= 0xeffff && validXmlCharacter(codePoint));
}

function nameCharacter(codePoint: number): boolean {
	return nameStart(codePoint) || codePoint === 0x2d || codePoint === 0x2e || codePoint === 0xb7 ||
		(codePoint >= 0x30 && codePoint <= 0x39) || (codePoint >= 0x300 && codePoint <= 0x36f) ||
		(codePoint >= 0x203f && codePoint <= 0x2040);
}

/** Tokenizes a bounded XML document without resolving DTDs or external resources. */
export function scanXml(source: string): IXmlScanResult {
	if (Buffer.byteLength(source, 'utf8') > SCAN_LIMITS.metadataFileBytes) {
		return { tokens: [], error: { code: 'xml-file-too-large', message: `XML input exceeds ${SCAN_LIMITS.metadataFileBytes} bytes.`, offset: 0 } };
	}

	const tokens: XmlToken[] = [];
	let cursor = source.charCodeAt(0) === 0xfeff ? 1 : 0;
	const fail = (code: string, message: string, offset = cursor): never => { throw new XmlScanFailure(code, message, offset); };
	const emit = (token: XmlToken): void => {
		if (tokens.length >= SCAN_LIMITS.xmlTokens) {
			fail('xml-token-limit', `XML input exceeds ${SCAN_LIMITS.xmlTokens} tokens.`, token.offset);
		}
		tokens.push(token);
	};
	const codePointAt = (): number => source.codePointAt(cursor) ?? 0;
	const readName = (): string => {
		const start = cursor;
		let codePoint = codePointAt();
		if (!nameStart(codePoint)) { fail('xml-malformed', 'An XML name was expected.'); }
		cursor += codePoint > 0xffff ? 2 : 1;
		while (cursor < source.length) {
			codePoint = codePointAt();
			if (!nameCharacter(codePoint)) { break; }
			cursor += codePoint > 0xffff ? 2 : 1;
		}
		return source.slice(start, cursor);
	};
	const skipWhitespace = (): void => {
		while (cursor < source.length && /[\t\n\r ]/.test(source[cursor])) { cursor++; }
	};
	const decodeEntity = (): string => {
		const entityOffset = cursor++;
		const end = source.indexOf(';', cursor);
		if (end < 0) { return fail('xml-entity-invalid', 'An XML entity reference is not terminated.', entityOffset); }
		const entity = source.slice(cursor, end);
		cursor = end + 1;
		switch (entity) {
			case 'amp': return '&';
			case 'lt': return '<';
			case 'gt': return '>';
			case 'quot': return '"';
			case 'apos': return "'";
		}
		if (entity.startsWith('#')) {
			const hexadecimal = entity[1] === 'x' || entity[1] === 'X';
			const digits = entity.slice(hexadecimal ? 2 : 1);
			const validDigits = digits.length > 0 && [...digits].every(character => hexadecimal ? /[0-9a-fA-F]/.test(character) : /[0-9]/.test(character));
			const codePoint = validDigits ? Number.parseInt(digits, hexadecimal ? 16 : 10) : Number.NaN;
			if (Number.isSafeInteger(codePoint) && validXmlCharacter(codePoint)) { return String.fromCodePoint(codePoint); }
		}
		return fail('xml-entity-invalid', 'Only predefined and valid numeric XML entities are supported.', entityOffset);
	};
	const readDecoded = (terminator: string, rejectLessThan: boolean): string => {
		let value = '';
		while (cursor < source.length && source[cursor] !== terminator) {
			if (source[cursor] === '&') {
				value += decodeEntity();
				continue;
			}
			if (rejectLessThan && source[cursor] === '<') { fail('xml-malformed', 'An attribute value cannot contain a literal <.'); }
			if (source.startsWith(']]>', cursor)) { fail('xml-malformed', 'The sequence ]]> is not allowed in XML character data.'); }
			const codePoint = codePointAt();
			if (!validXmlCharacter(codePoint)) { fail('xml-malformed', 'XML contains an invalid character.'); }
			value += String.fromCodePoint(codePoint);
			cursor += codePoint > 0xffff ? 2 : 1;
		}
		return value;
	};

	try {
		while (cursor < source.length) {
			const offset = cursor;
			if (source[cursor] !== '<') {
				const value = readDecoded('<', false);
				emit({ kind: 'text', value, offset });
				continue;
			}
			if (source.startsWith('<!--', cursor)) {
				const end = source.indexOf('-->', cursor + 4);
				const doubleHyphen = source.indexOf('--', cursor + 4);
				if (end < 0 || (doubleHyphen >= 0 && doubleHyphen < end)) { fail('xml-malformed', 'An XML comment is malformed or unterminated.', offset); }
				const value = source.slice(cursor + 4, end);
				cursor = end + 3;
				emit({ kind: 'comment', value, offset });
				continue;
			}
			if (source.startsWith('<![CDATA[', cursor)) {
				const end = source.indexOf(']]>', cursor + 9);
				if (end < 0) { fail('xml-malformed', 'A CDATA section is unterminated.', offset); }
				const value = source.slice(cursor + 9, end);
				cursor = end + 3;
				emit({ kind: 'text', value, offset });
				continue;
			}
			if (source.startsWith('<?', cursor)) {
				cursor += 2;
				const target = readName();
				const end = source.indexOf('?>', cursor);
				if (end < 0) { fail('xml-malformed', 'A processing instruction is unterminated.', offset); }
				const value = source.slice(cursor, end).trim();
				cursor = end + 2;
				emit({ kind: 'processingInstruction', target, value, offset });
				continue;
			}
			if (source.startsWith('<!', cursor)) {
				const code = source.startsWith('<!DOCTYPE', cursor) || source.startsWith('<!ENTITY', cursor) ? 'xml-dtd-prohibited' : 'xml-declaration-unsupported';
				fail(code, code === 'xml-dtd-prohibited' ? 'DTD and custom entity declarations are prohibited.' : 'This XML declaration is unsupported.', offset);
			}
			if (source.startsWith('</', cursor)) {
				cursor += 2;
				const name = readName();
				skipWhitespace();
				if (source[cursor] !== '>') { fail('xml-malformed', 'An XML closing tag is malformed.', offset); }
				cursor++;
				emit({ kind: 'end', name, offset });
				continue;
			}

			cursor++;
			const name = readName();
			const attributes = new Map<string, string>();
			let selfClosing = false;
			while (cursor < source.length) {
				skipWhitespace();
				if (source[cursor] === '>') { cursor++; break; }
				if (source[cursor] === '/' && source[cursor + 1] === '>') { cursor += 2; selfClosing = true; break; }
				const attributeOffset = cursor;
				const attributeName = readName();
				if (attributes.has(attributeName)) { fail('xml-malformed', `Attribute '${attributeName}' is duplicated.`, attributeOffset); }
				skipWhitespace();
				if (source[cursor] !== '=') { fail('xml-malformed', `Attribute '${attributeName}' is missing '='.`, attributeOffset); }
				cursor++;
				skipWhitespace();
				const quote = source[cursor];
				if (quote !== '"' && quote !== "'") { fail('xml-malformed', `Attribute '${attributeName}' must use a quoted value.`, attributeOffset); }
				cursor++;
				const value = readDecoded(quote, true);
				if (source[cursor] !== quote) { fail('xml-malformed', `Attribute '${attributeName}' is unterminated.`, attributeOffset); }
				cursor++;
				attributes.set(attributeName, value);
			}
			if (cursor >= source.length && source[source.length - 1] !== '>') { fail('xml-malformed', 'An XML start tag is unterminated.', offset); }
			emit({ kind: 'start', name, attributes, selfClosing, offset });
		}
		return { tokens };
	} catch (error) {
		if (error instanceof XmlScanFailure) {
			return { tokens, error: { code: error.code, message: error.message, offset: error.offset } };
		}
		throw error;
	}
}
