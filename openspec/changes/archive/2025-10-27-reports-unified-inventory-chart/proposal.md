# Reports Inventory: Unified Dynamic Chart (Facilities Distribution in All mode; Interactive in Single-facility)

- ID: 2025-10-27-reports-unified-inventory-chart
- Status: Implemented
- Date: 2025-10-27
- Owners: Reports/Inventory FE + BE
- Related: openspec/changes/archive/2025-10-27-fix-reports-all-facilities-aggregation

## Summary
Unify the Inventory tab’s “interactive chart” into a single dynamic component visible only to regional_leader and global users. The chart automatically switches its visualization based on the user’s current facility selection:
- All facilities selected → Facilities Equipment Distribution (current stock per facility), default Top 10 with a “Show all” toggle, with a friendly role-aware message.
- Single facility selected → The existing per-facility interactive chart (by department/location) with full interactivity.

No backend migrations are required. We reuse the existing get_facilities_with_equipment_count RPC for all-facilities current stock per facility, and keep current hooks for single-facility mode.
