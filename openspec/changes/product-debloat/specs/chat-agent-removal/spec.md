# Chat and Agent Removal Specification

## Purpose

Remove Walker-owned chat, Copilot, Agents Window, and Agent Host implementations and their shipping/runtime dependency graph rather than keeping hidden or dormant replacements.

## Requirements

### Requirement: No chat or agent product surfaces

Walker MUST NOT register chat, language-model tooling, agent sessions, Copilot setup/entitlement, Agents Window, Open in Agents, or local Agent Host product capabilities. Their commands, views, menus, keybindings, settings, URL actions, setup links, and default-agent product wiring SHALL be removed. Persisted feature enablement or a restored window/session SHALL NOT reactivate them.

#### Scenario: Fresh and upgraded workbench
- GIVEN either a fresh profile or a profile containing old chat settings, agent sessions, and Agents Window restoration state
- WHEN Walker starts and its commands, views, settings, and window-opening actions are inspected
- THEN no chat/agent surface is available and no stored agent session starts or opens an Agents Window.

### Requirement: Removal of chat and agent source/runtime graph

The chat contribution tree, Agents Window workbench layer, local Agent Host platform/workbench services and server channel, and bundled Copilot extension SHALL be absent from the delivered source/package graph. Walker MUST NOT construct or start an Agent Host, use its agent-only IPC/transports, or ship Copilot SDK/runtime/native payloads. Feature-dependent imports, API bridges/converters, entrypoints, test fixtures, package dependencies, and packaging shims SHALL be removed with their owners. Build success MUST NOT depend on the removed Copilot ripgrep shim or package-copy fixup.

#### Scenario: Clean packaged desktop and server
- GIVEN packages built from clean outputs and the retained desktop/server entrypoints
- WHEN their files, dependencies, startup service construction, and process tree are inspected
- THEN they contain no removed chat/session/agent implementation or Copilot runtime, expose no agent-only channel, and start no Agent Host.

#### Scenario: Build without Copilot fixup
- GIVEN the Copilot extension, SDK dependency, shim implementation, and shim invocations are removed
- WHEN desktop and retained server packages are built
- THEN packaging succeeds without downloading, locating, copying, or repairing a Copilot runtime or its ripgrep payload.

### Requirement: No functional extension chat or language-model bridge

Walker SHALL remove the feature-dependent main-thread and extension-host chat, agent-session, and language-model/tool bridges. Any unavoidable public signature compatibility SHALL be minimal, documented, and inert: discovery yields no capability and attempts to create/register/use the removed capability fail deterministically as unsupported. Such compatibility MUST NOT instantiate chat services, access providers, register agents/tools, or reconstruct a shadow chat/agent framework. Ordinary extension-host activation and non-chat extension APIs SHALL remain usable.

#### Scenario: Extension requests a removed capability
- GIVEN an extension calls a retained chat/language-model compatibility signature
- WHEN it discovers capabilities or attempts participant/tool registration or model execution
- THEN it receives an empty discovery or documented unsupported result without a chat service, provider call, agent process, or feature contribution.

#### Scenario: Ordinary extension APIs
- GIVEN a non-chat extension uses commands, documents, diagnostics, terminals, or SCM APIs
- WHEN it activates in the debloated workbench
- THEN these retained APIs do not fail because a deleted chat bridge or service is missing.

### Requirement: Preserve only feature-neutral shared behavior

Only genuinely feature-neutral behavior required by protected capabilities MAY survive extraction from deleted feature-owned modules. It SHALL belong to the appropriate retained layer and have independent tests. Chat-shaped compatibility trees, inert agent startup managers, and copied agent abstractions retained solely to satisfy imports MUST NOT substitute for deletion. Ordinary Search, SCM, editing, terminals, debugging, local toolchain onboarding, and SSH development SHALL remain functional.

#### Scenario: Shared packaging helper
- GIVEN ordinary Search packaging used a helper previously located in a Copilot-owned build module
- WHEN that module is removed
- THEN the retained feature-neutral helper still packages ordinary Search resources without retaining Copilot runtime selection or shim logic.

#### Scenario: Feature integration cleanup
- GIVEN a retained notebook, terminal, editor, debug, or onboarding component imported chat-owned behavior
- WHEN chat is removed
- THEN its chat-specific integration disappears while its non-chat behavior remains usable and resolves no deleted service.
