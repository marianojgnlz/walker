/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PolicyCategory } from '../../../base/common/policy.js';
import { localize } from '../../../nls.js';
import { Extensions, IConfigurationRegistry } from '../../configuration/common/configurationRegistry.js';
import { Registry } from '../../registry/common/platform.js';

// The telemetry enablement settings (`telemetry.telemetryLevel`, `telemetry.enableTelemetry`,
// `telemetry.enableCrashReporter`) are no longer registered: no reporting service reads them any
// more and they must never be able to re-enable reporting. The single surviving setting below is
// not telemetry reporting — it gates the retained feedback surfaces (issue reporter, surveys,
// relauncher) — so it keeps its schema, default and `EnableFeedback` policy entry.
//
// NOTE: this module is a side-effect registration module. It must stay imported from a module that
// is actually loaded (`workbench.common.main.ts`), otherwise the setting silently disappears and
// the retained feedback surfaces flip to "disabled".
const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
configurationRegistry.registerConfiguration({
	'id': 'telemetry',
	'order': 1,
	'type': 'object',
	'title': localize('telemetryConfigurationTitle', "Telemetry"),
	'properties': {
		'telemetry.feedback.enabled': {
			type: 'boolean',
			default: true,
			description: localize('telemetry.feedback.enabled', "Enable feedback mechanisms such as the issue reporter, surveys, and other feedback options."),
			policy: {
				name: 'EnableFeedback',
				category: PolicyCategory.Telemetry,
				minimumVersion: '1.99',
				localization: { description: { key: 'telemetry.feedback.enabled', value: localize('telemetry.feedback.enabled', "Enable feedback mechanisms such as the issue reporter, surveys, and other feedback options.") } },
			}
		},
	},
});
