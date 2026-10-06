/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { env } from '../../../base/common/process.js';


export function verifyMicrosoftInternalDomain(domainList: readonly string[]): boolean {
	const userDnsDomain = env['USERDNSDOMAIN'];
	if (!userDnsDomain) {
		return false;
	}

	const domain = userDnsDomain.toLowerCase();
	return domainList.some(msftDomain => domain === msftDomain);
}
