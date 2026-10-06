/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../base/common/event.js';
import { ExtHostTelemetryShape } from './extHost.protocol.js';
import { TelemetryLevel } from '../../../platform/telemetry/common/telemetry.js';
import { ExtensionIdentifier, IExtensionDescription } from '../../../platform/extensions/common/extensions.js';
import { Disposable } from '../../../base/common/lifecycle.js';

/**
 * Minimal disabled telemetry facade for extension hosts.
 *
 * Reporting was removed from the product: this facade always reports disabled state,
 * never forwards extension-supplied sender methods, never creates telemetry output
 * channels, and never builds common properties or event payloads. It exists only to
 * keep the public extension API shape intact for extensions that consume it.
 */
export class ExtHostTelemetry extends Disposable implements ExtHostTelemetryShape {

	readonly _serviceBrand: undefined;

	readonly onDidChangeTelemetryEnabled: Event<boolean> = Event.None;
	readonly onDidChangeTelemetryConfiguration: Event<vscode.TelemetryConfiguration> = Event.None;

	getTelemetryConfiguration(): boolean {
		return false;
	}

	getTelemetryDetails(): vscode.TelemetryConfiguration {
		return {
			isCrashEnabled: false,
			isErrorsEnabled: false,
			isUsageEnabled: false
		};
	}

	instantiateLogger(_extension: IExtensionDescription, _sender: vscode.TelemetrySender, _options?: vscode.TelemetryLoggerOptions): vscode.TelemetryLogger {
		return new ExtHostTelemetryLogger().apiTelemetryLogger;
	}

	$initializeTelemetryLevel(_level: TelemetryLevel, _supportsTelemetry: boolean, _productConfig?: { usage: boolean; error: boolean }): void {
		// Reporting is removed: old initialization values can never enable telemetry.
	}

	$onDidChangeTelemetryLevel(_level: TelemetryLevel): void {
		// Reporting is removed: old level changes can never enable telemetry.
	}

	onExtensionError(_extension: ExtensionIdentifier, _error: Error): boolean {
		return false;
	}
}

/**
 * A pure shape-compatible telemetry logger that never invokes its sender.
 */
export class ExtHostTelemetryLogger {

	static validateSender(sender: vscode.TelemetrySender): void {
		if (typeof sender !== 'object') {
			throw new TypeError('TelemetrySender argument is invalid');
		}
		if (typeof sender.sendEventData !== 'function') {
			throw new TypeError('TelemetrySender.sendEventData must be a function');
		}
		if (typeof sender.sendErrorData !== 'function') {
			throw new TypeError('TelemetrySender.sendErrorData must be a function');
		}
		if (typeof sender.flush !== 'undefined' && typeof sender.flush !== 'function') {
			throw new TypeError('TelemetrySender.flush must be a function or undefined');
		}
	}

	private readonly _apiObject: vscode.TelemetryLogger = Object.freeze({
		logUsage: (_eventName: string, _data?: Record<string, any>): void => { },
		get isUsageEnabled() {
			return false;
		},
		get isErrorsEnabled() {
			return false;
		},
		logError: (_eventNameOrException: Error | string, _data?: Record<string, any>): void => { },
		dispose: (): void => { },
		onDidChangeEnableStates: Event.None
	});

	get apiTelemetryLogger(): vscode.TelemetryLogger {
		return this._apiObject;
	}
}

export function isNewAppInstall(firstSessionDate: string): boolean {
	const installAge = Date.now() - new Date(firstSessionDate).getTime();
	return isNaN(installAge) ? false : installAge < 1000 * 60 * 60 * 24; // install age is less than a day
}

export const IExtHostTelemetry = createDecorator<IExtHostTelemetry>('IExtHostTelemetry');
export interface IExtHostTelemetry extends ExtHostTelemetry, ExtHostTelemetryShape { }
