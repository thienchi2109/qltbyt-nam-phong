# Issue 301 Read Prefilter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-only, strict-normalized department scoping for role `user` across the equipment read RPC family in issue `#301`.

**Architecture:** Implement one forward-only SQL migration that adds a shared normalization helper and patches only the read RPCs in scope. Drive the work from a new SQL smoke test that locks the desired read contract first, then verify existing app-side consumers still match the server contract without pulling `#302` or `#303` behavior into this batch.

**Tech Stack:** Supabase Postgres migrations via Supabase MCP, SQL smoke tests via Supabase MCP `execute_sql`, Next.js RPC proxy, React Query hooks, Vitest for focused contract checks

---

## Context Snapshot

- Umbrella tracker: `#305`
- This batch: `#301` `[Equipment] Phase 1 - user department prefilter for read RPCs`
- Keep this batch limited to read-side SQL. Do not implement write guards from `#302` or deep-link `deny + no-open` client behavior from `#303`.
- Policy for role `user` only:
  - strict normalized equality only
  - server-only enforcement
  - missing or blank `khoa_phong` claim fails closed
  - list/filter RPCs fail closed to empty results
  - `equipment_get` / `equipment_get_by_code` fail closed with deny/not-found

## Code Review Graph / Discovery Notes

- `code-review-graph get_minimal_context_tool` was low-signal for SQL symbol scoping in this repo, so use it only as a first-pass map.
- `morph codebase_search` and direct reads narrowed the real SQL family to:
  - `supabase/migrations/20260213095000_equipment_soft_delete_active_reads.sql`
  - `supabase/migrations/20260218203500_fix_ilike_sanitization_equipment_list.sql`
- The existing app blast radius is stable because these RPCs already flow through the proxy allowlist in `src/app/api/rpc/[fn]/allowed-functions.ts`.

## Live DB Findings To Preserve

- Supabase MCP inspection confirms the deployed source of truth already has `SET search_path = public, pg_temp` on every RPC in the `#301` read family.
- `equipment_get` and `equipment_get_by_code` currently:
  - use `allowed_don_vi_for_session()`
  - map `admin -> global`
  - deny with the generic message `Equipment not found or access denied`
- `equipment_list` currently:
  - uses `allowed_don_vi_for_session()`
  - maps `admin -> global`
  - sanitizes search with `_sanitize_ilike_pattern`
  - returns empty for no tenant access rather than JSON error
- `equipment_list_enhanced` currently:
  - uses `allowed_don_vi_for_session_safe()`
  - treats `global` and `admin` together
  - returns JSON `{ data, total, page, pageSize, error }` for tenant-denied / no-tenant-access paths
  - applies all user-selected filters by string-building `v_where`
- Filter-option RPCs currently:
  - use `allowed_don_vi_for_session_safe()`
  - do not map `admin -> global`
  - group on trimmed display labels such as `COALESCE(NULLIF(TRIM(...), ''), 'Chưa ...')`
- `equipment_count_enhanced` is deployed with its own role logic and direct `p_khoa_phong` equality. It remains out of scope for `#301`, but this is the concrete reason the report-count consistency gap exists.

## Blast Radius

### Direct SQL blast radius

- `public._normalize_department_scope(text)` new helper
- `public.equipment_list`
- `public.equipment_list_enhanced`
- `public.equipment_get`
- `public.equipment_get_by_code`
- `public.departments_list_for_tenant`
- `public.equipment_users_list_for_tenant`
- `public.equipment_locations_list_for_tenant`
- `public.equipment_classifications_list_for_tenant`
- `public.equipment_statuses_list_for_tenant`
- `public.equipment_funding_sources_list_for_tenant`

### Direct app consumers

- Equipment page data hook: `src/app/(app)/equipment/_hooks/useEquipmentData.ts`
- Inventory report hook: `src/app/(app)/reports/hooks/use-inventory-data.ts`
- QR exact-code lookup: `src/components/qr-action-sheet.tsx`
- RPC proxy allowlist: `src/app/api/rpc/[fn]/allowed-functions.ts`

### Existing test surfaces worth re-running

- `src/app/(app)/equipment/__tests__/useEquipmentData.test.ts`
- `src/components/__tests__/qr-action-sheet.test.tsx`
- `src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts`
- Existing SQL regression checks near this family:
  - `supabase/tests/equipment_list_enhanced_overload_regression.sql`
  - `supabase/tests/equipment_soft_delete_historical_reads_smoke.sql`

## Known Gaps To Watch

- No SQL smoke test currently locks department-scoped read behavior. Existing coverage is mostly mocked JS behavior, not DB-enforced scope.
- Live DB inspection via Supabase MCP shows the deployed read-family already has `SET search_path`; the new migration must preserve that deployed contract even if older repo migrations show earlier states.
- Role normalization is not perfectly uniform across this family today. Preserve current role contracts for non-`user` roles instead of flattening everything into one new branch.
- `use-inventory-data.ts` combines `departments_list_for_tenant` with `equipment_count_enhanced`; because live DB shows `equipment_count_enhanced` is a separate contract, count consistency must stay a follow-up issue instead of being silently pulled into `#301`.
- `#303` deep-link `deny + no-open` remains out of scope here. This batch only needs the server deny behavior that `#303` will later consume.

## Chunk 1: SQL Read Scope

### Task 1: Write the failing SQL smoke test first

**Files:**
- Create: `supabase/tests/equipment_department_scope_reads_smoke.sql`
- Read: `supabase/tests/equipment_soft_delete_historical_reads_smoke.sql`
- Read: `supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql`
- Read: `supabase/tests/equipment_list_enhanced_overload_regression.sql`

- [ ] **Step 1: Copy the local smoke-test structure from the nearest Supabase SQL smoke tests**

Use the same style for:
- fixture suffixing
- `request.jwt.claims` session setup
- explicit assertion blocks with `RAISE EXCEPTION`
- cleanup

- [ ] **Step 2: Write failing assertions for the read contract in issue `#301`**

Minimum cases to lock:
- role `user`, same tenant + same normalized department:
  - `equipment_list` returns row
  - `equipment_list_enhanced` returns row and correct total
  - `equipment_get` returns row
  - `equipment_get_by_code` returns row
- role `user`, same tenant + different department:
  - `equipment_list` returns empty
  - `equipment_list_enhanced` returns empty payload
  - `equipment_get` raises deny/not-found
  - `equipment_get_by_code` raises deny/not-found
- role `user`, missing or blank `khoa_phong` claim:
  - list RPCs fail closed empty
  - single-item reads deny
- preserve current non-`user` contracts exactly:
  - `equipment_get` / `equipment_get_by_code` still allow `admin` via `admin -> global`
  - `equipment_list_enhanced` still returns existing tenant-denied / no-tenant-access JSON shapes
- filter-option RPCs only reflect the scoped equipment set
- one non-`user` control case proves current behavior is preserved

- [ ] **Step 3: Include normalization edge cases in the same smoke test**

At least one fixture pair must prove:
- trim is ignored
- case is ignored
- repeated internal whitespace collapses

Do not add fuzzy, substring, or accent-insensitive matching expectations.

- [ ] **Step 4: Run the new smoke test and verify RED**

Run via Supabase MCP:
- load the contents of `supabase/tests/equipment_department_scope_reads_smoke.sql`
- execute them with `execute_sql(query: <file contents>)`

Expected:
- FAIL because the helper and department read-scope enforcement do not exist yet

### Task 2: Implement the minimal forward-only migration

**Files:**
- Create: `supabase/migrations/20260422xxxxxx_add_user_department_scope_reads.sql`
- Read: `supabase/migrations/20260213095000_equipment_soft_delete_active_reads.sql`
- Read: `supabase/migrations/20260218203500_fix_ilike_sanitization_equipment_list.sql`
- Read: `supabase/migrations/20260219150500_fix_audit_spoofing_and_search_path.sql`

- [ ] **Step 5: Add `public._normalize_department_scope(text)`**

Implementation contract:
- return `NULL` for null/blank input
- normalize tabs/newlines/NBSP to spaces
- trim outer whitespace
- lowercase
- collapse repeated whitespace to single spaces

- [ ] **Step 6: Patch only the read RPCs in scope**

Required behavior:
- keep existing tenant guard first
- preserve current non-`user` role behavior
- for role `user`, read `khoa_phong` from JWT claims, normalize it, and fail closed when null/empty
- compare against normalized `tb.khoa_phong_quan_ly` with strict equality only
- keep current `_sanitize_ilike_pattern()` handling in `equipment_list` and `equipment_list_enhanced`
- keep `SET search_path = public, pg_temp` on every touched `SECURITY DEFINER` function

Concrete patch rules by deployed function family:
- `equipment_get` / `equipment_get_by_code`:
  - keep the current `allowed_don_vi_for_session()` tenant gate and `admin -> global` mapping
  - after tenant scope but before returning the row, add a role-`user` department check against normalized `tb.khoa_phong_quan_ly`
  - on missing/blank claim or mismatch, raise the same generic deny exception already used today
- `equipment_list`:
  - keep the current `allowed_don_vi_for_session()` and `v_effective` logic
  - for role `user`, add an extra normalized department predicate into `v_sql`
  - if the normalized claim is null, return empty immediately rather than raising
- `equipment_list_enhanced`:
  - keep the current `allowed_don_vi_for_session_safe()` logic and existing JSON error returns for tenant-denied / no-tenant-access paths
  - do not change selected-filter behavior for `p_khoa_phong[_array]`, `p_nguoi_su_dung[_array]`, `p_vi_tri_lap_dat[_array]`, `p_tinh_trang[_array]`, `p_phan_loai[_array]`, `p_nguon_kinh_phi[_array]`
  - for role `user`, append one additional normalized department predicate to `v_where`
  - if the normalized claim is null, return the normal empty payload shape `{ data: [], total: 0, page, pageSize }` without introducing a new `error`
- Filter-option RPCs:
  - keep the current `allowed_don_vi_for_session_safe()` / `v_effective` logic and existing label grouping expressions
  - for role `user`, add the same normalized department predicate directly in the final `WHERE`
  - if the normalized claim is null, return no rows immediately

- [ ] **Step 7: Apply the migration**

Run via Supabase MCP:
- load the contents of `supabase/migrations/20260422xxxxxx_add_user_department_scope_reads.sql`
- apply them with `apply_migration(name: "add_user_department_scope_reads", query: <file contents>)`

Expected:
- migration applies cleanly

- [ ] **Step 8: Re-run the smoke test and verify GREEN**

Run via Supabase MCP:
- re-execute `supabase/tests/equipment_department_scope_reads_smoke.sql` with `execute_sql(query: <file contents>)`

Expected:
- PASS

- [ ] **Step 9: Run post-migration advisor check**

Use Supabase MCP:
- `get_advisors(type: "security")`

Expected:
- no new security regression caused by the migration

### Task 3: Re-run focused app-side contract tests

**Files:**
- Test: `src/app/(app)/equipment/__tests__/useEquipmentData.test.ts`
- Test: `src/components/__tests__/qr-action-sheet.test.tsx`
- Test: `src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts`

- [ ] **Step 10: Run focused tests for direct consumers**

Run:
```bash
node scripts/npm-run.js test -- --run "src/app/(app)/equipment/__tests__/useEquipmentData.test.ts"
node scripts/npm-run.js test -- --run "src/components/__tests__/qr-action-sheet.test.tsx"
node scripts/npm-run.js test -- --run "src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts"
```

Expected:
- PASS

- [ ] **Step 11: Only add or adjust app-side tests if the SQL contract change exposes a real mismatch**

Allowed examples:
- `useEquipmentData` expectations for empty filter-option arrays under scoped user claims
- QR action-sheet handling of deny/not-found wording if the current copy mismatches the SQL error contract

Not allowed:
- implementing `#303` no-open behavior in this batch
- broad UI refactors

- [ ] **Step 12: Commit only the `#301` slice**

```bash
git add supabase/tests/equipment_department_scope_reads_smoke.sql supabase/migrations/20260422xxxxxx_add_user_department_scope_reads.sql
git commit -m "feat: [#301] add user department prefilter for equipment reads"
```

## Done Criteria

- New smoke test was written first and observed RED before implementation
- Read-family RPCs enforce department scope only for role `user`
- Non-`user` roles keep existing behavior
- Filter-option RPCs derive values only from the scoped equipment set
- Single-item reads deny for same-tenant, cross-department role `user`
- No `#302` or `#303` behavior was implemented accidentally
