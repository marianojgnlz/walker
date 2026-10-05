# Tasks: Account-Free Product Debloat

Approved proposal and the read-back four domain specs/design are the inputs. Checkboxes track independently completed implementation work; checked rows do not declare a family, phase, or delivery complete. The parent has resolved the provider as **Open VSX (`open-vsx.org`)** and delivery as **subsystem-bounded units on a `feature-branch-chain`**, explicitly declining `size:exception`. The parent still owns session todos/goals and delivery gates. This file contains implementation work only; no checkbox changes those resolved choices or declares delivery complete.

Path notation: `workbench/...`, `platform/...`, `code/...`, and `server/...` abbreviate the corresponding exact roots under `src/vs/`. Bare `contrib/...`, `services/...`, and `api/...` abbreviate `src/vs/workbench/` subdirectories; fragments such as `parts/...` use the preceding explicit component's root. Artifact basenames (`telemetry-inventory.md`, `compatibility.md`, etc.) live under `openspec/changes/product-debloat/`. The parent expands these to narrow repository-relative paths in each leaf brief.

**Ready for bounded apply:** both parent gates are resolved. Implement the concrete `build/distro/walker/gallery.json` → `build/lib/walkerProduct.ts` → desktop/REH packaged-product mixin from design D1. M0 measures exact leaf scopes before edits; every production leaf stays <=400 additions + deletions including tests. Use the approved feature-branch-chain, with narrow parent-supplied edit surfaces and no size exception. Actual Open VSX/package/native behavior remains to be verified, not presumed from this plan.

## Review Workload Forecast

Preliminary implementation additions + deletions: **approximately 600,000–2,000,000 lines**, not a measured diff. Source/tests/styles/resources/manifests/lockfiles/build tails all count. Copilot/chat/sessions/Agent Host dominate; uncertainty remains high until a tracked-file/line manifest is measured. Binary files/bytes and these OpenSpec artifact diffs are additional. Do not count net lines, omit tests/docs, treat vendor/generated deletions as free, or promise a small fixed PR count.

Delivery strategy: ask-on-risk
Review budget: 400 additions + deletions per reviewable unit
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Approved split: measured inventories/protected fixtures → accounts/auth/Open VSX gallery → Sync/tunnels/Continue On → chat core/API/integrations → sessions+Agent Host → neutral `getRipgrepExcludeFilter` extraction before Copilot/build-tail deletion → telemetry infrastructure and bundled-direct-reporter cutoff → telemetry call-site groups by subsystem → boundary regression coverage. The chain-ready units below provide prerequisites, owned deletion seams, retained boundaries and verification commands. Final pruning cannot be deferred to another change; no size exception is permitted.

### Estimated family scope

These are **families, not single PRs**. Each expands into numbered autonomous leaf slices under the protocol below. Ranges are rough estimates including tests and package cleanup, and are not a census; M0 replaces them with measured, disjoint ownership. Telemetry within deleted A/C trees is counted with those deletions, not again under pruning.

| Family | Estimated changed lines | Expected deletion/change unit |
| --- | ---: | --- |
| M0/M1 | 1,000–2,600 | Inventories, compatibility/protected fixtures and runner discovery |
| A1 | 500–1,200 | Inert public auth facade and tests |
| A2 | 5,000–15,000 | Workbench auth/RPC/dynamic OAuth/MCP tails and tests |
| A3 | 800–2,000 | Accounts global/title controls/settings/default-account tails |
| A4 | 6,000–22,000 | GitHub/Microsoft provider extensions/manifests/locks/build references |
| A5 | 15,000–40,000 | Sync implementations/transports/tests; local-helper extraction |
| A6 | 4,000–12,000 | Cloud edit sessions/contributions/tests/direct links |
| A7 | 5,000–18,000 | Account tunnels/forwarding/CLI account paths and tests |
| A8 | 2,000–8,000 | Whole GitHub integration extension and its discovery/dependencies |
| G1/G2 | 1,500–4,000 | Gallery account UI/services; anonymous config/request tests |
| C1 | 1,000–3,000 | Product/chat/session registration/entrypoint disconnection |
| C2 | 6,000–18,000 | Chat/language-model API bridges/converters/tests |
| C3 | 4,000–12,000 | Non-chat contribution integrations/test fixtures |
| C4 | 100,000–280,000 | Chat tree/services/tests/styles/assets |
| C5 | 50,000–180,000 | Agents Window tree/tests/resources/entrypoint tails |
| C6 | 50,000–170,000 | Platform/workbench/server/CLI Agent Host tree/tails |
| C7 | 300,000–900,000 | Bundled Copilot tree/tests/manifests/vendor resources |
| P1 | 180–350 | Neutral ripgrep filter extraction/platform tests |
| P2/P3 | 4,000–18,000 | Copilot shim/native/SDK dependency/producer/CI/lock tails |
| I1–I7 | 4,000–10,000 | All-context telemetry/crash infrastructure cutoff/tests |
| B1–B8 | 3,000–10,000 | Retained bundled reporters/injections/manifests/locks/tests |
| T1–T12 | 40,000–120,000 | Remaining owned calls/payloads/DI/helpers/tests/dependencies |
| V1/V2 | 1,000–2,500 | Packaged/protected regression fixtures and reproducible evidence |

### Autonomous leaf-slice protocol

Every family has start/finish/test/rollback boundaries in the table below. Instantiate `Family.001`, `.002`, etc. from its concrete path/symbol dependency manifest **before executing that leaf**; the parent brief must name narrow file paths/globs, prerequisites and test selector. A completed leaf is not a completed family.

- Target 120–400 additions + deletions **including tests, deletion of obsolete tests, metadata and inventory updates**. Usually reserve 30–100 lines for tests/evidence and use at most 200–300 source/package lines. Never combine upper bounds into >400 unnoticed.
- Disconnect registration/consumers before deleting dependencies; remove unreachable members/tests/resources in reverse dependency order. For a large file, split independent function/test blocks while maintaining compilation; for large trees, use measured file batches and explicit no-inbound-reference assertions.
- Start: preceding leaf is passing; required boundary/positive regression exists; exact paths and measured estimate are known. RED: add the focused absence/retained-behavior assertion. GREEN: remove the named implementation/consumer. TRIANGULATE: exercise legacy-state/alternate-context and positive protected behavior. REFACTOR: remove sole-purpose residue and rerun affected checks.
- Finish: focused tests and relevant compile diagnostics pass; the manifest records actual added + deleted lines, deleted files/package entries, remaining inbound references and subsystem progress. Keep working code unregistered/inert during any staging recovery; never introduce a shadow auth/chat/reporter implementation.
- Rollback: restore only the safe generic behavior or an unregistered fragment needed for diagnosis; retain inert facades/no-op telemetry/no crash startup. Preserve user data and test credentials; rebuild clean outputs. No blind revert that reactivates prohibited behavior.
- `size:exception` is explicitly declined. Split large lock/generated/source-and-test changes at coherent dependency/member/fixture ownership seams, retaining test changes in every leaf. If measurement reveals no safe <=400 seam, **pause that leaf and return a concrete split-plan obstacle**; do not proceed oversized, reopen the resolved chain choice, compress tests or assume an exception.

## Approved Chain-Ready Unit Decomposition

Execute the following dependency order on the approved **feature-branch-chain**. `Uxx` denotes a subsystem stage, **not one oversized PR**. Its named seams (`a`, `b`, etc.) expand into reviewable units `Uxx.a.001`, `.002`, etc., each **120–400 total changed lines including its tests/deletions/metadata**; P1's first neutral-helper unit is estimated 180–350. M0 records the exact measured file/member/test batch for every leaf before editing. No subtree, giant test file, generated output or lockfile is one review-free deletion. The existing family checkboxes below are the execution checklist; these stages bind their order and verification, without duplicating delivery gates.

**Universal retained boundary for every unit:** `extensions/git` + `git-base`, OS Git helpers/SSH keys/askpass/passphrases and arbitrary plain remotes (including github.com), local profiles/settings/repos/extensions/secrets, ordinary diagnostics and generic SSH/server/port forwarding. Every leaf carries an appropriate positive retained-boundary test plus its negative removal/compatibility test. Start from the predecessor's passing state; finish with those tests/current compile diagnostics passing and measured inventory updated. Rollback retains inert facades/no-op telemetry and restores only required generic behavior, never accounts/agents/reporting or destructive state cleanup.

### U00 — Inventory and protected-fixture units (M0/M1)

Prerequisites: approved gates and current proposal/spec/design. Seams: **a** tracked source/test/package/line ownership manifest; **b** telemetry payload/DI/dependency ledger; **c** per-process/API legacy-state counter fixtures; **d** Git/SSH/profile/gallery/diagnostic positive fixtures. Expected production deletions: none; test/inventory additions are independently measured. Finish: exact unit paths/seams and test selectors are known; current positive boundaries pass and baseline violations are reproduced safely. Retain all user/remote data.

## Verification — U00

`./scripts/test.sh --run <fixture-file>`; `./scripts/test.sh --run vs/platform/tunnel/test/common/tunnel.test`; `./scripts/test-integration.sh --suite 'git,git-base'`; `npm run test --prefix extensions/dotnet-toolchain`. Baseline RED results are recorded, not misreported as implemented behavior.

### U01 — Accounts/authentication/gallery units (A1/A3/A4/A8/G1/G2)

Prerequisites: U00; ordinary API/Git fixtures. Seams: **a** passive-empty/create-register-unsupported public auth facade + Node/worker tests; **b** each global/title account control/config block + UI/registration tests; **c** provider discovery disconnection followed by GitHub/Microsoft provider source/test/manifest/dependency batches; **d** GitHub integration disconnection/source/test/menu batches; **e** each gallery account service/UI/rating branch + anonymous/metadata/failure tests; **f** Open VSX mixin/helper + build fixtures; **g** desktop product-stream wiring + serialized/embedded product test; **h** REH wiring/type mapping + remote-product test. Expected deletions: account UI/provider/GitHub/gallery account-owned code and package references, never Git/askpass; root product gallery field stays absent. Later auth-source deletion waits for internal cloud/chat consumer disconnections (U02–U05); its API boundary is inert now. Finish: account entrypoints and bundled registrations removed, Open VSX quartet effective in packaging, normal Git/API/local state intact.

## Verification — U01

`./scripts/test.sh --run <account-api-or-ui-file>`; `./scripts/test.sh --run vs/platform/extensionManagement/test/common/extensionGalleryService.test`; `./scripts/test-integration.sh --suite 'git,git-base'`; affected extension build (`npm run gulp compile-extensions` or smaller existing task); from `build/`, `node --test lib/test/walkerProduct.test.ts`; `npm run typecheck --prefix build`; `npm run typecheck-client` when not covered by current diagnostics. Product tests are phased to the owning removals; final live gallery smoke is U12.

### U02 — Sync/local-profile seam units (A5)

Prerequisites: U01's inert API, U00 local-profile sentinels. Seams: **a** independently local profile/ignored-extension helpers moved with parity tests; **b** each desktop/web/shared startup/DI block removed with no-cloud-start tests; **c** each Sync transport/service/synchronizer source+obsolete-test block; **d** remaining config/log/package/generated tails. Expected deletions: userDataSync cloud trees/transport/log/dependencies, not local profile storage/settings/import/export. Finish: no Sync state reader/refresh/upload/startup path; local profiles remain usable and unchanged.

## Verification — U02

`./scripts/test.sh --run <owning-profile-or-sync-boundary-file>`; `npm run typecheck-client` for moved helpers/DI; relevant extension-management profile tests via `./scripts/test.sh --run <file>`. Reopen copied Sync state and compare protected sentinels.

### U03 — Account tunnels/CLI/cloud-forwarding units (A7)

Prerequisites: U02 completed, U01's inert API, and U00 generic tunnel/server/key-transport fixtures. Seams: **a** remoteTunnel and bundled tunnel-forwarding registration/launch blocks; **b** cloud UI/service/process source+tests; **c** Rust device/token/login/cloud commands split by function/module with Cargo regression tests; **d** cloud-only product mutex/installer/package/dependency tails. Expected deletions: Remote Tunnels/account CLI/cloud provider, never generic platform tunnel/Ports/SSH/server connection security. Agent-specific CLI consumers are disconnected here or in a documented U07 prerequisite leaf before deleting their dependencies. Finish: account enrollment/forward-internal unavailable while non-account forwarding/remote infrastructure resolves.

## Verification — U03

`./scripts/test.sh --run vs/platform/tunnel/test/common/tunnel.test`; `./scripts/test.sh --run vs/platform/tunnel/test/node/tunnelProxy.test`; owning remote/server boundary files; `cargo check --manifest-path cli/Cargo.toml`; `cargo test --manifest-path cli/Cargo.toml <focused-filter>`; affected retained extension build and `npm run typecheck-client` when needed.

### U04 — Cloud Continue On/edit-session units (A6)

Prerequisites: U01/U02/U03; local workspace-restore tests. Seams: **a** cloud command/extension-point/destination activation and direct links; **b** cloud service/storage/backend source+obsolete-test blocks; **c** exclusive proposals/manifests/package tails. Expected deletions: editSessions/cloud continuation code and dependencies, not ordinary local restoration/files. Finish: legacy state inert, no cloud requests and no obsolete command links.

## Verification — U04

`./scripts/test.sh --run <workspace-restore-or-edit-session-boundary-file>`; retained extension API suite through `./scripts/test-integration.sh --suite api-workspace --grep <focused-pattern>`; `npm run typecheck-client` for contribution/API changes.

### U05 — Chat core and final auth compile-tail units (C1–C4/A2)

Prerequisites: U01–U04; retained API/editor/notebook/terminal/SCM tests. Seams: **a** product/workbench/window/session/host activation blocks; **b** each chat/language-model/tools API protocol/converter bridge + inert facade/regular-API tests; **c** each retained-feature or later-tree inbound consumer block + non-chat parity tests; **d** final workbench/dynamic/MCP OAuth source/RPC/test removal once all consumers are disconnected; **e** reverse-dependent chat service/model/action/widget/source+test/style/resource blocks. Expected deletions: chat core/chat-only services, active auth graph and their compile/package tails; no shadow chat/auth tree. **Cross-tree prerequisite disconnection is explicit:** if sessions/AgentHost source or tests import a chat dependency, remove that owned integration block in a recorded `U06.prep`/`U07.prep` leaf before its U05.e dependency; complete tree deletion remains U06/U07. This keeps compilation coherent without resurrecting a framework. Finish: chat core physically gone and final auth boundary inert, with ordinary APIs/features preserved.

## Verification — U05

`./scripts/test.sh --run <api-or-retained-feature-file>`; `./scripts/test-integration.sh --suite api-folder --grep <focused-pattern>`; `npm run typecheck-client`; `npm run vscode-dts-compile-check` for declarations; `npm run valid-layers-check` only for neutral-helper movement. Source/import/registration fixtures must assert physical removal, not only hidden UI.

### U06 — Agents Window ownership units (C5)

Prerequisites: U05 and any U06.prep leaves; normal workbench/window tests. Seams: **a** desktop/web build/restore/entrypoint lists + absence fixtures; **b** each sessions provider/service/component/test block in reverse dependency order; **c** exclusive HTML/styles/icons/component/layer/build/test registrations. Expected deletions: all `src/vs/sessions/` and its exclusive assets/entrypoints; ordinary workbench/windows remain. Finish: no Sessions Window source, entrypoint or restoration path ships.

## Verification — U06

`./scripts/test.sh --run <window-or-workbench-boundary-file>`; focused entrypoint build tests via `node --test <file>` from `build/`; `npm run typecheck-client`; `npm run typecheck --prefix build`; normal desktop/browser entrypoint compile diagnostics.

### U07 — Agent Host ownership units (C6)

Prerequisites: U03/U05/U06 and U07.prep leaves; retained generic server/SSH/IPC fixtures. Seams: **a** starter/manager/agent-only channel/CLI-supervisor construction references + no-process tests; **b** workbench agent-host clients/services + retained remote tests; **c** platform agent provider/protocol/state/server source+test/generated blocks; **d** exclusive scripts/registry/agent package tails. Expected deletions: platform/workbench Agent Host trees, server agentHostChannel, exclusive CLI/process hooks; no generic remote/tunnel/credential primitive is removed by name. Finish: no agent process/channel/source dependency while server/remote extension host works.

## Verification — U07

`./scripts/test.sh --run <process-or-remote-boundary-file>`; retained platform tunnel suites; `npm run typecheck-client`; changed CLI Cargo check/focused tests; retained server-entrypoint compile diagnostics. Live SSH/Ports coverage is U12 when the environment exists.

### U08 — Neutral ripgrep prerequisite unit(s) (P1)

Prerequisites: U07; original platform-filter fixture inputs. Seams: **a** extract only `getRipgrepExcludeFilter`/required neutral platform mapping into `build/lib/ripgrep.ts` + independent `build/lib/test/ripgrep.test.ts` (estimated **180–350 total lines**); **b** desktop/REH import migration + task-load/Search payload fixtures if needed as a separate <=400 unit. Expected deletion/change: filter code removed from Copilot-owned module, **not** ordinary ripgrep. Finish: both packaging graphs use the neutral helper before any Copilot module deletion.

## Verification — U08

From `build/`, `node --test lib/test/ripgrep.test.ts`; `npm run typecheck --prefix build`; independent platform target-selection fixtures for Linux/armhf/alpine/macOS/Windows. Ordinary package Search smoke is U12.

### U09 — Copilot and build/dependency-tail units (C7/P2/P3)

Prerequisites: U08 and U05–U07 runtime consumer disconnections. Seams: **a** SDK/version/shim/fetch/copy/filter/discovery invocation blocks + package-task fixtures; **b** measured reverse-dependent Copilot source/test/manifest/vendor/generated/resource batches; **c** dead `build/lib/copilot.ts` member/test blocks and final file deletion, Mach-O/.moduleignore paths; **d** each agent SDK/Codex/dictation/CI producer and exclusive dependency component + retained native/build tests; **e** affected lockfile/dependency-closure batches, each including graph assertions. Expected deletions: all Copilot extension/SDK/runtime/shim/package-copy and exclusive agent producers/packages; ordinary Search/ripgrep/proxy/native/REH build utilities remain. Finish: clean build needs no Copilot shim/fake SDK, and package/dependency graph is physically absent. Huge files split by owned members/test scenarios/resources; no size exception or test compression.

## Verification — U09

Focused build package-task fixtures via `node --test <file>` from `build/`; `npm run typecheck --prefix build`; affected retained extension builds; `npm run typecheck-client` for source tails; inspected `npm run build-fast` and `npm run gulp vscode-linux-x64`, plus discovered retained REH target after prerequisites. Recipe must complete without the removed shim feature.

### U10 — Telemetry infrastructure/direct-reporter cutoff units (I1–I7/I.ALL/B1–B8)

Prerequisites: U09/U00; each process/extension's counter and positive diagnostic fixture. Seams: **a** dependency-free null contract/DI + tests; **b** separate desktop main, desktop renderer, browser, shared, server and Node/worker bootstrap/RPC/transport blocks + per-context request/logger/flush tests; **c** early crashReporter/argv/runners/schema blocks + no-start/error-output tests; **d** appender/server/custom-endpoint/error/log/UI/package implementation+obsolete-test batches after caller disconnection; **e** each retained extension's direct reporter/parameters/calls/manifests/lock blocks + positive owning-feature tests (Git first, then language/markdown/merge/media/browser owners). Expected deletions: reporting infrastructure/crash startup/direct reporters and their exclusive packages, not ordinary logs/errors/Git credentials. Finish: **all** retained contexts and bundled reporters prove no network/telemetry-log/flush with old all settings. Stage 2 has not yet closed.

## Verification — U10

`./scripts/test.sh --run vs/platform/telemetry/test/common/nullTelemetryService.test` (new), owning process/ext-host counter files and `npm run typecheck-client`; `./scripts/test-integration.sh --suite 'git,git-base'` and affected `typescript`, `html`, `json`, `markdown` suites; retained extension builds; focused build/server/CLI checks when their graph changes. No reporting milestone until every I and B owner passes.

### U11 — Telemetry call-site units by owned subsystem (T1–T12)

Prerequisites: accepted U10 cutoff. Each row independently expands into <=400-line source/payload/constructor/test/dependency leaves in order; every one runs RED → GREEN → TRIANGULATE → REFACTOR and updates the ledger. Expected deletion in every row includes telemetry-only payload computation and dependencies, not only the final emission. All rows preserve the universal Git/local-data/diagnostic/SSH boundaries.

| Unit seam / family | Owned source/package deletion | Specific retained boundary/test |
| --- | --- | --- |
| U11.a / T1 | Main/code/server/platform/environment/product/externalServices reporting calls/IDs/proxy/OS/metered payloads | Startup no-reporting, ordinary request/log/error/server behavior |
| U11.b / T2 | Editor/base event/DI/classification/timing-only helpers | Model/selection/action and independently used perf/debug tests |
| U11.c / T3 | Workbench shell/services layout/views/themes/timer/lifecycle/assignment instrumentation | Local profiles/personalization/commands/lifecycle/disposal tests |
| U11.d / T4 | Files/explorer/workspace/Search/SCM telemetry aggregation/injections | File/Search/ripgrep/history and Git helper/askpass tests |
| U11.e / T5 | Terminal/debug/tasks/testing instrumentation and reporting-only telemetryApp/build entry | PTY/terminal/debug/tasks/test operation and error-output tests |
| U11.f / T6 | Retained language/intellisense/notebook/interactive telemetry/helpers | Non-chat language diagnostics/notebook/API tests |
| U11.g / T7 | Gallery/extensions/API telemetry metadata/DI, machine correlation headers/stat requests | Open VSX functional headers/anonymous lifecycle/metadata/dependencies/VSIX tests |
| U11.h / T8 | Remote/network/Ports/security/metered instrumentation/init payloads | Generic SSH/forwarding/trust/proxy/connection-token tests |
| U11.i / T9 | Remaining extension/server/worker instrumentation/experiment payloads/dependencies | Owning Git/language/markdown/preview/browser build/tests |
| U11.j / T10 | Deleted-feature telemetry test/generated/package residue | Source/package-absence and disjoint ledger reconciliation tests |
| U11.k / T11 | Build/extractor/artifact/script/CLI telemetry-only dependencies/config/runners | Retained packaging/--run/--suite/license/native checks; .NET opt-out preserved |
| U11.l / T12 | Unowned residual calls/payloads/DI/dependencies or undocumented compatibility | Full closed ledger; exact tested no-op public/non-telemetry residual reasons |

## Verification — U11

Every `U11.<seam>.<n>` runs `./scripts/test.sh --run <owning-file-from-leaf-manifest>` plus its row's positive/old-setting counter assertions. Constructor/API changes use `npm run typecheck-client` unless current compilation covers them; U11.i uses extension tests/builds, U11.k uses `npm run typecheck --prefix build`/focused Node tests/Cargo as affected, U11.g uses focused gallery tests and real Open VSX checks after prerequisites. Finish: T1–T12 all closed, including payload-only computation/dependencies; never a deferred cleanup backlog.

### U12 — Boundary regression/package-evidence units (V1/V2)

Prerequisites: U01–U11 complete, all source/package/telemetry ledgers closed. Seams: **a** clean desktop/REH product/dependency/native/process inspection fixtures; **b** fresh/copied-upgrade account/chat/telemetry absence plus local-data/secret/diagnostic/toolchain/Search regression fixtures; **c** Open VSX anonymous lifecycle/control API/listed C# acquisition evidence with known Microsoft-only gap; **d** controlled plain-Git SSH/helper/self-hosted/github.com and remote/Ports tests; **e** macOS/Windows fixtures/native-smoke or explicit environment-gap evidence. Expected changes: missing boundary regression tests/fixes and reproducible evidence, not new features or user-data cleanup. Each test/fix/evidence unit remains <=400; any discovered source fix returns to its owning chain stage. Finish: available targets pass and unavailable native environments are honestly recorded; no test treats absent C# Dev Kit/Copilot as Open VSX failure.

## Verification — U12

Focused `./scripts/test.sh --run <file>`; `npm run typecheck-client`; affected retained extension tests/builds; `npm run typecheck --prefix build`/focused Node tests; changed Cargo checks/tests; inspected `npm run build-fast`, `npm run gulp vscode-linux-x64`, and retained REH recipe. Packaged smokes use isolated profiles/repos/keys and actual Open VSX requests; record C# extension registry ID/version/license and expected provider gap. Git credential/askpass, ordinary diagnostics, non-account SSH/forwarding and the final no-telemetry-network/log assertions are mandatory positive/negative boundaries, not claims from mocks alone.

## Review family boundaries

| Family | Prerequisites / start → finish | Protected boundary and verification | Safe rollback boundary |
| --- | --- | --- | --- |
| M0/M1 | Supplied preflight/approved proposal; inspected baseline → measured graph and isolated failing/positive fixtures | Real Git/SSH credentials and data never touched; focused harness/retained tests | Remove only owned test scaffolding; retain historical evidence |
| A1 | M1 → API passive-empty/create/register-unsupported without RPC | Normal extension APIs, unrelated secrets; Node/worker facade tests | Keep unsupported facade; restore only generic API support |
| A2 | A1; internal cloud/chat auth consumers disconnected by A5–A7/C1–C3 → no workbench/dynamic auth graph | Generic request/proxy/URL/secret APIs and non-auth MCP consumers; zero-side-effect tests | Restore generic helper only; no provider or loopback runtime |
| A3 | M1; consumer inventory → no account menus/settings/badges/default-account service consumers | Title/global controls/local profiles/onboarding; registration/UI tests | Account-free layout fallback |
| A4 | M1/A1, bundled discovery disconnection → provider trees and npm/package tails absent | Git askpass/OS helpers; extension discovery/build/tests | No provider activation; restore safe build metadata only |
| A5 | M1; local-helper classification → no Sync startup/transports/source | Local profile/settings/import/export/extension policy; profile/sentinel tests | Local helpers only, no Sync registration |
| A6 | M1; retained-local consumers identified → no cloud edit-session implementation/links | Workspace restoration/files; retained restore tests | Local restore path only |
| A7 | M1; generic/server/cloud ownership mapped → no account tunnel/provider/CLI login | Platform tunnel, remote Ports/SSH/security tokens; core/Cargo/remote tests | Generic transport/server primitive only; no cloud enrollment |
| A8 | M1/A1; Git carve-out fixture passing → no bundled GitHub integration | Git/git-base arbitrary remote/history/askpass; extension tests/build | Plain Git only, never OAuth registrant |
| G1/G2 | M1, approved Open VSX quartet; G1 removes account dependency → concrete packaging mixin and anonymous baseline | Install/update/dependencies/VSIX, metadata, controlUrl mapping; gallery/package tests and listed C# acquisition | Approved Open VSX config or explicit unavailable diagnostic; no provider/sign-in fallback |
| C1 | M1, A1; process/UI inventory → chat/agent/session activation removed | Editor/SCM/terminal/debug/onboarding; registration/no-process tests | Entry points remain disconnected |
| C2 | C1/A1; ordinary API fixture → no feature bridges/protocol/converter imports | Public type shapes only where required; regular APIs activate | Tiny empty/unsupported facade only |
| C3 | C1; inbound retained-feature imports mapped → chat-only integrations removed | Notebook/language/editor/terminal/SCM/debug/Search and test harnesses | Feature-neutral helper or non-chat fallback |
| C4 | C1–C3, no retained inbound consumers → complete chat tree gone | Positive regular API/feature tests and source absence | No shadow tree; generic-helper recovery only |
| C5 | C1–C3; sessions build/window references removed → all Agents Window source/assets gone | Normal editor windows/extension activation; entrypoint tests | Normal workbench-only startup |
| C6 | C1–C3/A7; agent process/channel inbound uses removed → Agent Host graph gone | Generic remote/server/SSH/CLI; process/channel/core/Cargo tests | Generic server/IPC only, no host starter/manager |
| C7 | C1–C3; Copilot packaging/discovery disconnected with P2 → bundled tree gone | Retained extensions/Search; no SDK/shim lookup build tests | No Copilot extension/runtime activation |
| P1 | M1, original filter inputs inspected → neutral ripgrep filter used by desktop/REH | Ordinary Search and platform filtering; independent build fixtures | Safe generic filter, no Copilot module dependency |
| P2/P3 | P1, C1–C3; removed runtime consumers → all Copilot/agent-only package/producer tails absent | Search/proxy/native/REH/CLI packaging; clean graph/build tests | Generic utility restoration, no runtime-copy shim |
| I1–I7 | M1; each process's current construction tested → no reporter/transport/crash startup anywhere | Ordinary request/log/error/remote APIs; no-reporting counters/DI tests | No-op service and ordinary diagnostics only |
| B1–B8 | M1; extension reporter graph mapped → direct reporters/dependencies removed | Git/language/markdown/merge/media/browser functionality; extension suites | Non-reporting feature code only |
| T1–T12 | I1–I7 and B1–B8 non-reporting acceptance; A/C deletions credited → every owned group pruned | Per-group positive tests/ledger and no-reporting checks | Ordinary functionality with no-op boundary; no reporting residue restored |
| V1/V2 | All A/G/C/P/I/B/T families finished → clean package/protected results and explicit gaps | User data/Git/gallery/SSH/diagnostics/toolchain and native platforms | Disable affected broken path; preserve all data, never restore removed feature |

Order does not create a cycle: A2 **final deletion** waits for consumer disconnection, not full C4–C7 source deletion; C7 waits for P2's packaging/discovery disconnection, while P2 final graph cleanup waits only for runtime consumers to be unreachable, not for C7's last disconnected source file. Leaf manifests separate disconnection and final deletion steps explicitly.

## M — Measure inventory and establish protected fixtures

### M0 — Owned source/package/telemetry manifest

- [x] M0.1: Read all inbound imports/re-exports/DI registrations/extension-point/product/config/command/URL/build/test references to proposal removal roots; create `openspec/changes/product-debloat/removal-inventory.md` with exact path/symbol ownership, prerequisite leaf graph, retained consumer classification, tracked source/test/generated/lock/binary file counts and additions-plus-deletions estimates. Distinguish disconnected versus physically deleted state. Include desktop/browser/shared/server/extension-host/CLI/build graphs, not client-only references. <!-- sdd-owner: implementation -->
- [x] M0.2: Seed `telemetry-inventory.md` from design D6 groups T1–T12; enumerate calls, aliases, constructor injections, payload-only variables/timers/classifications/identifiers, direct reporters, stat requests, dependency manifests/locks and build artifacts. Assign every entry a family/leaf, status and test; document non-reporting suppression controls such as the toolchain's `DOTNET_CLI_TELEMETRY_OPTOUT`. <!-- sdd-owner: implementation -->
- [x] M0.3: Trace the exact Open VSX mixin/productJsonStream/productJsonFn composition specified in design D1, including quartet-to-runtime controlUrl mapping, preserved Walker identity and anonymous functional headers. Recompute disjoint workload estimates and instantiate <=400-line feature-chain leaves; report any unresolvable safe-split obstacle, not a pending provider/chain decision or implicit size exception. <!-- sdd-owner: implementation -->

### M1 — RED protected and absence contracts

- [x] M1.RED: Extend suitable existing API/core test harnesses (discovery targets: `workbench/api/test/common/accountFreeApi.test.ts`, `code/test/electron-main/productDebloat.test.ts`, platform telemetry no-op test) with isolated request/logger/URI/provider/storage/channel/process/sender counters and old-state fixtures. Demonstrate baseline account/auth/chat/telemetry violations without performing real OAuth or sending telemetry. Split fixtures/assertions by process/API under the leaf budget. <!-- sdd-owner: implementation -->
- [x] M1.GREEN: Add reusable positive fixtures to `extensions/git/src/test`, platform tunnel/gallery suites, local profile/workspace restoration suites and existing onboarding/toolchain suites: plain remotes/arbitrary hosts, SSH/helper/askpass handling, anonymous gallery/VSIX behavior, unrelated secrets/profile/repo/key sentinels, regular extension APIs, Search/diagnostics. Keep real home/repositories/network credentials out of default unit tests. <!-- sdd-owner: implementation -->
- [x] M1.TRIANGULATE → REFACTOR: Run the smallest positive retained suites and expected-failing new absence suites; record baseline compiler/build diagnostics and actual test selectors. Inspect `scripts/test.sh`/`test-integration.sh`/Windows equivalents for crash/auth/Copilot/agent-host tails; do not launch duplicate watches/builds. Simplify injected fixtures without weakening side-effect assertions. <!-- sdd-owner: implementation -->

## Verification — M

Reference `./scripts/test.sh --run <file>` for every discovered core fixture; examples: `vs/platform/tunnel/test/common/tunnel.test`, `vs/platform/extensionManagement/test/common/extensionGalleryService.test`, `vs/workbench/contrib/welcomeOnboarding/test/common/onboardingTypes.test`. Use `./scripts/test-integration.sh --suite 'git,git-base'` for retained extension-host suites and `npm run test --prefix extensions/dotnet-toolchain` for its existing pure suite. Measurement/discovery is not verification of runtime behavior.

## A — Account, cloud, provider, and GitHub removal

### A1 — Inert public authentication facade

- [x] A1.RED: Add passive session/accounts/hasSession, create/force/provider registration, never-emitting/disposable event, challenge/issuer and old-session cases in API tests; count provider callbacks/subscriptions, RPC, requests, URI opens and storage writes. Assert stable unsupported Error name/code from design D2. <!-- sdd-owner: implementation -->
- [x] A1.GREEN: Replace the `authentication` namespace's active delegation in `src/vs/workbench/api/common/extHost.api.impl.ts` with a pure common facade (retain/replace `common/extHostAuthentication.ts` only if it contains no old implementation). Both Node/worker factories use passive-empty and deterministic unsupported behavior; retain required public types/proposal guards, not services or RPC. <!-- sdd-owner: implementation -->
- [x] A1.TRIANGULATE → REFACTOR: Verify create options with detail objects, duplicate registrations, cancellation, dynamic/challenge input and Node/worker paths never call providers/network; ordinary commands/documents/diagnostics/SCM APIs still activate. Remove unused facade dependencies and document exact public compatibility in `compatibility.md`. <!-- sdd-owner: implementation -->

### A3/A4/A8 — UI, bundled providers, and GitHub integration

- [x] A3.RED → GREEN: Add account registration/menu/titlebar/settings/badge absence assertions, then remove account-owned code from `workbench/browser/parts/globalCompositeBar.ts`, `parts/titlebar/{titlebarPart,titlebarActions}.ts`, account contributions/settings and default-account consumers discovered by M0. Remove one independently testable location per leaf; retain local profile and other global/title controls. <!-- sdd-owner: implementation -->
- [x] A3.TRIANGULATE → REFACTOR: Exercise fresh/copied persisted profiles, keyboard/title/global layout and local profile actions; remove orphan account-only helpers/context/config links. No broad welcome redesign; retain toolchain/personalization. <!-- sdd-owner: implementation -->
- [x] U01.b.011: Remove default-account entitlement consumption from the update contribution and disconnect the inert gallery account side-effect imports from desktop and Sessions entrypoints; preserve legacy storage/update IPC and verify both entrypoints remain account-free. <!-- sdd-owner: implementation -->
- [x] U01.b.012: Remove account-driven GitHub link token/enterprise resolution and sign-in prompts; retain public `github.com` link presentation with an explicit unavailable state when no credential exists. <!-- sdd-owner: implementation -->
- [x] U01.b.013: Remove account entitlement/token-derived Copilot assignment filters and persisted filter state while retaining extension-version filters; remove the account-backed TAS endpoint in a separate leaf. <!-- sdd-owner: implementation -->
- [x] U01.b.014: Disconnect the default-account-derived TAS assignments endpoint and request transport from WorkbenchAssignmentService while preserving the ordinary TAS client and legacy treatment behavior. <!-- sdd-owner: implementation -->
- [x] U01.b.015: Remove the unused account-entitlement GitHub TAS filter provider and assignments-only Copilot extension filter mapping after disconnecting the endpoint. <!-- sdd-owner: implementation -->
- [x] U01.b.016: Remove the default-account-based extension enablement override, the Sync Account Policy developer action, and Getting Started's default-account injection while retaining Settings Sync's account-provider guard and the Agents banner's generic open-window behavior. <!-- sdd-owner: implementation -->
- [x] U01.b.017: Remove account/session/authentication/account-policy-gate sections and account service dependencies from Developer Actions diagnostics; preserve general Policy Diagnostics and native/file managed-settings diagnostics. <!-- sdd-owner: implementation -->
- [x] U01.b.018: Disconnect account-policy gate registrations and active chat/Sessions consumers; stop applying account-gate restricted values while retaining generic policy and AgentDisabled behavior. Gate-only implementation/test files remain on the parent-deletion manifest. <!-- sdd-owner: implementation -->
- [x] A3.PHYSICAL-REMOVAL (parent): Parent's commit `dd1a928fd15` physically removed the disconnected account-policy gate contribution and dedicated test. <!-- sdd-owner: implementation -->
- [x] A4.DISCONNECT: Remove provider discovery/build/CI/native-check/linter/test-label references from the parent-approved paths and assert `git`/`git-base` remain. Provider source trees are not physically removed by this executor. <!-- sdd-owner: implementation -->
- [x] A4.RESIDUAL-REFERENCES: Remove the GitHub authentication suite from both integration runners and their skill documentation; clear provider source entries from both ESLint allowlists while preserving executable `git`/`git-base` suites and generic GitHub transport. <!-- sdd-owner: implementation -->
- [x] A4.PHYSICAL-REMOVAL (parent): Parent's commit `dd1a928fd15` physically removed `extensions/github-authentication/` and `extensions/microsoft-authentication/`. <!-- sdd-owner: implementation -->
- [x] A4.TRIANGULATE → REFACTOR: Check extension discovery and Node/browser retained-extension builds, old provider callback URI inactivity, and positive Git helper/SSH prompts. Remove provider-only package/proposal/transitive dependencies only after last consumer evidence. <!-- sdd-owner: implementation -->
- [x] A8.DISCONNECT: Remove GitHub integration discovery/build/test-label references in the parent-approved paths and remove authentication trust-grant lists from the approved Vite/Rspack HTML templates; preserve Git and Git Base. Source integrations are not physically removed by this executor. <!-- sdd-owner: implementation -->
- [x] A8.RESIDUAL-REFERENCES: Remove the GitHub extension debug launch target from `.vscode/launch.json` while retaining the `vscode.git` test launch. <!-- sdd-owner: implementation -->
- [x] A8.PHYSICAL-REMOVAL (parent): Parent's commit `dd1a928fd15` physically removed `extensions/github/`. <!-- sdd-owner: implementation -->
- [x] A8.TRIANGULATE → REFACTOR: Run retained clone/fetch/pull/push/history/branch/helper/askpass fixtures, GitHub URL dispatch and self-hosted-style cases; eliminate dead external links caused by removed commands. Verify Git-specific generic credential-provider abstraction/terminal env remains meaningful without GitHub OAuth registrants. <!-- sdd-owner: implementation -->

### A5/A6 — Sync and cloud edit sessions

- [ ] A5.RED: Add old Sync/profile enrollment no-start and local profile/settings/create/switch/import/export preservation tests in appropriate existing profile/Sync harnesses. Classify inbound references to `platform/userDataSync` helpers (including ignored-extension policy) before extraction. <!-- sdd-owner: implementation -->
- [ ] A5.GREEN: Disconnect desktop/web/shared/main Sync initialization/registrations; delete `workbench/contrib/userDataSync/`, `workbench/services/userDataSync/` and cloud `platform/userDataSync/` source/transports/tests/resources in dependency-order leaves. Extract only independently local helpers into existing profile/extension-management layers with parity tests; remove Sync logs/account/service/CLI/config tails. <!-- sdd-owner: implementation -->
- [ ] A5.TRIANGULATE → REFACTOR: Reopen copied legacy Sync state, switch local profiles and compare unrelated files/secrets; ensure no upload/download/refresh or provider sign-out. Remove telemetry/payload/dependency residue credited to T10, not local profile functionality. <!-- sdd-owner: implementation -->
- [ ] A6.RED → GREEN: Assert no cloud Continue Working On/edit-session upload/restoration commands or destination providers; disconnect/delete `workbench/contrib/editSessions/` and its cloud services/backend/extension-point/build/test tails, retaining local workspace restoration. Remove direct command links and extension proposals whose consumers disappear. <!-- sdd-owner: implementation -->
- [ ] A6.TRIANGULATE → REFACTOR: Test normal reopen/restore/files plus inert copied edit-session state, no cloud/network/account calls and no deletion of local/remote data; remove sole-purpose dependencies and ledger residue. <!-- sdd-owner: implementation -->

### A7 — Account tunnels, cloud forwarding, and CLI paths

- [ ] A7.RED: Map `platform/remoteTunnel`, `contrib/remoteTunnel`, `extensions/tunnel-forwarding`, Rust `cli/src/{auth.rs,commands/tunnels.rs,tunnels/*}`, product tunnel fields, nativeHost/CLI/packaging/installer wiring by reachable owner. Add cloud login/enrollment/forward-internal absence fixtures and **positive** generic `platform/tunnel`, remote server/Ports/key-transport tests before deletions. <!-- sdd-owner: implementation -->
- [ ] A7.GREEN: Disconnect/delete account Remote Tunnels, cloud tunnel-forwarding bundled provider and account CLI/device/token/service flows; remove tunnel application/mutex/product and bundled-extension discovery tails when exclusively cloud-owned. Keep independent local forwarding/server/version/download/stdio/security-token primitives; do not blanket-delete `platform/tunnel`, `workbench/services/remote`, `cli/src/tunnels/`, or dev-tunnels packages with retained generic consumers. <!-- sdd-owner: implementation -->
- [ ] A7.TRIANGULATE → REFACTOR: Run generic tunnel/server/CLI argument tests and Cargo checks/tests for changed Rust; verify no `getSession` fallback or token refresh from persisted tunnel state. Exercise SSH-key remote files/terminal/extension host and non-account forwarding where available; document environment gaps and remove dead cloud packages only with inbound-use evidence. <!-- sdd-owner: implementation -->

### A2 — Final auth implementation and dynamic/MCP OAuth deletion

- [ ] A2.RED: After A5/A6/A7 and C1/C2/C3 consumer disconnections, add no-auth-service/RPC/callback/loopback/device/XAA construction assertions; inventory residual `IAuthentication*`/defaultAccount/dynamic token references including `contrib/mcp` configuration/actions/language lenses and API implementations. <!-- sdd-owner: implementation -->
- [ ] A2.GREEN: Remove `contrib/authentication/`, `services/authentication/`, `api/browser/mainThreadAuthentication.ts`, active common/node auth implementations and `extHostXaaAuthProvider`/loopback/token-storage helpers; delete main/ext-host auth RPC shapes/context/service registrations. Strip MCP account/OAuth enrollment/secret lenses/provider activation and unsupported auth-dependent operations without deleting independently used non-account behavior. Delete obsolete service/provider/OAuth tests in measured leaves while preserving A1 boundary tests. <!-- sdd-owner: implementation -->
- [ ] A2.TRIANGULATE → REFACTOR: Re-scan callbacks/session restore/auth DI across all entrypoints, run API Node/worker fixtures and ordinary secret/URL/request tests; verify deterministic unsupported behavior and no broad secret wipe/remote revocation. Final residual auth types are public inert signatures or justified Git/generic transport semantics, never active account infrastructure. <!-- sdd-owner: implementation -->

## Verification — A

Use `./scripts/test.sh --run <file>` for replacement API boundaries and retained profile/tunnel suites; preserve focused selectors from existing `extHostAuthentication.test`, integration harnesses and `vs/platform/tunnel/test/common/tunnel.test` / `test/node/tunnelProxy.test` as appropriate. Run `npm run typecheck-client` for changed constructor/API/import graphs unless current compilation already covers them. Run `npm run gulp compile-extensions` (or discovered narrower compile task) plus `./scripts/test-integration.sh --suite 'git,git-base'`. For A7: `cargo check --manifest-path cli/Cargo.toml` and `cargo test --manifest-path cli/Cargo.toml <focused-filter>`. Never run removed OAuth/provider tests by recreating the deleted infrastructure.

## G — Anonymous Open VSX gallery, with the resolved packaging mixin

### G1 — Remove account and rating sign-in paths

- [x] G1.RED: Extend gallery manifest/view/widget suites to require no account-service access, no sign-in command/content/badge/review action, read-only metadata preservation, anonymous operations and failure-without-login. Include persisted private-account-gallery configuration with unavailable outcome and no silent provider fallback. <!-- sdd-owner: implementation -->
- [x] G1.GREEN: Remove `services/extensionManagement/common/extensionGalleryAccount.ts`, `electron-browser/extensionGalleryAccountService.ts`, registrations and account branch of the workbench manifest service. Clean `contrib/extensions/browser/{extensionsViewlet,extensions.contribution,extensionsWidgets}.ts` plus platform rating-link resources. Preserve manifest IPC, gallery client/download/install/update/dependency/VSIX and ordinary diagnostics. <!-- sdd-owner: implementation -->
- [x] G1.TRIANGULATE → REFACTOR: Test access denial, provider unavailable/offline, metadata, private legacy state, anonymous default paths and VSIX installation; remove account-only settings/tests/imports, not protected extension policy/proxy/certificates. <!-- sdd-owner: implementation -->

### G2 — Establish the concrete Open VSX package baseline

- [x] G2.RED: Add `build/lib/test/walkerProduct.test.ts` for the design D1 Open VSX quartet, distribution `controlApiUrl` → runtime `controlUrl` mapping, matching serialized/embedded desktop+REH configuration, unchanged Walker identity/built-ins/root product and missing/malformed mixin rejection. The test reads checked-in `product.json` directly, proves its gallery is absent, then proves the approved packaging mixin supplies it without a dev override. Account/agent/telemetry absence assertions remain deferred until their owning removals. <!-- sdd-owner: implementation -->
- [x] G2.GREEN: Add the exact Open VSX values to `build/distro/walker/gallery.json`, implement narrow composition/validation in `build/lib/walkerProduct.ts`, and apply it in `build/gulpfile.vscode.ts` and `build/gulpfile.reh.ts` productJsonStream transforms before productJsonContents/productJsonFn capture. Update the consumed product type fields only as needed. Keep root product.json/hygiene unchanged and avoid upstream mixin-quality checkout rewriting; no account fields, alternative-provider flag or replacement gallery adapter. Split helper/fixtures, desktop wiring and REH wiring into separate <=400-line leaves as needed. <!-- sdd-owner: implementation -->
- [x] G2.TRIANGULATE → REFACTOR: Keep packaged-product evidence in unit tests: actual checked-in root product absence, exact Open VSX quartet/controlUrl mapping, desktop+REH serialization/bootstrap parity and release-stamp preservation, Walker identity/built-ins, and malformed/missing input rejection. `walkerProduct.test.ts` and `inlineMeta.test.ts` passed under Node 24.18.0. Live package endpoint/lifecycle and listed C# acquisition/licensing evidence remain in U12 V2; telemetry correlation/stat cleanup remains with I/T7. <!-- sdd-owner: implementation -->

## Verification — G

`./scripts/test.sh --run vs/platform/extensionManagement/test/common/extensionGalleryService.test`, focused retained workbench gallery manifest/view/widget files; `npm run typecheck-client`; from `build/`, `node --test lib/test/walkerProduct.test.ts`; `npm run typecheck --prefix build` for composition wiring. After prerequisites, `npm run build-fast` and `npm run gulp vscode-linux-x64` verify real packaged Open VSX operation; validate REH composition with its discovered retained package target. Successful VSIX/mocks/downloaded built-in installation alone does not certify online anonymous access. C# Dev Kit/Copilot absence is expected provider-gap evidence, not a failed test; selected Open-VSX-listed C# acquisition must succeed.

## C — Chat, Agents Window, Agent Host, and Copilot source graph

### C1 — Product activation, workbench/window/host entrypoints

- [ ] C1.RED: Add fresh/legacy product registration/window-restoration/process-start tests with no defaultChatAgent or account; require no chat/views/commands/Open in Agents/settings/session window/host IPC startup while normal workbench starts. <!-- sdd-owner: implementation -->
- [ ] C1.GREEN: Disconnect chat/agent/session activation from `workbench.{common,desktop,web}.main.ts`, `code/electron-main/app.ts` starter/manager/session-link opening, server registrations and main/window APIs. Remove product `defaultChatAgent`, Copilot IDs/URLs/commands/auth access/proposal/auto-update/session fields and fallback defaults in `platform/product/common/product.ts`; remove only exclusive product type/schema members and direct links. Entry/registration/constructor blocks are separate measured leaves. <!-- sdd-owner: implementation -->
- [ ] C1.TRIANGULATE → REFACTOR: Exercise old enabled chat/agent state and API requests without resurrecting a window/process/channel; keep normal workbench/local toolchain/onboarding/remote extension host usable. Do not call disconnection final source deletion. <!-- sdd-owner: implementation -->

### C2 — API/protocol/converter compile tail

- [ ] C2.RED: Add empty-discovery/unsupported registration/execution tests for unavoidable public `chat`/`lm` members plus positive ordinary extension API activation; inventory every bridge/context/protocol/converter/type/proposal/test dependency before deleting it. <!-- sdd-owner: implementation -->
- [ ] C2.GREEN: Remove `api/browser/mainThreadChat*`, `mainThreadLanguageModels.ts`, `mainThreadLanguageModelTools.ts`, `mainThreadAgentEditorComments.ts`, corresponding common `extHostChat*`/language-model/tools/comments modules, protocol/context/service registrations, `extHostTypeConverters` and internal type/test tails. Replace only unavoidable stable facade members with tiny empty/unsupported functions from design D4; no `extHostChat` or chat-service compatibility framework survives. Preserve non-chat converters and APIs. <!-- sdd-owner: implementation -->
- [ ] C2.TRIANGULATE → REFACTOR: Exercise Node/worker ordinary APIs and public declaration checks; remove dead proposed-only grants/fixtures and document exact inert facade members/Error name/code. Re-scan to ensure converter/type tests no longer import deleted chat structures. <!-- sdd-owner: implementation -->

### C3 — Retained feature integrations and fixtures

- [ ] C3.RED: For each inbound consumer batch in M0, add/identify positive non-chat tests for notebook controllers, terminal/inline hints, editor/inline completions, SCM/debug/Search/accessibility/getting-started and ordinary test services; assert removed actions never register. <!-- sdd-owner: implementation -->
- [ ] C3.GREEN: Remove only chat/agent portions of retained contributions and constructor/fixture imports; delete exclusively agent contributions such as `welcomeAgentSessions`/`agentsVoice` with source-use evidence. Clean `workbench/test/{browser,electron-browser}/workbenchTestServices.ts`, component snapshots and onboarding chat setup helper consumers. Extract a truly neutral helper only into the proper retained layer, with parity tests and no chat-shaped model/service copied elsewhere. <!-- sdd-owner: implementation -->
- [ ] C3.TRIANGULATE → REFACTOR: Verify ordinary editor/notebook/terminal/debug/SCM/Search/diagnostic/toolchain behavior, disposable ownership and import/layer validity. Remove direct dead command links; list broader welcome-content follow-ups without editing onboarding copy/design beyond direct removal. <!-- sdd-owner: implementation -->

### C4/C5/C6 — Complete disconnected source deletion

- [ ] C4.RED → GREEN: Once retained inbound references are gone, assert source/import absence and remove **all `src/vs/workbench/contrib/chat/`** plus chat-only `workbench/services/chat/` source/tests/styles/assets. Expand the manifest into reverse-dependent member/file/test batches <=400; run the existing retained boundary/positive tests and add deletion assertions per leaf. No shadow chat subtree or inactive replacement models. <!-- sdd-owner: implementation -->
- [ ] C4.TRIANGULATE → REFACTOR: Close chat ownership including mocks/component/API/test/asset and default-entitlement tails, credit telemetry deletion to T10, and rerun retained feature/API diagnostics. A physically present disconnected source file keeps the family open. <!-- sdd-owner: implementation -->
- [ ] C5.RED → GREEN: Assert no Agents Window build/restore entries; disconnect sessions desktop/web entrypoints in `build/next/index.ts`, gulp/rspack/vite/component/layer/test registrations and remove **all `src/vs/sessions/`**, HTML/styles/tests/assets and exclusive session icons/resources in measured leaves. Preserve normal desktop/browser workbench builds and ordinary windows. <!-- sdd-owner: implementation -->
- [ ] C5.TRIANGULATE → REFACTOR: Inspect desktop/web entry lists and retained window startup; ensure source/package/session fixtures are gone and no tests import a removed sessions component. Record native-platform gaps rather than inferring them. <!-- sdd-owner: implementation -->
- [ ] C6.RED → GREEN: Assert no agent process manager/starter/channel/CLI-supervisor construction, then remove **all `src/vs/platform/agentHost/`, `src/vs/workbench/services/agentHost/`, `src/vs/server/node/agentHostChannel.ts`** and exclusive agent-host scripts/server/CLI registry/supervisor/protocol tails in dependency-order leaves. Keep generic remote/server/IPC/SSH connection security. <!-- sdd-owner: implementation -->
- [ ] C6.TRIANGULATE → REFACTOR: Exercise retained server/extension-host/SSH/Ports paths and no-agent startup; remove agent-only native/SDK dependencies with P3, test/service fixtures, generated imports and process-info/URL restoration tails. Close T10 credit only after actual source/package deletion. <!-- sdd-owner: implementation -->

### C7 — Delete the bundled Copilot tree

- [ ] C7.RED → GREEN: After P2 packaging/discovery disconnection, assert no bundled Copilot extension/SDK lookup; remove **all `extensions/copilot/`** tracked source/tests/manifests/styles/assets/vendor/generated resources/locks in measured autonomous leaves. Delete root compile/watch/setup/token/chat-perf scripts and npm/extension build discovery tails that point into it. Large lock/generated/file deletions split into tested <=400-line ownership/member/dependency leaves; an unresolvable safe-split obstacle pauses that leaf, never grants a size exception. <!-- sdd-owner: implementation -->
- [ ] C7.TRIANGULATE → REFACTOR: Confirm retained extension discovery/compilation/API tests still work, no package/compiler/test imports the removed tree, and final clean packages include no Copilot extension or platform runtime. Remove Copilot-only test pipeline registrations and credit its reporter pruning to T10. <!-- sdd-owner: implementation -->

## Verification — C

Per leaf: `./scripts/test.sh --run <file>` for new API/process boundaries and affected **retained** feature tests; `npm run typecheck-client` when existing current diagnostics do not cover cross-entrypoint/API changes. Use `npm run vscode-dts-compile-check` when public/proposed declarations change, `npm run valid-layers-check` only for neutral-helper extraction/layer changes, extension builds/API suites and focused server/CLI checks as appropriate. Source/import/package manifests must show physical deletion, not just lack of activation. Packaged absence is checked again in V1.

## P — Feature-neutral packaging, native/dependency, and pipeline tails

### P1 — Preserve ordinary ripgrep before deleting its Copilot-owned module

- [ ] P1.RED: Add independent build platform fixtures for `getRipgrepExcludeFilter`, including Linux/armhf/alpine/macOS/Windows mappings and retained Search payloads; inspect every helper consumer. <!-- sdd-owner: implementation -->
- [ ] P1.GREEN: Extract only the feature-neutral `@vscode/ripgrep-universal` filtering from `build/lib/copilot.ts` to the neutral utility `build/lib/ripgrep.ts`; update desktop/REH imports and independent test file. Keep ordinary Search/ripgrep and unrelated npm/proxy/native utilities, not Copilot package selection. <!-- sdd-owner: implementation -->
- [ ] P1.TRIANGULATE → REFACTOR: Run focused platform filter tests and build-tooling typecheck; compare retained target payload selection and delete obsolete Copilot-filter coupling. If measured source+test diff exceeds 400, split helper tests/import migration, not coverage. <!-- sdd-owner: implementation -->

### P2/P3 — Remove SDK/shim and exclusive agent producers

- [ ] P2.RED: Add packaging-task load/product/dependency assertions with no Copilot package installed and no shim call expected. Cover ordinary ripgrep and retained native dependencies; the prior shim failure must not be bypassed with a fake SDK. <!-- sdd-owner: implementation -->
- [ ] P2.GREEN: Disconnect Copilot runtime fetch/version checks/stamping/prebuild/filter/copy/extension packaging and `prepareBuiltInCopilotRipgrepShim` in `build/gulpfile.vscode.ts` (old line 554) and `build/gulpfile.reh.ts` (old line 530). Delete `build/lib/copilot.ts`, `build/lib/test/copilot.test.ts`, Copilot Mach-O paths in `build/darwin/verify-macho.ts` and Agent Host note in `build/.moduleignore` after P1. Remove `@github/copilot-sdk`/runtime versions and all exclusive root/remote/extension locks/dependency entries with measured regeneration. <!-- sdd-owner: implementation -->
- [ ] P3.GREEN: Remove exclusively agent-owned `build/agent-sdk` producers/stamping/CI templates, Codex protocol tooling and dictation/voice runtime production whose only consumers disappear; inspect agent-only Anthropic/Codex/Copilot/MXC/foundry/sandbox dependencies before deletion. Clean `build/lib/extensions.ts`, `build/npm/dirs.ts`, `build/filters.ts`, package scripts, platform pipeline Copilot jobs/cache/artifact hooks and native/license fixtures; keep generic scanners/signing/npm utilities and non-agent consumers. <!-- sdd-owner: implementation -->
- [ ] P2/P3.TRIANGULATE → REFACTOR: Regenerate only affected dependency graphs/locks; inspect top-level/task imports and shipped native paths, then package desktop and retained REH without the Copilot shim or runtime-copy feature. Validate Linux build completion (not merely reaching package-linux); record macOS/Windows fixture/native checks and actual gaps. Remove stale owned output only through the established clean-build recipe, not user data. <!-- sdd-owner: implementation -->

## Verification — P

Focused build tests using the existing Node runner, e.g. from `build/`, `node --test lib/test/ripgrep.test.ts` after creation; `npm run typecheck --prefix build`. Inspect current build prerequisites/diagnostics, then `npm run build-fast` and `npm run gulp vscode-linux-x64`; discover/run retained REH target from `build/gulpfile.reh.ts` for the supported Linux architecture. Build with no Copilot SDK installed or downloaded. Search/ripgrep must work in the resulting package. Deleted Copilot tests are replaced by neutral Search/package assertions, not recreated shim tests.

## I — Telemetry stage 1: process/transport/crash cutoff

Every I-family leaf starts with its process side-effect fixture, ends with no-op DI/no reporting in that context, preserves ordinary logging/request/error behavior, and rolls back only to a safe no-op binding. **Stage 1 is not completion.**

- [ ] I1.RED → GREEN: In `src/vs/code/electron-main/app.ts`, test and replace main reporting service with `NullTelemetryService` object binding; remove appender-client config, ErrorTelemetry construction and telemetry service setup dependencies. Do not confuse singleton object with constructor. Triangulate old all settings, ordinary main logs/errors and no appender-channel request; refactor sole-purpose setup payloads. <!-- sdd-owner: implementation -->
- [ ] I2.RED → GREEN: Replace desktop renderer `services/telemetry/electron-browser/telemetryService.ts` registration/implementation with common no-op binding; remove desktop custom-endpoint import/service/channel. Test renderer startup without shared telemetry channels and retained services; triangulate old settings and refactor dependencies. <!-- sdd-owner: implementation -->
- [ ] I3.RED → GREEN: Replace browser `services/telemetry/browser/telemetryService.ts` registration/implementation and web-main reporting configuration with common no-op binding; remove 1DS/local-log/consent-driven enablement. Test browser/dev/extension-test mode with old all settings produces zero requests/logging; preserve ordinary browser diagnostics, then refactor. <!-- sdd-owner: implementation -->
- [ ] I4.RED → GREEN: In `code/electron-utility/sharedProcess/sharedProcessMain.ts`, remove appenders/common reporting properties, `telemetryAppender`/custom-endpoint channel registrations, custom endpoint service and shutdown flushes; bind no-op. Test channel list/log construction and ordinary shared extension-management services; triangulate old settings, refactor reporting-only dependencies. <!-- sdd-owner: implementation -->
- [ ] I5.RED → GREEN: In `server/node/serverServices.ts` and retained remote service clients, replace server telemetry service/DI with no-op, delete server/remote telemetry channels and initial/change telemetry-level control; keep generic server and gallery-manifest channels. Test old remote level messages cannot enable reporting, positive remote/gallery resolution, then refactor. <!-- sdd-owner: implementation -->
- [ ] I6.RED → GREEN: Replace `api/common/extHostTelemetry.ts`, main-thread telemetry bridge/init/RPC/service tails with the disabled public facade: false enablement/config, no telemetry logger/common properties/sender storage/unhandled-error reporting, no-op usage/error/dispose/flush. Test supplied sender counters stay zero in Node/worker/remote old-init cases; preserve regular error notifications/output and document compatibility before refactoring. <!-- sdd-owner: implementation -->
- [ ] I7.RED → GREEN: Delete `src/main.ts` crashReporter import/initialization/config/CLI path, main argv.json report-ID/enablement writes, crash schema/environment/server/ext-host/CLI tails. Clean crash arguments in `scripts/test.sh`, integration runners and platform equivalents without breaking test selectors. Assert old argv/settings cannot start crashReporter and ordinary error handling remains; triangulate early startup and refactor. <!-- sdd-owner: implementation -->
- [ ] I.ALL.TRIANGULATE → REFACTOR: After all contexts resolve no-op, delete platform appenders, reporting telemetryService/telemetryIpc/remoteTelemetryChannel/server/custom-endpoint/error/log infrastructure and reporting tests/UI/config/consent/status/extractor/package streams in measured leaves. Retain minimal no-op/public shape only; remove exclusive 1DS/reporting dependencies and identity/payload collection with consumer evidence. Run cross-context no-network/no-telemetry-log/no-flush fixtures under old settings and record cutoff acceptance separately from remaining T inventory. <!-- sdd-owner: implementation -->

## Verification — I

Use `./scripts/test.sh --run <file>` for `vs/platform/telemetry/test/common/nullTelemetryService.test` (new), process bootstrap fixtures and replacement ext-host telemetry API tests. Replace/remove obsolete browser/server/log-appender suites with no-op and retained error-output assertions. Run `npm run typecheck-client` for service/entrypoint/API changes; extension-host integration and retained server/CLI/build checks cover non-client contexts. Explicit counters and package inspection must show no telemetry output even in development/extension-test mode and with old full-reporting/crash arguments.

## B — Bundled direct-reporting cutoff and extension-owned pruning

Prerequisite: M1 and each extension's baseline tests/build. Every named extension is an independent removal family with reporter/payload/manifest/lock deletion leaves, positive feature tests and safe non-reporting rollback. Deleted provider/GitHub/Copilot reporters are credited to A/C and T10, not counted again here.

- [ ] B1.RED → GREEN → TRIANGULATE → REFACTOR: In `extensions/git`, remove reporter creation/import/dependency/aiKey and all reporter parameters/calls/payload-only logic in `src/{main,repository,model,commands,cloneManager}.ts` and discovered helpers/tests; regenerate its lock. Preserve `git`, askpass/SSH/helper/env/credential-provider behavior and logs. Run Git tests/build and old-telemetry-setting no-output fixtures with each leaf, not after deleting the whole extension reporter graph. <!-- sdd-owner: implementation -->
- [ ] B2.RED → GREEN → TRIANGULATE → REFACTOR: In `extensions/typescript-language-features`, remove direct reporter and experimentation telemetry adapter/payload/identity paths/dependencies; retain only independently needed non-reporting feature configuration and TS language behavior. Add no-reporter/error-log preservation tests, run Node/browser extension builds and TypeScript integration suite. <!-- sdd-owner: implementation -->
- [ ] B3.RED → GREEN → TRIANGULATE → REFACTOR: In `extensions/html-language-features` client/server/browser graphs, remove direct reporter/import/manifests/locks/events/sole-purpose payloads; preserve language/diagnostic behavior and run focused HTML suite/builds/no-reporting fixtures. <!-- sdd-owner: implementation -->
- [ ] B4.RED → GREEN → TRIANGULATE → REFACTOR: Repeat for `extensions/json-language-features` client/server/browser graphs, retaining JSON completion/validation/diagnostics and focused JSON suite/builds. Do not mistake server diagnostic transport for telemetry. <!-- sdd-owner: implementation -->
- [ ] B5.RED → GREEN → TRIANGULATE → REFACTOR: In `extensions/markdown-language-features`, remove direct reporter/payload/injection/dependency/lock code without disrupting language/preview/markdown editor features; run focused markdown integration/build checks and no-reporting/error-output fixtures. <!-- sdd-owner: implementation -->
- [ ] B6.RED → GREEN → TRIANGULATE → REFACTOR: In `extensions/merge-conflict`, remove direct reporter/telemetry-only commands payloads/dependencies/locks; add retained conflict resolution and ordinary error-output tests with no reporter output and run its discovered build/test harness. <!-- sdd-owner: implementation -->
- [ ] B7.RED → GREEN → TRIANGULATE → REFACTOR: In `extensions/media-preview`, remove reporter lifecycle/event payloads/dependencies/locks; preserve image/audio/video preview and ordinary diagnostics, with extension build and focused fixtures per leaf. <!-- sdd-owner: implementation -->
- [ ] B8.RED → GREEN → TRIANGULATE → REFACTOR: In `extensions/simple-browser`, remove reporter lifecycle/payloads/dependencies/locks while preserving browser views/output. Scan every other retained local and downloaded bundled extension's **actual packaged payload** for reporters/direct telemetry; assign discoveries to new bounded B leaves. If a vendor-built reporter needs a product/distribution choice, stop that slice for the parent rather than deleting protected debug support or exempting it silently. <!-- sdd-owner: implementation -->

## Verification — B

Run discovered per-extension compile tasks or `npm run gulp compile-extensions`; affected Node/browser/server targets all count. Inspected integration runner supports `./scripts/test-integration.sh --suite 'git,git-base'`, `--suite typescript`, `--suite html`, `--suite json`, and `--suite markdown` (add focused `--grep` where appropriate). Extensions without a selected integration suite use their existing/discovered unit harness or focused injected facade tests, not invented `npm test` scripts. Manifest/lock/bundle scans plus counter tests must show direct reporting dependency/output absence. Ordinary Git/language/browser diagnostic logs remain positive assertions.

## T — Telemetry stage 2: finish every owned group

Prerequisite: I.ALL and B families have accepted non-reporting tests. For **each numbered leaf** below: RED add/identify a protected-function regression and instrumentation/payload-absence fixture; GREEN delete calls/sole-purpose timing/IDs/counters/classifications/helpers/constructor forwarding/DI/imports/tests/dependencies; TRIANGULATE old settings and alternate process/error paths; REFACTOR dead code and update `telemetry-inventory.md` with actual diff/tests. Each leaf runs its focused core/extension suite and relevant compilation, not only the final global scan.

- [ ] T1: Finish main/code/server/bootstrap/platform/environment/product/externalServices/telemetry service callsite/identity/payload pruning, including OS/proxy/metered reporting in `app.ts`; retain separately justified generic identity/security/perf behavior and normal logs. Close all infrastructure leftovers and temporary custom-endpoint no-op signatures after final consumer removal. <!-- sdd-owner: implementation -->
- [ ] T2: Prune editor/base-owned event/DI/timing/classification code across `src/vs/editor` and `src/vs/base`; keep ordinary model/selection/action/perf/debug utilities only when a tested non-reporting consumer exists. Run affected editor/base suites and layer checks only if dependencies move. <!-- sdd-owner: implementation -->
- [ ] T3: Prune workbench shell/common/services (layout/title/status/views/timer/themes/keybindings/lifecycle/storage/accessibility/assignment), constructor/test stubs and payload helpers; preserve personalization, profile switching, command/lifecycle/disposable behavior with focused service/browser tests. <!-- sdd-owner: implementation -->
- [ ] T4: Prune files/explorer/workspace/bulk-edit/Search/SCM telemetry, aggregation and injection, keeping actual file/search/history/Git work and output; run affected file/search/SCM fixtures and retained Git tests. Ordinary ripgrep must not become an exclusive-reporting dependency deletion. <!-- sdd-owner: implementation -->
- [ ] T5: Prune terminal/terminalContrib/debug/tasks/testing events, timings/helpers/DI and `contrib/debug/node/telemetryApp` if reporting-only, plus its build entrypoint; preserve PTY/terminal/debug/tasks/test operation/error notifications with focused suites. This does not implement new .NET Run & Debug or Tests. <!-- sdd-owner: implementation -->
- [ ] T6: Prune retained language/intellisense/inline-completion/notebook/interactive contribution telemetry/payloads and fixtures; preserve non-chat language features, diagnostics/notebook execution and relevant API behavior. Do not delete general language helpers for a telemetry substring. <!-- sdd-owner: implementation -->
- [ ] T7: Prune platform/workbench extensionManagement/extensions views/recommendations/API event/DI/init/common-property payloads; remove `marketplace.ts` stored correlation headers/identity queries, gallery query telemetry/correlation payloads and `reportStatistic` usage-reporting requests/callers. Preserve functional headers, metadata reads and all anonymous acquisition/VSIX/dependency networking. Test forbidden headers/stat requests and real authorized gallery compatibility; return incompatibility to parent, never restore telemetry. <!-- sdd-owner: implementation -->
- [ ] T8: Prune retained remote/network/Ports/tunnel/server/security/metered instrumentation and remote init payloads; preserve SSH/remote extension host/ordinary connection tokens/trust/proxy/security and non-account forwarding through positive remote/tunnel tests. <!-- sdd-owner: implementation -->
- [ ] T9: Close all retained extension/server/worker instrumentation and experimentation leftovers after B cutoff; remove event-only helpers/parameters/schemas/dependencies and update every affected manifest/lock/build. Run owning extension tests/builds and shipped-payload scans; no direct reporter bypass or payload-only residue can remain. <!-- sdd-owner: implementation -->
- [ ] T10: Reconcile A/C physical deletions against telemetry entries and generated/test/package tails. Mark a deleted-feature group pruned only after every owning file/reference/payload/dependency is removed; retain evidence of separate infrastructure acceptance versus full pruning without double-counting lines. <!-- sdd-owner: implementation -->
- [ ] T11: Remove telemetry-only build/packaging/extractor/artifact/script/CLI configuration and dependencies across root/remote/extension manifests/locks and build tasks/pipelines. Clean test runners' old crash/chat/Agent Host/auth/Copilot settings/selectors while keeping retained `--run`/`--suite` functionality. Preserve generic release tooling, license/native validation and the .NET installer suppression controls. <!-- sdd-owner: implementation -->
- [ ] T12: Re-scan the entire tracked source/test/package graph for telemetry service/reporter/log/channel/setting/event/classification/payload aliases and exclusive dependencies. Assign every residual to T1–T11 or exact documented+tested `retained-compatibility`/`retained-non-telemetry` entries in `compatibility.md`/the ledger; remove all unowned residue, rerun owning focused tests and verify every group closes. No permanent pruning backlog or enabled old-level path. <!-- sdd-owner: implementation -->

## Verification — T

Each leaf uses `./scripts/test.sh --run <file>` for its owning subsystem and affected retained-behavior tests. Use `npm run typecheck-client` for changed constructor/DI/API graphs not already covered by current compilation, extension-level tests/builds for T9/B changes, build-tooling typecheck/tests for T11, and server/CLI checks for T1/T8/T11. Re-run no-network/no-telemetry-log/no-sender/flush fixtures with legacy reporting settings after constructor/payload refactors. Inventory closure requires evidence for payload-only computation and remaining dependencies, not merely zero literal `publicLog` matches.

## V — Clean package and protected regression evidence

These are implementation regression/evidence tasks, not parent delivery/release/review gates. Their completion does not substitute for independent SDD verification.

- [ ] V1.RED → GREEN: Add/finalize clean-output package inspection/smoke fixtures for removed extension/source/native/SDK/entrypoint/IPC/service/config/UI/URL/CLI fields and actual product composition. Build packaged Linux desktop and retained server/REH with no Copilot shim/runtime-copy or telemetry artifact streams; resolve only in-scope failures and record exact commands/exit codes. Inspect final extension manifests/bundles/native trees/locks and absent Agent Host/crashReporter startup; do not use stale `.build/extensions`/`out` as proof. <!-- sdd-owner: implementation -->
- [ ] V1.TRIANGULATE: Launch isolated fresh and copied persisted profiles; exercise commands/settings/menu/title controls/old URLs/agent-window restore/API attempts with absence guarantees. Verify local profiles/settings/installed extensions/unrelated secrets/repo/key/helper sentinels, ordinary errors/log/output/Search and established account-free toolchain/onboarding/personalization. Old full-reporting/argv settings must produce no telemetry network/log or sender output. <!-- sdd-owner: implementation -->
- [ ] V2.TRIANGULATE: In packaged Linux, execute the Open VSX anonymous lifecycle/dependencies/VSIX and suitable Open-VSX-listed C# acquisition, recording its registry ID/version/license and expected C# Dev Kit/Copilot provider gap without failing acceptance for those unavailable extensions. Exercise controlled plain-Git clone/fetch/pull/push/history/branches using SSH keys and an OS helper where available, including self-hosted-style endpoints and github.com URL behavior without OAuth. Exercise SSH remote files/terminal/extension host/non-account forwarding when infrastructure exists; record actual unavailable-environment/Open VSX access failures rather than asserting passes from mocks or switching providers. <!-- sdd-owner: implementation -->
- [ ] V2.REFACTOR: Run mandatory macOS/Windows argument/platform/native-filter fixtures and available native package/startup/Git/SSH smokes; record results/gaps in `openspec/changes/product-debloat/implementation-evidence.md` and compare final source/package/telemetry/compatibility ledgers with all spec scenarios. Remove only owned throwaway test artifacts/processes, retain user data, report broader welcome follow-ups, and rerun impacted focused tests after any in-scope fix. <!-- sdd-owner: implementation -->

## Verification — V

Required command families: focused `./scripts/test.sh --run <file>`; `npm run typecheck-client`; retained extension tests/builds (`npm run gulp compile-extensions` or smaller appropriate tasks and the documented integration `--suite` selectors); `npm run typecheck --prefix build` plus focused Node build tests; changed CLI Cargo checks/tests; inspected normal Linux recipe `npm run build-fast` and `npm run gulp vscode-linux-x64`, plus the discovered retained REH package target. Inspect existing diagnostics/prerequisites first and avoid duplicate compile/watch processes. Verify Linux recipe **finishes without the removed Copilot shim fixup**; package-stage output followed by failure is not success.

## Implementation reporting contract

After each leaf, report chain unit/family/leaf IDs, narrow changed paths, measured additions + deletions (and binary file/byte changes), expected/actual source/package deletions, focused tests/compile results, remaining inbound references and ledger status. A family completes only when all its source/package/test/payload entries close. Return unknown paths, unresolvable safe-split obstacles, genuinely new vendor remediation choices and unavailable native/Open VSX environments to the parent; the Open VSX/feature-branch-chain choices are resolved and size exceptions declined. Preserve the approved chain and Git carve-out. Never infer extra consent, create broad secret/data cleanup, commit, or claim final compliance at telemetry cutoff.
