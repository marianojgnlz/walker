/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function readWorkbenchSource(relativePath: string): string {
	return readFileSync(join(process.cwd(), 'src/vs/workbench', relativePath), 'utf8');
}

function readRepositorySource(relativePath: string): string {
	return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

suite('Product chat integration boundaries', () => {
	test('retained accessibility features do not bridge into Chat', () => {
		const accessibleView = readWorkbenchSource('contrib/accessibility/browser/accessibleView.ts');
		assert.doesNotMatch(accessibleView, /IChatCodeBlockContextProviderService|ICodeBlockActionContext|calculateCodeBlocks|registerProvider\(\{ getCodeBlockContext|_getChatHints|workbench\.action\.chat/);
		assert.match(accessibleView, /class AccessibleView/);
		assert.match(accessibleView, /getCodeBlockContext\(\) \{\s*return undefined;\s*\}/);
		assert.match(accessibleView, /navigateToCodeBlock\(_type: 'next' \| 'previous'\): void \{ \}/);
		const accessibilityConfiguration = readWorkbenchSource('contrib/accessibility/browser/accessibilityConfiguration.ts');
		assert.doesNotMatch(accessibilityConfiguration, /accessibleViewContainsCodeBlocks/);

		const actions = readWorkbenchSource('contrib/accessibility/browser/accessibleViewActions.ts');
		assert.doesNotMatch(actions, /NextCodeBlock|PreviousCodeBlock|AccessibleViewNextCodeBlockAction|AccessibleViewPreviousCodeBlockAction/);
		assert.match(actions, /AccessibleViewNextAction/);
		assert.match(actions, /AccessibleViewPreviousAction/);
		assert.match(actions, /AccessibleViewAcceptInlineCompletionAction/);

		const editorHelp = readWorkbenchSource('contrib/accessibility/browser/editorAccessibilityHelp.ts');
		assert.doesNotMatch(editorHelp, /ChatContextKeys|ctxHasEditorModification|ctxHasRequestInProgress|getChatCommandInfo|getChatEditInfo/);
		assert.match(editorHelp, /getCommentCommandInfo/);
		assert.match(editorHelp, /HasSpeechProvider/);

		const terminalHelp = readWorkbenchSource('contrib/terminalContrib/accessibility/browser/terminalAccessibilityHelp.ts');
		assert.doesNotMatch(terminalHelp, /ChatContextKeys/);
		assert.match(terminalHelp, /HasSpeechProvider/);
		assert.match(terminalHelp, /FocusAccessibleBuffer/);
	});

	test('command palette remains available without Chat suggestions', () => {
		const commandsQuickAccess = readWorkbenchSource('contrib/quickaccess/browser/commandsQuickAccess.ts');
		assert.doesNotMatch(commandsQuickAccess, /IChatAgentService|ChatAgentLocation|CHAT_OPEN_ACTION_ID|ASK_QUICK_QUESTION_ACTION_ID|showAskInChat|Ask in Chat|workbench\.commandPalette\.showAskInChat/);
		assert.match(commandsQuickAccess, /class CommandsQuickAccessProvider/);
		assert.match(commandsQuickAccess, /getCodeEditorCommandPicks/);
		assert.match(commandsQuickAccess, /getGlobalCommandPicks/);
		assert.match(commandsQuickAccess, /getRelatedInformationPicks/);
		assert.match(commandsQuickAccess, /class ShowAllCommandsAction/);

		const quickAccessConfiguration = readWorkbenchSource('browser/quickaccess.ts');
		assert.doesNotMatch(quickAccessConfiguration, /showAskInChat|askChatLocation/);
		assert.match(quickAccessConfiguration, /readonly history: number/);
		assert.match(quickAccessConfiguration, /suggestCommands: boolean/);
	});

	test('editor dictation remains available through the speech provider without Chat', () => {
		const editorDictation = readWorkbenchSource('contrib/codeEditor/browser/dictation/editorDictation.ts');
		assert.doesNotMatch(editorDictation, /ChatContextKeys|IChatSpeechToTextService|BuiltinDictationConfigured|\.\.\/\.\.\/\.\.\/chat\//);
		assert.match(editorDictation, /HasSpeechProvider/);
		assert.match(editorDictation, /createSpeechToTextSession\(cts\.token, 'editor'\)/);
		assert.match(editorDictation, /SpeechToTextStatus\.Recognized/);
	});

	test('empty editor hints retain language setup without Chat', () => {
		const emptyTextEditorHint = readWorkbenchSource('contrib/codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint.ts');
		assert.doesNotMatch(emptyTextEditorHint, /IChatAgentService|ChatAgentLocation|IInlineChatSessionService|inlineChat\.start|hasInlineChatProvider|emptyTextEditorHintWithInlineChat/);
		assert.match(emptyTextEditorHint, /ChangeLanguageAction\.ID/);
		assert.match(emptyTextEditorHint, /emptyTextEditorHintSetting/);
		assert.match(emptyTextEditorHint, /AccessibilityVerbositySettingId\.EmptyEditorHint/);
		assert.match(emptyTextEditorHint, /registerEditorContribution\(EmptyTextEditorHintContribution\.ID/);

		const emptyCellEditorHint = readWorkbenchSource('contrib/notebook/browser/contrib/editorHint/emptyCellEditorHint.ts');
		assert.doesNotMatch(emptyCellEditorHint, /IChatAgentService|ChatAgentLocation|IInlineChatSessionService/);
		assert.match(emptyCellEditorHint, /Schemas\.vscodeNotebookCell/);
		assert.doesNotMatch(emptyCellEditorHint, /registerEditorContribution\(EmptyCellEditorHintContribution\.CONTRIB_ID/);

		const notebookContribution = readWorkbenchSource('contrib/notebook/browser/notebook.contribution.ts');
		assert.doesNotMatch(notebookContribution, /contrib\/editorHint\/emptyCellEditorHint/);
		assert.match(notebookContribution, /contrib\/clipboard\/notebookClipboard/);
	});

	test('symbol navigation retains editor outlines without Chat integration', () => {
		const workbenchGotoSymbol = readWorkbenchSource('contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts');
		assert.doesNotMatch(workbenchGotoSymbol, /ChatOutline|IChatWidgetService|ISymbolVariableEntry|isRequestVM|chatWidgetService/);
		assert.match(workbenchGotoSymbol, /doGetOutlinePicks/);
		assert.match(workbenchGotoSymbol, /getSymbolPicks\(/);

		const editorGotoSymbol = readFileSync(join(process.cwd(), 'src/vs/editor/contrib/quickAccess/browser/gotoSymbolQuickAccess.ts'), 'utf8');
		assert.doesNotMatch(editorGotoSymbol, /attach\?\(|item\.attach|add to chat context/);
		assert.match(editorGotoSymbol, /this\.gotoLocation/);

		const goToSymbol = readFileSync(join(process.cwd(), 'src/vs/editor/contrib/gotoSymbol/browser/goToSymbol.ts'), 'utf8');
		assert.doesNotMatch(goToSymbol, /vscodeChatCodeBlock|vscodeChatCodeCompareBlock/);
		assert.match(goToSymbol, /Schemas\.walkThroughSnippet/);
	});

	test('inline completions remain provider-driven without Chat entitlement gates', () => {
		const inlineCompletionsModel = readFileSync(join(process.cwd(), 'src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts'), 'utf8');
		assert.doesNotMatch(inlineCompletionsModel, /product\.defaultChatAgent|completionsEnablementSetting/);
		assert.match(inlineCompletionsModel, /createInstance\(InlineCompletionsSource/);

		const inlineCompletionStatus = readWorkbenchSource('contrib/inlineCompletions/browser/inlineCompletionLanguageStatusBarContribution.ts');
		assert.doesNotMatch(inlineCompletionStatus, /IChatEntitlementService|sentimentObs|\$\(copilot\)/);
		assert.match(inlineCompletionStatus, /InlineCompletionsController\.get/);
		assert.match(inlineCompletionStatus, /this\._languageStatusService\.addStatus/);
	});

	test('debug actions retain ordinary editor behavior without Chat gates', () => {
		const debugContribution = readWorkbenchSource('contrib/debug/browser/debug.contribution.ts');
		assert.doesNotMatch(debugContribution, /DebugChatContextContribution|debugChatIntegration/);
		assert.match(debugContribution, /registerWorkbenchContribution\(DebugStatusContribution/);

		const debugCommands = readWorkbenchSource('contrib/debug/browser/debugCommands.ts');
		assert.doesNotMatch(debugCommands, /ChatContextKeys/);
		assert.match(debugCommands, /TOGGLE_INLINE_BREAKPOINT_ID/);

		const debugEditorActions = readWorkbenchSource('contrib/debug/browser/debugEditorActions.ts');
		assert.doesNotMatch(debugEditorActions, /ChatContextKeys/);
		assert.match(debugEditorActions, /class RunToCursorAction/);
		assert.match(debugEditorActions, /class SelectionToReplAction/);
		assert.match(debugEditorActions, /class SelectionToWatchExpressionsAction/);
	});

	test('code actions remain available without inline Chat affordances', () => {
		const codeActionController = readFileSync(join(process.cwd(), 'src/vs/editor/contrib/codeAction/browser/codeActionController.ts'), 'utf8');
		assert.doesNotMatch(codeActionController, /inlineChat\.start/);
		assert.match(codeActionController, /actions\.allAIFixes/);
		assert.match(codeActionController, /showCodeActionList\(actions, at/);

		const codeActionCommands = readFileSync(join(process.cwd(), 'src/vs/editor/contrib/codeAction/browser/codeActionCommands.ts'), 'utf8');
		assert.doesNotMatch(codeActionCommands, /MenuId\.InlineChatEditorAffordance/);
		assert.match(codeActionCommands, /class QuickFixAction/);
		assert.match(codeActionCommands, /EditorContextKeys\.hasCodeActionsProvider/);

		const markerHover = readFileSync(join(process.cwd(), 'src/vs/editor/contrib/hover/browser/markerHoverParticipant.ts'), 'utf8');
		assert.doesNotMatch(markerHover, /fix with inline chat/i);
		assert.match(markerHover, /MenuId\.MarkerHoverStatusBar/);
		assert.match(markerHover, /getMenuActions\(MenuId\.MarkerHoverStatusBar/);
		assert.match(markerHover, /NextMarkerAction\.ID/);
	});

	test('quick diff providers remain available without Chat edit coordination', () => {
		const quickDiffModel = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/scm/browser/quickDiffModel.ts'), 'utf8');
		assert.doesNotMatch(quickDiffModel, /IChatEditingService|ModifiedFileEntryState|editingSessionsObs/);
		assert.match(quickDiffModel, /onDidChangeQuickDiffProviders/);
		assert.match(quickDiffModel, /quickDiffService\.getQuickDiffs/);
	});

	test('source control actions remain available without Chat setup shortcuts', () => {
		const scmContribution = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/scm/browser/scm.contribution.ts'), 'utf8');
		assert.doesNotMatch(scmContribution, /ChatContextKeys|CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID|product\.defaultChatAgent|SCMHistoryItemContextContribution|scm\.editor\.triggerSetup|Resolve Conflicts with AI/);
		assert.match(scmContribution, /SCMWorkingSetController/);
		assert.match(scmContribution, /SCMViewPane/);
		assert.match(scmContribution, /SCMInputContextKeys/);

		const scmInput = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/scm/browser/scmInput.ts'), 'utf8');
		assert.doesNotMatch(scmInput, /ChatContextKeys|CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID|product\.defaultChatAgent|generateCommitMessageCommand|SetupAction/);
		assert.match(scmInput, /class SCMInputWidgetActionRunner/);
		assert.match(scmInput, /SCMInputWidgetCommandId\.CancelAction/);
		assert.match(scmInput, /SCMInputWidgetStorageKey\.LastActionId, action\.id/);
	});

	test('terminal initial hints preserve generic suggestions without Chat or Copilot', () => {
		const terminalInitialHint = readWorkbenchSource('contrib/terminalContrib/inlineHint/browser/terminal.initialHint.contribution.ts');
		assert.doesNotMatch(terminalInitialHint, /IChatAgentService|IChatEntitlementService|AccessibilityVerbositySettingId\.TerminalInlineChat|Copilot CLI|terminalCopilotCli\.hintAction|sendText\('copilot'/);
		assert.match(terminalInitialHint, /AccessibilityVerbositySettingId\.Terminal/);
		assert.match(terminalInitialHint, /TerminalCapability\.CommandDetection/);
		assert.match(terminalInitialHint, /TerminalSuggestCommandId\.TriggerSuggest/);

		const terminalInitialHintConfiguration = readWorkbenchSource('contrib/terminalContrib/inlineHint/common/terminalInitialHintConfiguration.ts');
		assert.doesNotMatch(terminalInitialHintConfiguration, /agentsWindow/);
		assert.match(terminalInitialHintConfiguration, /default: true/);
	});

	test('notebook diagnostics and failure quick actions remain generic without Chat', () => {
		const cellDiagnostics = readWorkbenchSource('contrib/notebook/browser/contrib/cellDiagnostics/cellDiagnosticEditorContrib.ts');
		assert.doesNotMatch(cellDiagnostics, /IChatAgentService|ChatAgentLocation|hasNotebookAgent/);
		assert.match(cellDiagnostics, /NotebookSetting\.cellFailureDiagnostics/);
		assert.match(cellDiagnostics, /markerService\.changeOne/);

		const statusBar = readWorkbenchSource('contrib/notebook/browser/contrib/cellDiagnostics/diagnosticCellStatusBarContrib.ts');
		assert.doesNotMatch(statusBar, /IChatAgentService|ChatAgentLocation|hasNotebookAgent/);
		assert.match(statusBar, /OPEN_CELL_FAILURE_ACTIONS_COMMAND_ID/);

		const actions = readWorkbenchSource('contrib/notebook/browser/contrib/cellDiagnostics/cellDiagnosticsActions.ts');
		assert.doesNotMatch(actions, /InlineChatController|IChatWidgetService|notebook\.cell\.chat\.(?:fixError|explainError)/);
		assert.match(actions, /notebook\.cell\.openFailureActions/);
		assert.match(actions, /CodeActionController/);

		const diagnosticsTest = readWorkbenchSource('contrib/notebook/test/browser/contrib/notebookCellDiagnostics.test.ts');
		assert.doesNotMatch(diagnosticsTest, /IChatAgentService|ChatAgentLocation|ChatModeKind/);
	});

	test('notebook entrypoint, execution and navigation remain without inline Chat', () => {
		const notebookContribution = readWorkbenchSource('contrib/notebook/browser/notebook.contribution.ts');
		assert.doesNotMatch(notebookContribution, /controller\/chat\/notebook\.chat\.contribution|contrib\/editorHint\/emptyCellEditorHint/);
		assert.match(notebookContribution, /controller\/coreActions/);
		assert.match(notebookContribution, /contrib\/clipboard\/notebookClipboard/);

		const executeActions = readWorkbenchSource('contrib/notebook/browser/controller/executeActions.ts');
		assert.doesNotMatch(executeActions, /CTX_INLINE_CHAT_FOCUSED/);
		assert.match(executeActions, /NOTEBOOK_CELL_LIST_FOCUSED/);

		const editActions = readWorkbenchSource('contrib/notebook/browser/controller/editActions.ts');
		assert.doesNotMatch(editActions, /InlineChatController|CTX_INLINE_CHAT_FOCUSED/);
		assert.match(editActions, /focusNotebookCell\(context\.cell, 'editor'\)/);

		const arrowNavigation = readWorkbenchSource('contrib/notebook/browser/contrib/navigation/arrow.ts');
		assert.doesNotMatch(arrowNavigation, /InlineChatController/);
		assert.match(arrowNavigation, /focusNotebookCell\(newCell/);
	});

	test('problem markers remain available without Chat context attachments', () => {
		const markersContribution = readWorkbenchSource('contrib/markers/browser/markers.contribution.ts');
		assert.doesNotMatch(markersContribution, /MarkerChatContextContribution|markersChatContext/);
		assert.match(markersContribution, /MarkersStatusBarContributions/);
		assert.match(markersContribution, /Markers\.MARKERS_VIEW_ID/);
	});

	test('interactive editor remains available without Inline Chat', () => {
		const interactiveEditor = readWorkbenchSource('contrib/interactive/browser/interactiveEditor.ts');
		assert.doesNotMatch(interactiveEditor, /INLINE_CHAT_ID/);
		assert.match(interactiveEditor, /EditorExtensionsRegistry\.getSomeEditorContributions/);
		assert.match(interactiveEditor, /MarkerController\.ID/);

		const interactiveContribution = readWorkbenchSource('contrib/interactive/browser/interactive.contribution.ts');
		assert.doesNotMatch(interactiveContribution, /InlineChatController|acceptSession\(\)/);
		assert.match(interactiveContribution, /historyService\.replaceLast/);
		assert.match(interactiveContribution, /new ResourceNotebookCellEdit/);
	});

	test('image carousel keeps Explorer preview without Chat actions', () => {
		const imageCarousel = readWorkbenchSource('contrib/imageCarousel/browser/imageCarousel.contribution.ts');
		assert.doesNotMatch(imageCarousel, /imageCarousel\.chat\.enabled|workbench\.action\.chat\.openImageInCarousel|OpenImageInCarouselAction/);
		assert.match(imageCarousel, /workbench\.action\.openImagesInCarousel/);
		assert.match(imageCarousel, /imageCarousel\.explorerContextMenu\.enabled/);
		assert.match(imageCarousel, /EditorPaneDescriptor\.create/);
	});

	test('settings editor preserves generic settings and MCP without Chat or Agent gates', () => {
		const settingsEditor = readWorkbenchSource('contrib/preferences/browser/settingsEditor2.ts');
		assert.doesNotMatch(settingsEditor, /IChatEntitlementService|chatEntitlementService|AGENTS_WINDOW_SETTING_TAG|@feature:chat|@tag:agentMerge/);
		assert.match(settingsEditor, /updateAiSearchToggleVisibility/);
		assert.match(settingsEditor, /getExperimentalExtensionToggleData\(this\.extensionGalleryService, this\.productService\)/);

		const settingsLayout = readWorkbenchSource('contrib/preferences/browser/settingsLayout.ts');
		assert.doesNotMatch(settingsLayout, /ChatAIDisabledSettingId|id: 'chat'|chat\/agent|chat\.mcp\./);
		assert.match(settingsLayout, /id: 'features\/search'/);
		assert.match(settingsLayout, /id: 'features\/mcp'[\s\S]*settings: \['mcp', 'mcp\.\*'\]/);
		assert.doesNotMatch(settingsLayout, /GitHub\.copilot-chat\.manageExtension|chat\.agent\.maxRequests/);

		const preferences = readWorkbenchSource('contrib/preferences/common/preferences.ts');
		assert.doesNotMatch(preferences, /IChatEntitlementService|chatEntitlementService/);
		assert.match(preferences, /extensionGalleryService\.isEnabled\(\)/);
		assert.match(preferences, /productService\.extensionRecommendations/);
	});

	test('Tasks keep generic output and notifications without Chat troubleshooting hooks', () => {
		const abstractTasks = readWorkbenchSource('contrib/tasks/browser/abstractTaskService.ts');
		assert.doesNotMatch(abstractTasks, /ChatAgentLocation|ChatModeKind|CHAT_OPEN_ACTION_ID|IChatAgentService|IChatService|troubleshootWithChat|taskServiceOutputPromptChat|TaskRunSource\.ChatAgent/);
		assert.match(abstractTasks, /label: nls\.localize\('showOutput', "Show Output"\)/);
		assert.match(abstractTasks, /taskServiceOutputPrompt', 'There are task errors\. See the output for details\.'/);
		assert.match(abstractTasks, /protected _showOutput\(runSource: TaskRunSource/);

		const desktopTasks = readWorkbenchSource('contrib/tasks/electron-browser/taskService.ts');
		assert.doesNotMatch(desktopTasks, /IChatAgentService|IChatService|_chatAgentService|_chatService/);
		assert.match(desktopTasks, /super\(configurationService/);

		const taskTypes = readWorkbenchSource('contrib/tasks/common/tasks.ts');
		assert.doesNotMatch(taskTypes, /\bChatAgent\b/);
		// The Chat agent tool tree that used to read `TaskRunSource.ChatAgent` is deleted,
		// so assert that absence instead of reading a file that no longer exists.
		assert.ok(
			!existsSync(join(process.cwd(), 'src/vs/workbench', 'contrib/terminalContrib/chatAgentTools')),
			'the removed Chat agent tool tree must not come back'
		);
	});

	test('preferences and image carousel contain no stale Chat-only residue', () => {
		const settingsTreeModels = readWorkbenchSource('contrib/preferences/browser/settingsTreeModels.ts');
		assert.doesNotMatch(settingsTreeModels, /featureFilters\.has\('chat'\)|chatFeatures/);
		assert.match(settingsTreeModels, /AGENTS_WINDOW_SETTING_TAG/);
		assert.match(settingsTreeModels, /Array\.from\(featureFilters\)\.some\(filter =>/);
		assert.match(settingsTreeModels, /child\.id === 'features'/);

		const imageCarouselEditor = readWorkbenchSource('contrib/imageCarousel/browser/imageCarouselEditor.ts');
		assert.doesNotMatch(imageCarouselEditor, /chat attachments/);
		assert.match(imageCarouselEditor, /image\.data instanceof Uint8Array/);
	});

	test('legacy Agent Sessions startup value does not suppress generic walkthrough behavior', () => {
		const gettingStartedService = readWorkbenchSource('contrib/welcomeGettingStarted/browser/gettingStartedService.ts');
		assert.doesNotMatch(gettingStartedService, /agentSessionsWelcomePage/);
		assert.match(gettingStartedService, /workbench\.welcomePage\.walkthroughs\.openOnInstall/);
	});

	test('Getting Started preserves ordinary onboarding without Chat or Agent routes', () => {
		const contribution = readWorkbenchSource('contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts');
		assert.doesNotMatch(contribution, /AgentSessionsWelcomePage|IChatEntitlementService|chatEntitlementService|agentSessionsWelcomePage|welcome\.newWorkspaceChat/);
		assert.match(contribution, /id: 'workbench\.action\.openWalkthrough'/);
		assert.match(contribution, /workbench\.startupEditor/);
		assert.match(contribution, /'welcomePageInEmptyWorkbench'/);

		const gettingStarted = readWorkbenchSource('contrib/welcomeGettingStarted/browser/gettingStarted.ts');
		assert.doesNotMatch(gettingStarted, /createAgentsBanner|IChatEntitlementService|chatEntitlementService/);
		assert.match(gettingStarted, /showOnStartupCheckbox\.domNode/);

		const startupPage = readWorkbenchSource('contrib/welcomeGettingStarted/browser/startupPage.ts');
		assert.doesNotMatch(startupPage, /IChatEntitlementService|chatEntitlementService/);
		assert.match(startupPage, /this\.onboardingService\.show\(\)/);
		assert.match(startupPage, /ONBOARDING_STORAGE_KEY/);

		const content = readWorkbenchSource('contrib/welcomeGettingStarted/common/gettingStartedContent.ts');
		assert.doesNotMatch(content, /defaultChatAgent|createCopilotSetupStep|topLevelNewWorkspaceChat|welcome\.newWorkspaceChat|workbench\.action\.chat\./);
		assert.match(content, /id: 'Setup'/);
		assert.match(content, /id: 'pickColorTheme'/);
	});

	test('terminal dictation remains speech-provider driven without Chat services', () => {
		const terminalMenus = readWorkbenchSource('contrib/terminal/browser/terminalMenus.ts');
		assert.doesNotMatch(terminalMenus, /ChatContextKeys/);
		assert.match(terminalMenus, /const TerminalDictationAvailable = HasSpeechProvider/);

		const voiceActions = readWorkbenchSource('contrib/terminalContrib/voice/browser/terminalVoiceActions.ts');
		assert.doesNotMatch(voiceActions, /IChatSpeechToTextService|ChatContextKeys|chatSpeechToTextService/);
		assert.match(voiceActions, /HasSpeechProvider/);
		assert.match(voiceActions, /TerminalVoiceSession\.getInstance/);

		const terminalVoice = readWorkbenchSource('contrib/terminalContrib/voice/browser/terminalVoice.ts');
		assert.doesNotMatch(terminalVoice, /IChatSpeechToTextService|ChatSpeechToTextState|getDictationPreparingLabel|chatSpeechToTextService|_startBuiltin/);
		assert.match(terminalVoice, /createSpeechToTextSession\([^)]*'terminal'/);
		assert.match(terminalVoice, /postProcessTerminalDictation/);
	});

	test('terminal tabs and testing registration preserve generic behavior without Chat tools', () => {
		const terminalTabbedView = readWorkbenchSource('contrib/terminal/browser/terminalTabbedView.ts');
		assert.doesNotMatch(terminalTabbedView, /ITerminalChatService|TerminalTabsChatEntry|getToolSessionTerminalInstances|ChatHasHiddenTerminals|_updateChatTerminalsEntry/);
		assert.match(terminalTabbedView, /TerminalTabList/);
		assert.match(terminalTabbedView, /_refreshShowTabs/);

		const terminalContextKey = readWorkbenchSource('contrib/terminal/common/terminalContextKey.ts');
		assert.doesNotMatch(terminalContextKey, /TerminalContribContextKeyStrings\.ChatHasHiddenTerminals/);
		assert.match(terminalContextKey, /shouldShowViewInlineActions/);

		const testingContribution = readWorkbenchSource('contrib/testing/browser/testing.contribution.ts');
		assert.doesNotMatch(testingContribution, /TestingChatAgentToolContribution|testingChatAgentTool\.js/);
		assert.match(testingContribution, /registerWorkbenchContribution2\(TestingContentProvider\.ID/);

		const telemetryContributionPath = join(process.cwd(), 'src/vs/workbench', 'contrib/telemetry/browser/telemetry.contribution.ts');
		if (existsSync(telemetryContributionPath)) {
			const telemetryContribution = readFileSync(telemetryContributionPath, 'utf8');
			assert.doesNotMatch(telemetryContribution, /TerminalContribSettingId|terminal\.integrated\.chatAgentTools\.outputLocation/);
		}

		// The workbench telemetry call-site contribution is no longer registered: T3 removed
		// the workspace-load/file/configuration events, so neither the Chat-only setting
		// reference nor the telemetry machinery can come back through it.
		const commonMain = readWorkbenchSource('workbench.common.main.ts');
		assert.doesNotMatch(commonMain, /contrib\/telemetry\/browser\/telemetry\.contribution/);
		assert.doesNotMatch(commonMain, /policyTelemetry\.contribution/);
	});

	test('terminal startup and command decoration preserve generic behavior without Chat', () => {
		const terminalAll = readWorkbenchSource('contrib/terminal/terminal.all.ts');
		assert.doesNotMatch(terminalAll, /terminal\.chatAgentTools\.contribution|terminal\.chat\.contribution/);
		assert.match(terminalAll, /terminal\.voice\.contribution/);
		assert.match(terminalAll, /terminal\.suggest\.contribution/);

		const terminalExports = readWorkbenchSource('contrib/terminal/terminalContribExports.ts');
		assert.doesNotMatch(terminalExports, /import \{[^}]*\bterminalChatAgentToolsConfiguration\b|\.\.\.terminalChatAgentToolsConfiguration\b/);
		assert.doesNotMatch(terminalExports, /terminalContrib\/chat(?:AgentTools)?\/|TerminalChat(?:CommandId|ContextKeyStrings|AgentToolsSettingId)/);
		// These four Chat consumers were redirected off the generic terminal bridge in
		// U05.c.026 and their whole tree has since been deleted. Check them only while
		// they still exist so this retained boundary test survives their deletion.
		for (const chatTerminalConsumer of [
			'contrib/chat/browser/actions/chatAccessibilityHelp.ts',
			'contrib/chat/browser/agentSessions/agentHost/agentHostModePickerPresentation.ts',
			'contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolConfirmationSubPart.ts',
			'contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.ts',
		]) {
			const chatTerminalConsumerPath = join(process.cwd(), 'src/vs/workbench', chatTerminalConsumer);
			if (existsSync(chatTerminalConsumerPath)) {
				assert.doesNotMatch(readFileSync(chatTerminalConsumerPath, 'utf8'), /terminalContribExports/);
			}
		}
		assert.ok(
			!existsSync(join(process.cwd(), 'src/vs/workbench', 'contrib/chat')),
			'the removed Chat tree must not come back'
		);
		assert.match(terminalExports, /terminalInitialHintConfiguration/);
		assert.match(terminalExports, /terminalSuggestConfiguration/);

		const decorationAddon = readWorkbenchSource('contrib/terminal/browser/xterm/decorationAddon.ts');
		assert.doesNotMatch(decorationAddon, /IChatContextPickService|IChatWidgetService|ChatAgentLocation|attachToChat|TerminalContext|getTerminalUri/);
		assert.match(decorationAddon, /terminal\.rerunCommand/);
		assert.match(decorationAddon, /terminal\.copyCommandAndOutput/);

		const terminalMenus = readWorkbenchSource('contrib/terminal/browser/terminalMenus.ts');
		assert.doesNotMatch(terminalMenus, /ChatContextKeys|ChatHasHiddenTerminals/);
		assert.match(terminalMenus, /TabsShowActiveTerminal/);
	});

	test('edit telemetry retains generic source tracking without Agent Host attribution', () => {
		const feature = readWorkbenchSource('contrib/editTelemetry/browser/telemetry/editSourceTrackingFeature.ts');
		assert.doesNotMatch(feature, /agentHostEditMarkerService|AgentHostEditMarkerService|markerService/);
		assert.match(feature, /createInstance\(EditSourceTrackingImpl, shouldSendDetails, this\._annotatedDocuments\)/);

		const impl = readWorkbenchSource('contrib/editTelemetry/browser/telemetry/editSourceTrackingImpl.ts');
		assert.doesNotMatch(impl, /agentHostEditMarkerService|AgentHostEditMarkerService|preparedAgentFlush|deferSuppressedExternal|includeSuppressedExternal|coverageGap|externalEditCorrelation/);
		assert.doesNotMatch(impl, /platform\/agentHost/);
		assert.match(impl, /new DocumentEditSourceTracker\(docWithJustReason, undefined\)/);
		assert.match(impl, /const agentModifiedCount = data\.agentHostModifiedCount;/);
		assert.match(impl, /const totalModifiedCount = data\.totalModifiedCharactersInFinalState;/);

		const tracker = readWorkbenchSource('contrib/editTelemetry/browser/telemetry/editTracker.ts');
		assert.doesNotMatch(tracker, /agentHostEditMarkerService/);
		assert.match(tracker, /export interface IExternalEditCorrelation \{/);
		assert.match(tracker, /export interface IExternalEditCorrelationResolution \{/);

		// The Agent Host marker service died with the Agent Host tree, so assert its
		// absence instead of reading a file that no longer exists.
		assert.ok(
			!existsSync(join(process.cwd(), 'src/vs/workbench', 'contrib/editTelemetry/browser/telemetry/agentHostEditMarkerService.ts')),
			'the removed Agent Host edit marker service must not come back'
		);
	});

	test('retained startup, policy and product surfaces carry no Agent Host debug or config-sync residue', () => {
		// Debug ports: only the retained pty-host and shared-process inspectors stay parseable.
		const argv = readRepositorySource('src/vs/platform/environment/common/argv.ts');
		assert.doesNotMatch(argv, /'inspect-agenthost'|'inspect-brk-agenthost'/);
		assert.match(argv, /'inspect-ptyhost'\?: string;/);
		assert.match(argv, /'inspect-sharedprocess'\?: string;/);

		const argvOptions = readRepositorySource('src/vs/platform/environment/node/argv.ts');
		assert.doesNotMatch(argvOptions, /'inspect-agenthost'|'inspect-brk-agenthost'/);
		assert.match(argvOptions, /'inspect-ptyhost': \{ type: 'string'/);
		assert.match(argvOptions, /'inspect-sharedprocess': \{ type: 'string'/);

		const environmentService = readRepositorySource('src/vs/platform/environment/node/environmentService.ts');
		assert.doesNotMatch(environmentService, /parseAgentHostDebugPort|5878/);
		assert.match(environmentService, /export function parsePtyHostDebugPort/);
		assert.match(environmentService, /export function parseSharedProcessDebugPort/);

		// Settings no longer mirror into a deleted agent host root configuration.
		const configurationRegistry = readRepositorySource('src/vs/platform/configuration/common/configurationRegistry.ts');
		assert.doesNotMatch(configurationRegistry, /IAgentHostConfigurationSync|getAgentHostSyncConfigurations|AgentHostConfigurationSyncScope|agentHostSyncConfigurations/);
		assert.match(configurationRegistry, /getPolicyConfigurations\(\): Map<PolicyName, string>/);
		assert.match(configurationRegistry, /Cannot register '\{0\}'\. A setting must not declare both 'policy' and 'policyReference'\./);

		const requestConfiguration = readRepositorySource('src/vs/platform/request/common/request.ts');
		assert.doesNotMatch(requestConfiguration, /agentHost: \{ key:|AgentHostConfigurationSyncScope/);
		assert.match(requestConfiguration, /'http\.proxy'/);
		assert.match(requestConfiguration, /'http\.noProxy'/);
		assert.match(requestConfiguration, /function registerProxyConfigurations\(useHostProxy/);

		// The About dialog and the dev product fallback no longer read Copilot versions.
		const product = readRepositorySource('src/vs/base/common/product.ts');
		assert.doesNotMatch(product, /copilotVersions/);
		const productDefaults = readRepositorySource('src/vs/platform/product/common/product.ts');
		assert.doesNotMatch(productDefaults, /copilotVersions|copilotRuntimeVersion|@github\/copilot-sdk/);
		assert.match(productDefaults, /version: packageConfiguration\.version/);
		const dialog = readRepositorySource('src/vs/platform/dialogs/electron-browser/dialog.ts');
		assert.doesNotMatch(dialog, /copilot|formatCopilotVersion/i);
		assert.match(dialog, /localize\(\{ key: 'aboutDetail'/);

		// The removed Copilot packages are not dependencies of the retained product.
		const manifest = readRepositorySource('package.json');
		assert.doesNotMatch(manifest, /@github\/copilot-sdk|@vscode\/copilot-api|copilotRuntimeVersion/);
		assert.match(manifest, /"compile": "npm run compile-client"/);
	});

	test('workspace build tasks carry no Copilot watcher scripts', () => {
		const tasks = readRepositorySource('.vscode/tasks.json');

		assert.doesNotMatch(tasks, /copilot/i);
		assert.match(tasks, /"script": "watch-client-transpiled"/);
		assert.match(tasks, /"label": "VS Code - Build"/);
	});

	test('server and shared process do not wire Agent Host starters or channels', () => {
		const serverServices = readRepositorySource('src/vs/server/node/serverServices.ts');
		assert.doesNotMatch(serverServices, /NodeAgentHostStarter|ServerAgentHostManager|AgentHostChannel|UnavailableAgentHostChannel|AgentHostIpcChannels/);
		assert.match(serverServices, /socketServer\.registerChannel\('logger'/);
		assert.match(serverServices, /socketServer\.registerChannel\('userDataProfiles'/);

		const sharedProcessMain = readRepositorySource('src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts');
		assert.doesNotMatch(sharedProcessMain, /AgentHost/);
		assert.match(sharedProcessMain, /registerChannel\('localGit'/);
		assert.match(sharedProcessMain, /registerChannel\('playwright'/);
	});

	test('desktop/web build entry lists and window startup contain no Agents Window sessions residue', () => {
		const nextIndex = readRepositorySource('build/next/index.ts');
		assert.doesNotMatch(nextIndex, /vs\/sessions\//);
		assert.doesNotMatch(nextIndex, /sessionsWebEntryPoint|bundleDevTunnelsWeb|devTunnelsWebOutDir/);
		assert.match(nextIndex, /vs\/workbench\/workbench\.web\.main\.internal/);

		const gulpfile = readRepositorySource('build/gulpfile.vscode.ts');
		assert.doesNotMatch(gulpfile, /vs\/sessions\//);
		assert.doesNotMatch(gulpfile, /sessions\.ico/);
		assert.match(gulpfile, /vs\/code\/electron-browser\/workbench\/workbench\.html/);

		const windowImpl = readRepositorySource('src/vs/platform/windows/electron-main/windowImpl.ts');
		assert.doesNotMatch(windowImpl, /vs\/sessions\/electron-browser/);
		assert.doesNotMatch(windowImpl, /sessions\.ico/);
		assert.doesNotMatch(windowImpl, /config(uration)?\.isSessionsWindow/);
		assert.match(windowImpl, /vs\/code\/electron-browser\/workbench\/workbench/);
	});
});
