# Apply progress: `new-project-wizard`

## Status consumed

- Active change: `new-project-wizard` (Change 3); goal `muy6or02` resumed by the user.
- Parent-derived structured apply status from the active launch context: `applyState: ready`, `actionContext.mode: implement`, no dependencies and no blocked reasons. The apply mode remained `implement`; no remediation authorization was used.
- Artifact backend: `openspec`. No prior `apply-progress.md` existed, so this file records the cumulative apply evidence.
- Workload forecast: 400 changed lines per review leaf; feature-branch chain selected in the parent authorization. Chained PRs are recommended; no size exception is approved.
- Strict TDD is disabled by `openspec/config.yaml`; no TDD cycle table is required.

## Completed implementation units

### P1 — Wizard shell and dynamic template option model

- Completed all three P1 implementation tasks. Their persisted task rows are checked in `tasks.md`.
- Implemented the common wizard command and File menu/command-palette entry, localized template catalog labels, approved template identities and aliases, fail-closed installed-template parsing, per-template help parsing, and configuration validation.
- Verification: `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/templates.test.ts` — **10 passing**; `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/projectWizard.test.ts` — **2 passing**.

### P2 — Existing toolchain process boundary

- Completed all three P2 implementation tasks. Their persisted task rows are checked in `tasks.md`.
- Added the narrow `walker.dotnet.runTemplateOperation` adapter for allowlisted local list/help/dry-run/generate operations. Core calls the command contract and does not import extension implementation code. Requests are structured and validated; the extension uses only the current verified SDK executable, fixed argument arrays, and its existing bounded, shell-free, environment-sanitizing process runner.
- Verification: `npm test --prefix extensions/dotnet-toolchain` — **269 passing**; `./scripts/test.sh --run src/vs/workbench/contrib/welcomeOnboarding/test/common/dotnetToolchain.test.ts` — **6 passing**; `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/projectWizardBoundary.test.ts` — **4 passing**, including core-boundary and local-operation assertions.

### P3 — Configuration, generation, truthful partial results, and window flow

- Completed all three P3 implementation tasks. Their persisted task rows are checked in `tasks.md`.
- Implemented verified-SDK setup/recheck, installed-template and selected-template-help discovery, only-advertised framework/style/test/restore options, project-name and local destination validation, existing-output refusal, cancellable dry-run and generation, output verification, recent-history update, same/new-window opening, and separate generation/Git/open failure reporting.
- Restore opt-out maps only to an advertised `--no-restore`; implicit restore failure remains part of generation diagnostics per approved Decision 3. Generation and post-generation filesystem errors preserve any generated output. A project completed during cancellation is preserved and not opened. Recents/open status is also truthful if updating canonical history fails.
- Same-window Git initialization waits for the target folder to become the active workspace and then invokes existing `git.init` with `skipFolderPrompt: true`. New-window Git initialization uses the separately implemented, expiring, one-shot intent described below; Git failure does not delete generated files.
- Verification after the final flow changes: `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/projectWizardFlow.test.ts` — **26 passing**. Coverage includes the bounded timeout case, unavailable and malformed adapter responses, restore opt-out, generation failure/partial output, cancellation, destination and output checks, both window modes, and Git failure/scheduling behavior.

### P3 split analysis — Deferred Git continuation

- The new-window Git leg is separated as a review unit because Decision 2 requires it to target only the generated project window, while Decision 4 explicitly authorizes building its transport in this change. It is not an extension/Git-boundary change.
- The intent is machine-scoped application storage, versioned, local-folder-only, expiring, removed before dispatch, and consumed only by a matching single-folder local workspace. Opening failure cancels the intent; storage, matching, expiry, and target-wait failures do not run Git in another workspace.
- Verification: `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/deferredGitInitialization.test.ts` — **8 passing**; the final flow suite above verifies integration with new-window open success/failure.

### P4 — Welcome and canonical recent workspaces

- Completed all three P4 implementation tasks. Their persisted task rows are checked in `tasks.md`.
- Added the localized `.NET Project` start entry routed to the shared wizard command. Recent projects consume `IWorkspacesService`/canonical `IRecentlyOpened` history, preserve ordering/deduplication, use normal host window-opening semantics, support the new-window modifier, remain native keyboard-focusable buttons, and report missing-path open failures without rewriting history. The existing `.button-link` styling uses the workbench `--vscode-textLink-foreground` theme token; no parallel recent store or custom color was added.
- Verification: `./scripts/test.sh --run src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStartedProjectWizard.test.ts` — **6 passing**; also covered by `projectWizardBoundary.test.ts` and the flow suite. No live high-contrast screenshot/theme session was run.

### P5 — Integration and protected boundaries

- Completed all three P5 implementation tasks. Their persisted task rows are checked in `tasks.md`.
- Added static boundary coverage for core-to-extension imports, account/auth/telemetry references, network template requests, operation allowlisting, and canonical recent history. Tests assert shared command routing, SDK setup/recheck and actionable adapter failures.
- Verification: `npm run compile-client` — **passed**, including `src/tsconfig.json` with 0 errors and extension compiles with 0 errors; `npm run typecheck-client` — **passed**; `npm test --prefix build` — **498 passing, 0 failing**; all focused suites listed above passed.
- No live `dotnet new` smoke test or per-template SDK 10.0.401 help capture was run in this workbench test session. The proposal's parent evidence addendum supplies the captured SDK template families/options; the current implementation dynamically discovers active-SDK help, and fixtures plus adapter tests passed. Do not interpret this apply run as a live generation test.

## Verification commands and observed results

- `npm run compile-client` — passed twice during this apply continuation; final run completed `compile-src` with **0 errors**, extension TypeScript projects with **0 errors**, and finished the compile task successfully. It emitted npm configuration and Node deprecation warnings only.
- `npm run typecheck-client` — passed after the final source/test edits; `tsc --project ./src/tsconfig.json --noEmit --skipLibCheck` exited successfully.
- `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/projectWizard.test.ts` — **2 passing**.
- `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/projectWizardFlow.test.ts` — **26 passing** after final flow/test edits.
- `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/templates.test.ts` — **10 passing**.
- `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/deferredGitInitialization.test.ts` — **8 passing** after final helper formatting.
- `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/projectWizardBoundary.test.ts` — **4 passing**.
- `./scripts/test.sh --run src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStartedProjectWizard.test.ts` — **6 passing**.
- `./scripts/test.sh --run src/vs/workbench/contrib/welcomeOnboarding/test/common/dotnetToolchain.test.ts` — **6 passing**.
- `npm test --prefix extensions/dotnet-toolchain` — **269 passing**.
- `npm test --prefix build` — **498 passing, 0 failing**. The build suite printed expected error output from negative resource fixtures; the complete suite still passed.
- A request to run `./scripts/test.sh --run src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStarted.test.ts` was attempted but that source selector does not exist in this checkout (the dynamic import failed because there is no such file). It is not counted as a product test failure; the extant Welcome project integration suite above passed.

## Files changed

- `extensions/dotnet-toolchain/package.json`
- `extensions/dotnet-toolchain/src/contracts.ts`
- `extensions/dotnet-toolchain/src/extension.ts`
- `extensions/dotnet-toolchain/src/test/contracts.test.ts`
- `extensions/dotnet-toolchain/src/test/extension.test.ts`
- `openspec/changes/new-project-wizard/design.md`
- `openspec/changes/new-project-wizard/specs/project-creation/spec.md`
- `openspec/changes/new-project-wizard/tasks.md`
- `openspec/changes/new-project-wizard/apply-progress.md`
- `src/vs/workbench/contrib/projectWizard/common/projectWizard.ts`
- `src/vs/workbench/contrib/projectWizard/common/templates.ts`
- `src/vs/workbench/contrib/projectWizard/browser/projectWizard.ts`
- `src/vs/workbench/contrib/projectWizard/browser/projectWizard.contribution.ts`
- `src/vs/workbench/contrib/projectWizard/browser/deferredGitInitialization.ts`
- `src/vs/workbench/contrib/projectWizard/test/common/projectWizard.test.ts`
- `src/vs/workbench/contrib/projectWizard/test/common/templates.test.ts`
- `src/vs/workbench/contrib/projectWizard/test/common/projectWizardFlow.test.ts`
- `src/vs/workbench/contrib/projectWizard/test/common/deferredGitInitialization.test.ts`
- `src/vs/workbench/contrib/projectWizard/test/common/projectWizardBoundary.test.ts`
- `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts`
- `src/vs/workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts`
- `src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStartedProjectWizard.test.ts`
- `src/vs/workbench/contrib/welcomeOnboarding/common/dotnetToolchain.ts`
- `src/vs/workbench/contrib/welcomeOnboarding/test/common/dotnetToolchain.test.ts`
- `src/vs/workbench/workbench.common.main.ts`

## Review workload and PR boundary

- The authorized delivery path is the existing feature-branch chain on `new-project-wizard`; no size exception was accepted. The deferred transport remains paired with its matching-window tests, and core flow tests remain paired with the user-visible outcomes they verify.
- `wc -l` reports 1,724 lines across the ten new `projectWizard` source/test files, plus 108 lines in the new Welcome integration test. These are authored-file line counts, not additions-plus-deletions from a diff. No Git command was run (the parent owns all Git operations), so exact per-leaf diff totals were not measured.
- Two newly authored files exceed 400 lines as whole files: `browser/projectWizard.ts` (421 lines) and `test/common/projectWizardFlow.test.ts` (432 lines). The P3 flow and its full test file therefore must not be treated as a single ≤400-line review leaf. Recommended parent staging/review split is by cohesive flow slices (SDK/readiness/configuration; dry-run/generation/output/cancellation; recent/open/Git), with matching test hunks included in each leaf. The deferred storage helper and its test are a separate 271-line authored-file pair. Do not delete tests or compress source to satisfy the budget; no size exception is claimed.
- The approved P1–P5 tasks are completed, but the parent should measure the actual changed-line totals and enforce the review-chain boundaries when preparing review units.

## Deviations, remaining tasks, and review focus

- Design/spec wording records the authorized restore mapping (`--no-restore`) and its inability to report implicit restore failure separately from generation; no operation-set widening occurred.
- No implementation-owned task rows remain unchecked. Remaining verification limitation: live SDK 10.0.401 generation/per-template help evidence and a live high-contrast UI pass were not run here; use the parent-provided SDK evidence and validate those visual/runtime surfaces in independent verification if available.
- Next review focus: verify intent matching/removal in `deferredGitInitialization.ts` and its startup contribution; confirm output-preservation and no-false-success branches in `projectWizard.ts`; inspect Welcome recent-entry keyboard/window behavior; and independently check the extension request guard/process-runner boundary.
- No `git` operations, staging, commits, or changes to parent-owned session todos/goals were performed.

## Parent review (2026-10-08) — leaf measurements + security-leaf verdicts

Measured review leaves (Decision 5 ratified split): A=218 (projectWizard.ts 1–218), B=203 (219–421), C=271 (deferredGitInitialization pair), D≈256 (Welcome diff ~148 + test 108), boundary-source=212 (contracts +94, extension +115, package.json +3), boundary-tests=112, core-mirror pair=156 (dotnetToolchain.ts +114, test +41, workbench.common.main +1). Every leaf ≤400 reviewed lines; no size exception.

Parent review verdicts (security-relevant leaves):
- Leaf C (deferred git-init): schema-validated intents (file-scheme only; 10-minute TTL; expiresAt bounded to now+TTL), flush-before-dispatch with cleanup on partial persistence, ALL matching intents removed before git executes (one-shot; crash-after-removal fails safe to "no git run"), case-biased folder matching, 30-second workspace-wait timeout. PASS.
- Toolchain boundary: fixed 12-template allowlist, 5-option allowlist (framework regex-validated; value-less options must omit value), duplicate-option rejection, strict key checks, fresh `recheck()` before every operation (verified executable never stale), output absolute + non-root + must not exist (lstat ENOENT gate — no overwrites), existing-directory parent, `DOTNET_CLI_TELEMETRY_OPTOUT=1` child env, per-operation timeouts, argv from fixed templates only (no shell, no arbitrary executable). PASS.
- Notes (non-blocking): child-env hardening could add further opt-out variables later; wizard→contract→live-SDK composition seam remains the recorded residual (recommend a follow-up integration test).
