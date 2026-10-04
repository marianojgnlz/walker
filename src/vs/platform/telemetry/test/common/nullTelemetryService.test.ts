/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ITelemetryService, TelemetryLevel } from '../../common/telemetry.js';
import { NullTelemetryService } from '../../common/telemetryUtils.js';

suite('NullTelemetryService', () => {
	test('exposes disabled compatibility values and ignores reporting calls', () => {
		const telemetryService: ITelemetryService = NullTelemetryService;
		telemetryService.publicLog('fixture.event');
		telemetryService.publicLog2('fixture.event');
		telemetryService.publicLogError('fixture.error');
		telemetryService.publicLogError2('fixture.error');
		telemetryService.setCommonProperty('fixture', 'only');
		telemetryService.setExperimentProperty('fixture', 'only');

		assert.deepStrictEqual({
			serviceIsObject: typeof NullTelemetryService === 'object',
			level: NullTelemetryService.telemetryLevel,
			sendErrorTelemetry: NullTelemetryService.sendErrorTelemetry,
			identifiers: [NullTelemetryService.sessionId, NullTelemetryService.machineId, NullTelemetryService.sqmId, NullTelemetryService.devDeviceId, NullTelemetryService.firstSessionDate],
		}, {
			serviceIsObject: true,
			level: TelemetryLevel.NONE,
			sendErrorTelemetry: false,
			identifiers: ['someValue.sessionId', 'someValue.machineId', 'someValue.sqmId', 'someValue.devDeviceId', 'someValue.firstSessionDate'],
		});
	});
});
