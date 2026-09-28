# Phase 7.5 Handoff — Independent package dispatch

Phase 7.5 is a gated handoff from Phase 7 dark smoke to Phase 8 exact-commit
acceptance. Dispatch packages independently and preserve the stop boundary
after each package. The package owner may return evidence and blockers without
starting the next package.

## Dispatch order and ownership

### 7.5A — Contract/ADR and route decision

**Prerequisite:** Phase 0.9 review and existing Go `Broker`, `QueryExecutor`
and registry interfaces.

**Owner:** architecture/spec owner. **Output:** a reviewed concrete BFF broker
route `POST /api/internal/ai/broker/v1`, request/response schemas, allowlist,
timeout/cancellation, redaction, trusted BFF credential source and token
contract, recorded in [phase-7.5a-contract.md](phase-7.5a-contract.md):
`iss=nextjs-bff`, `aud=qltbyt-rpc-broker-v1`, numeric `user_id`, maximum TTL
`120s`, role/facility scope and clock policy.

**Package status:** `READY FOR REVIEW` — the docs contract is recorded and
reconciled; exact landed subject commit/config binding and reviewer sign-off are
still required before this package is labelled `PASS`.

**Stop:** no route/credential source/allowlist/TTL review, or any design that
requires browser cookies, browser claims or `SUPABASE_JWT_SECRET` in Go.

**Excludes:** endpoint implementation, Go composition, SQL, Oracle activation,
Phase 8 cutover and Phase 9 cleanup.

### 7.5B — Application-owned BFF broker endpoint

**Prerequisite:** `7.5A` PASS and the trusted server-side credential source.

**Owner:** Next.js/BFF owner. **Output:** server-only endpoint and focused tests
for token mint/verify, RPC allowlist, scope, cancellation, bounded cleanup and
redacted failures. The browser never supplies the authority for this endpoint.

**Stop:** missing trusted credential source, claims/TTL drift, browser cookie or
`SUPABASE_JWT_SECRET` forwarding, or unbounded RPC access.

**Excludes:** `/api/chat` cutover, Go production wiring, SQL/live DB and paid
provider smoke.

**7.5B implementation handoff (worktree, not landed):** the route and focused
contract tests are present under `src/app/api/internal/ai/broker/v1/`. The
server-only verifier uses `AI_SERVICE_BFF_BROKER_SECRET` and enforces the
7.5A HMAC issuer/audience, numeric positive claims and 120-second TTL. The
allowlisted RPC schemas, derived facility/audit/quota arguments, cleanup
boundary, streamed request/upstream body caps, strict recursive result schemas,
Access-header transport compatibility, cancellation budget, response caps,
correlation IDs and redacted errors are covered by 36 focused passing tests
(23 route, 7 server-RPC body-cap, 6 token). Targeted TypeScript and diff
checks pass. Trusted deployment Access provenance remains uncertified, so the
package is `DISPOSABLE ONLY` until the changes are landed and
the 7.5A review plus later Go/SQL/disposable acceptance gates are complete;
overall Phase 7.5 remains `BLOCKING / INCOMPLETE`.

### 7.5C — Internal Go broker/capability composition

**Prerequisite:** `7.5A` PASS and `7.5B` contract/schema PASS.

**Owner:** Go runtime owner. **Output:** internal `Broker` composition that
calls the BFF endpoint, propagates trusted numeric identity/facility scope,
timeout/cancellation, audit and quota calls, and registers
`qltbyt/assistant-chat/v1`. Readiness cannot be certified from this package
alone; `7.5D` must supply the query executor.

**Stop:** dummy/test broker, browser authority, unbound claims, policy bypass or
readiness `200` without the full tuple.

**Excludes:** role provisioning, live DB writes, `/api/chat` cutover and Phase 9.

### 7.5D — External-pooler QueryExecutor composition

**Prerequisite:** `7.5A` and `7.5C` PASS.

**Owner:** Go query/runtime owner. **Output:** real `QueryExecutor` using
external-pooler `AI_DATABASE_URL` and an existing approved or disposable
dedicated `ai_query_tool` read-only role, with statement/schema allowlist,
scope, timeout, row/payload limits and no DDL/DCL/write transaction. Prove
readiness `503` for each missing member and `200` only for the real Broker +
QueryExecutor + registry tuple. Production role certification waits for the
separate `7.5E` read-back gate.

**Stop:** missing pooler/read-only contract, test executor, unsafe SQL path or
tuple readiness that can be satisfied by a partial composition.

**Excludes:** SQL role/grant/password provisioning (7.5E), live DB writes,
cutover and paid-provider smoke.

**7.5D implementation handoff (landed `0c46e24`, with uncommitted follow-up):** the Go runtime now
validates `AI_DATABASE_URL` against the documented transaction-pooler contract,
opens the existing QLTBYT SQL executor with pgx simple protocol and bounded
connections, and requires a live `ai_query_tool` read-only role probe for
readiness. URL, role, connection, dummy-executor and partial-tuple negatives
have focused local tests; SQL parser/catalog/scope/timeout/row/payload behavior
remains in the existing executor. `go test ./...` passes, but no disposable
PostgreSQL/pooler connection or role/read-back evidence was available or used.
The package remains `BLOCKING / INCOMPLETE`; do not treat local in-memory tests
or false-positive SQL gate output as external-role certification. See the
[7.5D evidence report](phase-7.5-evidence.md#75d-package-report--external-pooler-queryexecutor-composition).

The follow-up worktree additionally restores documented aggregate and
parenthesized-expression SQL behavior and removes process-environment startup
overrides from the effective pgx pool configuration. It has passed local Go
verification but is not part of the landed commit until explicitly committed.

### 7.5E — Separate SQL role/provisioning and read-back gate

**Prerequisite:** `7.5A` contract and `7.5D` connection/role requirements.

**Owner:** database quality-gate owner. **Output:** exact subject SQL plan or
existing-role mapping, static and baseline-forward reports (separate), and
read-back of role/grants/pooler/catalog parity. Report `BLOCKING / INCOMPLETE`
when a required lane or input is unavailable.

**Stop:** no read-back, unsafe grants, missing gate evidence or any request to
apply live SQL without operation-specific authorization.

**Excludes:** default live migration/DDL, Supabase CLI, runtime code changes,
Phase 8 and paid smoke. Disposable PASS is not production certification.

### 7.5F — Disposable auth/readiness acceptance

**Prerequisite:** `7.5A–D` PASS; `7.5E` is required before a production claim.

**Owner:** integration acceptance owner. **Output:** redacted, exact-subject
matrix covering token and Access positive/negative paths, browser credential
rejection, broker allowlist, read-only SQL rejection, audit ordering,
cancellation, readiness `503/200` and error redaction. Label the report
`DISPOSABLE ONLY` when any dependency is mocked/disposable.

**Stop:** no trusted BFF Access source, tuple mismatch, unsafe query accepted,
or disposable evidence presented as production.

**Excludes:** `/api/chat` cutover, Phase 9 cleanup, live SQL/migration and paid
provider smoke.

### 7.5G — Oracle activation

**Prerequisite:** `7.5A–F` PASS on one exact subject commit/config, Phase 6
artifacts and separate authorization for Oracle activation.

**Owner:** Oracle/runtime operations owner. **Output:** exact image/config/
contract hashes, local private probes, trusted-BFF Tunnel/Access route,
redacted Broker/QueryExecutor smoke, drain/rollback evidence and explicit
candidate status. Any real quota/audit write must be listed and separately
authorized.

**Stop:** prior package missing, raw port exposed, untrusted Access credential,
tuple mismatch, unredacted evidence or readiness `200` without real members.

**Excludes:** `/api/chat` cutover, Phase 9 cleanup, live migration/DDL and paid
provider smoke. Phase 8 remains the sole cutover gate.

## Handoff record

Catalog-readiness follow-up verified on Oracle (2026-09-28): 15/15 disposable
subtests PASS using `848073b5` plus the uncommitted executor fix. All five
approved synthetic views are required. Revoked SELECT/USAGE or any missing
view now yields 503, and restoring grants recovers 200. Runtime probes only
catalog metadata/effective privileges, without executing tenant-dependent
views. The previous false-200 defect is fixed for this tested matrix. Cleanup
was verified; no production grants or Supavisor parity are certified. See
`/tmp/refactor-ai-phase-7.5d-oracle-rerun.md` and the updated evidence hashes.
No commit/push; overall Phase 7.5 remains BLOCKING / INCOMPLETE.

Latest 7.5D checkpoint (2026-09-28): follow-up landed at `848073b5`.
Oracle disposable integration on that exact code passed ten subtests but
confirmed a readiness defect: revoking approved-view SELECT makes queries
fail while `/readyz` stays 200. Fix catalog usability probing without runtime
provisioning, then repeat the negative case. The fixture used a separate
PostgreSQL cluster restored from baseline, synthetic catalog and PgBouncer;
it does not certify production grants or Supavisor. All disposable resources,
dump and credentials were cleaned up. See the latest 7.5D evidence entry and
`/tmp/refactor-ai-phase-7.5d-oracle-verification.md`. No new commit or push was
performed during this verification; task checkboxes remain unchanged.

Current status is `BLOCKING / INCOMPLETE`; no package has been certified by this
documentation update. Before dispatch, record the exact subject commit,
configuration/image hashes, owner and approval boundary in
[phase-7.5-evidence.md](phase-7.5-evidence.md). Do not tick downstream package
checkboxes from a predecessor's evidence.
