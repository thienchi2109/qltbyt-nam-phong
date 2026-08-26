# Technical Configuration Dossier Search Handoff

## Phase 1: Contract Foundation

- Date: 2026-08-26
- Status: merged to `main`
- Landed commit: `2643cff234ba1136c199bad472277bfa4c6bee35`
- Scope completed:
  - reusable normalization and boundary fixtures
  - module-local search constants and deterministic normalizer
  - optional nullable `p_search` RPC argument
  - module-local dossier list query-key builder
- Verification:
  - 11 focused dossier/RPC test files, 82 tests passed
  - format, explicit-`any`, dedupe, typecheck, React Doctor, and strict OpenSpec gates passed
  - database gate skipped as expected because Phase 1 changed no migration or SQL-test registry
- Boundary respected: no SQL, UI, dossier-list caller, or live database changes.

## Phase 2: Database Search Contract

- Date: 2026-08-26
- Status: implementation and review fixes complete; exact-commit static evidence pending
- Branch: `feat/technical-configuration-dossier-search-p2`
- Base commit: `2643cff234ba1136c199bad472277bfa4c6bee35`
- Scope completed:
  - append-only migration with immutable SQL normalization helper
  - defaulted four-argument list RPC replacing the three-argument signature
  - bounded, literal, all-token search across dossier name and device type
  - longest-token GIN candidate selection before all-token filtering
  - deterministic exact/prefix/token ranking and filtered totals
  - two schema-qualified trigram expression indexes
  - static migration contracts plus rollback-only search and delete SQL phase gates
  - unconditional registration of the dossier-search phase gate
- TDD evidence:
  - static RED: 6 of 8 contract tests failed before the migration existed
  - migration skeleton RED: 5 of 8 contract tests failed
  - Oracle RED: the disposable-clone gate failed on the missing four-argument signature
  - focused GREEN: 6 files, 53 tests passed
  - Oracle GREEN after review fixes: migration, search phase gate, and existing delete phase gate passed; the disposable clone was dropped
- Review fixes:
  - production-shaped EXPLAIN now proves both trigram indexes through positive candidate predicates
  - runtime fixtures prove `updated_at DESC, id` tie-break ordering
  - runtime coverage accepts a one-character search
  - helper ACL is revoked after expression-index creation
- Final non-database verification:
  - format, explicit-`any`, dedupe, TypeScript docstrings, and typecheck gates passed
  - 6 focused test files, 45 tests passed
  - React Doctor scored 100/100
  - strict OpenSpec validation passed
- Current database gate status:
  - static: `INCOMPLETE`; expected `DROP FUNCTION` and `GRANT EXECUTE` findings require exact-commit approval evidence, and two JWT-guard findings are analyzer gaps
  - baseline-forward: manual disposable-clone validation passed on the final working-tree bytes; canonical harness evidence remains affected by `#967`
  - aggregate: not yet `PASS`
- Follow-up gate issues:
  - `#966`: recognize pure helpers and prior-migration guard delegation
  - `#967`: do not skip SQL tests for warning-only catalog findings
  - `#958`: refresh stale SQL-test inventory counts
- Boundary respected: no UI or hook changes and no live database write.
- Next entry point:
  - obtain exact-commit approval evidence for the expected dangerous statements
  - rerun the static lane after the analyzer gaps are fixed
  - do not apply the migration to live without separate explicit permission
