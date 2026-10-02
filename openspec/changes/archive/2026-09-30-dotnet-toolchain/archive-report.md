# Archive Report — dotnet-toolchain

PASS

```yaml
mode: archive
status: pass
change: dotnet-toolchain
artifact_store: openspec
workspace: /home/marialez/Work/walker
branch: dotnet-toolchain
actionContext:
  mode: archive
  execution: auto
applyState: all_done
verifyState: all_done
syncState: all_done
archiveReady: true
implementation_rows: 61/61
unchecked_rows: 0
ownership_errors: 0
critical_findings: 0
behavioral_blockers: 0
destination: openspec/changes/archive/2026-09-30-dotnet-toolchain/
next_recommended: archived
```

## Change summary

Walker 0.1.0 .NET toolchain bootstrap implements local detect/install/verify/status through a built-in local/UI extension and replaces first-run authentication with account-free toolchain onboarding. Explicit LTS, STS, or validated specific-version selection and confirmation precede home-scoped installation. Execution-based SDK readiness, recoverable staged publication, cancellation, serialized ownership, commands, output and status remain separate from project SDK resolution. Theme/keymap personalization and continuation without setup are retained. Product-wide account removal is a separate compliance lane.

## Authority and operation boundary

Parent-authoritative status selects only `dotnet-toolchain`, store `openspec`, branch `dotnet-toolchain`, and archive mode with automatic execution. Session preflight uses ask-on-risk delivery, a 400-line review budget, feature-branch-chain, and no size exception. Historical planning chain-choice wording is superseded by this preflight. Parent explicitly authorizes the dated whole-directory relocation and this report; no partial-artifact approval or task reconciliation is needed.

Allowed mutations are the active change directory and `openspec/changes/archive/**`. Canonical specs are read-only and already synced. This operation performs no canonical merge, implementation edit, build, test, network smoke, staging, commit, or git-state change. Existing uncommitted remediation and pre-existing `.pi/` and OpenSpec content are preserved. `openspec/config.yaml` contains no additional archive rules. No separate post-verification final-state evidence was supplied.

## Freshly read closure gates

- **Tasks:** full persisted `tasks.md` re-read immediately before reporting; exactly 61 implementation-owned rows, all checked, zero unchecked rows and zero ownership errors. No checkbox repair was performed. Historical handoff excerpts in cumulative progress do not replace current task accounting.
- **Independent verification:** `verify-report.md` opening `sdd.verify-result/v1` envelope states `verdict: pass`, zero blockers, zero critical findings, 10/10 requirements and 26/26 scenarios; standalone `PASS` is present. Round 3 records three fresh consecutive runs of 266 extension tests and zero exits for extension compile/typecheck, client transpilation, focused onboarding common/browser tests and client typecheck. This archive consumes that report rather than a phase summary.
- **Completed sync:** `sync-report.md` states `status: pass`, standalone `PASS`, and terminal `sync completed.`. Fresh canonical and change-domain hashes match all four recorded sync hashes; the verification-report hash also matches the sync evidence. Both canonical files were read in full. No additional merge is needed.
- **Required artifacts:** proposal, both domain specs, design, tasks, cumulative apply progress, verification and sync reports are present and read. The historical `state.yaml` is preserved with the whole directory, without rewriting parent state.
- **Destination:** `openspec/changes/archive/2026-09-30-dotnet-toolchain/` is absent at the pre-move check; authoritative workspace and relocation ancestors were checked for path containment and symlink indirection.

## Remediation evidence and optional retry disposition

Both rounds are complete and assessed by the independent round-3 report:

| Round | Finding | Recorded outcome and traceability |
| --- | --- | --- |
| 1 | R1 | Deterministic staged-probe promise synchronization before cancellation, bounded timeout and preserved assertions; five recorded runs of 263 tests. See `apply-progress.md` lines 3250–3252 and `verify-report.md` R1. |
| 1 | R2 | Operation-owned Unix curl/wget wrappers disable inherited configuration and enforce HTTPS-only requests/redirects for dry-run and installation; child-only PATH and shell-free spawning retained. Parent accepted the documented Windows PowerShell boundary. See progress lines 3254–3256 and verification R2. |
| 1 | R3 | Recorded isolated runtime-only → user-selected LTS → managed SDK 10.0.401 → direct MSBuild execution 18.9.11.42413 → fresh-process/profile restart Ready. System component evidence matches before/after; subsequent offline diagnostic preserves hashes of the managed host and selected MSBuild DLL. See progress lines 3258–3284 and verification R3. |
| 2 | R4 | Production extension → installer → candidate chain obtains live local file-scheme workspace roots on every pass. Direct workspace candidates and aliases resolving into roots are excluded before probing; dynamic recheck and remote URI exclusion have current tests. See progress lines 3295–3298 and verification R4. |
| 2 | R5 | Shared probe/installer/termination-tool boundary strips inherited shell startup and DOTNET/MSBUILD hooks case-insensitively, rejects explicit shell startup keys, preserves deliberately trusted explicit probe values, and leaves the parent environment unchanged. See progress lines 3300–3303 and verification R5. |

The additional post-offline retry demo was **cancelled by user decision** after two ten-minute click polls. Its dialog appeared on Hyprland's `FALLBACK` output rather than the physical screen. No user confirmation or new installer activity was observed for that retry leg; it remains an infrastructure-limited unverified demo, not an established product defect. Parent close-out and independent R3 assessment retain literal proposal criterion 6 as satisfied without this optional leg, with retry behavior covered by tests. Parent teardown removed owned smoke processes and scratch SDK data, retaining the evidence directory. This archive does not extend that native smoke coverage.

## Synced domain state and traceability

| Domain | Canonical path | Requirements / scenarios | Prior sync operation |
| --- | --- | --- | --- |
| dotnet-toolchain | `openspec/specs/dotnet-toolchain/spec.md` | 7 / 19 | Full new domain addition, plus documented verified discovery, child-sanitation and Unix transport clarifications. |
| welcome-onboarding | `openspec/specs/welcome-onboarding/spec.md` | 3 / 7 | Full new domain addition with clean canonical purpose wording and separate product-wide compliance boundary. |

All 10 exact requirement names and 26 named scenarios are retained. Canonical toolchain refinements reconcile the original domain prose with design D2/D3, remediation R2/R4/R5 and the verified current contract; original change specs stay intact. Fresh hashes confirm the previously read-back sync state, rather than demanding byte equality with earlier planning prose. The prior sync had no domain collisions or destructive operations and required neither ordering nor destructive-merge approval. Archive performs no removal or replacement merge.

SHA-256 evidence:

| Artifact | Digest |
| --- | --- |
| Canonical dotnet-toolchain spec | `b279d1af38acbbf075086b702cec80e8ffb4c480c69dd2646e764660f043176c` |
| Canonical welcome-onboarding spec | `ab2917ce28572e4d96f5cef8d5682fa9a29bf000c718ee916f556058c2341b85` |
| Change dotnet-toolchain spec | `57af8b3471ef48920bcc1f3965d85271f6bd9a74efd0d160c870d57a845eb033` |
| Change welcome-onboarding spec | `aa42ce821601686fbfe4fb843c462eeb3ba21681184f525b2a8b6ef48896b606` |
| tasks.md | `ceab3d819e611198c86636b9fb63dd7c7cc24e42082aa1a07a296aa674e56d1b` |
| apply-progress.md | `79df09febcedcd04d2007150dfd3b4f3ddabbc580ae3ae75a25af3e88c68f380` |
| verify-report.md | `f51aafdb028d6a5f0ca4024ce63c70255ae0934da1f4afdca9e6a26a47e6bf69` |
| Verification evidence revision | `95d81d6766a575e2ae1e8a65038f3232b6e3e336bea2fd9308d5ef9dcdfce4fb` |
| sync-report.md | `9137bb49bb3f21de90702a8043cb651d7a42d4d5b5668c9374a9a0feea845f8c` |

Branch traceability: read-only `git log --oneline main..dotnet-toolchain` confirms 22 commits, from A1a `db655eca0cd` and A1b `e095d2e7774` through D1 tip `f0e3e37affc`; C7 is `6c1e1a946f9`, and the adjacent branding commit is `6b786b02524`. Both remediation rounds remain uncommitted and are traced through cumulative progress/current verification, not attributed to an invented commit. No archive commit is created.

Retained evidence root: `/tmp/walker-dotnet-remediate-ZfUzRotmXk/evidence/`, whose files were listed afresh. Pointers include `managed-sdk-verification.txt`, `ready-state-snapshot.txt`, `before-system.txt`, `after-system.txt`, `offline-failure-snapshot.txt`, `managed-before-offline.txt`, `managed-after-offline.txt`, `runtime-bin-listing.txt` and retained smoke logs. These are external temporary evidence, not relocated into OpenSpec. Their interpreted results are recorded in progress and independent verification; the archive does not rerun them or treat the component hashes as recursive whole-tree audits.

## Retained platform gaps and assessed deviations

- Native macOS/Windows install, cancellation, rename and locality remain unverified; platform fixtures are bounded evidence, not native certification. Windows PowerShell HTTPS-to-HTTP payload redirect rejection is the explicit parent-accepted security limitation; Unix wrapper enforcement does not certify Windows.
- General live supported-proxy interoperability is deferred. The controlled localhost allowlist proxy demonstrates only its recorded configuration. Remote desktop locality and actual simultaneous installer writers remain unverified natively; host guards, lock fixtures and process tests provide narrower evidence.
- Stylesheet-loaded visual/high-contrast/narrow/reduced-motion checks and native screen-reader checks are deferred. Semantic DOM/focus tests and static CSS are distinct from loaded visual geometry.
- Recorded packaged smoke predates the latest source remediation. Current compilation/tests verify the new wiring; a newly packaged native replay is deferred. Historical packaging exited 1 at the unrelated Copilot SDK shim after the toolchain package was produced; this is not whole-product packaging certification.
- Product-wide no-account/sign-in compliance remains separate; unrelated upstream Accounts/Sign In controls are outside this onboarding-only removal.
- Earlier Playwright keyboard/forced QuickPick selection departed from the smoke-driving protocol. Recorded final confirmation was user-activated; later retry driving used app-owned DOM actions without synthetic confirmation. Independent verification qualifies this procedural provenance without discarding retained direct SDK/component evidence.
- Un-isolated `walker --version` initialized real-profile files, which were left untouched. Narrow isolated SDK/PATH/shell comparisons do not imply a session-wide absence of real-profile writes.
- Authorized packaging fetched marketplace extensions beyond the smoke proxy allowlist. That broader provenance does not establish insecure .NET transport. Verbose diagnostics exposed a credential-bearing environment value; no secret is reproduced here, and credential-handling follow-up remains parent-owned.
- Parent-authorized teardown removed owned scratch/processes and transient snapshots, limiting replay. Cumulative progress preserves the earlier cleanup-scope deviation; recorded observations remain distinct from fresh commands.
- Delivery accounting remains qualified: 14,497 committed additions plus deletions exceed the forecast, and historical large unit commits are not proof of independently passing ≤400-line review patches. The two remediation rounds comprise 386 and 157 application lines (543 combined), with OpenSpec bookkeeping additional. Parent retains exact bounded review-slice accounting before delivery; archive grants no size exception, oversized delivery approval, global compliance or release certification.

## Artifact preservation and readback procedure

This report is persisted inside the active directory before relocation and read back in full. The entire directory, including `state.yaml` and both domain spec subdirectories, is relocated to `openspec/changes/archive/2026-09-30-dotnet-toolchain/`; nothing is split out or left active. Whole-tree relative path/type/content manifests are compared around the move, required artifacts are read from the destination, canonical hashes are checked unchanged, and absence of `openspec/changes/dotnet-toolchain/` is required before executor success. These post-move checks are returned as actual readback evidence by the executor.

Artifacts read: `.github/copilot-instructions.md`, `openspec/config.yaml`, proposal, both change-domain specs, design, tasks (including the fresh gate re-read), apply-progress opening and final D1/remediation/parent-close-out ranges through end of file, full verification/sync reports and both full canonical specs. No artifact absence waiver was used.

## Key Learnings

- Machine SDK readiness is distinct from project/global.json compatibility and requires direct execution-based verification.
- Live workspace roots and resolved aliases must be excluded before probing local candidate executables.
- Unix downloader enforcement and deliberately trusted child overrides have explicit platform and trust boundaries.

next_recommended: archived

ready for archive.
