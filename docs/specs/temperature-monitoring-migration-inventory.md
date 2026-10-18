# Temperature Monitoring — local migration inventory

Recorded on 2026-10-18 from local `main` at
`0d0a9384989d615fc133723b78be093590f4f768` (TM-01 through TM-06).

There are **11 pending migrations**. Read-only inspection of live project
`cdthersvldpnlbvpufrr` in this session found none of these versions or
temperature-monitoring migration names in `supabase_migrations.schema_migrations`.

| Task  | Migration under `supabase/migrations/`                        |
| ----- | ------------------------------------------------------------- |
| TM-01 | None — domain contract and survey only                        |
| TM-02 | `20261017100000_temperature_monitoring_configuration.sql`     |
| TM-03 | `20261017110000_temperature_monitoring_schedules_slots.sql`   |
| TM-04 | `20261017120000_temperature_monitoring_measurements.sql`      |
| TM-04 | `20261017120100_temperature_monitoring_recorded_slots.sql`    |
| TM-05 | `20261018030000_temperature_monitoring_review_state.sql`      |
| TM-05 | `20261018030100_temperature_monitoring_review_actions.sql`    |
| TM-05 | `20261018030200_temperature_monitoring_review_projection.sql` |
| TM-06 | `20261018040000_temperature_monitoring_deviation_state.sql`   |
| TM-06 | `20261018040100_temperature_monitoring_deviation_actions.sql` |
| TM-06 | `20261018040200_temperature_monitoring_deviation_queries.sql` |
| TM-06 | `20261018040300_temperature_monitoring_user_recording.sql`    |

## Owner decision and evidence boundary

- Keep these migrations local; do not apply to live. No live-apply authorization
  follows from starting TM-07 or any later task.
- Owner deferred further formal gate repair work. Static and baseline-forward
  certification remain **INCOMPLETE**; deferral is not a PASS or standing bypass.
- Disposable application, behavior, backfill and concurrency tests passed; the
  exact source, independent evidence and cleanup records are in
  [TM-06](../../backlog/tasks/TM-06-deviation-and-corrective-action.md).
- This inventory is a dated snapshot. Survey each later task before deciding
  whether additional migrations are necessary; record any additions separately.
