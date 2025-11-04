Status: Draft  
Date: 2025-11-04  
Owner: Codex Agent

## Problem
- Transfer kanban UI is failing to render cards reliably (virtualized row API mismatch, recent debugging required TypeScript workarounds with `as any` casts).
- Transfer kanban architecture is overly complex for typical dataset sizes (<500 items) and is difficult to maintain (custom virtualization, dual data fetching for counts/data).
- Transfer workflows now rely on server-side filtering (facility, status, date, search) similar to repair and maintenance pages, but kanban keeps custom client logic.
- Counts, pagination, and tenant isolation patterns are inconsistent with data grid architecture already proven in repair requests and maintenance pages.

## Goals
1. Replace the kanban columns with a paginated TanStack data grid using the same server-side filtering conventions as repair requests.
2. Unify filtering/count logic so badge totals and rows come from a single RPC result set.
3. Preserve existing transfer actions (view detail, approve, edit, delete) with role-based gating.
4. Ensure global/regional users can scope by facility while non-global users remain restricted to their tenant.

## Non-Goals
- No changes to transfer approval workflow or business rules.
- No major visual redesign beyond moving to the shared data grid components.
- No updates to export/print flows (handled separately).

## Proposed Changes
### API/RPC
- Introduce RPC `public.transfer_request_list` with arguments for facility IDs, statuses, types, date range, search text, pagination, and cursor.
- Add RPC `public.transfer_request_counts` that mirrors filters (except status) and returns per-status totals + overall count.
- Deprecate `/api/transfers/kanban` and associated grouping logic once grid is live.

### Next.js API Routes
- Add `/api/transfers/list` and `/api/transfers/counts` wrappers that call the new RPC functions through the existing proxy and enforce role claims.
- **Remove** `/api/transfers/kanban` route entirely (no deprecation period).

### Client (App Router)
- Replace the kanban board in `src/app/(app)/transfers/page.tsx` with the shared data grid shell (toolbar, filters, TanStack table, pagination footer).
- Move filters to the standard server-driven pattern (facility select, multi-status, date range, type, search) with debounced query invalidation.
- Update badge counts to use the new counts endpoint (or integrate into list response metadata).
- Ensure action buttons (detail dialog, approve/reject, edit, delete) still appear in a rightmost column with `stopPropagation`.
- **Delete** kanban-specific components: `VirtualizedKanbanColumn`, `TransferCard` (create new table-optimized variant if needed), `DensityToggle`, kanban preferences utilities.

### UX/Visual
- Adopt the existing data grid styling (striped rows, sticky header, responsive card fallback on mobile if needed).
- Provide empty-state messaging and loading skeletons consistent with other grids.

## Risks & Mitigations
- Risk: New RPC may miss tenant isolation edge cases → reuse helper functions from repair requests and add regression SQL tests.
- Risk: Users accustomed to kanban lose quick visual grouping → ensure filters + status badges remain prominent; status multi-select provides equivalent filtering.

## Decisions
- **No feature flag**: Direct replacement of kanban with data grid (clean cut).
- **No export/print functions**: Transfer workflows do not require dedicated export beyond existing handover sheet generation (handled via detail dialog).
- **Full removal**: Delete kanban-specific components (`VirtualizedKanbanColumn`, kanban API routes) in same PR to avoid dead code.
