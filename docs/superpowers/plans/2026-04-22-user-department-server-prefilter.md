# User Department Server Prefilter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce invisible server-owned khoa/phòng scoping for JWT role `user` across equipment reads, deep-link entry points, QR lookup, and workflow mutations without changing behavior for other roles.

**Architecture:** Keep the existing tenant scope as layer 1 and add one stricter layer 2 for role `user` only. The new layer must live in SQL, use strict normalized equality on department names, fail closed on missing `khoa_phong` claims, and never introduce client-side filtering as an enforcement mechanism.

**Tech Stack:** Supabase Postgres migrations, SQL smoke tests in `supabase/tests`, Next.js App Router, React hooks, Vitest, React Doctor.

---

## Scope and constraints

- Only role `user` gets the new department prefilter.
- Match policy is strict normalized equality only: trim, lowercase, normalize tabs/newlines/NBSP to spaces, normalize hyphen separators to spaces, collapse repeated whitespace.
- Do not reuse `src/lib/department-utils.ts` for enforcement.
- List and filter-option RPCs fail closed to empty results.
- Single-item reads and mutations fail closed with deny/not-found behavior, not blank fallbacks.
- Deep-link `?action=create` without `equipmentId` keeps opening a blank create sheet.
- Deep-link `?action=create&equipmentId=X` must not open anything when the server says denied, missing, or unresolved.
- All touched `SECURITY DEFINER` functions must keep `SET search_path = public, pg_temp`.
- Keep the current SQL family patterns:
- Read RPCs stay in the `allowed_don_vi_for_session[_safe]()` style used by the current equipment read surfaces.
- Write RPCs stay in the `current_setting('request.jwt.claims', true)::jsonb` style used by recent repair and transfer workflow migrations.

## File map

- Create: `supabase/tests/equipment_department_scope_reads_smoke.sql`
- Create: `supabase/tests/equipment_department_scope_workflow_guards_smoke.sql`
- Create: `supabase/migrations/20260422123000_add_user_department_scope_reads.sql`
- Modify: `src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts`
- Modify: `src/components/__tests__/qr-action-sheet.test.tsx`
- Modify: `src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts`

## GitHub issue breakdown

- Umbrella tracker: `#305` `[Equipment] User department server prefilter rollout`
- Batch 1: `#301` `[Equipment] Phase 1 - user department prefilter for read RPCs`
- Batch 2: `#302` `[Equipment] Phase 2 - user department prefilter for workflow guards`
- Batch 3: `#303` `[Repair Requests] Phase 3 - deny and no-open create deep-link for out-of-scope equipment`
- Batch 4: `#304` `[Equipment] Phase 4 - QR contract and final verification for department prefilter`

## Recommended execution order

- Finish `#301` first. It establishes the helper and read contract.
- Finish `#302` second. It reuses the same normalization and pushes the guard into write paths.
- Finish `#303` third. It depends on the server deny behavior already existing.
- Finish `#304` last. It is the cleanup and final gate batch.

## Implementation notes for the worker

- Read SQL before editing:
- `supabase/migrations/20260213095000_equipment_soft_delete_active_reads.sql`
- `supabase/migrations/20260218203500_fix_ilike_sanitization_equipment_list.sql`
- `supabase/migrations/20260219150500_fix_audit_spoofing_and_search_path.sql`
- `supabase/migrations/20260415125328_fix_repair_request_snapshot_cluster_and_legacy_nulls.sql`
- `supabase/migrations/20260219032645_fix_workflow_guard_security_and_race.sql`
- Existing frontend behavior to replace:
- `src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts`
- Existing tests that currently lock the wrong behavior:
- `src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts`
- `src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts`
- Existing QR access-denied coverage to extend:
- `src/components/__tests__/qr-action-sheet.test.tsx`

## Chunk 1: SQL Read Scope

### Task 1: Lock the desired read behavior with failing SQL tests

**Files:**
- Create: `supabase/tests/equipment_department_scope_reads_smoke.sql`
- Reference: `supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql`
- Reference: `supabase/tests/equipment_list_enhanced_overload_regression.sql`

- [ ] **Step 1: Write the first failing SQL smoke file**

Cover only read behavior in this file:
- `public._normalize_department_scope(text)` returns normalized text for spacing and case variants.
- `equipment_list` returns rows when normalized JWT `khoa_phong` matches `tb.khoa_phong_quan_ly`.
- `equipment_list` returns zero rows for same-tenant different-department.
- `equipment_list_enhanced` returns `total = 0` and empty `data` for same-tenant different-department.
- `equipment_get` denies same-tenant different-department with `42501`.
- `equipment_get_by_code` denies same-tenant different-department with `42501`.
- `departments_list_for_tenant`, `equipment_users_list_for_tenant`, `equipment_locations_list_for_tenant`, `equipment_classifications_list_for_tenant`, `equipment_statuses_list_for_tenant`, and `equipment_funding_sources_list_for_tenant` only derive values from the already scoped equipment set.
- Missing or blank `khoa_phong` claim for role `user` fails closed.
- Non-`user` roles keep current behavior.

Use fixtures with same-tenant rows whose `khoa_phong_quan_ly` differ only by case and repeated whitespace so the helper behavior is explicit.

- [ ] **Step 2: Run the new smoke test and verify RED**

Run:
Run via Supabase MCP:
- load `supabase/tests/equipment_department_scope_reads_smoke.sql`
- execute with `execute_sql(query: <file contents>)`

Expected:
- FAIL because `_normalize_department_scope` does not exist and current read RPCs do not enforce department scope for role `user`.

- [ ] **Step 3: If the failure is a harness/setup failure, fix only the test harness**

Allowed fixes:
- JWT fixture setup
- test seed data
- test assertions

Not allowed:
- production migration changes before the test fails for the intended reason

### Task 2: Implement the minimal SQL read-side scope

**Files:**
- Create: `supabase/migrations/20260422123000_add_user_department_scope_reads.sql`
- Read: `supabase/migrations/20260213095000_equipment_soft_delete_active_reads.sql`
- Read: `supabase/migrations/20260218203500_fix_ilike_sanitization_equipment_list.sql`
- Read: `supabase/migrations/20260219150500_fix_audit_spoofing_and_search_path.sql`

- [ ] **Step 4: Add the helper and patch only the read RPCs needed by the failing test**

Implement in one forward-only migration:
- `public._normalize_department_scope(text)`
- `equipment_list`
- `equipment_list_enhanced`
- `equipment_get`
- `equipment_get_by_code`
- `departments_list_for_tenant`
- `equipment_users_list_for_tenant`
- `equipment_locations_list_for_tenant`
- `equipment_classifications_list_for_tenant`
- `equipment_statuses_list_for_tenant`
- `equipment_funding_sources_list_for_tenant`

Implementation rules:
- Keep existing tenant guard first.
- Normalize `admin -> global` where that function family already does so.
- For role `user`, extract `khoa_phong` claim from JWT, normalize it, and fail closed on null or empty.
- Compare against normalized `tb.khoa_phong_quan_ly` with strict equality only.
- Preserve `_sanitize_ilike_pattern()` handling already present in `equipment_list` and `equipment_list_enhanced`.
- Do not broaden any role contract.

- [ ] **Step 5: Apply the migration**

Run:
Run via Supabase MCP:
- load `supabase/migrations/20260422123000_add_user_department_scope_reads.sql`
- apply with `apply_migration(name: "add_user_department_scope_reads", query: <file contents>)`

Expected:
- Migration applies cleanly.

- [ ] **Step 6: Re-run the read smoke test and verify GREEN**

Run:
Run via Supabase MCP:
- re-execute `supabase/tests/equipment_department_scope_reads_smoke.sql` with `execute_sql(query: <file contents>)`

Expected:
- PASS

- [ ] **Step 7: Refactor only inside the migration if duplication is obviously harmful**

Allowed:
- local variables for normalized claim reuse
- tiny helper-local cleanup

Not allowed:
- unrelated read RPC rewrites
- fuzzy matching
- client-driven filter parameters

- [ ] **Step 8: Re-run the same smoke test after refactor**

Run the same command as Step 6.

Expected:
- PASS

- [ ] **Step 9: Commit the read-scope slice**

```bash
git add supabase/tests/equipment_department_scope_reads_smoke.sql supabase/migrations/20260422123000_add_user_department_scope_reads.sql
git commit -m "feat: add user department scope to equipment read RPCs"
```

## Chunk 2: SQL Workflow Guards

### Task 3: Lock mutation deny behavior with failing SQL tests

**Files:**
- Create: `supabase/tests/equipment_department_scope_workflow_guards_smoke.sql`
- Reference: `supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql`
- Reference: `supabase/tests/repair_request_lifecycle_audit_smoke.sql`
- Reference: `supabase/tests/transfer_request_lifecycle_audit_smoke.sql`

- [ ] **Step 10: Write the failing workflow-guard smoke file**

Cover only these cases:
- `repair_request_create` returns `42501` for same-tenant cross-department equipment when role is `user`.
- `transfer_request_create` returns `42501` for same-tenant cross-department equipment when role is `user`.
- `maintenance_tasks_bulk_insert` returns `42501` for same-tenant cross-department equipment when role is `user`.
- Missing or blank `khoa_phong` claim for role `user` fails closed.
- Same-department `user` still succeeds.
- Non-`user` roles preserve current behavior.

Also assert no write side effects remain on deny:
- no repair request inserted
- no transfer request inserted
- no maintenance task inserted

- [ ] **Step 11: Run the new workflow smoke test and verify RED**

Run via Supabase MCP:
- load `supabase/tests/equipment_department_scope_workflow_guards_smoke.sql`
- execute with `execute_sql(query: <file contents>)`

Expected:
- FAIL because the workflow RPCs currently stop at tenant scope.

### Task 4: Implement the minimal mutation guard changes in a new migration

**Files:**
- Create: `supabase/migrations/<next_timestamp>_add_user_department_scope_workflow_guards.sql`
- Read: `supabase/migrations/20260415125328_fix_repair_request_snapshot_cluster_and_legacy_nulls.sql`
- Read: `supabase/migrations/20260219032645_fix_workflow_guard_security_and_race.sql`
- Read: `supabase/migrations/2025-09-29/20250927_regional_leader_phase4.sql`

- [ ] **Step 12: Patch `repair_request_create`**

Rules:
- Keep current JWT extraction style.
- Keep `user_id`, `role`, `don_vi`, `regional_leader`, and `FOR UPDATE` behavior intact.
- After locked equipment fetch and tenant guard, add role `user` department equality guard using `_normalize_department_scope`.
- Return `42501` on mismatch or missing claim.
- Do not change repair status-sync logic.

- [ ] **Step 13: Patch `transfer_request_create`**

Rules:
- Keep current audit-field and `P0002` behavior intact.
- Add the same department guard after the locked or selected equipment row is known and tenant scope passes.
- Preserve server-owned audit fields.

- [ ] **Step 14: Patch `maintenance_tasks_bulk_insert`**

Rules:
- Keep current allowed-tenant behavior.
- For each task item with `thiet_bi_id`, fetch the equipment row and enforce the same department scope for role `user`.
- Raise `42501` and insert nothing on mismatch.

- [ ] **Step 15: Apply the updated migration**

Run via Supabase MCP:
- load `supabase/migrations/<next_timestamp>_add_user_department_scope_workflow_guards.sql`
- apply with `apply_migration(name: "add_user_department_scope_workflow_guards", query: <file contents>)`

Expected:
- Migration applies cleanly.

- [ ] **Step 16: Re-run the workflow smoke test and verify GREEN**

Run via Supabase MCP:
- load `supabase/tests/equipment_department_scope_workflow_guards_smoke.sql`
- execute with `execute_sql(query: <file contents>)`

Expected:
- PASS

- [ ] **Step 17: Re-run existing adjacent workflow smokes to catch regression**

Run via Supabase MCP:
- load `supabase/tests/equipment_soft_delete_workflow_guards_smoke.sql`
- execute with `execute_sql(query: <file contents>)`
- load `supabase/tests/repair_request_lifecycle_audit_smoke.sql`
- execute with `execute_sql(query: <file contents>)`
- load `supabase/tests/transfer_request_lifecycle_audit_smoke.sql`
- execute with `execute_sql(query: <file contents>)`

Expected:
- PASS

- [ ] **Step 18: Commit the workflow-guard slice**

```bash
git add supabase/tests/equipment_department_scope_workflow_guards_smoke.sql supabase/migrations/<next_timestamp>_add_user_department_scope_workflow_guards.sql
git commit -m "feat: add user department scope to equipment workflow RPCs"
```

## Chunk 3: Deep Link And QR Client Contracts

### Task 5: Replace the wrong deep-link expectation with failing Vitest coverage

**Files:**
- Modify: `src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts`
- Reference: `src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts`

- [ ] **Step 19: Rewrite the incorrect blank-sheet tests before touching hook code**

Replace the current expectations so that:
- `?action=create` without `equipmentId` still opens a blank sheet.
- `?action=create&equipmentId=X` opens only when `equipment_get` resolves in-scope.
- `?action=create&equipmentId=X` with `null`, access denied, or missing resolution shows the destructive toast, cleans the URL, and does not call `openCreateSheet`.
- pending equipment resolution still blocks the sheet.

Do not remove the race-condition coverage. Update it so terminal missing state means `no open`, not blank open.

- [ ] **Step 20: Run the focused hook test and verify RED**

Run:
```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts'
```

Expected:
- FAIL against the current hook because it still opens a blank sheet on `missing`.

### Task 6: Implement the minimal deep-link hook change

**Files:**
- Modify: `src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts`

- [ ] **Step 21: Patch only the create-intent handling**

Rules:
- Keep assistant-draft fast path.
- Keep plain `?action=create` behavior unchanged.
- For `action=create&equipmentId`, keep waiting on terminal resolution state.
- On terminal `missing` or deny/unresolved path, show the existing destructive toast, clean the URL, and do not open a blank sheet.
- Do not add client-side filtering or extra query parameters.

- [ ] **Step 22: Re-run the hook test and verify GREEN**

Run the same command as Step 20.

Expected:
- PASS

- [ ] **Step 23: Refactor only if the hook now has obvious duplication**

Allowed:
- tiny local helper for cleanup path

Not allowed:
- broader hook restructuring
- unrelated race-condition changes

- [ ] **Step 24: Re-run the hook test after refactor**

Run the same command as Step 20.

Expected:
- PASS

### Task 7: Tighten QR access-denied coverage without inventing new client filtering

**Files:**
- Modify: `src/components/__tests__/qr-action-sheet.test.tsx`
- Reference: `src/components/qr-action-sheet.tsx`

- [ ] **Step 25: Add the strict QR access-denied test first**

Add or extend coverage so that when `equipment_get_by_code` returns access denied:
- access-denied state is rendered
- equipment details are absent
- no action buttons or action path is available

- [ ] **Step 26: Run the focused QR test and verify RED or immediate GREEN**

Run:
```bash
node scripts/npm-run.js run test:run -- src/components/__tests__/qr-action-sheet.test.tsx
```

Expected:
- Either FAIL because the test is stricter than the current UI, or PASS immediately because the UI already behaves correctly.

- [ ] **Step 27: If RED, patch the smallest possible QR UI change**

Rules:
- No new client-side scope logic.
- Only adjust rendering if the test exposed an actual action-path leak.

- [ ] **Step 28: Re-run the QR test**

Run the same command as Step 26.

Expected:
- PASS

- [ ] **Step 29: Commit the client-contract slice**

```bash
git add 'src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts' 'src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts' src/components/__tests__/qr-action-sheet.test.tsx
git commit -m "feat: tighten user department deep-link and QR access behavior"
```

## Chunk 4: Verification And Release Gates

### Task 8: Run the required verification sequence in repo order

**Files:**
- No new files

- [ ] **Step 30: Re-run the new SQL read smoke**

Run via Supabase MCP:
- load `supabase/tests/equipment_department_scope_reads_smoke.sql`
- execute with `execute_sql(query: <file contents>)`

- [ ] **Step 31: Re-run the new SQL workflow smoke**

Run via Supabase MCP:
- load `supabase/tests/equipment_department_scope_workflow_guards_smoke.sql`
- execute with `execute_sql(query: <file contents>)`

- [ ] **Step 32: Run the focused Vitest suites**

```bash
node scripts/npm-run.js run test:run -- 'src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts'
node scripts/npm-run.js run test:run -- src/components/__tests__/qr-action-sheet.test.tsx
```

- [ ] **Step 33: Run the TypeScript verification gates in mandated order**

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
```

- [ ] **Step 34: Run React Doctor diff scan**

```bash
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

- [ ] **Step 35: Run Supabase advisors after the migration**

Use Supabase MCP:
- `get_advisors(type: "security")`

Expected:
- no new security regressions from the touched SQL

- [ ] **Step 36: Final commit if any verification-only fixes were required**

```bash
git add supabase/migrations/20260422123000_add_user_department_scope_reads.sql supabase/migrations/<next_timestamp>_add_user_department_scope_workflow_guards.sql supabase/tests/equipment_department_scope_reads_smoke.sql supabase/tests/equipment_department_scope_workflow_guards_smoke.sql 'src/app/(app)/repair-requests/__tests__/useRepairRequestsDeepLink.test.ts' 'src/app/(app)/repair-requests/_hooks/useRepairRequestsDeepLink.ts' src/components/__tests__/qr-action-sheet.test.tsx
git commit -m "feat: enforce user department server prefilter"
```

## Success criteria

- Role `user` sees only same-tenant, same-department equipment rows after normalization.
- Role `user` cannot deep-link, QR-open, or mutate cross-department equipment inside the same tenant.
- Other roles keep current behavior.
- No client-side enforcement layer is introduced.
- The new smoke tests fail before implementation and pass after implementation.
- The final verification sequence passes in the repo’s required order.

## Known risks to watch during execution

- `equipment_list_enhanced` already contains search and return-shape regressions historically. Do not rewrite more than needed.
- `repair_request_create` has adjacent invariant logic and fail-closed audit behavior. Do not disturb status-sync or audit semantics.
- `transfer_request_create` has server-owned audit-field protections. Do not accidentally re-expose spoofable fields.
- `maintenance_tasks_bulk_insert` currently has less regression coverage than repair and transfer; rely on the new smoke test, not intuition.

Plan complete and saved to `docs/superpowers/plans/2026-04-22-user-department-server-prefilter.md`. Ready to execute?
