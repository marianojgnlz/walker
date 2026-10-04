# Protected Boundaries Specification

## Purpose

Protect account-independent repository management, anonymous extension acquisition, local state, key-based remote development, and ordinary IDE diagnostics while account, chat/agent, and telemetry capabilities are removed.

## Requirements

### Requirement: Plain Git operations and OS credentials

Walker SHALL retain fully functional bundled `vscode.git` and required `vscode.git-base` behavior: clone, fetch, pull, push, status, commits, history, branches, and generic remotes. SSH keys/agents, OS Git credential helpers, and Git-specific HTTPS askpass and SSH passphrase/host-confirmation behavior SHALL remain functional without platform account services. Git MUST NOT require GitHub/Microsoft OAuth, provider enrollment, or an accounts menu. Remote hostnames, including github.com and self-hosted Gitea/Forgejo/GitLab-style endpoints, MUST NOT be rejected or treated as account enrollment requirements.

#### Scenario: Key-based plain remote
- GIVEN an accessible plain Git remote and working SSH key/agent credentials
- WHEN the user clones and performs fetch, pull, commit, branch, history, and push workflows
- THEN the retained Git implementation performs them without account UI or provider calls.

#### Scenario: OS helper and askpass
- GIVEN a plain HTTPS Git remote and either a functioning OS credential helper or a credential request handled by Git askpass
- WHEN Git needs credentials
- THEN the OS/Git path supplies or prompts for them without Walker authentication-provider enrollment; SSH passphrase and host-confirmation prompts also remain available.

#### Scenario: github.com is a plain remote
- GIVEN a github.com Git URL with valid OS Git credentials
- WHEN clone, fetch, pull, or push is invoked
- THEN it uses ordinary Git credentials and does not activate a removed GitHub integration or require Publish to GitHub.

### Requirement: Working anonymous extension acquisition

The effective packaged desktop configuration SHALL use the approved Open VSX registry at `open-vsx.org` as Walker's anonymous extension gallery. Walker SHALL retain anonymous search, browsing/details, install, update, uninstall, dependency resolution, and local VSIX installation without gallery account services or rate/review sign-in prompts. Gallery functionality MUST NOT depend on telemetry collection/reporting or correlation identifiers. Ordinary request/product compatibility headers and read-only rating/install metadata MAY remain when required for anonymous acquisition, but usage-statistics reporting SHALL NOT remain a telemetry bypass. Missing configuration or denied anonymous access SHALL be reported as an implementation/access failure rather than silently selecting another provider or claiming success from mocks.

Suitable C# acquisition verification SHALL use an extension actually available on Open VSX. Microsoft-only extensions, including C# Dev Kit and Copilot, are not available there; Walker SHALL record this known provider gap. Their absence SHALL NOT fail the Open VSX acceptance criterion, trigger a Microsoft Marketplace fallback, or introduce sign-in. This scoped gallery baseline does not authorize unrelated provider migration or C# editing integration.

#### Scenario: Packaged anonymous lifecycle
- GIVEN the packaged product has effective Open VSX configuration and no account
- WHEN the user searches, opens extension details, installs an extension with dependencies, updates it, uninstalls it, and installs a local VSIX
- THEN these supported operations work without sign-in, telemetry reporting, or account-dependent request headers.

#### Scenario: Suitable C# extension availability
- GIVEN Open VSX is reachable from packaged Walker
- WHEN a suitable C# extension listed on Open VSX is located and acquired
- THEN acquisition succeeds without an account, its registry identity is recorded, and the result is not represented as proof that Walker now supplies C# language integration.

#### Scenario: Known Microsoft-only provider gap
- GIVEN C# Dev Kit and Copilot are not available on Open VSX
- WHEN gallery and C# acquisition acceptance is assessed
- THEN this expected provider gap is documented, an Open-VSX-available C# extension is used for acquisition verification, and the missing Microsoft-only extensions do not fail acceptance or cause another-provider/sign-in fallback.

#### Scenario: Missing or restricted gallery baseline
- GIVEN the effective desktop product lacks its Open VSX endpoint or Open VSX denies a required anonymous operation
- WHEN the baseline is assessed
- THEN the configuration/access failure is recorded and anonymous gallery success is not claimed or replaced with another provider; local VSIX behavior remains independently testable.

### Requirement: Preserve local user state without destructive migration

Local profiles, settings, workspace/repository data, user-installed extensions, unrelated extension secrets, SSH keys, OS credential-helper data, and remote configuration SHALL be preserved. Orphaned account, Sync, cloud-edit, chat, and agent state SHALL be ignored, not used to restore removed capabilities. This change MUST NOT perform broad secret-storage cleanup, remote-token revocation, remote-service deletion, or deletion of local profile/agent data. Existing local profile creation/switching and local workspace restoration SHALL remain functional.

#### Scenario: Upgrade with mixed state
- GIVEN a copied profile contains removed-feature state alongside local profiles/settings, unrelated secrets, repositories, SSH configuration, and installed extensions
- WHEN the product upgrades, restarts, and switches local profiles
- THEN protected state is retained, local profiles/settings work, and removed state remains inert without provider activation or destructive cleanup.

### Requirement: Preserve generic remote and port-forwarding infrastructure

Generic remote-agent/server infrastructure, SSH-key development, non-account port forwarding, remote extension hosts, and their ordinary connection/protocol behavior SHALL remain functional. Deletion SHALL distinguish account-gated cloud tunnels and agent-only transports from these retained capabilities. Generic server connection tokens or SSH transport authentication MUST NOT be removed merely because they use authentication terminology.

#### Scenario: Key-based remote workspace
- GIVEN an available remote development endpoint using SSH keys and the retained remote infrastructure
- WHEN the user connects, opens files, starts a terminal, and uses the remote extension host
- THEN these functions work without account enrollment and without starting an Agent Host.

#### Scenario: Non-account port forwarding
- GIVEN a remote workspace provides a service port through generic forwarding
- WHEN it is forwarded and accessed locally
- THEN the ordinary connection succeeds without GitHub/Microsoft login, a cloud-tunnel provider, or agent-only transport.

### Requirement: Preserve ordinary IDE diagnostics and established local setup

Ordinary logs, output channels, errors/notifications, debugging, Search/ripgrep, SCM, editing, terminals, local .NET toolchain setup, and account-free onboarding/personalization SHALL remain. Removing telemetry SHALL NOT remove ordinary error handling or diagnostic output. Existing .NET toolchain and welcome-onboarding canonical contracts SHALL remain unchanged. New-project creation, C# editing integration, NuGet/test/debug improvements, broader welcome-content redesign, replacement cloud/AI systems, and arbitrary-extension network policing are outside this change.

#### Scenario: Ordinary errors remain visible
- GIVEN a retained Git, gallery, editor, or extension operation fails
- WHEN its error is handled
- THEN ordinary diagnostic output and appropriate error notification remain while no telemetry report or telemetry log is emitted.

#### Scenario: Search and local toolchain onboarding
- GIVEN the packaged product has no chat/default agent, account providers, or Copilot shim
- WHEN text Search and the established .NET toolchain onboarding/status commands are used
- THEN ordinary Search works, local setup remains available with its existing authorization/verification behavior, and personalization/continuation has no sign-in fallback.
