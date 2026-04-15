## Why

`nhat_ky_su_dung.tinh_trang_thiet_bi` ghi chung một cột cho cả thời điểm bắt đầu và kết thúc phiên sử dụng. Khi audit/điều tra sự cố, không thể phân biệt thiết bị đang ở trạng thái nào **trước** và **sau** khi sử dụng. Tách thành hai cột riêng biệt (`tinh_trang_ban_dau`, `tinh_trang_ket_thuc`) cho phép theo dõi chính xác tình trạng thiết bị tại mỗi thời điểm.

Issue: Audit requirement from [2026-04-13-usage-log-split-status-audit-plan.md](file:/docs/plans/2026-04-13-usage-log-split-status-audit-plan.md)

## What Changes

- **BREAKING**: None. New columns and RPC params use `DEFAULT NULL`; existing callers are unaffected.
- Add columns `tinh_trang_ban_dau text` and `tinh_trang_ket_thuc text` to `nhat_ky_su_dung`.
- Backfill existing data from legacy `tinh_trang_thiet_bi` column (approximation for historical records).
- Modify `usage_session_start` RPC to accept and validate `p_tinh_trang_ban_dau`, write to the new column, and include it in the JSON response.
- Modify `usage_session_end` RPC to accept and validate `p_tinh_trang_ket_thuc`, write to the new column, include it in the JSON response, and **fix** missing DDL-level `SET search_path = public, pg_temp`.
- **Fix** `usage_session_end` admin role guard: change `v_role <> 'global'` to `NOT v_is_global` to include `admin` role (per repo `isGlobalRole` convention).
- Modify both `usage_log_list` overloads to project the two new fields in JSON response.
- Retain legacy `tinh_trang_thiet_bi` column for backward reads; continue writing to it for backward compatibility until all consumers are migrated.
- Modify frontend dialogs (`start-usage-dialog.tsx`, `end-usage-dialog.tsx`) to use split status fields with free-text + datalist input.
- Update `use-usage-logs.ts` mutation payloads and response parsing.
- Update `database.ts` types with optional new fields.
- Update `usage-history-tab.tsx` to display split status with legacy fallback.
- Update `usage-log-print.tsx` print + CSV with 2 status columns (requires pre-requisite refactor: extract HTML/CSV builders to comply with 350-line file ceiling).

## Capabilities

### New Capabilities
- `usage-log-sessions`: Split initial/final equipment status tracking for usage session audit.

### Modified Capabilities
- None (no existing OpenSpec capability for usage logs).

## Impact

- Affected code:
  - `supabase/migrations/YYYYMMDDHHMMSS_usage_log_split_status_columns.sql` [NEW]
  - `supabase/tests/usage_log_split_status_smoke.sql` [NEW]
  - `src/types/database.ts`
  - `src/hooks/use-usage-logs.ts`
  - `src/components/start-usage-dialog.tsx`
  - `src/components/end-usage-dialog.tsx`
  - `src/components/usage-history-tab.tsx`
  - `src/components/usage-log-print.tsx`
  - `src/components/usage-log-print-html-builder.ts` [NEW — extracted from usage-log-print.tsx]
  - `src/components/usage-log-print-csv-builder.ts` [NEW — extracted from usage-log-print.tsx]
  - `src/components/__tests__/start-usage-dialog.validation.test.tsx` [NEW]
  - `src/components/__tests__/end-usage-dialog.validation.test.tsx` [NEW]
  - `src/components/__tests__/usage-log-print.columns.test.tsx` [NEW]
- Security impact:
  - Fixes `usage_session_end` missing DDL-level `search_path` (currently body-only `set_config`; `pg_proc.proconfig = null`).
  - Fixes `usage_session_end` admin role bypass bug (`v_role <> 'global'` → `NOT v_is_global`).
  - All modified RPCs retain `SECURITY DEFINER`, tenant guards via `allowed_don_vi_for_session()`.
- Performance impact: None. Schema is additive, backfill touches 1 existing row.
- Data impact:
  - Backfill is an approximation: historical records have the same value for both initial and final status. This is documented as an accepted limitation since the original data did not distinguish between the two.
- Pre-requisite refactor:
  - `usage-log-print.tsx` is 491 lines (exceeds 350-line ceiling). Must extract HTML builder and CSV builder into separate files before adding new columns.
- Out of scope:
  - Dropping or deprecating legacy `tinh_trang_thiet_bi` column
  - Adding CHECK constraints on new columns (enforced via RPC validation)
  - Changing the free-text input to a strict enum
