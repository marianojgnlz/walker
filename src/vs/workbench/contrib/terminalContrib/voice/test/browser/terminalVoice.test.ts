/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IHoverService } from '../../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IKeybindingService } from '../../../../../../platform/keybinding/common/keybinding.js';
import { MockContextKeyService } from '../../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ISpeechService, ISpeechToTextEvent, SpeechToTextStatus } from '../../../../speech/common/speechService.js';
import { ITerminalContribution, ITerminalInstance, ITerminalService } from '../../../../terminal/browser/terminal.js';
import { postProcessTerminalDictation, TerminalVoiceSession } from '../../browser/terminalVoice.js';

suite('postProcessTerminalDictation', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('substitutes spoken symbols including single word forms like "dash"', () => {
		assert.strictEqual(postProcessTerminalDictation('ls dash la'), 'ls - la');
	});

	test('prefers multi-word symbol phrases over their single word forms', () => {
		assert.strictEqual(postProcessTerminalDictation('echo dollar sign path'), 'echo $ path');
	});

	test('strips sentence punctuation added by the transcriber', () => {
		assert.strictEqual(postProcessTerminalDictation('git status.'), 'git status');
	});

	test('lower-cases the capitalized first word', () => {
		assert.strictEqual(postProcessTerminalDictation('Echo hello'), 'echo hello');
	});

	test('substitutes every occurrence of a symbol name', () => {
		assert.strictEqual(postProcessTerminalDictation('a ampersand b ampersand c'), 'a & b & c');
	});
});

suite('TerminalVoiceSession', () => {
	const store = new DisposableStore();
	ensureNoDisposablesAreLeakedInTestSuite();

	let sentTexts: string[];
	let instantiationService: TestInstantiationService;
	let activeInstanceChanged: Emitter<ITerminalInstance | undefined>;

	setup(() => {
		sentTexts = [];
		instantiationService = store.add(new TestInstantiationService());
		activeInstanceChanged = store.add(new Emitter<ITerminalInstance | undefined>());
		instantiationService.stub(IConfigurationService, new TestConfigurationService());
		instantiationService.stub(IContextKeyService, new MockContextKeyService());
		instantiationService.stub(IKeybindingService, new class extends mock<IKeybindingService>() {
			override lookupKeybinding() { return undefined; }
		});
		instantiationService.stub(IHoverService, new class extends mock<IHoverService>() { });
		const activeInstance = new class extends mock<ITerminalInstance>() {
			override async sendText(text: string): Promise<void> { sentTexts.push(text); }
			override xterm = undefined;
			override registerMarker() { return undefined; }
			override getContribution<T extends ITerminalContribution>(): T | null { return null; }
		};
		instantiationService.stub(ITerminalService, new class extends mock<ITerminalService>() {
			override onDidChangeActiveInstance = activeInstanceChanged.event;
			override onDidDisposeInstance = Event.None;
			override get activeInstance() { return activeInstance as unknown as ITerminalInstance; }
		});
	});

	teardown(() => {
		const holder = TerminalVoiceSession as unknown as { _instance: TerminalVoiceSession | undefined };
		holder._instance?.dispose();
		holder._instance = undefined;
		store.clear();
	});

	test('uses the speech provider for terminal dictation without a Chat speech service', async () => {
		let providerStarts = 0;
		const speechEvents = store.add(new Emitter<ISpeechToTextEvent>());
		instantiationService.stub(ISpeechService, new class extends mock<ISpeechService>() {
			override async createSpeechToTextSession(_token: CancellationToken, context?: string) {
				providerStarts++;
				assert.strictEqual(context, 'terminal');
				return { onDidChange: speechEvents.event };
			}
		});

		const session = TerminalVoiceSession.getInstance(instantiationService as unknown as IInstantiationService);
		await session.start();
		speechEvents.fire({ status: SpeechToTextStatus.Started });
		speechEvents.fire({ status: SpeechToTextStatus.Recognized, text: 'Echo hello' });

		assert.strictEqual(providerStarts, 1);
		assert.ok(sentTexts.some(text => text.includes('echo hello')), `expected normalized dictated text to be sent, got ${JSON.stringify(sentTexts)}`);
		session.dispose();
	});
});
