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
