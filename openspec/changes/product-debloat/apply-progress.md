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

## U01 cumulative implementation record reconstructed from surviving task/inventory evidence

> The prior U01 narrative was accidentally overwritten during b.016 artifact update. This cumulative summary is reconstructed from the parent-provided session summary and surviving `tasks.md` / `removal-inventory.md`; historical test results below are transcribed from those sources, not rerun in b.016. The b.016 record is current and its checkbox was re-read.

### Public auth and Open VSX packaging

- **U01.a.001 — public authentication facade:** 292 additions+deletions. Public API delegation is passive-empty/unsupported with stable `AuthenticationUnsupported` / `WALKER_AUTHENTICATION_UNSUPPORTED`, inert events and retained proposal guards; internal auth RPC remains for A2. `compile-client` passed; account-free API test 5/5, extension activator 10/10, and ordinary commands/documents/diagnostics/SCM selectors passed. Compatibility is documented; no service-side auth deletion is claimed.
- **U01.f.001 — Open VSX mixin/helper:** 138 additions+deletions. Added the approved quartet and strict gallery-only composition with `controlApiUrl` → runtime `controlUrl`; root `product.json` remains without a gallery. Helper tests passed; live registry/package behavior remains U12.
- **U01.g.001 — product bootstrap marker:** 103 additions+deletions. Enabled the existing product marker and verified desktop/server/server-web selection and serialized product injection; package marker remains intact. `inlineMeta` tests passed 6/6.
- **U01.g.002 — desktop gallery stream:** 41 additions+deletions. Desktop product composition is applied after release stamps and before serialized/embedded capture; walker-product tests passed.
- **U01.h.001 — REH gallery stream:** 45 additions+deletions. REH uses the same composition while preserving release/SDK fields; walker-product tests and build typecheck passed.
- `npm run typecheck --prefix build` and `npm run typecheck-client` passed in the recorded G2 work. Live Open VSX lifecycle, provider endpoints, and listed C# acquisition remain U12; C# Dev Kit/Copilot are an expected provider gap, not inferred available.

### Gallery account removal

- **U01.e.001 — disable private-gallery account branch:** 215 additions+deletions. Legacy private URLs remain unavailable with no account lookup, network request, or public fallback; default anonymous gallery remains.
- **U01.e.002–e.004 — obsolete gallery provider tests:** 268, 257, and 222 additions+deletions respectively. Removed provider-routing, account selection, auth/restart and auth-telemetry expectations while preserving anonymous/private-legacy cases; full workbench manifest suite passed 4/4 after e.004.
- **U01.e.005 — Marketplace sign-in/status/review UI:** 221 additions+deletions. Removed sign-in action/content/account badge updater and clickable review links; read-only stars/counts and ordinary Marketplace/search remain. Focused UI absence/metadata test passed 5/5; broader extensions view/action selectors passed 141/248.
- **U01.e.006 — anonymous failure/VSIX behavior:** 130 additions+deletions. Access denial remains actionable, ordinary 404 remains empty, offline failures propagate without account retry, anonymous VSIX fallback remains, and account-required rating URI is removed. Gallery service tests passed 38/38.
- **U01.e.007 — authenticated gallery providers:** 384 additions+deletions. Removed GitHub/Microsoft gallery account-provider implementations and contribution; focused provider-absence test passed 1/1.
- **U01.e.008 / G1:** removed gallery account contract, hidden auth setting/config key and provider implementations while leaving old preference data inert. Focused gallery account UI tests passed 8/8, manifest tests 5/5, and gallery service tests 38/38. Live marketplace behavior is not established by these unit tests.
- The stale gallery side-effect imports were disconnected from desktop and Sessions entrypoints in b.011. `IExtension.ratingUrl`'s optional interface member remains outside the authorized surface; the concrete getter/consumer is gone.

### Account actions and default-account consumers

- **U01.b.001–b.005 — global activity/titlebar controls:** measured 122, 167, 65, 202 and 329 additions+deletions. Removed Accounts activity toggle/preferences/menu/view items and titlebar Accounts action while preserving generic Manage, global activity sizing and unrelated title controls. Focused global composite bar and titlebar tests passed after their respective leaves.
- **U01.b.006 — account badges:** 141 additions+deletions. Removed account-badge activity API and producers from activity, auth, Sync and edit sessions; retained auth session/request behavior, Sync conflict/progress badges, edit sessions and generic activity. `compile-client` and GlobalCompositeBar tests passed 6/6.
- **U01.b.007 — basic account actions/auth UI:** 310 additions+deletions. Removed Manage Accounts, Sign Out and authentication feature-renderer registration; retained code-exchange bridge/usage contribution. Focused absence test passed 1/1.
- **U01.b.008 — extension account preference picker:** 222 additions+deletions; removed the account-only picker; compile and focused test passed 1/1.
- **U01.b.009 — dynamic provider/trusted extension actions:** 338 additions+deletions; focused absence tests passed 2/2.
- **U01.b.010 — trusted MCP account action:** 233 additions+deletions; focused absence test passed 1/1.
- **U01.b.011 — updater and stale entrypoint behavior:** 150 additions+deletions. `DefaultAccountUpdateContribution` is inert without reading/clearing legacy `update/internalOrg`; `IUpdateService.setInternalOrg` and IPC shape remain. Focused updater and Walker product checks passed.
- **U01.b.012 — GitHub link auth:** 311 additions+deletions. Removed workbench account token/enterprise lookup and sign-in; public github.com link presentation and explicit unavailable state remain. GitHub service tests passed 2/2 and link-presentation tests 5/5; plain Git transport was unchanged.
- **U01.b.013 — account assignment filters:** 235 additions+deletions. Removed token/entitlement-derived filters and account-only persisted keys; retained installed Copilot extension-version filters and old profile state. Focused tests and compile passed.
- **U01.b.014 — account-backed TAS endpoint:** 256 additions+deletions. Removed default-account endpoint/retry/request transport while preserving ordinary TAS, overrides, disposal and bare-name treatment. Focused assignment service tests passed 10/10 and compile passed.
- **U01.b.015 — obsolete TAS filter provider:** 211 additions+deletions. Removed unused GitHub account filter provider and assignment-only Copilot mapping; retained extension-version provider. Focused tests passed 4/4 and compile passed.
- No existing-file safety-net baseline was captured for b.011; the constructor-arity assertion failed against baseline because the contribution had three dependencies rather than zero. This limitation remains disclosed.

## U01.b.016 — Disconnect remaining default-account consumers

- Structured status consumed: parent-derived `change=product-debloat`, `artifactStore=openspec`, `applyState=ready`, `nextRecommended=sdd-apply`; parent-authorized A3 default-account consumer and account-policy surfaces were used. Action context: implementation mode, workspace `/home/marialez/Work/walker`, no warnings. Node 24.18.0 was used.
- **RED:** the new extension-enablement test failed because the former default-account authentication provider still prevented enablement (`false !== true`). Two Node 24 source-boundary assertions also failed against baseline: Getting Started referenced `IDefaultAccountService`, and Developer Actions registered `SyncAccountPolicyAction`.
- **GREEN:** removed the default-account authentication-provider match/dependency from `ExtensionEnablementService`, renaming the remaining guard to `isSettingsSyncAuthProviderExtension`. Settings Sync still prevents disabling an authentication extension when its own signed-in account depends on it. Removed only `SyncAccountPolicyAction` and its sole-purpose freshness import; retained `PolicyDiagnosticsAction` and other developer diagnostics. Removed Getting Started's account service injection/argument to `createAgentsBanner`, retaining chat-entitlement visibility and the generic open-Agents-window action.
- **TRIANGULATE / REFACTOR:** all 128 extension-enablement tests passed, including the former-default-account case and existing Settings Sync guards. Both account-consumer source assertions passed after the changes. Shared Agents banner implementation and separate account-managed-settings diagnostics were not changed.
- **Verification:** Node 24.18.0 `npm run compile-client` passed with zero compile errors. `./scripts/test.sh --run vs/workbench/services/extensionManagement/test/browser/extensionEnablementService.test` passed 128/128. Read-only Node assertions over `gettingStarted.ts` and `developerActions.ts` failed before edits and passed after. `git diff --check` passed. Non-fatal npm configuration and Electron/platform warnings occurred.
- **Files changed:** extension enablement service/test; `developerActions.ts`; `gettingStarted.ts`; `tasks.md`, `removal-inventory.md`, and this progress file. No local profile/settings/repos/secrets, Git/SSH behavior, package or dependency files changed.
- **Persisted completion:** `U01.b.016` is visibly `[x]` in `tasks.md`. A3 remains incomplete while default-account service/registrations, account-policy wiring and other account-owned tasks remain.
- **Workload / PR boundary:** 83 additions+deletions across source, test and artifacts on the resolved feature-branch-chain. This narrow independently testable seam is below the usual 120-line target; it was not padded with unrelated code/tests. It is below the 400-line ceiling; no size exception or commit.
- **Review focus:** confirm no default-account lookup remains in extension enablement or Getting Started; preserve the Settings Sync disablement guard, generic Agents banner, general Policy Diagnostics and remaining managed-settings diagnostic ownership.

## U01 continuation — A3 gate/diagnostics and A4/A8 reference disconnection

### Structured status consumed

- Parent-derived authoritative status: `activeChange=product-debloat`, `artifactStore=openspec`, `applyState=ready`, `nextRecommended=sdd-apply`; 94 tasks at input (73 remaining, parent 0, errors 0); verify/sync reports missing; sync blocked; archive not ready. Provenance: parent disk scan of `tasks.md` checkboxes using `sdd-status-derivation.md`.
- Action context: `mode=apply`, workspace `/home/marialez/Work/walker`, branch `product-debloat`, parent checkpoint `a9fbaf24dfa`; approved exact edit surfaces plus the two added HTML paths were observed. No action-context warnings. Parent resolved `feature-branch-chain`, 400 lines per leaf, no size exception. `openspec/config.yaml` says strict TDD false; task RED→GREEN→TRIANGULATE→REFACTOR still followed.
- Node 24.18.0 was used via the approved mise PATH. No staging or commits.

### Completed bounded work

- **U01.b.017–b.018 — account diagnostics and gate disconnection:** removed account/session/authentication/account-policy-gate diagnostics and GitHub server-managed-settings reporting from `developerActions.ts`; preserved the general Policy Diagnostics action and native/file managed-settings reporting. Removed the policy service's `restrictedValue` force-on-unsatisfied-account-gate branch. Disconnected the workbench gate contribution import and desktop/web/Sessions service registrations, replaced the chat gate key's service import with a false-default local key, and removed account/gate/freshness dependencies from the Sessions blocked overlay. The generic `AgentDisabled` overlay and generic policy/managed-settings service remain. Gate status declarations/computation and gate-only contribution/test files still exist but have no active workbench/Sessions registrations; see parent physical-deletion manifest below.
- **RED:** a new `accountPolicyService.test.ts` assertion for no account-gate-forced value failed against baseline (`false` versus `undefined`; 1 failing, 34 passing). A Node source-boundary check also failed while the Sessions overlay still consumed account/gate freshness. **GREEN/TRIANGULATE:** removed the forced value and the cross-tree account dependencies; the full account-policy service suite passed 35/35, the authorized cross-tree source assertions passed, and generic native/file diagnostics plus `AgentDisabled` assertions remained true. The paired b.017–b.018 leaf measures 346 additions+deletions including 325 source/test lines and its allocated task/inventory/progress evidence.
- **U01.A4/A8.001 — approved-path provider/GitHub disconnection:** removed GitHub/Microsoft provider and GitHub integration discovery/compile/native-check/CI/CodeQL/CredScan/linter/test references from the approved build/package/test/consumer files. Removed the full authentication trust-grant list from `build/vite/workbench-vite.html` and `build/rspack/workbench-rspack.html`, preserving the unrelated gallery/Sync/URL product settings. `.vscode-test.js` now asserts removed integration/provider discovery and trust grants stay absent while `git` and `git-base` remain. No provider/GitHub extension source tree was unlinked or edited.
- At this checkpoint, residual test/debug/linter references outside the then-approved surfaces were recorded in `removal-inventory.md` and `tasks.md`. Parent subsequently authorized exactly those six paths; U01.A4/A8.002 below records their cleanup.

### Verification evidence

- `npm run compile-client` with Node 24.18.0: passed; zero TypeScript compile errors, including current workbench/Sessions sources and retained extension build targets.
- `npm run typecheck --prefix build`: passed.
- From `build/`, `node --test lib/test/walkerProduct.test.ts`: 6/6 passed.
- `./scripts/test.sh --run vs/workbench/services/policies/test/browser/accountPolicyService.test`: RED 1 failing/34 passing before the behavior edit; GREEN 35/35 after.
- `./scripts/test.sh --run vs/workbench/api/test/common/accountFreeApi.test`: 5/5 passed.
- `./scripts/test.sh --run vs/platform/extensionManagement/test/common/extensionGalleryService.test`: 38/38 passed.
- `./scripts/test.sh --run vs/workbench/contrib/extensions/test/electron-browser/extensionGalleryAccountUi.test`: 8/8 passed.
- `node --check .vscode-test.js` and importing the config: passed. Node assertions over approved provider/Git discovery and both HTML trust templates passed; A3 account diagnostics/gate source assertions passed.
- `git diff --check`: passed after the final code and artifact edits.
- Git/Git Base integration was not rerun in this pass: its runner is known to download/install extensions outside the approved edit surfaces. The prior historical integration result remains recorded above (Git 60 passing/2 pending; Git Base 14 passing); current `compile-client` included retained Git and Git Base targets. Live Open VSX/package behavior remains U12-owned.

### Leaf workload and PR boundary

- The paired A3 b.017–b.018 leaf measures **346 additions+deletions**: 325 source/test lines plus 21 allocated tasks/inventory/progress lines.
- The approved A4/A8 cross-tree disconnection leaf measures **215 additions+deletions**: 160 source/config lines plus 55 allocated tasks/inventory/progress lines. Both feature-chain leaves remain below 400; no size exception and no commits.
- Physical provider/integration and gate-only source deletion is intentionally parent-owned; the corresponding physical-removal checkboxes remain unchecked until deletion is observed.

### Pending physical deletion (parent)

Parent executes `git rm` for the exact paths below between passes; this agent performed no deletion operation:

- `extensions/github-authentication/` (all provider source, tests, resources, manifests and locks).
- `extensions/microsoft-authentication/` (all provider source, tests, resources, manifests and locks).
- `extensions/github/` (all integration source, tests, resources, manifests and locks).
- `src/vs/workbench/services/policies/browser/accountPolicyGate.contribution.ts`.
- `src/vs/workbench/services/policies/browser/accountPolicyGateContribution.ts`.
- `src/vs/workbench/services/policies/test/browser/accountPolicyGateContribution.test.ts`.

### Remaining U01 implementation work

- [ ] A3.RED → GREEN: Add account registration/menu/titlebar/settings/badge absence assertions, then remove account-owned code from `workbench/browser/parts/globalCompositeBar.ts`, `parts/titlebar/{titlebarPart,titlebarActions}.ts`, account contributions/settings and default-account consumers discovered by M0. Remove one independently testable location per leaf; retain local profile and other global/title controls. <!-- sdd-owner: implementation -->
- [ ] A3.TRIANGULATE → REFACTOR: Exercise fresh/copied persisted profiles, keyboard/title/global layout and local profile actions; remove orphan account-only helpers/context/config links. No broad welcome redesign; retain toolchain/personalization. <!-- sdd-owner: implementation -->
- [ ] A3.PHYSICAL-REMOVAL (parent): Parent executes `git rm` for the disconnected account-policy gate contribution and its dedicated test listed in the manifest; keep unchecked until deletion is observed. <!-- sdd-owner: implementation -->
- [x] A4.RESIDUAL-REFERENCES: Remove the GitHub authentication suite from both integration runners and their skill documentation; clear provider source entries from both ESLint allowlists while preserving executable `git`/`git-base` suites and generic GitHub transport. <!-- sdd-owner: implementation -->
- [ ] A4.PHYSICAL-REMOVAL (parent): Parent executes `git rm` for `extensions/github-authentication/` and `extensions/microsoft-authentication/` after the remaining authorized references are reconciled; keep this checkbox open until deletion is observed. <!-- sdd-owner: implementation -->
- [ ] A4.TRIANGULATE → REFACTOR: Check extension discovery and Node/browser retained-extension builds, old provider callback URI inactivity, and positive Git helper/SSH prompts. Remove provider-only package/proposal/transitive dependencies only after last consumer evidence. <!-- sdd-owner: implementation -->
- [x] A8.RESIDUAL-REFERENCES: Remove the GitHub extension debug launch target from `.vscode/launch.json` while retaining the `vscode.git` test launch. <!-- sdd-owner: implementation -->
- [ ] A8.PHYSICAL-REMOVAL (parent): Parent executes `git rm` for `extensions/github/` after the remaining authorized references are reconciled; keep this checkbox open until deletion is observed. <!-- sdd-owner: implementation -->
- [ ] A8.TRIANGULATE → REFACTOR: Run retained clone/fetch/pull/push/history/branch/helper/askpass fixtures, GitHub URL dispatch and self-hosted-style cases; eliminate dead external links caused by removed commands. Verify Git-specific generic credential-provider abstraction/terminal env remains meaningful without GitHub OAuth registrants. <!-- sdd-owner: implementation -->

A3's broader default-account service/consumer removals remain incomplete pending downstream chat/Sessions ownership. U12 live gallery/package verification is still pending. Preserve extensions/git, git-base, OS credentials, plain GitHub remotes, local profiles/repos/secrets, generic policy/diagnostics, SSH and port forwarding. Do not modify the known flaky .NET toolchain test. No commits have been made.

## U01 A4/A8.002 — residual runner, launch, and lint-reference cleanup

### Structured inputs and authorization

- Parent-supplied structured status at this pass: `activeChange=product-debloat`, `artifactStore=openspec`, `applyState=ready`, `verifyState=ready`, `nextRecommended=sdd-apply`; 101 tasks, 76 remaining, parent 0, errors 0. Parent provenance: disk scan of `tasks.md` and `sdd-status-derivation.md`.
- Parent explicitly selected option 1 and authorized only `scripts/test-integration.sh`, `scripts/test-integration.bat`, `.vscode/launch.json`, `.github/skills/integration-tests/SKILL.md`, `.eslint-allowed-javascript-files`, and `.eslint-allowed-bracket-notation-files`, in addition to the earlier approved surfaces. Mode remains apply; workspace `/home/marialez/Work/walker`; branch `product-debloat`; feature-branch-chain; 400-line ceiling; no size exception. Node 24.18.0 via the approved mise PATH.
- This pass changes only the named residual references and their `.vscode-test.js` regression assertions plus OpenSpec artifacts. No physical deletion, stage, commit, package mutation, or user-state cleanup occurred.

### RED → GREEN → TRIANGULATE

- **RED:** added `.vscode-test.js` assertions for absence of the removed authentication suite in Bash/Windows runner and skill metadata, no GitHub extension launch target, and no provider-owned lint allowlist entries. The initial Node 24 config import failed as expected on the remaining `github-authentication` runner entry.
- **GREEN:** removed that suite's label/dispatch from both integration runners and its documented suite name; removed the GitHub extension launch configuration; removed the Microsoft provider JavaScript mocks and GitHub/Microsoft provider TypeScript allowlist entries. The generic GitHub transport allowlist entry is retained.
- **TRIANGULATE:** the config assertions verify `git` and `git-base` are not only named but still have executable suite branches in both runners, that the Git launch target remains, and that `src/vs/platform/github/common/githubTransport.ts` remains allowed. The Git integration suite itself was not edited.

### Verification evidence

- Node 24.18.0 `node --check .vscode-test.js` and importing the config: passed after cleanup; the first import intentionally failed in RED on the stale suite entry.
- `bash -n scripts/test-integration.sh`: passed.
- `./scripts/test-integration.sh --help`: passed; advertised list includes `git` and `git-base` and excludes `github-authentication`.
- Node 24.18.0 `npm run typecheck-client`: passed.
- Node 24.18.0 `npm run typecheck --prefix build`: passed; pretypecheck DTO preparation ran and left no additional tracked/untracked changes outside the allowed surfaces.
- Static scans of each of the six authorized paths found no `github-authentication`, no GitHub integration launch target, and no provider allowlist entries. The generic `githubTransport.ts` entry remains. `git diff --check` passed after the final code and artifact edits.
- The requested `./scripts/test-integration.sh --suite 'git,git-base'` was not rerun: this runner unconditionally creates a temporary profile and executes `rm -rf` on it, which is prohibited by the apply safety boundary. The Windows runner likewise uses `rmdir /s /q`. Earlier historical Git/Git Base suite results remain recorded above (Git 60 passed/2 pending; Git Base 14 passed); these are not represented as fresh verification of this pass.
- `npm run gulp compile-extensions` was not run: its compile tasks first run `cleanTask`, which calls `util.rimraf(out)` and `fs.rmSync(tsBuildInfoFile)` across extension trees outside the permitted generated-output roots. No destructive or out-of-scope build was substituted.

### Scope, workload, and next review

- This bounded `U01.A4/A8.002` residual-reference leaf measures **138 additions+deletions**: 90 runner/debug/lint and regression-test lines plus 48 allocated task/inventory/progress lines. It is below the 400-line ceiling and includes only cohesive reference cleanup and its preservation checks; no size exception.
- A4 and A8 reference disconnection and the six residual references are complete; their provider/integration source trees remain physically present pending parent `git rm`. A4/A8 TRIANGULATE stays open until deletion and the retained integration/build verification can be safely completed.
- G1's RED/GREEN/TRIANGULATE checkboxes were already complete and remain so. A3.b.017–b.018 are checked; broad A3 UI/default-account triangulation and the gate-only file deletion remain open. No broader A3 completion is claimed.
- **Pending physical deletion (parent):** the complete exact manifest above remains authoritative: `extensions/github-authentication/`, `extensions/microsoft-authentication/`, `extensions/github/`, `src/vs/workbench/services/policies/browser/accountPolicyGate.contribution.ts`, `src/vs/workbench/services/policies/browser/accountPolicyGateContribution.ts`, and `src/vs/workbench/services/policies/test/browser/accountPolicyGateContribution.test.ts`. Parent executes `git rm` between passes; all physical-removal checkboxes remain unchecked until deletion is observed.
- Review focus: after parent deletion, independently recheck remaining provider/Git integration references and run the retained `git,git-base` suites through a safe approved harness; verify plain github.com remotes continue through OS/Git credentials, with no OAuth or integration activation. Live Open VSX verification remains U12-owned.
