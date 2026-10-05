# Removal Inventory — Product Debloat

## Inventory contract and measured baseline

This is the U00 ownership/index artifact for `product-debloat`. It separates reachable/disconnection work from physical deletion and leaves final closure to the owning A/C/P/I/B/T stages. Names below are repository-relative. The user approved a 400 added-plus-deleted-line review budget and `feature-branch-chain`; estimates are never netted or treated as deletion exemptions.

Baseline was read from the tracked `main` tree (`git ls-files`), with `rg`/`git grep` source-reference scans across `src/vs`, `src/main.ts`, `extensions`, `build`, `cli`, and `scripts`. Counts include tracked tests/resources/manifests; generated/vendor-looking files are labeled separately when their path identifies them. Line counts are LF-delimited text lines. Binary count/bytes are recorded at the owner root; binary lines are not meaningful. Untracked `.pi/` is harness output and outside the edit scope. OpenSpec change files were untracked at entry and are not source ownership.

### Disjoint owner-root census

Each row is a distinct direct owner root; nested broad roots are not added to this table. `text lines` includes source, tests and ordinary text resources; class details are supplied where the trees have generated/vendor or binary members. These are tracked baseline sizes, **not** leaf diffs or estimates of removable changed lines.

| Owner root | Tracked files | Text lines | Source files/lines | Test files/lines | Manifest/lock files/lines | Generated/vendor or other text files/lines | Binary files |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `src/vs/workbench/contrib/authentication/` | 8 | 1,356 | 8 / 1,356 | 0 / 0 | 0 / 0 | 0 | 0 |
| `src/vs/workbench/services/authentication/` | 17 | 7,890 | 12 / 4,507 | 5 / 3,383 | 0 / 0 | 0 | 0 |
| `src/vs/workbench/contrib/userDataSync/` | 8 | 2,578 | 7 / 2,502 | 1 / 76 | 0 / 0 | 0 | 0 |
| `src/vs/workbench/services/userDataSync/` | 8 | 1,508 | 8 / 1,508 | 0 / 0 | 0 / 0 | 0 | 0 |
| `src/vs/platform/userDataSync/` | 52 | 23,739 | 33 / 11,487 | 19 / 12,252 | 0 / 0 | 0 | 0 |
| `src/vs/workbench/contrib/remoteTunnel/` | 2 | 1,155 | 1 / 931 | 1 / 224 | 0 / 0 | 0 | 0 |
| `src/vs/platform/remoteTunnel/` | 13 | 2,063 | 7 / 1,139 | 6 / 924 | 0 / 0 | 0 | 0 |
| `src/vs/workbench/contrib/editSessions/` | 9 | 2,796 | 8 / 2,469 | 1 / 327 | 0 / 0 | 0 | 0 |
| `extensions/github-authentication/` | 49 | 6,961 | 25 / 3,953 | 7 / 1,767 | 5 / 665 | 9 other-text / 288 | 3 |
| `extensions/microsoft-authentication/` | 43 | 4,797 | 27 / 3,197 | 3 / 449 | 5 / 920 | 6 other-text / 231 | 2 |
| `extensions/github/` | 44 | 3,978 | 18 / 3,041 | 2 / 97 | 4 / 781 | 0 | 1 |
| `src/vs/workbench/contrib/chat/` | 1,414 | 552,032 | 780 / 303,974 | 440 / 220,423 | 0 / 0 | 0 | 103 |
| `src/vs/sessions/` | 942 | 321,285 | 525 / 160,753 | 293 / 139,213 | 0 / 0 | 0 | 0 |
| `src/vs/platform/agentHost/` | 2,344 | 521,032 | 565 / 185,507 | 916 / 303,395 | 0 / 0 | 828 files / 13,550 lines | 0 |
| `src/vs/workbench/services/agentHost/` | 15 | 4,030 | 8 / 1,912 | 7 / 2,118 | 0 / 0 | 0 | 0 |
| `src/vs/server/node/agentHostChannel.ts` | 1 | 412 | 1 / 412 | 0 / 0 | 0 / 0 | 0 | 0 |
| `extensions/copilot/` | 4,149 | 1,359,427 | 1,720 / 421,195 | 2,279 / 594,751 | 59 / 32,598 | 79 text files / 310,883 lines | 12 |
| `src/vs/platform/telemetry/` | 30 | 4,192 | 25 / 2,489 | 5 / 1,703 | 0 / 0 | 0 | 0 |
| `src/vs/workbench/services/telemetry/` | 7 | 632 | 5 / 487 | 2 / 145 | 0 / 0 | 0 | 0 |
| `extensions/git/` (retained; reporter-owned members only) | 91 | 30,960 | 51 / 23,872 | 6 / 1,508 | 5 / 5,379 | 0 | 1 |

Authentication extension rows include `other-text` resource counts as shown; binaries are not assigned source lines.

The largest measured deletion roots already exceed the preliminary forecast before any entrypoint, API, package, lock, and callsite tails: chat 552,032 + sessions 321,285 + Agent Host 525,474 (including 13,550 generated/vendor-path lines) + Copilot 1,359,427 = **2,758,218 tracked text lines**, plus 218 binary files. This corrects the proposal's rough 600k–2M estimate upward; it is a source-tree ownership lower bound, not an exact diff or a promised PR count. Keep all file/test/binary tails reviewable in measured leaves.

### U00 leaf instantiation — inventory and fixtures

The following exact leaves are instantiated before their edits. They are disjoint by paths/seam; each targets 120–400 total added+deleted lines, with task/apply metadata counted. Future family leaf IDs remain uninstantiated until their owner scans/parent brief name exact member batches; no broad family is one leaf.

| Leaf | Exact paths/seam | Prerequisite / owned symbols | Planned changed-line range | Test/evidence selector |
| --- | --- | --- | ---: | --- |
| U00.a.001 | `openspec/changes/product-debloat/removal-inventory.md` census | Tracked ownership roots, file/line/binary split, source-vs-test status | 140–220 | Reproducible `git ls-files` census (no runtime claim) |
| U00.a.002 | `removal-inventory.md` reference graph | API, main/workbench/browser/shared/server/extension-host/CLI/build inbound owners and retained consumers | 140–240 | Source/import/registration scan, no runtime claim |
| U00.a.003 | `removal-inventory.md` packaging/provider/workload seam | D1 gallery product stream/composition, observed runtime mappings, disjoint stage estimates | 140–240 | `build/lib/test/walkerProduct.test` is a later G2 leaf, not run here |
| U00.b.001 | `telemetry-inventory.md` T1–T6 | Core/process/editor/workbench/files/terminal/language owners, calls and payloads | 140–240 | Test selector assigned per context/owner below |
| U00.b.002 | `telemetry-inventory.md` T7–T12 | Gallery/direct reporters/remote/build/removed-feature/residual owners and dependencies | 140–240 | Test selector assigned per context/owner below |
| U00.c.001 | `src/vs/workbench/api/test/common/accountFreeApi.test.ts` | Legacy auth/session/provider bridge counters; fixtures use inert IDs only | 140–260 (partial actual 147 incl. progress/manifest metadata) | `./scripts/test.sh --run vs/workbench/api/test/common/accountFreeApi.test` (blocked: compiled `out/**` selector missing) |
| U00.c.002 | `src/vs/code/electron-main/app.ts`, `src/vs/code/test/electron-main/productDebloat.test.ts`, `src/vs/platform/telemetry/test/common/nullTelemetryService.test.ts` | Test-observable main telemetry registration selection plus dependency-free no-op contract | 140–320 | One authorized focused command per core fixture |
| U00.d.001 | Git, tunnel, gallery, local-profile, onboarding/toolchain retained fixtures | Plain remotes/SSH prompts, anonymous gallery calls, local workspace/profile data, ordinary diagnostics/Search/setup | 140–320 | Focused core tests, Git integration and existing .NET pure suite |

U00 writes no feature-removal code. `app.ts` is permitted only for a test-observability seam around existing telemetry-service registration and must have zero runtime behavior change. Any additional production path or behavior edit is out of scope and requires parent approval.

### Concrete ownership anchors read for U00.a.001

| Work family | Exact owner path and symbol seam | Retained consumer/boundary |
| --- | --- | --- |
| API auth | `src/vs/workbench/api/common/extHost.api.impl.ts`: `authentication` namespace factory, `getSession`, `getAccounts`, `hasSession`, `onDidChangeSessions`, `registerAuthenticationProvider` | API public type surface and regular commands/documents/diagnostics/SCM |
| API auth bridge | `src/vs/workbench/api/common/extHostAuthentication.ts`: provider map, `_proxy` ensure/session/account/register paths, dynamic/XAA methods; `browser/mainThreadAuthentication.ts`; `node/extHostAuthentication.ts` | Generic extension-host RPC, ordinary secret/URL/request APIs |
| Auth services | `src/vs/workbench/{contrib/authentication,browser/parts/globalCompositeBar.ts,browser/parts/titlebar/{titlebarPart,titlebarActions}.ts,services/authentication/}` | Non-account global/title controls, local profile UI |
| Auth packages | `extensions/{github-authentication,microsoft-authentication}/` and `build/npm/dirs.ts` discovery | OS Git credential helpers, SSH/passphrase, plain HTTPS/proxy |
| Sync | `src/vs/workbench/{contrib/userDataSync,services/userDataSync}/`, `src/vs/platform/userDataSync/`, startup registrations in desktop/web/common main | `src/vs/platform/userDataProfile/`, local settings/import/export, extension policy |
| Remote tunnels | `src/vs/workbench/contrib/remoteTunnel/`, `src/vs/platform/remoteTunnel/`, `product.json` tunnel identity, CLI commands | `src/vs/platform/tunnel/`, generic server/Ports/SSH forwarding |
| Cloud edit sessions | `src/vs/workbench/contrib/editSessions/`, cloud services, command/destination/extension-point links | Local workspace reopen/restore and ordinary files |
| GitHub integration | `extensions/github/`: `src/extension.ts`, `src/auth.ts`, `src/publish.ts`, `src/branchProtection.ts`, `src/pushErrorHandler.ts`; package/build/proposal/menu refs | `extensions/git/`, `extensions/git-base/`, arbitrary Git remote hosts |
| Anonymous gallery | `src/vs/workbench/services/extensionManagement/{common/extensionGalleryAccount.ts,electron-browser/extensionGalleryAccountService.ts}` and extension view/widgets | Manifest IPC, metadata, query/download/install/update/VSIX |
| Chat API | `api/browser/mainThreadChat*`, `mainThreadLanguageModels.ts`, `mainThreadLanguageModelTools.ts`, `common/extHostChat*`, `extHostTypeConverters.ts`, `common/extHost.api.impl.ts` | Non-chat API types, ordinary extension activation |
| Chat UI/core | `src/vs/workbench/contrib/chat/`, `src/vs/workbench/services/chat/`, `workbench.{common,desktop,web}.main.ts` contribution imports | Search, editing, notebooks, terminal, SCM, debug |
| Agents Window | `src/vs/sessions/`, `build/next/index.ts`, desktop/web entrypoints, exclusive HTML/style/assets | Ordinary workbench windows and startup |
| Agent Host | `src/vs/platform/agentHost/`, `src/vs/workbench/services/agentHost/`, `src/vs/server/node/agentHostChannel.ts`, `src/vs/code/electron-main/app.ts` starter/manager/session-link startup | Generic remote extension host/server/IPC/SSH |
| Copilot | `extensions/copilot/`, `build/lib/copilot.ts`, desktop/REH gulp shim calls, package/sdk/version/discovery/native paths | Ordinary ripgrep/Search, generic build/native utilities |
| Main telemetry | `src/vs/code/electron-main/app.ts`: telemetry registration, appender, common properties, error/proxy/OS/metered event methods | Main-process normal logs/errors and network/request behavior |
| Other telemetry processes | `src/vs/workbench/services/telemetry/{browser,electron-browser}/`, `src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts`, `src/vs/server/node/serverServices.ts` | Browser/shared/remote services and ordinary diagnostics |
| Early crash | `src/main.ts`, argv/schema/environment/server/extension-host runner plumbing, `scripts/test.sh`, integration runners | Ordinary error reporting to logs and test selectors |
| Extension telemetry | `extensions/{git,typescript-language-features,html-language-features,json-language-features,markdown-language-features,merge-conflict,media-preview,simple-browser}` reporter constructors/manifests/locks | Owning Git/language/preview behavior without reporting |
| Gallery privacy | `src/vs/platform/externalServices/common/marketplace.ts`: `resolveMarketplaceHeaders`; `extensionGalleryService.ts`: `reportStatistic` | Functional product/version/User-Agent headers and gallery operations |
| Build/product gallery | `build/gulpfile.vscode.ts` and `build/gulpfile.reh.ts` `productJsonStream` → `productJsonContents` → `productJsonFn`; Walker root product remains unchanged | Desktop and server bootstrap product parity |

This anchor map identifies concrete owner symbols and protected consumers; it does not pretend every callsite in the large trees has been manually deleted or semantically dispositioned. Later family owners expand each anchor into exact source/member/test/package leaf manifests before edits.

### Baseline scope exclusions and ownership cautions

* `src/vs/workbench/api/` has 334 tracked files and 110,797 lines, but is **not** a deletion root. Only the identified auth/chat/telemetry bridges and dead test/converter owners are candidates; public shapes are preserved only where their specs require inert compatibility.
* `src/vs/code/` includes 27 files / 7,176 lines, and `src/vs/server/` 30 / 7,005 lines. Their counts are broad and not owned wholesale; `app.ts`, `serverServices.ts`, startup and channel members need function-level splitting.
* `src/vs/platform/telemetry/` has 30 files / 4,192 lines and five tracked test files; no-op boundary vs appender/service deletion are different I/T leaf classes.
* `extensions/git/` has 91 tracked files / 30,960 lines (including 6 tests and 5 manifests/locks); only reporter and payload members belong to B1/T9. The complete extension is retained.
* Direct reporter package owners include retained extensions with existing test/build surfaces. Deleted GitHub/auth/Copilot reporter lines are credited to A/C/T10, not double-counted under B.
* Main/workbench entrypoint modifications are disconnections and precede source-tree deletions. Current tree file counts measure eventual physical deletion only when the owning spec calls for whole-tree removal.
* Test deletion, generated/vendor text, extension package metadata, lockfiles, static resources, and binary payloads all count toward future leaf review budgets. No generated or binary path is treated as free.
* The census is reproducible with tracked `git ls-files` plus per-file text/binary classification; untracked output is not ownership evidence. Future lock/regeneration diffs require fresh counts because tracked baselines do not predict package-manager churn.
* Legacy state handling is read-ignore. No inventory entry authorizes migration, sign-out, remote revocation, credential inspection, or cleanup of profile, repository, SSH, secret, or agent-state data.
* The public account facade may remain tiny and inert only as designed. Provider/session/RPC implementations and dynamic/MCP OAuth paths are not a retained compatibility boundary.
* Gallery manifest IPC and anonymous extension acquisition remain protected; account service, review actions, machine correlation and statistics calls are separate owners.
* Copilot module contains the feature-neutral `getRipgrepExcludeFilter` consumer in both desktop and REH graphs; P1 extraction must precede module deletion.
* The tracked source census is deliberately non-netted: a later deletion of 200 lines and an addition of 40 test lines costs 240 review lines, not 160.

### Explicit non-tree references for later ownership splits

| Reference owner | Concrete path/member family | Treatment and prerequisite |
| --- | --- | --- |
| Product auth/chat | `product.json`: `defaultChatAgent`, Copilot IDs/URLs/commands and account/tunnel fields | C1/A7 disconnect, do not modify in U00 |
| Workbench bootstrap | `src/vs/workbench/{workbench.common.main.ts,workbench.desktop.main.ts,workbench.web.main.ts}` | Disconnect contributors before deleting their owner trees |
| Desktop process | `src/vs/code/electron-main/app.ts`: `ElectronAgentHostStarter`, `AgentHostProcessManager`, session-link open, telemetry construction/events | Agent Host disconnect in C6; telemetry registration seam only in U00 |
| Browser/server process | `src/vs/server/node/serverServices.ts`, `src/vs/server/node/agentHostChannel.ts`, `webClientServer.ts` | Separate generic remote/gallery service from agent-only channel |
| API registrations | `src/vs/workbench/api/common/extHost.protocol.ts`, API factories, `browser/mainThreadAuthentication.ts`, chat/model bridges | Remove consumers before protocol shapes; preserve ordinary RPC |
| Product schema | `src/vs/base/common/product.ts`, `src/vs/platform/product/common/productService.ts`, product JSON schema | Product fields are owned by account/chat/tunnel/gallery leaf; no schema cleanup in U00 |
| Build discovery | `build/npm/dirs.ts`, `build/lib/extensions.ts`, `build/next/index.ts`, gulp desktop/REH product/runtime paths | Update after disconnect tests; retained Search/REH paths are positive owners |
| Release/package metadata | root/remote/extension package manifests and lockfiles; `build/darwin/verify-macho.ts`; `build/.moduleignore` | Disjoint per package graph; dependency closure follows consumer deletion |
| CLI graph | `cli/src/auth.rs`, `cli/src/commands/tunnels.rs`, tunnel modules and CLI package manifests | Split account commands from local forwarding/server/stdio |
| Test graph | `src/vs/workbench/api/test/{common,browser}/`, code/electron-main, extension tests, runner selectors | Delete only tests for disconnected implementations; replace boundary assertions |
| Crash runner tails | `scripts/test.sh`, `scripts/test-integration.sh`, platform runner analogues | M1 inventories only; runner changes are a future I7 leaf |
| Toolchain suppression | `extensions/dotnet-toolchain/src/probe.ts`, `src/test/{probe,processRunner}.test.ts` | Retain `DOTNET_CLI_TELEMETRY_OPTOUT=1`, never classify it as Walker telemetry |

Each current source-only U00 test leaf is bounded separately below; no production deletion is assigned. Future consumers discovered during A/C/P/I/T scans must be appended under their exact owner path before deleting the corresponding provider or package. A broad grep match is a candidate, not proof of ownership; imports, DI, activation, serialized product fields, menus/URLs, package edges, and test use are classified independently. The tracked census preserves rather than edits all baseline source.

Every count is tied to a path, so later file/member deletions can be reconciled without subtracting unrelated siblings. Product and API compatibility boundaries remain owners, not free cleanups.

Binary and resource counts remain explicit and test data remains synthetic.

## U00.a.002 — inbound reference/dependency graph

### Search scope and candidate counts

Whole-source-tree scans were run over `src/vs`, `src/main.ts`, `extensions`, `build`, `cli`, and `scripts`, restricted to tracked-code formats (TS/JS/JSON/HTML/CSS/SCSS/shell/Rust/YAML). Each number is the count of distinct matching files for the listed owner terms; categories overlap and counts are not additive. These are reproducible candidate sets that must be resolved semantically by their leaf owners, not a claim that every text match is an active reference.

| Candidate family | Search terms | Files | Current edge classes reviewed |
| --- | --- | ---: | --- |
| Authentication | `Authentication`, `authentication`, `IAuthentication`, `authSession`, `authIssuers`, `defaultAccount` | 744 | API factory/service/RPC, provider registration, OAuth/dynamic/MCP, account UI and tests |
| Sync | `userDataSync`, `UserDataSync`, `sync.enable`, `Settings Sync` | 120 | desktop/web startup, profile helpers, commands/settings, service and tests |
| Tunnels | `remoteTunnel`, `RemoteTunnel`, `tunnel-forwarding`, `forward-internal` | 49 | contribution/CLI/product/account provider, separate generic tunnel and Ports uses |
| Edit sessions | `editSessions`, `EditSessions`, `Continue Working On`, `continueOn` | 69 | command/destination registration, service/storage, direct links and tests |
| GitHub | extension IDs, publisher, Octokit, provider/publish terms | 45 | bundled GitHub integration and links; retained generic Git remote parser is separate |
| Chat/API | chat contribution, agent/model bridge and default-agent terms | 1,064 | entrypoint imports, protocol/API factory, retained feature integrations, tests |
| Agents Window/Host | `vs/sessions`, `agentHost`, `AgentHost`, session links | 1,353 | desktop/web restore, main starter/manager, server channel, CLI and test/build roots |
| Copilot | extension ID, SDK, runtime/shim and Copilot terms | 1,330 | extension discovery, package/runtime/native/build producers, feature-only calls |
| Telemetry | service/report methods, appender, telemetry setting | 963 | process DI, callsites, extension hosts, tests, retained extension and build paths |

The scoped symbol search confirms this is not a client-only graph. Search counts do not decide ownership: e.g. generic `authentication` in SSH/security and platform Git credential handling is retained; ordinary Git, local profiles, gallery manifests, server and terminal APIs do not become feature-owned by keyword.

### Process and API edges

| Context / edge | Registration or inbound owner | Downstream / retained consumer | Ordering |
| --- | --- | --- | --- |
| Desktop main | `src/vs/code/electron-main/app.ts`: `CodeApplication` service collection, `ITelemetryService` registration, `ElectronAgentHostStarter` and `AgentHostProcessManager` | Main diagnostics, Windows/remote startup, generic IPC and tunnel/server | U00 may expose only telemetry registration observation; C6/I1 own later disconnections |
| Desktop workbench | `src/vs/workbench/workbench.common.main.ts`, `workbench.desktop.main.ts`, contribution registries | API activation, local editor, Search, Git, terminal, profiles | Disconnect each feature registration before its tree deletion |
| Browser workbench | `src/vs/workbench/workbench.web.main.ts`, browser telemetry and extension-host services | Browser extension host, Search, gallery manifest and ordinary browser APIs | I3/C1 are independent bounded owners |
| Extension API | `src/vs/workbench/api/common/extHost.api.impl.ts`, `extHost.protocol.ts`; auth browser main-thread and Node bridge | public extension authentication, chat/model bridge and ordinary API factory | A1 makes API facade inert first; A2/C2 remove active RPC after consumers disconnect |
| Shared process | `src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts`, telemetry appender/custom endpoint channels | shared extension management and logging | I4 retains ordinary shared services |
| Server/REH | `src/vs/server/node/serverServices.ts`, `agentHostChannel.ts`, `webClientServer.ts` | remote extension host, gallery manifest/resource template, generic server | C6 removes agent-only channel; I5 retains gallery and generic remote channels |
| Built-in extension host | `extensions/*/package.json`, activation contributions, extension source/tests and package locks | `extensions/git`, `git-base`, language/markdown/browser features | A4/A8/C7 disconnect and delete their extensions; B1–B8 retain owning feature tests |
| CLI | `cli/src/auth.rs`, tunnel commands/modules, local forwarding and server commands | generic server/serve-web/version/download/stdio | U03 tasks split account command symbols from retained transport before removal |
| Desktop packaging | `build/gulpfile.vscode.ts`, `build/lib/extensions.ts`, `build/npm/dirs.ts`, root manifest/locks | retained extension discovery, resource packaging and Search | P1 neutral helper before P2/P3/C7 tails |
| REH packaging | `build/gulpfile.reh.ts`, bootstrap inline product; server product distribution | remote workbench and extension host | Same effective gallery mixin must reach JSON stream and embedded bootstrap |
| Test runners | `scripts/test.sh`, `scripts/test-integration.sh`, extension runner manifests | selectors and process harness | remove crash/auth/Copilot/agent selectors only with owning I7/A4/C7 leaf |

### Prerequisite graph and retained classification

| Stage/leaf family | Depends on | May disconnect/delete | Explicitly retained |
| --- | --- | --- | --- |
| U00 M0/M1 | approved proposal/spec/design and assigned paths | inventories and baseline/protected fixtures only | All production behavior, user data and external endpoints |
| U01 A1/A3/A4/A8/G1/G2 | U00 red/positive fixtures | passive auth facade, account UI/providers/GitHub integration/gallery account UI and packaged gallery config, each separate | Git/git-base, OS helpers, anonymous gallery, local state |
| U02 A5/A6 | U01 API facade | Sync/cloud edit-session source/registrations by ownership | local profile/settings, local restore |
| U03 A7 | U02, U00 generic tunnel tests | Remote Tunnels/cloud forwarding/account CLI | generic platform tunnel, SSH, remote server/Ports |
| U04 A6 continuation | U01/U02/U03 | Continue On and cloud edit-session leaves | workspace restoration and local files |
| U05 C1–C4/A2 | U01–U04 | product/entrypoint/API bridges, retained feature integration, chat tree and final auth graph | ordinary APIs/features; no shadow framework |
| U06 C5 | U05 and prep leaves | sessions source/assets/entrypoint/build registrations | ordinary workbench/windows |
| U07 C6 | U03/U05/U06 and prep leaves | Agent Host process/channel/platform/workbench source | generic server, SSH, remote extension host |
| U08 P1 | U07 | neutral ripgrep extraction only | ordinary Search/resource filters |
| U09 C7/P2/P3 | U05–U08 consumer disconnection | Copilot/agent-owned extension, shim/native/package/build dependencies | generic native/build/REH/Search functions |
| U10 I1–I7/I.ALL/B1–B8 | U00 context counters, U09 ownership | all report-capable registrations, crash path, direct reporters | ordinary diagnostics, requests, Git/language/browser features |
| U11 T1–T12 | accepted U10 cutoff | all remaining calls, payload-only work, DI, tests and exclusive packages | feature-specific functionality and documented no-op API only |
| U12 V1/V2 | all owning implementation families | boundary/package regression fixes/evidence | every universal retained boundary |

The M0 root manifest classifies current imports/re-exports/protocol registrations as **disconnect first**, source/package/test members as **physical delete only after no-inbound evidence**, and independent local/Git/remote/diagnostic behavior as **retain**. Member-level path slices for giant source trees (chat, sessions, Agent Host, Copilot) are not safe as whole-tree review units and must be enumerated/re-measured by their U05–U09 owner before each deletion leaf.

### Leaf sizing result at U00.a.002

For assigned U00, the inventory graph is an independent documentation seam and the protected fixtures are independent test seams; no feature source deletion is mixed into either. At a 400-line ceiling, a huge family cannot be one leaf: the complete measured source/test tree totals alone imply at least 6,896 400-line chunks at the impossible assumption that every line is deleted and no tests/metadata are added (2,758,218 ÷ 400, rounded up). This is a scale lower bound, not a committed PR count; real coherent source/member/test/metadata seams increase it. No size exception is approved. U00 leaves a.001–a.003, b.001–b.002, c.001–c.002 and d.001 use distinct paths and remain within the bounded 120–400 target; future family leaf numbers are reserved for exact parent/owner manifests, not inferred from this aggregate.

### Exact cross-file ownership edges inspected

| Owner symbol | Exact inbound/registration site | Dependency/order consequence | Retained comparator |
| --- | --- | --- | --- |
| `ExtHostAuthentication` | `api/common/extHost.api.impl.ts` service accessor and auth namespace | API calls cross service to RPC; A1 must bypass it before A2 deletes it | ordinary API factory + commands |
| `MainThreadAuthenticationShape` | `api/common/extHost.protocol.ts` + browser main thread named customer | Remove shape/actor only after all internal auth consumers disconnect | unrelated extension-host RPC shapes |
| dynamic auth provider | `api/common/extHostAuthentication.ts` dynamic auth provider registration/token routes | A2 waits on MCP/chat/account consumer map | generic fetch/proxy/URL remain |
| GitHub provider | `extensions/github-authentication/` activation and `extensions/github/` credential manager | A4/A8 separate from Git extension code | Git askpass and arbitrary `origin` URLs |
| account composite view | `workbench/browser/parts/globalCompositeBar.ts` actions and view registration | A3 removes account-only branch in one UI leaf at a time | unrelated global activities |
| title account control | `workbench/browser/parts/titlebar/titlebarPart.ts`, `titlebarActions.ts` | A3 retains other title controls and layout | ordinary menus/title actions |
| Sync startup | common/desktop/web workbench main imports + service registrations | A5 disconnects startup before userDataSync tree batches | profiles/settings/local import/export |
| profile shared helper | `platform/userDataSync/` imports from `platform/userDataProfile/` and extension management | classify/extract per helper before deleting platform tree | local profile storage and ignored extension policy |
| tunnel product | root product JSON tunnel identity plus CLI/package fields | A7 removes application/launch/mutex; no platform/tunnel blanket deletion | non-account forwarding/SSH/server |
| cloud forwarder | `extensions/tunnel-forwarding` provider registration calls auth/session then `forward-internal` | A7 disconnects provider before deleting account CLI endpoint | local-forwarding and generic ports |
| edit-session command | `workbench/contrib/editSessions` contribution / destination handlers | A6 removes links and remote state reader, not workspace restore | local workspace restore |
| GitHub publishing | extension commands/menu/publisher and Octokit paths | A8 whole GitHub integration deletion after discovery unlink | `extensions/git`/`git-base` whole |
| Gallery account | account service DI, view content, rating widget | G1 account branch deletion leaves metadata and gallery query | manifest IPC and install lifecycle |
| Gallery anonymous config | root `product.json` lacks endpoint; root product hygiene rejects it | G2 uses packaging mixin, not root JSON or dev override | Walker identity and root hygiene |
| Chat product flag | `product.json.defaultChatAgent`, `workbench main` registrations | C1 disconnect before C4 source deletion | editor/Search/terminal startup |
| Chat API bridge | main-thread/ext-host model/chat modules and converters | C2 removes protocol and converter callers first | regular public API shape if required |
| retained chat integrations | notebook/editor/terminal/SCM/debug/onboarding imports | C3 removes only chat-owned constructor/action blocks | each owning feature behavior |
| Sessions entrypoint | `build/next/index.ts`, desktop/web session window registrations | C5 removes entrypoints before `src/vs/sessions` batches | ordinary workbench window startup |
| Agent Host startup | `app.ts` starter/manager + main/window link parsing | C6 removes process construction and channel before provider source | remote extension host/server |
| Agent Host channel | `server/node/agentHostChannel.ts` and platform channel registration | no agent-only IPC; keep generic connection channels | SSH/remote/Ports |
| Copilot discovery | `build/npm/dirs.ts`, extension list and product references | disconnect registration/runtime packaging before extension tree | retained extension discovery |
| Copilot SDK shim | `build/lib/copilot.ts` imported by desktop and REH gulp | P1 extracts only Search ripgrep helper before P2 deletes file | generic ripgrep and native package code |
| Telemetry main service | `app.ts` conditional appender descriptor and `ErrorTelemetry` constructor | I1 binds no-op before later T1 payload pruning | ordinary errors/logging |
| Telemetry renderer | browser/electron-browser service registrations | I2/I3 remove service/reporting channel separately | normal workbench DI |
| Telemetry shared process | `sharedProcessMain.ts` appender and endpoint channel | I4 deletes channels/flush after no-op registration | shared extension management/loggers |
| Telemetry server | `serverServices.ts`, server/remote telemetry channels | I5 retains gallery and remote protocol channels | generic server and remote API |
| Extension-host telemetry | `api/common/extHostTelemetry.ts` and init/RPC | I6 keeps only disabled public API as designed | ordinary output/error API |
| Crash reporter | `src/main.ts` plus app/argv/test runner flags | I7 startup/runner split; no crashReporter | ordinary uncaught error handling |
| Marketplace identity | `externalServices/common/marketplace.ts` service machine ID and telemetry gating | T7 strips correlation; real anonymous provider check remains later | functional product/version/User-Agent |
| Gallery statistics | `extensionGalleryService.ts:reportStatistic` + UI callers | T7 disables report-only POST but retains downloads and metadata | anonymous query/details/install |
| Git reporter | `extensions/git/src/{main,repository,model,commands,cloneManager}.ts` | B1 removes reporter/payload with feature tests | Git operations/helper auth |
| retained language reporters | typescript/html/json/markdown source/reporters and manifests | B2–B5 independent owners, don't aggregate locks | diagnostics/language services |
| retained small reporters | merge-conflict/media-preview/simple-browser package/source | B6–B8 independent owners and functional tests | conflicts/previews/browser views |
| .NET environment opt-out | toolchain `probe.ts`, `processRunner.ts` and pure tests | never prune; record non-Walker reporter | managed SDK suppression behavior |

### Verification ownership and unresolved edges

| Boundary | Existing focused fixture or selector | U00 treatment |
| --- | --- | --- |
| API auth bridge | new `vs/workbench/api/test/common/accountFreeApi.test` | add isolated counters; expected baseline violation |
| Main reporter registration | new `vs/code/test/electron-main/productDebloat.test` | observe descriptor selection, never instantiate reporter |
| Null service | new `vs/platform/telemetry/test/common/nullTelemetryService.test` | prove no-op methods remain side-effect free |
| Git remotes/helpers | `extensions/git/src/test/{git,askpassManager,cloneManager}.test.ts` | add synthetic host/credential-path fixture |
| Generic tunnel | `vs/platform/tunnel/test/common/tunnel.test` | add localhost/port boundary case |
| Anonymous gallery | `vs/platform/extensionManagement/test/common/extensionGalleryService.test` | assert functional request without credentials |
| Local profiles/workspace | `vs/platform/userDataProfile/test/common/userDataProfileService.test` | retain profile and workspace association sentinel |
| Onboarding/toolchain | onboarding types + `extensions/dotnet-toolchain` pure tests | existing account-free steps and opt-out are protected |
| Ordinary API/diagnostics | `vs/workbench/api/test/common/extensionHostMain.test` and `extHostExtensionActivator.test` | retained error/activation behavior; no auth credentials |
| Search | existing workbench Search/ripgrep owners and P1 platform fixture to be created later | no U00 production Search changes |

An unresolved edge is not silently reclassified: missing `extensionsGallery` at root does not imply anonymous provider readiness; account-gated enterprise config must remain unavailable, not fall back. The Open VSX access check and actual package verification are G2/U12, not U00's mocked positive fixture. Likewise Git URL parsing and askpass tests do not certify a live hosted permission or touch real repositories.

Future per-leaf inventories must add *new* inbound consumers discovered by graph checks at the owning stage, preserve the reviewer path boundary, and re-count before deletion. Every generated/lock/metadata/test update is attributed once to its source or package owner, with A/C removals credited once to T10 rather than again under telemetry B/T.

### Oversized shared-file and package boundaries

Current tracked source sizes make whole-file/member edits inappropriate. These files are owner maps, not permission to delete the file wholesale:

| Tracked file | Baseline lines | Owned member groups | Unowned/retained member groups |
| --- | ---: | --- | --- |
| `src/vs/code/electron-main/app.ts` | 1,949 | telemetry construction/events; Agent Host startup/session-link path | all unrelated desktop services, diagnostics and OS integration |
| `src/vs/workbench/api/common/extHost.api.impl.ts` | 2,340 | auth namespace; chat/language-model facade registration | public API factory, commands/documents/diagnostics/SCM |
| `src/vs/workbench/api/common/extHostAuthentication.ts` | 1,063 | provider/session bridge, dynamic OAuth, challenge/XAA/token logic | only future minimal API facade is eligible to survive |
| `src/vs/workbench/api/common/extHost.protocol.ts` | 4,218 | auth/chat/model RPC shapes/context symbols | every unrelated extension-host protocol shape |
| `src/vs/workbench/workbench.common.main.ts` | 485 | chat/auth/sync contribution imports | general editor/workbench services and contributions |
| `src/vs/workbench/workbench.desktop.main.ts` | 216 | desktop account/chat/agent/sync registration | ordinary desktop startup and remote extension host |
| `src/vs/workbench/workbench.web.main.ts` | 192 | browser account/chat/agent/sync/telemetry registration | ordinary browser workbench startup |
| `src/main.ts` | 772 | crashReporter path and related CLI/schema handling | ordinary uncaught errors, logging and app setup |
| `build/gulpfile.vscode.ts` | 660 | gallery mixin insertion; Copilot shim/runtime/product fields; telemetry streams | identity/stamps, general package assembly, Search resources |
| `build/gulpfile.reh.ts` | 577 | gallery mixin insertion; Copilot shim/runtime/telemetry streams | generic server package assembly and inline product |
| `build/lib/copilot.ts` | 460 | P1 `getRipgrepExcludeFilter` only, then Copilot members | Search helper until independent extraction; no copied SDK code |
| `build/lib/extensions.ts` | 691 | Copilot/bundled provider discovery registrations | ordinary extension packaging and retained extension lists |
| `build/next/index.ts` | 888 | Sessions desktop/web entries and agent-owned build conditions | regular desktop/browser build graph |
| `src/vs/server/node/serverServices.ts` | 538 | Agent Host + server telemetry registration/channels | remote extension host, gallery and generic server services |
| `extensions/git/src/repository.ts` | 3,551 | telemetry reporter/payload constructor and call members only | entire Git repository model/commands/credentials |
| `extensions/git/src/commands.ts` | 5,780 | telemetry-only reporting/payload members only | ordinary Git commands, clone/fetch/push/history |
| `extensions/git/src/model.ts` | 1,225 | telemetry-only model fields/calls | repository discovery, state, refs and credentials |

A large file may be split by independent function/member blocks only while each intermediate state compiles and its retained fixture passes. If no such <=400-line seam is safe, stop that owner leaf and return the exact obstacle; this census does not authorize an exception or compression.

### Retained classification by data and side effect

| State or action | Removal behavior | Preserved data/action |
| --- | --- | --- |
| Old auth/account/session values | no consumer, no callback or provider startup | unrelated secret storage untouched |
| Old Sync enablement/cloud records | no service startup or read/refresh | local settings and local profile files unchanged |
| Old tunnel enrollment | no login/token refresh/cloud forwarding | generic server and local port forwarding |
| Old edit-session state | no cloud continuation or upload | local workspace restore and repositories |
| Old chat/agent/window state | no process, IPC registration or restored agent window | ordinary workbench and generic extension host |
| Old telemetry settings/argv values | no reporter, appender, sender, output channel or crashReporter | ordinary errors/logs and test selector behavior |
| Gallery private/account state | ordinary unavailable/denied result, no sign-in/fallback | anonymous Open VSX, metadata and local VSIX |
| Git remote hostnames | no provider or hostname gating | HTTPS/SSH/plain Git at any remote host |
| SSH credentials and host prompt | no account menu dependency | OS key/agent, askpass, passphrases and host confirmation |
| Toolchain child process | retain explicit external-runtime telemetry suppression | `DOTNET_CLI_TELEMETRY_OPTOUT=1` and other owned env policy |

No actual repositories, credentials, account secrets, local profile directories, Git remotes or network endpoints were read by the census. Test state remains synthetic and no fixture may embed a real token or home-directory artifact.

The generic code string `Authentication` has non-account owners (SSH/server request/security-token transport and Git credential APIs); it is not an automatic deletion glob. `Tunnel` likewise has account cloud providers and unrelated `platform/tunnel`, Ports and SSH helpers; owner manifests preserve that split. `Telemetry` in toolchain environment variables is a suppression control, not a Walker reporter. `Gallery` manifests and request headers carry functional extension data, while machine correlation/statistics are separate telemetry owners.

## U00.a.003 — product composition and workload remeasurement

### Current product/gallery path (read-only in U00)

| Path / symbol | Observed behavior | Ownership implication |
| --- | --- | --- |
| Root `product.json` | Walker identity fields are present; no `extensionsGallery`; `defaultChatAgent` and account/agent/tunnel fields are current | Keep root product and hygiene unchanged during U00 |
| `build/hygiene.ts:95` | Explicitly errors if checked-in root product contains `extensionsGallery` | The provider configuration must enter during packaging, not root product mutation |
| `build/distro/walker/gallery.json` | Path is absent in the current checkout | D1's selected Walker input is future G2 work; no implicit upstream mixin exists |
| `build/gulpfile.vscode.ts:199–229` | Desktop reads root `product.json`, mutates release metadata, then `productJsonStream` captures `productJsonContents` | Apply gallery-only composition in this stream before capture |
| `build/gulpfile.vscode.ts:457–459` | Passes `productJsonFn: () => productJsonContents` to `inlineMeta` for desktop bootstrap entries | `inlineMeta.ts:18–23,38–42` comments out product marker/replacement; callback is not consumed by this path |
| `build/gulpfile.reh.ts:328–349` | REH stream independently reads product, applies release stamps and captures `productJsonContents` | Apply the same narrow input to remote/server product |
| `build/gulpfile.reh.ts:443–446` | Passes the callback to `inlineMeta` for server/server-web bootstrap entries | Same commented product insertion; serialized REH product is not proof of embedded product parity |
| `src/vs/base/common/product.ts:147–158` | `extensionsGallery` type declares `serviceUrl`, `controlUrl`, `extensionUrlTemplate`, `resourceUrlTemplate`, `nlsBaseUrl`, access fields; no `itemUrl` member | `itemUrl` is consumed through gallery manifest config; type work is outside U00 surfaces |
| `src/vs/platform/extensionManagement/common/extensionGalleryManifestService.ts:44–80` | Manifest resource URLs derive query/latest/statistics/item/resource values from product config | `itemUrl` creates details/rating links; resource template creates extension resource URI |
| `src/vs/platform/extensionManagement/common/extensionGalleryService.ts:625–627` | Service reads runtime `controlUrl` and optional `extensionUrlTemplate` fallback, and constructs marketplace headers | `controlApiUrl` needs explicit normalization; `extensionUrlTemplate` is a separate fallback field |
| `src/vs/server/node/webClientServer.ts:174,399–402` | Server exposes/re-writes configured resource URL template for web extension resources | Keep functional resource template and HTTP rewrite; no gallery IPC deletion |
| `src/vs/platform/windows/electron-main/windowImpl.ts:945–948` | Uses configured `serviceUrl` authority for request header injection | Open VSX authority must be included by effective product without user identity |
| `src/vs/platform/externalServices/common/marketplace.ts:16–38` | User ID/session correlation is conditional on telemetry settings; functional base headers are always built | T7 removes machine correlation, not product/version/User-Agent headers |
| `extensionGalleryService.ts:1649–1676` | `reportStatistic` issues a gallery statistics POST outside ordinary download/query flow | T7 treats this as reporting, while metadata and acquisition remain ordinary function |

D1 input values and runtime mapping are frozen for the next owning G2 stage; this U00 inventory does not implement them:

| Distro input key | Exact approved value | Runtime destination / usage |
| --- | --- | --- |
| `serviceUrl` | `https://open-vsx.org/vscode/gallery` | `extensionsGallery.serviceUrl`; manifest query/latest/stat resource base |
| `itemUrl` | `https://open-vsx.org/vscode/item` | optional runtime item URL; details/read-only metadata links, rating action removed later |
| `resourceUrlTemplate` | `https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}` | `extensionsGallery.resourceUrlTemplate`; gallery manifest resource payload |
| `controlApiUrl` | `https://open-vsx.org/vscode/gallery/control` | map input name to consumed `extensionsGallery.controlUrl` (not `controlApiUrl`) |
| `extensionUrlTemplate` | no extra approved value in D1 | distinct legacy fallback consumed by extension download; leave optional absent unless G2's actual manifest/API test establishes a need |

The approved intended mechanism is Walker-only package mixin → narrow product helper → desktop/REH JSON transforms. **Observed gap:** `build/lib/inlineMeta.ts` passes package configuration but the product marker and `productJsonFn()` replacement are commented out because late product mutations are not covered. The streams can produce serialized product JSON, but this path does not establish matching embedded desktop/REH configuration. G2 must resolve or prove an alternative runtime-load path before asserting parity; `build/lib/inlineMeta.ts` and both gulpfiles are outside U00's edit surfaces and were not changed. Do not add `extensionsGallery` to root `product.json`, edit hygiene, consume `VSCODE_DEV` overrides, execute upstream mixin-quality rewriting, replace Walker identity/built-in extensions, select another provider, or add an authentication adapter. The fourth input key normalization is required because this checkout consumes `controlUrl`; a passing build mock cannot substitute for Open VSX control/search/install verification.

### Header and gallery ownership split

* Product/version/User-Agent and any required ordinary extension gallery compatibility headers are functional requests; they are not telemetry solely because a gallery request exists.
* `X-Market-User-Id` and `VSCode-SessionId` currently use telemetry/service-machine IDs and belong to T7's privacy removal.
* `reportStatistic` usage POSTs are a direct reporting edge; they do not authorize deleting query, manifest, metadata, dependency, download, update, uninstall or local VSIX operations.
* Gallery access-denied, private-account legacy settings or unavailable config have no sign-in/provider fallback; diagnostics remain ordinary user-facing failure output.
* Open VSX anonymous lifecycle and a listed C# extension are live verification after G2, not a U00 network probe; no requests or credentials were sent here.
* The known C# Dev Kit/Copilot gap is a provider gap; no alternate Marketplace choice is opened by inventory evidence.

### Disjoint workload correction

The following selected owner-root totals are disjoint for the listed implementation families; shared entrypoints/API/package tails are not counted here and future generated/lock changes may add review lines.

| Owner family | Measured tracked text-line baseline | What the count contains |
| --- | ---: | --- |
| Auth providers, auth workbench/services | 21,004 | two provider extensions, account contribution and authentication service trees |
| Sync | 27,825 | workbench contribution/services and platform Sync source/tests |
| Account tunnels | 3,218 | remoteTunnel contribution/platform source/tests; generic platform tunnel excluded |
| Cloud edit sessions | 2,796 | editSessions owner tree |
| GitHub extension | 3,978 | only `extensions/github`; `git` and `git-base` excluded |
| Chat | 552,032 | complete contribution source/tests/assets/text in tracked owner tree |
| Agents Window | 321,285 | complete `src/vs/sessions` tracked text source/tests/assets |
| Agent Host | 525,474 | platform/workbench owner trees and server channel |
| Copilot | 1,359,427 | complete extension source/tests/manifests/resources; 12 binary files separate |
| Telemetry infrastructure | 4,824 | platform/workbench telemetry trees; excludes cross-repo callsites/reporters |
| **Known disjoint owner roots** | **2,821,863** | text-line deletion baseline before entrypoint/API/build/lock/test tails |

This disjoint observed lower bound supersedes the preliminary 600,000–2,000,000 estimate. It is not a full diff forecast: it does not include every cross-tree API/registration/runner/lock/dependency/test leaf, nor new tests and per-leaf metadata; later inventories may raise it. Review lines remain additions plus deletions, so no netting or test omission applies. At the 400-line budget, the known text roots alone imply 7,055 theoretical line-budget chunks (`ceil(2,821,863/400)`), with real ownership/test seams requiring more units. This is not a fixed PR count.

### Leaf instantiation and safe-split decision

U00 exact leaves are already instantiated in this file before fixture edits. The planned estimates below include tests and metadata; after each leaf, `apply-progress.md` and this manifest record measured added+deleted totals. Every U00 edit target is within the explicit launch surfaces, and no production deletion is expected.

| Leaf | Baseline measured scope / exact seam | Planned additions+deletions | Planned ownership outcome |
| --- | --- | ---: | --- |
| U00.a.001 | tracked owner census and source/test/resource counts in this manifest | 140–220 (actual 156 so far) | Inventory only; no runtime change |
| U00.a.002 | process/API/build/test references and retained consumers | 140–240 (actual 167 incl. checkbox/progress metadata) | dependency graph; no runtime change |
| U00.a.003 | product streams, type/runtime mappings, workload correction | 120–240 (actual 136 incl. metadata) | package/product observation only; G2 not implemented |
| U00.b.001 | telemetry core/process/editor/workbench/files/terminal/language ledger | 140–240 (actual 129 incl. progress/manifest metadata) | telemetry entries with T-family owner/status/test |
| U00.b.002 | gallery/direct reporters/remote/build/deleted/residual ledger | 140–240 (actual 169 incl. checkbox/progress/manifest metadata) | telemetry entries with T-family owner/status/test |
| U00.c.001 | isolated auth API/service proxy counters and inert fixture IDs | 140–260 (partial actual 147 incl. progress/manifest metadata) | expected red source fixture written; no credential/network; harness cannot load absent compiled output |
| U00.c.002 | app registration test seam and null service fixture | 140–320 | test observability only; no runtime behavior |
| U00.d.001 | Git/tunnel/gallery/profile/onboarding positives | 140–320 | protected behavior, no production deletion |

The U00 source/test fixture boundaries have a safe <=400 seam. **No size exception or split obstacle is required for U00.** The very large chat/sessions/Agent Host/Copilot trees do not have a safe <=400 whole-tree seam; their eventual owner leaves must split by independently compilable source/member/test/resource/package ownership with exact path lists before execution. This is an explicit future decomposition requirement, not authorization to exceed budget. G2 also has a product-embedding evidence gap: investigate `build/lib/inlineMeta.ts` or a verified runtime resource-load path before wiring the quartet, without widening this U00 edit surface.

### Later gallery work-unit split (not authorized in this U00 slice)

| Proposed future leaf | Exact intended surface | Finish check and prerequisite |
| --- | --- | --- |
| U01.g2.001 | `build/distro/walker/gallery.json`, `build/lib/walkerProduct.ts`, `build/lib/test/walkerProduct.test.ts` | validate exact four input fields/controlUrl normalization, reject missing/malformed input, preserve unrelated Walker product identity and built-in lists |
| U01.g2.002 | `build/gulpfile.vscode.ts` product transform and focused product test | serialized desktop product contains the quartet while root product and normal release stamps remain unchanged |
| U01.g2.003 | `build/gulpfile.reh.ts` product transform and focused product test | serialized REH product matches desktop gallery values and retains server product fields |
| U01.g2.004 (hold) | candidate `build/lib/inlineMeta.ts` plus any necessary bootstrap marker caller | only after parent authorizes that exact surface or another existing runtime product-load path is proven; current product JSON insertion is commented out |

Do not collapse desktop, REH and product embedding into one assumed passing leaf. Each includes its own test and remains <=400 additions+deletions; if the neutral product helper and tests exceed a leaf, split helper/test from each entrypoint. Existing `inlineMeta` tests cover package markers only and do not prove product injection. No desktop/REH package or network test ran in U00.

### U00.a.003 boundary and evidence outcome

* Product values and the `controlApiUrl` → `controlUrl` runtime mapping are traced to D1; actual Open VSX functionality remains pending G2/U12.
* Desktop and REH stream composition is traced, but current `inlineMeta` product-insertion code is commented out; matching embedded configuration must not be claimed.
* `extensionUrlTemplate` is a separate optional extension download fallback from `resourceUrlTemplate`; do not conflate it with the four committed mixin values.
* Header correlation and gallery statistic POSTs are telemetry-owned T7 edges; manifest/query/download/install and required functional headers remain protected.
* The disjoint counted owner-root baseline is 2,821,863 text lines, before cross-tree tails; this is a measured lower bound, not a detailed diff estimate.
* Current U00 graph includes desktop, browser, shared, server/REH, extension host, CLI, build, tests and runner entrypoints; future member leaves need finer owner scans.
* `size:exception` is declined. There is no bounded U00 inventory/test obstacle, but whole-tree deletion remains prohibited by the review budget.
* No production deletion occurred. `app.ts` remains the sole allowed production path and is still untouched pending its test-observability leaf.
* This report does not choose to expand U00 edit surfaces to build tooling; it records the exact candidate path for parent-owned G2 planning.

Additional functional invariants from the trace:

* `serviceUrl` drives the extension query API and latest-version manifest resources.
* `itemUrl` is metadata/detail linkage, not a registration endpoint.
* `resourceUrlTemplate` has `{publisher}`, `{name}`, `{version}`, and `{path}` substitutions.
* `controlUrl` drives extension control/management queries and must not retain the input-only `controlApiUrl` name.
* `extensionsGallery` configuration is absent from root product and must remain absent there.
* `productJsonStream` JSON is the packaged serialized configuration boundary for both targets.
* `productJsonFn` is currently a callback-shaped API only; `inlineMeta` doesn't call it.
* Late Darwin universal `assetId` and Windows `target` mutations are why upstream defers product embedding.
* Product parity tests must cover bootstrap behavior, not merely callback arguments.
* Existing gallery mocks use marketplace.test values; they do not prove real Open VSX endpoint access.
* Existing machine-ID/header test is a known privacy-baseline violation, not a positive no-correlation contract.
* Existing reporter/statistic calls are inventoried for later telemetry-owned deletion.

<!-- end U00.a inventory; next: telemetry ledger U00.b.001 -->

## U01 leaf instantiation

| Leaf | Exact paths / seam | Prerequisite and owned behavior | Planned changed lines | Focused selector |
| --- | --- | --- | ---: | --- |
| U01.a.001 | `src/vs/workbench/api/common/extHost.api.impl.ts`; `src/vs/workbench/api/test/common/accountFreeApi.test.ts`; `openspec/changes/product-debloat/compatibility.md`; this inventory; `tasks.md`; `apply-progress.md` | U00 RED/protected fixtures pass. Replace only public `vscode.authentication` delegation with the shared passive-empty/unsupported facade; test Node/worker-shared behavior and record compatibility. Internal auth services/RPC remain for later A2 consumer disconnection. | 180–360 planned; **292 measured** additions + deletions including tests/artifacts | `./scripts/test.sh --run vs/workbench/api/test/common/accountFreeApi.test`; current ordinary API activation selector from U00 |
| U01.f.001 | `build/distro/walker/gallery.json`; `build/lib/walkerProduct.ts`; `build/lib/test/walkerProduct.test.ts`; `src/vs/base/common/product.ts`; this inventory; `tasks.md`; `apply-progress.md` | Approved D1 Open VSX choice and U00 product trace. Add strict four-field input validation, `controlApiUrl` → runtime `controlUrl` mapping, narrow mixin composition, and fixture checks preserving Walker product identity/built-ins/root hygiene. No package wiring or live network call in this leaf. | 180–360 planned; **138 measured** additions + deletions including tests/artifacts | From `build/`: `node --test lib/test/walkerProduct.test.ts`; `npm run typecheck --prefix build` |
| U01.g.001 | `build/lib/inlineMeta.ts`; `build/lib/test/inlineMeta.test.ts`; this inventory; `apply-progress.md` | U01.f.001 helper tests pass. Enable the existing product bootstrap marker so packaged desktop and REH entrypoints embed the same serialized effective Walker product as `product.json`; verify desktop/server/server-web targets with the build Node runner. | 120–300 planned; **103 measured** additions + deletions including tests/artifacts | From `build/`: `node --test lib/test/inlineMeta.test.ts` |
| U01.g.002 | `build/gulpfile.vscode.ts`; `build/lib/test/walkerProduct.test.ts`; this inventory; `apply-progress.md` | U01.f.001 helper and U01.g.001 embedding test pass. Apply the gallery-only composition in the desktop `productJsonStream` after release stamps but before `productJsonContents` capture; prove serialized/bootstrap gallery parity without packaging or network traffic. | 120–300 planned; **41 measured** additions + deletions including tests/artifacts | From `build/`: `node --test lib/test/walkerProduct.test.ts`; `npm run typecheck --prefix build` |
| U01.h.001 | `build/gulpfile.reh.ts`; `build/lib/test/walkerProduct.test.ts`; this inventory; `tasks.md`; `apply-progress.md` | U01.f.001 helper and U01.g.001 desktop/server target embedding tests pass. Apply the same gallery composition in the retained REH `productJsonStream` before product capture; validate server/REH gallery parity without package creation or network traffic. | 120–300 planned; **45 measured** additions + deletions including tests/artifacts | From `build/`: `node --test lib/test/walkerProduct.test.ts`; `npm run typecheck --prefix build` |
| U01.b.001 | `src/vs/workbench/browser/parts/globalCompositeBar.ts`; `src/vs/workbench/test/browser/parts/globalCompositeBar.test.ts`; this inventory; `tasks.md`; `apply-progress.md` | U00 local-profile and API boundary fixtures pass. Remove only the Accounts activity-strip action/toggle/context preference from the global composite bar; retain generic global controls and local profile functions. Add a regression proving no Accounts toggle is exposed and verify action layout remains functional. | 120–300 planned; **122 measured** additions + deletions including tests/artifacts | `./scripts/test.sh --run vs/workbench/test/browser/parts/globalCompositeBar.test` |
| U01.b.002 | `src/vs/workbench/browser/parts/globalCompositeBar.ts`; `src/vs/workbench/test/browser/parts/globalCompositeBar.test.ts`; this inventory; `tasks.md`; `apply-progress.md` | After b.001, ignore the legacy Accounts-visibility preference in the titlebar gate, remove Accounts context-menu toggles while retaining generic Manage/profile controls, and drop tests for the now-unreachable account avatar item. | 120–300 planned; **167 measured** additions + deletions including tests/artifacts | `./scripts/test.sh --run vs/workbench/test/browser/parts/globalCompositeBar.test` |
| U01.e.001 | `src/vs/workbench/services/extensionManagement/electron-browser/extensionGalleryManifestService.ts`; `src/vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test.ts`; this inventory; `tasks.md`; `apply-progress.md` | Remove private gallery auth/provider lookup and account-request branch from the workbench manifest service. Persisted private URL/provider settings remain unavailable with no fallback/network/account lookup; public default gallery stays anonymous and functional. Legacy account-specific tests are a separate cleanup leaf. | 120–300 planned; **215 measured** additions + deletions including tests/artifacts | `./scripts/test.sh --run vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test --grep 'private gallery|legacy provider|no configuredServiceUrl'` |
| U01.e.002 | `src/vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test.ts`; this inventory; `tasks.md`; `apply-progress.md` | After e.001, remove obsolete GitHub/Microsoft provider routing, sign-in/eligibility, token/tenant and custom-index tests in a measured block. Keep current anonymous private-legacy/public-default tests; defer account selection, restart, telemetry and helper cleanup to e.003. | 180–300 planned; **268 measured** additions + deletions including tests/artifacts | `./scripts/test.sh --run vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test --grep 'legacy private gallery|legacy provider|no configuredServiceUrl'` |
| U01.e.003 | `src/vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test.ts`; this inventory; `tasks.md`; `apply-progress.md` | After e.002, remove obsolete multi-account selection, token-scope/auth-failure and account-scoped catalog-change tests; preserve the anonymous private-legacy and public-default behavior cases. Leave restart and auth-telemetry residue for e.004. | 180–300 planned; **257 measured** additions + deletions including tests/artifacts | `./scripts/test.sh --run vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test --grep 'legacy private gallery|legacy provider|no configuredServiceUrl'` |
| U01.e.004 | `src/vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test.ts`; this inventory; `tasks.md`; `apply-progress.md` | Remove leftover configuration-restart/auth-verdict telemetry cases and their inert account/storage/dialog fixtures. Retain account/session lookup counters and explicit no-account/no-request/no-telemetry regression tests. | 180–300 planned; **222 measured** additions + deletions including tests/artifacts | `./scripts/test.sh --run vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test` |
| U01.e.005 | `src/vs/workbench/contrib/extensions/browser/{extensionsViewlet.ts,extensions.contribution.ts,extensionsWidgets.ts,extensionsWorkbenchService.ts}`; `src/vs/workbench/contrib/extensions/test/electron-browser/extensionGalleryAccountUi.test.ts`; this inventory; `apply-progress.md` | Remove marketplace sign-in action/access content/status badges and clickable rating/review links after e.001/e.004; delete the unused concrete extension `ratingUrl` accessor. Preserve the ordinary Marketplace/search views and read-only rating/count metadata; gallery failure reporting remains on its existing unavailable path. | 180–300 planned; **221 measured** additions + deletions including tests/artifacts | `npm run compile-client`; `./scripts/test.sh --run vs/workbench/contrib/extensions/test/electron-browser/extensionGalleryAccountUi.test`; positive selectors `extensionsViews.test` / `extensionsActions.test` |
| U01.b.003 | `src/vs/workbench/browser/parts/titlebar/{titlebarPart.ts,titlebarActions.ts}`; `src/vs/workbench/test/browser/parts/titlebar/titlebarPart.test.ts`; this inventory; `apply-progress.md` | Remove the titlebar Accounts action, titlebar routing/listener and account visibility storage check. Retain the generic Manage/global title action and other toolbar layout/actions; global Account activity service is not removed in this leaf. | 120–240 planned; **65 measured** additions + deletions including tests/artifacts | `./scripts/test.sh --run vs/workbench/test/browser/parts/titlebar/titlebarPart.test` |
| U01.b.004 | `src/vs/workbench/browser/parts/globalCompositeBar.ts`; `src/vs/workbench/test/browser/parts/globalCompositeBar.test.ts`; this inventory; `apply-progress.md` | Remove the account-specific activity-bar menu resolver (sign-out, dynamic-provider, MCP/default-account actions) and orphaned Accounts visibility preference helper/key; retain generic Manage/context toolbar behavior. The account item and provider/avatar listeners remain for subsequent leaves. | 160–240 planned; **202 measured** additions + deletions including tests/artifacts | `npm run compile-client`; `./scripts/test.sh --run vs/workbench/test/browser/parts/globalCompositeBar.test` |
| U01.b.005 | `src/vs/workbench/browser/parts/globalCompositeBar.ts`; `src/vs/workbench/test/browser/parts/globalCompositeBar.test.ts`; this inventory; `apply-progress.md` | Delete the now-unreferenced Accounts and SimpleAccount activity view-item classes, account avatar/default-account/session/provider lookup code and account icon registration. Preserve generic Global/Manage activity item and activity service contract for later consumer audit. | 280–360 planned; **329 measured** additions + deletions including tests/artifacts | `npm run compile-client`; `./scripts/test.sh --run vs/workbench/test/browser/parts/globalCompositeBar.test`; positive `titlebarPart.test` |
| U01.e.006 | `src/vs/platform/extensionManagement/common/{extensionGalleryService.ts,extensionGalleryManifestService.ts}` and `test/common/extensionGalleryService.test.ts`; `src/vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test.ts`; this inventory; `tasks.md`; `apply-progress.md` | Distinguish anonymous access denial from ordinary not-found, propagate offline failure without account retry, exercise anonymous VSIX primary/CDN fallback, and omit the account-required rating/review URI while preserving details and read-only rating metadata. | 120–240 planned; **130 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; gallery service (38) and workbench manifest (5) and account UI (5) selectors; `git diff --check` |
| U01.b.006 | `src/vs/workbench/services/activity/{common/activity.ts,browser/activityService.ts}`; `src/vs/workbench/test/common/workbenchTestServices.ts`; auth extension/MCP badge producers; `src/vs/workbench/contrib/{userDataSync/browser/userDataSync.ts,editSessions/browser/editSessions.contribution.ts}`; global bar test; this inventory; `apply-progress.md` | Remove the Accounts activity API/implementation and all four account-badge producer calls while preserving generic global activity, auth request/session logic, Sync conflicts, and cloud edit-session behavior for their later owners. RED asserts the activity service retains generic activity but lacks account badge activity. | 120–240 planned; **141 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/test/browser/parts/globalCompositeBar.test` |
| U01.b.007 | `src/vs/workbench/contrib/authentication/browser/authentication.contribution.ts`; account action modules `manageAccountsAction.ts` and `signOutOfAccountAction.ts`; `src/vs/workbench/test/browser/parts/globalCompositeBar.test.ts`; this inventory; `apply-progress.md` | Remove account-management/sign-out action implementations and their workbench UI registration; remove the authentication extension-feature table, but retain the provider code-exchange bridge and authentication-usage contribution for A4/U05 ownership. RED asserts the action modules expose no account UI implementation. | 180–360 planned; **310 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/test/browser/parts/globalCompositeBar.test --grep 'does not export basic account management actions'` |
| U01.b.008 | `src/vs/workbench/contrib/authentication/browser/actions/manageAccountPreferencesForExtensionAction.ts`; `src/vs/workbench/test/browser/parts/globalCompositeBar.test.ts`; this inventory; `apply-progress.md` | Remove only the extension account-preference picker implementation; keep generic extension-management/account API service behavior for later owners. Split action-export tests so this leaf has a specific RED/GREEN assertion. | 160–280 planned; **222 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/test/browser/parts/globalCompositeBar.test --grep 'does not export extension account preference action'` |
| U01.b.009 | `src/vs/workbench/contrib/authentication/browser/actions/manageDynamicAuthenticationProvidersAction.ts`, `manageTrustedExtensionsForAccountAction.ts`; existing per-module assertions in `src/vs/workbench/test/browser/parts/globalCompositeBar.test.ts`; this inventory; `apply-progress.md` | Remove dynamic authentication-provider management and per-account trusted-extension management actions; preserve all unrelated authentication and extension behavior. | 260–380 planned; **338 measured** additions + deletions including artifacts; focused absence assertions supplied the RED/GREEN evidence | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/test/browser/parts/globalCompositeBar.test --grep 'does not export trusted extension account action|does not export dynamic authentication provider management'` |
| U01.b.010 | `src/vs/workbench/contrib/authentication/browser/actions/manageTrustedMcpServersForAccountAction.ts`; existing per-module assertion in `src/vs/workbench/test/browser/parts/globalCompositeBar.test.ts`; this inventory; `apply-progress.md` | Remove only the per-account trusted-MCP-server action, leaving generic MCP and authentication services for their owners. | 200–300 planned; **233 measured** additions + deletions including artifacts; focused absence assertion supplied RED/GREEN evidence | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/test/browser/parts/globalCompositeBar.test --grep 'does not export trusted MCP account action'` |
| U01.e.007 | `src/vs/workbench/services/extensionManagement/electron-browser/extensionGalleryAccountService.ts`; `src/vs/workbench/contrib/extensions/test/electron-browser/extensionGalleryAccountUi.test.ts`; this inventory; `apply-progress.md` | Remove the authenticated GitHub/Microsoft account-provider implementation and contribution; preserve anonymous gallery behavior and generic extension-management downloads. The stale desktop/Sessions entrypoint imports were disconnected separately in U01.b.011. | 340–395 planned; **384 measured** additions + deletions including focused test and artifacts | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/contrib/extensions/test/electron-browser/extensionGalleryAccountUi.test --grep 'does not register authenticated marketplace account providers'` |
| U01.e.008 | `src/vs/workbench/services/extensionManagement/common/extensionGalleryAccount.ts`, `src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts`, `src/vs/platform/extensionManagement/common/extensionGalleryManifest.ts`, `src/vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test.ts`, `extensionGalleryAccountUi.test.ts`; inventory/progress | Remove the remaining account gallery-service contract and hidden auth-provider setting. Keep legacy setting data inert by testing the literal persisted key; preserve the private gallery unavailable/no-fallback result and anonymous manifest behavior. | 120–200 planned; **138 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/contrib/extensions/test/electron-browser/extensionGalleryAccountUi.test`; `./scripts/test.sh --run vs/workbench/services/extensionManagement/test/electron-browser/extensionGalleryManifestService.test` |
| U01.b.011 | `src/vs/workbench/contrib/update/browser/update.ts`, `src/vs/workbench/services/accounts/test/browser/defaultAccount.test.ts`, `src/vs/workbench/workbench.desktop.main.ts`, `src/vs/sessions/sessions.desktop.main.ts`, `build/lib/test/walkerProduct.test.ts`; tasks/progress | Remove default-account entitlement behavior from the update contribution and disconnect the inert gallery-account module from desktop/Sessions entrypoints. Preserve update IPC shape and legacy stored state; never clear user data. | 120–180 planned; **150 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; from `build/`, `node --test lib/test/walkerProduct.test.ts`; focused `defaultAccount.test.ts` update-contribution selector (2/2) |
| U01.b.012 | `src/vs/workbench/contrib/github/browser/githubLinkPresentation.contribution.ts`; `src/vs/workbench/contrib/github/test/browser/githubLinkPresentation.test.ts`; `src/vs/workbench/services/github/browser/githubService.ts`; `src/vs/workbench/services/github/test/browser/githubService.test.ts`; tasks/progress | Remove default-account/enterprise endpoint lookup and credential acquisition from the workbench GitHub link service; remove link-preview sign-in prompts; retain public `github.com` matching and explicit authentication-unavailable presentation. | 240–360 planned; **311 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; focused GitHub service and link-presentation selectors |
| U01.b.013 | `src/vs/workbench/services/assignment/common/assignmentFilters.ts`; `src/vs/workbench/services/assignment/test/common/assignmentFilters.test.ts`; tasks/progress | Remove Copilot account entitlement/token-derived assignment filter values, default-account/chat-entitlement access and account-only persisted filter keys; retain installed Copilot extension version filters. The account-backed assignments endpoint is a separate next leaf. | 200–300 planned; **235 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/services/assignment/test/common/assignmentFilters.test` |
| U01.b.014 | `src/vs/workbench/services/assignment/common/assignmentService.ts`; `src/vs/workbench/services/assignment/test/common/assignmentService.test.ts`; tasks/progress | Disconnect the default-account-derived TAS assignments endpoint, retry path and main-process request transport; preserve the ordinary TAS client, developer overrides, client disposal behavior, and bare-name legacy treatment lookup. | 250–300 planned; **256 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/services/assignment/test/common/assignmentService.test` (10/10) |
| U01.b.015 | `src/vs/workbench/services/assignment/common/assignmentFilters.ts`; `src/vs/workbench/services/assignment/test/common/assignmentFilters.test.ts`; tasks/progress | Remove the now-unused account-entitlement GitHub assignment filter provider and the assignments-only Copilot extension mapping; keep the legacy extension-version filter provider. | 190–230 planned; **211 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/services/assignment/test/common/assignmentFilters.test` (4/4) |
| U01.b.016 | `src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts`; its browser test; `src/vs/workbench/browser/actions/developerActions.ts`; `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts`; tasks/progress | Remove the account-provider match that pins extension enablement, the account refresh developer action, and Getting Started's default-account injection. Retain the independent Settings Sync auth-provider guard, general Policy Diagnostics, chat entitlement visibility and the Agents banner's generic open-window path. | 60–120 planned; **83 measured** additions + deletions including tests/artifacts | Node 24.18.0 `npm run compile-client`; `./scripts/test.sh --run vs/workbench/services/extensionManagement/test/browser/extensionEnablementService.test` (128/128); source-boundary assertions for the two account-only consumers |
| U01.b.017 | `src/vs/workbench/browser/actions/developerActions.ts`; `src/vs/workbench/services/policies/common/accountPolicyService.ts`; `src/vs/workbench/services/policies/test/browser/accountPolicyService.test.ts`; tasks/progress | Remove account/session/authentication/gate and GitHub server-managed-settings content from Developer Actions diagnostics while preserving Policy Diagnostics and native/file managed-settings output. Remove the account-gate `restrictedValue` override while retaining other account policy data and managed-settings resolution. | 260–340 planned; **262 source/test lines**, artifact-adjusted leaf measurement recorded in `apply-progress.md` | RED `accountPolicyService.test`: new no-account/no-forced-value assertion failed (1 failure, 34 pass); GREEN rerun passed 35/35. `npm run compile-client` passed. |
| U01.b.018 | `src/vs/workbench/workbench.common.main.ts`; `src/vs/workbench/{browser/web.main.ts,electron-browser/desktop.main.ts,contrib/chat/common/actions/chatContextKeys.ts}`; `src/vs/sessions/{electron-browser/sessions.main.ts,contrib/policyBlocked/browser/policyBlocked.contribution.ts}`; tasks/progress | Disconnect the active gate contribution and `IAccountPolicyGateService` service registrations, localize the chat context key to a false default, and remove account/gate/freshness dependencies from Sessions' blocked overlay. Preserve the generic AgentDisabled overlay and generic policy service. Gate-only contribution/source tests remain pending parent deletion. | 120–220 planned; **63 source lines**, artifact-adjusted leaf measurement recorded in `apply-progress.md` | Node 24 RED assertion found Sessions still depended on default-account/gate freshness; GREEN cross-tree assertions passed. `npm run compile-client` and `accountPolicyService.test` passed. |
| U01.A4/A8.001 | Parent-approved discovery/build/CI/product/consumer paths, `.vscode-test.js`, `build/vite/workbench-vite.html`, `build/rspack/workbench-rspack.html`; tasks/progress | Remove provider/GitHub extension references from approved npm/compile/native/CI/linter/test discovery surfaces; preserve `extensions/git`/`git-base`; remove generated Vite/Rspack HTML auth-trust lists. These are reference disconnections only; the provider and GitHub source trees remain present. | 120–280 planned; **160 source/config lines** before artifact updates; final leaf count recorded in `apply-progress.md` | `node --check .vscode-test.js`; importing `.vscode-test.js`; Node assertions for approved discovery/trust paths; `npm run typecheck --prefix build`; build Walker product tests 6/6. |
| U01.A4/A8.002 | `scripts/test-integration.sh`, `scripts/test-integration.bat`, `.vscode/launch.json`, `.github/skills/integration-tests/SKILL.md`, `.eslint-allowed-javascript-files`, `.eslint-allowed-bracket-notation-files`, `.vscode-test.js`; tasks/progress | Remove stale GitHub authentication suite/debug/linter entries; preserve executable `git` and `git-base` suite branches, the plain Git debug launch, and `src/vs/platform/github/common/githubTransport.ts`. The extension trees remain parent-deletion work. | 120–220 planned; **138 additions+deletions** including 90 runner/debug/lint and regression-test lines plus 48 artifact lines | RED: `.vscode-test.js` import failed on stale GitHub-authentication suite. GREEN: `node --check` + import, `bash -n scripts/test-integration.sh`, `./scripts/test-integration.sh --help`, Node assertions for both runners/launch/lint paths; client/build typechecks passed. Full integration and compile-extensions tasks were withheld because their internal cleanups delete generated files. |

### A4/A8 residual reference cleanup

The parent authorized exactly the six paths in U01.A4/A8.002. Removed the obsolete `github-authentication` suite selector/execution branch from Bash and Windows integration runners and its skill documentation; removed the `extensions/github/` debug launch and the provider-only ESLint allowlist entries. The runner tests still select and execute both `git` and `git-base`; `.vscode/launch.json` retains the Git test launch; the generic `src/vs/platform/github/common/githubTransport.ts` allowlist entry remains. `.vscode-test.js` asserts these boundaries. No repository paths outside the approved surfaces were edited.

The approved Vite and Rspack HTML templates no longer contain `trustedExtensionAuthAccess`/`github.remotehub`; their unrelated Gallery, Sync, and URL configuration was preserved. No Git remote hostname, Git/Git Base discovery entry, or OS credential behavior was changed.

## U01 A3 continuation — account UI residuals and parent boundary

The account-menu entrypoint is disconnected; the parent accepted the intentional loss of its Chat Pet badge-selection UI, and parent-owned U06 will physically remove `src/vs/sessions/contrib/accountMenu/browser/account.contribution.ts`. Keep that file physically present until the parent deletes the Sessions tree; do not separately delete `chatPetAchievementBadges.ts` or achievement services. Other disconnected account-panel candidates are `src/vs/sessions/browser/accountTitleBarState.ts` and its widget stylesheets (`accountTitleBarWidget.css`, `accountWidget.css`). The mixed contribution also registers the mobile chat-dashboard service, so physical deletion remains with the parent/U06.

The authorized A3 auth follow-up removed the workspace-picker sign-in action, stopped consulting the signed-out opt-in in the type picker, removed account-auth startup/watch/dialog flow from `sessionsSetUpService.ts`, made first-run welcome independent of authentication, and cleared the `vscode.github-authentication`/`github.auth` cross-app sharing allowlist entry without touching stored secret data. Residual sign-in source is dormant: `AGENTIC_SIGN_IN_COMMAND_ID` remains only in the unregistered `account.contribution.ts`; `sessionsSignInDialog.ts` is imported by a workbench component fixture, not a runtime caller; and `sessionsPolicyBlocked.ts` still contains account-gate/sign-in branches, while its registered contribution currently invokes only `AgentDisabled`. That last source path is outside this grant and remains parent/U06-owned. `mobileChatShell.css` retains inert account-sheet/avatar selectors after the mobile DOM removal. No live sign-in entrypoint or account gate was observed in the authorized runtime paths; no edit scope was widened.

## U02 leaf instantiation — Sync/local-profile seam ownership

The parent has assigned U02/A5 with the `feature-branch-chain` decision resolved and the 400-line ceiling in force. These leaves are exact symbol/path boundaries; rows sharing a large entrypoint are sequential, non-overlapping symbol seams. Planned sizes include tests and allocated OpenSpec progress/task/inventory changes. Add any newly discovered dependent path as a separate parent-approved surface before editing it.

| Leaf | Exact paths / seam | Prerequisite and owned behavior | Planned changed lines | Focused selector / evidence |
| --- | --- | --- | ---: | --- |
| U02.a.001 | `src/vs/workbench/services/userDataProfile/browser/{settingsResource.ts,userDataProfileSettingsService.ts}`; `src/vs/workbench/services/userDataProfile/test/browser/settingsResource.test.ts`; local profile service registration in `workbench.common.main.ts` | RED parity for profile settings export/import formatting and machine-scoped setting preservation; move only the local formatting/setting-preservation helpers out of userDataSync. | 180–360 | `./scripts/test.sh --run vs/workbench/services/userDataProfile/test/browser/settingsResource.test` |
| U02.a.002 | `src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts`; `src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts`; `src/vs/workbench/services/extensionManagement/test/common/ignoredExtensionsManagementService.test.ts`; its independent registration symbol in `workbench.common.main.ts` | RED parity for lower-case IDs, machine-scoped defaults, explicit ignore/always-sync overrides and configuration updates; move only the independent local ignored-extension policy into the retained extension-management layer. | 180–360 | `./scripts/test.sh --run vs/workbench/services/extensionManagement/test/common/ignoredExtensionsManagementService.test` |
| U02.a.003 | `src/vs/workbench/services/userDataProfile/test/browser/userDataProfileSyncBoundary.test.ts`; `src/vs/platform/userDataProfile/test/common/userDataProfileService.test.ts`; `src/vs/workbench/services/userDataProfile/test/browser/snippetsResource.test.ts` | RED no-start source assertions for legacy Sync state plus positive local profile creation/workspace/settings/snippets sentinels; classify all Sync imports and profile helpers before disconnection. | 160–340 | `./scripts/test.sh --run vs/workbench/services/userDataProfile/test/browser/userDataProfileSyncBoundary.test`; existing profile/snippets selectors |
| U02.b.001 | Sync-only symbols in `src/vs/workbench/workbench.common.main.ts`, `workbench.desktop.main.ts`, `src/vs/sessions/sessions.common.main.ts`, `sessions.desktop.main.ts` | Remove common/desktop/Sessions Sync contribution imports, logging/config registrations and service bootstrap only after the startup RED fixture passes. | 180–360 | `npm run typecheck-client`; profile Sync-boundary test |
| U02.b.002 | Sync-only symbols in `src/vs/workbench/workbench.web.main.ts`, `src/vs/workbench/browser/web.main.ts`, `src/vs/workbench/browser/web.api.ts` | Remove web Sync DI, user-data initializer/store startup, and obsolete web Sync option surface while preserving profile import initialization. | 180–360 | `npm run typecheck-client`; profile Sync-boundary test |
| U02.b.003 | Sync-only symbols in `src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts` | Remove Sync configuration, DI and IPC channels; preserve shared-process extension storage, enablement and unrelated channels. | 180–360 | `npm run typecheck-client`; profile Sync-boundary test |
| U02.b.004.001 | `src/vs/workbench/contrib/extensions/electron-browser/{remoteExtensionsInit.ts,extensions.contribution.ts}` | Remove only the Sync-backed `RemoteExtensionsInitializerContribution`; preserve `InstallRemoteExtensionsContribution` and ordinary remote extension relay/install behavior. | 120–400 | `userDataProfileSyncBoundary.test`; `npm run compile-client` |
| U02.b.004.002 | `src/vs/workbench/contrib/extensions/{browser/{extensionsActions.ts,extensionsList.ts,extensionsWidgets.ts,extensionsWorkbenchService.ts,extensions.contribution.ts,extensionRecommendationNotificationService.ts},common/extensions.ts,test/electron-browser/extensionsActions.test.ts}` | Remove Sync-only extension ignored-policy actions/widgets, machine-scope install alternatives and Sync-dependent install prompt choices; retain ordinary extension installs, local profile scope and extension enablement behavior. | 120–400 | `userDataProfileSyncBoundary.test`; extension actions/workbench service tests; `npm run compile-client` |
| U02.b.004.003 | `src/vs/workbench/contrib/preferences/{browser/{settingsEditor2.ts,settingsEditorSettingIndicators.ts,settingsLayout.ts,settingsTree.ts},test/browser/{settingsEditor2.test.ts,settingsEditorSettingIndicators.test.ts}}` | Remove Sync controls, ignored-setting actions/indicators and Settings Sync settings-layout category while preserving local settings editing, profile targets, and other setting indicators. | 120–400 | Sync-boundary, settings-editor, and indicator tests; `npm run compile-client` |
| U02.b.005.001 | `src/vs/workbench/contrib/chat/browser/promptSyntax/newPromptFileActions.ts`; `src/vs/workbench/contrib/welcomeGettingStarted/{browser/gettingStartedService.ts,common/gettingStartedContent.ts}`; `src/vs/workbench/contrib/relauncher/{browser/relauncher.contribution.ts,test/browser/relauncher.test.ts}`; `src/vs/workbench/contrib/update/browser/update.ts`; assertions in `src/vs/workbench/services/userDataProfile/test/browser/userDataProfileSyncBoundary.test.ts` | Remove Sync-only prompt/onboarding suggestions and relaunch/updater waits/store selection; preserve local prompt creation/settings customization, ordinary configuration relaunch, and quality-change confirmation. | 231 total (171 tracked source/test + 20 boundary-test lines + 38 apply-progress lines + 2 inventory changes) | `userDataProfileSyncBoundary.test`; relauncher suite; `npm run compile-client` |
| U02.c.001.001 | `src/vs/workbench/services/workspaces/common/workspaceIdentityService.ts`; local-shape assertion in `src/vs/workbench/services/userDataProfile/test/browser/userDataProfileSyncBoundary.test.ts` | Replace only the Sync-owned `IWorkspaceStateFolder` import/signatures with the equivalent local `IWorkspaceIdentityFolder` shape; preserve the edit-session identity algorithm. | 19 source/test lines (small type-only seam; no unrelated changes to reach 120) | `userDataProfileSyncBoundary.test`; `npm run compile-client` |
| U02.c.001.002 (pending parent decision) | `src/vs/workbench/contrib/editSessions/{browser/editSessions.contribution.ts,browser/editSessionsStorageService.ts,common/editSessions.ts,common/editSessionsStorageClient.ts,common/workspaceStateSync.ts}` | Remaining consumers use Sync store/client/error/resource/machine/synchronizer APIs for cloud edit-session behavior. Removing those edges while keeping cloud edit sessions would need an alternative backend; disabling/removing the behavior is A6 ownership, not a Sync-only A5 edit. | Not authorized to alter A6 behavior; keep this edge inventory-only until parent resolves stage order/scope | Current `npm run compile-client` passes with platform Sync source retained; no deletion-readiness evidence |
| U02.c.002 (blocked) | `src/vs/platform/userDataSync/**`, `src/vs/workbench/contrib/userDataSync/**`, `src/vs/workbench/services/userDataSync/**` tracked source/test/resource batches | No physical-deletion manifest is ready: edit-session cloud consumers still import platform Sync, and environment/CLI tails are not fully resolved. Executor does not unlink files. | Parent physical deletion only, after every inbound edge is disconnected; no exact manifest/batches emitted in this pass | Fresh source/import scan after authorized consumer disconnection, then parent removal evidence |
| U02.d.001 (blocked) | `src/vs/platform/environment/common/{environment.ts,environmentService.ts}`, `src/vs/workbench/services/environment/browser/environmentService.ts`; `src/vs/platform/environment/common/argv.ts` and `node/argv.ts` discovered as additional CLI owners | `userDataSyncHome` and `IEnvironmentService.sync` are used by Sync implementation roots; `--sync` is parsed in `node/argv.ts`. `--do-not-sync` also feeds machine-scoped CLI install options in code/server consumers. Keep legacy CLI/config tails until their exact edit surfaces and preserved machine-scope semantics are authorized. The standalone Monaco `userDataSyncHome` stub is out of grant and is not an active reader. | No edits to new argv/CLI paths without parent approval | Existing boundary test and compile only prove currently disconnected callers; no full environment/CLI absence claim |

### U02 inbound-reference classification before extraction

A fresh tracked-source scan, `git grep -n -E '(platform/userDataSync|workbench/services/userDataSync|workbench/contrib/userDataSync)' -- src/vs`, classified the importers below. This classification precedes helper extraction; it distinguishes protected local functions from Sync-only readers and consumer blocks. A path that only imports a Sync type is not automatically a local helper, and no broad import deletion is authorized.

| Class | Exact importer paths / symbols | Disposition and retained boundary |
| --- | --- | --- |
| Local profile settings preservation | `src/vs/workbench/services/userDataProfile/browser/settingsResource.ts`: `updateIgnoredSettings`, `IUserDataSyncUtilService.resolveFormattingOptions` | Extract only formatting and machine-scoped setting-preservation behavior into the existing `services/userDataProfile` layer; retain profile import/export and test profile-local data round-trips. The Sync merge/config/disallowed-setting policy is not retained. |
| Local ignored-extension policy | `src/vs/platform/userDataSync/common/ignoredExtensions.ts` consumed from `workbench.common.main.ts`, `workbench/contrib/extensions/browser/extensionsWorkbenchService.ts`, and `workbench/contrib/extensions/electron-browser/remoteExtensionsInit.ts` | Preserve only independent lower-case extension IDs, machine-scoped defaults and +/- overrides in the existing extension-management layer with parity tests. Remove remote initializer and trigger/Sync UI consumers; retain local extension installation, enablement, profiles and metadata. |
| Sync-only extension management branches | `src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts` (Sync-enabled machine-scope prompt); `src/vs/workbench/services/extensionManagement/electron-browser/extensionManagementService.ts` (forwarded Sync DI); `src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts` (Sync account/provider restriction); `src/vs/workbench/contrib/extensions/browser/{extensions.contribution.ts,extensionsWorkbenchService.ts}` (Sync enablement context/install prompt/toggle/trigger); `src/vs/workbench/contrib/extensions/browser/{extensionRecommendationNotificationService.ts,extensionsActions.ts,extensionsWidgets.ts}` | Remove Sync enablement, badge/action/recommendation, account restriction and upload trigger logic; preserve general recommendations, install/uninstall/update, local ignored extension config parity only where task requires it, and ordinary extension enablement. `extensionsActions.test.ts` and `extensionEnablementService.test.ts` contain corresponding Sync test fixtures to remove/replace in bounded leaves. |
| Sync-only preferences, relaunch, update and onboarding | `src/vs/workbench/contrib/preferences/browser/{settingsEditor2.ts,settingsEditorSettingIndicators.ts,settingsTree.ts}` and `test/browser/settingsEditor2.test.ts`; `src/vs/workbench/contrib/relauncher/browser/relauncher.contribution.ts` and its test; `src/vs/workbench/contrib/update/browser/update.ts`; `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedService.ts` | Remove Settings Sync UI/status/setting indicators, relaunch wait/commands, updater Sync actions/restart dependencies and Getting Started Sync CTA only. Preserve unrelated settings editor functionality, relaunch, update, welcome/personalization and profile switching. |
| Desktop/web/shared/Sessions bootstrap | `src/vs/workbench/workbench.common.main.ts`, `workbench.desktop.main.ts`, `workbench/workbench.web.main.ts`, `workbench/browser/web.main.ts`, `src/vs/sessions/sessions.common.main.ts`, `sessions.desktop.main.ts`, `sessions.web.main.ts`, `src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts` | Disconnect Sync configuration, local/remote stores, account/log/util services, store/user-data initialization and IPC channels. Keep extension storage/enablement and unrelated shared-process/workbench services. Shared-process scope is parent-authorized Sync-only. |
| Workbench Sync feature owner | `src/vs/workbench/contrib/userDataSync/**`, `src/vs/workbench/services/userDataSync/**` plus `src/vs/platform/userDataSync/**` imports internal to those roots | Parent-owned physical-deletion batches only after no inbound references remain. Obsolete tests/transports/resources go with their owning batch; this executor records exact manifests and never unlinks. |
| Cross-family cloud consumers | `src/vs/workbench/contrib/editSessions/browser/{editSessions.contribution.ts,editSessionsStorageService.ts}`, `common/{editSessions.ts,editSessionsStorageClient.ts,workspaceStateSync.ts}`; `src/vs/workbench/contrib/chat/browser/promptSyntax/newPromptFileActions.ts` | Remove Sync-only error/synchronizer/store/enablement references before the A6 or chat owner physically deletes its consumer. Keep A6 and chat ownership distinct and do not remove local workspace identity, local prompt-file editing, or unrelated APIs. |
| Workspace identity type-only edge | `src/vs/workbench/services/workspaces/common/workspaceIdentityService.ts`: `IWorkspaceStateFolder` import/signatures | Replace the Sync-owned structural type with a narrowly owned local workspace identity shape in this already approved file; preserve local workspace identity matching behavior. |
| Environment and CLI flags | `src/vs/platform/environment/common/{environment.ts,environmentService.ts}`, `src/vs/workbench/services/environment/browser/environmentService.ts`, `src/vs/platform/environment/common/argv.ts`, `src/vs/platform/environment/node/argv.ts`, `src/vs/code/node/cliProcessMain.ts`, `src/vs/server/node/{serverEnvironmentService.ts,remoteExtensionsScanner.ts,remoteExtensionHostAgentCli.ts}` | `userDataSyncHome`/`.sync` feed Sync roots; `--sync` is parsed as an enablement override; `--do-not-sync` also selects machine-scoped installs. The additional common/node argv and CLI consumers are outside the current grant; obtain exact parent authorization and preserve/explicitly retire the machine-scope behavior before removing these flags. |
| Other named direct consumers | `src/vs/workbench/contrib/extensions/{browser/extensions.contribution.ts,electron-browser/remoteExtensionsInit.ts}`; `src/vs/workbench/contrib/preferences/**`; `src/vs/workbench/contrib/relauncher/**`; `src/vs/workbench/contrib/update/browser/update.ts`; `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedService.ts`; `src/vs/workbench/contrib/chat/browser/promptSyntax/newPromptFileActions.ts`; `src/vs/workbench/services/extensionManagement/electron-browser/extensionManagementService.ts` | These consumers are included above and remain separate code-owner leaves; this row records no additional scope. New path discovery requires a distinct approved leaf before any edit. |

The direct-reference search found importers in the documented workbench, Sessions, shared-process, edit-session/chat consumer, local-profile, extension-management, preferences/relauncher/update/onboarding owners and the Sync implementation roots. Remaining textual matches are to be re-scanned after disconnection; the classification is semantic ownership evidence, not physical-removal evidence. Current helper extraction targets stay only in `src/vs/workbench/services/userDataProfile/**` and `src/vs/workbench/services/extensionManagement/**` already granted by parent.

This manifest is a dependency map, not a claim of completion. U02.b.005.001 is implemented and verified in the cumulative apply record; U02.c.001.001 removes only the local workspace identity type edge. The remaining edit-session cloud dependencies and CLI/environment tails block the exact parent-owned deletion manifest and deletion-review batches. Parent scope/ordering approval is required before any A6 behavior or new argv/CLI path is edited. No Sync-tree file was physically removed in this pass.

## U02.A6 bounded-leaf instantiation — cloud Edit Sessions

Parent option 1 now authorizes A6-only disconnection on the added paths in `parent-authorization.md`. Ordinary Git, local workspace editing/restoration, generic window routing and unrelated API behavior remain protected. Parent alone performs physical deletion; no `rm`/unlink is performed here.

| Leaf | Exact paths / seam | Prerequisite and owned behavior | Planned changed lines | Focused selector / evidence |
| --- | --- | --- | ---: | --- |
| U02.A6.a.001 | `workbench/workbench.common.main.ts`; `sessions/sessions.common.main.ts`; `workbench/api/browser/{extensionHost.contribution.ts,mainThreadWorkspace.ts}`; `workbench/api/common/{extHost.api.impl.ts,extHost.protocol.ts,extHostWorkspace.ts}`; `platform/extensions/common/extensionsApiProposals.ts`; `extensions/git/{package.json,tsconfig.json,src/main.ts}`; `workbench/services/workspaces/test/browser/workspaceEditingService.test.ts`; pending exact-path approval: `src/vs/workbench/api/common/extHostApiCommands.ts` | Remove Edit Session activation and extension identity-provider API/proposal/Git integration. Preserve Git SCM/commands/credential paths and local workspace editing. Focused test passes activation/identity checks but remains RED on the obsolete API command mapping outside the current grant. | 180–360 including tests and allocated artifacts | `./scripts/test.sh --run vs/workbench/services/workspaces/test/browser/workspaceEditingService.test`; `npm run compile-client` |
| U02.A6.a.002 | `platform/environment/{common/{argv.ts,environment.ts,environmentService.ts},node/argv.ts}`; `workbench/{services/environment/browser/environmentService.ts,browser/web.api.ts}`; `code/electron-main/app.ts`; `platform/windows/electron-main/{windowsMainService.ts,windowImpl.ts}`; `workbench/contrib/editSessions/browser/editSessions.contribution.ts`; same focused workspace boundary test | Remove Continue On/edit-session launch transport and cloud auto-resume fields only. Keep unrelated URI/session routing, Sync configuration pending A5, and ordinary desktop/browser workspace restore. | 150–340 including tests and allocated artifacts | Workspace boundary test; `npm run compile-client`; focused workspace-restoration positive case |
| U02.A6 pending deletion manifest | `workbench/contrib/editSessions/**` (9 tracked source/test files); `workbench/services/workspaces/common/workspaceIdentityService.ts`; parent-authorized manifest-only identity API/type files and Git provider are listed in apply-progress | Submit exact candidates only after external registrations, API command mapping, and API/package references are disconnected; parent runs `git rm`. Do not mark A6 tasks complete until physical deletion is observed. | Parent-owned deletion; excluded from executor edit budget | Final tracked-source reference scan, workspace boundary test, client compile before parent deletion |

Out-of-scope literal hits are classified, not edited: `src/vs/base/test/node/uri.perf.data.txt` contains URI-performance corpus path strings; `src/vs/editor/test/node/diffing/fixtures/json-brackets/*.json` are diff input/expected text read as fixture content, not imports; and Copilot fixture snapshots contain a copied API implementation. These are non-entrypoint test data, not live product imports; the Copilot fixtures are removed by their later owning family.

## U02 continuation — A6 parent batches and conditional A5 manifest

This status supersedes the provisional “pending parent decision” / “no manifest ready” rows above. As of this inventory update, A6 cloud entrypoint/API/command edges and A5 Sync bootstrap/CLI flags are disconnected and focused tests compile/pass. Physical deletion remains parent-only. The tracked paths below were counted from the current checkout after edits, so their current line totals differ from the baseline census near the top of this document.

### A6 exact parent-only deletion manifest and review batches

| Batch | Ownership-coherent scope | Files | Current lines | Preconditions / retained boundary |
| --- | --- | ---: | ---: | --- |
| A6-D1 | Complete `src/vs/workbench/contrib/editSessions/` implementation and obsolete test tree | 9 | 2,721 | Workbench and Sessions entrypoints no longer import the contribution; the identity API participant and legacy extension-host command are disconnected. Local workspace restore remains green. All internal Sync imports stay within this batch; execute before A5 platform Sync batches. |
| A6-D2 | `workspaceIdentityService`, `editSessionIdentityService`, platform identity contract, and main-thread participant | 4 | 325 | A6 runtime consumers are disconnected; after D1, re-scan for any remaining identity-service imports. This batch removes only cloud identity behavior, not the retained `IWorkspaceIdentityFolder` local structural shape. |
| A6-D3 | Reserved proposed API declaration and Git identity-provider source | 2 | 207 | Git provider registration/proposal package entries are disconnected and the `vscode.experimental.editSession.continue` command mapping is removed. After deletion, rebuild the generated `extensionsApiProposals.ts` registry. Preserve Git SCM, ordinary commands, and `git.continueInLocalClone`. |
| **Total A6** | Parent-owned physical deletion only | **15** | **3,253** | Do not check A6 task boxes until parent deletion is observed and fresh verification passes. |

Exact A6-D1 paths:

```text
src/vs/workbench/contrib/editSessions/browser/editSessions.contribution.ts
src/vs/workbench/contrib/editSessions/browser/editSessionsFileSystemProvider.ts
src/vs/workbench/contrib/editSessions/browser/editSessionsStorageService.ts
src/vs/workbench/contrib/editSessions/browser/editSessionsViews.ts
src/vs/workbench/contrib/editSessions/common/editSessions.ts
src/vs/workbench/contrib/editSessions/common/editSessionsLogService.ts
src/vs/workbench/contrib/editSessions/common/editSessionsStorageClient.ts
src/vs/workbench/contrib/editSessions/common/workspaceStateSync.ts
src/vs/workbench/contrib/editSessions/test/browser/editSessions.test.ts
```

Exact A6-D2 paths:

```text
src/vs/platform/workspace/common/editSessions.ts
src/vs/workbench/api/browser/mainThreadEditSessionIdentityParticipant.ts
src/vs/workbench/services/workspaces/common/editSessionIdentityService.ts
src/vs/workbench/services/workspaces/common/workspaceIdentityService.ts
```

Exact A6-D3 paths:

```text
extensions/git/src/editSessionIdentityProvider.ts
src/vscode-dts/vscode.proposed.editSessionIdentityProvider.d.ts
```

The retained `workspaceEditingService.test.ts` and `userDataProfileSyncBoundary.test.ts` were adjusted so they no longer try to read implementation files that the parent will delete. Static assertions still check startup/API disconnection and retained local workspace behavior. The generated proposal registry and API type bridge are intentionally left for post-deletion regeneration/cleanup.

### Conditional U02 Sync physical-deletion batches

These are exact current tracked-file lists. Execute only after A6-D1–D3 have been deleted and a fresh `git grep`/import scan confirms no external platform-Sync consumers. The userDataSync client fixture was updated to remove the deleted `.sync` test override; current count is 52 platform files / 23,732 lines (not the pre-edit baseline 23,739). Parent runs `git rm`; executor does not unlink.

| Batch | Ownership-coherent scope | Files | Current lines | Gate |
| --- | --- | ---: | ---: | --- |
| A5-C1 | Workbench Sync browser contribution, views, trigger, conflict UI | 5 | 2,394 | A5 startup/UI consumers are disconnected; retain local profile and extension-management helpers already extracted. |
| A5-C2 | Workbench Sync Electron contributions and utility channel | 2 | 88 | Remove with its owning channel and contribution registration. |
| A5-C3 | Sync utility-channel Electron test | 1 | 76 | Delete with C2; no non-Sync consumer. |
| A5-S1 | Workbench Sync browser enablement/init/workbench services | 4 | 1,255 | A5 workbench registrations and startup consumers are disconnected; after A6 deletion there must be no external A6 imports. |
| A5-S2 | Workbench Sync common contracts/utilities | 2 | 163 | Delete with S1 and all feature consumers. |
| A5-S3 | Workbench Sync Electron auto-sync/service contributions | 2 | 56 | Delete with service registration/channel owners. |
| A5-P1 | Platform Sync engine, account, enablement, local store, machine/service/IPC, and Node auto-sync | 16 | 5,799 | Requires A6 removal first; keep `userDataProfile` local settings/import/export, extension policy, and workspace behavior outside this batch. |
| A5-P2 | Platform resource synchronizers/mergers and retired `ignoredExtensions` implementation | 17 | 5,682 | The independent ignored-extension policy already lives in extension-management; do not remove that local replacement. |
| A5-P3 | Platform merge tests | 6 | 4,685 | Delete only with the corresponding resource implementation batch. |
| A5-P4 | Platform resource synchronization tests | 8 | 4,366 | Delete only with the corresponding resource implementation batch. |
| A5-P5 | Platform core synchronizer/auto-sync/client/service/store tests | 5 | 3,200 | Delete with P1 service/engine owners; no network test is run by this executor. |
| **Total U02 A5** | Parent-owned conditional Sync-tree deletion | **68** | **27,764** | Execute only after A6 files/importers are physically removed and a fresh source scan/compile passes. |

Exact A5-C1 paths:

```text
src/vs/workbench/contrib/userDataSync/browser/userDataSyncConflictsView.ts
src/vs/workbench/contrib/userDataSync/browser/userDataSync.contribution.ts
src/vs/workbench/contrib/userDataSync/browser/userDataSyncTrigger.ts
src/vs/workbench/contrib/userDataSync/browser/userDataSync.ts
src/vs/workbench/contrib/userDataSync/browser/userDataSyncViews.ts
```

Exact A5-C2 paths:

```text
src/vs/workbench/contrib/userDataSync/electron-browser/userDataSync.contribution.ts
src/vs/workbench/contrib/userDataSync/electron-browser/userDataSyncUtilChannel.contribution.ts
```

Exact A5-C3 path:

```text
src/vs/workbench/contrib/userDataSync/test/electron-browser/userDataSyncUtilChannel.test.ts
```

Exact A5-S1 paths:

```text
src/vs/workbench/services/userDataSync/browser/userDataSyncEnablementService.ts
src/vs/workbench/services/userDataSync/browser/userDataSyncInit.ts
src/vs/workbench/services/userDataSync/browser/userDataSyncWorkbenchService.ts
src/vs/workbench/services/userDataSync/browser/webUserDataSyncEnablementService.ts
```

Exact A5-S2 paths:

```text
src/vs/workbench/services/userDataSync/common/userDataSync.ts
src/vs/workbench/services/userDataSync/common/userDataSyncUtil.ts
```

Exact A5-S3 paths:

```text
src/vs/workbench/services/userDataSync/electron-browser/userDataAutoSyncService.ts
src/vs/workbench/services/userDataSync/electron-browser/userDataSyncService.ts
```

Exact A5-P1 paths:

```text
src/vs/platform/userDataSync/common/abstractJsonSynchronizer.ts
src/vs/platform/userDataSync/common/abstractSynchronizer.ts
src/vs/platform/userDataSync/common/content.ts
src/vs/platform/userDataSync/common/userDataAutoSyncService.ts
src/vs/platform/userDataSync/common/userDataSync.ts
src/vs/platform/userDataSync/common/userDataSyncAccount.ts
src/vs/platform/userDataSync/common/userDataSyncEnablementService.ts
src/vs/platform/userDataSync/common/userDataSyncIpc.ts
src/vs/platform/userDataSync/common/userDataSyncLocalStoreService.ts
src/vs/platform/userDataSync/common/userDataSyncLog.ts
src/vs/platform/userDataSync/common/userDataSyncMachines.ts
src/vs/platform/userDataSync/common/userDataSyncResourceProvider.ts
src/vs/platform/userDataSync/common/userDataSyncService.ts
src/vs/platform/userDataSync/common/userDataSyncServiceIpc.ts
src/vs/platform/userDataSync/common/userDataSyncStoreService.ts
src/vs/platform/userDataSync/node/userDataAutoSyncService.ts
```

Exact A5-P2 paths:

```text
src/vs/platform/userDataSync/common/extensionsMerge.ts
src/vs/platform/userDataSync/common/extensionsSync.ts
src/vs/platform/userDataSync/common/globalStateMerge.ts
src/vs/platform/userDataSync/common/globalStateSync.ts
src/vs/platform/userDataSync/common/ignoredExtensions.ts
src/vs/platform/userDataSync/common/keybindingsMerge.ts
src/vs/platform/userDataSync/common/keybindingsSync.ts
src/vs/platform/userDataSync/common/mcpSync.ts
src/vs/platform/userDataSync/common/promptsSync/promptsMerge.ts
src/vs/platform/userDataSync/common/promptsSync/promptsSync.ts
src/vs/platform/userDataSync/common/settingsMerge.ts
src/vs/platform/userDataSync/common/settingsSync.ts
src/vs/platform/userDataSync/common/snippetsMerge.ts
src/vs/platform/userDataSync/common/snippetsSync.ts
src/vs/platform/userDataSync/common/tasksSync.ts
src/vs/platform/userDataSync/common/userDataProfilesManifestMerge.ts
src/vs/platform/userDataSync/common/userDataProfilesManifestSync.ts
```

Exact A5-P3 paths:

```text
src/vs/platform/userDataSync/test/common/extensionsMerge.test.ts
src/vs/platform/userDataSync/test/common/globalStateMerge.test.ts
src/vs/platform/userDataSync/test/common/keybindingsMerge.test.ts
src/vs/platform/userDataSync/test/common/settingsMerge.test.ts
src/vs/platform/userDataSync/test/common/snippetsMerge.test.ts
src/vs/platform/userDataSync/test/common/userDataProfilesManifestMerge.test.ts
```

Exact A5-P4 paths:

```text
src/vs/platform/userDataSync/test/common/globalStateSync.test.ts
src/vs/platform/userDataSync/test/common/keybindingsSync.test.ts
src/vs/platform/userDataSync/test/common/mcpSync.test.ts
src/vs/platform/userDataSync/test/common/promptsSync.test.ts
src/vs/platform/userDataSync/test/common/settingsSync.test.ts
src/vs/platform/userDataSync/test/common/snippetsSync.test.ts
src/vs/platform/userDataSync/test/common/tasksSync.test.ts
src/vs/platform/userDataSync/test/common/userDataProfilesManifestSync.test.ts
```

Exact A5-P5 paths:

```text
src/vs/platform/userDataSync/test/common/synchronizer.test.ts
src/vs/platform/userDataSync/test/common/userDataAutoSyncService.test.ts
src/vs/platform/userDataSync/test/common/userDataSyncClient.ts
src/vs/platform/userDataSync/test/common/userDataSyncService.test.ts
src/vs/platform/userDataSync/test/common/userDataSyncStoreService.test.ts
```

### External tails and deletion gates

- A source scan finds five cross-family imports of `src/vs/platform/userDataSync/**` in A6-D1: `editSessions.contribution.ts`, `editSessionsStorageService.ts`, `common/editSessions.ts`, `common/editSessionsStorageClient.ts`, and `common/workspaceStateSync.ts`. All other Sync imports are internal to the A5 deletion roots. The previously missed `sessions.web.main.ts` Sync registrations were removed and the boundary test now covers common, desktop, and web Sessions entrypoints. This is why the A5 manifest remains conditional on A6 physical removal.
- `userDataSyncHome` remains in environment interfaces/getters and the standalone environment stub because Sync implementation sources still compile until parent deletion. Remove the interface/getter tails in a later authorized cleanup after A5 tree deletion; `src/vs/editor/standalone/browser/standaloneServices.ts` also contains unused `continueOn` / `editSessionId` and extra `sync` properties, is outside this grant, and has been reported to the parent for a follow-up authorization decision.
- `src/vs/platform/extensions/common/extensionsApiProposals.ts` is regenerated from proposed declaration files. The generated `editSessionIdentityProvider` registry entry must be removed by parent deletion of the reserved `.d.ts` followed by compile, not by editing generated output.
- `src/vs/base/common/product.ts` still carries the `editSessions.store` type key until A6 source deletion; the root `product.json` has no runtime value. The API type bridge and no-op protocol residue are also post-deletion cleanup, not part of the physical manifest.
- Do not check A5/A6 family checkboxes or claim closure until parent deletion evidence and an independent fresh verification are recorded. No physical deletion, staging, or commit occurred here.

## U02 post-parent deletion reconciliation — 2026-10-05

This section supersedes the conditional A5 manifest/deletion-gate statements above. Parent evidence: A6-D1–D3 physically removed all **15 manifest files**, including the five manifest-only paths; the generated proposal registry was rebuilt by `npm run compile-client` (**PASS**). The parent then physically removed all **68/68** manifest Sync files; `platform/userDataSync/`, `workbench/contrib/userDataSync/`, and `workbench/services/userDataSync/` are absent. Parent `npm run compile-client` passed after the A5 batches. The A6 local workspace positive suite passed 9/9. The parent-reported profile/Sync-boundary suite failure was test-code `ENOENT` from reading deleted `workspaces/common/workspaceIdentityService.ts`, not a production compile/runtime failure; the test now asserts the path is absent.

The final source-tail leaf removes `userDataSyncHome`/`sync` interface/getter members from the three environment files, and the inert Sync/Edit Sessions fields from standalone Monaco's environment stub. The standalone stub no longer advertises `userDataSyncHome`, `sync`, `continueOn`, or `editSessionId`.

The machine-scope disposition was resolved under the parent's `approve-all` P01–P11 grant. The only live behavioral reader of `isMachineScoped` was the `IgnoredExtensionsManagementService`, deriving `settingsSync.ignoredExtensions`; install implementations merely serialized/copied metadata, and no installation-location branch existed. Accordingly, the machine-scope option/metadata field and Sync-only helper, registrations, and obsolete behavior tests were removed from P01–P11 plus the seven granted consumer paths. `isApplicationScoped`, profile location/resource behavior, ordinary installs, remote installs, language packs, themes, recommendations, and application-wide profile installs remain. The earlier classification row describing the ignored-extension helper as independently local is superseded: it had no non-Sync consumer and was not a retained local helper.

Fresh U02 evidence now includes a passing 19/19 Sync boundary test (including deleted-file absence, environment-tail absence, standalone-tail absence, and local profile switching), the machine-scope absence/preservation test, copied-legacy-state profile service test (33/33), and workspace editing test (9/9). Parent compile/test outputs remain separately labeled in `apply-progress.md`. The tracked-source audit leaves `isMachineScoped` only in the negative source assertion itself; `userDataSyncHome`/Sync environment and standalone fields have no source declarations or consumers. No user files, secrets, local repositories, or remote state were modified; no live provider/network probe or sign-out was performed. Physical deletions were parent-executed; this executor performed no unlink, staging, or commit.
