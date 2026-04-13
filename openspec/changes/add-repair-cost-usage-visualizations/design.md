## Context
Repair cost capture is complete and archived under `repair-request-cost-statistics`. The current `/reports` maintenance tab shows repair/maintenance KPI cards, trend/status charts, maintenance plan comparison, top repaired equipment by request count, and recent repair history.

Supabase schema inspection on 2026-04-13 confirmed that actual usage duration must come from `public.nhat_ky_su_dung`, using `thoi_gian_bat_dau` and `thoi_gian_ket_thuc`, joined to repair requests through `thiet_bi.id`. Live data is currently sparse, so the UI must not imply a meaningful correlation when there are too few overlapping records.

## Goals / Non-Goals
- Goals: show top repair-cost equipment, show usage-hours vs repair-cost relationship, keep the default scope aligned with the report date range, and expose insufficient-data state clearly.
- Non-goals: change how repair cost is captured, change usage-log creation flows, backfill repair costs, or infer usage from equipment age fields such as `ngay_dua_vao_su_dung`.

## Decisions
- Default scope: selected report date range for both cost ranking and correlation.
- Cumulative mode: optional toggle for the correlation chart only, using completed usage and completed repair costs through `dateRange.to`.
- RPC contract: keep the existing `get_maintenance_report_data(date,date,bigint)` signature and return correlation data as two named scopes in one payload, for example `charts.repairUsageCostCorrelation.period` and `charts.repairUsageCostCorrelation.cumulative`, each with `points` and `dataQuality`.
- Usage duration: sum only valid completed intervals where `thoi_gian_ket_thuc IS NOT NULL` and `thoi_gian_ket_thuc > thoi_gian_bat_dau`.
- Cost basis: completed repair requests with non-null `chi_phi_sua_chua`; averages exclude null values and totals coalesce to zero only after aggregation.
- Chart readiness: render the correlation chart only when at least three equipment have both positive usage hours and recorded repair cost; otherwise render a data-quality empty state with counts.
- File structure: split new report chart components/helpers out of `maintenance-report-tab.tsx` before adding UI because the file is already near the 450-line hard ceiling.

## Risks / Trade-offs
- Sparse production data can make correlation misleading; mitigate with the minimum-point threshold and explicit data-quality copy.
- Adding usage aggregation to the existing report RPC can increase query work; mitigate by aggregating usage in scoped CTEs keyed by `thiet_bi_id` and relying on the existing `nhat_ky_su_dung(thiet_bi_id, thoi_gian_bat_dau)` index.
- Existing `topEquipmentRepairs` sorts by request count; add a separate cost-ranked payload instead of silently changing the existing table behavior.

## Verification
- Follow TDD: add failing SQL and UI tests before production changes.
- Run repo TypeScript/React gates in the required order for `.ts`/`.tsx` changes.
- Run Supabase security advisor after the migration.
