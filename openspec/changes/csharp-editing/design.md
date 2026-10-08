# C# Editing Design

## Status and inputs

Approved input: `proposal.md`, scope gate PASS and parent preflight. Store: OpenSpec. Domains are inferred: full new `csharp-editing` plus additive `dotnet-toolchain`; existing canonical requirements are unchanged. No competing active change or legacy flat spec was found. Readback of both planned specs completed before this design.

**This is a conditional design, not an assertion that the package is safe.** Final toolchain-boundary disposition and the external-package feasibility evidence below are required before implementation authorization. Linux payload evidence is the only platform evidence currently available. No code, live probe or memory operation was executed in this planning phase; memory/command tools are unavailable to this executor.

## Architecture and requirement mapping

| Spec requirement | Decision/component | Verification |
| --- | --- | --- |
| Explicit anonymous acquisition | D1 workbench install/configure coordinator | install failures, disabled/update/profile cases |
| Fail-closed activation admission | D2 pre-module identity-scoped admission + revocation | host activation/configuration race tests |
| Canonical standalone Roslyn hosting | D3 command + D4 audited requester mapping | contract/probe and real dependency tests |
| Reporting and AI suppression | D4 compatibility record, effective settings and real reporting audit | startup/load/error/AI capture |
| Declared solution and project graph | D5 extension parsers/model | solution/XML/items/reference fixtures |
| Bounded non-evaluating graph reads | D5 budgets/containment/partial diagnostics | malicious and unsupported fixtures |
| Refresh and accessible lifecycle | D6 tree controller/watchers | cancellation/disposal/navigation/locality tests |
| Truthful editing acceptance and preservation | D7 packaged evidence/ownership rollback | live language fixture + sentinels |
| Toolchain: Versioned editing-host resolution | D3 strictly guarded command | guard/freshness/fixed-process tests |

New built-in `extensions/solution-explorer/` owns graph model, bounded filesystem reads, stable TreeDataProvider APIs, localized view/commands and normal editor navigation. It has no SDK/process/network adapter. Its UI extension host handles local file roots only, including read-only untrusted roots. Unsupported browser/remote/virtual contexts get a localized explanation, not local scanning of remote paths.

`src/vs/workbench/contrib/csharpEditing/` owns privileged acquisition/admission and profile configuration. It talks to toolchain only through guarded versioned commands, not extension implementation imports. The tree invokes `walker.csharp.configureEditing`; core exposes that command even if the language extension is absent. No Welcome change, third-party builtInExtensions entry or recommendation-only policy is needed. The optional file recommendation is omitted to keep the install action explicit and the surface narrow.

Data flow: local root discovery → bounded solution/project parsers → declared graph + diagnostics → tree; independent configure action → anonymous gallery install → canonical host command → effective-settings audit → admission → third-party standalone Roslyn. The tree never waits for language readiness.

## D1 — Configuration and acquisition

Use existing gallery/workbench installation services with explicit user action, Open VSX identity and version selection. Dependency acquisition is allowed, not independent runtime provisioning. Do not silently re-enable disabled extensions. Display missing, disabled, unsupported package/platform, installing, signature failure, offline/access failure, configuration conflict, toolchain unavailable, starting and ready/error states separately. Readiness requires actual server/language verification, not an installed flag.

Manifest `configurationDefaults` in the companion extension supplies `dotnet.server.useOmnisharp=false`, `chat.disableAIFeatures=true`, `dotnet.projects.enableAutomaticRestore=false`, `dotnet.navigation.navigateToSourceLinkAndEmbeddedSources=false`. Defaults do not outrank user/workspace/folder values. Explicit Configure writes only authorized profile-level values and a per-profile owned-value/prior-value journal via normal configuration/storage APIs. It never writes workspace files, secrets, PATH, terminal settings or `extensions.verifySignature`. Known signature failure explains the optional explicit user/profile workaround and its security tradeoff; failed default installation remains failed evidence.

Dynamic values: extension-owned `dotnet.server.path`, `dotnet.server.environmentVariables` containing CLI opt-out/no-logo plus verified root/multilevel suppression, and dependency requester mapping to the verified executable. Their exact effective shapes must match the package audit. Validate every resource scope that the client can consult, not only the active editor. Reject server paths outside the audited payload, conflicting inherited `DOTNET_ROSLYN_SERVER_PATH`, crash-report/debug hook settings and inherited shell/.NET/MSBuild execution hooks. Do not try to sanitize another extension's inherited environment by editing process.env; fail closed when supported child settings cannot neutralize it.

(Amended by parent Decision 8, 2026-10-08) The supported desktop profile denies the activation-time VSWebAssemblyBridge component installer fetch. In audited `muhammad-sammy.csharp` `2.145.21-g154a82fd27`, `csharp.wasm.debug.useVSDbg` (default true) does not gate this unconditional installer; it is not a suppression control. E1a run 3 proved denial benign for desktop diagnostics/completion (contained proxy 502), as recorded in `evidence/e1-probe/E1a-runtime-probe.md` and `E1a-network-attribution.jsonl`. Blazor/wasm debugging remains out of scope and denied.

## D2 — Smallest activation admission seam

Selected seam: internal ext-host→main-thread admission RPC immediately before `_doActivateExtension` loads either CommonJS or ESM modules in `src/vs/workbench/api/common/extHostExtensionService.ts`. Existing code loads modules before calling activate, so a hook only around activate() is insufficient. Apply by normalized identity to the audited C# client and its runtime dependency only; unrelated extensions take the existing path. Do not change public vscode API shapes or persist disabled enablement state.

Private RPC design: `$checkCSharpEditingAdmission(extensionId, installedVersion, extensionLocation, hostKind, generation)` returns `{ allowed: true, generation }` or `{ allowed: false, generation, reason }`. Identity/version/location are checked against main-thread installed metadata, not trusted from the request. Environment safety is checked in the actual ext host with a narrowly enumerated unsafe-key report, never transferring complete environment/secrets. Denial, malformed response, timeout (10 seconds), missing coordinator, stale generation or non-local host stops module loading with an ordinary localized diagnostic. Register the coordinator before extension-host activation starts; startup defaults alone are not a permit.

Dependency ordering: the runtime dependency receives a separately audited environment/config permit before it loads; C# receives the full SDK/runtime/trust permit after dependencies resolve. Resolving the first-party UI toolchain must not wait on either protected package, avoiding a dependency cycle. The configured dependency mapping must be established before dependency module loading. A grant is immutable for its generation; no deferred timer writes.

Revocation must also be ordered at the source of safety configuration propagation. Route affected configuration/trust/package/locality updates through the admission coordinator before delivering them to the affected host. On invalidation, revoke permits and stop that host first; do not merely observe `onDidChangeConfiguration` after forwarding. Restart with fresh admission after explicit repair/reload. Already-active unsafe profiles take this same stop/restart path, never late-disable-as-proof. A shared host restart can temporarily interrupt unrelated extensions but must preserve their enablement/settings/secrets. Localized explanation must disclose that interruption.

Discovery/edit targets: `extHost.protocol.ts`, `mainThreadExtensionService.ts`, `extHostExtensionService.ts`, and the actual configuration forwarding path (`mainThreadConfiguration.ts` and extension-host manager/service lifecycle). Tests must prove direct, automatic, dependency, ESM/CommonJS, early startup, revocation and stale grants. If source-ordered revocation cannot be enforced with this narrow seam, stop before implementation and return the incompatibility to the parent; do not introduce a generic command broker or accept a post-activation race.

(Amended by parent Decision 8, 2026-10-08) The D2 admission coordinator also owns the component-fetch deny rule for the admitted C# extension identity. Establish interception before that identity activates and block the exact destination `https://vsdebugger.blob.core.windows.net/vswebassemblybridge-9-0-705702/vswebassemblybridge.zip` before any non-local connection. Match the exact destination and admitted identity, not arbitrary extension traffic; emit a structured denial log with extension identity and destination. Rule-evaluation failure MUST fail closed before connection, never fall through to network access. A6 owns request interception and rule tests; A7 verifies integrated benign degradation: desktop diagnostics/completion remain usable without the component, while Blazor/wasm debugging stays denied.

## D3 — Concrete proposed contracts.ts delta (parent approval pending)

Add `DOTNET_TOOLCHAIN_COMMANDS.resolveEditingHost = 'walker.dotnet.resolveEditingHost'`. Add independent `DOTNET_EDITING_HOST_SCHEMA_VERSION = 1`; do not bump snapshot-v1 or change template request/result unions. Proposed wire types:

```typescript
export interface IDotnetEditingHostRequest {
 readonly schemaVersion: 1;
 readonly profile: 'roslyn-standalone-10';
}
export type IDotnetEditingHostResult =
 | { readonly schemaVersion: 1; readonly kind: 'ready'; readonly locality: 'local';
     readonly profile: 'roslyn-standalone-10'; readonly executable: string;
     readonly root: string; readonly sdkVersion: string; readonly runtimeVersion: string }
 | { readonly schemaVersion: 1; readonly kind: 'unavailable';
     readonly reason: 'unsupported-host' | 'sdk-not-ready' | 'runtime-incompatible' | 'busy' }
 | { readonly schemaVersion: 1; readonly kind: 'invalid';
     readonly reason: 'malformed-request' | 'unsupported-profile' }
 | { readonly schemaVersion: 1; readonly kind: 'failed';
     readonly reason: 'recheck-failed' | 'unsafe-installation' | 'spawn' | 'timeout' | 'invalid-runtime-output' };
```

Command requires exactly one request. Guard rejects arrays/null, missing/extra keys, wrong schema and all executable/argv/cwd/URL/env inputs; correctly shaped unknown profile returns unsupported-profile. Result guard checks exact discriminant key sets, local/profile literals, nonempty absolute NUL/newline-free executable/root, stable version syntax, compatible runtime and executable/root relationship using local-platform path semantics. Core mirrors DTO/guards in `csharpEditing/common/toolchainContract.ts` with parity fixtures; no cross-layer implementation imports. Paths from DTOs are not a general launcher capability.

`extension.ts` registers command synchronously and guards host before constructing any probe. Busy install/verification yields busy. Fresh `controller.recheck()` must finish with verified SDK or yield sdk-not-ready; unexpected rejection yields recheck-failed. Revalidate executable realpath/root containment and current workspace exclusion. Use verified executable only with fixed `['--list-runtimes']`, trusted non-workspace temp cwd (validate against current roots), sanitized child env (owned DOTNET_ROOT, multilevel lookup 0, CLI opt-out 1, no-logo 1), shell:false, 10-second timeout and 64 KiB output ceiling. Never accept a caller's runtime minimum or process inputs.

Parse only stable Microsoft.NETCore.App runtime records under that real installation's `shared/Microsoft.NETCore.App`; reject missing/malformed/truncated output and external paths. Require contained runtime artifacts and execution validation with fixed `['--info']` under the same sanitized boundary; malformed/unusable host is failure. Compatibility profile follows audited client stable >=10.0.5 selection; client/dependency must independently prove it will choose that installation successfully, including major roll-forward behavior. No SDK inventory, project cwd/global.json, automatic install, shell, restore or project-evaluation command. Result is an observation, not a persistent lease: recheck on each admission generation.

Tests inject existing process/filesystem/host facades, recording exact argv/env/cwd, zero installer/network calls and unchanged snapshot/template contracts. **All D3 implementation tasks depend on final parent disposition of this exact amendment.**

## D4 — External-package feasibility and compatibility record

Direct planning read of bundled client line 951 confirms `dotnet.findPath` receives `{acquireContext:{version:'10.0.5', requestingExtensionId:Lg, architecture, mode:'runtime'}, versionSpecRequirement:'greater_than_or_equal', rejectPreviews:true}` for standalone. Undefined result falls back through acquireStatus/acquire and ensureDotnetDependencies. `dotnet.toolingRuntimePath` is Dev Kit-only. Child host environment copies process.env, sets DOTNET_ROOT/multilevel lookup, and can enable crash reporting. These facts require a real mapping guarantee, not a guess based on extension identity.

**Unresolved audit prerequisite:** this executor cannot establish the value of bundled `Lg` with the available truncated grep output, and dependency 3.2.0 implementation was not located in available evidence paths. Do NOT assume it is `muhammad-sammy.csharp` rather than upstream-branded. Obtain the audited dependency implementation and bounded source excerpts/checksums durably under `evidence/ext-package/`; record the exact requester literal, supported `dotnetAcquisitionExtension.existingDotnetPath` schema, per-requester/global precedence, validation/architecture/version behavior and all fallbacks. The candidate setting name is not yet an approved effective mapping. If mapping cannot guarantee successful findPath without PATH discovery/acquisition for the verified host, the integration is incompatible: stop, not monkeypatch commands or fork packages.

Named guard `CSharpRuntimeMappingGuard` denies admission unless the exact audited package/dependency/platform record and effective mapping pass. Real-dependency tests must return the canonical executable and record zero dotnet.acquireStatus/dotnet.acquire/ensureDotnetDependencies calls on the supported path, including stale/missing mapping, incompatible runtime and hostile PATH cases (negative cases denied before client entry). No arbitrary extension network policing is added.

**Unresolved telemetry prerequisite:** no contributed dotnet.telemetry switch exists; server XML includes project-load telemetry. Preserve source evidence for reporter construction, standalone service composition, error reporters and Dev Kit/session argument branches. Exercise the actual telemetry library against Walker's disabled ext-host facade and capture actual standalone startup/project-load/error child args/env and requests with test-only instrumentation. CLI opt-out and absence of Dev Kit args alone do not prove server suppression. If a reporter can send independently without a supported documented suppression mechanism, deny compatibility and return provider incompatibility; never invent a flag or silently rely on firewall blocking.

Compatibility record initially pins C# version/digest, runtime dependency version/digest, Roslyn version `5.9.0-1.26318.9`, runtime profile, requester/mapping semantics and demonstrated reporting controls. Linux x64 admission is enabled only after those facts are established. Other platforms stay unvalidated/denied until their payload and native probes supply equivalent evidence. AI audit verifies effective chat.disableAIFeatures skips setup/acquisition, no Dev Kit/Copilot module activation and no server AI component launch; package metadata alone is not activation proof.

## D5 — Source graph and safety budgets

New files: `model.ts`, `scanLimits.ts`, `workspaceReader.ts`, `solutionParser.ts`, `xmlReader.ts`, `projectParser.ts`, `projectItems.ts`, `graph.ts`, plus corresponding `src/test/` suites/fixtures. A small structural XML tokenizer/parser handles namespace-qualified elements, quoted attributes, comments, predefined/numeric entities and matching nesting; rejects DTD/custom entities, processing of external resources and malformed input. Do not reuse development-only xml2js or add a package without packaging/license/lock review.

Initial fixed limits per scan: 2 MiB metadata file, 64 solutions, 256 projects, 20,000 directory entries/graph nodes, depth 32, XML depth 64, 100,000 XML tokens, 4 concurrent reads and a 5-second work budget with cooperative cancellation. Budget exhaustion emits partial diagnostics and retains project-file navigation; tests control clock and test exact boundaries. Stat before read and reject oversized returned bytes too; adapters must not allocate arbitrarily before applying a bounded local read. Skip symlink entries automatically and verify realpath containment immediately before reads; no traversal outside authorized roots. Display external declarations without stat/read; explicit normal editor opening is separate.

Solution grammar parses conventional Project records and NestedProjects with quoted-path handling, GUID validation, duplicate/missing membership diagnostics and cycle-safe folder nesting. `.slnx`, unsupported solution project kinds/sections remain partial. Identify shared projects by canonical URI while node IDs include workspace/solution ancestry. Standalone csproj means discovered project not included in any discovered solution; keep root identity even if another folder contains a same-path alias.

XML projection extracts only unconditional literal metadata. Conditions/imports/property expansion/custom transforms mark the project partial and preserve unresolved declarations. Literal local includes/removes/link labels are supported; bounded simple glob expansion supports SDK implicit .cs inclusion and ordinary project-local declarations, never transforms/property functions. Unsupported patterns get unresolved nodes. Respect literal EnableDefaultItems/EnableDefaultCompileItems=false; conditions on those controls make implicit results partial. Deduplicate resolved file/reference identities while retaining duplicate diagnostics and declaration provenance. File lists are navigation, not compilation membership claims. Missing files and references are diagnostic nodes; package version/include/update/assembly hint metadata never resolves online.

## D6 — Tree, refresh and lifecycle

`treeProvider.ts` produces stable IDs, workspace/solution/project/file/dependency/diagnostic nodes, partial badges/descriptions and standard ThemeIcon resource labels. `extension.ts` registers Refresh/Open and the localized view, wires configuration action and owns immediate disposal. Normal `vscode.open`/document APIs preserve editor/history behavior; external target opening requires an explicit command on that node. No parallel recent storage.

`graphController.ts` caches parsed documents by URI/content generation and dependency membership. Local filesystem watchers cover metadata and relevant file patterns, debounce 150 ms, coalesce events and dirty affected projects/solutions; topology/workspace changes invalidate root membership. A monotonic scan generation prevents stale publication; cancellation checks before/after awaited reads. Repeated refresh/workspace replacement disposes old watcher collections, bounds queued events (256 then full bounded rescan) and never accumulates listeners. Refresh survives missing/malformed files and labels partial snapshots rather than replacing them with empty success. Trust changes affect language admission, not read-only graph availability.

## D7 — Tests, rollout and rollback

Natural order per unit: focused failing tests → minimal behavior → additional edge cases → refactor. Strict TDD is not mandated. Use Node 24.18.0 via mise. Core suites run `./scripts/test.sh --run <compiled suite selector>` following existing projectWizard tests. Extension tests follow dotnet-toolchain's injected facades and extension-local compile/mocha scripts; confirm precise build/test inclusion during scaffolding, never assume the core runner loads raw extension TS. Focused client/extension compile only where fresh outputs or cross-cutting RPC types require it; no ceremonial broad build.

Rollout order: preserve feasibility evidence first; obtain parent plan/boundary disposition; implement command/config/admission as disabled-until-validated units; implement independent graph leaves; wire only validated Linux compatibility; packaged language/security/graph checks. All new view/manifests must be present in packaged built-in extension discovery/build output, verified against repository build inclusion rather than assuming a new directory ships.

Acceptance evidence under `evidence/` records exact versions/digests, default signature failure and separate workaround success, startup/load/error reporting captures, zero acquisition/AI/automatic-restore traces, real completion/diagnostics/hover/definition/references/rename fixture results, keyboard/theme/localization and disposables checks, unrelated profile/secret/project sentinels and toolchain/wizard regressions. Redact secrets and bound evidence captures. Windows/macOS and unavailable remote endpoints remain explicitly environment-gated, not passes.

Each review leaf has a disabled/independent start and finish boundary in tasks.md. Roll back leaf wiring before shared infrastructure; remove graph extension/core contribution and editing-host command without touching snapshot/template operations or user-installed packages. Restore journaled settings only if current values still match Walker-written values; preserve user edits. No default signature-policy change or removed service restoration.

## Risks and required disposition

1. Exact runtime requester/mapping audit and standalone server telemetry proof are missing; these are fail-closed feasibility blockers, not presumed passes. Parent must supply/authorize audit execution and accept its durable evidence before apply authorization.
2. D2 source-ordered admission/revocation spans extension-host lifecycle and configuration forwarding. Its bounded feasibility must be demonstrated, not replaced with late listeners; a shared host restart affects unrelated running extensions transiently.
3. D3 is the concrete proposed widening for final parent approval. Rejection stops its dependent language work; tree scope remains approved, but no alternate runtime boundary is invented.
4. Custom XML/source parsing deliberately yields partial graphs; bounded limits can truncate large repositories and must be explicit to users.
5. At least seven areas require multiple cohesive leaves; 400-line budget includes tests and applicable artifacts. Any actual inseparable over-budget leaf returns to parent, since size exception was declined.
