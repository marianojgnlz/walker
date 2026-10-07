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
