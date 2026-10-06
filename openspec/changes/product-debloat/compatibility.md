# Compatibility boundaries — Product Debloat

## Authentication API (U01.a.001)

The public `vscode.authentication` namespace remains available as an inert compatibility surface in both Node and worker extension hosts. The shared API factory implements:

| Operation | Retained behavior |
| --- | --- |
| `getSession` without truthy `createIfNone` or `forceNewSession` | Resolves `undefined`, including silent, challenge, and authorization-server inspection. |
| `getAccounts` | Resolves an empty array. |
| Proposed `hasSession` | Retains the `authSession` proposal guard, then resolves `false`. |
| `onDidChangeSessions` | Uses `Event.None`; listeners receive a disposable and never fire. |
| `getSession` with truthy create/force options | Rejects with localized `AuthenticationUnsupported` / `WALKER_AUTHENTICATION_UNSUPPORTED`. |
| `registerAuthenticationProvider` | Synchronously throws the same unsupported error without subscribing to or invoking the provider. |

The `authLearnMore`, `authIssuers`, and `authSession` proposal checks remain in force where their proposed options are used. The compatibility boundary does not restore provider discovery, account state, network/authentication requests, consent UI, or account services. Existing internal authentication services/RPC remain temporarily for their not-yet-disconnected consumers; their later removal belongs to A2 and is not claimed by this leaf.

## Terminal Chat service prerequisite (U05/U07) — resolved by the wave

The U05/U07 terminal prerequisite is resolved by the U06/U07 removal wave. The `agentHostTerminalService` implementation and its `IAgentHostTerminalService` registration were deleted, so the retained terminal workbench no longer renders hidden Chat terminal tabs or drives generic tab visibility through a Chat service. The only survivor is the inert `ITerminalChatService` interface declaration in `terminal/browser/terminal.ts` (decorator plus interface, zero implementations and zero consumers); the retained `productDebloatChatIntegrations.test.ts` asserts the terminal tabbed view carries no Chat references. This declaration does not authorize restoring terminal Chat UI registrations, Chat-agent tools, Chat-owned speech sessions, or Chat settings in generic terminal code.

## Account-free browser embedder API (A2-D2.001)

`IWorkbenchConstructionOptions.authenticationProviders` was removed from `workbench/browser/web.api.ts` together with its consumer in `AuthenticationService` (environment-contributed providers). This is an intentional account-free API change: browser embedders can no longer inject authentication providers, and the web workbench no longer seeds the secret store from a server-rendered `vscode-workbench-auth-session` element. Local persisted secrets, profiles and settings are untouched — only account-login bootstrap and provider discovery are gone. The A1 public extension API facade remains the deterministic unsupported/passive-empty boundary.

## Account-free MCP and issue-reporting retained behavior (A2-D2/D3)

- **MCP servers that required OAuth now take the non-auth path.** The MCP client no longer discovers WWW-Authenticate/OAuth metadata, requests tokens, tracks sessions or replays them on session changes. Ordinary (non-auth) MCP servers keep working end-to-end; a server requiring authentication fails without token acquisition instead of prompting or signing in. The deprecated `authentication` launch property was removed end-to-end (types, validator, type converter and the `mcpToolDefinitions` proposal declaration) because it was already dead code.
- **Issue reporting is anonymous.** The reporter no longer reads GitHub sessions or pre-fills `githubAccessToken`; it always uses the unauthenticated URL/form path. This is intentional under the account-free contract.
- **A1 facade unchanged.** `createAuthenticationApiFacade` remains the deterministic unsupported/passive-empty public boundary, and `accountFreeApi.test` stays green throughout.

## MCP OAuth configuration surface removed (A2-D3 residual)

The MCP `oauth`/`enterpriseManaged` configuration surface was removed end-to-end as an intentional account-free change: the `mcp.json` schema no longer accepts `oauth.clientId`/`oauth.enterpriseManaged`, the `mcp.enterpriseManagedAuth.idp` setting and its policy registration are gone, the "Set/Replace Client Secret" code lens and `SetOAuthClientSecret` command are removed, and `McpServerTransportHTTPOAuth` / `mcpOAuthClientSecretStorageKey` / the client-secret sanitizer no longer exist. Generic MCP configuration (`mcp.json` servers, headers, dev mode, collision behavior, sampling, discovery) and ordinary server start/stop/output flows are unchanged; no previously stored client-secret values are deleted from the secret store (they simply become unreachable).

## Telemetry call-site pruning — retained boundaries (U11 pass 1)

Two product-visible interface details changed intentionally while pruning call-sites; both are non-account, non-reporting and covered by focused tests:

- **`resolveMarketplaceHeaders` no longer takes service/telemetry dependencies.** Its signature is `resolveMarketplaceHeaders(version, productService)` and it returns only `X-Market-Client-Id` and `User-Agent`. The stored service-machine identifier (`getServiceMachineId`, `storage.serviceMachineId`, `<userData>/machineid`) is no longer generated, read or written — legacy values on disk are preserved and ignored. Functional gallery headers (`X-Client-Name`, `X-Client-Version`, `X-Client-Commit` in `AbstractExtensionResourceLoaderService.getExtensionGalleryRequestHeaders`) are unchanged. `extensionGalleryService.test.ts` asserts the functional headers remain and the three correlation headers (`X-Market-User-Id`, `VSCode-SessionId`, `X-Machine-Id`) are absent.
- **Remote telemetry RPC removed.** `IRemoteAgentService.updateTelemetryLevel`/`logTelemetry`/`flushTelemetry` and the `telemetry` IPC channel client are gone; `getRoundTripTime()` now uses the retained `remoteextensionsenvironment` channel. Remote connection/latency measurement behavior is unchanged from its post-U10 state (the `ping` command was already removed with the telemetry channel), and remote extension-host/workspace behavior is untouched.
- **`telemetry.feedback.enabled` is the only registered setting in the `telemetry` configuration section.** It is a retained non-telemetry setting (issue reporter, NPS survey, relauncher) and keeps its type/default/description/`EnableFeedback` policy metadata. `telemetry.telemetryLevel`, the deprecated `telemetry.enableTelemetry` and `telemetry.enableCrashReporter` are no longer registered; legacy values on disk stay untouched and inert, and no reader can enable reporting.
- **Retained no-op extension/telemetry contract unchanged:** `NullTelemetryService`/`NullTelemetryServiceShape`, the `ITelemetryService` shape (with its fixed sentinel identity fields), `TelemetryTrustedValue` and the `env.machineId`/`env.devDeviceId`/`env.sessionId` API members are deliberately untouched by this pass. `TelemetryTrustedValue` remains a public value/type marker only.
- **`disable-telemetry` argv stays accepted.** The integration runners, the smoke runner and `extensions/vscode-test-resolver` still pass it. It is recorded as a documented inert invocation-compatibility input: with no reporting service, no telemetry transport and no telemetry log output, the flag cannot turn anything on or off. Its removal is deferred to the T11 residual list rather than silently breaking those invocations.
