# Change: Add Database Quality Gate

## Why

SQL migration review currently depends on scattered static conventions, manual
Oracle checks, and operator knowledge. The repository needs one deterministic,
fail-closed gate that protects applied history, validates pending migrations on
disposable databases, records reusable exact-commit evidence, and preserves the
separate authorization required for every live database write.

## What Changes

- Add a new `database-quality-gate` capability with deterministic finding
  classifications, aggregate outcomes, exit codes, reports, and evidence
  invalidation rules.
- Protect legacy and future applied migration history with a Git cutover and an
  append-only applied-migration lock.
- Add diff-aware static validation for migration source order, hygiene,
  dangerous operations, approvals, waivers, and no-new-regressions baselines.
- Add registry-driven expected-schema, table-security, invariant, and SQL-test
  contracts.
- Add Oracle-hosted baseline-forward and fresh-replay lanes that operate only on
  disposable test databases.
- Add exact landed-commit pre-live review and a fail-closed post-apply
  reconciliation state machine.
- Add Phase 1 repository enforcement through Lefthook, secret-free pull-request
  CI, protected `main`, runbooks, and an Oracle-local scheduled fresh replay
  after a successful manual bootstrap run.
- Keep Phase 2 self-hosted GitHub runner provisioning outside this change until
  the harness is stable and its runner security boundary is separately
  reviewed.

## Impact

- Affected specs:
  - `database-quality-gate` (new capability)
- Anticipated repository areas:
  - `scripts/` gate commands, report rendering, registry validation, and focused
    tests
  - `supabase/applied-migrations.lock.json`
  - `supabase/db-quality-gate-waivers.json`
  - `supabase/db-quality-gate-invariants.json`
  - `supabase/db-quality-gate-tests.json`
  - `package.json`, `lefthook.yml`, and a secret-free pull-request workflow
  - DB Quality Gate and Oracle operations runbooks
- Anticipated Oracle test-environment areas:
  - disposable database orchestration
  - baseline health and migration high-water evidence
  - immutable gate reports
  - a local `systemd` timer enabled only after the first manual fresh replay
    passes
- Live database:
  - this proposal authorizes no live write
  - a gate PASS only permits requesting permission
  - every live write requires a new, explicit, affirmative maintainer permission
    for the exact target and operation in that rollout session
  - silence, prior or blanket permission, PASS, merge, approval, waiver, or a
    scheduled trigger never grants live-write permission
  - any permitted live write must use Supabase MCP
- Implementation:
  - this change contains proposal artifacts only
  - no harness, test implementation, migration, CI configuration, dependency,
    timer, Oracle database mutation, or live database write is included

## Wayfinder Traceability

- Map: https://github.com/thienchi2109/qltbyt-nam-phong/issues/931
- Source decision: https://github.com/thienchi2109/qltbyt-nam-phong/issues/936
- Decision status: Resolved
- Promoted on: 2026-08-16
