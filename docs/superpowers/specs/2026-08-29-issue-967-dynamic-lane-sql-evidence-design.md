# Issue #967: Dynamic Lane SQL-Test Evidence

## Problem

The baseline-forward dynamic lane records unchanged historical catalog debt as
`WARNING`. Its downstream execution guard currently requires
`state.findings.length === 0`, so a warning suppresses post-migration catalog
collection and all registry-selected `default-safe` SQL tests. The lane can
then aggregate to `PASS` without complete behavioral evidence.

## Behavior Contract

- Historical `WARNING` findings do not suppress post-migration catalog
  collection or selected `default-safe` SQL tests.
- `BLOCKING` findings and incomplete execution state remain fail-closed and
  prevent SQL-test execution.
- The report records the selected SQL-test paths and the paths actually
  attempted. It separately records paths whose executor reached SQL execution;
  a `failed` SQL-test result counts as executed, while pre-execution validation
  failures do not.
- A non-empty selected SQL-test set with incomplete execution evidence produces
  `INCOMPLETE`; it must never aggregate to `PASS`.
- SQL-test failures remain `FAILED`; unavailable, interrupted, timeout, or
  cleanup failures retain their existing `INCOMPLETE` semantics.
- Cleanup, report persistence, and lock release remain unchanged.

## Scope

- Change the dynamic-lane execution state/report contract and its focused tests.
- Do not modify candidate migrations, registries, live Supabase, or the
  persistent Oracle baseline.
- Do not execute the unregistered SQL-test corpus.

## TDD Matrix

| Scenario                                  | Expected behavior                                     |
| ----------------------------------------- | ----------------------------------------------------- |
| Historical warning only                   | Collect final catalog and run every selected SQL test |
| New blocking catalog finding              | Do not run SQL tests; report `FAILED`                 |
| Preflight unavailable                     | Do not create a database; report `INCOMPLETE`         |
| Selected SQL test fails                   | Record execution attempt, clean up, report `FAILED`   |
| Selected SQL test execution is incomplete | Report `INCOMPLETE`, never `PASS`                     |
