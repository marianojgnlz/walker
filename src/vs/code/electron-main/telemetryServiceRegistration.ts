/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServiceCollection } from '../../platform/instantiation/common/serviceCollection.js';
import { ITelemetryService } from '../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../platform/telemetry/common/telemetryUtils.js';

/**
 * Registers the main-process telemetry service. Reporting has been removed from the
 * product, so this always binds the shared no-op object and exposes no reporting-descriptor
 * seam. Exported so startup tests can assert the binding without starting a process.
 */
export function registerMainTelemetryService(services: ServiceCollection): void {
	services.set(ITelemetryService, NullTelemetryService);
}
