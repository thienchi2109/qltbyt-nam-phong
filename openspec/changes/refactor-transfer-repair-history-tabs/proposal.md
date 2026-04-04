## Why

Issue [#205](https://github.com/thienchi2109/qltbyt-nam-phong/issues/205) asks to separate `Lịch sử thay đổi` from overloaded detail surfaces and align Transfers and Repair Requests with the tabbed detail experience already established in Equipment.
The refactor needs a shared presentation layer instead of another inline patch because Transfer and Repair detail surfaces still diverge from the Equipment tabbed reference, while Repair history must stay tenant-safe and RPC-only.

## What Changes

- **BREAKING**: None.
- Add a shared UI-only change-history presentation layer for detail surfaces:
  - normalized `ChangeHistoryEntry` contract
  - shared timeline rendering
  - shared loading and empty states
  - domain adapters that keep source-specific mapping out of leaf dialogs
- Refactor the Transfers detail dialog into tabs: `Overview | History | Progress`.
- Move Transfer history rendering into the shared history presentation layer while preserving the existing transfer detail/history query roots and mutation invalidation contracts.
- Add a tenant-safe Repair Request history read path that reuses the existing audit-log source of truth through RPC-only access, without depending on the global-only audit viewer hook.
- Refactor the Repair Requests detail view into tabs: `Details | History`.
- Keep Equipment as the visual and interaction reference only; do not migrate Equipment history to the shared layer in this change.
- Add focused tests for adapters, transfer tab behavior, repair history authorization/empty states, and shared presentation states.

## Capabilities

### New Capabilities
- `change-history-presentation`: shared normalized change-history rendering contract for domain detail views.
- `transfer-detail-dialog`: tabbed transfer detail experience with shared history presentation.
- `repair-request-detail-view`: tabbed repair detail experience with tenant-safe history rendering.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/components/transfer-detail-dialog.tsx`
  - `src/components/transfer-detail-dialog.data.ts`
  - `src/components/__tests__/transfer-detail-dialog.test.tsx`
  - `src/hooks/useTransferActions.ts`
  - `src/hooks/__tests__/useTransferActions.test.tsx`
  - `src/app/(app)/repair-requests/_components/RepairRequestsDetailView.tsx`
  - `src/app/(app)/repair-requests/_components/RepairRequestsDetailContent.tsx`
  - `src/app/(app)/repair-requests/_hooks/useRepairRequestsData.ts`
  - `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`
  - `src/app/api/rpc/[fn]/route.ts`
  - `supabase/migrations/*` for any new repair-history RPC wrapper over audit logs
  - new shared UI under `src/components/change-history/*`
- Current codebase constraints that drive this refactor:
  - `TransferDetailDialog` remains a 396-line monolith with transfer-specific history labels, formatters, and rendering embedded directly in the dialog component.
  - `RepairRequestsDetailContent` is still a flat details surface with no history tab.
  - Equipment provides the reference tabbed UX, but its history contract differs from Transfer history and is not a drop-in shared data source.
  - Repair history already uses audit-log infrastructure for `repair_request`, but the shipped `useAuditLogs()` hook is gated to global users and cannot be reused directly for tenant-scoped detail history.
- Affected active changes:
  - `openspec/changes/update-transfer-detail-related-people/` also edits transfer detail surfaces; implementation should be coordinated or stacked to avoid conflicting `TransferDetailDialog` edits.
- Security impact:
  - Repair Request history must remain RPC-only and tenant-safe.
  - This change must not expose global audit-log viewer semantics to tenant-scoped detail views.
- Performance impact:
  - The proposal intentionally keeps current eager Transfer history fetching behavior during the tab refactor to minimize regression risk; lazy-fetch-on-tab is explicitly deferred.
- Out of scope:
  - Equipment history migration to the shared layer
  - Generic cross-domain fetch centralization
  - New audit-log source tables or business-rule changes to how audit events are produced
  - Broad repair realtime/query-key cleanup beyond what is needed for the new history read path
