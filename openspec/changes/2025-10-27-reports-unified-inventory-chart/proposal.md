# Reports Inventory: Unified Dynamic Chart (Facilities Distribution in All mode; Interactive in Single-facility)

- ID: 2025-10-27-reports-unified-inventory-chart
- Status: Proposed
- Date: 2025-10-27
- Owners: Reports/Inventory FE + BE
- Related: openspec/changes/archive/2025-10-27-fix-reports-all-facilities-aggregation

## Summary
Unify the Inventory tab’s “interactive chart” into a single dynamic component visible only to regional_leader and global users. The chart automatically switches its visualization based on the user’s current facility selection:
- All facilities selected → Facilities Equipment Distribution (current stock per facility), default Top 10 with a “Show all” toggle, with a friendly role-aware message.
- Single facility selected → The existing per-facility interactive chart (by department/location) with full interactivity.

No backend migrations are required. We reuse the existing get_facilities_with_equipment_count RPC for all-facilities current stock per facility, and keep current hooks for single-facility mode.

## Motivation & Goals
- Simplify UX by replacing conditional/hiding logic with one role-gated chart that adapts to context.
- Provide at-a-glance, scoped system overview for multi-facility (RL/global) while preserving depth for single facility.
- Reduce UI duplication and future maintenance cost.

## Non-goals
- Changing business rules for “current stock”.
- Adding new database migrations.
- Changing existing single-facility interactive behavior and datasets.

## Current state (as of last commit)
- Multi-facility mode (tenantFilter === 'all'): charts are hidden and only KPI aggregates show.
- Single-facility mode: InteractiveEquipmentChart (by department/location) renders alongside other charts.
- Role gating exists for tenant selection; interactive chart is currently hidden in all-facilities view.

## Proposal
Introduce a unified dynamic chart component (UnifiedInventoryChart) that renders only for regional_leader/global users and switches views:
- All-facilities view (Facilities Distribution):
  - Data: current stock per facility (role-scoped).
  - Default: Top 10 facilities by current stock; “Show all” reveals all facilities.
  - Sorting: current stock desc; tie-breaker by facility name asc.
  - Messaging (localized): friendly, role-aware info line (global = across all facilities; regional_leader = within your region).
- Single-facility view (Per-facility Interactive):
  - Reuse current InteractiveEquipmentChart behavior and data (department/location breakdown, cross-filtering, legends, tooltips).
  - No separate facilities snapshot above; the unified chart replaces the old interactive slot.

### Role visibility
- Visible: regional_leader (scoped to allowed facilities), global (all facilities).
- Hidden: all other roles (no placeholder to avoid signaling unavailable capability).

### Friendly messages (vi)
- All-facilities (global): “Đang hiển thị phân bố số lượng thiết bị theo cơ sở trên toàn hệ thống. Mặc định hiển thị Top 10; chọn ‘Hiển thị tất cả’ để xem toàn bộ.”
- All-facilities (regional_leader): “Đang hiển thị phân bố số lượng thiết bị theo cơ sở trong phạm vi của bạn. Mặc định hiển thị Top 10; chọn ‘Hiển thị tất cả’ để xem toàn bộ.”
- Single-facility: “Biểu đồ tương tác cho cơ sở đã chọn.”

## UX Specification
- Placement: Inventory tab, below KPI cards, occupying the existing “interactive chart” slot.
- All-facilities view:
  - Vertical bar chart; X = facility (truncate/tooltip), Y = current stock.
  - Top 10 by default; “Hiển thị tất cả” toggle expands to all.
  - Tooltip: facility name (with code) and count; accessible via keyboard.
  - Large sets: enable horizontal scroll in expanded mode.
- Single-facility view:
  - Preserve all existing interactions, tooltips, legends, cross-filters (department/location), and loading/empty states.
- States:
  - Loading: skeleton sized to chart.
  - Empty (all-facilities): “Không có dữ liệu tồn kho theo cơ sở trong phạm vi của bạn.”
  - Empty (single-facility): unchanged.
  - Error: friendly message; technical details in logs.
- Accessibility/i18n:
  - Localize all messages; add aria-labels reflecting current mode.
  - Keyboard-focusable “Hiển thị tất cả” toggle with focus-visible styling.

## Data & API
- All-facilities Facilities Distribution:
  - Source: get_facilities_with_equipment_count() → returns [{ id, name, code, equipment_count }] role-aware.
  - No date/department filtering; it is a “current stock per facility” snapshot.
  - Transform: sort desc by equipment_count; take Top 10 (default), expand on toggle.
- Single-facility interactive:
  - Source: existing useEquipmentDistribution hook and InteractiveEquipmentChart; no change to semantics.

## Security / RBAC
- Client: feature-gate rendering to regional_leader/global by inspecting session role from parent page and passing a prop (e.g., isGlobalOrRegionalLeader) to InventoryReportTab.
- Server: rely on existing role-aware RPC (get_facilities_with_equipment_count) to enforce scope (regional_leader limited to allowed facilities; global sees all).
- No new endpoints; no schema changes.

## Performance
- All-facilities mode uses a single role-aware RPC returning counts; Top 10 default avoids rendering very long label sets.
- Expand to all only on user action; consider virtualization/h-scroll for long lists.

## Analytics / Telemetry
- Events:
  - unified_chart_viewed { mode: ‘all’|‘single’, role, facility_count }
  - show_all_toggled { from: false|true }
  - mode_switched { from: ‘all’|‘single’, to: … }
- Avoid PII; include render_time_ms for perf tracking.

## Rollout
- Behind a small FE feature flag (optional), default enabled for regional_leader/global.
- Validate on staging with representative data volumes.

## Testing Plan
- Unit:
  - Mode detection and switching on tenantFilter changes.
  - Sorting (stock desc) and Top 10 truncation.
  - Toggle state resets when switching modes.
- Integration (UI):
  - RL/global see the chart; others do not.
  - All mode shows facilities distribution; Single mode shows interactive chart.
  - Loading/empty/error states.
  - Long facility names truncation and tooltip.
- Manual QA checklist:
  - RL (all): friendly message correct; Top 10 shows; Show all reveals all; counts match RPC.
  - Global (all): same as above with “toàn hệ thống” message.
  - Single facility: interactive chart unchanged; cross-filters work.

## Acceptance Criteria
- [ ] UnifiedInventoryChart renders only for regional_leader/global.
- [ ] Mode auto-switches: tenantFilter === ‘all’ → facilities distribution; otherwise single-facility interactive.
- [ ] All-facilities view defaults to Top 10, sorted desc by equipment_count, with “Hiển thị tất cả” toggle.
- [ ] Friendly, localized messages appear per role and mode.
- [ ] Single-facility mode preserves existing interactive behavior (filters, tooltips, legends).
- [ ] Loading/empty/error states implemented and accessible.

## Risks & Mitigations
- Large facility counts → default Top 10, expand on demand; enable h-scroll/virtualization as needed.
- Long labels → truncate with tooltip; cap x-axis tick density.
- Scope leakage → rely on role-aware RPC; no new endpoints.

## Open Questions
- Maximum facility count to render without virtualization in expanded mode (default 50?).
- Precise copy for messages in both vi/en; finalize with product/UX.

## Implementation Plan (post-acceptance)
- FE only (no DB changes):
  1) Add UnifiedInventoryChart component that reads tenantFilter and isGlobalOrRegionalLeader via props from Reports page.
  2) All mode: fetch facilities via get_facilities_with_equipment_count, compute Top 10 and support “Hiển thị tất cả”.
  3) Single mode: render existing InteractiveEquipmentChart internally (reuse implementation/hook).
  4) Replace current InteractiveEquipmentChart usage in InventoryReportTab with UnifiedInventoryChart for RL/global users.
  5) Add i18n keys, accessibility labels, and telemetry hooks.

## References
- src/app/(app)/reports/page.tsx
- src/app/(app)/reports/components/inventory-report-tab.tsx
- src/components/interactive-equipment-chart.tsx
- src/hooks/use-equipment-distribution.ts
- supabase/migrations/2025-10-04/20251004123000_add_get_facilities_with_equipment_count.sql
- openspec/changes/archive/2025-10-27-fix-reports-all-facilities-aggregation/*