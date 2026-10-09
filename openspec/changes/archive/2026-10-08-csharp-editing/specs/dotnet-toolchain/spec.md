# Delta for .NET Toolchain

## ADDED Requirements

### Requirement: Versioned editing-host resolution

Walker SHALL expose a narrow versioned local editing-host resolution command that freshly rechecks canonical SDK readiness and verifies a stable runtime compatible with the audited C# server in the same verified installation. It SHALL return the verified executable/root, SDK and compatible runtime version, or a structured unavailable/invalid/failure outcome. A runtime-only installation MUST NOT suffice. Requests MUST NOT accept executable paths, arbitrary argv, workspace cwd, URLs or caller environments. Internal probes SHALL use fixed arguments, validated absolute executables, a non-workspace cwd, time/output bounds and the existing sanitized child-only telemetry-opt-out process boundary. Resolution MUST NOT install/download, mutate installations, change parent/terminal environments, evaluate projects, assert project compatibility or provision remote hosts. Snapshot-v1 readers, setup authorization and the template-operation allowlist SHALL remain unchanged.

#### Scenario: Compatible verified SDK installation
- GIVEN a local desktop toolchain with a freshly execution-verified SDK and compatible stable runtime in that installation
- WHEN a valid versioned editing-host request is made
- THEN resolution returns that executable/root and verified versions without independent discovery or acquisition.

#### Scenario: Missing or incompatible runtime
- GIVEN SDK readiness is absent or no compatible stable runtime exists within the verified installation
- WHEN editing-host resolution is requested
- THEN a structured actionable unavailable outcome is returned and no runtime is downloaded or sourced from another installation.

#### Scenario: Hostile request or unsupported host
- GIVEN a request contains an unknown schema/profile or caller executable, argv, cwd, URL or environment, or execution is not local desktop/UI
- WHEN the command receives it
- THEN invalid input or unsupported locality is reported and no supplied process or remote probe executes.

#### Scenario: Recheck and probe failure
- GIVEN prior readiness is stale or a bounded runtime probe fails, times out or returns malformed output
- WHEN resolution runs
- THEN it freshly checks readiness and returns non-ready/failure rather than trusting stale paths, executing workspace configuration or broadening template operations.
