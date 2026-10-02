```yaml
schema: sdd.verify-result/v1
evidence_revision: sha256:95d81d6766a575e2ae1e8a65038f3232b6e3e336bea2fd9308d5ef9dcdfce4fb
verdict: pass
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 26/26
test_command: npm run test --prefix extensions/dotnet-toolchain
test_exit_code: 0
test_output_hash: sha256:f51f6c1a0773c2c12c3e4f30ba4b4818fc47e0b00574c9fa1b9fba4b2cdcb3ad
build_command: npm run compile --prefix extensions/dotnet-toolchain
build_exit_code: 0
build_output_hash: sha256:77c69f6266d978e8ce74f0e8f4cd46b5d3002d51ac454c453d3e821864f1d45f
```

PASS

# Independent verification — round 3

The two production-wiring findings are remediated. Three fresh consecutive extension runs each pass 266 tests; all authorized compilation, client transpilation, focused workbench tests, and client typechecking exit zero. This is scoped change verification using qualified recorded Linux smoke evidence, not universal platform or product-release certification.

## Authority and evidence

Consumed parent-authoritative status: sole active change `dotnet-toolchain`; store `openspec`; workspace `/home/marialez/Work/walker`; branch `dotnet-toolchain`; actionContext mode `verify`, execution `auto`; applyState `all_done`, verifyState `ready`. The sole allowed write is this report. Inspected implementation targets are inside the authoritative workspace. The original chain-choice text in planning artifacts is superseded by parent preflight `feature-branch-chain`; no size exception is accepted.

Read proposal, both domain specs, design, tasks, configuration, relevant cumulative progress sections including both remediation rounds and parent close-out, prior report, production composition/candidate/process/probe/status/contracts/platform/shim code, focused test evidence, onboarding client/renderer evidence, build registration, and retained smoke text files. No flat change-root spec is required.

The round-2 report at this path was read before replacement; its byte hash was `sha256:94b0cf776ac22c14c4fe7d2dc8ac5a9fe467b9c5cb5b89ecb5a06ec8eafae09f`. Historical details remain in `openspec/changes/dotnet-toolchain/apply-progress.md`.

Evidence revision hashes sorted path + NUL + exact bytes + NUL for the fully retrieved guidance/config, proposal/design/tasks/prior report/domain specs, extension README/package, nine production modules (candidates, extension, installer, processRunner, downloaderShim, probe, contracts, platformArguments, status), shim test, core contract/client, and seven retained smoke text files. It additionally includes labeled apply-progress ranges 1–669 and 3040–3326, and exact command capture `/tmp/pi-bash-0abf633c8e9b19b0.log`. Focused excerpts from other tests/renderer/build were reviewed separately. Output hashes are over each subprocess's combined stdout/stderr bytes before decoding. The opening envelope was checked before writing: all fields occur once, counts are recomputed from the two retrieved specs, and test/build exits and hashes are observed. The envelope selects extension test run 3 and extension compilation, not an unexecuted broader build.

## Prior findings R1-R5 — remediated

### R1 — verification cancellation synchronization

`extensions/dotnet-toolchain/src/test/installer.test.ts:816–853` awaits the promise signaled inside the staged probe responder, with a disposed five-second timeout, before cancellation. Outcome assertions retain absent publication/stage and a free lock. All three fresh 266-test runs include this regression and real process-tree fixtures. Finite repetitions support stability without claiming a universal scheduling guarantee.

### R2 — Unix downloader transport boundary

`src/downloaderShim.ts` creates exclusive private operation-owned wrappers. Curl uses `--disable`, original arguments, then `--proto '=https' --proto-redir '=https'`; wget uses `--no-config --https-only`. Captured absolute downloader variables and the shim PATH are child-only. `src/installer.ts` applies this environment to both channel dry-run and installation. Shim and controller assertions pass; parent PATH and `shell: false` are preserved. The accepted Unix scope is satisfied. PowerShell direct HttpClient requests remain outside this protection and outside any universal trust certification.

### R3 — literal proposal criterion 6

Retained evidence root: `/tmp/walker-dotnet-remediate-ZfUzRotmXk/evidence/`.

- Cumulative D1/remediation records isolated runtime-only detection, explicit user-picked LTS and confirmation, then SDK **10.0.401** at the isolated `.walker/dotnet/dotnet`, committed publication, and released lock.
- `managed-sdk-verification.txt` records SDK inventory 10.0.401 and zero exits for inventory and direct `dotnet exec .../sdk/10.0.401/MSBuild.dll -nologo -version`, with output **18.9.11.42413**.
- `ready-state-snapshot.txt` identifies the same managed version/executable after the recorded fresh-process/profile restart.
- `before-system.txt` and `after-system.txt` are byte-identical: host executable/SDK inventory, system-root entries, PATH hash, and `.bashrc` hash. This supports those components, not a recursive audit of every system file.
- `offline-failure-snapshot.txt` records a truthful download/offline error rather than stale Ready. `managed-before-offline.txt` and `managed-after-offline.txt` are byte-identical, preserving SHA-256 of the managed host and selected MSBuild DLL, not a whole-tree hash.
- Separate split-install/restart, canceled chooser, two-profile live-owner-lock contention, and disabled-extension command unavailability are recorded in D1 and supported by current fixtures. Their removed transient state JSON and the removed managed tree cannot be independently replayed here. The contention smoke used a live-owner fixture, not two actual concurrent SDK writers.

Criterion 6 literally requires the Linux runtime-only → user-picked managed installation → direct verification → restart Ready sequence, unchanged existing components, split-install recognition, and native-platform results or explicit gaps. This recorded/retained evidence satisfies that wording. Retry after the offline attempt is an additional demo, canceled by user decision after visibility limitations on Hyprland's `FALLBACK` output; it is infrastructure-limited and test-covered, not a required criterion-6 leg. No smoke was rerun here.

### R4 — live production workspace-root wiring

The actual path is now `activate` → `createVscodeExtensionHost` → `createLocalInstallerController` → `createDotnetInstallerController` → `discoverDotnetCandidates`:

- `extension.ts` reads `workspace.workspaceFolders` on every getter call, accepts only `file:` URI `fsPath` values, and passes `workspaceRoots: () => host.getWorkspaceRoots()` into the real controller.
- `installer.ts` requires the provider and calls it on each fresh detection pass. It does not cache roots at activation.
- `candidates.ts` requires `workspaceRoots`; there is no default-empty option. Lexical workspace candidates are excluded before realpath, and candidate aliases resolving into roots are excluded before any probe.
- `src/test/installer.test.ts:453–481` records actual probe invocations: direct workspace PATH and symlink-alias candidates never reach the probe. Adding `/later-workspace` between rechecks prevents further probes of that formerly external candidate.
- `src/test/extension.test.ts` exercises live file-scheme sourcing and remote URI exclusion through the VS Code facade. Candidate fixtures retain relative/empty PATH exclusions.

This closes the omitted production argument, not merely the pure helper fixture. `probe.ts` uses non-workspace cwd, independent inventories, contained SDK paths and direct MSBuild execution; it does not consult global.json or assert project compatibility. Remote URI folders are not treated as local filesystem roots.

### R5 — shared child environment sanitation

`processRunner.ts:createChildEnvironment` is used at probe, installer and Windows termination-tool spawn boundaries. It strips inherited `BASH_ENV`, `ENV`, `SHELLOPTS`, `BASHOPTS`, `CDPATH`, `GLOBIGNORE`, `PS4`, `PROMPT_COMMAND`, `BASH_FUNC_*`, `DOTNET_*`, and `MSBUILD*`, case-insensitively. All listed shell startup keys are also rejected from explicit child overrides. Injected-spawn tests inspect complete resulting environments and unchanged parent environments.

Important exact policy: trusted explicit probe DOTNET values are deliberately reapplied verbatim, as requested and required by D2; the helper does not indiscriminately reject every explicit DOTNET/MSBUILD key. Production probe values are only owned root, telemetry, no-logo and multilevel-lookup suppression. Public setup arguments cannot supply child environments. Thus inherited execution hooks cannot survive through an explicit public override route. Literal safe values containing spaces/metacharacters remain unchanged. Shared filtering and injected-spawn assertions close the startup-hook issue while fixed absolute interpreters, argv arrays and `shell: false` remain intact. No hostile hook was executed by this verifier.

## Spec coverage and proposal success criteria

Independently counted **10 requirements / 26 scenarios**: toolchain 7/19, welcome onboarding 3/7. Coverage below means implementation plus current tests and qualified recorded smoke, not native certification everywhere.

| Requirement | Scenarios covered | Evidence |
| --- | ---: | --- |
| Truthful local discovery | 5/5 | Candidate/probe fixtures, live workspace wiring, split-root smoke |
| Explicit install authorization | 2/2 | Selection/controller/platform assertions and recorded confirmation/cancellation |
| Trusted home-scoped installation | 2/2 | Integrity/TLS/offline tests, startup sanitation, owned destination; approved Unix boundary |
| Serialized recoverable installation | 3/3 | Lock/process-tree/transaction preservation tests and qualified contention smoke |
| Execution-based install verification | 2/2 | Pinned stage/final probes, exact-version assertions, managed exec/restart record |
| Shared command and status state | 2/2 | Status/controller and core/browser transition/cancellation/retry assertions |
| Local desktop activation and packaged availability | 3/3 | Desktop/UI host guards, package resources/build registration, recorded packaged commands |
| Account-free toolchain first step | 2/2 | No default agent/account dependencies or authentication dispatch in onboarding |
| Truthful toolchain interaction | 3/3 | Snapshot parity, unavailable fallback, generation/revision/dismissal assertions |
| Optional accessible onboarding | 2/2 | Skip/back/theme/keymap/completion/reopen/focus/disposal tests; static theme hooks |

Proposal criteria **1–5** are supported respectively by discovery/probe, explicit selection/platform, lifecycle/preservation, account-free onboarding, and matching command/status/client state tests. Criterion **6** is supported as qualified under R3.

The core imports only its contribution-local contract/client and uses ICommandService; no extension runtime import crosses that boundary. Both snapshot-v1 guards agree on five command IDs, eight states, locality, required Ready details, failure stages and progress phases. User-facing core and extension presentation uses nls/l10n with manifest localization. Step timers/listeners have disposable ownership and generation guards; dismissed late work cannot revive the step, while separately authorized extension setup remains controllable.

Current tasks contain **61 checked implementation rows and zero unchecked implementation rows**. Historical handoff excerpts are not current tasks. Strict TDD is inactive (`testing.strict_tdd: false`); historical cycle tables are not retroactively replayed. Inspected new assertions check actual spawn environments and actual probe execution exclusion, rather than type-only, tautological or smoke-only claims. DOM/focus assertions do not establish loaded stylesheet geometry.

## Residual gaps

- Native macOS/Windows install, cancellation, rename and locality are **unverified on this platform**; platform fixtures are not native smokes.
- Windows PowerShell HTTPS-to-HTTP payload redirect rejection remains the explicit parent-accepted platform security gap. No universal D3 or Windows security certification is made.
- General live supported-proxy interoperability is **deferred**; the controlled localhost allowlist proxy proves only that recorded smoke configuration.
- Stylesheet-loaded visual/high-contrast/narrow/reduced-motion and native screen-reader checks are **deferred**. Browser tests establish semantic DOM/focus behavior, with static CSS evidence only.
- Native remote desktop locality and actual simultaneous installer writers are **unverified on this platform**; host guards and injected concurrency/process fixtures supply bounded evidence.
- Product-wide no-account/sign-in compliance remains a separate lane. Retained snapshots still show unrelated upstream Sign In/Accounts controls; this change removes onboarding authentication and introduces no account dependency, not global account removal.
- Recorded package/smoke provenance predates the latest remediation. Current source compilation/tests establish the new wiring; a newly packaged native replay is **deferred** under this round's no-packaging/no-launch authorization.

### Review workload / delivery boundary

Fresh git history confirms **22 commits**, including A1a/A1b subdivision and the disclosed branding commit. Fresh branch numstat totals **14,497 additions + deletions**, far above the 4,450–6,690 forecast. Oversized unit commits in the cumulative record are not literally ≤400-line commits/PRs; logical ownership tables are a review plan, not proof of independently executed passing predecessor patches. No size exception was accepted.

Current uncommitted tracked remediation delta is **240 additions + deletions**, plus **303 lines** in the two untracked shim files: **543 application lines combined across both remediation rounds**. This corroborates the recorded 386-line round 1 plus 157-line round 2 split, not a single ≤400-line remediation patch. OpenSpec bookkeeping is additional. Parent must preserve exact bounded review patch/slice accounting before delivery. This is a delivery-review qualification, not an unresolved behavior finding or permission for one oversized review. No broader editor/LSP/project-build/remote provisioning scope was observed; the adjacent branding change remains disclosed.

## Deviations assessed

1. Earlier Playwright keyboard/forced QuickPick selection departed from the smoke-driving protocol. Recorded final confirmation was user-activated; later retry actions used app-owned DOM actions without synthetic confirmation. Procedural provenance is qualified, while retained direct SDK output, status and component/hash evidence remain usable.
2. Un-isolated `walker --version` touched real profile files and those were left untouched. Any blanket claim of no real-profile writes across the session is therefore inappropriate; isolated install component/PATH/shell comparisons remain narrower evidence.
3. Marketplace fetches occurred during an authorized packaging command outside the smoke proxy allowlist. Packaging provenance is broader than that allowlist; this does not establish insecure .NET payload transport. Historical package command exit 1 at the unrelated Copilot SDK shim is not represented as successful whole-product packaging.
4. Verbose startup diagnostics exposed a credential-bearing environment value. Redaction does not undo exposure; applicable credential-handling follow-up remains with the parent. No secret is reproduced here.
5. Parent teardown removed owned scratch/processes and transient evidence. This limits independent native replay; recorded observations are distinguished from fresh commands. No cleanup was performed in this round.

## Command log

All commands ran from repository root after `export PATH="/home/marialez/.local/share/mise/installs/node/24.18.0/bin:$PATH"`. No network smoke, app interaction, packaging, dependency installation, implementation fix, or commit was performed. Core tests use the expressly authorized Electron test harness. Existing npm configuration, Wayland/Electron and Node warnings did not affect zero exits.

| Exact command | Observed result | Combined output SHA-256 |
| --- | --- | --- |
| `npm run test --prefix extensions/dotnet-toolchain` (1) | Exit 0; 266 passing, 772 ms | `94d184e3f6cbc949f725b90820638920b33365e0614f419257573eb09c783ea7` |
| `npm run test --prefix extensions/dotnet-toolchain` (2) | Exit 0; 266 passing, 774 ms | `f6cbd140f72bbb49d7253e2954ee0fe7b2190d007cfcb7a00ae208ba1ca5a4d5` |
| `npm run test --prefix extensions/dotnet-toolchain` (3) | Exit 0; 266 passing, 775 ms | `f51f6c1a0773c2c12c3e4f30ba4b4818fc47e0b00574c9fa1b9fba4b2cdcb3ad` |
| `npm run compile --prefix extensions/dotnet-toolchain` | Exit 0 | `77c69f6266d978e8ce74f0e8f4cd46b5d3002d51ac454c453d3e821864f1d45f` |
| `npx tsc --noEmit -p extensions/dotnet-toolchain/tsconfig.json` | Exit 0 | `09b9b911f3cbde63fcc24cea1807fa43a33ed657cce05cc40e7e0b3db67b6b9a` |
| `npm run transpile-client` | Exit 0; 9,156 files, 2,066 resources; 4,486 ms total | `781264297a9766d4c873b5ba9c709b8c831eec82f4f00a8e1082fd98edc2bb2c` |
| `./scripts/test.sh --run vs/workbench/contrib/welcomeOnboarding/test/common/dotnetToolchain.test` | Exit 0; 4 passing, 3 ms | `30c912c46b9d07393043a587edc4b447a8d6dc778fa20f8f1de0ec4b85e0b722` |
| `./scripts/test.sh --run vs/workbench/contrib/welcomeOnboarding/test/common/onboardingTypes.test` | Exit 0; 4 passing, 2 ms | `27a608019f1923c8df51d12c1ba962fd980473e51903b9dfc29c2b1026f409f5` |
| `./scripts/test.sh --run vs/workbench/contrib/welcomeOnboarding/test/browser/onboardingVariationA.test` | Exit 0; 19 passing, 2 s | `4a1c9fd17996dd4cc991a062c2c4cae22a250d618bbb589e9f0f5a842df97cb3` |
| `npm run typecheck-client` | Exit 0 | `25d4a10e7654a35ff6e5fdac546a1fda4b39982f72b3424969ab4195e914b8a5` |
| `git log --oneline main..dotnet-toolchain` | Exit 0; 22 commits, tip `f0e3e37affc` | `7793f9021e42db25fe83b44065a594e0e864d7d802022cc11cd33b24a653e6bb` |
| `git diff --numstat main..dotnet-toolchain` | Exit 0; 14,497 committed added/deleted lines | `552ab8d3cdaddc40d50c4aa47b7ebca71200d2000010e2c984d9716590fec879` |

Baseline and post-command git status agree on ten existing modified extension paths, two untracked shim paths and pre-existing `.pi/`/`openspec/`. Compile/transpile/test-generated outputs are normal authorized command outputs; no unexpected tracked mutation was observed. This report is the sole authored repository change in this round.

## Disposition

Exact behavioral blockers: **none**. Route to **`sdd-close:sync`**, retaining the explicit platform/security, procedural, product-wide account-compliance and delivery-review qualifications above. Sync is not release approval or permission to erase those qualifications.
