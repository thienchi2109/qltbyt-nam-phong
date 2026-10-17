# TM-09 — Long-range export

- Status: Todo
- Milestone: Temperature Monitoring / Reporting
- Depends on: TM-04, TM-05, TM-06
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Export authorized temperature history beyond the 90-day interactive UI limit.

## Scope

- Export filters for any authorized date range, equipment, shift and status.
- Server-side streaming or background processing for large ranges.
- Excel as the first format; include threshold snapshots, states, actors, amendments and deviations.
- Size/rate limits and safe error handling.

## Acceptance criteria

- A user can export multiple years when permitted without the browser fetching all rows.
- Export results respect tenant/department permissions and amendment effective state.
- UI states explicitly distinguish “interactive display max 90 days” from long-range export.
- Large exports provide progress/failure feedback and do not expose raw database errors.

## Takeover gate

The agent must survey existing equipment/maintenance export utilities, authorization checks and large-download constraints, then write a detailed TM-09 plan before implementation.
