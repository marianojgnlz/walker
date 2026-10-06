/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '../../..');

function readSource(relativePath) {
	return fs.readFileSync(path.join(extensionRoot, 'src', relativePath), 'utf8');
}

suite('TypeScript feature Copilot boundary', () => {
	test('quick fixes retain generic actions without Copilot chat actions', () => {
		const quickFix = readSource('languageFeatures/quickFix.ts');

		assert.doesNotMatch(quickFix, /github\.copilot-chat|EditorChatFollowUp|isAI|with AI|Infer types using AI/);
		assert.match(quickFix, /execute\('getCodeFixes'/);
		assert.match(quickFix, /getEditForCodeAction/);
		assert.match(quickFix, /ApplyFixAllCodeAction/);
	});

	test('TypeScript 7 preview requires an empty generic plugin list', () => {
		const nativePreview = readSource('ui/suggestNativePreview.ts');

		assert.doesNotMatch(nativePreview, /copilotChatExtensionId|github\.copilot-chat/);
		assert.match(nativePreview, /pluginManager\.plugins\.length/);
		assert.match(nativePreview, /getTreatmentVariable\('suggestTS7IfNoPlugins'/);
	});

	test('language-service crash prompts include every plugin extension', () => {
		const client = readSource('typescriptServiceClient.ts');

		assert.doesNotMatch(client, /copilotChatExtensionId|github\.copilot-chat/);
		assert.match(client, /plugins\.map\(plugin => plugin\.extension\.id\)/);
	});

	test('generic refactor command composition remains without editor-chat follow-up', () => {
		const refactor = readSource('languageFeatures/refactor.ts');
		const helper = readSource('languageFeatures/util/copilot.ts');

		assert.doesNotMatch(refactor, /EditorChatFollowUp|vscode\.editorChat\.start/);
		assert.match(refactor, /CompositeCommand/);
		assert.doesNotMatch(helper, /EditorChatFollowUp|vscode\.editorChat\.start|EditorChatFollowUp_Args/);
		assert.match(helper, /CompositeCommand/);
	});
});
