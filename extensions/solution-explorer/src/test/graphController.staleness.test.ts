/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { createGraphController, type IGraphControllerOptions } from '../graphController';
import type { IGraphDiagnostic, IWorkspaceGraph } from '../model';

function graph(name: string, diagnostics: readonly IGraphDiagnostic[] = []): IWorkspaceGraph {
	const id = `workspace:${name}`;
	return { rootIds: [id], nodes: [{ id, kind: 'workspace', label: name, resourceUri: `file:///${name}`, childIds: [] }], diagnostics };
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(complete => { resolve = complete; });
	return { promise, resolve };
}

suite('workspace graph controller staleness and failure', () => {
	test('discards a stale asynchronous read after a newer refresh publishes', async () => {
		const scans: { readonly signal: AbortSignal; readonly result: ReturnType<typeof deferred<IWorkspaceGraph>> }[] = [];
		const published: IWorkspaceGraph[] = [];
		const options: IGraphControllerOptions = {
			workspaceRoots: ['/workspace'],
			scan: (_roots, signal) => {
				const result = deferred<IWorkspaceGraph>();
				scans.push({ signal, result });
				return result.promise;
			},
			publish: value => published.push(value),
		};
		const controller = createGraphController(options);
		const stale = controller.refresh();
		const current = controller.refresh();
		assert.strictEqual(scans[0].signal.aborted, true);
		scans[1].result.resolve(graph('current'));
		await current;
		scans[0].result.resolve(graph('stale'));
		await stale;
		assert.deepStrictEqual(controller.getCurrentGraph()?.rootIds, ['workspace:current']);
		assert.ok(published.every(snapshot => !snapshot.nodes.some(node => node.label === 'stale')));
		controller.dispose();
	});

	test('invalidates old workspace membership and suppresses its late read after root replacement', async () => {
		const scans: { readonly roots: readonly string[]; readonly signal: AbortSignal; readonly result: ReturnType<typeof deferred<IWorkspaceGraph>> }[] = [];
		const published: IWorkspaceGraph[] = [];
		const controller = createGraphController({
			workspaceRoots: ['/workspace/old'],
			scan: (roots, signal) => {
				const result = deferred<IWorkspaceGraph>();
				scans.push({ roots, signal, result });
				return result.promise;
			},
			publish: value => published.push(value),
		});
		const oldScan = controller.refresh();
		const newScan = controller.setWorkspaceRoots(['/workspace/new']);
		assert.strictEqual(scans[0].signal.aborted, true);
		assert.deepStrictEqual(scans.map(scan => scan.roots), [['/workspace/old'], ['/workspace/new']]);
		assert.ok(published.some(snapshot => snapshot.diagnostics.some(diagnostic => diagnostic.code === 'workspace-scan-pending')));
		scans[1].result.resolve(graph('new'));
		await newScan;
		scans[0].result.resolve(graph('old'));
		await oldScan;
		assert.deepStrictEqual(controller.getCurrentGraph()?.rootIds, ['workspace:new']);
		assert.ok(published.every(snapshot => !snapshot.nodes.some(node => node.label === 'old')));
		controller.dispose();
	});

	test('retains the last truthful partial graph and adds failure diagnostics after refresh rejection', async () => {
		let scans = 0;
		const partial: IGraphDiagnostic = { id: 'partial:1', code: 'unsupported-project-pattern', message: 'An item pattern is unsupported.', severity: 'warning' };
		const controller = createGraphController({
			workspaceRoots: ['/workspace'],
			scan: async () => {
				scans++;
				if (scans === 1) { return graph('workspace', [partial]); }
				throw new Error('controlled reader failure');
			},
			publish: () => undefined,
		});
		await controller.refresh();
		await controller.refresh();
		assert.deepStrictEqual(controller.getCurrentGraph()?.nodes.map(node => node.label), ['workspace']);
		assert.deepStrictEqual(controller.getCurrentGraph()?.diagnostics.map(value => value.code), ['unsupported-project-pattern', 'workspace-scan-failed']);
		controller.dispose();
	});
});
