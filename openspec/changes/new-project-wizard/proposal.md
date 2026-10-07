# Proposal: .NET Project Creation Wizard

## Intent and users

Walker is intended as a free, open-source alternative to JetBrains Rider; creating a project is table-stakes functionality for a .NET IDE. Developers should be able to start a supported .NET project from the Welcome page or normal application navigation without first learning CLI template syntax, while retaining control over SDK, project options, destination, restore, and window behavior.

The approved scope is the full Walker .NET project wizard, including Welcome-page recent projects. It builds on the existing `welcome-onboarding` and `dotnet-toolchain` capabilities. Product choices are approved in the handoff and are recorded here rather than reopened.

## Repository evidence and proposed capability structure

- `openspec/specs/welcome-onboarding/spec.md` specifies account-free onboarding and the existing Welcome flow. Its current source is under `src/vs/workbench/contrib/welcomeOnboarding/`; keep project creation as a dedicated capability rather than expanding onboarding into a project-generation implementation.
- `openspec/specs/dotnet-toolchain/spec.md` and `extensions/dotnet-toolchain/` establish the SDK resolver and wizard-adapter/registration contracts, including local-machine resolution, no-network constraints, and toolchain state. Project generation must consume this boundary rather than introduce an independent SDK lookup or silently select an executable.
- Add a new `project-creation` capability for template enumeration, option modeling, creation orchestration, and the wizard's user-visible behavior. Amend `welcome-onboarding` for the Welcome entry and recent-project presentation, and `dotnet-toolchain` only as needed to define/consume the existing resolver adapter contract. The implementation must keep core-to-extension integration command/adapter based; core must not import extension implementation modules.
- Relevant implementation surfaces include `src/vs/workbench/contrib/welcomeOnboarding/**`, the Welcome/Getting Started recent-entry model in `src/vs/workbench/contrib/welcomeGettingStarted/**` or the canonical recent-workspace service, command/menu registration, and `extensions/dotnet-toolchain/**` adapter and package contributions. Exact owners and boundaries are design-phase verification items.

## Approved design contract

### Entry points and recent projects

Expose project creation through a Welcome page button (labelled “New C# Project” or “.NET Project”), a File menu item, and a command-palette command. The Welcome page also tracks recent project folders/workspaces and lets the user reopen one. Reuse the canonical recent-workspace mechanism where it meets the approved behavior; do not create a competing recent-history store without a demonstrated contract gap.

### Templates and configuration

Drive template discovery and generation through `dotnet new` and templates available from the active SDK selected via the `dotnet-toolchain` resolver contracts. The supported picker surface is console, class library, Web API, MVC, Blazor, worker, and test projects with xUnit or NUnit. The wizard configures project name, folder/location, target framework (including net10.0/net8.0 when offered by the selected template), Web API minimal-API versus controller style, test framework and template-supported include-tests options, Git initialization, restore, and opening in the same or a new window.

Template options are SDK/template-version dependent. The product contract is to expose only options actually offered by the selected template, with safe defaults and understandable validation; never assume an option exists merely because it exists in another SDK. The scope handoff identifies local SDK 10.0.401 for option-surface inspection, but this proposal environment provides no command-execution tool. Therefore `dotnet new <template> --help` was not run here and no individual CLI switch or template-specific availability is asserted. Design must capture actual help output for the target SDK and fixtures/tests must tolerate option differences.

### Execution and safety

Resolve the active SDK through the canonical toolchain adapter and use its verified executable for template listing and generation. Treat template output and option metadata as external process data: validate user inputs, pass structured arguments without shell interpolation, show generation errors, and do not report success until the output project exists and the requested operations have completed or their failure is clearly reported. Respect the user's restore toggle; a restore failure must not erase a successfully generated project. The template catalog is local to the active SDK; network template installation is not part of this scope. Project creation remains account-free and telemetry-free.

## Scope

In scope:

- A new project-creation capability and the Welcome, File-menu, and command-palette entry points.
- SDK-resolved `dotnet new` template discovery and project generation for the approved template families.
- The approved configuration choices, gated by the selected template's real option surface.
- Git initialization and optional restore behaviors, with actionable partial-failure reporting.
- Same-window/new-window opening behavior.
- Welcome-page recent project/workspace tracking and reopen action using canonical recent-workspace behavior.
- Focused UI, command, adapter, template-option, process, and failure-path tests, plus documented SDK/template coverage.

## Out of scope

Solution-level management, multi-project orchestration beyond the approved test-project/template options, arbitrary template installation or marketplace, NuGet package browsing, C# language-service/editor/debugger integration, project migration, and general-purpose project scaffolding outside the listed templates are excluded. This change does not alter SDK installation/resolution policy, authentication, telemetry, or unrelated Welcome content.

## Impact and constraints

Expected changes span a new project-creation implementation (likely a core UI/command surface plus adapter integration), onboarding/Welcome contributions and tests, recent-workspace presentation, and the existing toolchain extension adapter/manifest only if its established contracts need a narrow extension. The feature must remain compatible with the archived product-debloat guarantees: no account or sign-in dependency and no telemetry. It must not add a network dependency; local template discovery and generation use the selected SDK.

The implementation should preserve existing recent-workspace history and ordering semantics, avoid duplicate entries, and handle missing/deleted recent paths gracefully. Workspace opening must honor same/new-window choice and not claim a workspace opened when the launch request fails. Generation errors, unavailable SDK, invalid destination/name, cancellation, and restore/Git initialization failures need explicit user feedback and safe retry paths.

## Success criteria

1. All three approved entry points launch the same wizard and are discoverable with keyboard navigation; the Welcome page exposes recent projects that reopen through canonical workspace behavior.
2. The wizard identifies the SDK resolved by the toolchain adapter and presents only template options supported by that SDK's installed templates. Tests or captured evidence cover the actual SDK 10.0.401 help surface and the listed template families; unavailable templates/options are explained rather than fabricated.
3. A successful configured flow creates the selected template at the selected location with the requested framework/style/test options, applies Git initialization and restore toggles as requested, and opens in the chosen window mode.
4. Process invocation uses validated structured arguments and the resolved SDK, with no shell interpolation, independent SDK discovery, or network template acquisition. Missing SDK/template and malformed/unsupported options do not create misleading success states.
5. Cancellation and failure cases preserve user data and any generated project; restore failure is surfaced without destructive cleanup. Recent history updates only for valid created/openable projects, avoids duplicates, and handles missing paths gracefully.
6. The experience remains account-free and emits no telemetry; focused tests cover entry points, adapter interaction, option variation, generation, partial failures, recents, and window selection.

## Risks and decisions

- SDK templates evolve, and CLI option names vary. Discover/validate against the active SDK and test representative template help output; avoid hard-coded universal assumptions.
- Framework targeting may be template-dependent. Present only the target frameworks actually supported/offered and avoid silently upgrading or changing the SDK.
- The repository may have more than one recent-item surface. Design must identify the canonical Welcome/recent-workspace model and extend it instead of creating inconsistent parallel history.
- Generation, restore, and Git initialization are separable operations. Report partial success accurately and never delete generated files as implicit rollback.
- The active SDK may be unavailable or extension activation may fail. Provide an actionable route to toolchain setup/retry without authentication fallback.
- Scope gate: **NEEDS-DISCUSSION**. The requested exploration includes live `dotnet new <T> --help` inspection, Welcome/recent implementation inspection, and command registration inspection, but the available read-only tools expose repository file reads/search only and cannot execute commands. The existing specifications and toolchain source surface were inspected; actual template option output and implementation-level entrypoint evidence remain unverified. Resolve these evidence gaps in design before implementation scope is frozen. This is an evidence limitation, not a request to revisit the approved product contract.

## Rollback

Disable/remove the project-creation command and Welcome/File-menu contributions, revert the new capability's implementation, and restore any amended adapter contract. Do not delete generated projects or rewrite/delete existing recent-workspace data. Keep the account-free and telemetry-free product boundaries intact. If failure occurs after generation, leave files in place and explain the partial result rather than attempting destructive cleanup.

## Work-breakdown sketch

1. Inspect Welcome and recent-workspace implementation and capture `dotnet new` help for the supported templates from SDK 10.0.401; establish exact adapter and command boundaries.
2. Specify project-creation capability requirements, dynamic template-option behavior, validation, process execution, error states, and recent-item semantics.
3. Implement SDK-resolved template discovery and wizard orchestration with tests for option variation and safe argument construction.
4. Add Welcome, File, and command-palette contributions plus recent project display/reopen behavior, reusing the canonical recent model.
5. Verify generated output and requested toggles, partial failures, window selection, account/telemetry boundaries, and focused regression suites; document platform/template gaps.

This proposal documents the approved scope; detailed requirements, design, and executable tasks belong to subsequent SDD phases.

## Evidence addendum (parent, 2026-10-08 — fills the scope-gate evidence gaps)

**Active SDK template surface (SDK 10.0.401, `dotnet new list` / `--help` captured)**: console, classlib, webapi (+ webapiaot), mvc, webapp/razor, blazor (+ blazorwasm), worker, xunit, nunit (+ nunit-playwright) — every user-approved template is present. Common options: `-n/--name`, `-o/--output`, `--dry-run`, `--force`; template-specific options (e.g. `--use-minimal-apis`/`--use-controllers` for webapi, `--framework` where offered) are to be enumerated per-template at design and exposed only when the selected SDK's template supports them (proposal risk #1 addressed by an option-dry-run discovery step in the design).

**Welcome/recents surfaces (post-debloat tree)**: the Welcome page is `src/vs/workbench/contrib/welcomeOnboarding/browser/` (`welcomeOnboarding.contribution.ts`, `dotnetToolchainStep.ts`, `onboardingVariationA.ts`); recents ride the workspaces service (`src/vs/workbench/services/workspaces/`, `IRecentlyOpened` machinery) consumed by the titlebar menu + file dialogs.

**Toolchain extension surface**: `extensions/dotnet-toolchain/src/` (contracts/candidates/probe/installer/…); `package.json` contributes 4 commands (`walker.dotnet.{recheck,setup,showOutput,showActions}`) with no menus; the wizard plugs in through its contracts module (no separate wizardAdapter file exists — the canonical spec's registration contract lives in `contracts.ts`).

**Scope-gate re-evaluation: PASS** — the gate's NEEDS-DISCUSSION was evidence-only (no `dotnet new` inspection + surface-location uncertainty), not a scope conflict; the user-approved contract is unchanged and the gaps are now closed with captured evidence.
