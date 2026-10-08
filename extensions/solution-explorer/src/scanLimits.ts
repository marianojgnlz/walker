/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Fixed upper bounds for one bounded, non-evaluating solution graph scan (design D5). */
export const SCAN_LIMITS = Object.freeze({
	metadataFileBytes: 2 * 1024 * 1024,
	solutions: 64,
	projects: 256,
	directoryEntries: 20_000,
	graphNodes: 20_000,
	directoryDepth: 32,
	xmlDepth: 64,
	xmlTokens: 100_000,
	concurrentReads: 4,
	workDurationMs: 5_000,
} as const);
