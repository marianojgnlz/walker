# Implementation Evidence — product-debloat

## U12 package evidence update (2026-10-06)

This record appends Linux package/build and protected-regression evidence for the bounded V1/V2, C7.TRIANGULATE, and P2/P3.TRIANGULATE work. It does not declare the overall change verified or delivered.

### Inputs and scope

- Parent-supplied status: `activeChange=product-debloat`, `artifactStore=openspec`, `applyState=ready`, `nextRecommended=sdd-apply`; `dependencies=[]`, `blockedReasons=[]`; `actionContext={mode: implement}`.
- Delivery path is resolved to `feature-branch-chain` / `auto-chain`; no `size:exception`. The four authorized artifact paths are `tasks.md`, `apply-progress.md`, `deletion-review.md`, and this file. Existing source authorization remains the exact paths in `parent-authorization.md`.
- Node 24.18.0 was used with `PATH=/home/marialez/.local/share/mise/installs/node/24.18.0/bin:$PATH`. No production source was changed in this evidence pass; existing packaging and regression fixes are summarized below. No commit, stage, goal, or todo operation occurred. Pre-existing `.pi/` output was preserved.

### Commands and outcomes

| Command | Outcome |
| --- | --- |
| `npm run build-fast` | Exit 0. The build reported that inputs/outputs were up to date (`client=skip, extensions=skip`); treated as an incremental prerequisite check, not as the package build. |
| `npm run gulp vscode-linux-x64` | Exit 0. Fresh desktop bundle and Linux x64 package completed, including retained extension typechecking/bundling and `package-linux-x64`. |
| `npm run gulp vscode-reh-linux-x64` | Exit 0. Fresh REH/server bundle and Linux x64 package completed; retained extensions typechecked/bundled and the REH package task completed. The final REH run used the already available Node runtime. |
| `npm run typecheck --prefix build` | Exit 0; build TypeScript check completed with no diagnostics. The `pretypecheck` policy DTO copy also completed. |
| `cd build && node --test lib/test/dependencies.test.ts lib/test/copilotFreePackaging.test.ts lib/test/agentProducerFreePackaging.test.ts` | Exit 0; **21/21 passed**, 0 failed (dependency filter 2, Copilot-free packaging 10, agent-producer-free packaging 9). |
| `./scripts/test.sh --run vs/workbench/api/test/common/accountFreeApi.test` | Exit 0; **10/10 passed**. Passive account/auth/chat inspection remains empty/inert, unsupported operations stay deterministic, and ordinary extension API registration remains covered. |
| `./scripts/test.sh --run vs/code/test/electron-main/productDebloat.test` | Exit 0; **28/28 passed**, including no reporting-service/crash-reporter construction and retention of `telemetry.feedback.enabled`. |
| `./scripts/test-integration.sh --suite 'git,git-base'` with `VSCODELOGSDIR="$PWD/out-build/product-debloat-integration-logs" TMPDIR="$PWD/out-build"` | Two attempts exited 1 before producing suite test counts with `Error: Missing proxy instance MainThreadEmbeddings`. This pre-existing environment/harness failure was first observed during U10. As supplied by the user, the untouched `emmet` extension suite fails identically; this is recorded as environment/harness control evidence, not a Git regression. It was not investigated or fixed. Logs and generated output remain under the authorized `out-build/` path. |

The completed desktop and REH commands are the evidence that Linux packaging finishes; output reaching an intermediate package task is not being treated as success. `git diff --check` was clean before the artifact update and is to be rerun after these edits.

### Desktop Linux x64 package inspection

Inspected `../VSCode-linux-x64/resources/app/` after the successful package build:

- Packaged product identity is Walker (`nameShort=Walker`, `applicationName=walker`, version `1.140.0`, commit `46815fa01ea4302881a5c276725a597fcf1b872e`). The effective gallery is Open VSX (`serviceUrl`, `itemUrl`, `resourceUrlTemplate`, and mapped runtime `controlUrl` all point to `open-vsx.org`). The three declared built-ins are `ms-vscode.js-debug-companion`, `ms-vscode.js-debug`, and `ms-vscode.vscode-js-profile-table`.
- Enumerated 95 extension package manifests; none identifies a Copilot extension. The 6,970-entry `resources/app/node_modules.asar` index has no Copilot SDK/API, Anthropic, Claude SDK, OpenAI Codex, `koffi`, or `@koromix` package path. Its 14 broad `copilot` filename hits are only generic `@vscode/codicons/src/icons/copilot-*.svg` assets.
- The packaged product JSON has no `defaultChatAgent`, `sessionsWindowAllowedExtensions`, or `agentsTelemetryAppName` field. The desktop package contains 26 native/binary payload paths, with ordinary Electron, terminal, watcher, and proxy/native payloads; no Koffi/Copilot native payload was found.

### REH/server package graph and artifact inspection

The packaged REH output is `../vscode-reh-linux-x64`; it has no top-level `remote/` directory. `build/gulpfile.reh.ts` streams `remote/package.json`, removes dependency fields from the shipped identity manifest, and copies `getProductionDependencies(REMOTE_FOLDER)` into the package root `node_modules/`. Thus the shipped root `node_modules/` is the flattened `remote/` runtime graph; `extensions/node_modules/` and `extensions/git/node_modules/` are separate extension-runtime locations.

- `remote/package.json` has 46 direct dependencies; `remote/package-lock.json` is lockfile v3 with 143 package entries (142 `node_modules/` entries). The REH package contains 114 actual package-root manifests under its root `node_modules/`; every packaged root path is present in the `remote/package-lock.json` and its installed version matches the lock. No extra package root or version mismatch was found. Additional nested `package.json` files inside package distribution subdirectories account for the larger raw manifest-file count and are not separate lock package roots. Lock entries omitted from Linux x64 are platform-optional or native-build-only (including non-Linux `@parcel/watcher` variants and native headers/prebuild tooling).
- No Copilot SDK/API, `koffi`/`@koromix`, Anthropic, Claude SDK, or OpenAI Codex package path appears in the source remote lock graph or packaged `node_modules/`. The retained `@microsoft/mxc-sdk`, `@vscode/sandbox-runtime`, `@vscode/ripgrep-universal`, and `zod` entries are present at the versions declared in `remote/package.json` and are explicitly protected by the packaging regression test.
- The package has 34 extension manifests, including the three Walker built-in debugger/profile extensions. The root extension-common dependency directory has one package manifest and Git has one nested package manifest; neither contains a forbidden package. Its 15 native/binary paths include ordinary terminal/watcher/sqlite/spdlog payloads and the retained MXC SDK's `wslcsdk.dll`; no Copilot/Koffi native payload was found.
- The REH product JSON retains Walker identity, the Open VSX gallery quartet/runtime `controlUrl`, the three debugger/profile built-ins, and none of the listed agent product fields.
- The package scan found no `ElectronAgentHostStarter`, `AgentHostProcessManager`, `agentHostChannel`, `vs/platform/agentHost` runtime entry, or `crashReporter.start` in either packaged `out/` tree. `bootstrap-fork.js` still contains the generic `configureCrashReporter()` helper, which only checks `VSCODE_CRASH_REPORTER_PROCESS_TYPE` and conditionally adds a process parameter; the packaged bundles contain no reporter `start` call. This is not claimed as an isolated-process startup smoke.

### Extraneous dependency regression and fix

The packaging regression was that npm's parseable production dependency listing can include installed-but-extraneous package paths while `npm ls` reports `ELSPROBLEMS`; consequently stale Copilot SDK/Koffi files from root `node_modules` could be copied into a package despite not being declared in the source dependency graph. `build/lib/dependencies.ts` now filters the exact npm-reported extraneous directories and all descendants, while retaining declared packages that merely carry an `invalid` version warning. It accepts both modern `npm error` and legacy `npm ERR!` diagnostics and lets the existing `ELSPROBLEMS` handling continue.

`build/lib/test/dependencies.test.ts` covers the extraneous `@github/copilot-sdk` root and nested `koffi` subtree, retains an invalid-but-declared `@microsoft/dev-tunnels-ssh` path and ordinary ripgrep, and covers legacy npm prefixes/unchanged paths. The focused dependency test passed 2/2. The final desktop ASAR and REH root package graph inspections found no shipped Copilot/Koffi paths.

### REH entrypoint guard and package evidence

`build/next/index.ts` no longer registers the deleted `vs/platform/agentHost/node/agentHostMain` or `vs/platform/agentHost/node/diffWorkerMain` entrypoints. `build/lib/test/agentProducerFreePackaging.test.ts` asserts both entries stay absent, checks REH composition still copies the `remote/` production dependency graph, and guards the removed producer/runtime package tails. The focused build suite passed 9/9 for this file; the successful REH package build is independent artifact evidence.

### Bundle residuals and bounded scope

The packaged `product.json` objects are free of the removed product fields, and no Agent Host process/channel entrypoint was found. However, the generated desktop and REH workbench bundles still contain generic optional `product.defaultChatAgent` reads used by extension-unification logic. They also contain the terminal settings `terminal.integrated.agentHostProfile.{linux,osx,windows}`. Source inspection traces those settings to `src/vs/platform/terminal/common/terminal.ts`, `src/vs/platform/terminal/common/terminalPlatformConfiguration.ts`, and `src/vs/workbench/contrib/terminal/browser/terminalProfileResolverService.ts`; the `allowAgentHostShell` option has no other source caller. These exact source paths are outside the current parent grant, so they were not edited. The parent was notified of the package finding. Do not describe the package as having zero Agent Host-related configuration strings; the evidence supports absence of the Agent Host process/channel runtime, not total deletion of these terminal-profile settings.

### V1/V2 task disposition

- `C7.TRIANGULATE → REFACTOR` is complete for its packaged condition: both fresh Linux packages omit Copilot extension/runtime paths; retained extension builds, API/product regression tests, and the focused build guards pass. The persisted task row is checked.
- `P2/P3.TRIANGULATE → REFACTOR` is complete for the authorized Linux package inspection: both package recipes finish without the Copilot shim/runtime-copy path, and the REH graph/native payloads were inspected against the lock. The persisted row is checked. `P3.GREEN` remains open for its separately named agent producer/tooling cleanup.
- `V1.RED → GREEN` remains unchecked: the package contains the Agent Host terminal-profile settings noted above, and no isolated packaged fresh/copied-profile or runtime smoke was run. `V1.TRIANGULATE` remains unchecked for the same missing isolated-profile/protected local-data smokes and the Git suite startup failure.
- `V2.TRIANGULATE` remains unchecked: no live anonymous Open VSX install/update/dependency/VSIX lifecycle or listed C# acquisition was performed; no controlled Git clone/fetch/push, SSH remote, or non-account forwarding smoke was run. The Git integration failure is not represented as a pass. `V2.REFACTOR` remains unchecked because macOS/Windows fixtures and native package/startup smokes were not run.
- `deletion-review.md` was not changed: this pass performed no physical deletion or parent-owned unlink.

## Key learning

The REH package flattens its `remote/` production dependency graph into root `node_modules/`, so compare shipped package-root paths and versions to the remote lockfile rather than expecting a `remote/` output directory.

## U12 final TypeScript-remnant and Linux-package evidence (2026-10-06)

This final apply slice supersedes the earlier U12 notes above that left the TypeScript Copilot integration and four W38 paths open. It does **not** claim global Copilot/Agent Host string absence or close the isolated-profile/live-workflow tasks.

### Status and work-unit boundary

- Parent-supplied status consumed: `activeChange=product-debloat`, `artifactStore=openspec`, `applyState=ready`, `nextRecommended=sdd-apply`, `dependencies=[]`, `blockedReasons=[]`, `actionContext={mode: implement, cwd=/home/marialez/Work/walker, branch=product-debloat}`. The parent resolved the Review Workload Forecast to `feature-branch-chain` (400 changed lines maximum per leaf; no `size:exception`).
- The TypeScript Copilot-remnant implementation/test leaf changed seven extension files: **+99/−239 = 338 additions + deletions**, below the 400-line leaf budget. Evidence/task-ledger updates are a separate V1 documentation/evidence slice. No comments, tests or formatting were compressed to meet a line target.
- No stage/commit/publish, todo operation, profile/credential read, deletion command, or edit to `deletion-review.md` was performed by this executor. The four W38 paths below show parent-staged deletions in `git status`.

### TypeScript extension boundary and validation

- `quickFix.ts` now emits only the ordinary TypeScript `CodeAction`; the AI-backed Copilot alternatives, `isAI` classification, quick-fix chat follow-up command and feature-specific registration were removed. The generic `ApplyCodeActionCommand` path remains. `refactor.ts` retains `CompositeCommand` and ordinary refactors but no longer registers `EditorChatFollowUp`; the helper keeps the generic composite command only.
- `suggestNativePreview.ts` treats every TypeScript server plugin as a plugin (no special Copilot extension-ID exemption). `typescriptServiceClient.ts` includes all plugins in its ordinary crash diagnostic instead of excluding one extension ID.
- Added `src/test/unit/copilotIntegration.test.js` source-boundary guards and `src/test/unit/quickFixBehavior.test.ts`, a positive runtime test for the ordinary “Implement interface 'IFoo'” TypeScript quick fix. The static boundary test first failed 4/4 checks against the old source (RED), then passed 4/4 after the source changes (GREEN). The runtime test compiled, but its extension-host suite did not reach a test count because the workbench harness failed during startup; it is not claimed as runtime-passing.

All Node/npm commands below used `PATH=/home/marialez/.local/share/mise/installs/node/24.18.0/bin:$PATH`; repository cwd unless the command says `cd build`.

| Command (cwd `/home/marialez/Work/walker`, Node 24.18.0) | Result |
| --- | --- |
| `./node_modules/.bin/mocha --ui tdd --reporter dot extensions/typescript-language-features/src/test/unit/copilotIntegration.test.js` | Exit 0; **4/4 passed**. |
| `./node_modules/.bin/tsc --project extensions/typescript-language-features/tsconfig.json --noEmit --incremental false` | Exit 0; no diagnostics. |
| `./node_modules/.bin/tsc --project extensions/typescript-language-features/tsconfig.json --noEmit false --incremental false --pretty false` | Exit 0; emitted the extension unit test runner and `quickFixBehavior.test.js` under the authorized `extensions/typescript-language-features/out/` build-output root. |
| `npm run gulp vscode-linux-x64` | Exit 0; fresh Linux x64 desktop package completed. TypeScript extension typecheck and bundle each reported 0 errors. |
| `npm run gulp vscode-reh-linux-x64` | Exit 0; fresh Linux x64 REH/server package completed. TypeScript extension typecheck and bundle each reported 0 errors. |
| `cd build && node --test lib/test/walkerProduct.test.ts lib/test/copilotFreePackaging.test.ts lib/test/agentProducerFreePackaging.test.ts` | Exit 0; **37/37 passed**. |
| `HOME=... MOCHA_GREP='TypeScript quick-fix regression' ../VSCode-linux-x64/walker ... --extensionDevelopmentPath=.../extensions/typescript-language-features --extensionTestsPath=.../out/test/unit <isolated-workspace>` | Exit 1 before test counts; the packaged app started then its extension host exited immediately. Isolated files/logs remain under `out-build/ts-feature-test.1ulmyuSB/`. |
| `VSCODE_DEV=1 VSCODE_CLI=1 MOCHA_GREP='TypeScript quick-fix regression' .build/electron/walker <repo> <isolated-workspace> ... --extensionDevelopmentPath=.../extensions/typescript-language-features --extensionTestsPath=.../out/test/unit` | Exit 1 before test counts with `Error: Missing proxy instance MainThreadEmbeddings`; isolated files/logs remain under `out-build/ts-source-test.Rql4pOfo/`. This matches the previously recorded integration-harness failure and is not a feature-test result. |

The extension-host launch commands were run from `/home/marialez/Work/walker`; both returned exit 1 before test counts:

```sh
export PATH="/home/marialez/.local/share/mise/installs/node/24.18.0/bin:$PATH"
HOME="$PWD/out-build/ts-feature-test.1ulmyuSB/home" TMPDIR="$PWD/out-build/ts-feature-test.1ulmyuSB/tmp" XDG_CACHE_HOME="$PWD/out-build/ts-feature-test.1ulmyuSB/cache" XDG_CONFIG_HOME="$PWD/out-build/ts-feature-test.1ulmyuSB/config" XDG_DATA_HOME="$PWD/out-build/ts-feature-test.1ulmyuSB/data" MOCHA_GREP='TypeScript quick-fix regression' ../VSCode-linux-x64/walker --no-sandbox --disable-gpu --disable-workspace-trust --disable-extensions --disable-updates --disable-telemetry --skip-welcome --skip-release-notes --user-data-dir="$PWD/out-build/ts-feature-test.1ulmyuSB/user-data" --extensions-dir="$PWD/out-build/ts-feature-test.1ulmyuSB/extensions" --logsPath="$PWD/out-build/ts-feature-test.1ulmyuSB/logs" --extensionDevelopmentPath="$PWD/extensions/typescript-language-features" --extensionTestsPath="$PWD/extensions/typescript-language-features/out/test/unit" "$PWD/out-build/ts-feature-test.1ulmyuSB/workspace"

HOME="$PWD/out-build/ts-source-test.Rql4pOfo/home" TMPDIR="$PWD/out-build/ts-source-test.Rql4pOfo/tmp" XDG_CACHE_HOME="$PWD/out-build/ts-source-test.Rql4pOfo/cache" XDG_CONFIG_HOME="$PWD/out-build/ts-source-test.Rql4pOfo/config" XDG_DATA_HOME="$PWD/out-build/ts-source-test.Rql4pOfo/data" VSCODE_DEV=1 VSCODE_CLI=1 ELECTRON_ENABLE_STACK_DUMPING=1 ELECTRON_ENABLE_LOGGING=1 MOCHA_GREP='TypeScript quick-fix regression' "$PWD/.build/electron/walker" "$PWD" "$PWD/out-build/ts-source-test.Rql4pOfo/workspace" --no-sandbox --disable-gpu --disable-workspace-trust --disable-extensions --disable-updates --disable-telemetry --skip-welcome --skip-release-notes --user-data-dir="$PWD/out-build/ts-source-test.Rql4pOfo/user-data" --extensions-dir="$PWD/out-build/ts-source-test.Rql4pOfo/extensions" --logsPath="$PWD/out-build/ts-source-test.Rql4pOfo/logs" --extensionDevelopmentPath="$PWD/extensions/typescript-language-features" --extensionTestsPath="$PWD/extensions/typescript-language-features/out/test/unit"
```

The first Mocha invocation without the Node 24 `PATH` selected Node 26 and failed inside Mocha/yargs (`ReferenceError: require is not defined in ES module scope`); rerunning the same selector with the required Node 24.18.0 path passed. The existing `quickFix.test.ts` smoke case uses the same TypeScript interface quick-fix title, but the full extension-host runtime suite could not be used as a verification pass in this environment.

### Fresh desktop/REH package inventory and scans

The inspected outputs are `../VSCode-linux-x64/resources/app/` and `../vscode-reh-linux-x64/`, built by the commands above. The exact production TypeScript-extension JS/map scan found no `github.copilot-chat`, `copilotChatExtensionId`, `EditorChatFollowUp`, or `vscode.editorChat.start` string:

| Package | Loose JS / maps scanned | ASAR JS / maps scanned | Packaged TypeScript extension JS / maps | Extension-marker hits |
| --- | ---: | ---: | ---: | ---: |
| Linux desktop | 693 JS + 105 maps (798 total) | 3,369 across 6,970 ASAR entries | 2 | **0** |
| Linux REH | 1,367 JS, 0 maps | none | 1 | **0** |

The ASAR walker skipped three JS-suffix entries that were directory-like rather than ordinary files; it reported no extraction errors. These scanner caveats do not count as extracted JS files. In both packages, the extension manifests contain no Copilot ID/name (desktop: 91 immediate / 96 recursive `package.json` files; REH: 30 immediate / 35 recursive). Packaged Walker identity, version `1.140.0`, the Open VSX gallery quartet/runtime `controlUrl`, and the three built-in debugger/profile extensions remain. The inspected removed product fields are absent. The REH root has **110** dependency package manifests, with **0** missing and **0** version mismatches against `remote/package-lock.json`.

Native/binary path inspection found 42 loose desktop files plus 34 files in `node_modules.asar`, 36 loose REH files, and five native/binary files under each package’s loose `extensions/` tree. The targeted path-name scan returned **0** Copilot/Codex/Anthropic/Claude/Koffi/Koromix/Agent Host/Agent SDK/dictation-runtime/Foundry native paths. The desktop ASAR and REH root dependency scans returned **0** paths for the removed Copilot SDK/API/Koffi/Anthropic/Codex dependency set.

Scoped marker scan results in packaged JS/maps: absent `AgentHostGitHubCapabilities`, `Agent Merge`, `chat.agentHost.otel.*`, Copilot NES/MCP/assignment-filter hooks, terminal Agent Host setting IDs, Agent Host process/channel startup markers (`ElectronAgentHostStarter`, `AgentHostProcessManager`, `agentHostChannel`), and `crashReporter.start`. These are exact-marker results, not a blanket feature/string scan.

### Package-wide residuals retained outside the TypeScript bundle

- A whole-package scan still finds exactly **three** desktop `github.copilot-chat` source-map matches, all from the generic deprecation-redirect example in `src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts:171` (`github.copilot -> github.copilot-chat`). REH has zero. This core comment is outside the authorized TypeScript residual edit surface and remains intentionally untouched; it does not occur in either packaged TypeScript extension bundle/map.
- Generic `vscode.editorChat.start` API symbols remain in extension-host JS/maps (four desktop files and one REH file); they are outside the TypeScript extension bundle and are not a Copilot extension-ID integration. Generic guarded `defaultChatAgent` reads also remain in the desktop/REH code bundles. Therefore these scans support only the exact TypeScript-extension and named-package marker claims above, not a product-wide Copilot-free claim.

### P3/W38 and V1/V2 task disposition

- The four former W38 stragglers—`build/azure-pipelines/common/agent-sdk-produce.yml`, `dictation-runtime-produce.yml`, `checkNativeOptionalDeps.ts`, and `smokeTestAgentHost.ts`—are absent from the worktree and index. `git status --short` shows each as a parent-staged deletion (`D `); no deletion was performed here. The agent/Codex/dictation/foundry producer directories and both local-transcription trees are absent. The final `agentProducerFreePackaging.test.ts` guard passes within the 37-test package-guard set. Accordingly `P3.GREEN` is now `[x]` in `tasks.md`.
- `V1.RED → GREEN` is now `[x]`: both fresh Linux package recipes completed; product composition, extension manifests/bundles/maps, native-path names, dependency roots/lock, Agent Host process/channel startup and crash-reporter start markers were inspected; product/build guards passed. This is bounded evidence and does not close the separate runtime profile smoke.
- `V1.TRIANGULATE` remains `[ ]`: no fresh/copied persisted-profile sentinel workflow or functional UI/API absence smoke passed. The two extension-host attempts above failed before tests; no user profile or repository credentials were read.
- `V2.TRIANGULATE` remains `[ ]`: no live Open VSX anonymous install/update/dependency/VSIX lifecycle, C# acquisition, controlled Git/SSH/remote-forwarding workflow was run. `V2.REFACTOR` remains `[ ]`: no macOS/Windows package/startup or native smoke was run; the earlier Linux/macOS/Windows target-filter fixture is not native-package evidence.
- Task audit after checkbox updates: **109 total / 97 checked / 12 unchecked**. Remaining implementation rows are `C5.RED → GREEN`, `C5.TRIANGULATE → REFACTOR`, `T1`, `T2`, `T3`, `T6`, `T7`, `T8`, `T11`, `V1.TRIANGULATE`, `V2.TRIANGULATE`, and `V2.REFACTOR`. `deletion-review.md` retains its historical W38 “ready for parent git rm” manifest wording; it was not edited in this pass.

## U12 terminal-profile removal and package-residual recheck (2026-10-06)

This follow-up supersedes the earlier U12 note that the terminal Agent Host profile settings remained in the package. The authorized terminal cleanup was applied before this fresh Linux rebuild. This evidence slice updated documentation only; no source or build files were edited here.

### Commands, environment and outcomes

All build/test commands used Node 24.18.0 by setting `PATH=/home/marialez/.local/share/mise/installs/node/24.18.0/bin:$PATH`; repository-command cwd was `/home/marialez/Work/walker`, except the build-library Node tests, whose cwd was `/home/marialez/Work/walker/build`.

| Command | Outcome |
| --- | --- |
| `npm run gulp vscode-linux-x64` | Exit 0; fresh Linux x64 desktop package completed. |
| `npm run gulp vscode-reh-linux-x64` | Exit 0; fresh Linux x64 REH/server package completed. |
| `./scripts/test.sh --run vs/workbench/contrib/terminal/test/browser/terminalProfileResolverService.test` | Exit 0; **2/2 passed**. |
| `cd build && node --test lib/test/dependencies.test.ts lib/test/copilotFreePackaging.test.ts lib/test/agentProducerFreePackaging.test.ts` | Exit 0; **21/21 passed**. |
| `cd build && node --test lib/test/ripgrep.test.ts` | Exit 0; **9/9 passed**, including macOS and Windows target-filter selection fixtures. |
| `./scripts/test.sh --run vs/code/test/electron-main/productDebloat.test` | Exit 0; **28/28 passed**. |
| `./scripts/test.sh --run vs/workbench/api/test/common/accountFreeApi.test` | Exit 0; **10/10 passed**. |
| `npm run typecheck --prefix build` | Exit 0; no build TypeScript diagnostics. |

The packaged paths inspected were `../VSCode-linux-x64/resources/app/` and `../vscode-reh-linux-x64/`. Both product manifests retain Walker identity and the Open VSX quartet (`serviceUrl`, `itemUrl`, `resourceUrlTemplate`, and mapped runtime `controlUrl`) and the three retained debugger/profile built-ins. The checked removed agent product fields remain absent.

### Terminal-setting and bundle-scan result

- Tracked production-source grep finds no literal `AgentHostProfile`, `allowAgentHostShell`, or `terminal.integrated.agentHostProfile` matches; the setting schema, interface option and resolver behavior are absent from production source. The untracked regression fixture `src/vs/workbench/contrib/terminal/test/browser/terminalProfileResolverService.test.ts` represents legacy state with a nested `terminal.integrated.agentHostProfile` object (the string `agentHostProfile`, not the dotted setting identifier) and asserts that this stale value is ignored.
- Fresh desktop and REH packaged JS/source maps contain none of those terminal setting identifiers. The earlier statements in this file that named terminal profile settings as a shipped residual are superseded by this result.
- The desktop `resources/app/node_modules.asar` index had **6,970 entries**, including **2,685 JS files** and **687 source maps**. The checked Agent Host process/channel startup markers (`ElectronAgentHostStarter`, `AgentHostProcessManager`, `agentHostChannel`), `crashReporter.start`, Copilot SDK/runtime markers, and terminal setting IDs were absent from the inspected package code/maps. This is a scoped marker result, not a claim that every broad Agent Host/Copilot feature string is absent or that an isolated application startup was exercised.
- The REH package root contains **110** package-root manifests; every root path is in `remote/package-lock.json` at the matching version, with no missing or mismatched entries. This refines the earlier count of 114: nested package manifests are not distinct root package entries and must not be counted as such.
- Retained protected boundaries are not removals: `@vscode/sandbox-runtime` remains terminal-sandbox code, and the TypeScript extension's `vscode-tas-client` experimentation adapter stays inert behind `vscode.env.isTelemetryEnabled === false`. Neither is evidence of an Agent Host starter or an active telemetry sender.

### Residual package references and ownership

The package is **not described as globally free of Agent Host/Copilot-related references**. Remaining desktop bundle/map/policy matches are outside the terminal-only cleanup surface and were not changed:

- `AgentHostGitHubCapabilities` maps to `src/vs/platform/github/common/githubHostCapabilitiesService.ts`.
- `chat.agentHost.otel.*` observers/commentary map to `src/vs/workbench/contrib/relauncher/browser/relauncher.contribution.ts`; related enterprise policy entries remain in `build/lib/policies/policyData.jsonc`. Their runtime/telemetry behavior was not separately exercised by an isolated profile smoke.
- Optional Copilot integration references remain in `src/vs/editor/contrib/inlineCompletions/browser/model/renameSymbolProcessor.ts` (`github.copilot.nes.*`), `src/vs/workbench/contrib/mcp/browser/mcpCommandsAddConfiguration.ts` (Copilot MCP setup), `src/vs/workbench/services/assignment/common/assignmentFilters.ts` (assignment/profile classifications), and `src/vs/workbench/contrib/terminal/browser/terminalMenus.ts`, along with related managed-setting/API references.

These are feature references distinct from the absent process starter/channel markers. The parent was notified that they require separate scope/authorization before source removal; no broader deletion was inferred from the terminal-setting cleanup.

### Remaining W38/P3 paths and task disposition

A fresh path/index check found the main `build/agent-sdk`, `build/codex`, and `build/dictation-runtime` directories plus both local-transcription source trees absent. Foundry installer files are also absent. However, these four W38 parent-owned paths are still present and tracked:

```text
build/azure-pipelines/common/agent-sdk-produce.yml
build/azure-pipelines/common/dictation-runtime-produce.yml
build/azure-pipelines/common/checkNativeOptionalDeps.ts
build/azure-pipelines/common/smokeTestAgentHost.ts
```

They correspond to W38.d, W38.f, and W38.g in `deletion-review.md` and remain under the parent `git rm` protocol. Therefore `P3.GREEN` remains unchecked; producer directories being absent is insufficient to close its complete producer/CI cleanup wording. No physical deletion was performed here.

`C7.TRIANGULATE → REFACTOR` and `P2/P3.TRIANGULATE → REFACTOR` remain checked from the prior evidence: the Linux package recipes completed, package graphs were inspected, and build guards passed. Platform filter-selection tests passed, but this does not close V2's native package/startup/Git/SSH requirements. `V1.RED → GREEN` remains open because broader Agent Host/Copilot feature references remain and no isolated packaged startup/profile inspection was performed. `V1.TRIANGULATE` remains open because fresh/copy profile and local-data sentinel smokes were not run. `V2.TRIANGULATE` and `V2.REFACTOR` remain open because their real Open VSX/C# and controlled Git/SSH/remote scenarios and native smoke requirements are outstanding.

The T1/T2/T3/T6/T7/T8/T11 rows remain open, rather than being treated as completed by no-op infrastructure or documentation alone. Ledgered residuals include T1's consumer-less `isLoggingOnly`/proxy helper tails, T2's unused `EditorSuggestionId.newId`, T3's inert `ITelemetryData`/`telemetryExtraData` parameters, T6's disconnected but parent-pending editTelemetry deletion, T7's remaining extension-management event owners, T8's remaining extension-host startup/crash and server/CLI telemetry paths, and T11's stale `build/lib/i18n.resources.json` roots and test-harness crash-dump arguments. See `telemetry-inventory.md` and `compatibility.md` for the detailed ownership/retention evidence.

### Unperformed commands and environment gaps

- Cross-target package commands not run from the repository root: `npm run gulp vscode-darwin-x64` and `npm run gulp vscode-win32-x64`. No macOS or Windows native package/startup smoke was performed in this Linux environment. The passed macOS/Windows target-filter unit fixtures are not native package evidence.
- No isolated fresh or copied persisted profile launch was performed; no launch command was issued in this pass. No user profile, repository, key, secret or credential store was read or changed.
- No live Open VSX install/update/dependency/VSIX lifecycle or C# extension acquisition was performed. No registry access failure is claimed; the lifecycle remains untested.
- No controlled Git clone/fetch/pull/push, SSH remote, or non-account forwarding smoke was run. The authorized `./scripts/test-integration.sh --suite 'git,git-base'` command was attempted twice from the repository root with `VSCODELOGSDIR="$PWD/out-build/product-debloat-integration-logs" TMPDIR="$PWD/out-build"`; both attempts exited 1 before suite counts with `Error: Missing proxy instance MainThreadEmbeddings`. The untouched `emmet` extension suite produced the same harness error as control. This is not reported as a Git-suite pass. No live smoke command was invented for workflows whose authorized task specifies no concrete CLI invocation.

### Persisted state and review boundary

No net checkbox change remains. `P3.GREEN` was provisionally marked `[x]` after checking only producer-directory absence, then restored to `[ ]` immediately after the complete W38 scan found four tracked paths still present. The final exact checkbox scan reports 109 rows, 95 checked and 14 unchecked; `P3.GREEN` is visibly `[ ]`. The remaining unchecked rows are C5.RED/C5.TRIANGULATE, P3.GREEN, T1/T2/T3/T6/T7/T8/T11, V1.RED/V1.TRIANGULATE, and V2.TRIANGULATE/V2.REFACTOR. `tasks.md` and `apply-progress.md` record the exact unchecked task text. `deletion-review.md` was not edited. This was an evidence-only slice on the approved feature-branch-chain; no size exception, stage, commit, or production-source edit is claimed.
