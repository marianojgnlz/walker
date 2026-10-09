# A1 standalone telemetry, crash, Dev Kit and AI audit

## Source-level verdict

The client-side extension reporters have a supported suppression path through Walker's permanently disabled extension telemetry API. The runtime dependency also has a contributed `dotnetAcquisitionExtension.enableTelemetry` setting (default `true`) that gates its own event reporter; Walker must set its effective value to `false`. The C# standalone client path skips Dev Kit-specific telemetry setup and omits the Dev Kit/session arguments, and its client-side AI component path is skipped when standalone or when `chat.disableAIFeatures` is true.

**Blocking unsupported conclusion:** the shipped Roslyn server artifacts document a project-load telemetry reporter and a `VSCodeRequestTelemetryLogger`, but the server implementation is opaque in the supplied package and the audited C# manifest/client expose no standalone server telemetry setting or telemetry-level launch argument. `DOTNET_CLI_TELEMETRY_OPTOUT` only covers .NET CLI telemetry. Source inspection therefore does **not** establish that the Roslyn server's project-load/error reporting is suppressed. It also does not prove that the opaque server reporter sends independently. Under the fail-closed requirement, this is not a compatibility pass: do not authorize language-server code apply until the parent resolves this finding. E1's actual startup/project-load/error capture remains required, but executing package code was not authorized in A1.

## Extension-host API and the bundled client telemetry library

The C# bundle contains `@vscode/extension-telemetry`'s `BaseTelemetryReporter`. Its constructor obtains `vscodeAPI.env.createTelemetryLogger`; it starts the network sender only when the logger reports usage or error telemetry enabled. Ordinary events/errors route through that logger. The library also contains explicit “dangerous” methods that instantiate and use the sender directly; static search of the full C# bundle found each dangerous method only at its definition and no call site.

```js
// C# dist/extension.js:10, bounded fragments around columns 78136, 78674, 79138, 79508
this.telemetryLogger=this.vscodeAPI.env.createTelemetryLogger(this.telemetrySender,n);
(this.telemetryLogger.isErrorsEnabled||this.telemetryLogger.isUsageEnabled)&&this.telemetrySender.instantiateSender();
// ordinary event/error paths:
i?this.telemetrySender.sendEventData(...):this.telemetryLogger.logUsage(...);
i?this.telemetrySender.sendEventData(...):this.telemetryLogger.logError(...);
// direct-sender methods exist in the library:
sendDangerousTelemetryEvent(...){this.telemetrySender.instantiateSender(),...}
sendDangerousTelemetryErrorEvent(...){this.telemetrySender.instantiateSender(),...}
```

Walker source provides the relevant runtime suppression: `src/vs/workbench/api/common/extHostTelemetry.ts:29–38` always returns `false` and `{isCrashEnabled:false,isErrorsEnabled:false,isUsageEnabled:false}`; `:41–42` instantiates the no-op logger; `:78–89` returns false enable states and no-op `logUsage`/`logError` methods. This applies to load/error calls made through the extension API and to the telemetry library's normal usage/error methods. It does not suppress a library call to its dangerous direct-sender API; no such C# call site was found in the audited bundle.

The client calls `sendTelemetryEvent("roslyn/clientInitialize")` on language-client initialization (C# bundle line 966; `KZe` excerpt), and event/error handlers call ordinary reporter event/error methods. These route to the disabled extension-host logger. A user-invoked `csharp.reportIssue` is a separate explicit action; it is not an automatic telemetry sender.

## Runtime dependency telemetry

`ms-dotnettools.vscode-dotnet-runtime` 3.2.0 contributes `dotnetAcquisitionExtension.enableTelemetry`, Boolean default `true` (`package.json:290–293`). Set it effectively to `false` before that dependency's activation. Its embedded `TelemetryObserver.js` constructs the extension telemetry reporter but `post()` sends only inside `TelemetryUtilities.isTelemetryEnabled(...)`, which requires both the extension setting and VS Code telemetry enabled:

```js
// extension.js.map sourcesContent[59], TelemetryObserver.js:17-30, 46-63
if (telemetryReporter === undefined) {
  const connectionString = packageJson.connectionString;
  this.telemetryReporter = new TelemetryReporter(connectionString ?? '');
}
...
post(event) {
  if (TelemetryUtilities.isTelemetryEnabled(this.isExtensionTelemetryEnabled, this.utilityContext)) {
    ... this.telemetryReporter.sendTelemetryEvent(...)
  }
}

// sourcesContent[60], TelemetryUtilities.js:59-62
static isTelemetryEnabled(isExtensionTelemetryEnabled, utilityContext) {
  const isVSCodeTelemetryEnabled = utilityContext.vsCodeEnv.isTelemetryEnabled();
  return isVSCodeTelemetryEnabled && isExtensionTelemetryEnabled;
}
```

The same library therefore sees the disabled Walker telemetry API, while the extension-owned setting is an explicit package-level additional gate. The dependency's separate .NET SDK/CLI telemetry helper sets `DOTNET_CLI_TELEMETRY_OPTOUT` when its telemetry is disabled (`TelemetryUtilities.js:41–61`). This is CLI telemetry only and may be reached along acquisition/configuration paths; it is not a Roslyn-server telemetry switch. The supported mapped path must avoid acquisition and supply the child CLI opt-out explicitly.

## Roslyn server, standalone branch and unsupported server result

The package's Roslyn XML documentation records:

```xml
<!-- Microsoft.CodeAnalysis.LanguageServer.xml:692-709 -->
<member name="T:...ProjectTelemetry.ProjectLoadTelemetryEvent">
  <summary>Data type for the project load telemetry event.</summary>
</member>
<member name="M:...ProjectTelemetry.ProjectLoadTelemetryReporter.ReportProjectLoadTelemetryAsync(...)">
  <summary>This is designed to report project telemetry in an extremely similar way to O#...</summary>
</member>
```

It also names `Microsoft.CodeAnalysis.LanguageServer.Telemetry.VSCodeRequestTelemetryLogger` at XML line 962. These prove the server payload includes telemetry-reporting code/types; XML does not establish their enabled state, sender path, or any supported suppression control. The server assembly source is not included in the audited package.

The C# client bundle has no `--telemetry`/`--telemetryLevel` token, and the C# manifest contributes no `dotnet.telemetry` setting. In `dist/extension.js:966`, the Dev Kit branch calls `getCSharpDevKitExportArgs` and `setupDevKitEnvironment`; only there does the source pass `--devKitDependencyPath`, `--sessionId`, and call the optional `setupTelemetryEnvironmentAsync`. The standalone `else` branch sets Roslyn activation context and adds `--csharpDesignTimePath`; it does not add those Dev Kit arguments or invoke Dev Kit telemetry setup.

`DOTNET_CLI_TELEMETRY_OPTOUT=1` is still appropriate in the Roslyn child environment, but the package design itself distinguishes CLI telemetry from Roslyn project-load telemetry, so it cannot be treated as a blanket server suppressor. No source-backed Roslyn standalone suppression mechanism was found. The server's default behavior and any possible independent request/reporting path remain **unsupported conclusions** for A1 and are a compatibility blocker pending parent disposition and the later independent E1 runtime evidence.

## Crash reporter settings

The client reads `dotnet.server.crashDumpPath` (manifest `package.json:1525–1532`, no default shown). When set, `dist/extension.js:951` adds `DOTNET_DbgEnableMiniDump=1`, `DOTNET_DbgMiniDumpType=4`, `DOTNET_EnableCrashReport=1`, and a dump path. This is a crash-dump configuration, not proof of telemetry suppression. The supported profile must leave it unset and deny a conflicting effective value. Keep ordinary local logs/error output; the `csharp.reportIssue` command is user-invoked and must not be characterized as an automatic report path.

## Dev Kit and AI branches

The client reads `chat.disableAIFeatures` through `cn("chat.disableAIFeatures", false)` (bundle line 851). Activation computes the Dev Kit branch from `Cu()`: `d && !Ss.disableAIFeatures` is required before `RoslynCopilot` is added to the dependency/component set (line 966). In the Dev Kit branch, `setupCopilotEnvironment` also returns immediately when AI is disabled; otherwise it adds the `roslynCopilot` component. `getCSharpDevKitExportArgs` supplies `--devKitDependencyPath` and `--sessionId`, and `setupDevKitEnvironment` conditionally calls `setupTelemetryEnvironmentAsync`. The standalone branch bypasses that Dev Kit block. Thus standalone plus effective `chat.disableAIFeatures=true` leaves the RoslynCopilot component and Dev Kit telemetry setup out of the client source path. The manifest still lists `@github/copilot-language-server` as package metadata; metadata presence is not evidence of activation/acquisition in that branch.

## Runtime evidence reserved for E1

A1 performed source-path inspection only. E1 must still exercise the exact digested packages and establish no telemetry requests on standalone startup, project load and error, verify ordinary diagnostics remain usable, and observe the actual extension telemetry library/API behavior. Until the parent accepts a supported server suppression result, none of those source-level facts alone authorizes enabling the C# language client.
