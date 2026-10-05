/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ConfigurationScope, Extensions, IConfigurationNode, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { ITextResourceConfigurationService, ITextResourcePropertiesService } from '../../../../../editor/common/services/textResourceConfiguration.js';
import { IUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { SettingsResource } from '../../browser/settingsResource.js';

const ROOT = URI.file('tests').with({ scheme: 'vscode-tests' });

suite('SettingsResource', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	let instantiationService: TestInstantiationService;
	let fileService: IFileService;
	let settingsResource: URI;

	setup(() => {
		instantiationService = disposables.add(new TestInstantiationService());
		fileService = disposables.add(new FileService(new NullLogService()));
		const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
		disposables.add(fileService.registerProvider(ROOT.scheme, fileSystemProvider));
		settingsResource = joinPath(ROOT, 'profiles', 'local-profile', 'settings.json');

		instantiationService.stub(IFileService, fileService);
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(ITextModelService, {
			createModelReference: async () => { throw new Error('No text model'); },
		} as unknown as ITextModelService);
		instantiationService.stub(ITextResourcePropertiesService, {
			_serviceBrand: undefined,
			getEOL: () => '\n',
		} as ITextResourcePropertiesService);
		instantiationService.stub(ITextResourceConfigurationService, {
			_serviceBrand: undefined,
			getValue: (_resource: URI | undefined, section?: string) => section === 'editor.insertSpaces' ? true : 2,
		} as unknown as ITextResourceConfigurationService);
	});

	test('exports and imports settings in the selected local profile', async () => {
		const profile = { name: 'Local', settingsResource } as IUserDataProfile;
		const machineSetting = 'walker.testProfile.machineSetting';
		const configuration: IConfigurationNode = { properties: { [machineSetting]: { type: 'string', scope: ConfigurationScope.MACHINE } } };
		const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
		configurationRegistry.registerConfiguration(configuration);
		try {
			await fileService.writeFile(settingsResource, VSBuffer.fromString(`{\n\t"files.autoSave": "afterDelay",\n\t"${machineSetting}": "local-only"\n}`));
			const resource = instantiationService.createInstance(SettingsResource);

			const exported = JSON.parse(await resource.getContent(profile));
			const exportedSettings = JSON.parse(exported.settings);
			assert.strictEqual(exportedSettings['files.autoSave'], 'afterDelay');
			assert.strictEqual(exportedSettings[machineSetting], undefined);

			await resource.apply(JSON.stringify({ settings: '{\n\t"files.autoSave": "off",\n\t"editor.tabSize": 4\n}' }), profile);
			const imported = JSON.parse((await fileService.readFile(settingsResource)).value.toString());
			assert.strictEqual(imported['files.autoSave'], 'off');
			assert.strictEqual(imported['editor.tabSize'], 4);
			assert.strictEqual(imported[machineSetting], 'local-only');
		} finally {
			configurationRegistry.deregisterConfigurations([configuration]);
		}
	});
});
