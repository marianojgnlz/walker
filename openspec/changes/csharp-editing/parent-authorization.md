# Parent Authorization — change `csharp-editing`

Base: `main` @ `c85de31f01c` · Delivery: feature-branch-chain off main · Review budget: 400 lines/leaf, `size:exception` declined · Parent owns ALL git operations; per-unit commits authorized on the change branch. Merge to main remains the user's call.

## Decision 1 (2026-10-08): scope gate PASS

`proposal.md` read back and validated after `sdd-proposal` completion (with one parent-supplied evidence round: extracted Open VSX package `muhammad-sammy.csharp` 2.145.21-g154a82fd27, alpine-arm64 + linux-x64, plus acquisition logs 07/08/09). The three open implementation questions were ratified as proposed: explicit anonymous install + config/pre-activation admission gates; built-in Solution Explorer extension + narrow workbench contribution; bounded non-evaluating source parsing. verifySignature application default stays `true`; profile-level workaround documented, used only for verification probes.

## Decision 2 (2026-10-08): plan gate PASS

`sdd-plan` produced and persisted (read back by parent): `specs/csharp-editing/spec.md` (7 requirements / 17 scenarios), `specs/dotnet-toolchain/spec.md` (additive delta, 1 ADDED requirement / 4 scenarios), `design.md` (D1–D7), `tasks.md` (27 leaves A1–A7, T1–T3, S1–S2, P1–P7, V1–V3, L1–L2, E1–E3, forecast 6,400–8,600 lines, guard lines present, all checkboxes `<!-- sdd-owner: implementation -->`). Domains inferred (flagged in spec): new `csharp-editing` + additive `dotnet-toolchain`; no collisions (sole active change).

## Decision 3 (2026-10-08): toolchain-boundary amendment APPROVED (final)

Design D3's concrete `walker.dotnet.resolveEditingHost` contract is approved for implementation (tasks T1–T3): `DOTNET_TOOLCHAIN_COMMANDS.resolveEditingHost`, independent `DOTNET_EDITING_HOST_SCHEMA_VERSION = 1`, profile `roslyn-standalone-10`, ready/unavailable/invalid/failed result unions, strict request/result guards (no caller executable/argv/cwd/URL/env), fresh `recheck()` gate, fixed `--list-runtimes`/`--info` probes under the sanitized child-only env, 10 s timeout, 64 KiB output ceiling, no install/evaluate/remote provisioning, snapshot-v1 readers and `runTemplateOperation` allowlist unchanged. Core mirrors DTOs/guards in `csharpEditing/common/toolchainContract.ts` with parity fixtures; no cross-layer implementation imports. This disposes the widening requested by the proposal ("Proposed Toolchain Boundary Amendment"); canonical delta is the ADDED requirement in `specs/dotnet-toolchain/spec.md`, synced only at close.

## Decision 4 (2026-10-08): workload/delivery disposition

Forecast exceeds the 400-line per-leaf budget in aggregate (High). Resolved per preflight: **feature-branch-chain** of 27 cohesive ≤400-line leaves (including their tests); no `size:exception`; stop-and-reslice to the parent if a measured inseparable leaf exceeds budget. Per-unit commits authorized; parent performs them.

## Decision 5 (2026-10-08): feasibility audit (A1) authorized as pre-apply work

A1 executes before any code leaf. Parent-supplied audit inputs:
- Requester literal resolved by parent grep of `/tmp/csharp-ext-evidence/csharp-linux-x64/extension/dist/extension.js`: `Lg="muhammad-sammy.csharp"` (4 `requestingExtensionId:Lg` uses; line 951 `acquireContext:{version:KP,requestingExtensionId:Lg,...}`). A1 must capture the durable excerpt + digest under `evidence/ext-package/`.
- Runtime dependency `ms-dotnettools.vscode-dotnet-runtime` **3.2.0** extracted by parent from Open VSX to `/tmp/csharp-ext-evidence/dotnet-runtime/extension/` (VSIX `ms-dotnettools.vscode-dotnet-runtime-3.2.0.vsix`, 1,457,925 bytes). A1 audits `existingDotnetPath` schema, requester precedence, version/arch validation, PATH/fallback paths from this source.
- Test-only instrumentation for runtime reporting/telemetry demonstrations is authorized for the verification leaves (E1) with bounded, redacted, durable traces under `evidence/`. A1's demonstration duty is source-path audit + feasibility records; runtime captures belong to E1.

Incompatibility rule (binding, from proposal Risk 1): if A1 cannot establish requester-specific mapping without acquisition fallback, or cannot identify a supported standalone reporting-suppression mechanism, `sdd-apply` stops and returns findings to the parent — no provider change, no forking, no bundling, no boundary weakening.

## Decision 6 (2026-10-08): telemetry blocker disposition — option `authorize-e1-first`

A1 completed (audit accepted; see Decision 7) and returned a fail-closed blocker: the Roslyn server payload documents `ProjectLoadTelemetryReporter` / `VSCodeRequestTelemetryLogger`, but the package supplies neither the server implementation nor a standalone suppression control. Parent disposition, per the executor's closed option set (the lossless envelope is preserved in `apply-progress.md` context and Engram):

- **`authorize-e1-first` is selected.** A bounded runtime probe (an ordered slice of E1, "E1a") executes NOW, before any further code leaf, against the installed Walker build + a disposable scratch profile: anonymous install of the exact audited packages (profile-level `verifySignature:false` rider), a pre-restored multi-project C# fixture, startup + project-load + error + completion triggers.
- **Containment invariant (binding): no outbound packet may reach a non-local destination during the probe.** Network-isolated launch (user-namespace/netns where available) plus a local CONNECT-logging proxy and/or `strace -f -e trace=connect` on the app tree; all connect attempts logged, redacted, digested.
- **Verdict rule (binding):** observed telemetry attempts toward non-local destinations with no supported suppression ⇒ provider incompatibility — STOP, return to the user (options: accept-incompatibility-stop / provider change). Zero non-local attempts + usable diagnostics ⇒ suppression requirement demonstrated; language leaves unblock and the probe record counts as E1 evidence.
- Language-path leaves (A2, A4–A7, T1–T3, E1 remainder) stay blocked until the verdict. Graph/tree leaves (P/S/V/L) may be scheduled by the parent after the probe returns, independent of the language verdict.

## Decision 7 (2026-10-08): A1 evidence-leaf size disposition

A1 measured 441 additions+deletions (41 over the 400 budget) — a documentation/evidence-only slice (audit records + progress); no product code. Parent accepts the overage for THIS leaf only under the stop-and-reslice rule; it is not precedent for code leaves, which remain hard-capped at 400.

## Decision 8 (2026-10-08): E1a telemetry verdict + VSWebAssemblyBridge fetch disposition

**E1a verdict accepted (Decision 6 criterion MET):** runtime probe on the exact audited packages (scratch profile, contained network) shows zero C#/Roslyn-telemetry-originated non-local attempts across startup, project-load, compiler-error, completion and recovery, with requester-specific mapping succeeding without acquisition fallback and Roslyn diagnostics/completions usable. The telemetry-suppression blocker is resolved; language leaves (A2, A4–A7, T1–T3) are UNBLOCKED. E1's remaining scenarios stay open for the full E1 pass.

**VSWebAssemblyBridge finding:** C# extension activation unconditionally attempts `https://vsdebugger.blob.core.windows.net/vswebassemblybridge-9-0-705702/vswebassemblybridge.zip`; `csharp.wasm.debug.useVSDbg` (default true) does not gate it; denial (502) was functionally benign for desktop editing in run 3. Disposition: the supported path MUST deny this activation-time fetch — identity-scoped, logged, fail-closed — via the D2 admission coordinator (component-fetch deny rule for the admitted C# identity). This is a design amendment: sdd-plan must bound-revise design (D1/D2) and tasks (A6/A7) to carry the deny rule + tests, and add a `#### Scenario:` to the existing "Fail-closed activation admission" requirement in `specs/csharp-editing/spec.md` (pre-sync delta, no canonical change). Blazor/wasm debugging remains out of scope and denied.

**Attribution notes (recorded, out of change scope):** eight `open-vsx.org /vscode/gallery/control` background GETs are Walker's own gallery control-cache polling; three `redirector.gvt1.com` attempts are Chromium/Electron startup traffic (purpose unconfirmed at TLS level — pre-existing Walker behavior, not this change); nine direct IPv6 attempts failed ENETUNREACH with unknown purpose and no timestamps — recorded in `e1-probe/E1a-network-attribution.jsonl` for the parent boundary review.

## Decision 9 (2026-10-08): A2 micro-overage accepted + A3 re-slice authorized

Apply reported A2 = 404 lines (4 over) complete and A3 = 570 lines projected against the hard 400-line budget. Per the no-compression rule:
- **A2 accepted at 404** as a one-off parent dispensation (347 policy/tests + 57 manifest/checklist/progress lines). Not a precedent; subsequent leaves target ≤400 with margin.
- **A3 re-sliced** into two parent-authorized units, each hard-capped ≤400 measured lines:
  - **A3a — profile journal / conditional rollback**: `browser/profileConfiguration.ts` + `test/browser/profileConfiguration.test.ts` (owned/prior-value journal per profile, restore-only-if-unchanged, never verifySignature/workspace files/PATH).
  - **A3b — pinned gallery acquisition**: `browser/configureEditing.ts` + `test/browser/configureEditing.test.ts` (anonymous pinned install of C# 2.145.21-g154a82fd27 + runtime dep 3.2.0, signature/offline/access failure actions, canceled-acquisition and already-installed/disabled triangulation).
  - The apply executor amends `tasks.md` accordingly: replace the single A3 row with A3a/A3a-ordered rows (both `<!-- sdd-owner: implementation -->`, original text split at the journal/acquisition boundary), one forecast sentence noting the Decision 9 re-slice. Checkbox authority: A2 stays checked; A3 original row is replaced by A3a/A3b unchecked until each completes.
- A4/A5 authorization remains separate and pending.

## Decision 10 (2026-10-08): T1 re-sliced into T1a/T1b

T1 measured 454 lines (54 over) as a single unit — the wire contract is inherently two-sided (extension DTOs/guards + core structural mirror + independent test suites). Disposition: **re-slice, no exception**. The apply executor replaces the single T1 row with:
- **T1a — Extension-side editing-host contract**: `extensions/dotnet-toolchain/src/contracts.ts` additions + `src/test/contracts.test.ts` (~221 lines measured).
- **T1b — Core mirror + parity fixtures**: `src/vs/workbench/contrib/csharpEditing/common/toolchainContract.ts` + `test/common/toolchainContract.test.ts` (~233 lines measured).
Both rows `<!-- sdd-owner: implementation -->`, one forecast sentence noting the Decision 10 re-slice. Already-authored, passing code maps onto the two rows; the executor measures, flips each checkbox, and records per-unit counts. T2/T3 continue afterward under the same per-leaf cap.

## Decision 11 (2026-10-08): T2 re-sliced into T2a/T2b

T2 measured 465 lines (65 over). Disposition: **re-slice, no exception**. The apply executor replaces the single T2 row with:
- **T2a — Editing-host verification core**: `extensions/dotnet-toolchain/src/editingHost.ts` implementation (canonical SDK recheck, realpath/root containment, workspace exclusion, stable Microsoft.NETCore.App >=10.0.5 record parsing, compatibility outcome) + its core verification tests.
- **T2b — Process-probe boundary tests**: the hostile/negative probe surface (fixed argv, sanitized child env, non-workspace cwd, timeout/output ceilings, spawn/timeout/malformed outcomes, zero install/network calls) as a separate test module over the same implementation.
Reorganizing already-authored tests between the two rows is permitted (no filler, no compression of coverage); both rows `<!-- sdd-owner: implementation -->`, one forecast sentence noting the Decision 11 re-slice. Each row must measure ≤400 lines.

## Decision 12 (2026-10-08): A6 re-sliced into A6a/A6b

A6 measured 437 lines (37 over). Disposition: **re-slice, no exception**, matching the natural module boundary of the authored code:
- **A6a — Runtime mapping and compatibility**: `src/vs/workbench/contrib/csharpEditing/common/runtimeMapping.ts` (+ its test file) — requester-specific mapping, compatibility record, zero-acquisition-fallback enforcement, independent >=10.0.5/executable/architecture/preview validation.
- **A6b — Bridge interception (pre-connection deny)**: `src/vs/workbench/api/node/proxyResolver.ts` (+ `src/vs/workbench/api/test/node/proxyResolver.test.ts`) — identity-scoped exact-destination VSWebAssemblyBridge deny before any non-local connection, structured log, fail-closed evaluation.
The executor replaces the A6 row with A6a/A6b (both `<!-- sdd-owner: implementation -->`, one forecast sentence noting the re-slice), measures each, flips both if within cap, and records per-unit counts. A7 remains a separate authorization.

## Decision 13 (2026-10-08): A7 re-sliced into A7a/A7b + regression remediation ordered

A6a (232) and A6b (214) accepted within cap. A7 measured 775 lines (375 over). Disposition: **re-slice, no exception**, split at the status/wiring module boundary — the executor distributes the authored files/tests between the rows and reports per-unit counts:
- **A7a — Editing status module + localized states**: `common/editingStatus.ts`, its tests, and the contribution's status rendering/repair-action surface.
- **A7b — Contribution wiring + configure command + registration**: `browser/csharpEditing.contribution.ts` remaining wiring, early coordinator startup registration, `walker.csharp.configureEditing`, `workbench.common.main.ts` import, integration tests.
Both rows `<!-- sdd-owner: implementation -->`, one forecast sentence noting the re-slice; each hard-capped ≤400 measured lines; honest per-unit stop if over.

## Decision 18 (2026-10-08): verify round 1 FAIL → bounded remediation authorized

Independent verify round 1 (report at HEAD de1b7d07c59) returned **fail**: 6/9 requirements, 22/25 scenarios; 416 focused tests passing; 3 CRITICAL findings + 2 blockers. Parent confirmed all three criticals by direct inspection:
- **R1** (revocation gap): `csharpEditingSafetyConfigurationKeys` omits `dotnetAcquisitionExtension.allowInvalidPaths` + `sharedExistingDotnetPath` though admission validates both → post-admission changes bypass revocation.
- **R2** (parser): implicit `.cs` inclusion processed after `Compile Remove` → excluded files reintroduced without a partial warning.
- **R3** (missing test): `csharpEditing.contribution.test.ts` does not exist — the canonical selector pointed at a nonexistent file.
- **R4** (truthful wording): install-failure text says "Open VSX rejected the C# package signature" but the durable observed error is "Signature verification was not executed".
- **R5** (assertion quality): a mock test manually fabricates diagnostics/completion events — locate and fix within the csharpEditing/solution-explorer test trees.

**Remediation authorization (mode: remediate, bounded)**: failed evidence revision = verify-report @ de1b7d07c59; narrowed surfaces = exactly `src/vs/workbench/api/browser/mainThreadExtensionService.ts` (R1), `extensions/solution-explorer/src/projectItems.ts` + `src/test/projectItems.test.ts` (R2), `src/vs/workbench/contrib/csharpEditing/test/browser/csharpEditing.contribution.test.ts` (R3, new), `src/vs/workbench/contrib/csharpEditing/browser/configureEditing.ts` + `test/browser/configureEditing.test.ts` (R4), the flagged mock test file once identified (R5), plus `apply-progress.md` (append-only remediation section). Each fix ≤400 lines, RED→GREEN where applicable, historical evidence preserved, then **fresh independent sdd-verify**.

**Accounting reconciliation**: the accumulated E-phase fix surface (943+/88− across 8 csharpEditing files between commits 36c6538a530..de1b7d07c59) is ACCEPTED as multiple distinct probe-driven micro-fix units (staged-write race, dependency-permit ordering, mapping-write, configure sequencing — each RED→GREEN at the time). Recorded as accounting reconciliation; not a precedent for single-leaf sizes.

**openspec CLI blocker resolved**: authorize a one-off cache-only `npx --yes openspec validate csharp-editing` (no repo dependency mutation) as the validation command; if network-unavailable, record the validation as environment-gated with structural validation delegated to the close gate's sync step.

## Decision 19 (2026-10-08): verify round 2 → one remaining CRITICAL; bounded remediation round 2 authorized

Round 2 (report @ c6a34b76ae3) confirmed R1–R5, 429 runner tests passing, contribution suite loading under the canonical selector — but the deeper source audit found **R6 (CRITICAL, Active-profile invalidation)**: in `mainThreadConfiguration.ts`, queued handlers classify the CAPTURED event's affectedKeys yet forward the ENTIRE current configuration snapshot at execution time, so an earlier unrelated queued event can deliver a later unsafe setting before the later safety event revokes/stops the host.

**Remediation authorization (mode: remediate, bounded)**: failed evidence = round-2 verify-report @ c6a34b76ae3. Fix: safety classification must be re-evaluated at FORWARD/EXECUTION time (revoke/stop before any queued forward whose current snapshot differs from its captured safety classification), or equivalently withhold queued forwards whose snapshot now contains unsafe values until revocation completes. Narrowed surfaces: `src/vs/workbench/api/browser/mainThreadConfiguration.ts` + `src/vs/workbench/api/test/browser/mainThreadConfiguration.test.ts` (RED integration test reproducing the interleaving: unrelated event queued → safety change → queued callback executes → unsafe snapshot must NOT be delivered before revocation/stop) + `apply-progress.md` (append-only). ≤400 lines; then **fresh independent sdd-verify round 3**. Openspec CLI stays environment-gated (Decision 18).

## Decision 14 (2026-10-08): S2 checkbox corrected + S2 re-sliced into S2a/S2b

The apply executor checked S2 despite measuring 461 lines (61 over cap) — a deviation from the honest-stop rule. Correction: **S2 stays unchecked** until its re-sliced units pass. Disposition: **re-slice, no exception**, at the source/test-module boundary of the authored code:
- **S2a — Solution topology core**: `extensions/solution-explorer/src/graph.ts` (folders, nested-project cycles, shared projects, membership dedup) + the primary `graph.test.ts` portion covering those behaviors.
- **S2b — Multi-root/standalone/alias triangulation tests**: a separate test module (e.g. `graph.topology.test.ts`) housing the multi-root/multi-solution/standalone-membership and URI-alias cases (reorganizing authored tests is permitted; no coverage compression, no filler).
Both rows `<!-- sdd-owner: implementation -->`; each hard-capped ≤400 measured lines; the executor replaces the S2 row, measures, and flips only compliant units. P2 proceeds after S2a/S2b land.

## Decision 15 (2026-10-08): P2 re-sliced into P2a/P2b

P2 measured 628 lines (228 over). Disposition: **re-slice, no exception**, split at the reader-concern boundary of the authored code (executor distributes source/tests between the rows):
- **P2a — Bounded discovery and read core**: incremental directory enumeration, D5 size/count/depth limits, bin/obj/.git exclusions, stat/read overflow rejection + the core reader tests.
- **P2b — Containment, concurrency and cancellation**: symlink skip + realpath containment, 4-concurrent-reader bound, cooperative cancellation incl. directory-handle disposal, 5-second work budget with controlled clock + the corresponding boundary tests.
Both rows `<!-- sdd-owner: implementation -->`, one forecast sentence noting the re-slice; each hard-capped ≤400 measured lines; honest per-unit stop if over. (Row-count arithmetic note: 34 rows total after all re-slices; parent tally errors in earlier briefs are superseded by artifact readbacks.)

## Decision 16 (2026-10-08): L1 re-sliced into L1a/L1b

L1 measured 437 lines (37 over; implementation and tests pass, left unchecked per the honest-stop rule). Disposition: **re-slice, no exception**, split at the controller/test boundary (executor distributes authored content):
- **L1a — Graph controller core**: `graphController.ts` generation-gated scanning + bounded parse cache source + the primary `graphController.test.ts` portion (generation gating, cache invalidation).
- **L1b — Staleness and failure triangulation tests**: separate test module housing stale-async-read, workspace-replacement and failure-retains-partial-graph cases (reorganizing authored tests permitted; no coverage compression, no filler).
Both rows `<!-- sdd-owner: implementation -->`, one forecast sentence noting the re-slice; each hard-capped ≤400 measured lines. L2 proceeds after L1a/L1b land.
