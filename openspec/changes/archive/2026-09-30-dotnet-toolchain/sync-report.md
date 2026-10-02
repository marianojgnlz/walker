# Canonical Specification Sync — dotnet-toolchain

PASS

```yaml
mode: sync
status: pass
change: dotnet-toolchain
artifact_store: openspec
workspace: /home/marialez/Work/walker
branch: dotnet-toolchain
execution: auto
applyState: all_done
verifyState: all_done
syncState: all_done
domain_collisions: none
behavioral_blockers: 0
implementation_rows: 61/61
ownership_errors: 0
next_recommended: sdd-close:archive
```

## Authority and scope

Consumed the parent-authoritative structured status: sole active change `dotnet-toolchain`, apply and verification complete, sync ready, no domain collisions or blocking reasons. Action context is mode `sync`, execution `auto`. Session preflight: OpenSpec file store, ask-on-risk delivery, 400-line review budget, feature-branch-chain, no size exception accepted. Historical planning chain text does not supersede this preflight.

Allowed writes are `openspec/specs/**` and this report. The canonical store was absent before this operation. Both domains are new: pure addition, with no deletion, replacement of an existing requirement, or rename operation. No destructive approval or collision-ordering approval was needed. `openspec/config.yaml` contains no additional sync rules.

## Verification evidence

Read `openspec/changes/dotnet-toolchain/verify-report.md` directly. Its opening `sdd.verify-result/v1` envelope has verdict `pass`, zero blockers, zero critical findings, 10/10 requirements, and 26/26 scenarios; its standalone verdict is `PASS`. This is report evidence, not a phase-summary substitution.

- Evidence revision: `sha256:95d81d6766a575e2ae1e8a65038f3232b6e3e336bea2fd9308d5ef9dcdfce4fb`.
- Exact verification-report file hash: `sha256:f51aafdb028d6a5f0ca4024ce63c70255ae0934da1f4afdca9e6a26a47e6bf69`.
- Recorded extension test command: `npm run test --prefix extensions/dotnet-toolchain`, exit 0; three fresh consecutive runs each contain 266 passing tests.
- Recorded extension compile command: `npm run compile --prefix extensions/dotnet-toolchain`, exit 0.
- The report additionally records zero exits for extension typechecking, client transpilation, focused common/browser tests, and client typechecking.
- Current persisted `tasks.md` contains 61 checked implementation-owned rows and zero unchecked rows. Both remediation rounds are recorded in cumulative progress and assessed by the independent round-3 report.

No builds, tests, installs, or smoke launches were performed during sync. No separate post-report final-state evidence was supplied; this operation uses the persisted round-3 report and parent status without extending their verification claims.

## Canonical additions

| Domain | Canonical path | Operation | Carried content |
| --- | --- | --- | --- |
| dotnet-toolchain | `openspec/specs/dotnet-toolchain/spec.md` | Create full new domain | 7 requirements and 19 named scenarios: machine discovery, explicit authorization, trusted home-scoped setup, serialized recovery, execution-based verification, command/status parity, and local desktop availability. |
| welcome-onboarding | `openspec/specs/welcome-onboarding/spec.md` | Create full new domain | 3 requirements and 7 named scenarios: account-free first step, truthful command-driven interaction, optional accessible personalization and completion. |

All 10 exact requirement names and all 26 exact scenario names are retained. No scenario was dropped. Canonical purpose sections omit change-planning provenance; the welcome domain retains its separate product-wide account-compliance boundary. Welcome requirements/scenarios are otherwise unchanged.

The parent explicitly requested the verified post-remediation contract, not a verbatim copy of earlier working notes. Toolchain canonicalization therefore includes these additive clarifications within the existing named blocks:

- **Truthful local discovery / Workspace independence:** current local file-scheme roots on each pass; direct workspace candidates excluded before realpath; aliases resolving into roots excluded before probing; empty/relative PATH ignored; remote URI roots excluded from local filesystem treatment; non-workspace cwd and direct contained MSBuild execution without project/global.json resolution. Sources: design D2, apply-progress round 2 R4, and verify-report R4.
- **Trusted home-scoped installation / Platform installation boundaries:** shared probe/installer/termination-tool sanitation removes inherited shell startup families plus DOTNET/MSBUILD overrides case-insensitively, also rejects explicit shell startup keys, preserves trusted explicit probe values verbatim, and leaves the parent environment unchanged. Public setup cannot supply child environments; absolute execution and `shell: false` remain. Sources: design D2/D3, apply-progress round 2 R5, and verify-report R5, including its exact trusted-override qualification.
- **Trusted home-scoped installation:** Unix operation-owned downloader wrappers enforce HTTPS-only payload requests/redirects with configuration disabled for both dry-run and installation, in child-only environments. The text explicitly avoids treating this as established Windows PowerShell redirect protection. Sources: apply-progress round 1 R2 and verify-report R2.

These are additions to newly created canonical domains, not destructive MODIFIED merges against an existing canonical store. Change-domain inputs remain untouched. Archive should reconcile these documented refinements with their referenced design/progress/verification evidence rather than require byte equality with earlier change-spec prose.

## Artifacts read

- `.github/copilot-instructions.md` and `openspec/config.yaml`.
- `openspec/changes/dotnet-toolchain/proposal.md`.
- `openspec/changes/dotnet-toolchain/specs/dotnet-toolchain/spec.md`.
- `openspec/changes/dotnet-toolchain/specs/welcome-onboarding/spec.md`.
- `openspec/changes/dotnet-toolchain/design.md`.
- `openspec/changes/dotnet-toolchain/tasks.md`.
- `openspec/changes/dotnet-toolchain/apply-progress.md`: opening historical context and final D1, remediation, parent close-out, and round-2 evidence, through end of file.
- `openspec/changes/dotnet-toolchain/verify-report.md` in full.

## Readback and checks

Both canonical files were read back in full after creation. Source-to-canonical diffs were inspected: changes are limited to clean purpose wording and the documented verified toolchain clarifications. Requirement/scenario counts match the independently verified totals: toolchain 7/19, welcome 3/7, combined 10/26.

Canonical readback SHA-256 values:

- `openspec/specs/dotnet-toolchain/spec.md`: `b279d1af38acbbf075086b702cec80e8ffb4c480c69dd2646e764660f043176c`.
- `openspec/specs/welcome-onboarding/spec.md`: `ab2917ce28572e4d96f5cef8d5682fa9a29bf000c718ee916f556058c2341b85`.

Change-domain input SHA-256 values:

- `specs/dotnet-toolchain/spec.md`: `57af8b3471ef48920bcc1f3965d85271f6bd9a74efd0d160c870d57a845eb033`.
- `specs/welcome-onboarding/spec.md`: `aa42ce821601686fbfe4fb843c462eeb3ba21681184f525b2a8b6ef48896b606`.

This report is persisted for full readback before executor success is returned. Sync leaves `openspec/changes/dotnet-toolchain/` active; no archive move, implementation edits, task reconciliation, or commit is part of this operation.

## Retained qualifications

Sync is scoped specification reconciliation, not release or universal security certification. Verification retains native macOS/Windows and remote-locality gaps, the parent-accepted Windows PowerShell payload redirect limitation, general live-proxy interoperability and stylesheet-loaded/native-accessibility gaps, fixture-based concurrent-writer evidence, and the distinction between recorded package smoke and freshly compiled remediation. Product-wide no-account compliance remains separate. Procedural provenance, real-profile initialization, credential-exposure follow-up, and exact bounded delivery-review accounting remain parent concerns as documented in the verification report. No size exception or oversized delivery approval is granted here.

## Key Learnings

- Discovery excludes workspace executables using live local roots and resolved aliases before any probe.
- Child sanitation distinguishes inherited execution hooks from deliberately trusted probe overrides.
- Unix downloader HTTPS enforcement does not establish Windows PowerShell payload redirect protection.

next_recommended: sdd-close:archive

sync completed.
