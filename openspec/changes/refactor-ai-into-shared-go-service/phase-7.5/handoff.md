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
route, request/response schemas, allowlist, timeout/cancellation, redaction,
trusted BFF credential source and token contract:
`iss=nextjs-bff`, `aud=qltbyt-rpc-broker-v1`, numeric `user_id`, maximum TTL
`120s`, role/facility scope and clock policy.

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

Current status is `BLOCKING / INCOMPLETE`; no package has been certified by this
documentation update. Before dispatch, record the exact subject commit,
configuration/image hashes, owner and approval boundary in
[phase-7.5-evidence.md](phase-7.5-evidence.md). Do not tick downstream package
checkboxes from a predecessor's evidence.
