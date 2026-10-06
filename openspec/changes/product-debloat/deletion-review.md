# Deletion Review Decomposition — parent deletion commit dd1a928fd15

Parent record per verify round 1 finding ("the 16,274-line deletion lacks documented bounded review batches"). The physical deletion was a single parent `git rm` executed under the deletion protocol (executor performed all disconnection + absence tests first; manifest recorded in `apply-progress.md`); this document provides the bounded review decomposition so the deletion is reviewable as coherent batches, without a size exception.

## Review batches (review each batch as one ownership-coherent diff)

| Batch | Scope | Files | Lines | Pre-condition evidence |
| --- | --- | ---: | ---: | --- |
| D1 | `extensions/github-authentication/` (entire provider extension) | 49 | −6,673 | A4 leaves: discovery/registration disconnected, absence tests green (`accountFreeApi` GREEN flip) |
| D2 | `extensions/microsoft-authentication/` (entire provider extension) | 43 | −4,797 | A4 leaves: same evidence |
| D3 | `extensions/github/` (entire GitHub integration extension) | 44 | −3,978 | A8 leaves: menu/proposal/build references disconnected, plain-remote dispatch test green |
| D4 | account-policy-gate files (`accountPolicyGate.contribution.ts`, `accountPolicyGateContribution.ts`, `accountPolicyGateContribution.test.ts`) | 3 | −826 | A3 leaves: policy gate unregistered; account-only policy removed, enterprise policy preserved |
| D5 | tooling/config reference cleanup in the same commit (integration runners, skill doc, eslint allowlists, `.vscode-test.js`, launch config) | ~all non-deletion files | small | U01.A4/A8.002 leaf (138 lines incl. its regression tests: git/git-base runners + Git launch target preserved) |

## Review guidance

- Each batch is a whole-ownership deletion whose inbound references were removed and absence-tested in earlier reviewed leaves; the per-file manifest lives in `removal-inventory.md`.
- The 400-line/leaf ceiling applies to authored edits (apply leaves: A4/A8.001–.002 etc., each 120–400 lines incl. tests). Mechanical `git rm` of fully-disconnected trees is recorded here as reviewed-by-batch, per the parent deletion protocol; no `size:exception` is claimed for authored work.
- Post-deletion parent evidence (2026-10-05): `npm run compile-client` PASS · `npm run gulp compile-extensions` PASS · `./scripts/test-integration.sh --suite 'git,git-base'` exit 0.

## Pending U03 physical-deletion batches (parent-owned; no files unlinked here)

These are candidate physical-removal batches only; parent revalidates each inbound-use edge and performs every `git rm`. Retained generic server/Ports/SSH/Agent Host behavior is not included in these candidates.

| Batch | Scope | Files | Tracked lines | Preconditions / review notes |
| --- | --- | ---: | ---: | --- |
| D6 | `src/vs/platform/remoteTunnel/` and `src/vs/workbench/contrib/remoteTunnel/` | 15 | −3,218 | U03.b.001–b.005 disconnect shared-process, Sessions and Chat account-tunnel registrations. Current source scan found no direct imports of these owner roots outside them; the API `extHostTunnelService` / `mainThreadTunnelService` hits are generic tunnel/Ports paths and remain. Reconfirm entrypoints before deletion. |
| D7 | `extensions/tunnel-forwarding/` | 12 | −619 | Product/discovery scan found no active packaging reference beyond the Walker absence regression. Delete the account-authenticated bundled provider and its own manifest/lock only; root Dev Tunnels dependencies stay through U07. |
| D8 | `src/vs/workbench/contrib/chat/electron-browser/media/tunnelHost.css` | 1 | −74 | U03.b.004–b.005 left this stylesheet untouched; its RemoteTunnel view-item consumer is disconnected. Parent owns the unlink. |
| D9 | Disconnected CLI tunnel/service source candidates listed below | 14 | −3,580 | `commands.rs` omits `commands::tunnels`; `tunnels.rs` omits the Dev Tunnel, port-forwarder and WSL-detect modules; singleton CLI module registration is absent. Recheck each member before deletion. `commands/tunnels.rs` (594 lines) and `tunnels/dev_tunnels.rs` (1,358 lines) exceed the 400-line leaf budget and cannot be a single review leaf or receive a size exception. |

D9 exact candidates: `cli/src/commands/tunnels.rs`; `cli/src/tunnels/{dev_tunnels.rs,port_forwarder.rs,wsl_detect.rs,singleton_client.rs,singleton_server.rs,service.rs,service_linux.rs,service_macos.rs,service_windows.rs,nosleep.rs,nosleep_linux.rs,nosleep_macos.rs,nosleep_windows.rs}`. `cli/src/tunnels/local_forwarding.rs` and `cli/src/singleton.rs` are held for a parent generic-consumer decision: the former names local forwarding but depends on the Dev Tunnel `ActiveTunnel`, and the latter is shared singleton IPC. Keep `cli/src/tunnels/{agent_host.rs,agent_host_registry.rs,code_server.rs,control_server.rs,machine_status.rs,paths.rs,protocol.rs}` and generic command-shell/serve-web paths; `control_server.rs` retains `serve_stream` and Agent Host handoff, while `machine_status.rs` retains token-error reporting used by protected `cli/src/auth.rs`.

Do not delete the root `@microsoft/dev-tunnels-*` package/lock entries or Rust `tunnels` crate/lock entries in D6–D9. Their protected Agent Host/auth consumers are a U07 prerequisite, recorded in `removal-inventory.md`.

## U03 parent deletion execution — observed after D6–D9

This section supersedes the preceding **Pending U03 physical-deletion batches** section for the listed paths. The parent reports executing the removals; this executor only inspected the parent-owned index/worktree and did not unlink, stage, or commit files. Read-only `git diff --cached --summary` / `--numstat` confirms the following deletion set:

| Batch | Parent-executed scope | Staged tracked paths | Deleted text lines | Evidence note |
| --- | --- | ---: | ---: | --- |
| D6 | `src/vs/platform/remoteTunnel/` and `src/vs/workbench/contrib/remoteTunnel/` | 15 | 3,218 | All manifest paths show staged deletion. |
| D7 | `extensions/tunnel-forwarding/` | 12 | 619 + one binary | All tracked extension/source/manifest paths show staged deletion; the generated-output directory itself still exists, so physical emptiness is not claimed. |
| D8 | Chat `media/tunnelHost.css` | 1 | 74 | Parent-owned stylesheet deletion is staged. |
| D9 | Original CLI candidate list | 14 | 3,718 | The current staged diff reports `cli/src/commands/tunnels.rs` as 732 lines, not the prior 594-line manifest estimate; no reason for this 138-line delta is inferred. |
| D9 parent-approved additions | Previously held `cli/src/tunnels/local_forwarding.rs` and `cli/src/singleton.rs` | 2 | 549 | Parent reports the generic-consumer review and approval; both paths now show staged deletion. |
| **Observed total** | **D6–D9 plus the two approved CLI additions** | **44** | **8,178 + one binary** | **43 text paths and one binary icon; tracked paths are absent from the current index.** |

The original D9 manifest's 14-file/3,580-line count is superseded by the observed current staged diff (14 files/3,718 lines); adding the two parent-approved holdouts yields 16 CLI files/4,267 lines. The 400-line review ceiling still requires the oversized CLI removals to be reviewed as bounded batches; this aggregate deletion record is not a size exception or a claim that one authored leaf contains the whole deletion. Root Dev Tunnels package/lock entries, the Rust `tunnels` crate, and protected Agent Host/auth paths remain U07 prerequisites. No deletion commit hash is claimed here.

## U05 candidate manifests — parent-owned physical deletion only

These are read-only candidate counts from the current tracked worktree (`git ls-files` plus `wc -l`); line totals are source inventory, not authored diff statistics, and must be revalidated against each parent deletion checkout. No path was unlinked, staged, or committed by this apply executor. Split every large tree into owner/member/test leaves under the 400-line review ceiling; this aggregate inventory does not authorize one bulk deletion or a size exception.

### C4 — Chat and dedicated feature trees

| Candidate batch | Exact tracked scope | Files | Current lines | Preconditions and protected edges |
| --- | --- | ---: | ---: | --- |
| U05-C4-A | `src/vs/workbench/contrib/chat/browser/**` | 794 | 273,403 | Split by owner subtree, then file/test; first remove remaining external imports and default Chat service constructors. |
| U05-C4-B | `src/vs/workbench/contrib/chat/common/**` | 157 | 53,773 | Dependent on browser/test owners; don't retain Chat-shaped common replacement types. |
| U05-C4-C | `src/vs/workbench/contrib/chat/test/{browser,common,electron-browser}/**` | 440 | 220,121 | Parent deletes only after implementation imports are gone; shared test services remain until these consumers are removed. |
| U05-C4-D | `src/vs/workbench/contrib/chat/electron-browser/**` plus `chatCodeOrganization.md` | 22 | 4,502 | Verify no entrypoint/test imports remain. |
| U05-C4-E | `src/vs/workbench/services/chat/**` | 2 | 1,704 | Delete with Chat implementation/services; confirm no non-Chat service contract consumers. |
| U05-C4-F | `src/vs/workbench/contrib/inlineChat/**` | 24 | 6,452 | Dedicated feature tree, not the retained generic Interactive Window. |
| U05-C4-G | `src/vs/workbench/contrib/agentsVoice/**` | 37 | 15,835 | Dedicated voice implementation; leave independent speech-provider/editor dictation behavior intact. |
| U05-C4-H | `src/vs/workbench/contrib/welcomeAgentSessions/**` | 4 | 1,774 | Agent Sessions welcome implementation only; preserve generic onboarding/startup settings and local user data. |
| U05-C4-I | `src/vs/workbench/contrib/terminalContrib/chat/**` and `chatAgentTools/**` | 124 | 40,076 | Generic terminal contributions/exports are now disconnected. Keep `terminal/browser/agentHostTerminalService.ts`, the `ITerminalChatService` U07 prerequisite, PTY ownership, and ordinary terminal features. |
| U05-C4-J | Testing Chat tool: `src/vs/workbench/contrib/testing/common/testingChatAgentTool.ts` and `test/common/testingChatAgentTool.test.ts` | 2 | 1,294 | Registration is removed; retain the generic testing contribution and `testService` behavior. |
| U05-C4-K | Terminal Chat-only owners: `src/vs/workbench/contrib/terminal/browser/terminalTabsChatEntry.ts`, `terminal/terminalContribChatExports.ts`, `terminal/browser/chatTerminalCommandMirror.ts`, and `terminal/test/browser/{chatTerminalCommandMirror.test.ts,chatTerminalMirrorTestUtils.ts}` | 5 | 2,308 | View/tool/command paths are disconnected; retain generic terminal tabs, decoration actions, and U07 terminal-host service. |
| U05-C4-L | Chat component fixtures: `src/vs/workbench/test/browser/componentFixtures/chat/**` and `componentFixtures/editor/inlineChatZoneWidget.fixture.ts` | 34 | 10,840 | Remove only after Chat tests are gone; `componentFixtures/sessions/**` is a separate C5 manifest (21 files / 8,416 lines). |

**Deferred C4 shared-fixture edge:** `workbench/test/common/workbenchTestServices.ts` (906 lines) exports `TestChatEntitlementService`; `workbench/test/browser/workbenchTestServices.ts` (2,173 lines) imports it, stubs `IChatEntitlementService`/`IChatWidgetService`, and defines `TestChatWidgetService`. Chat tests still import/use these. Per parent approval, leave those shared Chat defaults intact until C4 deletes their Chat test consumers; then remove only Chat-owned test-service members/imports, never either generic workbench-test-services file wholesale. Recheck `src/vs/workbench/test/browser/componentFixtures/sessions/**` only in C5. `searchChatContext.ts` is not a C4 candidate while Sessions still consumes it; parent owns its later C5 edge review.

**C4 retained-fixture decoupling (U05.c.031, executor-completed):** three retained fixtures that read Chat-tree paths were decoupled so the parent C4 deletion cannot break them:

- `src/vs/workbench/test/browser/productDebloatChatIntegrations.test.ts` checks the four redirected Chat terminal consumers only while those files exist (`existsSync` guard); the generic terminal-exporter assertions remain unconditional.
- `src/vs/workbench/services/userDataProfile/test/browser/userDataProfileSyncBoundary.test.ts` no longer lists `workbench/contrib/chat/browser/promptSyntax/newPromptFileActions.ts` in its Sync sentinel list.
- `src/vs/workbench/services/extensionManagement/test/common/ignoredExtensionsManagementService.test.ts` no longer scans `chatSetupController.ts` for `isMachineScoped`. The two `extensions/copilot/**` entries remain and need the same review when U09 deletes their paths.

**Additional C4 test tail:** `src/vs/workbench/test/browser/aiCustomizationManagementSectionRegistry.test.ts` (44 lines) imports the Chat-owned `aiCustomizationManagementSectionRegistry`/`AICustomizationManagementSection`; it belongs with the Chat test batch even though it lives under `workbench/test/`. `componentFixtures/agentsVoice/voiceModeOnboarding.fixture.ts` and both `componentFixtures/editor/inlineChat*.fixture.ts` are part of U05-C4-F/G/I scopes (fixtures are discovered by the component-fixture runner, not a static registry).

**C4 ordering constraint (account-policy tail):** `src/vs/workbench/services/policies/test/browser/accountPolicyService.test.ts` imports Chat session-type helpers from `contrib/chat/common/{constants,chatSessionsService,chatSessionTypePreference}.ts`, while its owning `AccountPolicyService` is still registered in `workbench/browser/web.main.ts` and `workbench/electron-browser/desktop.main.ts`. The parent must remove or decouple that A2/A3-owned file before deleting the Chat tree; do not delete Chat first and leave the retained account-policy test importing absent modules.

### C2 — API/RPC/protocol deletion candidates and mixed-owner files

| Candidate batch | Exact scope | Files | Current lines | Review boundary |
| --- | --- | ---: | ---: | --- |
| U05-C2-A | `src/vs/workbench/api/browser/mainThreadChat*.ts`, `mainThreadLanguageModels.ts`, `mainThreadLanguageModelTools.ts`, `mainThreadAgentEditorComments.ts` | 12 | 3,170 | Actor registrations and customer imports are disconnected; `mainThreadAgentEditorComments.ts` and `mainThreadChatQuota.ts` are 6-line parent-owned physical-deletion stubs; delete feature owners after remaining protocol/test imports are removed. |
| U05-C2-B | `src/vs/workbench/api/common/extHostChat*.ts`, `extHostLanguageModels.ts`, `extHostLanguageModelTools.ts`, `extHostAgentEditorComments.ts` | 11 | 5,097 | Node/worker general activation stays; `extHostAgentEditorComments.ts` and `extHostChatQuota.ts` are 6-line parent-owned physical-deletion stubs; no Chat service/API compatibility framework survives. |
| U05-C2-C | Chat/LM API tests (`api/test/**/*Chat*.test.ts`, `api/test/browser/mainThreadLanguageModels.test.ts`) | 5 | 1,982 | Remove only feature-specific tests after `accountFreeApi.test` and ordinary API activation coverage stay green. |
| U05-C2-D | Mixed `src/vs/workbench/api/common/extHost.protocol.ts` and `extHostTypeConverters.ts` | 2 | 8,489 | **Not whole-file deletion candidates.** Disconnected `AgentEditorComments` and ChatQuota DTO/shape/context pairs are removed; remove other Chat/LM DTOs, proxy identifiers and converter members only after reverse-import scan; preserve all generic extension-host channels/converters and ordinary tests. |

### A2 — authentication and OAuth tails (gated on C1/C2/C3 consumers)

| Candidate batch | Exact scope | Files | Current lines | Review boundary |
| --- | --- | ---: | ---: | --- |
| U05-A2-A | `src/vs/workbench/contrib/authentication/**`; `services/authentication/**`; `api/browser/mainThreadAuthentication.ts`; `api/common/extHostAuthentication.ts`; `api/node/extHostAuthentication.ts`; `api/common/extHostXaaAuthProvider.ts` | 29 | 10,568 | Keep the tiny inert A1 public facade; remove implementation/RPC only after Chat/language-model and ordinary auth consumers are disconnected. |
| U05-A2-B | API auth registrations `api/node/extHost.node.services.ts` and `api/worker/extHost.worker.services.ts`; browser auth tests `api/test/browser/*Authentication*` | 6 | 1,232 | Replace service construction tests with inert facade / no-callback assertions; no token-store, provider, UI or network behavior. |
| U05-A2-C | Approved MCP auth/OAuth members in `mcpCommands.ts`, `mcpServerActions.ts`, `mcpLanguageFeatures.ts`, `mcp.contribution.ts`, and `mcpConfiguration.ts` plus approved tests | 7 | 5,064 | These are mixed-purpose files, not deletion targets. Strip account/OAuth enrollment and secret lenses only; preserve independently used MCP configuration, ordinary server execution and non-account behavior. |

C2/A2 counts are inventory snapshots only. The `AgentEditorComments`, ChatQuota, ChatStatus, ChatOutputRenderer, ChatCodeMapper and ChatContext RPC shape/context pairs have been disconnected (U05.c.028–c.035); their twelve bridge files are 6-line `export {}` placeholders and their DTOs, shapes, proxy IDs and disconnected-set entries are physically removed from the mixed `extHost.protocol.ts`/`extHost.api.impl.ts` owners. Two in-scope new files from this stage remain **untracked** (`src/vs/workbench/api/common/extHostLanguageModelAccessInformation.ts` — the retained inert language-model access facade imported by `accountFreeApi.test.ts`, and `src/vs/workbench/test/browser/productDebloatChatIntegrations.test.ts`); they are outside `git rm` reach until the parent stages them with its commit. Remaining real bridge sources with disconnected registrations: browser `mainThreadChatAgents2.ts`, `mainThreadChatDebug.ts`, `mainThreadChatInputNotification.ts`, `mainThreadChatSessions.ts`, `mainThreadLanguageModels.ts`, `mainThreadLanguageModelTools.ts`; common `extHostChatAgents2.ts`, `extHostChatDebug.ts`, `extHostChatInputNotification.ts`, `extHostChatSessions.ts`, `extHostLanguageModelAccessInformation.ts`, `extHostLanguageModels.ts`, `extHostLanguageModelTools.ts`. Several of those pairs have live API tests, so they must retire bridge-and-test together in a measured leaf; `extHostLanguageModelAccessInformation.ts` is still imported by `accountFreeApi.test.ts`. The API workspace integration test remains parent-owned. Authentication/MCP tail edits remain ordered after C1/C2/C3 consumer disconnection; no A2 source deletion or broad secret cleanup is implied.
