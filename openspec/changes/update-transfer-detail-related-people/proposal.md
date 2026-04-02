## Why

The Transfers detail dialog currently renders `Người liên quan` only when requester and approver user objects are already embedded in the dialog payload. In the current flow, the dialog opens from list-row data that only carries requester and approver IDs, so transfer requests can show an empty related-people section even when the underlying record has valid requester and approver references.

This change restores the intended detail-dialog behavior for requester and approver without expanding scope into transfer-history reconstruction. The stale `Lịch sử thay đổi` contract is tracked separately in issue [#202](https://github.com/thienchi2109/qltbyt-nam-phong/issues/202).

## What Changes

- Add a dedicated transfer-detail read path for the Transfers detail dialog so requester and approver user objects are resolved independently of list-row payload shape.
- Ensure the transfer-detail payload includes nested `nguoi_yeu_cau` and `nguoi_duyet` objects whenever the corresponding IDs exist and the referenced users can be resolved.
- Update the Transfers detail dialog to use the detail read path for `Người liên quan` instead of relying on list-row mapping alone.
- Preserve current behavior for non-people sections of the dialog and keep `Lịch sử thay đổi` out of scope for this proposal.
- Add focused verification for transfer requests in multiple statuses to prove requester and approver render consistently.
- Execute delivery in strict test-first order: write failing regression tests for the detail dialog behavior before adding the new detail read path, then implement the minimal code to make those tests pass, then refactor without changing behavior.

## Capabilities

### New Capabilities
- `transfers`: Defines the detail-dialog related-people contract for requester and approver.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/components/transfer-detail-dialog.tsx`
  - `src/app/(app)/transfers/page.tsx`
  - `src/hooks/useTransferActions.ts`
  - `src/types/database.ts`
  - `src/types/transfers-data-grid.ts`
  - `src/app/api/rpc/[fn]/route.ts`
  - transfer detail/read RPC implementation under `supabase/migrations/`
- Expected blast radius is low-to-medium because the change is isolated to the transfer detail read path and should not require list or kanban rows to embed nested user objects.
- No transfer workflow mutation rules change in this proposal.
- Out of scope:
  - transfer history rendering and any redesign of `transfer_history_list`
  - additional related-person roles beyond requester and approver
