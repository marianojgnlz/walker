# A1 source and package digest ledger

Audit target: Open VSX `muhammad-sammy.csharp` 2.145.21-g154a82fd27, Linux x64 payload, plus `ms-dotnettools.vscode-dotnet-runtime` 3.2.0 and the repository activation/configuration anchors. Source excerpts in the companion A1 records are bounded copies from these exact inputs. Runtime-dependency `extension.js.map` embeds the readable TypeScript/JavaScript sources cited by source entry and line number; the full source map is not duplicated here.

No package code was executed. The `/tmp/csharp-ext-evidence` paths are the parent-provided read-only audit inputs; the hashes below make those non-durable inputs verifiable. The runtime package manifest is referenced by digest and only relevant, non-sensitive schema/source excerpts are preserved in the A1 records.

## External package inputs

| Source | SHA-256 |
| --- | --- |
| `/tmp/csharp-ext-evidence/dotnet-runtime.vsix` (1,457,925 bytes; runtime extension 3.2.0) | `a4cff5409f66e3827ee2c6a727ae59382290a182a653ca0f9ac97c63536ee541` |
| `/tmp/csharp-ext-evidence/dotnet-runtime/extension/package.json` | `1a6e2fa7147489d6dc52b365727041a26cf2a0f15ab048fe4e18a08a5205834e` |
| `/tmp/csharp-ext-evidence/dotnet-runtime/extension.vsixmanifest` | `fd5ee802c71f1b5426338469dc267b1ac1c872591ac989830946997ced63ec2f` |
| `/tmp/csharp-ext-evidence/dotnet-runtime/extension/readme.md` | `4e2e543367be8bd968e4c1cd649e6000c87ebf8837b154e4ad0521c2778e4af8` |
| `/tmp/csharp-ext-evidence/dotnet-runtime/extension/dist/extension.js` | `8f54c89d49877f6f88c5ddfe955ba251b0c06a263889ff27a5410d618fe5e10f` |
| `/tmp/csharp-ext-evidence/dotnet-runtime/extension/dist/extension.js.map` | `9a3b0d1da22797d5ad8515437a90b777d9e61ef0b24e88b3d81d82e538ae7b0f` |
| `/tmp/csharp-ext-evidence/csharp-linux-x64/extension/package.json` | `2873747ff47368feae8014e509825681dec8445c1c99b0255e4c2d26f07291b4` |
| `/tmp/csharp-ext-evidence/csharp-linux-x64/extension/dist/extension.js` | `5f516e9eb34197cae953372b2901ada3e4339cd06c2ea789545ef3ca9c2e2622` |
| `/tmp/csharp-ext-evidence/csharp-linux-x64/extension/.roslyn/Microsoft.CodeAnalysis.LanguageServer.xml` | `c1d8c92b7e3eb3df0344fdc892618fb67d16bc199d1b5c53da0443790de7390e` |
| `/tmp/csharp-ext-evidence/csharp-linux-x64/extension/.roslyn/Microsoft.CodeAnalysis.LanguageServer.runtimeconfig.json` | `bf3872afb6b0c93fdfb99e021e5ba3418723d980bfbf7133dee608abf60c2079` |

The existing durable package evidence is retained unchanged at `EVIDENCE.md`, the Linux/alpine C# manifests, the Open VSX metadata, and the Roslyn runtimeconfig/XML files. This ledger supplements it with the runtime dependency and audited executable-source digests.

## Repository source anchors

| Repository source | SHA-256 |
| --- | --- |
| `src/vs/workbench/api/common/extHostExtensionService.ts` | `c8f618ac16560127aa020aa75efa8a58cff051b264199564be3bfe845b7bdfa3` |
| `src/vs/workbench/api/browser/mainThreadConfiguration.ts` | `b5918f9f377b62a9995d4721af4640620dd950791ac3bffc9e272f0546bf9fe1` |
| `src/vs/workbench/api/common/extHostConfiguration.ts` | `0944e7595c2ffcf31e1b29e00eae1f29426deadca4d56d3409236b7d16b77f6e` |
| `src/vs/workbench/api/common/extHostTelemetry.ts` | `fcd5c31060774c0bbfc808bf95fe358df5feda0abce06cbcc119e4a343b961f2` |
| `src/vs/workbench/api/common/extHost.protocol.ts` | `ff1759ee170b000b4d6c044bb8e545357210b7320aae7bef43987b1127077cea` |
| `src/vs/workbench/services/extensions/common/extensionHostManager.ts` | `edee85406eb1e92137c6ae4bdfd677cafa77d236f0d874d76801c20463301529` |
| `src/vs/workbench/services/extensions/common/lazyCreateExtensionHostManager.ts` | `909b405b0c52012ca5066a116b81d788bd29d6817cf9063412c308c25c1fe027` |
| `src/vs/workbench/services/extensions/common/abstractExtensionService.ts` | `650f039b8da6dc260654ce2680f63e53f9c9cd67b254ebce3e60295bacf35149` |

