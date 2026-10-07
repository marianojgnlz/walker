# Design: .NET Project Creation Wizard

## Status, inputs, and scope

Approved proposal and parent evidence addendum were read, including the scope-gate PASS. Canonical `welcome-onboarding` and `.NET Toolchain` specifications, archive design/tasks conventions, and OpenSpec configuration were read. No `rules.spec`, `rules.specs`, `rules.design`, or `rules.tasks` overrides are configured. The proposal's evidence addendum locates the Welcome page, `IRecentlyOpened`, toolchain `contracts.ts`, and SDK 10.0.401 template families/options. No active competing change spec was found in the searched change paths. This is a plan only; no implementation or tests were run. Proposal scope is unchanged.

Create a dedicated `src/vs/workbench/contrib/projectWizard/` workbench contribution, not an extension-owned wizard. The UI is a core workbench surface invoked by Welcome, File menu, and command palette; it needs ordinary workbench navigation and window-opening integration. The existing toolchain extension remains the authority for resolved SDK and process contracts, called through commands/adapter contract; core must not import extension implementation modules. No new SDK resolver, template downloader, sign-in, telemetry, or network template installation is introduced. The welcome contribution is amended only for its entry point and canonical recent-project display/reopen behavior.

## D1 — Wizard ownership and integration boundary

The wizard's views, command, template-option model, validation, and orchestration live under `src/vs/workbench/contrib/projectWizard/`. Register one command as the common entry point; expose it from the Welcome page, File menu, and command palette, all routed to the same flow. Follow workbench contribution/command/menu conventions. Use the toolchain extension's existing registration and `contracts.ts` contract via command/adapter calls to acquire the verified executable and operational state. The exact method/contract shape is implementation discovery; do not add an independent resolver or import extension source into core. If the current contract cannot supply required verified executable/process capability, stop and return a narrow contract gap to the parent rather than bypassing it.

A core workbench wizard is preferred over an extension-provided UI because entry-point consistency, localization/accessibility, canonical workspace open behavior, and Welcome integration are workbench responsibilities. The extension remains responsible for local SDK readiness and verified SDK identity. All subprocess execution must respect the existing process-runner/environment-sanitization boundary; any extension-side command needed to expose generation/process execution remains a narrow command/adapter extension of that established boundary, not an independent SDK lookup. No template operation may fetch/install templates from a network.

## D2 — UI flow and state

The wizard flow is: template picker → configuration → progress/result → open. Keep the selected template and validation errors while moving between stages; cancellation must stop owned work safely and preserve generated files. Present SDK state early. Missing/unavailable SDK reuses `walker.dotnet.setup` (the explicit toolchain setup flow) and offers retry/cancel; do not create a second installer UI or imply readiness. If setup succeeds, refresh the toolchain contract before listing templates.

The template picker is driven by the active verified SDK's locally installed templates, restricted to approved families: console, classlib, webapi and webapiaot, mvc, webapp/razor, blazor and blazorwasm, worker, xunit, nunit. Display friendly labels while retaining the SDK's actual template identity. Hide unavailable templates and explain an empty/unavailable catalog; do not install templates.

Configuration includes project name, parent location/output, target framework only when supported, Web API style only if its selected template exposes the corresponding choice (e.g. `--use-minimal-apis` / `--use-controllers`), test framework/template choices and include-tests only when offered, Git initialization, restore, and same/new-window opening. Defaults must be safe and validation actionable. Do not conflate `webapi` and `webapiaot`, or assume every SDK/template version shares options.

Progress is cancellable where process semantics permit, accessible, and reports generation, optional Git initialization, optional restore, and opening separately. Template failure writes diagnostics to a `.NET Project` output channel with a report action. Restore/Git failures preserve generated output and clearly report partial success. A successful creation updates canonical recent history and then opens in the selected window. Never report an open as successful before the workspace open request resolves successfully.

## D3 — Template option discovery and invocation

On the selected verified SDK, enumerate local templates and invoke `dotnet new <template> --help` for each selected template at design/runtime as appropriate. Parse the help surface into supported option metadata; retain raw bounded output for diagnostics, but do not trust metadata as executable input. Use the SDK 10.0.401 captured option evidence as fixtures, while treating active-SDK output as authoritative. `--dry-run` validates each configured command before actual generation; because `dotnet new --dry-run` may validate creation without creating files, it is a preflight, not proof of successful output. Confirm output existence after real generation.

Build an argument array for the resolver-provided executable, never shell text. Base arguments include `new`, the selected template, validated `--name` and `--output`; add `--framework` and discovered switches only if advertised. Map UI values to the exact enumerated option/value pair (including Web API style), never synthesize options based on another template or SDK. Validate name and destination, avoid argument injection, and ensure output handling does not overwrite user data without the template's explicit safe behavior/confirmation. Process cwd/environment and output bounds must follow the existing toolchain process-runner contracts. If those contracts do not permit safe argument-array process invocation for this use, extend the existing boundary narrowly and test its inherited environment sanitation rather than launching a shell from core.

Template help is version-dependent and potentially localized. Discovery must fail closed for malformed/unrecognized option surfaces: retain basic project fields that are independently known, but hide uncertain specialized controls and explain the limitation. Tests use captured SDK 10.0.401 fixtures plus option-variation fixtures and tolerate absent switches. At implementation time record actual help evidence for each listed template; do not claim switches supported merely from proposal examples.

## D4 — Recent projects and workspace opening

Reuse `IRecentlyOpened` in `src/vs/workbench/services/workspaces/` and its existing workspace-folder recents and open-window semantics. Add a Welcome presentation that consumes canonical recent-workspace data and delegates opening through established workbench workspace commands/services. Do not store a parallel list or rewrite history. Preserve canonical ordering/deduplication and handle deleted/unavailable paths gracefully. Add a created project only after it exists and is openable; rely on normal workspace opening/recents updates where possible, otherwise invoke the canonical recent service contract explicitly after verifying behavior. Inspect the Welcome/Getting Started recent-entry owner during implementation and keep the surface aligned without duplicating titlebar/file-dialog history.

Same-window opening uses the normal workbench open path; new-window opening uses its canonical window target option. Record and display actual open failures without deleting the generated project. Reuse existing history across windows and do not promise recents persistence beyond the service contract.

## D5 — Safety, errors, and boundaries

The wizard is account-free and telemetry-free. Add no telemetry events, auth checks, or network template APIs. Toolchain missing/unavailable/failed state offers existing setup/recheck/output actions and does not bypass the extension. Listing, help, dry-run, and generation use the selected verified SDK only. Errors distinguish resolver unavailable, SDK missing, no installed supported templates, option discovery failure, invalid configuration, dry-run failure, generation failure, Git failure, restore failure, and workspace-open failure. Localized messages and output diagnostics must avoid exposing secrets/environment dumps. Cancellation and disposal must guard late callbacks so stale results do not reopen UI or alter newer state.

## D6 — Files and verification

Expected implementation surfaces (confirm exact ownership before editing): new `src/vs/workbench/contrib/projectWizard/` command, UI, template discovery/option parsing, invocation orchestration, localization, and unit/browser tests; Welcome contribution/browser/tests and relevant recent presentation; command/menu registration in the new contribution; narrow `extensions/dotnet-toolchain/src/contracts.ts`/extension adapter change only if the established process boundary needs a supported invocation. Do not create a second recents service or duplicate SDK resolver.

Tests cover option parsing and per-template variation, no absent switches, structured arguments/no shell interpolation, SDK command/adapter errors, dry-run and generation failures, output existence, cancellation/late response, Git/restore partial failures, recent deduplication/missing paths, window selection/open failure, and shared entry-point routing. Add integration-surface tests for Welcome, File menu, command palette, toolchain setup reuse, and canonical recents. Where the suite and environment allow, test `dotnet new` invocations against actual SDK 10.0.401; do not make unit suites depend on a local SDK. Assert protected boundaries: no account/auth dependency, no telemetry calls, no network template acquisition, no independent SDK discovery, and no core import from extension implementation.

Rollout is additive: wizard command and entry points are available only after the common flow is wired; no destructive migration. Rollback removes/disables command/menu/Welcome hooks and wizard implementation, but never removes generated projects or rewrites recent history. Risks include SDK help-output variation, toolchain contract sufficiency for safe process invocation, template behavior differences, and divergence between the Welcome recent surface and service API; resolve contract gaps before implementation rather than inventing parallel mechanisms.

## Requirement coverage

| Requirement | Design decision | Verification |
| --- | --- | --- |
| Discover templates from the resolved SDK | D1–D3: consume verified toolchain identity and local catalog only | Adapter/catalog tests; SDK-backed catalog where available; no-network boundary checks |
| Expose only supported template options | D3: per-template help parsing and fail-closed option model | SDK 10.0.401 captured fixtures plus absent/variant options |
| Generate with structured local process arguments | D1, D3: resolver executable, argument arrays, dry-run then generation | Invocation tests assert exact args, shell false, output existence |
| Report progress, cancellation, and partial failures truthfully | D2, D5: staged state and preserve-output failures | Generation/cancel/Git/restore/report tests |
| Open the generated project | D2, D4: canonical same/new window opening and recent service | Window-mode/open-error/recent deduplication integration tests |
| Remain local, account-free, and telemetry-free | D1, D5: toolchain adapter only, no network template APIs | Static/source and integration boundary assertions |
| Optional accessible onboarding (modified) | D2, D4: Welcome entry and canonical recent presentation | Keyboard, localization, missing paths, normal open behavior |

## Review Workload Forecast

Estimated changed lines (additions + deletions, implementation and tests): **1,000–1,600**. The estimate is a planning forecast, not measured diff. A four-or-more-leaf feature across wizard, toolchain adapter, menu/Welcome, and recents exceeds the 400-line leaf budget and requires a feature-branch chain. Risk of any proposed unsplit batch exceeding 400 lines: **Medium**; any measured batch above 400 must be subdivided at the named boundaries, with tests retained.

Delivery strategy: ask-on-risk (preflight resolved to feature-branch-chain)
Review budget: 400 changed lines per leaf
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium
Suggested split: (1) wizard command/model + option parsing/tests, (2) process adapter contract + safe generation tests, (3) configuration/progress/open flow + integration tests, (4) Welcome entry/recents + window/accessibility tests, (5) end-to-end SDK 10.0.401 and protected-boundary verification. Keep coupled interface changes within a leaf only when recorded split analysis shows they cannot be reviewed independently; report any such pair to the parent for disposition before apply. Start from `product-debloat` and chain leaves on `new-project-wizard`; no size exception is assumed.