# E2 — Live language features and declared solution graph

## Scope and environment

Live acceptance used a disposable, pre-restored two-project fixture at `/tmp/walker-csharp-e2.sdd-apply-20261008/fixture/E2LanguageClean`, with `App/App.csproj` referencing `Library/Library.csproj` through `CSharpEditing.sln`. The fixture scan and graph assembly found both project files and produced workspace, solution and project nodes. The live package pins were `muhammad-sammy.csharp` **2.145.21-g154a82fd27** (Linux x64) and `ms-dotnettools.vscode-dotnet-runtime` **3.2.0**; package digests are recorded in [`../ext-package/EVIDENCE.md`](../ext-package/EVIDENCE.md) and [`../ext-package/A1-source-digests.md`](../ext-package/A1-source-digests.md).

The final live run (`/tmp/walker-csharp-e2.sdd-apply-20261008/e2-language-clean-isolated-final2.log`) used UID 1000, empty IPv4/IPv6 route tables, a scratch profile and a writable scratch temp/runtime-shared-memory directory. The fixture was pre-restored before the probe; the probe did not run build or restore commands. No screenshot was taken for this record.

## Live language acceptance

The run loaded `App/App.csproj` and reported project initialization complete. The UI automation and language output transcript record these live results:

| Operation | Observed result |
| --- | --- |
| Completion | At `Greeter.He`, completion returned `Hello`. |
| Diagnostics | The deliberate fixture errors produced `CS0117` (`Greeter` has no member `He`) and `CS0103` (`MissingSymbol` is not in scope). |
| Hover | `string Greeter.Hello(string name)`. |
| Go to Definition | Opened `Greeter.cs` in the Library project. |
| Find References | The result panel reported **5 references**. |
| Rename | Rename reported **5 text edits in 3 files**; the `Hello` definition and its callers in `Program.cs` and `E2Acceptance.cs` were changed to `Salute`. The final harness assertion `rename-updated-definition-and-all-callers=true` passed. |

The `Program.cs` diagnostics were intentional acceptance inputs (`Greeter.He` and `MissingSymbol`), not regressions. The rename affected only the disposable `/tmp/.../fixture/E2LanguageClean` files.

## Live Solution Explorer graph and refresh

The live Solution Explorer showed the `E2LanguageClean` workspace root, `CSharpEditing.sln`, App and Library projects, `Library.csproj`, `Greeter.cs`, and the declared project reference. Adding `E2TreeRefreshEvidence4.cs` to the App fixture was reflected in the tree without restarting the window; the probe recorded `tree-after-file-add-has-refresh=true`. This demonstrates the requested project/reference/file graph and one incremental file-add refresh.

There is a harness limitation around row activation: scrolling/double-clicking particular Solution Explorer rows timed out (`tree-open-fallback-*` / `keyboard-tree-open-error-*`). Quick Open subsequently opened `Program.cs`, `Greeter.cs` and `E2Acceptance.cs`; language-definition navigation also opened `Greeter.cs`. Therefore, do not report the tree-row keyboard/double-click path as passing. Live missing/partial project metadata rendering was not separately exercised in this GUI run; the bounded project/graph suites listed in [`../e3-regression.md`](../e3-regression.md) cover those parser states.

## Untrusted-workspace probe and limits

The separate `/tmp/walker-csharp-e2.sdd-apply-20261008/e2-untrusted-verified-pass.log` records selecting **“No, I don't trust the authors”**, retaining Restricted Mode and showing the read-only Solution Explorer tree. It records no Roslyn process, no C# runtime mapping, unchanged scratch profile settings, and identical before/after hashes for the fixture project/source sentinels.

This is evidence that no C# language server was observed after trust was declined, while the declared tree remained usable. The profile also lacked a runtime mapping and displayed the generic C# configuration-conflict state, so this run does not isolate workspace trust as the sole denial cause. Do not use it as a complete test of every trust transition or already-active host revocation branch; those are covered only by focused admission/revocation tests.

## Status and process-exit caveats

The UI continued to display third-party **“Error acquiring .NET!”** and Walker's own **“C# Editing is configured and starting”** status even while the standalone Roslyn server was initialized and responding to language requests. These are retained as observed E2 caveats, not recast as a ready status or modified as part of E2. The ready-path server initialization is independently visible in `e1b-ready-final-profile/logs/20261008T211137/window1/exthost/muhammad-sammy.csharp/C#.log`.

The wrapper ended with `language-probe-exit=2` because its eight-second shutdown check still found Walker main PID `536726` and explicitly requested per-PID Procedure A escalation. Thus the probe's feature observations are usable, but the wrapper did **not** exit cleanly. Procedure B was performed after testing ended. At final inventory, the dev-build Walker and its descendants were absent, `hyprctl` showed no Walker window, all 50 exact-path `socat` bridges plus the matching proxy and launcher wrapper had exited, no listener remained on the harness ports, and no named harness network namespace remained. The scratch profiles/logs were retained. Detailed inventory is recorded in [`../e3-regression.md`](../e3-regression.md). The tree-row activation timeouts above are separate from this shutdown status.

## Applicability

- **Observed live on Linux x64:** completion, compiler diagnostics, hover, definition, five references, rename across the definition/callers, App/Library/reference/file tree, and one file-add refresh.
- **Observed in a separate untrusted run:** trust decline retained Restricted Mode, the declared read-only tree remained visible, no Roslyn process or requester mapping was observed, and fixture/profile sentinels were unchanged.
- **Covered by focused tests rather than this live GUI probe:** partial/missing metadata and parser limits, host stop ordering, failed-stop behavior, stale permissions, and conditional profile rollback.
- **Not established:** Windows/macOS, remote/browser language editing, Dev Kit runtime behavior, an isolated trust-only denial cause, live invalid-package update matrices, successful keyboard/double-click activation of tree rows, or a fully `ready` UI state.

## Evidence sources

- Full UI transcript and process status: `/tmp/walker-csharp-e2.sdd-apply-20261008/e2-language-clean-isolated-final2.log`.
- C# and Roslyn logs: `/tmp/walker-csharp-e2.sdd-apply-20261008/e1b-ready-final-profile/logs/20261008T211137/window1/exthost/muhammad-sammy.csharp/C#.log` and sibling `C# LSP Trace Logs.log`.
- Trust-decline, restricted-tree, no-Roslyn and before/after hash evidence: `/tmp/walker-csharp-e2.sdd-apply-20261008/e2-untrusted-verified-pass.log`.
- Fixture preparation/scan and graph evidence: `/tmp/walker-csharp-e2.sdd-apply-20261008/fixture/E2LanguageClean/` and the E2 transcript above.

## Review focus

Check that each language claim is tied to the observed result (not installation alone); retain both UI caveats and the wrapper exit-2/shutdown limitation; review the trust-denial causality caveat; and do not treat the tree-row keyboard/double-click automation timeouts as successful navigation.
