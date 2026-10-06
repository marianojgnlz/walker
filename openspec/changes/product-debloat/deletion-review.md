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
| `api/common/extHostApiCommands.ts:25-26` — `PromptsType`, `IExtensionPromptFileResult` (prompt-syntax API commands) | **Cleared in U05.c.045** |
| `contrib/editTelemetry/browser/editTelemetryContribution.ts:18` — `IChatEntitlementService` sentiment gating of edit telemetry | **Cleared in U05.c.044** |
| `api/common/extHostTypes.ts:33` — `HookTypeValue` public chat-hook types | **Cleared in U05.c.045** (`hookType` widened to `string`) |
| `api/common/extHost.protocol.ts:58-60` — surviving Chat DTO members | **Cleared in U05.c.045** (14-declaration dead component removed; zero Chat imports remain) |

Conclusion: all retained Chat-tree import edges are now gone; no file outside `contrib/chat/`, the dedicated deletion trees, U06 sessions and U07 agentHost imports `contrib/chat/**` or `services/chat/**`. The only remaining pre-deletion items are the queued A2 auth/RPC/MCP tails (and their entrypoint registrations), after which the C4 physical-deletion manifest can be finalized.

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

**Notebook Chat dedicated files (C4, parent-owned):** `src/vs/workbench/contrib/notebook/browser/contrib/chat/notebookChatUtils.ts` (67), `browser/controller/chat/cellChatActions.ts` (270), `browser/controller/chat/notebook.chat.contribution.ts` (390), `browser/controller/chat/notebookChatContext.ts` (9), `browser/view/cellParts/chat/cellChatPart.ts` (38) — 5 files / 774 lines. The only inbound reference is from the Chat tree itself, so they are deletion-safe with the same batch order.

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

C2/A2 counts are inventory snapshots only. All seven Chat RPC shape/context pairs and the five formerly paused bridge pairs are retired (U05.c.028–c.042): their bridge files (and dedicated tests) are 6-line `export {}` placeholders and their DTOs, shapes, proxy IDs and disconnected-set entries are removed from the mixed `extHost.protocol.ts`/`extHost.api.impl.ts` owners. Two in-scope new files from that stage remain **untracked** (`src/vs/workbench/api/common/extHostLanguageModelAccessInformation.ts` — the retained inert language-model access facade imported by `accountFreeApi.test.ts`, and `src/vs/workbench/test/browser/productDebloatChatIntegrations.test.ts`); they are outside `git rm` reach until the parent stages them with its commit. The API workspace integration test remains parent-owned.

### A2-D1 — Auth RPC bridge coupled batch (executor-executed)

| Batch | Scope | Files | Measured deletion lines | Evidence |
| --- | --- | ---: | ---: | --- |
| A2-D1 | `api/browser/mainThreadAuthentication.ts` (755), `api/common/extHostAuthentication.ts` (1,063), `api/node/extHostAuthentication.ts` (339), `api/common/extHostXaaAuthProvider.ts` (402); their 5 dedicated tests (149+41+773+185+99); protocol `MainThreadAuthenticationShape`/`ExtHostAuthenticationShape`, the five auth option DTOs, `IXaaProviderDiscovery`, both proxies; and four registration sites (`extHost.api.impl.ts` import/const/context-set, `node/extHost.node.services.ts`, `worker/extHost.worker.services.ts`, `browser/extensionHost.contribution.ts`) | 15 | 3,944 | compile exit 0; `accountFreeApi` **10/10** with new auth-shape/class absence assertions; placeholder tests run clean |

Coupled-batch rationale: the pair is bidirectionally shape-coupled (each side proxies the other), the ext-host implementations were registered in both Node and worker service collections, and the A1 public facade is independent of both (`createAuthenticationApiFacade` continues to serve the account-free contract). All nine modules/tests are now 6-line placeholders with zero importers, ready for parent `git rm`.

### A2 remaining leaves (measured, not started)

- **A2-D2 — auth tree disconnection:** `contrib/authentication/**` + `services/authentication/**` (25 files) still have retained consumers: `workbench/workbench.common.main.ts` (registration), `code/browser/workbench/workbench.ts`, `workbench/browser/web.api.ts`, `contrib/extensions/browser/extensionsActions.ts`, `contrib/issue/browser/*` + `electron-browser/*` (4 files), `contrib/mcp/browser/{mcpCommands,mcpServerActions}.ts`, `api/browser/mainThreadMcp.ts` + its test, and `workbench/test/browser/parts/globalCompositeBar.test.ts` (sessions and dedicated-tree consumers die under U06/C4 separately).
- **A2-D3 — MCP account/OAuth constructors:** the approved `mcp/**` files plus the auth-dependent enrollment/secret lenses.
- **A2-D4 — final readiness + parent manifest:** re-run the retained-import scan, then publish the complete “Pending physical deletion (parent)” list (C4 trees + dedicated trees + Notebook Chat batch + zero-importer placeholders + A2 trees).

## Final "Pending physical deletion (parent)" manifest (A2-D4, 2026-10-06)

Consolidated readiness check: retained chat/auth importers are now zero outside the deletion trees (only the C4-dedicated notebook chat file and the deletion-safe boundary test text reads remain, both listed below). Parent owns every unlink/revalidation.

| Batch | Scope | Notes |
| --- | --- | --- |
| C4-A…L | `src/vs/workbench/contrib/chat/**`, `workbench/services/chat/**`, chat tests/styles/assets, component fixtures, `aiCustomizationManagementSectionRegistry.test.ts` | per the existing U05-C4 tables; source absence fixtures exist |
| C4 dedicated trees | `inlineChat/**`, `agentsVoice/**`, `welcomeAgentSessions/**`, `terminalContrib/{chat,chatAgentTools}/**` | per-directory batches recorded (U05.c.038) with >400-line files listed |
| Notebook Chat batch | `notebook/browser/{contrib/chat,controller/chat,view/cellParts/chat}` five files / 774 lines | added in U05.c.046 |
| Zero-importer placeholders | 6-line `export {}` bridge/test placeholders from c.028–c.036, c.041, c.042, A2-D1 (auth bridges/tests) | each has zero importers |
| A2 auth trees | `workbench/contrib/authentication/**`, `workbench/services/authentication/**` (25 files) | registrations removed in D2.006; no retained importers remain; **A2-D3 residual executed** (OAuth config surface removed end-to-end, U05.c.057) so this batch is deletion-ready |
| A2-D3 residual | MCP OAuth config surface — **COMPLETE** (U05.c.057): schema, enterprise setting/policy, lens/command, sanitizer, types and fixtures removed | done; see `compatibility.md` for the user-visible config change |
| U06/U07 | sessions/agentHost trees | separate stages |

JSON/JSONC config and type files (`src/vs/base/common/product.ts` defaultChatAgent type, proposal registry entries) are Phase-C1/U09-owned and remain listed in their own manifests.


## Combined deletion wave — U06/U07-prerequisite completion + U05 C4 tails (manifest refresh 2026-10-06)

Recorded by the executor after leaf (d) marker-service rewrite, leaf (e) app/sharedProcess/server disconnection and leaf (f) entrypoint-registration removal landed (compile 0 errors; focused suites green — evidence in `apply-progress.md`). Everything below is a **read-only measured candidate inventory for the parent's `git rm`**; no path here was unlinked, staged, or committed by this executor. Counts are tracked files and tracked text lines measured from the current worktree (`git ls-files` + `wc -l`); placeholders that already emptied a file are counted at their current 6-line size.

### Wave batches (per-directory, reviewable units)

| Batch | Exact tracked scope | Files | Lines | Binary | Pre-conditions / retained edges |
| --- | --- | ---: | ---: | ---: | --- |
| W1 | `src/vs/workbench/contrib/chat/**` | 1,415 | 551,371 | 103 | C1–C3 disconnections + seven RPC-pair retirements complete; per-directory split in the tables below. |
| W2 | `src/vs/workbench/services/chat/**` | 2 | 1,704 | 0 | zero importers outside the wave (verified scan). |
| W3 | `src/vs/workbench/contrib/inlineChat/**` | 24 | 6,452 | 0 | per-directory batches in U05.c.038. |
| W4 | `src/vs/workbench/contrib/agentsVoice/**` | 37 | 7,566 | 12 | 12 binary MP3 voice resources ride the same batch. |
| W5 | `src/vs/workbench/contrib/welcomeAgentSessions/**` | 4 | 1,774 | 0 | generic onboarding untouched. |
| W6 | `src/vs/workbench/contrib/terminalContrib/chat/**` | 14 | 2,953 | 0 | per-directory batches in U05.c.038. |
| W7 | `src/vs/workbench/contrib/terminalContrib/chatAgentTools/**` | 110 | 37,121 | 0 | per-directory batches in U05.c.038; generic terminal contributions untouched. |
| W8 | Notebook Chat batch: `notebook/browser/contrib/chat/**`, `notebook/browser/controller/chat/**`, `notebook/browser/view/cellParts/chat/**` | 5 | 774 | 0 | only inbound reference is the Chat tree itself. |
| W9 | `src/vs/workbench/contrib/authentication/**` | 8 | 183 | 0 | A2-D2.006 removed the registration; remaining importers are sessions-only. |
| W10 | `src/vs/workbench/services/authentication/**` | 17 | 7,813 | 0 | same as W9; A1 inert public facade stays (it lives in `api/common/extHostAuthentication…` surface, not here). |
| W11 | `src/vs/sessions/**` | 942 | 319,537 | 0 | leaf (f) removed the common/web/desktop registrations; build/entrypoint + window-type residue listed under "C5 residue" below. |
| W12 | `src/vs/platform/agentHost/**` | 2,344 | 521,031 | 0 | leaf (e) removed server/shared-process starters/channels; `platform/agentPlugins` returns as W20 (normalizer extraction complete 2026-10-06). |
| W13 | `src/vs/workbench/services/agentHost/**` | 15 | 4,030 | 0 | leaf (f) removed all three desktop + two web registrations; zero importers outside the wave (verified). |
| W14 | Agent-host terminal trio + command source: `terminal/browser/{agentHostOutputChannel,agentHostPty,agentHostTerminalService}.ts` (52/598/489) and `terminal/browser/ahpTerminalCommandSource.ts` (259); tests `terminal/test/browser/{agentHostPty,agentHostTerminalService}.test.ts` (992/266) | 6 | 2,656 | 0 | supersedes the earlier U05-C4-I hold; the six sessions importers are inside W11 (`remoteAgentHostTerminal.contribution`, `remoteAgentHost.contribution`, `agentHostSessionTaskRunner`(+test), `sessionsTerminalContribution`(+test)). |
| W15 | MCP agent-host UI strip: `mcp/browser/mcpToolCallUI.ts` (446) + `mcp/test/browser/mcpToolCallUI.test.ts` (107) + `mcp/common/mcpEditorAffordanceState.ts` (46) + `mcp/test/common/mcpEditorAffordanceState.test.ts` (75) | 4 | 674 | 0 | `IMcpToolCallUIData` agentHost variant + the deletion-bound `chatMcpAppModel`/`stateToProgressAdapter`/`chatService` producers go in the same pass (they live in W1). |
| W16 | Server agent-host channel/manager + tests: `server/node/agentHostChannel.ts` (412), `server/node/serverAgentHostManager.ts` (274), `server/test/node/agentHostChannel.test.ts` (261), `server/test/node/serverAgentHostManager.test.ts` (457) | 4 | 1,404 | 0 | leaf (e) removed construction/registration; both modules and suites are green today (9/9 and 20/20) and become zero-importer with this wave. |
| W17 | editTelemetry marker placeholders: `contrib/editTelemetry/browser/telemetry/agentHostEditMarkerService.ts` + `test/browser/agentHostEditMarkerService.test.ts` | 2 | 12 | 0 | leaf (d) emptied both (778 + 788 original lines removed); subset of W18. |
| W18 | Zero-importer API/auth/bridge placeholders: the 40 tracked 6-line `export {}` files listed below | 40 | 240 | 0 | each has zero importers. |
| W19 | Workbench test fixtures bound to the wave: `workbench/test/browser/componentFixtures/chat/**` (33/10,346), `componentFixtures/sessions/**` (21/8,416), `componentFixtures/agentsVoice/**` (1/63), `componentFixtures/editor/inlineChatZoneWidget.fixture.ts` (1/494), `workbench/test/browser/aiCustomizationManagementSectionRegistry.test.ts` (1/44) | 57 | 19,363 | 0 | `componentFixtures/fixtureUtils.ts` is **retained** (leaf a2 removed its nine deletion-bound imports). |
| W20 | `src/vs/platform/agentPlugins/**` — `common/agentPluginParser.ts`, `common/pluginParsers.ts`, `test/common/pluginParsers.test.ts` | 3 | 2,194 | 0 | Pre-wave extraction executed 2026-10-06: retained `.mcp.json` chain repointed to `platform/mcp/common/mcpServerConfigurationNormalizer.ts` with a 14-case parity suite (11 moved + 3 new; runner 15 passing incl. harness clean-state). `pluginParsers.ts` keeps only a value re-export for its deletion-bound importers (W12 agentHost, W1 chat, W19 fixture); delete W20 atomically with or after W12+W1. |
| W21 | MCP plugin-discovery pair: `workbench/contrib/mcp/common/discovery/pluginMcpDiscovery.ts` + `test/common/pluginMcpDiscovery.test.ts` | 2 | 198 | 0 | imports `contrib/chat/**` (`agentPluginService`, `enablement`); registration `mcp.contribution.ts:67`. Must be deleted with or before W1 (chat) — its chat imports break the retained MCP tree otherwise. |
| W22 | Agents Window build/dependency tail: `build/next/{devTunnelsWeb.ts,devTunnelsWebEntry.js,test/devTunnelsWeb.test.ts,devTunnelsShims/**}` + `resources/win32/sessions.ico` | 7 + 1 binary | 295 | 1 | `build/next/index.ts` call/import removed by the 2026-10-06 pre-wave C5 leaf; today only its own build test imports the helper, and its bundle output path lives inside the sessions tree. Delete after W11. |

Wave total after W20–W22: **5,060 tracked files / 1,489,333 text lines + 116 binary files.** (Sum of W1–W22; W17 is the same two files as the editTelemetry entry of W18 and is not double-counted. All placeholders are counted at their current 6-line size; W20 lines are measured after the 2026-10-06 extraction.)

### Per-directory detail — W1 chat tree

| Sub-batch | Files | Lines |
| --- | ---: | ---: |
| `browser/` | 794 | 272,859 (103 binary) |
| `test/` | 442 | 220,237 |
| `common/` | 157 | 53,773 |
| `electron-browser/` + `chatCodeOrganization.md` | 22 | 4,502 |

`browser/` deep split (top directories): `widget/` 339/85,097 · `agentSessions/` 100/40,977 · `aiCustomization/` 39/27,444 · `chatDebug/` 29/15,876 · `actions/` 38/14,604 · `chatEditing/` 33/12,975 · `voiceClient/` 14/11,691 · remaining browser files (dialog/controller/history/tools/etc.) carry the rest.

### Per-directory detail — W11 sessions tree

| Sub-batch | Files | Lines |
| --- | ---: | ---: |
| `contrib/providers/` | 160 | 75,963 |
| `contrib/chat/` | 151 | 50,826 |
| `contrib/sessions/` | 68 | 37,875 |
| `services/sessions/` | 36 | 19,698 |
| `browser/parts/` | 80 | 19,507 |
| `contrib/automations/` | 27 | 14,361 |
| `contrib/changes/` | 48 | 14,352 |
| `contrib/agentFeedback/` | 41 | 11,928 |
| `contrib/layout/` | 20 | 10,166 |
| `test/browser/` | 28 | 9,590 |
| `contrib/github/` | 44 | 9,323 |
| `browser/workbench.ts` + remaining `browser/` | 37 | 7,231 |
| remaining `contrib/` (terminal, tunnelHost, codeReview, accountMenu, policyBlocked, fileTreeView, onboardingTours, editor, …) + `services/` + `common/` + entrypoints + root docs | 222 | 51,121 |

Entrypoint files inside this batch: `sessions.common.main.ts` (495), `sessions.desktop.main.ts` (252), `sessions.web.main.ts` (207), `sessions.web.main.internal.ts` (24), `electron-browser/sessions.{html,ts,main.ts,desktop.contribution.ts,-dev.html}` and 13 `skills/**` + 14 root `*.md` docs.

### Per-directory detail — W12 platform/agentHost

| Sub-batch | Files | Lines |
| --- | ---: | ---: |
| `test/` | 916 | 303,395 |
| `node/` | 1,184 | 164,888 |
| `common/` | 219 | 44,272 |
| `browser/` | 15 | 4,909 |
| `electron-browser/` | 6 | 2,215 |
| `electron-main/electronAgentHostStarter.ts` | 1 | 322 |
| root docs (`AGENTS.md`, `OTEL.md`, `LOCAL_ENDPOINT.md`) | 3 | 1,030 |

`node/` deep split: `codex/` 854/28,485 · `claude/` 73/31,709 · `copilot/` 44/26,103 · `shared/` 35/12,284 · `agentService.ts` 1/9,135 · `chatContributions/` 25/2,518 · `sshRemoteAgentHostService.ts` 1/2,180 · remaining node files carry the rest. `test/node/` (837/279,930) is dominated by the agent SDK fixture/scenario suites and rides the same batch.

### Dependency order for the wave

1. W17+W18 placeholders (already zero-importer) and W16 (server channel/manager) — leaf (e) removed every construction/registration.
2. W14 terminal trio — only after W11 removes its six sessions importers (recorded coupling finding: leaf (b) could not land earlier).
3. W15 MCP strip together with the W1 `chatMcpAppModel` / `stateToProgressAdapter` / `chatService` producers (the `IMcpToolCallUIData` agentHost variant is produced by the Chat tree).
4. W3–W8 dedicated/notebook trees (no retained importers).
5. W9+W10 auth trees — only sessions importers remain, so they go with or after W11.
6. W11 sessions tree (owns the terminal-trio importers, the auth-tree importers and the C5 build/entrypoint residue); W22 build/devTunnels tail after it.
7. W12+W13 agent host trees after W14/W15/W16 (their last retained consumers); W20 `platform/agentPlugins` with or after W12.
8. W1+W2 chat tree + W19 fixtures last, after every retained edge has gone; W20+W21 must go no later than this step (their remaining importers live in W12/W1).

**Precondition check (2026-10-06, executor):** item 8's "every retained edge has gone" is **NOT met** — the pre-wave readiness re-scan below measures 68 retained files with compile-level edges into the deletion trees (MCP core, browserView tools, notebook viewModels/repl, terminal, extensions, …) that are in no wave batch. W1/W2 chattree and W12 agentHost deletion cannot compile until those edges are disconnected or the files are folded into the wave.

### Scope corrections and residual tails (do NOT delete blindly)

- **`src/vs/platform/agentPlugins/**` — CORRECTED 2026-10-06: extraction executed; the tree returns to the wave as W20.** The pre-wave leaf moved `normalizeMcpServerConfiguration` into the neutral `src/vs/platform/mcp/common/mcpServerConfigurationNormalizer.ts` and repointed the retained `.mcp.json` chain (`mcpWorkspaceConfiguration.ts`; live through `mcpManagementService`, `mcpResourceScannerService`, `mcpTypes`, `workspaceDotMcpDiscovery`, `mcpWorkbenchService`, `mcpConfigurationDestination`, `mcpWorkspaceConfiguration.test`) with a 14-case parity suite (11 moved + 3 new). `pluginParsers.ts` keeps only a value re-export of the normalizer for its remaining importers, because they are all inside deletion-bound trees (17 agentHost-node, 9 agentHost-test, 15 chat = 9 tests + 6 source, 1 sessions fixture, plus the W21 plugin-discovery test); it cannot become a zero-importer `export {}` placeholder before the wave, so delete W20 atomically with or after W12+W1. The remaining agent-host imports in the file (`agentHost/common/state/protocol/{state,mcpAppDefaults}.js`, `agentHost/common/state/sessionState.js`) are unchanged.
- **C5 build/entrypoint residue — CLEANED 2026-10-06 (`build/next/index.ts`, `build/gulpfile.vscode.ts`, `windowImpl.ts`).** `build/next/index.ts` no longer lists any `vs/sessions/*` entry point/CSS/bootstrap and no longer bundles Dev Tunnels web output (`bundleDevTunnelsWeb`/`devTunnelsWebOutDir` import + call removed; the output dir was inside the sessions tree); `build/gulpfile.vscode.ts` dropped the four `vs/sessions/*` checksums and `resources/win32/sessions.ico`; `windowImpl.ts` dropped the sessions URL branch, the sessions icon override and its `backgroundThrottling` special case, plus the now-unused `join` import. **Remaining tail (needs `src/vs/platform/windows/electron-main/windowsMainService.ts`, outside this leaf's surfaces):** `IWindowCreationOptions.isSessionsWindow` (windowImpl L55) is still passed from `windowsMainService.ts` L1568 and derived at L1555 from `environmentService.agentSessionsWorkspace` (also read at L731, L1479, L1682); removing the field without those edits fails compile. The physical `resources/win32/sessions.ico` file and the now zero-importer `build/next/devTunnelsWeb*` helpers ride W22.
- **Server bridge-token plumbing (retained, now inert):** `server/node/serverServices.ts` keeps the `_agentHostBridgeConnectionToken` parameter (unused) because `server/node/remoteExtensionHostAgentServer.ts` and `server/node/server.main.ts` still pass it; `server/node/serverEnvironmentService.ts:18` still exports `agentHostBridgeConnectionTokenEnvironmentVariable`. A later leaf removes the parameter and its env plumbing together.
- **Agent-sessions theme/size tokens:** leaf (f) removed the `../sessions/common/{theme,sizes}.js` side-effect imports from `workbench.common.main.ts`. Consequences: `workbench/contrib/splash/browser/partsSplash.ts` L101–102 (`agentsPanel.background`/`agentsPanel.border`) now yields `undefined` (optional fields, retained splash still works), the agent token ids remain as data in `extensions/theme-*/themes/*.json`, and `build/lib/stylelint/vscode-known-variables.json` keeps the `agents-*` CSS variable entries generated from the deleted sessions stylesheets.
- **Docs/comment residue:** `workbench/browser/web.main.ts` L448 mentions a "sessions in-memory workspace" override example (C5 wording cleanup).

### Pre-wave readiness re-scan — retained → deletion-tree import edges (2026-10-06, executor-measured)

Method: every relative `import`/`export … from` specifier under `src/vs/**` was resolved to a real path and checked against the deletion roots (chat tree, `services/chat`, sessions, platform/workbench agentHost, the five dedicated trees, `platform/agentPlugins`, deletion-bound component fixtures), excluding importers inside those roots. This closes the gap left by the earlier literal-`contrib/chat/` greps, which cannot see relative specifiers such as `../../chat/...`.

Measured result: **86 retained files still carry compile-level edges into deletion-bound trees** — 67 chat, 16 agentHost, 7 inlineChat, 2 chat-services, 2 terminal-chatAgentTools, 1 terminal-chat, 1 agentsVoice, 1 agentPlugins (some files import more than one root). 16 files are already wave-covered (W8 3 · W14 5 · W15 4 · W16 2 · W19 2) and 2 join as W21, leaving **68 files in no batch**. This is compile-level, not dead text: `mcpTypes.test` — a selector of this leaf's own verification set — exercises `mcpTypes.ts`'s chat `enablement`/`languageModelTools` imports.

**MCP — 23 uncovered files (largest coherent family; retained MCP core/UI/tests):** `contrib/mcp/common/`: `mcpTypes.ts` 1,193, `mcpServer.ts` 1,535, `mcpRegistry.ts` 588, `mcpService.ts` 300, `mcpSamplingService.ts` 326, `mcpLanguageModelToolContribution.ts` 403, `mcpTypesUtils.ts` 183; `contrib/mcp/browser/`: `mcpCommands.ts` 1,563 (chat+agentHost), `mcpLanguageFeatures.ts` 690 (chat+agentHost), `mcpServerActions.ts` 1,304, `mcpWorkbenchService.ts` 1,095, `mcpElicitationService.ts` 721, `mcpResourceQuickAccess.ts` 602, `mcpServersView.ts` 583, `mcp.contribution.ts` 145, `mcpAddContextContribution.ts` 98, `openPanelChatAndGetWidget.ts` 27; `contrib/mcp/test/`: `mcpRegistry.test.ts` 1,597, `mcpWorkbenchService.test.ts` 1,170, `mcpConfigurationEntryPoints.test.ts` 568, `mcpGatewayToolBrokerChannel.test.ts` 494, `mcpCommands.test.ts` 74 (chat+agentHost), `testMcpService.ts` 45.

**browserView AI tools — 19 uncovered files (in the C3 approved list; disconnection not yet executed):** `electron-browser/browserViewWorkbenchService.ts` 601, `electron-browser/features/browserEditorChatFeatures.ts` 1,173, `electron-browser/features/browserWelcomeFeature.ts` 68, `electron-browser/tools/` 14 files (`browserToolHelpers` 353, `browserTools.contribution` 167, `clickBrowserTool` 119, `dragElementTool` 113, `handleDialogBrowserTool` 97, `hoverElementTool` 90, `listBrowserPagesTool` 56, `navigateBrowserTool` 166, `openBrowserTool` 362, `openBrowserToolNonAgentic` 82, `readBrowserTool` 73, `runPlaywrightCodeTool` 116, `screenshotBrowserTool` 243, `typeBrowserTool` 161), `test/electron-browser/tools/{navigateBrowserTool,openBrowserTool}.test.ts` 258/241.

**Other retained integrations — 12 uncovered files:** `contrib/debug/browser/debugChatIntegration.ts` 504 (C3), `contrib/issue/electron-browser/issueReporterEditorPane.ts` 651, `contrib/markers/browser/markersChatContext.ts` 131, `contrib/remoteCodingAgents/common/remoteCodingAgentsService.ts` 96, `contrib/scm/browser/scmHistoryChatContext.ts` 337 (C3), `contrib/search/browser/searchChatContext.ts` 341, `contrib/testing/common/testingChatAgentTool.ts` 573 + `test/common/testingChatAgentTool.test.ts` 721, `contrib/update/browser/updateTitleBarEntry.ts` 408; `services/assignment/test/common/assignmentFilters.test.ts` 86 (chat-services); `services/github/browser/githubService.ts` 46 (**agentHost** `githubEndpoints.js`); `workbench/test/browser/componentFixtures/editor/inlineChatAffordance.fixture.ts` 103 (chat+inlineChat).

**Extensions — 3 uncovered files:** `contrib/extensions/browser/extensions.contribution.ts` 2,063, `contrib/extensions/common/installExtensionsTool.ts` 71 (C3), `contrib/extensions/common/searchExtensionsTool.ts` 150 (C3).

**Notebook/REPL — 6 uncovered files:** `contrib/notebook/browser/diff/notebookDiffActions.ts` 751, `contrib/notebook/browser/diff/inlineDiff/notebookOriginalModelRefFactory.ts` 94; `contrib/notebook/browser/viewModel/{baseCellViewModel,codeCellViewModel,markupCellViewModel}.ts` 751/548/331 and `contrib/replNotebook/browser/repl.contribution.ts` 497 (**inlineChat**).

**Terminal — 5 uncovered files:** `contrib/terminal/browser/terminal.ts` 1,657, `contrib/terminal/browser/chatTerminalCommandMirror.ts` 1,005 (U05-C4-K), `contrib/terminal/terminalContribChatExports.ts` 10 (U05-C4-K); `contrib/terminalContrib/telemetry/browser/terminalProfileConfigurationTelemetry.ts` 118 + test 132 (chatAgentTools setting id).

Candidate dispositions for the parent (not executed by this leaf): **(a)** wave additions for modules already recorded as deletion-bound but missing from W1–W22 — `testingChatAgentTool.ts` (+test) (U05-C4-J), the U05-C4-K terminal trio/tests, `markersChatContext.ts`, `searchChatContext.ts`, `scmHistoryChatContext.ts`, the notebook diff chat files, `inlineChatAffordance.fixture.ts`; **(b)** bounded disconnection leaves where the C3 grant anticipates removing the chat edge, not the file — browserView AI tools/features, `debugChatIntegration.ts`, `installExtensionsTool.ts`/`searchExtensionsTool.ts`, `updateTitleBarEntry.ts`, `issueReporterEditorPane.ts`, `remoteCodingAgentsService.ts`, `assignmentFilters.test.ts`, `githubService.ts`; **(c)** a retained-core neutralization family for the MCP chat integration (23 files), `terminal.ts`, `extensions.contribution.ts` and the notebook `viewModel/*` + `repl.contribution.ts` inlineChat edges.

### Zero-importer placeholder batch (W18) — 40 files, 6 lines each (240 lines)

`api/browser/`: mainThreadAgentEditorComments, mainThreadAuthentication, mainThreadChatAgents2, mainThreadChatCodeMapper, mainThreadChatContext, mainThreadChatDebug, mainThreadChatInputNotification, mainThreadChatOutputRenderer, mainThreadChatQuota, mainThreadChatSessions, mainThreadChatStatus, mainThreadLanguageModelTools, mainThreadLanguageModels.
`api/common/`: extHostAgentEditorComments, extHostAuthentication, extHostChatAgents2, extHostChatContext, extHostChatDebug, extHostChatInputNotification, extHostChatOutputRenderer, extHostChatQuota, extHostChatSessions, extHostChatStatus, extHostCodeMapper, extHostLanguageModelTools, extHostLanguageModels, extHostXaaAuthProvider.
`api/node/extHostAuthentication.ts`.
`api/test/browser/`: extHostAuthentication.integrationTest, extHostAuthentication.test, extHostXaaAuthProvider.test, mainThreadAuthentication.integrationTest, mainThreadAuthentication.test, mainThreadChatAgents2.test, mainThreadChatInputNotification.test, mainThreadChatSessions.test, mainThreadLanguageModels.test.
`api/test/common/extHostChatAgents2.test.ts`.
`contrib/editTelemetry/`: `browser/telemetry/agentHostEditMarkerService.ts` (778 → 6) and `test/browser/agentHostEditMarkerService.test.ts` (788 → 6) — the W17 pair, included here so the batch totals stay disjoint.

### Wave prerequisite evidence (executor-observed)

- `npm run compile-client` (Node 24.18.0) exit 0 after leaves (d), (e) and (f).
- Retained assertions green: `productDebloatChatIntegrations.test` **27/27** (now includes the agent-host edit-traces absence test and the server/shared-process channel-absence test), `accountFreeApi.test` **10/10**, `editSourceTrackingImpl.test` **8/8** (agent-host scenarios retired with the marker service), `editTracker.test` **9/9** (correlation interfaces relocated), `editTelemetry.test` **3/3**.
- Server boundary evidence: `serverMain.test` **4/4**; the wave-listed modules/suites still pass intact (`agentHostChannel.test` 9/9, `serverAgentHostManager.test` 20/20).
- `git diff --check` clean; no path was staged, committed, or unlinked by this executor.

## Pre-wave readiness resolution — 68-file dispositions executed (2026-10-07, executor)

All recorded dispositions for the 68 unbatched retained→deletion edge files (a/b/c of the "Pre-wave readiness re-scan" above) are executed, together with the `windowsMainService.ts` `isSessionsWindow` tail. The re-scan below is the same relative-import-resolving method with every wave root (W1–W26) and placeholder treated as deletion-bound.

### New wave additions (fold into the parent's `git rm`; placeholders where noted)

| Batch | Exact tracked scope | Files | Notes |
| --- | --- | ---: | --- |
| W23 | MCP chat-integration placeholders: `contrib/mcp/browser/mcpAddContextContribution.ts`, `contrib/mcp/browser/openPanelChatAndGetWidget.ts`, `contrib/mcp/common/mcpLanguageModelToolContribution.ts`; `contrib/mcp/test/browser/mcpCommands.test.ts` | 4 | each is a 6-line `export {}` placeholder with zero retained importers; the `pluginMcpDiscovery.ts` pair stays W21 |
| W24 | browserView AI tools: `electron-browser/tools/**` (13 tool files + `browserTools.contribution.ts` + `browserToolHelpers.test.ts`, `test/electron-browser/tools/{navigateBrowserTool,openBrowserTool}.test.ts`) + `electron-browser/features/browserEditorChatFeatures.ts` | 17 | all placeholders except `browserToolHelpers.ts`, which is **retained and neutralized** (only `formatBrowserEditorList` + `getBrowserPageResourceNavigationError` remain for `browserEditorInput.test.ts`) |
| W25 | terminal chat-only files: `terminal/browser/chatTerminalCommandMirror.ts`, `terminal/browser/terminalTabsChatEntry.ts`, `terminal/terminalContribChatExports.ts`, `terminal/test/browser/chatTerminalCommandMirror.test.ts`, `terminal/test/browser/chatTerminalMirrorTestUtils.ts` | 5 | zero retained importers (U05-C4-K) |
| W26 | other chat-owned retained files: `testing/common/testingChatAgentTool.ts` + test, `markers/browser/markersChatContext.ts`, `search/browser/searchChatContext.ts` + test, `scm/browser/scmHistoryChatContext.ts`, `debug/browser/debugChatIntegration.ts`, `notebook/browser/diff/inlineDiff/notebookOriginalModelRefFactory.ts`, `extensions/common/{installExtensionsTool,searchExtensionsTool}.ts`, `workbench/test/browser/componentFixtures/editor/inlineChatAffordance.fixture.ts` | 11 | zero retained importers after the disconnections below; `SCMHistoryItemTransferData` moved to `scmHistoryViewPane.ts` |

### Retained files disconnected (chat/agentHost edges removed, files survive)

- MCP core: neutral extractions `platform/mcp/common/contributionEnablement.ts` (from `chat/common/enablement.ts`, which now re-exports it for deletion-bound consumers) and `platform/mcp/common/mcpToolTypes.ts` (`IToolProgressStep`/`ToolProgress`/`ToolDataSource`); `mcpTypes.ts`, `mcpServer.ts` (drop `vscode.conversationId` meta), `mcpRegistry.ts` (local strict-plugin-only policy helper reading the retained platform policy key), `mcpService.ts`, `mcpTypesUtils.ts`, `mcpServerActions.ts`, `mcpWorkbenchService.ts`, `mcpResourceQuickAccess.ts` (attach-to-chat actions removed), `mcpServersView.ts`/`mcp.contribution.ts` (chat setup gates removed; quick-access registration retained without a chat `when`), `mcpLanguageFeatures.ts` (agent-host branches removed; config code lenses/inlay hints retained). `mcpSamplingService.ts` and `mcpElicitationService.ts` are **retained stubs** implementing their interfaces (sampling rejects, elicitation declines, no logs) because `mcpServer.ts` injects both.
- browserView: `browserViewWorkbenchService.ts` (sharing availability is now a constant-false context, chat-session foreground branch removed, `aiFeaturesDisabled: true`), `browserWelcomeFeature.ts` (plain welcome subtitle), `browserToolHelpers.ts` (neutral retained subset).
- Small retained disconnections: `services/github/browser/githubService.ts` (local github.com endpoints), `contrib/remoteCodingAgents/common/remoteCodingAgentsService.ts` (local `hasRemoteCodingAgent` context key), `contrib/update/browser/updateTitleBarEntry.ts`, `contrib/issue/electron-browser/issueReporterEditorPane.ts`, `contrib/notebook/browser/diff/notebookDiffActions.ts`, `contrib/notebook/browser/viewModel/{base,code,markup}CellViewModel.ts`, `contrib/replNotebook/browser/repl.contribution.ts`, `contrib/terminal/browser/terminal.ts` (terminal-owned confirmation-action type), `contrib/terminalContrib/telemetry/{browser,test/browser}/terminalProfileConfigurationTelemetry*.ts`, `services/assignment/test/common/assignmentFilters.test.ts`, `contrib/extensions/browser/extensions.contribution.ts` (chat tool registration + plugin-install call removed), `contrib/scm/browser/scmHistoryViewPane.ts` (now owns `SCMHistoryItemTransferData`), `contrib/notebook/browser/diff/inlineDiff/notebookInlineDiff.ts` (dead factory registration removed).
- `windowsMainService.ts` + `platform/window/common/window.ts` + `platform/windows/electron-main/windowImpl.ts`: `isSessionsWindow` field/derivations removed; `services/environment/electron-browser/environmentService.ts` returns `false` (sessions window unreachable).
- **Surface note:** the last path is not in the grant's file list; it is the one-line compile-necessity reader of the removed configuration field and is flagged for parent ratification in `apply-progress.md`.

### Final readiness re-scan (executor-measured)

Same method as above, with every W1–W26 root (plus the placeholders) treated as deletion-bound. Result: **15 retained files with edges, all already wave-covered** — W8 3 (`notebook/browser/{contrib,controller}/chat/*`), W14 5 (terminal agent-host trio + tests), W15 4 (MCP tool-call UI + editor-affordance state + tests), W16 2 (server agent-host channel/manager + test), W19 1 (`workbench/test/browser/aiCustomizationManagementSectionRegistry.test.ts`). Zero uncovered retained→wave edges remain; W1/W2/W11/W12/W20 can be deleted without further disconnection work.

### Post-wave completion — pending physical deletion (2026-10-06)

The wave left the default-account surface half-deleted; the executor removed its workbench plumbing and decoupled `AccountPolicyService` (see `apply-progress.md`, “Post-wave dangling-reference fix pass”). Physical deletion is parent-owned:

| Path | Ready? | Notes |
| --- | --- | --- |
| `src/vs/workbench/services/accounts/browser/managedSettings.ts` | **Yes** | zero production importers after the deleted workbench account impl went; only its own test imports it. |
| `src/vs/workbench/services/accounts/test/browser/managedSettings.test.ts` | **Yes** | tests only the file above; delete both together. |
| `src/vs/platform/defaultAccount/common/defaultAccount.ts` | **Yes** | parent approved the 4 exact test paths; the dead `IDefaultAccountService` stubs were removed from `editor/contrib/inlineCompletions/test/browser/{utils,suggestWidgetModel.test}.ts`, `editor/contrib/suggest/test/browser/suggestModel.test.ts` and `workbench/services/assignment/test/common/assignmentService.test.ts`. Zero importers remain after the `services/accounts` pair is deleted; `git rm` all three together (see `apply-progress.md`). |

After this pass no production file imports `platform/defaultAccount` or `workbench/services/accounts`; `accountPolicyService.ts` no longer references the account service, and the editor inline-completions account/`sku` injection is gone, so no runtime DI consumer remains.

### C5/C6 build-tail closure — readiness and new pending deletions (2026-10-07)

W22 is now **ready to execute** and the C5/C6 build-registration residue is cleaned; the remaining whole-file deletions are parent-owned. Measured by the executor’s reference audit (repo-wide `grep` excluding `node_modules`, `out*`, `.git`) and the build-lib test run:

| # | Path(s) | Ready? | Evidence / blocking note |
| --- | --- | --- | --- |
| W22 | `build/next/devTunnelsWeb.ts`, `build/next/devTunnelsWebEntry.js`, `build/next/test/devTunnelsWeb.test.ts`, `build/next/devTunnelsShims/{buffer.js,empty.cjs,process.js,vscodeJsonrpc.cjs}` | **Yes** | Only its own test imports the helper (`build/next/index.ts`’s import/call was removed on 2026-10-06); the bundle output dir is inside the deleted `src/vs/sessions` tree; the entry point exists only to bundle `@microsoft/dev-tunnels-*` for the removed account/remote-agent-host feature. **The `resources/win32/sessions.ico` part of W22 is already absent** (`git ls-files resources/win32 \| grep sessions` → empty), so the row’s binary item is closed. `apply-progress.md` records the five `.eslint-allowed-javascript-files` entries that must go **in the same commit**. |
| W27 | `build/lib/test/agentHostDependencies.test.ts` (196 lines) | **Yes** | Fails today: `ENOENT ... src/vs/platform/agentHost/node/agentHostServerMain.ts`. It validates the runtime dependency graph of the two deleted Agent Host entry points and has no consumer. Wave-caused regression, discovered this pass. |
| W28 | `src/vs/server/node/agentHostChannel.ts` (412 lines) + `src/vs/server/test/node/agentHostChannel.test.ts` | **Yes** | `C6.RED → GREEN` names the channel; zero references repo-wide (no `serverServices.ts` registration, no importer); the test exercises only that channel. The file compiles because it only reuses base/platform IPC primitives — it is dead source, not a compile dependency. |
| W29 | `src/vs/workbench/test/browser/componentFixtures/editor/multiDiffEditorChatChanges.json` (315,177 bytes) | **Yes** | Zero importers after the fixture edit that removed the `ChatInputChanges` variant; the payload is deleted `contrib/chat` source text used as inert screenshot data. |
| W30 | `build/vite/mobile-multi-diff.html`, `build/vite/mobile-multi-diff.ts`, `build/vite/mobile-multi-diff-worker.ts` | **Yes** | Playground for the deleted `src/vs/sessions/browser/parts/mobile/contributions/mobileMultiDiff*` view; both TS files import deleted modules (`vite/**` is excluded from `build/tsconfig.json`, so the client typecheck cannot see it); `vite.config.ts` builds only `workbench-vite.html`; no script or HTML references the trio. |
| W22/C6 follow-up | `.eslint-allowed-javascript-files`: `build/next/devTunnelsWebEntry.js` + `build/next/devTunnelsShims/{buffer.js,empty.cjs,process.js,vscodeJsonrpc.cjs}`; `.eslint-allowed-bracket-notation-files`: `scripts/code-agent-host.js`, `scripts/code-sessions-web.js`, `scripts/sync-agent-host-protocol.ts`, `scripts/test-agent-host-e2e.ts` | with their files | These nine allow-list entries name files that still exist; they must be removed in the commit that deletes the files, otherwise `local/code-no-new-javascript-files` / the bracket rule would flag live files. |

**Wave-gap note:** W16 was recorded as the server agent-host channel/manager pair, but `src/vs/server/node/agentHostChannel.ts` + its test survived the 2026-10-06 wave (`git log 90cd0fad145`); they are re-listed here as W28 so the C6 row can be closed honestly. Likewise the wave left the stale `build/lib/test/agentHostDependencies.test.ts` (W27) behind, which is why the build-lib suite is red today.

### C5/C6 build-registration cleanup executed this pass (2026-10-07)

- `build/next/resources.ts`: seven dead globs removed (sessions media SVG ×2, `sessions{,-dev}.html`, sessions prompts/skills + header, `chatPet` media, `agentsVoice` audio ×3) — the target trees are deleted, so the globs could never match.
- `.eslint-allowed-bracket-notation-files` / `.eslint-allowed-javascript-files`: every entry naming an absent path removed (143 + 5 entries; 4 sections dropped, 3 renamed to their retained content: MCP, Configuration/profiles/policy, Remote/tunnels/networking). Live-file entries kept on purpose.
- `build/lib/i18n.ts` + `build/lib/i18n.resources.json` + `build/lib/test/i18n.test.ts`: the `vs/sessions` Transifex project, its 35-entry resource list and the dead `vs/workbench/services/agentHost` entry are gone; a negative test now enforces that `vs/sessions/**` cannot resolve to an XLF bundle.
- Residual C6/P3 tails that remain open are listed in `apply-progress.md` (“Remaining C5/C6/P3 tails discovered”): the agent-host/sessions dev scripts and `.github` workflows/skills, `build/azure-pipelines/common/smokeTestAgentHost.ts` + pipeline hooks, `build/codex/**` and its generated-agentHost protocol tooling, `build/filters.ts` codex exclusions, `build/agent-sdk/**`, and the `chat.agentHost.*` policy keys.

### Approved escalation (`approve-all-three`) — additional pending deletions (2026-10-07)

The parent approved the three escalation groups; the reference cleanups are done and the whole-file deletions are parent-owned. Decisive evidence per entry:

| # | Path(s) | Ready? | Evidence |
| --- | --- | --- | --- |
| W31 | `scripts/mock-policy-server/{README.md,endpoints.ts,server.ts,public/{app.ts,index.html,style.css}}` | **Yes** | Served the deleted `DefaultAccountService`/`defaultChatAgent` policy endpoints; only consumer was the root `package.json` `mock-policy-server` script (removed); only doc was `local-testing.md` (W34, links cleaned); no allow-list or CODEOWNERS entry. |
| W32 | `scripts/code-agent-host.{js,sh}`, `scripts/code-sessions-web.{js,sh}`, `scripts/sync-agent-host-protocol.ts`, `scripts/test-agent-host-e2e.ts`, `scripts/test-agent-host-e2e-child.ps1`, `scripts/agent-host-e2e-coverage.ts` | **Yes** | All external consumers removed in this pass (npm scripts, `test-integration.{sh,bat}`, `.vscode/launch.json`, the three PR workflows); remaining mentions are self-references plus its coupled allow-list entries. |
| W33 | `scripts/chat-simulation/{config.jsonc,jsconfig.json,merge-ci-summary.js,test-chat-perf-regression.js,test-chat-mem-leaks.js,common/perf-scenarios.js,common/utils.js,fixtures/_chatperf_*.ts}` (15 files) | **Yes** | Chat-perf harness; consumers were the removed npm scripts, `.github/workflows/chat-perf.yml` (W34) and the removed standalone branch of the retained mock server. |
| W33-retained | `scripts/chat-simulation/common/mock-llm-server.ts` | **KEEP — not deletable yet** | Live dependency of retained smoke code: `test/smoke/src/utils.ts:228` returns this path and `areas/browserView/browserView.test.ts:23` (+ `areas/agentHost…`/chat areas) `require` it at runtime. Its deletion needs the `test/**` follow-up (disconnect `utils.ts` + the chat/agentsWindow smoke areas first). |
| W34 | `.github/workflows/{sessions-e2e,chat-perf}.yml`, `.github/actions/detect-agent-host-e2e-changes/**`, `.github/instructions/{sessions,agentHostTesting}.instructions.md`, `.github/learnings/sessions.md`, `.github/skills/{sessions,chat-perf,agent-host-chat-contributions,agent-host-e2e-tests,customizations-in-the-agent-host}/SKILL.md`, `.github/skills/agent-host-logs/**`, `.github/skills/policy-and-managed-settings/local-testing.md` | **Yes** | Owned by the deleted sessions/agent-host E2E and chat-perf harnesses, or by the deleted mock policy server; the detect action is now referenced by no workflow and the skill/instruction files are entirely about removed features. |

**Coupled allow-list entries for the same commit (16):** `.eslint-allowed-javascript-files` → the five `build/next/devTunnels*` entries, `scripts/code-agent-host.js`, `scripts/code-sessions-web.js`, and the five `scripts/chat-simulation/*.js` entries; `.eslint-allowed-bracket-notation-files` → `scripts/{code-agent-host.js,code-sessions-web.js,sync-agent-host-protocol.ts,test-agent-host-e2e.ts}`. They must not be removed before their files, or the lint rules flag live files.

**Execution note:** the multi-item `git rm` for W22 + W27–W34 (plus these 16 entries) should be followed by `npm run compile-client`, `cd build && node --test lib/test/walkerProduct.test.ts lib/test/ripgrep.test.ts`, `npm run typecheck --prefix build`, and the repo lint path (`node build/eslint.ts <a few nls-importing workbench files>`) so the now-unreferenced deletions and the translation-remind rule are re-verified in the committed state.

### Lint rule fixed (2026-10-07, `approve-translation-remind-rule-fix`)

`.eslint-plugin-local/code-translation-remind.ts` previously spread `[...parsed.workbench, ...parsed.sessions]` from `build/lib/i18n.resources.json`, so removing the `sessions` project crashed repo lint (`TypeError: parsed.sessions is not iterable`). The parent approved the path; the rule is now project-agnostic (`Object.values(parsed).flatMap(project => Array.isArray(project) ? project : [])`) and its dead `vs/sessions/contrib/...` branch is gone, so `build/lib/i18n.resources.json` is back to exactly the retained `editor` + `workbench` projects with no `vs/sessions`/`vs/workbench/services/agentHost` entry and no placeholder container. Verified: RED crash reproduced before the fix; eslint on nls-importing contrib/services/editor/notebook/terminal files exit 0; `Linter`-API semantics check keeps the enforcing `missing` report for unlisted resources; `npm run typecheck --prefix build` exit 0; build tests 30/30. Note: `.eslint-plugin-local/tsconfig.json` is red at HEAD for untouched rule files (visitor-type drift vs `@typescript-eslint/utils`); zero errors reference the edited rule.

### W35 — Rust CLI Agent Host surface, disconnected and ready for parent `git rm` (2026-10-07, `U07.a.001`)

The executor disconnected every registration/reference and left the whole files in place; the parent executes the `git rm` between passes. Measured in the current worktree (`git ls-files` + `wc -l`), all plain text, no binaries:

| # | Path | Lines | Ready? | Evidence |
| --- | --- | ---: | --- | --- |
| W35.a | `cli/src/commands/agent.rs` | 400 | **Yes** | `pub mod agent;` removed from `commands.rs`; `Commands::Agent`/`AgentArgs`/`AgentSubcommand`/dispatch removed; its only inbound consumers (`main.rs` dispatch + `args.rs`) are cleaned; zero remaining `commands::agent` references outside the file. |
| W35.b | `cli/src/commands/agent_discovery.rs` | 317 | **Yes** | module registration removed; only agent modules (`agent.rs`, `agent_ps.rs`, `agent_kill.rs`, `agent_logs.rs`) imported it; no retained importer. |
| W35.c | `cli/src/commands/agent_endpoints.rs` | 146 | **Yes** | registration + dispatch removed; sole consumer was `main.rs`; zero retained references. |
| W35.d | `cli/src/commands/agent_host.rs` | 1202 | **Yes** | registration + dispatch + `command_shell.rs` `ensure_supervisor_running` consumer + `control_server.rs` `ActiveAgentHost` consumer all removed; `AgentHostArgs`/bridge fields gone; zero retained imports. |
| W35.e | `cli/src/commands/agent_kill.rs` | 168 | **Yes** | registration + dispatch removed; zero retained imports. |
| W35.f | `cli/src/commands/agent_logs.rs` | 222 | **Yes** | registration + dispatch removed; zero retained imports. |
| W35.g | `cli/src/commands/agent_ps.rs` | 497 | **Yes** | registration + dispatch removed; zero retained imports. |
| W35.h | `cli/src/commands/agent_relay.rs` | 344 | **Yes** | registration + dispatch removed; zero retained imports. |
| W35.i | `cli/src/commands/agent_stop.rs` | 108 | **Yes** | registration + dispatch removed; zero retained imports. |
| W35.j | `cli/src/tunnels/agent_host.rs` | 3658 | **Yes** | `pub mod agent_host;` removed from `tunnels.rs`; the command-side consumers are W35.a–i; no retained importer of the module remains (grep over compiled files = 0). |
| W35.k | `cli/src/tunnels/agent_host_registry.rs` | 1591 | **Yes** | module registration removed; its only importers (agent commands, `tunnels/agent_host.rs`, `user_data_path.rs`) are all manifest-bound; no retained importer. |
| W35.l | `cli/src/tunnels/agent_host_registry_acl_windows.rs` | 350 | **Yes** | the `#[cfg(windows)] mod agent_host_registry_acl_windows;` registration was removed with the registry; it is the registry's Windows ACL helper and has no other declaration site. |
| W35.m | `cli/src/tunnels/idle_timeout.rs` | 353 | **Yes** | agent-supervisor-only idle termination (`commands/agent_host.rs` + `tunnels/agent_host.rs` consumers gone); `pub mod idle_timeout;` unregistered; zero retained references. Not part of the generic `serve_stream`/`serve-web`/SSH tunnel core. |
| W35.n | `cli/src/tunnels/user_data_path.rs` | 334 | **Yes** | agent-host registry user-data resolver; its only callers were the agent commands + `tunnels/agent_host{,_registry}.rs`; `pub mod user_data_path;` unregistered; zero retained references. |

**W35 readiness total: 14 files / 9,690 lines**, all disconnected, `cargo check` + full `cargo test` green without them being compiled. The `tunnels/` core (`code_server.rs`, `control_server.rs`, `machine_status.rs`, `paths.rs`, `protocol.rs`, `legal.rs`, `challenge.rs`, `server_bridge.rs`, `server_multiplexer.rs`, `shutdown_signal.rs`, `socket_signal.rs`) and `cli/src/auth.rs` stay — the `tunnels` crate dependency is still consumed by `auth.rs` (`AuthorizationProvider for Auth`) and `tunnels/protocol.rs` (`TUNNEL_PROTOCOL_*`), so no `cli/Cargo.toml`/`Cargo.lock` change is claimed.

**C6 still open after W35 — agent-host tails outside this leaf's surfaces (recorded for the parent):**

1. `src/vs/server/node/serverEnvironmentService.ts` — argv schema/interface/redaction for `agent-host-port`, `agent-host-bridge-{port,path,host,connection-token}` and `agentHostBridgeConnectionTokenEnvironmentVariable` (lines ~18, 28–29, 102–107, 237–242).
2. `src/vs/server/node/server.main.ts` (~15, 38–39, 72) — reads and deletes `VSCODE_AGENT_HOST_BRIDGE_CONNECTION_TOKEN` and threads it into `doCreateServer`.
3. `src/vs/server/node/remoteExtensionHostAgentServer.ts` (~612, 653) — `createServer(..., agentHostBridgeConnectionToken)` parameter.
4. `src/vs/server/node/serverServices.ts` (~105) — `setupServerServices(..., _agentHostBridgeConnectionToken: string | undefined, ...)` (already unused, `_`-prefixed).
5. `src/vs/server/test/node/serverConnectionToken.test.ts` (~105–121) — fixture exercising the bridge redaction.
6. `extensions/vscode-test-resolver/src/extension.ts` (~26, 167–194) + `extensions/vscode-test-resolver/package.json` (~160–171) — `testresolver.agentHostPort`/`agentHostBridgePort`/`agentHostBridgeConnectionToken` settings that emit `--agent-host-port` / `--agent-host-bridge-port` + the env var.
7. `test/smoke/src/areas/agentsWindow/**` (5 tracked files incl. the `packagedAgentHost.ts`/`tunnelAuthentication/**` fixtures) — full agent-host smoke suite for the deleted trees; referenced by the smoke runner and by the retained mock LLM server chain (W33-retained note).

None of these compile against the removed Rust modules, so W35 is independently deletable; they are TS-side C6/U06 tails whose edit paths are outside the `cli/**` surfaces of this leaf and need a parent grant (or a separate C6 TS-tail leaf).

### W36 — Agent Host smoke + automation tails, disconnected and ready for parent `git rm` (2026-10-07, `u07.a.002`)

The executor disconnected every retained reference (smoke runner import/registration, automation `Workbench` field/export) and left the whole files in place; the parent executes the `git rm` between passes. Measured with `wc -l` in the current worktree, all plain text, no binaries:

| # | Path | Lines | Ready? | Evidence |
| --- | --- | ---: | --- | --- |
| W36.a | `test/smoke/src/areas/agentsWindow/agentsWindow.test.ts` | 936 | **Yes** | Sole importer was `test/smoke/src/main.ts` (import + `setupAgentsWindowTests` registration removed in `u07.a.002`); drives the removed `app.workbench.agentsWindow` automation field and imports `../chat/shellScenarios` + `./remoteDevContainerFixtures`; it is the only file carrying post-disconnection `test/smoke` tsc errors (exactly 64, all its own `app.workbench.agentsWindow` uses), and the directory-excluded shadow compile of the retained smoke sources is 0 errors. |
| W36.b | `test/smoke/src/areas/agentsWindow/remoteDevContainerFixtures.ts` | 976 | **Yes** | Imported only by `agentsWindow.test.ts`; no other smoke file references it. |
| W36.c | `test/smoke/src/areas/agentsWindow/fixtures/packagedAgentHost.ts` | 161 | **Yes** | Forked/copied only by `remoteDevContainerFixtures.ts` (L366, L873, L878); no other consumer. |
| W36.d | `test/smoke/src/areas/agentsWindow/fixtures/tunnelAuthentication/extension.ts` | 43 | **Yes** | Copied only by `remoteDevContainerFixtures.ts` (L690–691). |
| W36.e | `test/smoke/src/areas/agentsWindow/fixtures/tunnelAuthentication/package.json` | 20 | **Yes** | Copied only by `remoteDevContainerFixtures.ts` (L690–691). |
| W36.f | `test/automation/src/agentsWindow.ts` | 1125 | **Yes** | The `Workbench.agentsWindow` field/constructor and the `test/automation/src/index.ts` re-export were removed in `u07.a.002`; `grep -rn "agentsWindow\|AgentsWindow" test/automation/src` is zero outside the file's own `[agentsWindow]` log strings. |

**W36 readiness total: 6 files / 3,261 lines.** All compiled/reference consumers are disconnected: `test/smoke` retained sources typecheck 0 errors with the directory excluded, and `test/automation` compiles 0 errors with the helper still present. The physical `git rm` is independent of W35 (no cross-references).

**Post-`git rm` expectation:** `cd test/smoke && npm run compile` becomes 0 errors (in the current worktree it reports exactly the 64 W36.a-internal errors), `cargo check --manifest-path cli/Cargo.toml` stays green, and the generated `test/smoke/out/**` / `test/automation/out/**` copies are ignored build artifacts, not part of the manifest.

**`u07.a.002` closes the “C6 still open after W35” list above:** items 1–6 are executed (server argv/env/redaction schema, `server.main.ts` env bridge, `remoteExtensionHostAgentServer.createServer` parameter, `serverServices.setupServerServices` unused parameter, `serverConnectionToken.test.ts` fixture, `vscode-test-resolver` settings/argv/env emission) plus the additional `src/server-main.ts` minimist string list; item 7 is disconnected and manifest-bound as W36 above. `src/vs/server/**` and `extensions/vscode-test-resolver/**` now have zero `agent-host*` / `agentHostBridge*` / `AGENT_HOST_BRIDGE*` matches.

### W37 — Bundled Copilot extension tree + its packaging/CI tails, disconnected and ready for parent `git rm` (2026-10-07, `p2.green` + `c7.disconnect`)

The executor disconnected every retained consumer and left all files in place; the parent executes the `git rm` between passes. Readiness was checked with reference sweeps (`grep -rn` over `*.yml|ts|js|json|md|sh|bat`, excluding `extensions/copilot/**`, `openspec/**`, `out*/**`) after this pass; each entry below lists what refused to be disconnected if anything.

| # | Path(s) | Ready? | Evidence |
| --- | --- | --- | --- |
| W37.a | `extensions/copilot/**` (whole tree: sources, tests, fixtures, `chat-lib/**`, scripts, styles, assets, vendored/generated resources, `package.json`/`package-lock.json`, `.nvmrc`, `.eslintplugin/**`) | **Yes** | Disconnected in this pass from: `build/npm/dirs.ts` (npm workspace list), `build/lib/extensions.ts` (excluded list + `packageCopilotExtensionStream`), `build/gulpfile.extensions.ts` (`compile-copilot-extension-build`), `build/gulpfile.vscode.ts` + `build/gulpfile.reh.ts` (extension compile step), `build/next/build-fast.ts` + its test (Copilot build lane + `extensions/copilot/package.json` env fingerprint), `build/hygiene.ts` + `build/gulpfile.hygiene.ts` (`checkCopilotEnginesVersion`), `.vscode-test.js` (test label + `dist/test-extension.js`), root `package.json` scripts/dependency/runtime version, `.github/workflows/{pr,pr-node-modules,pr-linux-test,pr-win32-test,pr-darwin-test}.yml`, `build/azure-pipelines/**` stages/steps. `extensions/copilot/out/**` and `dist/**` are ignored build output, not tracked. |
| W37.b | `build/lib/copilot.ts` | **Yes** | Shim-only after P1 (ripgrep extraction). Zero importers remain; its two former importers (`gulpfile.vscode.ts`, `gulpfile.reh.ts`) now use `build/lib/{ripgrep,mxc}.ts`. `getMxcExcludeFilter` was extracted to the new neutral `build/lib/mxc.ts` first so the retained sandbox packaging keeps its per-arch filter. |
| W37.c | `build/lib/test/copilot.test.ts` (471 lines) | **Yes** | Only importer was the helper above. Its retained coverage was migrated: the two `@microsoft/mxc-sdk` cases and the ordinary ripgrep/`getRipgrepExcludeFilter` cases live on in `build/lib/test/copilotFreePackaging.test.ts` and `build/lib/test/ripgrep.test.ts`. |
| W37.d | `build/azure-pipelines/copilot/{build-steps,l10n-steps,pull-test-cache,setup-steps,test-integration-steps,test-steps}.yml` | **Yes** | `pull-test-cache.yml` and `test-integration-steps.yml` were included by the per-OS compile/test steps (`darwin`/`linux`/`win32`) — those includes are removed in this pass. Nothing else references the directory. |
| W37.e | `build/azure-pipelines/product-copilot.yml`, `product-copilot-recovery.yml` | **Yes** | The `Copilot` stage was instantiated by `product-build.yml`, `product-build-template.yml`, `product-build-ado-ci.yml` and `product-smoke-flaky.yml` — all four stage blocks are removed, and the smoke-flaky OS stages no longer `dependsOn: Copilot`. |
| W37.f | `build/azure-pipelines/common/downloadCopilotVsix.ts` | **Yes** | Its detached/attach `deemon` steps are removed from `alpine/product-build-alpine.yml`, `darwin|linux|win32 .../product-build-*-compile.yml` and `web/product-build-web.yml`. The `copilot_vsix` artifact is produced only by `product-copilot.yml` (W37.e), and `downloadNotice.ts` no longer cites it as its blueprint. |
| W37.g | `build/azure-pipelines/common/apply-sdk-canary.yml`, `apply-sdk-canary-override.ts` | **Yes** | Template include removed from all 8 consumer pipelines; the `VSCODE_SDK_CANARY_VERSION`/`VSCODE_CLI_CANARY_VERSION` parameters and normalizing variables are removed from `product-build.yml` and `product-build-ado-ci.yml`. |
| W37.h | `build/copilot-migrate-pr.ts` | **Yes** | Self-references only (usage banner + temp-file name); no script, workflow or doc invokes it. |
| W37.i | `.github/workflows/chat-lib-package.yml` | **Yes** | Entire workflow is `extensions/copilot/chat-lib`; no other file references it. |
| W37.j | `.github/skills/otel/SKILL.md` | **Yes** | Subject is Agent Host + local Copilot Chat OTel (both deleted); nothing references the skill. Retained VS Code OTel code keeps its own in-tree documentation. |
| W37.k | `.github/workflows/chat-perf.yml`, `.github/skills/chat-perf/**` | **Yes** | Already recorded as W34; re-confirmed disconnected (only self-references inside the pair). |

**Coupled allow-list / ignore entries — SEVERED 2026-10-07 (executor, ratified deletion-coupling grant).** The W37 lint/ignore coupling was removed ahead of this deletion: `.eslint-allowed-bracket-notation-files` lost the `# Copilot extension (90 files)` section header plus all 90 `extensions/copilot/**` entries and the `build/azure-pipelines/common/apply-sdk-canary-override.ts` entry (its section count recounted 48 → 47); `.eslint-allowed-javascript-files` lost its 30 `extensions/copilot/**` entries; `.eslint-ignore` lost its 17 `**/extensions/copilot/**` entries. `eslint.config.js` no longer imports `./extensions/copilot/.eslintplugin/index.ts`, no longer registers the two `extensions/copilot/**/*` ignore patterns or the three copilot dependency entries in its import-pattern lists, and the complete `copilot-local` config block (400 lines) is deleted. Measured change for the pass: `eslint.config.js` 408 deletions · `.eslint-allowed-bracket-notation-files` 94 deletions + 1 insertion · `.eslint-allowed-javascript-files` 30 deletions + 2 insertions · `.eslint-ignore` 17 deletions. The same pass restored two **live-file** entries (`.vscode-test.js`, the `eslint.config.js` self-entry) that the W27–W34 stale-prune commit `d50e03b4e77` had removed by mistake — the prune's intent was absent-path entries only. No plugin, pattern or allow/ignore entry now couples this deletion to lint loading, so the `git rm` no longer has to land with lint edits.

**Dependencies that die with the tree:** `@vscode/copilot-api` (root `package.json` dependency + `package-lock.json` entries) and `src/typings/copilot-api.d.ts` — both outside this pass's surfaces (see apply-progress escalation). **Open finding (2026-10-07, deletion-coupling pass):** `remote/package.json` still declares `@github/copilot-sdk` (line 7), `@vscode/copilot-api` (line 12) and `copilotRuntimeVersion` (line 81), and `remote/package-lock.json` carries 50 copilot lines. `remote/` is a live packaging input (`build/npm/dirs.ts:51`; `build/gulpfile.reh.ts:322` streams `remote/package.json`; `build/gulpfile.reh.ts:357-359` copies `getProductionDependencies(REMOTE_FOLDER)` into the server package and `build/.moduleignore` no longer excludes the Copilot packages). Therefore this `git rm` alone does not remove the Copilot runtime dependency from the REH/server package graph; the still-open P2.GREEN item ("Remove `@github/copilot-sdk`/runtime versions and all exclusive root/remote/extension locks/dependency entries with measured regeneration") must land with it.

**Post-`git rm` expectation:** `npm run compile` (client + extensions), `npm run compile-extensions`, `npm run typecheck-client`, `npm run typecheck --prefix build`, `cd build && node --test lib/test/{ripgrep,copilotFreePackaging,walkerProduct}.test.ts` and `npm run test-extension` discovery all stay green; `.vscode-test.js` additionally asserts the absence of the Copilot label, dependency and SDK references, so the deletion is enforced from then on. Copilot's `@github/copilot-sdk`/platform packages, `koffi` and the shim are **not** part of any package input in the root/desktop graph any more (`package.json`/`package-lock.json`, `build/.moduleignore`, both gulpfiles, both Darwin merge files); the `remote/` manifest finding above is the remaining server-graph exception and is P2.GREEN work.

### W37 addition — Copilot API typing + dependency, and the launcher-script follow-up (2026-10-07, O1–O6 follow-up leaf)

| # | Path(s) | Ready? | Evidence |
| --- | --- | --- | --- |
| W37.l | `src/typings/copilot-api.d.ts` (188 lines) | **Yes** | It only declares the ambient `@vscode/copilot-api` module "used by the agent host until the package is fixed" — both consumers are gone (the agent host tree and `extensions/copilot`). Zero importers remain in `src/`, `build/`, `remote/`, `test/`, `extensions/` (excluding the deleted tree). |
| W37.m | `@vscode/copilot-api` (dependency, not a file) | **Done in this pass** | Removed from the root `package.json` dependency list and from `package-lock.json` (root entry + its `node_modules/@vscode/copilot-api` block, 7 generated lines). `package.json`/`package-lock.json` now contain zero `copilot` matches. The dependency dies with W37.l and W37.a; nothing else referenced it. |

**Not manifest-bound — launcher-script cleanup, EXECUTED 2026-10-07 (ratified deletion-coupling grant):** `.agents/skills/launch/scripts/launch.sh` and `launch.ps1` no longer allocate an Agent-Host port, no longer pass `--inspect-agenthost=$PORT` to the app, and no longer emit `agentHostPort` in their JSON (measured 8 and 5 changed lines). `Get-FreePorts` in the PowerShell script now allocates three ports instead of four; the Bash allocator dropped from four listeners to three. The historical inertness note is retained: `parseAgentHostDebugPort`'s argv entry is already gone, and unknown options are dropped by `parseArgs` (`for (const key in remainingArgs) { errorReporter.onUnknownOption(key); }`, default `ignoringReporter`) rather than added to `_`, so no folder-open error ever occurred.

### W38 — Agent SDK / Codex / dictation-runtime producers and their CI installers, disconnected and ready for parent `git rm` (2026-10-07, `p2.green` remote manifests + `p3.green` producers)

The executor disconnected every retained build, packaging and pipeline reference and left all files in place; the parent executes the `git rm` between passes. Readiness was checked with a reference sweep over `*.ts|js|mjs|json|yml|yaml|md|sh|ps1` (excluding `node_modules/**`, `out*/**`, `openspec/**` and the manifest files themselves) plus `npm run typecheck --prefix build` and the build test suite, which are green with every file below still on disk. Measured with `wc -l` in the current worktree, all plain text, no binaries.

| # | Path(s) | Lines | Ready? | Evidence |
| --- | --- | ---: | --- | --- |
| W38.a | `build/agent-sdk/**` (agents/claude + agents/codex manifests/locks, `common.ts`, `package.ts`, `produce.ts`, `upload.ts`, `README.md`, `test/versionSync.test.ts`) | 2,854 | **Yes** | Both former importers are gone in this pass: `build/gulpfile.vscode.ts` and `build/gulpfile.reh.ts` no longer import `readAgentSdkResults` (or stamp `agentSdks`), and `build/package.json`'s test glob no longer collects `agent-sdk`. `build/azure-pipelines/common/checkNativeOptionalDeps.ts` (W38.f) was the producers' only remaining build-module importer and goes with it. `build/agent-sdk/test/versionSync.test.ts` asserts the repo-root `devDependencies` pins for both SDKs, which no longer exist — the file is therefore exempt from the test run and must be deleted, not repaired. |
| W38.b | `build/codex/**` (`check-protocol-sync.ts`, `generate-protocol.{mjs,d.mts}`, `codex-version.txt`, `test/checkProtocolSync.test.ts`) | 514 | **Yes** | Zero retained callers: `package.json` lost `codex:gen-protocol`/`codex:check-protocol`, `.github/workflows/pr.yml` lost its "Check Codex protocol client is in sync" step, and `build/package.json`'s test glob no longer collects `codex`. The protocol tooling validated vendored output under the deleted `src/vs/platform/agentHost/node/codex/protocol/generated/**`. |
| W38.c | `build/dictation-runtime/**` (`common.ts`, `nuget.ts`, `package.ts`, `produce.ts`, `upload.ts`) | 975 | **Yes** | `readDictationRuntimeResults` import/stamping removed from `build/gulpfile.vscode.ts`; `build/azure-pipelines/common/dictation-runtime-produce.yml` (W38.d) and `build/azure-pipelines/common/foundryLocalInstall.ts` (W38.e) were the only remaining importers and both go with it. No CI step produces or uploads a dictation runtime any more. |
| W38.d | `build/azure-pipelines/common/agent-sdk-produce.yml` (102), `build/azure-pipelines/common/dictation-runtime-produce.yml` (66) | 168 | **Yes** | Both template includes plus their `.build/agent-sdk/tarballs` `pipelineArtifact` uploads are removed from `alpine/product-build-alpine.yml`, `darwin/product-build-darwin.yml` + `darwin/steps/product-build-darwin-compile.yml`, `linux/product-build-linux.yml` + `linux/steps/product-build-linux-compile.yml`, `win32/product-build-win32.yml` + `win32/steps/product-build-win32-compile.yml`. Zero `agent-sdk-produce`/`dictation-runtime-produce`/`.build/agent-sdk`/`.build/dictation-runtime` references remain outside this pair. |
| W38.e | `build/azure-pipelines/common/foundry-local.yml` (27), `foundryLocalInstall.ts` (121), `disableFoundryLocalInstall.ts` (8) | 156 | **Yes** | The trio exists only to make the dictation-runtime tarball producible: `foundryLocalInstall.ts` imports `../../dictation-runtime/nuget.ts` (W38.c) and fetches the NuGet core libraries into `node_modules/foundry-local-sdk/foundry-local-core/<target>`. All 26 `foundry-local.yml` includes, their `VSCODE_SKIP_FOUNDRY_LOCAL_INSTALL` conditions/parameter (declared in the three compile steps, passed by the three `product-smoke-flaky-*.yml`) and the three in-pipeline `disableFoundryLocalInstall.ts` steps are removed; zero references remain outside the trio. |
| W38.f | `build/azure-pipelines/common/checkNativeOptionalDeps.ts` | 114 | **Yes** | Its `NATIVE_OPTIONAL_DEP_BASE_PACKAGES` list is exactly `@openai/codex` + `@anthropic-ai/claude-agent-sdk`, both removed from the root manifest/lock in this pass, and its only build-module consumer was `build/agent-sdk/package.ts` (W38.a). Its 13 `node build/azure-pipelines/common/checkNativeOptionalDeps.ts` call sites (5 pipeline files, 3 `product-build-*-node-modules.yml`, `web/product-build-web{,-node-modules}.yml`, `win32/sdl-scan-win32.yml`, `product-quality-checks.yml`, 3 in `.github/workflows/pr-node-modules.yml`) are all removed. |
| W38.g | `build/azure-pipelines/common/smokeTestAgentHost.ts` | 129 | **Yes** | Recorded as an open C6/P3 tail at `deletion-review.md` since the agent-host wave; the C7.disconnect leaf removed its three compile-pipeline includes, so its only remaining reference is itself (`grep -rn smokeTestAgentHost` finds the file and `.git/index`). Listed here so the same `git rm` closes it. |

**Measured coupling severed in this pass (not manifest items):** `remote/package.json` lost `@github/copilot-sdk`, `@vscode/copilot-api`, the `koffi` override, the `koffi@3.2.1` allow-scripts entry and `copilotRuntimeVersion` (7 changed lines) and `remote/package-lock.json` lost 31 package entries / 484 lines (the SDK, its eight platform packages, the nested `koffi`/`@koromix/koffi-*`/`zod` tree, `@vscode/copilot-api` and the then-orphaned `node_modules/vscode-jsonrpc`), which closes the **open finding recorded under W37**: the REH/server graph is composed from `remote/` (`build/npm/dirs.ts:51`, `build/gulpfile.reh.ts:322`/`:357-359`) and no longer resolves a Copilot runtime. Root `package-lock.json` lost 17 agent-SDK entries / 301 lines and `package.json` lost `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`, `@openai/codex`, `codex:gen-protocol` and `codex:check-protocol`.

**Retained by consumer evidence (NOT manifest items):** `@microsoft/mxc-sdk` (terminal-sandbox payload via `build/lib/mxc.ts`), `@vscode/sandbox-runtime` (`src/vs/platform/sandbox/common/terminalSandboxEngine.ts:645` resolves its `dist/cli.js`, the same retained sandbox as MXC), `foundry-local-sdk` (`src/vs/platform/localTranscription/node/localTranscriptionService.ts:545` dynamically imports it and the postinstall patch targets it). All three keep their root and `remote/` manifest entries and their lock entries.

**Documented deviation (compile-necessity):** the `dictationRuntime` member of `IProductConfiguration` (`src/vs/base/common/product.ts`) is **retained** as an inert contract instead of being deleted with the stamping. Its retained reader — `src/vs/workbench/services/localTranscription/electron-browser/localTranscriptionService.ts:88` — is outside this pass's edit surfaces, and `IProductService extends Readonly<IProductConfiguration>`. Removing the member produced exactly one error (`TS2339: Property 'dictationRuntime' does not exist on type 'IProductService'`) and no other. The member is now documented in-tree as never stamped by any build; no gulpfile reads or writes it. Closing this needs either authorization for the consumer tree (`src/vs/platform/localTranscription/**` + `src/vs/workbench/services/localTranscription/**` + their two `workbench.*.main.ts` registrations) or re-provisioning of the runtime producer.

**Post-`git rm` expectation:** `npm run compile`, `npm run compile-extensions`, `npm run typecheck-client`, `npm run typecheck --prefix build`, `npm test --prefix build` (493 tests, `{lib,next}` glob) and `cd build && node --test lib/test/{walkerProduct,ripgrep,mxc,copilotFreePackaging,agentProducerFreePackaging}.test.ts` all stay green — `build/lib/test/agentProducerFreePackaging.test.ts` is the permanent guard (it treats the W38 paths as `pendingParentDeletion` and asserts no retained build module, manifest or pipeline references them, so it keeps holding after the deletion).

### W38 addition — O1 `delete-orphaned-dictation-tree`, disconnected and ready for parent `git rm` (2026-10-07)

Parent decision O1 is recorded in `parent-authorization.md` §"Dictation disposition (2026-10-07, O1 `delete-orphaned-dictation-tree`)". Rationale accepted: the stack is unreachable (zero injectors) **and** unprovisionable (its runtime producer is W38.c); the change's compatibility rule reserves inert retention for public API only. All 10 files stay in place for the parent's `git rm`; every retained reference is already severed, and the tree typechecks/compiles green in this state.

| # | Path(s) | Lines | Ready? | Evidence |
| --- | --- | ---: | --- | --- |
| W38.h | `src/vs/platform/localTranscription/common/localTranscription.ts` (147), `node/foundryLocalModelImport.ts` (358), `node/foundryLocalRuntime.ts` (446), `node/localTranscriptionMain.ts` (19), `node/localTranscriptionService.ts` (839), `test/node/foundryLocalModelImport.test.ts` (204), `test/node/foundryLocalRuntime.test.ts` (246), `test/node/localTranscriptionService.test.ts` (41) | 2,300 | **Yes** | `ILocalTranscriptionService` had zero injectors (`grep -rn "ILocalTranscriptionService" src/` returned only this tree, its two registrations and its utility-process channel); the worker entry point `vs/platform/localTranscription/node/localTranscriptionMain` was removed from `build/next/index.ts`'s `desktopEntryPoints`; `foundryLocalRuntime.ts` was the only reader of `product.dictationRuntime` on the platform side. |
| W38.i | `src/vs/workbench/services/localTranscription/browser/localTranscriptionService.ts` (46), `electron-browser/localTranscriptionService.ts` (118) | 164 | **Yes** | Their `registerSingleton(..., InstantiationType.Delayed)` imports are removed from `src/vs/workbench/workbench.desktop.main.ts` and `src/vs/workbench/workbench.web.main.ts` (1 deleted line each). The electron-browser proxy also lost its `IProductService` dependency and the `runtimeUrlTemplate`/`runtimeVersion` payload fields (5 lines) so the tree stays compilable with the `dictationRuntime` contract gone — that edit is inside the approved O1 path set and dies with the file. |

**Coupled contract removal (same commit):** `IDictationRuntimeProductConfig` and `readonly dictationRuntime?: …` are removed from `src/vs/base/common/product.ts` (0 additions / 33 deletions vs `HEAD`, which also drops the earlier inert-contract comment and `agentSdks`/`IAgentSdkProductConfig`), the `foundry-local-sdk` dependency and its `foundry-local-sdk@1.2.3` allow-scripts entry are removed from `package.json` (7 deletions), and `package-lock.json` loses `node_modules/foundry-local-sdk` plus its only dependent-free transitive package `node_modules/adm-zip` (21 generated lines; 0 unresolved references after removal, every other retained package still resolved). Install-time support dies with them: `build/npm/postinstall.ts` loses the 46-line `VSCODE_FOUNDRY_LOCAL_NATIVE_DIR` coreInterop patch loop, and `build/gulpfile.vscode.ts` loses `getFoundryLocalExcludeFilter` (comment + function + its `filter(...)` pipe slot, 17 lines) so the desktop package no longer strips a payload for a package that is not installed any more.

**Deletion coupling found and fixed in this pass (outside O1's list, inside the standing `build/**` grant):** `build/next/index.ts`'s `desktopEntryPoints` still listed `vs/platform/localTranscription/node/localTranscriptionMain` **and** two entry points of the already-deleted agent host (`vs/platform/agentHost/node/agentHostMain`, `vs/platform/agentHost/node/diffWorkerMain`; `src/vs/platform/agentHost` is absent from the tree). All three are removed (3 deletions), which is required for `npm run build-fast` to resolve its desktop entry points at all.

**Post-`git rm` expectation:** `npm run compile-client`, `npm run typecheck-client`, `npm run typecheck --prefix build`, `npm run gulp compile-extensions`, `npm test --prefix build` (494 tests) and `./scripts/test.sh --run vs/workbench/api/test/common/accountFreeApi.test` stay green; `build/lib/test/agentProducerFreePackaging.test.ts` ("the unreachable on-device dictation stack is fully deprovisioned") is the permanent guard and needs no edit after the deletion, since it asserts on the wiring, the product contract, the manifests and the lock — not on the tree's absence from disk.
