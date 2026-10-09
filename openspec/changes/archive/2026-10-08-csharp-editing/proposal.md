# C# Editing Proposal

## Intent

Deliver Walker's first C# editing lane as one change: language intelligence supplied by the anonymously acquired Open VSX community extension `muhammad-sammy.csharp`, paired with a first-party Solution Explorer for the workspace's `.sln`/`.csproj` graph. C# developers should be able to understand project structure, navigate files and references, and obtain completion, diagnostics and symbol navigation without accounts, Copilot, telemetry, or an independently provisioned SDK.

This proposal implements the parent-confirmed lane direction; it does not reopen the choice of provider or authorize an owned LSP integration. Installation evidence establishes acquisition, not functioning language intelligence. Configuration and admission checks are substantive deliverables, not assumptions about the extension's defaults.

## Scope

### In

- An explicit, anonymous install/configure action for `muhammad-sammy.csharp`, truthful missing/disabled/incompatible/offline states, and version-aware admission to the Walker-supported editing path.
- Roslyn standalone mode using the server distributed by that extension, with telemetry disabled, AI integration inactive, automatic restore disabled, and a compatible host resolved through Walker's canonical toolchain boundary.
- A built-in first-party Solution Explorer: workspace/solution roots, projects, source files, declared project/package/assembly dependencies, refresh and file/project navigation. Multiple solutions and workspace folders remain distinct; standalone `.csproj` workspaces work without inventing a solution.
- Bounded read-only parsing, filesystem-change refresh, malformed/missing/unsupported metadata diagnostics, and honest partial-graph labeling.
- Focused tests for acquisition/configuration gates, contract changes, graph parsing, tree lifecycle, navigation, and live C# language behavior in packaged Walker.
- An explicit proposed widening of the toolchain resolution contract for editing-host compatibility, subject to parent disposition at the plan gate.

### Out

- Bundling, modifying or forking the community extension or Roslyn; own LSP client/server implementation; Microsoft Marketplace or Dev Kit fallback.
- Sign-in/accounts, Copilot/agents, telemetry/reporting, arbitrary installed-extension network policing, or restoration of removed product services.
- Build/Run & Debug, NuGet management/restore UI, test execution, project mutation, solution editing, evaluated MSBuild parity, or SDK inventory/project-compatibility claims.
- The vsce-sign decision, dev-tunnels dead-dependency cleanup, wizard-to-live-SDK composition test, a separate high-contrast visual pass, and Walker Welcome content changes.
- Remote SDK provisioning or interpreting local toolchain readiness as remote readiness. Initial language enablement is local desktop/file-workspace only; unsupported hosts receive an explanation. Generic SSH, remote extension hosts and port forwarding remain intact.

## Resolved Implementation Questions

### 1. Extension configuration and safe presence

**Decision: explicit gallery acquisition plus first-party configuration/admission gates; not automatic installation, bundling, or recommendation-only safety.**

Use the normal anonymous Open VSX installation machinery from a localized Install/Configure C# Editing action. Offer the action from editing/Solution Explorer state, not Welcome. Preserve users' ability to uninstall or disable extensions; do not silently re-enable them. Pin the Walker-supported compatibility record initially to audited version `2.145.21-g154a82fd27` and supported platform payloads. An extension update requires revalidation before Walker-supported activation; never disable updates for unrelated extensions.

Product `extensionRecommendations.onFileOpen` can add discovery for C# files but cannot establish installation, runtime provenance or safety. `fileBasedRecommendations.ts` consumes that key as a recommendation. `extensionEnabledApiProposals` is a proposed-API permission map, not install/configuration policy; no `extensionEnabledAppliance` precedent was found in the inspected product contract. `builtInExtensions` would bundle third-party artifacts and violates this lane's decision. Workspace `.vscode/extensions.json` is advisory and would mutate user projects; it is not the selected mechanism.

A narrow workbench editing contribution owns acquisition, pre-activation coordination and effective-configuration validation. A manifest-level configuration-default contribution supplies safe initial settings before third-party activation; dynamic toolchain-derived values must be established before activation, not by a late startup timer. Where existing extension enablement/activation sequencing cannot provide that guarantee, propose an identity-scoped activation admission seam, preserving public extension API shapes. Do not implement an ineffective post-activation disable race or assume an extension dependency on the Walker companion would order this third-party extension.

**Actual package findings and required configuration:**

| Surface | Evidence and chosen behavior |
| --- | --- |
| Server selection | `dotnet.server.useOmnisharp` defaults to **true**. Walker sets **false** to select Roslyn; no OmniSharp fallback. |
| Server location | `dotnet.server.path` selects the extension-owned Roslyn payload. Bundled code checks inherited `DOTNET_ROSLYN_SERVER_PATH` first. Admission rejects unexpected overrides/components and selects the audited extension-owned server, rather than executing a workspace-specified server. |
| Child environment | `dotnet.server.environmentVariables` is a real setting, merged into the Roslyn child environment by `getServerExecutableOptions`. Supply `DOTNET_CLI_TELEMETRY_OPTOUT="1"` and `DOTNET_NOLOGO="1"`, with root/multilevel-lookup values derived from the verified toolchain. Validate effective values and reject inherited execution hooks/unsafe overrides in the supported path. This is child configuration, not mutation of parent/terminal PATH or shell profiles. |
| Extension telemetry | Walker's `ExtHostTelemetry` permanently reports disabled: `getTelemetryConfiguration() === false`; usage/error/crash details are false; API loggers never invoke senders. Retain these API shapes. The package includes `@vscode/extension-telemetry`; test its real reporting behavior against this facade rather than inferring safety from the package name. |
| Roslyn telemetry | There is **no contributed `dotnet.telemetry` switch** in the audited manifest. Standalone launch has no Dev Kit telemetry setup, `--devKitDependencyPath` or `--sessionId`; those occur only on the Dev Kit path. `DOTNET_CLI_TELEMETRY_OPTOUT=1` suppresses .NET CLI telemetry, not proof against every independent Roslyn reporter. Acceptance must demonstrate standalone server/reporting suppression, including no telemetry-enabled server arguments/environment, no telemetry requests, and no error-reporting bypass. Do not invent a `dotnet.telemetry:false` setting or an undocumented server flag. |
| AI | The client reads `chat.disableAIFeatures` and skips its RoslynCopilot setup/acquisition when disabled; set effective **true** as an inert external-extension control, without restoring Chat. Require standalone mode with no Dev Kit or Copilot activation. The manifest still contains `@github/copilot-language-server` and RoslynCopilot download metadata; these are audited external-package risks, not Walker features to enable. |
| Restore and external navigation | Set `dotnet.projects.enableAutomaticRestore=false` and `dotnet.navigation.navigateToSourceLinkAndEmbeddedSources=false` for local editing without implicit package/source downloads. No new restore command is added to the Walker toolchain. |
| Signature workaround | Keep existing application default `extensions.verifySignature=true`. The install action reports the known packaged failure and documents the approved **user/profile-level** `false` workaround; it never silently changes this application security setting. Existing `false` profiles can proceed. No default-wide weakening or vsce-sign packaging decision is authorized. |

Effective configuration can override defaults at user/workspace/folder scopes. Admission therefore checks the effective result before activation and after changes; conflicting state suspends the supported path with a localized explanation and explicit repair/reload action. Preserve unrelated settings, extension state and secrets. Never represent an already-active unsafe profile as newly made safe without stopping/restarting the relevant extension host and proving the transition. The plan must select the smallest sequencing mechanism that enforces this requirement.

**Runtime dependency is real:** both extracted manifests declare `extensionDependencies: ["ms-dotnettools.vscode-dotnet-runtime"]`; Open VSX metadata and the successful install log agree. The earlier parent grep observation of no dependency is superseded by direct evidence. Its gallery installation is permitted, but a separate runtime download/discovery bypass is not. The C# runtime resolver calls `dotnet.findPath` for a stable compatible runtime **>=10.0.5**, then falls back to `dotnet.acquireStatus`/`dotnet.acquire`. `dotnet.toolingRuntimePath` is honored only when Dev Kit is present and is **not** a usable standalone Walker bypass.

Configure the acquisition extension's supported existing-host mapping with the toolchain-derived executable and the actual requesting-extension identifier used by the audited client. The plan must verify the dependency's implementation, including whether the identifier remains upstream-branded, and prove mapping precedence/no acquisition fallback. A named integration guard must fail closed if mapping cannot enforce the verified-host requirement. Do not substitute a generic process command broker or implement a competing runtime downloader. Preserve the dependency's ordinary diagnostics while ensuring its own telemetry remains off.

### 2. Solution Explorer contribution point

**Decision: a built-in extension under `extensions/` for the tree and source graph; a small workbench contribution only for privileged acquisition/admission coordination.**

The extension uses stable `TreeDataProvider`/tree-view, workspace filesystem/watchers, command and document-opening APIs. It owns localized labels, normal theme icons/tokens, keyboard navigation and disposables. The first slice handles local file workspaces and clearly reports unsupported host/locality combinations; it does not execute a remote path through the local/UI toolchain. It remains useful as a read-only declared graph when no SDK or language extension is available.

`extensions/dotnet-toolchain` demonstrates packaged built-in extension availability, localized commands, a local/UI host guard and testable injected facades. `projectWizard` demonstrates the alternative workbench contribution with services and a command client into the toolchain rather than implementation imports. The tree does not need privileged workbench services or direct SDK subprocess access, so placing all graph/UI code in core would unnecessarily couple a .NET feature to the workbench. Conversely, a companion extension alone cannot safely order another extension's activation or perform privileged enablement coordination. Keep those responsibilities explicit and separate.

Neither core nor Solution Explorer imports toolchain implementation modules. Use versioned command results with structural guards; if a runtime-resolution addition is needed, update the boundary deliberately rather than reading private state. Preserve the existing strict `walker.dotnet.runTemplateOperation` allowlist unchanged. No arbitrary executable/argv/shell/environment command is added.

### 3. `.sln` / `.csproj` graph parsing

**Decision: bounded source-level parsing, with a conservative partial-graph fallback; no MSBuild execution for the tree.**

- Parse conventional `.sln` project entries and solution-folder relationships as data, resolving project URIs relative to the solution.
- Parse project XML with a small bounded non-evaluating reader: XML namespaces/attributes/entities/comments must be handled deliberately; reject DTD/external entities and malformed input. Do not use broad regex extraction as a substitute for XML structure.
- Build file nodes from project-local files and supported explicit item declarations (`Compile`, `Content`, `None`, with straightforward Include/Remove/Link handling). Apply supported SDK-style implicit source inclusion conservatively; exclude `bin`, `obj`, `.git` and unrelated traversal. Recognize when implicit items are disabled.
- Show declared `ProjectReference`, `PackageReference` and assembly `Reference` items; package dependencies are metadata, not a NuGet-management lane. Navigable references open the referenced local project; package/reference nodes do not fetch metadata.
- Keep conditions/imports/property expansions, custom item transformations and external linked files visible as unsupported/unresolved where they cannot be interpreted safely. Missing projects remain diagnosable nodes. Do not claim that declared items are the evaluated build graph or infer which conditional references are active.
- Bound file sizes, project counts, recursion, concurrent reads and refresh work; avoid symlink cycles and escaping workspace roots. External references can be displayed, but traversal/opening outside the authorized workspace requires an explicit normal user action and must not become automatic scanning/execution. Cancel/discard stale scans on workspace changes.
- Fallback for malformed or unsupported project metadata is a labeled partial tree with project-file navigation, not an empty success, an automatic MSBuild run, or a fabricated resolved dependency graph.

**Alternatives evaluated:** Microsoft.Build/MSBuild workspace APIs would require a managed helper plus NuGet dependencies, runtime deployment and execution of workspace-controlled evaluation logic. CLI queries such as `dotnet sln list` simplify solution membership but not complete file/dependency evaluation; `dotnet msbuild -getItem/-getProperty` can evaluate imports/property functions and introduces workspace SDK selection and trust risks even without a build target. Neither is authorized by the current template-operation contract. Source parsing meets the first read-only navigation slice without telemetry, sign-in, network requests or SDK execution. Root `package.json` has `xml2js` only in development dependencies; that is not proof of a packaged extension runtime dependency. Prefer the bounded reader with targeted fixtures; any dependency addition requires explicit packaging/license/lock review rather than assuming availability.

This choice does not bypass toolchain resolution: graph reads need no SDK at all; language/runtime readiness continues to come exclusively from the canonical boundary. Exact evaluated graph parity and `.slnx` support are later refinements, not implicit promises of this `.sln`/`.csproj` slice.

## Proposed Toolchain Boundary Amendment

`contracts.ts` currently exposes local machine readiness and a verified executable/SDK version, plus a strictly guarded template-operation command. SDK Ready does not establish a compatible runtime for this server, project compatibility, or a remote host. A runtime-only machine must not become editing-ready merely because a matching host is found independently.

Propose one narrow, versioned editing-host resolution command, implemented by the existing local toolchain extension. It freshly rechecks SDK readiness, validates a compatible stable runtime in the same verified installation, and returns that executable/root plus a compatibility outcome. It accepts no executable, arbitrary arguments, workspace cwd, URLs or caller child environments. Any required runtime probes use fixed argv, validated absolute executables, non-workspace cwd, time/output bounds and the existing sanitized child-only telemetry-opt-out process boundary. Insufficient runtime or SDK yields an actionable setup/recheck explanation; existing explicit installation authorization remains unchanged and no automatic install occurs.

This is a proposed boundary change, not already approved implementation authority. The plan gate must obtain/record a Decision-1-style parent disposition and any canonical-spec delta before apply. Preserve snapshot-v1 readers and template operations; do not broaden `runTemplateOperation` to run project evaluation. No change to machine discovery's workspace independence, home-scoped installation or local/UI-only policy is implied.

## Protected Boundaries

- Open VSX remains the sole anonymous gallery; no Microsoft Marketplace fallback, account-dependent headers, provider enrollment or rate/review sign-in routes.
- No Walker account, Copilot, agent, entitlement, Sync or telemetry services are restored. External-extension AI-disabling configuration is a suppression control, not reinstatement of Chat.
- Stable extension API shapes and no-op telemetry facades remain. Supported integration is validated against actual external package behavior, not mock-only success or claims to police arbitrary extension networking.
- Preserve profiles, unrelated settings/extensions/secrets, workspaces, Git/OS credentials, local .NET installations, generic remote/SSH/forwarding and ordinary logs/errors/output.
- No graph parsing process, network request, restore, shell interpolation, workspace execution or project-file mutation. Roslyn project loading is trusted-workspace-only because project imports, analyzers and generators can execute code; a read-only tree is not authorization for language-server project evaluation.
- Existing Welcome/project-creation commands, recent-history ownership and canonical toolchain behavior remain. New navigation opens normal editors and does not create parallel recent storage.

## Affected Areas

- New built-in Solution Explorer extension under `extensions/`, manifest/localization/build inclusion and extension unit fixtures.
- A narrow `src/vs/workbench/contrib/csharpEditing/` contribution and, only if necessary, an identity-scoped extension activation admission hook with regression tests.
- `extensions/dotnet-toolchain/src/contracts.ts`, `extension.ts` and focused runtime-resolution/process tests for the proposed boundary addition; any core command DTO mirror must preserve parity without importing implementation.
- Optional `product.json` C# file recommendation; manifest-level configuration defaults and explicit per-profile configuration actions. No third-party entry in `builtInExtensions`.
- Editing integration acceptance evidence and later canonical C# editing specification; targeted toolchain/protected-boundary amendments only where needed. Proposal phase writes no spec/design/tasks.

## Risks and Plan-Gate Conditions

1. **High: external package is not safe by default.** OmniSharp is default; runtime acquisition, telemetry libraries and AI component metadata are present. Before implementation authorization, validate the runtime dependency, activation ordering and standalone telemetry suppression. If enforceable configuration/gates cannot satisfy the confirmed constraints without forking/bundling, stop and return the incompatibility to the parent; do not silently change provider or weaken boundaries.
2. **High: runtime-resolution boundary widening.** Toolchain SDK readiness alone is insufficient for runtime >=10.0.5. Require the explicit parent disposition described above; do not execute a ready-snapshot path as if it were a general launcher.
3. **High: pre-activation races and unsafe upgrades/profiles.** Test already-installed/disabled extensions, workspace overrides, hostile inherited environment, extension updates and asynchronous readiness. A late settings write is not a gate.
4. **Medium: graph fidelity.** Complex MSBuild inputs remain partial and labeled. Test legacy namespaces, conditions/imports, duplicate references, missing files, links, multi-root/multi-solution and incremental refresh. Do not expand into evaluated build tooling to hide limitations.
5. **Medium: signature rider and acquisition failure.** A clean default profile currently cannot install successfully without the explicit existing workaround. Report the security tradeoff and access failure; do not count it as successful default verification.
6. **Medium: native-platform evidence and temporary sources.** Linux payload inspection does not establish Windows/macOS behavior. Preserve audited metadata/source excerpts/checksums in the change's evidence during plan/verify; `/tmp` paths are not durable acceptance artifacts. Pin platform-specific claims to actual evidence.

## Delivery and Rollback

One SDD change, delivered as a feature-branch chain off `main` at `c85de31f01c`. The parent owns every git operation, branch, commit, push and close/archive action. Each reviewable leaf must stay within **400 changed lines**, including its relevant tests/artifact accounting under the parent convention; size exception was declined. Forecast cohesive leaves for configuration/admission, toolchain resolution, solution parsing, project parsing, tree/navigation, incremental lifecycle and verification. These are sizing areas, not a task plan. If an inseparable leaf exceeds the budget or the high risks cannot be bounded, return to the parent before apply; do not relabel a large change as multiple nominal leaves.

Rollback removes first-party editing admission/configuration contributions, optional recommendation, tree extension and the added resolution command while retaining existing toolchain commands and user state. Do not uninstall user-acquired community extensions/dependencies or erase settings/projects. Restore only Walker-owned configuration values when they still equal the values Walker wrote, using recorded ownership/prior values; never reverse unrelated user edits. Disabling the integration must leave ordinary editing, syntax support and toolchain setup available. No rollback changes the signature policy or reintroduces removed account/AI/reporting services.

## Success Criteria

1. Packaged Walker offers an explicit Open VSX C# install/configure path without sign-in or bundling, reports the signature rider accurately, preserves disabled/uninstalled state, and fails truthfully offline or on denied acquisition.
2. With the supported extension/platform/version, trusted local workspace and compatible canonically resolved SDK/runtime, Roslyn standalone starts using the verified installation. Evidence establishes completion, diagnostics, hover, definition/references navigation and rename in a multi-project C# fixture; install logs alone are insufficient.
3. Real extension/server startup and error paths show API telemetry disabled, CLI telemetry opt-out effective, no Dev Kit/Copilot/agent activation, and no telemetry reporting. Configuration/environment conflict or unvalidated extension update prevents the supported path from starting; no automatic runtime acquisition or package restore occurs.
4. SDK missing/runtime-only/incompatible/checking/failed/unsupported-host states show correct setup/recheck/output actions without automatic install, independent PATH discovery, remote provisioning or false readiness. Existing toolchain and wizard contracts continue passing their focused tests.
5. Solution Explorer accurately shows the supported declared solution/project/file/dependency graph, navigates through normal editors, handles multiple roots/solutions and standalone projects, refreshes without stale scans/leaks, and clearly labels malformed/missing/unsupported/partial inputs. It remains usable without an SDK and performs no project execution or network access.
6. Keyboard/localization/theme-token/disposable checks cover the new tree and state/actions; no separate high-contrast visual-pass claim is made. Protected-boundary regression checks retain account-free Git/gallery/state/remote infrastructure and no-op extension API shapes.
7. Verification distinguishes live, automated and environment-gated evidence, records exact external versions/platforms, and measures every delivery leaf against 400 lines. The parent archives and pushes the approved change branch only after the full SDD close gate.

## Evidence Addendum

### Repository evidence read in this phase

- `.github/copilot-instructions.md`: architectural layering, built-in-extension conventions, localization/disposal requirements and focused validation guidance.
- `openspec/specs/protected-boundaries/spec.md`: Open VSX anonymous lifecycle, state/remote/diagnostic preservation; recorded community-extension/runtime versions and signature-verification rider; acquisition explicitly is not editing integration.
- `openspec/specs/dotnet-toolchain/spec.md`: execution-verified machine readiness, workspace-independent probing, sanitized process boundary, explicit installation authorization and local/UI host policy.
- `openspec/specs/project-creation/spec.md`: verified-toolchain reuse, structured arguments and bounded approved template behavior; no separate restore command.
- `openspec/specs/welcome-onboarding/spec.md`: command-based core/extension interaction, truthful unavailable states, disposal and canonical recent-history ownership.
- `extensions/dotnet-toolchain/src/contracts.ts`: versioned local snapshot; strict template request shapes/allowlists; no project evaluation or editing-runtime resolution command today.
- `extensions/dotnet-toolchain/src/extension.ts`: fixed `dotnet new` argv, fresh `recheck()`, child `DOTNET_CLI_TELEMETRY_OPTOUT=1`, bounded execution and local host guard.
- `extensions/dotnet-toolchain/package.json`: built-in UI extension manifest, packaged entry point and localized command contributions.
- `extensions/dotnet-toolchain/src/test/extension.test.ts`: verified-executable and fixed-argv/environment expectations, hostile-request and non-ready tests.
- `src/vs/workbench/contrib/projectWizard/browser/projectWizard.contribution.ts`: workbench alternative, command adapter into toolchain, file/open/history services and ordinary diagnostic output.
- `src/vs/base/common/product.ts`, `product.json`, `src/vs/workbench/contrib/extensions/browser/fileBasedRecommendations.ts`: real recommendation/API-permission shapes and recommendation consumer; product built-in artifact list is distinct from anonymous user installation.
- `src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts`: `extensions.verifySignature` application-scoped default remains true.
- `src/vs/workbench/api/common/extHostTelemetry.ts`: permanent disabled telemetry/API-compatible no-op logger regardless of legacy initialization values.
- Root `package.json`: `xml2js` is a development dependency, not evidence of packaged extension availability.
- `out-build/v-evidence/07-openvsx-install-csharp.log`: FAILED default-path signature attempt, not successful acquisition.
- `out-build/v-evidence/08-openvsx-install-csharp-noverify.log`: successful anonymous install of C# `2.145.21-g154a82fd27` and runtime extension `3.2.0` with the prior explicit workaround.
- Lifecycle information in the canonical protected-boundaries verification record and the earlier inspected `09-openvsx-list-uninstall.log` search results confirms list/uninstall; not represented as newly executed verification.

### External package evidence supplied by the parent and inspected directly

- `/tmp/csharp-ext-evidence/ver.json`: Open VSX version/platform download metadata, declared runtime dependency and gallery license field.
- `/tmp/csharp-ext-evidence/csharp/extension/package.json` and `/tmp/csharp-ext-evidence/csharp-linux-x64/extension/package.json`: both declare the runtime extension dependency; exact setting names/defaults, workspace host, activation/trust capabilities, AI/reporting dependency metadata and Roslyn version `5.9.0-1.26318.9`.
- `/tmp/csharp-ext-evidence/csharp-linux-x64/extension/dist/extension.js`, especially lines 951 and 966: runtime >=10.0.5 query/acquisition fallback; Dev Kit-only toolingRuntimePath; inherited child environment; server-path environment precedence; Roslyn standalone launch, environmentVariables merge; Dev Kit telemetry/session and AI-component branches. Very long bundled lines limit file-tool access to other fragments; exact runtime requester identifier and dependency mapping semantics remain plan-time audit requirements, not asserted facts here.
- `/tmp/csharp-ext-evidence/csharp-linux-x64/extension/.roslyn/Microsoft.CodeAnalysis.LanguageServer.runtimeconfig.json`: framework-dependent net10 server, base runtime 10.0.0 and major roll-forward; client runtime policy is separately >=10.0.5.
- `/tmp/csharp-ext-evidence/csharp-linux-x64/extension/.roslyn/Microsoft.CodeAnalysis.LanguageServer.xml`: project-load telemetry exists in the server; CLI opt-out alone must not be treated as blanket reporter proof.
- `/tmp/csharp-ext-evidence/csharp-linux-x64/extension/readme.md`, `RuntimeLicenses/license.txt`: community Open VSX acquisition and free-debugger intent; mixed artifact license inventory requires preservation/review, not a claim that every bundled component is Roslyn/MIT.

### Parent-provided confirmed context

The parent supplied full `roadmap/csharp-editing-lane` observation 1489 and `sdd/csharp-editing/decision/lane-direction` / `decision/session-preflight` records inline because this executor has no Engram tools. These establish provider/no-bundling direction, canonical toolchain reuse, binding non-goals, openspec storage, base revision, feature-branch-chain delivery and the 400-line/no-size-exception constraint. No memory read/save operation or live verification execution is claimed by this phase.
