# TM-08 — Trend chart and accessible data view

- Status: Todo
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
