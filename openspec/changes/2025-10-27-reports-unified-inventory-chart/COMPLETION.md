# Completion — Reports Inventory Unified Dynamic Chart

- Change ID: 2025-10-27-reports-unified-inventory-chart
- Status: Implemented
- Completed: 2025-10-28

## Summary
Frontend-only implementation completed:
- UnifiedInventoryChart added; RL/global-only rendering.
- All-facilities: Facilities Equipment Distribution using get_facilities_with_equipment_count (Top 10 default, "Hiển thị tất cả" toggle; sorted by count desc then name asc).
- Single-facility: Reused InteractiveEquipmentChart; behavior unchanged.
- Department filter hidden for RL/global users.

## Acceptance Checklist
- [x] Renders only for regional_leader/global.
- [x] Auto-switch all vs single facility.
- [x] All-mode Top 10 default; toggle expands/collapses.
- [x] Localized role-aware messages.
- [x] Loading/empty/error states.

## Files Touched
- src/components/unified-inventory-chart.tsx (new)
- src/app/(app)/reports/components/inventory-report-tab.tsx (wire-in, hide dept filter for RL/global)
- src/app/(app)/reports/page.tsx (prop wiring)

## Notes
- No DB changes; uses existing RPCs via API proxy.
- Telemetry placeholders via console.debug per spec.
