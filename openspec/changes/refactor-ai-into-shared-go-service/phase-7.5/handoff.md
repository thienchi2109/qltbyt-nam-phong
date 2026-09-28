# Phase 7.5 Handoff — Independent package dispatch

## Latest Vercel settings checkpoint

Four production settings are now stored: AI_SERVICE_BFF_URL,
AI_SERVICE_BFF_HMAC_KEY_ID, AI_SERVICE_BFF_HMAC_SECRET and
AI_SERVICE_BFF_BROKER_SECRET. Secrets match the source bytes from Oracle's
candidate mounts and are stored as Sensitive; post-write listing confirms
names/types/production target, not decrypted equality. No redeploy or paid
smoke ran. Access client ID/secret and a real user session remain prerequisites.
Existing Device Quota Access variables cannot be recovered through Vercel
because they are Sensitive; AI policy coverage was not assumed. Tunnel
version 2 already points to candidate port 18081; version 1's 8080 is stale.
The no-AI_SERVICE-variable observation below describes the earlier checkpoint.

## Latest candidate deployment (2026-09-28)

The user authorized upgrading/recreating only the Oracle candidate, then one
read-only paid-provider smoke including quota/usage accounting. The candidate
now uses source `5ea42ef24b1decf5638ad009a17509b36d3909ab`, image
`sha256:3e7b239b69b7feec68174c9c2f89bdd7fe1703125f0a979a2f6e8470abc25d3d`.
The protected env supplies the verified pooler URL; persistent candidate
override `/opt/qltbyt-ai/compose.oracle-candidate.yml` passes that variable,
the BFF endpoint, and `qltbyt / assistant-chat / v1` identifiers. Old image
`sha256:6608456a8d43b2e53de543c90af845720bf4d439969b404d7a57d2a10bbd7c52`
remains available for rollback. No production service or cutover was changed.

Oracle-side read-only pooler verification passes. Final private probes at
2026-09-28 15:27:14 UTC returned `/healthz=200` and `/readyz=200`, after the
150-second restart quarantine. Paid smoke has not run:
the deployed Next.js broker returns `503 unavailable` for the invalid-token
preflight. Vercel CLI confirms production has no `AI_SERVICE_*` variables,
including the BFF broker secret. Do not
bypass authentication or deploy Next.js without a separately scoped operation.
See the final candidate entry in `phase-7.5-evidence.md` for verified readiness
and limits. Earlier candidate/no-URL entries are historical.

## Latest 7.5E live operation (2026-09-28)

The user explicitly authorized applying the four reviewed role settings and
waived the broken DB gate for this operation. Supabase MCP apply succeeded on
project `cdthersvldpnlbvpufrr`, migration `20260928132847` /
`set_ai_query_tool_read_only_role_settings`. Live read-back at 13:29:07 UTC
confirmed all four stored settings, unchanged reader membership and checked
grants. No password, grant, PUBLIC EXECUTE, or runtime deployment change occurred.
See the final 7.5E live-operation entry in `phase-7.5-evidence.md` for identity
and read-back details. Earlier no-live-apply statements are historical.

The user accepted tasks `7.5E.1`–`7.5E.3` on 2026-09-28. `7.5E.2` stays
accepted only with the recorded waiver: static remains `INCOMPLETE` and
baseline-forward remains `NOT RUN`. That tick is not a gate PASS. `7.5E.3` is
accepted on the live role/grant/config read-back. Pooler connection
verification moves to the next acceptance step. Oracle credential parity is
not required. Overall Phase 7.5 remains `BLOCKING / INCOMPLETE` because
`7.5F`–`G` and production certification are still open.

Subsequently, the user authorized Oracle schema/migration catch-up. The new
migration was applied to `qltbyt_test`; live and baseline each report 352
migrations and high-water `20260928132847`. A passwordless NOLOGIN fixture
retains the four role settings. Evidence is in the final Oracle catch-up
section of `phase-7.5-evidence.md`. Gate state was invalidated (`healthy=false`)
and not recertified; this does not claim full schema parity or gate PASS.

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

7.5E live read-only inspection (2026-09-28, subject `ddad8cfd`): Supabase MCP
SELECT found existing `ai_query_reader` and passworded `ai_query_tool`, the
five `ai_readonly` views, and inherited reader grants. Role GUCs are unset.
Static lane returned SKIP because this subject has no migration diff;
baseline-forward was not run. No live write or password read. See the 7.5E
section in `phase-7.5-evidence.md`. Overall status remains BLOCKING /
INCOMPLETE.

7.5E local migration (2026-09-28, still uncommitted, HEAD `ddad8cfd`): file
`supabase/migrations/20260928120000_set_ai_query_tool_read_only_role_settings.sql`
contains only the four `ALTER ROLE ai_query_tool SET` statements plus the
header and transaction wrapper required by the static harness. Isolated Oracle
read-back passed and baseline role count stayed 0. Static on this exact commit
is INCOMPLETE (`migration.subject-input`, `registry.sql-tests.evidence`).
Baseline-forward was not run because the commit does not contain the file.
No live apply. Overall status remains BLOCKING / INCOMPLETE.

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
