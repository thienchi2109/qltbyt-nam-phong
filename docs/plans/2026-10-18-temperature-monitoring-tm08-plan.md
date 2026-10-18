# Temperature Monitoring Trend Chart Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents are available) or superpowers:executing-plans to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Add a safe, accessible trend view for temperature workspace observations, including amendments, limits, deviations, and scheduled gaps.

**Architecture:** Place the view inside the existing `Lịch sử` surface and reuse the workspace RPC, filters, chart primitive, and slot sheet. Drain all cursor pages for the selected equipment and filters, then expose bounded 200-observation chart windows plus the complete paginated table. Preserve point-in-time values, gaps, threshold snapshots, and deviation metadata without interpolation or aggregation that could misstate them.

**Tech Stack:** Existing React/TypeScript workspace, temperature workspace RPC, current chart primitives, and Vitest.

**Status:** Draft proposal; UI implementation is blocked pending explicit user approval of this layout. Branch `feat/temperature-monitoring-tm-08`, base `af3a4cce10b4ad64a8a4ffe596926108226b056d`.

**Implementation gate:** All runtime, DTO/type, hook, page, chart, and test edits in Tasks 1–3 are deferred until the owner explicitly approves this design, including the proposed route-private composition exception or inline fallback. The tasks below describe work after that gate only.

---

## Scope and evidence

- Place the chart inside the existing `Lịch sử` surface in `src/app/(app)/temperature-monitoring/TemperatureMonitoringPageClient.tsx`. Require exactly one selected equipment; with none or multiple, show `Chọn một thiết bị để xem biểu đồ`.
- Default to the last 30 inclusive calendar days. Offer 7/30/90-day presets and custom inclusive dates capped at 90 days; apply shift/status filters server-side and visibly label the selected from–to range and 90-day maximum. Include `Hiển thị các lần ghi nhận thủ công; đây không phải dòng giám sát liên tục.`
- Reuse the existing workspace RPC/filter state. Drain `p_limit` pages of at most 200 until exhausted; any later-page error fails the full load. The hook currently requests 50 rows (`src/hooks/use-temperature-workspace-filters.ts`).
- Sort by resolved x (`captured_at` for readings, `slot_start` for empty slots), then stable `reading_id` or empty-slot identity. Retain `monitoring_date` and shift as data, not sorting substitutes.
- Plot one raw effective amended value per recorded slot, unsmoothed with straight segments. Keep original capture time/note and snapshot bounds. Preserve linked deviation markers after an amendment returns in range.
- Keep empty and unable-to-measure slots as gaps; never coerce null to zero or connect a line across a gap. Break lines at missing/unable states and chart-window edges.
- Show operator as `#<operator_user_id>`; do not add name lookup or one detail request per point. Use the existing slot sheet from an explicit `Xem chi tiết` button.
- Reuse `src/components/dynamic-chart.tsx` and preserve its lazy Recharts loader; do not eagerly import Recharts into the workspace. Reuse the chart-plus-table accessibility precedent in `src/app/(app)/reports/components/equipment-search-report-tab.tsx`. No new RPC, database migration, dependency, or server aggregation is in scope.
- A dedicated route-private `TemperatureMonitoringTrendView.tsx` is proposed as a narrow exception to the five compositions currently allowed by the domain contract. It is not approved yet; if declined, keep the view inline while `use-temperature-logbook.ts` remains untouched at 449 lines and no file exceeds 450.

## Proposed layout — approval required before UI implementation

Desktop — inside the existing `Lịch sử` section after its filters:

```text
┌ Lịch sử ────────────────────────────────────────────────────────────┐
│ Equipment (exactly one) · 30 ngày · shift · status · range: from–to │
│ Hiển thị các lần ghi nhận thủ công; đây không phải dòng giám sát liên tục.│
│ Đang vẽ 1–200/… điểm; … bất thường ngoài khung · [Previous] [Next] │
│ Temperature °C   ●────●     gap      ◆ deviation   Time →          │
│ [Named semantic table: every observation, paginated 50 rows]         │
└─────────────────────────────────────────────────────────────────────┘
```

Mobile (stacked controls; semantic table scrolls within its own region):

```text
Lịch sử
[Stacked equipment/date/shift/status controls]
[Compact chart: same maximum 200 points per window]
Observation table → its own labelled horizontal-scroll region
14:00 · 5.1 °C · limit 2–8 °C · deviation · [Xem chi tiết]
```

- Render snapshot lower/upper bounds as discrete segments only while adjacent observations share the same configuration version and bounds. Break at missing/unable states and configuration changes; show the new snapshot at its observation and never imply an unseen policy-change time. Raw readings are straight, unsmoothed segments.
- Show no more than 200 chronological observations in one chart window; page through windows without downsampling or aggregation. Show `Đang vẽ {first}–{last}/{total} điểm; {outside} bất thường ngoài khung`, with accessible previous/next controls. The full table paginates at 50 and offers `Chỉ xem bất thường`; no unlimited SVG points.
- Hover, keyboard focus, or touch selection exposes a tooltip with monitoring date, captured time, shift, operator ID, original note, snapshot lower/upper bounds, value or unable state, slot status, and deviation ID/status/severity. Provide an explicit `Xem chi tiết` button to open the existing slot sheet; do not make the whole row the only action.
- Keep a semantic named table on all sizes with columns for monitoring date, captured time, shift, effective value or unable state, slot status, snapshot lower/upper bounds, operator ID, original note, and deviation ID/status/severity. Provide an explicit `Xem chi tiết` button per row; the row itself is not the only action. On mobile, place the table in its own labelled horizontal-scroll region; do not replace table semantics with generic stacked list rows. Never encode status by color alone.
- Loading: `Đang tải dữ liệu nhiệt độ…`. Empty range: `Không có dữ liệu trong khoảng thời gian này.` No numeric values but unable-to-measure records: `Không có số đo bằng số trong khoảng thời gian này; có lần ghi nhận không đo được.` Error/retry: `Không tải được dữ liệu nhiệt độ đầy đủ. Thử lại.` Equipment/filter change clears the prior series and shows `Đang cập nhật thiết bị và bộ lọc…`; ignore any late response for the old scope.

## Implementation tasks

### Task 1: Define and test the trend observation mapping

**Files:** `src/app/(app)/temperature-monitoring/TemperatureMonitoringPageClient.tsx`; `src/app/(app)/temperature-monitoring/TemperatureMonitoringFilters.tsx`; `src/hooks/use-temperature-workspace-filters.ts`; `src/types/temperature-monitoring.ts`; proposed mapper `src/lib/temperature-trend.ts` only if the page/hook would otherwise grow; proposed test `src/hooks/__tests__/use-temperature-trend.test.ts`. Do not grow `src/hooks/use-temperature-logbook.ts` (449 lines).

- [ ] Add failing cases for a point on cursor page 2, later-page failure, mixed empty/recorded chronological ordering by resolved x (including overnight slots), stable equal-time ties, changed-threshold boundary, approved amendment with linked deviation, and unable-state gaps. Verify server shift/status filters remain intact.
- [ ] Run the focused test and confirm the failures exercise those contracts.
- [ ] Make the smallest mapping/query change. Drain all pages at the selected filters, sort after collection, keep all point metadata together, and return an error if a page fails. Add `note` to the DTO only if the current RPC row already supplies it.
- [ ] Rerun the focused test; confirm all cases pass and no N+1 detail calls were introduced.

### Task 2: Implement the proposed chart and accessible view (after UI approval)

**Files:** `src/app/(app)/temperature-monitoring/page.tsx`, `src/app/(app)/temperature-monitoring/TemperatureMonitoringPageClient.tsx`, `src/app/(app)/temperature-monitoring/TemperatureMonitoringFilters.tsx`, `src/app/(app)/temperature-monitoring/TemperatureMonitoringSlotSheet.tsx`, `src/components/dynamic-chart.tsx`, `src/lib/chart-utils.ts`; proposed route-private `src/app/(app)/temperature-monitoring/TemperatureMonitoringTrendView.tsx` only after its exception is approved; proposed test `src/app/(app)/temperature-monitoring/__tests__/TemperatureMonitoringTrendView.test.tsx`. Reuse `src/components/__tests__/dynamic-bar-chart.tooltip.test.tsx` and `src/app/(app)/reports/components/__tests__/equipment-search-report-tab.test.tsx` as precedent.

- [ ] Add failing component cases for loading/empty/all-unable/error/retry states; scope change cancelling old data; exact equipment prompt; bounded 200-point windows with outside-window anomaly count; 50-row full table and anomaly shortcut; touch and keyboard actions; table/tooltip metadata; and gap/threshold break behavior.
- [ ] Run the focused test and confirm each scenario fails for the missing behavior.
- [ ] Add the responsive chart/table using existing primitives: straight effective-value line, discrete snapshot-bound segments, no downsampling, complete paginated table, explicit detail buttons, and deviation markers independent of current effective range.
- [ ] Rerun the focused component test and confirm the accessible table is complete at mobile and desktop widths.

### Task 3: Verify and hand off

- [ ] Run, in order: `node scripts/npm-run.js run format:check`; `node scripts/npm-run.js run verify:no-explicit-any`; `node scripts/npm-run.js run verify:dedupe`; `node scripts/npm-run.js run typecheck`; focused temperature-monitoring tests; `node scripts/npm-run.js run react-doctor`.
- [ ] Run the `code-deduplication` skill before commit because chart mapping/view behavior reuses existing seams; document the reuse result.
- [ ] Confirm no SQL, generated RPC types, new dependency, or unrelated UI changed. Record exact commit and verification results in TM-08.

## Acceptance

- All selected-filter workspace pages are loaded before chart/table display; any page error is visible and no partial dataset is presented as complete.
- Observations are chronological and use effective amended values with original capture context and snapshot limits.
- Null states remain gaps; deviation linkage stays visible after a corrected value returns in range.
- Chart interactions expose point details by keyboard and touch, and the accessible table contains every observation without depending on color.
- No UI implementation begins until the user approves this layout and the route-private composition decision.
