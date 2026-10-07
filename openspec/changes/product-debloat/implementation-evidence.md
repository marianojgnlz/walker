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

- Packaged product identity is Walker (`nameShort=Walker`, `applicationName=walker`, version `1.140.0`, commit `46815fa01ea4302881a5c276725a597fcf1b872e`). The effective gallery is Open VSX (`serviceUrl`, `itemUrl`, `resourceUrlTemplate`, and mapped runtime `controlUrl` all point to `open-vsx.org`). The three declared built-ins are `ms-vscode.js-debug-companion`, `ms-vscode.js-debug`, and `ms-vscode.vscode-js-profile-table`. **Commit-stamp nuance:** that packaged commit is the commit the existing packages were built from, not the current working-tree HEAD; the round-5 remediation did not re-run any package recipe, so the package observations in this file are scoped to the `46815fa01ea` build and are not fresh-from-HEAD package claims.
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

The ASAR walker skipped three JS-suffix entries that were directory-like rather than ordinary files; it reported no extraction errors. These scanner caveats do not count as extracted JS files. In both packages, the extension manifests contain no Copilot ID/name (desktop: 91 immediate / 96 recursive `package.json` files; REH: 30 immediate / 35 recursive). Packaged Walker identity, version `1.140.0`, the Open VSX gallery quartet/runtime `controlUrl`, and the three built-in debugger/profile extensions remain. The inspected removed product fields are absent. The REH root has **114** dependency package manifests, with **0** missing and **0** version mismatches against `remote/package-lock.json`.

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
- The REH package root contains **114** package-root manifests; every root path is in `remote/package-lock.json` at the matching version, with no missing or mismatched entries. The earlier **110** figure in this file was a scanner undercount (it excluded some real roots); an independent round-5 traversal that selected full `node_modules/(scope/)?package(/node_modules/(scope/)?package)*` root shapes and excluded distribution-folder manifests confirmed **114**, superseding both the 110 figure and the former "refines the earlier count of 114" rationale.
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

The T1/T2/T3/T6/T7/T8/T11 rows remain open, rather than being treated as completed by no-op infrastructure or documentation alone. Ledgered residuals include T1's consumer-less `isLoggingOnly`/proxy helper tails, T2's unused `EditorSuggestionId.newId`, T3's inert `ITelemetryData`/`telemetryExtraData` parameters, T6's disconnected but parent-pending editTelemetry deletion, T7's remaining extension-management event owners, T8's remaining extension-host startup/crash and server/CLI telemetry paths, and T11's stale `build/lib/i18n.resources.json` roots and test-harness crash-dump arguments. See `telemetry-inventory.md` and `compatibility.md` for the detailed ownership/retention evidence. (Superseded in part by the later cleanup: T1's `isLoggingOnly` readers are gone with the `telemetryUtils` minimization; T2's helper is `EditSuggestionId.newId` — that spelling, not `EditorSuggestionId` — and is removed; the W44 editTelemetry tree is physically gone; the T7 API-layer producers are pruned; the T8 extension-host startup/crash and crash-reporter argv paths are removed, leaving `test/**` harness crash-dump arguments as the recorded T11 residual; the i18n roots are reconciled in the remediation pass.)

### Unperformed commands and environment gaps

- Cross-target package commands not run from the repository root: `npm run gulp vscode-darwin-x64` and `npm run gulp vscode-win32-x64`. No macOS or Windows native package/startup smoke was performed in this Linux environment. The passed macOS/Windows target-filter unit fixtures are not native package evidence.
- No isolated fresh or copied persisted profile launch was performed; no launch command was issued in this pass. No user profile, repository, key, secret or credential store was read or changed.
- No live Open VSX install/update/dependency/VSIX lifecycle or C# extension acquisition was performed. No registry access failure is claimed; the lifecycle remains untested.
- No controlled Git clone/fetch/pull/push, SSH remote, or non-account forwarding smoke was run. The authorized `./scripts/test-integration.sh --suite 'git,git-base'` command was attempted twice from the repository root with `VSCODELOGSDIR="$PWD/out-build/product-debloat-integration-logs" TMPDIR="$PWD/out-build"`; both attempts exited 1 before suite counts with `Error: Missing proxy instance MainThreadEmbeddings`. The untouched `emmet` extension suite produced the same harness error as control. This is not reported as a Git-suite pass. No live smoke command was invented for workflows whose authorized task specifies no concrete CLI invocation.

### Persisted state and review boundary

No net checkbox change remains. `P3.GREEN` was provisionally marked `[x]` after checking only producer-directory absence, then restored to `[ ]` immediately after the complete W38 scan found four tracked paths still present. The final exact checkbox scan reports 109 rows, 95 checked and 14 unchecked; `P3.GREEN` is visibly `[ ]`. The remaining unchecked rows are C5.RED/C5.TRIANGULATE, P3.GREEN, T1/T2/T3/T6/T7/T8/T11, V1.RED/V1.TRIANGULATE, and V2.TRIANGULATE/V2.REFACTOR. `tasks.md` and `apply-progress.md` record the exact unchecked task text. `deletion-review.md` was not edited. This was an evidence-only slice on the approved feature-branch-chain; no size exception, stage, commit, or production-source edit is claimed. (Preserved mid-pass snapshot, superseded by the final addendum in this file: `P3.GREEN` and `V1.RED → GREEN` are checked and the persisted scan is 109 total / 97 checked / 12 unchecked.)

## V1/V2 live Linux evidence pass (2026-10-07)

This is the live-evidence pass the round-6 verdict required. It rebuilds both Linux packages from HEAD, re-scans them at the new commit stamp, and exercises the fresh/copied packaged profiles, the live Open VSX anonymous lifecycle, and file/SSH Git workflows against a packaged workbench. It also found and fixed one packaged-product defect (extension host `MainThreadEmbeddings`), and it records the platform and environment gaps that remain. Evidence artifacts (logs, scripts, hashes, screenshots, throwaway profiles) are under `out-build/v-evidence/` on this machine; the authoritative statements are the commands and observed outputs below.

### Environment and inputs

- Branch `product-debloat`, HEAD `71759d4897cefb3ddb409a9b64285fcb0598db80`; cwd `/home/marialez/Work/walker`; Node `v24.18.0` (`export PATH="/home/marialez/.local/share/mise/installs/node/24.18.0/bin:$PATH"`), npm `11.16.0`, system git `2.55.0`.
- Session: `XDG_SESSION_TYPE=wayland`, `WAYLAND_DISPLAY=wayland-1`, `DISPLAY=:0`; the packaged Electron ran with `--ozone-platform=wayland` (visible in child-process argv). Smoke windows therefore use the Wayland/fallback output; all assertions below are DOM/CDP/log based and were captured as screenshots where useful.
- Launch flags used for every packaged UI smoke: `--no-sandbox --disable-gpu --disable-workspace-trust --disable-updates --skip-welcome --skip-release-notes --do-not-sync --user-data-dir=<isolated> --extensions-dir=<isolated> --logsPath=<isolated> --remote-debugging-port=<port> <workspace>`, launched by `out-build/v-evidence/run-packaged.sh` with isolated `HOME`/`XDG_*`.
- No credentials, tokens, real keys, or user data were read. SSH keys used are throwaway keys generated for a user-level loopback sshd.

### Fresh-from-HEAD package rebuild and re-scan

Commands (all exit 0; rerun after the defect fix so the final packages match the final source):

| Command | Result |
| --- | --- |
| `npm run build-fast` | exit 0; incremental client compile used for the fix runs |
| `npm run gulp vscode-linux-x64` | exit 0; ~1m4s; desktop package rebuilt |
| `npm run gulp vscode-reh-linux-x64` | exit 0; ~25s; REH package rebuilt |
| `../VSCode-linux-x64/bin/walker --version` | `1.140.0` / `71759d4897cefb3ddb409a9b64285fcb0598db80` / `x64` |

Both packaged `product.json` objects now carry `commit=71759d4897cefb3ddb409a9b64285fcb0598db80`, `version=1.140.0`, `nameShort=Walker`, the exact Open VSX quartet with mapped runtime `controlUrl`, and none of `defaultChatAgent`/`sessionsWindowAllowedExtensions`/`agentsTelemetryAppName`.

Marker re-scan at the new stamp (`out-build/v-evidence/28-package-rescan-final2.log`; in-place ASAR header scan, no extraction): desktop-loose 1,014 JS/maps, REH-loose 1,728 JS/maps, desktop ASAR 4,044 JS/map entries.

| Marker group | Stale V1 stamp (round 6) | Fresh-from-HEAD stamp |
| --- | --- | --- |
| `defaultChatAgent` | 12 desktop / 2 REH | **0 / 0** |
| `vscode.editorChat.start` | 4 / 1 | **0 / 0** |
| `ICustomEndpointTelemetryService` + `TelemetryLogGroup` | 12 / 2 | **0 / 0** |
| `validateTelemetryData` | 6 / 0 | **0 / 0** |
| `github.copilot-chat` | 3 desktop comments | **3 desktop, all in `.js.map` sourcesContent only** (retained generic deprecation-redirect example from `abstractExtensionManagementService.ts:171`; zero in the packaged `.js`) |

Also zero across both packages: `EditorChatFollowUp`, `copilotChatExtensionId`, `AuthorizationProvider`, `device_code`/`deviceCode`, `cleanData`, `getPiiPathsFromEnvironment`, `NullAppender`, `ITelemetryAppender`, `URIDescriptor`, `NullEndpointTelemetryService`, `getCustomTelemetryEndpoint`, `githubAccessToken`, `IIssueSubmissionHost`, `uploadIssueDataFile`, `extractIssueData`, `IGitHubUploadService`, `internalGithubButton`, `getPrivateIssueUrl`, `submitToGitHub`, `crashReporter.start`, `ElectronAgentHostStarter`, `AgentHostProcessManager`, `agentHostChannel`, `vs/platform/agentHost`, `agentHostProfile`.

Dependency-root classification (`24-dep-root-final.log`): desktop ASAR 257 roots, desktop loose `node_modules` 5, desktop `extensions` 2, REH `node_modules` 111, REH `extensions` 2; zero Copilot/Anthropic/OpenAI/Codex/Koffi roots. Retained and expected: `@vscode/sandbox-runtime`, `@vscode/ripgrep-universal`, `zod`.

**New residual finding (out of this pass's scope, for the parent).** The desktop ASAR still ships the five `@microsoft/dev-tunnels-*` packages declared in root `package.json` lines 87–91, and `package.json:40` still runs `bundle-dev-tunnels-web` against the W22-deleted `build/next/devTunnelsWeb.ts`. `git grep '@microsoft/dev-tunnels'` over `src/ build/ extensions/ remote/` finds no production importer (only `build/lib/test/dependencies.test.ts` as the invalid-version example), so these are dead cloud-tunnel dependencies in the shipped desktop package. REH does not ship them. Not changed here; the row text does not require it and lock regeneration was not authorized.

### Live Open VSX anonymous lifecycle (V2.TRIANGULATE)

Registry facts fetched from `open-vsx.org` on 2026-10-07 (also used for the C# acquisition): `muhammad-sammy.csharp` **2.145.21-g154a82fd27**, license `SEE LICENSE IN RuntimeLicenses/license.txt`, dependency `ms-dotnettools.vscode-dotnet-runtime` (3.2.0, MIT); `jakubkozera.csharp-dev-tools` 1.13.0 (license URL in manifest); local VSIX `jakubkozera.csharp-dev-tools-1.12.8.vsix` sha256 `8dd37224a06dbe78615f9fab41d6202594668c36934f09561fffb8fdd9535f04`, 35,008,530 bytes, downloaded via the Open VSX redirect to `openvsx.eclipsecontent.org`.

Verified provider gap (registry API): `ms-dotnettools/csdevkit` → HTTP 404, `github/copilot` → 404, `github/copilot-chat` → 404, `ms-dotnettools/csharp` → 404; `ms-dotnettools/vscode-dotnet-runtime` → 200. C# Dev Kit and Copilot absence is the documented expected gap and did not fail acceptance or trigger any fallback/sign-in.

Packaged CLI lifecycle (isolated profiles; `../VSCode-linux-x64/bin/walker`):

| Step | Observed |
| --- | --- |
| Fresh profile `--list-extensions --show-versions` | empty list, exit 0 |
| Default install `muhammad-sammy.csharp` (verification default on) | **exit 1**; `Error while installing extension ms-dotnettools.vscode-dotnet-runtime: Signature verification was not executed.` and the same for `muhammad-sammy.csharp`; `Failed Installing Extensions: …` (network/metadata/dependency resolution itself succeeded) |
| Same install with `"extensions.verifySignature": false` | exit 0; `Extension 'ms-dotnettools.vscode-dotnet-runtime' v3.2.0 was successfully installed.` and `Extension 'muhammad-sammy.csharp' v2.145.21-g154a82fd27 was successfully installed.` (live anonymous dependency resolution) |
| `--list-extensions --show-versions` | both IDs with versions |
| `--uninstall-extension` both | exited 0; list empty afterwards |
| Local VSIX `--install-extension <file.vsix>` | exit 0; `Extension 'jakubkozera.csharp-dev-tools-1.12.8.vsix' was successfully installed.` (later re-run on the final package refused a downgrade over the installed 1.13.0, proving version comparison) |
| Gallery update `--install-extension jakubkozera.csharp-dev-tools --force` | exit 0; `Updating the extension 'jakubkozera.csharp-dev-tools' to the version 1.13.0` |
| `--uninstall-extension jakubkozera.csharp-dev-tools` | exit 0; list empty |

**Returned gallery incompatibility.** The default-path failure is not an Open VSX access failure. `extensionManagementService.ts` requires a successful verification when `extensions.verifySignature` is true (its default) and the app `isBuilt`; `extensionSignatureVerificationService.ts` dynamically imports `@vscode/vsce-sign`, and that package is absent from the packaged app (0 ASAR entries) and from the root `package.json`/`package-lock.json` of this repository's entire history — the only references are `build/` dev tooling (`@vscode/vsce`'s allowScripts entry, `.moduleignore`, the ASAR unpack list) and the Copilot extension's own lockfile removed by W37. The CLI log records `Could not load vsce-sign module Cannot find package '@vscode/vsce-sign' imported from …/cliProcessMain.js`. Interpretation: pre-existing fork-level packaging gap, not caused by this change. The full anonymous lifecycle above works with the documented per-profile workaround `"extensions.verifySignature": false`; the parent should decide between shipping the module as a root runtime dependency (needs dependency mutation/lock authorization) or explicitly accepting the workaround. No telemetry/statistics request or account surface was involved in any step.

### Packaged profile smokes (V1.TRIANGULATE)

Three isolated profiles: fresh (`ui-fresh`, `ui-fresh2`, `ui-final`), and a copied legacy-state profile (`legacy`, copied from a seed profile, then injected with old full-reporting settings, old `argv.json` (`enable-crash-reporter: true`, `crash-reporter-id: 00000000-…`), eight orphaned state.vscdb rows (`chat.sessions`, `workbench.panel.chat.state`, `workbench.view.extension.chat`, `sessionsWindow.state`, `authentication.accounts`, `sync.enabled`, `telemetry.legacy.enabled`, `workbench.experimental.settingsSync.state`), and sentinel files in an isolated HOME and workspace.

Command-palette absence on both fresh and legacy profiles (typed queries, result rows read from the live DOM; log `18-palette-absence.log`):

| Query | Fresh profile | Legacy profile |
| --- | --- | --- |
| `sign in` | No matching commands | No matching commands |
| `account` | No matching commands | No matching commands |
| `chat` | No matching commands | No matching commands |
| `copilot` | No matching commands | (not re-run) |
| `agent` | No matching commands | (not re-run) |
| `authentication` | No matching commands | (not re-run) |
| `telemetry` | No matching commands | No matching commands |
| `crash reporter` | No matching commands | No matching commands |
| `tunnel` | No matching commands | (not re-run) |
| `settings sync` / `sync now` | only `Git: Sync`/`Git: Sync (Rebase)` | only `Git: Sync`/`Git: Sync (Rebase)` |
| `manage accounts` | only generic Extensions/Git/Tasks “Manage …” commands | (same class) |
| `publish to github` | only `Git: Publish Branch...` | (same class) |

Other live checks:

- **Fresh startup**: workbench loaded (`clone1 - Walker`), titlebar/activitybar/statusbar present, no account widget, zero dialogs; screenshots under `out-build/v-evidence/screenshots/`.
- **Copied-state restart**: the legacy profile started twice; no sign-in or chat surface appeared; old URLs `walker://github.copilot-chat/unknown-target` and `walker://workbench.action.chat.open` sent through the packaged CLI exited 0 with no dialog, no extra window and no chat command; orphaned `sessionsWindow.state` did not restore any Agents window.
- **Protected data**: after the legacy launch+restart, SHA-256 of `.ssh/id_sentinel`, `.ssh/known_hosts`, `.gitconfig`, `repo-sentinel/important.txt`, `unrelated-secret-sentinel.txt`, `settings.json`, `argv.json`, and the workspace sentinel were **all unchanged**, and all eight orphaned state.vscdb rows were still present (inert, not wiped).
- **Telemetry/argv outcome**: legacy `argv.json` was not rewritten; logs contain no `crashReporter`/`crash-reporter` lines; no `telemetry.log` exists; no `vortex.data.microsoft.com`/`mobile.events.data.microsoft.com`/`1ds`/`appender` markers appear; the only crashpad artifact is Chromium’s `Crashpad/client_id` (Electron-level, no upload channel; `crashReporter.start` is absent from the bundles).
- **Ordinary Search**: `Ctrl+Shift+F` → `sentinel` → “2 results in 1 file” with both `sentinel.txt` matches shown in the result tree.
- **Account-free toolchain**: `vscode.dotnet-toolchain` activates at startup and its output channel reports `Local .NET SDK 10.0.401 at /home/marialez/.local/share/dotnet/dotnet`; personalization stayed inert and preserved (`walker.sentinel.personalization` kept in the profile).
- Not directly exercised (recorded gaps): local-profile switching through the UI and OS-keychain secret storage. Both are unit-covered (`userDataProfileService.test` 33/33) but are not claimed as packaged-live here.

### Git and SSH workflows (V2.TRIANGULATE)

All remotes are local (`file://` and `ssh://localhost:2222`); no GitHub/Microsoft account, no OAuth, no real credentials.

- **File transport** (`bash out-build/v-evidence/git-smoke.sh`, exit 0): bare remote; clone; commit; push; feature branch; second clone commit/push; `pull --ff-only`; fetch; log/branch inspection — all with system git 2.55.0, the same binary the Git extension drives.
- **SSH transport** (`bash out-build/v-evidence/git-ssh-smoke.sh`, exit 0): throwaway user-level sshd on `127.0.0.1:2222` with generated ed25519 host/user keys, `ssh-loopback-ok`; clone, push, feature branch, second clone, and fast-forward pull over `ssh://marialez@127.0.0.1:2222/…`.
- **Packaged Git extension (live)**: in the packaged workbench the extension host opens the repo and logs `git fetch --prune` / `git pull` / fetch-all (`exthost/vscode.git/Git.log`). Externally verified hashes: `origin/main` moved `710a092` → `a174c3e` via the UI `Git: Fetch`; UI `Git: Pull` fast-forwarded `clone1` to `a174c3e` (working tree gained all lines); on the final build the UI fetch moved `origin/main` to `4f8cb99`; UI `Git: Fetch From All Remotes` created the SSH remote refs (`ssh-local/main` = `a5b0f7d`, `ssh-local/feature-ssh` = `858593a`) with `GIT_SSH_COMMAND` bound to the throwaway loopback key.
- **Blocked-suite gap closed**: `VSCODELOGSDIR="$PWD/out-build/product-debloat-integration-logs" TMPDIR="$PWD/out-build" ./scripts/test-integration.sh --suite 'git,git-base'` now exits 0 with **Git 60 passing / 2 pending** and **Git Base 14 passing** (previously it exited 1 before any counts).
- Not exercised (recorded gaps): github.com live access (the pass’s network scope is limited to open-vsx.org and suite-standard downloads; the retained Git path was already shown to have no OAuth gate), and remote-workspace terminal/extension-host/non-account port forwarding (no remote endpoint infrastructure is available in this environment).

### Packaged extension-host defect found and fixed (`MainThreadEmbeddings`)

**Pre-fix evidence (packaged product).** The first fresh packaged launch produced `Error: Missing proxy instance MainThreadEmbeddings` three times in `window1/renderer.log` at `ExtensionHostManager._createExtensionHostCustomers`, the extension host never completed customer creation, and the SCM view stayed at “Scanning folder for Git repositories…”.

**Root cause.** Commit `0debb3dcf31` (U05, C2 pair retirement) removed `import './mainThreadEmbeddings.js';` from `src/vs/workbench/api/browser/extensionHost.contribution.ts`, but `MainContext.MainThreadEmbeddings` remains in the protocol map and `MainThreadExtensionService` registers **every** `MainContext` identifier into the ext-host expectation list; `RPCProtocol.assertRegistered` throws for the first identifier without a registered customer. The ext-host side already excludes `ExtHostEmbeddings` via `disconnectedChatApiContexts`, so the same exclusion was missing on the main-thread side. The `accountFreeApi` guard test requires the contribution import to remain absent, so restoring the import was not the intended repair.

**Fix (in scope, minimal).** `src/vs/workbench/api/browser/mainThreadExtensionService.ts` now excludes the intentionally disconnected `MainContext.MainThreadEmbeddings` from the expectation list (+5/−1, comment + filter).

**Post-fix live evidence.** `window1/renderer.log` is clean; `exthost.log` shows `vscode.git-base` and `vscode.git` activating at startup (plus `vscode.debug-auto-launch`, `vscode.dotnet-toolchain`, `vscode.merge-conflict`, `vscode.emmet`); the SCM/commit-graph view renders the live repository; all Git UI fetches/pulls above were performed on the fixed build.

**Verification after the fix.** `npm run typecheck-client` exit 0; `./scripts/test.sh --run vs/workbench/api/test/common/accountFreeApi.test` **10 passing**; `./scripts/test.sh --run vs/code/test/electron-main/productDebloat.test` **31 passing**; `npm test --prefix build` **498 pass / 0 fail** (includes the macOS/Windows ripgrep target-filter fixtures); the Git integration suite passes as above. This also corrects the earlier record: the identical failure was previously classified as a pre-existing environment/harness gap, but it was a product defect affecting the packaged extension host, and the fix clears it in both the packaged app and the test harness.

### macOS/Windows platform gaps (V2.REFACTOR)

Linux-only environment; no macOS or Windows host exists. Unperformed commands and checks, recorded explicitly rather than inferred:

- `npm run gulp vscode-darwin-x64`, `npm run gulp vscode-darwin-arm64`, `npm run gulp vscode-win32-x64`, `npm run gulp vscode-win32-arm64`;
- native macOS/Windows package inspection, app startup/profile smokes, and native Git/SSH smokes on those platforms;
- native signing/notarization and platform-native dependency checks beyond the unit-level target filters (`ripgrep.test.ts` macOS/Windows cases) that pass inside `npm test --prefix build`.

The macOS/Windows **filter fixtures** are covered; native package/startup/Git/SSH behavior is not claimed.

### Ledger comparison and remaining follow-ups

- Source/physical deletion ledgers were re-checked for the debloat markers at the final stamp (table above); the only retained hits are the already-disclosed generic ones (three `github.copilot-chat` map comments; retained no-op telemetry/facade contracts covered by `productDebloat`/`T12` guards).
- Open VSX official registry and the C# provider-gap record are now live-verified; the packaged default-install signature-verification gap above is the one returned incompatibility.
- Dead `@microsoft/dev-tunnels-*` desktop dependencies and the stale `bundle-dev-tunnels-web` script are recorded for a bounded follow-up.
- Broader welcome-content/personalization redesign remains out of scope (no onboarding copy was edited).
- Throwaway processes/artifacts owned by this pass were stopped and cleaned (packaged app instances, loopback sshd, Playwright sessions and their repo-root cache directory); evidence outputs in the ignored `out-build/v-evidence/` tree were retained for review, and all disposable user-data profiles are under that tree.

### Task disposition

`V1.TRIANGULATE`, `V2.TRIANGULATE`, and `V2.REFACTOR` are checked on the evidence above, with the recorded gaps: packaged default signature verification (workaround `extensions.verifySignature: false`, parent decision requested), macOS/Windows native smokes, github.com live access, remote-workspace/port-forwarding, UI profile switching, OS-keychain secrets, and the dev-tunnels dependency residual. The nine non-V reconciliation rows were already `[x]` in the parent-owned `tasks.md` when this pass started (parent-supplied status: 106 checked / 3 remaining); this pass flipped the three V rows. Persisted accounting after the flips: **109 total / 109 checked / 0 unchecked**, no malformed checkbox or owner marker.
