/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../../nls.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { HasSpeechProvider, SpeechToTextInProgress } from '../../../speech/common/speechService.js';
import { registerActiveInstanceAction, sharedWhenClause } from '../../../terminal/browser/terminalActions.js';
import { TerminalCommandId } from '../../../terminal/common/terminal.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
import { TerminalVoiceSession } from './terminalVoice.js';

const VOICE_CATEGORY = localize2('voiceCategory', "Voice");

export function registerTerminalVoiceActions() {
	registerActiveInstanceAction({
		id: TerminalCommandId.StartVoice,
		title: localize2('workbench.action.terminal.startDictation', "Start Dictation in Terminal"),
		category: VOICE_CATEGORY,
		precondition: ContextKeyExpr.and(
			HasSpeechProvider,
			// Keep the toggle available for terminal dictation, but not unrelated speech-to-text sessions.
			ContextKeyExpr.or(SpeechToTextInProgress.toNegated(), TerminalContextKeys.terminalDictationInProgress),
			sharedWhenClause.terminalAvailable
		),
		f1: true,
		icon: Codicon.mic,
		run: async (activeInstance, c, accessor) => {
			const contextKeyService = accessor.get(IContextKeyService);
			// Toggle: invoking the command again while dictation is in progress stops and accepts it.
			if (TerminalContextKeys.terminalDictationInProgress.getValue(contextKeyService)) {
				TerminalVoiceSession.getInstance(accessor.get(IInstantiationService)).stop(true);
				return;
			}
			if (!HasSpeechProvider.getValue(contextKeyService)) {
				return;
			}
			await TerminalVoiceSession.getInstance(accessor.get(IInstantiationService)).start();
		},
	});

	registerActiveInstanceAction({
		id: TerminalCommandId.StopVoice,
		title: localize2('workbench.action.terminal.stopDictation', "Stop Dictation in Terminal"),
		category: VOICE_CATEGORY,
		precondition: TerminalContextKeys.terminalDictationInProgress,
		f1: true,
		run: (activeInstance, c, accessor) => {
			const instantiationService = accessor.get(IInstantiationService);
			TerminalVoiceSession.getInstance(instantiationService).stop(true);
		}
	});
}
