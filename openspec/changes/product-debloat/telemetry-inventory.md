# Telemetry Inventory — Product Debloat

## Status and scan contract

This ledger is seeded from design D5–D6 and the tracked `main` baseline. U00 is inventory/fixture work only; every Walker-owned reporting entry is pending, not removed or accepted as a no-op. A file match is a candidate; owners resolve each call, payload-only calculation, DI edge, package/build edge and protected diagnostic function in its future bounded implementation leaf.

Baseline `git grep -n -I` scans cover tracked source under `src/vs`, `src/main.ts`, `extensions`, `build`, `cli`, and `scripts`. Token groups are intentionally broad, overlap, and count matches rather than unique semantic events. Current scan totals: `ITelemetryService`/`publicLog*`/appender/service aliases: **3,079 matches across 849 files**; `__GDPR__`, telemetry ID/common-property and timer anchors: **590 matches across 214 files**; reporter package/class/sender markers: **571 matches across 134 files**; gallery statistics/correlation/query telemetry terms: **651 matches across 267 files**; crash reporter/flags: **51 matches across 15 files**. Re-run scoped scans in each owning leaf; these are not a claim of closure.

The four D6 acceptance states remain: `pending` → `cut-off` (I/B infrastructure only) → `pruned` (calls, payloads and exclusive dependencies removed); `retained-compatibility` and `retained-non-telemetry` require exact member/consumer, rationale and passing test. No group is pruned by no-op service injection alone. Status here is `pending` except explicit protected external suppression controls.

## Entry schema and ownership rules

Each ledger row records: source/process owner; exact paths or symbol families found; emission/alias and payload-only classes; inbound DI/constructor/manifest edges; removal family and U00 ledger leaf; state; focused positive/negative selector; retained boundary. Exact line-level entries are expanded by the corresponding T owner before code removal; U00 records disjoint ownership classes and a measurable candidate set rather than auto-deleting grep results.

| Candidate source class | Owner / disposition | Non-reporting boundary |
| --- | --- | --- |
| `ITelemetryService`, `ICustomEndpointTelemetryService`, `IServerTelemetryService` | I1–I6 process cut-off, then T1/T7/T8 signatures and injections | Retain only minimal no-op/public service contract where specified |
| `publicLog`, `publicLog2`, `publicLogError`, `publicLogError2`, `setCommonProperty`, `setExperimentProperty` | T1–T12 call and constructor inventories | Calls are removed; ordinary logger/error/request APIs are not telemetry by name |
| Reporter constructors / `TelemetryReporter` / sender `sendEventData`, `sendErrorData`, `flush` | B1–B8 direct reporters; removed A/C reporters credited to T10 | Preserve owning Git/language/preview/browser behavior; sender counters remain zero |
| `TelemetryLevel`, enablement settings, `supportsTelemetry`, `getTelemetryLevel`, `isLoggingOnly` | I1–I7 cutoff; T1/T11 config/argv closure | Old all/error/crash settings powerless; no local telemetry log |
| `machineId`, `sqmId`, `devDeviceId`, `sessionId`, `firstSessionDate`, storage keys | T1/T7 and per-context payload owners | No new IDs or wiping; preserve distinct ordinary IPC/security IDs with test evidence |
| `resolveCommonProperties`, `commonProperties`, `TelemetryTrustedValue`, `__GDPR__` annotations | T1/T7/T9/T12 data and type owners | Public compatibility wrapper only if spec documents/tests exact reason |
| `StopWatch`, `duration`, `count`, timers, classifications, experiment IDs | T1–T12 inspect payload-only usage after event deletion | Preserve tested non-reporting perf/debug measurements only |
| `telemetryAppender`, `ServerTelemetryChannel`, `TelemetryAppenderClient`, `TelemetryLogAppender`, 1DS/custom endpoint | I1–I.ALL infrastructure owners | Ordinary logs/error output and gallery/API RPC remain |
| `crashReporter`, crash IDs/CLI/schema/runner flags | I7 | Normal exception diagnostics remain; no crashReporter startup |
| `reportStatistic`, gallery stat resource, `X-Market-User-Id`, `VSCode-SessionId` | T7 | Anonymous query, detail, install/update/download/VSIX functional requests |
| `.build/telemetry/**`, extractors and exclusive manifest/lock entries | I.ALL/T11 packaging owners | Generic release/build/license/native validation |
| `DOTNET_CLI_TELEMETRY_OPTOUT=1` | Protected external-runtime suppression; **retain** | The .NET toolchain launches its managed installer/probe without .NET CLI telemetry |

No real telemetry sends, OAuth, account tokens, private URLs, user profiles, home data, real repositories, or production credentials were used in discovery. Test IDs and any fake old state will be obvious non-secret fixtures.

## T1–T6 process and subsystem ledger

| Group / removal unit | Disjoint discovery roots and exact anchors | Calls/aliases and payload-only work to enumerate | Dependency/inbound edge | State; future focused test |
| --- | --- | --- | --- | --- |
| T1 — process/platform (`U11.a.*`; cutoff I1/I4/I5/I7) | `src/main.ts`; `src/vs/code/**`; `src/vs/server/**`; platform telemetry, environment, product, externalServices, native/main bootstrap | `app.ts` `ITelemetryService` conditional appender descriptor, `resolveCommonProperties`, machine IDs; power suspend/resume, GPU fallback/crash, network launch/gone, OS proxy event types/timers; crashReporter argv/config and ErrorTelemetry | Desktop app services + shared process appender channel + server telemetry DI; build/run arguments | pending; new `vs/code/test/electron-main/productDebloat.test` for registration; existing error/log tests retained; `typecheck-client` later |
| T2 — editor/base (`U11.b.*`) | `src/vs/editor/**`, `src/vs/base/**` | telemetry interfaces/types/classifications, model/selection/action timing, IDs and event-only utilities; separate stable common error/perf helpers from payload values | Base→platform→editor layering and editor service DI | pending; owning editor/base fixture assigned per leaf; `typecheck-client` when signatures change |
| T3 — workbench shell/services (`U11.c.*`) | workbench browser/common/services excluding the disjoint API, telemetry, extension-management, files/search/SCM, terminal/debug/language and removed-feature roots | lifecycle/layout/title/status/views/theme/keybinding/accessibility/storage/timers/assignment calls; `__GDPR__` payload-only state and constructor forwarders | contribution registries, global/title UI and shared DI; profile/storage remain | pending; targeted existing workbench service/browser test per exact member leaf |
| T4 — files/search/SCM (`U11.d.*`) | workbench explorer/files/search/SCM contributions/services and bulk-edit/workspace owners | search/history/workspace activity, SCM aggregation and file payloads; separate timing counters from genuine Search/Git functionality | `extensions/git` and Search/ripgrep are positive protected dependencies | pending; Git suite `--suite 'git,git-base'` plus exact Search/file/SCM focused test per leaf |
| T5 — terminal/debug/tasks/testing (`U11.e.*`) | terminal/terminalContrib, debug, tasks, testing and `contrib/debug/node/telemetryApp` | PTY/debug/tasks/testing event IDs, duration/timers, telemetry-only app entry/DI | process and workbench entrypoints; keep terminal operation, debug, task/test execution and ordinary error output | pending; affected focused core/extension test and client diagnostics per leaf |
| T6 — retained language/notebooks (`U11.f.*`) | workbench language/intellisense/notebook/interactive/inline completion excluding removed chat integrations | diagnostics/perf events, language/notebook payload builders, classifications and exclusive helper imports | B2–B5 retained language extensions plus C3 chat integration removal | pending; owning language/notebook/API positive suite; no blanket removal of language helpers |

The path sets above are ownership partitions, not blanket directories. Cross-cutting platform APIs are assigned to T1/T7/T8 by consumer and exact member, never duplicated. Removed account/chat/session/Copilot tree telemetry is credited once to T10 after actual physical deletion.

### I1 / I4 / I5 / I6 / I7 current startup anchors

* `src/vs/code/electron-main/app.ts`: lines 82–85 import active telemetry service/appender/utilities; `initServices` selects `TelemetryService` under `supportsTelemetry`, otherwise singleton `NullTelemetryService`; starts `ErrorTelemetry`; several event-producing methods construct payloads. U00 permits only a zero-runtime-change registration-observation seam, not a reporting cutoff.
* `src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts`: imports common props, appender channel, log appender, active `TelemetryService`, and custom endpoint; registers `telemetryAppender` and binds `ITelemetryService`.
* `src/vs/server/node/serverServices.ts`: constructs 1DS/log appenders, maps remote `telemetry-level` args into a server service, registers `telemetry` channel and `ErrorTelemetry`; generic server and gallery-manifest channels are separate.
* `src/vs/workbench/api/common/extHostTelemetry.ts`: retains sender map/lifecycle, machine/session/product common properties, usage/error enablement change events, payload cleaning and sender methods; future I6 tests sender/flush counters in Node/worker contexts.
* `src/main.ts:12,86–98,486–568`: imports Electron crashReporter and starts from old argv/config; mutates crash path/ID and propagates IDs to child args. `scripts/test.sh` and integration runner use crash-reporter-directory for test process setup.

### T1–T6 per-owner member inventory (baseline candidates)

| Ledger entry | Current path/member candidate | Exact removal owner / required retained assertion |
| --- | --- | --- |
| T1.001 | `src/vs/code/electron-main/app.ts`: telemetry registration branch | I1 binds no-op; no `telemetryAppender` request; ordinary service collection still resolves |
| T1.002 | `app.ts`: `resolveCommonProperties`, `machineId`, `sqmId`, `devDeviceId`, `getPiiPathsFromEnvironment` | **pruned (`u11.a.002`, 2026-10-08):** identity resolution, state keys, shared-process/window configuration fields, environment-service getters and `resolveCommonProperties` are removed; stored IDs are not wiped and no unrelated identity/security consumer was touched. |
| T1.003 | `app.ts`: `power.suspend`, `power.resume` and `PowerEvent` | **pruned (`u11.a.001`):** event, classification, event-only listener and idle/thermal sampling removed; power lifecycle behavior is Electron-owned and unchanged. |
| T1.004 | `app.ts`: `gpu.crash.fallback`, GPU status and fallback event payload | **pruned (`u11.a.001`):** reporter, `getGPULogMessages` payload and the GPU-log string builder removed; GPU fallback/diagnostic handling is untouched. |
| T1.005 | `app.ts`: `networkProcess.launched`, `networkProcess.gone`, exit/crash classifications | **pruned (`u11.a.001`):** both events/classifications removed while the ordinary `[network process] launched/gone` diagnostic log lines stay. |
| T1.006 | `app.ts`: `osProxyConfig`, `OSProxyConfigEvent`, PAC/platform proxy-state gathering | **pruned (`u11.a.001`):** event, classification, `logOSProxyConfigTelemetry`, `getPACScriptStats`, `getOSProxyEnvironmentState`, `hasOSProxyBypassRules` and the mutating `telemetryLevel` gate removed; the read-only `readProxyConfigWithPackage` native API is left in place (now consumer-less, T12 residual). |
| T1.007 | app `ErrorTelemetry` construction and telemetry imports | I1 cutoff then I.ALL removes collector; ordinary uncaught errors remain visible |
| T1.008 | `src/main.ts`: crashReporter args/config/IDs and `configureCrashReporter` | I7; old flags powerless and no child ID propagation; normal startup errors remain |
| T1.009 | `src/vs/platform/telemetry/common/commonProperties.ts`: common identity/product/session properties | **pruned (`u11.a.002`):** `resolveCommonProperties` (identity, session UUID, timestamps, sequence, snap/platform details) removed; only `verifyMicrosoftInternalDomain` remains for the TAS/experiment gate. |
| T1.010 | electron/node telemetry `resolveMachineId`, `resolveSqmId`, `resolveDevDeviceId`, state keys | **identity half pruned (`u11.a.002`):** all four resolvers/validators, the three state keys and their DI threading were removed and the module is empty (parent-deletion manifest) without wiping stored state. Remaining: `base/node/id.ts` helpers, session-date keys, `virtualMachineHint` consumer audit. |
| T1.011 | telemetry `supportsTelemetry`, `isLoggingOnly`, `getTelemetryLevel`, `TelemetryLevel` | no product/environment/settings switch may re-enable logging/reporting after cutoff |
| T1.012 | common/Node/browser 1DS and telemetry log appenders | I.ALL deletes output/network code and direct package deps after no-op wiring |
| T1.013 | `src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts`: `appenders`, custom endpoint, appender channel | I4 no channel/appender/flush; extension-management/log services survive |
| T1.014 | `src/vs/server/node/serverServices.ts`: remote `telemetry-level` arg and `IServerTelemetryService` | I5 ignores old remote enablement; generic server and gallery channels resolve |
| T1.015 | `src/vs/platform/telemetry/common/remoteTelemetryChannel.ts` / server service | delete reporting channel, not unrelated remote RPC or request channel |
| T1.016 | `src/vs/workbench/api/common/extHostTelemetry.ts`: `TelemetrySender`, logger map, `onDidChangeEnableStates` | I6 facade disabled; all sendEvent/sendError/flush counts stay zero |
| T1.017 | `extHostTelemetry.ts`: common properties from machine/session/SQM/device/first-session IDs | remove telemetry-only fields and generation, don't collect or erase external IDs |
| T1.018 | `src/vs/platform/telemetry/common/errorTelemetry.ts`, electron-main/node collectors | I.ALL remove error collector and tests; ordinary errors/log channels remain |
| T2.001 | `src/vs/editor/**`: `ITelemetryService` and `publicLog*` callsites | event+payload computed work removed; editor operations/tests remain |
| T2.002 | `src/vs/base/**`: telemetry IDs, classifications, event-only timers/helpers | remove only sole-purpose reporter code; base utilities remain when consumer-tested |
| T2.003 | Editor/base public types, `ClassifiedEvent`, `IGDPRProperty`, GDPR generator input | remove after downstream declarations/build graph audit; stable API types only if explicitly retained |
| T3.001 | `workbench/browser/**`: startup/layout/title/status/view telemetry DI/calls | remove event arguments and injections; keep layout, controls, lifecycle |
| T3.002 | `workbench/common/**`: lifecycle/command/theme/keybinding contribution instrumentation | remove report-only listeners and derived payloads; command/lifecycle semantics remain |
| T3.003 | `workbench/services/**`: profile/storage/accessibility/timer/assignment instrumentation | preserve local profiles/settings/storage and actual timers with non-reporting uses |
| T3.004 | workbench common/browser properties and agent-window identity fields | delete reporting-only payload; do not delete local agent state or protected onboarding |
| T4.001 | `contrib/search/**`, Search model/query/target classifications | preserve Search/ripgrep and ordinary status/log output; no source behavior reclassification by `telemetry` name |
| T4.002 | `contrib/scm/**`, `contrib/files/**`, explorer/workspace/bulk edit telemetry | keep Git SCM, file operations, history, local workspace state |
| T4.003 | `services/search`, `services/scm`, files/workspace activity aggregation | remove report-only aggregators/injections and constructor forwarding |
| T4.004 | Extension Git reporter and core Git service are separate inventory entries | B1/T9 owns reporter; plain remotes, askpass and SSH remain |
| T5.001 | `contrib/terminal/**`, terminalContrib PTY/command events | preserve shell/PTy operation, normal process errors and output |
| T5.002 | `contrib/debug/**`, `contrib/tasks/**`, `contrib/testing/**` timing/event payloads | preserve debug/task/test launch and diagnostics |
| T5.003 | `contrib/debug/node/telemetryApp` and package/build entry | remove if reporting-only after inbound checks; preserve generic debugging/error logs |
| T6.001 | retained language/intellisense/inline-completion event emitters | remove telemetry-only payloads; retain completion/diagnostic operations |
| T6.002 | notebook/interactive/renderer timing and classification helpers | keep notebook execution and public extension API behavior |
| T6.003 | chat-dependent notebook/language instrumentation | credit source deletions to C3/T10 exactly once; no chat framework in T6 |

### Identity and payload-only aliases requiring explicit audit

| Payload/identity group | Current exact forms to search | Assigned owner and status |
| --- | --- | --- |
| Machine IDs | `machineId`, `common.machineId`, `telemetry.machineId`, `machineIdKey`, `resolveMachineId`, marketplace service machine ID | T1/T7; pending; no stored state cleanup |
| SQM/device IDs | `sqmId`, `devDeviceId`, `common.sqmId`, `common.devDeviceId`, `telemetry.sqmId`, `telemetry.devDeviceId` | T1; pending; no identity transfer |
| Session/install dates | `sessionId`, `firstSessionDate`, `lastSessionDate`, `currentSessionDateStorageKey`, `common.firstSessionDate`, `isNewSession` | T1/T3/T7; pending; ordinary local profile timestamps are separate |
| PII path cleaning | `piiPaths`, `cleanData`, `cleanRemoteAuthority`, `TelemetryTrustedValue` | T1/I6; pending; only remove telemetry serialization behavior |
| GDPR classifications | `__GDPR__`, `__GDPR__COMMON__`, `__GDPR__FRAGMENT__`, `Classification`, `purpose`, `isMeasurement` | T1–T12 by source owner; pending; do not remove ordinary domain types blindly |
| Timer/aggregation | `StopWatch`, `startTime`, `duration`, `elapsed`, `count`, `sequence`, power/network/proxy event timers | T1–T12 per consuming event; pending; retain only a tested non-reporting consumer |
| Extension sender | `TelemetrySender`, `TelemetryLogger`, `isUsageEnabled`, `isErrorsEnabled`, `sendEventData`, `sendErrorData`, `flush` | I6 public facade; pending; no sender callback/disposal flush |
| Direct reporters | `TelemetryReporter`, `VSCodeTelemetryReporter`, `createTelemetryReporter`, `@vscode/extension-telemetry` | B1–B8 or A/C/T10; pending; manifest and lock are separate package edges |
| Product/argv gates | `supportsTelemetry`, `isLoggingOnly`, `enableTelemetry`, `telemetry-level`, `disable-telemetry`, old crash flags | I1–I7/T11; pending; settings must never restore reporting |
| Statistics/correlation | `reportStatistic`, `ExtensionStatisticsUri`, `X-Market-User-Id`, `VSCode-SessionId` | T7; pending; no deletion of functional gallery request headers |
| Error/crash | `ErrorTelemetry`, `publicLogError*`, `crashReporter`, `crash-reporter-directory`, `crash-reporter-id` | I1/I5/I7/T1; pending; normal diagnostic errors stay visible |

Every alias/payload row is assigned to an owning T/I/B family; physical `T*.001` implementation leaves must be narrowed to independent file/member batches before editing. The `U00.b.001` leaf itself owns only this ledger addition and has no runtime side effect.

### Test ownership for T1–T6 and process cutoff

* `src/vs/code/test/electron-main/productDebloat.test.ts` is a U00 RED counter for reporter registration; it must inspect a descriptor and must not instantiate `TelemetryService` or an appender.
* `src/vs/platform/telemetry/test/common/nullTelemetryService.test.ts` is the positive test for the existing no-op object: methods are inert, `telemetryLevel` is NONE and error state is false.
* `src/vs/workbench/api/test/common/accountFreeApi.test.ts` is auth-only; it must not be misreported as telemetry acceptance.
* `src/vs/platform/telemetry/test/browser/telemetryService.test.ts` and `test/common/serverTelemetryService.test.ts` exercise active behavior and are legacy baseline owners, not retained completion suites.
* Current telemetry tests also include `1dsAppender.test.ts`, `telemetryLogAppender.test.ts`, and `telemetryUtils.test.ts`; their eventual deletion/replacement belongs to I.ALL.
* Test selectors for current protected retained checks include `vs/platform/tunnel/test/common/tunnel.test`, `vs/platform/extensionManagement/test/common/extensionGalleryService.test`, and `vs/workbench/contrib/welcomeOnboarding/test/common/onboardingTypes.test`.
* Any expected-red API or process test is labeled as an observed baseline violation; test failure does not imply source implementation is complete.
* Product setting `telemetry.telemetryLevel=all`, old `telemetry.enableTelemetry=true`, and `telemetry.enableCrashReporter=true` must be inert across desktop, renderer, browser, shared, server and Node/worker hosts.
* Extension-host init/change `TelemetryLevel.USAGE`, `sendEventData`, `sendErrorData`, logger dispose and `flush` require counters; no actual endpoint/sender is permitted.
* `NullTelemetryServiceShape` is a constructor, while `NullTelemetryService` is the object. DI tests must prevent object-as-constructor misuse.
* Telemetry log output is distinct from ordinary `ILogService`/output/error messages; the protected fixture records the former without suppressing the latter.
* `DOTNET_CLI_TELEMETRY_OPTOUT` is verified by existing `processRunner.test.ts` and `probe.test.ts`; the external .NET runtime is not a Walker reporter.

## T7–T12 gallery, reporter, build and closure ledger

| Group / owner unit | Disjoint discovery roots and exact anchors | Calls/aliases/payload/dependency entries | State; retained boundary and test |
| --- | --- | --- | --- |
| T7 — extensions/gallery/API (`U11.g.*`) | `src/vs/platform/extensionManagement/**`, `workbench/contrib/extensions/**`, `workbench/services/extensionManagement/**`, `platform/externalServices/common/marketplace.ts`, API logger | `publicLog*`, gallery event schemas/durations, recommendation/runtime-state payloads, machine correlation headers, statistics POST and account-stat paths | pending; retain anonymous manifest/query/install/update/VSIX and product/version/User-Agent; gallery focused test + no forbidden header/stat counter |
| T8 — remote/network/security (`U11.h.*`) | remote authority, tunnel/Ports, server, network/proxy/metered/trust services, remote extension host | connect/metered/proxy/security classifications, init telemetry-level/channel, timers and IDs; classify ordinary connection tokens separately | pending; retain SSH, generic forwarding, proxy/security and remote extension host; tunnel/remote positive tests |
| T9 — retained bundled extensions (`U11.i.*`, B1–B8 cutoff) | all retained extension source/package/test roots, excluding deleted trees | direct reporters, reporter constructors, `TelemetryReporter` aliases, telemetry payload builders, dependencies and lock graphs | pending; own-feature tests/builds; all direct reporter users enumerate below |
| T10 — deleted feature credit (`U11.j.*`) | A/C trees: auth/provider/GitHub, Sync/cloud, chat/sessions/Agent Host/Copilot | direct reporter and callsite members vanish with their owning source/test/package; no duplicate B1–B8 or T1–T9 line credit | pending until physical A/C deletion; source/package/test/generated absence, not service cutoff |
| T11 — build/package/tooling (`U11.k.*`) | root/remote/extension manifests/locks, `build`, `scripts`, CLI and CI | `.build/telemetry/**`, 1DS/extractor deps, telemetry-docs mixin command, crash runner flags, telemetry-only product/CLI/schema/test setup | pending; retain generic package/license/native/release and test selectors; focused build/test checks |
| T12 — residual closure (`U11.l.*`) | full tracked source/test/package/config/artifact graph | aliases/cases, interface implementations, constructor/DI pass-through, event payload variables, IDs/timers/classifications, stale config and bundle references | pending; exact owning leaf or tested `retained-compatibility` / `retained-non-telemetry` disposition required |

### T7 exact gallery and extension-management telemetry members

| Path/member | Current reporting edge | Functional edge retained / future owner |
| --- | --- | --- |
| `src/vs/platform/externalServices/common/marketplace.ts:16–38` | settings-gated `getServiceMachineId`, `X-Market-User-Id`, `VSCode-SessionId`, service/telemetry DI params | **pruned (`u11.g.001`, 2026-10-08):** the stored service-machine identifier (`serviceMachineId.ts`, emptied for parent deletion), both correlation headers and the `X-Machine-Id` twin in `extensionResourceLoader` are gone; `resolveMarketplaceHeaders(version, productService)` keeps only `X-Market-Client-Id`/`User-Agent`, and product/version/User-Agent plus `X-Client-Name`/`X-Client-Version`/`X-Client-Commit` are retained. `extensionGalleryService.test.ts` asserts the headers stay functional and anonymous. |
| `src/vs/platform/extensionManagement/common/extensionGalleryService.ts:667,780,817,1080,1301,1479,1539,1636,1901` | additional query/name, engine fallback, query duration/count, latest and CDN fallback event calls | query/latest/download fallback operations; T7 |
| `extensionGalleryService.ts:1295–1301,1432–1479,1559–1636` | `StopWatch`/duration/count work adjacent to publicLog calls | Remove if only payload; retain independent download/query timing only with consumer evidence |
| `extensionGalleryService.ts:1649–1676` | `reportStatistic()` sends gallery statistics resource POST; telemetry bypass candidate | remove usage statistics request; preserve metadata, functional gallery requests, installs and local VSIX |
| `src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts:899` | uninstall calls `reportStatistic` | remove statistics call but not extension uninstall |
| `src/vs/workbench/services/extensionManagement/common/extensionManagement.ts:424` | public gallery interface exposes `reportStatistic` | remove/inert after caller graph; no broader extension-management facade deletion |
| `src/vs/workbench/services/extensionManagement/electron-browser/extensionGalleryAccountService.ts:104` | auth-check telemetry and account service | A/G1 account service deletion; credit T10, not T7 |
| `src/vs/workbench/contrib/extensions/browser/extensionEditor.ts:588` | open-extension event includes `extension.telemetryData` | render/details behavior remains; strip payload and sole-purpose computation |
| `src/vs/workbench/contrib/extensions/browser/extensionsActions.ts:602,2069` | install action and runtime-state event payload | install/runtime action remains; remove event-only data |
| `src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts:475,732,793,1171,1327,1793,2082` | README, missing gallery, metadata, installed IDs and updates | local workbench install/update lifecycle and read-only metadata remain |
| `extensionRecommendationNotificationService.ts`, `extensionRecommendationsService.ts`, `extensionsViews.ts` | install/show/cancel/search/recommendation callbacks | recommendation surface semantics are retained unless separate product owner says otherwise; remove only reporting payload |
| `src/vs/platform/extensionManagement/node/{extensionDownloader,extensionManagementService,extensionSignatureVerificationService}.ts` | retry/download/extraction/signature classifications and error data | downloads, extraction, signature enforcement and normal diagnostics remain |

### B1–B8 reporter package owners and source matches

This tracked search (`@vscode/extension-telemetry|createTelemetryReporter|TelemetryReporter|sendEventData|sendErrorData`) found **97 extension files** across 12 extension roots; 24 are `package.json`/`package-lock.json` manifest pairs. Reporter-path rows are assigned to their owner group; A/C-deleted roots receive T10 credit. The terms also match telemetry-only fixtures and vendor source, so each path needs semantic owner review rather than blind deletion.

| Owner | Matching tracked path | Assignment/status |
| --- | --- | --- |
| Copilot/T10 | `extensions/copilot/package.json` | T10 pending; deleted subtree |
| Copilot/T10 | `extensions/copilot/package-lock.json` | T10 pending; lock after subtree ownership |
| Copilot/T10 | `extensions/copilot/src/extension/completions-core/vscode-node/lib/src/snippy/telemetryHandlers.ts` | T10 pending; vendor reporter |
| Copilot/T10 | `extensions/copilot/src/extension/completions-core/vscode-node/lib/src/telemetry.ts` | T10 pending; vendor reporter |
| Copilot/T10 | `extensions/copilot/src/extension/completions-core/vscode-node/lib/src/test/context.ts` | T10 pending; telemetry test fixture |
| Copilot/T10 | `extensions/copilot/src/extension/completions-core/vscode-node/lib/src/test/noopTelemetry.ts` | T10 pending; telemetry test fixture |
| Copilot/T10 | `extensions/copilot/src/extension/completions-core/vscode-node/lib/src/test/telemetry.test.ts` | T10 pending; telemetry test fixture |
| Copilot/T10 | `extensions/copilot/src/extension/completions-core/vscode-node/lib/src/test/telemetry.ts` | T10 pending; telemetry test fixture |
| Copilot/T10 | `extensions/copilot/src/extension/completions-core/vscode-node/lib/src/test/telemetrySpy.ts` | T10 pending; telemetry test fixture |
| Copilot/T10 | `extensions/copilot/src/extension/log/vscode-node/loggingActions.ts` | T10 pending; vendor reporting helper |
| Copilot/T10 | `extensions/copilot/src/extension/prompt/node/feedbackGenerator.ts` | T10 pending; vendor reporting helper |
| Copilot/T10 | `extensions/copilot/src/extension/test/node/fixtures/gitdiff/03-large` | T10 pending; fixture match, inspect owner |
| Copilot/T10 | `extensions/copilot/src/extension/test/node/fixtures/gitdiff/03-large-many-changes` | T10 pending; fixture match, inspect owner |
| Copilot/T10 | `extensions/copilot/src/platform/telemetry/common/failingTelemetryReporter.ts` | T10 pending; direct infrastructure |
| Copilot/T10 | `extensions/copilot/src/platform/telemetry/common/ghTelemetryService.ts` | T10 pending; direct infrastructure |
| Copilot/T10 | `extensions/copilot/src/platform/telemetry/common/msftTelemetrySender.ts` | T10 pending; direct infrastructure |
| Copilot/T10 | `extensions/copilot/src/platform/telemetry/common/telemetry.ts` | T10 pending; direct infrastructure |
| Copilot/T10 | `extensions/copilot/src/platform/telemetry/node/azureInsightsReporter.ts` | T10 pending; direct infrastructure |
| Copilot/T10 | `extensions/copilot/src/platform/telemetry/node/spyingTelemetryService.ts` | T10 pending; test infrastructure |
| Copilot/T10 | `extensions/copilot/src/platform/telemetry/test/node/telemetry.spec.ts` | T10 pending; test tree |
| Copilot/T10 | `extensions/copilot/src/platform/telemetry/vscode-node/githubTelemetrySender.ts` | T10 pending; direct infrastructure |
| Copilot/T10 | `extensions/copilot/src/platform/telemetry/vscode-node/microsoftTelemetrySender.ts` | T10 pending; direct infrastructure |
| Copilot/T10 | `extensions/copilot/src/platform/telemetry/vscode-node/telemetryServiceImpl.ts` | T10 pending; direct infrastructure |
| Copilot/T10 | `extensions/copilot/src/platform/test/node/telemetryFake.ts` | T10 pending; fixture |
| Copilot/T10 | `extensions/copilot/test/simulation/fixtures/multiFileEdit/issue-8131/extension.ts` | T10 pending; fixture match |
| Git/B1 | `extensions/git/package.json` | B1 pending; direct dependency |
| Git/B1 | `extensions/git/package-lock.json` | B1 pending; lock closure |
| Git/B1 | `extensions/git/src/cloneManager.ts` | B1 pending; reporter injection/calls/payload |
| Git/B1 | `extensions/git/src/commands.ts` | B1 pending; reporter injection/calls/payload |
| Git/B1 | `extensions/git/src/main.ts` | B1 pending; reporter construction/DI |
| Git/B1 | `extensions/git/src/model.ts` | B1 pending; reporter injection/calls |
| Git/B1 | `extensions/git/src/repository.ts` | B1 pending; reporter injection/calls/payload |
| GitHub/T10 | `extensions/github/package.json` | T10 pending; deleted extension dependency |
| GitHub/T10 | `extensions/github/package-lock.json` | T10 pending; lock closure |
| GitHub/T10 | `extensions/github/src/branchProtection.ts` | T10 pending; direct reporter |
| GitHub/T10 | `extensions/github/src/extension.ts` | T10 pending; direct reporter |
| GitHub/T10 | `extensions/github/src/pushErrorHandler.ts` | T10 pending; direct reporter |
| GitHub auth/T10 | `extensions/github-authentication/package.json` | T10 pending; deleted provider reporter dependency |
| GitHub auth/T10 | `extensions/github-authentication/package-lock.json` | T10 pending; lock closure |
| GitHub auth/T10 | `extensions/github-authentication/src/common/experimentationService.ts` | T10 pending; reporter/experiment payload |
| GitHub auth/T10 | `extensions/github-authentication/src/github.ts` | T10 pending; reporter |
| HTML/B3 | `extensions/html-language-features/package.json` | B3 pending; direct dependency |
| HTML/B3 | `extensions/html-language-features/package-lock.json` | B3 pending; lock closure |
| HTML/B3 | `extensions/html-language-features/client/src/htmlClient.ts` | B3 pending; event payload/use |
| HTML/B3 | `extensions/html-language-features/client/src/node/htmlClientMain.ts` | B3 pending; reporter construction |
| JSON/B4 | `extensions/json-language-features/package.json` | B4 pending; direct dependency |
| JSON/B4 | `extensions/json-language-features/package-lock.json` | B4 pending; lock closure |
| JSON/B4 | `extensions/json-language-features/client/src/jsonClient.ts` | B4 pending; event payload/use |
| JSON/B4 | `extensions/json-language-features/client/src/node/jsonClientMain.ts` | B4 pending; reporter construction |
| JSON/B4 | `extensions/json-language-features/client/src/test/schemaRequestTestUtils.ts` | B4 pending; fixture match |
| Markdown/B5 | `extensions/markdown-language-features/package.json` | B5 pending; direct dependency |
| Markdown/B5 | `extensions/markdown-language-features/package-lock.json` | B5 pending; lock closure |
| Markdown/B5 | `extensions/markdown-language-features/src/commands/index.ts` | B5 pending; reporter payload/call |
| Markdown/B5 | `extensions/markdown-language-features/src/commands/showPreview.ts` | B5 pending; reporter payload/call |
| Markdown/B5 | `extensions/markdown-language-features/src/extension.shared.ts` | B5 pending; reporter DI |
| Markdown/B5 | `extensions/markdown-language-features/src/telemetryReporter.ts` | B5 pending; reporter wrapper |
| Media/B7 | `extensions/media-preview/package.json` | B7 pending; direct dependency |
| Media/B7 | `extensions/media-preview/package-lock.json` | B7 pending; lock closure |
| Merge conflict/B6 | `extensions/merge-conflict/package.json` | B6 pending; direct dependency |
| Merge conflict/B6 | `extensions/merge-conflict/package-lock.json` | B6 pending; lock closure |
| Merge conflict/B6 | `extensions/merge-conflict/src/documentMergeConflict.ts` | B6 pending; reporter injection |
| Merge conflict/B6 | `extensions/merge-conflict/src/documentTracker.ts` | B6 pending; reporter call |
| Merge conflict/B6 | `extensions/merge-conflict/src/mergeConflictParser.ts` | B6 pending; reporter call |
| Merge conflict/B6 | `extensions/merge-conflict/src/services.ts` | B6 pending; reporter construction |
| Microsoft auth/T10 | `extensions/microsoft-authentication/package.json` | T10 pending; deleted provider reporter dependency |
| Microsoft auth/T10 | `extensions/microsoft-authentication/package-lock.json` | T10 pending; lock closure |
| Microsoft auth/T10 | `extensions/microsoft-authentication/src/common/loggerOptions.ts` | T10 pending; telemetry logger options |
| Microsoft auth/T10 | `extensions/microsoft-authentication/src/common/telemetryReporter.ts` | T10 pending; direct reporter |
| Microsoft auth/T10 | `extensions/microsoft-authentication/src/extension.ts` | T10 pending; reporter construction |
| Microsoft auth/T10 | `extensions/microsoft-authentication/src/node/authProvider.ts` | T10 pending; reporter use |
| Microsoft auth/T10 | `extensions/microsoft-authentication/src/node/cachedPublicClientApplication.ts` | T10 pending; reporter use |
| Microsoft auth/T10 | `extensions/microsoft-authentication/src/node/publicClientCache.ts` | T10 pending; reporter use |
| Simple browser/B8 | `extensions/simple-browser/package.json` | B8 pending; direct dependency |
| Simple browser/B8 | `extensions/simple-browser/package-lock.json` | B8 pending; lock closure |
| TypeScript/B2 | `extensions/typescript-language-features/package.json` | B2 pending; direct dependency |
| TypeScript/B2 | `extensions/typescript-language-features/package-lock.json` | B2 pending; lock closure |
| TypeScript/B2 | `extensions/typescript-language-features/src/experimentTelemetryReporter.ts` | B2 pending; reporter wrapper |
| TypeScript/B2 | `extensions/typescript-language-features/src/experimentationService.ts` | B2 pending; experiment payload |
| TypeScript/B2 | `extensions/typescript-language-features/src/extension.browser.ts` | B2 pending; reporter construction |
| TypeScript/B2 | `extensions/typescript-language-features/src/extension.ts` | B2 pending; reporter construction |
| TypeScript/B2 | `extensions/typescript-language-features/src/languageFeatures/completions.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/languageFeatures/diagnostics.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/languageFeatures/inlayHints.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/languageFeatures/organizeImports.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/languageFeatures/quickFix.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/languageFeatures/refactor.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/languageFeatures/util/copilot.ts` | B2 pending; classify remaining Chat/Copilot inbound uses first |
| TypeScript/B2 | `extensions/typescript-language-features/src/languageProvider.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/lazyClientHost.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/logging/telemetry.ts` | B2 pending; report-only helper |
| TypeScript/B2 | `extensions/typescript-language-features/src/test/unit/server.test.ts` | B2 pending; fixture match |
| TypeScript/B2 | `extensions/typescript-language-features/src/tsServer/server.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/tsServer/spawner.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/typeScriptServiceClientHost.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/typescriptService.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/typescriptServiceClient.ts` | B2 pending; payload/calls |
| TypeScript/B2 | `extensions/typescript-language-features/src/ui/largeProjectStatus.ts` | B2 pending; payload/calls |

Reporter search output above includes 97 exact paths: Copilot 25, Git 7, GitHub 5, GitHub Authentication 4, HTML 4, JSON 5, Markdown 6, Media Preview 2, Merge Conflict 6, Microsoft Authentication 8, Simple Browser 2, TypeScript 23. Each root's manifest and lock are separate changed files, not netted; T10's deleted trees are credited once.

### T10–T12, dependencies and packaging artifacts

| Exact manifest/artifact | Current observation | Owner/status/test |
| --- | --- | --- |
| `package.json` + `package-lock.json`: `@microsoft/1ds-core-js`, `@microsoft/1ds-post-js` | root package direct 1DS dependencies | I.ALL/T11 pending; remove after all core clients are unregistered |
| `remote/package.json` + lock; `remote/web/package.json` + lock: 1DS packages | server and web package graphs have explicit 1DS deps | I5/T11 pending; generic remote packaging remains |
| `package.json` + lock: `@vscode/telemetry-extractor` | telemetry-docs/extractor build dependency | T11 pending; test runner/build metadata retained |
| extension `package.json` + lock pairs | 24 reporter dependency manifests/locks in the 12 roots listed above | B1–B8/T10 pending; remove per extension only after source call pruning |
| `build/gulpfile.vscode.ts:236,307` | packages `.build/telemetry/**` stream in desktop product | I.ALL/T11 pending; no telemetry artifacts in final package |
| `build/npm/mixin-telemetry-docs.ts` and root `mixin-telemetry-docs` script | script contains `rmSync` of an existing docs path and `git clone` to refresh telemetry docs | do **not** execute in this task; T11 reviews/removes only in an authorized safe leaf |
| `src/vs/platform/telemetry/{common,electron-main,node}/` | common service/1DS/custom endpoint/error/log appender implementations and IDs | I.ALL/T1 pending; no broad request library deletion |
| test runners | `scripts/test.sh` passes `--crash-reporter-directory`; integration runner lists auth/Copilot and Agent Host E2E tails | I7/T11 pending; preserve focused `--run`/`--suite` functionality |
| .NET toolchain | `extensions/dotnet-toolchain/src/probe.ts`, `src/test/probe.test.ts`, `processRunner.test.ts` | `DOTNET_CLI_TELEMETRY_OPTOUT=1` protected; status `retained-non-telemetry`, tests exist |
| deleted feature reporter owners | A/C extension/manifests/locks and telemetry members | T10 pending until physical source/package/test/generated removal |
| final residual search | case variants/aliases plus calls, constructor injection, payload-only data, deps and generated artifacts | T12 pending; no permanent backlog allowed |

### Focused test and state mapping for T7–T12

* T7 gallery positive test: `./scripts/test.sh --run vs/platform/extensionManagement/test/common/extensionGalleryService.test`; it currently asserts an `X-Market-User-Id` machine header and must be changed in a later T7 leaf, not treated as green acceptance now.
* T7 must count both gallery query/download operations and forbidden statistics POSTs/correlation headers; metadata/search/install functionality is not a report.
* T8 positive test: `./scripts/test.sh --run vs/platform/tunnel/test/common/tunnel.test`; actual SSH/Ports smoke belongs to U12 and no credentials were read.
* T9 direct reporters use their existing extension tests/builds; authorized U00 Git evidence uses the Git integration selector, not newly invoked extension scripts.
* T10 closure must reconcile physical deletion including associated tests, manifests, locks and generated/vendor files; I cutoff alone leaves all current T statuses open.
* T11 has no build verification in U00; `npm run typecheck --prefix build` is authorized for the U00 stage only after fixture work, not permission to modify tooling files.
* T12 search results must classify a match by behavior and owning path; comments/docs/fixtures may be retained as test data only when they do not ship or reconstruct telemetry.
* Test payloads use counters and dummy values only; no real telemetry endpoint, Open VSX request, service machine ID or third-party credential was contacted.
* `scripts/test.sh` and integration runner contents were read for crash/auth/Copilot/Agent Host tails; no runner was edited in U00.

<!-- end U00.b ledger -->

## U11 pruning progress — pass 1 (2026-10-08; T1/T3/T7/T8/T11 partial)

Group states stay `pending` until every entry in the group closes; the rows below record what this pass actually retired and what remains. Measured diff: 39 source/test files, +109/−1,746 authored lines (`git diff --shortstat -- src`).

| Closed entry | Leaf | Evidence |
| --- | --- | --- |
| T1.003 power suspend/resume, T1.004 GPU crash fallback, T1.005 network-process events, T1.006 `osProxyConfig` payload+timer | `u11.a.001` | `app.ts` has no `ITelemetryService`/`TelemetryLevel` usage; `productDebloat.test.ts` (9 passing) + `typecheck-client` |
| Metered-connection state reporting (`meteredConnectionStateChange`, `setTelemetryService`) | `u11.a.001` | `meteredConnectionMainService.ts` keeps only the deferred-init + state propagation behavior |
| T1.002 identity payload, T1.009 common properties, T1.010 machine/SQM/device ID resolution | `u11.a.002` | `platform/telemetry/electron-main/telemetryUtils.ts` emptied (parent-deletion manifest); no `machineIdKey`/`sqmIdKey`/`devDeviceIdKey` remains; stored state untouched |
| Shared-process `clientPlatformInfo` + Linux distro/DE payload reads; server `serverStart`/`serverPlatformInfo` | `u11.a.003` | no `publicLog` remains in `sharedProcessMain.ts` or `remoteExtensionHostAgentServer.ts` |
| Workbench call-site contribution (`workspaceLoad`, `fileGet`, `filePUT`, configuration-setting events) | `u11.c.001` | contribution emptied + unregistered; `productDebloat.test.ts` and `productDebloatChatIntegrations.test.ts` assert the absence |
| Effective-policy telemetry (`policy.applied`) + its obsolete suite | `u11.c.002` | contribution and test emptied + unregistered; generic policy suites untouched |
| Marketplace/gallery correlation identity (`getServiceMachineId`, `X-Market-User-Id`, `VSCode-SessionId`, `X-Machine-Id`) | `u11.g.001` | `serviceMachineId.ts` emptied; gallery suite 38 passing with the anonymous-header assertion |
| Release-notes marketing attribution gated on telemetry settings | `u11.c.003` | `addGAParameters`/utm parameters removed; release-note links open unchanged |
| Remote `updateTelemetryLevel` / `logTelemetry` / `flushTelemetry` RPC + propagation contribution | `u11.h.001` | the `telemetry` channel client and the `updateTelemetryLevel` remote RPC are gone; `getRoundTripTime` uses the retained remote-extension-environment channel |
| `telemetry.telemetryLevel` / `telemetry.enableTelemetry` registrations; `telemetry.enableCrashReporter` registration | `u11.k.001` | `platform/telemetry/common/telemetryService.ts` now registers only the retained `telemetry.feedback.enabled`; `desktop.contribution.ts` lost the crash-reporter setting |

### Retained / regressed items handled in the same pass

* **U10 regression fixed:** the retained non-telemetry `telemetry.feedback.enabled` setting (read by the issue reporter, NPS survey and relauncher) had been silently unregistered when U10 removed its renderer side-effect importer. `u11.k.001` restores that registration from `workbench.common.main.ts` with unchanged type/default/description/policy. This keeps the `EnableFeedback` policy entry in `build/lib/policies/policyData.jsonc` matched; the `TelemetryLevel` policy entry has no registration and is a recorded T11 residual.
* **Latency measurement:** `remoteConnectionLatencyMeasurer`/`getRoundTripTime` is retained (it drives the remote indicator tooltip and diagnostic-info latency), but it was already non-functional after U10 removed the telemetry channel's `ping` handler. The `RemoteConnectionLatencyClassification` event in `contrib/remote/browser/remoteConnectionHealth.ts` remains a T8 residual.
* **`disable-telemetry` argv** is retained as a documented inert invocation-compatibility input because the integration runners, the smoke runner and `extensions/vscode-test-resolver` still pass it; `telemetry-level`, `crash-reporter-directory` and `crash-reporter-id` remain T11 residual work together with their `environmentService` getters, `desktop.contribution.ts` argv help entries and `server.cli.ts` validation.

### Focused selectors run in this pass

`./scripts/test.sh --run vs/platform/telemetry/test/common/nullTelemetryService.test` (2 passing) · `vs/code/test/electron-main/productDebloat.test` (9) · `vs/workbench/test/browser/productDebloatChatIntegrations.test` (30) · `vs/workbench/api/test/common/accountFreeApi.test` (10) · `vs/platform/extensionManagement/test/common/extensionGalleryService.test` (38) · `npm run typecheck-client` (exit 0) · `npm run compile-client` (exit 0).
