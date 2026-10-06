# Parent Authorization (authoritative — compaction-proof)

This file is the parent-produced grant for `sdd-apply` on change `product-debloat`. If a resume or compaction loses the injected brief, THIS file is the source of truth for structured status, allowed edit surfaces, and standing authorizations. Updated by the parent only.

## SDD Structured Status (parent-derived per sdd-status-derivation.md)

```yaml
activeChange: product-debloat
artifactStore: openspec
artifacts: {proposal: done, specs: done, design: done, tasks: done, apply-progress: done, verify-report: missing, sync-report: missing}
taskAccounting: {total: 101, remaining: 62, checked: 39, parent: 0, errors: 0}
gates: {coreArtifactsReady: true, taskArtifactBlocked: false, applyState: ready, verifyState: ready, syncState: blocked, archiveReady: false}
dependencies: {apply: ready, verify: ready, sync: blocked}
blockedReasons: []
statusProvenance: parent disk scan of tasks.md checkboxes + sdd-status-derivation.md
nextRecommended: sdd-apply
actionContext: {mode: apply, workspace: /home/marialez/Work/walker, branch: product-debloat, allowedEditRoots: see surfaces below}
reviewWorkloadGate: RESOLVED — feature-branch-chain split, 400 lines/leaf, size:exception declined.
```

## Physical deletion protocol

The executor's safety rules prohibit unlink/rm. The executor performs disconnection + tests + records an exact "Pending physical deletion (parent)" manifest in `apply-progress.md`; the parent executes `git rm` between passes and reports evidence; physical-removal checkboxes are checked only after the parent's deletion is observed. Completed: provider trees + account-policy-gate files deleted in `dd1a928fd15` (139 files, −16,274 lines) with parent-verified `compile-client` PASS, `compile-extensions` PASS, `./scripts/test-integration.sh --suite 'git,git-base'` exit 0.

## Allowed edit surfaces (complete; every listed entry is approved)

openspec/changes/product-debloat/compatibility.md
openspec/changes/product-debloat/removal-inventory.md
openspec/changes/product-debloat/telemetry-inventory.md
openspec/changes/product-debloat/apply-progress.md
openspec/changes/product-debloat/tasks.md
openspec/changes/product-debloat/parent-authorization.md
product.json
package.json
package-lock.json
scripts/test-integration.sh
scripts/test-integration.bat
.vscode/launch.json
.github/skills/integration-tests/SKILL.md
.github/CODENOTIFY
.eslint-allowed-javascript-files
.eslint-allowed-bracket-notation-files
build/npm/dirs.ts
build/gulpfile.extensions.ts
build/lib/extensions.ts
build/lib/inlineMeta.ts
build/lib/test/inlineMeta.test.ts
build/lib/walkerProduct.ts
build/lib/test/walkerProduct.test.ts
build/lib/test/inlineMeta.test.ts
build/darwin/verify-macho.ts
build/darwin/create-universal-app.ts
build/distro/walker/**
build/gulpfile.vscode.ts
build/gulpfile.reh.ts
build/next/index.ts
build/vite/workbench-vite.html
build/rspack/workbench-rspack.html
build/azure-pipelines/common/product-smoke-flaky-build.yml
build/azure-pipelines/win32/steps/product-build-win32-test.yml
build/azure-pipelines/darwin/steps/product-build-darwin-test.yml
build/azure-pipelines/linux/steps/product-build-linux-test.yml
build/azure-pipelines/config/CredScanSuppressions.json
.github/workflows/pr-win32-test.yml
.github/workflows/pr-linux-test.yml
.github/workflows/pr-darwin-test.yml
.github/codeql/codeql-config.yml
.vscode-test.js
eslint.config.js
src/vs/base/common/product.ts
src/vs/platform/product/common/productService.ts
src/vs/platform/extensionManagement/common/extensionGalleryManifestService.ts
src/vs/platform/extensionManagement/common/extensionGalleryService.ts
src/vs/platform/extensionManagement/test/**
src/vs/platform/defaultAccount/common/defaultAccount.ts
src/vs/platform/secrets/common/secrets.ts
src/vs/platform/userDataProfile/test/common/userDataProfileService.test.ts
src/vs/workbench/services/userDataProfile/test/browser/snippetsResource.test.ts
src/vs/workbench/api/common/extHost.api.impl.ts
src/vs/workbench/api/common/extHostAuthentication.ts
src/vs/workbench/api/common/extHost.protocol.ts
src/vs/workbench/api/browser/mainThreadProgress.ts
src/vs/workbench/api/browser/mainThreadMessageService.ts
src/vs/workbench/api/test/**
src/vs/workbench/browser/parts/globalCompositeBar.ts
src/vs/workbench/browser/parts/titlebar/titlebarPart.ts
src/vs/workbench/browser/parts/titlebar/titlebarActions.ts
src/vs/workbench/browser/actions/developerActions.ts
src/vs/workbench/browser/web.main.ts
src/vs/workbench/browser/workbench.contribution.ts
src/vs/workbench/electron-browser/desktop.main.ts
src/vs/workbench/workbench.common.main.ts
src/vs/workbench/workbench.desktop.main.ts
src/vs/workbench/contrib/authentication/browser/authentication.contribution.ts
src/vs/workbench/contrib/authentication/browser/actions/manageAccountPreferencesForExtensionAction.ts
src/vs/workbench/contrib/authentication/browser/actions/manageAccountPreferencesForMcpServerAction.ts
src/vs/workbench/contrib/authentication/browser/actions/manageAccountsAction.ts
src/vs/workbench/contrib/authentication/browser/actions/manageDynamicAuthenticationProvidersAction.ts
src/vs/workbench/contrib/authentication/browser/actions/manageTrustedExtensionsForAccountAction.ts
src/vs/workbench/contrib/authentication/browser/actions/manageTrustedMcpServersForAccountAction.ts
src/vs/workbench/contrib/authentication/browser/actions/signOutOfAccountAction.ts
src/vs/workbench/contrib/chat/common/actions/chatContextKeys.ts
src/vs/workbench/contrib/editSessions/browser/editSessions.contribution.ts
src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts
src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts
src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts
src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts
src/vs/workbench/contrib/extensions/test/**
src/vs/workbench/contrib/github/browser/githubLinkPresentation.contribution.ts
src/vs/workbench/contrib/github/test/browser/githubLinkPresentation.test.ts
src/vs/workbench/contrib/update/browser/update.ts
src/vs/workbench/contrib/userDataSync/browser/userDataSync.ts
src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
src/vs/workbench/contrib/welcomeOnboarding/test/browser/onboardingVariationA.test.ts
src/vs/workbench/services/accounts/browser/defaultAccount.ts
src/vs/workbench/services/accounts/test/browser/defaultAccount.test.ts
src/vs/workbench/services/activity/common/activity.ts
src/vs/workbench/services/activity/browser/activityService.ts
src/vs/workbench/services/assignment/common/assignmentService.ts
src/vs/workbench/services/assignment/common/assignmentFilters.ts
src/vs/workbench/services/assignment/test/common/assignmentFilters.test.ts
src/vs/workbench/services/authentication/browser/authenticationExtensionsService.ts
src/vs/workbench/services/authentication/browser/authenticationMcpService.ts
src/vs/workbench/services/authentication/common/authentication.ts
src/vs/workbench/services/extensionManagement/common/extensionGalleryAccount.ts
src/vs/workbench/services/extensionManagement/electron-browser/extensionGalleryAccountService.ts
src/vs/workbench/services/extensionManagement/electron-browser/extensionGalleryManifestService.ts
src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts
src/vs/workbench/services/extensionManagement/test/**
src/vs/workbench/services/github/browser/githubService.ts
src/vs/workbench/services/github/test/browser/githubService.test.ts
src/vs/workbench/services/policies/common/accountPolicyService.ts
src/vs/workbench/services/policies/test/browser/accountPolicyService.test.ts
src/vs/sessions/sessions.common.main.ts
src/vs/sessions/sessions.desktop.main.ts
src/vs/sessions/common/sessionCommands.ts
src/vs/sessions/electron-browser/sessions.main.ts
src/vs/sessions/browser/accountTitleBarState.ts
src/vs/sessions/browser/parts/mobile/mobileTitlebarPart.ts
src/vs/sessions/contrib/accountMenu/**
src/vs/sessions/contrib/policyBlocked/browser/policyBlocked.contribution.ts
src/vs/sessions/browser/sessionsAuthGate.ts
src/vs/sessions/browser/sessionsSetUpService.ts
src/vs/sessions/browser/sessionsSignInDialog.ts
src/vs/sessions/contrib/chat/browser/newChatWidget.ts
src/vs/sessions/contrib/chat/browser/sessionTypePicker.ts
src/vs/sessions/test/browser/sessionsAuthGate.test.ts
src/vs/sessions/test/browser/sessionsSignInDialog.test.ts
src/vs/sessions/contrib/chat/test/browser/sessionWorkspacePicker.test.ts
src/vs/server/node/webClientServer.ts
src/vs/code/browser/workbench/workbench.ts
src/vs/workbench/test/common/workbenchTestServices.ts
src/vs/workbench/test/browser/workbenchTestServices.ts
src/vs/workbench/test/browser/componentFixtures/fixtureUtils.ts
src/vs/workbench/test/browser/parts/globalCompositeBar.test.ts
src/vs/workbench/test/browser/parts/titlebar/titlebarPart.test.ts
extensions/vscode-test-resolver/src/extension.browser.ts
test/smoke/src/areas/agentsWindow/remoteDevContainerFixtures.ts
out/**

Tests outside this list need exact-path requests (parent approves quickly). Any other path: escalate with candidate paths.

## Standing authorizations

- `npm run compile-client` + `out/**` writes; `export PATH="/home/marialez/.local/share/mise/installs/node/24.18.0/bin:$PATH"` for npm/node.
- Verification set: tasks.md "## Verification — U01" (per-unit sections likewise for later stages).
- Physical deletions: parent-executed (see protocol above).
- NEVER run git commits — the parent commits (per-unit cadence on branch `product-debloat`).
- Append carefully to `apply-progress.md` — write full merged content, never truncate.
- Preservation bindings (every leaf): `extensions/git` + `git-base`, OS Git credentials/SSH keys/askpass, plain remotes incl. github.com over OS credentials, local profiles/settings/repos/secrets, ordinary diagnostics, generic SSH/server/port forwarding, public workbench link presentation, unrelated consumer behavior (assignmentService, extensionEnablementService, update.ts, gettingStarted, developerActions, enterprise policy).
- Leaf protocol: 120–400 total changed lines incl. tests; RED→GREEN→TRIANGULATE→REFACTOR; pause un-splittable leaves with a concrete split obstacle.
- **Authorized validation output surfaces (verify round 1 resolution, retroactive):** in addition to `out/**`, the authorized validation commands' expected generated outputs include `.vscode/extensions/**/out/**` (selfhost extension compile output), `.build/**` (Electron runner crash artifacts e.g. `settings.dat`), `build/lib/policies/policyDto.ts` (build pretypecheck DTO copy — tracked content unchanged), `extensions/**/out/**`, `extensions/**/dist/**`, `**/*.tsbuildinfo`, `.vscode-test/**`, `~/.walker-dev/extensions/**`, and runner-managed temp/profile/log dirs under the system temp directory. Verify round 1 observed all of these as generated-only; `git status` shows no tracked changes outside the granted surfaces.

## Stage U02 — additional authorized surfaces (additive to the list above)

src/vs/platform/userDataSync/**
src/vs/workbench/contrib/userDataSync/**
src/vs/workbench/services/userDataSync/**
src/vs/platform/userDataProfile/**
src/vs/workbench/services/userDataProfile/**
src/vs/code/electron-main/app.ts
src/vs/server/node/serverServices.ts
src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts
src/vs/workbench/browser/web.api.ts
src/vs/server/node/webClientServer.ts
src/vs/server/node/serverEnvironmentService.ts
src/vs/code/browser/workbench/workbench.ts
src/vs/workbench/contrib/chat/browser/promptSyntax/newPromptFileActions.ts
src/vs/workbench/contrib/editSessions/browser/editSessions.contribution.ts
src/vs/workbench/contrib/editSessions/browser/editSessionsStorageService.ts
src/vs/workbench/contrib/editSessions/common/editSessions.ts
src/vs/workbench/contrib/editSessions/common/editSessionsStorageClient.ts
src/vs/workbench/contrib/editSessions/common/workspaceStateSync.ts
src/vs/workbench/contrib/extensions/browser/extensionRecommendationNotificationService.ts
src/vs/workbench/contrib/extensions/browser/extensionsActions.ts
src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts
src/vs/workbench/contrib/preferences/browser/settingsEditorSettingIndicators.ts
src/vs/workbench/contrib/preferences/browser/settingsLayout.ts
src/vs/workbench/contrib/preferences/browser/settingsTree.ts
src/vs/workbench/contrib/preferences/test/browser/settingsEditor2.test.ts
src/vs/workbench/contrib/preferences/test/browser/settingsEditorSettingIndicators.test.ts
src/vs/workbench/contrib/relauncher/browser/relauncher.contribution.ts
src/vs/workbench/contrib/relauncher/test/browser/relauncher.test.ts
src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedService.ts
src/vs/workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts
src/vs/workbench/contrib/extensions/electron-browser/remoteExtensionsInit.ts
src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts
src/vs/workbench/services/extensionManagement/electron-browser/extensionManagementService.ts
src/vs/workbench/services/environment/browser/environmentService.ts
src/vs/platform/environment/common/environment.ts
src/vs/platform/environment/common/environmentService.ts
src/vs/workbench/services/workspaces/common/workspaceIdentityService.ts
src/vs/workbench/workbench.desktop.main.ts
src/vs/sessions/sessions.desktop.main.ts
src/vs/sessions/sessions.web.main.ts
src/vs/workbench/contrib/extensions/browser/extensionsList.ts
src/vs/workbench/contrib/extensions/electron-browser/extensions.contribution.ts
src/vs/workbench/contrib/extensions/common/extensions.ts
src/vs/platform/environment/common/argv.ts
src/vs/platform/environment/node/argv.ts
src/vs/code/node/cliProcessMain.ts
src/vs/server/node/remoteExtensionsScanner.ts
src/vs/server/node/remoteExtensionHostAgentCli.ts
src/vs/workbench/contrib/editSessions/test/**
src/vs/workbench/api/browser/extensionHost.contribution.ts
src/vs/workbench/api/browser/mainThreadWorkspace.ts
src/vs/workbench/api/common/extHostWorkspace.ts
src/vs/workbench/api/common/extHostApiCommands.ts
src/vs/platform/extensions/common/extensionsApiProposals.ts
extensions/git/package.json
extensions/git/tsconfig.json
extensions/git/src/main.ts
src/vs/platform/windows/electron-main/windowsMainService.ts
src/vs/platform/windows/electron-main/windowImpl.ts
src/vs/workbench/services/workspaces/test/browser/workspaceEditingService.test.ts
src/vs/editor/standalone/browser/standaloneServices.ts

## Stage U05 — additional authorized surfaces (C1–C4 + A2: chat core + auth tails)

src/vs/workbench/contrib/chat/**
src/vs/workbench/contrib/authentication/**
src/vs/workbench/services/authentication/**
src/vs/workbench/api/**
src/vs/workbench/test/**
src/vscode-dts/**
src/vs/platform/extensions/common/extensionsApiProposals.ts

Scope: C1 product/chat/session registration + entrypoint disconnection (incl. remaining `defaultChatAgent`/copilot product wiring references — but `extensions/copilot` itself is U09/C7, do not delete it here); C2 chat/language-model API bridges/converters/tests + proposed-API d.ts + generated proposal registry regeneration; C3 non-chat contribution integrations/test fixtures; C4 the chat tree/services/tests/styles/assets (parent-deletion manifest); A2 workbench auth/RPC/dynamic-OAuth/MCP tails (`contrib/authentication`, `services/authentication`, `mainThreadAuthentication`, `extHostAuthentication` implementation — the inert A1 public facade stays). Protected: A1 facade semantics, Git carve-out, local profiles, generic diagnostics, U07 Agent Host prerequisites. Verification — U05: task-named selectors + `npm run compile-client` + `npm run typecheck-client` + `./scripts/test-integration.sh --suite api-workspace` (or parent-run citation if the runner's cleanup trips your safety rules) + accountFreeApi GREEN maintenance.

## Stage U03 — additional authorized surfaces (A7: account tunnels/CLI/cloud-forwarding)

src/vs/workbench/contrib/remoteTunnel/**
src/vs/platform/remoteTunnel/**
extensions/tunnel-forwarding/**
cli/**

### U03 additions (2026-10-05, `authorize-listed-paths`)

src/vs/workbench/contrib/chat/electron-browser/tunnelHost.contribution.ts
src/vs/workbench/contrib/chat/electron-browser/toggleRemoteConnectionsActionViewItem.ts
src/vs/workbench/contrib/chat/test/electron-browser/toggleRemoteConnectionsActionViewItem.test.ts
src/vs/sessions/contrib/tunnelHost/electron-browser/tunnelHost.contribution.ts
src/vs/sessions/contrib/tunnelHost/test/electron-browser/tunnelHost.contribution.test.ts
src/vs/sessions/contrib/providers/remoteAgentHost/browser/tunnelAgentHost.contribution.ts
src/vs/sessions/contrib/providers/remoteAgentHost/browser/remoteAgentHostActions.ts
src/vs/sessions/contrib/providers/remoteAgentHost/test/browser/tunnelAgentHost.contribution.test.ts
src/vs/sessions/contrib/providers/remoteAgentHost/test/browser/remoteAgentHostActions.test.ts
src/vs/workbench/contrib/chat/test/electron-browser/tunnelHost.contribution.test.ts
src/vs/sessions/contrib/providers/remoteAgentHost/test/browser/connectionDiagnosticsService.test.ts
src/vs/code/node/cli.ts
src/vs/platform/environment/test/node/argv.test.ts
build/linux/dependencies-generator.ts
build/gulpfile.vscode.win32.ts
build/win32/code.iss
build/azure-pipelines/darwin/steps/product-build-darwin-compile.yml
build/azure-pipelines/linux/steps/product-build-linux-compile.yml
build/azure-pipelines/win32/steps/product-build-win32-compile.yml
build/lib/i18n.resources.json
extensions/terminal-suggest/src/terminalSuggestMain.ts
extensions/terminal-suggest/src/completions/code-tunnel.ts
extensions/terminal-suggest/src/completions/code.ts
extensions/terminal-suggest/src/test/terminalSuggestMain.test.ts
extensions/terminal-suggest/src/completions/code-tunnel-insiders.ts
extensions/terminal-suggest/src/test/completions/code.test.ts
extensions/terminal-suggest/src/test/completions/code-insiders.test.ts

Scope: U03-only disconnection + tests; Sessions Agent Host tunnel edits recorded as U07 prerequisite work (those subtrees die in U06/U07).

Scope limits (binding): remove account-gated Remote Tunnels, the cloud device/token/login/auth flows, and the GitHub-OAuth cloud-forwarding (`forward-internal`) paths. NEVER touch generic platform tunnel/Ports/SSH/server-connection security or non-account port forwarding. Rust CLI: remove account/device/token/login/cloud-tunnel commands with Cargo regression tests (seam c — split by function/module); `agent_*` CLI commands are U07-owned — disconnect them here only as a documented U07 prerequisite leaf if their dependencies require it, and record that. `extensions/tunnel-forwarding`: its account/cloud provider goes; if the extension becomes single-purpose cloud forwarding it goes to the parent-deletion manifest — generic forwarding survives elsewhere. Verification — U03: `./scripts/test.sh --run vs/platform/tunnel/test/common/tunnel.test`, `./scripts/test.sh --run vs/platform/tunnel/test/node/tunnelProxy.test`, owning remote/server boundary files, `cargo check --manifest-path cli/Cargo.toml`, `cargo test --manifest-path cli/Cargo.toml <focused-filter>`, affected retained extension build, `npm run typecheck-client`. Parent follow-up item: `extensions/git/tsconfig.json` retains a dead exclude for the deleted `editSessionIdentityProvider.ts` — clean it in a U03 leaf.
src/vs/platform/extensionManagement/common/extensionManagement.ts
src/vs/platform/extensionManagement/node/extensionManagementService.ts
src/vs/platform/extensionManagement/common/unsupportedExtensionsMigration.ts
src/vs/workbench/services/extensionManagement/common/webExtensionManagementService.ts
src/vs/workbench/api/browser/mainThreadCLICommands.ts
src/vs/workbench/services/localization/electron-browser/localeService.ts
src/vs/workbench/contrib/themes/browser/themes.contribution.ts
src/vs/workbench/contrib/remote/browser/remoteIndicator.ts
src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupController.ts
extensions/copilot/test/scenarios/test-tools/workspace/chatSetup.ts
extensions/copilot/src/platform/parser/test/node/fixtures/chatSetup.ts

`isMachineScoped` removal (2026-10-05, `approve-all` P01–P11): executor audit confirmed `InstallOptions.isMachineScoped` is Sync-exclusion-only (sole live reader = `IgnoredExtensionsManagementService.getIgnoredExtensions()`; no install-location branch) — the parent's binding machine-scope disposition therefore mandates removal. Scope: remove only the `isMachineScoped` option/metadata wiring in these paths; preserve all unrelated extension install/profile behavior. The 7 already-granted paths get the same narrow cleanup.

A6-scan additions (2026-10-05, option 1 approved): paths above are A6-only disconnection/removal (Git edits limited to proposal entries; preserve ordinary Git/workspace behavior). **Manifest-only (parent physical deletion, do not edit beyond disconnection refs):** `src/vs/platform/workspace/common/editSessions.ts`, `src/vs/workbench/services/workspaces/common/editSessionIdentityService.ts`, `src/vs/workbench/api/browser/mainThreadEditSessionIdentityParticipant.ts`, `src/vscode-dts/vscode.proposed.editSessionIdentityProvider.d.ts`, `extensions/git/src/editSessionIdentityProvider.ts`.

## Inserted stage — U02.A6-PREP (parent decision 2026-10-05)

Route chosen: `authorize-a6-prep`. U02 revealed that cloud Edit Sessions imports Sync storage/client/machine/synchronizer APIs, so the platform-Sync deletion manifest cannot be produced until its A6 consumers are gone. Execute the A6 family tasks from tasks.md (A6.RED → GREEN, A6.TRIANGULATE → REFACTOR: cloud command/extension-point/destination activation + direct links removed; cloud service/storage/backend source + obsolete-test blocks deleted; exclusive proposals/manifests/package tails removed) as a bounded inserted stage INSIDE the current apply slice. Retain local workspace restoration (protected boundary). The physical-deletion protocol applies (you disconnect + record the manifest; parent runs `git rm`). U02's completed leaves stand; its platform-Sync deletion manifest waits until A6 is done. Additional A6 callers found by scan → exact-path requests as usual.

Env/CLI tail authorization (Sync tails only): the five paths above — `--do-not-sync` flag + argv wiring, `userDataSyncHome`/`sync` environment members — may be removed. MACHINE-SCOPE DISPOSITION (binding): `--do-not-sync` maps to `InstallOptions.isMachineScoped`; remove the Sync-named flag, but FIRST verify `isMachineScoped` semantics — if it is sync-exclusion-only, remove it too; if it controls install location/behavior independent of Sync, KEEP that behavior (optionally rename), do not change machine-scoped install behavior without evidence. Also fix the trailing blank line at `remoteExtensionsInit.ts:107`.

(P01–P25 approved 2026-10-05 under AFK delegation, `approve-all`, with the binding scope limit: **Sync-specific edits only** in those files — remove live Sync service/config/UI/bootstrap consumers and the Sync-owned `IWorkspaceStateFolder` type usage; unrelated behavior stays.)

## Stage U02 scope notes (A5 — sync/local-profile seams)

- Delete the Sync cloud trees (`platform/userDataSync`, `contrib/userDataSync`, `services/userDataSync`) in dependency-order leaves WITH obsolete-test removal per leaf; extract ONLY independently local helpers (profile storage/settings/import/export, ignored-extension policy) into the existing profile/extension-management layers with parity tests.
- Remove Sync initialization/registrations from desktop/web/shared/main startup (app.ts, serverServices.ts, workbench entrypoints). Remove Sync logs/account/service/CLI/config tails.
- Protection: local profiles/settings/create/switch/import/export must keep working; reopening copied legacy Sync state must be inert (no upload/download/refresh/provider sign-out); no deletion of local data or secrets. Verification — U02: `./scripts/test.sh --run <owning-profile-or-sync-boundary-file>`, `npm run typecheck-client` for moved helpers/DI, extension-management profile tests, plus compare protected sentinels on reopened Sync state.
- Physical deletion protocol unchanged (executor records manifest; parent runs `git rm`). Deletion-review batches must be documented like `deletion-review.md` for any new physical removal.

## SDD Structured Status (U02 stage — parent-derived)

```yaml
activeChange: product-debloat
artifactStore: openspec
artifacts: {proposal: done, specs: done, design: done, tasks: done, apply-progress: done, verify-report: done (round 1, U00+U01 PASS), sync-report: missing}
taskAccounting: {total: 101, remaining: 62, checked: 39, parent: 0, errors: 0}
gates: {coreArtifactsReady: true, taskArtifactBlocked: false, applyState: ready, verifyState: ready, syncState: blocked, archiveReady: false}
nextRecommended: sdd-apply
actionContext: {mode: apply — next assigned slice U03 (A7), workspace: /home/marialez/Work/walker, branch: product-debloat}
statusNote: refreshed 2026-10-05 after U02+A6-prep completion (39 checked / 62 remaining).
reviewWorkloadGate: RESOLVED — feature-branch-chain split, 400 lines/leaf, size:exception declined.
```

## Parent product/tech decisions log (AFK delegation, 2026-10-03/05)

- A3 sign-in follow-up: option `authorize-auth-and-profile-tests` chosen (auth-gate/setup-service/sign-in-dialog/newChatWidget/sessionTypePicker/sessionCommands + 3 tests; PLUS rerun local-profile preservation tests: userDataProfileService + snippetsResource). Approved commands: the four listed in that option plus the two profile selectors.
- `src/vs/platform/secrets/common/secrets.ts`: remove ONLY the obsolete `CROSS_APP_SHARED_SECRET_KEYS` entry for `vscode.github-authentication`/`github.auth`; stored secret data must be preserved (protected-boundary spec).
- **Chat Pet decision (ACCEPTED LOSS):** the account-panel contribution hosts `SessionsChatPetAchievementBadges` — removing the account panel removes the badge-selection UI. This is intended: Chat Pet is agent-chat gamification and the entire `sessions` tree is deleted in U06. Do NOT create a retained-UI task for it; leave achievement unlock services untouched (they die with U06). Document the loss in apply-progress.
- `compile-client` runs `clean-out` (regenerates `out/**`) — expected, not a deletion incident. Ignored generated residue under deleted extension dirs (`out/`, `dist/`, `node_modules`) is untracked build garbage; parent may clean it outside apply passes; package-absence evidence must not claim those dirs are physically empty.

## Stage U05 — candidate group approvals (2026-10-05, `approve-all-listed`; narrow U05 changes only; physical deletion remains parent-owned)

### approve-c1-product-sessions
src/vs/base/common/product.ts
src/vs/workbench/browser/workbench.contribution.ts
src/vs/workbench/browser/web.api.ts
src/vs/sessions/sessions.common.main.ts
src/vs/sessions/sessions.desktop.main.ts
src/vs/sessions/sessions.web.main.ts

### approve-c4-services-chat
src/vs/workbench/services/chat/**

### approve-a2-mcp
src/vs/workbench/contrib/mcp/browser/mcpCommands.ts
src/vs/workbench/contrib/mcp/browser/mcpServerActions.ts
src/vs/workbench/contrib/mcp/browser/mcpLanguageFeatures.ts
src/vs/workbench/contrib/mcp/browser/mcp.contribution.ts
src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts
src/vs/workbench/contrib/mcp/browser/mcpAddContextContribution.ts
src/vs/workbench/contrib/mcp/browser/openPanelChatAndGetWidget.ts
src/vs/workbench/contrib/mcp/browser/mcpResourceQuickAccess.ts
src/vs/workbench/contrib/mcp/common/mcpConfiguration.ts
src/vs/workbench/contrib/mcp/common/mcpTypes.ts
src/vs/workbench/contrib/mcp/common/mcpCommandIds.ts
src/vs/workbench/contrib/mcp/common/mcpLanguageModelToolContribution.ts
src/vs/workbench/contrib/mcp/test/browser/mcpCommands.test.ts
src/vs/workbench/contrib/mcp/test/browser/mcpConfigurationEntryPoints.test.ts
src/vs/workbench/contrib/mcp/test/browser/mcpWorkbenchService.test.ts
src/vs/workbench/contrib/mcp/test/common/mcpTypes.test.ts
src/vs/workbench/contrib/mcp/test/common/mcpService.test.ts
src/vs/workbench/contrib/mcp/test/common/mcpServerConnection.test.ts

### approve-c3-cross-tree (dedicated chat-feature trees = parent-deletion manifest; the rest = narrow chat-integration removal, preserve each host feature)
src/vs/workbench/contrib/inlineChat/**
src/vs/workbench/contrib/agentsVoice/**
src/vs/workbench/contrib/welcomeAgentSessions/**
src/vs/workbench/contrib/terminalContrib/chat/**
src/vs/workbench/contrib/terminalContrib/chatAgentTools/**
src/vs/workbench/contrib/accessibility/browser/accessibleView.ts
src/vs/workbench/contrib/accessibility/browser/accessibleViewActions.ts
src/vs/workbench/contrib/accessibility/browser/editorAccessibilityHelp.ts
src/vs/workbench/contrib/accessibility/browser/accessibilityConfiguration.ts
src/vs/workbench/contrib/terminalContrib/accessibility/browser/terminalAccessibilityHelp.ts
src/vs/workbench/contrib/browserView/electron-browser/features/browserEditorChatFeatures.ts
src/vs/workbench/contrib/browserView/electron-browser/features/browserWelcomeFeature.ts
src/vs/workbench/contrib/browserView/electron-browser/tools/**
src/vs/workbench/contrib/codeEditor/browser/dictation/editorDictation.ts
src/vs/workbench/contrib/codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint.ts
src/vs/workbench/contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts
src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts
src/vs/editor/contrib/codeAction/browser/codeActionController.ts
src/vs/editor/contrib/codeAction/browser/codeActionCommands.ts
src/vs/editor/contrib/hover/browser/markerHoverParticipant.ts
src/vs/editor/contrib/quickAccess/browser/gotoSymbolQuickAccess.ts
src/vs/editor/contrib/gotoSymbol/browser/goToSymbol.ts
src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts
src/vs/workbench/contrib/debug/browser/debug.contribution.ts
src/vs/workbench/contrib/debug/browser/debugCommands.ts
src/vs/workbench/contrib/debug/browser/debugEditorActions.ts
src/vs/workbench/contrib/extensions/common/installExtensionsTool.ts
src/vs/workbench/contrib/extensions/common/searchExtensionsTool.ts
src/vs/workbench/contrib/imageCarousel/browser/imageCarousel.contribution.ts
src/vs/workbench/contrib/inlineCompletions/browser/inlineCompletionLanguageStatusBarContribution.ts
src/vs/workbench/contrib/interactive/browser/interactiveEditor.ts
src/vs/workbench/contrib/interactive/browser/interactive.contribution.ts
src/vs/workbench/contrib/markers/browser/markersChatContext.ts
src/vs/workbench/contrib/notebook/browser/controller/chat/cellChatActions.ts
src/vs/workbench/contrib/notebook/browser/notebook.chat.contribution.ts
src/vs/workbench/contrib/notebook/browser/notebookChatContext.ts
src/vs/workbench/contrib/notebook/browser/controller/executeActions.ts
src/vs/workbench/contrib/notebook/browser/controller/editActions.ts
src/vs/workbench/contrib/notebook/browser/contrib/chat/notebookChatUtils.ts
src/vs/workbench/contrib/notebook/browser/contrib/cellDiagnostics/cellDiagnosticEditorContrib.ts
src/vs/workbench/contrib/notebook/browser/contrib/cellDiagnostics/cellDiagnosticsActions.ts
src/vs/workbench/contrib/notebook/browser/contrib/cellDiagnostics/diagnosticCellStatusBarContrib.ts
src/vs/workbench/contrib/notebook/browser/contrib/editorHint/emptyCellEditorHint.ts
src/vs/workbench/contrib/notebook/browser/contrib/navigation/arrow.ts
src/vs/workbench/contrib/notebook/browser/diff/notebookDiffActions.ts
src/vs/workbench/contrib/notebook/browser/diff/inlineDiff/notebookOriginalModelRefFactory.ts
src/vs/workbench/contrib/notebook/browser/diff/notebookCellDiffDecorator.ts
src/vs/workbench/contrib/notebook/browser/view/renderers/cellRenderer.ts
src/vs/workbench/contrib/notebook/test/browser/contrib/notebookCellDiagnostics.test.ts
src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts
src/vs/workbench/contrib/preferences/browser/settingsLayout.ts
src/vs/workbench/contrib/preferences/common/preferences.ts
src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts
src/vs/workbench/contrib/scm/browser/quickDiffModel.ts
src/vs/workbench/contrib/scm/browser/scm.contribution.ts
src/vs/workbench/contrib/scm/browser/scmHistoryChatContext.ts
src/vs/workbench/contrib/scm/browser/scmInput.ts
src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts
src/vs/workbench/contrib/search/browser/anythingQuickAccess.ts
src/vs/workbench/contrib/search/browser/searchChatContext.ts
src/vs/workbench/contrib/search/browser/symbolsQuickAccess.ts
src/vs/workbench/contrib/search/browser/search.contribution.ts
src/vs/workbench/contrib/search/test/browser/searchChatContext.test.ts
src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts
src/vs/workbench/contrib/tasks/electron-browser/taskService.ts
src/vs/workbench/contrib/terminal/common/terminal.ts
src/vs/workbench/contrib/terminal/browser/chatTerminalCommandMirror.ts
src/vs/workbench/contrib/terminal/browser/terminal.ts
src/vs/workbench/contrib/terminal/browser/terminalMenus.ts
src/vs/workbench/contrib/terminal/browser/terminalTabsChatEntry.ts
src/vs/workbench/contrib/terminal/browser/xterm/decorationAddon.ts
src/vs/workbench/contrib/terminal/terminal.all.ts
src/vs/workbench/contrib/terminal/terminalContribChatExports.ts
src/vs/workbench/contrib/terminal/terminalContribExports.ts
src/vs/workbench/contrib/terminal/test/browser/chatTerminalCommandMirror.test.ts
src/vs/workbench/contrib/terminal/test/browser/chatTerminalMirrorTestUtils.ts
src/vs/workbench/contrib/terminalContrib/inlineHint/browser/terminal.initialHint.contribution.ts
src/vs/workbench/contrib/terminalContrib/inlineHint/test/browser/terminalInitialHint.test.ts
src/vs/workbench/contrib/terminalContrib/voice/browser/terminalVoiceActions.ts
src/vs/workbench/contrib/terminalContrib/voice/browser/terminalVoice.ts
src/vs/workbench/contrib/terminalContrib/voice/test/browser/terminalVoice.test.ts
src/vs/workbench/contrib/testing/common/testingChatAgentTool.ts
src/vs/workbench/contrib/testing/test/common/testingChatAgentTool.test.ts
src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts
src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts
src/vs/workbench/contrib/welcomeGettingStarted/browser/startupPage.ts
src/vs/workbench/contrib/welcomeGettingStarted/common/gettingStartedContent.ts
src/vs/workbench/contrib/welcomeOnboarding/test/browser/onboardingVariationA.test.ts

### U05 addition (2026-10-05, `approve-both-listed`; narrow scope)
src/vs/platform/product/common/product.ts
Scope: remove ONLY the `defaultChatAgent` fallback product object.
src/vs/workbench/workbench.web.main.ts
Scope: remove ONLY the Chat-backed `BrowserAgentHostDebugLogsExportService` import/registration.

### U05 addition (2026-10-05, `approve-all-seven`; narrow C1 routing/product-reader cleanup)
src/vs/platform/launch/electron-main/launchMainService.ts
src/vs/platform/native/electron-main/nativeHostMainService.ts
src/vs/platform/native/common/native.ts
src/vs/platform/windows/electron-main/windows.ts
src/vs/platform/window/common/window.ts
src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts
src/vs/platform/extensionManagement/common/abstractExtensionManagementService.ts

### U05 addition (2026-10-05; narrow chat-config residue cleanup)
src/vs/workbench/browser/quickaccess.ts
src/vs/workbench/contrib/terminalContrib/inlineHint/browser/terminalInitialHintConfiguration.ts

### U05 addition (2026-10-05; narrow importer cleanup)
src/vs/workbench/contrib/notebook/browser/notebook.contribution.ts

### U05 addition (2026-10-05; narrow chat registration cleanup)
src/vs/workbench/contrib/markers/browser/markers.contribution.ts

### U05 addition (2026-10-05; C3 terminal/testing batch — option 1, all four)
src/vs/workbench/contrib/terminal/common/terminalContextKey.ts
src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts
src/vs/workbench/contrib/testing/browser/testing.contribution.ts
src/vs/workbench/contrib/telemetry/browser/telemetry.contribution.ts
Scope: remove Chat-owned export edges/registrations/setting references only (the telemetry file's Chat-only `OutputLocation` setting reference; the telemetry machinery itself remains for T5/U10).
Also accepted disposition: `ITerminalChatService` interface + its `agentHostTerminalService` usage are preserved as a documented U07 prerequisite. `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedService.ts` (already in grant) is approved for removing the legacy `agentSessionsWelcomePage` startup-editor comparison.

### U05 addition (2026-10-05; C3 residue batch)
src/vs/workbench/contrib/tasks/common/tasks.ts
Scope: remove ONLY the Chat-only `TaskRunSource.ChatAgent` value.
src/vs/workbench/contrib/preferences/browser/settingsTreeModels.ts
Scope: remove ONLY the chat-feature-filter code (AGENTS_WINDOW_SETTING_TAG consumers preserved).
src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts
Scope: stale chat-attachment comment removal only.

## Size dispositions (parent)

- U05.c.035 (ChatContext RPC pair): ACCEPTED as a single coupled-pair mechanical review batch (~460 authored lines). Rationale: the pair is bidirectionally shape-coupled; the recorded split analysis shows no safe ≤400 seam without a forbidden inert shim or a non-compiling half-leaf. This is a per-pair review-batch disposition under the deletion-review policy (like the D-batches), NOT a blanket size:exception for authored scope — the 400 cap remains the hard limit everywhere else, and future coupled pairs must pause and record their split analysis the same way.
- C4 deletion ORDERING CONSTRAINT (binding): `accountPolicyService.test.ts` imports Chat session-type helpers and the service is registered in `web.main.ts`/`desktop.main.ts` — resolve that A2/A3-owned tail BEFORE the parent deletes the Chat tree.
- Untracked in-scope files (`api/common/extHostLanguageModelAccessInformation.ts`, `test/browser/productDebloatChatIntegrations.test.ts`) are parent-staged at commit time (`git add -A -- ':!.pi'`); `.pi/` never enters commits.

### U05 dispositions (2026-10-06)
- `approve-sessionArchiveNudge-import`: `src/vs/sessions/contrib/chat/test/browser/sessionArchiveNudge.test.ts` APPROVED — repoint the single `TestChatEntitlementService` import to `workbench/contrib/chat/test/common/chatTestServices.js` and remove the common re-export shim (both shared test factories become Chat-free).
- Five paused C2 bridge pairs (`LanguageModels`, `ChatAgents2`, `ChatSessions`, `ChatDebug`, `LanguageModelTools`): each ACCEPTED as a single coupled-pair mechanical review batch (645–3,730 authored lines per the recorded split analyses) under the same disposition as U05.c.035 — deletion-heavy bridge/DTO/proxy/test retirement reviewed per-pair, NOT a blanket size:exception; the 400 cap remains the hard limit for authored feature work. Record each pair's analysis + measurement in `deletion-review.md` as its own D-style batch.

### U05 addition (2026-10-06; C4 readiness — four retained edges approved for narrow disconnection)
src/vs/workbench/contrib/editTelemetry/browser/editTelemetryContribution.ts
Scope: remove ONLY the `IChatEntitlementService` gating import/usage (retained telemetry behavior preserved; telemetry machinery removal is T/U10 scope).
(The other three edges — `src/vs/workbench/api/common/extHostApiCommands.ts`, `extHostTypes.ts`, `extHost.protocol.ts` — are within the `src/vs/workbench/api/**` grant.)

## Stage U06/U07-prerequisite — authorized surfaces (2026-10-06; C4 deletion-wave prerequisite: sever retained → sessions/agentHost edges)

src/vs/sessions/**
src/vs/platform/agentHost/**
src/vs/workbench/services/agentHost/**
src/vs/server/node/agentHostChannel.ts
src/vs/server/node/serverAgentHostManager.ts
src/vs/server/node/serverServices.ts
src/vs/code/electron-main/app.ts
src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts
src/vs/platform/windows/electron-main/windowImpl.ts
src/vs/base/common/product.ts
src/vs/workbench/browser/actions/developerActions.ts
src/vs/workbench/contrib/browserView/electron-browser/browserViewWorkbenchService.ts
src/vs/workbench/contrib/editTelemetry/browser/editTelemetry.contribution.ts
src/vs/workbench/contrib/editTelemetry/browser/telemetry/agentHostEditMarkerService.ts
src/vs/workbench/contrib/terminal/browser/agentHostOutputChannel.ts
src/vs/workbench/contrib/terminal/browser/agentHostPty.ts
src/vs/workbench/contrib/terminal/browser/agentHostTerminalService.ts
src/vs/workbench/contrib/mcp/browser/mcpToolCallUI.ts
src/vs/workbench/contrib/mcp/common/mcpEditorAffordanceState.ts
src/vs/workbench/contrib/terminalContrib/chat/**
src/vs/workbench/contrib/inlineChat/**
src/vs/workbench/contrib/agentsVoice/**

Scope: sever every retained → sessions/agentHost import (disconnect registrations/starters/channels), preserving generic server/SSH/terminal/MCP/diagnostics behavior. The sessions/agentHost TREES join the deletion wave (their U06/U07 cross-tree disconnection is this slice; Rust `cli` agent_* remaining work and any U06/U07 leftovers stay for their stages' checkboxes). Protected: `ITerminalChatService` interface usage documented earlier may now also go if its U07 consumers are being disconnected — its preservation was conditional on agentHostTerminalService surviving, which it no longer does.

### U06/U07-prerequisite addition (2026-10-06, `approve-both-agent-host-edges`)
src/vs/platform/agentPlugins/common/pluginParsers.ts
src/vs/platform/agentPlugins/common/test/pluginParsers.test.ts
src/vs/workbench/services/workspaces/common/workspaceTrust.ts
src/vs/workbench/services/workspaces/test/common/workspaceTrust.test.ts
Scope: narrow disconnection of `platform/agentHost` imports only (the `AGENT_HOST_SCHEME`/state-protocol edges); unrelated trust/plugin behavior preserved. (Exact test paths may differ from the placeholders above — the approved scope is "the pluginParsers and workspaceTrust files plus their tests as found".)

### Pre-wave grant additions (2026-10-06)
src/vs/platform/windows/electron-main/windowsMainService.ts
Scope: remove the `IWindowCreationOptions.isSessionsWindow` tail (L1568 pass + L1555/L731/L1479/L1682 derivations) — sessions window is unreachable.
68-file wave-readiness resolution: the per-file dispositions (a/b/c) recorded in `deletion-review.md` are ADOPTED as the parent's decision — disconnection leaves for retained files, wave additions for chat/agentHost-owned content, per that record. All files named in that inventory are authorized for their disposition's scope.

### Surface ratification (2026-10-06, post-hoc)
src/vs/workbench/services/environment/electron-browser/environmentService.ts
RATIFIED: the one-line `isSessionsWindow` compile-necessity reader was required by the authorized field removal — in-scope retroactively.

### Post-wave grant additions (2026-10-06; wave-completion fix pass)
src/vs/platform/defaultAccount/**
src/vs/workbench/services/accounts/**
src/vs/workbench/services/policies/common/accountPolicyService.ts
src/vs/workbench/services/policies/test/browser/multiplexPolicyService.test.ts
Scope: resolve the wave's dangling references (exact error list in the apply brief). The default-account surface (platform interface + services impl) is account-owned → delete; remove its plumbing from web.main/desktop.main/workbenchTestServices/policy services/tests (AccountPolicyService ctor may drop the account dependency — generic policy behavior preserved). cellRenderer/terminal.contribution/extensionGalleryManifestService.test dangling refs: mechanical removal of deleted-module usage, preserving generic notebook/terminal/gallery-manifest behavior.
