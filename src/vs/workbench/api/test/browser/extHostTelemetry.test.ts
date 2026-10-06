/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ExtensionIdentifier, IExtensionDescription, TargetPlatform } from '../../../../platform/extensions/common/extensions.js';
import { TelemetryLevel } from '../../../../platform/telemetry/common/telemetry.js';
import { ExtHostTelemetry, ExtHostTelemetryLogger } from '../../common/extHostTelemetry.js';
import type { TelemetryLoggerOptions, TelemetrySender } from 'vscode';

interface TelemetrySenderSpy {
	dataArr: any[];
	exceptionArr: any[];
	flushCount: number;
}

suite('ExtHostTelemetry disabled facade', function () {
	ensureNoDisposablesAreLeakedInTestSuite();

	const mockExtensionIdentifier: IExtensionDescription = {
		identifier: new ExtensionIdentifier('test-extension'),
		targetPlatform: TargetPlatform.UNIVERSAL,
		isBuiltin: true,
		isUserBuiltin: true,
		isUnderDevelopment: true,
		name: 'test-extension',
		publisher: 'vscode',
		version: '1.0.0',
		engines: { vscode: '*' },
		extensionLocation: URI.parse('fake'),
		enabledApiProposals: undefined,
		preRelease: false,
	};

	const createSenderSpy = (): [TelemetrySenderSpy, TelemetrySender] => {
		const spy: TelemetrySenderSpy = { dataArr: [], exceptionArr: [], flushCount: 0 };
		return [spy, {
			sendEventData: (eventName: string, data) => spy.dataArr.push({ eventName, data }),
			sendErrorData: (exception, data) => spy.exceptionArr.push({ exception, data }),
			flush: () => { spy.flushCount++; }
		}];
	};

	test('Validate sender instances', function () {
		// eslint-disable-next-line local/code-no-any-casts
		assert.throws(() => ExtHostTelemetryLogger.validateSender(<any>null));
		// eslint-disable-next-line local/code-no-any-casts
		assert.throws(() => ExtHostTelemetryLogger.validateSender(<any>1));
		// eslint-disable-next-line local/code-no-any-casts
		assert.throws(() => ExtHostTelemetryLogger.validateSender(<any>{}));
		assert.throws(() => {
			// eslint-disable-next-line local/code-no-any-casts
			ExtHostTelemetryLogger.validateSender(<any>{
				sendErrorData: () => { },
				sendEventData: true
			});
		});
		assert.throws(() => {
			// eslint-disable-next-line local/code-no-any-casts
			ExtHostTelemetryLogger.validateSender(<any>{
				sendEventData: () => { },
				sendErrorData: () => { },
				flush: true
			});
		});
		// eslint-disable-next-line local/code-no-any-casts
		assert.doesNotThrow(() => ExtHostTelemetryLogger.validateSender(<any>{
			sendEventData: () => { },
			sendErrorData: () => { }
		}));
	});

	test('always reports disabled state, even after old full-reporting initialization', () => {
		const telemetry = new ExtHostTelemetry();
		try {
			let enablementEmissions = 0;
			let configurationEmissions = 0;
			const enablementSub = telemetry.onDidChangeTelemetryEnabled(() => enablementEmissions++);
			const configurationSub = telemetry.onDidChangeTelemetryConfiguration(() => configurationEmissions++);

			telemetry.$initializeTelemetryLevel(TelemetryLevel.USAGE, true, { usage: true, error: true });
			telemetry.$onDidChangeTelemetryLevel(TelemetryLevel.CRASH);

			assert.deepStrictEqual({
				enabled: telemetry.getTelemetryConfiguration(),
				details: telemetry.getTelemetryDetails(),
				enablementEmissions,
				configurationEmissions,
			}, {
				enabled: false,
				details: { isCrashEnabled: false, isErrorsEnabled: false, isUsageEnabled: false },
				enablementEmissions: 0,
				configurationEmissions: 0,
			});

			enablementSub.dispose();
			configurationSub.dispose();
		} finally {
			telemetry.dispose();
		}
	});

	test('extension-supplied sender methods are never invoked', () => {
		const telemetry = new ExtHostTelemetry();
		try {
			const [spy, sender] = createSenderSpy();
			const logger = telemetry.instantiateLogger(mockExtensionIdentifier, sender, {} as TelemetryLoggerOptions);

			logger.logUsage('fixture.event');
			logger.logError(new Error('fixture error'));
			logger.logError('fixture.error');
			logger.dispose();

			assert.deepStrictEqual({
				dataCount: spy.dataArr.length,
				exceptionCount: spy.exceptionArr.length,
				flushCount: spy.flushCount,
				isUsageEnabled: logger.isUsageEnabled,
				isErrorsEnabled: logger.isErrorsEnabled,
			}, {
				dataCount: 0,
				exceptionCount: 0,
				flushCount: 0,
				isUsageEnabled: false,
				isErrorsEnabled: false,
			});
		} finally {
			telemetry.dispose();
		}
	});

	test('repeated logger lifecycles accumulate no reporting state and never emit enablement changes', () => {
		const telemetry = new ExtHostTelemetry();
		try {
			const [spy, sender] = createSenderSpy();
			let enablementEmissions = 0;
			const sub = telemetry.onDidChangeTelemetryEnabled(() => enablementEmissions++);

			for (let i = 0; i < 5; i++) {
				const logger = telemetry.instantiateLogger(mockExtensionIdentifier, sender);
				logger.logUsage('fixture.event');
				logger.dispose();
				telemetry.$onDidChangeTelemetryLevel(TelemetryLevel.USAGE);
			}
			sub.dispose();

			assert.deepStrictEqual({
				dataCount: spy.dataArr.length,
				flushCount: spy.flushCount,
				enablementEmissions,
				handsOffExtensionErrors: telemetry.onExtensionError(mockExtensionIdentifier.identifier, new Error('fixture')),
			}, {
				dataCount: 0,
				flushCount: 0,
				enablementEmissions: 0,
				handsOffExtensionErrors: false,
			});
		} finally {
			telemetry.dispose();
		}
	});
});
