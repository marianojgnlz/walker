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

## Terminal Chat service prerequisite (U05/U07)

The retained terminal workbench no longer uses `ITerminalChatService` to render hidden Chat terminal tabs or drive generic tab visibility. Preserve the `ITerminalChatService` interface and the `agentHostTerminalService` implementation/consumer as a U07 Agent Host prerequisite until its owner disconnects the Chat-specific terminal-host paths. This retained interface does not authorize restoring terminal Chat UI registrations, Chat-agent tools, Chat-owned speech sessions, or Chat settings in generic terminal code. Physical removal of disconnected terminal Chat source remains parent-owned.
