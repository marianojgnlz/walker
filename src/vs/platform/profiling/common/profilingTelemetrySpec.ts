/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService } from '../../log/common/log.js';
import { BottomUpSample } from './profilingModel.js';
import { errorHandler } from '../../../base/common/errors.js';

export interface SampleData {
	perfBaseline: number;
	sample: BottomUpSample;
	source: string;
}

export function reportSample(data: SampleData, logService: ILogService, sendAsErrorTelemtry: boolean): void {

	// log a fake error with a clearer stack
	const fakeError = new PerformanceError(data);
	if (sendAsErrorTelemtry) {
		errorHandler.onUnexpectedError(fakeError);
	} else {
		logService.error(fakeError);
	}
}

class PerformanceError extends Error {
	readonly selfTime: number;

	constructor(data: SampleData) {
		// Since the stacks are available via the sample
		// we can avoid collecting them when constructing the error.
		if (Error.hasOwnProperty('stackTraceLimit')) {
			// eslint-disable-next-line local/code-no-any-casts
			const Err = Error as any as { stackTraceLimit: number }; // For the monaco editor checks.
			const stackTraceLimit = Err.stackTraceLimit;
			Err.stackTraceLimit = 0;
			super(`PerfSampleError: by ${data.source} in ${data.sample.location}`);
			Err.stackTraceLimit = stackTraceLimit;
		} else {
			super(`PerfSampleError: by ${data.source} in ${data.sample.location}`);
		}
		this.name = 'PerfSampleError';
		this.selfTime = data.sample.selfTime;

		const trace = [data.sample.absLocation, ...data.sample.caller.map(c => c.absLocation)];
		this.stack = `\n\t at ${trace.join('\n\t at ')}`;
	}
}
