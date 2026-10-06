/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RunOnceScheduler } from '../../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { isNumber } from '../../../../../base/common/types.js';
import { localize } from '../../../../../nls.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKey, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { SpeechTimeoutDefault } from '../../../accessibility/browser/accessibilityConfiguration.js';
import { ISpeechService, AccessibilityVoiceSettingId, ISpeechToTextEvent, SpeechToTextStatus } from '../../../speech/common/speechService.js';
import type { IMarker, IDecoration } from '@xterm/xterm';
import { alert } from '../../../../../base/browser/ui/aria/aria.js';
import { addDisposableListener, EventType } from '../../../../../base/browser/dom.js';
import { getDefaultHoverDelegate } from '../../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ITerminalService } from '../../../terminal/browser/terminal.js';
import { TerminalCommandId } from '../../../terminal/common/terminal.js';
import { TerminalContextKeys } from '../../../terminal/common/terminalContextKey.js';
import { TerminalInitialHintContribution } from '../../inlineHint/browser/terminal.initialHint.contribution.js';


/**
 * Spoken-word to symbol substitutions applied to terminal dictation. Ordered so
 * that multi-word phrases (e.g. "dollar sign") are matched before their single
 * word forms (e.g. "dollar"). Terminal dictation is mostly used to compose shell
 * commands, so punctuation names map to the literal characters a CLI expects.
 */
const symbolMap: [spoken: string, symbol: string][] = [
	['dollar sign', '$'],
	['double quote', '"'],
	['open paren', '('],
	['close paren', ')'],
	['open parenthesis', '('],
	['close parenthesis', ')'],
	['open bracket', '['],
	['close bracket', ']'],
	['open brace', '{'],
	['close brace', '}'],
	['open angle bracket', '<'],
	['close angle bracket', '>'],
	['greater than', '>'],
	['less than', '<'],
	['ampersand', '&'],
	['dollar', '$'],
	['percent', '%'],
	['asterisk', '*'],
	['star', '*'],
	['plus', '+'],
	['equals', '='],
	['exclamation', '!'],
	['forward slash', '/'],
	['slash', '/'],
	['backslash', '\\'],
	['pipe', '|'],
	['tilde', '~'],
	['caret', '^'],
	['at sign', '@'],
	['hashtag', '#'],
	['pound', '#'],
	['hash', '#'],
	['colon', ':'],
	['semicolon', ';'],
	['underscore', '_'],
	['hyphen', '-'],
	['dash', '-'],
	['dot', '.'],
	['period', '.'],
	['quote', '\''],
];

/** Applies terminal-specific normalization to dictated text. */
export function postProcessTerminalDictation(text: string): string {
	let input = text.replaceAll(/[.,?;!]/g, '');
	for (const [spoken, symbol] of symbolMap) {
		input = input.replace(new RegExp('\\b' + spoken + '\\b', 'gi'), symbol);
	}
	// Speech transcription capitalizes the first word of an utterance, which is
	// unexpected for shell commands (e.g. `Echo` instead of `echo`).
	input = input.replace(/^(\s*)([A-Z])/, (_, leading: string, letter: string) => leading + letter.toLowerCase());
	return input;
}

export class TerminalVoiceSession extends Disposable {
	private _input: string = '';
	private _ghostText: IDecoration | undefined;
	private _decoration: IDecoration | undefined;
	private _marker: IMarker | undefined;
	private _ghostTextMarker: IMarker | undefined;
	private static _instance: TerminalVoiceSession | undefined = undefined;
	private _acceptTranscriptionScheduler: RunOnceScheduler | undefined;
	private readonly _terminalDictationInProgress: IContextKey<boolean>;
	private _sessionTerminalInstanceId: number | undefined;
	static getInstance(instantiationService: IInstantiationService): TerminalVoiceSession {
		if (!TerminalVoiceSession._instance) {
			TerminalVoiceSession._instance = instantiationService.createInstance(TerminalVoiceSession);
		}

		return TerminalVoiceSession._instance;
	}
	private _cancellationTokenSource: CancellationTokenSource | undefined;
	private readonly _disposables: DisposableStore;
	private readonly _decorationDisposables: DisposableStore;
	constructor(
		@ISpeechService private readonly _speechService: ISpeechService,
		@ITerminalService private readonly _terminalService: ITerminalService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IHoverService private readonly _hoverService: IHoverService,
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
	) {
		super();
		this._disposables = this._register(new DisposableStore());
		this._decorationDisposables = this._register(new DisposableStore());
		this._terminalDictationInProgress = TerminalContextKeys.terminalDictationInProgress.bindTo(contextKeyService);
	}

	async start(): Promise<void> {
		this.stop();
		const activeInstance = this._terminalService.activeInstance;
		this._sessionTerminalInstanceId = activeInstance?.instanceId;
		this._disposables.add(this._terminalService.onDidChangeActiveInstance(instance => {
			if (instance?.instanceId !== this._sessionTerminalInstanceId) {
				this.stop();
			}
		}));
		this._disposables.add(this._terminalService.onDidDisposeInstance(instance => {
			if (instance.instanceId === this._sessionTerminalInstanceId) {
				this.stop();
			}
		}));
		if (activeInstance) {
			TerminalInitialHintContribution.get(activeInstance)?.dispose();
		}
		let voiceTimeout = this._configurationService.getValue<number>(AccessibilityVoiceSettingId.SpeechTimeout);
		if (!isNumber(voiceTimeout) || voiceTimeout < 0) {
			voiceTimeout = SpeechTimeoutDefault;
		}
		this._acceptTranscriptionScheduler = this._disposables.add(new RunOnceScheduler(() => {
			this._sendText();
			this.stop();
		}, voiceTimeout));
		this._cancellationTokenSource = new CancellationTokenSource();
		this._register(toDisposable(() => this._cancellationTokenSource?.dispose(true)));

		const session = await this._speechService.createSpeechToTextSession(this._cancellationTokenSource?.token, 'terminal');

		this._disposables.add(session.onDidChange((e) => {
			if (this._cancellationTokenSource?.token.isCancellationRequested) {
				return;
			}
			switch (e.status) {
				case SpeechToTextStatus.Started:
					this._terminalDictationInProgress.set(true);
					if (!this._decoration) {
						this._createDecoration();
					}
					break;
				case SpeechToTextStatus.Recognizing: {
					this._updateInput(e);
					this._renderGhostText(e);
					this._updateDecoration();
					if (voiceTimeout > 0) {
						this._acceptTranscriptionScheduler!.cancel();
					}
					break;
				}
				case SpeechToTextStatus.Recognized:
					this._updateInput(e);
					// Send text immediately like editor dictation
					this._sendText();
					// Clear ghost text and input for next recognition
					this._ghostText?.dispose();
					this._ghostText = undefined;
					this._ghostTextMarker?.dispose();
					this._ghostTextMarker = undefined;
					// Update decoration position for next recognition
					this._updateDecoration();
					this._input = '';
					break;
				case SpeechToTextStatus.Stopped:
					this.stop();
					break;
			}
		}));
	}

	stop(send?: boolean): void {
		this._setInactive();
		if (send) {
			this._acceptTranscriptionScheduler!.cancel();
			this._sendText();
		}
		this._ghostText = undefined;
		this._decoration?.dispose();
		this._decoration = undefined;
		this._marker?.dispose();
		this._marker = undefined;
		this._ghostTextMarker = undefined;
		this._cancellationTokenSource?.cancel();
		this._disposables.clear();
		this._input = '';
		this._terminalDictationInProgress.reset();
		this._sessionTerminalInstanceId = undefined;
	}

	private _sendText(): void {
		this._terminalService.activeInstance?.sendText(this._input, false);
		alert(localize('terminalVoiceTextInserted', '{0} inserted', this._input));
	}

	private _updateInput(e: ISpeechToTextEvent): void {
		if (e.text) {
			this._input = ' ' + postProcessTerminalDictation(e.text);
		}
	}

	private _createDecoration(): void {
		const activeInstance = this._terminalService.activeInstance;
		const xterm = activeInstance?.xterm?.raw;
		if (!xterm) {
			return;
		}
		const onFirstLine = xterm.buffer.active.cursorY === 0;

		// Calculate x position based on current cursor position and input length
		const inputLength = this._input.length;
		const xPosition = xterm.buffer.active.cursorX + inputLength;

		this._marker = activeInstance.registerMarker(onFirstLine ? 0 : -1);
		if (!this._marker) {
			return;
		}
		this._decoration = xterm.registerDecoration({
			marker: this._marker,
			layer: 'top',
			x: xPosition,
		});
		if (!this._decoration) {
			this._marker.dispose();
			this._marker = undefined;
			return;
		}
		this._decoration.onRender((e: HTMLElement) => {
			e.classList.add(...ThemeIcon.asClassNameArray(Codicon.micFilled), 'terminal-voice', 'recording');
			e.style.transform = onFirstLine ? 'translate(10px, -2px)' : 'translate(-6px, -5px)';
			this._registerMicInteractions(e);
		});
	}

	/**
	 * Make the recording mic icon a discoverable Stop affordance: clicking it
	 * stops (and accepts) dictation, mirroring the editor's control. A hover also
	 * surfaces the Escape keybinding so the stop gesture is not hidden.
	 */
	private _registerMicInteractions(element: HTMLElement): void {
		// The decoration's onRender can fire multiple times for the same element
		// (e.g. on scroll/resize); only wire up the listeners once.
		if (element.dataset.terminalVoiceInteractive) {
			return;
		}
		element.dataset.terminalVoiceInteractive = 'true';
		element.style.cursor = 'pointer';
		this._decorationDisposables.add(addDisposableListener(element, EventType.CLICK, e => {
			e.preventDefault();
			e.stopPropagation();
			this.stop(true);
		}));
		const keybindingLabel = this._keybindingService.lookupKeybinding(TerminalCommandId.StopVoice)?.getLabel();
		const title = keybindingLabel
			? localize('terminalVoice.stopDictationHover', "Stop Dictation ({0})", keybindingLabel)
			: localize('terminalVoice.stopDictationHoverNoKeybinding', "Stop Dictation");
		this._decorationDisposables.add(this._hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), element, title));
	}

	private _updateDecoration(): void {
		// Dispose the old decoration and its interaction listeners before recreating
		this._decorationDisposables.clear();
		this._decoration?.dispose();
		this._marker?.dispose();
		this._decoration = undefined;
		this._marker = undefined;
		this._createDecoration();
	}

	private _setInactive(): void {
		this._decoration?.element?.classList.remove('recording');
	}

	private _renderGhostText(e: ISpeechToTextEvent): void {
		this._renderGhostTextContent(e.text, 'terminal-voice-progress-text');
	}

	private _renderGhostTextContent(text: string | undefined, className: string): void {
		this._ghostText?.dispose();
		if (!text) {
			return;
		}
		const activeInstance = this._terminalService.activeInstance;
		const xterm = activeInstance?.xterm?.raw;
		if (!xterm) {
			return;
		}
		this._ghostTextMarker = activeInstance.registerMarker();
		if (!this._ghostTextMarker) {
			return;
		}
		this._disposables.add(this._ghostTextMarker);
		const onFirstLine = xterm.buffer.active.cursorY === 0;
		this._ghostText = xterm.registerDecoration({
			marker: this._ghostTextMarker,
			layer: 'top',
			x: onFirstLine ? xterm.buffer.active.cursorX + 4 : xterm.buffer.active.cursorX + 1,
		});
		if (this._ghostText) {
			this._disposables.add(this._ghostText);
		}
		this._ghostText?.onRender((e: HTMLElement) => {
			e.classList.add(className);
			e.textContent = text;
			e.style.width = (xterm.cols - xterm.buffer.active.cursorX) / xterm.cols * 100 + '%';
		});
	}
}
