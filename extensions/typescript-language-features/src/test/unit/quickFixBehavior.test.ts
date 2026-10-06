/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as vscode from 'vscode';
import { createTestEditor, wait } from '../testUtils';

suite('TypeScript quick-fix regression', () => {
	setup(async () => {
		await vscode.extensions.getExtension('vscode.typescript-language-features')!.activate();
	});

	teardown(async () => {
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	test('generic TypeScript interface quick fix remains available', async () => {
		const documentUri = vscode.Uri.parse('untitled:typescript-generic-quick-fix.ts');
		const editor = await createTestEditor(
			documentUri,
			`interface IFoo { value: string; }`,
			`class Foo implements IFoo { }`,
		);

		await wait(3000);

		const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
			'vscode.executeCodeActionProvider',
			documentUri,
			editor.document.lineAt(1).range,
		);

		assert.ok(actions?.some(action => action.title === `Implement interface 'IFoo'`));
	});
});
