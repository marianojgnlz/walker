# E3 — Preservation and quality regression evidence

## Status and scope

Structured status consumed from the persisted standing authorization in `PARENT-NOTES.md`: sole active OpenSpec change `csharp-editing`, `artifactStore=openspec`, `applyState=ready`, `nextRecommended=sdd-apply`, `mode=implement`, assigned E1 → E2 → E3; no dependencies or blocked reasons; authoritative workspace `/home/marialez/Work/walker`; allowed roots include only the approved C# implementation/test surface and E-track evidence/tasks/progress; delivery is the resolved `feature-branch-chain` off `main`, owned by the parent. Review budget is 400 repo-facing lines per leaf, no size exception; probe evidence is excluded. `openspec/config.yaml` sets `strict_tdd: false`, so no strict-TDD cycle table applies.

The checked-in/source behavior was not changed during this E3 verification pass. Tests ran with Node **24.18.0**. The E1/E2 conclusions and caveats are detailed in [`e1-probe/E1b-packaged-admission.md`](e1-probe/E1b-packaged-admission.md) and [`e2-probe/E2-live-language-graph.md`](e2-probe/E2-live-language-graph.md).

## Focused verification

| Command / selector | Result |
| --- | --- |
| `mise exec node@24.18.0 -- npm run compile-client` (fresh compile before canonical RPC-selector retry) | Passed. This compile and selector retry are from the immediately preceding verification sequence; no source edits followed them. |
| `mise exec node@24.18.0 -- npm run typecheck-client` | Passed in this closeout. |
| `VSCODE_SKIP_PRELAUNCH=1 mise exec node@24.18.0 -- ./scripts/test.sh --run` with the source selectors listed below | **99 passing**; included the canonical `mainThreadExtensionServiceAdmission.test.ts` selector (9 admission tests). |
| `mise exec node@24.18.0 -- npm test --prefix extensions/dotnet-toolchain` | **283 passing**; extension compile and tests both exited 0. |
| `mise exec node@24.18.0 -- npm test --prefix extensions/solution-explorer` | **61 passing**; extension compile and all parser/graph/tree/navigation/lifecycle/manifest tests exited 0. |
| Canonical Electron selector `src/vs/workbench/api/test/common/extHostExtensionServiceAdmission.test.ts`, retried after the fresh client compile | **Did not load**: Electron's dynamic import failed with `TypeError: Failed to fetch dynamically imported module`. No green Electron result is claimed for this selector. |
| Direct compiled Mocha run of `out/vs/workbench/api/test/common/extHostExtensionServiceAdmission.test.js` and the in-memory source harness for that RPC seam | **6 passing each**. These are narrow fallback evidence for the RPC behaviors, not a substitute claim that the canonical Electron selector passed. |
| Separate `csharpEditing.contribution.test.ts` Electron selector attempt | **Did not load**: `TypeError: Failed to fetch`. No passing total is claimed for it. |

The exact source selectors in the 99-test Electron run were:

```text
src/vs/workbench/contrib/csharpEditing/test/browser/configureEditing.test.ts
src/vs/workbench/contrib/csharpEditing/test/browser/profileConfiguration.test.ts
src/vs/workbench/contrib/csharpEditing/test/common/editingAdmission.test.ts
src/vs/workbench/contrib/csharpEditing/test/common/editingPolicy.test.ts
src/vs/workbench/contrib/csharpEditing/test/common/editingStatus.test.ts
src/vs/workbench/contrib/csharpEditing/test/common/runtimeMapping.test.ts
src/vs/workbench/contrib/csharpEditing/test/common/toolchainContract.test.ts
src/vs/workbench/api/test/browser/mainThreadExtensionServiceAdmission.test.ts
src/vs/workbench/contrib/projectWizard/test/common/deferredGitInitialization.test.ts
src/vs/workbench/contrib/projectWizard/test/common/projectWizard.test.ts
src/vs/workbench/contrib/projectWizard/test/common/projectWizardBoundary.test.ts
src/vs/workbench/contrib/projectWizard/test/common/projectWizardFlow.test.ts
src/vs/workbench/contrib/projectWizard/test/common/templates.test.ts
```

The C# suite results include preflight-before-acquisition, mapping-before-dependency-admission, C# independent denial, profile rollback/user-edit preservation, unsafe effective-configuration denial, untrusted/remote/non-file denial, requester mapping validation and active-host revocation ordering. The projectWizard tests retain the shared account-free toolchain contract, local-only operation boundaries and canonical workspace history. The Solution Explorer suite covers partial/missing declarations, bounded parser limits, read-only graph behavior in untrusted workspaces, standard icons/localized labels, normal editor navigation, 150-ms watcher coalescing, 256-event overflow, stale scans and disposal.

## Preservation and security applicability

- `profileConfiguration.test.ts` passed the assertions that rollback restores only unchanged Walker-owned settings and preserves later user edits and unrelated state. Mapping/settings resume and schema-owner race tests also passed.
- The untrusted E2 probe recorded unchanged scratch profile settings and identical before/after hashes for the fixture project/source files, with no C# runtime mapping or Roslyn process. This is a scratch-fixture sentinel, not a live test of an installed unrelated extension or secret store.
- No secret/credential files were read or changed. No user profile, installed extension inventory, or real project was used as a writable test fixture. A separate real extension/secret sentinel was not seeded, so do not claim that sentinel as independently tested.
- The configure/admission tests exercise the anonymous gallery provider, exact package identities, disabled-package behavior, and no silent enablement. There is no market/fallback provider in the accepted source path.
- The graph and toolchain tests exercise their explicit process/network/project-write boundaries. The live packaged probes were route-contained; the pre-restored C# fixture was not built and did not invoke automatic restore.
- Localization, theme-token use, normal editor command ownership, and disposal are covered by extension unit suites. The live Solution Explorer row keyboard/double-click attempt timed out; do not upgrade that specific UI interaction to a pass. No screenshot/visual theme audit was performed.
- No platform result is inferred from Node-only tests: Windows/macOS and remote/browser C# editing remain environment-gated. API telemetry sender no-op behavior and every package-specific reporting/error path were not independently runtime-instrumented in E1b; the bounded E1a zero-observed telemetry result remains scoped to its exercised triggers.

## Per-leaf changed-line record

These measurements are copied from the cumulative apply-progress records for already-completed implementation leaves; they are not newly derived from Git metadata. Existing attempts that were deliberately re-sliced are marked superseded rather than counted as delivered leaves.

| Implementation leaf | Recorded changed lines | Budget / applicability note |
| --- | ---: | --- |
| A2 | 404 | Historical one-off parent acceptance is recorded in apply-progress; not an E-track edit. |
| A3a / A3b | 373 / 362 | Within 400 each. |
| A4 / A5 | 386 / 332 | Within 400 each. |
| A6a / A6b | 232 / 214 | Within 400 each. |
| A7a / A7b-1 / A7b-2 | 298 / 161 / 339 | Within 400 each. |
| Bounded remediation | 27 | Within 400. |
| T1a / T1b | 221 / 233 | Within 400 each. |
| T2a / T2b | 381 / 108 | Inclusive counts recorded in apply-progress; within 400 each. |
| T3 | 135 | Pre-checkbox/progress count recorded in apply-progress. |
| S1 / S2a / S2b | 217 / 396 / 184 | Within 400 each. Earlier 461-line S2 attempt was re-sliced and is not a delivered leaf. |
| P2a / P2b | 337 / 369 | Within 400 each. Earlier 628-line P2 attempt was re-sliced. |
| P3 / P4 | 271 / 316 | Within 400 each. |
| P5 / P6 / P7 | 269 / 374 / 254 | Within 400 each. |
| V1 / V2 / V3 | 359 / 250 / 358 | Within 400 each. |
| L1a / L1b / L2 | 399 / 157 / 398 | Within 400 each. Earlier 437-line L1 attempt was re-sliced and is not a delivered leaf. |
| E1/E2/E3 evidence records and probe transcripts | Excluded | Parent's standing review-budget rule excludes probe evidence. No production source leaf was added during this E3 test run. |
| E1 pre-closeout source-fix surface | Not measured here | The historical E1 progress note assigns its line accounting to the parent and prohibits Git operations by this executor. Parent review must reconcile that pre-existing source-fix surface against the 400-line E1 leaf; no size exception is claimed. |

## Commands and result provenance

- Root suite and typecheck: run in `/home/marialez/Work/walker`; command lines and full 99-test summary were emitted by the focused runner in this session.
- Extension suites: `extensions/dotnet-toolchain/package.json` and `extensions/solution-explorer/package.json` use TypeScript compile followed by Mocha TDD; both completed with the totals above.
- Canonical RPC load error, prior direct Mocha fallback and in-memory harness totals: recorded in the immediately preceding E-track verification sequence described in the handoff context. The canonical load error remains a risk and is intentionally not hidden by the fallback results.

## Procedure B final cleanup

Testing was finished before cleanup. The exact process inventory confirmed there was no remaining `/home/marialez/Work/VSCode-linux-x64/walker` main or child and no Walker-class window. The scratch-root inventory found the filtered Open VSX proxy (`29662`), its launch wrapper (`29660`) and 50 `socat` bridges whose command lines all targeted the exact scratch `open-vsx-proxy.sock`; those verified helpers received `SIGTERM`. A subsequent inventory found no scratch-owned Python/socat helper, no dev-build Walker process, no Walker window, no listener on the harness ports (`5215`, `5216`, `5217`, `5219`, `5228`, `5230`, `5232`, `5234`, `5240`, `5286`, `5288`, `5301`, `5311`, `5313`, `5315`), and no named `walker-csharp-e2` network namespace. The E2 main PID had already exited by final cleanup, so it was not signaled. Scratch profiles, fixtures and logs were retained; no `rm` or temp-root deletion was run.

## Review focus

Inspect the failed canonical ext-host/contribution selectors separately from their narrower fallback evidence; confirm no suite with a failed module import is described as green; review the retained live UI and wrapper-exit caveats; confirm no trust-only or secret-sentinel claim is overstated; and have the parent account the pre-existing E1 source-fix line surface before delivery.
