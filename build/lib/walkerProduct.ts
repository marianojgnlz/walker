/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs';
import { resolve } from 'path';

const galleryPath = resolve(import.meta.dirname, '../distro/walker/gallery.json');
const expectedKeys = ['controlApiUrl', 'itemUrl', 'resourceUrlTemplate', 'serviceUrl'];

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readGalleryMixin(): unknown {
	return JSON.parse(readFileSync(galleryPath, 'utf8'));
}

function validateGalleryMixin(value: unknown): Record<string, string> {
	if (!isRecord(value) || Object.keys(value).sort().join(',') !== expectedKeys.join(',')) {
		throw new Error('Invalid Walker Open VSX gallery mixin: expected exactly the four approved endpoint fields.');
	}

	const expected = {
		serviceUrl: 'https://open-vsx.org/vscode/gallery',
		itemUrl: 'https://open-vsx.org/vscode/item',
		resourceUrlTemplate: 'https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}',
		controlApiUrl: 'https://open-vsx.org/vscode/gallery/control'
	};
	for (const [key, valueForKey] of Object.entries(expected)) {
		if (value[key] !== valueForKey) {
			throw new Error(`Invalid Walker Open VSX gallery mixin: unexpected ${key}.`);
		}
	}

	return value as Record<string, string>;
}

export function composeWalkerProduct(product: Record<string, unknown>, galleryMixin: unknown = readGalleryMixin()): Record<string, unknown> {
	const gallery = validateGalleryMixin(galleryMixin);
	return {
		...product,
		extensionsGallery: {
			serviceUrl: gallery.serviceUrl,
			itemUrl: gallery.itemUrl,
			resourceUrlTemplate: gallery.resourceUrlTemplate,
			controlUrl: gallery.controlApiUrl
		}
	};
}
