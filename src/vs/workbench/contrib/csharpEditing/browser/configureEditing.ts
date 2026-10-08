/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	CSHARP_EDITING_CLIENT_ID,
	CSHARP_EDITING_CLIENT_VERSION,
	CSHARP_EDITING_RUNTIME_ID,
	CSHARP_EDITING_RUNTIME_VERSION,
} from '../common/editingPolicy.js';
import {
	configureCSharpEditingProfile,
	IProfileConfigurationServices,
	ProfileConfigurationResult,
	rollbackCSharpEditingProfileConfiguration,
} from './profileConfiguration.js';

export type { IProfileSettingSnapshot } from './profileConfiguration.js';

export interface ICSharpEditingInstalledPackage {
	readonly id: string;
	readonly version: string;
	readonly enabled: boolean;
}

export interface ICSharpEditingInstalledPackages {
	readonly client?: ICSharpEditingInstalledPackage;
	readonly runtime?: ICSharpEditingInstalledPackage;
}

export interface ICSharpEditingGalleryExtension {
	readonly id: string;
	readonly version: string;
	/** Opaque gallery-service value; it is never persisted or inspected. */
	readonly handle: object;
}

export interface ICSharpEditingAcquisitionServices extends IProfileConfigurationServices {
	readInstalledPackages(): Promise<ICSharpEditingInstalledPackages>;
	getAnonymousOpenVSXExtension(id: string, version: string): Promise<ICSharpEditingGalleryExtension | undefined>;
	installPinnedExtension(extension: ICSharpEditingGalleryExtension, request: {
		readonly profileId: string;
		readonly pinnedVersion: true;
		readonly includeDependencies: true;
		readonly applicationScoped: false;
		readonly workspaceScoped: false;
	}): Promise<void>;
}

export type CSharpEditingFailureReason =
	| 'package-state-failed' | 'configuration-failed' | 'storage-failed' | 'gallery-not-found' | 'gallery-package-unvalidated'
	| 'signature-verification' | 'offline' | 'access-denied' | 'cancelled' | 'installation-failed' | 'installed-package-unvalidated';

export type CSharpEditingFailureAction =
	| 'repair-profile-configuration' | 'retry-gallery' | 'retry-when-online' | 'review-profile-signature-workaround'
	| 'review-gallery-access' | 'retry-install' | 'repair-extension-state';

type ProfileRefusal = Extract<ProfileConfigurationResult, { readonly kind: 'refused' }>['reason'];

export type CSharpEditingConfigurationResult =
	| { readonly kind: 'configured'; readonly installation: 'installed' | 'existing' }
	| { readonly kind: 'refused'; readonly reason: ProfileRefusal | 'client-disabled' | 'client-unvalidated' | 'runtime-missing' | 'runtime-disabled' | 'runtime-unvalidated' }
	| { readonly kind: 'failed'; readonly reason: CSharpEditingFailureReason; readonly action: CSharpEditingFailureAction; readonly rollback: 'not-needed' | 'complete' | 'incomplete' };

/** Acquires the exact anonymous client after the profile journal and owned settings are durable. */
export async function configureCSharpEditing(services: ICSharpEditingAcquisitionServices): Promise<CSharpEditingConfigurationResult> {
	if (!services.profileId || services.profileId !== services.configurationProfileId || services.profileId !== services.journalProfileId) {
		return { kind: 'refused', reason: 'profile-mismatch' };
	}

	let packages: ICSharpEditingInstalledPackages;
	try {
		packages = await services.readInstalledPackages();
	} catch {
		return failed('package-state-failed', 'repair-extension-state', 'not-needed');
	}
	const packageProblem = getPackageProblem(packages);
	if (packageProblem) {
		return { kind: 'refused', reason: packageProblem };
	}

	const prepared = await configureCSharpEditingProfile(services);
	if (prepared.kind === 'refused') {
		return prepared;
	}
	if (prepared.kind === 'failed') {
		return failed(prepared.reason, 'repair-profile-configuration', prepared.rollback);
	}
	if (packages.client) {
		return { kind: 'configured', installation: 'existing' };
	}

	let extension: ICSharpEditingGalleryExtension | undefined;
	try {
		extension = await services.getAnonymousOpenVSXExtension(CSHARP_EDITING_CLIENT_ID, CSHARP_EDITING_CLIENT_VERSION);
	} catch (error) {
		return failedWithRollback(classifyFailure(error), services);
	}
	if (!extension) {
		return failedWithRollback({ reason: 'gallery-not-found', action: 'retry-gallery' }, services);
	}
	if (extension.id !== CSHARP_EDITING_CLIENT_ID || extension.version !== CSHARP_EDITING_CLIENT_VERSION || !extension.handle || typeof extension.handle !== 'object') {
		return failedWithRollback({ reason: 'gallery-package-unvalidated', action: 'retry-gallery' }, services);
	}

	try {
		await services.installPinnedExtension(extension, {
			profileId: services.profileId,
			pinnedVersion: true,
			includeDependencies: true,
			applicationScoped: false,
			workspaceScoped: false,
		});
	} catch (error) {
		return failedWithRollback(classifyFailure(error), services);
	}

	try {
		const installed = await services.readInstalledPackages();
		if (!installed.client || getPackageProblem(installed) !== undefined) {
			return failedWithRollback({ reason: 'installed-package-unvalidated', action: 'repair-extension-state' }, services);
		}
	} catch {
		return failedWithRollback({ reason: 'installed-package-unvalidated', action: 'repair-extension-state' }, services);
	}
	return { kind: 'configured', installation: 'installed' };
}

async function failedWithRollback(
	failure: { readonly reason: CSharpEditingFailureReason; readonly action: CSharpEditingFailureAction },
	services: ICSharpEditingAcquisitionServices,
): Promise<CSharpEditingConfigurationResult> {
	const rollback = await rollbackCSharpEditingProfileConfiguration(services);
	return failed(failure.reason, failure.action, rollback.kind);
}

function failed(
	reason: CSharpEditingFailureReason,
	action: CSharpEditingFailureAction,
	rollback: 'not-needed' | 'complete' | 'incomplete',
): CSharpEditingConfigurationResult {
	return { kind: 'failed', reason, action, rollback };
}

function getPackageProblem(packages: ICSharpEditingInstalledPackages): Extract<CSharpEditingConfigurationResult, { readonly kind: 'refused' }>['reason'] | undefined {
	const client = packages.client;
	if (client && (client.id !== CSHARP_EDITING_CLIENT_ID || client.version !== CSHARP_EDITING_CLIENT_VERSION)) {
		return 'client-unvalidated';
	}
	if (client && !client.enabled) {
		return 'client-disabled';
	}
	const runtime = packages.runtime;
	if (!runtime && client) {
		return 'runtime-missing';
	}
	if (runtime && (runtime.id !== CSHARP_EDITING_RUNTIME_ID || runtime.version !== CSHARP_EDITING_RUNTIME_VERSION)) {
		return 'runtime-unvalidated';
	}
	if (runtime && !runtime.enabled) {
		return 'runtime-disabled';
	}
	return undefined;
}

function classifyFailure(error: unknown): { readonly reason: CSharpEditingFailureReason; readonly action: CSharpEditingFailureAction } {
	const value = error && typeof error === 'object' ? error as { readonly code?: unknown; readonly name?: unknown } : undefined;
	const code = typeof value?.code === 'string' ? value.code : typeof value?.name === 'string' ? value.name : '';
	if (code === 'SignatureVerificationFailed' || code === 'PackageNotSigned' || code === 'SignatureVerificationInternal') {
		return { reason: 'signature-verification', action: 'review-profile-signature-workaround' };
	}
	if (['Offline', 'ETIMEDOUT', 'ENETUNREACH', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENOTFOUND'].includes(code)) {
		return { reason: 'offline', action: 'retry-when-online' };
	}
	if (['NotAllowed', 'EACCES', 'EPERM', 'Forbidden', 'Unauthorized'].includes(code)) {
		return { reason: 'access-denied', action: 'review-gallery-access' };
	}
	if (['Cancelled', 'Canceled', 'CancellationError', 'AbortError', 'ABORT_ERR', 'ERR_CANCELED'].includes(code)) {
		return { reason: 'cancelled', action: 'retry-install' };
	}
	return { reason: 'installation-failed', action: 'retry-install' };
}
