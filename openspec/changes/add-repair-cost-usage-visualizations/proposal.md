## Why
Maintenance reports now expose repair cost KPIs, but users still cannot see which equipment drives the highest repair spend or whether repair cost is related to actual equipment usage time.

The next reporting increment should turn the captured `chi_phi_sua_chua` data into visual operational insights while using `nhat_ky_su_dung` for real usage duration.

## What Changes
- Add a Top 10 visualization for equipment with the highest completed repair cost in the selected report date range.
- Add a usage-vs-repair-cost visualization that compares total completed usage hours from `nhat_ky_su_dung` with completed repair cost per equipment.
- Default both visualizations to the current `/reports` date range, with a cumulative mode for the correlation chart through the selected end date.
- Keep the existing `get_maintenance_report_data(date,date,bigint)` signature and return both period and cumulative correlation datasets in the same payload.
- Add a data-quality empty state when there are too few equipment records with both usage duration and recorded repair cost.
- Preserve existing tenant/facility scoping and repair report security patterns.

## Impact
- Affected specs: `repair-request-cost-statistics`
- Affected code:
  - Supabase report RPC aggregation for `get_maintenance_report_data(date,date,bigint)`.
  - Maintenance report data types and default payloads.
  - `/reports` maintenance tab chart UI, likely split into focused chart components because the current tab file is near the repo line ceiling.
- Testing:
  - SQL smoke coverage for usage-duration aggregation, cost sorting, sparse-data behavior, and tenant scoping.
  - Vitest coverage for report data contract and chart/empty-state rendering.
