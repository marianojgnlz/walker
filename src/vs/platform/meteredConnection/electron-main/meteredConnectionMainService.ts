/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeferredPromise } from '../../../base/common/async.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { AbstractMeteredConnectionService } from '../common/meteredConnection.js';

/**
 * Electron-main implementation of the metered connection service.
 * This implementation receives metered connection updates via IPC channel from the renderer process.
 */
export class MeteredConnectionMainService extends AbstractMeteredConnectionService {
	private readonly connectionStateInitialized = new DeferredPromise<void>();
	readonly whenConnectionStateInitialized = this.connectionStateInitialized.p;

	constructor(@IConfigurationService configurationService: IConfigurationService) {
		super(configurationService, false);
	}

	public override setIsBrowserConnectionMetered(value: boolean): void {
		super.setIsBrowserConnectionMetered(value);
		this.connectionStateInitialized.complete();
	}
}
