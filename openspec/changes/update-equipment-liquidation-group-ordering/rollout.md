# Phase 2 Rollout Record

## Deployment

- Date: 2026-07-29 UTC.
- Supabase project: `cdthersvldpnlbvpufrr`.
- Approved local migration:
  `20260729062450_equipment_list_liquidation_chronology.sql`.
- Live migration version: `20260729072002`.
- Live migration name: `equipment_list_liquidation_chronology`.
- Local and recorded statement MD5:
  `087636696f06a1a8fc6117c9e03267a1`.
- Phase 1 implementation: PR #817, merge commit
  `eb180b9d11b5c40e25c068bcd580c8581a162121`.

The first MCP request was rejected before commit because its manually
transcribed ACL signature omitted the final funding-source `text, text[]`
pair. Postgres returned `42883`, and the surrounding transaction rolled back.
The local migration file was unchanged. The exact approved payload was then
applied successfully, and the recorded statement MD5 matches the local file.

## Live Contract

- Exactly one `public.equipment_list_enhanced` overload exists.
- The function has 18 input parameters.
- `p_liquidation_last` defaults to `false`.
- The liquidation priority key precedes the null-safe, trimmed
  `ngay_ngung_su_dung` chronology key.
- The chronology key precedes the requested sort, which precedes `id ASC`.
- The function remains `SECURITY DEFINER` with
  `search_path = public, pg_temp`.
- `authenticated`, `service_role`, and `postgres` have `EXECUTE`.
- `anon` and `PUBLIC` do not have `EXECUTE`.

The chronology key is the decommission date, not equipment `created_at` or a
warehouse-entry timestamp. This distinction was reviewed before authorization.

## Verification

- `equipment_list_enhanced_overload_regression.sql`: passed.
- Transactional liquidation-order smoke: all scenarios passed.
- Smoke fixture cleanup:
  - tenant rows remaining: `0`;
  - `ELE-LIQ-*` equipment rows remaining: `0`.
- Liquidation warehouse baseline before and after rollout:
  - exact liquidation rows: `272`;
  - warehouse rows: `272`;
  - exact liquidation rows with null or blank dates: `72`.
- No data backfill or production-row rewrite occurred.

Security and performance advisors were run after deployment. They returned
project-wide baseline findings unrelated to this ordering-only function
replacement. No finding caused by this migration required a rollout change.
The function's authenticated `SECURITY DEFINER` access remains intentional:
the RPC validates JWT claims and tenant scope before reading data.

## Rollback

Phase 2C passed, so forward rollback tasks 2.15-2.17 are not applicable. If a
future regression requires rollback, create a later migration restoring the
function body from
`20260722094302_equipment_list_liquidation_last.sql`, obtain explicit
operation-specific authorization, then rerun the overload, security, and
ordering checks.
