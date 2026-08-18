# Baseline-Forward Database Quality Gate

## Goal

Validate pending migrations against a disposable clone of the production-derived
Oracle baseline before any separately authorized live apply.

## Required Pre-Live Gate

An exact commit passes only when:

1. Static migration checks pass.
2. Baseline-forward clones `qltbyt_test` into a `dq_baseline_forward_*` database.
3. Only ordered pending migrations are applied.
4. Registered default-safe SQL tests and catalog invariants pass.
5. The immutable report is persisted and disposable cleanup succeeds.

Missing Oracle evidence, failed apply/test, or failed cleanup remains fail-closed.

## Removed Scope

- Fresh replay is not a pre-live lane.
- Full live/bootstrap catalog attestation is not required.
- The schema-only bootstrap SQL and manifest are deleted.
- Legacy migration membership remains protected by
  `supabase/applied-migrations.lock.json`; applied migrations remain immutable.

Fresh reconstruction of legacy history may be designed later as an independent,
non-blocking maintenance project.

## Safety Boundary

The gate may mutate only disposable Oracle `dq_*` databases. It never applies to
live. Every live write still requires explicit permission and Supabase MCP.
