# parent-authorization — change `new-project-wizard` (Change 3)

## Surface grant (executors)
- openspec/changes/new-project-wizard/** (all artifacts)
- src/** (the new `src/vs/workbench/contrib/projectWizard/` + welcomeOnboarding contributions + services touched per design.md)
- extensions/dotnet-toolchain/** (through its existing boundary only — contracts/processRunner; no bypassing)
- test surfaces under the touched trees
- package.json / package.nls.json (for the new contribution points)
- Out of scope unless re-authorized: cli/, remote/, build/, other extensions

## Process grants
- Per-unit commits: AUTHORIZED (blanket, this change) — parent executes ALL git operations; subagents NEVER git commit.
- Physical deletion protocol: executors record manifests; parent executes `git rm` of EXACT paths only.
- Review workload: 400 lines/leaf; coupled pairs only via recorded split analysis + parent disposition (no size:exception).
- AFK delegation: blocking envelopes resolved for the recommended/conservative option + recorded below.

## Decisions log
(none yet)

### Decision 1 (2026-10-08): narrow toolchain boundary addition — APPROVED (AFK recommended option)
The toolchain extension's contract (`walker.dotnet.getState`) lacks template operations; the wizard needs them. APPROVED: add narrow internal command(s) that run ONLY validated `dotnet new` operations (template list / help / dry-run / generate) through the extension's existing `createProcessRunner` (shell-free, bounded, environment-sanitizing). Constraints (binding):
- Only the current verified SDK executable is invoked; fixed structured argument arrays; no arbitrary executable; no shell; no network template acquisition.
- Core calls only through the registration contract (the extension owns SDK interaction; the design's boundary principle stands).
- Exact authorized paths (beyond the existing grant): `extensions/dotnet-toolchain/src/contracts.ts`, `extensions/dotnet-toolchain/src/extension.ts`, `extensions/dotnet-toolchain/src/test/contracts.test.ts`, `extensions/dotnet-toolchain/src/test/extension.test.ts`, `extensions/dotnet-toolchain/package.json` (activation/registration only if required); core mirror `src/vs/workbench/contrib/welcomeOnboarding/common/dotnetToolchain.ts`; wizard code/tests under `src/vs/workbench/contrib/projectWizard/**`.
- The command surface is internal to the wizard's use; it does not become a public extension API without a separate decision.

### Decision 2 (2026-10-08): git-init orchestration — APPROVED without a new Git boundary (AFK recommended option)
The `git.init` command cannot receive a target directory (it acts on the active workspace / opens its own picker). DECISION: the wizard's git-init toggle rides the **deferred-continuation mechanism** (the one already built for the toolchain handoff) + the EXISTING `git.init` command with `skipFolderPrompt: true`, executed in the target workspace's window AFTER the open flow: same-window → run after the folder opens; new-window → carry the intent through the deferred continuation and run it in the new window against the freshly-created project folder (always the new workspace root). No `extensions/git/**` edits, no new process boundary, no Git invocation against a pre-existing workspace. The approved scope keeps its git-init toggle.

### Decision 3 (2026-10-08): restore toggle maps to `--no-restore` (no allowlist widening)
The user's approved "dotnet restore toggle" maps to the template-advertised `--no-restore` switch: generation performs restore by default; the toggle skips it. No independent `dotnet restore` process authority is added — the fixed `dotnet new` operation set stays as approved. Restore failures surface through the generation step's output/error reporting (a documented design limitation: restore failure is not separable from generation failure in the report).

### Decision 4 (2026-10-08): deferred-continuation transport is a BUILD item of this change (not pre-existing)
The design's "deferred continuation" is to be CREATED by the open-flow unit (per design.md/tasks.md) — no such transport pre-exists (only `otherWindow` toolchain-ownership reporting exists). The git-init intent (Decision 2) rides it once built. If the transport cannot be built safely within an apply run, the new-window git-init leg records as an explicit partial with the same-window path shipping.

### Goal-state note (2026-10-08): the user chose `/goal-focus` in the parent's structured question. The parent relays that the human goal decision HAS BEEN MADE; goal tooling is parent-managed and must not block SDD execution.

### Decision 5 (2026-10-08): review-split ratification for the two >400-line authored files (NO size exception)
Measured: `browser/projectWizard.ts` 421 lines, `test/common/projectWizardFlow.test.ts` 432 lines (whole files). RATIFIED phase-based review split (review-unit boundaries, not file edits — no test deletion, no source compression):
- **Leaf A** — `browser/projectWizard.ts` lines 1–218 (contracts, type guards, `runTemplateOperation`/`requireReadySdk`, `chooseConfiguration`) + the flow-test hunks covering SDK/readiness/configuration.
- **Leaf B** — `browser/projectWizard.ts` lines 219–421 (`runProjectWizard`: dry-run/generation/output/cancellation/open) + the matching flow-test hunks.
- **Leaf C** — `deferredGitInitialization.ts` (154) + `deferredGitInitialization.test.ts` (117) as their own pair (P3 split analysis stands: machine-scoped, expiring, one-shot, local-folder-only intent).
- **Leaf D** — Welcome/recent integration (`gettingStarted.ts` +37/−17, `gettingStartedContent.ts` +12, `gettingStartedProjectWizard.test.ts` 108).
Every leaf reviews ≤400 changed lines. Toolchain boundary diff (512/17 across 10 tracked files) reviews as its own leaf set.

### Decision 6 (2026-10-08): parent review pass + leaf measurements — RATIFIED
Independent parent review of the two security-relevant leaves (deferred git-init intent mechanics; toolchain boundary command) returned PASS with no required changes (verdicts + findings in `apply-progress.md` § "Parent review"). Measured review leaves: A=218, B=203, C=271, D≈256, boundary-source=212, boundary-tests=112, core-mirror pair=156 — every leaf ≤400 reviewed lines; no size exception. These are parent-supplied review evidence; the verification round independently confirmed the battery results and spec conformance.
