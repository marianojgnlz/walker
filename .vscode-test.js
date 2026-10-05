/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as os from 'os';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { defineConfig } = require('@vscode/test-cli');

/**
 * A list of extension folders who have opted into tests, or configuration objects.
 * Edit me to add more!
 *
 * @type {Array<Partial<import("@vscode/test-cli").TestConfiguration> & { label: string }>}
 */
const extensions = [
	{
		label: 'markdown-language-features',
		workspaceFolder: `extensions/markdown-language-features/test-workspace`,
		mocha: { timeout: 60_000 }
	},
	{
		label: 'ipynb',
		workspaceFolder: path.join(os.tmpdir(), `ipynb-${Math.floor(Math.random() * 100000)}`),
		mocha: { timeout: 60_000 }
	},
	{
		label: 'notebook-renderers',
		workspaceFolder: path.join(os.tmpdir(), `nbout-${Math.floor(Math.random() * 100000)}`),
		mocha: { timeout: 60_000 }
	},
	{
		label: 'vscode-colorize-tests',
		workspaceFolder: `extensions/vscode-colorize-tests/test`,
		mocha: { timeout: 60_000 }
	},
	{
		label: 'terminal-suggest',
		workspaceFolder: path.join(os.tmpdir(), `terminal-suggest-${Math.floor(Math.random() * 100000)}`),
		mocha: { timeout: 60_000 }
	},
	{
		label: 'vscode-colorize-perf-tests',
		workspaceFolder: `extensions/vscode-colorize-perf-tests/test`,
		mocha: { timeout: 6000_000 }
	},
	{
		label: 'configuration-editing',
		workspaceFolder: path.join(os.tmpdir(), `confeditout-${Math.floor(Math.random() * 100000)}`),
		mocha: { timeout: 60_000 }
	},
	{
		label: 'npm',
		workspaceFolder: path.join(os.tmpdir(), `npmout-${Math.floor(Math.random() * 100000)}`),
		mocha: { timeout: 60_000 }
	},
	{
		label: 'vscode-api-tests-folder',
		extensionDevelopmentPath: `extensions/vscode-api-tests`,
		workspaceFolder: `extensions/vscode-api-tests/testWorkspace`,
		mocha: { timeout: 60_000 },
		files: 'extensions/vscode-api-tests/out/singlefolder-tests/**/*.test.js',
	},
	{
		label: 'vscode-api-tests-workspace',
		extensionDevelopmentPath: `extensions/vscode-api-tests`,
		workspaceFolder: `extensions/vscode-api-tests/testworkspace.code-workspace`,
		mocha: { timeout: 60_000 },
		files: 'extensions/vscode-api-tests/out/workspace-tests/**/*.test.js',
	},
	{
		label: 'git-base',
		mocha: { timeout: 60_000 }
	},
	{
		label: 'copilot',
		files: 'extensions/copilot/dist/test-extension.js',
		mocha: { ui: 'tdd', timeout: 60_000 }
	}
];


const extensionDirectories = readFileSync(path.join(__dirname, 'build/npm/dirs.ts'), 'utf8');
const extensionCompilations = readFileSync(path.join(__dirname, 'build/gulpfile.extensions.ts'), 'utf8');
const githubIntegrationDiscovery = /['"]extensions\/github(?:\/tsconfig\.json)?['"]/;
const authenticationProviderDiscovery = /['"]extensions\/(?:github-authentication|microsoft-authentication)(?:\/tsconfig\.json)?['"]/;
if (githubIntegrationDiscovery.test(extensionDirectories) || githubIntegrationDiscovery.test(extensionCompilations)) {
	throw new Error('The removed GitHub integration must not be included in extension discovery or compilation.');
}
if (authenticationProviderDiscovery.test(extensionDirectories) || authenticationProviderDiscovery.test(extensionCompilations)
	|| extensions.some(extension => extension.label === 'github-authentication' || extension.label === 'microsoft-authentication')) {
	throw new Error('Removed authentication providers must not be included in extension discovery, compilation, or test labels.');
}
for (const extension of ['git', 'git-base']) {
	if (!extensionDirectories.includes(`'extensions/${extension}',`) || !extensionCompilations.includes(`'extensions/${extension}/tsconfig.json',`)) {
		throw new Error(`Retained Git extension '${extension}' must remain in discovery and compilation.`);
	}
}
for (const template of ['build/vite/workbench-vite.html', 'build/rspack/workbench-rspack.html']) {
	const configuration = readFileSync(path.join(__dirname, template), 'utf8');
	if (/&quot;trustedExtensionAuthAccess&quot;|&quot;github\.remotehub&quot;/.test(configuration)) {
		throw new Error(`Removed GitHub integration auth grants must not remain in ${template}.`);
	}
}

const integrationRunnerPaths = [
	'scripts/test-integration.sh',
	'scripts/test-integration.bat',
	'.github/skills/integration-tests/SKILL.md',
];
const integrationRunnerSources = integrationRunnerPaths.map(file => readFileSync(path.join(__dirname, file), 'utf8'));
if (integrationRunnerSources.some(source => source.includes('github-authentication'))) {
	throw new Error('Removed GitHub authentication tests must not remain in integration runner selection or documentation.');
}
if (integrationRunnerSources.some(source => !source.includes('git-base') || !source.includes('git'))) {
	throw new Error('The retained Git and Git Base integration suites must remain documented and selectable.');
}
if (!integrationRunnerSources[0].includes('if should_run_suite git; then')
	|| !integrationRunnerSources[0].includes('if should_run_suite git-base; then')) {
	throw new Error('The Bash runner must keep executable Git and Git Base suite branches.');
}
if (!integrationRunnerSources[1].includes('call :should_run_suite git || goto skip_git')
	|| !integrationRunnerSources[1].includes('call :should_run_suite git-base || goto skip_git_base')) {
	throw new Error('The Windows runner must keep executable Git and Git Base suite branches.');
}
const launchConfiguration = readFileSync(path.join(__dirname, '.vscode/launch.json'), 'utf8');
if (/extensions\/github(?:\/|["\\])|VS Code Github Tests/i.test(launchConfiguration)) {
	throw new Error('The removed GitHub extension must not have a test launch configuration.');
}
if (!launchConfiguration.includes('"name": "VS Code Git Tests"')
	|| !launchConfiguration.includes('--extensionDevelopmentPath=${workspaceFolder}/extensions/git')) {
	throw new Error('Plain Git extension test launch support must remain configured.');
}
const lintAllowLists = [
	readFileSync(path.join(__dirname, '.eslint-allowed-javascript-files'), 'utf8'),
	readFileSync(path.join(__dirname, '.eslint-allowed-bracket-notation-files'), 'utf8'),
];
if (lintAllowLists.some(source => /extensions\/(?:github-authentication|microsoft-authentication)\//.test(source))) {
	throw new Error('Removed authentication extension paths must not remain in lint allowlists.');
}
if (!lintAllowLists[1].includes('src/vs/platform/github/common/githubTransport.ts')) {
	throw new Error('Generic GitHub transport must remain in the bracket-notation allowlist.');
}

const defaultLaunchArgs = process.env.API_TESTS_EXTRA_ARGS?.split(' ') || [
	'--disable-telemetry', '--disable-experiments', '--skip-welcome', '--skip-release-notes', `--crash-reporter-directory=${__dirname}/.build/crashes`, `--logsPath=${__dirname}/.build/logs/integration-tests`, '--no-cached-data', '--disable-updates', '--use-inmemory-secretstorage', '--disable-extensions', '--disable-workspace-trust'
];

const config = defineConfig(extensions.map(extension => {
	/** @type {import('@vscode/test-cli').TestConfiguration} */
	const config = {
		platform: 'desktop',
		files: `extensions/${extension.label}/out/**/*.test.js`,
		extensionDevelopmentPath: `extensions/${extension.label}`,
		...extension,
	};

	config.mocha ??= {};
	if (process.env.BUILD_ARTIFACTSTAGINGDIRECTORY || process.env.GITHUB_WORKSPACE) {
		let suite = '';
		if (process.env.VSCODE_BROWSER) {
			suite = `${process.env.VSCODE_BROWSER} Browser Integration ${config.label} tests`;
		} else if (process.env.REMOTE_VSCODE) {
			suite = `Remote Integration ${config.label} tests`;
		} else {
			suite = `Integration ${config.label} tests`;
		}

		config.mocha.reporter = 'mocha-multi-reporters';
		config.mocha.reporterOptions = {
			reporterEnabled: 'spec, mocha-junit-reporter',
			mochaJunitReporterReporterOptions: {
				testsuitesTitle: `${suite} ${process.platform}`,
				mochaFile: path.join(
					process.env.BUILD_ARTIFACTSTAGINGDIRECTORY || process.env.GITHUB_WORKSPACE || __dirname,
					`test-results/${process.platform}-${process.arch}-${suite.toLowerCase().replace(/[^\w]/g, '-')}-results.xml`
				)
			}
		};
	}

	if (!config.platform || config.platform === 'desktop') {
		config.launchArgs = defaultLaunchArgs;
		config.useInstallation = {
			fromPath: process.env.INTEGRATION_TEST_ELECTRON_PATH || `${__dirname}/scripts/code.${process.platform === 'win32' ? 'bat' : 'sh'}`,
		};
		config.env = {
			...config.env,
			VSCODE_SKIP_PRELAUNCH: '1',
		};
	} else {
		// web configs not supported, yet
	}

	return config;
}));

export default config;
