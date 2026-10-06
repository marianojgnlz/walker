/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';

/**
 * Determines whether experiment treatments (TAS) may be fetched and applied.
 *
 * This is an ordinary feature gate for the experiment client. It is deliberately independent of
 * telemetry enablement: telemetry settings must never be able to switch the experiment client on
 * or off, and an experiment fetch must not be confused with reporting.
 */
export function experimentsEnabled(
	configurationService: IConfigurationService,
	productService: IProductService,
	environmentService: IWorkbenchEnvironmentService
): boolean {
	return !!productService.tasConfig &&
		!environmentService.disableExperiments &&
		!environmentService.extensionTestsLocationURI &&
		!environmentService.enableSmokeTestDriver &&
		configurationService.getValue('workbench.enableExperiments') === true;
}
