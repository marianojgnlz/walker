/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SyncDescriptor } from '../../platform/instantiation/common/descriptors.js';
import { ServiceCollection } from '../../platform/instantiation/common/serviceCollection.js';
import { ITelemetryService } from '../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../platform/telemetry/common/telemetryUtils.js';

/**
 * Registers the main-process telemetry service. Exported so startup tests can count reporter setup without starting a process or opening the shared-process channel.
 */
export function registerMainTelemetryService(
	services: ServiceCollection,
	telemetrySupported: boolean,
	createReportingDescriptor: () => SyncDescriptor<ITelemetryService>
): boolean {
	if (telemetrySupported) {
		services.set(ITelemetryService, createReportingDescriptor());
		return true;
	}

	services.set(ITelemetryService, NullTelemetryService);
	return false;
}
