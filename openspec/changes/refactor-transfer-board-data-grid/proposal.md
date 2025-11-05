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
2. **Implement tabbed design** with 3 tabs for transfer types: Internal (`noi_bo`), External (`ben_ngoai`), Liquidation (`thanh_ly`).
3. **Dynamic column rendering** - each tab displays type-specific columns based on the TransferCard field layout.
4. Unify filtering/count logic so badge totals and rows come from a single RPC result set.
5. Preserve existing transfer actions (view detail, approve, edit, delete) with role-based gating.
6. Ensure global/regional users can scope by facility while non-global users remain restricted to their tenant.
7. **Implement type-specific status badges** - counts reflect only the current tab's transfer type.
8. **Implement mobile-responsive card view** - shows relevant fields per transfer type (table as desktop-only).

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
- Replace the kanban board in `src/app/(app)/transfers/page.tsx` with **tabbed data grid layout**.
- **Implement 3 tabs**: "Nội bộ" (Internal), "Bên ngoài" (External), "Thanh lý" (Liquidation).
- Each tab shows a data grid with **type-specific columns** filtered by `loai_hinh` parameter.
- Move filters to the standard server-driven pattern (facility select, multi-status, date range, search) with debounced query invalidation.
- **Remove type filter** from toolbar (replaced by tab selection).
- **Add type-specific status badges** above each tab's table showing counts for that type only (cho_duyet, da_duyet, dang_luan_chuyen, da_ban_giao, hoan_thanh) with click-to-filter functionality.
- Ensure action buttons (detail dialog, approve/reject, edit, delete) appear in a rightmost Actions column with `stopPropagation`.
- **Implement mobile card view** using refactored TransferCard component showing type-relevant fields per tab.
- **Delete** kanban-specific components: `VirtualizedKanbanColumn`, `DensityToggle`, `CollapsibleLane`, kanban preferences utilities.

#### Column Definitions (Based on TransferCard Layout)

**Common Columns (All Types)**:
- Transfer Code (`ma_yeu_cau`)
- Equipment (`thiet_bi.ma_thiet_bi` - `thiet_bi.ten_thiet_bi`)
- Reason (`ly_do_luan_chuyen`)
- Created Date (`created_at`)
- Status (`trang_thai`) - with color coding
- Actions (view, approve, edit, delete)

**Internal Transfer Tab (`noi_bo`) - Additional Columns**:
- From Department (`khoa_phong_hien_tai`)
- To Department (`khoa_phong_nhan`)
- Receiving Facility (`don_vi_nhan`) - if inter-facility transfer

**External Transfer Tab (`ben_ngoai`) - Additional Columns**:
- Receiving Entity (`don_vi_nhan`)
- Contact Person (`nguoi_lien_he`)
- Phone (`so_dien_thoai`)
- Expected Return Date (`ngay_du_kien_tra`) - with overdue indicator
- Handover Date (`ngay_ban_giao`)
- Actual Return Date (`ngay_hoan_tra`)

**Liquidation Tab (`thanh_ly`) - Additional Columns**:
- Purpose (`muc_dich`)
- Receiving Entity (`don_vi_nhan`)
- Contact Person (`nguoi_lien_he`)
- Completion Date (`ngay_hoan_thanh`)

### UX/Visual
- **Tab navigation**: Horizontal tabs at top with labels "Nội bộ", "Bên ngoài", "Thanh lý" with badge counts per type.
- **Type-specific status badges**: Below tabs, above table - clickable badges showing counts for ONLY the active tab's transfer type (cho_duyet, da_duyet, etc.).
- **Desktop table view**:
  - Striped rows, sticky header, sortable columns
  - Dynamic columns based on active tab
  - Actions column on right (view, approve, edit, delete)
- **Mobile card view**:
  - Refactored TransferCard component showing type-relevant fields
  - Internal tab: shows from/to departments
  - External tab: shows receiving entity, return date, overdue indicator
  - Liquidation tab: shows purpose, completion date
- **Responsive breakpoint**: Switch from table to cards at `md` breakpoint (768px).
- **Empty states**: Type-specific empty messages per tab.
- **Loading skeletons**: Consistent with other grids, respect tab context.

## Risks & Mitigations
- Risk: New RPC may miss tenant isolation edge cases → reuse helper functions from repair requests and add regression SQL tests.
- Risk: Users accustomed to kanban lose quick visual grouping → tabs + status badges provide clear visual separation; each tab is focused on single transfer type.
- Risk: Tab state management complexity → use URL query params to persist active tab, enabling shareable links and browser back/forward navigation.
- Risk: Column definitions maintenance → centralize column configs in separate file per type, making updates easier.

## Decisions
- **Tabbed design**: Three separate tabs for transfer types instead of single grid with type filter - provides clearer UX separation and enables type-specific column layouts.
- **Type-specific status badges**: Each tab shows counts only for its transfer type, avoiding confusion from mixed-type aggregates.
- **URL-based tab state**: Active tab persisted in URL query param (`?tab=noi_bo`) for shareable links and browser navigation support.
- **Dynamic column rendering**: TanStack Table column visibility controlled by active tab, with centralized column definitions per type.
- **No feature flag**: Direct replacement of kanban with data grid (clean cut).
- **No export/print functions**: Transfer workflows do not require dedicated export beyond existing handover sheet generation (handled via detail dialog).
- **Full removal**: Delete kanban-specific components (`VirtualizedKanbanColumn`, kanban API routes) in same PR to avoid dead code.
