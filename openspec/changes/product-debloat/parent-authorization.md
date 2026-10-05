# Parent Authorization (authoritative — compaction-proof)

This file is the parent-produced grant for `sdd-apply` on change `product-debloat`. If a resume or compaction loses the injected brief, THIS file is the source of truth for structured status, allowed edit surfaces, and standing authorizations. Updated by the parent only.

## SDD Structured Status (parent-derived per sdd-status-derivation.md)

```yaml
activeChange: product-debloat
artifactStore: openspec
artifacts: {proposal: done, specs: done, design: done, tasks: done, apply-progress: done, verify-report: missing, sync-report: missing}
taskAccounting: {total: 101, remaining: 76, parent: 0, errors: 0}
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

## Parent product/tech decisions log (AFK delegation, 2026-10-03/05)

- A3 sign-in follow-up: option `authorize-auth-and-profile-tests` chosen (auth-gate/setup-service/sign-in-dialog/newChatWidget/sessionTypePicker/sessionCommands + 3 tests; PLUS rerun local-profile preservation tests: userDataProfileService + snippetsResource). Approved commands: the four listed in that option plus the two profile selectors.
- `src/vs/platform/secrets/common/secrets.ts`: remove ONLY the obsolete `CROSS_APP_SHARED_SECRET_KEYS` entry for `vscode.github-authentication`/`github.auth`; stored secret data must be preserved (protected-boundary spec).
- **Chat Pet decision (ACCEPTED LOSS):** the account-panel contribution hosts `SessionsChatPetAchievementBadges` — removing the account panel removes the badge-selection UI. This is intended: Chat Pet is agent-chat gamification and the entire `sessions` tree is deleted in U06. Do NOT create a retained-UI task for it; leave achievement unlock services untouched (they die with U06). Document the loss in apply-progress.
- `compile-client` runs `clean-out` (regenerates `out/**`) — expected, not a deletion incident. Ignored generated residue under deleted extension dirs (`out/`, `dist/`, `node_modules`) is untracked build garbage; parent may clean it outside apply passes; package-absence evidence must not claim those dirs are physically empty.
