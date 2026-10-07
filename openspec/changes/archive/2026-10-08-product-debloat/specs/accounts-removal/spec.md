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
