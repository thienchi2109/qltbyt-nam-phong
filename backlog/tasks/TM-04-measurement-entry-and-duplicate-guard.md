# TM-04 — Measurement entry and duplicate guard

- Status: Todo
- Milestone: Temperature Monitoring / Core workflow
- Depends on: TM-02, TM-03
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Save one manual temperature reading for a device-day-shift slot with reliable server-side conflict protection.

## Scope

- °C input with one decimal place, bounded physical validation and explicit “không đo được” reason.
- Reading source `manual`, operator, timestamp, note, method and threshold snapshot.
- Database uniqueness for `(equipment_id, monitoring_date, shift_id)`.
- In-range, out-of-range and invalid-input outcomes.

## Acceptance criteria

- Concurrent submissions cannot create duplicate primary readings.
- A conflict returns the existing slot/read state and a clear path to amendment.
- In-range readings become `Đã ghi`; out-of-range readings become `Bất thường` and emit a deviation creation event for TM-06.
- The operation is tenant-safe, auditable and does not expose raw database errors.

## Takeover gate

The agent must survey current RPC transaction/lock/error conventions and existing query mutation tests, then write a detailed TM-04 plan before implementation.
