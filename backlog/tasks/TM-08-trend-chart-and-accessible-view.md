# TM-08 — Trend chart and accessible data view

- Status: In Progress
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

Implementation is blocked until the chart layout, interaction model, tooltip,
table fallback and mobile/desktop responsive states are explicitly reviewed and
approved by the user. The master spec describes behavior only; it is not UI
approval.

## Checkpoint — 2026-10-18

- Draft plan: `docs/plans/2026-10-18-temperature-monitoring-tm08-plan.md`.
- Branch/base: `feat/temperature-monitoring-tm-08` / `af3a4cce10b4ad64a8a4ffe596926108226b056d`.
- All runtime, DTO/type, hook, page, chart, and test edits in plan Tasks 1–3 are deferred until the owner explicitly approves the proposed design and composition decision.
- Current work is plan and design-gate preparation only. UI implementation remains blocked until the user explicitly approves the proposed layout and the narrow route-private composition exception (or the inline fallback).
- Lead independently checked the current workspace SQL/DTO contract, chronological ordering, component reuse constraints and documentation diff. Separate reviewer found no remaining blockers in the revised proposal against the fixed base.
- The two Markdown files were formatted with the installed Prettier; whitespace validation passed. No chart/runtime/test/migration implementation or runtime quality gates have been run. Existing formal DB gate debt remains deferred and `INCOMPLETE`.
