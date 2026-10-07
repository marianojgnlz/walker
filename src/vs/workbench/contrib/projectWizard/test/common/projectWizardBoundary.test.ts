/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

suite('project wizard protected integration boundaries', () => {
	test('uses only the shared core contract and emits no account, authentication, or telemetry dependency', () => {
		const coreSources = [
			source('src/vs/workbench/contrib/projectWizard/browser/projectWizard.ts'),
			source('src/vs/workbench/contrib/projectWizard/browser/projectWizard.contribution.ts'),
			source('src/vs/workbench/contrib/projectWizard/browser/deferredGitInitialization.ts'),
		].join('\n');

		assert.doesNotMatch(coreSources, /(?:from|import)\s*['"][^'"]*extensions\/dotnet-toolchain/);
		assert.doesNotMatch(coreSources, /(?:IAuthenticationService|ITelemetryService|IAccountService|telemetryService|signIn\s*\()/i);
		assert.doesNotMatch(coreSources, /\bfetch\s*\(|https?:\/\//i);
	});

	test('keeps template work to the approved local list/help/dry-run/generate operations', () => {
		const wizard = source('src/vs/workbench/contrib/projectWizard/browser/projectWizard.ts');
		const operations = [...wizard.matchAll(/operation:\s*'([^']+)'/g)].map(match => match[1]);
		assert.deepStrictEqual([...new Set(operations)].sort(), ['dryRun', 'generate', 'help', 'listTemplates']);
	});

	test('uses canonical workspace history rather than a parallel recent-project store', () => {
		const wizardContribution = source('src/vs/workbench/contrib/projectWizard/browser/projectWizard.contribution.ts');
		const welcome = source('src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts');
		assert.match(wizardContribution, /workspacesService\.addRecentlyOpened\(/);
		assert.match(welcome, /this\.workspacesService\.getRecentlyOpened\(\)/);
		assert.match(welcome, /this\.workspacesService\.removeRecentlyOpened\(/);
	});
});
