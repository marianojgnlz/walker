/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { IWorkspaceDirectory, IWorkspaceFileInfo, IWorkspaceReaderClock, IWorkspaceReaderFileSystem } from './workspaceReader';
import { SCAN_LIMITS } from './scanLimits';

export class WorkspaceScanStopped extends Error { }

export class WorkspaceScanGuard {
	readonly controller = new AbortController();
	stopped = false;
	private readonly startTime: number;
	private readonly abortListener = () => this.stop('scan-cancelled', 'Workspace scanning was cancelled.');

	constructor(private readonly clock: IWorkspaceReaderClock, private readonly externalSignal: AbortSignal | undefined, private readonly report: (code: string, message: string) => void) {
		this.startTime = clock.now();
		if (externalSignal?.aborted) {
			this.stop('scan-cancelled', 'Workspace scanning was cancelled.');
		} else {
			externalSignal?.addEventListener('abort', this.abortListener, { once: true });
		}
	}

	check(): void {
		if (!this.stopped && this.clock.now() - this.startTime > SCAN_LIMITS.workDurationMs) {
			this.stop('work-time-budget', `Workspace scan exceeded ${SCAN_LIMITS.workDurationMs} ms.`);
		}
		if (this.stopped) { throw new WorkspaceScanStopped(); }
	}

	dispose(): void {
		this.externalSignal?.removeEventListener('abort', this.abortListener);
	}

	private stop(code: string, message: string): void {
		if (!this.stopped) {
			this.stopped = true;
			this.report(code, message);
			this.controller.abort();
		}
	}
}

export function isPathWithin(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative.length === 0 || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

export async function resolveWorkspaceRoot(fileSystem: IWorkspaceReaderFileSystem, inputPath: string, guard: WorkspaceScanGuard, report: (code: string, message: string, path: string) => void): Promise<{ path: string; realPath: string } | undefined> {
	const absolutePath = path.resolve(inputPath);
	try {
		const realPath = await fileSystem.realpath(absolutePath);
		guard.check();
		const info = await fileSystem.lstat(realPath);
		guard.check();
		if (info.kind !== 'directory') {
			report('invalid-workspace-root', 'Workspace root is not a local directory.', absolutePath);
			return undefined;
		}
		return { path: absolutePath, realPath };
	} catch (error) {
		if (guard.stopped) { throw error; }
		report('workspace-root-unavailable', String(error), absolutePath);
		return undefined;
	}
}

export async function openContainedDirectory(fileSystem: IWorkspaceReaderFileSystem, directoryPath: string, rootPath: string, visited: Set<string>, guard: WorkspaceScanGuard, report: (code: string, message: string, path: string) => void): Promise<IWorkspaceDirectory | undefined> {
	const info = await fileSystem.lstat(directoryPath);
	guard.check();
	if (info.kind !== 'directory') {
		report(info.kind === 'symlink' ? 'symlink-skipped' : 'not-directory', 'A non-directory entry was not traversed.', directoryPath);
		return undefined;
	}
	const realDirectory = await fileSystem.realpath(directoryPath);
	guard.check();
	if (!isPathWithin(rootPath, realDirectory)) {
		report('workspace-escape', 'Directory realpath leaves the selected root.', directoryPath);
		return undefined;
	}
	if (visited.has(realDirectory)) { return undefined; }
	visited.add(realDirectory);
	const handle = await fileSystem.openDirectory(directoryPath);
	try { guard.check(); } catch (error) { await handle.close(); throw error; }
	return handle;
}

export async function validateContainedMetadata(fileSystem: IWorkspaceReaderFileSystem, filePath: string, rootPath: string, guard: WorkspaceScanGuard, report: (code: string, message: string, path: string) => void): Promise<IWorkspaceFileInfo | undefined> {
	const info = await fileSystem.lstat(filePath);
	guard.check();
	if (info.kind !== 'file') {
		report(info.kind === 'symlink' ? 'symlink-skipped' : 'metadata-not-file', 'Metadata path changed to a non-file entry.', filePath);
		return undefined;
	}
	const realFile = await fileSystem.realpath(filePath);
	guard.check();
	if (!isPathWithin(rootPath, realFile)) {
		report('workspace-escape', 'Metadata file realpath leaves the selected root.', filePath);
		return undefined;
	}
	return info;
}

export async function runBoundedReads<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
	let next = 0;
	const runWorker = async (): Promise<void> => {
		while (true) {
			const item = items[next++];
			if (item === undefined) { return; }
			await worker(item);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
}

export const nodeWorkspaceReaderFileSystem: IWorkspaceReaderFileSystem = {
	async lstat(value) {
		const info = await fs.lstat(value);
		return { kind: info.isSymbolicLink() ? 'symlink' : info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other', size: info.size };
	},
	realpath: value => fs.realpath(value),
	async openDirectory(value) {
		const directory = await fs.opendir(value);
		return {
			async read() {
				const entry = await directory.read();
				return entry ? {
					name: entry.name,
					kind: entry.isSymbolicLink() ? 'symlink' : entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
				} : undefined;
			},
			close: () => directory.close(),
		};
	},
	async readFileBounded(value, maxBytes, signal) {
		const handle = await fs.open(value, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
		try {
			if (signal.aborted) { throw new Error('cancelled'); }
			const info = await handle.stat();
			if (!info.isFile() || info.size > maxBytes) { throw new RangeError('metadata-file-too-large-or-not-file'); }
			const buffer = Buffer.allocUnsafe(maxBytes + 1);
			let total = 0;
			while (total < buffer.length) {
				if (signal.aborted) { throw new Error('cancelled'); }
				const result = await handle.read(buffer, total, buffer.length - total, total);
				if (result.bytesRead === 0) { break; }
				total += result.bytesRead;
			}
			return buffer.subarray(0, total);
		} finally {
			await handle.close();
		}
	},
};
