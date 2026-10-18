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

## TM-07 forward additions (local draft, 2026-10-18)

The original eleven files above remain unchanged. Six additional local migrations
implement the approved TM-07 read/projection/capture contracts; none was applied
to live. Formal static and baseline-forward remain **INCOMPLETE**.

| Migration                                                        | Contract                                                                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `20261018050000_temperature_monitoring_slot_source.sql`          | Private scoped slot source plus compatible public slots wrapper.                                                                    |
| `20261018050100_temperature_monitoring_workspace.sql`            | Rich workspace; server intervals; reading/deviation lifecycle and independent queue filters before pagination; scoped empty causes. |
| `20261018050200_temperature_monitoring_choices.sql`              | Manager-only methods/profile/staff choices and default manual method.                                                               |
| `20261018050300_temperature_monitoring_capture_time.sql`         | Prospective actual capture validation; original snapshots/conflicts preserved.                                                      |
| `20261018050400_temperature_monitoring_equipment_projection.sql` | Batch exact-scope tracking eligibility inside existing Equipment projection.                                                        |
| `20261018050500_temperature_monitoring_notifications.sql`        | Dated independent-review inbox, full scoped counts and deterministic twenty-item bound.                                             |

Configuration replacement remains a separate contract checkpoint: TM-02's
immutable version and nonoverlap constraints reject replacing an open-ended
version. TM-07 has not weakened either constraint. A decision on the forward
replacement seam is required before configuration update/disable can be complete.
