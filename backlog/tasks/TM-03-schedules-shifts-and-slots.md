# TM-03 — Schedules, shifts and missing-slot projection

- Status: Todo
- Milestone: Temperature Monitoring / Foundation
- Depends on: TM-01, TM-02
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Represent configurable measurement schedules and return expected slots without creating large sets of empty rows.

## Scope

- Default Sáng/Chiều/Tối/Đêm shift catalog with unit-level naming/time overrides.
- `monitoring_date` based on shift start, including overnight shifts and `Asia/Ho_Chi_Minh` display.
- Active-date and equipment-operational checks.
- Server-side projection of missing slots as `Chưa ghi`.

## Acceptance criteria

- A query returns only authorized equipment, selected date window and selected shifts.
- Missing expected slots appear as `Chưa ghi` without materialized empty measurement records.
- Overnight and effective-date boundaries are deterministic and covered by tests.
- The projection supports cursor pagination and does not fetch the full history.

## Takeover gate

Before editing schema or query code, the agent must survey existing date/time, maintenance schedule, pagination and tenant patterns and submit a detailed TM-03 plan.
