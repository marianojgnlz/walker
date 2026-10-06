/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { PolicyCategory } from '../../../../../base/common/policy.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Extensions, IConfigurationNode, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { DefaultConfiguration, PolicyConfiguration } from '../../../../../platform/configuration/common/configurations.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { FilePolicyService } from '../../../../../platform/policy/common/filePolicyService.js';
import { AbstractPolicyService, IPolicyService, PolicyValue, PolicyValueSource } from '../../../../../platform/policy/common/policy.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { MultiplexPolicyService } from '../../../../../platform/policy/common/multiplexPolicyService.js';

/** A minimal second policy service so the multiplex merge has a non-file source. */
class TestPolicyService extends AbstractPolicyService implements IPolicyService {

	private readonly values = new Map<string, PolicyValue>();

	setPolicyValue(name: string, value: PolicyValue | undefined): void {
		if (value === undefined) {
			this.values.delete(name);
		} else {
			this.values.set(name, value);
		}
		this._onDidChange.fire([name]);
	}

	override getPolicyValue(name: string): PolicyValue | undefined {
		return this.values.get(name);
	}

	override getPolicyValueSource(name: string): PolicyValueSource | undefined {
		return this.values.has(name) ? PolicyValueSource.ServerManagedSettings : undefined;
	}

	protected async _updatePolicyDefinitions(): Promise<void> { /* values are injected directly */ }
}

suite('MultiplexPolicyService', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	let policyService: MultiplexPolicyService;
	let fileService: IFileService;
	let secondaryPolicyService: TestPolicyService;
	let policyConfiguration: PolicyConfiguration;
	const logService = new NullLogService();

	const policyFile = URI.file('policyFile').with({ scheme: 'vscode-tests' });
	const policyConfigurationNode: IConfigurationNode = {
		'id': 'policyConfiguration',
		'order': 1,
		'title': 'a',
		'type': 'object',
		'properties': {
			'setting.A': {
				'type': 'string',
				'default': 'defaultValueA',
				policy: {
					name: 'PolicySettingA',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' } }
				}
			},
			'setting.E': {
				'type': 'boolean',
				'default': true,
			},
			'setting.F': {
				'type': 'boolean',
				'default': true,
				policy: {
					name: 'PolicySettingF',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' } }
				}
			},
			'setting.G': {
				'type': ['array', 'null'],
				'default': null,
				policy: {
					name: 'PolicySettingG',
					category: PolicyCategory.Extensions,
					minimumVersion: '1.0.0',
					localization: { description: { key: '', value: '' } }
				}
			},
		}
	};

	suiteSetup(() => Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration(policyConfigurationNode));
	suiteTeardown(() => Registry.as<IConfigurationRegistry>(Extensions.Configuration).deregisterConfigurations([policyConfigurationNode]));

	setup(async () => {
		const defaultConfiguration = disposables.add(new DefaultConfiguration(new NullLogService()));
		await defaultConfiguration.initialize();

		fileService = disposables.add(new FileService(new NullLogService()));
		const diskFileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
		disposables.add(fileService.registerProvider(policyFile.scheme, diskFileSystemProvider));

		secondaryPolicyService = disposables.add(new TestPolicyService());
		policyService = disposables.add(new MultiplexPolicyService([
			disposables.add(new FilePolicyService(policyFile, fileService, new NullLogService())),
			secondaryPolicyService,
		], logService));
		policyConfiguration = disposables.add(new PolicyConfiguration(defaultConfiguration, policyService, new NullLogService()));
	});

	async function clear() {
		await fileService.writeFile(policyFile,
			VSBuffer.fromString(
				JSON.stringify({})
			)
		);
	}

	test('no policy', async () => {
		await clear();

		await policyConfiguration.initialize();

		{
			const A = policyService.getPolicyValue('PolicySettingA');
			const F = policyService.getPolicyValue('PolicySettingF');
			const G = policyService.getPolicyValue('PolicySettingG');

			// No policy is set
			assert.strictEqual(A, undefined);
			assert.strictEqual(F, undefined);
			assert.strictEqual(G, undefined);
		}

		{
			const A = policyConfiguration.configurationModel.getValue('setting.A');
			const E = policyConfiguration.configurationModel.getValue('setting.E');
			const F = policyConfiguration.configurationModel.getValue('setting.F');
			const G = policyConfiguration.configurationModel.getValue('setting.G');

			assert.strictEqual(A, undefined);
			assert.strictEqual(E, undefined);
			assert.strictEqual(F, undefined);
			assert.deepStrictEqual(G, undefined);
		}
	});

	test('policy from file only', async () => {
		await clear();

		await fileService.writeFile(policyFile,
			VSBuffer.fromString(
				JSON.stringify({ 'PolicySettingA': 'policyValueA' })
			)
		);

		await policyConfiguration.initialize();

		assert.strictEqual(policyService.getPolicyValue('PolicySettingA'), 'policyValueA');
		assert.strictEqual(policyService.getPolicyValueSource('PolicySettingA'), PolicyValueSource.Device);
		assert.strictEqual(policyService.getPolicyValue('PolicySettingF'), undefined);
		assert.strictEqual(policyConfiguration.configurationModel.getValue('setting.A'), 'policyValueA');
	});

	test('policy from the secondary policy service only', async () => {
		await clear();

		secondaryPolicyService.setPolicyValue('PolicySettingA', 'policyValueA');

		await policyConfiguration.initialize();

		assert.strictEqual(policyService.getPolicyValue('PolicySettingA'), 'policyValueA');
		assert.strictEqual(policyService.getPolicyValueSource('PolicySettingA'), PolicyValueSource.ServerManagedSettings);
		assert.strictEqual(policyService.getPolicyValue('PolicySettingF'), undefined);
	});

	test('policy from file and the secondary policy service', async () => {
		await clear();

		await fileService.writeFile(policyFile,
			VSBuffer.fromString(
				JSON.stringify({ 'PolicySettingA': 'policyValueA' })
			)
		);
		secondaryPolicyService.setPolicyValue('PolicySettingF', true);

		await policyConfiguration.initialize();

		assert.strictEqual(policyService.getPolicyValue('PolicySettingA'), 'policyValueA');
		assert.strictEqual(policyService.getPolicyValueSource('PolicySettingA'), PolicyValueSource.Device);
		assert.strictEqual(policyService.getPolicyValue('PolicySettingF'), true);
		assert.strictEqual(policyService.getPolicyValueSource('PolicySettingF'), PolicyValueSource.ServerManagedSettings);
		assert.strictEqual(policyConfiguration.configurationModel.getValue('setting.A'), 'policyValueA');
		assert.strictEqual(policyConfiguration.configurationModel.getValue('setting.F'), true);
	});

	test('union-typed (array | null) policy registers and parses JSON string value', async () => {
		await clear();

		secondaryPolicyService.setPolicyValue('PolicySettingG', JSON.stringify(['policyValueG1', 'policyValueG2']));

		await policyConfiguration.initialize();

		assert.strictEqual(policyService.getPolicyValue('PolicySettingG'), JSON.stringify(['policyValueG1', 'policyValueG2']));
		assert.deepStrictEqual(policyConfiguration.configurationModel.getValue('setting.G'), ['policyValueG1', 'policyValueG2']);
	});

	test('union-typed (array | null) policy preserves an empty array (lockdown) distinct from unset', async () => {
		await clear();

		// Policy set to an empty array (e.g. a lockdown allowlist): must round-trip to `[]`, not `undefined`.
		secondaryPolicyService.setPolicyValue('PolicySettingG', JSON.stringify([]));

		await policyConfiguration.initialize();

		assert.strictEqual(policyService.getPolicyValue('PolicySettingG'), JSON.stringify([]));
		assert.deepStrictEqual(policyConfiguration.configurationModel.getValue('setting.G'), []);
	});

	test('union-typed (array | null) policy unset leaves the setting at its default (distinct from empty array)', async () => {
		await clear();

		secondaryPolicyService.setPolicyValue('PolicySettingG', undefined);

		await policyConfiguration.initialize();

		assert.strictEqual(policyService.getPolicyValue('PolicySettingG'), undefined);
		assert.strictEqual(policyConfiguration.configurationModel.getValue('setting.G'), undefined);
	});
});
