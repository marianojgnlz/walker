/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import type { IWorkspaceDirectory, IWorkspaceDirectoryEntry, IWorkspaceFileInfo, IWorkspaceReaderFileSystem } from '../workspaceReader';

interface IFakeNode { readonly info: IWorkspaceFileInfo; readonly bytes: Uint8Array; }

export class FakeFileSystem implements IWorkspaceReaderFileSystem {
	protected readonly nodes = new Map<string, IFakeNode>();
	protected readonly entries = new Map<string, IWorkspaceDirectoryEntry[]>();
	readonly readRequests: Array<{ path: string; maxBytes: number }> = [];
	closedDirectories = 0;

	addDirectory(value: string): void {
		const item = path.posix.normalize(value);
		this.nodes.set(item, { info: { kind: 'directory', size: 0 }, bytes: new Uint8Array() });
		this.entries.set(item, []);
		this.entries.get(path.posix.dirname(item))?.push({ name: path.posix.basename(item), kind: 'directory' });
	}

	addFile(value: string, size = 1, bytes = new Uint8Array([1])): void {
		const item = path.posix.normalize(value);
		this.nodes.set(item, { info: { kind: 'file', size }, bytes });
		this.entries.get(path.posix.dirname(item))?.push({ name: path.posix.basename(item), kind: 'file' });
	}

	async lstat(value: string): Promise<IWorkspaceFileInfo> {
		return this.nodes.get(path.posix.normalize(value))?.info ?? { kind: 'other', size: 0 };
	}

	async realpath(value: string): Promise<string> { return path.posix.normalize(value); }

	async openDirectory(value: string): Promise<IWorkspaceDirectory> {
		const children = this.entries.get(path.posix.normalize(value)) ?? [];
		let cursor = 0;
		return { read: async () => children[cursor++], close: async () => { this.closedDirectories++; } };
	}

	async readFileBounded(value: string, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
		const item = path.posix.normalize(value);
		this.readRequests.push({ path: item, maxBytes });
		if (signal.aborted) { throw new Error('cancelled'); }
		const bytes = this.nodes.get(item)?.bytes ?? new Uint8Array();
		return bytes.length > maxBytes ? bytes.slice(0, maxBytes + 1) : bytes;
	}
}

export function createFileSystem(): FakeFileSystem {
	const fileSystem = new FakeFileSystem();
	fileSystem.addDirectory('/workspace');
	return fileSystem;
}
