# RBAC Utility Consolidation Tasklist

Based on `docs/plans/2026-02-06-rbac-utility-consolidation.md`.

## Setup
- [x] Create `src/lib/rbac.ts`
- [x] Add `src/lib/__tests__/rbac.test.ts`

## Priority 0: Bug Fixes
- [x] `src/components/performance-dashboard.tsx`
- [x] `src/components/admin/user-management.tsx`
- [x] `src/lib/department-utils.ts`
- [x] `src/types/database.ts`

## Priority 1: Hooks
- [x] `src/hooks/useTransferActions.ts`
- [x] `src/hooks/useTransfersKanban.ts`
- [x] `src/app/(app)/equipment/_hooks/useEquipmentAuth.ts`
- [x] `src/hooks/use-tenant-branding.ts`
- [x] `src/hooks/use-audit-logs.ts`

## Priority 2: Contexts
- [x] `src/app/(app)/repair-requests/_components/RepairRequestsContext.tsx`
- [x] `src/app/(app)/equipment/_components/EquipmentDialogContext.tsx`

## Priority 3: Page Components
- [x] `src/app/(app)/device-quota/_components/DeviceQuotaSubNav.tsx`
- [x] `src/app/(app)/device-quota/categories/page.tsx`
- [x] `src/app/(app)/repair-requests/_components/RepairRequestsColumns.tsx`
- [x] `src/app/(app)/maintenance/page.tsx`
- [x] `src/app/(app)/layout.tsx`
- [x] `src/app/(app)/users/page.tsx`
- [x] `src/app/(app)/activity-logs/page.tsx`
- [x] `src/app/(app)/dashboard/page.tsx`
- [x] `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`

## Priority 4: Dialog/Form Components
- [x] `src/components/add-equipment-dialog.tsx`
- [x] `src/components/add-transfer-dialog.tsx`
- [x] `src/components/edit-transfer-dialog.tsx`
- [x] `src/components/add-maintenance-plan-dialog.tsx`
- [x] `src/components/start-usage-dialog.tsx`
- [x] `src/components/end-usage-dialog.tsx`
- [x] `src/components/edit-maintenance-plan-dialog.tsx`
- [x] `src/components/usage-history-tab.tsx` (3 instances)
- [x] `src/components/tenants-management.tsx`
- [x] `src/components/form-branding-header.tsx`

## Priority 5: Mobile Components
- [x] `src/components/mobile-footer-nav.tsx`
- [x] `src/components/mobile-equipment-list-item.tsx`
- [x] `src/components/mobile-usage-actions.tsx`
- [x] `src/components/equipment/equipment-actions-menu.tsx`

## Priority 6: Reports/Charts
- [x] `src/app/(app)/reports/components/tenant-filter-dropdown.tsx`
- [x] `src/components/unified-inventory-chart.tsx`
- [x] `src/components/department-filter-status.tsx`

## Priority 7: Utilities
- [x] `src/lib/advanced-cache-manager.ts`
- [x] `src/components/equipment/equipment-print-utils.ts`

## Docs
- [x] Update `docs/RBAC.md`

## Verification
- [x] `node scripts/npm-run.js run typecheck`
- [ ] `node scripts/npm-run.js run test:run` (fails: missing `@rollup/rollup-linux-x64-gnu`)
- [ ] `node scripts/npm-run.js run build` (fails: Next SWC download `npm config get registry` EPERM)
- [ ] Manual: verify DeviceQuotaSubNav categories tab visibility
