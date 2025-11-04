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
- [ ] 3.1 Scaffold `/api/transfers/list` and `/api/transfers/counts`.
- [ ] 3.2 Update `/api/rpc/[fn]/route.ts` allowlist (add `transfer_request_list`, `transfer_request_counts`).
- [ ] 3.3 Delete `/api/transfers/kanban` route file.

## 4. Frontend Refactor
- [ ] 4.1 Replace board layout with data grid, wiring TanStack Query to new endpoints.
- [ ] 4.2 Implement filter toolbar (facility, status multi-select, type, date range, search).
- [ ] 4.3 **Implement prominent status badges** above table (clickable, with counts, status-specific colors).
- [ ] 4.4 Ensure transfer actions (view, approve, edit, delete) work in table Actions column with role-based permissions.
- [ ] 4.5 **Implement mobile card view** with responsive breakpoint at `md` (768px).
- [ ] 4.6 Refactor `TransferCard.tsx` for mobile card view (remove kanban-specific logic).
- [ ] 4.7 Delete kanban-specific files:
  - [ ] `src/components/transfers/VirtualizedKanbanColumn.tsx`
  - [ ] `src/components/transfers/DensityToggle.tsx`
  - [ ] `src/components/transfers/CollapsibleLane.tsx`
  - [ ] `src/lib/kanban-preferences.ts`
  - [ ] `src/hooks/useTransfersKanban.ts` (replace with new hooks for list/counts)
  - [ ] `src/types/transfer-kanban.ts` (replace with data grid types)
- [ ] 4.8 Update imports across codebase (detail dialog, edit dialog, etc.).

## 5. QA & Rollout
- [ ] 5.1 Run `npm run typecheck` and `npm run lint` (ensure no broken imports).
- [ ] 5.2 Smoke-test roles: global, regional_leader, to_qltb, technician, user.
- [ ] 5.3 Validate performance with large datasets (500+ rows).
- [ ] 5.4 Test all transfer workflows end-to-end:
  - [ ] Create transfer request
  - [ ] Approve transfer
  - [ ] Start transfer
  - [ ] Complete transfer (internal)
  - [ ] Handover to external (for ben_ngoai type)
  - [ ] Return from external
  - [ ] Generate handover sheet (via detail dialog)
- [ ] 5.5 Prepare release notes highlighting UI change (kanban → table).
