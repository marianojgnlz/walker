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

**Deferred C4 shared-fixture edge (SUPERSEDED by U05.c.039 below):** `workbench/test/common/workbenchTestServices.ts` (906 lines) exports `TestChatEntitlementService`; `workbench/test/browser/workbenchTestServices.ts` (2,173 lines) imports it, stubs `IChatEntitlementService`/`IChatWidgetService`, and defines `TestChatWidgetService`. Chat tests still import/use these. Per parent approval, leave those shared Chat defaults intact until C4 deletes their Chat test consumers; then remove only Chat-owned test-service members/imports, never either generic workbench-test-services file wholesale. Recheck `src/vs/workbench/test/browser/componentFixtures/sessions/**` only in C5. `searchChatContext.ts` is not a C4 candidate while Sessions still consumes it; parent owns its later C5 edge review.

**C4 retained-fixture decoupling (U05.c.031, executor-completed):** three retained fixtures that read Chat-tree paths were decoupled so the parent C4 deletion cannot break them:

- `src/vs/workbench/test/browser/productDebloatChatIntegrations.test.ts` checks the four redirected Chat terminal consumers only while those files exist (`existsSync` guard); the generic terminal-exporter assertions remain unconditional.
- `src/vs/workbench/services/userDataProfile/test/browser/userDataProfileSyncBoundary.test.ts` no longer lists `workbench/contrib/chat/browser/promptSyntax/newPromptFileActions.ts` in its Sync sentinel list.
- `src/vs/workbench/services/extensionManagement/test/common/ignoredExtensionsManagementService.test.ts` no longer scans `chatSetupController.ts` for `isMachineScoped`. The two `extensions/copilot/**` entries remain and need the same review when U09 deletes their paths.

**C4 shared-fixture extraction (U05.c.039, executor-completed except one shim):** the Chat test services now live in `contrib/chat/test/common/chatTestServices.ts` with a Chat-owned `chatWorkbenchTestServices.ts` factory wrapper (62 Chat test files repointed); `workbench/test/browser/workbenchTestServices.ts` has **zero** Chat references, and `workbench/test/common/workbenchTestServices.ts` retains exactly one re-export line (`TestChatEntitlementService`) for the single ungranted sessions consumer `src/vs/sessions/contrib/chat/test/browser/sessionArchiveNudge.test.ts` (one import line; the sessions `TestChatWidgetService` files define local classes). Removing that last shim before C4 deletion needs that one path approved.

> Update (U05.c.040): the approved import repoint was executed and the shim removed — both shared test factories are now Chat-free with zero exceptions.

### C4 pre-deletion readiness scan (U05.c.041–c.043)

Retained-file imports of `contrib/chat/**` or `services/chat/**` after the C1–C3/C2 work and the five pair retirements (excluding the dedicated deletion trees, U06 sessions and U07 agentHost):

| Retained edge | Status |
| --- | --- |
| `api/browser/mainThreadEditorTabs.ts` — `ChatEditorInput` import + `TabInputKind.ChatEditorInput` branch | **Cleared in U05.c.043** |
| `api/common/extHostApiCommands.ts:25-26` — `PromptsType`, `IExtensionPromptFileResult` (prompt-syntax API commands) | Remaining (C2/C3 tail) |
| `contrib/editTelemetry/browser/editTelemetryContribution.ts:18` — `IChatEntitlementService` sentiment gating of edit telemetry | Remaining (C3 tail; telemetry itself is T3-owned) |
| `api/common/extHostTypes.ts:33` — `HookTypeValue` public chat-hook types | Remaining (C2 type tail) |
| `api/common/extHost.protocol.ts:58-60` — surviving Chat DTO members (`IChatProgressHistoryResponseContent`, `IChatExternalEditsDto`/`IChatMultiDiffData*`/`IChatNotebookEdit`/`IChatProgress`/`IChatTaskDto`, `IChatRequestVariableValue`) used by still-declared protocol members | Remaining (C2 protocol tail) |

Conclusion: the dedicated-tree manifests, shared-fixture extraction and account-policy ordering constraint are complete, but **C4 Chat-tree deletion is not yet executable** until the four remaining retained edges above are disconnected and the queued A2 tails land.

**Additional C4 test tail:** `src/vs/workbench/test/browser/aiCustomizationManagementSectionRegistry.test.ts` (44 lines) imports the Chat-owned `aiCustomizationManagementSectionRegistry`/`AICustomizationManagementSection`; it belongs with the Chat test batch even though it lives under `workbench/test/`. `componentFixtures/agentsVoice/voiceModeOnboarding.fixture.ts` and both `componentFixtures/editor/inlineChat*.fixture.ts` are part of U05-C4-F/G/I scopes (fixtures are discovered by the component-fixture runner, not a static registry).

**C4 ordering constraint (account-policy tail) — RESOLVED at test level (U05.c.037):** `accountPolicyService.test.ts` no longer imports any Chat module; the managed-sandbox case and its Chat helpers were removed, and the suite is green (34/34). The remaining A2-owned `AccountPolicyService`/registration removal is not a C4 blocker because the service itself has no Chat imports. Related fix: `workbench/services/accounts/browser/defaultAccount.ts` now falls back to an inert `NO_DEFAULT_CHAT_AGENT_CONFIG` when the removed product field is absent, which also restored `defaultAccount.test.ts` (51/51) and `multiplexPolicyService.test.ts` (11/11).

### U05 C2 coupled-pair retirement batches (approved dispositions; executor-executed)

The five remaining C2 pairs were retired together (their bridge modules import each other, so no pair compiles alone), then the now-dead protocol Chat DTOs were swept to a fixpoint. Each pair below is a D-style mechanical review batch under the accepted c.035 disposition; totals are measured `git diff --stat` deletions for the retirement pass (protocol + api.impl edits shared across the five).

| Batch | Scope | Files | Measured deletion lines | Evidence |
| --- | --- | ---: | ---: | --- |
| C2-D1 | LanguageModelTools pair (`mainThreadLanguageModelTools.ts`, `extHostLanguageModelTools.ts`, `IToolDataDto`/`IToolDefinitionDto`/`ILanguageModelChatSelectorDto`, 2 proxies, set entry) | 2 bridges + protocol | ~610 | compile 0 errors, `accountFreeApi` 10/10 |
| C2-D2 | ChatDebug pair (`mainThreadChatDebug.ts`, `extHostChatDebug.ts`, debug DTO family ~150 lines, 2 shapes, 2 proxies, set entry) | 2 bridges + protocol | ~860 | same |
| C2-D3 | LanguageModels pair (`mainThreadLanguageModels.ts`, `extHostLanguageModels.ts`, `mainThreadLanguageModels.test.ts`, LM shapes, 2 proxies, set entry) | 2 bridges + 1 test + protocol | ~1,480 | same |
| C2-D4 | ChatAgents2 pair (`mainThreadChatAgents2.ts`, `extHostChatAgents2.ts`, both 2 dedicated tests, agent/customization DTO family, `IChatAgentProgressShape`, 2 proxies, set entry) | 2 bridges + 2 tests + protocol | ~3,050 | same |
| C2-D5 | ChatSessions pair (`mainThreadChatSessions.ts`, `extHostChatSessions.ts`, `mainThreadChatSessions.test.ts`, session DTO family, 2 shapes, 2 proxies, set entry) | 2 bridges + 1 test + protocol | ~3,860 | same |
| — | Shared protocol dead-DTO sweep after the five retirements (34 Chat/mapped-edits DTOs removed to fixpoint + unused imports) | 1 protocol file | ~640 | compile 0 errors after two import-prune rounds |

Measured pass total: **14 tracked files, 9,095 deletion lines / 14 addition lines** for the five pairs plus the shared protocol sweep. The earlier per-pair split-analysis estimates (645–3,730) excluded the shared DTO tail, so D3–D5 measure above their estimates; recorded here rather than hidden. All ten bridge files and four dedicated test files are 6-line `export {}` placeholders for parent physical deletion. Protected edges unchanged: `accountFreeApi.test` green, ordinary RPC channels and generic converters untouched, A1 facades inert.

| Batch | Scope | Files | Measured deletion lines | Evidence |
| --- | --- | ---: | ---: | --- |
| C2-D6 | `extHostTypeConverters.ts` Chat/LM converter tail: 46 interconnected declarations (ChatFollowup, LanguageModelChatMessage{,Role,2}, the full ChatResponse* part family incl. `ChatResponsePart` dispatch, ChatToolInvocationPart, ChatTask{,Result}, ChatAgentRequest/Location/Result/CompletionItem/UserActionEvent, ChatPromptReference, ChatLanguageModelToolReference, ChatRequestModeInstructions, ChatSessionCustomizationType/Item, ChatRequestHooksConverter/ChatHookCommand, LanguageModelToolSource/Result) + import prune + unused local declarations | 1 converter file + 2 converter tests | 1,989 | compile 0 errors; `extHostTypeConverter.test` 7/7, `extHostTypeConverters.test` (common) 14/14, `accountFreeApi` 10/10 |

The converter tail was only removable as one interconnected unit: `ChatResponsePart.from/to` dispatched across every part converter, and the two converter tests were the last named-import consumers. A first symbol-level import prune corrupted the file and was discarded — the file was restored from HEAD and redone with brace-aware whole-declaration removal plus analysis-driven import pruning (verified by `import {  }`/anonymous-declaration greps before compiling).

### Dedicated-tree per-directory batches (U05.c.038, parent-owned execution)

Measured tracked inventory from the current worktree; these refine U05-C4-F through U05-C4-I. Each row is a reviewable directory batch; files above 400 lines are listed individually because they exceed a single review leaf alone. Parent owns every unlink and revalidates inbound use before each batch.

**inlineChat — 24 files, 6,452 lines**

| Batch | Files | Lines |
| --- | ---: | ---: |
| `browser/` | 14 | 4,061 |
| `browser/media/` (2 CSS) | 2 | 470 |
| `common/` | 1 | 121 |
| `test/browser/` | 7 | 1,800 |
| Oversized files | `browser/inlineChatController.ts` 961; `browser/inlineChatWidget.ts` 519; `browser/inlineChatZoneWidget.ts` 499; `browser/inlineChatActions.ts` 470; `test/browser/inlineChatEditReviewSession.test.ts` 454; `browser/inlineChatSessionServiceImpl.ts` 407 | |

**agentsVoice — 37 files, ~7,566 text lines + 12 binary MP3 resources**

| Batch | Files | Lines |
| --- | ---: | ---: |
| `browser/` | 6 | 3,950 |
| `browser/components/` | 9 | 1,344 |
| `browser/transcriptsView/` | 4 | 984 |
| `browser/media/` | 13 | 1 CSS (252) + 12 binary MP3 |
| `common/` | 3 | 515 |
| `electron-browser/` | 1 | 23 |
| `test/browser/` | 1 | 498 |
| Oversized files | `browser/voiceModeOnboarding.ts` 1,244; `browser/agentsVoiceWidget.ts` 1,193; `browser/agentsVoice.contribution.ts` 787; `test/browser/voiceModeOnboarding.test.ts` 498 | |

**welcomeAgentSessions — 4 files, 1,774 lines**

| Batch | Files | Lines |
| --- | ---: | ---: |
| `browser/` | 3 | 1,210 |
| `browser/media/` (1 CSS) | 1 | 564 |
| Oversized files | `browser/agentSessionsWelcome.ts` 935; `browser/media/agentSessionsWelcome.css` 564 | |

**terminalContrib/chat — 14 files, 2,953 lines**

| Batch | Files | Lines |
| --- | ---: | ---: |
| `browser/` | 10 | 2,328 |
| `browser/media/` (1 CSS) | 1 | 78 |
| `test/browser/` | 3 | 547 |
| Oversized files | `browser/terminalChatWidget.ts` 670; `browser/terminalChatActions.ts` 592; `browser/terminalChatService.ts` 489 | |

**terminalContrib/chatAgentTools — 110 files, 37,121 lines**

| Batch | Files | Lines |
| --- | ---: | ---: |
| `browser/` (top level) | 10 | 2,692 |
| `browser/commandParsers/` | 1 | 31 |
| `browser/executeStrategy/` | 5 | 1,394 |
| `browser/tools/` (top level) | 15 | 6,274 |
| `browser/tools/commandLineAnalyzer/` | 4 | 658 |
| `browser/tools/commandLineAnalyzer/autoApprove/` | 2 | 630 |
| `browser/tools/commandLinePresenter/` | 5 | 290 |
| `browser/tools/commandLineRewriter/` | 6 | 419 |
| `browser/tools/consoleCompactor/` | 1 | 5,764 |
| `browser/tools/monitoring/` | 3 | 879 |
| `browser/tools/task/` | 5 | 715 |
| `common/` | 5 | 1,337 |
| `test/browser/` | 26 | 9,609 |
| `test/browser/__snapshots__/` | 12 | 505 |
| `test/common/` | 2 | 203 |
| `test/electron-browser/` | 6 | 4,928 |
| `test/electron-browser/commandLineAnalyzer/` | 2 | 793 |
| Oversized files | `browser/tools/consoleCompactor/consoleCompactor.ts` 5,764; `test/electron-browser/runInTerminalTool.test.ts` 3,669; `browser/tools/runInTerminalTool.ts` 3,617; `test/browser/terminalSandboxService.test.ts` 1,631; `test/browser/commandLineAutoApprover.test.ts` 1,527; `test/browser/outputMonitor.test.ts` 953; `common/terminalChatAgentToolsConfiguration.ts` 828; `browser/tools/monitoring/outputMonitor.ts` 821; `browser/tools/terminalOutputCompressor.ts` 671; `test/browser/runInTerminalHelpers.test.ts` 670; `browser/runInTerminalToolTelemetry.ts` 642; `test/browser/agentHostSandboxForwarder.test.ts` 632; `test/electron-browser/commandLineAnalyzer/commandLineFileWriteAnalyzer.test.ts` 591; `test/browser/strategyHelpers.test.ts` 564; `test/browser/sendToTerminalTool.test.ts` 557; `test/electron-browser/treeSitterCommandParser.test.ts` 538; `browser/tools/sendToTerminalTool.ts` 433; `common/terminalSandboxService.ts` 421 | |

Protected edges for every batch: `terminal/browser/agentHostTerminalService.ts` and the `ITerminalChatService` U07 prerequisite stay; generic terminal contributions/exports, PTY ownership and the retained `terminalContrib/inlineHint`, `voice`, `accessibility` trees are not in these batches. `test/browser/__snapshots__/*.snap` are generated companion files of their owning tests and go with the same batch.

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

C2/A2 counts are inventory snapshots only. The `AgentEditorComments`, ChatQuota, ChatStatus, ChatOutputRenderer, ChatCodeMapper, ChatContext and ChatInputNotification RPC shape/context pairs have been disconnected (U05.c.028–c.036); their bridge files (and the dedicated ChatInputNotification test) are 6-line `export {}` placeholders and their DTOs, shapes, proxy IDs and disconnected-set entries are physically removed from the mixed `extHost.protocol.ts`/`extHost.api.impl.ts` owners. The five remaining pairs — `LanguageModels`, `ChatAgents2`, `ChatSessions`, `ChatDebug`, `LanguageModelTools` — are bidirectionally shape-coupled and paused with measured split analyses in `apply-progress.md` (U05.c.036 continuation) pending a parent disposition; nothing was edited for them. Two in-scope new files from this stage remain **untracked** (`src/vs/workbench/api/common/extHostLanguageModelAccessInformation.ts` — the retained inert language-model access facade imported by `accountFreeApi.test.ts`, and `src/vs/workbench/test/browser/productDebloatChatIntegrations.test.ts`); they are outside `git rm` reach until the parent stages them with its commit. `extHostLanguageModelAccessInformation.ts` is still imported by `accountFreeApi.test.ts`. The API workspace integration test remains parent-owned. Authentication/MCP tail edits remain ordered after C1/C2/C3 consumer disconnection; no A2 source deletion or broad secret cleanup is implied.
