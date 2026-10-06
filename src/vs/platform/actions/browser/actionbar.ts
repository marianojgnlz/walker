/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ActionBar, IActionBarOptions } from '../../../base/browser/ui/actionbar/actionbar.js';

export interface IWorkbenchActionBarOptions extends IActionBarOptions {
}

/**
 * A {@link ActionBar action bar} for the workbench.
 */
export class WorkbenchActionBar extends ActionBar {

	constructor(
		container: HTMLElement,
		options: IWorkbenchActionBarOptions,
	) {
		super(container, options);
	}
}
