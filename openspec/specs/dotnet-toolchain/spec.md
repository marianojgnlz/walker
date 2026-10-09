# .NET Toolchain Specification

## Purpose

Establish local machine SDK readiness in Walker without accounts, administrative access, system-install changes, or project/editor integration.

## Requirements

### Requirement: Truthful local discovery

Walker SHALL detect on local desktop activation and explicit recheck. It SHALL distinguish Checking, SDK Ready, Runtime Only—SDK Needed, Not Installed, and Setup Failed. SDK Ready SHALL require successful execution of an SDK probe and include the verified SDK version and actual executable path. Executable existence or host/runtime version alone MUST NOT imply SDK readiness. Detection SHALL consider managed, PATH, and conventional user installations, independently of workspace configuration. It MUST NOT expose an SDK inventory or assert project compatibility.

Discovery SHALL obtain current local file-scheme workspace roots on every detection pass, including explicit recheck. It SHALL exclude candidates lexically contained in an open local workspace before realpath resolution and candidates whose resolved executable is contained in such a workspace before probing. Empty or relative PATH entries SHALL be ignored; remote URI folders SHALL NOT be interpreted as local filesystem roots. SDK verification SHALL use a non-workspace working directory and execute the candidate's validated, contained SDK MSBuild entrypoint directly, without project arguments or `global.json` resolution.

#### Scenario: Split installation
- GIVEN PATH resolves to `/usr/bin/dotnet` with runtime 10.0.11 and no SDK, and `~/.local/share/dotnet` contains a usable SDK 10.0.401
- WHEN discovery completes
- THEN the state is SDK Ready with 10.0.401 and the executable under `~/.local/share/dotnet`, not the runtime-only PATH executable.

#### Scenario: Runtime-only and missing machines
- GIVEN no candidate has a usable SDK
- WHEN all candidates are successfully classified
- THEN a usable runtime produces Runtime Only—SDK Needed and no usable host/runtime produces Not Installed; both offer managed SDK setup.

#### Scenario: Probe errors are not absence
- GIVEN a candidate is inaccessible, invalid, incompatible, or times out, and no other candidate verifies an SDK
- WHEN discovery finishes
- THEN the state is Setup Failed with a detection-stage diagnostic rather than Not Installed or Ready.

#### Scenario: Existing SDK wins over an unrelated failed candidate
- GIVEN a supported candidate verifies an SDK and another candidate fails
- WHEN discovery finishes
- THEN Walker reports the verified SDK Ready and retains the other candidate's diagnostic in output.

#### Scenario: Workspace independence
- GIVEN an open workspace contains `global.json`, scripts, or a relative PATH entry, or a candidate lies inside a current local workspace either directly or through a symlink alias
- WHEN detection executes or explicit recheck runs after workspace folders change
- THEN it neither executes workspace scripts nor uses workspace SDK resolution to establish machine readiness, and the current direct or resolved workspace-contained candidates never reach the probe.

### Requirement: Explicit install authorization

Every setup entry action SHALL open an explicit LTS / STS / Validated Specific Version choice. Specific Version SHALL require validated SDK version input. Walker SHALL show the selection and home-scoped destination before starting and obtain confirmation. Cancellation before confirmation MUST cause no installer execution, network request, or installation changes. No startup install or silent channel default is permitted.

#### Scenario: Channel and exact-version choices
- GIVEN the user enters setup
- WHEN the user selects LTS, STS, or a valid exact version and confirms the displayed choice and destination
- THEN installation requests that channel or exact version, rather than an implicit alternative.

#### Scenario: Invalid or canceled input
- GIVEN the chooser, version prompt, or confirmation is open
- WHEN the user cancels or submits an invalid version
- THEN no installation starts; invalid input is explained and remains correctable.

### Requirement: Trusted home-scoped installation

Walker SHALL use the official platform-appropriate `dotnet-install` script to provision the managed SDK at `~/.walker/dotnet` (the user's home equivalent on Windows). Execution SHALL follow authenticated HTTPS retrieval and integrity validation. Unvalidated user/workspace input MUST NOT become a shell command, executable, destination, or download URL. Walker MUST NOT elevate privileges, modify system installations, mutate system PATH, modify terminal environments, or edit shell profiles. Offline, proxy, TLS, and integrity failures SHALL be actionable failures, without insecure fallback.

Probe, installer, and termination-tool child processes SHALL share an environment sanitation boundary without mutating the parent environment. It SHALL remove inherited `BASH_ENV`, `ENV`, `SHELLOPTS`, `BASHOPTS`, `CDPATH`, `GLOBIGNORE`, `PS4`, `PROMPT_COMMAND`, `BASH_FUNC_*`, `DOTNET_*`, and `MSBUILD*` keys case-insensitively. Shell startup keys SHALL also be rejected from explicit child overrides. Trusted explicit probe DOTNET values SHALL be reapplied verbatim; sanitation MUST NOT indiscriminately reject every explicit DOTNET or MSBUILD value. Production probe overrides SHALL be limited to the owned root, telemetry opt-out, no-logo, and multilevel-lookup suppression. Public setup arguments MUST NOT supply child environments. Execution SHALL use fixed absolute interpreters or validated absolute executables, argument arrays, and `shell: false`.

On Unix, operation-owned downloader wrappers SHALL disable inherited curl/wget configuration and enforce HTTPS-only payload requests and redirects for both channel dry-run and installation. Downloader overrides and shim PATH SHALL remain child-only. This Unix enforcement MUST NOT be represented as established Windows PowerShell payload redirect protection.

#### Scenario: Platform installation boundaries
- GIVEN a confirmed setup on Linux, macOS, or Windows, with inherited shell or .NET execution-hook variables present
- WHEN the official installer runs through the shared child-process boundary
- THEN it installs into Walker-owned home-scoped storage without sudo/UAC, system writes, PATH changes, or shell-profile edits; inherited hook variables and explicit shell startup overrides are absent from the child environment while trusted explicit probe values remain verbatim and the parent environment is unchanged.

#### Scenario: Download cannot be trusted or reached
- GIVEN retrieval is offline, blocked by a proxy, redirected outside the approved trust policy, or fails integrity/TLS validation
- WHEN setup attempts retrieval
- THEN no downloaded script is executed and output identifies the failing stage and a safe retry path.

### Requirement: Serialized recoverable installation

Only one Walker-managed install SHALL modify the managed destination at a time across local windows. Repeated requests MUST NOT start competing installers. Progress and cancellation SHALL be available. Failure or cancellation SHALL preserve all pre-existing managed SDKs and system installations. Interrupted or ambiguous operations MUST NOT be silently treated as successful or destructively cleaned up.

#### Scenario: Concurrent requests
- GIVEN one local Walker window is installing
- WHEN another window or repeated click requests setup
- THEN only the original installation proceeds and the other requester receives a truthful busy/recheck indication.

#### Scenario: Failure and cancellation with an existing SDK
- GIVEN a managed SDK already exists
- WHEN a new install fails or is canceled during download, process execution, or verification
- THEN the old SDK remains intact, temporary owned data is safely handled, and cancellation returns to freshly detected state rather than claiming new installation success.

#### Scenario: Interruption and recovery
- GIVEN Walker exits unexpectedly during installation or finalization
- WHEN Walker next checks the toolchain or the user retries
- THEN it detects incomplete work, preserves the previous SDK and recovery data, and either safely restores the prior state or gives explicit non-destructive recovery instructions before permitting another writer.

### Requirement: Execution-based install verification

A zero installer exit code SHALL NOT suffice for success. Walker SHALL execute the installed managed executable to establish that an SDK is present and usable, and SHALL verify the published managed location before reporting success. An exact-version install SHALL verify the requested SDK exists and is usable. Failure to verify SHALL retain Setup Failed even if an unrelated system SDK exists; recheck may subsequently report independently verified readiness.

#### Scenario: Installer succeeds without usable SDK
- GIVEN the script exits zero but leaves no usable SDK
- WHEN verification executes
- THEN setup reports Setup Failed with verification diagnostics, not SDK Ready.

#### Scenario: Successful managed installation
- GIVEN the installer and managed executable verification succeed
- WHEN setup completes and when Walker restarts
- THEN discovery reports SDK Ready with the actual managed SDK version and executable location.

### Requirement: Shared command and status state

Walker SHALL expose setup, recheck, and output actions through commands and a status item. The extension and onboarding SHALL present equivalent Checking, SDK Ready, Runtime Only—SDK Needed, Not Installed, Installing, Verifying, and Setup Failed states. Ready tooltips SHALL identify version and executable. Failures SHALL offer retry/recheck and diagnostic output; cancellation SHALL not masquerade as failure or success. User-facing text SHALL be localized, keyboard-accessible, theme-compatible, and owned by disposable lifecycles.

#### Scenario: Progress and terminal state
- GIVEN setup is initiated from onboarding or a command
- WHEN the operation transitions through Installing, Verifying, and its terminal state
- THEN the status item and visible onboarding reflect that same operation, with no stale Ready result overriding a failure.

#### Scenario: Retry after cancellation
- GIVEN an install was canceled and its process stopped safely
- WHEN the user rechecks or invokes setup again
- THEN the detected state and supported actions are available without restarting Walker or losing previous installations.

### Requirement: Local desktop activation and packaged availability

The built-in extension SHALL be discoverable and activatable in the packaged desktop application. In remote desktop windows it SHALL operate on the local/UI machine only and label that locality. Browser or remote-host execution MUST NOT provision an SDK. Unavailable local extension support SHALL provide a non-authentication fallback without blocking onboarding dismissal.

#### Scenario: Remote workspace from desktop
- GIVEN desktop Walker has a remote workspace open
- WHEN toolchain setup is invoked
- THEN the chooser identifies the local machine and local destination, and no remote executable or remote filesystem is provisioned.

#### Scenario: Unsupported host
- GIVEN a browser window or forced remote extension host cannot provide local desktop setup
- WHEN setup is requested
- THEN an unavailable message is shown and no probe/install process starts remotely.

#### Scenario: Packaged first use
- GIVEN an installed Walker desktop package and fresh profile
- WHEN startup detection or a toolchain command first runs
- THEN the packaged extension activates without development-only module paths and provides its command/status contract.

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
