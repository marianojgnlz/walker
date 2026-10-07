# Archive Report — product-debloat

PASS

```yaml
schema: sdd.archive-result/v1
mode: archive
status: pass
change: product-debloat
artifact_store: openspec
workspace: /home/marialez/Work/walker
branch: product-debloat
head: 4708d72c922cafc8b1950b2bb103ee995d29c5f5
applyState: all_done
verifyState: all_done
syncState: all_done
archiveReady: true
implementation_rows: 109/109
unchecked_rows: 0
ownership_errors: 0
critical_findings: 0
blockers: 0
verification_round: 7
verified_requirements: 15/18
verified_scenarios: 34/38
environment_gated_scenarios: 4
canonical_requirements: 18
canonical_scenarios: 38
canonical_merge_performed_in_this_mode: false
destination: openspec/changes/archive/2026-10-08-product-debloat/
next_recommended: archived
```

## Closure summary

The independent round-7 whole-change verdict and the completed canonical sync establish a passing closure for Walker's account-free product debloat. All 109 persisted implementation rows are checked. Walker-owned accounts/sign-in/OAuth, Sync, account tunnels, cloud continuation, GitHub account integrations, chat/Copilot, Agents Window, local Agent Host, and telemetry/crash-reporting infrastructure have been removed with their owned API, dependency, build, test, and package tails. Telemetry completion includes infrastructure cutoff **and** T1–T12 call-site/payload pruning, not merely disabled settings. Protected Git, local-state, generic remote/server, anonymous-gallery, Search, diagnostics, and existing .NET setup/onboarding boundaries are retained within the evidence limits below.

The delivered removal exceeds the approximately 2.9M-line scale: a fresh read-only aggregate measurement of the 29 change-branch commits, from base `d5f71c6a4b6542afb73e7c79ce9e218c4350a6ff` to HEAD, excluding `openspec/**`, records **6,760 additions and 3,028,623 deletions** across 10,409 numeric-numstat paths, plus 135 binary-numstat paths. These are aggregate changed lines, not net lines, a source-only census, or proof that every commit is a ≤400-line review leaf. The deletion trail spans W1–W47 and the earlier account/cloud batches; source, tests, generated/vendor resources, manifests, and dependency/build tails all count.

Coverage remains **15/18 fully substantiated requirements and 34/38 scenarios**. Four live scenarios are explicitly environment-gated. The signature-verification policy choice, dead dev-tunnels dependency cleanup, and macOS/Windows native smokes remain recorded follow-ups. This passing archive neither enlarges evidence coverage nor certifies a release, all native platforms, default signature-verified installation, or arbitrary installed-extension networking.

## Authority and operation boundary

Parent-injected preflight selects execution `auto`, artifact store `openspec`, delivery `ask-on-risk` resolved to `feature-branch-chain`, and a 400-line review budget per leaf; `size:exception` is declined. Recorded coupled-batch dispositions remain distinct from a blanket size waiver. This invocation serves parent task-list item #18; no goal is set and no task-list or goal mutation is performed.

The supplied structured status selects exactly `product-debloat`: proposal/specs/design/tasks/apply-progress done; verify rounds 1–7 done with round 7 passing; sync done with four canonical domains, 18 requirements and 38 scenarios; accounting 109 total / 109 checked / zero remaining / zero errors. Core artifacts are ready, task artifact is clear, apply/verify/sync are `all_done`, and `archiveReady: true`. Supplied `actionContext` is `{mode: archive, workspace: /home/marialez/Work/walker, branch: product-debloat}`; supplied HEAD matches the locally observed full HEAD above.

Parent explicitly authorizes this report and the whole-directory move to the dated destination. Allowed mutations are only the active change bundle and that destination. Canonical specs are frozen/read-only. **Archive mode performs no sync or canonical merge**, source edit, checkbox reconciliation, test/build/network smoke, staging, commit, branch/config change, push, or repository recovery. No partial-artifact approval is needed. `openspec/config.yaml` declares `strict_tdd: false` and no additional `rules.archive` policy. No separate post-round-7 final-state evidence was supplied; earlier implementation/package observations are consumed through their records and independent round-7 adjudication, not rerun here.

Initial worktree state includes the parent-owned modified `verify-report.md`, untracked `sync-report.md`, four new canonical domain directories, and pre-existing untracked `.pi/`. Their bytes are preserved; canonical/config hashes are checked around relocation. Cwd, branch, HEAD, workspace containment, ancestor paths, and absence of symlink indirection were checked. The dated destination and an active `archive-report.md` were absent before writing.

## Freshly read closing gates

- **Tasks:** complete persisted `tasks.md` read, followed by a fresh byte-level audit immediately before report creation: 109 implementation rows, all lowercase checked `[x]`, zero unchecked implementation rows, 109 implementation-owner markers, zero malformed checkbox syntax. Historical unchecked excerpts in cumulative records are superseded snapshots, not present implementation rows. No repair is performed in this invocation.
- **Verification:** current opening `sdd.verify-result/v1` envelope and round-7 body agree on a passing whole-change verdict, zero blockers, zero critical findings, 15/18 requirements and 34/38 scenarios. Report SHA-256 matches the existing sync report exactly. Historical rounds remain preserved; no phase summary or prose claim substitutes for current report evidence.
- **Sync:** existing standalone `PASS`, `verdict: pass`, `canonical_sync: complete`, zero blockers, round-7 evidence revision, matching verification-report hash, and task accounting were checked. Each of the four canonical files was read in full, matches its recorded sync hash, and begins with the **entire byte-identical change-domain specification**. Non-normative evidence records preserve current gaps. No new merge, replacement, deletion, or ordering decision is required.
- **Required artifacts:** proposal, four domain specs, design, tasks, cumulative apply progress, verification and sync reports are present. No flat legacy change `spec.md` exists. Compatibility, removal/telemetry inventories, deletion-review, implementation evidence, and parent-authorization are preserved with them. The prior .NET archive report supplies the house closure format.

Verification evidence revision: `sha256:e4bbdb87c896082f41ac032349efc7ce954df6b09bd04714a955afde1d575514`.

## Delivered scope and deletion trail

| Delivery lane / deletion record | Completed capability boundary and traceability |
| --- | --- |
| U00–U04 / earlier account/cloud batches | Measured ownership and positive fixtures; inert public auth facade; account controls/providers/GitHub integration removed; anonymous Open VSX packaging; Sync and cloud Edit Sessions removed; account Remote Tunnels/cloud forwarding/CLI login disconnected and deleted without deleting Git credentials or generic transport security. |
| W1–W26 / U05 wave | Chat core, chat services/integrations, authentication implementations/bridges, Agents Window `src/vs/sessions/**`, platform/workbench Agent Host, server channels, agent-only terminal/MCP/browser integrations and fixtures. Wave commit `90cd0fad145`: 5,122 paths, +286/−1,499,575 (whole-commit accounting). Retained inbound edges were resolved before the parent deletion. |
| W27–W36 / C5/C6 tails | Session/Agent Host build, script, CI, resource, smoke, and Rust CLI tails removed; generic server tokens, remote infrastructure, terminal behavior, and retained test selectors preserved. Neutral MCP helpers and ordinary ripgrep filtering have independent parity/target fixtures. |
| W37 / Copilot | Bundled `extensions/copilot/**`, SDK/runtime/shim, packaging/discovery/CI/native-filter tails removed. Commit `1e73ad98ebd`: 4,244 paths, +665/−1,365,683 (whole-commit accounting). Desktop/REH builds no longer require the Copilot ripgrep fixup. |
| W38 / exclusive producers | Agent SDK/Codex/dictation producers and unreachable local transcription stack removed by parent disposition. Commit `997c502e082`: 75 paths, +472/−8,190. Ordinary Search/native/package utilities remain. |
| W39–W46 / I/B/T lanes | All retained process reporting and crash startup cut off; direct bundled reporters and reporting dependencies removed; seven U11 pruning passes retire owned events, payload-only computation, identifiers, constructor threading, RPC, helpers, tests, build/schema/argv tails. Only documented tested no-op/public or non-telemetry boundaries remain. |
| W47 / round-5 remediation | Orphan CLI `auth.rs`, dead telemetry helper test, completions-enablement module, and two issue-upload services physically removed; telemetry utility reduced to its 39-line no-op boundary; default-agent/editorChat consumers, telemetry custom endpoints, UUID residue, owned i18n roots, and issue-reporter token/upload branches retired. Commit `71759d4897c`: 50 paths, +426/−3,123. |
| Final V-evidence / `4708d72c922` | Fresh Linux packages and live provider/profile/Git evidence, task closure, disclosed incident recovery, and the +5/−1 ext-host expectation-list fix. |

These measurements are nested records of their respective diffs, **not additive disjoint line totals**. `deletion-review.md`, `removal-inventory.md`, `telemetry-inventory.md`, `apply-progress.md`, and `parent-authorization.md` retain exact manifests, prerequisites, safe generic extractions, split analyses, parent-owned physical-deletion execution, and per-batch review decisions.

## Protected boundaries, Open VSX, and packaged evidence

The retained `vscode.git`/`git-base` use ordinary OS Git, SSH keys/agents, credential helpers and Git askpass/passphrase/host-confirmation paths, not Walker authentication providers. Local profiles/settings/repositories/extensions/unrelated secrets and SSH configuration are preserved by read-ignore upgrade behavior; there is no broad secret wipe, provider sign-out, remote-token revocation, or remote-data deletion. Generic server/remote/Ports/connection-token behavior, ordinary logs/errors/output, editing/terminal/debug/Search, .NET toolchain setup, onboarding and personalization remain protected. The two pre-existing canonical domains are unchanged.

Open VSX is configured by `build/distro/walker/gallery.json` through the narrow `build/lib/walkerProduct.ts` desktop/REH packaging composition, not a root-product gallery field or development override. The approved quartet maps distribution `controlApiUrl` to consumed runtime `controlUrl`; Walker identity and release stamps remain. Gallery account/rating sign-in paths, correlation headers and usage-statistics requests are removed without a Microsoft/account fallback.

Recorded final package recipes (`npm run build-fast`, `npm run gulp vscode-linux-x64`, `npm run gulp vscode-reh-linux-x64`) exit zero after the ext-host fix. Both packages are Walker 1.140.0 stamped `71759d4897cefb3ddb409a9b64285fcb0598db80`; round 7 resolves the stamp nuance: the later HEAD's sole source change is the ext-host fix and that filter is present in the shipped desktop bundle. Independent round-7 scans reproduce zero hits for all 24 recorded debloat markers across desktop loose output, extensions, the in-place ASAR and REH. Three Copilot-name source-map comments and one sessions CSS-map comment remain inert; no blanket substring-absence claim is made. REH package roots match the remote lock with zero absent roots/version mismatches; historical count variation reflects scanner methodology, not dependency restoration.

Live anonymous acquisition records `muhammad-sammy.csharp` **2.145.21-g154a82fd27**, license `SEE LICENSE IN RuntimeLicenses/license.txt`, with dependency `ms-dotnettools.vscode-dotnet-runtime` **3.2.0**, MIT. Install/list/uninstall, dependency resolution and local VSIX/update use the explicit signature-verification workaround below. VSIX/update evidence covers `jakubkozera.csharp-dev-tools` **1.12.8 → 1.13.0**. Expected Open VSX HTTP 404 results for C# Dev Kit, Copilot/Copilot Chat and Microsoft C# are documented provider gaps, not reasons to switch providers or introduce sign-in. Acquisition is not C# editing integration.

Fresh/copied-profile launches and restarts show inert old account/chat/window/telemetry state, absent removed product surfaces and inactive old URLs. Eight file sentinels retain equal before/after SHA-256, all eight orphaned state rows remain, legacy argv is unchanged, and no recorded telemetry-log/endpoint marker appears. The Electron-level Chromium Crashpad client-id artifact is distinguished from removed Walker crash-reporter initialization. Live Search returns two results and the account-free toolchain activates. File and loopback-SSH Git workflows exercise clone/commit/push/branch/pull/fetch; packaged Git UI fetch/pull/fetch-all is corroborated by external ref/working-tree hash movement.

### Extension-host defect and corrected diagnosis

Removing the `mainThreadEmbeddings` contribution left `MainContext.MainThreadEmbeddings` in the all-identifiers registration expectation, preventing ordinary extension-host customer creation. The earlier harness/environment characterization is superseded: this was a packaged product defect. `mainThreadExtensionService.ts` now excludes that intentionally disconnected identifier (+5/−1), mirroring the ext-host exclusions; the guard still forbids restoring the removed contribution. Round 7 verifies source, guards and shipped bundle. Fresh integration exits zero with **Git 60 passing / two intentionally skipped cases, Git Base 14 passing**.

## Seven-round independent verification history

| Round | Scope and historical disposition | Closure significance |
| --- | --- | --- |
| 1 | U00/U01 milestone passing; 17 validation commands; administrative output/deletion-review findings resolved by parent records. | Scoped accounts/auth/gallery fixture milestone, not whole-change acceptance. |
| 2 | U02 + inserted A6-prep milestone passing; 13 commands; Sync/Edit Sessions removed with local-profile/restoration positives. | Scoped cloud-removal milestone. |
| 3 | Wave substance confirmed; remediation required for five stale product guards and the named extension-compile command. | Physical absence confirmed; validation setup/guards required repair. |
| 4 | Narrow remediation re-check passing; product guards 17/17, correct gulp extension compile, MCP/runner repairs confirmed. | Round-3 findings closed; not yet whole-change acceptance. |
| 5 | Whole-change assessment required further work: twelve unchecked rows plus telemetry/source/review findings; live package/provider/profile evidence incomplete. | Drove six-item remediation, W47, evidence corrections and explicit review ratifications. |
| 6 | Every round-5 substantive finding resolved with fresh validations; twelve implementation rows still required proof-backed reconciliation/acceptance or live evidence. | Eight closure-ready rows, one harness decision, three V-evidence rows explicitly identified; no checkbox bypass. |
| 7 | Whole-change **PASS**: 109/109, zero blockers/critical findings, source/package/live-log spot-checks, ext-host fix, green integration and incident-recovery confirmation. | Authoritative current closure verdict: 15/18 requirements and 34/38 scenarios, explicit environmental gaps and residual ledger. |

Round-7 fresh validation includes compile-client/typecheck-client, extension compile (40 zero-error summaries), build tests **498/498**, Cargo check and tests (**47 lib + 5 bin**), productDebloat **31**, accountFreeApi **10**, chat-integration boundaries **30**, local profiles **33**, gallery **39**, generic tunnel **3**, MCP configuration **13**, null telemetry **2**, plus the Git integration above. Exact commands, raw-output hashes and full historical reports remain in `verify-report.md`. Archive consumes those tests; it does not rerun them.

## Canonical domains and coverage

| Domain | Frozen canonical path | Contract requirements / scenarios | Fully substantiated requirements / scenarios |
| --- | --- | --- | --- |
| accounts-removal | `openspec/specs/accounts-removal/spec.md` | 5 / 11 | 4/5 / 10/11 |
| chat-agent-removal | `openspec/specs/chat-agent-removal/spec.md` | 4 / 7 | 4/4 / 7/7 |
| telemetry-removal | `openspec/specs/telemetry-removal/spec.md` | 4 / 8 | 4/4 / 8/8 |
| protected-boundaries | `openspec/specs/protected-boundaries/spec.md` | 5 / 12 | 3/5 / 9/12 |
| Total | Four synced new domains | 18 / 38 | 15/18 / 34/38 |

Existing sync added each new domain in full, preserving all normative clauses/scenarios and appending separate evidence records. It recorded no domain collision, MODIFIED/REMOVED/RENAMED operation or destructive merge, so no collision-order/destructive approval is needed here. Archive only confirms that state and preserves the change deltas.

### Four environment-gated scenarios — exact names retained

| Domain / requirement | Scenario | Recorded gap |
| --- | --- | --- |
| accounts-removal / Removal of account-dependent cloud capabilities | GitHub remote without GitHub integration | github.com push over OS Git credentials outside live-workflow network scope. |
| protected-boundaries / Plain Git operations and OS credentials | github.com is a plain remote | github.com clone/fetch/pull/push outside live-workflow network scope. |
| protected-boundaries / Preserve generic remote and port-forwarding infrastructure | Key-based remote workspace | No available remote development endpoint for files, terminal and remote extension host. |
| protected-boundaries / Preserve generic remote and port-forwarding infrastructure | Non-account port forwarding | No remote workspace/service-port infrastructure for forwarding/local access. |

File/loopback Git SSH, generic tunnel unit tests and source/package scans are narrower evidence and do not establish these four live scenarios. The normative contracts remain unchanged.

## Decisions and residual ledger

Key decisions remain in `parent-authorization.md` and the proposal/design: total Walker-owned account/chat/agent removal; approved Open VSX packaging without provider substitution; whole bundled GitHub extension deletion while plain Git remains; neutral ripgrep/MCP extraction rather than shadow feature frameworks; read-ignore legacy state without destructive cleanup; telemetry cutoff followed by complete pruning; accepted removal of Chat Pet agent-gamification UI; and parent-directed deletion of unreachable dictation/local-transcription consumers. Broader welcome content, project creation, Roslyn/Solution Explorer, NuGet/test/debug improvements and extension policing remain separate changes.

Review decisions explicitly ratify named coupled pairs/CLI/TypeScript/owner-group/issue-reporter removals with split analyses. Round 7 confirms no unratified review-budget violation remains; archive grants no blanket size exception. User-approved 2026-10-08 close-gate decisions reconcile eight evidence-backed rows and accept T11's harness input; the live pass closes the three V rows. Those decisions are read, not re-executed here.

| Follow-up or evidence limit | Preserved disposition |
| --- | --- |
| Signature-verification decision | Default packaged installs terminate non-zero with `Signature verification was not executed.` because `@vscode/vsce-sign` is absent from packaged app/root manifests. The observed lifecycle uses per-profile `"extensions.verifySignature": false`, explicitly disabling verification, not equivalent security evidence. Parent still chooses shipping the module with dependency/lock authorization or accepting the documented workaround. No choice is inferred by archival. |
| Dead dev-tunnels dependencies/script | Five `@microsoft/dev-tunnels-*` packages (567 desktop ASAR entries) and stale `bundle-dev-tunnels-web` remain with no production importer; REH carries none. Bounded cleanup needs dependency/lock-regeneration authorization. No functioning account-tunnel path is claimed. |
| macOS/Windows native smokes | Linux-only host. `vscode-darwin-x64`, `vscode-darwin-arm64`, `vscode-win32-x64`, `vscode-win32-arm64` gulp packages and native startup/profile/Git/SSH/signing checks remain unperformed. Passing target-filter fixtures are not native certification. |
| Four live scenarios | Exact environmental gaps above remain carried in canonical evidence records and this closure. |
| UI profile switching / OS-keychain secrets | Not directly exercised packaged-live; file/state sentinels and profile unit tests support only their stated narrower scope. |
| T11 harness crash-dump argv | Explicitly user-accepted `test/**` harness input; product crash-reporter argv/startup paths are absent. |
| Inert compatibility/cosmetics | Documented no-op/public identity/telemetry shapes, neutral MCP legacy client-id inputs, TAS no-op adapter, ordinary feedback/diagnostic consumers, source-map comments, inline-chat string, unification-setting/enum remnants, consumer-less native upload member and upload CSS do not restore removed capabilities. Exact scope stays in compatibility and verification records. |

## Repository incident and recovery record

The live Git smoke's relative `file://` clone error allowed the script to continue in the real repository. It created accidental artifact-only commit `a0c64c3f4be`, local/remote `feature-a`, local Git identity/branch configuration, and checked out `main`. This was disclosed to the parent, not concealed as an isolated smoke.

Recorded recovery used explicit absolute paths: restore `product-debloat`, mixed reset to `71759d4897c` while preserving parent artifact edits, remove local identity/feature-branch config, delete local and remote `feature-a`, and confirm remote-head absence. No source was in the accidental commit; `main` and `product-debloat` were not pushed by that incident. Recovery log: `out-build/v-evidence/15-git-incident-recovery.log`. Round 7 independently confirms reflog sequence, no local/remote `feature-a`, no stray local config, and accidental commit outside current branch ancestry. Final intended fix/evidence are in HEAD `4708d72c922`. Archive performs no further git recovery or mutation.

Owned app/loopback-sshd/Playwright processes were stopped by the evidence pass; isolated profiles/logs/scripts/screenshots remain under ignored `out-build/v-evidence/`. External package trees and temporary/generated evidence are not relocated into OpenSpec. Their interpreted results and hashes remain preserved in the change records; replay requires retained local evidence or new authorized smokes.

## Artifact integrity, readback and relocation procedure

The original bundle has **16 files**. Its SHA-256 over sorted relative path, NUL, file bytes, NUL is `636c372fa7ba0497e9c63c9665f63946ae4ecb5e5ee1fb726d4301d1a24ddc23`. This report is the sole newly authored artifact. All original files, including the entire seven-round verification history, remain byte-for-byte unchanged.

| Artifact | SHA-256 |
| --- | --- |
| tasks.md | `aad7e8335931484f6515560bb8aafe9a4c01e5e779c5f0aba38b171731a9fc8b` |
| apply-progress.md | `45cf193f417a0cf9ed310f70f91834c0f118c8ea0be888b46bd24ae0e58831f4` |
| verify-report.md | `6a90876ad01bdeac90809325e5a9d671a7a86733c164b19717ceaa777afe419f` |
| sync-report.md | `5ef14deed33ffa267cac9a13e5cc555da1b8731ae4d42ed6a317d90eb7cc6b8a` |
| Canonical accounts-removal | `38b5dc8d6fdfadd3fa0815dbd8ba1e4d575949af79224f3eb6110397e04adbce` |
| Canonical chat-agent-removal | `86138d50809c1124e895f6963badfde7adbd7363aefeefccd5e19e4b5cdffee1` |
| Canonical telemetry-removal | `fd68609676e712d42983bb96f114510a1377f85df17a79585209d59ba5dc7e5f` |
| Canonical protected-boundaries | `af737060c8713a7ae6c26fa742cbac1b3da9ac19cbdde5569b796a99931b8e62` |
| Preserved canonical dotnet-toolchain | `b279d1af38acbbf075086b702cec80e8ffb4c480c69dd2646e764660f043176c` |
| Preserved canonical welcome-onboarding | `ab2917ce28572e4d96f5cef8d5682fa9a29bf000c718ee916f556058c2341b85` |

Artifacts read: project instructions/config; proposal/design; all four full change-domain and six full canonical specs; complete persisted tasks; apply-progress opening, final W47 remediation and live-evidence records; all current round-7 verification evidence plus historical round summaries/envelopes; full sync report; compatibility; implementation-evidence final live section; parent standing/product/size/ratification/close-gate decisions; deletion-wave records; removal/telemetry ledger closure sections; prior .NET archive report. Every original artifact is additionally read as bytes for the preservation manifest. No absent-artifact waiver, unapproved checkbox repair, or destructive canonical operation is used.

The report is written and read back in the active bundle before movement. The executor then snapshots the entire relative path/type/mode/content manifest, performs a whole-directory relocation to `openspec/changes/archive/2026-10-08-product-debloat/`, refusing an existing destination, and compares the destination manifest. All 17 destination files are read back, the original 16-file digest is rechecked, all canonical/config hashes are confirmed unchanged, and the active path must be absent before success is returned. The report is not rewritten after movement; actual post-move checks are returned by the executor. No commit is created; the parent owns the separate archive commit and subsequent follow-up decisions.

## Key Learnings

- Removing an RPC contribution also requires excluding its identifier from registration expectations; otherwise ordinary extension-host activation can break.
- Open VSX lifecycle evidence with signature verification explicitly disabled does not establish default-path installation or equivalent verification security.
- Whole-change acceptance, normative contract counts, implementation checkboxes and environment-gated live coverage are separate records.
- Whole-directory archival can preserve cumulative evidence exactly while canonical specs remain frozen and independently hash-checked.

next_recommended: archived

ready for archive.
