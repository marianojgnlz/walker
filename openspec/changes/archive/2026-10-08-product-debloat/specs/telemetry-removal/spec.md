# Telemetry Removal Specification

## Purpose

Remove Walker-owned telemetry and crash-reporting collection, transport, output, and dependencies in every retained process, then finish pruning all owned instrumentation rather than leaving a disabled reporting framework.

## Requirements

### Requirement: No telemetry or crash-reporting infrastructure

Desktop main/renderer, browser, shared process, server/remote, and Node/worker extension-host contexts SHALL have no active or shipped telemetry appender, telemetry IPC/remote/custom-endpoint channel, reporting server/service, telemetry-specific log appender, error-telemetry collector, or Electron crash-reporter initialization. Retained transitional telemetry service contracts SHALL resolve only to a minimal no-op implementation. Representative usage/error/custom-endpoint calls MUST produce neither telemetry network requests nor telemetry log output. Bundled extensions MUST NOT bypass this guarantee through direct reporters. Ordinary diagnostic logs and error notifications SHALL remain.

#### Scenario: Every retained process is non-reporting
- GIVEN each retained process starts with representative telemetry calls and instrumented request/logger dependencies
- WHEN usage/error/custom-endpoint calls and shutdown occur
- THEN zero telemetry network requests, telemetry log writes, and reporter flushes occur and no telemetry transport or crash reporter is initialized.

#### Scenario: Bundled extension activity
- GIVEN retained bundled extensions perform Git, language-service, markdown, merge-conflict, media-preview, and browser actions
- WHEN their ordinary workflows run
- THEN no direct telemetry reporter or reporting dependency emits data, while ordinary behavior and diagnostics remain functional.

### Requirement: Legacy enablement is powerless

Old product configuration, telemetry settings, crash-reporting arguments, persisted consent, extension-host initialization values, or remote telemetry-level changes MUST NOT enable collection, reporting, local telemetry logging, or crash reporting. Walker SHALL remove telemetry consent, settings, status, reporting commands, and telemetry-only identity/payload collection. The public telemetry enablement state SHALL always be false with usage/error/crash disabled.

#### Scenario: Old settings request full reporting
- GIVEN old settings request telemetry level all, enable telemetry/crash reporting, and permit reporting in development or extension-test mode
- WHEN Walker starts and representative telemetry APIs are invoked
- THEN reporting remains absent, public telemetry enablement remains false, and no network or telemetry log output occurs.

#### Scenario: Initialization attempts to raise telemetry level
- GIVEN an extension host or remote context receives old initialization/change values that enabled telemetry
- WHEN it handles those values
- THEN no sender, reporter, telemetry logger, or reporting channel becomes active.

### Requirement: Infrastructure cutoff followed by complete owned pruning

The change SHALL distinguish the non-reporting infrastructure-cutoff milestone from final instrumentation removal. Before completion, an owned subsystem inventory SHALL account for and retire every Walker-owned telemetry call, constructor injection, event/classification payload, telemetry-only computation/helper/test, reporting dependency, and build/package artifact. Deleting a final logging call while retaining its telemetry-only payload computation SHALL NOT count as pruning. Remaining references SHALL have a documented, tested public compatibility or genuinely non-telemetry reason; unresolved pruning groups MUST NOT be deferred beyond this change.

#### Scenario: Cutoff is not completion
- GIVEN every process is non-reporting but subsystem instrumentation remains
- WHEN change completion is assessed
- THEN the infrastructure milestone may be recorded but the change is incomplete until the inventory closes.

#### Scenario: Payload-only residue
- GIVEN an event emission was removed but its timing aggregation, classification, identifier lookup, or telemetry-only dependency remains
- WHEN the owning subsystem is reviewed
- THEN that residue is removed or receives a documented and tested non-telemetry justification before the group can close.

### Requirement: Minimal no-op extension telemetry compatibility

Intentionally retained public telemetry API signatures SHALL be minimal and documented. They SHALL always report disabled state and return disposable no-op loggers; usage/error calls, disposal, and flush SHALL invoke neither extension-supplied telemetry sender methods nor telemetry-specific output. They MUST NOT generate telemetry identifiers, build event payloads, create telemetry output channels, or retain appenders/reporting transports. This requirement concerns Walker-mediated APIs and bundled reporters, not policing arbitrary extension networking.

#### Scenario: Extension-supplied sender
- GIVEN an extension supplies valid sendEventData, sendErrorData, and flush methods with observable counters
- WHEN it creates a Walker telemetry logger, logs usage/errors, and disposes it
- THEN all sender counters and telemetry-output counters remain zero and the logger reports usage/errors disabled.

#### Scenario: Repeated no-op logger lifecycle
- GIVEN extensions repeatedly create and dispose retained telemetry loggers
- WHEN old settings or remote initialization request telemetry
- THEN no logger becomes enabled and no background reporter, payload collection, event-source subscription, or telemetry file accumulates.
