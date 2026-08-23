# Phase 7 Plan: Local Migration Gate

## Objective

Run the existing static Database Quality Gate automatically through local
Lefthook checks whenever a repository diff changes a canonical migration or a
committed DB Quality Gate registry.

## Scope

- Reuse `collectStaticChangedFiles()` for diff detection.
- Reuse `runDatabaseQualityGateCommand(["--lane", "static"])` for validation.
- Add one concise local command that reports `PASS`, `FAILED`, `INCOMPLETE`, or
  `SKIP` without printing the full JSON report.
- Invoke that command from Lefthook `post-commit` and `pre-push`.
- Keep baseline-forward execution as a separate manual Oracle operation.
- Keep `AGENTS.md` and `CLAUDE.md` semantically aligned.

## Non-Scope

- GitHub Actions or other pull-request workflows.
- GitHub rulesets, protected-branch activation, or break-glass procedures.
- Self-hosted runner provisioning.
- Phase 8 implementation.
- Live Supabase writes.
- Oracle restored-baseline mutation.
- Changes to `protected-main.ts` or activation of reconciliation paths that
  require protected Git evidence.

## Implementation Boundary

The local command is an orchestration layer only. It must not duplicate changed
file collection or static-lane policy logic. A missing comparison ref, Git
failure, malformed gate report, or inconsistent outcome/exit code fails closed
as `INCOMPLETE`.

## TDD Checkpoints

### Checkpoint A: Trigger Contract

- A non-DB diff exits successfully with `SKIP`.
- A canonical migration diff runs the static lane.
- Changes to the applied lock, baseline, waiver, invariant, and SQL-test
  registries run the static lane.
- Diff collection failure returns `INCOMPLETE`.

### Checkpoint B: Result Contract

- Static `PASS` exits `0`.
- Static `FAILED` exits `1`.
- Static `INCOMPLETE` exits `2`.
- Outcome and exit-code disagreement returns `INCOMPLETE`.
- Malformed JSON returns `INCOMPLETE`.
- Output includes the report digest and finding counts but excludes individual
  finding records.

### Checkpoint C: Repository Wiring

- The package command invokes only the local wrapper.
- Lefthook invokes the command after commit for immediate feedback and before
  push for enforcement.
- No GitHub workflow or ruleset artifact is added.
- Documentation keeps Oracle baseline-forward manual and preserves all live DB
  authorization boundaries.

## Verification

1. Run the focused local-gate tests.
2. Run the existing changed-file and static-lane tests.
3. Run formatting, explicit-`any`, dedupe, typecheck, and applicable repository
   checks.
4. Run the local hook command on a non-DB diff and a controlled migration-path
   fixture.
5. Run `openspec validate add-database-quality-gate --strict`.
6. Review the final diff against this boundary.
