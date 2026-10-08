# A1 requester and .NET runtime mapping audit

## Verdict

The audited standalone C# server path has a feasible requester-specific mapping: `dotnetAcquisitionExtension.existingDotnetPath` is an array of `{ extensionId, path }` entries, and this exact C# package sends `requestingExtensionId: "muhammad-sammy.csharp"`. A valid matching entry for the canonical, stable Linux x64 host at version >=10.0.5 is accepted by `dotnet.findPath` before its PATH/root/managed-install search. That path does not invoke the C# client's `dotnet.acquireStatus`, `dotnet.acquire`, or `dotnet.ensureDotnetDependencies` fallback.

This is a source-path feasibility result, not a runtime trace. The integration must set and validate the requester mapping, disallow invalid-path bypass, check the exact effective path and stable runtime itself, and prove zero fallback calls in E1/A6. A subtle source gap is recorded below: the dependency's existing-path branch does not forward the caller's `rejectPreviews` flag, so its own mapping validator is not sufficient to establish “stable” on its own.

## Exact requester literal and package identity

The durable Linux package manifest says `name: "csharp"`, `publisher: "muhammad-sammy"`, version `2.145.21-g154a82fd27` (`evidence/ext-package/package.json.linux-x64.json`, fields at lines 2–4). The executable bundle resolves the requester literal directly:

```js
// /tmp/csharp-ext-evidence/csharp-linux-x64/extension/dist/extension.js:856, column 54614
var Lg="muhammad-sammy.csharp";
```

The server runtime request uses that exact identifier:

```js
// .../dist/extension.js:951, column 13999
let i={acquireContext:{version:KP,requestingExtensionId:Lg,architecture:n,mode:r},versionSpecRequirement:"greater_than_or_equal",rejectPreviews:!0};
```

The bundle contains four `requestingExtensionId:Lg` references: the server-runtime lookup and its acquire fallback at line 951, plus two ASP.NET Core/debug helper references at line 954. The literal is not the upstream `ms-dotnettools.csharp` shown in the dependency README example; the effective entry must use `muhammad-sammy.csharp`.

## Runtime dependency 3.2.0 setting schema and precedence

The dependency `ms-dotnettools.vscode-dotnet-runtime` 3.2.0 package manifest (`/tmp/csharp-ext-evidence/dotnet-runtime/extension/package.json`, SHA-256 in `A1-source-digests.md`) contributes:

```json
"dotnetAcquisitionExtension.existingDotnetPath": {
  "type": "array"
},
"dotnetAcquisitionExtension.sharedExistingDotnetPath": {
  "type": "string"
}
```

The dependency README's `existingDotnetPath` example is (README lines 52–58):

```json
"dotnetAcquisitionExtension.existingDotnetPath": [
  { "extensionId": "ms-dotnettools.csharp", "path": "C:\\Program Files\\dotnet\\dotnet.exe" }
]
```

Each entry has `extensionId` and `path`; the source resolver matches `pair.extensionId` and returns `pair.path` (`vscode-dotnet-runtime-library/dist/Acquisition/ExistingPathResolver.js`, source-map excerpt below). `sharedExistingDotnetPath` is a single global path.

The ordering is **requester-specific first, shared/global second** when the caller supplies its ID. If a matching per-requester row exists, it wins even when a shared path is also set. If no row matches, the shared path is used as fallback. If a matching requester row exists but its path fails validation, the resolver does not then try the shared path; it returns no configured path and `dotnet.findPath` proceeds to discovery. A missing requesting ID can only use the shared path. The task-specific row should therefore be provided and validated, and conflicting shared/user/workspace values still require effective-configuration review.

```js
// extension.js.map sourcesContent[13], ExistingPathResolver.js:51-80
getExistingPath(existingPaths, extensionId, windowDisplayWorker) {
  if (existingPaths && ((existingPaths?.individualizedExtensionPaths?.length ?? 0) > 0 || existingPaths?.sharedExistingPath)) {
    if (!extensionId) {
      if (existingPaths.sharedExistingPath) return existingPaths.sharedExistingPath;
      ...
    } else {
      const matchingExtensions = existingPaths.individualizedExtensionPaths?.filter((pair) => pair.extensionId === extensionId);
      if (matchingExtensions && matchingExtensions.length > 0) {
        const existingLocalPath = existingPaths.individualizedExtensionPaths?.filter((pair) => pair.extensionId === extensionId);
        if (existingLocalPath && existingLocalPath.length > 0) return existingLocalPath[0].path;
      } else if (existingPaths.sharedExistingPath) {
        return existingPaths.sharedExistingPath;
      }
      ...
    }
  }
  return null;
}
```

`existingDotnetPath`, `sharedExistingDotnetPath`, `proxyUrl`, and `allowInvalidPaths` are listed as restricted configurations for untrusted workspaces in the dependency manifest (lines 34–40). The manifest says user-level values remain available there, while workspace/folder values for these settings are ignored. `allowInvalidPaths` is a validation bypass: the dependency accepts it in the resolver and skips ordinary supplied-path requirements. Walker admission must require it false and must not treat untrusted-workspace filtering as a replacement for reviewing all effective scopes.

## Provided path validation and early return

The dependency resolves/validates a supplied path before looking for another host. It canonicalizes/realpath-resolves the provided executable, verifies its runtime against the request, records it in-use, and only then returns it:

```js
// extension.js.map sourcesContent[13], ExistingPathResolver.js:26-42, 85-91
async resolveExistingPath(existingPaths, extensionId, windowDisplayWorker, requirement) {
  let existingPath = this.getExistingPath(existingPaths, extensionId, windowDisplayWorker);
  ...
  const resolvedPath = await dotnetResolver.resolveTruePath(existingPath ?? '', this.workerContext.acquisitionContext?.architecture ?? null);
  existingPath = resolvedPath ?? null;
  if (existingPath && (await this.providedPathMeetsAPIRequirement(..., requirement) || this.allowInvalidPath(...))) {
    await InstallTrackerSingleton.getInstance(...).markInstallAsInUse(existingPath);
    return { dotnetPath: existingPath };
  }
  return undefined;
}

async providedPathMeetsAPIRequirement(workerContext, existingPath, apiRequest, requirement) {
  const validator = new DotnetConditionValidator(...);
  const validated = await validator.dotnetMeetsRequirement(existingPath, {
    acquireContext: apiRequest,
    versionSpecRequirement: requirement ?? 'equal'
  });
  ...
}
```

The check runs `dotnet --list-runtimes --arch <requested-architecture>` against the **provided executable** (`DotnetResolver.js:252–270`), checks the actual host architecture (`resolveHostArchitecture`, lines 91–108), and checks that a runtime record has the requested mode, architecture and version (`DotnetConditionValidator.js:26–50`). For `greater_than_or_equal`, the validator accepts a same-major version at or above the requested minor/patch, or a later major (`DotnetConditionValidator.js:54–125`). With the supplied C# request, a valid stable `Microsoft.NETCore.App` >=10.0.5 runtime for the requested Linux x64 architecture satisfies this check.

**Preview edge:** C# passes `rejectPreviews: true` at the top level of the `dotnet.findPath` request (bundle line 951), but `src/extension.ts:696` passes only `versionSpecRequirement` into `resolveExistingPathIfExists`; `ExistingPathResolver.js:85–91` then builds a new requirement containing only `acquireContext` and `versionSpecRequirement`. Its preview guard only rejects when `requirement.rejectPreviews === true` (`DotnetConditionValidator.js:158–162`). Therefore preview rejection is not established for the configured-path branch. Walker's canonical host guard must independently require a stable runtime >=10.0.5; do not rely on this dependency path to enforce the stable qualifier. This does not block the exact stable canonical-host mapping, but it is a required guard/test case.

## `dotnet.findPath` search order and zero-fallback proof

The runtime dependency's command first resolves configured settings. For a non-SDK/runtime request, a valid setting is returned immediately **before** construction of the `DotnetConditionValidator`/`DotnetHostPathFinder` discovery branch:

```ts
// extension.js.map sourcesContent[398], .././src/extension.ts:682-710
if (!commandContext.acquireContext.mode || !commandContext.acquireContext.requestingExtensionId ||
    !commandContext.acquireContext.version || !commandContext.acquireContext.architecture) throw ...;
const workerContext = getAcquisitionWorkerContext(...);
const existingPath = await resolveExistingPathIfExists(..., commandContext.versionSpecRequirement);
if (existingPath && commandContext.acquireContext.mode !== 'sdk') {
  ...
  return existingPath;
}
const validator = new DotnetConditionValidator(...);
const finder = new DotnetHostPathFinder(...);
const dotnetOnShellSpawn = (await finder.findDotnetFastFromListOnly(requestedArchitecture)) ?? '';
```

If the setting is absent/invalid, the source's remaining `findPath` order is: fast `dotnet` host resolution (`extension.ts:710`), shell/PATH lookup (`:721`), real-PATH lookup (`:732`), `DOTNET_ROOT` lookup (`:743`), extension-managed runtimes (`:751–764`), then hostfxr/registry/system-install records (`:766–775`). The path finder may use `which`/`where`, shell PATHs and direct PATH processing (`DotnetHostPathFinder.js:98–174`); these are discovery fallbacks, not part of the valid requester-setting fast return.

The C# server runtime call order is:

```js
// C# bundle line 951, columns 13999–14300 (bounded excerpt)
...let i={acquireContext:{version:KP,requestingExtensionId:Lg,architecture:n,mode:r},
versionSpecRequirement:"greater_than_or_equal",rejectPreviews:!0};
...let o=await RA.commands.executeCommand("dotnet.findPath",i);
 o===void 0 && ( ... o=await this.acquireDotNetProcessDependencies(r) );...

// C# bundle line 951, columns 15442–16040
async acquireRuntime(e) {
  let n={version:`${aXe}.${uXe}`,requestingExtensionId:Lg,mode:e},
      i=await RA.commands.executeCommand("dotnet.acquireStatus",n);
  if(i===void 0 && (await RA.commands.executeCommand("dotnet.showAcquisitionLog"),
      i=await RA.commands.executeCommand("dotnet.acquire",n),!i)) throw ...;
  return i;
}
async acquireDotNetProcessDependencies(e) {
  let r=await this.acquireRuntime(e), n=[this.getServerPath(this.platformInfo)];
  return await RA.commands.executeCommand("dotnet.ensureDotnetDependencies",
      {command:r.dotnetPath,arguments:n}),r;
}
```

Thus: `dotnet.findPath` valid mapping → no fallback; undefined mapping → `dotnet.acquireStatus` → if undefined, acquisition log then `dotnet.acquire` → `dotnet.ensureDotnetDependencies`. The acquisition request's fallback version is constructed as `10.0` (the client constants `aXe="10"`, `uXe="0"`), not the explicit 10.0.5 find request. The supported Walker path must never reach it.

A separate ASP.NET/Blazor debugging helper in the same bundle (line 954) uses `dotnet.findPath`, then direct `dotnet.acquire`, then falls back to the OS `dotnet.exe`/`dotnet` command. It is not the standalone Roslyn server host lookup and is outside this proposal's editing lane; debugging must not be represented as covered by the no-acquisition editing guarantee.

## Compatibility proof boundary

For the specific supported path, source establishes that a matching, validated requester entry can satisfy `dotnet.findPath` without PATH discovery and without runtime acquisition. It does **not** establish a runtime capture of zero `acquireStatus`/`acquire`/`ensureDotnetDependencies`; that remains E1/A6 evidence. The stable-version and exact-executable provenance checks belong to Walker's canonical runtime guard, not to a setting value alone.
