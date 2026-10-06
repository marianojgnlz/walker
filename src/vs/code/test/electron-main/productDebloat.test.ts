/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ServiceCollection } from '../../../platform/instantiation/common/serviceCollection.js';
import { ITelemetryService, TelemetryLevel } from '../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../platform/telemetry/common/telemetryUtils.js';
import { registerMainTelemetryService } from '../../electron-main/telemetryServiceRegistration.js';

function readRepoFile(relativePath: string): string {
	return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

suite('Product debloat process startup', () => {
	test('main process binds the no-op telemetry service with no reporting seam', () => {
		const services = new ServiceCollection();
		registerMainTelemetryService(services);

		assert.deepStrictEqual({
			noOpServiceBound: services.get(ITelemetryService) === NullTelemetryService,
			serviceIsObject: typeof NullTelemetryService === 'object',
			level: NullTelemetryService.telemetryLevel,
			sendErrorTelemetry: NullTelemetryService.sendErrorTelemetry,
		}, {
			noOpServiceBound: true,
			serviceIsObject: true,
			level: TelemetryLevel.NONE,
			sendErrorTelemetry: false,
		});
	});

	test('process entrypoints no longer construct reporting services, appenders or crash reporters', () => {
		assert.doesNotMatch(readRepoFile('src/main.ts'), /crashReporter/);

		const app = readRepoFile('src/vs/code/electron-main/app.ts');
		assert.doesNotMatch(app, /TelemetryAppenderClient|new SyncDescriptor\(TelemetryService|ErrorTelemetry|resolveCommonProperties|getPiiPathsFromEnvironment|telemetryAppender/);
		assert.match(app, /registerMainTelemetryService\(services\)/);

		const sharedProcess = readRepoFile('src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts');
		assert.doesNotMatch(sharedProcess, /OneDataSystemAppender|TelemetryAppenderChannel|TelemetryLogAppender|CustomEndpointTelemetryService|telemetryAppender|customEndpointTelemetry|supportsTelemetry/);
		assert.match(sharedProcess, /services\.set\(ITelemetryService, NullTelemetryService\)/);

		const server = readRepoFile('src/vs/server/node/serverServices.ts');
		assert.doesNotMatch(server, /OneDataSystemAppender|ServerTelemetryChannel|ServerTelemetryService|TelemetryLogAppender|ErrorTelemetry|telemetry-level/);
		assert.match(server, /services\.set\(ITelemetryService, NullTelemetryService\)/);

		const cli = readRepoFile('src/vs/code/node/cliProcessMain.ts');
		assert.doesNotMatch(cli, /OneDataSystemAppender|resolveCommonProperties|buildTelemetryMessage|resolveMachineId/);
		assert.match(cli, /services\.set\(ITelemetryService, NullTelemetryService\)/);
	});

	test('renderer telemetry registrations resolve the no-op shape without appenders or channels', () => {
		for (const relativePath of [
			'src/vs/workbench/services/telemetry/electron-browser/telemetryService.ts',
			'src/vs/workbench/services/telemetry/browser/telemetryService.ts',
		]) {
			const source = readRepoFile(relativePath);
			assert.doesNotMatch(source, /OneDataSystemAppender|TelemetryAppenderClient|TelemetryLogAppender|BaseTelemetryService|telemetryAppender|@microsoft\/1ds/);
			assert.match(source, /registerSingleton\(ITelemetryService, new SyncDescriptor\(NullTelemetryServiceShape/);
		}

		const contribution = readRepoFile('src/vs/workbench/contrib/telemetry/browser/telemetry.contribution.ts');
		assert.doesNotMatch(contribution, /ErrorTelemetry|showTelemetry|TelemetryLogGroup|telemetryLogId/);
	});

	test('extension telemetry facade never reports and no 1DS reporting dependency remains in core', () => {
		const extHost = readRepoFile('src/vs/workbench/api/common/extHostTelemetry.ts');
		assert.doesNotMatch(extHost, /@microsoft\/1ds|cleanData|TelemetryLogGroup|\.sendEventData\(|\.sendErrorData\(|\.flush\(/);

		const mainThread = readRepoFile('src/vs/workbench/api/browser/mainThreadTelemetry.ts');
		assert.doesNotMatch(mainThread, /isValidAssignmentContext|setExperimentProperty|supportsTelemetry/);

		assert.strictEqual((readRepoFile('package.json').match(/@microsoft\/1ds/g) ?? []).length, 0);
	});

	test('bundled Git extension no longer ships a direct telemetry reporter', () => {
		const manifest = JSON.parse(readRepoFile('extensions/git/package.json')) as { aiKey?: string; dependencies?: Record<string, string> };
		assert.strictEqual(manifest.aiKey, undefined);
		assert.strictEqual(manifest.dependencies?.['@vscode/extension-telemetry'], undefined);

		for (const source of ['main.ts', 'model.ts', 'repository.ts', 'commands.ts', 'cloneManager.ts']) {
			assert.doesNotMatch(readRepoFile(`extensions/git/src/${source}`), /TelemetryReporter|sendTelemetryEvent|extension-telemetry/);
		}
	});

	test('retained language, markdown, merge and preview extensions ship no direct telemetry reporter', () => {
		for (const extension of [
			'typescript-language-features',
			'html-language-features',
			'json-language-features',
			'markdown-language-features',
			'merge-conflict',
			'media-preview',
			'simple-browser',
		]) {
			const manifest = JSON.parse(readRepoFile(`extensions/${extension}/package.json`)) as { aiKey?: string; dependencies?: Record<string, string> };
			assert.strictEqual(manifest.aiKey, undefined, `${extension} must not declare an aiKey`);
			assert.strictEqual(manifest.dependencies?.['@vscode/extension-telemetry'], undefined, `${extension} must not depend on the reporter`);
			assert.doesNotMatch(readRepoFile(`extensions/${extension}/package-lock.json`), /@vscode\/extension-telemetry/, `${extension} lock must not contain the reporter`);
		}
	});

	test('welcome surface no longer renders a telemetry consent notice', () => {
		for (const relativePath of [
			'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts',
			'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedInput.ts',
			'src/vs/workbench/contrib/welcomeGettingStarted/browser/startupPage.ts',
			'src/vs/base/common/product.ts',
		]) {
			assert.doesNotMatch(readRepoFile(relativePath), /showTelemetryNotice|showTelemetryOptOut|telemetryOptOutShown|buildTelemetryFooter/, relativePath);
		}
	});
});
