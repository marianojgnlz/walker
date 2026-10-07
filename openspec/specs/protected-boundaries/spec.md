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

## Verification record and documented gaps

This non-normative record carries the verified `product-debloat` delta into the canonical specification without inferring unavailable live evidence. Source artifacts at sync time are `openspec/changes/product-debloat/verify-report.md` (round 7), `implementation-evidence.md` (V1/V2 live Linux evidence pass), `compatibility.md`, and `parent-authorization.md` (close-gate decisions). The corresponding evidence remains part of that change's artifact bundle on later archival.

Evidence revision: `sha256:e4bbdb87c896082f41ac032349efc7ce954df6b09bd04714a955afde1d575514`. Round-7 whole-change verdict: PASS, zero blockers and zero critical findings. This is the verifier's completion verdict, not a claim that every platform or live scenario was exercised.

Round 7 fully substantiates 3/5 requirements and 9/12 scenarios in this domain. Whole-change coverage is 15/18 requirements and 34/38 scenarios. The requirements above remain the normative contract; recorded evidence limits are not exemptions or additional acceptance scenarios.

### Environment-gated scenarios

| Requirement | Scenario | Recorded evidence limit |
| --- | --- | --- |
| Plain Git operations and OS credentials | github.com is a plain remote | Live github.com clone/fetch/pull/push using OS Git credentials was not exercised because github.com workflows were outside the pass's authorized network scope. File and loopback-SSH Git results do not establish this scenario. |
| Preserve generic remote and port-forwarding infrastructure | Key-based remote workspace | No remote development endpoint infrastructure was available for live file, terminal, and remote-extension-host workflows. Generic tunnel unit results and retained server-token logic do not establish this scenario. |
| Preserve generic remote and port-forwarding infrastructure | Non-account port forwarding | No remote workspace/service-port infrastructure was available for live forwarding and local access. Loopback Git SSH transport is not a remote-workspace forwarding smoke. |

Together with `GitHub remote without GitHub integration` in the Accounts Removal Specification, these are the four environment-gated scenarios recorded by round 7; none is represented as fully substantiated.

### Anonymous gallery evidence and signature-verification decision

The effective packaged desktop and REH configuration uses Open VSX. Live anonymous install-with-dependency, list, update, uninstall, and local-VSIX operations were observed using the per-profile `"extensions.verifySignature": false` workaround. The acquired C# extension was `muhammad-sammy.csharp` version `2.145.21-g154a82fd27` (license `SEE LICENSE IN RuntimeLicenses/license.txt`) with `ms-dotnettools.vscode-dotnet-runtime` version `3.2.0` (MIT). Local VSIX acquisition/update used `jakubkozera.csharp-dev-tools` versions `1.12.8` and `1.13.0`. Acquisition is not evidence of C# editing integration.

The default signature-verification path exits non-zero with `Signature verification was not executed.` because `@vscode/vsce-sign` is absent from the packaged app and root manifests. The workaround explicitly disables signature verification; it is not equivalent security evidence. The parent decision remains open between shipping that module (with dependency/lock authorization) and accepting the documented workaround. No default-path success, provider substitution, account fallback, or automatic policy change is claimed.

The registry returned the expected HTTP 404 provider gap for C# Dev Kit, Copilot/Copilot Chat, and Microsoft C#; the suitable Open-VSX-listed C# extension above supplies acquisition evidence instead. This does not weaken the requirement to report genuine configuration/access problems truthfully.

### Other carried residuals and live sub-step limits

- Five dead `@microsoft/dev-tunnels-*` dependencies (567 desktop ASAR entries) and the stale `bundle-dev-tunnels-web` script remain with no production importer; REH carries none. Bounded cleanup needs lock-regeneration authorization. This is a disclosed package residue, not a generic forwarding runtime verification.
- macOS/Windows native package/startup/profile/Git/SSH/signing checks were not performed on this Linux-only host. Unperformed recipes are `npm run gulp vscode-darwin-x64`, `npm run gulp vscode-darwin-arm64`, `npm run gulp vscode-win32-x64`, and `npm run gulp vscode-win32-arm64`. Passing target-filter unit fixtures are not native-platform evidence.
- Local-profile UI switching and OS-keychain secret storage were not directly exercised packaged-live. Mixed-state profile restarts, eight unchanged file sentinels and eight preserved orphaned state rows, plus local-profile unit tests, support the recorded preservation result without establishing those live sub-steps.
- The close-gate decision accepts `test/**` crash-dump argv uses as harness inputs. Inert cosmetics and consumer-less native upload/CSS remnants remain as disclosed in round 7; they do not restore removed sign-in, agent, or reporting behavior. Existing .NET Toolchain and Welcome Onboarding canonical contracts are unchanged.
