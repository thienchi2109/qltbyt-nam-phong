# P6A Cross-Surface Regression And Server Activation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if
> subagents are available) or superpowers:executing-plans to implement this plan. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Issue:** #894

**Base:** `main@67fd7fecc604eba047543bd713c59792f996c940` after PR #907

**Branch:** `feat/894-p6a-hierarchy-server-activation`

**Goal:** Prove every production technical-configuration reader is hierarchy-aware, then
activate the already-deployed hierarchy authoring and XLSX v2 apply server contracts
without mounting the P6B production controls.

## Discovery And Scope

- AgentMemory confirms P2B deliberately left
  `technical_configuration_baseline_import_apply_v2` fail-closed with
  `PT409 hierarchical_import_apply_not_activated`.
- Code Review Graph narrows the change to the baseline RPC manifests, RPC proxy
  allowlist, activation migration/source contracts, dormant import/authoring harnesses,
  and hierarchy-aware evaluation/comparison/result-export readers.
- GitNexus was stale, so it was reindexed at `67fd7fec`; `AGENTS.md` and `CLAUDE.md`
  were restored immediately afterward.
- Live Supabase read-only inspection confirms:
  - the public v2 apply wrapper is executable by `authenticated` but still raises the
    P2B not-activated error;
  - all seven hierarchy authoring RPCs are deployed but ungranted;
  - the hierarchy-aware evaluation read migration is deployed.
- Issue #903 is in scope because its two stale assertions inspect the exact P6A
  activation contracts. Reconcile the assertions without changing historical
  migrations merely to satisfy stale text.
- Issue #892 remains open only for authorized executable SQL phase gates. Its merged
  code and migration are present on `main` and live Supabase, but the live gates still
  require explicit permission.

## Activation Contract

- Add one superseding migration ordered after
  `20260812140500_technical_configuration_evaluation_hierarchy_order.sql`.
- Replace only the public v2 apply wrapper so it delegates to
  `_technical_configuration_baseline_import_apply_v2`.
- Keep the internal apply function ungranted.
- Grant `EXECUTE` to `authenticated` only for:
  - `technical_configuration_baseline_subgroup_create`
  - `technical_configuration_baseline_subgroup_update`
  - `technical_configuration_baseline_subgroup_delete`
  - `technical_configuration_baseline_subgroups_reorder`
  - `technical_configuration_baseline_hierarchy_criterion_create`
  - `technical_configuration_baseline_hierarchy_criterion_move`
  - `technical_configuration_baseline_hierarchy_criteria_reorder`
- Allowlist the same seven functions in the RPC proxy. The P4C hierarchy save path uses
  all seven, so activating only the four subgroup functions would leave P6B authoring
  partially callable.
- Keep legacy import apply byte/function contracts unchanged.
- Keep both XLSX v2 download actions, hierarchy import, and subgroup authoring absent
  from the production baseline tab until P6B.

## Chunk 1: RED Server Activation Contracts

### RED 1 - Proxy And Migration Contract

- [x] Add the focused failing activation test at
      `src/app/(app)/technical-configurations/__tests__/technical-configuration-hierarchy-activation.test.ts`.
- [x] Assert all seven hierarchy authoring RPCs are in `ALLOWED_FUNCTIONS` and absent
      from `SERVICE_ROLE_RPC_FUNCTIONS`.
- [x] Assert the new migration sorts after the latest hierarchy-aware reader migration.
- [x] Assert the public v2 apply wrapper delegates to the internal atomic apply function
      and no longer contains the P2B not-activated error.
- [x] Assert the internal apply stays ungranted and the public wrapper plus seven
      authoring RPCs grant only `authenticated`.
- [x] Run the focused test and record the expected RED failure.

Run:

```bash
node scripts/npm-run.js exec vitest run \
  src/app/\(app\)/technical-configurations/__tests__/technical-configuration-hierarchy-activation.test.ts
```

### GREEN 1 - Minimal Server Activation

- [x] Move the seven-RPC manifest to the shared baseline RPC owner and preserve the
      existing app-level export for current consumers.
- [x] Add the seven names to the production RPC proxy allowlist.
- [x] Add the superseding P6A migration with explicit revoke/grant statements and a
      secured public v2 apply wrapper.
- [x] Add a rollback-only activation security phase gate that verifies function
      existence, privileges, wrapper delegation, and internal-function isolation.
- [x] Run the focused activation and RPC whitelist tests until green.

## Chunk 2: RED/GREEN Stale Phase Contracts

- [x] Update the P2B apply source-contract test to preserve historical P2B guarantees
      while recognizing that the current client hook now contains the dormant v2 apply
      path.
- [x] Update the P1E subgroup mutation phase assertion to recognize completed P2B and
      completed local P6A verification.
- [x] Run both Issue #903 reproduction files and verify they pass for the canonical
      current phase contract.

Run:

```bash
node scripts/npm-run.js exec vitest run \
  src/app/api/rpc/__tests__/technical-configuration-baseline-hierarchy-apply-migration.test.ts \
  src/app/api/rpc/__tests__/technical-configuration-baseline-subgroup-mutations-migration.test.ts
```

## Chunk 3: Cross-Surface And Browser Regressions

- [x] Exercise both XLSX v2 downloads and assert current-data versus blank-template
      structure, hidden identity, and example-only instructions.
- [x] Exercise small, example-sized, and configured safety-bound workbooks without
      hard-coded business row counts.
- [x] Exercise parse/preview/apply round trips, invalid hierarchy rejection, revision
      retry, and explicit destructive replacement confirmation using the dormant
      hierarchy import harness.
- [x] Exercise subgroup authoring, direct/subgroup criterion movement, ordering, save
      resume, and rollback-safe failure behavior using the dormant authoring harness.
- [x] Exercise aggregate evaluation, hierarchy-aware comparison, and hierarchy-aware
      result export with mixed direct/subgroup criteria.
- [x] Keep production-isolation assertions green for both downloads, hierarchy import,
      and subgroup authoring.
- [ ] Run browser-level narrow and wide viewport checks against the dormant harness or
      the nearest existing browser-capable test surface. Check keyboard operation,
      accessible names, long Vietnamese text, overflow/overlap, and console errors.
- [x] Do not add a production route, feature flag, or mount point solely for testing.

Browser execution note (2026-08-13): the browser-level item above was explicitly skipped
by user instruction. Component and library regressions remain the recorded non-browser
evidence.

## Chunk 4: Local Verification

- [x] Run SQL migration source contracts and rollback-only SQL gate source contracts.
- [x] Run all focused XLSX v2, destructive replacement, hierarchy authoring, aggregate,
      evaluation, comparison, and result-export regressions.
- [x] Run the full technical-configuration app/lib/API regression set.
- [x] Run required TypeScript/React gates in repository order.
- [x] Run React Doctor changed scan.
- [x] Run strict OpenSpec validation.
- [x] Run Code Review Graph changed-file review and GitNexus changed-symbol impact.
- [x] Request independent review and iterate until zero actionable findings.

Required gate order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
# focused and broad Vitest commands
node scripts/npm-run.js run react-doctor
openspec validate revise-technical-configuration-baseline-hierarchy --strict
```

## Chunk 5: Authorized Live Supabase Checkpoint

- [x] Stop and request explicit permission before any live write.
- [x] After permission, apply only the P6A migration through Supabase MCP.
- [x] Run the authorized P5C and P6A executable SQL phase gates through Supabase MCP.
- [x] Verify live privileges, public v2 delegation, internal isolation, and unchanged
      legacy apply contracts.
- [x] Run Supabase security and performance advisors.
- [x] Do not use Supabase CLI.

## Chunk 6: Closeout

- [x] Mark P6A tasks complete only after local regressions, the documented user-directed
      browser omission, and authorized server activation evidence are complete.
- [x] Resolve Issue #903 if both stale assertions are fully covered by this PR.
- [x] Update Issue #892 only if its authorized executable phase gates are completed.
- [x] Commit with Lefthook enabled, pull with rebase, push the branch, and verify it is
      up to date with origin.
- [x] Open a PR to `main` that closes #894 and, if fully resolved, #903.
- [x] Report verification, live DB actions, residual risks, and review status before
      merge. Do not merge without the user's next instruction.
