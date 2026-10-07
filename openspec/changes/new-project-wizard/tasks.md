# Tasks: .NET Project Creation Wizard

Planning inputs: approved proposal and scope-gate PASS, both change specs, and design. All paths are repository-relative. No implementation work or verification was performed in this plan phase. Parent owns goal/session todos and resolves any newly discovered scope or contract gap before apply.

## Review Workload Forecast

Estimated changed lines: **1,000–1,600 additions + deletions** including implementation, tests, localization, and documentation; not a net-diff estimate. Five proposed review leaves are each estimated below 400 changed lines. Overall 400-line budget risk: **Medium** because estimates are uncertain and cross-boundary integration can grow; measure each leaf and split any that exceeds 400 without trimming tests or docs.

Suggested split: (1) wizard contribution shell, entry command and option model; (2) safe process/adapter invocation; (3) configuration, progress, generation and partial failures; (4) Welcome + `IRecentlyOpened` recent presentation and window flow; (5) integration, SDK-backed evidence and protected-boundary checks.

Delivery strategy: ask-on-risk (preflight resolved: feature-branch-chain)
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

The parent-provided chain starts from `product-debloat` and chains on branch `new-project-wizard`. Coupled pairs may share a leaf only after recorded split analysis and parent disposition. No size exception is accepted. Any measurement above 400 is a stop-and-resplit point; do not reduce verification scope to fit.

## Review leaves

| Leaf | Estimate (additions + deletions) | Start → finish | Verification | Rollback |
| --- | ---: | --- | --- | --- |
| P1 | 180–300 | No wizard → command, picker/configuration shell, supported-option model | Unit tests for registration, model and option fixtures | Remove unexposed wizard scaffolding |
| P2 | 180–320 | Model → safe resolver/process adapter and dry-run/generation | Argument, environment, shell-false, adapter and process tests | Disable invocation command; preserve no user project data |
| P3 | 220–360 | Invocation → full progress, partial-failure, open orchestration | Generation, cancellation, Git/restore, output and open tests | Remove/disable unfinished command flow; never delete generated projects |
| P4 | 180–320 | Wizard flow → Welcome entry and canonical recents | Welcome keyboard/UI, recents dedupe/missing-path, window integration | Remove Welcome presentation/hooks; preserve canonical history |
| P5 | 180–300 | Integrated behavior → SDK-backed and boundary verification | Focused suites, actual SDK where available, account/telemetry/network checks | Disable feature entry points; retain generated data/history |

### P1 — Establish wizard contribution and dynamic option model

- [ ] RED: Add focused tests under `src/vs/workbench/contrib/projectWizard/test/` for common entry command routing, template catalog filtering, option metadata parsing, unknown/malformed help output, and differing template option surfaces. Include fixtures for SDK 10.0.401 families; prove unsupported switches are omitted. <!-- sdd-owner: implementation -->
- [ ] GREEN: Create the `src/vs/workbench/contrib/projectWizard/` contribution and localized template-picker/configuration shell. Register one common command and expose it through command palette and File menu using repository workbench conventions. Build the approved-template model from toolchain-provided local template information; do not discover SDKs independently or fetch templates. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: Verify every approved family has an appropriate fixture/identity mapping (console, classlib, webapi/webapiaot, mvc, webapp/razor, blazor/blazorwasm, worker, xunit, nunit) and missing templates/options remain unavailable rather than fabricated; consolidate parser helpers without broad option assumptions. <!-- sdd-owner: implementation -->

### P2 — Use verified SDK through the established safe process boundary

- [ ] RED: Add tests for resolver/adapter unavailable and malformed contract, verified executable propagation, structured argument arrays, no shell interpolation, sanitized child environment, bounded output, `--help` discovery and `--dry-run` validation. Include hostile names/destinations and absent template options. <!-- sdd-owner: implementation -->
- [ ] GREEN: Consume `extensions/dotnet-toolchain/src/contracts.ts` through the established command/adapter boundary. If it cannot safely support this operation, first document the narrow contract gap and obtain parent disposition. Implement local template listing/help and dry-run calls with the verified executable and argument arrays; extend the existing process boundary narrowly if needed, never add independent SDK lookup or a shell path. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: Assert generated command arguments contain validated `--name`/`--output`, and `--framework` or specific switches only when that exact template's help advertises them; verify `--use-minimal-apis`/`--use-controllers` only on supported Web API templates. Check all process paths retain toolchain environment sanitation and no network acquisition occurs. <!-- sdd-owner: implementation -->

### P3 — Complete configuration, generation, and truthful result handling

- [ ] RED: Add tests for project name/destination/framework validation, template-specific choices, safe defaults, dry-run failure, process failure, output existence, cancellation and late callbacks, Git failure, restore failure, and same/new-window open failure. Assert partial failures never delete generated files. <!-- sdd-owner: implementation -->
- [ ] GREEN: Implement configuration and orchestration stages (picker → configuration → progress/result → open); invoke only discovered options; validate actual project output. Reuse `walker.dotnet.setup` for missing SDK and refresh state before discovery. Send failures to localized `.NET Project` output with report action; report generation, Git, restore, and opening outcomes separately. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: Test successful flows for every option class, restore/Git disabled and enabled, cancellation at safe boundaries, malformed template responses, process timeout, partial success and truthful same/new-window behavior. Confirm no stale callback reopens UI and no failed open is described as success. <!-- sdd-owner: implementation -->

### P4 — Wire Welcome and canonical recent-workspace behavior

- [ ] RED: Add Welcome tests for the localized project-creation action and recent entries; cover canonical ordering/deduplication, existing versus missing paths, keyboard activation, and normal workspace opening. Verify no second history store is introduced. <!-- sdd-owner: implementation -->
- [ ] GREEN: Amend `src/vs/workbench/contrib/welcomeOnboarding/browser/` with the wizard entry action and recent-project presentation. Reuse `IRecentlyOpened` from `src/vs/workbench/services/workspaces/` and existing open-window semantics; implement no parallel recent data or storage. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: Exercise creation then open, recents update only for valid created/openable projects, duplicate suppression, deleted paths, same/new-window selection, localization, keyboard and high-contrast behavior. Confirm titlebar/file-dialog recents continue to observe the same canonical history. <!-- sdd-owner: implementation -->

### P5 — Verify integration and protected boundaries

- [ ] RED: Add integration-surface tests proving Welcome, File menu and command palette route to the same wizard, SDK-missing flow invokes the existing setup path, and unavailable adapter/template failures remain actionable. Add static or injected assertions for account-free, telemetry-free, local-template-only behavior. <!-- sdd-owner: implementation -->
- [ ] GREEN: Resolve only demonstrated integration defects in the wizard, Welcome contribution, or narrow toolchain contract. Run focused unit/integration suites; where the test environment permits, run the documented flows against actual SDK 10.0.401 and capture per-template `dotnet new <T> --help` option evidence for the approved template families. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE → REFACTOR: Run relevant project-wizard and Welcome suites and focused typecheck/build coverage; verify no telemetry/auth dependency, no network template request, no independent SDK discovery, no core import of extension implementation, and no parallel recents. Document unavailable SDK/platform checks honestly; refactor only after behavioral coverage passes. <!-- sdd-owner: implementation -->

## Implementation reporting

Report measured additions + deletions per leaf, test commands/results, actual SDK/template evidence, remaining gaps, and any proposed coupled pair to the parent. Stop for parent disposition on any contract/scope gap or >400-line leaf estimate. Never commit, delete generated projects, rewrite recent history, or claim unperformed verification.