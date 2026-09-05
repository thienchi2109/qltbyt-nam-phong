# Issue #989 Exhaustive SQL Sweep Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enumerate all deterministic SQL-test failures in one fail-closed Oracle run.

**Architecture:** Keep the existing sequential, isolated `psql` executions. Continue only after
`kind="failed"`, attach the SQL-test path to each blocking finding, and preserve fail-fast
behavior for missing execution evidence.

**Tech Stack:** TypeScript, Vitest, PostgreSQL 17, Oracle SSH/Docker executor.

---

## Chunk 1: Exhaustive deterministic failure collection

### Task 1: Lock the behavior with tests

**Files:**

- Modify: `scripts/__tests__/database-quality-gate-dynamic-sql-evidence.test.ts`

- [ ] Add a four-test fixture whose second and third tests return `kind="failed"`.
- [ ] Assert RED: all four tests are attempted/executed, which fails under the current
      first-failure break.
- [ ] Assert the desired report remains `FAILED`, includes one path-bound redacted finding per
      failed test, and contains no raw executor error.
- [ ] Add a mixed fixture with `failed`, then `unavailable`, then a final test; assert
      `INCOMPLETE`, the final test is not attempted, and drop/release/persist are all attempted.
- [ ] Run the focused test and verify the new case fails for the missing exhaustive sweep.

### Task 2: Implement the minimum lane change

**Files:**

- Modify: `scripts/db-quality-gate/dynamic-lane.ts`
- Modify: `scripts/db-quality-gate/dynamic-lane-report.ts`

- [ ] Extend safe operation context with an optional SQL-test path.
- [ ] Use that path as deterministic finding subject/evidence for `run-sql-test`.
- [ ] On `kind="failed"`, record execution and continue the loop.
- [ ] On every other error kind, keep the existing incomplete-and-break behavior.
- [ ] Run the focused test and verify GREEN.

### Task 3: Verify and land conditionally

- [ ] Run format, no-explicit-any, diff-only dedupe, typecheck, focused tests, and React Doctor in
      repository order.
- [ ] Commit and push the stacked branch.
- [ ] Run static and baseline-forward against the same exact pushed commit.
- [ ] Inspect the immutable report digest and Oracle cleanup state.
- [ ] Land #957+#989, tick 4.4.1, and close issues only if both exact-commit lanes PASS; otherwise
      retain the branch/issues and report the complete failure set.
