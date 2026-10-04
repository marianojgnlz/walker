/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { SyncDescriptor } from '../../../platform/instantiation/common/descriptors.js';
import { ServiceCollection } from '../../../platform/instantiation/common/serviceCollection.js';
import { ITelemetryService } from '../../../platform/telemetry/common/telemetry.js';
import { TelemetryService } from '../../../platform/telemetry/common/telemetryService.js';
import { NullTelemetryService } from '../../../platform/telemetry/common/telemetryUtils.js';
import { registerMainTelemetryService } from '../../electron-main/telemetryServiceRegistration.js';

suite('Product debloat process startup', () => {
	test('legacy telemetry enablement does not construct a reporting service', () => {
		const services = new ServiceCollection();
		let reporterSetupCount = 0;

		const reportingServiceRegistered = registerMainTelemetryService(services, true, () => {
			reporterSetupCount++;
			return new SyncDescriptor(TelemetryService);
		});

		assert.deepStrictEqual({
			reportingServiceRegistered,
			reporterSetupCount,
			noOpServiceBound: services.get(ITelemetryService) === NullTelemetryService,
		}, {
			reportingServiceRegistered: false,
			reporterSetupCount: 0,
			noOpServiceBound: true,
		});
	});
});
