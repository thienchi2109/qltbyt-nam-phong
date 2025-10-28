# Implementation Plan — Reports Inventory Unified Dynamic Chart

Status: Implemented

## Overview
Frontend-only refactor to introduce a single chart component that adapts to facility selection for regional_leader/global users.

## Components & Files
- New: `src/components/unified-inventory-chart.tsx`
- Modify: `src/app/(app)/reports/components/inventory-report-tab.tsx`
- Modify: `src/app/(app)/reports/page.tsx` (prop wiring for role visibility)
- Reuse: `src/components/interactive-equipment-chart.tsx`, `src/hooks/use-equipment-distribution.ts`
- Reuse: RPC `get_facilities_with_equipment_count()`

## Behavior
- Visibility:
  - Render only if `isGlobalOrRegionalLeader === true`.
- Mode switch:
  - If `tenantFilter === 'all'` → Facilities Distribution view (Top 10 + Show all) using `get_facilities_with_equipment_count()`.
  - Else → Per-facility Interactive view via existing `<InteractiveEquipmentChart />` with current props.
- Messages:
  - All-mode (global): “Đang hiển thị phân bố số lượng thiết bị theo cơ sở trên toàn hệ thống. Mặc định hiển thị Top 10; chọn ‘Hiển thị tất cả’ để xem toàn bộ.”
  - All-mode (regional_leader): “Đang hiển thị phân bố số lượng thiết bị theo cơ sở trong phạm vi của bạn. Mặc định hiển thị Top 10; chọn ‘Hiển thị tất cả’ để xem toàn bộ.”
  - Single-mode: “Biểu đồ tương tác cho cơ sở đã chọn.”

## Data
- All-mode data source:
  - Call `get_facilities_with_equipment_count()` → map to `{ name: "Facility (CODE)", value: equipment_count }`.
  - Sort by `value` desc, then name asc.
  - Top N = 10 by default; `showAll` state toggles to full list.
- Single-mode data source:
  - Unchanged; via `useEquipmentDistribution` inside `InteractiveEquipmentChart`.

## UI/UX
- Container: occupies the same slot where the interactive chart currently appears in the Inventory tab.
- All-mode chart: vertical bar chart (DynamicBarChart) with truncated labels + tooltip and horizontal scroll in expanded mode.
- Controls: a small secondary button “Hiển thị tất cả” / “Thu gọn” (toggle) on the right of the chart header.
- A11y: aria-label for the chart reflects current mode; toggle is keyboard accessible.

## Telemetry
- `unified_chart_viewed` { mode, role, facility_count }
- `show_all_toggled` { from }
- `mode_switched` { from, to }

## Integration Steps
1) `reports/page.tsx`
   - Compute `isGlobalOrRegionalLeader` (already present).
   - Pass it into `InventoryReportTab` as `isGlobalOrRegionalLeader` (new prop).
2) `inventory-report-tab.tsx`
   - Add new prop: `isGlobalOrRegionalLeader?: boolean`.
   - Render `<UnifiedInventoryChart tenantFilter={tenantFilter} selectedDonVi={selectedDonVi} effectiveTenantKey={effectiveTenantKey} isGlobalOrRegionalLeader={isGlobalOrRegionalLeader} />` in the chart slot.
   - Remove/adjust the old condition that hid charts in all-facilities mode for RL/global; keep other charts logic intact.
   - Keep `EquipmentDistributionSummary` as-is (single facility only), unless later decided otherwise.
3) `unified-inventory-chart.tsx`
   - Props: `{ tenantFilter?: string; selectedDonVi?: number | null; effectiveTenantKey?: string; isGlobalOrRegionalLeader?: boolean }`.
   - If not RL/global → return null.
   - If `tenantFilter === 'all'` → fetch facilities list via RPC, compute dataset, render Facilities Distribution bar chart with Top 10 + toggle.
   - Else → render `<InteractiveEquipmentChart ... />` passing through props.
   - Add friendly message under the title based on role & mode.

## Edge Cases
- No facilities returned: show empty state message in all-mode.
- Very long facility names: ellipsis with tooltip; ensure tooltip shows full name (CODE).
- Many facilities: default Top 10 on initial render; horizontal scroll on expanded.

## Localization Keys
- `reports.unifiedChart.all.globalMessage`
- `reports.unifiedChart.all.rlMessage`
- `reports.unifiedChart.single.message`
- `reports.unifiedChart.toggle.showAll`
- `reports.unifiedChart.toggle.collapse`
- `reports.unifiedChart.empty.all`

## Acceptance Criteria
- Unified chart renders for RL/global only; hidden for others.
- Auto-switch by facility selection (all vs single).
- All-mode defaults Top 10; toggle expands; sorted desc by count.
- Messages are localized and role-aware; controls accessible.
- Loading/empty/error states present.

## Out of Scope
- Backend migrations or new RPCs.
- Changing single-facility interactive semantics.

## Rollback Plan
- Revert Inventory tab to previous per-mode rendering.
- Remove UnifiedInventoryChart import and usage.

