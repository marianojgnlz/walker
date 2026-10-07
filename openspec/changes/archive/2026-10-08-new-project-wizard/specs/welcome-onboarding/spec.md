# Delta for Welcome Onboarding

## MODIFIED Requirements

### Requirement: Optional accessible onboarding (Previously: Optional accessible onboarding)
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
