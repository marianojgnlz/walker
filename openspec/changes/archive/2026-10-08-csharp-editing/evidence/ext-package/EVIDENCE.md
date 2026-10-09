# csharp-editing external-package evidence (audited version 2.145.21-g154a82fd27)
Downloaded from Open VSX 2026-10-07T20:15:58Z; sources under /tmp/csharp-ext-evidence (non-durable) — durable copies + digests here.

## Digests
85a8c309642e4d49b4ee261b413ff666d96fa2562fd5a0f92d0c6cc15bd47b16  /tmp/csharp-ext-evidence/csharp.vsix
78bc006683cc998e9fd1a6f2760d8cb3da63096464a217bbd192ecfb490a5516  /tmp/csharp-ext-evidence/csharp-linux-x64.vsix
bf3872afb6b0c93fdfb99e021e5ba3418723d980bfbf7133dee608abf60c2079  evidence/ext-package/Microsoft.CodeAnalysis.LanguageServer.runtimeconfig.json
0d77990a76c4e89adfe44353969d9c081af897e6b2fdcd54ca85c5fb4851266c  evidence/ext-package/openvsx-ver.json
2873747ff47368feae8014e509825681dec8445c1c99b0255e4c2d26f07291b4  evidence/ext-package/package.json.alpine-arm64.json
2873747ff47368feae8014e509825681dec8445c1c99b0255e4c2d26f07291b4  evidence/ext-package/package.json.linux-x64.json

## Key audit facts (from proposal)
- dotnet.server.useOmnisharp default TRUE → Walker must set false (Roslyn)
- extensionDependencies: [ms-dotnettools.vscode-dotnet-runtime] in BOTH manifests; runtime >=10.0.5 client query, acquire fallback (dist/extension.js ~L951/966)
- Roslyn server 5.9.0-1.26318.9, net10 framework-dependent, base 10.0.0 roll-forward major
- No contributed dotnet.telemetry switch; project-load telemetry exists in server XML
- chat.disableAIFeatures read by client; @github/copilot-language-server + RoslynCopilot metadata present (must stay inert)
