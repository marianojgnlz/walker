/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EventType, addDisposableListener } from '../../../../base/browser/dom.js';
import { Disposable, IDisposable, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { DOTNET_TOOLCHAIN_COMMANDS, isDotnetToolchainSnapshot, type IDotnetToolchainSnapshot } from '../common/dotnetToolchain.js';

/** Elements owned by the currently visible onboarding toolchain step. */
export interface IDotnetToolchainStepElements {
	readonly status: HTMLElement;
	readonly details: HTMLElement;
	readonly setup: HTMLButtonElement;
	readonly recheck: HTMLButtonElement;
	readonly output: HTMLButtonElement;
}

/** Timer seam keeps polling and read-timeout behavior deterministic in browser tests. */
export interface IDotnetToolchainStepScheduler {
	schedule(callback: () => void, delayMs: number): IDisposable;
}

/** Optional timing overrides used by focused client tests. */
export interface IDotnetToolchainStepOptions {
	readonly scheduler?: IDotnetToolchainStepScheduler;
	readonly pollIntervalMs?: number;
	readonly stateReadTimeoutMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_STATE_READ_TIMEOUT_MS = 5000;

const defaultScheduler: IDotnetToolchainStepScheduler = {
	schedule: (callback, delayMs) => {
		const handle = setTimeout(callback, delayMs);
		return toDisposable(() => clearTimeout(handle));
	},
};

/** Local command client and presenter for the visible .NET toolchain onboarding step. */
export class DotnetToolchainStep extends Disposable {
	private readonly pollTimer = this._register(new MutableDisposable<IDisposable>());
	private readonly stateReadTimer = this._register(new MutableDisposable<IDisposable>());
	private readonly scheduler: IDotnetToolchainStepScheduler;
	private readonly pollIntervalMs: number;
	private readonly stateReadTimeoutMs: number;
	private snapshot: IDotnetToolchainSnapshot | undefined;
	private latestRevision = -1;
	private readGeneration = 0;
	private setupGeneration = 0;
	private recheckGeneration = 0;
	private readInFlight = false;
	private readQueued = false;
	private setupInFlight = false;
	private recheckInFlight = false;
	private hasResolvedState = false;
	private disposed = false;

	constructor(
		private readonly commandService: ICommandService,
		private readonly elements: IDotnetToolchainStepElements,
		options: IDotnetToolchainStepOptions = {},
	) {
		super();
		this.scheduler = options.scheduler ?? defaultScheduler;
		this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
		this.stateReadTimeoutMs = options.stateReadTimeoutMs ?? DEFAULT_STATE_READ_TIMEOUT_MS;
		this.elements.status.setAttribute('role', 'status');
		this.elements.status.setAttribute('aria-live', 'polite');
		this.elements.status.setAttribute('aria-atomic', 'true');
		this.elements.setup.textContent = localize('onboarding.toolchain.setup', "Set Up");
		this.elements.recheck.textContent = localize('onboarding.toolchain.recheck', "Recheck");
		this.elements.output.textContent = localize('onboarding.toolchain.showOutput', "Show Output");
		this._register(addDisposableListener(this.elements.setup, EventType.CLICK, () => this._runAction(DOTNET_TOOLCHAIN_COMMANDS.setup)));
		this._register(addDisposableListener(this.elements.recheck, EventType.CLICK, () => this._runAction(DOTNET_TOOLCHAIN_COMMANDS.recheck)));
		this._register(addDisposableListener(this.elements.output, EventType.CLICK, () => this._runOutputAction()));
		this._render();
		this._requestState();
		this._schedulePoll();
	}

	private _schedulePoll(): void {
		this.pollTimer.value = this.scheduler.schedule(() => {
			this.pollTimer.clear();
			if (this.disposed) {
				return;
			}
			this._requestState();
			this._schedulePoll();
		}, this.pollIntervalMs);
	}

	private _requestState(): void {
		if (this.disposed) {
			return;
		}
		if (this.readInFlight) {
			this.readQueued = true;
			return;
		}
		const generation = ++this.readGeneration;
		this.readInFlight = true;
		this.stateReadTimer.value = this.scheduler.schedule(() => {
			if (this.disposed || generation !== this.readGeneration) {
				return;
			}
			this.readGeneration++;
			this.readInFlight = false;
			this.stateReadTimer.clear();
			this._showUnavailable();
			if (this.readQueued) {
				this.readQueued = false;
				this._requestState();
			}
		}, this.stateReadTimeoutMs);
		void this._readState(generation);
	}

	private async _readState(generation: number): Promise<void> {
		try {
			const value = await this.commandService.executeCommand<unknown>(DOTNET_TOOLCHAIN_COMMANDS.getState);
			if (!this.disposed && generation === this.readGeneration) {
				this._acceptSnapshot(value);
			}
		} catch {
			if (!this.disposed && generation === this.readGeneration) {
				this._showUnavailable();
			}
		} finally {
			if (!this.disposed && generation === this.readGeneration) {
				this.stateReadTimer.clear();
				this.readInFlight = false;
				if (this.readQueued) {
					this.readQueued = false;
					this._requestState();
				}
			}
		}
	}

	private _acceptSnapshot(value: unknown): void {
		if (!isDotnetToolchainSnapshot(value)) {
			this._showUnavailable();
			return;
		}
		if (value.revision < this.latestRevision) {
			return;
		}
		this.latestRevision = value.revision;
		this.hasResolvedState = true;
		this.snapshot = value;
		this._render();
	}

	private _showUnavailable(): void {
		this.hasResolvedState = true;
		this.latestRevision = -1;
		this.snapshot = undefined;
		this._render();
	}

	private _render(): void {
		const snapshot = this.snapshot;
		const state = snapshot?.state ?? (this.hasResolvedState ? 'unavailable' : 'checking');
		if (!snapshot && !this.hasResolvedState) {
			this.elements.status.textContent = localize('onboarding.toolchain.checking', "Checking for a .NET SDK…");
			this.elements.details.textContent = '';
		} else if (!snapshot) {
			this.elements.status.textContent = localize('onboarding.toolchain.unavailable', "Local .NET setup is unavailable. Retry or continue without setup.");
			this.elements.details.textContent = '';
		} else {
			switch (snapshot.state) {
				case 'checking':
					this.elements.status.textContent = localize('onboarding.toolchain.checking', "Checking for a .NET SDK…");
					break;
				case 'ready':
					this.elements.status.textContent = localize('onboarding.toolchain.ready', "SDK ready — {0}", snapshot.verified!.sdkVersion);
					break;
				case 'runtimeOnly':
					this.elements.status.textContent = localize('onboarding.toolchain.runtimeOnly', "A .NET runtime was found; an SDK is needed.");
					break;
				case 'missing':
					this.elements.status.textContent = localize('onboarding.toolchain.missing', "No .NET SDK found.");
					break;
				case 'installing':
					this.elements.status.textContent = localize('onboarding.toolchain.installing', "Installing .NET SDK…");
					break;
				case 'verifying':
					this.elements.status.textContent = localize('onboarding.toolchain.verifying', "Verifying .NET SDK…");
					break;
				case 'failed':
					this.elements.status.textContent = localize('onboarding.toolchain.failed', "Setup failed. Review toolchain output and retry.");
					break;
				case 'unavailable':
					this.elements.status.textContent = localize('onboarding.toolchain.unavailable', "Local .NET setup is unavailable. Retry or continue without setup.");
					break;
			}
			if (snapshot.state === 'ready') {
				this.elements.details.textContent = snapshot.verified!.executable;
				this.elements.details.title = snapshot.verified!.executable;
			} else if (snapshot.progress?.otherWindow) {
				this.elements.details.textContent = localize('onboarding.toolchain.otherWindow', "Setup is active in another Walker window.");
				this.elements.details.title = '';
			} else if (snapshot.state === 'failed') {
				this.elements.details.textContent = localize('onboarding.toolchain.failureDetails', "Open Show Output for diagnostic details.");
				this.elements.details.title = '';
			} else {
				this.elements.details.textContent = '';
				this.elements.details.title = '';
			}
		}
		const busy = state === 'checking' || state === 'installing' || state === 'verifying';
		this.elements.status.setAttribute('aria-busy', busy ? 'true' : 'false');
		this.elements.setup.setAttribute('aria-disabled', busy || state === 'unavailable' || this.setupInFlight ? 'true' : 'false');
		this.elements.recheck.textContent = state === 'unavailable'
			? localize('onboarding.toolchain.retry', "Retry")
			: localize('onboarding.toolchain.recheck', "Recheck");
		this.elements.recheck.setAttribute('aria-disabled', this.recheckInFlight ? 'true' : 'false');
	}

	private _runAction(commandId: string): void {
		const isSetup = commandId === DOTNET_TOOLCHAIN_COMMANDS.setup;
		const state = this.snapshot?.state ?? (this.hasResolvedState ? 'unavailable' : 'checking');
		if (this.disposed || (isSetup && (this.setupInFlight || state === 'checking' || state === 'installing' || state === 'verifying' || state === 'unavailable')) || (!isSetup && this.recheckInFlight)) {
			return;
		}
		const generation = isSetup ? ++this.setupGeneration : ++this.recheckGeneration;
		this.setupInFlight = isSetup || this.setupInFlight;
		this.recheckInFlight = !isSetup || this.recheckInFlight;
		this._render();
		let command: Promise<unknown>;
		try {
			command = this.commandService.executeCommand<unknown>(commandId);
		} catch {
			this._finishAction(generation, isSetup);
			this._showUnavailable();
			return;
		}
		this._requestState();
		void command.then(value => {
			if (!this.disposed && this._isCurrentAction(generation, isSetup) && value !== undefined) {
				this._acceptSnapshot(value);
			}
		}, () => {
			if (!this.disposed && this._isCurrentAction(generation, isSetup)) {
				this._showUnavailable();
			}
		}).finally(() => {
			this._finishAction(generation, isSetup);
		});
	}

	private _isCurrentAction(generation: number, isSetup: boolean): boolean {
		return generation === (isSetup ? this.setupGeneration : this.recheckGeneration);
	}

	private _finishAction(generation: number, isSetup: boolean): void {
		if (this.disposed || !this._isCurrentAction(generation, isSetup)) {
			return;
		}
		if (isSetup) {
			this.setupInFlight = false;
		} else {
			this.recheckInFlight = false;
		}
		this._render();
		this._requestState();
	}

	private _runOutputAction(): void {
		if (this.disposed) {
			return;
		}
		try {
			void this.commandService.executeCommand(DOTNET_TOOLCHAIN_COMMANDS.showOutput).catch(() => undefined);
		} catch {
			// Diagnostics remain optional; failure to open output does not change detected readiness.
		}
	}

	override dispose(): void {
		this.disposed = true;
		this.readGeneration++;
		this.setupGeneration++;
		this.recheckGeneration++;
		this.readInFlight = false;
		this.readQueued = false;
		this.pollTimer.clear();
		this.stateReadTimer.clear();
		super.dispose();
	}
}
