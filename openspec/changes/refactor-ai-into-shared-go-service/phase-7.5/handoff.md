# Phase 7.5 Handoff — Independent package dispatch

## Latest 7.5F candidate-origin checkpoint (2026-09-29)

The disposable candidate was recreated from the exact `a3267b53` digest with
host networking and `127.0.0.1:8080`, after the unused `coolify-proxy` listener
was stopped to free that port. Private `/healthz` and `/readyz` both returned
`200` after quarantine; DQSS remained healthy with restart `0`, and Web Push
remained running. A public clarification-only probe still received Cloudflare
Access `403` before any candidate request, so trusted Access acceptance and
end-to-end tunnel delivery remain uncertified. `7.5F.1` and `7.5F.2` stay open;
7.5G remains unopened.

## Latest 7.5F checkpoint (2026-09-29)

Subject `a3267b539e9169342b12d7a127980b549217fb33` was reconciled for disposable
auth and readiness. Local Go and Vitest matrices passed, unauthenticated
production negatives rejected browser Access headers, and the Oracle candidate
was rebuilt natively from the exact subject. The candidate digest is
`sha256:c19c97cdad7fcd4415ad2fe69c19f1ab6d0a4bc239c2d455e320a263face56fc`
with OCI revision equal to the subject; private `/healthz=200` and
`/readyz=200` now exercise the external-pooler tuple. A disposable
broker-token clarification request also returned SSE `200` without provider
work. One production login attempt established a NextAuth session with an
allowed role and facility scope, but the subsequent clarification-only
`POST /api/chat/dark` returned HTTP `403` JSON `unauthorized` with no SSE.
Trusted Access positive acceptance therefore remains blocked. `7.5F.3`
records this reconciliation, and `7.5F.2` is checked as disposable-only
evidence. `7.5F.1` and `7.5G` stay open. `7.5E` static remains `INCOMPLETE` and
baseline-forward remains `NOT RUN`; the waiver is not a gate PASS. Overall
Phase 7.5 remains `BLOCKING / INCOMPLETE`. See the final 7.5F sections in
`phase-7.5-evidence.md`.

The read-only attribution follow-up is recorded in the final evidence section:
the sanitized attempt reached the BFF stage with `loginStatus=200`,
`sessionStatus=200`, role `to_qltb` and a facility, then returned HTTP `403`
JSON `unauthorized` without SSE. The response body/headers were not retained,
but the role is allowlisted and the script reached its BFF stage. Go's source
matrix maps invalid broker credentials to `401` and routes this exact
repair-plus-quota payload to clarification SSE before provider work, so the
`403` was returned by the Cloudflare Access edge in the upstream fetch. Oracle
Tunnel v2 routes only `/v1/chat` to the private candidate; no cloudflared or
candidate log record appeared in the attempt window. The missing condition is
trusted BFF service-token acceptance for that endpoint/policy; no fix or Access
bypass was attempted.

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

## Historical candidate deployment (2026-09-28)

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

## 2026-09-29 closeout

The maintainer explicitly waived the unresolved DB quality-gate lanes for this
7.5E acceptance. Preserve the recorded `static=INCOMPLETE` and
`baseline-forward=NOT RUN` statuses; this is a waiver, not a gate PASS.
Vercel production redeploy reached `READY` and is aliased to `www.cvmems.vn`.
Paid-provider smoke is intentionally deferred to manual frontend testing. No
synthetic identity or auth bypass was used. Do not claim provider smoke PASS,
cut over `/api/chat`, or open downstream phases from this handoff.

## 7.5F execution record (2026-09-29)

The integration acceptance pass used the existing Vercel deployment and Oracle
candidate. It did not rotate credentials, change runtime configuration, or
write to a database. Disposable token, cancellation, redaction, audit-order,
unsafe-SQL, and missing-tuple tests passed on `a3267b53`. Live checks proved
only negative paths: broker `401` without a valid token, dark route `401`
without a session, and Cloudflare `403` for browser-copy Access headers.
`/readyz=200` was observed privately on the `5ea42ef` image and is not
exact-commit evidence for `a3267b53`.

`7.5A` is still ready for review rather than PASS. `7.5B` and `7.5C` remain
disposable. `7.5D` disposable Oracle evidence is tied to `848073b5` plus an
uncommitted fix. `7.5E` remains the waiver recorded above. Those facts keep
`7.5F.1` open; the later exact-subject rerun checks `7.5F.2` as
`DISPOSABLE ONLY`. `7.5G`, cutover, Phase 8/9, and paid-provider smoke remain
unopened.

## 7.5F exact-subject candidate rerun (2026-09-29)

The Oracle host is `arm64`; the first local `amd64` transfer was rejected with
`exec format error` and its disposable container was removed. The service was
then built natively on Oracle from detached subject
`a3267b539e9169342b12d7a127980b549217fb33` with the pinned Dockerfile and
`TARGETARCH=arm64`. Docker recorded repository digest/image ID
`sha256:c19c97cdad7fcd4415ad2fe69c19f1ab6d0a4bc239c2d455e320a263face56fc`,
`arm64/linux`, and OCI revision equal to the subject. Only the disposable
`qltbyt-ai-service-candidate` container was recreated, using a temporary
Compose override that mounted the existing secret files and referenced the
protected BFF/pooler variables; no secret value was written to this repo.

After the replay quarantine, private `docker exec` probes returned
`/healthz={"status":"ok"}` and `/readyz={"status":"ok"}` on
`127.0.0.1:18081`; the container is `running/healthy` as user `65532:65532`.
The readiness result is direct evidence of the real Broker + external-pooler
QueryExecutor + `qltbyt/assistant-chat/v1` tuple on the exact subject. A
short-lived broker token and ingress HMAC were generated in protected process
memory from the mounted candidate secret files. A clarification-only request
with the complete routing tool set returned an SSE `200` (`start`, clarification,
`finish(stop)`, `[DONE]`) without provider work, proving positive disposable
broker-token acceptance. Token/signature/body/key values were not recorded.

An earlier exploratory request with an empty tool set returned `start` then
`cancelled`; it is not acceptance evidence. No successful provider result or
quota/usage write was observed, and no further provider request was made.

The trusted positive Cloudflare Access lane through production BFF remains
blocked. One production login attempt established the NextAuth session, but
the clarification-only `/api/chat/dark` request returned HTTP `403` JSON
`unauthorized` with no SSE. Browser-supplied Access headers remain negative
evidence; no Access secret was recovered, forged or bypassed. Therefore
`7.5F.2` is checked as `DISPOSABLE ONLY`, `7.5F.1` remains open, and Phase 7.5
stays `BLOCKING / INCOMPLETE`. The `7.5E` waiver remains
`static=INCOMPLETE`, `baseline-forward=NOT RUN`; no `7.5G`, cutover, Phase 8/9
or paid-provider smoke was opened.

## 7.5F.1 read-only access parity follow-up (2026-09-29)

Vercel production metadata contains all six `AI_SERVICE_BFF_*` names with
Production targets and encrypted/sensitive types. The values were not read.
The prior request ran on `dpl_7Hhs8L9bwwj7cvbrDXFZDJidvgBV` (`a3267b53`); the
current production alias is `dpl_8fUnWhGebwVxtEZLaSDJ6BPiQRQa` (`20ac0f26`).
No Vercel log record exposes the outbound BFF hostname, so equality with the
configured value cannot be certified. The independently verified service
hostname is `ai-service.cdclims.cloud`.

Oracle read-only inspection found a concrete activation mismatch. The local
AI route file validates `ai-service.cdclims.cloud`, `^/v1/chat$` and
`127.0.0.1:18081`, but the active host-network token-run
`qltbyt-ai-cloudflared-new` does not mount that file and retained tunnel logs
show the older `127.0.0.1:8080` origin. The disposable candidate listens only
inside bridge network `qltbyt-ai_default` at `10.0.7.2:18081`; it has no host
port mapping, while host port 8080 belongs to `coolify-proxy`. The active route
therefore cannot reach this candidate. This is not live provider evidence and
does not authorize activation or a runtime change.

No Cloudflare API/dashboard access, Access application ID, policy revision or
request-event log is available here. A maintainer must inspect the Access
application for `ai-service.cdclims.cloud` and `/v1/chat`, verify the service
token policy against the production BFF pair, and correlate the
`2026-09-29T04:39Z` request before closing `7.5F.1`. No secret/token value,
authentication retry, bypass, provider smoke or live DB write was performed;
the package remains `BLOCKING / INCOMPLETE`.

## 7.5F.1 candidate-only network experiment (2026-09-29)

The coordinator briefly recreated only the disposable candidate with host
networking to test the tunnel-facing topology, then restored the exact ARM64
image in its prior bridge network. The host-network trial returned
`/healthz=200` but `/readyz=503`; it was rolled back and is not a route or
Access acceptance result. The immediate bridge rollback was container-healthy
with `/healthz=200`, while `/readyz` was still `503` and the service produced no
application logs. DQSS stayed healthy with restart count `0` throughout.

A later read-only check at `2026-09-29T07:30:27Z` found the bridge candidate
healthy with both private endpoints returning `200`. That delayed recovery is
startup/readiness evidence only. The active token-run tunnel, Cloudflare
policy, Vercel settings and production BFF were untouched, so the host/bridge
route mismatch and trusted Access blocker remain unresolved. No secret, provider
request or live DB operation was performed; `7.5F.1` remains open.

## Latest read-only pooler/catalog correlation (2026-09-29)

A read-only transaction-pooler login as `ai_query_tool` succeeded. The session
reported both `transaction_read_only=on` and
`default_transaction_read_only=on`. Through that same role, the five approved
`ai_readonly` relations — `equipment_search`, `maintenance_facts`,
`repair_facts`, `usage_facts` and `quota_facts` — were all views and had
effective schema `USAGE` plus `SELECT`.

At the immediate candidate recreate checkpoint, private `/readyz` still
returned `503`; DQSS remained health `200`, healthy, and restart `0`. The
later post-quarantine `200` read-back is recorded above. The SQL result proves
the pooler role/catalog boundary only; it does not identify a provider root
cause, prove Tunnel/Access acceptance, or certify production readiness. No
password/URL was recorded and no SQL write, role change, activation, provider
request or live DB mutation occurred. The package remains
`BLOCKING / INCOMPLETE`.

## 7.5F host-network topology trial and rollback (2026-09-29)

Only the disposable candidate was recreated with host networking, retaining the
exact ARM64 image revision `a3267b539e9169342b12d7a127980b549217fb33`, digest
`sha256:c19c97cdad7fcd4415ad2fe69c19f1ab6d0a4bc239c2d455e320a263face56fc`, and
loopback listener `127.0.0.1:18081`. The host-network run started at
`12:51:16Z`; after startup, twelve consecutive probes through `12:53:18Z`
returned `/healthz=200` and `/readyz=503`. DQSS stayed HTTP 200, healthy and
restart 0 throughout.

The candidate was then rolled back to bridge network `qltbyt-ai_default` at
`12:53:49Z`. Seven post-start probes through `12:55:02Z` kept
`/healthz=200` and `/readyz=503`, with the candidate healthy/restart 0. A final
read-back confirmed cloudflared, DQSS and Coolify were unchanged; the candidate
had no application log lines. Since readiness failed in both topologies, no
production BFF trusted-lane probe or provider smoke was run. This is a
candidate-readiness blocker only and does not establish a provider root cause;
`7.5F.1` and overall Phase 7.5 remain `BLOCKING / INCOMPLETE`.
