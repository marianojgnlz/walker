/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { createAuthenticationApiFacade } from '../../common/extHost.api.impl.js';
import type * as vscode from 'vscode';

const unsupportedError = (error: unknown): boolean => {
	assert.ok(error instanceof Error);
	assert.strictEqual(error.name, 'AuthenticationUnsupported');
	assert.strictEqual((error as Error & { code?: string }).code, 'WALKER_AUTHENTICATION_UNSUPPORTED');
	assert.ok(error.message.length > 0);
	return true;
};

function createAuthenticationApi(): typeof vscode.authentication {
	return createAuthenticationApiFacade({
		...nullExtensionDescription,
		enabledApiProposals: ['authSession', 'authIssuers', 'authLearnMore']
	});
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
