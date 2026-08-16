# Phase 0 Characterization and RED Contract

Recorded on 2026-08-16 for `add-database-quality-gate`.

## Scope

This checkpoint adds only contract tests and characterization evidence. It does
not add a gate runner, committed registry, migration SQL, CI configuration,
GitHub ruleset change, Oracle mutation, or live Supabase write.

## Repository and Environment Facts

- Root migration inventory:
  - `supabase/migrations` has 330 root SQL files.
  - 41 files use a legacy `YYYYMMDD` prefix, 288 use a
    `YYYYMMDDHHMMSS` prefix, and one uses the noncanonical
    `202511061200` prefix.
  - The legacy date-only prefix has duplicate values; no duplicate 14-digit
    timestamp prefix was observed.
  - The lexical source high-water is
    `20260815105027_harden_device_quota_unlink_contract.sql`.
  - This is characterization only. The future gate must classify source
    membership and ordering deterministically instead of assuming that every
    existing legacy filename is ambiguous.
- Read-only live Supabase inspection found 324 applied migration records with
  high-water `20260816044031`.
- Read-only Oracle inspection found the persistent `qltbyt_test` baseline at
  the same 324-record, `20260816044031` high-water. The self-hosted Supabase
  containers were healthy and PostgreSQL, Kong, and Supavisor listeners
  remained loopback-only.
- Root-source and live record counts/high-waters are intentionally recorded as
  separate facts. The gate must not infer a one-to-one identity mapping from
  filenames or timestamps alone.
- `supabase/tests` contains 89 SQL files. All contain `BEGIN`; 71 contain
  `ROLLBACK`. No SQL test was executed in this phase, and filename conventions
  do not classify a test as default-safe.
- GitHub has one branch ruleset, `my_rules` (ID `12360764`), but it is
  disabled and has no rules.
- Wayfinder #938 is closed as of `2026-08-16T09:29:20Z`. It settles that
  ordinary gate runs operate offline, pre-live uses read-only live comparison,
  and restored-baseline catch-up occurs after a successful live apply using
  migrations already verified as live-applied. Unexplained drift or
  refresh/catch-up failure is fail-closed as `BLOCKING` or `INCOMPLETE`.

## RED Contract

The new suites specify the future runner-neutral modules under
`scripts/db-quality-gate/`:

| Suite                                                | Required behavior                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `database-quality-gate-contract.test.ts`             | Finding classifications, aggregate outcomes, exit codes, deterministic JSON, and Markdown rendering |
| `database-quality-gate-hash.test.ts`                 | One-terminal-newline normalization and content-preserving SHA-256                                   |
| `database-quality-gate-registry.test.ts`             | Applied lock, waiver, invariant, and SQL-test metadata schema contracts                             |
| `database-quality-gate-migration-repository.test.ts` | Legacy mutation/rename/deletion, lock history, pending editability, and ambiguous ordering          |
| `database-quality-gate-baseline.test.ts`             | Identity-based baseline comparison and no-new-regressions behavior                                  |
| `database-quality-gate-approvals.test.ts`            | Candidate evidence, approval-bearing commits, invalidation, expiry, revocation, and review evidence |

Expected RED command:

```bash
node scripts/npm-run.js run test:run -- scripts/__tests__/database-quality-gate-contract.test.ts scripts/__tests__/database-quality-gate-hash.test.ts scripts/__tests__/database-quality-gate-registry.test.ts scripts/__tests__/database-quality-gate-migration-repository.test.ts scripts/__tests__/database-quality-gate-baseline.test.ts scripts/__tests__/database-quality-gate-approvals.test.ts --reporter=verbose
```

Observed result: 6 failed test files and 25 failed tests. Every failure was the
expected `ERR_MODULE_NOT_FOUND` for an unimplemented module under the absolute
repository path `scripts/db-quality-gate/*.ts`. No test compilation, fixture,
or unrelated runtime failure was observed.

The pure outcome/report, hashing, registry, and approval seams are intended for
the Phase 1 contract core. The repository inspection and identity-baseline
seams require the Phase 2 static implementation. Later phases must make these
tests green without weakening the Phase 0 contracts.

## Boundaries Preserved

- No migration source, lock history, Oracle database, GitHub ruleset, or live
  Supabase state was changed.
- The live migration query was read-only through Supabase MCP.
- Oracle access was read-only and did not clone, restore, catch up, or execute
  SQL tests.
- A gate result, approval, merge, or this characterization never authorizes a
  live write.
