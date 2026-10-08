# A1 activation, configuration-forwarding and child-environment feasibility

## Pre-module admission seam

`extHostExtensionService.ts` has a single common activation path for CommonJS and ESM modules. `_doActivateExtension` selects the module kind and awaits `_loadESMModule` or `_loadCommonJSModule` as part of its `Promise.all`; only after both module/context loads resolve does it call `_callActivate`. This confirms the proposed hook must run before `_load...Module`, not only around `activate()`.

```ts
// src/vs/workbench/api/common/extHostExtensionService.ts:425-446
private _doActivateExtension(...) {
  const entryPoint = this._getEntryPoint(extensionDescription);
  ...
  const isESM = this._isESM(extensionDescription);
  ...
  return Promise.all([
    isESM
      ? this._loadESMModule(...)
      : this._loadCommonJSModule(...),
    this._loadExtensionContext(...)
  ]).then(values => {
    ...
    return AbstractExtHostExtensionService._callActivate(..., values[0], values[1], ...);
  });
}
```

`_callActivateOptional` invokes `extensionModule.activate(...)` at lines 542–548. Thus `activate()` is demonstrably later than module evaluation. This source supports a pre-module awaited admission RPC for either module format; it does not implement or test that RPC.

## Configuration forwarding path and host lifecycle

`MainThreadConfiguration` is a named ext-host RPC customer (`mainThreadConfiguration.ts:16`). Its constructor obtains the `ExtHostConfiguration` proxy, sends initial configuration, then subscribes to workbench configuration changes and directly forwards the current full configuration data plus change metadata:

```ts
// src/vs/workbench/api/browser/mainThreadConfiguration.ts:16-32
@extHostNamedCustomer(MainContext.MainThreadConfiguration)
export class MainThreadConfiguration ... {
  constructor(...) {
    const proxy = extHostContext.getProxy(ExtHostContext.ExtHostConfiguration);
    proxy.$initializeConfiguration(this._getConfigurationData());
    this._configurationListener = configurationService.onDidChangeConfiguration(e => {
      proxy.$acceptConfigurationChanged(this._getConfigurationData(), e.change);
    });
  }
}
```

`ExtensionHostManager` constructs and registers the named main-thread customers in its RPC setup (`extensionHostManager.ts:224–258`); `MainThreadConfiguration` is therefore the concrete forwarding actor, rather than a configuration event invented by the C# extension. On the extension side, `ExtHostConfiguration.$acceptConfigurationChanged` waits for its provider and then `ExtHostConfigProvider` parses the new data and fires `onDidChangeConfiguration` (`extHostConfiguration.ts:134–165`). That extension-facing event is **after** main-thread forwarding.

The current forwarding callback sends synchronously and has no pre-delivery revocation gate. A5 must place any ordered invalidation/stop gate before the proxy call at `mainThreadConfiguration.ts:31`; a late ext-host `onDidChangeConfiguration` listener cannot prove that unsafe values were withheld. The existing extension-host service has host-level stop/restart lifecycle (`abstractExtensionService.ts:737–750`, `:1290–1308`). A C# extension shares its host with other extensions, so this can interrupt unrelated running extensions; source inspection does not establish event ordering, failed-stop behavior, or a per-extension isolation guarantee. These are A4/A5 test obligations, not findings that the implementation already exists.

## Roslyn child executable and environment composition

The audited client chooses the server executable by checking inherited `process.env.DOTNET_ROSLYN_SERVER_PATH` first, then effective `dotnet.server.path`, then the extension-owned `.roslyn/Microsoft.CodeAnalysis.LanguageServer` payload (`csharp-linux-x64/extension/dist/extension.js:966`, function `Qbe`). Walker must reject an unexpected inherited server override and validate the effective configured path against the audited payload.

The dependency's host lookup builds `env` from `{ ...process.env }`, then sets `DOTNET_ROOT` to the selected host's directory, `DOTNET_MULTILEVEL_LOOKUP="0"`, and `DOTNET_ROOT_USER` from inherited `DOTNET_ROOT` or `"EMPTY"`. If `dotnet.server.crashDumpPath` is configured, it also sets `DOTNET_DbgEnableMiniDump`, `DOTNET_DbgMiniDumpType`, `DOTNET_EnableCrashReport`, and `DOTNET_DbgMiniDumpName` (C# bundle line 951, bounded fragment at column 15069).

The final Roslyn launch starts from `u.env`, optionally merges profiling variables, then merges `dotnet.server.environmentVariables` last:

```js
// csharp-linux-x64/extension/dist/extension.js:966, columns 14133-14350
let h=u.env;
let g=M$e(o);
h={...h,...g};
let S=Ro.environmentVariables;
Object.keys(S).length>0 && (h={...h,...S});
...
options:{detached:!0,env:h}
```

The manifest defines `dotnet.server.environmentVariables` as an object whose additional properties are strings (`package.json:1546–1555`). **The setting can override inherited unsafe keys and also overrides the dependency's calculated DOTNET values; its values win because it is spread last.** The client does not sanitize arbitrary inherited environment keys in this path. The allowlist/guard must validate the effective child environment and reject unsafe or unexpected keys/values, rather than assuming the package default is safe. The setting can supply `DOTNET_CLI_TELEMETRY_OPTOUT="1"`, but that only disables CLI telemetry, not Roslyn's own telemetry.

`dotnet.server.crashDumpPath` has no manifest default shown (`package.json:1525–1532`); when nonempty, crash-dump environment variables are injected before the final custom-environment merge. Require it unset for the supported profile and do not call local dump creation “telemetry suppression.” `dotnet.server.useOmnisharp` defaults to `true` (`package.json:1641–1647`), and `dotnet.projects.enableAutomaticRestore` defaults to `true` (`:1579–1585`); Walker must enforce its own effective values before admission.

## Source-level finding

A4's pre-module interception point and A5's configuration forwarding/host stop surfaces exist. The current workbench forwarding order is not itself safe for revocation: a coordinator must gate before the `MainThreadConfiguration` RPC send and prove stop-before-forward. The child environment is a broad inherited copy with a user-configurable final override. These are feasible but security-critical seams; source audit alone cannot establish race-free revocation or a safe resulting environment.
