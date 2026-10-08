# C# Editing Implementation Tasks

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Delivery strategy: ask-on-risk, resolved to feature-branch-chain off main `c85de31f01c`; size exception declined. Forecast: approximately **6,400–8,600 additions + deletions**, including focused tests, fixtures, localized manifests and new evidence/planning text (not the already-preserved package artifacts). Estimates below are cohesive leaves, not permission to exceed 400 lines. Suggested split: 27 independently testable leaves across the seven required sizing areas, plus planning artifacts as separately measurable spec/design/tasks leaves. Parent owns branches/PRs/git and all gates. Do not trim tests/docs or nominally split inseparable changes to meet the budget; stop and request parent re-slicing if a measured leaf cannot fit.

Parent Decision 8 (2026-10-08) amends A6/A7 with the identity-scoped, fail-closed VSWebAssemblyBridge component-fetch deny rule and its interception/benign-degradation tests, without changing forecast totals or leaf numbering.

A3 re-sliced into A3a/A3b by parent Decision 9 (2026-10-08); each unit hard-capped ≤400 measured lines.

T1 re-sliced into T1a/T1b by parent Decision 10 (2026-10-08); each unit hard-capped ≤400 measured lines.

T2 re-sliced into T2a/T2b by parent Decision 11 (2026-10-08); each unit hard-capped ≤400 measured lines.

A6 re-sliced into A6a/A6b by parent Decision 12 (2026-10-08); each unit hard-capped ≤400 measured lines.

A7 re-sliced into A7a/A7b by parent Decision 13 (2026-10-08); each leaf has a separate ≤400-line hard cap, with status rendering/localized states assigned to A7a and contribution wiring/registration to A7b; no size exception is authorized.

A7b re-sliced into A7b-1/A7b-2 by parent extension to Decision 13 (2026-10-08); the admission evaluator/tests are separated from contribution wiring/import, each unit retains the ≤400-line hard cap, and no size exception is authorized.

Parent Decision 14 (2026-10-08) re-slices over-budget S2 into S2a topology core and S2b multi-root/standalone/URI-alias triangulation tests; each unit is separately capped at 400 lines, with no size exception.

Parent Decision 15 (2026-10-08) re-slices over-budget P2 into P2a bounded discovery/read core and P2b containment/concurrency/cancellation tests; each unit is separately capped at 400 lines, with no size exception.

Parent Decision 16 (2026-10-08) re-slices over-budget L1 into L1a graph controller core and L1b staleness/failure triangulation tests; each unit is separately capped at 400 lines, with no size exception.

| Area | Leaves / estimated changed lines each | Area risk |
| --- | --- | --- |
| Configuration/admission | A1–A7: 180–360 | High: RPC and revocation integration |
| Toolchain resolution | T1–T3: 220–360 | Medium |
| Solution parsing | S1–S2: 180–300 | Low |
| Project parsing/read safety | P1–P7: 220–360 | High: XML and containment |
| Tree/navigation | V1–V3: 180–340 | Medium |
| Incremental lifecycle | L1–L2: 240–360 | Medium |
| Verification | E1–E3: 180–340 | Medium: durable traces/fixtures |

Every leaf starts from the preceding coherent state, finishes with its named focused suite passing and a measured ≤400-line diff, and remains disabled/unwired until its prerequisites are satisfied. Boundaries and rollback are specified below. Tests naturally run RED → GREEN → TRIANGULATE → REFACTOR within each leaf; strict TDD is false. No delivery-gate checkboxes are generated.

## Authorization dependencies (not implementation authority)

Design D3's exact `contracts.ts` amendment requires final parent disposition before T1–T3 or dependent language wiring. Design D4's exact requester/mapping and standalone reporter audits, and D2 admission/revocation feasibility, remain unresolved **pre-apply plan conditions**. A1 captures the missing evidence; it may be performed as authorized planning/audit work, but this task list does not authorize application ahead of that disposition. If audit proves incompatibility, return to parent; do not change provider, fork, bundle or weaken safety. Other platforms remain denied unless independently validated.

## 1. Configuration/admission leaves

A1 starts with preserved package evidence; finishes with bounded durable feasibility records; verification is real-package/source-path audit; rollback is removing only new records. A2–A3 start unwired; finish with tested pure policy/profile acquisition helpers; rollback removes helpers and conditionally restores owned settings. A4–A5 start with denied-by-default policy; finish with ordered internal admission/revocation; rollback removes RPC/lifecycle wiring while preserving normal host behavior. A6–A7 start with those seams but no grant; finish with integrated mapping/host validation and truthful UI; rollback withdraws admission and removes only Walker wiring.

- [x] **A1 — Audit prerequisite:** preserve bounded source excerpts/digests under `evidence/ext-package/` resolving bundled `Lg` to its exact requester literal; obtain runtime dependency 3.2.0 implementation and document existing-host schema, precedence, version/architecture validation, PATH/fallback paths. Demonstrate standalone Roslyn reporter suppression on load/error, real telemetry-library behavior, Dev Kit/AI branch suppression and pre-module/revocation feasibility. Record unsupported conclusions explicitly; stop on incompatibility and return findings to parent before code apply. <!-- sdd-owner: implementation -->
- [x] **A2 — Effective policy/defaults:** add failing policy tests under `src/vs/workbench/contrib/csharpEditing/test/common/`, then implement `common/editingPolicy.ts` and companion manifest defaults from D1. Triangulate user/workspace/folder overrides, untrusted/non-file/remote hosts, missing/disabled/unvalidated packages and hostile environment/server/crash-report hooks. Keep permits denied pending A1. <!-- sdd-owner: implementation -->
- [x] **A3a — Profile journal / conditional rollback:** test injected configuration/storage failures, then implement `browser/profileConfiguration.ts` and `test/browser/profileConfiguration.test.ts` with a profile-owned-value/prior-value journal and restore-only-if-unchanged behavior. Preserve unrelated settings/secrets and later user edits; never change `verifySignature`, workspace files, or PATH. <!-- sdd-owner: implementation -->
- [x] **A3b — Pinned gallery acquisition:** test injected gallery failures, then implement `browser/configureEditing.ts` and `test/browser/configureEditing.test.ts` for anonymous pinned `muhammad-sammy.csharp@2.145.21-g154a82fd27` installation plus declared runtime dependency `3.2.0`, with signature/offline/access failure actions. Triangulate cancellation and already-installed/disabled profiles; no command registration (A7 owns wiring). <!-- sdd-owner: implementation -->
- [x] **A4 — Pre-module admission:** after A1 feasibility disposition, add focused ESM/CommonJS/automatic/direct/dependency startup denial tests around `extHostExtensionService.ts`; implement identity-scoped internal RPC in `extHost.protocol.ts`/`mainThreadExtensionService.ts` plus coordinator registration. Verify early-start timeout/malformed/stale permits and unrelated-extension bypass; no client module may load on denial. <!-- sdd-owner: implementation -->
- [x] **A5 — Ordered revocation:** locate configuration/trust/package forwarding and host-stop paths (`mainThreadConfiguration.ts`, extension host managers/service). Write event-order tests first, then stop/revoke before unsafe delivery and require explicit repair/reload. Triangulate already-active unsafe profiles, shared-host restart, package update, trust loss, failed stop and stale grant; failed stop must not forward unsafe updates or claim safety. <!-- sdd-owner: implementation -->
- [x] **A6a — Runtime mapping and compatibility:** implement `common/runtimeMapping.ts` and `test/common/runtimeMapping.test.ts` with requester-specific mapping, the audited compatibility record, zero acquisition-fallback coverage, and independent stable-runtime >=10.0.5, executable, architecture and preview validation. <!-- sdd-owner: implementation -->
- [x] **A6b — Bridge interception (pre-connection deny):** implement `api/node/proxyResolver.ts` and `api/test/node/proxyResolver.test.ts` for an identity-scoped exact-destination VSWebAssemblyBridge deny before any non-local connection, structured denial logs, and fail-closed rule evaluation. <!-- sdd-owner: implementation -->
- [x] **A7a — Editing status module + localized states:** implement `common/editingStatus.ts`, its focused tests, and the status rendering/repair-action surface in `browser/csharpEditing.contribution.ts`. Test localized missing/disabled/conflict/unsupported/toolchain/starting/error/ready states, explicit repair actions, and truthful status that does not treat extension activation as language readiness. <!-- sdd-owner: implementation -->
- [x] **A7b-1 — Admission evaluator + tests:** implement `common/editingAdmission.ts` and its focused tests, composing effective configuration policy with requester-specific runtime mapping. Verify the validated Linux x64 client/runtime profile, true policy conflicts and mapping failures deny eligibility without issuing a permit. <!-- sdd-owner: implementation -->
- [x] **A7b-2 — Contribution wiring + configure command + registration:** complete the remaining `browser/csharpEditing.contribution.ts` wiring, early coordinator startup registration, `walker.csharp.configureEditing`, and the early `workbench.common.main.ts` import. Grant only the validated Linux payload with false OmniSharp, effective AI/restore/source-navigation suppression, telemetry disabled, and verified child configuration. Integrate the A6 component-fetch deny rule before admitted C# activation; preserve pre-connection denial, structured identity/destination logging, benign desktop diagnostics/completion without VSWebAssemblyBridge, installer-failure status, and continued Blazor/wasm debugging denial. Refactor only after policy/RPC suites pass. <!-- sdd-owner: implementation -->


## 2. Toolchain resolution leaves — final parent D3 disposition required

T1a/T1b start with unchanged snapshot/template contracts; finish with independent guarded DTOs/parity; rollback removes only new DTOs. T2a starts without a resolver; finishes with fixed-profile runtime verification and core tests; rollback removes the resolver. T2b starts with that resolver; finishes with isolated process-boundary tests; rollback removes only those tests and the shared output-ceiling seam. T3 starts with a tested resolver and probe boundary; finishes with registered command/host composition and unchanged existing suites; rollback unregisters only the new command.

- [x] **T1a — Extension-side editing-host contract:** add RED request/result guard tests in `extensions/dotnet-toolchain/src/test/contracts.test.ts`, then implement the D3 command constant, independent `DOTNET_EDITING_HOST_SCHEMA_VERSION = 1`, request/result DTOs, and guards in `extensions/dotnet-toolchain/src/contracts.ts`. Triangulate wrong arity/schema/profile, extra executable/argv/cwd/URL/env keys, unsafe result paths/versions, and unchanged snapshot-v1/template readers. <!-- sdd-owner: implementation -->
- [x] **T1b — Core mirror + parity fixtures:** implement the structural D3 mirror in `src/vs/workbench/contrib/csharpEditing/common/toolchainContract.ts` and parity fixtures in `src/vs/workbench/contrib/csharpEditing/test/common/toolchainContract.test.ts`. Keep the mirror independent; no cross-layer implementation imports. <!-- sdd-owner: implementation -->
- [x] **T2a — Editing-host verification core:** implement `extensions/dotnet-toolchain/src/editingHost.ts` behind injected filesystem/process facades and add core verification tests for canonical SDK recheck, realpath/root containment, workspace exclusion, stable Microsoft.NETCore.App >=10.0.5 record parsing, and compatibility outcomes. <!-- sdd-owner: implementation -->
- [x] **T2b — Process-probe boundary tests:** add hostile/negative probe coverage in a separate test module over the same implementation: fixed argv, sanitized child-only env, non-workspace cwd, timeout/output ceilings, spawn/timeout/malformed outcomes, and zero install/network calls. <!-- sdd-owner: implementation -->
- [x] **T3 — Command composition:** extend `extension.ts`, manifest activation event and focused `src/test/extension.test.ts` registration/host tests. Verify unsupported hosts instantiate no resolver process, fresh recheck errors are structured, setup/status/template behavior remains unchanged, and core command client rejects invalid results. Run the existing dotnet-toolchain and projectWizard focused regressions. <!-- sdd-owner: implementation -->

## 3. Solution parsing leaves

S1 starts with graph DTOs; finishes with tested conventional membership parsing; rollback removes parser. S2a starts with S1; finishes with tested folder/cycle/shared-project topology and membership deduplication. S2b starts with S2a; finishes with multi-root, standalone-membership and URI-alias triangulation without merging tree ancestry; rollback removes only the corresponding graph-topology tests.

- [x] **S1 — Conventional solution records:** create `extensions/solution-explorer/src/solutionParser.ts` and fixtures after failing quoted path/GUID/malformed/duplicate/missing entry tests; parse Project records only as data and preserve unsupported sections/kinds as diagnostics. <!-- sdd-owner: implementation -->
- [x] **S2a — Solution topology core:** implement `graph.ts` with NestedProjects cycle handling, solution folders, shared projects, membership deduplication and diagnostics; keep root/solution ancestry in node identity. Add primary graph tests for folder nesting, cycles, shared project records and membership deduplication. <!-- sdd-owner: implementation -->
- [x] **S2b — Multi-root/standalone/alias triangulation tests:** add `graph.topology.test.ts` for multiple workspace roots and solutions, shared-project ancestry, standalone membership and URI aliases without merging distinct tree ancestries. Reorganizing the existing graph fixtures is allowed; preserve all coverage. <!-- sdd-owner: implementation -->

## 4. Project parsing and bounded reads

P1 starts with no shipped graph code; finishes with testable model/packaging skeleton; rollback removes only the new extension. P2a finishes with bounded discovery/read core; P2b adds containment and cancellation safety; rollback removes the reader before wiring. P3–P4 finish with independently tested structural XML scanner/parser; rollback removes XML modules without an evaluator fallback. P5–P7 finish with project metadata/items/references and partial diagnostics; rollback removes projection modules while preserving normal file editing.

- [x] **P1 — Extension/model skeleton (execute before S1):** add localized `extensions/solution-explorer/package.json`, package.nls.json, tsconfig and test scripts following dotnet-toolchain; add `model.ts`/scanLimits.ts pure types. Discover actual built-in discovery/build inclusion targets and test packaged manifest entry resolution; keep language admission/view wiring inactive. <!-- sdd-owner: implementation -->
- [x] **P2a — Bounded discovery and read core:** implement incremental directory enumeration and D5 metadata, solution/project, entry, graph-node and depth limits in `workspaceReader.ts`; exclude bin/obj/.git and reject stat/read overflow. Add controlled filesystem core-reader tests; oversized metadata must never be read with an unbounded allocation. <!-- sdd-owner: implementation -->
- [x] **P2b — Containment, concurrency and cancellation:** enforce symlink skipping and realpath containment, at most four concurrent metadata reads, cooperative cancellation and directory-handle disposal, and the five-second work budget. Add controlled filesystem/clock boundary tests for escapes, concurrency, cancellation and timeout. <!-- sdd-owner: implementation -->
- [x] **P3 — XML scanner:** add failing namespace/attribute/comment/entity/DTD/size/token cases, then implement bounded tokenizer in `xmlReader.ts` (split scanner into its own module if needed for cohesion). Support only predefined/numeric entities and reject DTD/external entities; never regex-extract project items. <!-- sdd-owner: implementation -->
- [x] **P4 — XML structure:** extend failing matched-nesting/namespace-qualified/legacy/malformed/depth fixtures, implement the structural reader atop P3 and refactor duplicated logic. Verify token/depth exhaustion produces project-file navigation and a partial diagnostic, not empty success. <!-- sdd-owner: implementation -->
- [x] **P5 — Project metadata:** implement `projectParser.ts` after conditions/imports/property-expansion/custom-transform fixtures fail. Preserve unsupported declarations with provenance and partial labeling; parse literal SDK/implicit-item disabling controls conservatively without evaluation or a runtime package dependency. <!-- sdd-owner: implementation -->
- [x] **P6 — File declarations:** test then implement `projectItems.ts` local Compile/Content/None Include/Remove/Link, bounded simple globs and SDK implicit .cs inclusion. Triangulate disabled/default controls, external links, duplicate/missing files, unsupported transforms/patterns and exclusion rules; external targets remain display-only until explicit open. <!-- sdd-owner: implementation -->
- [x] **P7 — Dependencies:** add fixture tests then project/package/assembly reference projection and duplicate diagnostics; local projects navigate, missing projects remain visible, packages/assembly versions/hints stay non-fetching metadata. Verify fixture graph summaries and no process/network/project-write boundary exists. <!-- sdd-owner: implementation -->

## 5. Tree/navigation leaves

V1 starts with tested graph; finishes with stable tree nodes and partial states; rollback removes provider. V2 finishes with normal-editor commands/locality/navigation; rollback removes commands. V3 finishes with discoverable packaged view/actions; rollback removes view/config contributions, never user packages.

- [x] **V1 — Tree provider:** test then implement `treeProvider.ts` stable ancestry IDs, workspace/solution/project/file/dependency/diagnostic children, localized partial/missing/unsupported labels and standard icons. Cover multi-root/multi-solution and no-SDK/untrusted graph usability. <!-- sdd-owner: implementation -->
- [x] **V2 — Navigation/locality:** implement normal `vscode.open`/document command handlers with injected host tests; external references require explicit action and no prior stat/read. Verify keyboard commands, unsupported browser/remote/virtual states, no parallel recent-history storage and no SDK calls for tree navigation. <!-- sdd-owner: implementation -->
- [x] **V3 — View composition:** wire extension.ts/tree view/manifests/localization/build inclusion and Install/Configure editing action to the core command. Test activation/disposal and independent tree availability when language packages/toolchain are absent; use standard theme tokens and retain ordinary Explorer. <!-- sdd-owner: implementation -->

## 6. Incremental lifecycle leaves

L1 starts with explicit scan; finishes with bounded current-generation publication/cache; rollback returns to bounded explicit refresh. L2 finishes with relevant watcher refresh and owned disposal; rollback removes watchers but retains Refresh.

- [x] **L1a — Graph controller core:** implement `graphController.ts` generation-gated scanning, bounded URI/content parse caching, graph composition and workspace-topology invalidation. Add primary tests for current-generation publication, cache invalidation and bounded solution/project/file/dependency composition. <!-- sdd-owner: implementation -->
- [x] **L1b — Staleness and failure triangulation tests:** separate tests for stale asynchronous reads, workspace replacement and failure retaining the last truthful partial graph. Reorganizing the existing controller fixtures is permitted; preserve coverage without compression. <!-- sdd-owner: implementation -->
- [x] **L2 — Watchers/disposal:** add relevant metadata/file watcher tests then 150-ms debounce/coalescing, affected-project refresh, 256-event queue bound/full bounded rescan and watcher-store replacement. Triangulate repeated refresh/deactivation/workspace changes with no listener leaks or stale publication. <!-- sdd-owner: implementation -->

## 7. Implementation verification leaves

E1 starts with admitted integration; finishes with packaged installation/security failure and no-reporting evidence; rollback removes test instrumentation only. E2 finishes with live language and declared-tree fixture evidence; rollback removes disposable verification fixture/profile only. E3 finishes with focused regression/state-preservation evidence and complete applicability labels; rollback removes new harness additions, not user state. These are implementation tests/evidence tasks, not parent delivery gates.

- [ ] **E1 — Packaged admission/security:** run isolated Linux packaged probes with exact audited versions/digests. Record default signature failure separately from explicit workaround acquisition, real standalone startup/load/error telemetry suppression, API sender no-op behavior, AI/Dev Kit inertness, child environment and zero runtime acquisition/automatic restore. Test unsafe preinstalled/updated/disabled/profile/workspace overrides and already-active repair/reload transitions; preserve bounded durable redacted traces under evidence/. <!-- sdd-owner: implementation -->
- [ ] **E2 — Actual language and graph:** use a pre-restored multi-project C# fixture to demonstrate completion, diagnostics, hover, definition/references and rename; record requests/results, not install-only claims. Exercise solution/project/reference/file tree, missing/partial metadata and incremental navigation. Use a separately untrusted fixture to prove read-only tree works while Roslyn evaluation is denied; label all unexecuted platform scenarios environment-gated. <!-- sdd-owner: implementation -->
- [ ] **E3 — Preservation/quality regression:** run focused toolchain, projectWizard, admission, graph, tree and lifecycle suites with Node 24.18.0 and exact compiled suite selectors; check localization/keyboard/theme/disposables plus unrelated profile/settings/extensions/secrets/project sentinels and conditional settings rollback. Verify gallery-only provider, telemetry API shapes, retained generic remote/account-free infrastructure and no added project process/network/mutation. Record per-leaf measured changed lines and evidence applicability without treating remote/native unperformed checks as passes. <!-- sdd-owner: implementation -->

## Execution dependency order

A1 feasibility evidence and parent disposition precede apply. Then P1 and A2/A3 can establish independent scaffolding/policy. T1→T2→T3 requires D3 approval; A4→A5 requires D2 feasibility; A6 depends on T3/A1 and A7 depends on A2–A6. Graph order: P1→P2; P1→S1→S2; P3→P4→P5→P6/P7 (read-backed fixtures throughout), then V1→V2→V3→L1a→L1b→L2. E1–E3 require all relevant wiring. Language and graph leaves stay independently useful/revertible; no child task owns parent plan/review/archive/push decisions.
