## 1. Shared Change-History Presentation

- [ ] 1.1 Add failing tests for shared change-history loading, empty, and populated timeline states using a normalized `ChangeHistoryEntry` input.
- [ ] 1.2 Add a failing test proving the Transfer adapter maps transfer history rows into normalized display entries without leaking dialog-specific formatter logic into `TransferDetailDialog`.
- [ ] 1.3 Implement `src/components/change-history/*` as a UI-only shared layer with normalized types, timeline rendering, and loading/empty states.
- [ ] 1.4 Implement domain adapters for Transfer and Repair history inputs.
- [ ] 1.5 Re-run the focused shared-history tests and confirm they pass.

## 2. Transfer Detail Tabs

- [ ] 2.1 Add failing tests proving the Transfers detail dialog renders `Overview`, `History`, and `Progress` tabs and no longer shows history inline in the overview content.
- [ ] 2.2 Add a failing regression test proving the tab refactor preserves the current Transfer detail/history cache behavior when reopening the same transfer.
- [ ] 2.3 Refactor `TransferDetailDialog` to the tabbed layout and route history rendering through the shared presentation layer.
- [ ] 2.4 Preserve `transferDetailDialogQueryKeys.detailRoot` and `transferDetailDialogQueryKeys.historyRoot`, plus existing mutation invalidation behavior in `useTransferActions`.
- [ ] 2.5 Re-run the focused Transfers detail-dialog tests and confirm they pass.

## 3. Repair Request History Read Path

- [ ] 3.1 Add failing tests for a tenant-safe Repair Request history read path and a frontend hook that consumes it through RPC-only access.
- [ ] 3.2 Add or update the repair-history RPC wrapper so it reuses existing audit-log data for `repair_request` entities while enforcing tenant/role boundaries for the requested repair request.
- [ ] 3.3 Whitelist the new repair-history RPC in `/api/rpc/[fn]` if required.
- [ ] 3.4 Add app-scoped Repair Request history query keys and a dedicated hook near the current repair page module; do not extend the legacy `src/hooks/use-cached-repair.ts` path.
- [ ] 3.5 Update only the necessary repair detail invalidation paths for the new history query.

## 4. Repair Request Detail Tabs

- [ ] 4.1 Add failing tests proving the Repair Request detail view renders `Details` and `History` tabs and moves history out of the flat details content.
- [ ] 4.2 Add failing tests for Repair Request history populated, empty, and unauthorized/filtered cases.
- [ ] 4.3 Refactor the Repair Request detail surface to the tabbed layout using the shared presentation layer and the tenant-safe repair-history hook.
- [ ] 4.4 Keep the existing details content focused on request details; do not fold repair history mapping logic back into `RepairRequestsDetailContent`.
- [ ] 4.5 Re-run the focused Repair Request detail/history tests and confirm they pass.

## 5. Verification

- [ ] 5.1 Run `node scripts/npm-run.js run verify:no-explicit-any`
- [ ] 5.2 Run `node scripts/npm-run.js run typecheck`
- [ ] 5.3 Run focused tests for shared change-history components/adapters, Transfer detail tabs/history, and Repair Request detail/history behavior
- [ ] 5.4 Run `node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main`
- [ ] 5.5 Manually verify Transfer and Repair Request history tabs in the browser, including empty-state and tenant-scoped behavior
- [ ] 5.6 Run `openspec validate refactor-transfer-repair-history-tabs --strict`
