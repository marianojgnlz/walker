/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { NullLogService, NullLoggerService } from '../../../../platform/log/common/log.js';
import { ExtensionIdentifier } from '../../../../platform/extensions/common/extensions.js';
import { IExtHostInitDataService } from '../../common/extHostInitDataService.js';
import { IExtHostProgress } from '../../common/extHostProgress.js';
import { IExtHostRpcService } from '../../common/extHostRpcService.js';
import { IExtHostUrlsService } from '../../common/extHostUrls.js';
import { IExtHostWindow } from '../../common/extHostWindow.js';
import { ExtHostAuthentication } from '../../common/extHostAuthentication.js';
import { MainContext, MainThreadAuthenticationShape } from '../../common/extHost.protocol.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { ProxyIdentifier, Proxied } from '../../../services/extensions/common/proxyIdentifier.js';
import type * as vscode from 'vscode';

class RecordingAuthenticationProxy extends mock<Proxied<MainThreadAuthenticationShape>>() {
	readonly calls: string[] = [];

	override $ensureProvider = async (providerId: string): Promise<void> => {
		this.calls.push(`ensure:${providerId}`);
	};

	override $getSession = async (): Promise<vscode.AuthenticationSession> => {
		this.calls.push('getSession');
		return {
			id: 'fixture-old-session',
			scopes: ['fixture.scope'],
			accessToken: 'fixture-only-not-a-credential',
			account: { id: 'fixture-old-account', label: 'Fixture Account' }
		};
	};

	override $getAccounts = async (): Promise<readonly vscode.AuthenticationSessionAccountInformation[]> => {
		this.calls.push('getAccounts');
		return [{ id: 'fixture-old-account', label: 'Fixture Account' }];
	};

	override $registerAuthenticationProvider = async (): Promise<void> => {
		this.calls.push('registerProvider');
	};
}

function createAuthentication(proxy: RecordingAuthenticationProxy): ExtHostAuthentication {
	const rpc = new class extends mock<IExtHostRpcService>() {
		override getProxy<T>(identifier: ProxyIdentifier<T>): Proxied<T> {
			assert.strictEqual(identifier, MainContext.MainThreadAuthentication);
			return proxy as unknown as Proxied<T>;
		}
	}();

	return new ExtHostAuthentication(
		rpc,
		new class extends mock<IExtHostInitDataService>() { }(),
		new class extends mock<IExtHostWindow>() { }(),
		new class extends mock<IExtHostUrlsService>() { }(),
		new class extends mock<IExtHostProgress>() { }(),
		new NullLoggerService(),
		new NullLogService()
	);
}

suite('Account-free API baseline', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('legacy passive session and account inspection has no provider or state side effects', async () => {
		const proxy = new RecordingAuthenticationProxy();
		const authentication = createAuthentication(proxy);

		const session = await authentication.getSession(nullExtensionDescription, 'fixture-provider', ['fixture.scope'], { silent: true });
		const accounts = await authentication.getAccounts('fixture-provider');

		assert.deepStrictEqual({ session, accounts, calls: proxy.calls }, {
			session: undefined,
			accounts: [],
			calls: []
		});
	});

	test('provider registration does not subscribe to or register an extension provider', async () => {
		const proxy = new RecordingAuthenticationProxy();
		const authentication = createAuthentication(proxy);
		let subscriptions = 0;
		let providerCalls = 0;
		const provider: vscode.AuthenticationProvider = {
			onDidChangeSessions: listener => {
				subscriptions++;
				return Event.None(listener);
			},
			getSessions: async () => [],
			createSession: async () => {
				providerCalls++;
				throw new Error('fixture provider must stay inert');
			},
			removeSession: async () => { }
		};

		authentication.registerAuthenticationProvider('fixture-provider', 'Fixture Provider', provider);
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.deepStrictEqual({ subscriptions, providerCalls, proxyCalls: proxy.calls }, {
			subscriptions: 0,
			providerCalls: 0,
			proxyCalls: []
		});
	});

	test('fixture identifiers and old session state contain no real account data', () => {
		assert.deepStrictEqual([
			new ExtensionIdentifier('fixture.publisher').value,
			'fixture-old-session',
			'fixture-old-account',
			'fixture-only-not-a-credential'
		], [
			'fixture.publisher',
			'fixture-old-session',
			'fixture-old-account',
			'fixture-only-not-a-credential'
		]);
	});
});
