# .NET Toolchain

Built-in Walker extension that establishes local .NET SDK readiness without accounts, elevation,
system-install changes, or workspace configuration. The detection, transaction, and installer
foundation previously landed in review units; the command boundary below wires that foundation to
Walker commands and a status item while the packaged-activation slice (D1) still owns the shipping
bundle and platform smoke runs.

## Command boundary (`src/extension.ts`, `src/status.ts`)

The manifest now activates the extension (`onStartupFinished` plus one explicit `onCommand:` event
per registered command) with `extensionKind: ["ui"]`. The manifest alone cannot stop a browser or
forced-remote host, so activation requires **both** `env.uiKind === Desktop` and a UI extension host
(`context.extension.extensionKind === UI`) before constructing the installer controller. Unsupported
hosts register the same commands, report a localized `unavailable` snapshot, and never start a probe
or an install. `env.remoteName` is not a rejection condition: a desktop window with a remote
workspace still operates on, and labels, the local machine.

- Commands: `walker.dotnet.getState`, `walker.dotnet.recheck`, `walker.dotnet.setup`,
  `walker.dotnet.showOutput`, `walker.dotnet.showActions`. `getState` is registered for the
  onboarding client but intentionally not contributed to the palette.
- `walker.dotnet.setup` accepts no parameters by contract: any externally supplied argument is
  forwarded to the core prompter only to be ignored, so no channel, version, or destination can
  bypass the explicit LTS / STS / exact-version chooser and final confirmation.
- The status item shows a localized label per state (including a distinct "another window" label),
  a literal plain-text tooltip with version/executable or failure stage and stable code, and opens the
  actions menu (Setup / Check Again / Show Output as applicable). While another window owns the lock,
  a one-second read-only refresh re-reads state until the foreign operation clears; it never writes.
- Output lines are appended once per snapshot revision and are localized; the presenter surfaces only
  controller-provided diagnostics (already credential-redacted in `src/download.ts`) and never dumps
  environments or credentials. Progress runs under a cancellable notification, and cancellation is
  reported exactly as the controller's terminal snapshot — never as success.
- All presentation strings pass through `vscode.l10n.t` via a narrow facade; manifest strings live in
  `package.nls.json`. Runtime `vscode` use is confined to the facade binding in `src/extension.ts`;
  the presenter and every behavior behind it are covered by plain Node tests.

Unavailable and failed states remain non-blocking: setup failures keep retry/recheck and output
actions, and no startup path performs any install.

## Pinned official installer scripts

Walker never patches or vendors the official installer. `src/scriptSource.ts` pins unmodified
scripts from Microsoft's [`dotnet/install-scripts`](https://github.com/dotnet/install-scripts)
repository at one reviewed immutable commit together with the SHA-256 of the exact bytes:

| Script | Immutable URL | SHA-256 | Bytes |
| --- | --- | --- | ---: |
| `dotnet-install.sh` | `https://raw.githubusercontent.com/dotnet/install-scripts/e5cf1dd2d1540ed05ac84f8eb8c5cdec2807621e/src/dotnet-install.sh` | `082f7685e156738a1b2e2ed8381a621870d4ce8e8c59278034556f05c186eb2e` | 63563 |
| `dotnet-install.ps1` | `https://raw.githubusercontent.com/dotnet/install-scripts/e5cf1dd2d1540ed05ac84f8eb8c5cdec2807621e/src/dotnet-install.ps1` | `3bb07bc8025211836c1e4f9d3f6a044e55b1fb6eec518a6c78851d04e210442b` | 60817 |

- Reviewed commit: `e5cf1dd2d1540ed05ac84f8eb8c5cdec2807621e` (`main` at review time; upstream commit
  is GPG-verified by GitHub).
- Retrieval date: 2026-09-22; digests calculated locally with `sha256sum` over the raw HTTPS bytes.
- Re-verification: `curl -sS <immutable-url> | sha256sum` for each row; the output must equal the
  pin before any pin update is reviewed and landed. `src/test/scriptSource.test.ts` re-checks the
  pin shape offline, and `src/test/download.test.ts` proves a digest mismatch can never write or
  return a script path.
- Pin updates are reviewed maintenance. There is no automatic download or update channel.

## Retrieval trust rules (`src/download.ts`)

`downloadDotnetInstallScript` refuses anything outside the reviewed origin before a request is
made, and only a `downloaded` result carries a script path:

- HTTPS only, expected `raw.githubusercontent.com` host, no URL userinfo, exactly the
  commit-pinned `install-scripts` path, lowercase 40-hex commit and 64-hex digest.
- Zero redirects: a 3xx response is a `redirect` failure, not a hop to follow.
- Exactly HTTP 200; other statuses fail as `http-status`.
- At most 1 MiB (`MAX_SCRIPT_BYTES`) by declared length and by streamed bytes, with the transfer
  aborted as soon as the limit is exceeded.
- 60-second budget (`SCRIPT_DOWNLOAD_TIMEOUT_MS`); offline, TLS-certificate, and timeout failures
  map to distinct stable codes (`offline`, `tls`, `timeout`) for actionable output.
- SHA-256 is computed over the received bytes before any write. Only a digest matching the pin is
  written, exclusively (`wx`) with mode `0600`, into the caller-owned operation directory. Network
  bytes are never piped into a shell, and the returned path is the only file execution may use.
- Cancellation before or during retrieval returns `canceled` and writes nothing.

## Proxy behavior

The extension layer reads only user/machine proxy policy (never workspace install settings) and
passes it in as `src/download.ts`'s `DotnetProxySetting`; PAC and authenticated proxies are
rejected with an unsupported-proxy diagnostic and retry advice, and credentials are redacted from
every diagnostic at one seam. Credential-free `http://`/`https://` proxies are resolved to a
CONNECT target: retrieval tunnels through the proxy with normal certificate verification, the
pinned `.sh` script receives `HTTP(S)_PROXY`/`http(s)_proxy` environment values, and the pinned
`.ps1` script receives `-ProxyAddress` only. `-ProxyUseDefaultCredentials` is never passed and no
proxy setting is persisted.

## Explicit trust limits

- A matching hash is integrity of a reviewed official script, not a signature and not proof of SDK
  payload authenticity. Walker does not claim independent archive signature verification.
- The pinned official script owns SDK-feed retrieval. Its default feeds are HTTPS
  (`builds.dotnet.microsoft.com`, `ci.dot.net`), its reviewed revision does not disable TLS
  validation, and Walker passes no caller-supplied feed URL, credential, runtime-only switch, or
  extra script flag. For the Unix shell installer, Walker creates private operation-scoped `curl`
  and/or `wget` wrappers and prepends their directory only to the installer child `PATH`. The
  wrappers disable user downloader configuration and enforce `--proto '=https'
  --proto-redir '=https'` or `--https-only`; the parent PATH is unchanged, and missing tools or
  wrapper creation errors fail closed. This does not constrain the PowerShell script's direct
  `System.Net.Http.HttpClientHandler` payload requests; HTTPS-to-HTTP redirect rejection for that
  path is not established and remains an explicit Windows security/verification gap.
- Channel dry-run output is parsed as version data only. Payload URLs in that output are never
  evaluated or fetched, and a missing, malformed, prerelease, or conflicting version leaves the
  channel unresolved so setup fails safely instead of accepting an unrelated SDK.
- The default node transport's proxy tunnel and certificate behavior are implemented but only
  exercised through injected transports offline. A live supported-proxy smoke is still required
  before proxy support is claimed.
- Offline tests never touch the network or a real home directory; retrieval tests inject the
  transport, writer, and clock, and the exclusive-writer test uses only the OS temporary root.

## Publication, restoration, and manual recovery (`src/transaction.ts`)

Publication is the only point where `~/.walker/dotnet` changes. Inside the owned operation
directory `<home>/.walker/dotnet-install-<nonce>/` the journal records the step that is about to run
*before* each rename, the pre-existing managed tree is renamed into `backup/` instead of being
deleted, and the staged tree is renamed into `~/.walker/dotnet`. The published managed SDK is then
executed through the injected verifier; only a successful execution is reported Ready. Cancellation
is honored only before the short finalization section begins: once finalization starts it runs to a
verified commit or to a completed restore, and the pre-existing backup is always retained.

When publication or verification fails, Walker restores the pre-publication managed state from the
backup and keeps the whole operation directory for inspection. The journal `step` says what was
true on disk when the failure happened:

| Journal `step` | What is on disk | What happens / what to do |
| --- | --- | --- |
| `preparing` (scaffold) | Managed tree untouched | The failure was before finalization; retry setup. |
| `backup-pending` | Managed tree untouched | Nothing was published; retry setup. |
| `publish-pending` | Managed tree is in `backup/`; `stage/` is intact | Restore `backup/` to `~/.walker/dotnet` before retrying. |
| `verify-pending` | `stage/` is at `~/.walker/dotnet`; `backup/` holds the old tree | Move the failed publication aside, then restore `backup/`. |
| `rollback-pending` | Restoration is in progress | Inspect both locations and restore `backup/` if it still holds data. |
| `rolled-back` | The managed path is back to its pre-publication state | Retry setup; the retained operation directory is disposable. |
| `committed` | Publication verified; `backup/` holds the old SDKs | Setup succeeded; the retained backup may be inspected or deleted by the user. |

If Walker exits during finalization, do not delete or rewrite anything first. Close **all** Walker
windows, confirm no installer process remains, then:

1. `cd ~/.walker` and list `dotnet-install-*/` directories; the `journal.json` inside each one
   names the step and the relative `backup` directory. Only touch the directory matching the
   interrupted operation recorded in the lock metadata.
2. If `backup/` contains data and `~/.walker/dotnet` is missing, move that `backup/` to
   `~/.walker/dotnet` after confirming the directory from step 1.
3. If `~/.walker/dotnet` holds a failed publication and `backup/` holds the old tree, move the
   failed publication aside first (for example to the operation directory's `failed-publication/`),
   then restore `backup/` to `~/.walker/dotnet`.
4. Only after `~/.walker/dotnet` is correct, remove the stale `dotnet-install.lock` directory and
   invoke Recheck.

Retained backups are deliberate: Walker never deletes pre-existing SDK data automatically. After
setup is verified Ready and the old SDKs are no longer wanted, the user may delete the whole
retained `dotnet-install-*/` operation directory (journal, `backup/`, empty `stage/`, downloaded
script). Never delete `~/.walker/dotnet` itself as a cleanup shortcut, and never follow a
`~/.walker/dotnet` symlink.

## D1 packaged verification (Linux, 2026-09-29)

### Build and package evidence

`build/lib/extensions.ts` discovers local extensions from `extensions/*/package.json`, builds standard
`esbuild.mts` extensions, and rewrites a bundled manifest's `main` from `/out/` to `/dist/`. The
static `compilations` array in `build/gulpfile.extensions.ts` separately controls compile/typecheck
coverage; it omitted this extension's `tsconfig.json`. D1 adds that one config to the array so
`build-fast` and extension packaging compile/typecheck the extension instead of relying only on its
local scripts.

The packaged extension at `/home/marialez/Work/VSCode-linux-x64/resources/app/extensions/dotnet-toolchain`
was inspected after Linux packaging reached `package-linux-x64`:

- Packaged `package.json` has `main: "./dist/extension"`, `extensionKind: ["ui"]`, `onStartupFinished`
  and explicit activation events for all five `walker.dotnet.*` commands.
- `dist/extension.js` (70,316 bytes), its source map (338,585 bytes), and `package.nls.json` (342 bytes)
  exist in the package. Manifest localization tokens remain intact and resolve through the packaged
  `package.nls.json` strings.
- `esbuild.mts` selects `src/extension.ts` and `dist/`; `.vscodeignore` excludes source/tests/configs
  while leaving `dist/**`, the manifest, localization, and README packageable.
- `npm run gulp vscode-linux-x64` completed `package-linux-x64` in 26.1 seconds and bundled
  `dotnet-toolchain/esbuild.mts` with zero errors, but the top-level task exited 1 afterward at the
  existing Copilot `prepareBuiltInCopilotRipgrepShim` failure (`extensions/copilot/node_modules/@github/copilot/sdk`
  absent in the package). No Copilot source was changed. The packaged Walker executable and toolchain
  extension artifacts were nevertheless present for the isolated activation smokes below; this is not
  a claim that the entire product package task passed.

### Commands and results

Commands ran from the repository root with Node 24.18.0 first on `PATH`:

| Command | Result |
| --- | --- |
| `npm run test --prefix extensions/dotnet-toolchain` | 258 passing, exit 0; includes packaging-resource assertion and discovery, selection, offline transport, installer, host, and Windows/macOS platform fixtures. |
| `npm run compile --prefix extensions/dotnet-toolchain` | Exit 0. |
| `npx tsc --noEmit -p extensions/dotnet-toolchain/tsconfig.json` | Exit 0; only existing npm warnings for unknown project config keys. |
| `npm run build-fast` | Exit 0 after D1 registration fix; log includes `extensions/dotnet-toolchain/tsconfig.json` with 0 errors. |
| `npm run transpile-client` | Passed in the earlier D1 run. |
| `./scripts/test.sh --run vs/workbench/contrib/welcomeOnboarding/test/common/dotnetToolchain.test` | Passed in the earlier D1 run. |
| `./scripts/test.sh --run vs/workbench/contrib/welcomeOnboarding/test/common/onboardingTypes.test` | Passed in the earlier D1 run. |
| `./scripts/test.sh --run vs/workbench/contrib/welcomeOnboarding/test/browser/onboardingVariationA.test` | Passed in the earlier D1 run. |
| `npm run typecheck-client` | Passed in the earlier D1 run. |
| `npm run gulp vscode-linux-x64` | `package-linux-x64` and .NET bundle/typecheck completed; final exit 1 at the unrelated Copilot shim failure above. |

### Isolated packaged-app results

Each recorded smoke run used the packaged desktop binary, a fresh `--user-data-dir`, a test-only
`--extensions-dir`, `HOME`/XDG/TMP directories under `/tmp`, a minimal system `PATH`,
`--force-disable-user-env`, and telemetry/update/Copilot disabled. A temporary smoke-reader extension
invoked the packaged `walker.dotnet.getState` command and wrote only state snapshots to its own
temporary directory. The recorded runs used `--log error`, never `--log trace --verbose`; the earlier
startup-diagnostic incident is redacted in `apply-progress.md`.

| Scenario | Captured packaged result | Limit |
| --- | --- | --- |
| Runtime-only | An isolated `dotnet` fixture returned runtime 10.0.11 with no SDK; command snapshot was `runtimeOnly`, `local`. | No install started. |
| Split install and restart | A read-only symlink in isolated HOME exposed the pre-existing SDK; snapshot was `ready`, version `10.0.401`, executable `/tmp/walker-dotnet-d1c-split-home-45Xz7C/home/.local/share/dotnet/dotnet`. A second packaged process with a fresh profile and the same isolated HOME returned the same Ready version/path. | This is conventional user-root discovery, not a managed install at `.walker/dotnet`. The target was only read. |
| Canceled chooser | From `runtimeOnly`, the packaged test extension invoked `walker.dotnet.setup`, closed the actual QuickPick with `workbench.action.closeQuickOpen`, and observed `runtimeOnly` afterward. The isolated `~/.walker` contained only Walker's `argv.json`; no install lock or SDK tree was created. | Command-driven cancellation, not a keyboard-driven visual check. |
| Shared-home contention | Two packaged profiles sharing an isolated HOME both reported `installing`, `progress.phase: installing`, `otherWindow: true` against a validated live-owner lock fixture. | The owner was a live test process, not a first Walker installer; no concurrent SDK writers were started. |
| Unavailable extension | Launch with `--disable-extension vscode.dotnet-toolchain` made `walker.dotnet.getState` return `command not found`. | Packaged command unavailability confirmed; rendered onboarding fallback not visually inspected. |

### System before/after evidence and unverified gaps

Read-only checks before and after the D1 runs were identical:

- `which dotnet` → `/home/marialez/.local/share/dotnet/dotnet`.
- `dotnet --list-sdks` → `10.0.401 [/home/marialez/.local/share/dotnet/sdk]`.
- `ls /usr/share/dotnet` → `dotnet`, `host`, `shared`.
- `sha256sum ~/.bashrc` → `e089de15726d7dd70ce2518f8cb857f0c82c3fec4aa0cca576d251bd89aa5b36`.
- During D1, PATH was byte-for-byte identical before/after; no managed install was performed, and the real user SDK, system SDK/runtime directory, shell profile, and PATH were not written. Later remediation smokes used only isolated `/tmp` homes.

R3 remediation evidence (2026-09-30): after explicit user confirmation, packaged LTS setup installed SDK `10.0.401` at the isolated `.walker/dotnet/dotnet`; direct SDK/MSBuild execution and a fresh-profile Ready check passed. The packaged offline attempt truthfully failed at `download/offline` and preserved the managed SDK. The retry confirmation was re-presented after restoring online mode, but no user click arrived within 10 minutes, so retry remains unverified. The extension fixtures cover offline failures, proxy mapping/rejection, Windows/macOS roots, and platform installer arguments, but are not native installer smokes. The successful install followed the user's confirmation; no synthetic confirmation input was sent. The strict localhost CONNECT proxy enforced a four-host official allowlist; traffic was allowed to `raw.githubusercontent.com`, `builds.dotnet.microsoft.com`, and `ci.dot.net`, while `aka.ms` and `redirector.gvt1.com` were blocked before upstream connection. This does not establish general proxy interoperability. Visual unavailable-fallback rendering and native macOS/Windows install/cancel/rename/locality remain unverified. All 38 session-created `/tmp` scratch
roots and every spawned application/proxy process group were removed after evidence capture; exact paths are
listed in `openspec/changes/dotnet-toolchain/apply-progress.md`.
