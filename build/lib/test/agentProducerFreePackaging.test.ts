/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { readFileSync, readdirSync } from 'fs';
import * as path from 'path';
import { suite, test } from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

/**
 * Paths recorded for parent-owned physical deletion (W38). They may still be on
 * disk, so they are exempt from the "no retained surface reaches into them"
 * scans; once deleted, every assertion here keeps holding.
 */
const pendingParentDeletion = [
	'build/agent-sdk',
	'build/codex',
	'build/dictation-runtime',
	'build/azure-pipelines/common/agent-sdk-produce.yml',
	'build/azure-pipelines/common/dictation-runtime-produce.yml',
	'build/azure-pipelines/common/foundry-local.yml',
	'build/azure-pipelines/common/foundryLocalInstall.ts',
	'build/azure-pipelines/common/disableFoundryLocalInstall.ts',
	'build/azure-pipelines/common/checkNativeOptionalDeps.ts',
];

function isPendingDeletion(relativePath: string): boolean {
	return pendingParentDeletion.some(pending => relativePath === pending || relativePath.startsWith(`${pending}/`));
}

function relativeToRepo(file: string): string {
	return path.relative(repoRoot, file).replaceAll(path.sep, '/');
}

function read(relativePath: string): string {
	return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

/**
 * Every TypeScript file a build tool can load (no dependency trees), skipping
 * the trees recorded for parent-owned physical deletion.
 */
function listBuildSources(dir = path.join(repoRoot, 'build')): string[] {
	const result: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules') {
			continue;
		}
		const full = path.join(dir, entry.name);
		const relative = relativeToRepo(full);
		if (entry.isDirectory()) {
			if (!isPendingDeletion(relative)) {
				result.push(...listBuildSources(full));
			}
		} else if (entry.name.endsWith('.ts') && !isPendingDeletion(relative)) {
			result.push(full);
		}
	}
	return result;
}

/** Every pipeline definition the product build can execute. */
function listPipelineYamls(): string[] {
	const result: string[] = [];
	const collect = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				collect(full);
			} else if ((entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')) && !isPendingDeletion(relativeToRepo(full))) {
				result.push(full);
			}
		}
	};
	collect(path.join(repoRoot, 'build', 'azure-pipelines'));
	collect(path.join(repoRoot, '.github', 'workflows'));
	return result;
}

/**
 * Regression guard for the agent-producer, dictation and server-manifest
 * deprovisioning.
 *
 * The product no longer ships an agent host, so the per-platform agent SDK and
 * dictation runtime producers (`build/agent-sdk`, `build/codex`,
 * `build/dictation-runtime`), their CI templates, the `agentSdks` product stamp
 * and the exclusively agent-owned dependency inventory are all disconnected.
 * The unreachable on-device dictation consumer stack is removed with them
 * (`src/vs/platform/localTranscription`, `src/vs/workbench/services/localTranscription`,
 * their entrypoint registrations, the `dictationRuntime` contract and the
 * `foundry-local-sdk` dependency). The REH/server package graph is composed
 * from `remote/`, which must no longer declare the removed Copilot runtime.
 *
 * The assertions are deliberately textual: the producer trees are recorded for
 * parent-owned `git rm`, so they must not be required to be absent from disk —
 * only unreachable from every retained build, packaging and pipeline surface.
 */
suite('Agent-producer-free packaging pipeline', () => {

	test('no retained build module loads an agent producer', () => {
		const importers = listBuildSources()
			.filter(file => /(?:from|import)\s*(?:\(\s*)?['"][^'"]*(?:agent-sdk|dictation-runtime|build\/codex)\//.test(readFileSync(file, 'utf8')))
			.map(relativeToRepo);

		assert.deepStrictEqual(importers, [], 'no retained build module may import a producer recorded for deletion');
	});

	test('the build test suite no longer schedules producer tests', () => {
		const buildPackageJson = JSON.parse(read('build/package.json')) as { scripts?: Record<string, string> };
		const testScript = buildPackageJson.scripts?.test ?? '';

		assert.doesNotMatch(testScript, /agent-sdk/, 'the build test glob must not collect produced-SDK tests');
		assert.doesNotMatch(testScript, /\bcodex\b/, 'the build test glob must not collect Codex protocol tests');
		assert.match(testScript, /lib/, 'the retained build library tests must stay in the suite');
		assert.match(testScript, /next/, 'the retained build tooling tests must stay in the suite');
	});

	test('no pipeline references a removed agent producer or its installers', () => {
		const removed = [
			/agent-sdk-produce\.yml/,
			/dictation-runtime-produce\.yml/,
			/foundry-local\.yml/,
			/foundryLocalInstall\.ts/,
			/disableFoundryLocalInstall\.ts/,
			/checkNativeOptionalDeps/,
			/build\/agent-sdk\//,
			/build\/dictation-runtime\//,
			/build\/codex\//,
			/\.build\/agent-sdk\//,
			/\.build\/dictation-runtime\//,
		];
		const offenders: string[] = [];
		for (const file of listPipelineYamls()) {
			const source = readFileSync(file, 'utf8');
			for (const pattern of removed) {
				if (pattern.test(source)) {
					offenders.push(`${path.relative(repoRoot, file).replaceAll(path.sep, '/')}: ${pattern}`);
				}
			}
		}

		assert.deepStrictEqual(offenders, [], 'pipelines must not stage, produce or install removed agent payloads');
	});

	test('the product configuration declares no agent SDK stamps and no dictation runtime producer', () => {
		const product = read('src/vs/base/common/product.ts');
		assert.doesNotMatch(product, /IAgentSdkProductConfig|agentSdks/);
		assert.doesNotMatch(product, /IDictationRuntimeProductConfig|dictationRuntime/);

		for (const gulpfile of ['build/gulpfile.vscode.ts', 'build/gulpfile.reh.ts']) {
			const source = read(gulpfile);
			assert.doesNotMatch(source, /readAgentSdkResults|readDictationRuntimeResults/, `${gulpfile} must not read producer results`);
			assert.doesNotMatch(source, /agentSdks|dictationRuntime/, `${gulpfile} must not stamp removed agent payloads`);
		}

		// The retained on-device dictation consumer keeps its own runtime fallback
		// and the retained sandbox payload keeps its own filter.
		const engine = read('src/vs/platform/sandbox/common/terminalSandboxEngine.ts');
		assert.match(engine, /node_modules', '@vscode', 'sandbox-runtime'/);
		assert.match(read('build/gulpfile.vscode.ts'), /import \{ getMxcExcludeFilter \} from '\.\/lib\/mxc\.ts';/, 'the retained sandbox filter stays imported through its neutral module');
		assert.match(read('build/lib/mxc.ts'), /export function getMxcExcludeFilter\(/);
	});

	test('the exclusively agent-owned runtime packages are not declared dependencies', () => {
		const rootPackageJson = JSON.parse(read('package.json')) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
			optionalDependencies?: Record<string, string>;
			allowScripts?: Record<string, boolean>;
			scripts?: Record<string, string>;
		};
		const declared = {
			...rootPackageJson.dependencies,
			...rootPackageJson.devDependencies,
			...rootPackageJson.optionalDependencies,
		};

		for (const removed of ['@anthropic-ai/sdk', '@anthropic-ai/claude-agent-sdk', '@openai/codex']) {
			assert.ok(!(removed in declared), `${removed} was only consumed by the deleted agent host / protocol tooling`);
		}
		for (const script of Object.keys(rootPackageJson.scripts ?? {})) {
			assert.doesNotMatch(script, /^codex/, 'the Codex protocol scripts must be gone with their tooling');
		}

		// Retained for non-agent consumers: the terminal sandbox payload and the
		// terminal sandbox CLI (see terminalSandboxEngine.ts).
		for (const retained of ['@microsoft/mxc-sdk', '@vscode/sandbox-runtime']) {
			assert.ok(retained in declared, `${retained} still has a retained consumer`);
		}
		assert.ok(!('foundry-local-sdk' in declared), 'the on-device dictation SDK died with its only consumer');
		assert.ok(!Object.keys(rootPackageJson.allowScripts ?? {}).some(key => key.startsWith('foundry-local-sdk@')), 'the dictation SDK allow-scripts entry must be gone');

		assert.doesNotMatch(read('eslint.config.js'), /@anthropic-ai\/sdk|@anthropic-ai\/claude-agent-sdk/, 'lint import restrictions must not name removed packages');
	});

	test('the unreachable on-device dictation stack is fully deprovisioned', () => {
		// The consumer stack had zero injectors after the Chat-owned dictation UI
		// died, and its runtime producer is gone, so it was removed rather than
		// retained as inert public surface.
		for (const entrypoint of ['src/vs/workbench/workbench.desktop.main.ts', 'src/vs/workbench/workbench.web.main.ts']) {
			assert.doesNotMatch(read(entrypoint), /localTranscription/, `${entrypoint} must not register the removed dictation service`);
		}

		// No build wiring may bundle, patch or strip a payload for the removed stack.
		// This file is the guard itself, so it is excluded from its own scan.
		const wiringOffenders = listBuildSources()
			.filter(file => relativeToRepo(file) !== 'build/lib/test/agentProducerFreePackaging.test.ts')
			.filter(file => /localTranscription|foundry/i.test(readFileSync(file, 'utf8')))
			.map(relativeToRepo);
		assert.deepStrictEqual(wiringOffenders, [], 'no retained build module may reference the removed dictation stack');

		const product = read('src/vs/base/common/product.ts');
		assert.doesNotMatch(product, /IDictationRuntimeProductConfig|dictationRuntime/);

		const lock = JSON.parse(read('package-lock.json')) as { packages?: Record<string, unknown> };
		const dictationEntries = Object.keys(lock.packages ?? {}).filter(key => /foundry|adm-zip/.test(key));
		assert.deepStrictEqual(dictationEntries, [], 'the lockfile must not resolve the removed dictation SDK or its orphaned dependency');
	});

	test('the REH/server package graph declares no Copilot runtime', () => {
		const remoteManifest = JSON.parse(read('remote/package.json')) as {
			dependencies?: Record<string, string>;
			overrides?: Record<string, unknown>;
			allowScripts?: Record<string, boolean>;
		} & Record<string, unknown>;
		const dependencies = remoteManifest.dependencies ?? {};

		assert.ok(!('@github/copilot-sdk' in dependencies), 'the server package graph must not install the Copilot SDK');
		assert.ok(!('@vscode/copilot-api' in dependencies), 'the server package graph must not install the Copilot API package');
		assert.ok(!('copilotRuntimeVersion' in remoteManifest), 'the server manifest must not pin a Copilot runtime');
		assert.ok(!('koffi' in (remoteManifest.overrides ?? {})), 'the Copilot-SDK-only Koffi override must be gone');
		assert.ok(!Object.keys(remoteManifest.allowScripts ?? {}).some(key => key.startsWith('koffi@')), 'the Copilot-SDK-only Koffi allow-scripts entry must be gone');

		// The server graph keeps its retained native/sandbox/dictation packages.
		for (const retained of ['@microsoft/mxc-sdk', '@vscode/sandbox-runtime', 'zod', '@vscode/ripgrep-universal']) {
			assert.ok(retained in dependencies, `${retained} still has a retained server-graph consumer`);
		}

		const remoteLock = JSON.parse(read('remote/package-lock.json')) as { packages?: Record<string, unknown> };
		const copilotEntries = Object.keys(remoteLock.packages ?? {}).filter(key => /copilot|koffi|koromix/i.test(key));
		assert.deepStrictEqual(copilotEntries, [], 'the server lockfile must not resolve a Copilot runtime or its Koffi dependency');
		assert.ok('node_modules/zod' in (remoteLock.packages ?? {}), 'the retained zod package must stay resolved');
	});

	test('REH packaging keeps composing its server package graph from remote/', () => {
		const rehGulpfile = read('build/gulpfile.reh.ts');

		assert.match(rehGulpfile, /gulp\.src\(\['remote\/package\.json'\]/, 'REH must keep shipping the remote manifest');
		assert.match(rehGulpfile, /getProductionDependencies\(REMOTE_FOLDER\)/, 'REH must keep copying the remote production dependencies');
	});

	test('server bundler entrypoints do not reference the deleted Agent Host modules', () => {
		const buildIndex = read('build/next/index.ts');
		assert.ok(!buildIndex.includes("'vs/platform/agentHost/node/agentHostMain'"), 'server build must not try to bundle the deleted Agent Host entrypoint');
		assert.ok(!buildIndex.includes("'vs/platform/agentHost/node/diffWorkerMain'"), 'server build must not try to bundle the deleted Agent Host diff worker');
	});
});
