## Context

Issue #205 spans three related but not identical concerns:
- tabbed detail UX for Transfers
- tabbed detail UX for Repair Requests
- a shared change-history presentation layer that reduces duplicated history UI without coupling unrelated fetch logic

The review against the live codebase surfaced a few constraints that materially change the implementation shape:
- Transfer history already has a dedicated read path, `transfer_change_history_list`, plus tests and mutation invalidation wired to `transferDetailDialogQueryKeys.historyRoot`.
- Equipment provides the desired tabbed UX reference, but its history data shape (`HistoryItem`) does not match Transfer history and should not be treated as the canonical shared contract.
- Repair history already exists conceptually inside the audit-log system, but the existing `useAuditLogs()` hook is global-only and therefore unsuitable as the direct data layer for tenant-scoped Repair Request detail history.
- The live Repair Requests page uses app-scoped query keys such as `repair_request_list`, while `src/hooks/use-cached-repair.ts` and `src/contexts/realtime-context.tsx` still reflect legacy `['repair']` keys. New work should align with the app-scoped module, not deepen the legacy split.

## Goals / Non-Goals

**Goals:**
- Provide a shared, normalized presentation layer for change history in detail views.
- Move Transfer history into a dedicated tab without breaking current detail/history fetch behavior.
- Add Repair Request history through a tenant-safe RPC-only read path backed by the existing audit-log source of truth.
- Keep domain mapping logic testable and outside leaf UI components.

**Non-Goals:**
- Do not centralize all history fetching into one cross-domain hook.
- Do not migrate Equipment history to the shared layer in this change.
- Do not rewrite repair realtime invalidation wholesale.
- Do not add lazy-fetch-on-tab activation for Transfer history in this proposal.

## Decisions

### 1. Shared history stays presentation-only

Create a shared `src/components/change-history/` module that accepts a normalized entry shape and renders timeline/loading/empty states. A minimal contract is sufficient:

```ts
type ChangeHistoryEntry = {
  id: string
  occurredAt: string
  actionLabel: string
  actorName: string | null
  details: Array<{ label: string; value: string }>
}
```

Consumers remain responsible for:
- fetching data
- enforcing permissions
- adapting source-specific rows into `ChangeHistoryEntry`

This keeps the shared layer reusable without turning it into a cross-domain data abstraction.

### 2. Transfer keeps its existing read paths and eager fetch contract

The Transfer refactor should be limited to presentation and adapter extraction:
- keep `useTransferDetailDialogData()`
- keep `transfer_request_get` and `transfer_change_history_list`
- keep `transferDetailDialogQueryKeys.detailRoot` and `historyRoot`
- keep `useTransferActions()` invalidation behavior compatible with those roots

Lazy-loading history only when the `History` tab becomes active is intentionally deferred. The current repo already expects eager fetch on dialog open for Transfer and Equipment detail surfaces. Preserving that behavior reduces regression risk and avoids simultaneous changes to fetch timing, cache semantics, and UI composition.

### 3. Repair gets a dedicated tenant-safe history read path over audit logs

Repair Request history should reuse the existing audit-log source of truth, but not the shipped global-only `useAuditLogs()` hook. The recommended approach is a dedicated repair-history RPC wrapper, e.g. `repair_request_change_history_list`, that:
- filters to `entity_type = 'repair_request'`
- filters to the requested repair request ID
- enforces the same tenant/role boundaries as Repair Request detail access
- returns only the fields needed for detail-history rendering

This avoids two bad alternatives:
- exposing generic audit-log viewer semantics to tenant users
- inventing a second source of truth for Repair Request history

### 4. New Repair history query keys must live in the app-scoped repair module

Any new Repair history hook/query key should live alongside `src/app/(app)/repair-requests/_hooks/useRepairRequestsData.ts` and related page-scoped logic. Do not build new detail behavior on top of `src/hooks/use-cached-repair.ts`, which is already out of sync with the live page flow and still referenced by legacy realtime invalidation.

The proposal only requires targeted invalidation for the new history query where a mutation affects the viewed request. Broader legacy key cleanup can be handled separately.

### 5. Equipment remains a UX reference, not an immediate migration target

Equipment already demonstrates the target tabbed interaction, but migrating its history rendering into the shared layer would expand scope into a third domain with a distinct event schema. This proposal intentionally stops at:
- reusing Equipment as the interaction reference
- leaving Equipment history implementation unchanged

## Alternatives Considered

### Alternative A: Generic shared fetch hook for all histories

Rejected. Transfer and Equipment already use different read paths, and Repair history has permission constraints that do not match the current global audit-log hook. A generic fetch layer would either leak permissions or force a premature abstraction.

### Alternative B: Use `useAuditLogs()` directly for Repair detail history

Rejected. The current hook is gated by `isGlobalRole()` and models an audit viewer, not a tenant-scoped repair detail surface.

### Alternative C: Combine tabs refactor with lazy fetch on tab activation

Deferred. It adds value, but it also changes fetch timing, loading behavior, and cache expectations at the same time as a structural UI refactor. The safer first pass is to preserve eager fetch semantics.

## Risks / Trade-offs

- [Transfer dialog overlap with active change `update-transfer-detail-related-people`] -> Coordinate branch order or cherry-pick the detail-read changes first so both changes do not diverge on `TransferDetailDialog`.
- [Repair history authorization drift] -> Keep the Repair history read path RPC-specific and test tenant/global behavior explicitly.
- [Shared UI abstraction grows too far] -> Limit the shared module to presentation and normalized entry types only.
- [Legacy repair query-key split causes stale invalidation assumptions] -> Keep new history keys local to the app-scoped repair module and update only the invalidation paths that actually touch the new query.

## Migration Plan

1. Extract shared change-history presentation and adapters first.
2. Refactor Transfer detail layout to tabs without changing fetch timing or query roots.
3. Add the dedicated Repair history RPC wrapper over audit logs.
4. Add the Repair history hook/query keys in the app-scoped repair module.
5. Refactor Repair detail view to tabs and wire the shared history presentation.
6. Run verification and browser checks before approval for implementation.

## Open Questions

- Should the active `update-transfer-detail-related-people` change merge first, or should implementation deliberately stack both transfer-dialog refactors in one branch?
- After this change lands, should the broader legacy Repair realtime/query-key split be tracked as a separate cleanup proposal?
