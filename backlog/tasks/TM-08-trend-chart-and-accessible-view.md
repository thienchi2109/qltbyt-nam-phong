# TM-08 — Trend chart and accessible data view

- Status: Done (local implementation and review)
- Milestone: Temperature Monitoring / Insight UX
- Depends on: TM-04, TM-06
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Show temperature trend and limits without hiding abnormal points or excluding users who cannot use hover/color cues.

## Scope

- Raw measurement series, lower limit and upper limit series from threshold snapshots.
- Abnormal markers, touch/hover tooltip and date/shift/operator/note/deviation details.
- 7/30/90-day filters and maximum 90-day interactive window.
- Table fallback and non-color status cues.
- Lazy chart loading and bounded point density; never discard abnormal points silently.

## Acceptance criteria

- A threshold change produces visibly correct historical limit segments.
- Every abnormal point remains discoverable and has complete metadata.
- Tooltip works with touch and keyboard/focus alternatives; table view exposes equivalent data.
- Loading, empty, error and range labels are clear on mobile and desktop.

## Takeover gate

The agent must survey `DynamicLineChart`, chart utilities, report chart tests and accessibility conventions, then submit a detailed TM-08 plan before changing chart code.

## Frontend design gate

Approved by the owner on 2026-10-18: place the trend inside `Lịch sử`, require
one selected equipment for the chart, cap chart windows at 200 observations,
paginate the complete semantic table at 50 rows, and provide responsive
horizontal scrolling for that table on mobile. Preserve the chart tooltip and
explicit detail actions. The owner also approved the narrow route-private
`TemperatureMonitoringTrendView.tsx` composition exception; no new shared component,
dependency, RPC, or SQL change is authorized by this approval.

## Checkpoint — 2026-10-18

- Draft plan: `docs/plans/2026-10-18-temperature-monitoring-tm08-plan.md`.
- Branch/base: `feat/temperature-monitoring-tm-08` / `af3a4cce10b4ad64a8a4ffe596926108226b056d`.
- Owner approval releases the planned local implementation: the history-only trend, exactly-one-equipment prompt, 200-observation chart windows, complete 50-row semantic table pages, metadata tooltip, explicit slot-detail actions, and narrow route-private composition.
- The existing workspace RPC and server-side filters remain authoritative. Preserve the current cross-equipment history list when no equipment is selected; the trend hook stays disabled until one equipment is selected. The existing slot sheet remains reachable through `openSlot(row)`.
- Data verification: `/tmp/tm08-data-green.log` records `1 passed` file and `9 passed` tests for `src/hooks/__tests__/use-temperature-trend.test.ts`. An initial RED was observed during development, but no RED log was saved.
- Local SQL and live data are unchanged; formal DB gate debt remains deferred and `INCOMPLETE`.

## Independent completion evidence

- Lead ran the required ordered chain on the final source: formatting, explicit-any, diff-only dedupe, and TypeScript checks PASS; **11 Vitest files / 57 tests PASS**. Coverage includes temperature history, cursor/cache isolation, point/table interactions, the shared chart wrapper, assistant charts, and maintenance/inventory consumers.
- React Doctor: **93/100**, one non-blocking `no-high-complexity-react-function` warning at `TemperatureMonitoringPageClient.tsx`. Track further page simplification here; no additional component exception was requested for a scanner warning.
- Separate `post_implementation_reviewer` reviewed the complete working-tree diff (including new files) against `af3a4cce10b4ad64a8a4ffe596926108226b056d`, then checked the lead's final corrections: no remaining correctness/spec blockers.
- Semantic reuse: scoped query/cache invalidation, workspace RPC/filters, lazy `DynamicLineChart`, and slot sheet are reused. Table and selected-point metadata share one mapper. No new dependency, migration, RPC, or per-point lookup.
- All changed source files are at most 450 formatted lines: trend view 450, shared chart 444. The existing 449-line logbook hook is unchanged.
- Verified source fingerprint: `fb0831350d690437e5d2570dacd886629f3d21a0b134b302a8684295c8abb9f7` (SHA-256 over sorted changed code paths and bytes). Local commit identity is recorded below after hooks complete.
- Limits: no real-browser/authenticated E2E, deployment, merge, push, or live DB write. TM-07's formal DB gates remain `INCOMPLETE`; this SQL-free task does not clear that debt. TM-09 is outside this task.
