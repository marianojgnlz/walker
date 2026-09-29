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
  extra script flag. Payload transfers are delegated to the system `curl`/`wget` and the script's
  own redirect/status checks; Walker neither pins nor overrides those clients' redirect protocol
  defaults.
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
