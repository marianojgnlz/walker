# Project Creation Specification

## Purpose

Enable account-free creation of supported .NET projects from Walker using templates installed with the locally resolved SDK, with validated configuration, truthful progress and failure reporting, and normal workspace opening behavior.

## Requirements

### Requirement: Discover templates from the resolved SDK
The project-creation experience MUST use the verified executable and SDK supplied by the .NET Toolchain resolver contract. It MUST enumerate installed templates locally and MUST NOT perform network template installation or independent SDK discovery. The wizard SHALL offer only approved template families actually available in that SDK: console, class library, Web API (including webapiaot where available), MVC, webapp/Razor, Blazor (including blazorwasm where available), worker, and xUnit/NUnit test projects.

#### Scenario: Installed template catalog varies
- GIVEN the toolchain contract provides a verified SDK and its installed templates differ from another machine's templates
- WHEN the user opens the template picker
- THEN Walker shows only the approved templates discovered from that SDK and explains unavailable templates without attempting network acquisition.

### Requirement: Expose only supported template options
The wizard SHALL discover each selected template's options using the selected SDK's `dotnet new <template> --help` surface and MUST expose only options present for that template and SDK. It SHALL provide validated project name, destination, and framework where supported, and relevant template-specific choices such as Web API minimal API/controller style, test framework, template-supported include-tests, and Git initialization. Defaults MUST be safe and invalid or unsupported values MUST be explained before generation.

#### Scenario: Template-specific option variation
- GIVEN two selected templates or SDK template versions expose different options
- WHEN the user configures a project
- THEN the wizard presents only options enumerated for that selected template and does not send absent switches.

### Requirement: Generate with structured local process arguments
Project generation MUST invoke the verified SDK executable with structured arguments and without shell interpolation. The invocation SHALL include the selected template and validated name/output, and SHALL include framework or template-specific switches only when supported. A dry-run/discovery step MUST validate the planned template options before generation. User input and template metadata MUST be treated as data, not executable commands.

#### Scenario: Validated generation invocation
- GIVEN the user confirms a valid configuration for an installed template
- WHEN project generation starts
- THEN Walker invokes the resolver-provided executable with an argument array, validated `--name` and `--output`, and only discovered supported options, without a shell or independent SDK lookup.

### Requirement: Report progress, cancellation, and partial failures truthfully
The wizard SHALL provide accessible progress and cancellation. A failed template invocation MUST be reported with actionable diagnostics through the .NET Project output channel and a report action. Walker MUST NOT report success until the output project exists and requested operations have completed or their failure is clearly identified. Restore or Git initialization failure MUST NOT erase a generated project; cancellation and failure MUST preserve user data.

#### Scenario: Template restore fails during generation
- GIVEN the user leaves restore enabled and the selected template restores dependencies as part of `dotnet new`
- WHEN that template command fails during its implicit restore
- THEN Walker preserves any generated output and reports the generation failure with the template's restore diagnostic; it does not claim success or present restore as an independently executed stage.

The approved toolchain command set does not include a separate `dotnet restore`; the `--no-restore` option disables the template's implicit restore when the selected template advertises it. Restore failure therefore cannot be distinguished from generation failure beyond the command diagnostic.

### Requirement: Open the generated project
After successful creation, the wizard SHALL offer opening in the same or a new window using the normal workspace-opening contract. It MUST NOT claim the project opened if the open request fails. Newly created/openable projects SHALL enter canonical recent-workspace history without duplicate entries.

#### Scenario: Open in selected window
- GIVEN a project was generated and the user chose same-window or new-window opening
- WHEN the open request succeeds or fails
- THEN Walker uses the selected window mode and reports the actual result; valid created projects are recorded through canonical recent history without duplication.

### Requirement: Remain local, account-free, and telemetry-free
Project creation MUST NOT require authentication or emit telemetry. Template discovery and generation MUST use templates already installed with the selected local SDK and MUST NOT make network requests for templates.

#### Scenario: Offline local creation
- GIVEN a verified local SDK and installed template are available while the machine is offline
- WHEN the user creates a project
- THEN template discovery and generation proceed locally without account prompts, telemetry, or template-network requests.

## Verification Record (Non-normative)

- Source change: `new-project-wizard`; normative content above is copied verbatim from `openspec/changes/new-project-wizard/specs/project-creation/spec.md`.
- Round-1 verification: `openspec/changes/new-project-wizard/verify-report.md`, verdict PASS, evidence revision `sha256:5984b4d8ac48ac45b28b31cec711e78f3cd6212f48af86ad43c5ed366dcece96`. The new domain covers 6/6 requirements and 6/6 scenarios; together with the Welcome amendment, the verified delta covers 7/7 requirements and 10/10 scenarios.
- Evidence scope: automated wizard-flow tests and extension contract/process tests passed separately. The independent live console-generation and Web API help probes exercised the SDK directly, not the wizard-to-contract-to-live-SDK composition.

### Residual Carry-over

1. Wizard-to-contract-to-live-SDK composition remains unexercised. Follow-up integration coverage should connect wizard requests to the real toolchain command and local SDK in an isolated temporary directory, asserting selected-template options and resulting files.
2. A live high-contrast UI/visual pass remains outstanding. Automated Welcome keyboard and theme-token coverage is not a live visual session.
3. Round-1 verification did not independently measure per-leaf changed-line totals. The subsequent `Parent review (2026-10-08)` addendum in `openspec/changes/new-project-wizard/apply-progress.md` records leaf measurements and security-leaf verdicts; these are supplementary parent evidence, not a new independent verification run or a size exception.
