# .NET Toolchain

Built-in Walker extension that establishes local .NET SDK readiness without accounts, elevation,
system-install changes, or workspace configuration. The implementation is landing in review units;
until the command boundary is wired, the manifest stays inert and only pure TypeScript modules plus
offline test suites exist here.

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
