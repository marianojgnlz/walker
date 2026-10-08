# E1a — bounded isolated runtime probe

## Decision 6 result

**The Decision 6 runtime telemetry-suppression criterion is MET for the exercised Linux x64 paths.** The exact C# client and standalone Roslyn server activated; the two-project workspace completed project initialization; a C# completion request returned `Greeter.Hello`; and the server produced two intentional compiler diagnostics in a temporary unsaved buffer. Across the valid startup, project-load, error-diagnostic, completion, and recovery path, no C#/Roslyn telemetry-originated non-local attempt was observed. The Roslyn/client PIDs did not open network sockets in the interposer log. The non-local requests that were observed came through Walker's Chromium/network or gallery paths, plus a separate C# activation-time VSWebAssemblyBridge helper download; their per-attempt attribution is in `E1a-network-attribution.jsonl`.

Under the parent-supplied Decision 6 rule, zero observed C#/Roslyn telemetry attempts plus usable diagnostics satisfies the runtime suppression criterion and would otherwise unblock a subsequent apply slice; the current next action is **parent disposition of the separate VSWebAssemblyBridge fetch finding for A6/A7**. This is a bounded runtime verdict, not completion of task E1 or proof about unexercised paths. **No task checkbox was changed; E1 remains `[ ]`.**

## Runs and outcome scope

- **Run 1** (`logs/`, 21:23Z): initial launch opened `E1A.sln` as a document, not the fixture folder. The C# extension did not activate; the runtime dependency alone registered its command after startup. It produced two startup CONNECTs (`redirector.gvt1.com`, `open-vsx.org`) and two direct IPv6 attempts.
- **Run 2** (`logs/run2/`, 21:32Z): repeated the `.sln`-as-document pilot. Its Extension Host log confirms the C# extension itself did not activate. It produced two background CONNECTs and two direct IPv6 attempts.
- **Run 3** (`logs/run3/`, 21:35Z onward): launched the fixture folder and is the valid language-server exercise below. It produced eight CONNECTs: startup redirector, gallery control-cache poll, the VSWebAssemblyBridge attempt, and five later gallery control-cache polls; it also produced five direct IPv6 attempts.

Across all three runs the proxy ledger contains 12 CONNECT attempts. Each was stopped by the local proxy with `502 E1A-ISOLATED`; no TLS tunnel or non-local packet was delivered. Nine direct IPv6 attempts to `[2001:4860:4860::8888]:443` failed with `ENETUNREACH`; the exact Chromium feature is unconfirmed, and none is attributable to C#/Roslyn. Proxy CONNECT events have UTC timestamps. The interposer did not timestamp direct-connect calls; each such row explicitly records that limitation. Run 1's transport parent snapshot was not retained; its observed PIDs and the available Walker/shared-process ancestry are documented with that limitation in the ledger.

## Runtime and fixture

- Installed Walker binary: `1.140.0`, commit `c85de31f01c72456bfd326e8ffb25f7eaba04d8e`, x64. No Walker build was run.
- Exact Open VSX packages were installed in the scratch extension directory before these launches: `muhammad-sammy.csharp@2.145.21-g154a82fd27-linux-x64` and `ms-dotnettools.vscode-dotnet-runtime@3.2.0`. Their VSIX SHA-256 values are preserved in `../ext-package/EVIDENCE.md` and `../ext-package/A1-source-digests.md`.
- The C# manifest selected Roslyn `5.9.0-1.26318.9`. The configured executable was `$HOME/.local/share/dotnet/dotnet`; SDK `10.0.401`, runtime `10.0.12`.
- Scratch fixture: `E1A.sln`, `App/App.csproj` referencing `Library/Library.csproj`, and `Library/Greeter.cs`. Both `obj/project.assets.json` files existed from the pre-probe restore against an empty local feed. No app-triggered restore and no build/test command was run.
- Scratch profile settings: `extensions.verifySignature=false` (explicit probe-only workaround); `telemetry.telemetryLevel=off`; `dotnetAcquisitionExtension.enableTelemetry=false`; requester-specific `dotnetAcquisitionExtension.existingDotnetPath=[{"extensionId":"muhammad-sammy.csharp","path":"$HOME/.local/share/dotnet/dotnet"}]`; `dotnet.server.useOmnisharp=false`; child environment `DOTNET_CLI_TELEMETRY_OPTOUT=1`, `DOTNET_NOLOGO=1`, `DOTNET_ROOT=$HOME/.local/share/dotnet`, `DOTNET_MULTILEVEL_LOOKUP=0`; `chat.disableAIFeatures=true`; `dotnet.projects.enableAutomaticRestore=false`; `dotnet.navigation.navigateToSourceLinkAndEmbeddedSources=false`. `dotnetAcquisitionExtension.allowInvalidPaths` was not overridden; the 3.2.0 resolver reads an absent value as `false` (`workerContext.allowInvalidPathSetting ?? false`, verified in its source map). No Dev Kit extension was installed in the scratch extension directory.
- Walker and descendants ran in an unprivileged network namespace with loopback only and empty IPv4/IPv6 route tables. HTTP(S) proxy variables and Chromium's `--proxy-server` pointed only to a scratch proxy bound on `127.0.0.1`; it logged CONNECT destinations and immediately returned `502 E1A-ISOLATED` without forwarding. This preserved containment for proxied and direct attempts. Route/address records and redacted raw logs are listed in `E1a-digests.md`.

## Attribution summary

- `open-vsx.org:443` requests came from Walker's background `ExtensionManagementService` control-cache poll through the Shared Process. App logs identify the request as `GET /vscode/gallery/control`. These are gallery-control metadata checks—not package downloads or C# telemetry—and were blocked by the local proxy.
- `redirector.gvt1.com:443` requests occurred during Chromium/Electron startup before C# activation. They are Walker/browser startup traffic; because the proxy only logged CONNECT and returned 502, the exact TLS path and component/variation purpose remain unconfirmed.
- `vsdebugger.blob.core.windows.net:443` was the one C#-activation-correlated CONNECT. The initiating C# extension-host PID requested the manifest-declared `VSWebAssemblyBridge` ZIP before Roslyn startup. It is an automatic debugger-helper dependency fetch, not telemetry and not a `vsdbg` executable download. The proxy blocked it before TLS; no payload or non-local packet was delivered.
- Run 1's NetworkService parent was not retained in a process-tree snapshot. The network PID and the Shared Process/main-process initiator are preserved in the raw/Walker logs; run 2 and run 3 process trees confirm the same Chromium NetworkService→Walker-main transport pattern. Per-event confidence and that caveat are recorded in the JSONL ledger.

## Mapping and standalone process evidence

The extension-host trace records execution of `dotnet.findPath` and no execution of `dotnet.acquireStatus`, `dotnet.acquire`, or `dotnet.ensureDotnetDependencies`. The C# output channel recorded `Locating .NET runtime version 10.0.5`, `Dotnet path: $HOME/.local/share/dotnet/dotnet`, and `Activating C# standalone...`. The Roslyn server was PID `1595971`, parent extension-host PID `1595907`; its command ran from the audited package's `.roslyn/Microsoft.CodeAnalysis.LanguageServer` and contained no Dev Kit/session arguments. Its effective environment included CLI opt-out, no-logo, the canonical DOTNET root, multilevel lookup off, and only the loopback HTTP(S) proxy.

The C# output channel reports runtime `10.0.12`. During solution initialization its BuildHost registered MSBuild `10.0.401`, loaded both `App.csproj` and `Library.csproj`, and emitted `workspace/projectInitializationComplete`. No `--telemetry`, `--telemetryLevel`, Dev Kit dependency path, or session argument was present. No telemetry endpoint appeared in either proxy log, the app-tree socket log, or the bounded C#/Roslyn output excerpts. This establishes observed network behavior for the exercised triggers; it does not claim that every server exception/reporting path or future package path was exercised.

## Completion, error diagnostics, and recovery

`App/Program.cs` was opened in the `App` project. The C# server first returned zero diagnostics for the saved file. In an **unsaved editor buffer only**, the source was briefly changed to use `Greeter.He` and omit a semicolon. The Problems panel showed:

- `CS1061`: `Greeter` has no definition for `He`;
- `CS1002`: `; expected`.

With the caret after `He`, Ctrl+Space showed `Hello` and `GetHashCode`; the selected item detail was `string Greeter.Hello()`. The LSP trace records a `textDocument/completion` response (request 545, 12 ms) and a `completionItem/resolve` response (request 549, 58 ms). The original saved file was restored using **File: Revert File**; the final UI reported no problems, and on-disk `Program.cs` retained its original content. No fixture project file was changed for this trigger.

This exercised ordinary compiler-error diagnostics, not a server crash or an injected exception in `ProjectLoadTelemetryReporter`. No crash dump path was configured. Hover, navigation, rename, and a long-running session were not exercised.

## Separate non-telemetry automatic fetch constraint for A6/A7

At C# extension activation, before Roslyn startup, the C# output channel recorded `Installing C# dependencies...`, `Downloading package 'VSWebAssemblyBridge (Platform Agnostic)'`, and a failed request to `https://vsdebugger.blob.core.windows.net/vswebassemblybridge-9-0-705702/vswebassemblybridge.zip` (local proxy 502). The package's activation code unconditionally includes `VSWebAssemblyBridge` in its runtime-dependency installer. `csharp.wasm.debug.useVSDbg` defaults to true and gates later Blazor WebAssembly debugger use, but it does not gate this activation-time installer; no supported setting to suppress the installer was found.

The failed attempt was functionally benign for the exercised editing path: despite denial, Roslyn started, loaded both projects, returned completion, and surfaced diagnostics. This does not establish Blazor debugger functionality. The attempt remains an automatic non-local fetch under the proposal's no-implicit-download constraint, pending parent design disposition for A6/A7. No code or workaround was implemented against it. This is separate from the Decision 6 telemetry verdict.

## Status/UI caveat and applicability

The UI continued to show a separate `Error acquiring .NET!` status item while C# output confirmed the mapped path, standalone activation, Roslyn PID/runtime, loaded projects, completion, and diagnostics. The status item's origin was not attributable from the captured logs; it is not evidence that the C# `dotnet.findPath` lookup fell back or that Roslyn failed. The UI also displayed a generic missing build/debug assets warning even though pre-restored assets existed and the server loaded the projects. No build was run to investigate that warning.

The exercised payload is **Linux x64 only**. Windows/macOS, Razor/Blazor editing or debugging, long sessions, hover, navigation, rename, crash/error-reporter internals, and paths outside the exercised startup/project-load/diagnostic/completion sequence were not tested. No broader platform or complete E1 acceptance claim is made.
