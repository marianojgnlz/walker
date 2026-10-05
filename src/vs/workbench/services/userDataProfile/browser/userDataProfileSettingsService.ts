/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { applyEdits, setProperty } from '../../../../base/common/jsonEdit.js';
import { parse } from '../../../../base/common/json.js';
import { FormattingOptions } from '../../../../base/common/jsonFormatter.js';
import { URI } from '../../../../base/common/uri.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { ITextResourceConfigurationService, ITextResourcePropertiesService } from '../../../../editor/common/services/textResourceConfiguration.js';

export function updateProfileSettings(targetContent: string, sourceContent: string, preservedSettings: string[], formattingOptions: FormattingOptions): string {
	const source = parse(sourceContent);
	if (!source || !parse(targetContent)) {
		return targetContent;
	}

	for (const key of preservedSettings) {
		targetContent = applyEdits(targetContent, setProperty(targetContent, [key], source[key], formattingOptions));
	}
	return targetContent;
}

export async function resolveSettingsFormattingOptions(
	resource: URI,
	textModelService: ITextModelService,
	textResourcePropertiesService: ITextResourcePropertiesService,
	textResourceConfigurationService: ITextResourceConfigurationService,
): Promise<FormattingOptions> {
	try {
		const modelReference = await textModelService.createModelReference(resource);
		const { insertSpaces, tabSize } = modelReference.object.textEditorModel.getOptions();
		const eol = modelReference.object.textEditorModel.getEOL();
		modelReference.dispose();
		return { eol, insertSpaces, tabSize };
	} catch {
		return {
			eol: textResourcePropertiesService.getEOL(resource),
			insertSpaces: !!textResourceConfigurationService.getValue<boolean>(resource, 'editor.insertSpaces'),
			tabSize: textResourceConfigurationService.getValue<number>(resource, 'editor.tabSize')
		};
	}
}
