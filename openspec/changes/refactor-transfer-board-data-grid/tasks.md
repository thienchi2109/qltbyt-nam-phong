## 1. Planning & Alignment
- [x] 1.1 Confirm no other active OpenSpec change touches transfers UI/API (✅ kanban bugfixes complete).
- [x] 1.2 Review existing repair/maintenance grid implementations for reusable components.
- [x] 1.3 Identify all kanban-specific files for deletion (components, hooks, types, API routes, preferences utils).

## 2. Database / RPC Layer
- [x] 2.1 Design SQL for `public.transfer_request_list` (filters, pagination, tenant scoping).
- [x] 2.2 Implement `public.transfer_request_counts`.
- [x] 2.3 Write migration SQL and run EXPLAIN on critical filters.
- [x] 2.4 Add regression tests or psql snippets validating tenant isolation.

## 3. Next.js API Routes
- [x] 3.1 Scaffold `/api/transfers/list` and `/api/transfers/counts`.
- [x] 3.2 Update `/api/rpc/[fn]/route.ts` allowlist (add `transfer_request_list`, `transfer_request_counts`).
- [ ] 3.3 Delete `/api/transfers/kanban` route file (deferred to end of Task 4).

## 4. Frontend Refactor

### 4.A Tab Implementation
- [x] 4.A.1 Create tab navigation component with 3 tabs: "Nội bộ", "Bên ngoài", "Thanh lý".
- [x] 4.A.2 Implement URL-based tab state management (`?tab=noi_bo`).
- [-] 4.A.3 Add tab badge counts (total count per type from counts API). (placeholder)
- [x] 4.A.4 Wire tab selection to filter transfers by `loai_hinh` parameter.

### 4.B Hooks & Data Fetching
- [x] 4.B.1 Create `useTransferList` hook (calls `/api/transfers/list` with type filter).
- [x] 4.B.2 Create `useTransferCounts` hook (calls `/api/transfers/counts` with type filter).
- [x] 4.B.3 Implement debounced search hook.
- [x] 4.B.4 Integrate TanStack Query with proper cache keys per tab.

### 4.C Column Definitions
- [x] 4.C.1 Define common columns (transfer code, equipment, reason, created date, status, actions).
- [x] 4.C.2 Define internal transfer columns (from/to department, receiving facility).
- [x] 4.C.3 Define external transfer columns (receiving entity, contact, phone, return dates, overdue indicator).
- [x] 4.C.4 Define liquidation columns (purpose, receiving entity, contact, completion date).
- [x] 4.C.5 Centralize column configs in `src/components/transfers/columnDefinitions.ts`.

### 4.D Data Grid Implementation
- [ ] 4.D.1 Integrate TanStack Table with dynamic column rendering based on active tab.
- [ ] 4.D.2 Implement sortable columns (equipment, created date, status).
- [ ] 4.D.3 Implement Actions column with role-based buttons (view, approve, edit, delete).
- [ ] 4.D.4 Add `stopPropagation` to action buttons.
- [ ] 4.D.5 Implement pagination footer (page navigation, page size selector).

### 4.E Status Badges (Type-Specific)
- [ ] 4.E.1 Create `TransferStatusBadges` component.
- [ ] 4.E.2 Display badges above table (below tabs) showing counts for ONLY current tab's type.
- [ ] 4.E.3 Implement click-to-filter functionality (badge click filters by status).
- [ ] 4.E.4 Style badges with status-specific colors.

### 4.F Filter Toolbar
- [ ] 4.F.1 Implement facility filter (dropdown, global/regional users only).
- [ ] 4.F.2 Implement status multi-select filter.
- [ ] 4.F.3 Implement date range filter (from/to with Calendar).
- [ ] 4.F.4 Implement search filter with debounce.
- [ ] 4.F.5 **Remove type filter** (replaced by tabs).
- [ ] 4.F.6 Add "Clear filters" button.

### 4.G Mobile Card View (Type-Specific)
- [ ] 4.G.1 Refactor `TransferCard.tsx` to remove kanban-specific logic (DensityMode).
- [ ] 4.G.2 Implement responsive breakpoint at `md` (768px) - table on desktop, cards on mobile.
- [ ] 4.G.3 Ensure internal tab cards show from/to departments.
- [ ] 4.G.4 Ensure external tab cards show receiving entity, return date, overdue indicator.
- [ ] 4.G.5 Ensure liquidation tab cards show purpose, completion date.

### 4.H Cleanup
- [ ] 4.H.1 Delete `src/components/transfers/VirtualizedKanbanColumn.tsx`.
- [ ] 4.H.2 Delete `src/components/transfers/DensityToggle.tsx`.
- [ ] 4.H.3 Delete `src/components/transfers/CollapsibleLane.tsx`.
- [ ] 4.H.4 Delete `src/lib/kanban-preferences.ts`.
- [ ] 4.H.5 Delete `src/hooks/useTransfersKanban.ts` (replaced with `useTransferList`, `useTransferCounts`).
- [ ] 4.H.6 Delete `src/types/transfer-kanban.ts` (replaced with data grid types).
- [ ] 4.H.7 Delete `/api/transfers/kanban` route file.
- [ ] 4.H.8 Update imports across codebase (detail dialog, edit dialog, add/edit dialogs).

## 5. QA & Rollout
- [ ] 5.1 Run `npm run typecheck` and `npm run lint` (ensure no broken imports).
- [ ] 5.2 Smoke-test roles: global, regional_leader, to_qltb, technician, user.
- [ ] 5.3 Validate performance with large datasets (500+ rows per type).
- [ ] 5.4 Test tab functionality:
  - [ ] Tab switching updates URL (`?tab=noi_bo`, `?tab=ben_ngoai`, `?tab=thanh_ly`)
  - [ ] Tab badge counts accurate per type
  - [ ] Status badges update per active tab
  - [ ] Columns change dynamically per tab
  - [ ] Mobile card view shows correct fields per tab
  - [ ] Browser back/forward navigation works with tabs
- [ ] 5.5 Test all transfer workflows end-to-end (per type):
  - [ ] **Internal transfers**: Create → Approve → Start → Complete
  - [ ] **External transfers**: Create → Approve → Start → Handover → Return → Complete
  - [ ] **Liquidation**: Create → Approve → Complete (verify liquidation-specific workflow)
  - [ ] Generate handover sheet (via detail dialog)
- [ ] 5.6 Test filters within each tab:
  - [ ] Facility filter (global/regional users)
  - [ ] Status multi-select
  - [ ] Date range
  - [ ] Search text
  - [ ] Clear filters resets all except tab
- [ ] 5.7 Mobile responsiveness:
  - [ ] Test at breakpoint 768px (md)
  - [ ] Verify table → card transition
  - [ ] Test on actual mobile devices (iOS, Android)
- [ ] 5.8 Prepare release notes highlighting UI change (kanban → tabbed data grid).
