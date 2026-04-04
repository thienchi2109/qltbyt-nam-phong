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

Use a minimal normalized fixture like:

```ts
const entry = {
  id: "1",
  occurredAt: "2026-04-04T08:00:00.000Z",
  actionLabel: "Tạo yêu cầu",
  actorName: "Nguyễn Văn A",
  details: [{ label: "Trạng thái", value: "Đã duyệt" }],
}
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

**Files:**
- Create: `supabase/migrations/20260404113000_add_repair_request_change_history_list_rpc.sql`
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

Create `supabase/migrations/20260404113000_add_repair_request_change_history_list_rpc.sql` with:
- `SECURITY DEFINER`
- `SET search_path = public, pg_temp`
- JWT claim guards before business logic
- tenant/role checks equivalent to Repair Request detail access
- audit-log source filtering for `entity_type = 'repair_request'`
- filtering by the requested repair request ID only
- minimal response fields needed by the detail history tab

Do **not** create direct table access in app code. The migration is the only new read path.

**Step 4: Implement the frontend hook and adapter**

- Add `repairRequestHistoryAdapter.ts` as a pure mapper
- Add `useRepairRequestHistory.ts` next to `useRepairRequestsData.ts`
- Export stable query keys from `useRepairRequestHistory.ts`
- Keep this hook app-scoped; do not add new logic to `src/hooks/use-cached-repair.ts`

**Step 5: Update invalidation only where needed**

In `RepairRequestsContext.tsx`, invalidate the new history root after mutations that can change history for the currently viewed request:
- update
- approve
- complete
- delete if the viewed request is removed

Do not broaden invalidation beyond this new history root.

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

### Task 4: Tabbed Repair Request Detail View

**Files:**
- Modify: `src/app/(app)/repair-requests/_components/RepairRequestsDetailView.tsx`
- Create: `src/app/(app)/repair-requests/__tests__/RepairRequestsDetailTabs.test.tsx`
- Modify: `src/app/(app)/repair-requests/__tests__/RepairRequestsDetailView.test.tsx`
- Read only unless spacing/regression forces a small cleanup: `src/app/(app)/repair-requests/_components/RepairRequestsDetailContent.tsx`

**Step 1: Write the failing detail-tabs tests**

Add failing coverage for:
- `Details` and `History` tabs render in mobile and desktop detail shells
- `Details` tab continues to show the current detail content
- `History` tab renders loading, empty, and populated states through the shared `ChangeHistoryTab`
- history tab does not crash when the hook returns no actor name or no detail rows

Mock `useRepairRequestHistory()` in the detail-tab tests so the view tests stay focused on composition, not RPC behavior.

**Step 2: Run the focused detail-tabs tests to verify they fail**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/repair-requests/__tests__/RepairRequestsDetailView.test.tsx" "src/app/(app)/repair-requests/__tests__/RepairRequestsDetailTabs.test.tsx"
```

Expected: fail because the tabbed detail layout does not exist yet.

**Step 3: Implement the minimum tabbed Repair detail view**

- Add Radix tabs to `RepairRequestsDetailView.tsx`
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
git add src/app/(app)/repair-requests/_components/RepairRequestsDetailView.tsx src/app/(app)/repair-requests/__tests__/RepairRequestsDetailView.test.tsx src/app/(app)/repair-requests/__tests__/RepairRequestsDetailTabs.test.tsx
git commit -m "refactor: add repair request history tab"
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
