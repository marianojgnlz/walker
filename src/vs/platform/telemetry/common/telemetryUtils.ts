/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITelemetryService, TelemetryLevel } from './telemetry.js';

/**
 * A special class used to denoting a telemetry value which should not be clean.
 * This is because that value is "Trusted" not to contain identifiable information such as paths.
 * NOTE: This is used as an API type as well, and should not be changed.
 */
export class TelemetryTrustedValue<T> {
	// This is merely used as an identifier as the instance will be lost during serialization over the exthost
	public readonly isTrustedTelemetryValue = true;
	constructor(public readonly value: T) { }
}

export class NullTelemetryServiceShape implements ITelemetryService {
	declare readonly _serviceBrand: undefined;
	readonly telemetryLevel = TelemetryLevel.NONE;
	readonly sessionId = 'someValue.sessionId';
	readonly machineId = 'someValue.machineId';
	readonly sqmId = 'someValue.sqmId';
	readonly devDeviceId = 'someValue.devDeviceId';
	readonly firstSessionDate = 'someValue.firstSessionDate';
	readonly sendErrorTelemetry = false;
	publicLog() { }
	publicLog2() { }
	publicLogError() { }
	publicLogError2() { }
	setExperimentProperty() { }
	setCommonProperty() { }
}

export const NullTelemetryService = new NullTelemetryServiceShape();

// Kept as a protected output-channel identifier; the output service filters this legacy channel.
export const telemetryLogId = 'telemetry';
