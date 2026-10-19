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
- Exact-commit React Doctor: **91/100**, nine warnings: high complexity (page and trend), large trend component, reset-all-state and four state-adjustment findings on the scope-reset effect, and a redundant explicit region role. Separate reviewer classifies these as non-blocking; the owner requested a fresh read-only worker assessment before deciding whether to fix them. The earlier 93/100 pre-commit scan omitted untracked files and is superseded.
- Separate `post_implementation_reviewer` reviewed the complete working-tree diff (including new files) against `af3a4cce10b4ad64a8a4ffe596926108226b056d`, then checked the lead's final corrections: no remaining correctness/spec blockers.
- Semantic reuse: scoped query/cache invalidation, workspace RPC/filters, lazy `DynamicLineChart`, and slot sheet are reused. Table and selected-point metadata share one mapper. No new dependency, migration, RPC, or per-point lookup.
- All changed source files are at most 450 formatted lines: trend view 450, shared chart 444. The existing 449-line logbook hook is unchanged.
- Implementation commit: `c9de07de8d7d86cb67bf33a44038c6b151b78301`, with hooks enabled and passing. The lead re-ran the full ordered verification chain on this exact commit.
- Verified source fingerprint: `0d6d9937861d0ce21ea552311d059086c6ceb18b71973e00d21412c16d75b93c` (SHA-256 over sorted changed code paths and bytes, including required JSDoc added before commit).
- Limits: no real-browser/authenticated E2E, deployment, merge, push, or live DB write. TM-07's formal DB gates remain `INCOMPLETE`; this SQL-free task does not clear that debt. TM-09 is outside this task.

## Approved ARIA cleanup — 2026-10-19

- After an independent read-only assessment, the owner approved removing only the redundant explicit `role="region"` from the labelled point-detail `<section>`. A new `gpt-6.1-sol/high` worker made the one-line deletion; the implicit named region, live announcement, focus, and Escape behavior remain intact.
- Lead independently passed the ordered format, explicit-any, diff-only dedupe, typecheck, existing trend-view tests (**7/7 PASS**), and React Doctor checks. Doctor remains **91/100**, now **8 warnings**; the ARIA warning is gone. The earlier 57/57 result remains the broader implementation evidence at `c9de07de`; this cleanup reran only the affected 7-test suite.
- Keep the five scope-reset and three complexity/size warnings as reviewed non-blocking debt. No state-reset refactor or additional component was introduced. The trend view is now 449 formatted lines.
- Cleanup source fingerprint: `0cb6607101219eda69fb814d12d218cd3d2d6cd10eced6be55dc5b9d1b84b58d`, using the same sorted-path/bytes algorithm above. Main and live systems remain unchanged.
