# Proposal: Account-Free Product Debloat

## Intent and users

Walker is an account-free, subscription-free .NET IDE, not an account portal or an AI-agent product. Developers must be able to edit code, install extensions, and manage repositories without GitHub/Microsoft accounts, OAuth, Copilot subscriptions, or telemetry collection. Upstream account, cloud-sync, and agent surfaces contradict that promise and leave unnecessary runtime dependencies, packaging workarounds, and support burden.

This change removes those capabilities at their implementation boundaries, rather than hiding menus or changing defaults. It serves local desktop developers on Linux, macOS, and Windows, including users of self-hosted Gitea, Forgejo, and GitLab remotes. It must preserve ordinary Git credentials and extension acquisition so subsequent .NET work can rely on both. Linux is the first verification target; platform-specific code remains part of the removal inventory.

The confirmed product choices are final: total account/sign-in removal; deletion of chat core, Copilot, Agents Window, and local Agent Host; and telemetry infrastructure removal followed by staged call-site pruning. No subscription or replacement account system is introduced.

## Repository evidence and proposed shape

The following anchors were inspected during proposal work. They identify entry points, not an exhaustive dependency inventory.

### Accounts, authentication, and cloud surfaces

- `extensions/github-authentication/` and `extensions/microsoft-authentication/` contain the built-in authentication providers and their Node/browser builds. Remove their implementations, manifests, build discovery, dependencies, and packaging references.
- `src/vs/workbench/contrib/authentication/browser/authentication.contribution.ts`, `src/vs/workbench/services/authentication/`, and `src/vs/workbench/api/{browser/mainThreadAuthentication.ts,common/extHostAuthentication.ts,node/extHostAuthentication.ts}` expose authentication contributions and extension-host bridging. The browser authentication service also imports OAuth metadata/header parsing and restores a stored login account. Removing two provider extensions alone does not eliminate sign-in.
- `src/vs/workbench/browser/parts/globalCompositeBar.ts` owns accounts actions and view items; `parts/titlebar/titlebarPart.ts` and `titlebarActions.ts` also expose accounts controls. Remove all account menu locations, visibility settings, badges, and command entry points, not just the activity-bar icon.
- `src/vs/workbench/contrib/userDataSync/` and `src/vs/workbench/services/userDataSync/` host Settings Sync, including profile synchronization. Remove cloud-sync contributions, backend transports, startup initialization, and auth dependencies; preserve local settings and local profiles.
- `src/vs/workbench/contrib/remoteTunnel/` and `src/vs/platform/remoteTunnel/` implement account-gated Remote Tunnels. `product.json` includes tunnel application/mutex identity. Remove the account-gated tunnel feature and its launch/CLI/package wiring without deleting generic port forwarding, remote agents, or SSH transport merely because they use the word “tunnel.”
- `src/vs/workbench/contrib/editSessions/browser/editSessions.contribution.ts` contributes `Continue Working On...`, cloud changes, and Continue On destinations. Remove account/cloud continuation to github.dev/vscode.dev and its backend/wiring; do not remove unrelated local workspace restoration.
- `extensions/github/src/extension.ts` registers a `GithubCredentialProviderManager`, a GitHub remote publisher, Octokit-backed features, and a vscode.dev share provider. `src/auth.ts` calls `authentication.getSession('github', ..., { createIfNone: true })`; `src/publish.ts` implements Publish to GitHub. Remove these OAuth-dependent integrations and all manifest/menu/welcome contributions to them. Design should determine whether any remaining anonymous functionality merits keeping a reduced GitHub extension; retaining an account feature is not an option.

### Protected Git boundary

- `extensions/git/` is the built-in `vscode.git` implementation and must remain, together with required `extensions/git-base/` functionality.
- `extensions/git/src/askpass.ts` handles HTTPS/SSH credential prompts and also supports registered credential providers. Preserve OS Git credential helpers, SSH keys/agents, and Git-specific askpass/passphrase behavior; remove the GitHub OAuth provider registration, not Git authentication itself.
- Git clone, fetch, pull, push, status, commits, history, branches, and generic remote handling remain. A github.com URL is still a plain Git remote when OS credentials are used; do not reject hostnames or require provider accounts.
- `extensions/git/src/main.ts`, `repository.ts`, `model.ts`, `commands.ts`, and `cloneManager.ts` import `@vscode/extension-telemetry`. Removing core telemetry alone leaves a built-in extension reporting path, so prune this dependency/reporting while preserving Git behavior.

### Chat, Copilot, Agents Window, and Agent Host

- Delete `src/vs/workbench/contrib/chat/`, including chat services, setup, agents, sessions, language-model tools, commands, settings, views, and assets. This is source removal, not a dormant contribution switch.
- `src/vs/workbench/contrib/chat/electron-browser/agentSessions/agentSessionsActions.ts:59` declares “Open in Agents”; `browser/chat.shared.contribution.ts:2386` describes `chat.titleBar.openInAgentsWindow.enabled`. Both disappear with the feature, including command/menu/keybinding/configuration registrations.
- `src/vs/sessions/` is a separate Agents Window workbench layer. Remove this feature layer and its entrypoints/build assets, not only `chat/.../agentSessions`.
- `src/vs/platform/agentHost/`, `src/vs/workbench/services/agentHost/`, and `src/vs/server/node/agentHostChannel.ts` extend beyond chat core. `src/vs/code/electron-main/app.ts` constructs `ElectronAgentHostStarter` and `AgentHostProcessManager`. Remove the local Agent Host, associated agent-only transports/services, lifecycle startup, IPC, and package dependencies; preserve generic server/remote infrastructure used by SSH development.
- `workbench.common.main.ts`, `workbench.desktop.main.ts`, and `workbench.web.main.ts` import chat contributions or services. `src/vs/workbench/api/browser/mainThreadLanguageModels.ts`, `mainThreadLanguageModelTools.ts`, chat API bridges, and `api/test/` depend on chat interfaces. `workbench/test/browser/workbenchTestServices.ts` and sessions component fixtures also import chat code. Design must account for this compile-reference tail before deleting the subtree.
- Remove `extensions/copilot/` and the `product.json` `defaultChatAgent` configuration, including GitHub.copilot/GitHub.copilot-chat identifiers, provider/entitlement links, documentation/terms/privacy/SKU URLs, commands, and related extension-proposal wiring that becomes dead.
- `package.json` depends on `@github/copilot-sdk`. `build/lib/copilot.ts` implements runtime package selection and `prepareBuiltInCopilotRipgrepShim`; `build/gulpfile.vscode.ts:554` and `build/gulpfile.reh.ts:530` invoke the shim. Remove the Copilot runtime/package-copy workaround, platform-specific copies and filters, corresponding tests, lockfile entries, and obsolete packaging checks. Keep ordinary ripgrep used by Search and generic package utilities if still needed.
- `build/.moduleignore` explicitly describes Agent Host use of the Copilot SDK; `build/darwin/verify-macho.ts` lists Copilot package paths. Include these packaging tails in the inventory rather than treating successful client compilation as sufficient.

### Telemetry and crash reporting

- `src/vs/platform/telemetry/common/telemetryUtils.ts` exports `NullTelemetryService`; it is an existing singleton object, not a service constructor. Make this non-reporting implementation the actual injected service through appropriate registration/descriptors, rather than leaving a reporting implementation active behind a disabled setting.
- `src/vs/workbench/services/telemetry/{browser,electron-browser}/telemetryService.ts` currently register reporting-capable services. `src/vs/code/electron-main/app.ts` constructs the main-process telemetry service and error telemetry. Cover desktop, browser, shared process, server, and extension-host contexts; no context may retain an active appender.
- `src/vs/platform/telemetry/` includes appenders, `telemetryIpc.ts`, `remoteTelemetryChannel.ts`, server telemetry, custom-endpoint telemetry, error telemetry, and logging appenders. Delete collection, reporting, transport, and telemetry-specific logging infrastructure; reduce shared contracts/utilities to the minimal no-op boundary needed during migration.
- `src/main.ts:568` starts Electron `crashReporter`. Remove crash-reporter initialization and associated configuration/CLI/reporting paths, not only remote upload permission.
- Remove telemetry consent/settings/status/reporting UI and product/configuration/build dependencies. Preserve ordinary diagnostic logs, output channels, error notifications, and debugging; those are not telemetry merely because they describe failures.
- The handoff identifies thousands of telemetry call sites; proposal exploration confirms broad process registrations and built-in extension reporters, but does not claim an exact count. Produce an owned inventory in design and prune by subsystem after the infrastructure cutoff.

### Extension marketplace/gallery boundary

- Preserve search, browsing, details, anonymous installation, updates, dependency resolution, VSIX installation, and uninstall through `src/vs/platform/extensionManagement/` and the workbench extension-management services.
- `src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts` renders marketplace sign-in content and badges; `extensions.contribution.ts` contributes Sign in to access Extensions Marketplace. `src/vs/workbench/services/extensionManagement/common/extensionGalleryAccount.ts` and `electron-browser/extensionGalleryAccountService.ts` provide an account-specific gallery path. Remove those sign-in paths while retaining the anonymous gallery client.
- `src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts` contains `RatingsWidget`; `src/vs/platform/extensionManagement/common/extensionGalleryManifestService.ts` constructs an external review URL. Remove rate/review sign-in prompts and account-required action links without losing read-only metadata. Any account-gated enterprise gallery path must not become an authentication fallback.
- **Baseline gap:** checked-in `product.json` contains no `extensionsGallery` configuration. The platform manifest service reports Unavailable without a `serviceUrl`, and `build/hygiene.ts` rejects an `extensionsGallery` field in that file. Browser development build templates do supply one. Design must inspect the effective packaged desktop configuration/mixin and establish a working anonymous gallery baseline; do not silently select a new gallery or claim marketplace functionality from code presence alone. A provider/policy decision, if necessary, returns to the parent.

## Proposed behavior

### No accounts or OAuth

Walker must expose no turnkey sign-in, account management, OAuth redirect/callback, provider chooser, cloud-sync enrollment, remote-tunnel login, GitHub publishing, or gallery sign-in action. Existing account/session state must not reactivate removed features on upgrade or restart. Feature settings, command-palette entries, title-bar controls, menus, notifications, and URL handlers must be removed rather than hidden by defaults.

The generic authentication boundary also cannot remain a back door: extension requests must not register a functioning account provider or launch a consent/sign-in UI. Design should retain only the minimum inert API compatibility needed for ordinary extensions, with deterministic unsupported behavior and no network/auth flow. Delete obsolete authentication implementation and tests; retain/add compatibility tests where signatures remain. Apply the same audit to dynamic/MCP OAuth paths outside deleted chat code. A compatibility shim is not permission to retain authentication infrastructure.

The guarantee covers Walker-owned code and bundled extensions. It is not a claim that arbitrary installed extensions or external websites cannot independently show their own UI or make network requests. Do not implement an extension sandbox or network firewall here; nevertheless, Walker must never supply those extensions with an active account/OAuth platform service. Any requirement to police arbitrary extension behavior is a separate product decision.

Git-specific credential prompts are the sole authentication carve-out. They must use plain Git/OS mechanisms and never route through GitHub/Microsoft authentication, OAuth, or an accounts menu.

### No chat or agent runtime

No chat core, Copilot extension/runtime, Agents Window, Open in Agents command/setting, or local Agent Host ships or starts. Remove dependent feature bridges and registrations alongside the implementation. For genuinely shared helpers, extract only feature-neutral functionality into the proper existing layer; do not recreate a chat compatibility subtree or leave agent startup running invisibly. Ordinary SCM, Search, terminal, editor, debugging, and key-based remote development remain available.

### No telemetry infrastructure, then no reporting call sites

First cut off all production collection/reporting paths, bind the no-op service everywhere needed, remove crash reporting and reporting UI, and eliminate direct reporters in bundled extensions. This is a functional infrastructure-removal milestone, not the final debloat outcome.

Then remove telemetry calls, constructor injections, event/classification payloads, helpers, tests, and dependencies in bounded subsystem units. Remove telemetry-only data computation as well as the final logging call. Keep the remaining no-op contract only where intentionally required for extension/public API compatibility; document and test it. Completion requires the pruning inventory to close, not “telemetry disabled by default” or a permanently deferred backlog. Do not infer that preserving gallery networking requires preserving telemetry reporting.

## Scope and non-goals

In scope: all Walker-owned account/sign-in surfaces and providers; Settings/Profile Sync; account-gated Remote Tunnels and cloud Continue On; GitHub OAuth/publishing integrations; chat core, Copilot, Agents Window, and local Agent Host; telemetry/crash infrastructure, reporting UI, built-in reporters, and staged call-site pruning; dependent API/build/package/test cleanup; and regression coverage for protected Git/gallery/SSH paths.

Preserve local profiles/settings, repository/workspace data, generic remote/port-forwarding infrastructure, OS Git credentials, SSH-key remote development, anonymous gallery access, and ordinary diagnostics. Do not delete stored repositories, local profile directories, user-installed extensions, SSH keys, OS credential-helper data, or remote service data. Design must specify treatment of orphaned feature state without broad secret-storage wipes or starting a removed provider to sign out.

Separate later changes: `new-project-wizard`; C# editing with Roslyn LSP and Solution Explorer; Run & Debug, NuGet, and Tests; Walker .NET-flavored welcome content. General VS Code walkthrough/tips cleanup belongs to the welcome-content lane. Remove direct dead command links caused by this change and report broader dangling-content follow-ups; do not redesign onboarding or welcome content here. Marketplace-provider migration, extension policing, and replacement cloud sync/AI systems are not implicit scope.

## Success criteria

1. A fresh and an upgraded desktop profile expose no Walker-owned account/sign-in commands, menus, provider UI, OAuth callbacks, Sync, Remote Tunnels, Continue On cloud actions, GitHub publishing, or gallery rating/review sign-in prompts. Persisted account state and extension API requests cannot reactivate them.
2. Source/import/dependency inventories show removal of `src/vs/workbench/contrib/chat`, `extensions/copilot`, Agents Window entrypoints, local Agent Host startup, and Copilot product/package wiring. Runtime process checks show no agent host; packaged artifacts contain no Copilot SDK/runtime or shim/package-copy requirement.
3. Telemetry registrations resolve to no-op behavior in each retained process context. No appender, telemetry transport/channel, direct bundled-extension reporter, or Electron crash reporter remains active or shipped. Targeted tests assert that representative calls emit no telemetry network requests or telemetry log output, including when old settings request telemetry.
4. The separately tracked call-site inventory is fully pruned by subsystem, including telemetry-only payload computation and dependencies. Any intentionally retained no-op public compatibility contract has a documented reason and tests; the change is not declared complete at infrastructure cutoff.
5. `vscode.git` remains bundled. Regression checks cover clone/fetch/pull/push against a plain remote with SSH keys and, where available, an OS credential helper, including a self-hosted-style endpoint; no provider login is requested. Existing Git credential/askpass tests remain meaningful. Key-based remote development and non-account port forwarding pass regression checks or carry explicit unavailable-environment gaps.
6. The effective packaged gallery configuration supports anonymous search, extension detail browsing, install/update/uninstall, dependencies, and VSIX installation with no sign-in path. Verify a suitable C# extension can be acquired without implying that this change supplies C# editing. Record any provider/licensing/access gap rather than claiming success from mocks alone.
7. Relevant client, extension, build-tooling, and retained entrypoint checks have no dangling feature imports or service-resolution failures. Fresh-profile and persisted-state packaged Linux checks pass; macOS/Windows results or explicit verification gaps accompany delivery.

Use `.github/copilot-instructions.md` and `openspec/config.yaml`: focused core Mocha tests via `./scripts/test.sh --run <file>`, extension-appropriate tests/builds, and scope-appropriate client/build/extension type checks. Existing useful suites include authentication API/service tests, remoteTunnel tests, telemetry tests, extension gallery tests, Git askpass tests, and `build/lib/test/copilot.test.ts`. Remove tests for deleted behavior; replace relevant boundary assertions rather than merely deleting failing tests. Inspect existing diagnostics and avoid duplicate build tasks. Proposal work does not execute verification commands.

## Risks and design questions

- **Compile-reference tail:** deleting chat core affects main entrypoints, extension API converters/bridges, test-service fixtures, sessions code, and unrelated feature integrations. Inventory dependencies by owner before removal; remove dependent capabilities or extract only truly generic helpers. Keeping a shadow chat framework to quiet TypeScript violates the intended deletion.
- **Telemetry volume and scope:** infrastructure removal is a smaller cut than all call-site/dependency cleanup. Direct extension reporters bypass core DI. Track both workstreams, forbid reporting after cutoff, and use an explicit completion ledger so staged work does not dilute the mandate.
- **Gallery baseline and compatibility:** desktop gallery configuration is not established by the checked-in product file. Authentication-dependent extensions will intentionally lose that capability, but anonymous installation must remain functional. Provider selection or policy/access restrictions require parent visibility rather than a silent change.
- **Shared remote/Git primitives:** account tunnels, agent tunnels, SSH transports, askpass, and generic port forwarding overlap in naming but not purpose. Delete by ownership/dependency, not string matching. Strip Git telemetry separately from its credential plumbing.
- **Review workload:** this is substantially larger than a 400-line review unit, including deletions and generated dependency updates. Design/tasks must estimate changed-line and dependency scope, define bounded coherent units, and reach the ask-on-risk workload gate before implementation. No exception is pre-approved; choose the deferred chain strategy there. Do not compress risk by omitting tests or treating a giant deletion as review-free.
- **Upgrade state and rollback:** removed settings, stored account sessions, sync state, and agent data may linger. They must be inert and non-destructively handled. User-data deletion and remote revocation are not authorized by this proposal.
- **Platform/package tails:** client compilation alone misses shared process/server entrypoints, extension builds, native package filters, lockfiles, and packaged launch. Verify the relevant graph explicitly and report untested platforms.

No confirmed product choices need reopening. The gallery baseline, retained inert API shapes, exact process registrations, state handling, and subdivision of removals are engineering investigations for spec/design; new product/provider choices or delivery exceptions return to the parent.

## Work-breakdown sketch

1. Specify absence guarantees and protected behavior, including Git credentials, local profiles, anonymous gallery, remote SSH, extension API failure semantics, upgrade state, and telemetry completion criteria.
2. Build an ownership/dependency inventory for account/cloud surfaces, chat/session/agent entrypoints and bridges, telemetry registrations/direct reporters/call sites, and package/build tails. Establish the effective gallery baseline and identify any external access blocker.
3. Design bounded removal units and regression contracts. Resolve the 400-line workload/risk gate and deferred chain strategy before implementation; each unit names prerequisites, retained boundaries, tests, and expected source/package deletions.
4. Remove account providers and Walker-owned auth entrypoints with inert compatibility where required; remove Sync, Continue On, Remote Tunnels, GitHub publishing/OAuth, and gallery account UI. Preserve and test Git/gallery/SSH paths.
5. Remove chat, Agents Window, Agent Host, and API/contribution dependents in dependency-aware units; remove Copilot/product/dependency/build shims and verify retained packaging/Search behavior.
6. Cut telemetry/crash infrastructure and bundled direct reporters off, then prune all owned call-site groups in separately reviewable units. Inventory artifacts must distinguish infrastructure acceptance from full pruning completion.
7. Verify focused boundaries and packaged Linux behavior, including persisted-state profiles, anonymous extension acquisition, plain Git credentials, absent agent processes and telemetry, and artifact/dependency inspection. Record platform gaps and welcome-content follow-ups before final compliance review.

The sequencing above is a planning sketch, not a mandate to implement a single giant patch. Specifications, design, and executable tasks follow this proposal.

## Rollback

Use isolated dependency-aware units so an unsafe source/package deletion can be reverted for investigation without losing user data. A product rollback must not re-enable accounts, OAuth, Sync, account tunnels, Copilot/agents, telemetry, or crash reporting. If temporarily restoring code is necessary to recover compilation, keep its entrypoints unregistered and telemetry bound to the no-op service; that is an interim recovery state, not final compliance. Prefer restoring a safe generic helper or inert compatibility boundary over reviving an entire feature.

Preserve repositories, OS Git credentials, local settings/profiles, extensions, and remote SSH configuration. Do not delete legacy cloud/account/agent state or revoke remote tokens as a rollback side effect. Package from a clean output/dependency graph so removed extensions and native runtimes cannot survive through stale build artifacts.
