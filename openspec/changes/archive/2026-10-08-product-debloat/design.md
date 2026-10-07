# Design: Account-Free Product Debloat

## Status, inputs, and resolved gates

Approved proposal; parent preflight: execution `auto`, artifact store `openspec`, delivery `ask-on-risk`, review budget 400 additions + deletions. The parent has resolved the gallery provider as **Open VSX (`open-vsx.org`)** and the workload strategy as **subsystem-bounded units on a `feature-branch-chain`**; `size:exception` was explicitly declined. All four domain specs, including the updated protected-boundary gallery criterion, were read back before this bounded finalization pass. No implementation, tests, builds, network probes, or commits were performed during planning.

Domains are inferred from the proposal's capability sections because it has no formal Capabilities heading: `accounts-removal`, `chat-agent-removal`, `telemetry-removal`, and `protected-boundaries`. None has a canonical spec, competing active domain change, or legacy flat change spec. Existing canonical `dotnet-toolchain` and `welcome-onboarding` specs are retained unchanged; they establish protected regression contracts, not new work. `openspec/config.yaml` has no additional spec/design/task rules and `strict_tdd` is false. Tests already exist, so tasks nevertheless use RED → GREEN → TRIANGULATE → REFACTOR.

**Resolved decisions:**

1. **Gallery:** establish the packaged anonymous Open VSX baseline through the Walker distribution mixin below. Microsoft-only C# Dev Kit/Copilot availability is an acknowledged provider gap, not an acceptance failure; acquisition verification uses an Open-VSX-available C# extension.
2. **Delivery:** each review leaf targets <=400 additions + deletions, including its tests, on the approved `feature-branch-chain`. Large deletion families split at ownership/member/test/package seams; no size exception is authorized.

The rest of the architecture is unchanged. Planning is ready for bounded apply; real package/provider behavior still requires implementation verification.

## D1 — Gallery evidence and concrete Open VSX configuration contract

### Evidence inspected

| Evidence | Finding |
| --- | --- |
| Root `product.json` | Walker identity and defaultChatAgent exist; `extensionsGallery` does not. |
| `build/hygiene.ts:95` | Rejects `extensionsGallery` in the checked-in root product. Adding an endpoint there is not an established configuration mechanism. |
| `src/bootstrap-meta.ts` | Source startup reads root product; `product.overrides.json` is loaded only with `VSCODE_DEV`. |
| Root `product.overrides.json` | Absent in this checkout (direct read returned ENOENT). Even a dev override would not prove normal packaged desktop behavior. |
| `build/gulpfile.vscode.ts:199–225` | Desktop package starts from root product and stamps commit/date/version/checksums/Copilot/agent SDK/dictation fields; this stage does not introduce a gallery. |
| `build/azure-pipelines/distro/mixin-quality.ts` | Can replace the root product from `.build/distro/mixin/${VSCODE_QUALITY}/product.json` before packaging. Its merge preserves selected extension lists, not arbitrary OSS identity fields; using an upstream mixin blindly could undo Walker identity and restore removed features. |
| `.build/distro/mixin/{stable,insider}/product.json` | Both absent (direct reads returned ENOENT); no effective Walker distro product was available. |
| Prior expected `../VSCode-linux-x64/resources/app/product.json` | Absent now. Archived .NET packaging reports are historical evidence, not today's effective product. Built-in extension downloads also do not prove the interactive desktop gallery. |
| Platform `extensionGalleryManifestService.ts` | `serviceUrl` missing → Unavailable/null. |
| Workbench electron-browser `extensionGalleryManifestService.ts` | Default anonymous manifest requires the product service URL. A configured enterprise service currently enters an account-service path; a user setting alone does not establish the missing default. |

**Pre-change baseline:** with the inspected inputs, ordinary local desktop packaging has no established gallery. The approved Open VSX choice resolves that missing-provider decision; supplying its effective packaged configuration is now implementation work, not a pending product choice. Browser development templates, mocks, historical downloads, and installed extensions still do not prove packaged behavior.

### Selected mechanism: Walker packaging-time distribution mixin

Commit the provider configuration as **`build/distro/walker/gallery.json`**, separate from the hygiene-rejected root product field. Add **`build/lib/walkerProduct.ts`** to load/validate that build input and compose only its gallery data into the packaging stream's base product. Invoke this helper inside the existing `productJsonStream` JSON transform in **`build/gulpfile.vscode.ts`** and **`build/gulpfile.reh.ts`**, before serializing `productJsonContents`. Those files already pass the same product contents to `productJsonFn`, so the emitted `resources/app/product.json` and embedded Electron/server bootstrap product receive identical effective configuration. Preserve Walker identity, release stamps, and retained built-in lists; do not allow this gallery mixin to replace unrelated product fields.

This is the concrete packaging-time distribution-input mechanism selected from the earlier distro-mixin design. **Do not execute upstream `mixin-quality.ts` against the working checkout**: it rewrites root product.json and replaces identity fields. Its full-product external mixin mechanism is evidence of the upstream distribution boundary, not the chosen Walker implementation. Do not add `extensionsGallery` to checked-in root `product.json`, change its hygiene rule, depend on an absent external distro, or use `VSCODE_DEV`/product.overrides as the release configuration. The small Walker mixin is always applied by normal desktop/retained-REH packaging, with no provider-selection flag or authentication fallback.

The committed mixin contains these Open VSX values:

| Distribution input | Value | Effective runtime field |
| --- | --- | --- |
| `serviceUrl` | `https://open-vsx.org/vscode/gallery` | `extensionsGallery.serviceUrl` |
| `itemUrl` | `https://open-vsx.org/vscode/item` | `extensionsGallery.itemUrl` |
| `resourceUrlTemplate` | `https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}` | `extensionsGallery.resourceUrlTemplate` |
| `controlApiUrl` | `https://open-vsx.org/vscode/gallery/control` | `extensionsGallery.controlUrl` |

**Field mapping is intentional:** this checkout consumes `controlUrl` (`IProductConfiguration` and `ExtensionGalleryService`), not `controlApiUrl`; normalize the distribution-input name rather than writing an unused runtime key. Reflect the consumed `itemUrl`/optional Open VSX fields in the narrow product type contract as needed; do not invent Microsoft endpoint/NLS values to fill unsupported optional fields. Required normal gallery/version/User-Agent headers remain non-identifying. Validate actual endpoint responses during packaged verification, including the control API; endpoint failure is an engineering/provider-availability failure, never grounds for switching provider, adding accounts, or restoring telemetry.

Add **`build/lib/test/walkerProduct.test.ts`** for exact quartet/mapping, missing/malformed mixin rejection, unchanged Walker identity/built-ins/root product, matching serialized/embedded desktop+server configuration, and absent account/Copilot/telemetry wiring after their removals. Each fixture phase follows its removal prerequisite rather than demanding all source deletion in the first gallery leaf. No new gallery adapter is required: use Open VSX's VS Code-compatible API with the retained client.

### Known extension availability gap

C# Dev Kit and Copilot are Microsoft-only and not on Open VSX. Record that expected gap in the implementation evidence; do not fail gallery acceptance for it or try Microsoft Marketplace/sign-in fallback. Select a suitable **actually listed Open VSX C# extension** through the registry query at verification time and record publisher/ID/version/license, dependency availability and anonymous acquisition results. Do not fabricate current availability or present acquisition as C# language integration. Failure to acquire that selected available extension remains a real functional failure.

### Anonymous gallery data flow

Packaged Open VSX mixin → effective product's anonymous gallery → retained manifest service → generic manifest IPC to shared/remote contexts → retained `IExtensionGalleryService` → extension-management download/install/update/dependency/VSIX operations. Keep gallery manifest IPC: it is not telemetry IPC. Delete `extensionGalleryAccount` contracts/implementations/registrations, auth dependencies, and sign-in UI/actions in `extensionsViewlet.ts`, `extensions.contribution.ts`, and `RatingsWidget` in `extensionsWidgets.ts`.

A persisted **account-gated private** gallery configuration becomes unavailable/unsupported, with ordinary localized diagnostics and no login or silent fallback to another provider. Do not migrate its endpoint or erase its setting. Default anonymous access uses only the approved Open VSX packaging mixin. Access errors never activate a provider. Read-only ratings/install counts remain; account-required external review links disappear.

`src/vs/platform/externalServices/common/marketplace.ts` currently conditionally builds `X-Market-User-Id` and `VSCode-SessionId` using a stored service-machine ID and telemetry settings. Remove that collection/correlation path and its unused DI parameters; preserve functional product/version/User-Agent headers. The comment that the marketplace may reject missing session headers makes **real provider verification mandatory**, not permission to invent a persistent identifier. Query telemetry/correlation payloads and `extensionGalleryService.ts:reportStatistic` usage-reporting requests join the telemetry pruning inventory; preserve metadata reads and ordinary download requests. Gallery failure is not an excuse to restore telemetry.

Rejected alternatives: declaring marketplace preserved because service code exists; copying browser-dev URLs; root `product.json` endpoint addition despite hygiene; quietly falling back from an enterprise gallery; keeping account service behind an anonymous default.

## D2 — Remove account implementations; retain only an inert public facade

### Boundary and public contract

Implement the inert boundary first in the extension API facade, then remove the workbench/RPC infrastructure once its internal consumers have been disconnected. The small common compatibility module may retain the `extHostAuthentication.ts` filename, but **not its provider maps, RPC interface, DI service implementation, imports of authentication services, OAuth helpers, token store, or subclasses**. Both Node and worker API factories use the same pure behavior.

| Public operation | Deterministic behavior |
| --- | --- |
| `authentication.getSession` without truthy create/force options (including silent/challenge/issuer inspection) | Resolved `undefined`; no provider validation/discovery/network. |
| `getSession` with truthy `createIfNone`/`forceNewSession` | Rejected Error with stable `name = 'AuthenticationUnsupported'` and `code = 'WALKER_AUTHENTICATION_UNSUPPORTED'`; localized explanatory message, no UI. |
| `authentication.getAccounts` | Resolved empty array. |
| Proposed `hasSession` if its signature remains | Resolved false, retaining applicable proposal guards. |
| `registerAuthenticationProvider` | Synchronous unsupported Error with the same stable identity; do not subscribe to or invoke the supplied provider. |
| `onDidChangeSessions` | `Event.None` adapted to the public event; subscriptions are disposable and never emit. |

This is API source-shape compatibility, not authentication capability. Remove main-thread auth registration and `MainThreadAuthenticationShape`/`ExtHostAuthenticationShape` RPC messages, `mainThreadAuthentication.ts`, Node `extHostAuthentication.ts`, dynamic/XAA/loopback implementations, browser authentication contribution, provider extension points, and the entire workbench authentication service graph after consumers are removed. Stable public `.d.ts` types may remain where required to compile ordinary extensions; dead internal/proposed-only declarations and proposal wiring are removed by consumer inventory. No service-side NullAuthenticationService retaining provider/session/consent infrastructure is allowed.

Inspect `contrib/mcp` and API helpers outside chat: `mcpServerActions.ts`, `mcpCommands.ts`, configuration/language lenses, ext-host dynamic OAuth and XAA paths. Remove OAuth sign-in, client-secret enrollment UI and dynamic provider activation. If a remaining MCP function has a non-account consumer, preserve only that independent behavior; requests requiring authentication fail unsupported without discovery/refresh. Do not delete unrelated request/proxy/secret-storage/URI infrastructure or claim to sandbox third-party extensions.

### Account and cloud ownership inventory

| Owner/unit family | Remove/disconnect | Retained boundary |
| --- | --- | --- |
| A1/A2 — API/core auth | `contrib/authentication`, `services/authentication`, main/ext-host bridges, callback/device/XAA/dynamic auth implementation and obsolete tests | Pure inert public facade; ordinary API/RPC/URL handling and unrelated secrets |
| A3 — accounts UI | `globalCompositeBar.ts`, titlebar part/actions, account visibility/badges/menus/settings, default-account services discovered through references | Global/titlebar layout and other controls |
| A4 — provider extensions | `extensions/github-authentication`, `extensions/microsoft-authentication`, manifest/proposals/npm/build/package discovery | OS Git credentials and generic HTTPS/proxy |
| A5 — cloud sync | `contrib/userDataSync`, `services/userDataSync`, `platform/userDataSync` transports/auto-initialization/account/profile sync, shared/main/web registrations | `platform/userDataProfile`, local settings/profiles, profile import/export and unrelated extension policy |
| A6 — cloud continuation | `contrib/editSessions`, cloud services/storage/extension points and direct Continue On links | Local workspace restoration and local files |
| A7 — cloud tunnels/CLI | `contrib/remoteTunnel`, `platform/remoteTunnel`, cloud tunnel launch/login/service wiring; `extensions/tunnel-forwarding` account provider | Generic `platform/tunnel`, workbench remote/Ports, retained server launch and SSH/key transport |
| A8 — GitHub integration | `extensions/github` and its discovery/dependencies/menu/proposal references | `extensions/git`, `git-base`; remote URL handling independent of hostname |
| G1/G2 — gallery | Account services/private-account branch/sign-in/rating prompts and telemetry correlation/stat requests | Authorized anonymous client and manifest/install/dependency/VSIX services |

**Engineering choice: delete the whole bundled GitHub extension.** Inspected activation always creates a telemetry reporter/Octokit service and registers OAuth credential provider, publisher, branch protection and history enrichments. Even its remote-source search calls `getOctokit()` and authenticated-user listing; simple browser links/canonical-URI behavior do not justify keeping an account-oriented integration or building a new anonymous provider. No plain-Git function depends on keeping it. Removing GitHub web enrichments is inside the approved integration removal; do not recreate them elsewhere.

**Cloud forwarding is not generic forwarding.** `extensions/tunnel-forwarding/src/extension.ts:setupPortForwardingProcess` calls GitHub `getSession(...createIfNone: true)` and invokes `tunnel forward-internal` with an access token. Remove that bundled cloud provider, not `platform/tunnel`, remote Ports, SSH forwarding or ordinary terminal connectivity. Rust `cli/src/auth.rs` implements GitHub/Microsoft device/token endpoints. Remove account/cloud command paths and agent supervisor hooks by reachability; keep generic local/serve-web/server/version/download/stdio primitives where independent of accounts. `cli/src/tunnels/local_forwarding.rs` and server bridges need consumer-based classification rather than blanket folder deletion. Add Cargo checks/tests when that graph changes; do not remove generic server connection tokens/VSDA merely for containing “auth”.

Sync shares some profile/extension helpers with local functionality. Audit each cross-boundary reference before deleting `platform/userDataSync`; extract truly local helper behavior to its existing profile/extension-management layer with parity tests. Retaining Sync transports, services or log channels as inert compatibility is not permitted.

## D3 — Git carve-out and protected state

Git invokes the user's OS Git executable and retains credential-helper/SSH-agent behavior. `extensions/git/src/askpass.ts` owns Git IPC, HTTPS username/password caching/prompts, `GIT_ASKPASS`, SSH passphrase and host confirmation, and terminal authentication environment. Keep these paths, askpass scripts/manager, and normal `registerCredentialsProvider` Git API when independently useful; deleting the GitHub OAuth registrant does **not** authorize deleting Git's generic credential-provider abstraction. No hostname denylist, GitHub special rejection, or interception through inert `vscode.authentication`.

Tests triangulate a controlled plain remote, a self-hosted-style SSH/HTTPS remote, and github.com URL dispatch. Unit URL tests do not prove real hosted permissions; live Git smoke requires an authorized test repository/key/helper, never a user's production repository or account. Use temporary repositories/keys/credential-helper fixtures with explicit cleanup. Preserve existing Git/askpass/cache tests and add missing askpass cancellation/passphrase/host-confirmation coverage. Strip Git telemetry separately from commands/model/repository/clone logic and preserve its log output.

Upgrade is **read-ignore**, not deletion: remove readers, startup initializers, refresh timers, enrollment/callback handlers, and restoration paths for account/sync/tunnel/edit/chat/agents. No migration enumerates/deletes secrets, invokes sign-out, revokes tokens or erases local profile/agent directories. Normal storage migrations unrelated to removed features continue. Seed a copied throwaway persisted profile; sentinel unrelated secrets, profile files, repositories, installed extensions, SSH files, and OS-helper fixture data must survive restart/profile switching. Remote service data is never touched. Unknown legacy setting/argv fields can remain on disk; removed enablement is not interpreted. Legacy obsolete telemetry/crash flags, if accepted for invocation compatibility, are undocumented inert inputs with explicit tests and an inventory reason, not a reporting configuration API.

Preserve existing `.NET Toolchain`/`Welcome Onboarding` canonical behavior, managed SDK data, and the toolchain's explicit external-runtime telemetry opt-out environment values. `DOTNET_CLI_TELEMETRY_OPTOUT` is a protected suppression control, not Walker reporting instrumentation to delete by string search. Remove direct dead command links and auth/chat-only helper imports such as the onboarding chat setup runner where still referenced; broader welcome prose/tips are recorded as follow-ups, not redesigned.

## D4 — Dependency-aware chat, Agents Window, and Agent Host deletion

### Ordered source graph work

1. Inventory inbound imports/re-exports, DI constructors, contribution/extension-point registrations, product/config/URL/menu IDs, resources, build entrypoints, and test imports. Disconnect product activation and public API feature bridges first, retaining only inert public signatures if needed by the existing `typeof vscode` API factory.
2. Remove chat integrations from retained notebook/editor/inline-completion/terminal/SCM/debug/search/accessibility/getting-started code and test services. Extract a helper only after proving its semantics are feature-neutral and its new location obeys base → platform → editor → workbench. Do not transplant chat services/types into a “compat” tree.
3. Remove agent/session/feature consumers in reverse dependency order, then their internal dependency leaves. Intermediate disconnected source is a removal staging state, never final compliance or a release. Do not add feature flags that can reconnect it.
4. Remove Copilot SDK/bundled-extension/runtime/build references and obsolete CI/test fixtures; build only from clean generated outputs so deleted code cannot survive through old `out` or `.build/extensions` assets.

### Compile/package inventory

| Owner/unit family | Required source deletions and discovery tails |
| --- | --- |
| C1 — product/entrypoints | Chat/setup/defaultChatAgent/Copilot links, trusted auth/proposal wiring, auto-update list, sessions-window allowlist and agent product fields; `workbench.{common,desktop,web}.main.ts`; related configuration schema/context/menu/URL/window restoration references |
| C2 — API | `mainThreadChat*`, `mainThreadLanguageModels.ts`, `mainThreadLanguageModelTools.ts`, `mainThreadAgentEditorComments.ts`, corresponding `extHostChat*`/language-model/tools/comments modules; `extHost.api.impl.ts`, `extHost.protocol.ts`, service registries, `extHostTypeConverters.ts`, affected `extHostTypes.ts`/public proposal tables and API tests |
| C3 — external integrations | Notebook controller chat/contrib helpers, terminal inline hints/chat, editor/SCM/debug AI integrations, chat entitlement/default-account imports, `welcomeAgentSessions`, `agentsVoice` and other agent-only contributions; `workbench/test/{browser,electron-browser}/workbenchTestServices.ts` and component fixtures |
| C4 — chat | All `src/vs/workbench/contrib/chat/` source/tests/styles/assets and chat-only `services/chat` such as entitlement; no shadow subtree |
| C5 — Agents Window | All `src/vs/sessions/`, desktop/web entrypoints/HTML/assets; `build/next/index.ts` sessions desktop/web entries/conditional builds; gulp/rspack/vite/component/layer/test registration tails and sessions icons where exclusively owned |
| C6 — Agent Host | All `platform/agentHost`, `workbench/services/agentHost`, `server/node/agentHostChannel.ts`; `app.ts` `ElectronAgentHostStarter`/`AgentHostProcessManager` construction and session-link opening; agent-only server channels/startup/scripts, CLI supervisor/registry/agent-host paths |
| C7 — Copilot extension | All `extensions/copilot`, npm discovery (`build/npm/dirs.ts`), build/watch/setup/perf scripts, built-in extension packaging (`build/lib/extensions.ts`), extension proposal grants and Copilot-only test/CI jobs |
| P1/P2 — native/build tail | `@github/copilot-sdk`, platform/runtime/tgrep/prebuild filters/copy streams, runtime-version validation/stamping, shim calls in desktop/REH gulp files, `build/lib/copilot.ts`, `build/lib/test/copilot.test.ts`, Agent Host note in `build/.moduleignore`, `build/darwin/verify-macho.ts` Copilot paths, root/remote/extension lockfiles |
| P3 — other agent-owned tails | `build/agent-sdk` producers/results stamping/CI hooks, `build/codex` generated-protocol tooling where exclusively Agent Host-owned, dictation-runtime/agents-voice payload production where its only consumers are deleted; agent-only Anthropic/Codex/Copilot/foundry/MXC dependencies after inbound-use audit |

Keep root stable public declarations as necessary for ordinary extension compilation, with tiny facade-level empty discovery/unsupported failure behavior for unavoidable `chat`/`lm` members. Use stable Error name/code (`ChatUnsupported`/`WALKER_CHAT_UNSUPPORTED`) for invoking removed capabilities. These functions have no DI service, provider registry, model, event pipeline, IPC, or chat imports; no retained `mainThreadChat`/`extHostChat` implementation. Strip proposed-only machinery whose consumers disappear. Ordinary commands/documents/diagnostics/SCM/terminal APIs need activation regression tests. Compatibility is not a replacement AI system.

### Feature-neutral packaging extraction

`build/lib/copilot.ts` also owns `getRipgrepExcludeFilter`, used by both `gulpfile.vscode.ts` and `gulpfile.reh.ts`. Extract **only** ordinary `@vscode/ripgrep-universal` target-platform filtering to a narrow build utility (e.g. `build/lib/ripgrep.ts`) with independent platform fixtures before deleting the Copilot module. Inspect `toNodePlatformArch` needs without carrying over Copilot package selection. Keep generic `build/lib/npmPackage.ts` helpers if other consumers remain. MXC filters, Copilot SDK/ripgrep shim, runtime prebuild fetching and Copilot-specific Mach-O allowances disappear when their agent consumers do. Other unrelated native filters remain.

## D5 — Telemetry stage 1: irreversible reporting cutoff, reversible safe code work

### Minimal service and process contract

`NullTelemetryService` in `telemetryUtils.ts` is a singleton **object**; `NullTelemetryServiceShape` is a constructor. Use the object with `ServiceCollection.set`, or the dependency-free shape with `SyncDescriptor`/`registerSingleton`; never pass the singleton object as a service constructor. Reduce remaining common telemetry modules to a minimal contract/no-op implementation. Keep the no-op DI contract temporarily for unpruned constructors and permanently only for the documented process/public compatibility boundary. No settings-dependent wrapper may reconstruct a reporting service.

No-op state is NONE/false and methods have no side effects. Required telemetry-info public fields use documented fixed non-identifying sentinels rather than collecting machine/device/session IDs. Remove telemetry-only ID generation/storage/queries; retain separately justified non-telemetry identities (e.g. ordinary IPC/session/security primitives) with tests and ledger entries. Do not wipe old stored IDs.

| Process owner | Registration/startup changes | Required focused assertion |
| --- | --- | --- |
| Desktop main | `code/electron-main/app.ts`: direct no-op binding; delete appender client/config/common properties/ErrorTelemetry and later proxy/OS/metered telemetry payloads | Startup constructs no reporter or appender channel; usage/error calls produce zero request/log output |
| Desktop renderer | `workbench/services/telemetry/electron-browser/telemetryService.ts` reporting implementation/registration replaced by common no-op binding; desktop custom-endpoint import removed | DI resolves no-op without shared telemetry channel |
| Browser | `workbench/services/telemetry/browser/telemetryService.ts` reporting implementation removed; web main registers common no-op instead of consent/config-driven appenders | Old all settings and development mode cannot cause local-log or network reporting |
| Shared process | `code/electron-utility/sharedProcess/sharedProcessMain.ts`: no-op; remove 1DS/log appenders, `telemetryAppender` and custom endpoint service/channel | No channel registration, telemetry file/logger or shutdown flush |
| Server/remote | `server/node/serverServices.ts`: no-op `ITelemetryService` without `IServerTelemetryService` reporting graph; remove server/remote telemetry channels and remote clients | Remote telemetry-level messages cannot raise enablement; retained gallery/remote services still resolve |
| Node/worker extension hosts | `api/common/extHostTelemetry.ts`, main-thread bridge/init data and host services: minimal disabled API facade, no reporting RPC/logger/error collector | Supplied sender methods and flush remain uncalled in usage/error/disposal/old-init tests |
| Early main/crash paths | `src/main.ts`: delete crashReporter import/start/config path; app/argv/environment/server/ext-host crash wiring discovered by references | Old enable/crash argv cannot start crashReporter; ordinary uncaught-error handling/logging remains |

Delete platform appenders (browser/Node 1DS), common reporting `telemetryService`, `telemetryIpc`, `remoteTelemetryChannel`, server telemetry, custom endpoint, error telemetry, `telemetryLogAppender`, consent/reporting UI and telemetry build packaging such as `.build/telemetry` streams. A temporary internal custom-endpoint no-op signature can exist only until its callers are pruned; no endpoint service, URL handling, or channel ships at completion. Remove 1DS/reporting dependencies after graph cleanup, not arbitrary request libraries.

### Public extension telemetry compatibility

Replace `ExtHostTelemetry`'s current hidden output logger, sender storage, common-property construction, cleaning/classification, changing levels and unhandled-error dispatch with a tiny disabled facade. `env.isTelemetryEnabled` is always false; public/proposed usage/error/crash configuration fields are false; change events never announce enablement. `createTelemetryLogger` can retain pure argument validation and the public logger shape (no reporter imports); its usage/error methods and disposal/flush do nothing, even for a supplied sender. Do not call sender.flush on disposal. A retained `TelemetryTrustedValue` public wrapper is only a value/type marker, not collection or serialization logic. Ordinary extension output/log/error APIs remain independent. Record exact retained members and reasons in `compatibility.md` during apply.

### Bundled reporters

Inspected manifests/source show direct `@vscode/extension-telemetry` users in `git`, `typescript-language-features`, `html-language-features`, `json-language-features`, `markdown-language-features`, `merge-conflict`, `media-preview`, and `simple-browser`, plus the deleted GitHub/auth/Copilot extensions. Inventory all reporter imports/manifests/lockfiles and reporting helpers, not just these anchors. Remove direct reporter construction at cutoff; then prune every reporter injection/call/payload within the owning extension. No replacement Reporter class carrying event schemas. Language extension experimentation wrappers need audit: retain only independently required non-reporting feature configuration, not telemetry identifiers, event adapters or payload computation. Downloaded built-in extensions in `product.builtInExtensions` need an actual shipped-payload audit; if a third-party/vendor bundle reports directly, stop that packaging slice for the parent rather than deleting protected debugging support or silently declaring it exempt.

## D6 — Telemetry stage 2: owned inventory that must close

Apply creates `telemetry-inventory.md` under this change, seeded by the table below, and a source/dependency removal inventory. Every entry records repository path/symbol, subsystem, implementation unit ID, inbound consumers, reporting versus ordinary diagnostics, payload-only helpers/dependencies, disposition, focused test/result and remaining work. States: pending → cut-off → pruned; `retained-compatibility` requires exact public member/reason/tests, `retained-non-telemetry` requires consumer evidence/tests. Counts distinguish production/test/generated/package data. Search includes case variants and aliases; scans are evidence, not automatic string deletion. A subsystem cannot be marked pruned just because its telemetry service is no-op.

| Ledger group / task owner | Discovery roots and residue to prune | Protected tests/behavior |
| --- | --- | --- |
| T1 — process/platform infrastructure | `src/main.ts`, code/server/bootstrap, platform telemetry/externalServices/environment/product/nativeHost/remote/process data, workbench telemetry services | Process no-reporting tests, normal logging/remote/gallery headers |
| T2 — editor/base | `src/vs/editor`, `src/vs/base`, editor service callsites/types and timing/classifications | Editor/model/selection/actions; ordinary perf/debug utilities stay if independently used |
| T3 — workbench shell/services | `workbench/browser`, common/services excluding removed features: lifecycle/layout/title/status/views/timer/themes/keybindings/storage/accessibility/assignment | Startup, personalization, local profiles, commands, lifecycle/disposal |
| T4 — files/search/SCM | Explorer/files/search/SCM contributions/services, bulk edits, workspace/user activity | File operations, Search/ripgrep, SCM/history/Git flows |
| T5 — terminal/debug/tasks | Terminal and terminalContrib, debug including `node/telemetryApp`, tasks, testing | Shell/PTY/Run & Debug/tasks/test execution; preserve normal error notifications |
| T6 — languages/notebooks | Notebook/interactive/language/intellisense/inline-completion contributions not removed with chat | Non-chat language/diagnostic/notebook execution APIs |
| T7 — extensions/gallery/API | Platform/workbench extensionManagement, extensions views/recommendations/installation, API init/bridges/logger, marketplace identity/stat requests | Anonymous extension lifecycle/dependencies/VSIX, normal API activation |
| T8 — remote/network/security | Remote/tunnel/ports/server request paths, workspace trust/metered connection/security policies | SSH-key workspace, non-account forwarding, proxy/ordinary connection tokens |
| T9 — retained bundled extensions | All `extensions/*` manifests/source/server/worker bundles excluding deleted trees; reporters and experimentation helpers | Extension-specific tests/builds and user-facing language/Git/browser features |
| T10 — deleted features | A/C deletion families: auth/sync/cloud/chat/sessions/agent/Copilot | Mark pruned only when source, package, test and generated tails really disappear; no double-counting |
| T11 — build/package/tooling | Root/remote/extension manifests/locks, build/gulp/next/CI/hygiene telemetry extractor/artifacts, CLI args and scripts | Retained desktop/server/CLI packaging and license/native checks |
| T12 — residual closure | Repository-wide symbols/imports/config/event/classification/reporter dependencies plus payload-only evidence | Every residual assigned to T1–T11 or a tested documented compatibility/non-telemetry member |

After cutoff, remove calls **with** sole-purpose variables, timers, counters, UUIDs, classification types, constructor parameters/forwarding/DI stubs, helper methods, tests for deleted reporting and exclusive dependencies. Keep ordinary diagnostic messages or performance measurements where they have a real non-reporting consumer; document that consumer. Remove obsolete telemetry-only tests and add retained-behavior/no-side-effect tests rather than only deleting failing suites. Re-run the inventory after every removal family and final dependency regeneration. Neither an open ledger group nor a “later cleanup” placeholder satisfies completion.

## D7 — Tests, implementation boundaries, and verification evidence

Core test anchors already exist: API `extHostAuthentication`/`mainThreadAuthentication` (including integration suites), platform telemetry/server/log tests, extension gallery tests, workbench gallery manifest/account tests, platform remoteTunnel and retained `platform/tunnel` tests, Git `askpassManager.test.ts`/`cloneManager.test.ts`/Git/cache/smoke tests. Replace deleted behavior assertions with new API/process/protected-boundary tests; do not keep OAuth transport tests for removed implementation. New discovery targets include `api/test/common/accountFreeApi.test.ts`, `platform/telemetry/test/common/nullTelemetryService.test.ts`, and `code/test/electron-main/productDebloat.test.ts` (choose the existing suitable harness before adding a path).

1. **RED:** API no-side-effect fixtures count requests, URI opens, provider callbacks, storage writes, channel/service construction, log appends, sender/flush calls. Snapshot command/settings/menu/extension-point registrations. Seed legacy enablement/config/account/agent state and assert it is ignored. Baseline should demonstrate the current violation without live sign-in or telemetry.
2. **GREEN:** Apply one bounded unit; remove source/package/test owners together with dependent registrations; tests pass. Every process's no-op startup is tested, not just the shared null object.
3. **TRIANGULATE:** Test fresh/upgraded profiles, Node/worker/remote init, positive retained behavior and negative activation. Git tests cover HTTPS helper/askpass and SSH prompts plus arbitrary hostnames. Gallery tests cover functional requests versus forbidden auth/correlation/statistics requests, failure without login, and metadata retention.
4. **REFACTOR:** Remove sole-purpose payloads/dead DI/imports/fixtures; re-run smallest affected suite and current compiler diagnostics. Re-measure additions + deletions; report inventory closure by unit. Never compact code or omit tests to satisfy budget.
5. **Packaged Linux:** Clean-output desktop build with no Copilot shim; inspect actual product/manifest/native/dependency graph. Launch isolated fresh and copied persisted profiles. Observe command/UI/URL absence, retained .NET setup/onboarding/Search/diagnostics, no agent/crash reporter processes and no telemetry requests/files (old all settings included). Use controlled request/sender counters and startup tests in addition to a finite smoke capture; do not claim that finite network observation polices arbitrary extensions. Run the actual Open VSX anonymous gallery lifecycle and acquisition of a suitable Open-VSX-listed C# extension, recording the expected C# Dev Kit/Copilot provider gap without failing acceptance for those unavailable extensions, plus real controlled Git/SSH/non-account forwarding where environment exists. Record inaccessible providers/remote endpoints rather than certifying them from mocks.
6. **Other targets:** Retained server/REH and CLI compile/package checks are required for changed graph. macOS/Windows platform fixtures/native filter checks are mandatory; native startup/Git/remote/package results or explicit environment gaps accompany delivery. No platform passes by inference from Linux/client typecheck.

The inspected `scripts/test.sh` currently passes `--crash-reporter-directory`; `scripts/test-integration.sh` seeds chat notification settings, references Agent Host E2E, and lists auth/Copilot suites. These runner tails must be cleaned without breaking the retained focused Mocha/extension suite selectors. Commands to reference, not executed here: `./scripts/test.sh --run <file>`; `npm run typecheck-client` for cross-cutting core graph; `npm run gulp compile-extensions` or narrower existing extension build; extension-specific unit/integration runners discovered in manifests/scripts; `npm run typecheck --prefix build`; focused build tests via the existing Node test runner; `cargo check --manifest-path cli/Cargo.toml` and focused Cargo tests when CLI changes; Linux recipe `npm run build-fast`, `npm run gulp vscode-linux-x64` with prerequisites/diagnostics inspected first. Retained REH task names/arch are discovered from `build/gulpfile.reh.ts`, not guessed. Avoid duplicate watch/builds and refresh compiled tests only as needed.

## Requirement coverage

| Spec requirement | Design decisions | Evidence/tests |
| --- | --- | --- |
| No account or sign-in entrypoints | D2, D3 | Registration/UI/URL absence; fresh/upgraded profiles |
| Removal of account-dependent cloud capabilities | D2, D3 | Cloud no-start tests; retained Git/SSH/forwarding checks |
| Inert public authentication compatibility | D2 | Passive/create/force/provider/challenge/issuer fixtures, zero side effects |
| No gallery account fallback | D1, D2 | Gallery access-error/private-state/rating action tests |
| Non-destructive orphaned account state | D3 | Sentinel copied-profile/unrelated-secret preservation |
| No chat or agent product surfaces | D3, D4 | Product/config/command/window-restoration absence |
| Removal of chat and agent source/runtime graph | D4 | Import/source/package/channel/process inventory and clean packaging |
| No functional extension chat or language-model bridge | D4 | Empty/unsupported facade and ordinary API activation |
| Preserve only feature-neutral shared behavior | D3, D4 | Layer/inbound-use audit and Search/ripgrep helper fixtures |
| No telemetry or crash-reporting infrastructure | D5 | Process registration/sender/request/logger/flush counters |
| Legacy enablement is powerless | D3, D5 | Old settings/argv/init/change values remain disabled |
| Infrastructure cutoff followed by complete owned pruning | D6 | Closed subsystem ledger and payload/dependency audit |
| Minimal no-op extension telemetry compatibility | D5, D6 | Disabled API lifecycle, no sender/output calls |
| Plain Git operations and OS credentials | D2, D3 | Git/askpass tests and controlled plain-remote smoke |
| Working anonymous extension acquisition | D1, D5, D6 | Effective Open VSX mixin/embedded product and live anonymous lifecycle; listed C# acquisition plus documented Microsoft-only gap |
| Preserve local user state without destructive migration | D3 | Profile/repo/key/extension/secret sentinels |
| Preserve generic remote and port-forwarding infrastructure | D2, D3, D4 | Generic tunnel/server and SSH/Ports positive tests |
| Preserve ordinary IDE diagnostics and established local setup | D3–D7 | Output/errors/Search/API plus existing toolchain/onboarding suites |

## D8 — Rollout, rollback, and review slicing

No intermediate removal family establishes complete product compliance. Early cutoff/disconnection may leave **existing** unreachable source awaiting ordered deletion, but never adds a shadow framework, exports working auth/chat services, or permits a release/completion claim with that source shipped. The approved `feature-branch-chain` stages these removal slices on a non-released change branch; each leaf is reviewed against its passing predecessor. No intermediate branch state is released or represented as final compliance, and no alternative chain strategy is selected.

Rollback is safety-preserving forward-disable/recovery: restore a necessary generic helper or source fragment for diagnosis only with entrypoints still disconnected, API facades inert, telemetry permanently no-op and crash reporter absent. Do not blindly revert an entire deletion family if that reactivates accounts/agents/reporting. Stop owned test processes; preserve all user data and legacy state. Rebuild clean outputs to prevent stale removed extensions/runtimes. No remote revocation, secret cleanup or production repository mutation accompanies rollback.

Tasks define chain-ready autonomous review slices with explicit prerequisites, starting state, finishing state, retained boundaries, focused tests and rollback. Elementary slices target **120–400 total changed lines**, reserving test/inventory coverage within that same budget. Large files require bounded member/block removal while compilable; trees split into owned source/test/resource/package batches, with consumer-disconnection leaves before dependency deletion. Lock/generated/source-test changes also count: if no safe <=400 seam exists, pause the affected leaf and return a concrete split-plan obstacle to the parent, not an implicit or renewed size exception. `size:exception` is declined. Never compress code, omit tests or call deletions review-free. Planning artifacts and binary payload changes remain visible in review.

## Review Workload Forecast

This is an **order-of-magnitude estimate, not a measured diff**. Preliminary implementation additions + deletions: **approximately 600,000–2,000,000 lines** across source/test/resources/manifests/locks/build tooling; the bundled Copilot tree and broad chat/session/agent deletion dominate. Precision is intentionally low until the M0 tracked-file/line manifest measures disjoint ownership and generated content. Removing copied/vendor/generated files does not remove review responsibility. Binary bytes/files and OpenSpec artifacts are additional. Even the already inspected Copilot manifest, chat contribution, API factories and telemetry modules alone exceed one 400-line unit by a large margin.

Delivery strategy: ask-on-risk
Review budget: 400 added + deleted lines per reviewable unit
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Approved split: baseline/inventory/protected fixtures → accounts/auth/gallery → Sync/tunnels/Continue On → chat core/API/integrations → sessions+Agent Host → neutral `getRipgrepExcludeFilter` extraction **before** Copilot/build-tail deletion → all-process telemetry infrastructure and bundled-direct-reporter cutoff → telemetry call-site groups by subsystem → boundary regression/package coverage. Cross-tree compile consumers are disconnected in prerequisite leaves before deleting their owner; this does not keep a shadow framework. **Stage 2 never precedes accepted cutoff and never becomes a deferred change.** The explicit chain order, owned deletion seams, tests and verification commands are in tasks.md.

The parent-approved workload gate is resolved. M0 measures the preliminary estimate and instantiates exact <=400-line leaves on the selected feature branch; it does not reselect delivery strategy or authorize an oversize review. No small fixed PR count is promised, and no size exception is permitted.

## Risks and limitations

- Open VSX configuration is planned, not yet implemented/live-verified. Confirm packaged quartet/controlUrl mapping and endpoint/header compatibility; C# Dev Kit/Copilot absence is the acknowledged provider gap, not a failed gallery criterion.
- Preliminary deletion estimates may substantially change after measurement. Large generated/lock/source-test changes must split safely within 400 lines; if no coherent seam is available, pause that leaf for a revised split plan. Size exceptions are declined and tests cannot be reduced to fit.
- Chat/session/agent APIs, UI and unrelated features have a broad compile-reference tail. Client-only compilation misses server/utility/CLI/build/extension contexts.
- Git-specific auth and generic remote connection security are protected; word-based deletion risks crippling Git/SSH/Ports. Account-dependent tunnel-forwarding is a different provider and must disappear.
- Direct telemetry in retained downloaded built-ins cannot be certified from core DI or local extension manifests; shipped-payload audit may reveal a vendor remediation choice requiring parent direction.
- No-op compatibility is intentional only at documented public/process boundaries, not an excuse to keep OAuth/token providers, custom-endpoint infrastructure, telemetry payload builders or a chat framework.
- Upgrade tests must use copied isolated data. No authorization exists to wipe old secrets, revoke tokens, delete local agent data, or touch a production remote.
- Finite smokes and platform fixtures are not live native-platform/provider verification; gaps remain explicit. Broader welcome content is follow-up only.
