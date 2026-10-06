/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IHeaders } from '../../../base/parts/request/common/request.js';
import { IProductService } from '../../product/common/productService.js';

export async function resolveMarketplaceHeaders(version: string, productService: IProductService): Promise<IHeaders> {
	const headers: IHeaders = {
		'X-Market-Client-Id': `VSCode ${version}`,
		'User-Agent': `VSCode ${version} (${productService.nameShort})`
	};

	return headers;
}
