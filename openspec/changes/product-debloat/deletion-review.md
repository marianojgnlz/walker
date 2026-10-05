# Deletion Review Decomposition — parent deletion commit dd1a928fd15

Parent record per verify round 1 finding ("the 16,274-line deletion lacks documented bounded review batches"). The physical deletion was a single parent `git rm` executed under the deletion protocol (executor performed all disconnection + absence tests first; manifest recorded in `apply-progress.md`); this document provides the bounded review decomposition so the deletion is reviewable as coherent batches, without a size exception.

## Review batches (review each batch as one ownership-coherent diff)

| Batch | Scope | Files | Lines | Pre-condition evidence |
| --- | --- | ---: | ---: | --- |
| D1 | `extensions/github-authentication/` (entire provider extension) | 49 | −6,673 | A4 leaves: discovery/registration disconnected, absence tests green (`accountFreeApi` GREEN flip) |
| D2 | `extensions/microsoft-authentication/` (entire provider extension) | 43 | −4,797 | A4 leaves: same evidence |
| D3 | `extensions/github/` (entire GitHub integration extension) | 44 | −3,978 | A8 leaves: menu/proposal/build references disconnected, plain-remote dispatch test green |
| D4 | account-policy-gate files (`accountPolicyGate.contribution.ts`, `accountPolicyGateContribution.ts`, `accountPolicyGateContribution.test.ts`) | 3 | −826 | A3 leaves: policy gate unregistered; account-only policy removed, enterprise policy preserved |
| D5 | tooling/config reference cleanup in the same commit (integration runners, skill doc, eslint allowlists, `.vscode-test.js`, launch config) | ~all non-deletion files | small | U01.A4/A8.002 leaf (138 lines incl. its regression tests: git/git-base runners + Git launch target preserved) |

## Review guidance

- Each batch is a whole-ownership deletion whose inbound references were removed and absence-tested in earlier reviewed leaves; the per-file manifest lives in `removal-inventory.md`.
- The 400-line/leaf ceiling applies to authored edits (apply leaves: A4/A8.001–.002 etc., each 120–400 lines incl. tests). Mechanical `git rm` of fully-disconnected trees is recorded here as reviewed-by-batch, per the parent deletion protocol; no `size:exception` is claimed for authored work.
- Post-deletion parent evidence (2026-10-05): `npm run compile-client` PASS · `npm run gulp compile-extensions` PASS · `./scripts/test-integration.sh --suite 'git,git-base'` exit 0.

## Pending U03 physical-deletion batches (parent-owned; no files unlinked here)

These are candidate physical-removal batches only; parent revalidates each inbound-use edge and performs every `git rm`. Retained generic server/Ports/SSH/Agent Host behavior is not included in these candidates.

| Batch | Scope | Files | Tracked lines | Preconditions / review notes |
| --- | --- | ---: | ---: | --- |
| D6 | `src/vs/platform/remoteTunnel/` and `src/vs/workbench/contrib/remoteTunnel/` | 15 | −3,218 | U03.b.001–b.005 disconnect shared-process, Sessions and Chat account-tunnel registrations. Current source scan found no direct imports of these owner roots outside them; the API `extHostTunnelService` / `mainThreadTunnelService` hits are generic tunnel/Ports paths and remain. Reconfirm entrypoints before deletion. |
| D7 | `extensions/tunnel-forwarding/` | 12 | −619 | Product/discovery scan found no active packaging reference beyond the Walker absence regression. Delete the account-authenticated bundled provider and its own manifest/lock only; root Dev Tunnels dependencies stay through U07. |
| D8 | `src/vs/workbench/contrib/chat/electron-browser/media/tunnelHost.css` | 1 | −74 | U03.b.004–b.005 left this stylesheet untouched; its RemoteTunnel view-item consumer is disconnected. Parent owns the unlink. |
| D9 | Disconnected CLI tunnel/service source candidates listed below | 14 | −3,580 | `commands.rs` omits `commands::tunnels`; `tunnels.rs` omits the Dev Tunnel, port-forwarder and WSL-detect modules; singleton CLI module registration is absent. Recheck each member before deletion. `commands/tunnels.rs` (594 lines) and `tunnels/dev_tunnels.rs` (1,358 lines) exceed the 400-line leaf budget and cannot be a single review leaf or receive a size exception. |

D9 exact candidates: `cli/src/commands/tunnels.rs`; `cli/src/tunnels/{dev_tunnels.rs,port_forwarder.rs,wsl_detect.rs,singleton_client.rs,singleton_server.rs,service.rs,service_linux.rs,service_macos.rs,service_windows.rs,nosleep.rs,nosleep_linux.rs,nosleep_macos.rs,nosleep_windows.rs}`. `cli/src/tunnels/local_forwarding.rs` and `cli/src/singleton.rs` are held for a parent generic-consumer decision: the former names local forwarding but depends on the Dev Tunnel `ActiveTunnel`, and the latter is shared singleton IPC. Keep `cli/src/tunnels/{agent_host.rs,agent_host_registry.rs,code_server.rs,control_server.rs,machine_status.rs,paths.rs,protocol.rs}` and generic command-shell/serve-web paths; `control_server.rs` retains `serve_stream` and Agent Host handoff, while `machine_status.rs` retains token-error reporting used by protected `cli/src/auth.rs`.

Do not delete the root `@microsoft/dev-tunnels-*` package/lock entries or Rust `tunnels` crate/lock entries in D6–D9. Their protected Agent Host/auth consumers are a U07 prerequisite, recorded in `removal-inventory.md`.

## U03 parent deletion execution — observed after D6–D9

This section supersedes the preceding **Pending U03 physical-deletion batches** section for the listed paths. The parent reports executing the removals; this executor only inspected the parent-owned index/worktree and did not unlink, stage, or commit files. Read-only `git diff --cached --summary` / `--numstat` confirms the following deletion set:

| Batch | Parent-executed scope | Staged tracked paths | Deleted text lines | Evidence note |
| --- | --- | ---: | ---: | --- |
| D6 | `src/vs/platform/remoteTunnel/` and `src/vs/workbench/contrib/remoteTunnel/` | 15 | 3,218 | All manifest paths show staged deletion. |
| D7 | `extensions/tunnel-forwarding/` | 12 | 619 + one binary | All tracked extension/source/manifest paths show staged deletion; the generated-output directory itself still exists, so physical emptiness is not claimed. |
| D8 | Chat `media/tunnelHost.css` | 1 | 74 | Parent-owned stylesheet deletion is staged. |
| D9 | Original CLI candidate list | 14 | 3,718 | The current staged diff reports `cli/src/commands/tunnels.rs` as 732 lines, not the prior 594-line manifest estimate; no reason for this 138-line delta is inferred. |
| D9 parent-approved additions | Previously held `cli/src/tunnels/local_forwarding.rs` and `cli/src/singleton.rs` | 2 | 549 | Parent reports the generic-consumer review and approval; both paths now show staged deletion. |
| **Observed total** | **D6–D9 plus the two approved CLI additions** | **44** | **8,178 + one binary** | **43 text paths and one binary icon; tracked paths are absent from the current index.** |

The original D9 manifest's 14-file/3,580-line count is superseded by the observed current staged diff (14 files/3,718 lines); adding the two parent-approved holdouts yields 16 CLI files/4,267 lines. The 400-line review ceiling still requires the oversized CLI removals to be reviewed as bounded batches; this aggregate deletion record is not a size exception or a claim that one authored leaf contains the whole deletion. Root Dev Tunnels package/lock entries, the Rust `tunnels` crate, and protected Agent Host/auth paths remain U07 prerequisites. No deletion commit hash is claimed here.
