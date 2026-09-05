# Issue #989 Exhaustive SQL Sweep Design

## Goal

Make one Oracle baseline-forward run enumerate every deterministic SQL-test failure instead of
stopping at the first failure, while preserving the existing fail-closed and cleanup contracts.

## Scope

- Continue on executor results whose kind is exactly `failed`.
- Record one blocking finding per failed SQL test, bound to its repository path.
- Stop the SQL-test sweep immediately for timeout, unavailable, interrupted, stale-environment,
  disk-pressure, or other non-`failed` execution errors.
- Keep every SQL test in its own `psql` invocation and rollback-owned transaction envelope.
- Keep the disposable database drop, Oracle lock release, and immutable report persistence in the
  existing `finally` path. Attempt every remaining cleanup/report action even when an earlier
  cleanup action fails, and record such failures as `INCOMPLETE`.
- Do not modify individual SQL tests, applied migrations, live Supabase state, #987, or other
  deferred work.

## Data Flow

For each selected test, the lane records it as attempted and calls `runSqlTest`. A successful test
is recorded as executed. A deterministic SQL failure is also recorded as executed, emits a
`dynamic.run-sql-test.failed` finding whose subject and evidence include the test path, and the
loop continues. An infrastructure or contract failure emits its existing finding, marks evidence
incomplete, and terminates the loop.

The aggregate report remains `FAILED` when any deterministic test fails. It can be `PASS` only
when every selected test was attempted and executed with no blocking finding.

## Verification

- RED: a four-test fixture has two deterministic failures and asserts all four tests are
  attempted/executed; the current runner fails this expectation after the first failure.
- GREEN: both failed paths have separate redacted findings and outcome remains `FAILED`.
- A mixed fixture has a deterministic failure followed by an unavailable result and proves the
  sweep stops before the next test while all cleanup/report actions are still attempted.
- Existing tests prove non-`failed` executor errors still stop the sweep as `INCOMPLETE`.
- Run TypeScript gates, focused Vitest, React Doctor, exact-commit static, and Oracle
  baseline-forward on the pushed branch.
