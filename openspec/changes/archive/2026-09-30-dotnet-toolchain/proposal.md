# Proposal: .NET Toolchain Bootstrap

## Intent and users

Walker is a free, open-source alternative to Rider. Its first .NET integration slice must let a developer establish a usable SDK without subscriptions, accounts, administrative access, or modifying the system installation. Target users are .NET developers on Linux, macOS, and Windows; Linux is the first verification target, not the only intended platform.

A `dotnet` executable does not imply an SDK exists. The confirmed local reproduction has `/usr/bin/dotnet` providing runtime 10.0.11 with no SDK, while a separate SDK 10.0.401 exists at `~/.local/share/dotnet`. Detection must distinguish these installations rather than declare readiness from executable presence or a runtime version. This environment evidence was supplied in the confirmed handoff, not re-executed during proposal work.

## Repository evidence and proposed shape

- `.github/copilot-instructions.md` defines layered core code and built-in extensions under `extensions/`. `product.json` confirms Walker and `.walker` identity.
- Prefer a new built-in Node extension, `extensions/dotnet-toolchain/`, owning local detection, installation, verification, commands, output, and status. Use a local/UI extension host so remote windows do not silently install onto a remote machine. Design must confirm activation and local-host behavior before implementation.
- `build/lib/extensions.ts` discovers `extensions/*/package.json`, filters exclusions and product-provided extensions, and packages local extension output. It supports standard `esbuild.mts` and independent `.esbuild.mts` builds; `extensions/copilot/package.json` exposes its own `compile` script. Prefer the standard small-extension convention, with an extension-local compile command where appropriate, rather than inheriting Copilot's dependencies or special packaging path. A manifest alone is not proof that packaged activation works.
- `extensions/debug-auto-launch/src/extension.ts` demonstrates `window.createStatusBarItem`, a command target, localized labels, and disposal through extension subscriptions. No core status-bar contribution is required.
- Keep core changes to the onboarding step definitions, renderer, and necessary tests/styles. `src/vs/workbench/contrib/welcomeOnboarding/common/onboardingTypes.ts` currently orders **Sign In → Personalize** (theme/keymap together), contrary to the earlier description of three steps. `browser/onboardingVariationA.ts` imports account/chat services, asserts a default chat agent, renders sign-in, and adds a sign-in footer nudge. Replace the entire onboarding authentication path, not merely its heading. Preserve personalization and completion/dismissal behavior.
- The renderer already injects `ICommandService`; extension commands can provide the thin integration boundary. Prefer a command-driven setup interaction and refreshable state over a new `src/vs/platform` service. Design may revise this only with evidence that extension activation or the required state contract cannot be hosted cleanly. Core must not import extension implementation code.
- `src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupRunner.ts` also owns a separate “Continue Without Signing In” flow. Removing onboarding sign-in does **not** remove every upstream account surface.

## Proposed behavior

### Detect and report

On local desktop activation and explicit recheck, determine: checking; SDK ready (verified version and executable location); runtime-only; missing toolchain; or detection failure. Do not collapse permission errors, timeouts, or invalid executables into “not installed.” Probe SDK availability independently from runtime availability, without depending on a workspace `global.json` or executing workspace-provided scripts.

Consider the Walker-managed location and existing local installations, including PATH and conventional user installation roots. The exact ordered candidate set and precedence belong in design and must cover the confirmed split-install reproduction. If any supported candidate is verified with an SDK, report readiness with its actual location; if the only usable candidate is runtime-only, offer installation. Do not display an SDK inventory or claim project-version compatibility.

### Install and verify

A single setup action opens an explicit **LTS / STS / Specific Version** choice. “One-click install” means one entry action followed by this required choice, not silent channel selection. Specific version requires validated user input. Show the selected channel/version and destination before starting; selection/confirmation authorizes network access and installation. Canceling the chooser makes no installation changes.

Run the official platform-appropriate `dotnet-install` script into `~/.walker/dotnet` (the equivalent under the user's home on Windows), without sudo/elevation. Do not replace system executables, uninstall runtimes, alter system PATH, or edit shell profiles. Provide progress, cancellation, and actionable failure/retry output. Serialize installs so repeated clicks or multiple windows cannot corrupt the managed directory. Preserve existing usable installations on failure and cancellation.

Successful script exit is insufficient: invoke the resulting managed executable directly, check that an SDK is present and usable, and then report Ready with its resolved version and path. Retain failures as failures, not onboarding success. No automatic update loop or installation at startup. This slice verifies the toolchain; it does not promise shell-wide PATH integration or project build readiness.

### Onboarding and status surfaces

Replace the first-run Sign In step with **Set up .NET toolchain**. Display detection state, offer setup when needed, and allow users to skip/dismiss and retry later from a command/status item. Remove onboarding provider buttons, enterprise sign-in UI, footer sign-in nudges, account-driven navigation, and the requirement for a configured default chat agent. Preserve theme/keymap personalization. Never route setup through Copilot or an authentication flow.

Expose equivalent command/status states: Checking, SDK Ready, Runtime Only—SDK Needed, Not Installed, Installing, Verifying, and Setup Failed. The status item opens relevant setup/recheck/output actions; its tooltip identifies the selected executable and verified SDK when available. Cancellation returns to a truthful detected state. Accessibility, theme compatibility, localization, and disposable ownership follow repository conventions.

Walker has a product-wide **no account/sign-in anywhere** constraint. This proposal removes first-run authentication and introduces no account dependency. It does not claim that global account removal is complete: remaining upstream account/chat surfaces need a separately tracked compliance lane, not an implicit expansion of toolchain bootstrap. Parent review must retain this product-wide requirement.

## Scope and non-goals

In scope: local desktop detection, managed install with explicit channel choice, verification, replacement onboarding step, command/output/status UX, targeted tests, and built-in packaging/activation checks. Cross-platform adapters are part of the intended shape; unavailable platform validation must be reported rather than claimed.

Explicitly out of scope: multi-SDK listing/selection UI; `global.json` resolution; workload checks; SDK update management; all C#, LSP, editor, debugger, and test-runner integration; project creation/build orchestration; remote/container SDK provisioning; browser-based installation; terminal environment management; and unrelated branding/chat feature redesign. Internal SDK enumeration solely to establish presence is not a multi-SDK product feature.

## Success criteria

1. Deterministic probe fixtures distinguish missing, runtime-only, SDK-ready, and failed detection, including PATH-runtime plus separately discoverable user-SDK and managed-SDK cases; Ready includes the verified candidate path.
2. Installer tests assert that LTS, STS, and validated specific-version choices generate their corresponding script arguments and home-scoped destination; no selection produces no install process, and no flow invokes elevation or mutates system installation/PATH.
3. Tests cover download/process/verification failure, cancellation, repeat invocation, and concurrent requests; Ready is emitted only after successful SDK verification, and an existing usable installation remains intact after failure.
4. Onboarding tests/UI checks show Set up .NET toolchain instead of sign-in, no onboarding provider or sign-in footer controls, preserved personalization/skip behavior, and correct unavailable-extension/error handling without authentication fallback.
5. State-transition tests assert matching onboarding/status output for checking, ready, runtime-only, missing, installing, verifying, failure, and cancellation/recheck.
6. A Linux packaged-app smoke check demonstrates runtime-only detection in an isolated candidate environment, user-picked managed installation, direct SDK verification, and Ready after restart. Existing system components remain unchanged. A separate split-install check recognizes the pre-existing user SDK. macOS/Windows results or explicit unverified gaps accompany delivery.

Use `openspec/config.yaml` and project guidance for focused Mocha tests (`./scripts/test.sh --run <file>` for core tests), extension-appropriate tests/compile, and `npm run typecheck-client` when core cross-cutting changes warrant it. `welcomeOnboarding/test/common/onboardingTypes.test.ts` is an existing onboarding test surface; extension tests need their own runner setup. Do not execute broad packaging merely to approve this proposal.

## Risks and design questions

- **Scope/review budget:** authentication removal spans more than step copy, while a safe installer needs several modules and tests. The 400-line review budget may be exceeded. No size exception is accepted; design/tasks must estimate and propose bounded review units or stop at an explicit risk gate. Do not weaken verification/security to fit the budget.
- **Download execution:** official script retrieval, HTTPS/redirect policy, proxy/offline support, integrity policy, input validation, and safe process spawning need concrete design. Do not execute unvalidated user/workspace shell input.
- **Discovery and locality:** candidate precedence, architecture mismatch, local/UI host availability in remote windows, timeouts, and conventional install roots need explicit contracts. This is machine readiness, not project resolution.
- **Lifecycle:** cancellation, multi-window locking, partial installs, and preserving a prior managed SDK require an installation lifecycle design. No automatic deletion of a pre-existing managed directory.
- **Account policy:** first-run removal alone cannot certify the product-wide no-sign-in rule; remaining surfaces are a parent-visible compliance risk.
- **Build validation:** independent compile/discovery must be checked in the packaged app. The reported Copilot ripgrep packaging quirk is external to this change and must not be mistaken for a toolchain failure.

No confirmed product choices require reopening. Open questions above are bounded engineering decisions for design; any broader scope or delivery-budget exception returns to the parent.

## Work-breakdown sketch

1. Specify the detection/install state machine, candidate rules, command boundary, and success/failure assertions.
2. Design a small local built-in extension, platform adapters, official-script trust/process controls, installation locking/recovery, and packaging activation.
3. Implement detection and verification with isolated fixtures, then managed installation and lifecycle tests.
4. Replace onboarding authentication with the thin setup integration; add status/output commands and UI/state tests.
5. Verify focused tests and packaged Linux flow; record cross-platform gaps and account-policy follow-up, then review scope against the 400-line gate.

This is a proposal only; specs, design, and executable tasks are deferred to the next phase.

## Rollback

Revert extension registration/build additions and the toolchain UI integration if needed. A rollback must not restore sign-in onboarding: keep an account-free skip/personalization fallback to honor Walker policy. Stop active install processes safely; do not delete existing SDKs or user data. Managed files can be removed manually only with explicit user consent and confirmed ownership. System components require no rollback because this change must leave them untouched.
