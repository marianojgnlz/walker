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
