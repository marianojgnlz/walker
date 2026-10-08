/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
	CSHARP_EDITING_COMPATIBILITY_RECORD,
	CSharpRuntimeMappingGuard,
	ICSharpRuntimeMappingInput,
} from '../../common/runtimeMapping.js';

const host = {
	schemaVersion: 1 as const,
	kind: 'ready' as const,
	locality: 'local' as const,
	profile: 'roslyn-standalone-10' as const,
	executable: '/opt/dotnet/dotnet',
	root: '/opt/dotnet',
	sdkVersion: '10.0.401',
	runtimeVersion: '10.0.12',
};

function input(overrides: Partial<ICSharpRuntimeMappingInput> = {}): ICSharpRuntimeMappingInput {
	return {
		client: { id: 'muhammad-sammy.csharp', version: '2.145.21-g154a82fd27', targetPlatform: 'linux-x64' },
		runtimeDependency: { id: 'ms-dotnettools.vscode-dotnet-runtime', version: '3.2.0' },
		platform: 'linux', architecture: 'x64', host,
		existingDotnetPath: [{ extensionId: 'muhammad-sammy.csharp', path: host.executable }],
		allowInvalidPaths: false,
		...overrides,
	};
}

function resolveAuditedDependencyPath(setting: unknown, requesterId: string, sharedPath?: unknown): string | undefined {
	if (!Array.isArray(setting)) {
		return typeof sharedPath === 'string' ? sharedPath : undefined;
	}
	const match = setting.find(entry => typeof entry === 'object' && entry !== null && !Array.isArray(entry)
		&& (entry as { extensionId?: unknown }).extensionId === requesterId);
	return match && typeof (match as { path?: unknown }).path === 'string'
		? (match as { path: string }).path
		: typeof sharedPath === 'string' ? sharedPath : undefined;
}

suite('C# requester-specific runtime mapping', () => {
	test('pins the audited packages, runtime profile, requester schema and fallback boundary', () => {
		assert.strictEqual(CSHARP_EDITING_COMPATIBILITY_RECORD.client.vsixSha256, '78bc006683cc998e9fd1a6f2760d8cb3da63096464a217bbd192ecfb490a5516');
		assert.strictEqual(CSHARP_EDITING_COMPATIBILITY_RECORD.runtimeDependency.vsixSha256, 'a4cff5409f66e3827ee2c6a727ae59382290a182a653ca0f9ac97c63536ee541');
		assert.strictEqual(CSHARP_EDITING_COMPATIBILITY_RECORD.requesterMapping.requester, 'muhammad-sammy.csharp');
		assert.deepStrictEqual(CSHARP_EDITING_COMPATIBILITY_RECORD.requesterMapping.entryShape, ['extensionId', 'path']);
		assert.deepStrictEqual(CSHARP_EDITING_COMPATIBILITY_RECORD.requesterMapping.fallbackCommands, ['dotnet.acquireStatus', 'dotnet.acquire', 'dotnet.ensureDotnetDependencies']);
	});

	test('uses the audited requester row before shared path and reaches no acquisition fallback', () => {
		// Fixture mirrors runtime dependency 3.2.0 ExistingPathResolver and findPath source in A1.
		const settings = [{ extensionId: 'muhammad-sammy.csharp', path: host.executable }];
		const selected = resolveAuditedDependencyPath(settings, 'muhammad-sammy.csharp', '/untrusted/dotnet');
		assert.strictEqual(selected, host.executable);
		const fallbackCommands: string[] = [];
		if (!selected) {
			fallbackCommands.push(...CSHARP_EDITING_COMPATIBILITY_RECORD.requesterMapping.fallbackCommands);
		}
		assert.deepStrictEqual(fallbackCommands, []);
		assert.deepStrictEqual(CSharpRuntimeMappingGuard(input({ existingDotnetPath: settings })), { eligible: true, executable: host.executable });
	});

	test('denies missing, stale, duplicate and malformed requester entries before client entry', () => {
		for (const mapping of [undefined, [], [{ extensionId: 'muhammad-sammy.csharp', path: '/hostile/dotnet' }], [
			{ extensionId: 'muhammad-sammy.csharp', path: host.executable },
			{ extensionId: 'muhammad-sammy.csharp', path: host.executable },
		], [{ extensionId: 'MUHAMMAD-SAMMY.CSHARP', path: host.executable }], [{ extensionId: 'muhammad-sammy.csharp', path: 42 }]]) {
			assert.strictEqual(CSharpRuntimeMappingGuard(input({ existingDotnetPath: mapping })).eligible, false);
		}
	});

	test('denies unvalidated packages, unsupported architectures, bypass settings and conflicting shared paths', () => {
		assert.strictEqual(CSharpRuntimeMappingGuard(input({ client: { id: 'ms-dotnettools.csharp', version: '2.145.21-g154a82fd27', targetPlatform: 'linux-x64' } })).reason, 'client-unvalidated');
		assert.strictEqual(CSharpRuntimeMappingGuard(input({ architecture: 'arm64' })).reason, 'unsupported-platform');
		assert.strictEqual(CSharpRuntimeMappingGuard(input({ allowInvalidPaths: true })).reason, 'invalid-path-bypass');
		assert.strictEqual(CSharpRuntimeMappingGuard(input({ sharedExistingDotnetPath: '/other/dotnet' })).reason, 'mapping-conflict');
	});

	test('independently rejects preview, old and malformed runtime results', () => {
		for (const runtimeVersion of ['10.0.4', '10.0.12-preview.1', '9.0.9', '10.0']) {
			assert.strictEqual(CSharpRuntimeMappingGuard(input({ host: { ...host, runtimeVersion } as typeof host })).reason, 'runtime-incompatible');
		}
		assert.strictEqual(CSharpRuntimeMappingGuard(input({ host: { ...host, root: '/opt/other' } })).reason, 'host-unverified');
	});
});
