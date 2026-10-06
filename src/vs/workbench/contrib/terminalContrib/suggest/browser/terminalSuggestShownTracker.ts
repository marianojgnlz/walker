/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TimeoutTimer } from '../../../../../base/common/async.js';
import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';


export const TERMINAL_SUGGEST_DISCOVERABILITY_KEY = 'terminal.suggest.increasedDiscoverability';
export const TERMINAL_SUGGEST_DISCOVERABILITY_COUNT_KEY = 'terminal.suggest.increasedDiscoverabilityCount';
const TERMINAL_SUGGEST_DISCOVERABILITY_MAX_COUNT = 10;
const TERMINAL_SUGGEST_DISCOVERABILITY_MIN_MS = 10000;

interface ITerminalSuggestShownTracker extends IDisposable {
	resetState(): void;
}

export class TerminalSuggestShownTracker extends Disposable implements ITerminalSuggestShownTracker {
	private _done: boolean;
	private _count: number;
	private _timeout: TimeoutTimer | undefined;
	private _start: number | undefined;

	constructor(
		@IStorageService private readonly _storageService: IStorageService
	) {
		super();
		this._done = this._storageService.getBoolean(TERMINAL_SUGGEST_DISCOVERABILITY_KEY, StorageScope.APPLICATION, false);
		this._count = this._storageService.getNumber(TERMINAL_SUGGEST_DISCOVERABILITY_COUNT_KEY, StorageScope.APPLICATION, 0);
	}

	get done(): boolean {
		return this._done;
	}

	resetState(): void {
		this._done = false;
		this._count = 0;
		this._start = undefined;
	}

	resetTimer(): void {
		if (this._timeout) {
			this._timeout.cancel();
			this._timeout = undefined;
		}
		this._start = undefined;
	}

	update(widgetElt: HTMLElement | undefined): void {
		if (this._done) {
			return;
		}
		this._count++;
		this._storageService.store(TERMINAL_SUGGEST_DISCOVERABILITY_COUNT_KEY, this._count, StorageScope.APPLICATION, StorageTarget.USER);
		if (widgetElt && !widgetElt.classList.contains('increased-discoverability')) {
			widgetElt.classList.add('increased-discoverability');
		}
		if (this._count >= TERMINAL_SUGGEST_DISCOVERABILITY_MAX_COUNT) {
			this._setDone(widgetElt);
		} else if (!this._start) {
			this.resetTimer();
			this._start = Date.now();
			this._timeout = this._register(new TimeoutTimer(() => {
				this._setDone(widgetElt);
			}, TERMINAL_SUGGEST_DISCOVERABILITY_MIN_MS));
		}
	}

	private _setDone(widgetElt: HTMLElement | undefined) {
		this._done = true;
		this._storageService.store(TERMINAL_SUGGEST_DISCOVERABILITY_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
		if (widgetElt) {
			widgetElt.classList.remove('increased-discoverability');
		}
		if (this._timeout) {
			this._timeout.cancel();
			this._timeout = undefined;
		}
		this._start = undefined;
	}
}
