# OpenSpec Change Proposal: Tách trạng thái đầu/cuối cho nhật ký sử dụng

| Field           | Value                                              |
|-----------------|-----------------------------------------------------|
| **Proposal ID** | CP-2026-04-14-usage-log-split-status               |
| **Author**      | GitNexus (automated review + gap resolution)        |
| **Created**     | 2026-04-14                                          |
| **Status**      | DRAFT — awaiting approval                           |
| **Parent Plan** | [2026-04-13-usage-log-split-status-audit-plan.md](file:/docs/plans/2026-04-13-usage-log-split-status-audit-plan.md) |

---

## 1. Motivation

Hiện tại `nhat_ky_su_dung.tinh_trang_thiet_bi` ghi chung một cột cho cả thời điểm bắt đầu và kết thúc phiên sử dụng. Khi audit/điều tra sự cố, không thể phân biệt thiết bị đang ở trạng thái nào **trước** và **sau** khi sử dụng.

## 2. Scope of Change

### 2.1 Database Schema

```sql
-- Bọc trong BEGIN/COMMIT
BEGIN;

ALTER TABLE public.nhat_ky_su_dung
  ADD COLUMN IF NOT EXISTS tinh_trang_ban_dau text,
  ADD COLUMN IF NOT EXISTS tinh_trang_ket_thuc text;

-- Backfill từ legacy column
UPDATE public.nhat_ky_su_dung
SET tinh_trang_ban_dau = tinh_trang_thiet_bi
WHERE tinh_trang_ban_dau IS NULL
  AND tinh_trang_thiet_bi IS NOT NULL;

UPDATE public.nhat_ky_su_dung
SET tinh_trang_ket_thuc = tinh_trang_thiet_bi
WHERE tinh_trang_ket_thuc IS NULL
  AND tinh_trang_thiet_bi IS NOT NULL
  AND trang_thai = 'hoan_thanh';

COMMIT;
```

> **Data type note**: Legacy `tinh_trang_thiet_bi` is `varchar`, new columns are `text`. Functionally equivalent in PostgreSQL.

### 2.2 RPC Changes

#### `usage_session_start`

| Aspect | Before | After |
|--------|--------|-------|
| Params | `p_thiet_bi_id, p_nguoi_su_dung_id, p_tinh_trang_thiet_bi, p_ghi_chu, p_don_vi` | Same + `p_tinh_trang_ban_dau text DEFAULT NULL` |
| Validation | — | `RAISE EXCEPTION` when `p_tinh_trang_ban_dau` is null/empty |
| INSERT | Writes `tinh_trang_thiet_bi` | Also writes `tinh_trang_ban_dau` |
| Response JSON | 10 fields | +1: `tinh_trang_ban_dau` |
| search_path | ✅ DDL-level | ✅ No change |

#### `usage_session_end`

| Aspect | Before | After |
|--------|--------|-------|
| Params | `p_usage_log_id, p_tinh_trang_thiet_bi, p_ghi_chu, p_don_vi` | Same + `p_tinh_trang_ket_thuc text DEFAULT NULL` |
| Validation | — | `RAISE EXCEPTION` when `p_tinh_trang_ket_thuc` is null/empty |
| UPDATE | Writes `tinh_trang_thiet_bi` | Also writes `tinh_trang_ket_thuc` |
| Response JSON | 10 fields | +1: `tinh_trang_ket_thuc` |
| search_path | ❌ Body-only `set_config` | ✅ **Fixed**: DDL-level `SET search_path = public, pg_temp` |

#### `usage_log_list` (both overloads)

| Aspect | Before | After |
|--------|--------|-------|
| Response JSON | No split status | +2 fields: `tinh_trang_ban_dau`, `tinh_trang_ket_thuc` |

### 2.3 Signature Strategy

New params use `DEFAULT NULL` → `CREATE OR REPLACE` preserves existing signature. No `REVOKE`/`DROP` needed. Existing `GRANT EXECUTE` statements remain valid.

### 2.4 Frontend Changes

| File | Change Type | Notes |
|------|-------------|-------|
| `start-usage-dialog.tsx` | MODIFY | New `tinh_trang_ban_dau` field (free-text + datalist) |
| `end-usage-dialog.tsx` | MODIFY | New `tinh_trang_ket_thuc` field (required) |
| `use-usage-logs.ts` | MODIFY | Mutation payloads + response parsing |
| `database.ts` | MODIFY | Add 2 optional fields to `UsageLog` type |
| `usage-history-tab.tsx` | MODIFY | Display split status with legacy fallback |
| `log-template.tsx` | MODIFY | 2-column status in print template |
| `usage-log-print.tsx` | MODIFY | 2-column in table + CSV |
| `usage-log-print-html-builder.ts` | **NEW** | Extracted from `usage-log-print.tsx` |
| `usage-log-print-csv-builder.ts` | **NEW** | Extracted from `usage-log-print.tsx` |

### 2.5 Pre-requisite Refactor

`usage-log-print.tsx` is **491 lines** (exceeds 350-line project ceiling). Must extract HTML and CSV builders before adding new columns.

## 3. Backward Compatibility

| Concern | Mitigation |
|---------|------------|
| Legacy column `tinh_trang_thiet_bi` | Retained for reads; not written by new flow |
| Old sessions without split status | Backfilled from legacy column |
| FE fallback | `usage-history-tab.tsx` reads legacy column when new fields are null |
| RPC callers not sending new params | DEFAULT NULL → existing callers won't break; RPC validation forces new callers to provide values |

## 4. Security Checklist

- [x] `SECURITY DEFINER` on all modified RPCs
- [x] Function-level `SET search_path = public, pg_temp` (fixes `usage_session_end` gap)
- [x] Tenant guards via `allowed_don_vi_for_session()`
- [x] ILIKE sanitization via `_sanitize_ilike_pattern` where applicable
- [x] `GRANT EXECUTE` only to `authenticated` role
- [ ] Post-deploy: run `supabase-get_advisors(type='security')` to verify

## 5. Test Plan

### SQL Smoke Tests (`usage_log_split_status_smoke.sql`)

| # | Assertion |
|---|-----------|
| 1 | Columns `tinh_trang_ban_dau`, `tinh_trang_ket_thuc` exist |
| 2 | `usage_session_start` fails without `tinh_trang_ban_dau` |
| 3 | `usage_session_start` succeeds and writes correct column |
| 4 | `usage_session_end` fails without `tinh_trang_ket_thuc` |
| 5 | `usage_session_end` succeeds and writes correct column |
| 6 | Both `usage_log_list` overloads return 2 new fields |
| 7 | `usage_session_end` has DDL-level `search_path` |
| 8 | Backfill: legacy → `tinh_trang_ban_dau` populated |
| 9 | Backfill: completed sessions → `tinh_trang_ket_thuc` populated |
| 10 | JSON response of `usage_session_start` includes `tinh_trang_ban_dau` |
| 11 | JSON response of `usage_session_end` includes `tinh_trang_ket_thuc` |

### Frontend Tests

| Test File | Assertions |
|-----------|------------|
| `start-usage-dialog.validation.test.tsx` | Block submit when missing; allow when valid |
| `end-usage-dialog.validation.test.tsx` | Block submit when missing; allow when valid |
| `usage-log-print.columns.test.tsx` | Print HTML + CSV include 2 status columns |
| `log-template.columns.test.tsx` | LogTemplate renders 2 status columns |

### Verification Gates

```bash
# TS/TSX quality gates (in order)
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
# Focused tests
npm test -- --testPathPattern="usage|print|log-template"
# React Doctor
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
# Post-DDL security check
supabase-get_advisors(type='security')
```

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Backfill overwrites intentionally-null data | Very Low | Low | Only fills when new column IS NULL |
| Legacy callers break | None | — | DEFAULT NULL preserves old signature |
| `usage-log-print.tsx` refactor introduces regressions | Low | Medium | TDD: write column tests before refactoring |
| Production data (1 row) | None | — | Trivial backfill |

## 7. Rollback Plan

1. Columns are additive — no destructive schema change
2. RPCs can be reverted via `CREATE OR REPLACE` with old body
3. FE changes are isolated to listed files — revert via git

---

> **Next step**: Approve this proposal → begin Phase 1 (SQL smoke tests).
