/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { createAuthenticationApiFacade, createChatApiFacade, createChatWindowApiFacade, createInteractiveApiFacade, createLanguageModelApiFacade } from '../../common/extHost.api.impl.js';
import { createLanguageModelAccessInformation } from '../../common/extHostLanguageModelAccessInformation.js';
import type * as vscode from 'vscode';

const unsupportedError = (error: unknown): boolean => {
	assert.ok(error instanceof Error);
	assert.strictEqual(error.name, 'AuthenticationUnsupported');
	assert.strictEqual((error as Error & { code?: string }).code, 'WALKER_AUTHENTICATION_UNSUPPORTED');
	assert.ok(error.message.length > 0);
	return true;
};

const unsupportedChatError = (error: unknown): boolean => {
	assert.ok(error instanceof Error);
	assert.strictEqual(error.name, 'ChatUnsupported');
	assert.strictEqual((error as Error & { code?: string }).code, 'WALKER_CHAT_UNSUPPORTED');
	assert.ok(error.message.length > 0);
	return true;
};

function createAuthenticationApi(): typeof vscode.authentication {
	return createAuthenticationApiFacade({
		...nullExtensionDescription,
		enabledApiProposals: ['authSession', 'authIssuers', 'authLearnMore']
	});
}

function readApiSource(relativePath: string): string {
	return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

suite('Account-free authentication API', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('passive, challenge, issuer and account inspection stays empty', async () => {
		const authentication = createAuthenticationApi();
		const challenge: vscode.AuthenticationWwwAuthenticateRequest = {
			wwwAuthenticate: 'Bearer realm="fixture"',
			fallbackScopes: ['fixture.scope']
		};
		const passive = await authentication.getSession('fixture-provider', ['fixture.scope'], { silent: true });
		const challenged = await authentication.getSession('fixture-provider', challenge, { silent: true });
		const issuer = await authentication.getSession('fixture-provider', ['fixture.scope'], {
			silent: true,
			authorizationServer: URI.parse('https://issuer.invalid')
		});

		assert.deepStrictEqual({ passive, challenged, issuer, accounts: await authentication.getAccounts('fixture-provider'), hasSession: await authentication.hasSession('fixture-provider', ['fixture.scope']) }, {
			passive: undefined,
			challenged: undefined,
			issuer: undefined,
			accounts: [],
			hasSession: false
		});
	});

	test('create and force requests reject with the stable unsupported error', async () => {
		const authentication = createAuthenticationApi();

		await assert.rejects(Promise.resolve(authentication.getSession('fixture-provider', ['fixture.scope'], {
			createIfNone: { detail: 'Fixture request', learnMore: URI.parse('https://example.invalid') }
		})), unsupportedError);
		await assert.rejects(Promise.resolve(authentication.getSession('fixture-provider', ['fixture.scope'], {
			forceNewSession: { detail: 'Fixture refresh' }
		})), unsupportedError);
	});

	test('proposal guards remain active for issuer and hasSession APIs', async () => {
		const authentication = createAuthenticationApiFacade(nullExtensionDescription);

		await assert.rejects(Promise.resolve(authentication.hasSession('fixture-provider', ['fixture.scope'])), /CANNOT use API proposal: authSession/);
		await assert.rejects(Promise.resolve(authentication.getSession('fixture-provider', ['fixture.scope'], {
			authorizationServer: URI.parse('https://issuer.invalid')
		})), /CANNOT use API proposal: authIssuers/);
	});

	test('Chat participant registration is deterministically unsupported and never calls providers', () => {
		const chat = createChatApiFacade();
		let providerCalls = 0;

		assert.throws(() => chat.createChatParticipant('fixture-participant', () => { providerCalls++; }), unsupportedChatError);
		assert.strictEqual(providerCalls, 0);
	});

	test('chat-session, status-item, and agent-comment APIs are inert', () => {
		const interactive = createInteractiveApiFacade();
		const chatWindow = createChatWindowApiFacade();
		let sessionEvents = 0;
		const event = chatWindow.onDidChangeActiveChatPanelSessionResource(() => sessionEvents++);

		assert.throws(() => interactive.transferActiveChat(URI.file('/fixture')), unsupportedChatError);
		assert.throws(() => chatWindow.createChatStatusItem('fixture-status'), unsupportedChatError);
		assert.throws(() => chatWindow.createAgentEditorComments(URI.file('/fixture')), unsupportedChatError);
		assert.strictEqual(chatWindow.activeChatPanelSessionResource, undefined);
		event.dispose();
		assert.strictEqual(sessionEvents, 0);
	});

	test('language-model discovery is empty and registration or execution is unsupported', async () => {
		const languageModels = createLanguageModelApiFacade();
		let providerCalls = 0;
		let toolCalls = 0;
		let modelEvents = 0;
		const event = languageModels.onDidChangeChatModels(() => modelEvents++);
		const provider: vscode.LanguageModelChatProvider = {
			provideLanguageModelChatInformation: async () => { providerCalls++; return []; },
			provideLanguageModelChatResponse: async () => { providerCalls++; },
			provideTokenCount: async () => { providerCalls++; return 0; }
		};
		const tool: vscode.LanguageModelTool<object> = {
			invoke: async () => { toolCalls++; return { content: [] }; }
		};

		assert.deepStrictEqual(await languageModels.selectChatModels({ vendor: 'fixture' }), []);
		assert.deepStrictEqual(languageModels.tools, []);
		assert.throws(() => languageModels.registerLanguageModelChatProvider('fixture', provider), unsupportedChatError);
		assert.throws(() => languageModels.registerTool('fixture', tool), unsupportedChatError);
		assert.throws(() => languageModels.invokeTool('fixture', { input: {}, toolInvocationToken: undefined }), unsupportedChatError);
		event.dispose();

		assert.deepStrictEqual({ providerCalls, toolCalls, modelEvents }, { providerCalls: 0, toolCalls: 0, modelEvents: 0 });
	});

	test('Chat RPC actors are disconnected while ordinary extension APIs remain registered', () => {
		const apiImplementation = readApiSource('src/vs/workbench/api/common/extHost.api.impl.ts');
		const mainThreadContribution = readApiSource('src/vs/workbench/api/browser/extensionHost.contribution.ts');
		const webviewManager = readApiSource('src/vs/workbench/api/browser/mainThreadWebviewManager.ts');
		const commonServices = readApiSource('src/vs/workbench/api/common/extHost.common.services.ts');
		const extensionService = readApiSource('src/vs/workbench/api/common/extHostExtensionService.ts');
		const protocol = readApiSource('src/vs/workbench/api/common/extHost.protocol.ts');
		const extHostAgentEditorComments = readApiSource('src/vs/workbench/api/common/extHostAgentEditorComments.ts');
		const mainThreadAgentEditorComments = readApiSource('src/vs/workbench/api/browser/mainThreadAgentEditorComments.ts');
		const extHostChatQuota = readApiSource('src/vs/workbench/api/common/extHostChatQuota.ts');
		const mainThreadChatQuota = readApiSource('src/vs/workbench/api/browser/mainThreadChatQuota.ts');
		const extHostChatStatus = readApiSource('src/vs/workbench/api/common/extHostChatStatus.ts');
		const mainThreadChatStatus = readApiSource('src/vs/workbench/api/browser/mainThreadChatStatus.ts');
		const extHostChatOutputRenderer = readApiSource('src/vs/workbench/api/common/extHostChatOutputRenderer.ts');
		const mainThreadChatOutputRenderer = readApiSource('src/vs/workbench/api/browser/mainThreadChatOutputRenderer.ts');
		const extHostCodeMapper = readApiSource('src/vs/workbench/api/common/extHostCodeMapper.ts');
		const mainThreadChatCodeMapper = readApiSource('src/vs/workbench/api/browser/mainThreadChatCodeMapper.ts');
		const extHostChatContext = readApiSource('src/vs/workbench/api/common/extHostChatContext.ts');
		const mainThreadChatContext = readApiSource('src/vs/workbench/api/browser/mainThreadChatContext.ts');
		const disconnectedContexts = [
			'ExtHostCodeMapper',
			'ExtHostChatOutputRenderer',
			'ExtHostLanguageModelTools',
			'ExtHostChatSessions',
			'ExtHostChatAgents2',
			'ExtHostChatContext',
			'ExtHostChatDebug',
			'ExtHostEmbeddings',
			'ExtHostChatProvider'
		];
		const disconnectedMainThreadCustomers = [
			'mainThreadLanguageModels',
			'mainThreadChatAgents2',
			'mainThreadChatCodeMapper',
			'mainThreadLanguageModelTools',
			'mainThreadEmbeddings',
			'mainThreadChatContext',
			'mainThreadChatDebug',
			'mainThreadChatStatus',
			'mainThreadChatQuota',
			'mainThreadChatInputNotification',
			'mainThreadChatSessions'
		];

		for (const context of disconnectedContexts) {
			assert.doesNotMatch(apiImplementation, new RegExp(`rpcProtocol\\.set\\(ExtHostContext\\.${context}\\b`), `${context} remains registered`);
		}
		for (const customer of disconnectedMainThreadCustomers) {
			assert.doesNotMatch(mainThreadContribution, new RegExp(`import '\\./${customer}\\.js';`), `${customer} remains a main-thread customer`);
		}
		assert.doesNotMatch(webviewManager, /MainThreadChatOutputRenderer/);
		assert.doesNotMatch(protocol, /AgentEditorComments/);
		assert.doesNotMatch(extHostAgentEditorComments, /class ExtHostAgentEditorComments/);
		assert.doesNotMatch(mainThreadAgentEditorComments, /class MainThreadAgentEditorComments/);
		assert.doesNotMatch(protocol, /IQuotaSnapshot(?:s)?Dto|IRateLimitSnapshotDto|(?:ExtHost|MainThread)ChatQuotaShape|(?:ExtHost|MainThread)ChatQuota:/);
		assert.doesNotMatch(protocol, /ChatStatusItemDto|MainThreadChatStatusShape|MainThreadChatStatus:/);
		assert.doesNotMatch(protocol, /ChatOutputRendererShape|IChatOutputRenderContextDto|MainThreadChatOutputRenderer:/);
		assert.doesNotMatch(protocol, /CodeMapperShape|ICodeMapper.*Dto|MainThreadCodeMapper:/);
		assert.doesNotMatch(protocol, /ExtHostChatContextShape|ExtHostChatContext:|MainThreadChatContextShape|MainThreadChatContext:|IChatContextItemDto/);
		assert.doesNotMatch(extHostChatQuota, /class ExtHostChatQuota/);
		assert.doesNotMatch(mainThreadChatQuota, /class MainThreadChatQuota/);
		assert.doesNotMatch(extHostChatStatus, /class ExtHostChatStatus/);
		assert.doesNotMatch(mainThreadChatStatus, /class MainThreadChatStatus/);
		assert.doesNotMatch(extHostChatOutputRenderer, /class ExtHostChatOutputRenderer/);
		assert.doesNotMatch(mainThreadChatOutputRenderer, /class MainThreadChatOutputRenderer/);
		assert.doesNotMatch(extHostCodeMapper, /class ExtHostCodeMapper/);
		assert.doesNotMatch(mainThreadChatCodeMapper, /class MainThreadChatCodemapper/);
		assert.doesNotMatch(extHostChatContext, /class ExtHostChatContext/);
		assert.doesNotMatch(mainThreadChatContext, /class MainThreadChatContext/);
		assert.doesNotMatch(apiImplementation, /accessor\.get\(IExtHostLanguageModels\)/);
		assert.doesNotMatch(commonServices, /registerSingleton\(IExtHostLanguageModels/);
		assert.doesNotMatch(extensionService, /IExtHostLanguageModels/);
		assert.match(apiImplementation, /const disconnectedChatApiContexts = new Set<ProxyIdentifier<any>>/);
		assert.match(apiImplementation, /Object\.values<ProxyIdentifier<any>>\(ExtHostContext\)\.filter\(context => !disconnectedChatApiContexts\.has\(context\)\)/);
		assert.match(apiImplementation, /rpcProtocol\.set\(ExtHostContext\.ExtHostCommands/);
		assert.match(mainThreadContribution, /import '\.\/mainThreadCommands\.js'/);
	});

	test('language-model access compatibility stays empty for every extension', () => {
		const accessInformation = createLanguageModelAccessInformation();
		let changeEvents = 0;
		const subscription = accessInformation.onDidChange(() => changeEvents++);
		const emptyStream = async function* (): AsyncGenerator<string> { };
		const model: vscode.LanguageModelChat = {
			name: 'Fixture',
			id: 'fixture-model',
			vendor: 'fixture',
			family: 'fixture',
			version: '1',
			maxInputTokens: 1,
			capabilities: { supportsToolCalling: false, supportsImageToText: false },
			sendRequest: async () => ({ stream: emptyStream(), text: emptyStream() }),
			countTokens: async () => 0
		};

		assert.strictEqual(accessInformation.canSendRequest(model), false);
		subscription.dispose();
		assert.strictEqual(changeEvents, 0);
	});

	test('provider registration and session events are inert', () => {
		const authentication = createAuthenticationApi();
		let subscriptions = 0;
		let providerCalls = 0;
		let sessionEvents = 0;
		const provider: vscode.AuthenticationProvider = {
			onDidChangeSessions: listener => {
				subscriptions++;
				return Event.None(listener);
			},
			getSessions: async () => {
				providerCalls++;
				return [];
			},
			createSession: async () => {
				providerCalls++;
				throw new Error('fixture provider must stay inert');
			},
			removeSession: async () => { providerCalls++; }
		};
		const subscription = authentication.onDidChangeSessions(() => sessionEvents++);

		assert.throws(() => authentication.registerAuthenticationProvider('fixture-provider', 'Fixture Provider', provider), unsupportedError);
		assert.throws(() => authentication.registerAuthenticationProvider('fixture-provider', 'Fixture Provider', provider), unsupportedError);
		subscription.dispose();
		assert.deepStrictEqual({ subscriptions, providerCalls, sessionEvents }, { subscriptions: 0, providerCalls: 0, sessionEvents: 0 });
	});
});
