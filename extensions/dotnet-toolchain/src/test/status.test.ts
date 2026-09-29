/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { DOTNET_TOOLCHAIN_COMMANDS, DOTNET_TOOLCHAIN_STATES, type DotnetToolchainState, type IDotnetToolchainSnapshot } from '../contracts';
import { createDotnetStatusController, DEFAULT_DOTNET_STATUS_REFRESH_MS, type IDotnetStatusController } from '../status';
import {
	createDeferred,
	createDotnetHostHarness,
	createStateSourceHarness,
	dotnetSnapshot,
	type IDotnetHostHarness,
	type IStateSourceHarness,
} from './hostFixtures';

interface IPresenterHarness {
	readonly host: IDotnetHostHarness;
	readonly source: IStateSourceHarness;
	readonly status: IDotnetStatusController;
}

function createPresenter(initial: IDotnetToolchainSnapshot = dotnetSnapshot('checking')): IPresenterHarness {
	const host = createDotnetHostHarness();
	const source = createStateSourceHarness(initial);
	const status = createDotnetStatusController({ host, source });
	return { host, source, status };
}

/** Resolves pending promise continuations without relying on real time. */
async function flush(): Promise<void> {
	for (let index = 0; index < 4; index++) {
		await new Promise<void>(resolve => setImmediate(resolve));
	}
}

function assertLocalized(value: string | undefined, label: string): string {
	assert.ok(value !== undefined && value.startsWith('«') && value.endsWith('»'), `${label} must be localized: ${JSON.stringify(value)}`);
	return value;
}

function liveIntervals(host: IDotnetHostHarness): number {
	return host.intervals.filter(interval => !interval.disposed).length;
}

function tooltipOf(host: IDotnetHostHarness): string {
	return (host.statusItem.tooltipLines ?? []).join('\n');
}

suite('dotnet status presentation', () => {
	test('presents every declared state with a localized label, tooltip and the actions command', () => {
		const verified = { executable: '/home/test/.walker/dotnet/dotnet', sdkVersion: '10.0.401' };
		const cases: readonly { readonly state: DotnetToolchainState; readonly label: string; readonly snapshot: IDotnetToolchainSnapshot }[] = [
			{ state: 'checking', label: '$(sync~spin) .NET SDK: Checking…', snapshot: dotnetSnapshot('checking') },
			{ state: 'ready', label: '$(check) .NET SDK {0}', snapshot: dotnetSnapshot('ready', { verified }) },
			{ state: 'runtimeOnly', label: '$(warning) .NET SDK: Runtime Only', snapshot: dotnetSnapshot('runtimeOnly') },
			{ state: 'missing', label: '$(circle-slash) .NET SDK: Not Installed', snapshot: dotnetSnapshot('missing') },
			{ state: 'installing', label: '$(sync~spin) .NET SDK: Installing…', snapshot: dotnetSnapshot('installing', { progress: { phase: 'downloading', otherWindow: false } }) },
			{ state: 'verifying', label: '$(sync~spin) .NET SDK: Verifying…', snapshot: dotnetSnapshot('verifying', { progress: { phase: 'finalizing', otherWindow: false } }) },
			{ state: 'failed', label: '$(error) .NET SDK: Setup Failed', snapshot: dotnetSnapshot('failed', { failure: { stage: 'detect', code: 'inventory-error' } }) },
			{ state: 'unavailable', label: '$(circle-slash) .NET SDK: Unavailable Here', snapshot: dotnetSnapshot('unavailable') },
		];
		assert.deepStrictEqual(cases.map(entry => entry.state), [...DOTNET_TOOLCHAIN_STATES], 'every declared state must be covered');
		for (const entry of cases) {
			const { host, status } = createPresenter(entry.snapshot);
			status.update(entry.snapshot);
			try {
				assert.ok(host.localizer.messages.includes(entry.label), `${entry.state} must localize its label`);
				assert.strictEqual(host.statusItem.text, `«${entry.label.replace('{0}', entry.snapshot.verified?.sdkVersion ?? '')}»`);
				assert.strictEqual(host.statusItem.command, DOTNET_TOOLCHAIN_COMMANDS.showActions, `${entry.state} must expose the actions command`);
				assert.strictEqual(host.statusItem.shown, 1, `${entry.state} must show the status item`);
				assert.ok(host.statusItem.tooltipLines !== undefined && host.statusItem.tooltipLines.length > 0, `${entry.state} must have a tooltip`);
				for (const line of host.statusItem.tooltipLines) {
					assertLocalized(line, `${entry.state} tooltip line`);
				}
			} finally {
				status.dispose();
			}
		}
	});

	test('identifies version, executable and failure code in tooltips', () => {
		const verified = { executable: '/home/test/.walker/dotnet/dotnet', sdkVersion: '10.0.401' };
		const ready = createPresenter(dotnetSnapshot('ready', { verified }));
		ready.status.update(ready.source.getSnapshot());
		const readyTooltip = tooltipOf(ready.host);
		assert.ok(readyTooltip.includes('10.0.401'), 'ready tooltip must include the verified SDK version');
		assert.ok(readyTooltip.includes('/home/test/.walker/dotnet/dotnet'), 'ready tooltip must include the executable');
		ready.status.dispose();

		const failed = createPresenter(dotnetSnapshot('failed', { failure: { stage: 'recovery', code: 'metadata-missing' } }));
		failed.status.update(failed.source.getSnapshot());
		const failedTooltip = tooltipOf(failed.host);
		assert.ok(failedTooltip.includes('metadata-missing'), 'failure tooltip must include the stable diagnostic code');
		assert.ok(failedTooltip.includes('recovery'), 'failure tooltip must identify the recovery stage');
		failed.status.dispose();
	});

	test('logs one localized line per revision and never re-logs unchanged snapshots', () => {
		const { host, source, status } = createPresenter();
		status.update(dotnetSnapshot('checking', { revision: 0 }));
		status.update(dotnetSnapshot('checking', { revision: 0 }));
		assert.strictEqual(host.output.lines.length, 1, 'an unchanged revision must not be logged twice');
		assertLocalized(host.output.lines[0], 'checking line');
		source.setSnapshot(dotnetSnapshot('missing', { revision: 1 }));
		status.update(source.getSnapshot());
		assert.strictEqual(host.output.lines.length, 2);
		assertLocalized(host.output.lines[1], 'missing line');
		assert.ok(host.localizer.messages.includes('No local .NET SDK was found.'));
		status.dispose();
	});

	test('offers only applicable actions per state', async () => {
		const expected: readonly { readonly state: DotnetToolchainState; readonly actions: readonly string[] }[] = [
			{ state: 'ready', actions: ['setup', 'recheck', 'showOutput'] },
			{ state: 'runtimeOnly', actions: ['setup', 'recheck', 'showOutput'] },
			{ state: 'missing', actions: ['setup', 'recheck', 'showOutput'] },
			{ state: 'failed', actions: ['setup', 'recheck', 'showOutput'] },
			{ state: 'checking', actions: ['showOutput'] },
			{ state: 'installing', actions: ['showOutput'] },
			{ state: 'verifying', actions: ['showOutput'] },
			{ state: 'unavailable', actions: ['showOutput'] },
		];
		for (const entry of expected) {
			const { host, status } = createPresenter(dotnetSnapshot(entry.state));
			await status.showActions();
			const call = host.quickPicks.at(-1);
			assert.ok(call !== undefined, `${entry.state} must open the actions menu`);
			assert.deepStrictEqual(call.items.map(item => item.id), [...entry.actions], `${entry.state} action list`);
			assertLocalized(call.placeHolder, `${entry.state} actions placeholder`);
			for (const item of call.items) {
				assertLocalized(item.label, `${entry.state} action label`);
			}
			status.dispose();
		}
	});

	test('runs the chosen action and ignores a dismissed menu', async () => {
		const { host, source, status } = createPresenter(dotnetSnapshot('missing'));

		await status.showActions();
		assert.strictEqual(source.setupRequests.length, 0, 'dismissing the menu must not run an action');
		assert.strictEqual(source.recheckCalls, 0);
		assert.strictEqual(host.output.shown, 0);

		host.queueQuickPick({ id: 'showOutput', label: 'queued' });
		await status.showActions();
		assert.strictEqual(host.output.shown, 1, 'the output action must reveal the channel');

		source.setSnapshot(dotnetSnapshot('ready', { revision: 2, verified: { executable: '/usr/share/dotnet/dotnet', sdkVersion: '9.0.100' } }));
		host.queueQuickPick({ id: 'recheck', label: 'queued' });
		await status.showActions();
		assert.strictEqual(source.recheckCalls, 1, 'the recheck action must re-detect');
		assert.ok(host.statusItem.text.includes('9.0.100'), 'recheck must refresh the status item');

		host.queueQuickPick({ id: 'setup', label: 'queued' });
		await status.showActions();
		assert.strictEqual(source.setupRequests.length, 1, 'the setup action must run the explicit chooser flow');
		assert.strictEqual(host.progressCalls.length, 1, 'setup must run under a progress notification');
		status.dispose();
	});

	test('refreshes another window\'s busy operation until the lock clears', async () => {
		const { host, source, status } = createPresenter();
		const busy = dotnetSnapshot('installing', { revision: 3, progress: { phase: 'installing', otherWindow: true } });
		source.setSnapshot(busy);
		source.setRecheck(async () => busy);
		status.update(busy);
		assert.strictEqual(liveIntervals(host), 1, 'a busy other-window status must arm one refresh interval');
		assert.strictEqual(host.statusItem.text, '«$(sync~spin) .NET SDK: Installing in another window…»');

		host.fireIntervals();
		await flush();
		assert.strictEqual(source.recheckCalls, 1, 'the refresh must re-read state instead of writing');

		const terminal = dotnetSnapshot('missing', { revision: 4 });
		source.setRecheck(async () => terminal);
		host.fireIntervals();
		await flush();
		assert.strictEqual(liveIntervals(host), 0, 'the refresh must stop once the foreign operation clears');
		assert.strictEqual(host.statusItem.text, '«$(circle-slash) .NET SDK: Not Installed»');

		status.update(dotnetSnapshot('installing', { revision: 5, progress: { phase: 'installing', otherWindow: false } }));
		assert.strictEqual(liveIntervals(host), 0, 'an owned operation must not arm the foreign refresh');
		status.dispose();
	});

	test('reports localized progress phases and forwards cancellation truthfully', async () => {
		const { host, source, status } = createPresenter();
		const deferred = createDeferred<IDotnetToolchainSnapshot>();
		const requesting = dotnetSnapshot('installing', { revision: 1, progress: { phase: 'installing', otherWindow: false } });
		const verifying = dotnetSnapshot('verifying', { revision: 2, progress: { phase: 'verifying', otherWindow: false } });
		source.setSnapshot(requesting);
		source.setSetup(async () => await deferred.promise);

		const running = status.runSetup();
		await flush();
		assert.strictEqual(host.progressCalls.length, 1);
		assert.strictEqual(host.progressCalls[0].title, '«Setting Up the Local .NET SDK»', 'the progress title must be localized');
		const request = source.setupRequests[0];
		assert.ok(request?.cancellation !== undefined, 'setup must receive a cancellation token');
		assert.strictEqual(request.cancellation.isCancellationRequested, false);

		source.setSnapshot(verifying);
		host.fireIntervals();
		assert.ok(host.progressCalls[0].messages.includes('«Verifying the local .NET SDK…»'), 'the progress message must follow the controller snapshot');
		assert.strictEqual(host.statusItem.text, '«$(sync~spin) .NET SDK: Verifying…»');

		host.progressCalls[0].token.cancel();
		assert.strictEqual(request.cancellation.isCancellationRequested, true, 'progress cancellation must reach the controller');

		const canceled = dotnetSnapshot('missing', { revision: 3 });
		source.setSnapshot(canceled);
		deferred.resolve(canceled);
		const terminal = await running;
		assert.deepStrictEqual(terminal, canceled, 'the presenter must return the controller terminal snapshot');
		assert.strictEqual(host.statusItem.text, '«$(circle-slash) .NET SDK: Not Installed»', 'cancellation must never be presented as success');
		assert.strictEqual(liveIntervals(host), 0, 'the operation interval must be disposed');
		status.dispose();
	});

	test('owns and disposes the status item, output channel and timers immediately', () => {
		const { host, source, status } = createPresenter();
		status.update(dotnetSnapshot('installing', { revision: 1, progress: { phase: 'installing', otherWindow: true } }));
		assert.strictEqual(liveIntervals(host), 1);
		status.appendOutput('[detect] inventory-error');
		status.showError('plain error');
		assert.deepStrictEqual([...host.output.lines].filter(line => line === '[detect] inventory-error'), ['[detect] inventory-error']);
		assert.deepStrictEqual([...host.errors], ['plain error']);
		status.dispose();
		status.dispose();
		assert.strictEqual(liveIntervals(host), 0, 'disposal must clear the refresh interval');
		assert.strictEqual(host.statusItem.disposed, true);
		assert.strictEqual(host.output.disposed, true);
		const before = host.statusItem.text;
		status.update(dotnetSnapshot('ready', { revision: 9, verified: { executable: '/usr/share/dotnet/dotnet', sdkVersion: '9.0.100' } }));
		assert.strictEqual(host.statusItem.text, before, 'updates after disposal must be ignored');
		assert.strictEqual(source.disposeCalls, 0, 'the presenter must not own the controller lifecycle');
	});

	test('keeps the default refresh period at one second', () => {
		assert.strictEqual(DEFAULT_DOTNET_STATUS_REFRESH_MS, 1000);
		const { host, status } = createPresenter();
		status.update(dotnetSnapshot('installing', { revision: 1, progress: { phase: 'installing', otherWindow: true } }));
		assert.strictEqual(host.intervals[0].intervalMs, DEFAULT_DOTNET_STATUS_REFRESH_MS);
		status.dispose();
	});
});
