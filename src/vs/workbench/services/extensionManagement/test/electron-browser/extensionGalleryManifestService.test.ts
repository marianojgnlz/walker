/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { bufferToStream, VSBuffer } from '../../../../../base/common/buffer.js';
import { Event } from '../../../../../base/common/event.js';
import { IRequestContext, IRequestOptions } from '../../../../../base/parts/request/common/request.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IDefaultAccountService } from '../../../../../platform/defaultAccount/common/defaultAccount.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { ExtensionGalleryManifestStatus, ExtensionGalleryResourceType, ExtensionGalleryServiceUrlConfigKey } from '../../../../../platform/extensionManagement/common/extensionGalleryManifest.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ISharedProcessService } from '../../../../../platform/ipc/electron-browser/services.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IRequestService } from '../../../../../platform/request/common/request.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryServiceShape } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { AuthenticationSession, IAuthenticationService } from '../../../authentication/common/authentication.js';
import { IRemoteAgentService } from '../../../remote/common/remoteAgentService.js';
import { WorkbenchExtensionGalleryManifestService } from '../../electron-browser/extensionGalleryManifestService.js';

function mockResponse(statusCode: number, body: object): IRequestContext {
	return {
		res: { headers: {}, statusCode },
		stream: bufferToStream(VSBuffer.fromString(JSON.stringify(body))),
	};
}

// Gallery manifest response stub for the anonymous default gallery behavior tests.
function createGalleryManifest() {
	return {
		version: '1.0',
		resources: [],
	};
}

/** Captures emitted telemetry events so tests can assert on event names and dimensions. */
class RecordingTelemetryService extends NullTelemetryServiceShape {
	readonly events: { readonly eventName: string; readonly data: unknown }[] = [];

	override publicLog2(eventName?: string, data?: unknown): void {
		if (eventName) {
			this.events.push({ eventName, data });
		}
	}
}

suite('WorkbenchExtensionGalleryManifestService', () => {

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let requestHandler: (options: IRequestOptions) => IRequestContext | Promise<IRequestContext>;
	let requestCount: number;
	let defaultAccountLookups: number;
	let microsoftSessionLookups: number;
	let configurationService: TestConfigurationService;
	let telemetryService: RecordingTelemetryService;

	setup(() => {
		requestHandler = () => mockResponse(200, createGalleryManifest());
		requestCount = 0;
		defaultAccountLookups = 0;
		microsoftSessionLookups = 0;

		configurationService = new TestConfigurationService({
			[ExtensionGalleryServiceUrlConfigKey]: 'https://marketplace.example.com',
		});

		instantiationService = disposableStore.add(new TestInstantiationService());

		instantiationService.stub(IProductService, {
			version: '1.0.0',
			extensionsGallery: {
				serviceUrl: 'https://default-marketplace.example.com',
				itemUrl: 'https://default-marketplace.example.com/item',
				controlUrl: '',
				extensionUrlTemplate: '',
				resourceUrlTemplate: '',
				nlsBaseUrl: '',
			},
			nameLong: 'VS Code Test',
		});

		instantiationService.stub(IEnvironmentService, new class extends mock<IEnvironmentService>() {
		}());

		instantiationService.stub(IFileService, new class extends mock<IFileService>() {
		}());

		telemetryService = new RecordingTelemetryService();
		instantiationService.stub(ITelemetryService, telemetryService);

		instantiationService.stub(IRemoteAgentService, new class extends mock<IRemoteAgentService>() {
			override getConnection() { return null; }
		}());

		instantiationService.stub(ISharedProcessService, new class extends mock<ISharedProcessService>() {
			override getChannel(_channelName: string): any {
				return {
					call: () => Promise.resolve(),
					listen: () => Event.None,
				};
			}
		}());

		instantiationService.stub(IConfigurationService, configurationService);

		instantiationService.stub(IRequestService, new class extends mock<IRequestService>() {
			override async request(options: IRequestOptions) {
				requestCount++;
				return requestHandler(options);
			}
		}());

		instantiationService.stub(IDefaultAccountService, new class extends mock<IDefaultAccountService>() {
			override readonly onDidChangeDefaultAccount = Event.None;
			override async getDefaultAccount() { defaultAccountLookups++; return null; }
		}());

		instantiationService.stub(ILogService, new NullLogService());

		instantiationService.stub(IAuthenticationService, new class extends mock<IAuthenticationService>() {
			override readonly onDidChangeSessions = Event.None;
			override async getSessions(): Promise<readonly AuthenticationSession[]> {
				microsoftSessionLookups++;
				return [];
			}
		}());

		instantiationService.stub(IContextKeyService, disposableStore.add(new MockContextKeyService()));
	});

	function createService(): WorkbenchExtensionGalleryManifestService {
		return disposableStore.add(instantiationService.createInstance(WorkbenchExtensionGalleryManifestService));
	}


	// --- Anonymous marketplace behavior ---

	test('legacy private gallery URL stays unavailable without account lookup or public fallback', async () => {
		configurationService.setUserConfiguration(ExtensionGalleryServiceUrlConfigKey, 'https://private.example.com/manifest');
		requestHandler = () => mockResponse(200, createGalleryManifest());

		const service = createService();
		const statusChanges: ExtensionGalleryManifestStatus[] = [];
		disposableStore.add(service.onDidChangeExtensionGalleryManifestStatus(status => statusChanges.push(status)));
		const manifest = await service.getExtensionGalleryManifest();

		assert.strictEqual(service.extensionGalleryManifestStatus, ExtensionGalleryManifestStatus.Unavailable);
		assert.strictEqual(manifest, null);
		assert.deepStrictEqual(statusChanges, []);
		assert.deepStrictEqual({ defaultAccountLookups, microsoftSessionLookups, requestCount }, { defaultAccountLookups: 0, microsoftSessionLookups: 0, requestCount: 0 });
		assert.deepStrictEqual(telemetryService.events, []);
	});

	test('legacy provider preference cannot activate an authenticated gallery fallback', async () => {
		configurationService.setUserConfiguration(ExtensionGalleryServiceUrlConfigKey, 'https://private.example.com/manifest');
		configurationService.setUserConfiguration('extensions.gallery.authProvider', 'microsoft');

		const service = createService();
		await service.getExtensionGalleryManifest();

		assert.strictEqual(service.extensionGalleryManifestStatus, ExtensionGalleryManifestStatus.Unavailable);
		assert.strictEqual(microsoftSessionLookups, 0);
		assert.strictEqual(requestCount, 0);
	});

	// --- No configuredServiceUrl ---

	test('default gallery manifest has no account-required review link', async () => {
		configurationService.setUserConfiguration(ExtensionGalleryServiceUrlConfigKey, '');

		const manifest = await createService().getExtensionGalleryManifest();

		assert.deepStrictEqual(manifest?.resources.filter(resource => resource.type === ExtensionGalleryResourceType.ExtensionDetailsViewUri || resource.type === ExtensionGalleryResourceType.ExtensionRatingViewUri), [
			{ id: 'https://default-marketplace.example.com/item?itemName={publisher}.{name}', type: ExtensionGalleryResourceType.ExtensionDetailsViewUri }
		]);
	});

	test('no configuredServiceUrl — uses default gallery manifest', async () => {
		configurationService.setUserConfiguration(ExtensionGalleryServiceUrlConfigKey, '');

		const service = createService();
		await service.getExtensionGalleryManifest();

		// With no configured marketplace serviceUrl, the product's default gallery is fetched anonymously.
		assert.strictEqual(service.extensionGalleryManifestStatus, ExtensionGalleryManifestStatus.Available);
		assert.strictEqual(defaultAccountLookups, 0);
		assert.strictEqual(microsoftSessionLookups, 0);
	});

});
