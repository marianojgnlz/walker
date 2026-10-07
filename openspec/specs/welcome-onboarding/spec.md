# Welcome Onboarding Specification

## Purpose

Replace Walker's first-run authentication path with local .NET toolchain setup while retaining personalization and optional completion. Other upstream authentication surfaces remain a separate product-wide compliance concern outside this domain's onboarding contract.

## Requirements

### Requirement: Account-free toolchain first step

The first onboarding step SHALL be Set up .NET toolchain, followed by existing theme/keymap personalization. The onboarding path MUST NOT require a default chat agent, account, entitlement, or sign-in. It SHALL remove provider buttons, enterprise instance input/progress, sign-in disclaimers, footer nudges, authentication-driven navigation, and chat setup invocation. Core SHALL interact with toolchain behavior through commands, not imports of extension implementation.

#### Scenario: Product without a default chat agent
- GIVEN Walker starts with no configured default chat agent and no signed-in account
- WHEN the first-run onboarding is rendered
- THEN Set up .NET toolchain is the first step and no authentication assertion or sign-in UI appears.

#### Scenario: No onboarding authentication routes
- GIVEN either onboarding step is visible
- WHEN its buttons, keyboard actions, and footer actions are exercised
- THEN none initiates provider authentication, enterprise setup, or Copilot setup, and none navigates based on account state.

### Requirement: Truthful toolchain interaction

The toolchain step SHALL display current local detection/setup state and relevant setup, recheck, and diagnostic actions. Setup SHALL use the explicit choice/confirmation behavior of the .NET Toolchain Specification. Success SHALL not be inferred from clicking Setup or from script completion. An unavailable, disabled, incompatible, or failing extension SHALL produce an accessible explanation and retry/skip path, never authentication fallback. Late asynchronous responses MUST NOT update a dismissed step or overwrite newer state.

#### Scenario: State parity during setup
- GIVEN onboarding is visible while setup progresses through Checking, Installing, Verifying, and a terminal result
- WHEN the extension state changes
- THEN onboarding refreshes to the equivalent state shown by the status item, and a verification failure stays a failure.

#### Scenario: Disabled extension or failed command
- GIVEN the extension is disabled, fails activation, or returns an unsupported state contract
- WHEN onboarding requests toolchain state or setup
- THEN it explains local setup is unavailable, permits retry and continuation, and does not offer sign-in.

#### Scenario: Dismissal during asynchronous work
- GIVEN detection or setup is pending
- WHEN onboarding is dismissed or the user moves to personalization before a response arrives
- THEN the late response does not recreate the step, steal focus, or change completion state; extension-owned setup remains controllable through progress/status.

### Requirement: Optional accessible onboarding

Users SHALL be able to skip setup, navigate back, dismiss onboarding, and complete personalization without an SDK. Continuing without setup SHALL not falsely mark toolchain readiness. Existing theme/keymap application and completion/dismissal behavior SHALL remain. UI strings SHALL be localized; state changes SHALL be accessible without moving focus; controls SHALL support keyboard operation and existing theme/high-contrast tokens. Repeated opening/closing MUST dispose step-owned listeners and refresh resources. The Welcome surface SHALL provide a localized project-creation action that launches the common .NET project wizard. It SHALL present recent project/workspace entries using canonical recent-workspace history and allow reopening entries through normal workspace-opening behavior; it MUST NOT maintain parallel recent storage.

#### Scenario: Skip and personalize
- GIVEN the toolchain is missing, runtime-only, failed, or unavailable
- WHEN the user continues without setup, selects theme/keymap options, and completes onboarding
- THEN personalization and normal completion occur without an installation or Ready claim.

#### Scenario: Reopen and keyboard navigation
- GIVEN onboarding has been opened and dismissed previously
- WHEN it is reopened and navigated by keyboard in a high-contrast theme
- THEN current toolchain state is refreshed, focus and skip/back actions work, localized status is announced, and no duplicate listeners or background refreshes accumulate.

#### Scenario: Launch project creation from Welcome
- GIVEN the Welcome page is visible
- WHEN the user activates the localized New C# Project / .NET Project action
- THEN the same project wizard used by other entry points opens and remains keyboard accessible.

#### Scenario: Reopen recent project
- GIVEN canonical recent-workspace history contains existing and missing project paths
- WHEN recent projects are presented on Welcome and the user selects an existing entry
- THEN Walker opens it through normal workspace behavior, preserves canonical history ordering and avoids duplicate storage; missing entries are handled gracefully.
