/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { scanXml } from '../xmlScanner';
import { SCAN_LIMITS } from '../scanLimits';

suite('bounded XML scanner', () => {
	test('preserves qualified names and reads quoted attributes structurally', () => {
		const result = scanXml(`<msb:Project xmlns:msb="urn:build" Label='A &amp; B'/>`);
		assert.strictEqual(result.error, undefined);
		assert.deepStrictEqual(result.tokens, [{
			kind: 'start', name: 'msb:Project', selfClosing: true,
			attributes: new Map([['xmlns:msb', 'urn:build'], ['Label', 'A & B']]), offset: 0,
		}]);
	});

	test('skips comments as opaque tokens and retains processing instructions', () => {
		const result = scanXml(`<?xml version="1.0"?><!-- <Project/> -->\n<Project/>`);
		assert.strictEqual(result.error, undefined);
		assert.deepStrictEqual(result.tokens.map(token => token.kind), ['processingInstruction', 'comment', 'text', 'start']);
		assert.strictEqual(result.tokens[2].kind === 'text' ? result.tokens[2].value : '', '\n');
	});

	test('decodes predefined and numeric entities in text and attributes', () => {
		const result = scanXml(`<P a="&quot;&apos;&lt;&gt;&amp;&#65;&#x1F642;">&lt;&#x41;&gt;</P>`);
		assert.strictEqual(result.error, undefined);
		assert.strictEqual(result.tokens[0].kind === 'start' ? result.tokens[0].attributes.get('a') : '', `\"'<>&A🙂`);
		assert.strictEqual(result.tokens[1].kind === 'text' ? result.tokens[1].value : '', '<A>');
	});

	test('rejects DTD declarations, external/custom entities, and invalid numeric scalars', () => {
		assert.strictEqual(scanXml('<!DOCTYPE Project SYSTEM "file:///etc/passwd"><Project/>').error?.code, 'xml-dtd-prohibited');
		assert.strictEqual(scanXml('<Project>&external;</Project>').error?.code, 'xml-entity-invalid');
		assert.strictEqual(scanXml('<Project>&#xD800;</Project>').error?.code, 'xml-entity-invalid');
	});

	test('rejects malformed quoted attributes and comments', () => {
		assert.strictEqual(scanXml('<Project Name=value/>').error?.code, 'xml-malformed');
		assert.strictEqual(scanXml('<!-- not closed').error?.code, 'xml-malformed');
		assert.strictEqual(scanXml('<!-- invalid -- comment -->').error?.code, 'xml-malformed');
	});

	test('measures the metadata byte budget before scanning', () => {
		const oversized = 'é'.repeat(SCAN_LIMITS.metadataFileBytes / 2 + 1);
		const result = scanXml(oversized);
		assert.deepStrictEqual([result.tokens.length, result.error?.code], [0, 'xml-file-too-large']);
	});

	test('stops at the XML token budget and reports partial tokens', () => {
		const result = scanXml('<P/>'.repeat(SCAN_LIMITS.xmlTokens + 1));
		assert.deepStrictEqual([result.tokens.length, result.error?.code], [SCAN_LIMITS.xmlTokens, 'xml-token-limit']);
	});
});
