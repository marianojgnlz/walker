# Tasks: .NET Toolchain Bootstrap

Approved proposal and read-back specs/design are the implementation inputs. Parent owns workload consent, delivery gates, session todos, and any goal; this file contains implementation work only. Completed implementation tasks are marked below. All paths below are repository-relative. `E` means `extensions/dotnet-toolchain`; `O` means `src/vs/workbench/contrib/welcomeOnboarding`.

## Review Workload Forecast

Estimated changed lines: **4,450–6,690 additions + deletions**, including implementation, tests, localized strings, extension metadata, and operational documentation; OpenSpec artifact diffs are additional. Do not use net line counts. Proposed 20 focused review units include tests; any measured unit over 400 must be subdivided, not compressed or stripped of coverage.

Delivery strategy: ask-on-risk
Review budget: 400
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Recommended pending choice: `feature-branch-chain` so partially wired installation/auth-removal slices are not shipped. `stacked-to-main` is possible only with safe intermediate behavior. Parent must resolve the choice BEFORE apply; this plan does not grant an exception or choose a strategy. Core rollback always retains account-free continuation/personalization. No release/compliance gate is represented as an implementation checkbox.

## Review unit boundaries

Each unit starts from its predecessor's passing state, includes the specified RED/GREEN/triangulation/refactor cycle, and ends with focused tests passing. The order is detection/verification → install lifecycle → onboarding → packaged activation. New pure modules need not be activated until their full operation is wired. Units are independently reviewable against their predecessor, not claims of independently releasable features.

| Unit | Lines | Start → finish | Verification boundary | Rollback boundary |
| --- | ---: | --- | --- | --- |
| A1 | 160–240 | No extension → isolated harness/contracts | Fixture tests and extension typecheck | Remove unactivated scaffolding |
| A2 | 240–340 | Harness → bounded probe process adapter | Spawn/timeouts/limits/env tests | Remove unused adapter; no live process remains |
| A3 | 240–340 | Adapter → deterministic candidate/parser layer | Platform and split-root fixtures | Restore predecessor discovery modules |
| A4 | 220–320 | Candidates → executable SDK readiness | Detection aggregate/direct-SDK probes | Remove readiness wiring; no install data |
| B1 | 200–300 | Probe → explicit selection/platform arguments | Cancel/validation/argument fixtures | Remove unexposed setup adapter |
| B2 | 240–360 | Selection → pinned trusted script retrieval | Hash/TLS/redirect/proxy cases | Disable retrieval; no SDK changes |
| B3 | 240–360 | Retrieval → cancellable process trees | Descendant/timeout/platform fixtures | Stop owned children, retain ambiguous data |
| B4 | 230–350 | Processes → cross-window exclusive lock | Two-owner/stale-token fixtures | Release only proven-owned idle locks |
| B5 | 220–340 | Lock → safe copy/stage preparation | Disk-full/link/copy isolation fixtures | Delete only owned new scratch data |
| B6 | 250–380 | Stage → journaled publication/restoration | Rename fault matrix and final-path probe | Restore preserved backup; never delete SDKs |
| B7 | 240–360 | Transaction → full installer state machine | Cancel/error/race/version fixtures | Disable setup, retain detection and SDK data |
| B8 | 220–340 | Controller → local extension commands/status | Host guard, state, dispose/facade tests | Disable setup commands; no data deletion |
| C1 | 240–350 | Existing onboarding → enterprise path removed | No GHE interaction; baseline personalize | Forward-disable affected UI; never restore auth |
| C2 | 280–390 | No GHE path → account-free first-step shell | No account/chat config requirement or calls | Keep account-free shell and continuation |
| C3 | 230–350 | Account-free shell → clean types/navigation | Step order and completion/disposal tests | Preserve new account-free step/fallback |
| C4 | 220–340 | Shell → command-driven state interaction | Schema/timeout/late response/parity tests | Unavailable/Continue fallback |
| C5 | 200–300 | Old auth styles → hero/provider CSS removed | Targeted style/DOM and theme smoke | Restore only non-auth visual fallback styles |
| C6 | 170–280 | Remaining styles → responsive setup surface | Keyboard/high-contrast/narrow viewport | Retain functional unstyled account-free controls |
| C7 | 230–350 | Wired flow → full onboarding regressions | Focused common/browser Mocha + typecheck | Disable only broken bridge; retain no-auth path |
| D1 | 180–300 | Tested sources → packaged activation proof/docs | Linux packaged lifecycle, platform gap report | Disable extension/integration; preserve SDKs |

Estimates total A: 860–1,240; B: 1,840–2,790; C: 1,570–2,360; D: 180–300. Review measured diffs at each boundary. If B6 or C2 is oversized, split transaction fault/recovery cases or provider-rendering/dispatch removal into additional coherent units without removing tests. These are review slices, not permission to ship partially implemented behavior.

## A — Detection and execution verification first

### A1 — Establish isolated test harness and contracts

- [x] A1.RED: Add `E/src/test/contracts.test.ts` and reusable injected filesystem/process fixtures defining snapshot v1 and absence/runtime-only/SDK/error outputs; verify a failing baseline without network, real home writes, or runtime vscode imports. <!-- sdd-owner: implementation -->
- [x] A1.GREEN: Add minimal `E/package.json`, `tsconfig.json`, `src/contracts.ts`, and extension-local compile/test scripts using repository Mocha (`--ui tdd`) and TypeScript tooling; keep unfinished functionality unactivated. Define test temp cleanup and narrow injected UI facade. <!-- sdd-owner: implementation -->
- [x] A1.TRIANGULATE → REFACTOR: Test malformed/schema-mismatched snapshots and isolated fixture disposal; simplify shared fixtures, run `npm run test --prefix extensions/dotnet-toolchain` and targeted extension typecheck. <!-- sdd-owner: implementation -->

### A2 — Bound process probes

- [x] A2.RED: In `E/src/test/processRunner.test.ts`, cover absolute spawn paths, shell false, safe cwd, sanitized child environment, output caps, nonzero exit, spawn failure, and 10-second/overall-budget timeout; assert no mutation of parent environment. <!-- sdd-owner: implementation -->
- [x] A2.GREEN: Implement `E/src/processRunner.ts` probe adapter with injected spawn/clock, bounded output/error diagnostics and cleanup; preserve executable paths with spaces/non-ASCII characters. <!-- sdd-owner: implementation -->
- [x] A2.TRIANGULATE → REFACTOR: Add killed-process and stale-callback cases, verify no unresolved child/listener resources, then consolidate common invocation handling and rerun focused tests/typecheck. <!-- sdd-owner: implementation -->

### A3 — Discover ordered candidates and parse inventories internally

- [x] A3.RED: Add `E/src/test/candidates.test.ts` and parser fixtures for managed/PATH/user/system precedence, Linux runtime PATH plus `~/.local/share/dotnet` SDK, Windows/macOS roots, symlink deduplication, empty/relative/workspace PATH exclusions, and inaccessible candidates. <!-- sdd-owner: implementation -->
- [x] A3.GREEN: Implement `E/src/candidates.ts` and inventory parsing in `E/src/probe.ts` per D2, with absolute paths, realpath checks, deterministic limits, and no workspace/global.json-based SDK selection. <!-- sdd-owner: implementation -->
- [x] A3.TRIANGULATE → REFACTOR: Add malformed output/path injection, duplicate versions/roots, missing executable, and unsupported architecture cases; distinguish absence from errors, keep only reusable parsing helpers, and rerun focused tests. <!-- sdd-owner: implementation -->

### A4 — Verify SDK execution and aggregate readiness

- [x] A4.RED: Add `E/src/test/probe.test.ts` cases for runtime-only, host-only/missing, managed Ready, permission/timeout failure, error plus valid later SDK, and an SDK listed but unable to execute. <!-- sdd-owner: implementation -->
- [x] A4.GREEN: Complete `E/src/probe.ts`: independent SDK/runtime enumeration, selected SDK `dotnet exec .../MSBuild.dll -nologo -version` usability check, candidate aggregation, actual version/path result, and expected-version managed-only verification helper. <!-- sdd-owner: implementation -->
- [x] A4.TRIANGULATE → REFACTOR: Verify hostile workspace global.json has no influence, older usable SDK fallback stays internal, and caps fail truthfully; run all detection tests and simplify shared probe logic before install work. <!-- sdd-owner: implementation -->

## B — Install lifecycle, then extension-owned surfaces

### B1 — Require explicit choice and safe arguments

- [x] B1.RED: Add `E/src/test/selection.test.ts` covering LTS/STS/exact stable version, invalid/metacharacter/version-length input, cancel at each prompt, repeated chooser, local destination display and confirmation before any network/write/spawn. <!-- sdd-owner: implementation -->
- [x] B1.GREEN: Implement `E/src/selection.ts` and platform argument adapter: fixed interpreters, shell false, no-path, explicit mapped architecture, stage destination, and no public command argument bypass of confirmation. Localize prompt strings. <!-- sdd-owner: implementation -->
- [x] B1.TRIANGULATE → REFACTOR: Test every supported platform argument form including Windows process-scoped execution policy and path quoting, unsupported architecture/prerequisites; consolidate argument construction without string-shell interpolation. <!-- sdd-owner: implementation -->

### B2 — Fetch and validate an official script

- [x] B2.RED: Inspect the actual official `dotnet/install-scripts` revision, feed/TLS/redirect behavior, channel dry-run format, and proxy options; create `E/src/test/download.test.ts` fixtures for bad hash, redirects, TLS failure, oversized/offline responses, and supported/unsupported proxies. Stop for an explicit security blocker if no revision meets D3. <!-- sdd-owner: implementation -->
- [x] B2.GREEN: Add reviewed immutable commit URLs and calculated SHA-256 values to `E/src/scriptSource.ts`; implement `E/src/download.ts` with HTTPS-only zero-redirect policy, bounded retrieval, exclusive private script write, digest validation, user/machine proxy handling and secret redaction. Never fabricate production pins. <!-- sdd-owner: implementation -->
- [x] B2.TRIANGULATE → REFACTOR: Add channel metadata parse/version mismatch and canceled-download cases; verify only validated bytes can reach execution, document provenance and SDK-payload trust limits in `E/README.md`, and rerun trust tests. <!-- sdd-owner: implementation -->

### B3 — Stop installer process trees safely

- [x] B3.RED: Extend `E/src/test/processRunner.test.ts` with real isolated descendant-process fixtures where feasible, TERM→KILL escalation, Windows taskkill argument assertions, deactivation, and unconfirmed process-tree termination. <!-- sdd-owner: implementation -->
- [x] B3.GREEN: Extend `E/src/processRunner.ts` for cancellable installer groups/trees, hidden windows, absolute platform termination tools, 20-minute operation budget, bounded logs and exit waiting; return recovery-required when child exit cannot be proven. <!-- sdd-owner: implementation -->
- [x] B3.TRIANGULATE → REFACTOR: Test cancellation while child output floods and late exit after timeout; verify cleanup never races a live writer, then unify probe/install resource disposal without losing separate limits. <!-- sdd-owner: implementation -->

### B4 — Serialize local windows

- [x] B4.RED: Add `E/src/test/installLock.test.ts` for competing owners, repeated calls, partial metadata, token mismatch, live/ambiguous owner, lock symlink, and stale lock with possibly surviving children. <!-- sdd-owner: implementation -->
- [x] B4.GREEN: Implement `E/src/installLock.ts` atomic home-scoped mkdir/token metadata and owner-only release; expose read-only other-window busy/recovery state, never time-based stale lock reclamation. <!-- sdd-owner: implementation -->
- [x] B4.TRIANGULATE → REFACTOR: Exercise two independent controllers/processes against one temporary home, metadata race and release-after-cancel; validate containment and conservative stale-lock diagnostics, then rerun lock tests. <!-- sdd-owner: implementation -->

### B5 — Prepare stages without touching prior SDKs

- [x] B5.RED: Add `E/src/test/transaction.test.ts` cases for pre-existing managed SDK bytes, copy failure, disk-full, symlink/reparse points, file permissions, and cancellation during copy. <!-- sdd-owner: implementation -->
- [x] B5.GREEN: Implement preparation in `E/src/transaction.ts`: private owned sibling operation directory, safe path validation, versioned journal scaffold, real copies/reflinks but no hard links, and cleanup restricted to proven-owned temporary data. <!-- sdd-owner: implementation -->
- [x] B5.TRIANGULATE → REFACTOR: Mutate staged copies and assert originals remain identical; test external-link refusal and home with spaces; factor containment checks and rerun transaction fixtures. <!-- sdd-owner: implementation -->

### B6 — Publish, verify, and restore

- [x] B6.RED: Extend `E/src/test/transaction.test.ts` with injected failure/interruption before and after every rename/journal phase, final-path verification failure, Windows sharing violation, and rollback failure. <!-- sdd-owner: implementation -->
- [x] B6.GREEN: Implement journaled same-volume publication in `E/src/transaction.ts`, non-interruptible short finalization, final managed SDK execution, safe restoration, retained pre-existing backup, and recovery-required state when restoration is ambiguous. <!-- sdd-owner: implementation -->
- [x] B6.TRIANGULATE → REFACTOR: Prove original bytes survive every fault, no unrelated path can be removed, and committed installs preserve old SDKs; add phase-specific manual recovery/backup cleanup instructions to `E/README.md`, then refactor and rerun fault matrix. <!-- sdd-owner: implementation -->

### B7 — Orchestrate selection through verified completion

- [x] B7.RED: Add `E/src/test/installer.test.ts` transition cases for selected channel/exact version, zero exit without SDK, wrong expected version, download/process/probe failure, repeated request, cancellation, and prior Ready SDK surviving setup failure. <!-- sdd-owner: implementation -->
- [x] B7.GREEN: Implement `E/src/installer.ts` using selection, lock, stage, trusted download, official script, expected-version probe, publication and recheck; generation-guard state transitions and keep setup failure visible until explicit recheck. <!-- sdd-owner: implementation -->
- [x] B7.TRIANGULATE → REFACTOR: Test channel movement between dry-run and install, canceled confirmation with zero writes, canceled verification, stale probe completion and other-window busy completion; simplify controller flow and run the complete extension suite. <!-- sdd-owner: implementation -->

### B8 — Register commands, local status, output, and progress

- [x] B8.RED: Add `E/src/test/extension.test.ts` and `status.test.ts` with facade tests for synchronous command registration, startup detection only, all named states/actions, host guards (desktop local/desktop remote UI/browser/forced remote), localization and immediate disposal ownership. <!-- sdd-owner: implementation -->
- [x] B8.GREEN: Add `E/src/extension.ts` and `status.ts`, local/UI manifest and activation events, localized `package.nls.json`, `getState/recheck/setup/showOutput/showActions`, output/progress/status item and other-window refresh; forbid remote/browser probes or installs and persisted Ready assumptions. <!-- sdd-owner: implementation -->
- [x] B8.TRIANGULATE → REFACTOR: Check external command arguments cannot bypass prompts, stale lock reports recovery, credentials are redacted, cancellation is truthful, and all subscriptions/timers dispose; run extension tests/typecheck before onboarding edits. <!-- sdd-owner: implementation -->

## C — Replace onboarding authentication, then attach the command boundary

### C1 — Remove enterprise authentication behavior

- [x] C1.RED: Add focused browser fixtures in `O/test/browser/onboardingVariationA.test.ts` that reject GHE controls, enterprise configuration writes and setup calls while preserving navigation/personalization; use injected service stubs, not global product mutations. <!-- sdd-owner: implementation -->
- [x] C1.GREEN: In `O/browser/onboardingVariationA.ts`, remove enterprise form/progress/dispatch/state and associated navigation handling/imports; leave compilable predecessor behavior for remaining controls until C2, without introducing new account routes. <!-- sdd-owner: implementation -->
- [x] C1.TRIANGULATE → REFACTOR: Exercise back/escape/dismiss during the former enterprise path; remove orphan enterprise listeners/helpers, run focused browser tests and inspect measured removals before proceeding. <!-- sdd-owner: implementation -->

### C2 — Replace provider UI with an account-free shell

- [x] C2.RED: Extend browser tests to assert no default chat agent is required, no provider/disclaimer/footer sign-in UI renders, and no defaultAccountService or chat-setup command is invoked by the first step. <!-- sdd-owner: implementation -->
- [x] C2.GREEN: Replace remaining sign-in rendering and actions in `O/browser/onboardingVariationA.ts` with a localized Set up .NET toolchain shell and Continue Without Setup fallback; remove account DI/defaultChat assertion/auth-only telemetry and nudge behavior, preserving theme/keymap services. <!-- sdd-owner: implementation -->
- [x] C2.TRIANGULATE → REFACTOR: Verify personalized step footer also has no sign-in action; remove orphan auth imports/helpers and keep compilation passing. If this deletion-heavy unit exceeds 400, split provider rendering from dispatch/navigation cleanup while keeping every intermediate shell account-free. <!-- sdd-owner: implementation -->

### C3 — Clean step types, helpers, and navigation

- [x] C3.RED: Replace obsolete GHE-only expectations in `O/test/common/onboardingTypes.test.ts` with DotnetToolchain→Personalize ordering/localized titles, plus completion/back/skip expectations in the browser suite. Confirm GHE helper consumers before deletion. <!-- sdd-owner: implementation -->
- [x] C3.GREEN: Update `O/common/onboardingTypes.ts` to `onboarding.dotnetToolchain`; remove now-unused GHE definitions and residual auth navigation/cleanup fields from the renderer; preserve completion storage, theme/keymap application, and unrelated AI preference code. <!-- sdd-owner: implementation -->
- [x] C3.TRIANGULATE → REFACTOR: Test reopen/back/skip and no forced onboarding replay for completed users; run `./scripts/test.sh --run vs/workbench/contrib/welcomeOnboarding/test/common/onboardingTypes.test` and focused browser suite, then consolidate neutral continuation logic. <!-- sdd-owner: implementation -->

### C4 — Connect snapshot state without extension imports

- [x] C4.RED: Add `O/test/common/dotnetToolchain.test.ts` and client/browser tests for command/state contract parity, schema mismatch, activation failure, slow/stale responses, busy/failed/ready labels, and disposal while setup remains active. <!-- sdd-owner: implementation -->
- [x] C4.GREEN: Add `O/common/dotnetToolchain.ts` contract validation and contribution-local client/presenter (`O/browser/dotnetToolchainStep.ts` if needed); use constructor-injected ICommandService, one-second visible-state polling, state-read-only timeouts, actions and generation guards. No core imports from E. <!-- sdd-owner: implementation -->
- [x] C4.TRIANGULATE → REFACTOR: Exercise status-command setup while onboarding is visible, terminal-state refresh, extension unavailable/retry, and late callbacks after step exit; ensure no focus stealing or leaked timers, simplify adapter and run parity/common/browser suites. <!-- sdd-owner: implementation -->

### C5 — Remove unused authentication hero/provider styling

- [x] C5.RED: Identify only unused sign-in hero, disclaimer, GHE and provider selectors in `O/browser/media/variationA.css`; capture relevant DOM/style assertions or existing visual baseline with a no-account shell so cleanup cannot hide required controls. <!-- sdd-owner: implementation -->
- [x] C5.GREEN: Remove the first coherent unused auth-style block from `variationA.css`; retain personalize/shared button/focus styles and avoid unrelated visual redesign. Keep changed-line accounting inclusive of deletions. <!-- sdd-owner: implementation -->
- [x] C5.TRIANGULATE → REFACTOR: Check normal/light/high-contrast shell and personalization rendering, no references to deleted auth classes in the new renderer, and focus visibility; consolidate only new setup-related token usage. <!-- sdd-owner: implementation -->

### C6 — Finish responsive account-free styling

- [x] C6.RED: Add/extend assertions or focused UI cases for toolchain state/path wrapping, busy controls, keyboard reachability, polite status updates, narrow viewports and reduced motion. <!-- sdd-owner: implementation -->
- [x] C6.GREEN: Remove remaining sign-in nudge/icon/responsive selectors in `O/browser/media/variationA.css`; add minimal toolchain state/action styling using existing theme tokens and retain personalization media rules. <!-- sdd-owner: implementation -->
- [x] C6.TRIANGULATE → REFACTOR: Verify high contrast, screen-reader status/focus stability and long executable paths without horizontal breakage; remove unused setup classes and rerun affected UI/browser tests. <!-- sdd-owner: implementation -->

### C7 — Triangulate the complete first-run flow

- [x] C7.RED: Extend `O/test/browser/onboardingVariationA.test.ts` with end-to-end mocked-command sequences for all seven toolchain states plus unavailable, cancel/retry, disabled extension, setup dismissal, account-free completion and preserved theme/keymap operations. <!-- sdd-owner: implementation -->
- [x] C7.GREEN: Fix integration gaps only in `O` or existing E state adapters; keep extension failure non-blocking, install failure visible, and no account/chat fallback. Add no broader account-removal work. <!-- sdd-owner: implementation -->
- [x] C7.TRIANGULATE → REFACTOR: Run focused common/browser Mocha files and `npm run typecheck-client` if not already covered by a current compile; inspect disposable leaks and command parity, refactor duplication without crossing the core/extension boundary, and record remaining UI environment gaps. <!-- sdd-owner: implementation -->

## D — Package and validate activation after behavior is complete

### D1 — Validate normal packaged-app operation

- [x] D1.RED: Establish failing/absent-extension baseline checks for `E/esbuild.mts`, `.vscodeignore`, manifest main/activation and localization resources using `build/lib/extensions.ts` discovery/rewrite behavior; inspect any required extension project registrations before adding build changes. <!-- sdd-owner: implementation -->
- [x] D1.GREEN: Add/finish standard esbuild config and package inclusions; run targeted extension compile/typecheck/tests, inspect actual packaged manifest and dist entrypoint, then launch the desktop package with isolated profile/home/candidates. Fix only demonstrated discovery/activation defects, not unrelated Copilot packaging issues. <!-- sdd-owner: implementation -->
- [x] D1.TRIANGULATE: In Linux packaged Walker, exercise isolated runtime-only → explicit selected channel → official managed install → executed managed SDK verification → Ready → restart Ready, a separate split-install case, canceled chooser, offline failure, two-window contention, and unavailable extension. Capture selected version/path/output and before/after system SDK/PATH/profile evidence; use local/UI remote-window smoke when infrastructure exists. <!-- sdd-owner: implementation -->
- [x] D1.REFACTOR: Run macOS/Windows platform fixtures and available native install/cancel/rename/locality smokes plus supported-proxy smoke; record exact executed commands/results and explicit unverified gaps in `E/README.md` (or a focused adjacent verification document), remove throwaway fixtures/processes safely, and rerun impacted tests after fixes. Never claim packaged success from manifest presence alone. <!-- sdd-owner: implementation -->

## Implementation reporting contract

Report completed unit IDs, focused test results, actual additions + deletions, remaining blockers, and native-platform gaps to the parent. No automatic continuation past unresolved failures, unverified script trust, unsafe process termination, or the workload decision. Never delete existing managed SDKs during cleanup. Parent separately owns product-wide no-sign-in compliance tracking, final verification/review routing, delivery approval and any release decisions.
