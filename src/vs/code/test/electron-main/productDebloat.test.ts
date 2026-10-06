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
			['src/vs/editor/contrib/inlineCompletions/browser/telemetry.ts', /publicLog|sendInlineCompletionsEndOfLifeTelemetry|dataChannel\.publicLog2|InlineCompletionsEndOfLifeClassification/],
			['src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsSource.ts', /publicLog|DataChannelForwardingTelemetryService|sendInlineCompletionsEndOfLifeTelemetry|emptyResponseInformation|RequestResponseData/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}

		// The workbench side of the same `inlineCompletion.endOfLife` event (extension-backed providers).
		assert.doesNotMatch(
			readRepoFile('src/vs/workbench/api/browser/mainThreadLanguageFeatures.ts'),
			/sendInlineCompletionsEndOfLifeTelemetry|endOfLifeSummary|DataChannelForwardingTelemetryService|isCopilotLikeExtension|extractEngineFromCorrelationId/
		);
	});

	test('editor and view container bases no longer thread a telemetry service', () => {
		// T3.001: the composite/editor-pane/view-pane-container constructor threading was the last
		// reason these panes resolved ITelemetryService without emitting anything themselves.
		for (const relativePath of [
			'src/vs/workbench/browser/composite.ts',
			'src/vs/workbench/browser/panecomposite.ts',
			'src/vs/workbench/browser/parts/editor/editorPane.ts',
			'src/vs/workbench/browser/parts/views/viewPaneContainer.ts',
			'src/vs/workbench/browser/parts/views/viewsViewlet.ts',
			'src/vs/workbench/browser/parts/editor/editorPlaceholder.ts',
			'src/vs/workbench/browser/parts/editor/editorWithViewState.ts',
			'src/vs/workbench/browser/parts/editor/textEditor.ts',
			'src/vs/workbench/browser/parts/editor/textResourceEditor.ts',
			'src/vs/workbench/browser/parts/editor/sideBySideEditor.ts',
			'src/vs/workbench/browser/parts/editor/binaryEditor.ts',
			'src/vs/workbench/browser/parts/editor/binaryDiffEditor.ts',
			'src/vs/workbench/contrib/debug/browser/debugViewlet.ts',
			'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts',
			'src/vs/workbench/contrib/files/browser/explorerViewlet.ts',
			'src/vs/workbench/contrib/multiDiffEditor/browser/multiDiffEditor.ts',
			'src/vs/workbench/contrib/scm/browser/scmViewPaneContainer.ts',
			'src/vs/workbench/contrib/testing/browser/testingViewPaneContainer.ts',
			'src/vs/workbench/services/views/browser/viewsService.ts',
		]) {
			assert.doesNotMatch(readRepoFile(relativePath), /ITelemetryService|telemetryService/, relativePath);
		}

		// Producers inside the hierarchy keep their own injection; none of them may receive it from a base class.
		for (const relativePath of [
			'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts',
			'src/vs/workbench/contrib/extensions/browser/extensionEditor.ts',
			'src/vs/workbench/contrib/notebook/browser/notebookEditor.ts',
			'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts',
			'src/vs/workbench/contrib/surveys/browser/surveyEditorPane.ts',
		]) {
			const source = readRepoFile(relativePath);
			assert.doesNotMatch(source, /super\([^)]*telemetryService/s, relativePath);
			assert.match(source, /@ITelemetryService private readonly telemetryService: ITelemetryService,/, relativePath);
		}
	});

	test('platform action surfaces no longer report workbench action executions', () => {
		// T3.001: `workbenchActionExecuted` had producers in the shared action/action-widget surfaces;
		// the `telemetrySource` option and the workbench telemetry-name plumbing are gone with them.
		for (const relativePath of [
			'src/vs/platform/actions/browser/actionbar.ts',
			'src/vs/platform/actions/browser/toolbar.ts',
			'src/vs/platform/actions/browser/buttonbar.ts',
			'src/vs/platform/actions/browser/actionWidgetDropdownActionViewItem.ts',
			'src/vs/platform/actionWidget/browser/actionWidgetDropdown.ts',
		]) {
			assert.doesNotMatch(readRepoFile(relativePath), /telemetry|Telemetry/, relativePath);
		}

		for (const relativePath of [
			'src/vs/workbench/browser/parts/compositePart.ts',
			'src/vs/workbench/browser/parts/paneCompositePart.ts',
		]) {
			assert.doesNotMatch(readRepoFile(relativePath), /nameForTelemetry|telemetrySource|ITelemetryService|publicLog/, relativePath);
		}
	});

	test('keybinding, quick-input and menubar surfaces carry no telemetry emission', () => {
		// T3.001: the last `workbenchActionExecuted` producers outside the workbench shell.
		const prunedSites: [string, RegExp][] = [
			['src/vs/platform/keybinding/common/abstractKeybindingService.ts', /telemetry|Telemetry|HIGH_FREQ_COMMANDS/],
			['src/vs/platform/quickinput/browser/commandsQuickAccess.ts', /telemetry|Telemetry|WorkbenchActionExecuted/],
			['src/vs/platform/menubar/electron-main/menubar.ts', /telemetry|Telemetry/],
			['src/vs/editor/contrib/quickAccess/browser/commandsQuickAccess.ts', /ITelemetryService|telemetryService/],
			['src/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.ts', /ITelemetryService|telemetryService/],
			['src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts', /ITelemetryService|telemetryService/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}

		// The standalone editor keeps its no-op service shape and wires it without any producer.
		const standaloneServices = readRepoFile('src/vs/editor/standalone/browser/standaloneServices.ts');
		assert.match(standaloneServices, /super\(contextKeyService, commandService, notificationService, logService\)/);
		assert.match(standaloneServices, /class StandaloneTelemetryService implements ITelemetryService/);
	});

	test('inert telemetry plumbing is gone from the shared UI and editor widget layers', () => {
		// T2.001/T3.001: `skipTelemetry` lost its only reader with the context-view cleanup and the
		// editor `telemetryData` option had no producer left; both were carried through the layers as dead
		// parameters. The retained `ICodeEditor`/widget surface must not re-introduce them.
		for (const relativePath of [
			'src/vs/base/browser/contextmenu.ts',
			'src/vs/base/browser/ui/dropdown/dropdown.ts',
			'src/vs/base/browser/ui/dropdown/dropdownActionViewItem.ts',
			'src/vs/base/browser/ui/toolbar/toolbar.ts',
			'src/vs/platform/actions/browser/dropdownWithPrimaryActionViewItem.ts',
			'src/vs/editor/browser/editorBrowser.ts',
			'src/vs/editor/browser/widget/codeEditor/codeEditorWidget.ts',
		]) {
			assert.doesNotMatch(readRepoFile(relativePath), /telemetry|Telemetry/, relativePath);
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
