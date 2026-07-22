# Equipment Liquidation-Last Ordering TDD Plan

> **For Codex:** Execute with `superpowers:test-driven-development`, then
> `superpowers:verification-before-completion`. Invoke
> `supabase-postgres-best-practices` before SQL changes,
> `build-web-apps:react-best-practices` before React changes, and
> `code-deduplication` before adding the transition helper.

**Goal:** On the main Equipments table only, place equipment at the end of the
server-paginated result when both of these conditions are true:

- `tinh_trang_hien_tai = 'Ngưng sử dụng'`
- `khoa_phong_quan_ly = 'VT-TBYT- KHO THANH LÍ'`

After a successful edit that transitions an equipment item into that state,
show one informational toast explaining why the row moved. Do not navigate the
user to the last page.

**Architecture:** Extend the shared `equipment_list_enhanced` RPC with one
backward-compatible boolean parameter defaulting to `false`. Only
`useEquipmentData`, which owns the main Equipments table query, sends `true`.
When enabled, the RPC prepends a fixed two-condition priority expression before
the requested sort and before pagination. Other RPC consumers retain their
current ordering. The detail dialog computes the before/after transition and
passes an optional per-mutation success-toast override to the existing update
hook.

**Tech Stack:** Supabase Postgres, SQL migrations and smoke tests, Next.js,
React, TanStack Query, Vitest, Testing Library.

## Locked Acceptance Criteria

1. A row moves to the end only when both required field values match.
2. Matching only the status or only the department does not change priority.
3. Priority is applied before `OFFSET/LIMIT`, so matching rows move to the end
   of the complete filtered result, not merely the current browser page.
4. The priority remains primary when the user selects another sortable column;
   the selected sort remains secondary within normal and liquidation groups.
5. Only the main Equipments table enables the behavior.
6. Export, transfer dialogs, maintenance task selection, cached searches, and
   other `equipment_list_enhanced` callers retain current ordering.
7. A special toast is shown only when an edit transitions from a non-matching
   state into the matching state.
8. The special toast replaces the generic success toast; exactly one success
   toast is emitted.
9. Editing unrelated fields on an item already in the matching state shows the
   existing generic success toast.
10. Failed updates show only the existing error toast.
11. The page remains on its current pagination state; it does not navigate to
    the last page.

## Non-Goals

- Do not automatically set the status when the department changes, or vice
  versa.
- Do not add an alert dialog or confirmation step.
- Do not change exports or other equipment selectors to use the special order.
- Do not add a department table, stable department ID, tenant setting, or fuzzy
  matching rule.
- Do not apply a migration or run write-based smoke fixtures against live
  Supabase without explicit user permission for those operations.

## Deploy-Safe Boundary

The database phase must be deployed before the client phase:

1. The new RPC parameter defaults to `false`, so the migrated RPC remains
   compatible with the currently deployed application.
2. The client phase sends `p_liquidation_last: true`; it must not be deployed
   before the new RPC signature exists on live Supabase.
3. If application deployment is coupled to merge, apply and verify the
   migration before merging/deploying the client commit.

## Task 1: RED - Lock The Migration Contract Locally

**Files:**

- Create:
  `src/app/api/rpc/__tests__/equipment-list-liquidation-order-migration.test.ts`
- Planned migration:
  `supabase/migrations/20260722094302_equipment_list_liquidation_last.sql`
- Reference:
  `supabase/migrations/20260704074500_align_equipment_list_filters_with_bucket_labels.sql`

**Step 1: Write the failing source-contract test**

The test must locate exactly one migration ending in
`equipment_list_liquidation_last.sql` and assert:

- it sorts after
  `20260704074500_align_equipment_list_filters_with_bucket_labels.sql`;
- it drops the old 17-argument signature before creating the replacement;
- the replacement has one final parameter:
  `p_liquidation_last boolean DEFAULT false`;
- the function remains `SECURITY DEFINER`;
- it retains `SET search_path = public, pg_temp`;
- the priority expression is conditional on `p_liquidation_last`;
- the expression joins the status and department predicates with `AND`;
- the canonical database label is `VT-TBYT- KHO THANH LÍ`;
- department comparison uses strict normalized equality through
  `public._normalize_department_scope`, not `LIKE`, `ILIKE`, or frontend fuzzy
  matching;
- the priority expression occurs before the dynamic requested sort;
- `OFFSET` and `LIMIT` occur after the complete order;
- execute privileges are revoked from `PUBLIC` and `anon`, and granted only to
  `authenticated` for the new 18-argument signature.

Use `existsSync`/`readFileSync` and explicit source-order assertions, following
the existing migration contract tests in `src/app/api/rpc/__tests__`.

**Step 2: Run the focused test and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/equipment-list-liquidation-order-migration.test.ts
```

Expected: FAIL because the planned migration file does not exist.

## Task 2: RED - Specify Server Ordering Across Pagination

**Files:**

- Create:
  `supabase/tests/equipment_list_enhanced_liquidation_order_smoke.sql`
- Reference:
  `supabase/tests/equipment_list_enhanced_active_repair_smoke.sql`
- Modify:
  `supabase/tests/equipment_list_enhanced_overload_regression.sql`

**Step 1: Write the transactional SQL smoke test**

Use `BEGIN`/`ROLLBACK`, tenant-scoped JWT fixtures, and inserted equipment rows
whose insertion order would otherwise put liquidation rows first.

Create fixtures for:

1. both conditions match;
2. status matches but department does not;
3. department matches but status does not;
4. neither condition matches;
5. a second both-condition row to verify stable ordering inside the final
   group.

Assertions:

- with `p_liquidation_last => false`, `id.asc` retains normal ID order;
- with `p_liquidation_last => true`, both-condition rows occur after every
  non-matching row;
- the two one-condition fixtures remain in the normal group;
- with a page size that splits normal and liquidation groups, page 1 contains
  only normal-priority rows and the final page contains both-condition rows;
- with `ten_thiet_bi.desc`, liquidation priority remains primary and name
  ordering remains secondary inside each group;
- total count remains unchanged.

**Step 2: Update the overload regression expectation**

Change the documented contract from 17 parameters to 18 and assert:

```sql
pg_get_function_identity_arguments(p.oid)
  LIKE '%p_liquidation_last boolean%'
```

Continue asserting that exactly one `equipment_list_enhanced` function exists
and that no legacy `p_fields` overload remains.

**Step 3: Do not execute this smoke test yet**

The smoke test performs inserts inside a rolled-back transaction. It still
counts as a live database write and requires explicit permission before
execution through Supabase MCP.

## Task 3: GREEN - Implement The Backward-Compatible RPC Flag

**Files:**

- Create:
  `supabase/migrations/20260722094302_equipment_list_liquidation_last.sql`
- Verify against live:
  `public.equipment_list_enhanced`

**Step 1: Re-read live truth before writing**

Through read-only Supabase MCP SQL:

- fetch `pg_get_functiondef` for the sole deployed
  `equipment_list_enhanced` signature;
- verify it still matches the latest local migration's filters, JWT guards,
  grants, and active-repair JSON field;
- if live has drifted, base the replacement on live behavior and reconcile the
  local source instead of copying stale migration text.

**Step 2: Replace the sole signature**

Inside one transaction:

1. Drop the exact old 17-argument signature.
2. Recreate the function with the same first 17 parameters and append:

```sql
p_liquidation_last boolean DEFAULT false
```

3. Preserve all existing auth claims, tenant/department scoping, filter
   buckets, ILIKE sanitization, JSON fields, `SECURITY DEFINER`, and
   `search_path`.

Do not leave both 17- and 18-argument overloads. Calls that omit the new final
defaulted argument must continue resolving to the sole function.

**Step 3: Build the order fragment from fixed/validated values**

Keep the current order unchanged when the flag is false.

When the flag is true, generate the equivalent of:

```sql
CASE
  WHEN public._normalize_department_scope(tb.khoa_phong_quan_ly)
         = public._normalize_department_scope('VT-TBYT- KHO THANH LÍ')
   AND btrim(tb.tinh_trang_hien_tai) = 'Ngưng sử dụng'
  THEN 1
  ELSE 0
END ASC,
tb.<validated_sort_column> <validated_sort_direction>,
tb.id ASC
```

The sort column must remain allowlisted and the direction restricted to
`ASC`/`DESC`. Do not concatenate user-provided SQL fragments.

**Step 4: Restore explicit grants**

For the new 18-argument signature:

```sql
REVOKE ALL ON FUNCTION public.equipment_list_enhanced(...) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equipment_list_enhanced(...) FROM anon;
GRANT EXECUTE ON FUNCTION public.equipment_list_enhanced(...) TO authenticated;
```

**Step 5: Run the source-contract test and verify GREEN**

Run the Task 1 command again.

Expected: PASS. The SQL behavioral smoke test remains deferred until live-write
permission is granted.

## Task 4: RED/GREEN - Enable The Flag Only On Main Equipments

**Files:**

- Modify:
  `src/app/(app)/equipment/__tests__/useEquipmentData.test.ts`
- Create:
  `src/app/(app)/equipment/__tests__/equipment-liquidation-order-scope.test.ts`
- Modify:
  `src/app/(app)/equipment/_hooks/useEquipmentData.ts`
- Reference:
  `src/app/(app)/equipment/_hooks/useEquipmentExport.ts`
- Reference:
  `src/components/transfer-dialog.data.ts`
- Reference:
  `src/hooks/useAddTasksEquipment.ts`
- Reference:
  `src/hooks/use-cached-equipment.ts`

**Step 1: Write failing client-scope tests**

Add a focused `useEquipmentData` assertion that the main list RPC receives:

```typescript
p_liquidation_last: true
```

Also assert the query-key options include:

```typescript
liquidationLast: true
```

Create a compact source-scope regression test that asserts:

- `useEquipmentData.ts` contains exactly one enabled flag;
- export, transfer dialog, add-tasks, and cached equipment sources do not pass
  `p_liquidation_last: true`.

**Step 2: Run and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/app/\(app\)/equipment/__tests__/useEquipmentData.test.ts \
  src/app/\(app\)/equipment/__tests__/equipment-liquidation-order-scope.test.ts
```

Expected: FAIL because the main query does not send the flag.

**Step 3: Implement the minimal client change**

In the main equipment query only:

```typescript
queryKey: [
  "equipment_list_enhanced",
  {
    // existing scope, pagination, and sort fields
    liquidationLast: true,
  },
]
```

and:

```typescript
args: {
  // existing RPC arguments
  p_liquidation_last: true,
}
```

Do not add the flag to export or any shared selector.

**Step 4: Run and verify GREEN**

Run the Task 4 focused command again.

Expected: PASS.

## Task 5: RED/GREEN - Define The Exact Transition Predicate

**Files:**

- Create:
  `src/components/equipment-edit/EquipmentEditTransitions.ts`
- Create:
  `src/components/equipment-edit/__tests__/EquipmentEditTransitions.test.ts`
- Reference:
  `src/components/equipment-edit/EquipmentEditTypes.ts`

**Step 1: Search for equivalent logic**

Use Code Review Graph/GitNexus/`rg` to confirm there is no existing predicate
with the same business meaning. Do not reuse `isDepartmentMatch`; it performs
partial/fuzzy matching and is broader than this requirement.

**Step 2: Write failing table-driven tests**

Test `didEnterLiquidationEndState(before, after)`:

- normal department + active status -> canonical department + stopped status:
  `true`;
- only status changes: `false`;
- only department changes: `false`;
- already matched before, unrelated edit after: `false`;
- comparison tolerates surrounding whitespace, case, and NFC-equivalent text,
  but does not use partial matching.

**Step 3: Run and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/components/equipment-edit/__tests__/EquipmentEditTransitions.test.ts
```

Expected: FAIL because the transition module does not exist.

**Step 4: Implement the pure helper**

Use module-owned constants:

```typescript
export const LIQUIDATION_DEPARTMENT_NAME = "VT-TBYT- KHO THANH LÍ"
export const DECOMMISSIONED_EQUIPMENT_STATUS = "Ngưng sử dụng"
```

Normalize with NFC, trim, and locale-aware lowercase. Use strict equality after
normalization. Implement:

```typescript
isLiquidationEndState(values)
didEnterLiquidationEndState(before, after)
```

The server remains authoritative for ordering. This helper only decides whether
to select the special success toast.

**Step 5: Run and verify GREEN**

Run the Task 5 focused command again.

Expected: PASS.

## Task 6: RED/GREEN - Support One Per-Mutation Success Toast

**Files:**

- Create:
  `src/components/__tests__/useEquipmentEditUpdate.test.tsx`
- Modify:
  `src/components/equipment-edit/useEquipmentEditUpdate.ts`

**Step 1: Write failing hook tests**

Cover:

1. no override -> one existing generic success toast;
2. override supplied -> one special toast and no generic toast;
3. RPC failure -> one destructive error toast and no success toast.

The special toast contract is:

```typescript
{
  title: "Đã chuyển thiết bị",
  description:
    "Thiết bị đã được chuyển về cuối danh sách vì đang Ngưng sử dụng và thuộc Kho thanh lý.",
}
```

**Step 2: Run and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/components/__tests__/useEquipmentEditUpdate.test.tsx
```

Expected: FAIL because mutation variables cannot select a toast.

**Step 3: Implement the minimal hook contract**

Extend the update variables with an optional toast object:

```typescript
interface UpdateEquipmentParams {
  id: number
  patch: Partial<EquipmentFormValues>
  successToast?: {
    title: string
    description: string
  }
}
```

Use TanStack Mutation's `onSuccess(data, variables)` arguments:

```typescript
const selectedToast = variables.successToast ?? {
  title: "Thành công",
  description: successMessage,
}

toast(selectedToast)
onSuccess?.(savedPatch)
```

Do not emit a second toast from the caller.

**Step 4: Run and verify GREEN**

Run the Task 6 focused command again.

Expected: PASS.

## Task 7: RED/GREEN - Wire The Transition Into Equipment Detail Submit

**Files:**

- Modify:
  `src/app/(app)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx`
- Modify:
  `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`
- Use:
  `src/components/equipment-edit/EquipmentEditTransitions.ts`

**Step 1: Write the failing integration assertion**

Use the existing mocked `useEquipmentEditUpdate` seam. Start with an equipment
item that does not match both conditions, edit the form so the final values do,
submit, and assert `updateEquipment` receives the special `successToast`.

The pure transition tests from Task 5 cover the negative matrix. Keep this
dialog test to one positive wiring assertion to avoid duplicating form-heavy
cases.

**Step 2: Run and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- \
  src/app/\(app\)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx
```

Expected: FAIL because submit variables do not include `successToast`.

**Step 3: Implement event-time derivation**

Inside `onSubmitInlineEdit`, compare the current `savedValues` with submitted
`values`. Derive the transition directly in the submit event, not through an
effect or new component state.

Pass the special toast only when:

```typescript
didEnterLiquidationEndState(savedValues, values)
```

is true. Keep the existing success callback that updates `savedValues`, exits
edit mode, and invalidates the Equipments query.

**Step 4: Run and verify GREEN**

Run the Task 7 focused command again.

Expected: PASS.

## Task 8: Local Verification Before Any Live Write

Run all commands in one `ctx_batch_execute` in this order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- \
  src/app/api/rpc/__tests__/equipment-list-liquidation-order-migration.test.ts \
  src/app/\(app\)/equipment/__tests__/useEquipmentData.test.ts \
  src/app/\(app\)/equipment/__tests__/equipment-liquidation-order-scope.test.ts \
  src/components/equipment-edit/__tests__/EquipmentEditTransitions.test.ts \
  src/components/__tests__/useEquipmentEditUpdate.test.tsx \
  src/app/\(app\)/equipment/__tests__/equipment-detail-dialog-decommission-date.test.tsx
node scripts/npm-run.js run react-doctor
```

Expected:

- formatting passes;
- no explicit `any`;
- diff-only duplicate gate passes;
- typecheck passes;
- all focused tests pass;
- React Doctor reports no new blocking finding.

Also run the `code-deduplication` semantic search before commit and document why
the transition helper is module-specific rather than a reuse of fuzzy
department access utilities.

## Task 9: Explicitly Authorized Live Migration And SQL Verification

Stop and ask:

> Việc này cần apply migration và chạy smoke fixture có INSERT/ROLLBACK trên
> live DB qua Supabase MCP. Anh có cho phép tôi thực hiện hai thao tác cụ thể
> này không?

Only after explicit approval:

1. Apply
   `20260722094302_equipment_list_liquidation_last.sql` through Supabase MCP
   `apply_migration`.
2. Verify exactly one deployed overload exists and its final argument is
   `p_liquidation_last boolean`.
3. Execute
   `supabase/tests/equipment_list_enhanced_overload_regression.sql` through
   Supabase MCP.
4. Execute the transactional liquidation-order smoke test through Supabase MCP.
5. Confirm the transaction rolls back and no fixture rows remain.
6. Run Supabase security advisors.
7. Run Supabase performance advisors.
8. Compare representative main-list query latency with the flag off and on.
   The flag-off branch must retain the current SQL order fragment.

Expected:

- migration applied once;
- one RPC signature only;
- all SQL assertions pass;
- no new security advisor finding;
- no unacceptable list-query regression.

## Task 10: Deploy And Close Out

After the live RPC contract is verified:

1. Re-run Task 8.
2. Review the diff through context-mode and GitNexus changed-symbol impact.
3. Commit without bypassing Lefthook.
4. Push the branch.
5. Open/update the PR with the deploy order called out explicitly.
6. Merge only after the live RPC supports the new client argument.
7. Sync local `main`, prune the merged branch, and verify:

```bash
git status --short --branch
```

Expected: clean `main`, up to date with `origin/main`.

## Risks And Assumptions

- The canonical live department value is
  `VT-TBYT- KHO THANH LÍ`, with `LÍ`, not `LÝ`.
- The existing live data currently has 271 active rows in that department, all
  with status `Ngưng sử dụng`; tests must still cover inconsistent one-condition
  rows.
- `khoa_phong_quan_ly` is text and has no stable department ID on `thiet_bi`.
  The plan therefore uses strict normalized equality against the canonical
  label.
- Prepending a computed priority can prevent index-ordered retrieval for the
  main table. The conditional SQL branch ensures other consumers keep their
  current plan, and post-apply latency verification is required.
- Filtering still happens before ordering. If the user filters to only the
  liquidation department and stopped status, every returned row has equal
  priority and the selected column controls their internal order.
- No auto-navigation or auto-scroll is introduced when the edited row leaves
  the current page.
