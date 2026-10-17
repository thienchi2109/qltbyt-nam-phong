# TM-03 — Schedules, shifts and missing-slot projection

- Status: In Progress
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

## Survey and implementation plan (2026-10-17)

Read-only survey evidence:

- `docs/specs/temperature-monitoring.md` and `docs/specs/temperature-monitoring-domain-contract.md` define UTC event storage, `Asia/Ho_Chi_Minh` default display timezone, shift-start `monitoring_date`, eligibility, the 7/30/90-day (maximum 90-day) query boundary, and keyset pagination.
- TM-02 migration `supabase/migrations/20261017100000_temperature_monitoring_configuration.sql` provides effective-dated configuration versions and schedule-profile references, but no shift rows, slot projection, or reading table.
- Existing equipment seams use `thiet_bi.don_vi`, `khoa_phong_quan_ly`, `tinh_trang_hien_tai`, `ngay_dua_vao_su_dung`, `ngay_ngung_su_dung`, and `is_deleted`; RPCs derive tenant/role claims with `_get_jwt_claim('app_role'/'role')`.
- No TM-03 implementation or SQL test existed; the RPC proxy whitelist currently contains only TM-02 configuration functions.

Implementation plan:

1. Add a post-TM-02 migration with immutable default shift catalog, per-schedule shift overrides, and an index-backed read-only expected-slot projection RPC.
2. Derive slots from effective enabled configuration + active/operational equipment and selected date/shift filters; calculate `monitoring_date` from local shift start (including overnight shifts) without materializing empty readings.
3. Enforce tenant/department authorization, explicit admin unconfigured filtering, maximum 90-day windows, and opaque keyset cursor pagination in the RPC; grant only the RPC to authenticated callers and register it in the proxy allowlist.
4. Add static SQL smoke coverage for catalog/defaults, timezone/overnight/effective boundaries, disabled/unconfigured/operational filtering, tenant isolation, cursor/date/shift limits, and `Chưa ghi` projection semantics.
5. Run formatting and the repository static DB quality gate; run/report Oracle baseline-forward separately when available. Commit on the TM-03 feature branch; leave Done status for independent review.

Invariants and risks: no empty slot rows are persisted; slot identity is equipment/date/shift; global/admin role handling must remain claim-based; existing equipment date columns are text and are parsed defensively; baseline-forward may be unavailable or report known harness false positives.
