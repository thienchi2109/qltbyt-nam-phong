# TM-09 long-range Excel export implementation plan

**Goal:** Export authorized recorded temperature history within one selected
calendar year, without loading raw records into the browser. Export different
historical years separately; a full leap year is valid.

**Baseline:** `eb580985b89ae0c6662512131c8998b3b4691979`, branch
`feat/temperature-monitoring-tm-09`, isolated worktree only.

**Status:** Owner resolved the checkpoint on 2026-10-19 with the binding correction
that each export stays within one calendar year; multiple years require separate
exports. Lead released implementation with the remaining reviewed v1 boundaries.

## Decision checkpoint

Approved v1 boundary (owner decision and lead release, 2026-10-19):

- Export the same roles and equipment scope as existing temperature reads:
  `global/admin`, `to_qltb`, `technician`, `qltb_khoa`, `user`, `regional_leader`.
  Every non-global role retains the current tenant **and normalized department**
  restriction, including `to_qltb` and `regional_leader`. Require a valid actor.
  This grants no new tenant visibility or mutation capability.
- Export **recorded readings only**, including unable-to-measure observations,
  original and current effective approved content, all amendments, and deviation
  history. Do not generate unrecorded/overdue scheduled slots over multiple years.
  Label this clearly. Export filters exclude `Chưa ghi`/overdue/current-slot
  choices and reject unsupported statuses server-side; no misleading empty export.
- Valid ordered dates in the same calendar year are accepted, independent of the
  90-day UI; even December 31–January 1 is rejected. Full 366-day leap years work.
  Hard limits: 100,000 total data rows across worksheets, 25 MiB output enforced
  while writing, 60-second generation deadline, one active request per actor,
  two active requests per Node process, five starts per actor per ten minutes.
  Limit failures request narrower equipment/status/dates; never silently truncate.
- Synchronous server generation with installed ExcelJS streaming writer to a
  private temporary file; completed binary download only. No persistent export
  retention, new dependency, queue, worker, cron or object-storage infrastructure.

## Evidence and reuse

- `temperature_monitoring_workspace_list` in
  `supabase/migrations/20261018050100_temperature_monitoring_workspace.sql`
  materializes the UI slot generator, counts the full result each page, and only
  projects compact deviation/pending-author metadata. `_temperature_monitoring_slot_rows`
  in `20261018050000_temperature_monitoring_slot_source.sql` owns the 90-day guard.
  Keep both unchanged; they are not the scalable export source.
- Original observations/snapshots: `temperature_readings` (TM-04). Approved
  effective/review state: latest non-creation `temperature_monitoring_reading_events`
  snapshot, falling back to `_temperature_monitoring_initial_state` (TM-05).
  Amendments remain immutable in `temperature_reading_amendments`; review events
  identify decisions and actors. TM-06 deviation rows and append-only
  `temperature_monitoring_deviation_events` supply full workflow details.
- Installed ExcelJS 4.4 supports `stream.xlsx.WorkbookWriter` with a real writable
  stream and committed rows. Existing `excel-workbook.ts`/`excel-utils.ts` helpers
  use a document workbook and `writeBuffer`; reuse their conventions only, not
  their all-row accumulation mechanism.
- Reuse `getServerSession(authOptions)`, `getSessionUser`/`getSessionClaims` from
  the RPC proxy, `isGlobalRole`, `assertSameOriginRequest`, and `callServerRpc` from
  `src/lib/ai/server-rpc.ts`. Do not duplicate JWT signing, trust client scope,
  use service-role credentials, or route internal calls through a public URL.
- `callServerRpc` currently caps successful responses at 64 KiB. Add an optional
  bounded response cap, default unchanged, with a hard maximum of 1 MiB; request
  at most 25 export rows per RPC. Oversize pages/cells fail safely, never truncate.
- Existing `TemperatureMonitoringFilters.tsx` is 117 lines. Add existing Inputs,
  Select/Button primitives there; add no UI component file. Leave the 449-line
  logbook hook unchanged. Native Node fs/os/stream cover file lifecycle.
- Graph discovery was attempted: worktree CRG missing, main CRG stale at
  `af3a4cce`, GitNexus lacks the current TS temperature flows. Direct source/SQL
  inspection backs this plan; lead owns authoritative graph refresh and checks.

## API, resource bounds and failure contract

Create `POST /api/temperature-monitoring/export`, Node runtime, uncached. Validate
same origin and a small bounded JSON body before work. Accept `from`, `to`,
optional equipment, shift code, and supported recorded-reading status. Derive all
claims from the trusted session and enforce capability at both route and SQL.
Use `isGlobalRole` for all TypeScript global/admin checks.

Use an actor/process-local limiter with bounded expired-entry pruning. Document
that replicas multiply this protection; a distributed limiter is outside this
single-process v1. Set `maxDuration = 90`, a 60-second generation deadline that
includes RPCs/writer finalization, and a 25-second transfer deadline holding the
actor/process slot until the stream closes. No claim that this increases an external
proxy timeout: a shorter deployment limit may terminate the request; the UI must
show failure. Smoke-test on the actual hosting path before calling runtime ready.

Create a private `mkdtemp` directory under `os.tmpdir()` (0700), output file 0600.
Use a real bounded writable stream, `useSharedStrings: false`, `useStyles: false`,
and commit each row. Enforce the 25 MiB byte ceiling in the write path. Honor
backpressure, the request abort signal, deadline and row budget between pages.
Keep one small RPC page and current row in application memory; do not retain
earlier pages, styles, shared strings or workbook rows. Reject Excel cells above
32,767 characters rather than silently losing audit content. Text remains literal
text, never an Excel formula, hyperlink or rich-text object.

Finish and close the workbook, verify file size and only then return attachment
headers (`.xlsx`, fixed safe filename, correct content type, content length,
`Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`). Stream the
completed file and remove its directory when consumed, cancelled or errored.
Generation errors remove partial files and return safe JSON before file headers.
Guard cleanup for every exit and reclaim only stale task-prefixed temp directories
from earlier process crashes; never delete unrelated temp paths.

Browser fetches only the bounded finished binary, not JSON data pages. Save the
Blob only after the full response succeeds; transport failures must not create a
successful-looking partial download. Revoke object URLs. Show accessible
indeterminate `Đang chuẩn bị Excel…`, then download/ready or actionable failure;
do not invent a percentage. Support cancellation and disable duplicate starts.
Return safe Vietnamese errors for authentication, filter, busy/rate, size, timeout
and preparation failure; logs use existing sanitization without raw row content.

## SQL export contract and provenance

Add one forward-only local migration
`supabase/migrations/20261019090000_temperature_monitoring_export.sql` defining
`temperature_monitoring_export_page(p_from_date, p_to_date, p_equipment_id,
p_shift_codes, p_status, p_dataset, p_cursor, p_limit, p_started_at, p_reading_ids)`.

Five dataset values: `readings`, `amendments`, `reading_events`, `deviations`,
`deviation_events`. Each returns explicit typed JSON columns, `items`,
`next_cursor`, and server-start/page timestamps. No `SELECT *`, no per-reading
RPC/get/history calls, no offsets, unbounded JSON aggregation or date series.
Page size 1–25; use typed UUID/BIGINT bounds and `LIMIT p_limit + 1` inside each
dataset source before merging the bounded page. Stable immutable dataset keys
avoid repeated text-cast sorting of the full year's source.
Cursor must bind dataset, dates, equipment, shift, status and start watermark;
reject malformed/oversized/mismatched cursors. The server owns the watermark.

Reuse the exact existing read role/claim guards and normalized equipment scope.
For broad selection, implement the same row predicate in the set query rather
than invoking `_assert_scope` per record. Explicit out-of-scope equipment fails
closed. Every page rechecks scope; no caller tenant/department parameter exists.
`SECURITY DEFINER`, `search_path = public, pg_temp`, revoke PUBLIC/anon, grant only
authenticated, no raw table grants. The server calls this RPC directly, so it
does not need to broaden the browser proxy allowlist.

Filter real readings by monitoring date, equipment, snapshot shift and current
effective slot status. Join latest review state in the same SQL statement.
Restrict new immutable source rows/events with `created_at <= p_started_at` to
bound new arrivals; this is not a cross-page database snapshot. Current effective
state/status/deviation details may change between pages. Metadata must explicitly
say each page was read at its own instant and include page read time and revision.
Do not promise event-time reconstruction, repeatable status membership, or a
transaction snapshot. Stable reading/event identity ordering prevents offset
drift. Scope/equipment labels are current on each page. A commit arriving late
can still become visible after earlier pages; document this limit.

Workbook sheets:

| Sheet            | Required provenance/content                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export           | Dates/filters, actor id, generation start/end, read consistency note, sheet row counts and configured ceilings                                                                                                                                                                                                                        |
| Readings         | Reading/equipment ids and code/name; monitoring date/shift; capture/entry timestamps; operator; immutable original value/unable reason/note; lower/upper °C and configuration/method/timezone snapshots; current effective value/unable/author; classification/status/review requirement; confirmer/time; revision and page read time |
| Amendments       | Reading/proposal ids; proposed value/unable reason; rationale; author/time; pending/approved/rejected outcome; decision actor/reason/time from joined events                                                                                                                                                                          |
| Reading events   | Event/sequence/reading/amendment ids; action, actor/time, rationale and before/after state                                                                                                                                                                                                                                            |
| Deviations       | Id/source reading/trigger snapshot; severity/state; action/owner/due date/cause/evidence; verifier/result; repair link; creator/update times/revision                                                                                                                                                                                 |
| Deviation events | Event/deviation ids; action, actor/time, rationale and before/after state                                                                                                                                                                                                                                                             |

Actors use stable `#id` values; no one-request-per-actor name resolution. Include
rejected amendments and closed/cancelled deviations. NULL remains blank, never
numeric zero. Thresholds come from observation snapshots, not today's policy.

Existing indexes cover reading equipment/date, amendment reading, latest reading
events and deviation lookup; add only proven required date/id or event lookup
indexes for the actual cursor SQL. Review `EXPLAIN` in disposable DB, not live.

## Implementation sequence and useful RED → GREEN checks

1. **SQL contract.** Add
   `supabase/tests/temperature_monitoring_export_behavior.sql` before the new
   migration; verify failure for the missing contract in the authorized disposable
   environment, then implement. Cover >90 days/full leap years and rejection of
   cross-year ranges, all read roles,
   admin alias, missing/malformed claims, tenant/department isolation, invalid
   filters/cursors/limits, cursor exhaustion, original versus approved effective
   values, unable states, rejected/pending amendments, full deviations/events,
   and status filtering. Register the test in the committed DB gate registry.
   Do not apply candidates to the persistent restored baseline.
2. **Server writer and page pipeline.** Create
   `src/lib/temperature-monitoring-export.ts` and
   `src/lib/temperature-monitoring-export-workbook.ts` (split only at the logical
   boundary; each below 350 preferred/450 maximum). Tests in
   `src/lib/__tests__/temperature-monitoring-export.test.ts` generate a real XLSX
   with multiple pages and reopen it with installed ExcelJS to assert original,
   amended, unable, text/formula safety and history content. RED then GREEN for
   later-page error, cursor cycle, row/byte/cell limits, timeout/cancel and cleanup.
   Verify page/row objects are released and output uses streaming writer, not
   `writeBuffer`; exercise many pages under a modest process memory budget.
3. **Authenticated route.** Create the route and its focused tests under
   `src/app/api/temperature-monitoring/export/__tests__/route.test.ts`. Add the
   minimal optional success cap to `src/lib/ai/server-rpc.ts` with regression tests
   proving default cap unchanged, hard maximum enforced and oversized payload
   rejected. Assert session-derived claims/admin normalization, same-origin/body
   validation, rate/concurrency/deadline handling, no attachment before complete,
   safe failures, file cleanup and bounded response. No raw database messages.
4. **Existing UI composition.** Create
   `src/hooks/use-temperature-export.ts` and its focused behavior test; extend
   only existing `TemperatureMonitoringFilters.tsx`. Keep export dates separate
   from workspace dates and display `Xem trên màn hình: tối đa 90 ngày` plus
   `Xuất Excel: bản ghi đã nhập, mỗi lần trong cùng một năm`. Reuse selected equipment
   and shift; use an explicit supported recorded-reading status choice rather
   than copying `Chưa ghi`/overdue kinds. Test a full-year body and rejection of
   crossing years, only binary
   download, busy/cancel/failure, no save on partial transport and mobile labels.
5. **Docs/evidence.** Record the confirmed decision in the domain contract and
   TM-09 backlog, actual limits/consistency/runtime constraints and exact evidence.
   No new generic component, dependencies, live writes, deployment, TM-10 work,
   push, merge or root-worktree edits. Worker does not stage/commit; lead owns it.

## Verification and completion boundary

Lead runs one context-mode batch in required order: explicit-file Prettier,
`verify:no-explicit-any`, `verify:dedupe`, `typecheck`, focused Vitest, React Doctor.
Run semantic cross-file reuse review before commit; independent lead verification
and custom `post_implementation_reviewer` are required before any completion claim.

SQL static and Oracle baseline-forward evidence must be reported separately for
the exact landed commit. Inherited harness/baseline problems remain deferred;
do not repair them in TM-09. Disposable behavior proof is not formal PASS.
Without same-commit static **and** baseline-forward PASS, DB certification and
aggregate TM-09 completion remain **INCOMPLETE**. No live apply is authorized.

## Implementation notes

- A private newline UUID membership file fixes selected Readings membership;
  child datasets replay batches of at most 25 ids and recheck date/equipment/shift
  and authorization without re-evaluating mutable status. Its maximum size is
  bounded by 100,000 UUID lines (3.7 MB); no all-id in-memory Set is used.
- The 100,000-row ceiling is a rejection limit, not a promise that every request
  of that size completes within 60 seconds. Four child datasets can require many
  RPC batches; dense ranges may need narrower equipment/status/date filters.
- Disposable lead replay: 19 migrations and six registered temperature SQL suites
  pass, including 33-reading pagination (25+8); disposable cleanup count zero.
  Evidence: `/tmp/tm09-lead-disposable-final.log`. This is **DISPOSABLE ONLY**;
  formal static/baseline-forward remain **INCOMPLETE**.
- Focused worker evidence: core 6/6, export route 5/5, client hook 2/2, annual
  controls 1/1, shared server RPC 10/10 and its broker caller 23/23 PASS. Core
  checks reopen actual XLSX cells for original/effective/NULL/threshold/audit
  fidelity, later-page failures, row/byte/cell limits, cancellation, temporary
  cleanup, limiter release/cooldown and 64 MiB raw-cell streaming with heap growth
  below 48 MiB. Early pre-implementation Vitest attempts timed out under host
  memory pressure; do not describe those timeouts as a proven RED result.
- Reuse review: existing document workbook helpers cannot stream, and source
  discovery found no server binary/temporary-file lifecycle utility. Reuse native
  fs/stream/os plus installed ExcelJS, session claims, same-origin checks,
  BoundedBody and callServerRpc. GitNexus identifies the existing AI broker as
  the shared RPC helper's direct caller (HIGH impact); its 23 tests pass and the
  helper's 64 KiB success / 8 KiB error defaults remain unchanged. Explicit CRG
  affected-flow lookup still reported a stale graph; its zero result is not
  proof of no impact.
- Independent lead final gates: formatting, no-explicit-any, diff-only dedupe,
  exported JSDoc, typecheck and 12 focused files / 87 tests PASS. React Doctor
  scanned staged additions: 91/100, nine nonblocking warnings; one additional
  Filters complexity warning is retained, with no component-file exception.
  The independent custom reviewer found no final standards/spec blocker.
- Verified non-Markdown source fingerprint:
  `8b3b4936025d87ec3910a7cf3a7cfba29222a8784b0a2c0b2204999c134a0290`.
  Disposable SQL source digest:
  `304eb91493f4c1a2565b240e3df53d26cbca048883d3c7759fb9064d23578a9b`.
  Formal static and baseline-forward certification remain separate and INCOMPLETE.
