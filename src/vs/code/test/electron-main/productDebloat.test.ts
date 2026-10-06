/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Extensions, IConfigurationRegistry } from '../../../platform/configuration/common/configurationRegistry.js';
import { ServiceCollection } from '../../../platform/instantiation/common/serviceCollection.js';
import { Registry } from '../../../platform/registry/common/platform.js';
import { ITelemetryService, TelemetryLevel } from '../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../platform/telemetry/common/telemetryUtils.js';
import '../../../platform/telemetry/common/telemetryService.js';
import { registerMainTelemetryService } from '../../electron-main/telemetryServiceRegistration.js';

function readRepoFile(relativePath: string): string {
	return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function repoFileExists(relativePath: string): boolean {
	return existsSync(join(process.cwd(), relativePath));
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

		const contribution = 'src/vs/workbench/contrib/telemetry/browser/telemetry.contribution.ts';
		assert.strictEqual(repoFileExists(contribution), false, `${contribution} was deleted with the reporting infrastructure`);
	});

	test('workbench telemetry call-site contributions are removed from the shell', () => {
		const commonMain = readRepoFile('src/vs/workbench/workbench.common.main.ts');
		assert.doesNotMatch(commonMain, /contrib\/telemetry\/browser\/telemetry\.contribution/);
		assert.doesNotMatch(commonMain, /services\/policies\/browser\/policyTelemetry\.contribution/);

		// Representative call-site modules: no event, payload, classification or telemetry
		// service residue may survive in them (spec criterion 3/4). The two shell-wide
		// call-site modules were removed with the reporting infrastructure, so a reappearing
		// file is itself the regression.
		const removedCallSites = [
			'src/vs/workbench/contrib/telemetry/browser/telemetry.contribution.ts',
			'src/vs/workbench/services/policies/browser/policyTelemetry.contribution.ts',
		];
		for (const relativePath of removedCallSites) {
			assert.strictEqual(repoFileExists(relativePath), false, `${relativePath} must stay deleted`);
		}
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

	test('retained feedback setting stays registered while telemetry enablement settings stay gone', () => {
		const properties = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties();
		const feedback = properties['telemetry.feedback.enabled'];

		// Reading an unregistered setting returns `undefined`, which the issue reporter, the NPS
		// survey and the relauncher all treat as "feedback disabled". Losing this registration is a
		// silent behavior regression, not a telemetry change.
		assert.deepStrictEqual({
			registered: !!feedback,
			type: feedback?.type,
			defaultValue: feedback?.default,
			policyName: feedback?.policy?.name,
		}, {
			registered: true,
			type: 'boolean',
			defaultValue: true,
			policyName: 'EnableFeedback',
		});

		for (const gone of ['telemetry.telemetryLevel', 'telemetry.enableTelemetry', 'telemetry.enableCrashReporter']) {
			assert.strictEqual(properties[gone], undefined, `${gone} must not be registered`);
		}

		// The registration module is a side-effect import: it only works while the workbench shell
		// actually imports it.
		assert.match(readRepoFile('src/vs/workbench/workbench.common.main.ts'), /import '\.\.\/platform\/telemetry\/common\/telemetryService\.js';/);
	});

	test('workbench shell, editor and views call-sites carry no telemetry emission', () => {
		// Representative owners of the T3 pruning: any of these events, payload builders or
		// injections reappearing means the workbench started reporting again.
		const prunedSites: [string, RegExp][] = [
			['src/vs/workbench/browser/layout.ts', /publicLog|startupLayout|ITelemetryService/],
			['src/vs/workbench/browser/actions/helpActions.ts', /machineId|ITelemetryService/],
			['src/vs/workbench/browser/parts/editor/editorCommands.ts', /publicLog|workbenchEditorReopen|ITelemetryService/],
			['src/vs/workbench/browser/parts/editor/editorGroupView.ts', /publicLog|editorOpened|ITelemetryService|getTelemetryDescriptor|TelemetryTrustedValue/],
			['src/vs/workbench/browser/parts/editor/editorStatus.ts', /publicLog|AutomaticLanguageDetectionLikelyWrong|setUntitledDocumentLanguage|ITelemetryService/],
			['src/vs/workbench/browser/parts/editor/textDiffEditor.ts', /publicLog|editorVisibleTime|logInputLifecycleTelemetry/],
			['src/vs/workbench/browser/parts/notifications/notificationsCommands.ts', /publicLog|workbenchActionExecuted|ITelemetryService/],
			['src/vs/workbench/browser/parts/statusbar/statusbarItem.ts', /publicLog|workbenchActionExecuted|ITelemetryService/],
			['src/vs/workbench/browser/parts/titlebar/menubarControl.ts', /publicLog|workbenchActionExecuted|ITelemetryService/],
			['src/vs/workbench/browser/parts/views/treeView.ts', /publicLog|Extension:ViewActivate|ITelemetryService|TelemetryTrustedValue/],
			['src/vs/workbench/common/editor/editorInput.ts', /getTelemetryDescriptor|__GDPR__/],
			['src/vs/workbench/common/editor/sideBySideEditorInput.ts', /getTelemetryDescriptor/],
			['src/vs/workbench/electron-browser/window.ts', /publicLog|workbenchActionExecuted|ITelemetryService/],
			['src/vs/workbench/services/auxiliaryWindow/browser/auxiliaryWindowService.ts', /publicLog|auxiliaryWindowOpen|ITelemetryService/],
			['src/vs/workbench/services/auxiliaryWindow/electron-browser/auxiliaryWindowService.ts', /ITelemetryService/],
			['src/vs/workbench/services/contextmenu/electron-browser/contextmenuService.ts', /publicLog|workbenchActionExecuted|ITelemetryService|skipTelemetry/],
			['src/vs/platform/contextview/browser/contextMenuHandler.ts', /publicLog|workbenchActionExecuted|ITelemetryService/],
			['src/vs/platform/contextview/browser/contextMenuService.ts', /ITelemetryService/],
			['src/vs/workbench/services/themes/browser/workbenchThemeService.ts', /publicLog|activateThemeExtension|ITelemetryService|themeExtensionsActivated/],
			['src/vs/workbench/services/timer/browser/timerService.ts', /publicLog|startupTimeVaried|startup\.timer\.mark|ITelemetryService|TelemetryTrustedValue|__GDPR__/],
			['src/vs/workbench/services/timer/electron-browser/timerService.ts', /ITelemetryService|_shouldReportPerfMarks/],
			['src/vs/workbench/services/views/browser/viewDescriptorService.ts', /publicLog|viewDescriptorService\.moveViews|ITelemetryService/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}
	});

	test('editor call-sites carry no telemetry emission', () => {
		// T2 representatives: editor actions, inline completions, suggest, diff and tree-sitter
		// must not report. Only the standalone-editor no-op shape may still name the service.
		const prunedSites: [string, RegExp][] = [
			['src/vs/editor/browser/editorExtensions.ts', /publicLog|editorActionInvoked|ITelemetryService/],
			['src/vs/editor/browser/services/inlineCompletionsService.ts', /publicLog|'inlineCompletions\.snooze'|ITelemetryService/],
			['src/vs/editor/browser/widget/diffEditor/diffProviderFactoryService.ts', /publicLog|diffEditor\.computeDiff|ITelemetryService/],
			['src/vs/editor/common/model/tokens/treeSitter/treeSitterTree.ts', /publicLog|treeSitter\.|ITelemetryService/],
			['src/vs/editor/contrib/codeAction/browser/codeAction.ts', /publicLog|codeAction\.applyCodeAction|ITelemetryService/],
			['src/vs/editor/contrib/suggest/browser/suggestController.ts', /publicLog|suggest\.acceptedSuggestion|ITelemetryService/],
			['src/vs/editor/contrib/suggest/browser/suggestModel.ts', /publicLog|suggest\.durations|ITelemetryService/],
			['src/vs/editor/contrib/inlineCompletions/browser/hintsWidget/hoverParticipant.ts', /publicLog|inlineCompletionHover|ITelemetryService/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
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
