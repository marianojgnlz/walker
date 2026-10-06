/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { TelemetryLevel } from '../../../../platform/telemetry/common/telemetry.js';
import { IExtHostContext } from '../../../services/extensions/common/extHostCustomers.js';
import { MainThreadTelemetry } from '../../browser/mainThreadTelemetry.js';

interface InitializationCall {
	level: TelemetryLevel;
	supportsTelemetry: boolean;
	productConfig: { usage: boolean; error: boolean } | undefined;
}

suite('MainThreadTelemetry disabled bridge', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('initializes the extension host disabled and never raises the level', () => {
		const initializationCalls: InitializationCall[] = [];
		const levelChangeCalls: TelemetryLevel[] = [];
		const context = {
			getProxy: () => ({
				$initializeTelemetryLevel: (level: TelemetryLevel, supportsTelemetry: boolean, productConfig?: { usage: boolean; error: boolean }) => initializationCalls.push({ level, supportsTelemetry, productConfig }),
				$onDidChangeTelemetryLevel: (level: TelemetryLevel) => levelChangeCalls.push(level),
			})
		} as unknown as IExtHostContext;

		const bridge = new MainThreadTelemetry(context);
		try {
			assert.deepStrictEqual({
				initializationCalls,
				levelChangeCalls,
				capiCommandRegistered: !!CommandsRegistry.getCommand('_telemetry.setCapiAssignmentContext'),
			}, {
				initializationCalls: [{ level: TelemetryLevel.NONE, supportsTelemetry: false, productConfig: undefined }],
				levelChangeCalls: [],
				capiCommandRegistered: false,
			});
		} finally {
			bridge.dispose();
		}
	});
});
