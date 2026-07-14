# P4 Review Findings And Sequential PR Split Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all technically valid Cubic findings on PR #760, freeze a verified P4 snapshot, decompose it into reviewable P4A/P4B/P4C commits, and open only P4A.

**Architecture:** PR #760 remains the stabilization workspace until every valid finding is fixed and verified. The stabilized tree is then decomposed into three atomic commits without changing behavior: P4A owns database and transport contracts, P4B owns client state/cache/conflict behavior, and P4C owns UI and OpenSpec completion. Only one PR is open for review at a time.

**Tech Stack:** Next.js, React, TypeScript, TanStack Query, Vitest, PostgreSQL, Supabase MCP, GitHub CLI.

---

## Chunk 1: Review Stabilization

### Task 1: Freeze And Triage The Nine Cubic Findings

**Files:**

- Inspect: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-save.test.ts`
- Inspect: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineVersions.ts`
- Inspect: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor.ts`
- Inspect: `src/app/(app)/technical-configurations/technical-configuration-baseline-version-state.ts`
- Inspect: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`
- Inspect: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationVersionBar.tsx`
- Inspect: `supabase/migrations/20260714010000_technical_configuration_baseline_locking.sql`

- [x] **Step 1: Capture all nine inline comments and their GitHub IDs**

Run a `gh api repos/thienchi2109/qltbyt-nam-phong/pulls/760/comments --paginate` query through context-mode.

Expected: nine comments from `cubic-dev-ai[bot]`.

- [x] **Step 2: Classify each comment**

Record each as `valid`, `invalid`, `duplicate`, or `informational`, with root-cause evidence and target ownership:

- P4A: database/transport
- P4B: client state/cache
- P4C: UI/workflow

Result: finding 1 is invalid; findings 2-8 are valid; finding 9 identifies a valid
exact-boundary pagination symptom but attributes it to an incorrect per-page total increment.

- [x] **Step 3: Preserve finding 1 as a reasoned rejection unless code evidence changes**

The existing test intentionally uses HTTP 500 plus a conflict-looking message to prove that conflict classification requires both status/code and message. Do not change it merely to satisfy the reviewer.

### Task 2: Fix Version Pagination And Cache Integrity

**Files:**

- Modify: `src/app/(app)/technical-configurations/technical-configuration-baseline-version-state.ts`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineVersions.ts`
- Test: `src/app/(app)/technical-configurations/__tests__/use-technical-configuration-baseline-editor.test.tsx`
- Test: `src/app/(app)/technical-configurations/__tests__/baseline-locking.test.tsx`
- Create or modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-version-state.test.ts`

- [x] **Step 1: Write a failing exact-boundary cache regression test**

Create two fully loaded pages, cache one new version, and assert that the cache does not expose a
redundant next page when its unique loaded version count already reaches the new total.

- [x] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node scripts/npm-run.js run test:run -- \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-version-state.test.ts'
```

Expected: FAIL because `replaceTechnicalConfigurationBaselineVersionInPages()` increments each page independently.

- [x] **Step 3: Stop pagination when loaded unique versions reach the reported total**

Keep the global total consistent across pages and include all loaded pages when deciding whether a
next page remains.

- [x] **Step 4: Write a failing incomplete-page regression test**

Given an empty page whose starting offset is still below `total`, assert that next-page calculation throws `baseline_version_history_incomplete`.

- [x] **Step 5: Run the focused test and confirm RED**

Expected: FAIL because the current helper accepts the inconsistent page.

- [x] **Step 6: Reject inconsistent empty pages**

Add the smallest guard in `getTechnicalConfigurationBaselineNextPage()`.

- [x] **Step 7: Write a failing refresh-preserves-selection regression test**

Load at least two history pages, select a locked version from page 2, refresh page 1, and assert that the selected version and loaded pages remain available.

- [x] **Step 8: Run the hook test and confirm RED**

Expected: FAIL because `replaceVersions()` replaces the infinite cache with page 1 only.

- [x] **Step 9: Merge refreshed page 1 into existing infinite data**

Preserve loaded later pages and replace only page 1. Keep the selected locked version available until a server response explicitly removes it from the complete history.

- [x] **Step 10: Run the focused tests and confirm GREEN**

### Task 3: Fix Lifecycle Conflict And UI Race Handling

**Files:**

- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor.ts`
- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditorTypes.ts`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationVersionBar.tsx`
- Test: `src/app/(app)/technical-configurations/__tests__/baseline-locking.test.tsx`
- Test: `src/app/(app)/technical-configurations/__tests__/use-technical-configuration-baseline-editor.test.tsx`

- [x] **Step 1: Write a failing stale draft-create test**

Reject draft creation with `PT409/stale_revision`; assert conflict state is set and the generic create error is suppressed.

- [x] **Step 2: Run and confirm RED**

- [x] **Step 3: Classify draft-create conflicts consistently**

Reuse `isTechnicalConfigurationBaselineConflict()` in `createDraftMutation.onError`.

- [x] **Step 4: Write a failing locked-refresh rejection test**

Reject `onRefreshVersions()` while a locked version is selected and assert there is no unhandled rejection.

- [x] **Step 5: Run and confirm RED**

- [x] **Step 6: Catch locked refresh failures in the event handler**

Keep the existing hook-owned alert state; do not add duplicate component error state.

- [x] **Step 7: Write failing navigation-during-mutation tests**

Cover save and reload in flight. Assert the history selector and load-more action are disabled and selection cannot be overwritten by a stale completion handler.

- [x] **Step 8: Run and confirm RED**

- [x] **Step 9: Expose one aggregate lifecycle busy flag**

Include create, save, lock, copy, reload, and history-fetch transitions. Use it to block version navigation and load-more actions.

- [x] **Step 10: Run focused tests and confirm GREEN**

### Task 4: Fix Database History Query And Lineage Metadata

**Files:**

- Create: `supabase/migrations/20260714030000_technical_configuration_baseline_history_review_fixes.sql`
- Modify: `src/app/api/rpc/__tests__/technical-configuration-baseline-locking-migration.test.ts`
- Modify: `src/app/(app)/technical-configurations/baseline-types.ts`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationVersionBar.tsx`
- Test: `src/app/(app)/technical-configurations/__tests__/baseline-locking.test.tsx`

- [x] **Step 1: Invoke the Supabase/Postgres best-practices skill**

- [x] **Step 2: Write failing migration-contract tests**

Assert that the superseding migration:

- replaces per-version snapshot calls with set-based aggregation over paged version IDs
- returns `source_version_number`
- preserves `SECURITY DEFINER`
- pins `search_path = public, pg_temp`
- revokes default execution and grants only `authenticated`

- [x] **Step 3: Run migration tests and confirm RED**

- [x] **Step 4: Implement the superseding migration**

Do not edit live migration metadata. Replace the history RPC with one set-based query and extend snapshot output with source version number.

- [x] **Step 5: Add wire type and render lineage without loaded-source lookup**

Render `Sao chép từ phiên bản N` from `source_version_number`.

- [x] **Step 6: Run migration and UI tests and confirm GREEN**

- [x] **Step 7: Stop before live DB apply**

Applying the superseding migration requires a new explicit live-write approval.

### Task 5: Run Full Verification And Resolve Review Threads

**Files:**

- Modify only files needed by valid findings.

- [x] **Step 1: Run repository gates in one context-mode batch**

Run in order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run verify:ts-docstrings
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- <22 technical-configuration test files>
node scripts/npm-run.js run react-doctor
git diff --check
```

- [ ] **Step 2: Reply to each inline thread**

For valid findings, state the regression test and fix. For rejected findings, state the verified technical reason. Reply in the original inline thread.

- [ ] **Step 3: Resolve addressed review threads**

- [ ] **Step 4: Commit and push the stabilization snapshot to PR #760**

## Chunk 2: Sequential PR Decomposition

### Task 6: Freeze And Decompose The Stabilized Tree

**Files:**

- No production behavior changes.

- [ ] **Step 1: Create a backup branch at the stabilized snapshot**

Use a clearly named backup ref and record its commit hash.

- [ ] **Step 2: Create a temporary decomposition branch from the snapshot**

Reset its `HEAD` to updated `origin/main` while retaining the complete snapshot diff in the worktree.

- [ ] **Step 3: Create atomic commit P4A**

Own:

- SQL migrations and phase gate
- migration/RPC contract tests
- RPC proxy allowlist and typed transport contracts
- wire fields required by the database response

- [ ] **Step 4: Create atomic commit P4B**

Own:

- query keys and version-state helpers
- version-history hook
- editor lifecycle/cache/conflict handling
- state and hook regression tests

- [ ] **Step 5: Create atomic commit P4C**

Own:

- version bar and lock dialog
- baseline tab/read-only workflow
- UI interaction tests
- OpenSpec P4 documents/checklists

- [ ] **Step 6: Prove no change was lost**

Run:

```bash
git diff --exit-code <backup-snapshot> HEAD
```

Expected: no output and exit code 0.

- [ ] **Step 7: Run focused gates for each commit boundary**

Each commit must independently typecheck and pass its focused tests when applied in order.

### Task 7: Replace PR #760 With Only P4A

**Files:**

- GitHub metadata only.

- [ ] **Step 1: Close PR #760 as superseded**

Include links to the saved review context and the replacement P4A PR.

- [ ] **Step 2: Push only the P4A branch**

- [ ] **Step 3: Open one PR into `main`**

The PR must:

- contain only P4A
- keep `Closes #746`
- document the already-applied live migration and the pending review-fix migration
- state that P4B/P4C will not open before the preceding PR merges

- [ ] **Step 4: Verify only one P4 PR is open**

- [ ] **Step 5: Stop**

Do not open P4B or P4C until P4A is reviewed and merged.
