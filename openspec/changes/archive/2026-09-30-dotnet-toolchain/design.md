# Design: .NET Toolchain Bootstrap

## Status, inputs, and scope

Proposal approved; preflight supplied: execution `auto`, store `openspec`, delivery `ask-on-risk`, review budget 400 added + deleted lines, chain choice deferred, no size exception. This document is a plan, not evidence of executed tests or a packaged build. Implementation is blocked on the parent's workload decision, not on product questions.

Read inputs: proposal; both newly persisted domain specs; `openspec/config.yaml`; `.github/copilot-instructions.md`; onboarding types/renderer/contribution/tests and relevant CSS; `extensions/debug-auto-launch/{package.json,tsconfig.json,esbuild.mts,src/extension.ts}`; shared extension esbuild/tsconfig; relevant build packaging and extension-host selection code; extension API declarations. OpenSpec currently contains only this change: no canonical domain specs, competing active domain changes, or legacy flat change specs were found. Domains were inferred because the proposal has no Capabilities heading. Config has no additional spec/design/task rules. Strict TDD is not active, but implementation tasks use RED → GREEN → TRIANGULATE → REFACTOR.

Scope remains detect → install → verify → status and first-run account removal. No SDK inventory UI, global.json resolution, workload checking, updates, C#/LSP/editor/debug/test integration, shell/PATH integration, remote provisioning, or unrelated account/chat cleanup.

## D1 — Ownership, activation, and host locality

Create `extensions/dotnet-toolchain/`, a small Node built-in extension with `extensionKind: ["ui"]`, no browser entrypoint, `onStartupFinished` and explicit command activation events. Register commands synchronously before starting asynchronous detection. Support untrusted workspaces because no workspace executable/configuration is consumed; virtual workspaces do not change local machine semantics. Do not add a core platform service or import extension implementation into core.

Require BOTH `vscode.env.uiKind === UIKind.Desktop` and `context.extension.extensionKind === ExtensionKind.UI` before any filesystem probing or process execution. Check on activation and setup, not just in the manifest. `env.remoteName` is not a rejection condition: local UI extensions in desktop remote windows are supported. Describe every remote-window status/confirmation as local-machine readiness, never remote project readiness.

Evidence: `nativeExtensionService.ts` chooses LocalProcess for locally installed UI extensions; `browser/extensionService.ts` can choose Remote for a UI extension in a browser window. `extHostExtensionService.ts` derives the context's extensionKind from the actual host's `remote.isRemote`, making the runtime guard meaningful even with `remote.extensionKind` overrides. No local host → unavailable, not remote fallback.

Alternatives rejected: core service (larger layering/packaging surface); workspace extension (wrong installation machine); manifest-only UI guard (browser remote fallback); core extension imports (forbidden boundary).

## D2 — Discovery and SDK verification

### Candidate order

Resolve home with local Node `os.homedir()`, never remote workspace paths. Candidate order, deduplicated by real executable path (case-insensitive on Windows), is:

1. `<home>/.walker/dotnet/dotnet[.exe]`.
2. `dotnet[.exe]` in every absolute, non-empty local process PATH directory, preserving PATH order. Do not use a shell, `which`, Windows current-directory search, PATHEXT scripts, or workspace terminal environment collections.
3. `<home>/.dotnet`, `<home>/.local/share/dotnet` on Unix; also `<home>/AppData/Local/Microsoft/dotnet` on Windows. These explicit roots ensure the confirmed Linux split install is detected even when not on PATH.
4. Conventional system roots: Linux `/usr/share/dotnet`, `/usr/lib/dotnet`, `/usr/local/share/dotnet`; macOS `/usr/local/share/dotnet` and its `x64` subroot; Windows absolute ProgramFiles and ProgramFiles(x86) dotnet roots, with home/OS-derived defaults if variables are absent.

Treat absolute candidates under an open local workspace (including after realpath resolution) as excluded untrusted candidates, not executables to run. Ignore empty/relative PATH entries. Arbitrary DOTNET_ROOT overrides and custom paths are not discovery inputs in this slice; configured local PATH plus the stated roots define supported discovery. Log exclusions without executing them. Cap candidate count and total probe budget (64 unique candidates, 60 seconds overall); reaching a cap without readiness is detection failure, not absence. Absence (`ENOENT`/`ENOTDIR`) is normal; permission errors and bad images are diagnostics. Do not stop on a runtime-only PATH candidate. Select the first successfully SDK-verified candidate in the ordered set; retain diagnostics already encountered.

### Probe contract

`probe.ts` accepts injected filesystem/process/environment/clock adapters. Use absolute execFile/spawn with `shell: false`, hidden windows, bounded output (1 MiB per invocation), and a 10-second per-command timeout bounded by the overall budget. Run in an owned temporary directory, not workspace cwd. Strip inherited DOTNET_* and MSBUILD* overrides (especially startup hooks and SDK resolver variables); set only probe-specific root, telemetry opt-out, no-logo, and multilevel-lookup-disable values in the CHILD environment. Do not mutate host process environment or shells.

Invoke `--list-sdks` and `--list-runtimes` independently. Parse structured version/bracketed-root lines; reject malformed successful output rather than assuming absence. Host-only with empty lists is Not Installed (no usable toolchain), while a listed usable runtime with no SDK is Runtime Only. A detected SDK must also execute: run the same host with `exec <validated-sdk-root>/<version>/MSBuild.dll -nologo -version`, with no project argument. This proves the SDK's managed entrypoint can load, avoids global.json selection entirely, and performs no project build. Validate SDK paths against the candidate's resolved installation root; never execute an arbitrary path printed by a malformed fixture. For multiple internal SDK entries, try newest parsed version first, including explicitly parsed prereleases, falling back to another usable entry if necessary; expose only one verified SDK, not an inventory. Runtime-only classification requires successful runtime enumeration, not a host version string.

Aggregate: any verified SDK → Ready at its actual path; otherwise any material probe failure → Setup Failed (stage `detect`, with any known runtime context); otherwise any usable runtime → Runtime Only; else Not Installed. A wrong-architecture executable is a failed candidate, not Ready. Supported installer architecture mapping initially follows local host architecture: x64/arm64 on desktop platforms, Windows ia32→x86 and Linux arm→arm; reject unsupported combinations before download. An emulated host is reported as actually probed, not claimed to be native CPU readiness.

For install verification reuse the same probe but pin it to the managed candidate; do not fall back to another installation. Exact version must be present and execute, not merely a different existing SDK. For channel installs, capture the channel-resolved version from the pinned script's dry-run metadata and require that version at verification. Dry-run output is parsed as version data only, never evaluated or used as an arbitrary executable/URL. Failure to resolve unambiguously fails setup. Run the real script using the original chosen channel; if the channel moves between resolution and download, fail verification safely and offer retry rather than silently accepting an unrelated existing SDK.

## D3 — Explicit selection and trusted execution

`walker.dotnet.setup` accepts no path/version/URL arguments. It opens LTS / STS / Validated Specific Version; no item is auto-accepted. Stable specific versions use a bounded numeric `major.minor.patch` grammar (positive major; no whitespace except trimmed outer whitespace, prerelease suffix, wildcard, slash, option prefix, or shell metacharacter; max 32 characters). This slice does not offer preview installation. An unavailable but syntactically valid version becomes an actionable official-installer failure, never shell input. Present a final confirmation showing choice, local destination `<home>/.walker/dotnet`, and network use. Cancel at any prompt means no download, lock acquisition, or managed-directory mutation. Repeat activation while an operation/chooser is active focuses or reports that operation, not another chooser/install.

### Script origin and integrity

Use unmodified scripts from Microsoft's `dotnet/install-scripts` repository at a reviewed immutable 40-hex commit URL on `https://raw.githubusercontent.com/dotnet/install-scripts/<commit>/src/dotnet-install.sh` or `.ps1`. Store URL + SHA-256 pairs in `src/scriptSource.ts`. During implementation, obtain and independently review the actual upstream scripts and calculate the hashes; no hash/commit is fabricated here. Tests use isolated small fixtures and a test-only injected digest, never relax production verification. Pin updates are reviewed maintenance, not an automatic download/update channel.

For these immutable script URLs, redirects are rejected (zero-hop policy); require HTTPS, expected host/path, no URL userinfo, normal certificate verification, HTTP 200, a 1 MiB maximum, and a 60-second download budget. Hash bytes before writing an exclusive mode-0600 script in the operation directory; execute only that verified file. Do not pipe network content into a shell. A matching hash is integrity of a reviewed official script, not a signature or proof of SDK payload authenticity.

The pinned official script owns SDK-feed retrieval. Audit its TLS/redirect behavior and default feeds before enabling it: reject a revision that disables TLS validation or permits HTTPS-to-HTTP payload redirects. No caller-supplied feed URL, runtime-only switch, credentials, or extra script flags. Trust SDK payload transport to the reviewed official script and Microsoft's HTTPS feeds; do not claim independent archive signature verification. If the available upstream revision cannot meet those controls, stop the installer slice for a security blocker rather than patching an unreviewed script or weakening the policy.

### Proxy/offline behavior

Use Node `https` (not an unverified fetch path) through the desktop extension host's existing proxy/certificate support for script retrieval. Add tests for direct HTTPS and explicit local-user proxy configurations. Read only user/machine proxy policy using configuration inspection, never workspace-provided install settings. Pass supported local process proxy environment to the official shell script and vetted proxy options to PowerShell as required by the pinned revision; redact secrets and proxy credentials from output. Do not persist proxies or credentials, bypass certificate validation, or fall back to HTTP. Unsupported authenticated/PAC configurations receive an explicit unsupported-proxy diagnostic and retry advice, not a claim of universal proxy support. Offline setup fails promptly; cached scripts alone are not an offline SDK installer.

### Process arguments

Unix: trusted absolute bash interpreter + verified script path + `--channel LTS|STS` OR `--version <validated version>`, `--install-dir <owned stage>`, `--architecture <mapped arch>`, `--no-path`. Windows: trusted system PowerShell with `-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <verified script>` and equivalent `-Channel`/`-Version`, `-InstallDir`, `-Architecture`, `-NoPath`. ExecutionPolicy Bypass applies only to this child process after hash validation; no machine policy is modified and no elevation is requested. Resolve interpreters from fixed OS installation paths, not workspace PATH. Missing bash/PowerShell or required official-script dependencies is an actionable prerequisite error. Every call uses argument arrays with `shell: false`; include tests for spaces/non-ASCII home paths. Set child cwd, HOME/TEMP scratch paths where appropriate and sanitize startup-hook variables without editing the parent environment. Never pass `-Command`, `sh -c`, or arbitrary command strings.

Alternatives rejected: rolling unpinned download (remote code can change without review); vendoring large scripts (unnecessary distribution/review bulk); home-written SDK archive installer (duplicates official logic); writing directly into the existing managed root (cannot preserve it on failure).

## D4 — Install transaction, lock, cancellation, and recovery

Operation state flows: detected → chooser/confirmation (detected state remains) → Installing (acquire/copy/download/resolve/run) → Verifying (stage and publication) → Ready. Any ordinary error → Setup Failed with stage/retry/output. Cancellation before publication stops work and re-detects after safe process termination. Verification errors remain failures even if a previous SDK is usable; explicit recheck can acknowledge the surviving Ready state later. Generation IDs prevent late detection or old operation callbacks overwriting newer state.

### Exclusive ownership

Use an atomic `mkdir(<home>/.walker/dotnet-install.lock)` lock, shared across profiles/windows, not workspace/globalState storage. Metadata records a random owner token, PID, phase, owned operation-directory basename, and diagnostics. Check the managed parent/lock with lstat/realpath; refuse symlink/reparse-point or unexpected ownership targets. No operation follows a managed-root symlink to a system/user install. Each writer releases only its own token after children stop. In-process single flight begins at chooser creation. Cross-window lock contention reports Installing/Verifying in another local window from validated metadata and offers recheck/output; it does not start or queue a second installer.

Do not reclaim locks on elapsed time, PID absence, or heartbeat alone: a killed extension host can leave installer descendants alive, and PIDs can be reused. Missing/invalid/stale metadata is Setup Failed with recovery instructions. Startup discovery recognizes a lock/transaction before probing a potentially switching managed directory; a known live writer yields busy, an ambiguous operation yields recovery failure. Ordinary candidate discovery resumes after lock resolution. A small polling check while a busy status is visible refreshes when the lock disappears; it never writes from a non-owner.

### Staging and publication

1. After confirmation and lock acquisition create an exclusive sibling `<home>/.walker/dotnet-install-<nonce>/`, mode 0700 on Unix, inheriting the user's private directory ACL on Windows. Reserve `stage/`, `backup/`, script, and a versioned transaction journal. Reject unsafe pre-existing symlinks/reparse points in mutable paths. If managed SDKs exist, copy the managed tree into stage WITHOUT hard links (copy-on-write reflink is acceptable) so script writes cannot alter originals. Preserve file modes; refuse unresolvable/external links and explain rather than following them. Disk-full/copy failure leaves the original untouched. Sufficient free space and extra I/O are explicit trade-offs.
2. Download/hash official script, resolve selected channel if needed, execute installation into stage with no-path, then execute the stage's selected SDK. Never install directly into the existing destination.
3. Persist a journal with only operation-owned relative names and expected phase before each rename. Enter a short non-cancellable finalization section AFTER checking for pending cancellation. Rename existing managed directory to `backup/`, then stage to `<home>/.walker/dotnet`; same-volume renames only. No merge/copy-over of the live destination. Windows sharing violations stop publication and trigger restoration, not forced deletion.
4. Execute the final managed executable and selected SDK again. Until that succeeds state remains Verifying. On failure move only the just-published owned tree aside and restore backup; if restoration fails, retain lock/journal/backup and report recovery-required, never erase evidence.
5. On success mark committed, release ownership and report verified Ready. Preserve the backup containing pre-existing SDK data; do not automatically delete it in this slice. Explain the retained backup location in output and document explicit user-consented cleanup. Successful installation stage retains copied pre-existing SDKs, so no SDK is silently removed. Clean only disposable owned download/temp artifacts after process-tree completion.

On cancellation terminate the entire installer process group on Unix (TERM then bounded KILL) or process tree on Windows (system taskkill with fixed numeric PID `/T /F`, no shell), wait for closure, and only then discard owned stage/download data and release lock. Apply the same bounded termination on timeout/deactivation. If process-tree exit cannot be established, retain lock and data, report recovery-required; do not say canceled/cleaned. Child-process tests must include descendants, not just a stub resolving a Promise. Install execution has a 20-minute overall timeout; cancellation remains available during copy/download/probe phases. During short commit/rollback finalization display Finishing within Verifying and defer cancellation; never interrupt the restore halfway through.

### Recovery contract

No background auto-resume, reinstall, or destructive startup cleanup. Read-only detection reports the journal/lock condition. Diagnostics/README give a phase-specific recovery procedure: close ALL Walker windows and confirm installer descendants are stopped; retain/copy the operation directory; if backup exists and publication is incomplete, move aside the operation-owned failed publication and restore backup to the managed path; only then explicitly remove the stale lock and invoke Recheck. Never advise deleting `~/.walker/dotnet` or arbitrary matching directories. Unknown journal schema/path/ownership → preserve everything and request manual inspection. Tests inject interruption before/after each rename and show that pre-existing SDK bytes survive. Automatic crash recovery is deliberately rejected because multi-window/descendant liveness cannot be established portably without more infrastructure.

## D5 — Command boundary and state surfaces

Extension commands:
- `walker.dotnet.getState`: returns an immediate versioned snapshot; on first activation starts/coalesces detection without waiting for all probes.
- `walker.dotnet.recheck`: coalesces a fresh detection; during installation returns busy snapshot, never races publication.
- `walker.dotnet.setup`: runs the required prompts and install; returns the terminal/current snapshot after cancellation or completion. Ignores/rejects externally supplied install parameters.
- `walker.dotnet.showOutput`: reveals localized `.NET Toolchain` output.
- `walker.dotnet.showActions`: status-item entry, offers applicable Setup/Recheck/Show Output actions; Setup still opens the required choice.

Snapshot v1: `schemaVersion: 1`, monotonically increasing `revision` within activation, `state: checking|ready|runtimeOnly|missing|installing|verifying|failed|unavailable`, `locality: local`, optional verified `{ executable, sdkVersion }`, optional failure `{ stage, code }`, optional `{ phase, otherWindow }` progress. `unavailable` is host/integration availability, not a missing SDK. Reset snapshot-generation tracking after activation errors/retry. Do not serialize raw Error objects, localized HTML, secrets, or arbitrary command IDs. Display diagnostic text as plain text, never trusted markdown.

Keep a small structural contract in `welcomeOnboarding/common/dotnetToolchain.ts` and matching extension `src/contracts.ts`; no shared runtime import across core/extension. Table-driven parity fixtures/tests assert command IDs, states, required fields, and rejection of schema mismatch. This deliberate small duplication is less coupling than a new core service. A guarded client validates snapshots before rendering; invalid/unknown states show unavailable with Retry/Continue.

Status item uses `window.createStatusBarItem` and `vscode.l10n.t`, output/progress uses normal extension APIs. Register disposables immediately in `context.subscriptions`. Local status controller broadcasts state changes to status output internally; commands orchestrate work directly. No telemetry addition or persisted Ready cache. Redact proxy credentials and do not include environment dumps; use bounded process output with explicit truncation, stage/exit/timeout information, and safe retry advice.

Core renderer uses existing constructor-injected ICommandService. Add a small contribution-local client/presenter; poll `getState` at most once per second ONLY while the setup step is visible, including terminal states (so command/status actions elsewhere are reflected). One state-read request in flight, state-read timeout at 5 seconds (NOT a timeout on the long-running setup command), no accumulated timers, revision/generation guards, immediate refresh after setup/recheck, dispose on step exit/dismissal. Extension command activation can outlive a timeout, but late results cannot revive DOM or start an install by themselves. Polling reads state, not repeated filesystem probes. An explicit recheck starts a new probe. No callback command/event bridge or new platform service.

Both renderers map states to the same named labels/actions, with Ready tooltips/path details and polite accessible status announcements. Failure does not auto-advance. Continuing says Continue when ready or Continue Without Setup otherwise; users can always skip. Progress notifications and command/status remain available if onboarding is dismissed during setup; dismissal alone does not cancel a separately authorized install.

## D6 — Account-free onboarding, migration, and visual behavior

In `common/onboardingTypes.ts`, replace SignIn with DotnetToolchain (`onboarding.dotnetToolchain`), localized title/subtitle, and preserve the two-step order. Remove GHE parsing definitions after confirming they have no external consumers; replace their obsolete test suite with ordering/title and toolchain-contract tests. Do not remove unrelated AI preference code as incidental cleanup.

In `browser/onboardingVariationA.ts`, remove defaultChat assertion/config binding, account service dependency, account state, provider forms/buttons/disclaimers, enterprise input/progress, authentication telemetry, ChatSetupStrategy calls, footer nudge, enterprise navigation branches, and auth-only helpers/imports. Keep theme/keymap services, keymap extension installation, completion/dismissal emitters, focus management, and selection behavior. `chatSetupRunner.ts` remains untouched: separate compliance lane owns remaining sign-in surfaces.

Visual intent: Calm and Consistent. Use existing card/control tiers, button tokens and description/foreground ramps, not a new hero/sign-in visual system. A localized state row with icon + text, optional version/path, and Setup/Recheck/Show Output actions replaces the authentication hero; disabled/busy controls explain why. Keep keyboard focus stable across snapshots and aria-live announcements. Remove unused sign-in/provider CSS in focused cleanup slices; retain personalization/responsive/reduced-motion styles. No external assets required.

Existing onboarding completion storage remains unchanged; no forced replay for completed users and no migration of unrelated storage keys. Existing users access commands/status or reopen onboarding. No SDK data migration from system or conventional roots; detect them in place only.

Rollback: disable/remove toolchain command bridge/extension and leave account-free Continue/Personalize fallback. Never restore authentication onboarding by blindly reverting all changes. Stop owned processes before rollback, retain SDKs/backups, and remove managed files only with explicit informed user consent. Core and extension can be rolled back independently because the renderer handles unavailable commands.

## D7 — Files, tests, and packaging

Expected new extension files: `package.json`, `package.nls.json`, `tsconfig.json`, `esbuild.mts`, `.vscodeignore`, `README.md`; `src/{extension,contracts,candidates,probe,processRunner,selection,scriptSource,download,installLock,transaction,installer,status}.ts`; focused `src/test/*.test.ts` and fixture helpers. Modules may combine only when responsibility remains focused; do not pad or compress to meet the review budget. Runtime uses Node APIs and vscode, no Copilot dependency. Extension strings use vscode.l10n; manifest strings use package.nls. Core uses nls.localize.

Minimal runner: compile extension pure modules/tests with repository TypeScript/tsgo tooling and run existing root Mocha in TDD mode against emitted extension tests (`npm run test --prefix extensions/dotnet-toolchain` wraps an extension-local command using repository-installed tools). Tests requiring vscode inject a narrow facade rather than importing the runtime vscode module in plain Node. Keep tests out of the shipping bundle; include all necessary type roots and vscode.d.ts. Use normal tabs/headers/disposable ownership. No new external test framework, no default real network or real home mutation.

Core additions: `common/dotnetToolchain.ts`, optional `browser/dotnetToolchainStep.ts` for focused client/presenter, `test/common/dotnetToolchain.test.ts`, `test/browser/onboardingVariationA.test.ts`; edits limited to existing types/renderer/CSS/tests within welcomeOnboarding. Inspect constructor test stubs and references when removing account DI.

Packaging: standard `esbuild.mts` via `../esbuild-extension-common.mts`, development main `./out/extension.js`, production bundle `dist/extension.js`; `build/lib/extensions.ts` rewrites `/out/` to `/dist/` when packaging and discovers `extensions/*/package.json`. Use standard compile-extension task rather than Copilot's independent build dependency tree. Check extension-local tsconfig/type roots and any build project registration discovery before deciding extra files are necessary; root build changes are not presumed. `.vscodeignore` must ship dist/manifest/localization and exclude tests/sources/temp downloads. Pinned script metadata is bundled, scripts downloaded only after confirmation. Confirm l10n extraction/package behavior using repository extension conventions.

Verification layers:
1. Deterministic extension fixtures: ordered candidates; runtime-only + separate user SDK; managed precedence; errors/timeouts/output overflow; malicious/relative workspace paths; SDK execution independent of global.json; exact version and channel resolution; all state transitions; platform args; chooser cancellation; TLS/redirect/hash/proxy errors; single flight/lock contention; descendants; disk full; Windows rename denial; interrupted publication and recovery; byte preservation of existing SDKs.
2. Core Mocha: `./scripts/test.sh --run vs/workbench/contrib/welcomeOnboarding/test/common/onboardingTypes.test` and equivalent new contract/browser files. Refresh compiled output with smallest appropriate build when necessary. Browser suite instantiates with no defaultChatAgent and asserts absence of authentication controls/invocations plus personalization/dismissal/focus/disposal. Run `npm run typecheck-client` once for this constructor/import/contract cross-cutting change unless an existing current compile already covers it; avoid duplicate broad builds.
3. Extension compile/typecheck/unit runner, then inspect actual packaged manifest/main and run a packaged desktop with a fresh throwaway profile and isolated HOME/candidate environment. Do not introduce a production setting for arbitrary test paths; pure fixtures inject them, packaged smoke isolates process environment/OS user.
4. Linux packaged smoke: PATH host/runtime only → choose channel → managed install → direct managed executable verification → Ready → restart Ready; check system binary/SDK lists and shell profiles/PATH unchanged; separate split-install run recognizes real user SDK. Exercise canceled choice, failed download, two windows, extension unavailable, keyboard/high-contrast, and actual local/UI host in a remote desktop window when available. Capture command IDs/output/path/version and package extension presence. Use the final package's normal app startup, not only an extension development host.
5. macOS/Windows compile/argument fixtures are mandatory; native real-install/cancel/rename/locality smoke results must be reported honestly, with unsupported infrastructure recorded as unverified. Script/proxy controls need a live supported-proxy smoke before claiming proxy support. Do not label unavailable platforms verified.

No test/build/install was run during planning. Any environment blocker (including the independently reported Copilot ripgrep packaging issue) must be isolated and reported, not bypassed or mistaken for toolchain success.

## Requirement coverage

| Requirement | Design | Primary verification |
| --- | --- | --- |
| Truthful local discovery | D2 | Candidate/probe fixtures and split-install smoke |
| Explicit install authorization | D3, D5 | Selection cancellation/validation and platform args |
| Trusted home-scoped installation | D3, D4 | Script trust/proxy/process tests, system snapshot smoke |
| Serialized recoverable installation | D4 | Concurrent windows, process trees, copy/rename/crash fixtures |
| Execution-based install verification | D2, D4 | Empty-SDK exit-zero, expected version, final-path probes |
| Shared command and status state | D5 | Controller/status snapshots and core parity/disposal tests |
| Local desktop activation and packaged availability | D1, D7 | Host guards and packaged activation/locality smoke |
| Account-free toolchain first step | D6 | No-chat-agent renderer, no auth command/DOM assertions |
| Truthful toolchain interaction | D5, D6 | Schema/command failure, busy/failure, late-response tests |
| Optional accessible onboarding | D5, D6 | Skip/back/personalize, keyboard/theme, listener disposal |

## Risks and bounded engineering decisions

- Stage-copy plus backup costs up to multiple SDK-tree sizes. Fail safely on insufficient disk; do not switch to unsafe in-place installation. Retained backups are deliberate preservation, not SDK update management.
- Crash recovery is conservative/manual. Stale locks can block setup until descendants are stopped and journal paths inspected. No time-based lock stealing.
- Pinned official scripts must be fetched/audited during implementation. HTTPS and pinned script hashes do not independently authenticate SDK payload archives; trust Microsoft feeds and the reviewed script. Incompatible upstream TLS behavior is a security blocker.
- Channel resolution uses official dry-run metadata; fixtures must match the selected pinned revision, and a channel race is an explicit retry failure.
- Plain Node unit tests cannot prove packaged command activation, remote locality, proxy patching, or Windows process-tree cleanup. Native validation gaps remain visible.
- Only this onboarding account path is removed. Parent must retain the separate product-wide no-sign-in compliance lane; do not certify global compliance.
- Advisory TypeSafe cross-check over the source evidence/design summary: High total-budget risk probability 0.870; probability that per-slice estimates guarantee <=400 without measurement only 0.110; feature-boundary preservation probability 0.660 (moderate uncertainty). These are not verification or consent. The explicit requirement coverage map and exclusions govern scope; measured diffs and parent choice govern delivery.

## Review Workload Forecast

Estimated changed lines (implementation + tests + localized strings/build metadata/docs, additions PLUS deletions): **4,450–6,690**. Approximately 900–1,100 removed authentication lines alone are plausible from the 1,285-line renderer, 956-line CSS, and GHE helpers/tests. This is not a 400-line one-PR change. OpenSpec planning artifact diffs are additional and must not be hidden if included in the same review.

Delivery strategy: ask-on-risk
Review budget: 400 added + deleted lines per review unit
400-line budget risk: High
Chained PRs recommended: Yes
Chain strategy: pending
Decision needed before apply: Yes

Recommended chain once approved: **feature-branch-chain**, with individually reviewable 160–390-line units feeding a change branch; release only after the complete behavior is verified. Alternative `stacked-to-main` requires each intermediate merge to remain non-regressive and not present unfinished setup as available. Neither is selected by this planner; no size exception is accepted. Parent must choose before apply.

Suggested split (20 units; detailed start/finish/verification/rollback boundaries in tasks.md): four detection/harness units (860–1,240), eight install/state units (1,840–2,790), seven onboarding/removal/test units (1,570–2,360), one packaging/smoke unit (180–300). Each unit includes its focused tests; later integration tests add coverage rather than postponing unit tests. Where measured diff exceeds 400, subdivide at the named module/scenario boundaries and reforecast before proceeding; never omit tests or count only net additions.
