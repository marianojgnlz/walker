# C# Editing Specification

## Purpose

Provide account-free, telemetry-free C# language editing through an explicitly acquired community extension and a first-party, read-only declared Solution Explorer graph. Language readiness and graph availability are independent.

Domain assumption: the approved proposal has no Capabilities list. This new domain and an additive `dotnet-toolchain` delta are inferred from its scope. No canonical `csharp-editing` spec or competing active domain change was found; protected boundaries remain unchanged.

## Requirements

### Requirement: Explicit anonymous acquisition

Walker SHALL offer a localized Install/Configure C# Editing action through editing/Solution Explorer, using only anonymous Open VSX acquisition of `muhammad-sammy.csharp` and its declared runtime dependency. It MUST NOT bundle, fork, automatically install, silently enable, or substitute another provider. Walker-supported admission SHALL initially be limited to audited version `2.145.21-g154a82fd27` and independently validated platform payloads. Missing, disabled, incompatible, offline and failed-install states SHALL remain distinguishable. Installation alone MUST NOT imply language readiness.

#### Scenario: Explicit install with security failure
- GIVEN a missing extension and default `extensions.verifySignature=true`
- WHEN the user requests installation and packaged signature verification fails
- THEN Walker reports the actual failure and explains the explicit profile-level workaround without changing the setting or claiming success.

#### Scenario: Existing disabled or updated extension
- GIVEN the extension is disabled or its installed version/platform is unvalidated
- WHEN C# editing is requested
- THEN Walker explains the disabled/incompatible state, does not silently enable it, and does not admit the supported path.

### Requirement: Fail-closed activation admission

Walker MUST establish supported configuration, verified runtime mapping, trusted local file-workspace eligibility and an audited child execution environment before any supported C# client module executes. Admission SHALL cover automatic, explicit and dependency-driven activation. Effective user/workspace/folder overrides, hostile inherited execution hooks, unexpected server overrides, unvalidated extension/dependency updates and unavailable admission checks MUST fail closed. A newly conflicting already-active profile MUST lose supported admission and stop its relevant host before unsafe configuration reaches the client; repair SHALL require explicit configuration/reload actions and a fresh check. Walker MUST preserve unrelated settings, extension enablement and secrets.

#### Scenario: Override before activation
- GIVEN a workspace overrides Roslyn selection, server location, AI suppression, restore suppression or runtime mapping
- WHEN activation is requested
- THEN no client module executes and localized conflict/repair actions identify the affected scope.

#### Scenario: Hostile inherited environment
- GIVEN inherited server override or .NET/MSBuild execution-hook variables cannot be safely constrained for the third-party child
- WHEN admission checks the actual execution host
- THEN admission is denied without editing parent/terminal environments or shell profiles.

#### Scenario: Active-profile invalidation
- GIVEN an admitted client is running
- WHEN effective safety configuration, trust, locality or audited package identity changes
- THEN the relevant host is stopped before the new unsafe state is delivered, supported readiness is withdrawn, and repair/reload cannot bypass revalidation.

#### Scenario: Activation-time component fetch denied
- GIVEN the admitted C# extension identity attempts its unconditional VSWebAssemblyBridge installer fetch at activation
- WHEN the component-fetch deny rule intercepts it
- THEN the request is blocked before any non-local connection, the denial is logged with destination and extension identity, and desktop C# editing (diagnostics/completion) remains usable without the fetched component.

### Requirement: Canonical standalone Roslyn hosting

The supported path SHALL select Roslyn standalone, not the package-default OmniSharp, and SHALL use the extension-owned audited server and a stable compatible runtime of at least 10.0.5 from the canonically verified SDK installation. Runtime-only readiness, independent PATH discovery, acquisition fallback, automatic runtime download, Dev Kit hosting and OmniSharp fallback MUST NOT establish readiness. The actual client requester mapping and dependency behavior MUST be validated; failed mapping SHALL prevent activation rather than invoke `dotnet.acquire`.

#### Scenario: Verified standalone host
- GIVEN a trusted local workspace, audited packages and a freshly compatible canonical editing host
- WHEN admission succeeds and the server starts
- THEN it uses that verified installation and audited Roslyn payload with no Dev Kit or runtime-acquisition fallback.

#### Scenario: Runtime-only or incompatible SDK installation
- GIVEN SDK readiness is absent or the verified installation lacks a compatible runtime
- WHEN editing is requested
- THEN Walker offers existing setup/recheck/output actions without independently finding or installing a runtime.

#### Scenario: Mapping cannot guarantee provenance
- GIVEN the dependency mapping is missing, conflicting or not validated for the actual requester
- WHEN admission is evaluated
- THEN the supported client does not activate and acquisition is not attempted.

### Requirement: Reporting and AI suppression

Walker-supported editing MUST retain disabled extension API telemetry, suppress .NET CLI telemetry and demonstrate independent standalone Roslyn reporting suppression on startup, project loading and error paths. CLI opt-out alone MUST NOT count as blanket suppression. Walker MUST NOT invent an absent telemetry setting or undocumented server switch. Effective `chat.disableAIFeatures=true` SHALL keep RoslynCopilot acquisition and Copilot/Dev Kit activation inert without restoring Chat. Automatic restore and SourceLink/embedded-source network navigation SHALL be disabled. Ordinary local logs and errors SHALL remain usable.

#### Scenario: Real reporting paths
- GIVEN the admitted Linux payload is exercised with project load and an error
- WHEN actual client/server reporting paths are observed
- THEN no telemetry requests or telemetry-enabled server session/arguments occur, API senders remain unused, and ordinary diagnostics remain visible.

#### Scenario: AI and restore controls
- GIVEN the package contains AI download metadata and restoration capability
- WHEN the supported standalone path loads a project
- THEN no AI component is activated/acquired, no automatic package restore occurs, and external-source navigation does not fetch sources.

### Requirement: Declared solution and project graph

Solution Explorer SHALL show distinct local workspace roots and solutions, conventional `.sln` projects/solution folders, standalone `.csproj` projects, project-local files and supported explicit Compile/Content/None items including straightforward Include/Remove/Link handling. SDK-style implicit source inclusion SHALL respect supported disabling declarations and exclude bin, obj and .git. Declared ProjectReference, PackageReference and assembly Reference dependencies SHALL be shown as metadata, not evaluated build results. Duplicate declarations SHALL remain diagnosable without duplicate navigable nodes; missing targets SHALL remain visible. Navigable project/file nodes SHALL open normal editors; packages/assemblies MUST NOT cause metadata fetching.

#### Scenario: Multiple roots and solutions
- GIVEN two workspace folders, multiple solutions sharing a project and a standalone project
- WHEN the graph loads
- THEN root/solution identities remain distinct, solution-folder nesting is retained and standalone projects are not assigned a fabricated solution.

#### Scenario: Legacy and SDK-style project items
- GIVEN legacy XML namespaces and an SDK project with supported Include, Remove, Link and implicit-item controls
- WHEN their declarations are parsed
- THEN supported files/references are represented consistently with their declarations and no build evaluation is claimed.

#### Scenario: Missing and duplicate dependencies
- GIVEN duplicate project references, a missing referenced project and package/assembly declarations
- WHEN the tree renders
- THEN duplicates/missing targets have diagnostics and packages/assemblies remain non-fetching metadata nodes.

### Requirement: Bounded non-evaluating graph reads

Graph parsing MUST use bounded read-only source parsing without MSBuild, SDK processes, network requests, restore or project mutation. XML namespaces, attributes, comments and safe entities SHALL be handled structurally; DTD/external entities and malformed XML SHALL be rejected. Conditions, imports, property expansions, custom transformations and unsupported external links SHALL retain explanatory unresolved nodes and partial labels rather than silently pretending resolution. Size/count/depth/concurrency/work bounds SHALL be enforced. Symlink cycles and workspace escapes MUST NOT trigger automatic traversal. An external target MAY be displayed, but opening it SHALL require an explicit normal user action, never automatic scanning.

#### Scenario: Unsupported project semantics
- GIVEN conditional/imported/property-expanded metadata or malformed XML
- WHEN graph parsing runs
- THEN the tree is labeled partial, unresolved details and project-file navigation remain available, and no evaluator executes.

#### Scenario: Malicious or oversized input
- GIVEN a DTD, external entity, oversized file, too many projects, recursion cycle or symlink escape
- WHEN scanning encounters it
- THEN the input is rejected or bounded with a visible diagnostic and no external read, process or network execution.

#### Scenario: External linked file
- GIVEN a declared link leaves the authorized workspace
- WHEN the graph loads and later the user explicitly opens that node
- THEN automatic scanning does not read it and only the explicit normal editor action may open the target.

### Requirement: Refresh and accessible lifecycle

Solution Explorer SHALL refresh relevant declared graph changes incrementally and expose explicit Refresh. Workspace replacement and newer scans SHALL cancel/discard stale results. Watchers, tree registrations and listeners SHALL be disposed. Localized labels/actions, standard theme icons/tokens and keyboard navigation SHALL be provided. The declared tree SHALL remain usable without an SDK or language extension and in untrusted local workspaces; language-server project evaluation MUST remain trusted-workspace-only. Unsupported remote/browser/virtual graph hosts SHALL explain their limits without local execution of remote paths.

#### Scenario: Incremental change and stale scan
- GIVEN a tree with active watchers and an in-flight scan
- WHEN a project changes and workspace folders are replaced
- THEN only current relevant results are published, stale scans cannot overwrite them and old watchers are disposed.

#### Scenario: SDK absent or workspace untrusted
- GIVEN a local file workspace without an SDK or without trust
- WHEN Solution Explorer opens
- THEN read-only graph navigation works while language evaluation is unavailable with truthful setup/trust actions.

### Requirement: Truthful editing acceptance and preservation

Supported editing SHALL be demonstrated by completion, diagnostics, hover, definition/references and rename in a multi-project fixture, not installation logs alone. Evidence SHALL record package versions, platform, security workaround and automated/live/environment-gated limits durably. Linux inspection MUST NOT establish Windows/macOS success. Rollback SHALL retain projects, user-installed extensions, unrelated settings, normal editors/history, toolchain/wizard behavior and protected account-free/remote/no-op API infrastructure; Walker-owned settings SHALL only be restored if unchanged since Walker wrote them.

#### Scenario: Linux acceptance with workaround
- GIVEN an explicitly configured Linux profile using the documented signature workaround
- WHEN real multi-project editing is verified
- THEN each language behavior and reporting/acquisition constraint is recorded separately, and neither default-signature success nor Windows/macOS success is claimed.

#### Scenario: Rollback after user edits
- GIVEN Walker configured a profile and the user subsequently changed one owned value
- WHEN the integration is removed
- THEN unrelated state and acquired extensions remain, the user's later edit is preserved and existing toolchain commands still work.
