/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as tas from 'vscode-tas-client';

export interface IExperimentationTelemetryReporter extends tas.IExperimentationTelemetry, vscode.Disposable {
	postEventObj(eventName: string, props: { [prop: string]: string }): void;
}

/**
 * A no-op experimentation telemetry adapter.
 *
 * The direct `@vscode/extension-telemetry` reporter was removed. `vscode-tas-client`
 * already returns its telemetry-disabled experiment service whenever
 * `vscode.env.isTelemetryEnabled` is false, which is always the case in this product,
 * so nothing below is ever invoked by the experimentation service.
 */
export class ExperimentationTelemetryReporter implements IExperimentationTelemetryReporter {

	setSharedProperty(_name: string, _value: string): void {
		// Reporting removed.
	}

	postEvent(_eventName: string, _props: Map<string, string>): void {
		// Reporting removed.
	}

	postEventObj(_eventName: string, _props: { [prop: string]: string }): void {
		// Reporting removed.
	}

	dispose(): void {
		// noop
	}
}
