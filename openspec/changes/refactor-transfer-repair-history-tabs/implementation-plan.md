# Issue 205 History Tabs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `refactor-transfer-repair-history-tabs` by extracting a shared change-history presentation layer, moving Transfer detail history into tabs, and adding tenant-safe Repair Request history tabs backed by an RPC read path over audit logs.

**Architecture:** Keep fetch and permission logic owned by each domain. The shared module under `src/components/change-history/` only renders a normalized `ChangeHistoryEntry` contract. Transfer keeps its current eager fetch behavior and query-key roots; Repair adds a new app-scoped history hook plus a dedicated RPC wrapper instead of reusing the global-only audit viewer hook.

**Tech Stack:** Next.js App Router, React 18, TypeScript strict, TanStack Query v5, Radix Tabs, Vitest + Testing Library, Supabase/Postgres RPC via `/api/rpc/[fn]`, OpenSpec.

---

## Context Snapshot

- OpenSpec source of truth:
  - `openspec/changes/refactor-transfer-repair-history-tabs/proposal.md`
  - `openspec/changes/refactor-transfer-repair-history-tabs/design.md`
  - `openspec/changes/refactor-transfer-repair-history-tabs/tasks.md`
- Current code baseline on `main` already includes `transfer_request_get` and the related-people fix path. Do **not** re-implement that older change; treat it as baseline.
- GitNexus impact:
  - `useTransferDetailDialogData` = `CRITICAL`, direct caller `TransferDetailDialog`
  - `RepairRequestsDetailContent` = `LOW`
- Hard constraints:
  - No direct Supabase table access from app code
  - Repair history must stay tenant-safe and RPC-only
  - Do not wire tenant detail history directly to `useAuditLogs()` because it is gated by `isGlobalRole()`
  - Keep new Repair history query keys in the app-scoped repair module, not in `src/hooks/use-cached-repair.ts`
- Skills to load before implementation:
  - `next-best-practices`
  - `vercel-react-best-practices`

## TDD Flow (Mandatory For Every Task)

1. **RED**
   - Add or update the smallest failing test for the behavior in scope.
   - Run only the focused test file(s) for that behavior.
   - Confirm the failure matches the intended missing behavior, not a broken harness.
2. **GREEN**
   - Implement the minimum code to make the focused test pass.
   - Re-run the same focused test file(s) until green.
3. **REFACTOR**
   - Remove duplication, tighten types, and keep file sizes under control without changing behavior.
   - Re-run the same focused test file(s) after each cleanup pass.
4. **VERIFY IN ORDER**
   - `node scripts/npm-run.js run verify:no-explicit-any`
   - `node scripts/npm-run.js run typecheck`
   - Focused tests for the changed behavior
   - `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
5. **COMMIT**
   - Make one focused commit per task or per tightly related pair of tasks.

## Recommended Worktree

Implement in a dedicated worktree from `main`:

```bash
git worktree add ..\\qltbyt-issue-205-history-tabs -b feat/issue-205-history-tabs main
```

Then execute the rest of this plan inside that worktree.

### Task 1: Shared Change-History Presentation Contract

**Files:**
- Create: `src/components/change-history/ChangeHistoryTypes.ts`
- Create: `src/components/change-history/ChangeHistoryLoadingState.tsx`
- Create: `src/components/change-history/ChangeHistoryEmptyState.tsx`
- Create: `src/components/change-history/ChangeHistoryTimeline.tsx`
- Create: `src/components/change-history/ChangeHistoryTab.tsx`
- Create: `src/components/change-history/__tests__/ChangeHistoryTab.test.tsx`
- Read for reference: `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailHistoryTab.tsx`

**Step 1: Write the failing shared presentation tests**

Cover these cases in `src/components/change-history/__tests__/ChangeHistoryTab.test.tsx`:
- loading state renders placeholders
- empty state renders the expected empty copy
- populated state renders timestamp, action label, actor, and labeled detail rows
- **edge: entry with `actorName: null`** — renders fallback or omits actor gracefully
- **edge: entry with `details: []`** — timeline item renders without detail rows, does not crash

These edge cases MUST be tested at the shared layer because any consumer (transfer adapter, repair adapter, future domains) can produce entries with null actor or empty details. Catching this here prevents silent UI breakage at composition level.

Use a minimal normalized fixture like:

```ts
const entry = {
  id: "1",
  occurredAt: "2026-04-04T08:00:00.000Z",
  actionLabel: "Tạo yêu cầu",
  actorName: "Nguyễn Văn A",
  details: [{ label: "Trạng thái", value: "Đã duyệt" }],
}

const entryNoActor = { ...entry, id: "2", actorName: null }
const entryNoDetails = { ...entry, id: "3", details: [] }
```

**Step 2: Run the focused test to verify it fails**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/components/change-history/__tests__/ChangeHistoryTab.test.tsx"
```

Expected: fail because the new shared components do not exist yet.

**Step 3: Implement the minimum shared UI**

- Define `ChangeHistoryEntry` in `ChangeHistoryTypes.ts`
- Implement loading and empty states as leaf presentation components
- Implement `ChangeHistoryTimeline.tsx` for the populated state
- Implement `ChangeHistoryTab.tsx` as the wrapper that selects loading, empty, or populated output

Keep this module UI-only:
- no `callRpc`
- no `useQuery`
- no tenant/role logic

**Step 4: Re-run the focused test**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/components/change-history/__tests__/ChangeHistoryTab.test.tsx"
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/change-history
git commit -m "refactor: add shared change history presentation"
```

### Task 2: Transfer Adapter And Tabbed Transfer Detail Dialog

**Files:**
- Create: `src/components/transfer-detail-history-adapter.ts`
- Create: `src/components/__tests__/transfer-detail-history-adapter.test.ts`
- Modify: `src/components/transfer-detail-dialog.tsx`
- Modify: `src/components/__tests__/transfer-detail-dialog.test.tsx`
- Modify: `src/hooks/useTransferActions.ts`
- Modify: `src/hooks/__tests__/useTransferActions.test.tsx`
- Read only: `src/components/transfer-detail-dialog.data.ts`

**Step 1: Write the failing Transfer adapter and tabs tests**

Add failing coverage for:
- adapter maps `TransferChangeHistory` into normalized `ChangeHistoryEntry`
- dialog renders `Overview`, `History`, and `Progress` tabs
- overview no longer contains the inline history block
- reopening the same transfer still reuses cached detail/history behavior

Reuse the current cache-regression test in `src/components/__tests__/transfer-detail-dialog.test.tsx:287` and add tab assertions instead of replacing the cache behavior.

**Step 2: Run the focused Transfer tests to verify they fail**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/components/__tests__/transfer-detail-history-adapter.test.ts" "src/components/__tests__/transfer-detail-dialog.test.tsx"
```

Expected: fail for missing adapter and missing tabbed layout assertions.

**Step 3: Implement the minimum Transfer refactor**

- Create `transfer-detail-history-adapter.ts` as a pure mapper from `TransferChangeHistory` to `ChangeHistoryEntry`
- Remove transfer-specific history labels/formatters from `TransferDetailDialog` and delegate them to the adapter
- Add Radix tabs to `TransferDetailDialog` with:
  - `Overview`
  - `History`
  - `Progress`
- Render the shared `ChangeHistoryTab` inside the `History` tab
- Keep `useTransferDetailDialogData()` unchanged unless a test proves a real need

Do **not** change:
- `transfer_request_get`
- `transfer_change_history_list`
- `transferDetailDialogQueryKeys.detailRoot`
- `transferDetailDialogQueryKeys.historyRoot`
- current eager fetch behavior on dialog open

**Step 4: Re-run focused Transfer tests**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/components/__tests__/transfer-detail-history-adapter.test.ts" "src/components/__tests__/transfer-detail-dialog.test.tsx" "src/hooks/__tests__/useTransferActions.test.tsx"
```

Expected: PASS, including the invalidation-key expectations in `useTransferActions`.

**Step 5: Refactor only after green**

- Keep `src/components/transfer-detail-dialog.tsx` below the 450-line hard ceiling
- If the file still trends too large after history extraction, move only the overview JSX into `src/components/transfer-detail-overview.tsx`

Re-run the same focused tests after that cleanup.

**Step 6: Commit**

```bash
git add src/components/transfer-detail-dialog.tsx src/components/transfer-detail-history-adapter.ts src/components/__tests__/transfer-detail-history-adapter.test.ts src/components/__tests__/transfer-detail-dialog.test.tsx src/hooks/useTransferActions.ts src/hooks/__tests__/useTransferActions.test.tsx
git commit -m "refactor: move transfer history into tabbed detail view"
```

### Task 3: Repair History RPC Wrapper, Adapter, And Hook

> **Design rationale:** A new `repair_request_change_history_list` RPC is created intentionally for **tenant-safe semantics**. The existing `audit_logs_list_v2` (line 316 of the v2 migration) is global-only (`v_user_role IS DISTINCT FROM 'global'` gate). Rather than retrofitting tenant logic into a global audit read path, we create a purpose-built function that enforces the same tenant/role boundaries as `repair_request_detail` access. This is a deliberate architectural choice, not due to missing history infra.

**Files:**
- Create: `supabase/migrations/[timestamp]_add_repair_request_change_history_list_rpc.sql`
- Modify: `src/app/api/rpc/[fn]/route.ts`
- Modify: `src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts`
- Create: `src/app/(app)/repair-requests/_lib/repairRequestHistoryAdapter.ts`
- Create: `src/app/(app)/repair-requests/_hooks/useRepairRequestHistory.ts`
- Create: `src/app/(app)/repair-requests/__tests__/repairRequestHistoryAdapter.test.ts`
- Create: `src/app/(app)/repair-requests/__tests__/useRepairRequestHistory.test.ts`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`
- Optional modify if type reuse is needed: `src/app/(app)/repair-requests/types.ts`
- Read only: `src/hooks/use-audit-logs.ts`

**Step 1: Write the failing repair-history tests first**

Add failing coverage for:
- new RPC name is allowlisted
- adapter maps repair-history rows to normalized `ChangeHistoryEntry`
- hook uses an app-scoped query key such as `['repair_request_change_history', { id, tenant, role, diaBan }]`
- hook calls the dedicated repair-history RPC, not `useAuditLogs()`
- hook returns empty state cleanly when the RPC returns `[]`

**Step 2: Run the focused tests to verify they fail**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts" "src/app/(app)/repair-requests/__tests__/repairRequestHistoryAdapter.test.ts" "src/app/(app)/repair-requests/__tests__/useRepairRequestHistory.test.ts"
```

Expected: fail because the new RPC wrapper and hook do not exist yet.

**Step 3: Implement the SQL migration**

Create `supabase/migrations/[timestamp]_add_repair_request_change_history_list_rpc.sql` with:
- `SECURITY DEFINER`
- `SET search_path = public, pg_temp`
- JWT claim guards before business logic (`v_role`, `v_user_id` extraction and NULL check)
- Tenant/role access using `allowed_don_vi_for_session()` — the same helper used by `repair_request_get`, `repair_request_update`, and all other repair RPCs
- Access enforcement pattern (must match `repair_request_get` lines 72-91 and `transfer_request_history_list` lines 720-721):
  - `global`/`admin` → bypass tenant filter
  - other roles → call `allowed_don_vi_for_session()`, then verify the repair request's equipment `don_vi` is in the allowed set
  - **Out-of-scope access → `RAISE EXCEPTION ... USING ERRCODE = '42501'`** (NOT silent `[]`). History access semantics must be as strong as detail access
- audit-log source filtering for `entity_type = 'repair_request'` AND `entity_id = p_repair_request_id`
- minimal response fields needed by the detail history tab
- `_sanitize_ilike_pattern()` if any text search is added

Do **not** create direct table access in app code. The migration is the only new read path.

**Step 3b: Apply migration and run SQL boundary smoke tests**

After applying the migration via Supabase MCP `apply_migration`, run SQL boundary smoke tests via `execute_sql`.

**Harness**: Each test must call `set_config('request.jwt.claims', json_build_object(...)::text, true)` before invoking the RPC, exactly like `supabase/tests/audit_logs_v2_smoke.sql` (line 11). The `true` parameter makes the setting transaction-local so tests don't leak state. Without this harness, all auth branches are untested — the RPC will see empty JWT claims and always hit the missing-claims guard.

**Test cases** (use valid `TenantRole` values from `src/types/tenant.ts`):

```sql
-- 1. Authorized tenant: to_qltb user with matching don_vi → returns history
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('app_role','to_qltb','user_id','42','don_vi','DV001')::text,
    true);
  -- call repair_request_change_history_list for a request owned by DV001
  -- assert: json_array_length(result) > 0
END $$;

-- 2. Wrong tenant: to_qltb user with non-matching don_vi → raises 42501
-- (matches repair_request_get contract: out-of-scope = 42501, NOT silent [])
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('app_role','to_qltb','user_id','42','don_vi','DV999')::text,
    true);
  -- call repair_request_change_history_list for same request
  -- assert: SQLSTATE = '42501'
END $$;

-- 3. Global bypass → returns all history regardless of don_vi
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('app_role','global','user_id','1')::text,
    true);
  -- assert: returns history rows
END $$;

-- 4. Admin bypass → same as global (admin ↔ global normalization)
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('app_role','admin','user_id','1')::text,
    true);
  -- assert: returns history rows
END $$;

-- 5. Missing JWT claims → raises 42501
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  -- assert: SQLSTATE = '42501'
END $$;
```

> **Contract alignment**: Wrong tenant raises `42501` (not `[]`). This matches `repair_request_get` (line 72-91: `NOT FOUND → RAISE EXCEPTION ... USING ERRCODE = '42501'`) and `transfer_request_history_list` (line 720-721: same pattern). History semantics must not be weaker than detail access.

These DB-level tests catch cross-tenant regression that frontend unit tests cannot reach. Save as `supabase/tests/repair_request_history_smoke.sql` for CI reproducibility.

**Step 3c: Run security advisors post-migration**

```
get_advisors(security) via Supabase MCP
```

Verify the new function does not introduce new security warnings (missing RLS, unguarded SECURITY DEFINER, etc.).

**Step 4: Implement the frontend hook and adapter**

- Add `repairRequestHistoryAdapter.ts` as a pure mapper
- Add `useRepairRequestHistory.ts` next to `useRepairRequestsData.ts`
- Export stable query keys from `useRepairRequestHistory.ts`
- Query key MUST include the repair request ID: `['repair_request_change_history', { id: requestId }]`
- Keep this hook app-scoped; do not add new logic to `src/hooks/use-cached-repair.ts`

**Step 5: Update invalidation — precise, per-request-id**

The current `invalidateAndRefetch()` in `RepairRequestsContext.tsx` (line 286) is a void callback with no parameters — all 5 mutations (`create`, `update`, `delete`, `approve`, `complete`) call it in their `onSuccess`.

**Implementation approach:** Add single line to existing `invalidateAndRefetch`:

```ts
// In invalidateAndRefetch callback body, append:
queryClient.invalidateQueries({ queryKey: ['repair_request_change_history'] })
```

**Why this is precise enough:** The history query key includes `{ id: requestId }` but TanStack Query's `invalidateQueries` with a prefix key `['repair_request_change_history']` only invalidates queries that are **currently mounted** (active). Since only ONE detail view can be open at a time (controlled by `dialogState.requestToView`), only the mounted history query for that specific request ID gets refetched. Unmounted queries are simply marked stale — no extra network calls.

**Why we do NOT need `requestId` in the invalidation call:** `invalidateAndRefetch` is called from mutation `onSuccess` after a user action on a specific request. The detail view showing that request's history is the only mounted consumer. There is no risk of over-invalidation because no other request's history is mounted simultaneously.

Do not refactor `invalidateAndRefetch` to accept parameters — the current void signature is sufficient and avoids breaking the 5 mutation callsites.

**Step 6: Re-run the focused repair-history tests**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts" "src/app/(app)/repair-requests/__tests__/repairRequestHistoryAdapter.test.ts" "src/app/(app)/repair-requests/__tests__/useRepairRequestHistory.test.ts"
```

Expected: PASS.

**Step 7: Commit**

```bash
git add supabase/migrations/20260404113000_add_repair_request_change_history_list_rpc.sql src/app/api/rpc/[fn]/route.ts src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts src/app/(app)/repair-requests/_lib/repairRequestHistoryAdapter.ts src/app/(app)/repair-requests/_hooks/useRepairRequestHistory.ts src/app/(app)/repair-requests/__tests__/repairRequestHistoryAdapter.test.ts src/app/(app)/repair-requests/__tests__/useRepairRequestHistory.test.ts src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx src/app/(app)/repair-requests/types.ts
git commit -m "feat: add repair request history rpc and hook"
```

If `src/app/(app)/repair-requests/types.ts` was not changed, omit it from `git add`.

### Task 4: Tabbed Repair Request Detail View (Sheet-Only Unification)

> **Architecture change:** Unify `RepairRequestsDetailView` from dual Dialog (mobile) + Sheet (desktop) into a **single Sheet** with responsive sizing. This reduces duplicate shell code, simplifies tab wiring to a single composition, and aligns with the Equipment detail pattern.

**Files:**
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsDetailView.tsx`
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx` — remove `isMobile` prop from `<RepairRequestsDetailView>` call site (line 290)
- Create: `src/app/(app)/repair-requests/__tests__/RepairRequestsDetailTabs.test.tsx`
- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsDetailView.test.tsx`
- Read only unless spacing/regression forces a small cleanup: `src/app/(app)/repair-requests/_components/RepairRequestsDetailContent.tsx`

**Step 1: Write the failing detail-tabs tests**

Add failing coverage for:
- Sheet-only view renders for both mobile and desktop viewports (no Dialog branch)
- Sheet uses responsive sizing: `w-full` on mobile, constrained `sm:max-w-xl md:max-w-2xl lg:max-w-3xl` on desktop
- `Details` and `History` tabs render inside the unified Sheet shell
- `Details` tab continues to show the current detail content
- `History` tab renders loading, empty, and populated states through the shared `ChangeHistoryTab`
- history tab does not crash when the hook returns no actor name or no detail rows

Mock `useRepairRequestHistory()` in the detail-tab tests so the view tests stay focused on composition, not RPC behavior.

**Step 2: Run the focused detail-tabs tests to verify they fail**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsDetailView.test.tsx" "src/app/(app)/repair-requests/__tests__/RepairRequestsDetailTabs.test.tsx"
```

Expected: fail because the tabbed layout does not exist yet and the view still uses the dual Dialog/Sheet pattern.

**Step 3: Implement the unified Sheet + tabbed Repair detail view**

- Remove the `isMobile` branching and the `Dialog` import/usage from `RepairRequestsDetailView.tsx`
- Use a single `Sheet` with responsive sizing:
  - `SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0"`
  - On mobile, `w-full` makes the Sheet effectively full-screen
  - On desktop, max-width constraints keep it panel-sized
- Remove the `isMobile` prop from `RepairRequestsDetailViewProps` (no longer needed)
- Update all call sites that pass `isMobile` to `RepairRequestsDetailView`
- Add Radix tabs inside the unified Sheet: `Details` | `History`
- Keep `RepairRequestsDetailContent` as the `Details` tab body
- Render the shared `ChangeHistoryTab` in the `History` tab
- Pass `requestToView.id` into `useRepairRequestHistory()`
- Do not move history mapping logic into `RepairRequestsDetailContent.tsx`

**Step 4: Re-run the focused detail-tabs tests**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsDetailView.test.tsx" "src/app/(app)/repair-requests/__tests__/RepairRequestsDetailTabs.test.tsx" "src/app/(app)/repair-requests/__tests__/useRepairRequestHistory.test.ts"
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/(app)/repair-requests/_components/RepairRequestsDetailView.tsx src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx src/app/(app)/repair-requests/__tests__/RepairRequestsDetailView.test.tsx src/app/(app)/repair-requests/__tests__/RepairRequestsDetailTabs.test.tsx
git commit -m "refactor: unify repair detail to sheet-only + add history tab"
```

### Task 5: Final Verification, Manual QA, And Spec Hygiene

**Files:**
- Modify when implementation is truly complete: `openspec/changes/refactor-transfer-repair-history-tabs/tasks.md`
- Reference only: `openspec/changes/refactor-transfer-repair-history-tabs/proposal.md`
- Reference only: `openspec/changes/refactor-transfer-repair-history-tabs/design.md`

**Step 1: Run required TypeScript / React verification in order**

Run:

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- "src/components/change-history/__tests__/ChangeHistoryTab.test.tsx" "src/components/__tests__/transfer-detail-history-adapter.test.ts" "src/components/__tests__/transfer-detail-dialog.test.tsx" "src/hooks/__tests__/useTransferActions.test.tsx" "src/app/api/rpc/__tests__/rpc-whitelist.unit.test.ts" "src/app/(app)/repair-requests/__tests__/repairRequestHistoryAdapter.test.ts" "src/app/(app)/repair-requests/__tests__/useRepairRequestHistory.test.ts" "src/app/(app)/repair-requests/__tests__/RepairRequestsDetailView.test.tsx" "src/app/(app)/repair-requests/__tests__/RepairRequestsDetailTabs.test.tsx"
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
openspec validate refactor-transfer-repair-history-tabs --strict
```

Expected:
- no explicit `any`
- typecheck green
- focused tests green
- React Doctor diff scan green
- OpenSpec change remains valid

**Step 2: Manual browser verification**

Verify in browser:
- Transfer detail shows `Overview | History | Progress`
- Transfer history renders shared loading/empty/populated states
- Transfer dialog still refreshes correctly after an approve/complete flow
- Repair detail shows `Details | History`
- Repair history honors tenant-scoped access and does not expose global-only audit behavior

Record manual verification status in the PR or session notes if browser tooling is unavailable.

**Step 3: Update OpenSpec task checklist**

- Mark completed items in `openspec/changes/refactor-transfer-repair-history-tabs/tasks.md`
- Do not mark tasks complete before verification is green

**Step 4: Final commit**

```bash
git add openspec/changes/refactor-transfer-repair-history-tabs/tasks.md
git commit -m "docs: update issue 205 openspec task status"
```

Only make this commit if the OpenSpec checklist actually changed.
