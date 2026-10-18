# TM-04 — Measurement entry and duplicate guard

- Status: In Progress
- Integration: Merged into local `main` on 2026-10-18; not pushed. Implementation and independent review complete; formal DB gate certification remains incomplete.
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

## Survey checkpoint (2026-10-17; implementation not started)

Base: `5da5c6d67912d564a3f51b6357fd87ee1a61f156`, branch `feat/temperature-monitoring-tm-04`. This task owns measurement persistence/RPC, forward-only migration(s), measurement SQL tests/registry, minimal RPC allowlist coverage, and this backlog file. No UI, confirmation/amendment implementation, complete deviation workflow, live write, persistent baseline write, push, PR or merge.

Current seams:

- `20261017100000_temperature_monitoring_configuration.sql` provides immutable effective-dated versions, inclusive threshold inputs, recording-method/profile references, responsible users, append-only configuration audit, and deny-by-default table ACLs. Numeric limits are finite and at most one decimal; it does **not** define physical minimum/maximum. Configuration writes allow `global`/`admin`/`to_qltb`, and require tenant plus department for non-global actors.
- `20261017110000_temperature_monitoring_schedules_slots.sql` provides default/override shift times, normalized department scope, operational/active-date checks, timezone/overnight conversion, and bounded cursor projection. The effective version is selected at the **shift start**, and `temperature_monitoring_slots_list` currently always projects `Chưa ghi`. No reading table or measurement writer exists.
- Reuse `_normalize_department_scope`, existing JWT claims, immutable versions, and the TM-03 projection. Do not reimplement date parsing, eligibility, overnight rules or shift override selection. Graph search was attempted: Code Review Graph is stale at `91d6759c` and returned no TM node; GitNexus does not resolve these SQL flows reliably. Exact current SQL/file inspection is the source of truth; no index rebuild is needed for this checkpoint.
- RPC proxy `src/app/api/rpc/[fn]/route.ts` normalizes session roles before signing, forwards successful JSON, hides upstream 5xx, but forwards upstream 4xx payloads. A raw `23505` would therefore expose database details. Existing technical-configuration mutations use typed `PT409`; a structured successful RPC result with `outcome: conflict` is the smaller measurement-specific alternative and can carry the current reading without changing shared proxy behavior.
- `temperature_monitoring_schedules_slots_behavior.sql` uses actual rollback fixtures and role claims; smoke tests inspect contracts. `technical_configuration_baseline_cross_dossier_copy_concurrency_phase_gate.sql` demonstrates separate psql sessions, rendezvous/locks and no-partial-write assertions. Sequential rollback tests alone do not prove the duplicate race.
- Register only rollback-safe tests in `supabase/db-quality-gate-tests.json`; concurrency with committed cross-session fixtures is a separate disposable-only manual test, never default-safe registry execution. No new dependency or broad SQL corpus execution.

## Proposed contract and decisions requiring lead review

1. **Physical bounds (approved 2026-10-17):** user explicitly approved inclusive `[-200.0, +300.0] °C`, maximum one decimal place. Enforce independently in RPC and DB CHECK using unconstrained NUMERIC (no implicit typmod rounding); reject NaN/infinities/excess precision. Physical input bounds are separate from the captured per-device operating thresholds.
2. **Version/time semantics:** recommendation is to snapshot the version effective at the selected slot's shift start, matching TM-03 (including overnight slots). Persist actual observation `captured_at` in UTC separately from server `created_at`; reject non-finite timestamps. A capture-time-selected version could disagree with the expected slot after a mid-shift policy change, so do not mix these semantics silently. No new lateness/future-time policy is inferred.
3. **Record capability:** recommendation is `global`/`admin`/`to_qltb`/`technician`/`qltb_khoa`, with tenant **and** normalized department required for every non-global write; reject `regional_leader`, `user`, missing/unknown role or actor. Responsible-user assignment remains a snapshot, not an additional authorization rule unless approved. The canonical contract leaves the full capability matrix unresolved.
4. **Unable-to-measure:** accept either a finite one-decimal value or a nonblank reason, never both/neither; store a structured reason object with a free-text `reason` and no invented enum. Unable-to-measure projects `Chờ xác nhận`. In-range is `Đã ghi`; breach is initially `Bất thường`; reviewer transitions belong to TM-05.
5. **Conflict/result:** return JSON `{outcome: created|conflict, reading: ..., slot_status: ..., next_action: amendment}` (amendment action only for conflicts). The amendment route is a domain action/reference, not a pretend implemented endpoint; TM-05 owns execution. Preserve the existing primary reading and return its original snapshot/value after scope authorization. No exception catching that commits partial state.
6. **Deviation boundary:** persist one append-only `deviation_created` domain event per breached reading, including reading id, breach direction/value and captured thresholds, atomically with `reading_created`. Do not create an unreviewed severity policy or full TM-06 deviation lifecycle. TM-06 consumes this durable event.

## Detailed implementation plan (awaiting checkpoint approval)

1. Add unapplied `20261017120000_temperature_monitoring_measurements.sql` (split into one additional focused migration only if needed to respect source-size limits). Create immutable canonical readings with unique `(equipment_id, monitoring_date, shift_id)`, configuration-version FK, actor, UTC observation/server times, `source = manual`, value-or-reason check, note, and threshold/method/timezone/shift/responsible-user snapshot. Protect table writes through ACL/RLS and RPC only; update/delete rejection preserves originals for TM-05 amendments.
2. Add an append-only reading audit/event table with unique reading/event identity, immutable trigger and restricted ACL. Both reading creation and breach-event append occur in one RPC transaction. An injected audit insert failure must roll back all reading/event writes.
3. Replace `temperature_monitoring_slots_list` in the new forward migration, retaining its signature and current eligibility/effective/date/cursor engine, with only the reading join/status projection added. The writer reuses this public RPC for a bounded single-equipment/single-date slot lookup; no wrapper/renamed helper is required. No empty reading rows are materialized. Keep migration files below the repository source-size ceiling when carrying the existing definition forward.
4. Add `temperature_monitoring_measurement_create` with explicit role/actor/scope validation before reading/conflict disclosure, approved input validation and snapshot creation. Serialize TM writes with the same TM-only tenant advisory lock in the measurement RPC and version/override write triggers, including absent override insertion. Lock equipment scope after the advisory lock; recheck TM-02's backdate guard after acquiring it. Retain the database unique constraint, and use `INSERT ... ON CONFLICT DO NOTHING` plus an authorized existing-row read for a recoverable duplicate. No shared `don_vi` row lock or claim of pre-existing explicit TM-02 locking. Do not expose raw unique-constraint names/details.
5. Add only the new public RPC to `src/app/api/rpc/[fn]/allowed-functions.ts` and extend existing whitelist unit coverage. Do not modify common transport/UI logic. Invoke required React/Next guidance before any material TypeScript/framework edits; no framework change is planned.
6. Add rollback runtime behavior tests, and a narrow smoke/ACL contract check only where runtime behavior cannot establish it. Register default-safe tests against the new migration. Leave the task In Progress for independent implementation review.

## Valuable verification and evidence plan

- Numeric lower/upper threshold **equality** is in range; just-outside values breach; approved physical endpoints and just-outside values, NaN/infinities/excess precision, null and value/reason exclusivity are covered. Explicit unable reason yields `Chờ xác nhận` and no deviation event.
- Persist operator/source/time/note/structured reason plus immutable thresholds, method, effective version, timezone and shift snapshots. A later policy version/override does not reinterpret the existing reading; mid-shift and overnight cases use the approved version-time semantics. Repeat submission returns that same reading and amendment action without a second reading/audit/deviation event.
- Runtime RBAC covers approved writer roles, global/admin, denied read-only/unknown/missing roles, missing/nonexistent actor, cross-tenant/department and malformed/missing claims. Unauthorized duplicates must not disclose reading data. Direct table mutations and immutable update/delete must fail for client roles.
- Force audit insertion failure inside a rollback fixture and assert zero reading/event residue. Breach emits exactly one durable event with the observed snapshot. Slot queries retain filter/cursor behavior and reflect the three saved states.
- Run **two independent psql sessions** against one disposable-clone slot with synchronized overlap: winner remains uncommitted while loser enters the RPC; verify loser waits and then returns typed conflict after winner commits, identical existing reading id/snapshot, count exactly one, one reading-created event and at most one breach event. Also verify loser can create after winner rolls back; do not substitute a sequential duplicate test for this evidence.
- Oracle disposable-only setup: clone `qltbyt_test`; grant `postgres` schema `USAGE,CREATE` **inside the clone only** and add the exact missing `ai_readonly.try_parse_iso_date` prerequisite from `20260426090000` if absent; apply TM-02/TM-03/new TM-04 candidates. Use cleanup trap for every clone, including failure paths, then independently query `pg_database` to prove absence. Never mutate live or restored baseline.
- Run formatting and required JS/TS gates in repo order if allowlist/test TypeScript changes; run focused whitelist tests and React Doctor. Run/report formal static and exact-commit baseline-forward separately from disposable smoke/behavior/concurrency evidence. Known harness false positives or missing exact baseline inputs remain `INCOMPLETE`; no aggregate PASS or live-write authorization follows from disposable success.

Checkpoint: survey/plan only. No migration, application code, runtime fixture, clone, commit or remote operation has been created at this stage.

## Implementation progress (checkpoint and physical bounds approved)

- Lead approved slot-start policy snapshots, separate observation/server timestamps with no inferred lateness/future restriction, structured free-text unable reason, proposed writer roles/scopes, typed JSON conflicts, immutable readings/events, and breach event handoff only. User approved inclusive `[-200.0, +300.0] °C` and maximum one decimal on 2026-10-17. Bounds were reproduced RED (`-200.1` accepted), then GREEN with both RPC and DB checks. Both valid endpoints persist as device-threshold breaches with one deviation event; immediately outside, excess precision and non-finite values fail at both boundaries. The master spec records this approved decision.
- Working files: `20261017120000_temperature_monitoring_measurements.sql` adds `temperature_readings` (preserving TM-02's dynamic backdate-guard seam), generated captured-threshold status, append-only events, TM-only advisory coordination, policy-write triggers and create RPC. `20261017120100_temperature_monitoring_recorded_slots.sql` preserves the public slot RPC signature/engine and unions saved snapshots under current tenant/department authorization; later operational/profile/override changes cannot hide recorded slots. No wrappers or alternate slot engine.
- Rollback runtime test `temperature_monitoring_measurements_behavior.sql` was observed RED against TM-02/TM-03 (missing measurement RPC), then GREEN with candidates. It covers inclusive thresholds, both breach directions, unable reason, invalid finite/precision/exclusive/time inputs, snapshot fields, overnight/mid-shift version semantics, original-preserving conflicts, approved/denied/malformed/missing actor/scope, actual authenticated RPC execution and direct-access denial, RLS, immutable rows/events, historical projection/filter/cursor, preserved backdate guard, and injected **second** event failure that masks sensitive details and rolls back both reading and first event.
- `temperature_monitoring_measurements_concurrency.py` is a standalone stdlib disposable-only test, deliberately excluded from the default-safe registry. Four separate-session races observe the loser actually waiting on the advisory lock: duplicate winner commit → conflict/same id; winner rollback → created; policy + previously absent override commit → coherent new snapshot; policy rollback → safe ineligible-slot rejection. Final fixture counts: 3 unique readings, 3 creation events, exactly 1 breach event.
- Final disposable runtime evidence with approved bounds: clone `tm04_20261017104919`; both new migrations apply, TM-04 behavior and four races PASS, unchanged TM-03 smoke/behavior PASS. Reproduce on this VPS with `PYTHONDONTWRITEBYTECODE=1 python3 /tmp/tm04_runtime.py`; wrapper applies the committed candidates/tests, runs separate psql sessions via the committed concurrency runner, and drops its clone in `finally`. Artifact `/tmp/tm04-final-disposable-runtime.log`, SHA-256 `b26026fc5f993b819b47a1f4067e70cca4fa2cea6159f994e84a57a53c721aa2`. Clone-only prerequisites were public schema `USAGE,CREATE` plus the exact `try_parse_iso_date` helper/schema. All created clones were dropped in `finally`; an independent `pg_database` query returned count 0 after every run, including prerequisites/RED failures. No live/restored-baseline writes.
- Narrow RPC whitelist wiring is complete. Formatting, no-explicit-any, diff-only dedupe, typecheck, 56 whitelist tests and React Doctor 100/100 passed. Formal static/baseline-forward remain separate from disposable results: the first static command exceeded its 120-second budget with no digest, direct CLI retries also timed out at 55 seconds and native Node at 25 seconds with no report. Static is `INCOMPLETE`; exact-commit baseline-forward is not certified and aggregate PASS is not claimed. No harness changes or waivers were added.
- Status remains In Progress: implementation and independent review are complete, while the formal migration gate remains incomplete. No push, PR, merge, live write or persistent-baseline write.

## Independent-review correction (2026-10-17; approved)

- Reviewer found the replacement slot RPC omitted the mandatory `user_id` guard (`REVIEW.md` JWT contract). Added safe claim parsing and non-null identity guard to the new recorded-slots migration only; malformed/overflow claims return `42501` without exposing cast errors.
- Regression was observed RED on clone `tm04_20261017105550`: actorless saved-slot query succeeded. GREEN on `tm04_20261017105618`: missing/empty/malformed/overflow identities fail before expected or saved-slot reads for tenant/global/admin roles; complete TM-04 behavior, unchanged TM-03 smoke, adjusted TM-03 behavior and all four concurrency races pass. The one inherited TM-03 cross-tenant fixture now supplies its existing actor so it continues testing tenant filtering rather than unauthenticated access. Both clones were dropped and independent database readback returned count 0.
- Reproduce: `PYTHONDONTWRITEBYTECODE=1 python3 /tmp/tm04_runtime.py`. Evidence `/tmp/tm04-actor-guard-red.log` and `/tmp/tm04-actor-guard-green.log`; GREEN SHA-256 `1ff9931308f071ce5066b1b0c6ca6d36d334c6b862d14cfe8f82aa8a07fedf2d`. Formal static/baseline-forward certification remains `INCOMPLETE`; disposable success does not replace the gate.

## Final handoff (2026-10-17)

- Fixed implementation commits: `a3b0272f26e76d4c5cfeaab6d94c8def4a1f7b99` (measurement entry, duplicate guard, approved bounds and historical projection) and `648bd587309f4c8ded46b05797a584dfe83a3c34` (review-requested slot identity guard and affected runtime fixtures). Lefthook remained enabled and passed both commits.
- Independent reviewer returned **APPROVE** for exact implementation commit `648bd587309f4c8ded46b05797a584dfe83a3c34`: missing identity finding resolved, no remaining concrete issues. Implementation and review are complete; this is not a migration-gate PASS or a Done status.
- Lead independently ran the complete disposable proof at that exact commit on clone `tm04_lead_20261017105752`: TM-04 behavior including physical/RBAC/audit/snapshot checks, TM-03 smoke/behavior regressions and all four two-session races passed. Lead independently verified clone deletion with database count 0. Worker proof artifacts/reproduction are recorded above; neither run wrote live or the persistent restored baseline.
- Lead's independent no-explicit-any, diff-only dedupe, typecheck, 56/56 whitelist tests and React Doctor 100/100 passed on `a3b0272f`; TypeScript is unchanged in `648bd587`. The final review correction changed SQL/tests/docs only, so the full TypeScript chain was not repeated for that correction.
- Formal **static: INCOMPLETE** (bounded local/CLI attempts produced no digest-bearing report); **exact-commit baseline-forward: INCOMPLETE** (not certified). Disposable behavior/concurrency PASS cannot substitute for either lane. Aggregate migration gate PASS and migration work DONE are not claimed; Status stays **In Progress** until the required gate evidence is available. Known harness issues have not been waived or repaired in TM-04, and the user's acknowledgement does not authorize a live bypass/write.
- Handoff is committed locally with a clean worktree. No push, PR, merge, live DB write, persistent-baseline write or additional task implementation was performed. Follow-up is limited to formal gate certification and the user's later integration/live decisions.

## Local integration (2026-10-18)

- User authorized merging TM-04 into local `main` without pushing. Fast-forwarded `main` from `5da5c6d67912d564a3f51b6357fd87ee1a61f156` to reviewed handoff `d4e47e3ebb8a7a6bdea86bbe647b3e4c7ab30231`; no conflict or implementation change was introduced.
- Implementation and independent review are complete and integrated locally. Formal static and exact-commit baseline-forward remain **INCOMPLETE**; Status stays **In Progress**, with no aggregate DB gate PASS or live-apply authorization implied by this merge.
- Post-merge verification: RPC whitelist regression **56/56 PASS**, `git diff --check` PASS, and merged `main` exactly matched the reviewed handoff before this documentation-only update.
- No push, PR, live DB write, restored-baseline mutation or additional task implementation. Prior disposable cleanup evidence remains count 0; no new clone was created for this integration.
