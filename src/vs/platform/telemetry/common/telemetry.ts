/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ClassifiedEvent, IGDPRProperty, OmitMetadata, StrictPropertyCheck } from './gdprTypings.js';

export const ITelemetryService = createDecorator<ITelemetryService>('telemetryService');

export interface ITelemetryData {
	from?: string;
	target?: string;
	[key: string]: string | unknown | undefined;
}

export interface ITelemetryService {

	readonly _serviceBrand: undefined;

	readonly telemetryLevel: TelemetryLevel;

	readonly sessionId: string;
	readonly machineId: string;
	readonly sqmId: string;
	readonly devDeviceId: string;
	readonly firstSessionDate: string;
	readonly msftInternal?: boolean;

	/**
	 * Whether error telemetry will get sent. If false, `publicLogError` will no-op.
	 */
	readonly sendErrorTelemetry: boolean;

	/**
	 * @deprecated Use publicLog2 and the typescript GDPR annotation where possible
	 */
	publicLog(eventName: string, data?: ITelemetryData): void;

	/**
	 * Sends a telemetry event that has been privacy approved.
	 * Do not call this unless you have been given approval.
	 */
	publicLog2<E extends ClassifiedEvent<OmitMetadata<T>> = never, T extends IGDPRProperty = never>(eventName: string, data?: StrictPropertyCheck<T, E>): void;

	/**
	 * @deprecated Use publicLogError2 and the typescript GDPR annotation where possible
	 */
	publicLogError(errorEventName: string, data?: ITelemetryData): void;

	publicLogError2<E extends ClassifiedEvent<OmitMetadata<T>> = never, T extends IGDPRProperty = never>(eventName: string, data?: StrictPropertyCheck<T, E>): void;

	setExperimentProperty(name: string, value: string): void;

	/**
	 * Sets a common property that will be attached to all telemetry events, or removes it when the value is undefined.
	 * Common properties are added after PII cleaning and cannot be overridden by event data.
	 */
	setCommonProperty(name: string, value: string | boolean | undefined): void;
}

// Keys
export const firstSessionDateStorageKey = 'telemetry.firstSessionDate';

export const enum TelemetryLevel {
	NONE = 0,
	CRASH = 1,
	ERROR = 2,
	USAGE = 3
}
