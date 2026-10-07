/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Shared command used by the Welcome page, File menu, and command palette. */
export const CREATE_PROJECT_COMMAND_ID = 'workbench.action.projectWizard.newProject';

export type ProjectNameValidationError = 'empty' | 'format' | 'reserved';

const PROJECT_NAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;
const WINDOWS_RESERVED_NAME = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

/** Returns a stable validation code for cross-platform .NET project folder names. */
export function getProjectNameValidationError(value: string): ProjectNameValidationError | undefined {
	if (value.trim().length === 0) {
		return 'empty';
	}
	if (!PROJECT_NAME_PATTERN.test(value)) {
		return 'format';
	}
	if (WINDOWS_RESERVED_NAME.test(value)) {
		return 'reserved';
	}
	return undefined;
}
