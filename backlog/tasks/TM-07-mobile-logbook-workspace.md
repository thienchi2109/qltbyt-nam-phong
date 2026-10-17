# TM-07 — Mobile logbook workspace

- Status: Todo
- Milestone: Temperature Monitoring / Entry UX
- Depends on: TM-03, TM-04, TM-06
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Provide one mobile-first workspace for selecting a shift, entering readings and handling immediate abnormalities.

## Scope

- Equipment cards grouped by selected shift/date with one-tap entry.
- Status, threshold, method, note, deviation action and save feedback in the same flow.
- Server-side filters for equipment, date, shift and status.
- Explicit displayed range and manual-monitoring limitation.
- Equipment profile summary/deep-link and optional QR shortcut.

## Acceptance criteria

- A staff member can complete a normal reading without navigating through multiple screens.
- Touch targets, focus states, overlay actions and loading/error/empty states meet existing mobile patterns.
- The workspace never fetches beyond the selected server-side window and clearly displays that window.
- Equipment scope and role permissions match the existing Equipment module.

## Takeover gate

The agent must survey current Equipment mobile cards, bottom sheets, route synchronization and accessibility tests, then write a detailed TM-07 plan before editing UI.

## Frontend design gate

Implementation is blocked until the mobile-first screen design/layout, entry
flow and responsive states are explicitly reviewed and approved by the user.
The master spec describes behavior only; it is not UI approval.
