/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import type { IWorkspaceDirectory, IWorkspaceReaderClock } from '../workspaceReader';
import { FakeFileSystem } from './workspaceReaderFixtures';

export class SafetyFileSystem extends FakeFileSystem {
	private readonly aliases = new Map<string, string>();
	readonly realpaths: string[] = [];
	readGate?: Promise<void>;
	releaseReads?: () => void;
	onOpenDirectory?: () => void;
	activeReads = 0;
	maxConcurrentReads = 0;

	addSymlink(value: string, target: string): void {
		const item = path.posix.normalize(value);
		this.nodes.set(item, { info: { kind: 'symlink', size: 0 }, bytes: new Uint8Array() });
		this.entries.get(path.posix.dirname(item))?.push({ name: path.posix.basename(item), kind: 'symlink' });
		this.aliases.set(item, path.posix.normalize(target));
	}

	aliasRealpath(value: string, target: string): void { this.aliases.set(path.posix.normalize(value), path.posix.normalize(target)); }

	override async realpath(value: string): Promise<string> {
		const item = path.posix.normalize(value);
		this.realpaths.push(item);
		return this.aliases.get(item) ?? item;
	}

	override async openDirectory(value: string): Promise<IWorkspaceDirectory> {
		this.onOpenDirectory?.();
		return super.openDirectory(value);
	}

	override async readFileBounded(value: string, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
		this.activeReads++;
		this.maxConcurrentReads = Math.max(this.maxConcurrentReads, this.activeReads);
		try {
			await this.readGate;
			return await super.readFileBounded(value, maxBytes, signal);
		} finally {
			this.activeReads--;
		}
	}
}

export class FakeClock implements IWorkspaceReaderClock {
	value = 0;
	now(): number { return this.value; }
	advance(milliseconds: number): void { this.value += milliseconds; }
}

export function createSafetyFileSystem(): SafetyFileSystem {
	const fileSystem = new SafetyFileSystem();
	fileSystem.addDirectory('/workspace');
	return fileSystem;
}
