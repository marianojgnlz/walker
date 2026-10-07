/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { extUriBiasedIgnorePathCase } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { generateUuid } from '../../../../base/common/uuid.js';

export const DEFERRED_GIT_INITIALIZATION_STORAGE_PREFIX = 'walker.projectWizard.deferredGit.';
export const DEFERRED_GIT_INITIALIZATION_TTL_MS = 10 * 60 * 1000;

interface IDeferredGitInitializationIntent {
	readonly schemaVersion: 1;
	readonly operation: 'initializeGit';
	readonly folder: string;
	readonly expiresAt: number;
}

export interface IDeferredGitInitialization {
	readonly id: string;
	cancel(): Promise<void>;
}

function isIntent(value: unknown, now: number): value is IDeferredGitInitializationIntent {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const candidate = value as Partial<IDeferredGitInitializationIntent>;
	if (candidate.schemaVersion !== 1 || candidate.operation !== 'initializeGit' || typeof candidate.folder !== 'string' || !Number.isSafeInteger(candidate.expiresAt) || candidate.expiresAt! <= now || candidate.expiresAt! > now + DEFERRED_GIT_INITIALIZATION_TTL_MS) {
		return false;
	}
	try {
		return URI.parse(candidate.folder).scheme === 'file';
	} catch {
		return false;
	}
}

function parseIntent(value: string | undefined, now: number): IDeferredGitInitializationIntent | undefined {
	if (value === undefined) {
		return undefined;
	}
	try {
		const parsed: unknown = JSON.parse(value);
		return isIntent(parsed, now) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function sameFolder(left: URI, right: URI): boolean {
	return extUriBiasedIgnorePathCase.isEqual(left, right);
}

/** Persists a one-shot, short-lived Git intent for the new window selected by the user. */
export async function createDeferredGitInitialization(storage: IStorageService, folder: URI, now = Date.now()): Promise<IDeferredGitInitialization> {
	if (folder.scheme !== 'file') {
		throw new Error('Git initialization can only be deferred for a local folder.');
	}
	const id = generateUuid();
	const key = `${DEFERRED_GIT_INITIALIZATION_STORAGE_PREFIX}${id}`;
	const intent: IDeferredGitInitializationIntent = {
		schemaVersion: 1,
		operation: 'initializeGit',
		folder: folder.toString(),
		expiresAt: now + DEFERRED_GIT_INITIALIZATION_TTL_MS,
	};
	storage.store(key, JSON.stringify(intent), StorageScope.APPLICATION, StorageTarget.MACHINE);
	try {
		await storage.flush();
	} catch (error) {
		storage.remove(key, StorageScope.APPLICATION);
		try {
			await storage.flush();
		} catch (cleanupError) {
			throw new Error(`Failed to persist the Git intent and clear its partial record: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`, { cause: error });
		}
		throw error;
	}

	return {
		id,
		cancel: async () => {
			storage.remove(key, StorageScope.APPLICATION);
			await storage.flush();
		},
	};
}

/** Consumes a matching intent before dispatch, so retries or duplicate windows cannot run Git twice. */
export async function consumeDeferredGitInitialization(
	storage: IStorageService,
	folder: URI,
	initializeGit: () => Promise<void>,
	now = Date.now(),
): Promise<boolean> {
	const matchingKeys: string[] = [];
	let removedInvalidIntent = false;
	for (const key of storage.keys(StorageScope.APPLICATION, StorageTarget.MACHINE)) {
		if (!key.startsWith(DEFERRED_GIT_INITIALIZATION_STORAGE_PREFIX)) {
			continue;
		}
		const intent = parseIntent(storage.get(key, StorageScope.APPLICATION), now);
		if (!intent) {
			storage.remove(key, StorageScope.APPLICATION);
			removedInvalidIntent = true;
			continue;
		}
		if (sameFolder(URI.parse(intent.folder), folder)) {
			matchingKeys.push(key);
		}
	}

	if (matchingKeys.length === 0) {
		if (removedInvalidIntent) {
			await storage.flush();
		}
		return false;
	}
	for (const key of matchingKeys) {
		storage.remove(key, StorageScope.APPLICATION);
	}
	await storage.flush();
	await initializeGit();
	return true;
}

/** Waits for same-window opening to finish before calling git.init against the active project root. */
export function waitForWorkspaceFolder(contextService: IWorkspaceContextService, folder: URI, timeoutMs = 30_000): Promise<void> {
	if (contextService.isCurrentWorkspace(folder)) {
		return Promise.resolve();
	}
	return new Promise<void>((resolve, reject) => {
		const disposables = new DisposableStore();
		const timer = setTimeout(() => {
			disposables.dispose();
			reject(new Error('The generated folder did not become the active workspace before Git initialization.'));
		}, timeoutMs);
		disposables.add({ dispose: () => clearTimeout(timer) });
		const checkWorkspace = () => {
			if (contextService.isCurrentWorkspace(folder)) {
				disposables.dispose();
				resolve();
			}
		};
		disposables.add(contextService.onDidChangeWorkspaceFolders(checkWorkspace));
		disposables.add(contextService.onDidChangeWorkbenchState(checkWorkspace));
		checkWorkspace();
	});
}
