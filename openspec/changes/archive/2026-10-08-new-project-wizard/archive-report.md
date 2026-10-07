# Archive Report — new-project-wizard

PASS

```yaml
schema: sdd.archive-result/v1
mode: archive
status: pass
change: new-project-wizard
artifact_store: openspec
workspace: /home/marialez/Work/walker
branch: new-project-wizard
head: b49a279e26c
applyState: all_done
verifyState: all_done
syncState: all_done
archiveReady: true
implementation_rows: 15/15
unchecked_rows: 0
ownership_errors: 0
critical_findings: 0
blockers: 0
verification_round: 1
verified_requirements: 7/7
verified_scenarios: 10/10
canonical_merge_performed_in_this_mode: false
destination: openspec/changes/archive/2026-10-08-new-project-wizard/
next_recommended: archived
```

## Closure summary

Walker now provides the approved Rider-style .NET project-creation experience: a local template picker, per-template option discovery, validated configuration, dry-run followed by generation, truthful progress/cancellation/partial results, same-window or new-window opening, and canonical recent projects on Welcome. Welcome, File menu and command palette route to the same wizard. Missing SDK state reuses the existing toolchain setup/recheck path. Optional Git initialization runs through the existing `git.init` command in the generated project's target window, including the new expiring, one-shot deferred continuation for a new window.

The independent round-1 verification is **PASS**, with **7/7 requirements**, **10/10 scenarios**, zero blockers and zero critical findings. All **15/15** persisted implementation rows are checked. Existing canonical sync is **PASS** and its hashes and domain content match the current verified deltas. This archive consumes that evidence; it does not rerun verification, synchronize canonical specs, or certify unperformed live composition/visual checks. Follow-ups and parent-supplied review measurements are preserved below.

## Authority and operation boundary

Parent-injected preflight selects execution `auto`, artifact store `openspec`, delivery `ask-on-risk` resolved to `feature-branch-chain`, a 400-line review budget, and Decision 5's ratified leaf split. The authoritative workspace is `/home/marialez/Work/walker`, branch `new-project-wizard`, observed HEAD `b49a279e26c`. This invocation is explicitly **mode: archive**. The parent authorizes only this English-language closure report and whole-directory relocation to the dated destination; canonical specs and source remain frozen.

The supplied structured status records proposal/specs/design/tasks/apply-progress done, round-1 verification PASS, sync PASS, accounting 15 total / 15 checked / zero remaining / zero errors, core artifacts ready, apply/verify/sync `all_done`, and `archiveReady: true`. Supplied `actionContext` is `{mode: archive, workspace: /home/marialez/Work/walker, branch: new-project-wizard}`. The parent continuation confirms goal `muy6or02` is ACTIVE via the user's `/goal-resume` and resolves the injected goal-unfocused notice as stale parent-side UI state. No goal/focus/todo operation is performed.

`openspec/config.yaml` sets `strict_tdd: false` and contains no additional `rules.archive` policy. No partial-artifact approval, checkbox reconciliation, destructive merge, or collision-order decision is needed. Archive performs no sync, source edit, build/test/live SDK rerun, staging, commit, branch/config change, push, or unrelated cleanup. Older broad implementation grants do not enlarge this invocation's allowed edit scope.

## Freshly read closing gates

- **Tasks:** the complete persisted `tasks.md` was freshly read before report creation and audited as bytes: 15 lowercase checked implementation rows, each carrying `sdd-owner: implementation`, zero unchecked rows. No task is repaired or inferred from a phase summary.
- **Verification:** the round-1 `sdd.verify-result/v1` envelope and body agree on PASS, zero blockers/critical findings, 7/7 requirements and 10/10 scenarios. The report's SHA-256 matches the existing sync record exactly.
- **Sync:** the existing standalone `PASS`, `verdict: pass`, matching evidence revision, source-delta hashes, verified-report hash and both canonical post-sync hashes were confirmed. The complete project-creation delta is the canonical file's byte-identical prefix. The complete Welcome MODIFIED block matches the canonical exact-name target after removing only the `(Previously: Optional accessible onboarding)` merge annotation and normalizing the heading's blank separator. All scenarios remain present. No merge is repeated here.
- **Artifacts:** proposal, two domain specs, design, tasks, apply-progress, verification and sync reports are present and read. Parent authorization including Decisions 1–6 and the historical planning `state.yaml` are preserved. Structured parent status and fresh artifact evidence establish closure; the historical plan snapshot is not rewritten.
- **Safety:** workspace containment, branch/HEAD, absence of symlink indirection in the bundle and its ancestors, and absent destination/report targets were checked before writing.

Verification evidence revision: `sha256:5984b4d8ac48ac45b28b31cec711e78f3cd6212f48af86ad43c5ed366dcece96`.

## Delivered capabilities and protected boundary

| Delivery lane | Delivered behavior and evidence |
| --- | --- |
| P1 — Wizard shell/model | Common localized wizard entry, installed-template filtering and fail-closed selected-template help parsing. Approved families cover console, classlib, webapi/webapiaot, mvc, webapp/razor, blazor/blazorwasm, worker and xUnit/NUnit when installed. Missing templates/options are not fabricated. |
| P2 — Toolchain adapter | Narrow internal `walker.dotnet.runTemplateOperation` accepts only validated local list/help/dry-run/generate requests. Extension owns SDK interaction; core uses its command contract without importing extension implementation. |
| P3 — Configuration/generation/open | Validated name/local destination and supported framework/style/test choices; existing-output refusal; advertised `--no-restore` only; cancellable dry-run/generation; output verification; preserved generated files on failure; actionable `.NET Project` diagnostics; actual recents/open outcomes and selected window mode. |
| P3 — Deferred Git continuation | New-window intent is versioned, machine-scoped, local-folder-only, expiring and removed before dispatch. Only a matching target workspace consumes it. Same-window Git waits for the target folder. Both use existing `git.init` with `skipFolderPrompt: true`; no new Git boundary or `extensions/git/**` edit. |
| P4 — Welcome/recents | Localized `.NET Project` entry routes to the shared command. Recent projects reuse `IRecentlyOpened`/canonical workspace history, ordering and deduplication, normal host opening, keyboard-focusable controls and existing theme tokens; missing-path failures do not rewrite history. |
| P5 — Integration/safety | Passing command/setup/adapter tests and static boundary assertions: no independent SDK discovery, core extension-source import, account/auth dependency, telemetry emission, network template acquisition, or parallel recents store. |

Decision 1's constraints remain binding: only the current verified SDK executable is invoked, with fixed structured arguments through the existing shell-free, bounded, environment-sanitizing `createProcessRunner`; no arbitrary executable, shell or network template acquisition is authorized. Parent security review additionally records fresh recheck per operation, strict request keys, a 12-template/5-option allowlist, duplicate-option rejection, framework validation, safe output/parent checks, child `DOTNET_CLI_TELEMETRY_OPTOUT=1` and per-operation timeouts. The command remains internal, not a newly public extension API.

Generation may perform the template's default package restore; local-template-only means no template download/install, not a claim that enabled package restore is network-free. Decision 3 introduces no independent `dotnet restore` authority. Its implicit restore diagnostics remain part of generation reporting rather than a separately executable stage.

## Decisions 1–6

All six dated decisions are freshly read from `parent-authorization.md`; implementation evidence remains in `apply-progress.md` and independent acceptance in `verify-report.md`.

| Decision | Recorded disposition |
| --- | --- |
| 1 — Narrow toolchain boundary addition | Approved internal validated `dotnet new` list/help/dry-run/generate operations through the existing runner; verified SDK only, fixed argv, no shell/arbitrary executable/network templates, command-based core boundary. |
| 2 — Git-init orchestration | Approved existing `git.init` after opening the generated target workspace; deferred intent for new-window behavior; no Git extension edit or execution in a pre-existing unrelated workspace. |
| 3 — Restore mapping | Approved template-advertised `--no-restore`; default restore remains inside generation, with no allowlist widening or separately attributed restore execution. |
| 4 — Build continuation transport | Clarified that deferred transport did not pre-exist and is built by this change. Completed one-shot transport and matching-window tests substantiate both window paths. This clarification supersedes Decision 2's historical pre-existing-transport wording. |
| 5 — Review split | Ratified phase-based review boundaries for 421-line wizard source and 432-line flow-test files; corresponding test hunks stay with their behavior. Separate deferred pair and Welcome/recent leaf; separate toolchain leaf set. No source compression, test deletion or size exception. |
| 6 — Parent review/measurements | RATIFIED parent PASS reviews of deferred Git intent mechanics and toolchain command, with no required changes. Parent-supplied measurements A=218, B=203, C=271, D approximately 256, boundary-source=212, boundary-tests=112, core-mirror pair=156; every reported leaf at or below 400 reviewed lines, no size exception. |

Decision 6 was persisted after independent round-1 verification and is supplementary final-state review evidence. It does not replace that report, expand its measured coverage, or alter verified domain deltas. The original verification report and existing sync report remain unchanged.

## Verification evidence consumed

All commands below are reported by round-1 independent verification, with observed exit code zero; archive does not execute them again. Full stdout/stderr hashes, exact source selectors and earlier transient parallel-run outcomes remain in `verify-report.md`.

| Command / focused suite | Recorded result |
| --- | --- |
| `npm run compile-client` | Passed; zero TypeScript errors. |
| `npm run typecheck-client` | Passed. |
| `npm test --prefix build` | 498 passed, zero failed. |
| `npm test --prefix extensions/dotnet-toolchain` | 269 passed on the final serial run. |
| `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/projectWizard.test.ts` | 2 passed. |
| `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/projectWizardFlow.test.ts` | 26 passed. |
| `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/templates.test.ts` | 10 passed. |
| `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/deferredGitInitialization.test.ts` | 8 passed. |
| `./scripts/test.sh --run src/vs/workbench/contrib/projectWizard/test/common/projectWizardBoundary.test.ts` | 4 passed. |
| `./scripts/test.sh --run src/vs/workbench/contrib/welcomeGettingStarted/test/browser/gettingStartedProjectWizard.test.ts` | 6 passed on the final serial run. |
| `./scripts/test.sh --run src/vs/workbench/contrib/welcomeOnboarding/test/common/dotnetToolchain.test.ts` | 6 passed. |
| `dotnet new console -n LiveProbe -o /tmp/wizard-live-probe` | Actual console generation and automatic restore succeeded; temporary output was removed by verification. Output hash `10d3f5ba03c9496d59954b6830f39c9e8343d2c248736f7c18aac28d796f4e3b`. |
| `dotnet new webapi --help` | Actual SDK help exposed `--framework <net10.0>`, `--no-restore`, `--use-controllers`; minimal APIs were the default alternative, not an advertised `--use-minimal-apis` switch. Output hash `b369577622033e6cfc2cbbf2907aa1208fb025040df878f558c35172c98466c8`. |

The initial concurrent attempt had temporary lock/await and Welcome import issues; the final serial toolchain and Welcome suites passed, and their captured outputs are hashed. No hashes are inferred for uncaptured earlier output. Verification fixed no implementation defect. Proposal parent evidence supplies SDK 10.0.401 approved-template family coverage; independent live probing directly exercised the SDK, not the complete wizard-to-contract-to-process chain, and did not independently capture every family's help. Dynamic selected-template discovery, rather than proposal example switches, governs actual supported options.

## Canonical domains confirmed, not changed

| Domain | Existing sync operation | Verified delta requirements / scenarios | Frozen canonical requirements / scenarios | Canonical path |
| --- | --- | --- | --- | --- |
| project-creation | New full spec plus non-normative evidence record | 6 / 6 | 6 / 6 | `openspec/specs/project-creation/spec.md` |
| welcome-onboarding | MODIFIED `Optional accessible onboarding`; original two scenarios preserved, two added | 1 / 4 | 3 / 9 | `openspec/specs/welcome-onboarding/spec.md` |
| Total verified delta | Existing passing sync | 7 / 10 | Not an additional merge | Two paths above |

The existing sync recorded no active domain collision, no removals/renames or scenario loss, and a scoped additive Welcome amendment rather than a destructive replacement. No new ordering/destructive approval is needed. The `.NET Toolchain` canonical spec and four product-debloat canonical domains were read and remain frozen; the implementation's narrow authorized internal adapter addition is recorded here without creating an additional domain merge.

## Review-split record and residual ledger

Decision 5 defines A as SDK/readiness/configuration with corresponding flow-test hunks, B as dry-run/generation/output/cancellation/open with corresponding flow-test hunks, C as deferred intent plus matching tests, and D as Welcome/recents plus tests. Toolchain source, boundary tests and core mirror form their own leaf set. Decisions 5–6 and `apply-progress.md` retain the parent disposition. Whole authored-file lengths and review-leaf measurements are distinct; archive does not infer a full-file size waiver or delete tests to meet budget.

| Recorded follow-up / evidence boundary | Preserved disposition |
| --- | --- |
| Wizard → contract → live SDK composition seam | Follow-up integration coverage should connect actual wizard request composition to the real toolchain command and local SDK in an isolated temporary directory, asserting selected-template options and output files. Wizard flow and extension boundary suites passed separately; the direct live SDK probe is narrower evidence. |
| Live high-contrast UI pass | Follow-up live visual/high-contrast session. Automated Welcome keyboard/theme-token coverage passed and is not represented as a live visual pass. |
| Review-leaf measurement provenance | Independent round 1 did not measure per-leaf changed-line totals. Subsequent parent evidence records A=218, B=203, C=271, D approximately 256, boundary-source=212, boundary-tests=112 and core-mirror pair=156 and ratifies them in Decision 6. These are parent-supplied reviewed-line measurements, not independently remeasured here; matching flow-test hunks remain within Decision 5's review prescription. No size exception is claimed. |
| Additional child-environment hardening | Parent review records optional further opt-out variables as later hardening; existing sanitation, telemetry opt-out and scoped process assertions passed. |

These recorded follow-ups do not negate the clearly passing scoped closure. They remain distinct from normative requirements, task completion and independent test evidence; archive adds no new coverage claim.

## Artifact integrity, readback and relocation procedure

The original active bundle has **10 files**. Its SHA-256 over sorted relative path, NUL, complete file bytes, NUL is `d98d74a84193d8093476fb38b76d3f0acdc6c0a843fbc8dd2e1e04bda57d13a3`. This report is the only newly authored artifact. All ten original files, including Decision 6 and historical planning state, are preserved byte-for-byte. No links/references inside frozen original artifacts or canonical evidence records are rewritten; their historical active paths identify the source change, whose corresponding bundle is relocated to the dated destination.

| Artifact | SHA-256 at archive entry |
| --- | --- |
| tasks.md | `dd156c21551dae7c82aacdc5902c9c41b60b0295696cacb782d5a4e29e343059` |
| apply-progress.md | `0134687de18bcd2a9da8ade51ca2ffba5e71d260cf64d5a470bc04f4c472bf06` |
| parent-authorization.md (including Decision 6) | `11f3b79b0f92c621d5b74cf32d26b64ff0f43abb70bc3845645501427be7efb4` |
| verify-report.md | `546b8ce6c0941c4f356641f3064798909244b73a6648bbfa3487428fe7628a7f` |
| sync-report.md | `6f4456343f125faaa08c4fa3505f8da97d3b6bde65422b2745cc772a39fe9585` |
| Canonical project-creation | `eab062d0e801b8f48f7403fdf1d2416ea5c4d42b80b03723dc4117a96080ccd8` |
| Canonical welcome-onboarding | `d8601d65caaeef55d237ca2b4412c2869bf7e3aac91b9b359b055cb1ae443e74` |
| Preserved canonical dotnet-toolchain | `b279d1af38acbbf075086b702cec80e8ffb4c480c69dd2646e764660f043176c` |
| openspec/config.yaml | `0e9471279a1340e670eda8129a6b78f97d5f81026ff7c1996b1e794f52033722` |

Artifacts read: project instructions/config; complete proposal, design, tasks, apply-progress including parent review, parent authorization including Decisions 1–6, state, both change-domain specs, verify-report, sync-report, all seven canonical specifications, and prior `product-debloat` archive-report house style. All ten original artifacts were additionally read in full as bytes for the preservation manifest.

Execution procedure: write and read back this report in the active bundle; freshly recheck tasks, verification and sync; snapshot the full relative path/type/mode/content manifest; refuse any existing destination; rename the whole directory to `openspec/changes/archive/2026-10-08-new-project-wizard/`; read every destination artifact and compare the complete manifest and original ten-file digest; confirm the active path is absent and all seven canonical files plus config are unchanged. This report is not rewritten after movement. The executor returns actual post-move readback results separately. No commit is created; further Git delivery remains parent-owned.

## Key Learnings

- SDK template options vary by template and SDK; discovered help governs switches, not proposal examples.
- Existing `git.init` targets the active workspace, so new-window initialization needs a matching, expiring intent removed before dispatch.
- Direct SDK probing and separately passing wizard/extension suites do not establish live end-to-end composition.
- Parent-reviewed leaf measurements and independent verification coverage are distinct evidence records.
- Whole-directory archival preserves historical artifacts while canonical specifications remain frozen.

next_recommended: archived
