# TM-09 — Long-range export

- Status: In Progress — implementation reviewed and locally verified; formal DB certification INCOMPLETE
- Milestone: Temperature Monitoring / Reporting
- Depends on: TM-04, TM-05, TM-06
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Export authorized temperature history beyond the 90-day interactive UI limit.

## Scope

- Export filters within one authorized calendar year, equipment, shift and status.
- Server-side streaming or background processing for large ranges.
- Excel as the first format; include threshold snapshots, states, actors, amendments and deviations.
- Size/rate limits and safe error handling.

## Acceptance criteria

- Owner decision 2026-10-19 supersedes multi-year-in-one-file acceptance: each export must remain within one calendar year; historical years are exported separately, including a full leap year. The browser never fetches raw data pages.
- Export results respect tenant/department permissions and amendment effective state.
- UI states explicitly distinguish “interactive display max 90 days” from long-range export.
- Large exports provide progress/failure feedback and do not expose raw database errors.

## Takeover gate

The agent must survey existing equipment/maintenance export utilities, authorization checks and large-download constraints, then write a detailed TM-09 plan before implementation.

## Checkpoint — 2026-10-19

- Isolated branch: `feat/temperature-monitoring-tm-09`, base `eb580985b89ae0c6662512131c8998b3b4691979`.
- Detailed plan: [`2026-10-19-temperature-monitoring-tm09-plan.md`](../../docs/plans/2026-10-19-temperature-monitoring-tm09-plan.md).
- Existing UI RPC is not adequate for annual historical reading exports; use a separate bounded export RPC and installed ExcelJS streaming XLSX writer to a private temporary file, completed binary download only.
- Owner checkpoint resolved 2026-10-19: one calendar year per export, different years separately; lead released implementation. Reviewed boundaries: recorded-readings-only scope, unchanged read permissions, 100,000 total rows / 25 MiB / 60 seconds, and process-local rate/concurrency limits.
- Formal SQL `static` / `baseline-forward`: **INCOMPLETE** inherited gate boundary. Disposable behavior evidence cannot certify completion; no live write, push, merge or deploy authorized.

## Implementation evidence — independent lead gates and review

- Server streams installed ExcelJS rows to a byte-bounded private file; selected reading ids stay on disk in 25-id batches. Completed binary download only, explicit recorded-only annual controls, safe failures and cancellation; no new dependency/UI component or logbook-hook edit.
- Focused worker checks: core 6/6, route 5/5, binary hook 2/2, annual controls 1/1, shared RPC 10/10, existing broker caller 23/23 PASS. Real XLSX reload checks audit/value fidelity; 64 MiB raw-cell streaming stays within the check's 48 MiB heap-growth bound.
- Lead independent disposable replay: 19 migrations / six registered SQL suites PASS, including 33-reading 25+8 pagination; cleanup count zero. Log `/tmp/tm09-lead-disposable-final.log`. **DISPOSABLE ONLY**, not formal DB certification.
- Reuse: existing server session/claim signing, same-origin and bounded-body helpers; native Node file/stream lifecycle and installed ExcelJS. Shared RPC defaults remain 64 KiB success / 8 KiB error. GitNexus direct-caller regression is covered; stale CRG zero-flow output is not an impact claim.
- Limits are rejection ceilings, not guaranteed capacity within deployment/proxy deadlines. Current page state is not a transaction snapshot; process-local rate limits multiply with replicas. Formal SQL lanes remain **INCOMPLETE**.
- Independent lead checks: Prettier, no-explicit-any, diff-only dedupe, exported JSDoc and typecheck PASS; 12 focused test files / 87 tests PASS. React Doctor scanned the staged new files: 91/100, nine nonblocking warnings (eight inherited; one Filters complexity warning retained within the existing composition).
- A separate `post_implementation_reviewer` reviewed the final staged implementation against base `eb580985b89ae0c6662512131c8998b3b4691979`, including the Blob typing correction, and found no standards/spec blockers. Tested non-Markdown source fingerprint: `8b3b4936025d87ec3910a7cf3a7cfba29222a8784b0a2c0b2204999c134a0290`.
- Disposable SQL source digest: `304eb91493f4c1a2565b240e3df53d26cbca048883d3c7759fb9064d23578a9b`; migration SHA-256: `3b0a1a4d3a129f95bc1037b5b4a18a2da356539297d758ed1449ba058b263bf2`. These checks never applied candidates to the persistent baseline or live DB.
