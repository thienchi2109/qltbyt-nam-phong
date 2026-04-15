## Batch 1: Backend (can deploy independently)

Backend is fully backward-compatible. Old frontend continues working after backend deploy because new RPC params default to NULL → validation skipped → legacy column written as before.

### 1. SQL Smoke Tests (RED)

- [x] 1.1 Create `supabase/tests/usage_log_split_status_smoke.sql` with assertions:
  - Columns `tinh_trang_ban_dau`, `tinh_trang_ket_thuc` exist.
  - `usage_session_start` fails when `p_tinh_trang_ban_dau = ''` (empty string).
  - `usage_session_start` succeeds and writes `tinh_trang_ban_dau`.
  - `usage_session_end` fails when `p_tinh_trang_ket_thuc = ''` (empty string).
  - `usage_session_end` succeeds and writes `tinh_trang_ket_thuc`.
  - Both `usage_log_list` overloads return the 2 new fields.
  - `usage_session_end` has DDL-level `search_path = public, pg_temp`.
  - Backfill: legacy rows populate `tinh_trang_ban_dau`.
  - Backfill: completed sessions populate `tinh_trang_ket_thuc`.
  - JSON response of `usage_session_start` includes `tinh_trang_ban_dau`.
  - JSON response of `usage_session_end` includes `tinh_trang_ket_thuc`.
  - Backward compat: `usage_session_start` with `p_tinh_trang_ban_dau = NULL` (old caller) does NOT raise exception.
  - Admin role: `usage_session_end` tenant guard treats `admin` same as `global`.
- [ ] 1.2 Run smoke test and confirm RED (expected: fail because columns/params don't exist yet).
  Note: skipped after backend implementation was already in place; later GREEN smoke run was executed against the applied migration instead.

### 2. Migration (GREEN)

- [x] 2.1 Create `supabase/migrations/YYYYMMDDHHMMSS_usage_log_split_status_columns.sql` with:
  - `ALTER TABLE` adding 2 new columns.
  - Backfill from `tinh_trang_thiet_bi` (approximation for historical data).
  - Updated `usage_session_start` with new param, validation (skip when NULL, raise when empty), INSERT writing both new + legacy columns, and response.
  - Updated `usage_session_end` with new param, validation, UPDATE, response, DDL-level `SET search_path`, and fixed admin role guard (`NOT v_is_global`).
  - Updated both `usage_log_list` overloads projecting 2 new fields.
  - Proper `GRANT EXECUTE` statements.
- [x] 2.2 Run smoke test and confirm GREEN.
- [x] 2.3 Run `supabase-get_advisors(type='security')` to verify no regressions.
  Note: advisor output still contains pre-existing repo-wide findings, but no new lint was introduced for the split-status migration/functions.

### 3. Backend Verification

- [x] 3.1 All SQL smoke tests pass.
- [ ] 3.2 Security advisors clean.
  Note: not clean at project level because the Supabase advisor still reports pre-existing issues outside this change; verification confirmed no new regression tied to the applied migration.
- [ ] 3.3 Commit: `feat: add usage log split status columns and RPC updates`

---

## Batch 2: Frontend (deploy after Batch 1 is on production)

Start this batch only after Batch 1 migration is deployed. The pre-requisite refactor and frontend changes depend on the new RPC params being available.

### 4. Pre-requisite Refactor

- [ ] 4.1 Extract HTML builder from `usage-log-print.tsx` into `usage-log-print-html-builder.ts` (file is 491 lines, exceeds 350-line ceiling).
- [ ] 4.2 Extract CSV builder from `usage-log-print.tsx` into `usage-log-print-csv-builder.ts`.
- [ ] 4.3 Verify `usage-log-print.tsx` is under 350 lines after extraction; run `typecheck` and focused tests.

### 5. Frontend Tests (RED)

- [ ] 5.1 Create `start-usage-dialog.validation.test.tsx`: block submit when missing initial status; allow when valid.
- [ ] 5.2 Create `end-usage-dialog.validation.test.tsx`: block submit when missing final status; allow when valid.
- [ ] 5.3 Create `usage-log-print.columns.test.tsx`: print HTML + CSV include 2 status columns.
- [ ] 5.4 Run focused tests and confirm RED.

### 6. Frontend Implementation (GREEN)

- [ ] 6.1 Update `database.ts` types: add `tinh_trang_ban_dau?: string | null` and `tinh_trang_ket_thuc?: string | null`.
- [ ] 6.2 Update `use-usage-logs.ts`: mutation payloads and response parsing for start/end.
- [ ] 6.3 Update `start-usage-dialog.tsx`: new `tinh_trang_ban_dau` field (free-text + datalist), Zod validation.
- [ ] 6.4 Update `end-usage-dialog.tsx`: new `tinh_trang_ket_thuc` field (required), Zod validation.
- [ ] 6.5 Update `usage-history-tab.tsx`: display split status with legacy fallback.
- [ ] 6.6 Update `usage-log-print.tsx` + extracted builders: 2 status columns in print table and CSV.
- [ ] 6.7 Run focused tests and confirm GREEN.

### 7. Frontend Verification

- [ ] 7.1 Run `node scripts/npm-run.js run verify:no-explicit-any`
- [ ] 7.2 Run `node scripts/npm-run.js run typecheck`
- [ ] 7.3 Run focused tests: `npm test -- --testPathPattern="usage|print"`
- [ ] 7.4 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
- [ ] 7.5 Run `openspec validate add-usage-log-split-status --strict`
- [ ] 7.6 Commit: `feat: add split status UI for usage log sessions`
