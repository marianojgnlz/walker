# E1b — Packaged admission, no-SDK fail-closed, and ready-path evidence

## Scope and pinned inputs

This record closes the assigned Linux x64 E1 probe slice. It does not extend platform claims beyond Linux x64.

- Walker package: 1.140.0, Linux x64.
- Open VSX client: `muhammad-sammy.csharp` **2.145.21-g154a82fd27**, Linux x64; VSIX SHA-256 `78bc006683cc998e9fd1a6f2760d8cb3da63096464a217bbd192ecfb490a5516`.
- Declared runtime dependency: `ms-dotnettools.vscode-dotnet-runtime` **3.2.0**; VSIX SHA-256 `a4cff5409f66e3827ee2c6a727ae59382290a182a653ca0f9ac97c63536ee541`.
- Audited Roslyn server: `5.9.0-1.26318.9`; stable SDK/runtime used by the ready profile: SDK `10.0.401`, `Microsoft.NETCore.App` `10.0.12`.
- Source of the package digests and compatibility audit: [`../ext-package/EVIDENCE.md`](../ext-package/EVIDENCE.md), [`../ext-package/A1-source-digests.md`](../ext-package/A1-source-digests.md).

All probes used disposable profiles and fixtures under `/tmp/walker-csharp-e2.sdd-apply-20261008/`. No user profile or workspace settings were used as the probe target.

## Default signature check versus explicit acquisition

The durable CLI record [`out-build/v-evidence/07-openvsx-install-csharp.log`](../../../../../out-build/v-evidence/07-openvsx-install-csharp.log) records the default install attempt refusing both pinned extensions with **“Signature verification was not executed.”** This is the actual observed failure category; it does not establish that either package had an invalid signature. The parent has accepted this CLI record as the default signature-verification failure evidence.

The separate explicit verification-disabled acquisition in [`out-build/v-evidence/08-openvsx-install-csharp-noverify.log`](../../../../../out-build/v-evidence/08-openvsx-install-csharp-noverify.log) records successful installation of runtime `3.2.0` and C# `2.145.21-g154a82fd27`. The E1a scratch profile separately records the explicitly selected profile workaround `extensions.verifySignature=false`; it was confined to that disposable profile. Walker did not change the user's signature setting.

A later GUI re-attempt is **not** signature evidence: its launch failed before package installation because the sandboxed Walker process could not bind its IPC socket (`EROFS` under `/run/user/1000`). That attempt is retained only as an environmental failure, not as a pass or a package verdict.

## No-SDK fail-closed probe (accepted)

`/tmp/walker-csharp-e2.sdd-apply-20261008/e1b-preflight-nosdk2.log` records the isolated no-SDK run. The probe ran as UID 1000 with empty IPv4 and IPv6 route tables. Its wrapper masked SDK locations, removed `dotnet` from `PATH`, left `DOTNET_ROOT` unset, and used scratch writable locations. After explicitly trusting the fixture, the workbench reported `.NET SDK: Setup Failed` and **“A compatible verified .NET SDK/runtime is not ready.”**

The C# Configure action did not acquire packages or write its profile settings: the recorded settings snapshots before Configure and at 5, 12, 17, 22, 27, 32, 37, 42, 47, 52 and 57 seconds are identical and contain no C# runtime mapping or C# server path. The activation excerpt lists the runtime dependency only; no C# client activation is recorded. No host-stop notification was observed in the 57-second capture (this is an output/notification observation, not an independent host-process instrumentation result). The probe exited 0 and the Walker main process exited 0.

This is the accepted **no-SDK fail-closed** result, not a claim that every denial or host-stop branch was individually exercised live. Compiled admission and policy tests below independently cover C#'s own full-check gate.

## Ready-path configuration and observed server startup

The later ready-path capture under `e1b-ready-final-profile/logs/20261008T211137/` records the exact C# and runtime packages in a trusted local fixture. Its disposable user settings contained the requester-specific `dotnetAcquisitionExtension.existingDotnetPath` mapping for the already verified local executable, `dotnetAcquisitionExtension.allowInvalidPaths=false`, the audited C# server path, standalone Roslyn selection, telemetry opt-outs, `chat.disableAIFeatures=true`, automatic restore and external source navigation disabled, and an empty crash-dump path. The runtime extension trace records a `dotnet.findPath` request for requester `muhammad-sammy.csharp`, stable runtime requirement `>=10.0.5`, and resolution through the explicit mapping; the resulting host/runtime were `x64` / `10.0.12`.

The C# log records `Activating C# standalone...`, the verified executable, child environment `DOTNET_CLI_TELEMETRY_OPTOUT=1`, `DOTNET_NOLOGO=1`, `DOTNET_ROOT=<verified-local-root>`, `DOTNET_MULTILEVEL_LOOKUP=0`, and `[Global] Language server initialized`. The C# project log records the App project load. The exact output log also records the expected fail-closed `VSWebAssemblyBridge installation is disabled for C# editing` denial before any bridge download.

**Do not label this UI as fully ready.** The workbench still displayed the third-party `Error acquiring .NET!` item and Walker's own truthful `C# Editing is configured and starting` state while the standalone Roslyn server initialized and handled language requests. The parent accepted those as E2 caveats, not as a defect to change in this E-track.

## Admission, persistence ordering, and regression evidence

The focused compiled Electron run recorded in `evidence/e3-regression.md` passed the admission, policy, requester-mapping, profile-configuration and configure suites. In particular, it verifies that:

- C# remains independently denied until its own full checks pass, even when the runtime dependency has its separate permit;
- missing/stale/duplicate/malformed requester mappings, unsafe settings, unsupported packages/platforms and untrusted/remote/non-file workspaces fail closed;
- the runtime mapping and `allowInvalidPaths=false` are persisted before dependency module admission;
- interrupted profile writes resume without overwriting later user edits, and rollback restores only unchanged Walker-owned values while preserving unrelated state;
- profile writes remain pending when the owner schema or exact dependency is unavailable; and
- an active shared host is stopped before an unsafe safety-configuration update is forwarded, while a denied pre-module activation does not stop an unrelated shared host.

The production/test source changes for the staged-write/schema-readiness, mapping-before-admission, and validation-revocation fixes were made before this verification-only closeout. This record does not claim a live packaged matrix for every preinstalled/updated/disabled/profile/workspace-override combination: those conditions are covered by the focused policy/admission/profile tests. No Windows/macOS or Dev Kit runtime scenario is claimed.

## Telemetry, AI, restore, and applicability

The earlier bounded E1a runtime probe remains the primary runtime-reporting evidence: during standalone startup, two-project load, completion, intentional compiler diagnostics and recovery, it observed no C#/Roslyn telemetry-originated non-local attempts. It recorded the C# client's use of `dotnet.findPath` and no calls to `dotnet.acquireStatus`, `dotnet.acquire` or `dotnet.ensureDotnetDependencies`. It also recorded CLI telemetry opt-out and the verified child environment. The contained E1a proxy blocked/logged the separately attributed VSWebAssemblyBridge request before TLS; it was not telemetry.

The ready-path runtime dependency log contains the inert third-party `LanguageModelToolsRegistrationError` / `ChatUnsupported: Chat is not supported in Walker.` output. It is an expected API-gate error, not AI activation or a C# failure. `chat.disableAIFeatures=true` and `dotnet.projects.enableAutomaticRestore=false` were present in the disposable profile; the pre-restored fixture was not built and no automatic restore was observed.

Applicability limits: API telemetry sender no-op behavior and every standalone error/crash reporter path were not independently instrumented in E1b; E1a's zero-observed telemetry attempts are bounded to its exercised triggers. Dev Kit inertness was not separately probed as a live package scenario. Unexercised package-update and platform cases remain unclaimed.

## Evidence sources

- Default signature refusal and separate explicit acquisition: `out-build/v-evidence/07-openvsx-install-csharp.log`, `08-openvsx-install-csharp-noverify.log`.
- No-SDK status, unchanged settings snapshots and containment: `/tmp/walker-csharp-e2.sdd-apply-20261008/e1b-preflight-nosdk2.log`.
- Earlier admission verification summary: `/tmp/walker-csharp-e2.sdd-apply-20261008/e1b-admission-verification.log`.
- Ready profile mapping: `/tmp/walker-csharp-e2.sdd-apply-20261008/e1b-ready-final-profile/User/settings.json`.
- Ready standalone startup: `/tmp/walker-csharp-e2.sdd-apply-20261008/e1b-ready-final-profile/logs/20261008T211137/window1/exthost/muhammad-sammy.csharp/C#.log`.
- Runtime dependency requester/runtime/API-gate trace: `/tmp/walker-csharp-e2.sdd-apply-20261008/e1b-ready-final-profile/logs/20261008T211137/window1/exthost/ms-dotnettools.vscode-dotnet-runtime/DotNetAcquisition-ms-dotnettools.vscode-dotnet-runtime-1791504699371.txt`.
- Full bounded telemetry attribution and prior UI caveat: [`E1a-runtime-probe.md`](E1a-runtime-probe.md), [`E1a-output-channel-excerpts.log`](E1a-output-channel-excerpts.log), [`E1a-digests.md`](E1a-digests.md).

## Review focus

Verify fail-closed no-SDK behavior and unchanged profile state; confirm the requester mapping and `allowInvalidPaths=false` precede runtime dependency admission; distinguish Roslyn initialization from the still-present `Error acquiring .NET!` and `configured and starting` UI; retain the explicit scope limits for API telemetry, Dev Kit, untested update/override variants, and non-Linux platforms.
