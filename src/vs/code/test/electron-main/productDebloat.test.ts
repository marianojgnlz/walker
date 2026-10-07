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
			['src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsSource.ts', /publicLog|DataChannelForwardingTelemetryService|sendInlineCompletionsEndOfLifeTelemetry|emptyResponseInformation|RequestResponseData/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}

		// The emptied module was deleted by the parent (W42); a reappearing file is itself the regression.
		assert.strictEqual(repoFileExists('src/vs/editor/contrib/inlineCompletions/browser/telemetry.ts'), false);

		// The workbench side of the same `inlineCompletion.endOfLife` event (extension-backed providers).
		assert.doesNotMatch(
			readRepoFile('src/vs/workbench/api/browser/mainThreadLanguageFeatures.ts'),
			/sendInlineCompletionsEndOfLifeTelemetry|endOfLifeSummary|DataChannelForwardingTelemetryService|isCopilotLikeExtension|extractEngineFromCorrelationId/
		);
	});

	test('the stripped edit telemetry subsystem carries no shell wiring', () => {
		// T6 closure: the `contrib/editTelemetry` tree, its platform event shape and the
		// data-channel forwarding service exist only for the AI edit-telemetry pipeline. The
		// shell and the extension-backed inline-completion provider must stay disconnected;
		// the whole-file deletion is queued as W44.
		assert.doesNotMatch(readRepoFile('src/vs/workbench/workbench.common.main.ts'), /editTelemetry/);

		const languageFeatures = readRepoFile('src/vs/workbench/api/browser/mainThreadLanguageFeatures.ts');
		assert.doesNotMatch(languageFeatures, /AiEditTelemetry|aiEditTelemetry|createSuggestionId|handleCodeAccepted|handleCodeRejected/);

		// The suggestion id existed only so the AI edit service could correlate accepted
		// inline completions; nothing else in the API layer reads it.
		assert.doesNotMatch(readRepoFile('src/vs/workbench/api/common/extHost.protocol.ts'), /EditSuggestionId|suggestionId/);
		assert.doesNotMatch(readRepoFile('src/vs/workbench/api/common/extHostLanguageFeatures.ts'), /suggestionId/);

		// W44 whole-file deletion candidates: while they exist, no retained shell module may
		// import them, because the stripped tree was their only consumer family.
		for (const relativePath of [
			'src/vs/platform/telemetry/common/editTelemetry.ts',
			'src/vs/platform/telemetry/common/editArcTelemetry.ts',
			'src/vs/platform/dataChannel/browser/forwardingTelemetryService.ts',
		]) {
			if (!repoFileExists(relativePath)) {
				continue;
			}
			const importName = relativePath.split('/').pop()!.replace('.ts', '');
			for (const consumer of [
				'src/vs/workbench/workbench.common.main.ts',
				'src/vs/workbench/workbench.desktop.main.ts',
				'src/vs/workbench/api/browser/mainThreadLanguageFeatures.ts',
				'src/vs/workbench/api/common/extHost.protocol.ts',
			]) {
				assert.doesNotMatch(readRepoFile(consumer), new RegExp(importName), `${consumer} must not import ${relativePath}`);
			}
		}
	});

	test('gallery acquisition carries no query, download or usage-statistics reporting', () => {
		// T7 owners: the gallery query/download events with their `StopWatch` durations, the
		// telemetry-trusted correlation headers and the `reportStatistic` usage-statistics POST are
		// the reporting half of extension acquisition. Anonymous query, metadata reads,
		// install/update, dependency resolution and VSIX downloads stay functional.
		const gallery = readRepoFile('src/vs/platform/extensionManagement/common/extensionGalleryService.ts');
		assert.doesNotMatch(gallery, /publicLog|StopWatch|TelemetryTrustedValue|ITelemetryService|telemetryService|__GDPR__|setTelemetry|getGalleryExtensionTelemetryData|reportStatistic/);

		for (const relativePath of [
			'src/vs/platform/extensionManagement/common/extensionManagement.ts',
			'src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts',
		]) {
			assert.doesNotMatch(readRepoFile(relativePath), /reportStatistic|StatisticType/, relativePath);
		}

		for (const relativePath of [
			'src/vs/platform/extensionManagement/common/extensionGalleryManifest.ts',
			'src/vs/platform/extensionManagement/common/extensionGalleryManifestService.ts',
		]) {
			assert.doesNotMatch(readRepoFile(relativePath), /ExtensionStatisticsUri/, relativePath);
		}

		assert.doesNotMatch(readRepoFile('src/vs/workbench/services/extensionManagement/common/extensionGalleryService.ts'), /ITelemetryService|telemetryService/);

		// Workbench-side payloads: the extension editor, install/runtime actions, recommendation
		// surfaces and the extensions workbench service no longer build telemetry payloads or read
		// the removed `telemetryData` carrier.
		const prunedPayloads: [string, RegExp][] = [
			['src/vs/workbench/contrib/extensions/browser/extensionEditor.ts', /ITelemetryService|telemetryService|publicLog|__GDPR__/],
			['src/vs/workbench/contrib/extensions/browser/extensionsActions.ts', /ITelemetryService|telemetryService|publicLog|__GDPR__/],
			['src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts', /ITelemetryService|telemetryService|publicLog|__GDPR__|TelemetryTrustedValue/],
			['src/vs/workbench/contrib/extensions/browser/extensionRecommendationsService.ts', /ITelemetryService|telemetryService|publicLog|__GDPR__/],
			['src/vs/workbench/contrib/extensions/browser/extensionRecommendationNotificationService.ts', /ITelemetryService|telemetryService|publicLog/],
			['src/vs/workbench/contrib/extensions/browser/extensionsViews.ts', /ITelemetryService|telemetryService|publicLog|reportSearchFinished/],
			['src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts', /ITelemetryService|telemetryService|publicLog|__GDPR__|reportTelemetry/],
			['src/vs/platform/extensionManagement/common/extensionManagementUtil.ts', /Telemetry|telemetry/],
			['src/vs/platform/extensionManagement/common/extensionManagement.ts', /telemetryData/],
			['src/vs/workbench/contrib/extensions/common/extensions.ts', /telemetryData/],
		];
		for (const [relativePath, removal] of prunedPayloads) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}
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
			// Former self-injecting producers, pruned in the T12 pass.
			'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts',
			'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts',
			'src/vs/workbench/contrib/surveys/browser/surveyEditorPane.ts',
		]) {
			assert.doesNotMatch(readRepoFile(relativePath), /ITelemetryService|telemetryService/, relativePath);
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

	test('files, search and workspace call-sites carry no telemetry emission', () => {
		// T4 owners: any of these events, payload builders or injections reappearing means the
		// file/search/workspace surfaces started reporting again. `_reason` is a telemetry-only
		// query annotation whose only consumers were the `searchComplete` payloads.
		const prunedSites: [string, RegExp][] = [
			['src/vs/workbench/contrib/search/browser/searchTreeModel/searchModel.ts', /publicLog|ITelemetryService|searchResultsFirstRender|searchResultsFinished|searchResultsShown/],
			['src/vs/workbench/contrib/search/browser/searchView.ts', /publicLog|ITelemetryService|searchKeywordClick/],
			['src/vs/workbench/contrib/searchEditor/browser/searchEditorActions.ts', /publicLog|ITelemetryService|searchEditor\//],
			['src/vs/workbench/contrib/searchEditor/browser/searchEditorInput.ts', /publicLog|ITelemetryService|searchEditor\//],
			['src/vs/workbench/services/search/common/searchService.ts', /publicLog|ITelemetryService|sendTelemetry|cachedSearchComplete|textSearchComplete|_reason|randomChance/],
			['src/vs/workbench/services/search/common/search.ts', /ITelemetryData|ITelemetryEvent|__GDPR__|_reason/],
			['src/vs/workbench/services/search/browser/searchService.ts', /ITelemetryService/],
			['src/vs/workbench/services/search/common/queryBuilder.ts', /_reason/],
			['src/vs/workbench/api/browser/mainThreadWorkspace.ts', /_reason/],
			['src/vs/workbench/api/common/extHostWorkspace.ts', /_reason/],
			['src/vs/workbench/api/common/extHostNotebook.ts', /_reason/],
			['src/vs/workbench/contrib/search/browser/anythingQuickAccess.ts', /_reason/],
			['src/vs/workbench/contrib/search/browser/quickTextSearch/textSearchQuickAccess.ts', /_reason/],
			['src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts', /_reason/],
			['src/vs/workbench/services/extensions/common/workspaceContains.ts', /_reason/],
			['src/vs/workbench/contrib/files/browser/views/explorerView.ts', /publicLog|ITelemetryService|workbenchActionExecuted/],
			['src/vs/workbench/contrib/files/browser/views/openEditorsView.ts', /publicLog|ITelemetryService|workbenchActionExecuted/],
			['src/vs/workbench/contrib/files/browser/workspaceWatcher.ts', /publicLog|ITelemetryService|fileWatcherError/],
			['src/vs/workbench/contrib/workspace/browser/workspace.contribution.ts', /publicLog|ITelemetryService|WorkspaceTrustTelemetry|workspaceTrustDisabled|workspaceTrustFolderCounts|workspaceTrustStateChanged|workspaceFolderDepthBelowTrustedFolder/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}
	});

	test('terminal, debug, task, test and notebook call-sites carry no telemetry emission', () => {
		// T5/T6 owners: any of these events, payload builders or injections reappearing means the
		// terminal/debug/task/test/notebook surfaces started reporting again.
		const prunedSites: [string, RegExp][] = [
			['src/vs/workbench/contrib/terminalContrib/suggest/browser/terminalSuggestAddon.ts', /publicLog|ITelemetryService|_suggestTelemetry|_completionRequestTimestamp/],
			['src/vs/workbench/contrib/terminal/browser/terminalInstance.ts', /publicLog|ITelemetryService|shellIntegrationFailureProcessExit/],
			['src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts', /publicLog|ITelemetryService|FailedShellIntegrationActivation/],
			['src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts', /publicLog|ITelemetryService|disableShellIntegrationReporting|imageAddonActivated|imageAdded/],
			['src/vs/platform/terminal/common/xterm/shellIntegrationAddon.ts', /publicLog|ITelemetryService|_hasUpdatedTelemetry|disableTelemetry/],
			['src/vs/workbench/contrib/terminalContrib/links/browser/terminalLinkManager.ts', /publicLog|ITelemetryService|terminal\/openLink/],
			['src/vs/workbench/contrib/terminalContrib/quickFix/browser/quickFixAddon.ts', /publicLog|ITelemetryService|terminal\/quick-fix/],
			['src/vs/workbench/contrib/terminalContrib/typeAhead/browser/terminalTypeAheadAddon.ts', /publicLog|ITelemetryService|terminalLatencyStats/],
			['src/vs/workbench/contrib/debug/browser/debugSession.ts', /publicLog|ITelemetryService|CustomEndpointTelemetryService|category === 'telemetry'/],
			['src/vs/workbench/contrib/debug/browser/debugToolBar.ts', /publicLog|ITelemetryService|workbenchActionExecuted/],
			['src/vs/workbench/contrib/debug/browser/variablesView.ts', /publicLog|ITelemetryService|didViewMemory/],
			['src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts', /ITelemetryService|_telemetryService/],
			['src/vs/workbench/contrib/tasks/electron-browser/taskService.ts', /ITelemetryService|telemetryService/],
			['src/vs/workbench/contrib/testing/browser/testResultsView/testResultsTree.ts', /publicLog|ITelemetryService|testing\.expandOlderResults/],
			['src/vs/workbench/contrib/testing/common/testResultService.ts', /publicLog|ITelemetryService|telemetryService/],
			['src/vs/workbench/contrib/testing/common/testResult.ts', /publicLog|ITelemetryService|test\.outcomes/],
			['src/vs/workbench/contrib/notebook/browser/controller/coreActions.ts', /publicLog|ITelemetryService|sendEntryTelemetry/],
			['src/vs/workbench/contrib/notebook/browser/notebookEditor.ts', /publicLog|ITelemetryService|editorOpenPerf|WorkbenchNotebookOpen/],
			['src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts', /publicLog|ITelemetryService|editorOpened/],
			['src/vs/workbench/contrib/notebook/browser/view/cellParts/cellStatusPart.ts', /publicLog|ITelemetryService|workbenchActionExecuted/],
			['src/vs/workbench/contrib/notebook/browser/view/renderers/backLayerWebView.ts', /publicLog|ITelemetryService|NotebookCellOutputRender|workbenchActionExecuted/],
			['src/vs/workbench/contrib/notebook/common/notebookEditorModel.ts', /publicLog|ITelemetryService|notebook\/SaveError|getSaveErrorMessage/],
			['src/vs/workbench/contrib/notebook/common/notebookEditorModelResolverServiceImpl.ts', /ITelemetryService|_telemetryService/],
			['src/vs/workbench/api/browser/mainThreadSearch.ts', /publicLog|ITelemetryService|handleTelemetry/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}

		// The emptied telemetry-only modules are W43 deletion candidates: the parent may have
		// deleted them, or they must still be content-free. A reappearing class/event is the
		// regression, not the parent's deletion.
		for (const relativePath of [
			'src/vs/workbench/contrib/terminalContrib/telemetry/browser/terminalTelemetry.ts',
			'src/vs/workbench/contrib/terminalContrib/telemetry/browser/terminalProfileConfigurationTelemetry.ts',
			'src/vs/workbench/contrib/terminalContrib/telemetry/browser/terminal.telemetry.contribution.ts',
			'src/vs/workbench/contrib/terminalContrib/suggest/browser/terminalSuggestTelemetry.ts',
			'src/vs/workbench/contrib/debug/common/debugTelemetry.ts',
		]) {
			if (repoFileExists(relativePath)) {
				assert.doesNotMatch(readRepoFile(relativePath), /publicLog|ITelemetryService|export (class|function|const)|TelemetryContribution/, relativePath);
			}
		}
	});

	test('remote connection health, latency and reconnection carry no telemetry emission', () => {
		// T8 owners: the initial-connection, latency and reconnection events are gone. The
		// latency *measurement* stays because the remote indicator tooltip and the diagnostic
		// info surface read it.
		const prunedSites: [string, RegExp][] = [
			['src/vs/workbench/contrib/remote/browser/remoteConnectionHealth.ts', /publicLog|ITelemetryService|remoteConnectionSuccess|remoteConnectionFailure|remoteConnectionLatency/],
			['src/vs/workbench/contrib/remote/browser/remoteIndicator.ts', /publicLog|ITelemetryService|remoteConnectionHealth|workbenchActionExecuted/],
			['src/vs/workbench/contrib/remote/browser/remote.ts', /publicLog|ITelemetryService|remoteReconnectionReload|remoteConnectionLost|remoteReconnectionRunning|remoteReconnectionPermanentFailure|remoteConnectionGain/],
			['src/vs/workbench/contrib/remote/browser/remoteStartEntry.ts', /publicLog|ITelemetryService|workbenchActionExecuted/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}

		// Retained: the latency measurer still feeds the indicator tooltip and diagnostic info.
		assert.match(readRepoFile('src/vs/workbench/contrib/remote/browser/remoteIndicator.ts'), /remoteConnectionLatencyMeasurer/);
		assert.match(readRepoFile('src/vs/workbench/contrib/remote/electron-browser/remote.contribution.ts'), /remoteConnectionLatencyMeasurer/);
	});

	test('extension-host init and extension-management trust carry no telemetry payload', () => {
		// T8 owners: the extension-host init data no longer carries a logging-only telemetry flag,
		// and the publisher-trust/workspace-extension management events are gone.
		assert.doesNotMatch(readRepoFile('src/vs/workbench/services/extensions/common/extensionHostProtocol.ts'), /isExtensionTelemetryLoggingOnly/);

		for (const relativePath of [
			'src/vs/workbench/services/extensions/browser/webWorkerExtensionHost.ts',
			'src/vs/workbench/services/extensions/common/remoteExtensionHost.ts',
			'src/vs/workbench/services/extensions/electron-browser/localProcessExtensionHost.ts',
		]) {
			assert.doesNotMatch(readRepoFile(relativePath), /isExtensionTelemetryLoggingOnly|isLoggingOnly/, relativePath);
		}

		assert.doesNotMatch(
			readRepoFile('src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts'),
			/publicLog|ITelemetryService|telemetryService|extensions:trustPublisher|workspaceextension:/
		);
	});

	test('node extension management and the tree/webview view relays carry no telemetry emission', () => {
		// T7 owners: the downloader retry, extraction-metadata, signature-verification,
		// executable-recommendation and auto-profiler payloads are gone, and the tree-view
		// resolve-failure relay is removed from the API protocol with them because its only
		// caller reported the failure. Downloads, extraction, signature enforcement,
		// recommendations, profiling and the ordinary error logs stay.
		const prunedSites: [string, RegExp][] = [
			['src/vs/platform/extensionManagement/node/extensionDownloader.ts', /publicLog|ITelemetryService|RetryDownload|downloadvsix:retry|downloadsigzip:retry/],
			['src/vs/platform/extensionManagement/node/extensionManagementService.ts', /publicLog|ITelemetryService|UpdateMetadataError|extension:extract/],
			['src/vs/platform/extensionManagement/node/extensionSignatureVerificationService.ts', /publicLog|ITelemetryService|extensionsignature:verification/],
			['src/vs/platform/extensionManagement/common/extensionTipsService.ts', /publicLog|ITelemetryService|exeExtensionRecommendations/],
			['src/vs/platform/extensionManagement/node/extensionTipsService.ts', /ITelemetryService|telemetryService/],
			['src/vs/workbench/contrib/extensions/electron-browser/extensionsAutoProfiler.ts', /publicLog|ITelemetryService|exthostunresponsive/],
			['src/vs/workbench/api/browser/mainThreadTreeViews.ts', /publicLog|ITelemetryService|treeView\.resolveFailure|logResolveTreeNodeFailure/],
			['src/vs/workbench/api/browser/mainThreadWebviewViews.ts', /publicLog|ITelemetryService|webviews:createWebviewView/],
			['src/vs/workbench/api/common/extHostTreeViews.ts', /logResolveTreeNodeFailure/],
			['src/vs/workbench/api/common/extHost.protocol.ts', /logResolveTreeNodeFailure/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}

		// Retained: the tree-view resolve failure still logs its ordinary error and throws.
		assert.match(readRepoFile('src/vs/workbench/api/common/extHostTreeViews.ts'), /Failed to resolve tree node for element/);
		// Retained: the node extension tips service still wraps the shared abstract implementation.
		assert.match(readRepoFile('src/vs/platform/extensionManagement/node/extensionTipsService.ts'), /super\(environmentService\.userHome, nativeHostService,/);
	});

	test('extension-host startup, crash and RPC-size reporting is gone', () => {
		// T8 owners: the startup/success/failure, crash, crash-extension, activation-error and
		// extensions-message payloads plus the sampled RPC-size logger are removed with the
		// reporting-only internal-API callback that carried the activation error. Extension host
		// startup, crash recovery/bisect, the ordinary console RPC logger and the retained
		// telemetry-info init block for the `env.machineId` facade stay.
		const prunedSites: [string, RegExp][] = [
			['src/vs/workbench/services/extensions/common/extensionHostManager.ts', /publicLog|ITelemetryService|extensionHostStartup|TelemetryRPCLogger|RPCTelemetryData/],
			['src/vs/workbench/services/extensions/common/abstractExtensionService.ts', /publicLog|ITelemetryService|extensionsMessage|extensionActivationError|_onDidActivateExtensionError/],
			['src/vs/workbench/services/extensions/electron-browser/nativeExtensionService.ts', /publicLog|ITelemetryService|_sendExtensionHostCrashTelemetry/],
			['src/vs/workbench/services/extensions/browser/extensionService.ts', /ITelemetryService|telemetryService/],
			['src/vs/workbench/services/extensions/common/extensions.ts', /_onDidActivateExtensionError/],
			['src/vs/workbench/api/browser/mainThreadExtensionService.ts', /_onDidActivateExtensionError/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}

		// Retained: the crash tracker still restarts the host, the ordinary crash log stays and
		// the manual RPC logger is still available for `--logExtensionHostCommunication`.
		const native = readRepoFile('src/vs/workbench/services/extensions/electron-browser/nativeExtensionService.ts');
		assert.match(native, /_logExtensionHostCrash\(extensionHost\)/);
		assert.match(native, /_localCrashTracker\.registerCrash\(\)/);
		assert.match(readRepoFile('src/vs/workbench/services/extensions/common/extensionHostManager.ts'), /class RPCLogger implements IRPCProtocolLogger/);

		// Retained: the extension-host init data still feeds the `env` identity facade.
		assert.match(readRepoFile('src/vs/workbench/services/extensions/common/remoteExtensionHost.ts'), /telemetryInfo/);
	});

	test('telemetry argv, policy schema and platform readers are closed', () => {
		// T1/T11 owners: the old `--telemetry-level` and `--disable-crash-reporter` switches and
		// the consumer-less platform readers left over from the reporting cutoff are removed.
		// `--disable-telemetry` stays as the documented inert invocation input and the retained
		// `Env`/protocol shapes keep their parameters.
		const argv = readRepoFile('src/vs/platform/environment/common/argv.ts');
		assert.doesNotMatch(argv, /'telemetry-level'|'disable-crash-reporter'/);
		assert.match(argv, /'disable-telemetry'\?: boolean;/);

		const cliOptions = readRepoFile('src/vs/platform/environment/node/argv.ts');
		assert.doesNotMatch(cliOptions, /'telemetry-level'|'disable-crash-reporter'/);
		assert.match(cliOptions, /'disable-telemetry': \{ type: 'boolean' \}/);

		assert.doesNotMatch(readRepoFile('src/vs/server/node/serverEnvironmentService.ts'), /telemetry-level/);

		const relaunch = readRepoFile('src/vs/platform/update/electron-main/updateRelaunchArguments.ts');
		assert.doesNotMatch(relaunch, /'disable-crash-reporter'/);
		assert.match(relaunch, /'disable-telemetry'/);

		const telemetryUtils = readRepoFile('src/vs/platform/telemetry/common/telemetryUtils.ts');
		assert.doesNotMatch(telemetryUtils, /supportsTelemetry|isLoggingOnly|isInternalTelemetry|getTelemetryLevel|TELEMETRY_SETTING_ID|cleanData|validateTelemetryData|getPiiPathsFromEnvironment|cleanRemoteAuthority|NullEndpointTelemetryService|ITelemetryAppender|NullAppender|TelemetryLogGroup|URIDescriptor/);
		// Retained: the no-op service and public trusted-value marker; the output log uses only this id.
		assert.match(telemetryUtils, /export class NullTelemetryServiceShape/);
		assert.match(telemetryUtils, /export class TelemetryTrustedValue/);
		assert.match(telemetryUtils, /export const telemetryLogId = 'telemetry'/);

		const telemetry = readRepoFile('src/vs/platform/telemetry/common/telemetry.ts');
		assert.doesNotMatch(telemetry, /TELEMETRY_SETTING_ID|TELEMETRY_OLD_SETTING_ID|TELEMETRY_CRASH_REPORTER_SETTING_ID|telemetryLevelEnabled|escapeModelIdForTelemetry|TelemetryConfiguration|ITelemetryEndpoint|ICustomEndpointTelemetryService/);
		// Retained: the `TelemetryLevel` enum backs the extension API facade and the no-op shape.
		assert.match(telemetry, /export const enum TelemetryLevel/);
		assert.doesNotMatch(readRepoFile('src/vs/workbench/contrib/debug/common/debugger.ts'), /getCustomTelemetryEndpoint|aiKey|cleanRemoteAuthority/);
		assert.doesNotMatch(readRepoFile('src/vs/workbench/contrib/debug/common/debug.ts'), /getCustomTelemetryEndpoint|aiKey|ITelemetryEndpoint/);

		const policyData = readRepoFile('build/lib/policies/policyData.jsonc');
		assert.doesNotMatch(policyData, /telemetry\.telemetryLevel/);
		assert.match(policyData, /telemetry\.feedback\.enabled/);

		const rootManifest = readRepoFile('package.json');
		assert.doesNotMatch(rootManifest, /@vscode\/telemetry-extractor|mixin-telemetry-docs/);
		assert.doesNotMatch(readRepoFile('package-lock.json'), /@vscode\/telemetry-extractor/);

		const storage = readRepoFile('src/vs/platform/storage/electron-main/storageMain.ts');
		assert.doesNotMatch(storage, /currentSessionDateStorageKey|lastSessionDateStorageKey/);
		// Retained: the first-session date drives the welcome-page personalization.
		assert.match(storage, /firstSessionDateStorageKey/);
		assert.match(readRepoFile('src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts'), /firstSessionDateStorageKey/);

		// Retained: `virtualMachineHint` still feeds the diagnostics machine info and the
		// extension-host perf view VM likelihood.
		const baseId = readRepoFile('src/vs/base/node/id.ts');
		assert.doesNotMatch(baseId, /getMachineId|getMacMachineId|getSqmMachineId|getDevDeviceId|SQMClient/);
		assert.match(baseId, /export const virtualMachineHint/);
		assert.match(readRepoFile('src/vs/platform/native/electron-main/nativeHostMainService.ts'), /getOSVirtualMachineHint/);

		// W45.a deletion candidate: `src/vs/base/node/macAddress.ts` lost its last consumer
		// with those resolvers; the base id module must not import it again.
		assert.doesNotMatch(baseId, /macAddress/);
	});

	test('CLI account auth is no longer exported', () => {
		assert.doesNotMatch(readRepoFile('cli/src/lib.rs'), /^pub mod auth;/m);
	});

	test('default Chat extension unification and editorChat command mappings are absent', () => {
		for (const relativePath of [
			'src/vs/base/common/product.ts',
			'src/vs/platform/configuration/common/configurationRegistry.ts',
			'src/vs/workbench/api/common/configurationExtensionPoint.ts',
			'src/vs/workbench/api/common/extHostApiCommands.ts',
			'src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts',
			'src/vs/workbench/contrib/extensions/browser/extensionsActions.ts',
			'src/vs/workbench/services/extensionManagement/test/browser/extensionEnablementService.test.ts',
			'src/vs/workbench/contrib/extensions/test/electron-browser/extensionsActions.test.ts',
		]) {
			assert.doesNotMatch(readRepoFile(relativePath), /defaultChatAgent|IDefaultChatAgent|EXTENSION_UNIFICATION_EXTENSION_IDS|vscode\.editorChat\.start|inlineChat\.start|EnableAIFeaturesInWorkspaceAction|ChatAIDisabledSettingId/, relativePath);
		}

		// The product-backed completions-enablement reader was removed with the Chat
		// product integration; the module is a W47 deletion candidate and must not
		// come back. Guarded deletion-tolerantly so the live assertion is the absence
		// of the old product read while the file is still on disk.
		if (repoFileExists('src/vs/editor/common/services/completionsEnablement.ts')) {
			assert.doesNotMatch(readRepoFile('src/vs/editor/common/services/completionsEnablement.ts'), /defaultChatAgent|completionsEnablementSetting|isCompletionsEnabled/);
		}
		const editorWorker = readRepoFile('src/vs/editor/browser/services/editorWorkerService.ts');
		assert.doesNotMatch(editorWorker, /isCompletionsEnabledWithTextResourceConfig|completionsEnablement/);
		assert.match(editorWorker, /wordBasedSuggestions/);
	});

	test('issue reporting retains local attachments without token or upload branches', () => {
		const issueData = readRepoFile('src/vs/workbench/contrib/issue/common/issue.ts');
		assert.doesNotMatch(issueData, /githubAccessToken|IIssueSubmissionHost/);
		const issueForm = readRepoFile('src/vs/workbench/contrib/issue/browser/issueFormService.ts');
		assert.doesNotMatch(issueForm, /githubAccessToken|githubUploadService|uploadViaMobileApi|uploadIssueDataFile|extractIssueData|setAttachmentUploadState/);
		const baseReporter = readRepoFile('src/vs/workbench/contrib/issue/browser/baseIssueReporterService.ts');
		assert.doesNotMatch(baseReporter, /githubAccessToken|submitToGitHub|Create Internally|internalGithubButton/);
		const nativeReporter = readRepoFile('src/vs/workbench/contrib/issue/electron-browser/issueReporterService.ts');
		assert.doesNotMatch(nativeReporter, /githubAccessToken|submitToGitHub|Bearer/);
		const overlay = readRepoFile('src/vs/workbench/contrib/issue/browser/issueReporterOverlay.ts');
		assert.match(overlay, /onDidRequestOpenScreenshot/);
		assert.match(overlay, /onDidRequestOpenRecording/);
		assert.match(overlay, /restoreAttachments/);
	});

	test('retained TypeScript extension carries no reporter, tracing or diagnostics-telemetry payload', () => {
		// T9 owners: the extension-local `TelemetryReporter` adapter, every `logTelemetry`/
		// `logTraceEvent` call, the tsserver payload forwarding and the
		// `enableDiagnosticsTelemetry` switch are gone. TS language behaviour, the ordinary
		// tsserver logs and the inert TAS experimentation adapter stay.
		const prunedSites: [string, RegExp][] = [
			['extensions/typescript-language-features/src/typescriptServiceClient.ts', /logTelemetry|logTraceEvent|TelemetryReporter|dispatchTelemetryEvent|typeScriptServerEnvCommonProperties|__GDPR__/],
			['extensions/typescript-language-features/src/languageProvider.ts', /TelemetryReporter/],
			['extensions/typescript-language-features/src/typescriptService.ts', /TelemetryReporter/],
			['extensions/typescript-language-features/src/typeScriptServiceClientHost.ts', /IExperimentationTelemetryReporter/],
			['extensions/typescript-language-features/src/lazyClientHost.ts', /IExperimentationTelemetryReporter/],
			['extensions/typescript-language-features/src/configuration/configuration.ts', /enableDiagnosticsTelemetry/],
			['extensions/typescript-language-features/src/tsServer/server.ts', /logTelemetry|logTraceEvent|TelemetryReporter/],
			['extensions/typescript-language-features/src/tsServer/spawner.ts', /TelemetryReporter/],
			['extensions/typescript-language-features/src/commands/tsserverRequests.ts', /logTraceEvent|TelemetryReporter/],
			['extensions/typescript-language-features/src/languageFeatures/completions.ts', /logTelemetry|TelemetryReporter|logCompletionsTelemetry/],
			['extensions/typescript-language-features/src/languageFeatures/diagnostics.ts', /logTelemetry|TelemetryReporter|DiagnosticsTelemetryManager|logDiagnosticsPerformanceTelemetry/],
			['extensions/typescript-language-features/src/languageFeatures/inlayHints.ts', /logTelemetry|TelemetryReporter|hasReportedTelemetry/],
			['extensions/typescript-language-features/src/languageFeatures/organizeImports.ts', /logTelemetry|TelemetryReporter|DidOrganizeImportsCommand/],
			['extensions/typescript-language-features/src/languageFeatures/quickFix.ts', /logTelemetry|TelemetryReporter/],
			['extensions/typescript-language-features/src/languageFeatures/refactor.ts', /logTelemetry|TelemetryReporter|DidApplyRefactoringCommand/],
			['extensions/typescript-language-features/src/languageFeatures/util/copilot.ts', /logTelemetry|TelemetryReporter/],
			['extensions/typescript-language-features/src/ui/largeProjectStatus.ts', /logTelemetry|TelemetryReporter|hintProjectExcludes/],
			['extensions/typescript-language-features/src/tsServer/serverError.ts', /__GDPR__|get telemetry|sanitizedStack|badclient|TypeScriptRequestErrorProperties/],
		];
		for (const [relativePath, removal] of prunedSites) {
			assert.doesNotMatch(readRepoFile(relativePath), removal, relativePath);
		}

		// Retained: the ordinary tsserver error/exit diagnostics and the experimentation adapter.
		assert.match(readRepoFile('extensions/typescript-language-features/src/typescriptServiceClient.ts'), /TSServer exited\. Code:/);
		assert.match(readRepoFile('extensions/typescript-language-features/src/experimentTelemetryReporter.ts'), /class ExperimentationTelemetryReporter/);
		assert.match(readRepoFile('extensions/typescript-language-features/src/extension.ts'), /new ExperimentationService\(/);

		// W45.b deletion candidate: the emptied reporter module or its deletion.
		if (repoFileExists('extensions/typescript-language-features/src/logging/telemetry.ts')) {
			assert.doesNotMatch(readRepoFile('extensions/typescript-language-features/src/logging/telemetry.ts'), /export /, 'extensions/typescript-language-features/src/logging/telemetry.ts');
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

	test('T12 residual producers carry no telemetry service, event or payload tokens', () => {
		// Every path below was matched by the pass-6 T12 root scan and had its
		// producer removed in pass 7: no `ITelemetryService` injection, `publicLog*`
		// event, `__GDPR__` fragment or `TelemetryTrustedValue` wrapper remains.
		const prunedProducers = [
			// API layer
			'src/vs/workbench/api/browser/mainThreadTelemetry.ts',
			'src/vs/workbench/api/common/extHostApiDeprecationService.ts',
			'src/vs/workbench/api/common/extHostCommands.ts',
			'src/vs/workbench/api/common/extHostDebugService.ts',
			'src/vs/workbench/api/common/extHostExtensionService.ts',
			'src/vs/workbench/api/common/extHostRequireInterceptor.ts',
			'src/vs/workbench/api/common/extHostSCM.ts',
			'src/vs/workbench/api/common/extHostWorkspace.ts',
			'src/vs/workbench/api/node/proxyResolver.ts',
			// Platform
			'src/vs/platform/accessibilitySignal/browser/accessibilitySignalService.ts',
			'src/vs/platform/browserView/electron-main/browserView.ts',
			'src/vs/platform/browserView/electron-main/browserViewMainService.ts',
			'src/vs/platform/browserView/node/playwrightChannel.ts',
			'src/vs/platform/browserView/node/playwrightService.ts',
			'src/vs/platform/diagnostics/node/diagnosticsService.ts',
			'src/vs/platform/diagnostics/common/diagnostics.ts',
			'src/vs/platform/extensions/electron-main/extensionHostStarter.ts',
			'src/vs/platform/profiling/common/profilingTelemetrySpec.ts',
			'src/vs/platform/profiling/electron-browser/profileAnalysisWorkerService.ts',
			'src/vs/platform/update/electron-main/abstractUpdateService.ts',
			'src/vs/platform/update/electron-main/updateService.darwin.ts',
			'src/vs/platform/update/electron-main/updateService.linux.ts',
			'src/vs/platform/update/electron-main/updateService.win32.ts',
			'src/vs/platform/utilityProcess/electron-main/utilityProcess.ts',
			'src/vs/platform/utilityProcess/electron-main/utilityProcessWorkerMainService.ts',
			'src/vs/platform/windows/electron-main/windowImpl.ts',
			// Workbench contributions
			'src/vs/workbench/contrib/browserView/common/browserEditorInput.ts',
			'src/vs/workbench/contrib/browserView/common/browserView.ts',
			'src/vs/workbench/contrib/browserView/electron-browser/browserView.contribution.ts',
			'src/vs/workbench/contrib/browserView/electron-browser/features/browserTabManagementFeatures.ts',
			'src/vs/workbench/contrib/codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint.ts',
			'src/vs/workbench/contrib/localization/electron-browser/localization.contribution.ts',
			'src/vs/workbench/contrib/markdown/browser/markdownSettingRenderer.ts',
			'src/vs/workbench/contrib/mcp/browser/mcpCommandsAddConfiguration.ts',
			'src/vs/workbench/contrib/mcp/browser/mcpServerActions.ts',
			'src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts',
			'src/vs/workbench/contrib/mcp/common/mcpServer.ts',
			'src/vs/workbench/contrib/onboarding/browser/onboardingService.ts',
			'src/vs/workbench/contrib/performance/browser/startupTimings.ts',
			'src/vs/workbench/contrib/performance/electron-browser/startupTimings.ts',
			'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts',
			'src/vs/workbench/contrib/preferences/browser/settingsTree.ts',
			'src/vs/workbench/contrib/share/browser/shareService.ts',
			'src/vs/workbench/contrib/speech/browser/speechService.ts',
			'src/vs/workbench/contrib/surveys/browser/languageSurveys.contribution.ts',
			'src/vs/workbench/contrib/surveys/browser/nps.contribution.ts',
			'src/vs/workbench/contrib/surveys/browser/surveyEditorPane.ts',
			'src/vs/workbench/contrib/update/browser/postUpdateWidget.ts',
			'src/vs/workbench/contrib/update/browser/updateTitleBarEntry.ts',
			'src/vs/workbench/contrib/url/browser/trustedDomains.ts',
			'src/vs/workbench/contrib/url/browser/trustedDomainsValidator.ts',
			'src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts',
			'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts',
			'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts',
			'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedService.ts',
			'src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts',
			// Workbench services
			'src/vs/workbench/services/accessibility/electron-browser/accessibilityService.ts',
			'src/vs/workbench/services/languageDetection/browser/languageDetectionWorkerServiceImpl.ts',
			'src/vs/workbench/services/languageDetection/browser/languageDetectionWebWorker.ts',
			'src/vs/workbench/services/languageDetection/common/languageDetectionWorkerService.ts',
			'src/vs/workbench/services/remote/electron-browser/remoteAgentService.ts',
			'src/vs/workbench/services/textMate/browser/tokenizationSupport/textMateTokenizationSupport.ts',
			'src/vs/workbench/services/textMate/browser/textMateTokenizationFeatureImpl.ts',
		];
		for (const relativePath of prunedProducers) {
			assert.doesNotMatch(readRepoFile(relativePath), /ITelemetryService|publicLog|__GDPR__|TelemetryTrustedValue/, relativePath);
		}

		// `contrib/tags` was a telemetry-only tree and is disconnected from both
		// entrypoints; the emptied files are recorded in the parent W46 manifest.
		assert.doesNotMatch(readRepoFile('src/vs/workbench/workbench.desktop.main.ts'), /contrib\/tags\//);
		assert.doesNotMatch(readRepoFile('src/vs/workbench/workbench.web.main.ts'), /contrib\/tags\//);
		for (const relativePath of [
			'src/vs/workbench/contrib/tags/browser/workspaceTagsService.ts',
			'src/vs/workbench/contrib/tags/common/workspaceTags.ts',
			'src/vs/workbench/contrib/tags/common/javaWorkspaceTags.ts',
			'src/vs/workbench/contrib/tags/electron-browser/workspaceTags.ts',
			'src/vs/workbench/contrib/tags/electron-browser/workspaceTagsService.ts',
			'src/vs/workbench/contrib/tags/electron-browser/tags.contribution.ts',
		]) {
			// W46 whole-file deletion candidate: the guard stays green once the parent removes it.
			if (repoFileExists(relativePath)) {
				assert.doesNotMatch(readRepoFile(relativePath), /ITelemetryService|publicLog|__GDPR__|TelemetryTrustedValue/, relativePath);
			}
		}

		// Retained no-op/infrastructure modules keep their minimal public shape.
		assert.match(readRepoFile('src/vs/platform/telemetry/common/telemetry.ts'), /export interface ITelemetryService/);
		assert.match(readRepoFile('src/vs/platform/telemetry/common/telemetryUtils.ts'), /export class NullTelemetryServiceShape/);
		assert.match(readRepoFile('src/vs/editor/standalone/browser/standaloneServices.ts'), /class StandaloneTelemetryService/);
		assert.match(readRepoFile('src/vs/code/electron-main/telemetryServiceRegistration.ts'), /registerMainTelemetryService/);
		assert.match(readRepoFile('src/vs/workbench/services/telemetry/browser/telemetryService.ts'), /NullTelemetryServiceShape/);
	});

	test('crash-reporter argv tail and T12 retained API facade are settled', () => {
		// The crash-reporter argv/getter/help/validation tail is gone.
		const argv = readRepoFile('src/vs/platform/environment/common/argv.ts');
		assert.doesNotMatch(argv, /crash-reporter-directory|crash-reporter-id/);
		const argvNode = readRepoFile('src/vs/platform/environment/node/argv.ts');
		assert.doesNotMatch(argvNode, /crash-reporter-directory|crash-reporter-id/);
		const environmentService = readRepoFile('src/vs/platform/environment/common/environmentService.ts');
		assert.doesNotMatch(environmentService, /crashReporterId|crashReporterDirectory/);
		assert.doesNotMatch(readRepoFile('src/vs/server/node/server.cli.ts'), /crash-reporter-directory/);
		assert.doesNotMatch(readRepoFile('src/vs/workbench/electron-browser/desktop.contribution.ts'), /crash-reporter-id|enable-crash-reporter/);
		assert.doesNotMatch(readRepoFile('scripts/test.bat'), /crash-reporter-directory/);
		assert.doesNotMatch(readRepoFile('.vscode-test.js'), /crash-reporter-directory/);
		assert.doesNotMatch(readRepoFile('.vscode/launch.json'), /crash-reporter-directory/);

		// Retained: the extension-host `telemetryInfo` init data still feeds the public
		// `vscode.env.machineId`/`sessionId`/`devDeviceId`/`isNewAppInstall` API facade.
		for (const relativePath of [
			'src/vs/workbench/services/extensions/browser/webWorkerExtensionHost.ts',
			'src/vs/workbench/services/extensions/common/remoteExtensionHost.ts',
			'src/vs/workbench/services/extensions/electron-browser/localProcessExtensionHost.ts',
		]) {
			assert.match(readRepoFile(relativePath), /telemetryInfo: \{/, relativePath);
		}
		const apiImpl = readRepoFile('src/vs/workbench/api/common/extHost.api.impl.ts');
		assert.match(apiImpl, /initData\.telemetryInfo\.machineId/);
		assert.match(apiImpl, /initData\.telemetryInfo\.sessionId/);
		assert.match(apiImpl, /TelemetryTrustedValue: TelemetryTrustedValue/);
	});
});
