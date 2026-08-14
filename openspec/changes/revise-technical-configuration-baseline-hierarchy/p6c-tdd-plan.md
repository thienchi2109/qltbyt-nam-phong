# P6C Authorized Live Acceptance And Closeout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development
> (if subagents are available) or superpowers:executing-plans to implement this
> plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Issue:** #896

**Branch:** `feat/896-p6c-acceptance-closeout`

**Base:** clean `main` at `4f2be3bd638a55fc62e1995b8b78d8b13d8abfc7`

**Goal:** Produce auditable P6C acceptance evidence for XLSX v2 hierarchy
import/copy/lock, document forward recovery for the retired legacy UI path, and
prepare the OpenSpec change for user acceptance without changing the verified P6B
production surfaces.

**Architecture:** Keep P6C artifact-only. Add one static closeout contract test,
one rollback-only SQL smoke script, and one acceptance report. Use the existing
deployed RPCs through Supabase MCP; do not add or replace migrations, functions,
grants, policies, generated types, runtime TypeScript, or React components.

**Tech Stack:** OpenSpec, Vitest, Node.js file contracts, PostgreSQL transaction
smoke SQL, Supabase MCP, GitHub CLI routed through context-mode.

---

## Scope And Constraints

- Issue #896 already exists from the 22-leaf roadmap. Update it instead of
  creating a duplicate.
- P6B is present on `main` through commit `4f2be3bd`. Keep these production
  surfaces unchanged:
  - `src/components/ui/heroui/HeroActionDropdown.tsx`
  - `src/components/equipment/equipment-toolbar.tsx`
  - `src/components/equipment/heroui-pilot/controls.tsx`
  - `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineProductionActions.tsx`
  - the P6B production isolation/download tests and shared dropdown tests
- Do not change evaluation, comparison, result export, version navigation, focus
  mode, inline editing, copy, lock, or reload behavior.
- Browser testing is intentionally skipped because production credentials are
  unavailable. Preserve the existing P6A/P6B browser-task notes and compensate
  with focused production-component coverage plus the complete technical
  configuration regression directory.
- All database operations use Supabase MCP for project
  `cdthersvldpnlbvpufrr`. The Supabase CLI is forbidden.
- Read-only live inspection and advisors may run before authorization. Stop and
  request explicit user permission before the rollback-only import/copy/lock
  transaction because those RPCs write even though the transaction ends in
  `ROLLBACK`.
- Never archive the OpenSpec change, merge the PR, close #896, or mark P6C.3/P6C.4
  complete before independent review, user acceptance, deployment, and final
  `main` synchronization.
- Existing unchecked browser tasks remain unchecked. Do not claim browser
  acceptance from Vitest coverage.

## Planned File Ownership

- Create
  `src/app/api/rpc/__tests__/technical-configuration-baseline-hierarchy-p6c-closeout.test.ts`
  as the RED/GREEN artifact contract.
- Create
  `supabase/tests/technical_configuration_baseline_hierarchy_p6c_live_acceptance.sql`
  as the authorized rollback-only smoke script.
- Create
  `openspec/changes/revise-technical-configuration-baseline-hierarchy/p6c-live-acceptance.md`
  as the durable evidence, rollback, recovery, and handoff record.
- Modify
  `openspec/changes/revise-technical-configuration-baseline-hierarchy/tasks.md`
  only after the corresponding evidence exists.
- Modify this plan to record completed RED/GREEN/verification checkpoints.
- Do not modify any protected P6B production or test file.

## Chunk 1: RED Closeout Contract

### Task 1: Artifact Contract

- [x] Add a focused Vitest contract that requires:
  - the P6C SQL smoke file and acceptance report to exist;
  - exception-safe subtransaction rollback through an intentional sentinel;
  - no `COMMIT`, temporary-table DDL, or persistent DDL/DCL;
  - calls to hierarchy preview/apply v2, baseline copy, and baseline lock;
  - explicit JWT-claim setup and exact copied-version residue assertions;
  - pre-lock/apply hierarchy identity comparison;
  - acceptance-report sections for authorization, live migration state,
    security/performance advisors, XLSX v2 acceptance, protected P6B surfaces,
    browser-test skip, rollback, recovery, review, and merge/deploy blockers.
- [x] Run the focused test and confirm RED because the SQL/report artifacts do not
      exist yet.

RED command:

```bash
node scripts/npm-run.js exec vitest run \
  "src/app/api/rpc/__tests__/technical-configuration-baseline-hierarchy-p6c-closeout.test.ts"
```

## Chunk 2: GREEN Acceptance Artifacts

### Task 2: Rollback-Only Live Smoke

- [x] Reuse deployed RPC signatures and fail-closed claim conventions from the
      existing hierarchy phase gates.
- [x] Select one representative existing draft at runtime; fail closed if no
      suitable draft exists.
- [x] Snapshot the representative draft, run XLSX v2 hierarchy preview/apply,
      lock the source, copy the locked source, lock the copy with its own
      revision, and assert canonical hierarchy identity plus criterion lineage.
- [x] Force both success and failure paths through a PL/pgSQL exception
      subtransaction so all writes roll back before residue verification.
- [x] Retain the original source snapshot and generated copy ID in local state;
      prove the source is restored exactly and the copy plus all five dependent
      baseline tables contain no matching rows after rollback.
- [x] Keep the script deterministic, fixture-scoped, and free of DDL/DCL.

### Task 3: Acceptance Report And Recovery

- [x] Record branch/base/issue, protected-file manifest, and browser-test skip.
- [x] Record the live migration inventory and deployed RPC signatures from
      read-only Supabase MCP inspection.
- [x] Record security/performance advisor output, classifying baseline findings
      separately from P6C regressions.
- [x] Document forward recovery:
  - revert or disable the P6B UI activation through a reviewed code PR;
  - preserve XLSX v2 parser/server compatibility;
  - do not restore duplicate legacy production actions;
  - never drop populated hierarchy data or edit applied migration history;
  - use a separately reviewed forward migration only if a database correction is
    required, with fresh explicit authorization before applying it.
- [x] Record each live authorization and keep acceptance pending until the
      lifecycle-correct rollback-only smoke passes.
- [x] Run the focused contract and confirm GREEN.

## Chunk 3: Authorized Live Acceptance

### Task 4: Read-Only Preflight

- [x] Inspect live migration ordering, relevant table counts, deployed function
      signatures, and representative draft availability through Supabase MCP.
- [x] Run security and performance advisors through Supabase MCP.
- [x] Update the report with exact timestamps and evidence.

### Task 5: Explicit Permission Boundary

- [x] Present the exact rollback-only operation to the user and ask:
      `Việc này cần ghi vào live DB qua Supabase MCP. Anh có cho phép tôi thực hiện không?`
- [x] Do not execute the smoke SQL until the user gives affirmative permission for
      this specific transaction.

### Task 6: Live Smoke Execution

- [x] After authorization, execute the smoke SQL only through Supabase MCP.
- [x] Confirm import preview/apply, copy, and lock assertions passed.
- [x] Confirm the transaction rolled back and no residual smoke rows remain.
- [x] Re-run security and performance advisors and update the report.
- [x] Mark P6C.1 and P6C.2 complete only when their evidence is recorded.

## Chunk 4: Regression And Review

### Task 7: Focused Protected-Surface Regression

- [x] Run the new P6C closeout contract.
- [x] Run the existing P6B shared dropdown and production activation tests.
- [x] Run the existing hierarchy download/import/authoring tests.

Focused command:

```bash
node scripts/npm-run.js exec vitest run \
  "src/app/api/rpc/__tests__/technical-configuration-baseline-hierarchy-p6c-closeout.test.ts" \
  "src/components/ui/heroui/__tests__/HeroActionDropdown.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-download-actions.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-lifecycle.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-large-preview.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-import-production-isolation.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-controls.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-entry.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-hierarchy-authoring-workflow.test.tsx" \
  "src/lib/__tests__/technical-configuration-baseline-excel.test.ts"
```

### Task 8: Broad Regression And Required Gates

- [x] Run the complete technical-configuration test directory and inspect
      evaluation, comparison, export, copy, lock, navigation, and reload failures.
- [x] Run the final repository verification chain in mandated order through one
      `ctx_batch_execute` call:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js exec vitest run \
  "src/app/(app)/technical-configurations/__tests__"
node scripts/npm-run.js run react-doctor
node scripts/npm-run.js run build
openspec validate revise-technical-configuration-baseline-hierarchy --strict
git diff --check
```

### Task 9: Independent Review To Zero Findings

- [x] Run Code Review Graph change detection and GitNexus changed-file impact.
- [x] Dispatch an independent specification/code reviewer with the exact diff,
      P6C constraints, live evidence, and protected-file manifest.
- [x] Triage every finding; fix valid findings and rerun affected checks.
- [x] Repeat independent review on the final evidence-updated diff until the
      reviewer returns zero findings.

## Chunk 5: PR Handoff Before Merge

### Task 10: Issue And PR

- [x] Update #896 to match the canonical P6C tasks and link this plan.
- [ ] Commit with Lefthook enabled, push the branch, and open a PR to `main`.
- [ ] Report focused, broad, gates, React Doctor, OpenSpec strict, advisor, live
      smoke, and review evidence before merge.
- [ ] Leave P6C.3/P6C.4, issue closure, OpenSpec archive, merge, deployment, branch
      cleanup, and final `main` synchronization pending for explicit user acceptance.
