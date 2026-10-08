/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import type { IGraphDiagnostic } from './model';
import { SCAN_LIMITS } from './scanLimits';
import {
	nodeWorkspaceReaderFileSystem,
	openContainedDirectory,
	resolveWorkspaceRoot,
	runBoundedReads,
	validateContainedMetadata,
	WorkspaceScanGuard,
	WorkspaceScanStopped,
} from './workspaceReaderSafety';

export type WorkspaceEntryKind = 'file' | 'directory' | 'symlink' | 'other';
export type WorkspaceMetadataKind = 'solution' | 'project';

export interface IWorkspaceFileInfo {
	readonly kind: WorkspaceEntryKind;
	readonly size: number;
}

export interface IWorkspaceDirectoryEntry {
	readonly name: string;
	readonly kind: WorkspaceEntryKind;
}

export interface IWorkspaceDirectory {
	read(): Promise<IWorkspaceDirectoryEntry | undefined>;
	close(): Promise<void>;
}

/** Filesystem facade for local-only, bounded reads. */
export interface IWorkspaceReaderFileSystem {
	lstat(path: string): Promise<IWorkspaceFileInfo>;
	realpath(path: string): Promise<string>;
	openDirectory(path: string): Promise<IWorkspaceDirectory>;
	readFileBounded(path: string, maxBytes: number, signal: AbortSignal): Promise<Uint8Array>;
}

export interface IWorkspaceReaderClock {
	now(): number;
}

export interface IWorkspaceMetadataFile {
	readonly path: string;
	readonly kind: WorkspaceMetadataKind;
	readonly bytes: Uint8Array;
}

export interface IWorkspaceRootScan {
	readonly path: string;
	readonly realPath: string;
	/** Bounded local entry paths for literal project-item/glob projection; contents are not read. */
	readonly localFiles: readonly string[];
	readonly solutions: readonly IWorkspaceMetadataFile[];
	readonly projects: readonly IWorkspaceMetadataFile[];
}

export interface IWorkspaceScanResult {
	readonly roots: readonly IWorkspaceRootScan[];
	readonly diagnostics: readonly IGraphDiagnostic[];
	readonly partial: boolean;
}

export interface IWorkspaceReaderOptions {
	readonly fileSystem?: IWorkspaceReaderFileSystem;
	readonly clock?: IWorkspaceReaderClock;
}

interface IMetadataCandidate {
	readonly path: string;
	readonly kind: WorkspaceMetadataKind;
	readonly root: MutableRoot;
}

interface MutableRoot {
	readonly path: string;
	readonly realPath: string;
	readonly localFiles: string[];
	readonly solutions: IWorkspaceMetadataFile[];
	readonly projects: IWorkspaceMetadataFile[];
}

const systemClock: IWorkspaceReaderClock = { now: () => Date.now() };

function metadataKind(name: string): WorkspaceMetadataKind | undefined {
	const extension = path.extname(name).toLowerCase();
	return extension === '.sln' || extension === '.slnx' ? 'solution' : extension === '.csproj' || extension === '.shproj' ? 'project' : undefined;
}

function excludedDirectory(name: string): boolean {
	const normalized = name.toLowerCase();
	return normalized === '.git' || normalized === 'bin' || normalized === 'obj';
}

/** Discovers and reads only bounded local solution/project metadata under selected roots. */
export function createWorkspaceReader(options: IWorkspaceReaderOptions = {}) {
	const fileSystem = options.fileSystem ?? nodeWorkspaceReaderFileSystem;
	const clock = options.clock ?? systemClock;

	async function scan(rootPaths: readonly string[], signal?: AbortSignal): Promise<IWorkspaceScanResult> {
		const diagnostics: IGraphDiagnostic[] = [];
		let diagnosticId = 0;
		const addDiagnostic = (code: string, message: string, resourceUri?: string): void => {
			diagnostics.push({
				id: `workspace-reader:${code}:${diagnosticId++}`,
				code,
				message,
				severity: 'warning',
				...(resourceUri === undefined ? {} : { resourceUri }),
			});
		};
		const guard = new WorkspaceScanGuard(clock, signal, (code, message) => addDiagnostic(code, message));
		const roots: MutableRoot[] = [];
		const candidates: IMetadataCandidate[] = [];
		let directoryEntries = 0;
		let graphNodes = 0;
		let solutionCount = 0;
		let projectCount = 0;
		let stopTraversal = false;
		let entryLimitReported = false;
		let depthLimitReported = false;
		let solutionLimitReported = false;
		let projectLimitReported = false;

		try {
			for (const inputPath of rootPaths) {
				guard.check();
				if (graphNodes >= SCAN_LIMITS.graphNodes) {
					addDiagnostic('graph-node-limit', `Workspace graph exceeds ${SCAN_LIMITS.graphNodes} nodes.`, inputPath);
					break;
				}
				if (!path.isAbsolute(inputPath) || /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(inputPath)) {
					addDiagnostic('unsupported-workspace-root', 'Only absolute local filesystem roots are scanned.', inputPath);
					continue;
				}
				const resolvedRoot = await resolveWorkspaceRoot(fileSystem, inputPath, guard, (code, message, resource) => addDiagnostic(code, message, resource));
				if (!resolvedRoot) { continue; }
				const { path: absolutePath, realPath: realRoot } = resolvedRoot;
				const root: MutableRoot = { path: absolutePath, realPath: realRoot, localFiles: [], solutions: [], projects: [] };
				roots.push(root);
				graphNodes++;
				const stack = [{ directory: realRoot, depth: 0 }];
				const visited = new Set<string>();

				while (stack.length > 0 && !stopTraversal && !guard.stopped) {
					guard.check();
					const current = stack.pop()!;
					let handle: IWorkspaceDirectory | undefined;
					try {
						handle = await openContainedDirectory(fileSystem, current.directory, realRoot, visited, guard, (code, message, resource) => addDiagnostic(code, message, resource));
					} catch (error) {
						if (guard.stopped) { break; }
						addDiagnostic('directory-read-failed', String(error), current.directory);
						continue;
					}
					if (!handle) { continue; }

					try {
						while (!guard.stopped && !stopTraversal) {
							guard.check();
							const entry = await handle.read();
							guard.check();
							if (!entry) { break; }
							if (directoryEntries >= SCAN_LIMITS.directoryEntries) {
								if (!entryLimitReported) {
									addDiagnostic('directory-entry-limit', `Workspace discovery exceeds ${SCAN_LIMITS.directoryEntries} entries.`, current.directory);
									entryLimitReported = true;
								}
								stopTraversal = true;
								break;
							}
							directoryEntries++;
							if (entry.kind === 'symlink') { continue; }
							const childPath = path.join(current.directory, entry.name);
							if (entry.kind === 'directory') {
								if (excludedDirectory(entry.name)) { continue; }
								if (current.depth >= SCAN_LIMITS.directoryDepth) {
									if (!depthLimitReported) {
										addDiagnostic('directory-depth-limit', `Workspace discovery exceeds depth ${SCAN_LIMITS.directoryDepth}.`, childPath);
										depthLimitReported = true;
									}
									continue;
								}
								stack.push({ directory: childPath, depth: current.depth + 1 });
								continue;
							}
							if (entry.kind !== 'file') { continue; }
							root.localFiles.push(childPath);
							const kind = metadataKind(entry.name);
							if (!kind) { continue; }
							if (graphNodes >= SCAN_LIMITS.graphNodes) {
								addDiagnostic('graph-node-limit', `Workspace graph exceeds ${SCAN_LIMITS.graphNodes} nodes.`, childPath);
								stopTraversal = true;
								continue;
							}
							if (kind === 'solution' && solutionCount >= SCAN_LIMITS.solutions) {
								if (!solutionLimitReported) { addDiagnostic('solution-limit', `Workspace discovery exceeds ${SCAN_LIMITS.solutions} solutions.`, childPath); solutionLimitReported = true; }
								continue;
							}
							if (kind === 'project' && projectCount >= SCAN_LIMITS.projects) {
								if (!projectLimitReported) { addDiagnostic('project-limit', `Workspace discovery exceeds ${SCAN_LIMITS.projects} projects.`, childPath); projectLimitReported = true; }
								continue;
							}
							candidates.push({ path: childPath, kind, root });
							graphNodes++;
							if (kind === 'solution') { solutionCount++; } else { projectCount++; }
						}
					} finally {
						await handle.close();
					}
				}
			}
		} catch (error) {
			if (!(error instanceof WorkspaceScanStopped)) { addDiagnostic('workspace-scan-failed', String(error)); }
		}

		const readCandidate = async (candidate: IMetadataCandidate): Promise<void> => {
			try {
				guard.check();
				const info = await validateContainedMetadata(fileSystem, candidate.path, candidate.root.realPath, guard, (code, message, resource) => addDiagnostic(code, message, resource));
				if (!info) { return; }
				if (!Number.isSafeInteger(info.size) || info.size < 0) {
					addDiagnostic('invalid-metadata-size', 'Metadata file reported an invalid size.', candidate.path);
					return;
				}
				if (info.size > SCAN_LIMITS.metadataFileBytes) {
					addDiagnostic('metadata-file-too-large', `Metadata file exceeds ${SCAN_LIMITS.metadataFileBytes} bytes.`, candidate.path);
					return;
				}
				const bytes = await fileSystem.readFileBounded(candidate.path, SCAN_LIMITS.metadataFileBytes, guard.controller.signal);
				guard.check();
				if (bytes.byteLength > SCAN_LIMITS.metadataFileBytes) {
					addDiagnostic('metadata-read-overflow', `Bounded metadata read exceeded ${SCAN_LIMITS.metadataFileBytes} bytes.`, candidate.path);
					return;
				}
				const file = { path: candidate.path, kind: candidate.kind, bytes };
				(candidate.kind === 'solution' ? candidate.root.solutions : candidate.root.projects).push(file);
			} catch (error) {
				if (guard.stopped) { return; }
				if (signal?.aborted) { guard.check(); }
				addDiagnostic(error instanceof RangeError ? 'metadata-file-too-large' : 'metadata-read-failed', String(error), candidate.path);
			}
		};
		try {
			await runBoundedReads(candidates, SCAN_LIMITS.concurrentReads, readCandidate);
		} catch (error) {
			if (!(error instanceof WorkspaceScanStopped)) { addDiagnostic('metadata-read-failed', String(error)); }
		}
		guard.dispose();
		return {
			roots: roots.map(root => ({ ...root, localFiles: [...root.localFiles], solutions: [...root.solutions], projects: [...root.projects] })),
			diagnostics,
			partial: diagnostics.length > 0,
		};
	}

	return { scan };
}
