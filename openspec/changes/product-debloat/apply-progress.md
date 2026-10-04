# Apply Progress — product-debloat

## Structured status consumed

- Parent-derived status: `artifactStore=openspec`, `applyState=ready`, `nextRecommended=sdd-apply`; authoritative change `product-debloat`.
- Action context: assigned U00 only; implementation checkboxes M0.1, M0.2, M0.3, M1.RED, M1.GREEN, M1.TRIANGULATE → REFACTOR. Workspace `/home/marialez/Work/walker`; exact edit surfaces are those in the launch prompt.
- Delivery: resolved `feature-branch-chain`; 400 additions+deletions per leaf; `size:exception` declined. Strict TDD is false; task-mandated RED→GREEN→TRIANGULATE→REFACTOR order remains active.
- Entry worktree: tracked `main` clean; pre-existing untracked `.pi/` harness output and OpenSpec change tree are preserved. No unrelated file was edited.

## Completed work by leaf

- **U00.a.001 — measured owner-root census:** added the first 121 lines of `removal-inventory.md`; with the 35-line progress record, measured leaf total is 156 additions and zero deletions. No runtime behavior changed.
- **U00.a.002 — inbound ownership graph:** measured 167 total added+deleted lines (163 inventory additions, one apply-progress line replacement, one task-checkbox replacement); zero runtime behavior changes. It adds scoped reference counts, cross-process/API/build/test edges, retained boundaries, prerequisite graph and oversized-file seams.
- **U00.a.003 — product/workload trace:** measured 136 total added+deleted lines across the inventory, its measurement metadata, task checkbox and progress entry; zero runtime changes. M0.3 is checked complete as an inventory trace. `inlineMeta` does not consume the supplied product callback because its product insertion is commented out; G2 parity is a recorded blocker, not a U00 code change.
- **U00.b.001 — telemetry core ledger:** measured 129 total added+deleted lines (126 new ledger lines, one progress line and one manifest measurement-line replacement); no runtime changes. T1–T6 members, aliases, payload-only variables/IDs, process registrations and owner-specific test contracts are seeded with `pending` status.
- **U00.b.002 — reporter/gallery/closure ledger:** measured 169 total added+deleted lines (162 new ledger lines, M0.2 checkbox, progress entry/remaining-work update and manifest measurement replacement); no runtime changes. Includes exact 97-file reporter search index, 24 extension manifest/lock paths, gallery correlation/statistics owners, build artifacts and T7–T12 statuses. M0.2 is checked complete.
- **U00.c.001 — partial M1.RED source fixture only:** measured 147 total added+deleted lines including the 127-line new API fixture, progress/test-evidence and manifest updates. It uses only synthetic IDs/state and no credentials or network; selector failed before importing the new fixture, so no behavioral RED is established and M1.RED remains unchecked.
- M0.1 is visibly complete in `tasks.md`. The measured source-root total for chat, sessions, Agent Host and Copilot is about 2.758M tracked text lines before external entrypoint/package tails, materially above the preliminary forecast. This is a workload correction, not a delivery-strategy change.

## Verification evidence

- **Attempted RED selector:** with Node 24 PATH, `./scripts/test.sh --run vs/workbench/api/test/common/accountFreeApi.test` exited 1. Electron reported `Failed to fetch dynamically imported module: file:///home/marialez/Work/walker/out/vs/workbench/api/test/common/accountFreeApi.test.js`; the source test exists but no compiled output does. `scripts/test.sh` launches precompiled `out/**` and does not compile tests.
- **Typecheck:** `npm run typecheck-client` initially found `AuthenticationSessionAccount` was not a public API type; corrected the fixture to `AuthenticationSessionAccountInformation`, then reran the same authorized command and it passed with exit 0.
- **Existing Git integration verification:** `./scripts/test-integration.sh --suite 'git,git-base'` exited 0: Git 58 passing/2 pending; Git Base 14 passing. Startup downloaded three built-in debugger/profile extensions from GitHub and initialized extensions under `/home/marialez/.walker-dev/extensions` and `/home/marialez/Work/walker/.vscode-test/extensions`. No credentials or OAuth were supplied, and no explicit telemetry send was invoked; outbound telemetry was not independently instrumented. Generated/profile data was preserved, not cleaned. These existing-suite results do not load the new API fixture.
- **.NET toolchain verification:** `npm run test --prefix extensions/dotnet-toolchain` exited 1 after its compile succeeded; 265 tests passed, one failed: `dotnet installer verification and process transitions` → `cancels a running installer through the process-tree bridge and re-detects` timed out in `waitFor` (`out/test/installer.test.js:96`). No source test or implementation in that suite was changed.
- No new M1 fixture assertion has run; the existing Git pass and .NET failure do not substitute for the missing RED/positive boundary fixtures. Do not count the harness import failure as a RED behavior observation. No unapproved compile command was run because its generated `out/**` writes are outside the allowed edit surface.
- Baseline discovery inspected the API auth bridge, main telemetry registration, gallery product stream and runner selector tails. See the inventories for owner details.

## Workload and PR boundary

- Current stage: U00 inventory/protected fixtures only; no feature deletion authorized or performed. Leaves U00.a.001–a.003, b.001–b.002, c.001–c.002 and d.001 are recorded with disjoint paths and 120–400 line targets.
- No safe-split obstacle is identified for these bounded inventory/test seams. Later giant trees require exact per-file/member manifests before owner work and cannot be treated as a single PR.

## Remaining assigned work at the prior checkpoint (superseded below)

- Resolve the test compilation boundary: either authorize a safe compile selector and its generated-write surface, or stop U00 with source fixtures unverified. The attempted `npm run compile-client`/`npm run compile` alternatives are not authorized; the latter also starts Copilot compilation.
- M1.RED/M1.GREEN fixtures and M1.TRIANGULATE verification remain incomplete; no process seam or additional fixtures were written. Parent decision is needed before compiling the absent core fixture output. The existing .NET suite also has the one reported failing test; do not remediate without authorization.
- Re-read persisted checkboxes and this cumulative report before returning to the parent.

## Review focus at the prior checkpoint (superseded below)

- `accountFreeApi.test.ts` is typechecked but remains unverified source; the allowed test launcher requires a compiled `out/vs/workbench/api/test/common/accountFreeApi.test.js` that is absent.
- No `app.ts` seam or other production path was written. If compilation is authorized, verify the selected module is emitted, then confirm failing assertions are behavioral rather than harness errors.
- New positive Git, gallery, local-profile, generic tunnel, diagnostics and Search fixtures have not been added. Existing Git integration passes, while the existing .NET suite has one failure as recorded above.

## U00 M1 continuation — completion record

This continuation supersedes the prior checkpoint's pending M1 and test-compilation statements. Parent authorization selected `authorize_registration_helper`, including the exact new helper path below, and authorized `npm run compile-client` with Node 24.18.0 on `PATH`. Mode remains implementation; scope is U00 only; action-context warnings: none. The resolved delivery boundary remains the assigned feature-branch-chain leaf, with no size exception. `app.ts` changed solely to delegate its existing telemetry registration branch through the side-effect-free helper; no telemetry behavior was changed.

### Completed M1 leaves and measured source/test lines

- **U00.c.001 — account-free API baseline:** 127 added fixture lines; the previously measured leaf total was 147 additions+deletions including its progress/inventory metadata. Synthetic legacy session/account data reproduced the expected RED without real credentials or network calls.
- **U00.c.002 — main telemetry observability/no-op:** 97 additions + 6 deletions = 103 source/test changed lines across `app.ts`, `telemetryServiceRegistration.ts`, `productDebloat.test.ts` and `nullTelemetryService.test.ts`. The test calls the helper directly and counts reporting-descriptor construction; disabled telemetry binds `NullTelemetryService` in the passing no-op contract.
- **U00.d.001 — retained positive boundaries:** 78 additions + 2 deletions = 80 source/test changed lines across Git/SSH askpass, generic tunnel, anonymous gallery, local profile, snippets restoration, onboarding and ordinary diagnostics fixtures.
- M1 source/test changes total **302 additions + 8 deletions = 310 changed lines**. Including the prior U00.c.001 metadata (20 lines), this continuation's 27 progress lines, 4 superseding-heading lines and 6 task-checkbox lines, the measured full M1 scope is **367 changed lines**, within the 400-line review ceiling. No production deletion, dependency change, or user-data cleanup occurred.

### Verification evidence

- `npm run compile-client` with Node 24.18.0: **passed**, 0 compilation errors. The remaining npm configuration/deprecation warnings were non-fatal.
- `./scripts/test.sh --run vs/workbench/api/test/common/accountFreeApi.test`: expected RED, **2 failing / 2 passing**. Legacy passive session/account reads invoke the provider and expose state; provider registration subscribes and crosses the proxy.
- `./scripts/test.sh --run vs/code/test/electron-main/productDebloat.test`: expected telemetry RED, **1 failing / 1 passing**. Direct helper counters show the legacy enabled setting constructs/registers the reporting service instead of binding the no-op.
- `./scripts/test.sh --run vs/platform/telemetry/test/common/nullTelemetryService.test`: **2 passing**.
- Positive selectors passed via `./scripts/test.sh --run`: `vs/platform/tunnel/test/common/tunnel.test` (**3**), `vs/platform/extensionManagement/test/common/extensionGalleryService.test` (**34**), `vs/platform/userDataProfile/test/common/userDataProfileService.test` (**32**), `vs/workbench/services/userDataProfile/test/browser/snippetsResource.test` (**5**), `vs/workbench/contrib/welcomeOnboarding/test/common/onboardingTypes.test` (**4**) and `vs/workbench/contrib/welcomeOnboarding/test/common/dotnetToolchain.test` (**4**), `vs/workbench/contrib/search/test/browser/searchModel.test` (**11**), `vs/workbench/api/test/common/extHostExtensionActivator.test` (**10**), and `vs/workbench/test/browser/notificationsToasts.test` (**6**).
- `./scripts/test-integration.sh --suite 'git,git-base'`: **Git 60 passing / 2 pending; Git Base 14 passing**. Synthetic remotes and SSH/Git askpass fixtures passed; no user credentials were supplied.
- `npm run test --prefix extensions/dotnet-toolchain`: **266 passing** on this run. The earlier checkpoint's known flaky `cancels a running installer through the process-tree bridge and re-detects` timed out once; it passed on this rerun. No test or implementation was altered to address that historical failure.

### Persisted status and review focus

- `tasks.md` now visibly marks M1.RED, M1.GREEN and M1.TRIANGULATE → REFACTOR complete; M0 checkboxes remain unchanged. The intentional account/telemetry RED results are baseline evidence, not verification failures to remediate in U00.
- Runner triangulation: `scripts/test.sh` selects precompiled `out/**` tests and sets the crash directory; integration Bash/Windows runners honor the exact `git,git-base` suite selection, pass telemetry/experiments-disabled flags to extension-host suites, and skip the default all-suite Agent Host/Copilot paths. No runner was edited.
- Files changed: `src/vs/code/electron-main/app.ts`, `src/vs/code/electron-main/telemetryServiceRegistration.ts`, `src/vs/code/test/electron-main/productDebloat.test.ts`, `src/vs/platform/telemetry/test/common/nullTelemetryService.test.ts`, `src/vs/workbench/api/test/common/accountFreeApi.test.ts`, `extensions/git/src/test/{askpassManager,git}.test.ts`, `src/vs/platform/{extensionManagement/test/common/extensionGalleryService.test.ts,tunnel/test/common/tunnel.test.ts,userDataProfile/test/common/userDataProfileService.test.ts}`, `src/vs/workbench/contrib/welcomeOnboarding/test/common/onboardingTypes.test.ts`, `src/vs/workbench/services/userDataProfile/test/browser/snippetsResource.test.ts`, and `src/vs/workbench/test/browser/notificationsToasts.test.ts`.
- Review next: independently confirm the account-free API and telemetry baseline contracts, verify the helper preserves the `app.ts` branch behavior, and check the protected Git/SSH, generic tunnel, anonymous gallery, local data, Search and diagnostics fixtures. No remaining U00 implementation task is unchecked.
