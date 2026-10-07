# Accounts Removal Specification

## Purpose

Make Walker-owned product and bundled-extension behavior account-free, including after upgrades and extension API requests, without interfering with plain Git credentials or other protected local capabilities.

## Requirements

### Requirement: No account or sign-in entrypoints

Walker MUST NOT expose or execute account management, provider selection, GitHub/Microsoft sign-in, OAuth enrollment, redirect/callback handling, entitlement enrollment, or account-consent flows. Their Walker-owned commands, menus, title/activity controls, badges, settings, notifications, URL handlers, and bundled provider implementations SHALL be removed, not merely disabled by defaults. Git-specific OS credential and SSH passphrase prompts are exempt only as specified in the Protected Boundaries Specification.

#### Scenario: Fresh-profile product surfaces
- GIVEN a fresh desktop profile with no account state
- WHEN command-palette, title-bar, activity-bar, settings, extension views, and registered product URL actions are inspected and exercised
- THEN no Walker-owned account, provider, sign-in, or OAuth entrypoint is available or starts a flow.

#### Scenario: Old account callback
- GIVEN an upgraded profile and a previously valid GitHub, Microsoft, or dynamic-provider callback URL
- WHEN the URL is delivered to Walker
- THEN it does not register a provider, redeem a token, open sign-in UI, or revive account controls.

### Requirement: Removal of account-dependent cloud capabilities

Walker SHALL remove Settings/Profiles Sync, account-gated Remote Tunnels, cloud Continue On/edit-session actions, and GitHub publishing/OAuth integrations together with their startup, transport, CLI, bundled-extension, manifest, and direct command-link wiring. An account-dependent cloud port-forwarding provider MUST NOT remain an alternative login path. Local profiles, local workspace restoration, generic port forwarding, SSH-based development, and plain Git remotes SHALL remain as specified in the Protected Boundaries Specification.

#### Scenario: Legacy cloud enrollment
- GIVEN stored Sync enablement, tunnel enrollment, or edit-session state from a previous version
- WHEN Walker starts, opens a workspace, or receives a former cloud command request
- THEN none schedules a cloud upload/download, token refresh, account login, tunnel registration, or cloud continuation.

#### Scenario: GitHub remote without GitHub integration
- GIVEN a repository with a github.com Git remote and working OS Git credentials
- WHEN the user pushes using the retained Git implementation
- THEN the ordinary push path operates without Publish to GitHub, GitHub OAuth, or provider discovery.

### Requirement: Inert public authentication compatibility

Any retained authentication API signature SHALL be an inert compatibility boundary rather than an account implementation. Passive session/account inspection SHALL return no session/accounts; requests to create or force a session or register a functioning provider SHALL fail deterministically as unsupported. No such request, including dynamic authorization-server, challenge-based, enterprise/MCP OAuth, or device-code requests, MAY invoke provider callbacks, network authentication, consent UI, token storage/refresh, a callback listener, or a workbench account service. Session-change compatibility events SHALL never announce a live account. Walker MUST NOT supply installed extensions with an active authentication platform service.

#### Scenario: Passive inspection
- GIVEN an installed extension and old persisted account sessions
- WHEN it requests a passive session or account enumeration through Walker's API
- THEN it receives no session/accounts and no account data is restored or disclosed.

#### Scenario: Forced session and provider registration
- GIVEN an extension supplies a provider implementation or requests a session with create/force semantics
- WHEN it invokes the retained authentication API
- THEN it receives the documented unsupported result and neither the provider implementation nor any authentication side effect runs.

#### Scenario: Dynamic OAuth request
- GIVEN an extension or retained MCP integration supplies an authorization-server URL or an authentication challenge
- WHEN it requests Walker-mediated authentication
- THEN the result is inert or deterministically unsupported without metadata retrieval, loopback listening, device-code polling, or browser sign-in.

### Requirement: No gallery account fallback

Walker SHALL remove gallery account services, marketplace sign-in commands/content/badges, account-required rating/review prompts, and account-gated gallery enrollment. Read-only extension metadata SHALL remain. An access-denied or unavailable gallery MUST NOT trigger authentication, alternate account-provider activation, or restoration of a stored gallery account. Anonymous acquisition SHALL satisfy the Protected Boundaries Specification independently of account services.

#### Scenario: Gallery access requires an account
- GIVEN a gallery response or an old enterprise-gallery setting requires account access
- WHEN Walker attempts extension browsing or acquisition
- THEN it reports the ordinary access/unavailable failure without sign-in or an account fallback.

#### Scenario: Ratings metadata
- GIVEN extension details include a rating and review count
- WHEN the details view renders and its available actions are inspected
- THEN read-only metadata is retained but no rate/review sign-in action or account-required review link is offered.

### Requirement: Non-destructive orphaned account state

Existing account/session, Sync, cloud continuation, tunnel, and OAuth secrets/state SHALL become inert on upgrade. Walker MUST NOT launch removed providers to sign out, revoke remote tokens, broadly wipe secret storage, or delete user data to obtain the absence guarantee. Removed settings SHALL NOT reactivate removed features. Normal unrelated secret storage SHALL remain functional. Direct links to commands removed by this change SHALL be removed; broader welcome-content redesign is outside this specification.

#### Scenario: Upgrade without data destruction
- GIVEN a profile contains old account secrets, Sync state, local profiles/settings, unrelated extension secrets, and repository data
- WHEN it is opened repeatedly with the debloated product
- THEN removed feature state is not consumed, refreshed, or uploaded, and protected data and unrelated secrets remain intact without remote revocation.

#### Scenario: Direct obsolete command link
- GIVEN retained UI previously linked directly to a command removed by this change
- WHEN that UI renders in Walker
- THEN it does not offer the obsolete command or replace it with a different account action.

## Verification record and documented gaps

This non-normative record carries the verified `product-debloat` delta into the canonical specification without inferring unavailable live evidence. Source artifacts at sync time are `openspec/changes/product-debloat/verify-report.md` (round 7), `implementation-evidence.md` (V1/V2 live Linux evidence pass), `compatibility.md`, and `parent-authorization.md` (close-gate decisions). The corresponding evidence remains part of that change's artifact bundle on later archival.

Evidence revision: `sha256:e4bbdb87c896082f41ac032349efc7ce954df6b09bd04714a955afde1d575514`. Round-7 whole-change verdict: PASS, zero blockers and zero critical findings. This is the verifier's completion verdict, not a claim that every platform or live scenario was exercised.

Round 7 fully substantiates 4/5 requirements and 10/11 scenarios in this domain. The requirements above remain the normative contract; recorded evidence limits are not exemptions or additional acceptance scenarios.

### Environment-gated scenario

| Requirement | Scenario | Recorded evidence limit |
| --- | --- | --- |
| Removal of account-dependent cloud capabilities | GitHub remote without GitHub integration | Live github.com push using OS Git credentials was not exercised: this pass's network scope covered Open VSX and suite-standard downloads, not github.com workflows. File and loopback-SSH Git results do not establish this scenario. |

### Carried residuals and compatibility

- The desktop package retains five dead `@microsoft/dev-tunnels-*` dependencies (567 ASAR entries) and the stale `bundle-dev-tunnels-web` script targeting the deleted `build/next/devTunnelsWeb.ts`. Round 7 finds no production importer; REH ships none. Dependency/script cleanup remains a bounded follow-up requiring lock-regeneration authorization, not evidence of a functioning account-tunnel path.
- Anonymous gallery lifecycle evidence uses the explicit per-profile `"extensions.verifySignature": false` workaround because the packaged `@vscode/vsce-sign` module is absent. Shipping the module versus accepting the workaround remains a parent decision; default-path installation success is not established. The full gallery limitation is recorded in the Protected Boundaries Specification.
- macOS/Windows native package/startup/Git/SSH smokes were not performed on the Linux-only host. Unit-level target-filter results do not establish native-platform behavior.
- Authentication is the passive-empty/deterministically-unsupported public facade documented in `compatibility.md`; the retained neutral MCP normalizer accepts legacy `oauth.clientId`/`oauthClientId` inputs as inert configuration data, with no downstream OAuth reader. No deletion or remote revocation of orphaned secrets is claimed.
