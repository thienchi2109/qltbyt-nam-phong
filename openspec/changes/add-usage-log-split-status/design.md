## Context

Equipment usage sessions currently record a single `tinh_trang_thiet_bi` (equipment condition) value that serves as both the starting and ending condition. This makes it impossible to determine whether equipment condition changed during a usage session, which is critical for incident audit and accountability.

The existing data:
- 1 row in `nhat_ky_su_dung` with `tinh_trang_thiet_bi = 'Hoạt động'`, `trang_thai = 'hoan_thanh'`.
- 4 RPCs: `usage_session_start`, `usage_session_end`, `usage_log_list` (2 overloads).
- `usage_session_end` has a security gap: uses body-level `set_config` instead of DDL-level `SET search_path`.
- `usage_session_end` has an admin role guard bug: uses `v_role <> 'global'` which bypasses `admin` users.

## Goals / Non-Goals

- Goals:
  - Split status into `tinh_trang_ban_dau` and `tinh_trang_ket_thuc` for audit traceability.
  - Fix `usage_session_end` security gaps (search_path + admin role).
  - Maintain backward compatibility with existing API consumers.
  - Comply with 350-line file ceiling for `usage-log-print.tsx`.

- Non-Goals:
  - Dropping the legacy `tinh_trang_thiet_bi` column.
  - Adding database-level NOT NULL constraints on new columns.
  - Converting free-text status to a strict enum.
  - Migrating other modules to split-status pattern.

## Decisions

- **Column type**: `text` (functionally equivalent to legacy `varchar` in PostgreSQL).
- **Validation strategy**: Enforced via RPC `RAISE EXCEPTION`, not via DB constraints. This allows migration to succeed on historical data that may have NULL status values.
- **Backward compatibility**: New RPC params use `DEFAULT NULL`. When param is NULL (old caller omitted it), validation is **skipped** and RPC writes only the legacy column — no exception. When param is explicitly empty string `''` (new caller error), validation raises exception. Legacy column continues to be written alongside new columns during transition period. This avoids breaking existing consumers while enforcing fail-closed for updated consumers.

- **Input approach**: Free-text with native HTML `<datalist>` for suggestions. No new UI library dependency.
- **Backfill**: Both new columns are populated from `tinh_trang_thiet_bi` for existing rows. This is an **approximation** — historical records didn't distinguish before/after status. `tinh_trang_ket_thuc` is only filled for completed sessions (`trang_thai = 'hoan_thanh'`).
- **File splitting**: `usage-log-print.tsx` (491 lines) must be split before adding columns. Extract `usage-log-print-html-builder.ts` and `usage-log-print-csv-builder.ts`.

## Risks / Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Backfill overwrites intentionally-null data | Very Low | Low | Only fills when new column IS NULL |
| Legacy callers break from validation | Medium | High | Continue writing legacy column; only validate when new param is explicitly provided (or coordinate atomic FE+BE deploy) |
| `usage-log-print.tsx` refactor introduces regressions | Low | Medium | TDD: write column tests before refactoring |

## Migration Plan (2-Batch Deploy)

### Batch 1: Backend (deploy independently)
1. Apply schema migration (additive columns + backfill).
2. Deploy updated RPCs (new params with `DEFAULT NULL`).
3. Verify: old frontend continues working because `NULL` param → skip validation → write legacy column only.

### Batch 2: Frontend (deploy after Batch 1 is on production)
1. Extract `usage-log-print.tsx` builders (pre-requisite refactor).
2. Deploy frontend sending new `p_tinh_trang_ban_dau` / `p_tinh_trang_ket_thuc` params.
3. New columns start getting populated; legacy column also written for transition safety.

### Why backend-first is safe

| State | Old FE + New BE | New FE + New BE |
|-------|----------------|-----------------|
| `usage_session_start` | Sends `p_tinh_trang_thiet_bi` only → param NULL → no exception → legacy column written | Sends both → validation passes → both columns written |
| `usage_session_end` | Same pattern | Same pattern |
| `usage_log_list` | Returns new fields as NULL for old rows (backfilled rows show values) | Reads new fields; fallback to legacy when NULL |

### Rollback
1. Columns are additive — no destructive schema change.
2. RPCs can be reverted via `CREATE OR REPLACE` with old body.
3. FE changes are isolated — revert via git.

## Resolved Questions

- **Validation timing vs backward compat**: Resolved — validation only triggers on empty string `''`, not on NULL (default). Old callers omitting the param continue working. New callers sending empty string get fail-closed. See spec: "Legacy Column Backward Compatibility" requirement.

