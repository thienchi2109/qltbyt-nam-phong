# Phase 7.5 Evidence — Broker/query composition và readiness

## 7.5G Oracle candidate activation (2026-09-30)

### 7.5G.2 trusted BFF smoke (2026-09-30)

- From an authenticated production session, `POST /api/chat/dark` returned
  `HTTP 200` with `Content-Type: text/event-stream` and a completed `[DONE]`
  stream. Request ID: `probe-75g-final`.
- This verifies the trusted BFF path reached the active Go candidate with the
  real signed Broker/QueryExecutor route and assistant capability registry.
- No secret, cookie, token or response body was recorded.

- **Subject/runtime:** Oracle candidate `qltbyt-ai-service-candidate` is running
  image `qltbyt-ai-service:75f1-cookie`; no image replacement or production
  cutover was performed.
- **Private activation evidence:** loopback `/healthz=200` and `/readyz=200`;
  raw listener remained private. Candidate, DQSS (`dqss-issue-508`) and
  cloudflared (`qltbyt-ai-cloudflared-new`) were running with restart count `0`.
- **Auth boundary:** an unsigned loopback `POST /v1/chat` returned redacted
  `401 unauthorized`, confirming the ingress boundary without printing or
  rotating any secret.
- **7.5G.2 status:** `BLOCKING / INCOMPLETE`. A trusted BFF Access credential
  and redacted real Broker + QueryExecutor + `qltbyt/assistant-chat/v1` smoke
  were not executed in this run; readiness `200` is not promoted to that
  acceptance claim.
- **Scope:** no live DB write, quota/audit mutation, Web Push change, `/api/chat`
  cutover, Phase 9 cleanup or paid-provider smoke.

**Status:** `BLOCKING / INCOMPLETE` for overall Phase 7.5. Tasks `7.5E.1`–`7.5E.3`
are accepted. `7.5E.2` is accepted with the recorded waiver: static remains
`INCOMPLETE` and baseline-forward remains `NOT RUN`. That waiver is not a gate
PASS. `7.5E.3` is accepted on the live role/grant/config read-back. Pooler
connection verification moves to the next acceptance step, and Oracle
credential parity is not required. The 2026-09-29 `7.5F` reconciliation and
the exact-subject candidate rerun are recorded below. On 2026-09-30 task
`7.5F.1` is checked at `DISPOSABLE ONLY` against image
`qltbyt-ai-service:diag-75f-cookie`, manifest list
`sha256:2f912b65f8226b546e0476b33c55e29f5216437a5f40cfbd739f62f796924d61`.
Positive probe `probe-75f-1790757941136` returned SSE `200`, and the negative
broker-token and browser-supplied Access cases on that same image returned
`401` or public `403` at `2026-09-30T09:00:54Z`. That image is not an exact
subject commit. After that tick, the serving container was swapped to cleaned
image `qltbyt-ai-service:75f1-cookie`
(`sha256:5b984f8fb0e2a7f782a0c2caf45110d12ab6eab957738080ae3d417de6bc9432`)
without a second model probe. `7.5F.2` remains the 2026-09-29 disposable tuple
result. This is not production acceptance or acceptance of `7.5G`.

**Subject commit/config:** not accepted as one phase subject. The `7.5F`
attempt binds Next.js, local disposable tests, and the rerun candidate to
`a3267b539e9169342b12d7a127980b549217fb33`. The exact-subject Oracle image
is revision `a3267b539e9169342b12d7a127980b549217fb33`, digest
`sha256:c19c97cdad7fcd4415ad2fe69c19f1ab6d0a4bc239c2d455e320a263face56fc`
(`arm64/linux`).

**Latest candidate checkpoint (2026-09-29):** the disposable Oracle candidate
was rebuilt natively for `arm64` from exact subject
`a3267b539e9169342b12d7a127980b549217fb33` and recreated with a temporary
override that mounted the configured secret files without recording values.
Private `/healthz` and `/readyz` both returned `200` after the restart
quarantine. The earlier `5ea42ef` deployment remains historical evidence and
does not bind the current candidate. This does not reopen accepted 7.5E tasks
or convert waived DB lanes to PASS.

**Latest candidate checkpoint (2026-09-30):** the serving disposable container
`qltbyt-ai-service-candidate` is cleaned image
`qltbyt-ai-service:75f1-cookie`, manifest list
`sha256:5b984f8fb0e2a7f782a0c2caf45110d12ab6eab957738080ae3d417de6bc9432`.
Private `/healthz` and `/readyz` are both `200`, Docker health is `healthy`,
and the restart count is `0`. The probed image
`qltbyt-ai-service:diag-75f-cookie`, manifest list
`sha256:2f912b65f8226b546e0476b33c55e29f5216437a5f40cfbd739f62f796924d61`,
was removed after that read-back. Its digest remains the `7.5F.1` record.
The only local AI service image left is `75f1-cookie`. See the 2026-09-30
section below.

**Latest Vercel configuration checkpoint:** four production BFF variables have
now been added and their names/types/target read back: URL, HMAC key ID, HMAC
secret, broker secret. The two secrets were transferred directly from the
candidate's mounted files through protected process memory/stdin and saved as
Sensitive. Earlier observations that no AI_SERVICE variables exist are historical.
No redeploy or paid smoke occurred. The remaining Access client ID/secret is
not available from the inspected sources: the existing Device Quota pair is
Sensitive and Vercel does not return its values, and its AI policy coverage is
unverified. No token was copied between services or Access policy changed.

The Phase 7 tunnel evidence was also rechecked against connector logs:
version 1 used 8080; version 2 routes `/v1/chat` to 127.0.0.1:18081 in host
network mode. The earlier port-mismatch claim was incorrect; no tunnel change
is needed. Phase 5 proves the Go route is `/api/chat/dark`, with `/api/chat`
remaining on its existing implementation. A real session is still needed for
end-to-end smoke; no session impersonation or authentication bypass is allowed.

Phase 7.5 sits between Phase 7 dark smoke and Phase 8 exact-commit acceptance.
It is an orchestration gate with seven independently dispatchable packages;
completing one package does not tick or authorize another package.

## Approved contract

- `7.5A` records the concrete application-owned BFF broker route as
  `POST /api/internal/ai/broker/v1`, with strict per-RPC argument/result
  schemas, derived facility/audit fields, response byte and row/item caps,
  allowlist, operation transport, timeout/cancellation, redaction and trusted
  BFF credential source in the [7.5A contract/ADR](phase-7.5a-contract.md).
  The route is no longer symbolic; implementation remains package `7.5B`.
- The broker token is short-lived (maximum `120s`) with
  `iss=nextjs-bff`, `aud=qltbyt-rpc-broker-v1`, numeric `user_id` and only
  trusted role/facility scope. Browser cookies, browser claims and
  `SUPABASE_JWT_SECRET` are rejected at the Go boundary.
- `7.5C` wires the internal Go `Broker` and `qltbyt/assistant-chat/v1`
  capability. `7.5D` wires a real `QueryExecutor` through external-pooler
  `AI_DATABASE_URL` with an existing approved or disposable dedicated
  `ai_query_tool` read-only role; production certification waits for `7.5E`.
- `/readyz=200` is valid only for the same real `Broker` + `QueryExecutor` +
  registered capability tuple. Missing, dummy, test-only, disconnected or
  registry-only wiring remains `/readyz=503`.
- `7.5E` is a separate SQL role/provisioning/read-back gate. It does not imply
  a live migration or live database write. Disposable wiring can find defects,
  but it cannot certify production.
- An authenticated Cloudflare Access lane requires evidence that the Access
  credential came from the trusted BFF source; browser-supplied Access headers
  are negative evidence. The 7.5B route treats those headers as transport
  metadata only and authorizes solely with the verified HMAC broker token;
  trusted deployment injection is not certified by this worktree package.

## Package acceptance matrix

| Package                      | Owner / dispatch boundary          | Required evidence                                                                                                                                                                                          | Status / blocker                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `7.5A` Contract/ADR          | Architecture/spec owner; docs only | [Contract/ADR](phase-7.5a-contract.md): route, per-RPC schemas, scope/telemetry derivation, operation mapping, byte/row/field caps, allowlist, token TTL/claims, trusted credential source, negative cases | **READY FOR REVIEW** — docs recorded; exact landed subject commit/config binding still pending                                                                                                                                                                                                                                                                                                                                              |
| `7.5B` BFF broker endpoint   | Next.js/BFF owner                  | Server-only credential source, token mint/verify, scope/allowlist, cancellation, redaction and route tests                                                                                                 | **DISPOSABLE ONLY** — focused worktree tests pass; landed/Go/Access acceptance remains pending                                                                                                                                                                                                                                                                                                                                              |
| `7.5C` Go broker/capability  | Go runtime owner                   | Internal Broker composition, trusted token propagation, audit/quota calls, registry `qltbyt/assistant-chat/v1`                                                                                             | **DISPOSABLE ONLY** — local composition/transport/readiness evidence passes; landed and downstream acceptance remain pending                                                                                                                                                                                                                                                                                                                |
| `7.5D` QueryExecutor/pooler  | Go query/runtime owner             | External-pooler `AI_DATABASE_URL`, existing approved/disposable read-only executor, parser/catalog/scope/limits, readiness negative cases                                                                  | **DISPOSABLE ONLY / NOT EXACT-COMMIT** — later Oracle entry passed the tested catalog matrix on `848073b5` plus an uncommitted executor fix; that superseded the earlier "no disposable PostgreSQL" note. It is not production certification and is not evidence for `a3267b53`                                                                                                                                                             |
| `7.5E` SQL gate              | Database quality-gate owner        | Static and baseline-forward lanes (separate), role/grant/pooler/catalog read-back                                                                                                                          | **ACCEPTED WITH WAIVER** — `7.5E.1`–`7.5E.3` ticked; static `INCOMPLETE`; baseline-forward `NOT RUN`; live role/grant/config read-back accepted; pooler connection moves to the next acceptance step                                                                                                                                                                                                                                        |
| `7.5F` Disposable acceptance | Integration acceptance owner       | Positive/negative token and Access tests, real-tuple readiness checks, redacted matrix labeled `DISPOSABLE ONLY`                                                                                           | **DISPOSABLE ONLY** — `7.5F.1`–`7.5F.3` are checked. `7.5F.1` binds probed image `diag-75f-cookie` manifest `sha256:2f912b65f8226b546e0476b33c55e29f5216437a5f40cfbd739f62f796924d61` (SSE `200` plus `2026-09-30T09:00:54Z` negatives). That image is not an exact subject commit. Serving then moved to cleaned `75f1-cookie` without a second model probe. `7.5F.2` remains the 2026-09-29 `a3267b53` tuple. Not a production candidate. |
| `7.5G` Oracle activation     | Oracle/runtime operations owner    | Exact image/config hashes, private Tunnel/Access, trusted BFF lane, local health/readiness, redacted smoke and drain/rollback                                                                              | **NOT RUN** — requires `7.5A–F` and operation-specific authorization                                                                                                                                                                                                                                                                                                                                                                        |

## Readiness acceptance

The following matrix is normative for every disposable and Oracle run:

| Condition                                                                  | Expected result                                 | Evidence required                          |
| -------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| Missing provider/HMAC or invalid config                                    | `/readyz=503`; no chat admission                | Redacted config validation                 |
| Missing or test-only Broker                                                | `/readyz=503`; no RPC/model work                | Composition diagnostic                     |
| Missing or test-only QueryExecutor, pooler URL or read-only role           | `/readyz=503`; no query work                    | Query composition diagnostic               |
| Missing `qltbyt/assistant-chat/v1` registry member                         | `/readyz=503`                                   | Registry lookup diagnostic                 |
| Only one or two members are present                                        | `/readyz=503`                                   | Tuple-negative test                        |
| Real Broker + QueryExecutor + registry tuple and trusted BFF Access source | `/readyz=200`; no unsafe model call or DB write | Exact tuple/config hash and probe response |

`/healthz` and `/readyz` remain local/private and are never Tunnel chat
routes. Readiness `200` from a nil-check, broker-secret check, registry-only
check or mock does not satisfy this gate.

## Explicit blockers and scope fences

- The BFF endpoint has only disposable worktree evidence; landed exact-commit,
  Go/Access and downstream acceptance remain blocking for `7.5C`.
- Cloudflare Access headers remain compatible with `GoBffProxy` because they are
  not rejected or used as authority at this route. Browser copies cannot
  authorize without the broker token, but trusted deployment provenance still
  requires the later Access/disposable acceptance lane.
- No production Go composition has been certified; existing injected
  `Broker`/`QueryExecutor` interfaces are contract evidence only.
- The capability-facing Go `Broker.Call` interface remains compatible with
  injected fakes while the 7.5C HTTP transport carries an explicit `call` or
  `cleanup` operation on the wire. The 7.5B Next.js verifier rejects
  nonpositive/noninteger facility claims, and 7.5C now repeats those boundary
  checks for the parsed credential; trusted deployment provenance and
  downstream acceptance remain pending.
- Tasks `7.5E.1`–`7.5E.3` are accepted. Static remains `INCOMPLETE` and
  baseline-forward remains `NOT RUN` under the recorded waiver. Live
  role/grant/config read-back is the `7.5E.3` evidence. Pooler connection
  verification is the next acceptance step. The 2026-09-29 reconciliation
  records `7.5F` as `BLOCKING / INCOMPLETE` at that date. The 2026-09-30
  section supersedes the Access gap: `7.5F.1` is checked `DISPOSABLE ONLY` on
  probed image `diag-75f-cookie`
  (`sha256:2f912b65f8226b546e0476b33c55e29f5216437a5f40cfbd739f62f796924d61`),
  `7.5F.2` stays the 2026-09-29 disposable checkbox, `7.5F.3` stays checked,
  and `7.5G` stays unopened. The serving container is later cleaned image
  `75f1-cookie`, which is not the probed subject. Overall Phase 7.5 stays
  `BLOCKING / INCOMPLETE`.
- No live DB write, migration, DDL, Supabase CLI operation or production
  credential provisioning is authorized by this artifact.
- Phase 8 `/api/chat` cutover, Phase 9 legacy cleanup and paid-provider smoke
  are outside this phase. They remain unopened even if a disposable run passes.

## Evidence handoff

Each package must append its report here or link a package-specific report with:
subject commit, config/image hashes, owner, prerequisites, commands/results,
redaction review, status (`PASS`, `BLOCKING / INCOMPLETE` or `DISPOSABLE ONLY`)
and explicit next-package authorization. A package may stop with a blocker;
the orchestrator must not relabel a missing report as PASS.

### 7.5A package report — contract/ADR

- **Artifact:** [phase-7.5a-contract.md](phase-7.5a-contract.md)
- **Route:** `POST /api/internal/ai/broker/v1` (server-only Next.js BFF)
- **Owner:** architecture/spec owner
- **Prerequisite:** Phase 0.9 review and existing Go `Broker`, `QueryExecutor`
  and capability registry contracts
- **Scope verified:** HMAC broker token (`iss=nextjs-bff`,
  `aud=qltbyt-rpc-broker-v1`, numeric `user_id`, max TTL `120s`), trusted
  session/secret custody, explicit RPC allowlist, strict per-RPC
  request/result schemas, server-derived facility and audit telemetry,
  operation mapping, response byte/row/item/field caps, generated error
  correlation for invalid request IDs, timeout/cancellation, redaction, scope
  binding and negative matrix. The 7.5B worktree verifier covers nonpositive
  facility rejection; Go-side enforcement remains a 7.5C requirement.
- **Validation:** `openspec validate ... --strict` and `git diff --check` are
  required for this docs-only package; no runtime, SQL, deployment or live DB
  command is part of 7.5A.
- **Status:** `READY FOR REVIEW` — contract work is recorded, but exact landed
  subject commit/config hashes and reviewer sign-off are still required before
  relabeling this package `PASS`.
- **Next-package boundary:** 7.5B may implement the route only after review of
  this artifact. No 7.5C–G package, Phase 8 cutover, Phase 9 cleanup, SQL/live
  DB work or paid-provider smoke is authorized by this report.

### 7.5B package report — application-owned BFF broker endpoint

- **Subject:** worktree based on `6f4ef73ccc2d64d189a2e196c7b9ee52f9b6891d`;
  changes remain uncommitted and this report is not a landed-commit
  certification.
- **Route:** `POST /api/internal/ai/broker/v1`, Node.js runtime, with explicit
  `GET`/`PUT`/`PATCH`/`DELETE` 405 responses.
- **Implementation:** server-only compact HMAC verification using
  `AI_SERVICE_BFF_BROKER_SECRET`; exact issuer/audience, positive numeric
  identity/facility claims, UTC clock and 120-second maximum TTL; strict
  allowlist and per-RPC input/result schemas; derived facility/audit/quota
  fields; call/cleanup admission; streamed 64 KiB request/success and 8 KiB
  error body caps; 5-second abort-aware downstream RPC budget; generated
  correlation IDs; redacted stable errors; browser cookie/claim and Supabase
  signing-secret rejection. Result schemas reject unknown recursive fields,
  cap `condition_counts` at 100 keys and allow only the seven contract filter
  keys. Access headers are transport metadata only; the broker HMAC is the
  sole route authority.
- **Changed source:** `src/app/api/internal/ai/broker/v1/route.ts`,
  `src/lib/ai/bff-broker/BffBrokerContracts.ts`,
  `src/lib/ai/bff-broker/BffBrokerResults.ts`,
  `src/lib/ai/bff-broker/BoundedBody.ts`,
  `src/lib/ai/go-bff/GoBffBrokerCredential.ts`, and the server RPC helper's
  optional abort signal, with route/token/server-RPC focused tests under
  `src/app/api/internal/ai/broker/v1/__tests__/`,
  `src/lib/ai/go-bff/__tests__/` and `src/lib/ai/__tests__/`.
- **Focused evidence:** 36 tests passed (23 BFF route, 7 server RPC body-cap,
  6 broker-token); targeted TypeScript compilation passed; `git diff --check`
  passed; route and contract hashes are recorded below.
- **Worktree SHA-256:** route
  `a97005b395c76dce4b287c3fce0631ac2ce8d68b58c7b00417fc3e949313434c`;
  route tests
  `f64d9b808fddb227b31f6fff14dd21b8750a2d3dc91805c95eb764057cf8416c`;
  contracts
  `3158e408ca2871ca58e7b0f6c5ec9581fc27ee12b107d7b0a69c9a164d028160`;
  result schemas
  `d5dd1fc77656e22a711fd24695bda65227c516716f84115e44814de815333c04`;
  bounded body helper
  `3d0117937e665f112fbc15af65dcc82abeb32e3119f70a5a2c7d9ca5d699d6a5`;
  token verifier
  `782cef3b291aef448c0c4972eb6ba1f6702b41a03e4da4d1e8369d64bf371146`;
  token tests
  `c8e6683bc98bce8f80e116ebd603769d6b9ce450404deceeac122b55697744c4`;
  abortable RPC helper
  `1aeeee28f10023e5c6a5af2aed6780526213620d41ca6d071b34b7023714d380`;
  route/server-RPC tests
  `0c44b5864aaa8d5b0a5e9ea165019018a228b3cd20748347ae5e42b8c0ef5473`.
- **Redaction review:** no token, cookie, Supabase signing secret, SQL text,
  upstream rows or raw upstream error is returned or logged. The test suite
  covers forged/expired/future/over-TTL/wrong-audience credentials, invalid
  IDs, browser authority, Access-header provenance boundary, widened scope,
  cleanup mismatch, request-body cancellation, bounded request/upstream/error
  bodies, bounded results and generated correlation IDs.
- **Status:** `DISPOSABLE ONLY` — the route contract and focused tests are
  implemented, but trusted deployment Access provenance is not certified and
  no Go 7.5C transport, real deployment/Access lane,
  production configuration, SQL/live DB operation, Oracle run or paid-provider
  smoke was performed. Overall Phase 7.5 remains `BLOCKING / INCOMPLETE`.
- **Next-package boundary:** 7.5C may consume this route/schema contract only
  after the 7.5A review gate and a landed exact subject commit are recorded.
  This report does not authorize 7.5C–G, Phase 8, Phase 9, SQL/live DB work or
  paid-provider smoke.

### 7.5C package report — Go broker/capability composition

- **Subject:** local worktree based on `cf15f9b904af67443bd7ed6bda0229875afc99dc`; changes remain uncommitted and are not a landed-commit certification.
- **Scope:** `internal/qltbyt/http_broker.go` adds the operation-aware HTTP transport for `POST /api/internal/ai/broker/v1`; `gate.Call` preserves `call` and bounded cleanup preserves `cleanup`. The transport forwards only the previously verified opaque broker token as `Authorization: Bearer`, binds `X-Request-ID`, preserves the explicit operation in the JSON envelope, rejects operation/RPC mismatches before network I/O, caps request/result/error bodies, and carries cancellation and the five-second budget.
- **Claims:** Go credential parsing now rejects unknown claims, browser claims, null/non-integer/non-positive facility claims, missing/blank or malformed role values and malformed envelopes before capability work. The verified token is retained only in the parsed credential for trusted transport propagation; no project JWT signing secret or browser cookie is minted or forwarded.
- **Composition:** `internal/composition` registers `qltbyt/assistant-chat/v1` only when Broker, QueryExecutor and broker secret are all present. The service entrypoint composes the broker boundary but passes no QueryExecutor until 7.5D, so broker-only, registry-only and nil-dependency states remain `/readyz=503`.
- **Focused evidence:** `go test ./internal/qltbyt -run 'TestCleanup|TestFinalizeQuota|TestGateCleanup|TestAssistantDependenciesRejectTypedNilInterfaces|TestCancellationDoesNotStartFurtherWorkOrWidenCleanup' -count=1` — PASS; `go test ./internal/composition -run 'TestRegisterQLTBYTRejectsTypedNilDependencies|TestRegisterQLTBYTReadinessMatrixRejectsNilBrokerQueryAndRegistry|TestRegisterQLTBYTRegistersTheRealTupleOnlyWhenComplete' -count=1` — PASS; the focused package suites (`./internal/qltbyt ./internal/composition ./internal/ingress ./cmd/ai-service`) — PASS; `go test ./...` — PASS; `go vet ./...` — PASS; `git diff --check` — PASS.
- **Fail-closed regressions:** cleanup now returns `503/capability_unavailable` without invoking a plain `Broker` when no cleanup-capable operation exists; reflection-backed dependency checks reject typed-nil `Broker` and `QueryExecutor` interfaces before registration or readiness.
- **Redaction review:** tests and transport code avoid logging or returning token bytes, cookies, SQL, rows or upstream response bodies; only bounded, fixed protocol errors leave the transport.
- **Status:** `DISPOSABLE ONLY` — local Go composition and fail-closed readiness behavior pass. QueryExecutor/pooler, SQL role/read-back, trusted Access provenance, disposable end-to-end acceptance and Oracle activation remain 7.5D–G blockers.
- **Next-package boundary:** 7.5D may supply the external-pooler QueryExecutor and then repeat the full tuple readiness matrix. This package does not authorize SQL/live DB writes, deployment, Access activation, `/api/chat` cutover, Phase 9 cleanup or paid-provider smoke.

### 7.5D package report — external-pooler QueryExecutor composition

- **Latest Oracle disposable result (2026-09-28, supersedes pending-integration notes below):** tested exact subject `848073b58d30551d4a168e5e96757c132ab26447` from `git archive` with an external test harness. Restored a read-only dump of `qltbyt_test` into an isolated PostgreSQL 17.6 cluster on Oracle, with transaction-mode PgBouncer 1.25.2, client TLS, synthetic scoped catalog and dedicated fixture role. No baseline role/grant/data mutation, live operation or SQL quality-gate execution occurred.
- **Catalog-readiness rerun (2026-09-28):** after adding all five approved views to the disposable fixture, the same real-pooler harness passed **15/15** subtests. Readiness returned 200 with all views/grants; returned 503 after revoking approved-view SELECT, revoking schema USAGE, removing each view one at a time, removing the registry, or closing the pool; and recovered to 200 after grants were restored. Scope/reuse, aggregate/parentheses, unsafe SQL, read-only/raw-access, state reset, cancellation and timeout recovery also passed.
- **Rerun artifacts:** PostgreSQL 17.6 disposable baseline dump SHA256 `ca059d2aa219da1d3cfdf0dc859ad8a106167301d0bd0fb9a0d54f7d9922403d`; temporary harness SHA256 `784d91d869ed89a50b224b8b48268bfee933e4e2a7223b7fb81b4c2f03babce1`; output SHA256 `fb2c35db88d80643aeaab87872611bca4f01177c67700113638b262d51c248d4`. All disposable containers, network, dump, credentials and certificates were removed; baseline read-back still has zero `ai_query_tool` role and zero `ai_readonly` schema.
- **Rerun subject and limit:** code exported from `848073b58d30551d4a168e5e96757c132ab26447` plus the uncommitted `executor.go` fix (SHA256 `042017f108bb4da2077399fb92cedc252cecaf75fffe0b514be53584ecf27061`). Binary SHA256 `27abde80d1ef0ca2def02df71ff612c8242a57b64e16742c61cf056837a81094`. This is **PASS / DISPOSABLE ONLY** for the tested matrix, not an exact-landed-commit or production certification. The catalog grant readiness defect is verified fixed in this worktree. Overall Phase 7.5 remains **BLOCKING / INCOMPLETE** and task checkboxes remain unchanged.
- **Earlier result on unmodified `848073b5`: FAIL / DISPOSABLE ONLY.** Ten subtests passed; revoked approved-view SELECT caused query failure but `/readyz` incorrectly remained 200. The rerun above supersedes this specific failure; it does not certify view function privileges, full production semantic-view definitions, Supavisor behavior or 7.5E grants/read-back.
- **Evidence limits:** real executor/pooler with synthetic catalog, stub BFF endpoint/provider factory and configured ingress harness; not production runtime/BFF, Supavisor or full-catalog certification. Role-default-negative and row/payload-limit integration cases remain unverified. Both broken SQL gate lanes remain unrun/not PASS. Report and reproducible harness references: `/tmp/refactor-ai-phase-7.5d-oracle-verification.md`; harness SHA-256 `fc19ddbeaa60854256a8124c809834435554a0c214111cdfc7026c94beab1f6f`; binary SHA-256 `9453f634b5ce1e0f8e912c8597c1c593055a3acfbfa6ceea9bd4ebbebaf9c1be`.
- **Cleanup verified:** disposable containers/network, dump, credentials/certificate and remote test/setup files removed. Baseline still has no fixture role/schema. Cached pooler image remains. Overall Phase 7.5 remains **BLOCKING / INCOMPLETE**. Entries below describe earlier checkpoints; their uncommitted/pending-integration wording is historical, not the latest subject status.

- **Post-review verification (2026-09-28):** primary agent independently reran `go test -count=1 ./...` and `go vet ./...` in `services/ai-service`; both PASS, and `gofmt -l cmd internal` returned no files. This verifies the current uncommitted worktree, not a landed commit or real database.
- **Review fixes:** the committed advisory-lock and URL-override fixes remain intact. The follow-up triage fix restores valid parenthesized expressions and the documented aggregate functions (`count`, `sum`, `min`, `max`, `avg`) while retaining the unsafe-function rejection. pgx startup parameters, callbacks and fallbacks inherited from process environment are cleared and the parsed endpoint, role, database and TLS are rechecked. Public errors remain generic and startup diagnostics remain bounded/redacted.
- **Independent triage (2026-09-28):** `go test ./internal/qltbyt -run '^TestReviewRepro' -count=1 -v` reproduced the false rejections and environment settings. Read-only PostgreSQL 17.6 `EXPLAIN` checks for the five parenthesized-function forms returned syntax error `42601` without executing a function; that report finding is not accepted as a demonstrated advisory-lock or tenant-scope bypass. The reviewer repro remains untracked and is not product evidence.
- **Follow-up verification (uncommitted worktree):** `go test -count=1 ./...`, `go vet ./...`, targeted `gofmt -l`, and `git diff --check` pass after the triage fixes. This is local contract evidence only; the last landed subject remains `0c46e24c121d5717b7f261d0fc5436ae84cf371d` until the user chooses whether to commit the follow-up.
- **Remaining verification:** no disposable Oracle database/pooler integration has run. Earlier read-only inspection found no `ai_query_tool` role or `ai_readonly` schema in the Oracle baseline; live state has not been checked. The legacy `docs/ai/assistant-sql-foundation-runbook.md` already specifies this role and connection contract. Both SQL quality-gate lanes are reported broken by the maintainer and are not counted as PASS. Approved-catalog privilege/readiness behavior and the effective-versus-stored role configuration contract still require resolution and real integration evidence. Overall status remains `BLOCKING / INCOMPLETE`.

- **Subject:** initial 7.5D landed at `0c46e24c121d5717b7f261d0fc5436ae84cf371d`, based on 7.5C `8bfa83bb0428459eb85ca75b134e2cc9a0ca9a27`. The triage fixes and this evidence update are uncommitted follow-up changes, not exact-landed-commit certification.
- **Owner/prerequisite:** Go query/runtime owner; 7.5A contract and 7.5C composition are the prerequisites. No SQL role provisioning, migration, live write, deployment, `/api/chat` cutover or paid-provider smoke was performed.
- **Implementation:** `AI_DATABASE_URL` is required and validated against the documented transaction-pooler shape (`postgresql`, `:6543`, `/postgres`, TLS `require`/`verify-*`, passworded `ai_query_tool` or pooler-qualified username). `internal/qltbyt/pooler.go` opens pgx in simple-protocol mode, bounds the pool, and closes it on shutdown. The existing `SQLExecutor` now exposes a read-only readiness probe that requires connected `ai_query_tool`, transaction `read_only=on`, and role `default_transaction_read_only=on`; query execution continues to apply the existing parser/schema allowlist, scope settings, five-second timeout, row/payload caps and read-only transaction.
- **Composition:** `cmd/ai-service/main.go` passes the concrete pooler executor through `internal/composition`, registers the capability only with the Broker + SQL executor + secret tuple, and probes the SQL executor before `/readyz=200`. Missing URL, invalid URL, unavailable connection, wrong role, writable connection, dummy executor, registry-only or partial tuples remain `/readyz=503`.
- **Focused evidence:** `go test ./internal/qltbyt ./internal/composition ./cmd/ai-service -run 'TestPooler|TestSQLExecutorReady|TestQueryExecutorReadiness|TestLoadRuntimeConfig|TestRuntimeHandler|TestRegisterAssistantWithEndpoint|TestRegisterQLTBYT' -count=1` — PASS (37 tests); `go test ./...` — PASS (331 tests); `go vet ./...` and `git diff --check` are required before landing.
- **Test boundary:** SQL executor readiness tests use an in-memory `database/sql` driver to exercise cancellation, connection failure, role/read-only checks and limits. No disposable PostgreSQL/pooler, approved `ai_query_tool` role, catalog read-back, static SQL gate or baseline-forward lane was available, so these tests are local contract evidence only and do not certify an external connection or production role.
- **Redaction review:** URL and driver errors are normalized and never include passwords, SQL, rows or upstream messages; `AI_DATABASE_URL` is removed from provider environment forwarding. Query results and SQL remain behind the existing bounded public error/audit path.
- **Status:** `BLOCKING / INCOMPLETE` — local composition and fail-closed behavior pass, but no disposable database or 7.5E role/grant/read-back evidence exists. The DB quality-gate static/baseline-forward state is not used to claim PASS.
- **Next-package boundary:** 7.5E must separately provide role/grant/catalog read-back and report static plus baseline-forward lanes; 7.5F may then run disposable end-to-end readiness. This report does not authorize live SQL, Oracle activation, deployment, cutover, Phase 9 cleanup or paid-provider smoke.

### 7.5E read-only inspection — existing role mapping

- **Subject:** `ddad8cfd59ca2c46ab30e8d8a19a0ad05271eaad` on local `main`. This is the landed 7.5D head. It is ahead of `origin/main` and has not been pushed by this inspection.
- **Method:** Supabase MCP read-only `SELECT` against project `cdthersvldpnlbvpufrr` (`ql-tbyt`, Postgres 17.6, `ACTIVE_HEALTHY`) on 2026-09-28. No `INSERT`, `UPDATE`, `DELETE`, DDL, migration, role change, password read, or pooler login was performed. Oracle baseline absence of `ai_query_tool` is not evidence about live.
- **Existing roles:** both roles already exist. `ai_query_reader` is `NOLOGIN`, has no password, and is not superuser, createdb, createrole, replication, or bypassrls. `ai_query_tool` is `LOGIN`, has a password, inherits, and has the same negative privilege flags. `ai_query_tool` is a member of `ai_query_reader` without admin option. Neither role has `rolconfig` or a per-role database setting. Postgres holds admin option on both roles.
- **Catalog:** schema `ai_readonly` is owned by `postgres`. The five relations `equipment_search`, `maintenance_facts`, `repair_facts`, `usage_facts`, and `quota_facts` are views owned by `postgres` with `security_barrier=true`. Functions `current_facility_id()`, `require_single_facility_scope()`, and `try_parse_iso_date(text)` are not security definer and pin `search_path=pg_catalog, pg_temp`.
- **Effective grants for `ai_query_tool`:** schema `USAGE` and `SELECT` on all five views, no `INSERT` on `equipment_search`, no `SELECT` or `INSERT` on `public.thiet_bi`, and `EXECUTE` on the three functions. Direct table grants are `SELECT` to `ai_query_reader` on those five views; the login role inherits them. `CONNECT` and `TEMP` are effective. Database `CREATE` and `public` schema `CREATE` are not. No dedicated database ACL row for either AI role was visible. `PUBLIC` can execute `try_parse_iso_date(text)` and cannot execute the two scope functions.
- **Applied live migration names:** `20260418103242 add_ai_readonly_semantic_layer_foundation`, `20260419033720 add_assistant_sql_audit_rpc`, and `20260426092400 expand_ai_readonly_equipment_reporting_surface`. These version numbers differ from the local filenames. The applied files were not renamed.
- **Pooler:** `get_project` returned the direct database host, not a transaction-pooler hostname. The Go contract requires `postgresql`, port `6543`, database `/postgres`, only `sslmode=require|verify-ca|verify-full`, and username `ai_query_tool` or `ai_query_tool.<suffix>`. That live URL was not read or tested. The direct host must not be substituted for it.
- **Static lane:** `node scripts/npm-run.js run db:quality-gate:local` printed `[db-quality-gate] SKIP no migration or gate registry changes` and exited 0. `SKIP` is not PASS.
- **Baseline-forward lane:** not executed. No disposable database was created on the VPS or on Oracle. The lane has no measured PASS or FAIL from this session.
- **Status:** `BLOCKING / INCOMPLETE`. This inspection did not change live settings. The later local migration records the four role settings and was not applied to live. Task checkboxes remain open. This inspection does not authorize 7.5F–G, deployment, cutover, Phase 8/9, or paid-provider smoke.

### 7.5E local migration — role settings only

Historical pre-apply checkpoint; superseded for live status by the entry below.

- **Subject:** HEAD remains `ddad8cfd59ca2c46ab30e8d8a19a0ad05271eaad`. The migration, opt-in read-back, and registry entry are uncommitted worktree files, so this is not an exact-commit certification.
- **Migration:** `supabase/migrations/20260928120000_set_ai_query_tool_read_only_role_settings.sql`. The executable change is four `ALTER ROLE ai_query_tool SET` statements: `default_transaction_read_only=on`, `statement_timeout=5s`, `idle_in_transaction_session_timeout=5s`, and `search_path=ai_readonly, pg_catalog`. The static harness also requires the file's header comment and `BEGIN`/`COMMIT` wrapper. The file does not create a role and does not change password, membership, grants, or `PUBLIC EXECUTE`.
- **Read-back:** `supabase/tests/ai_query_tool_role_config_readback.sql` is registered opt-in with `isolated-database`. It is not a default-gate test. It checks that `rolconfig` is exactly those four stored values.
- **Disposable result:** on 2026-09-28 an isolated Oracle container `ai75e-db` used cached image `qltbyt/postgres-dqg:17.6-pgnet-0.19.5-nix`, an internal network, and no published port. The fixture created `ai_query_tool` as `NOLOGIN` only inside that container, then applied the migration. Stored `rolconfig` matched the assertion and the read-back script passed. The container, network, and copied SQL files were removed. Read-only counts of `ai_query_tool` and `ai_query_reader` on baseline database `qltbyt_test` were 0 before and 0 after. This does not certify live or the baseline-forward lane.
- **Static lane:** `db:quality-gate:local` returned `INCOMPLETE`, exit 2, `changed=2`, `findings=1512`, `warnings=1510`, `dangerous=0`, `blocking=2`, digest `49a54b07da0f9a410f77f9208672ffbba93afc92619b5b99e49d23c113a9ec19`. A second static report for the same HEAD, run id `ai75e-static-worktree`, has digest `1ad0e1b2ab64f3530c02ecf3bdc67b39a71ee8f155f990e15aa65799ce64144d`, `evidenceAvailable=false`, and `requiredChecksComplete=false`. The digests differ because the reports do not share `createdAt` or run id. Both name the same two blocking rules and no finding on the new migration text: `migration.subject-input` and `registry.sql-tests.evidence`. Those rules fire because the worktree migration set and SQL-test registry are not in commit `ddad8cfd`. The 1510 warnings are historical hygiene on other migrations. This is not PASS.
- **Baseline-forward lane:** not run. The harness reads migration files from the exact subject commit. `ddad8cfd` does not contain this migration, so a run on that commit would not apply it. A later committed run still needs a database where `ai_query_tool` already exists; the Oracle baseline currently has neither AI role. No disposable gate database was created for this lane, and the migration was not applied to `qltbyt_test` or live.
- **Status:** `BLOCKING / INCOMPLETE`. No Supabase CLI command and no Supabase MCP write were used. Checkbox 7.5E remains open. Live apply is waiting for review. This package does not authorize 7.5F–G, deployment, cutover, Phase 8/9, or paid-provider smoke.

### 7.5E live role-setting apply — operation-specific waiver

- **Authorization:** The user explicitly authorized this live role write and
  explicitly waived the unavailable DB gate for this operation. No Supabase CLI
  was used; Supabase MCP `apply_migration` was used on project
  `cdthersvldpnlbvpufrr`.
- **Applied identity:** Supabase recorded migration version `20260928132847`,
  name `set_ai_query_tool_read_only_role_settings`. The SQL matched the local
  reviewed migration `20260928120000_set_ai_query_tool_read_only_role_settings.sql`:
  exactly four `ALTER ROLE ai_query_tool SET` statements, wrapped in
  `BEGIN`/`COMMIT`.
- **Live read-back (2026-09-28 13:29:07 UTC):** `ai_query_tool.rolconfig` is
  exactly `default_transaction_read_only=on`, `statement_timeout=5s`,
  `idle_in_transaction_session_timeout=5s`, and
  `search_path=ai_readonly, pg_catalog`; no database-specific override exists.
  `ai_query_tool` remains a LOGIN role with the same non-admin flags and remains
  a non-admin member of `ai_query_reader`; `ai_query_reader` remains NOLOGIN.
- **Preserved access checks:** `ai_query_tool` retains SELECT on all five
  `ai_readonly` views and USAGE on the schema, has no SELECT/INSERT on
  `public.thiet_bi`, and retains EXECUTE on the three scope/parse functions.
  `PUBLIC EXECUTE` remains on `try_parse_iso_date(text)` and was not changed.
- **Advisors:** Supabase security/performance advisors were read after apply;
  security returned 19 ERROR, 477 WARN and 15 INFO; performance returned 64
  INFO. No returned notice named `ai_query_tool` or `ai_readonly`. No pre-apply
  advisor snapshot was captured, so these notices are not classified as new
  or unchanged. This is advisory output, not a gate result.
- **Boundary:** Static is still `INCOMPLETE` and baseline-forward is still
  `NOT RUN`; no pooler login, `/readyz`, deployment, cutover, 7.5F-G, Phase 8/9
  or paid-provider smoke was performed. Overall Phase 7.5 remains
  `BLOCKING / INCOMPLETE`.

- **Source binding:** reviewed base HEAD `ddad8cfd59ca2c46ab30e8d8a19a0ad05271eaad`;
  local file SHA256 `050e12d9b01932165de21ff3ab77d788294f8d444a4f420cf3a34081d24ce8d7`.
  The applied SQL omitted the local header comments and trailing newline;
  archived live statement SHA256 `fc226738fdcf7f83f0f4f482a42355a3dee42d2de39b682a2d409b3bfe62d66a`.
  Live `schema_migrations.statements` was read back and matches that exact
  submitted SQL. Local and live versions/bytes differ; this evidence does not
  repair migration metadata or certify an Oracle identity mapping. The applied
  local file is preserved without rename or edit.
- **USER REVIEW:** this waiver covers this operation only. No gate checkbox is
  closed and no further live or runtime action is authorized by this entry.

### Oracle baseline schema/migration catch-up — `ai75e-catch-up-20260928`

- **Scope:** the newly applied migration only. Live metadata was checked
  read-only; no further live write, data copy, or credential copy occurred.
- **Execution:** on the private Oracle VM, persistent `qltbyt_test` was locked
  and the live SQL recorded by Supabase was replayed. A `NOLOGIN`, no-password
  `ai_query_tool` fixture was created because the migration contains
  `ALTER ROLE`; it remains a non-login fixture for migration-state parity.
- **Read-back:** migration count is `352`, high-water is
  `20260928132847`, and the recorded name is
  `set_ai_query_tool_read_only_role_settings`. Fixture `rolconfig` matches all
  four settings; live SQL read-back SHA256 is
  `fc226738fdcf7f83f0f4f482a42355a3dee42d2de39b682a2d409b3bfe62d66a`.
- **Health:** invalid indexes `0`, unvalidated constraints `0`, and
  `postgres` has no `CREATE` on `public`. Redacted evidence is stored at
  `/opt/supabase-test/quality-gate/evidence/ai75e-catch-up-20260928/`.
- **Boundary:** this is migration/schema catch-up, not baseline-forward PASS;
  static and baseline-forward certification remain separate and the overall
  Phase 7.5 status remains `BLOCKING / INCOMPLETE`.
- **State invalidation:** `baseline/current.json` was atomically marked
  `healthy=false` before the transaction, retaining its previous certified
  snapshot/high-water. It was not republished as healthy: the manual catch-up
  has not passed maintenance identity/catalog certification. The old state
  was archived as `state-before.json`; the actual DB high-water is the new
  value above. Existing absence of `ai_readonly` is not repaired by this
  role-only migration and full schema parity is not claimed.

### 7.5E task acceptance — 2026-09-28

- **Decision:** the user accepted `7.5E.1`, `7.5E.2`, and `7.5E.3`.
- **7.5E.1:** the existing-role mapping, local migration
  `20260928120000_set_ai_query_tool_read_only_role_settings.sql`, live identity
  `20260928132847`, and the recorded grant/config assertions are the subject
  evidence.
- **7.5E.2:** accepted with waiver. Static remains `INCOMPLETE`.
  Baseline-forward remains `NOT RUN`. This tick is not a static PASS,
  baseline-forward PASS, or aggregate gate PASS.
- **7.5E.3:** accepted on the live role, grant, and config read-back recorded
  above. Pooler connection verification moves to the next acceptance step.
  Oracle credential parity is not required.
- **Boundary:** overall Phase 7.5 remains `BLOCKING / INCOMPLETE`. `7.5F`–`G`,
  deployment, `/api/chat` cutover, Phase 8/9, and paid-provider smoke stay
  unopened.

### Candidate image/env deployment and pooler verification (2026-09-28)

- **Authorization:** the user approved candidate-only secret/env update,
  recreation, then an exact-commit image upgrade. One paid-provider smoke with
  a read-only prompt and its quota/usage writes was separately approved. None
  of these approvals opens production cutover or unrelated live DB writes.
- **Build:** native Oracle ARM64 build from archived source
  `5ea42ef24b1decf5638ad009a17509b36d3909ab`, pinned repository Dockerfile,
  `TARGETARCH=arm64` and matching `VCS_REF`. Image digest is
  `sha256:3e7b239b69b7feec68174c9c2f89bdd7fe1703125f0a979a2f6e8470abc25d3d`.
  Build log is under `/opt/qltbyt-ai/releases/5ea42ef24b1decf5638ad009a17509b36d3909ab/build.log`.
- **Deployment:** only Compose project `qltbyt-ai-candidate`, service
  `ai-service`, container `qltbyt-ai-service-candidate` was recreated.
  `/etc/qltbyt-ai/ai-service.env` remains mode 0600. Persistent override
  `/opt/qltbyt-ai/compose.oracle-candidate.yml` references secret env variables
  rather than containing their values. Override SHA256:
  `91a4eccf511c967d78c87c95a73d1184018826aa704bb15207af2ae538f0ce2f`.
  It supplies AI_DATABASE_URL, AI_SERVICE_BFF_BROKER_URL and the three
  capability identifiers. Non-root 65532:65532, read-only filesystem, ALL
  capabilities dropped, no-new-privileges, four secret mounts and host network
  with private listener 127.0.0.1:18081 were preserved.
- **Rollback:** previous image digest
  `sha256:6608456a8d43b2e53de543c90af845720bf4d439969b404d7a57d2a10bbd7c52`
  remains locally available. Private env/override snapshots were taken before
  mutation; the pre-BFF snapshots have suffix `before-bff-20260928T152010Z`.
  Rollback requires restoring the selected private snapshot and candidate-only
  image override, then recreating only this Compose service. No rollback ran.
- **Pooler read-back:** a bounded read-only psql transaction from Oracle used
  the candidate's effective URL in process environment, without printing it.
  It connected as `ai_query_tool`; both transaction_read_only and
  default_transaction_read_only were on. All five ai_readonly relations were
  views with effective schema USAGE and SELECT. No business rows were read,
  no SQL write attempted, and no credentials were included in evidence.
  This psql result is independent of the Go readiness probe.
- **BFF preflight:** the application origin from existing operations docs is
  `https://www.cvmems.vn`; `/api/internal/ai/broker/v1` returned 401 unauthorized
  for a valid request ID without Authorization, confirming the route responds.
  With a deliberately invalid bearer token it returned 503 unavailable.
  At the pinned source, verifyBrokerToken checks AI_SERVICE_BFF_BROKER_SECRET
  before parsing the token and emits this 503 when unset. This is evidence
  consistent with missing BFF secret configuration, not a direct inspection of
  production Next.js environment or proof of cross-service secret parity.
- **Smoke:** NOT RUN. No paid request or quota/usage write occurred in this
  operation. Authenticated end-to-end smoke requires the real BFF secret setup
  and a trusted session-derived user/facility scope. No synthetic privileged
  identity or authentication bypass was used. No Next.js deployment occurred.
- **Final runtime read-back (2026-09-28 15:27:14 UTC):** `/healthz=200` and
  `/readyz=200` on the candidate's private loopback listener. Earlier 503s
  occurred before completing capability configuration and during the built-in
  150-second restart quarantine. Readiness exercises the real Go SQL executor
  and registered tuple; it does not perform an authenticated BFF RPC or prove
  provider availability.
- **Vercel read-only verification:** CLI 52.0.0 identified project
  `qltbyt-namphong`, production deployment `dpl_52aTfNcVkihBDs9HGGjBAcbaW2qQ`,
  Ready, aliased to `www.cvmems.vn`. `vercel env ls production` has no
  `AI_SERVICE_*` variables, including `AI_SERVICE_BFF_BROKER_SECRET`, HMAC,
  service URL and AI-specific Access credentials. Therefore secret parity
  cannot yet be checked. Existing legacy AI variables (including an older
  AI_DATABASE_URL) were not read, changed or assumed equivalent to the new
  Oracle configuration. No Vercel env write or redeploy was performed.
- **Boundary:** 7.5E.1-3 acceptance remains unchanged; static INCOMPLETE and
  baseline-forward NOT RUN remain unchanged. This is positive candidate
  evidence, not completion of the full 7.5F negative/auth/Access matrix or 7.5G.

### 7.5E closeout waiver and production deployment (2026-09-29)

- **Closeout decision:** the user explicitly waived completion of the DB
  quality-gate lanes for this acceptance. Static remains `INCOMPLETE` and
  baseline-forward remains `NOT RUN`; neither is relabeled as PASS.
- **Deployment:** the exact-commit Vercel production deployment reached
  `READY` and was aliased to `https://www.cvmems.vn`. The deployment included
  the six approved `AI_SERVICE_BFF_*` variables; secret values are not recorded
  here.
- **Paid-provider smoke:** deferred by the user for manual frontend testing
  because this environment has no usable NextAuth credentials. No synthetic
  session, authentication bypass, provider request, or quota/usage write was
  used to manufacture a result.
- **Result:** 7.5E is operationally closed under the explicit gate waiver,
  with the waiver, unrun smoke, and lane statuses preserved. This does not
  certify paid-provider availability or open 7.5F-G, cutover, Phase 8/9.

### 7.5F disposable auth/readiness reconciliation (2026-09-29)

- **Subject for this attempt:** `a3267b539e9169342b12d7a127980b549217fb33` on `main`. Worktree was clean and equal to `origin/main` before the reconciliation edit.
- **Label:** `DISPOSABLE ONLY` for the tests below, and `BLOCKING / INCOMPLETE` for package acceptance. This is not `PRODUCTION-CANDIDATE`.
- **7.5E boundary preserved:** static remains `INCOMPLETE`. Baseline-forward remains `NOT RUN`. The recorded waiver is not a static PASS, baseline-forward PASS, or aggregate gate PASS. No live SQL, migration, DDL, grant, password, or pooler login was performed in this package.
- **Exact-commit parity:**
  - Vercel production deployment `dpl_7Hhs8L9bwwj7cvbrDXFZDJidvgBV` is `READY`, source `git`, ref `main`, commit `a3267b539e9169342b12d7a127980b549217fb33`, message `docs: close out phase 7.5e with gate waiver`. Aliases include `https://www.cvmems.vn`.
  - Oracle container `qltbyt-ai-service-candidate` was inspected read-only at `2026-09-29T01:27:33Z`. Image digest `sha256:3e7b239b69b7feec68174c9c2f89bdd7fe1703125f0a979a2f6e8470abc25d3d`. Label `org.opencontainers.image.revision=5ea42ef24b1decf5638ad009a17509b36d3909ab`. User `65532:65532`, read-only root, host network, listener `127.0.0.1:18081` only. Private probes: `/healthz=200`, `/readyz=200`.
  - `git diff --quiet 5ea42ef24b1decf5638ad009a17509b36d3909ab a3267b53 -- services/ai-service src` is empty. The only non-doc difference is `package.json` `prepare`, which skips Lefthook when `VERCEL=1`. Go image commit parity with `a3267b53` therefore fails even though the Go and `src` trees match.
- **Disposable tests on `a3267b53`, local source, not inside the Oracle image:**
  - `go test -count=1 -timeout 180s ./internal/qltbyt ./internal/composition ./internal/ingress` — all three packages `ok`. The run includes broker token rejection, audit-before-release, unsafe SQL rejection before executor, nil/missing Broker, QueryExecutor and registry, dummy executor `/readyz=503`, and the in-process complete-tuple `/readyz=200` case.
  - Vitest `route.test.ts` (23), `GoBffBrokerCredential.test.ts` (6), `GoBffConfig.test.ts` (9), `GoBffProxy.test.ts` (6), `src/app/api/chat/dark/__tests__/route.test.ts` (3) — 5 files, 47 tests passed. Browser-supplied `CF-Access-Client-Id` and `CF-Access-Client-Secret` do not authorize the broker route without a valid HMAC token (`401`). Fixture Access headers are injected only from server config.
- **Live negative probes, no session and no secret values:**
  - `POST https://www.cvmems.vn/api/internal/ai/broker/v1` without Authorization, with an invalid bearer, and with only browser-copy Access headers: each returned `401` and error code `unauthorized`.
  - `POST https://www.cvmems.vn/api/chat/dark` without a session, including browser-copy Access headers: `401` `unauthorized`.
  - `https://ai-service.cdclims.cloud/v1/chat` with browser-copy Access headers, and unauthenticated `/healthz` and `/readyz` on that hostname: each returned `403`. These public probes did not reach a ready chat or health response. The Phase 7 observation that public `/healthz` and `/readyz` returned `404` is historical; this run observed `403`.
- **Not run, and not manufactured:**
  - Positive trusted Access acceptance. Production names `AI_SERVICE_BFF_URL`, `AI_SERVICE_BFF_HMAC_KEY_ID`, `AI_SERVICE_BFF_HMAC_SECRET`, `AI_SERVICE_BFF_BROKER_SECRET`, `AI_SERVICE_BFF_CF_ACCESS_CLIENT_ID` and `AI_SERVICE_BFF_CF_ACCESS_CLIENT_SECRET` are present as encrypted Production variables. Their values were not read, copied, or sent. Device Quota Access variables were not reused. No NextAuth session was available.
  - Positive live broker token and any RPC, quota, audit, or provider call.
  - External-pooler negative tuple cases on this commit. Missing Broker, QueryExecutor, registry, and unsafe SQL were proven by local disposable tests. They were not repeated by changing the running candidate. The private `/readyz=200` belongs to image revision `5ea42ef`, not to git commit `a3267b53`.
- **Historical reconciliation with `7.5A`–`E`:** `7.5A` remains `READY FOR REVIEW`, not PASS. `7.5B` and `7.5C` remain `DISPOSABLE ONLY`. `7.5D` has a later disposable Oracle catalog result on `848073b5` plus an uncommitted fix; the matrix no longer says that result is absent, and it still does not certify `a3267b53` or production. `7.5E` remains accepted only with the waiver above. At this pre-rerun checkpoint, exact-subject image parity and the real tuple were still pending.
- **Historical checkbox result:** `7.5F.3` is checked because this reconciliation is the direct evidence. `7.5F.1` and `7.5F.2` were left open at that point. The exact-subject rerun below supersedes only the disposable image/token/tuple findings; `7.5G`, Phase 8 `/api/chat` cutover, Phase 9 cleanup, and paid-provider smoke stay unopened.
- **Status:** `BLOCKING / INCOMPLETE`.

### 7.5F exact-subject candidate rerun (2026-09-29)

- **Subject and build:** the source worktree was detached at
  `a3267b539e9169342b12d7a127980b549217fb33` and the pinned service Dockerfile
  was built natively on the Oracle `arm64` host with `TARGETARCH=arm64`.
  Docker reports repository digest/image ID
  `sha256:c19c97cdad7fcd4415ad2fe69c19f1ab6d0a4bc239c2d455e320a263face56fc`,
  `org.opencontainers.image.revision` equal to the subject, and
  `arm64/linux`. The previous `5ea42ef` image was not used for this run.
- **Candidate runtime:** only the disposable
  `qltbyt-ai-service-candidate` container was recreated. The temporary
  Compose override attached the four existing root-owned secret files and
  supplied the configured HMAC key ID, provider chain, BFF URL and external
  pooler URL through variable references; no secret value was printed or
  persisted in the repository. The container is `running/healthy`, user
  `65532:65532`, and the image ID matches the digest above.
- **Exact-subject private probes:** after the replay quarantine,
  `docker exec ... /busybox wget` returned `/healthz={"status":"ok"}` and
  `/readyz={"status":"ok"}` on `127.0.0.1:18081`. The `200` readiness result
  exercises the configured Broker + external-pooler QueryExecutor + registered
  `qltbyt/assistant-chat/v1` tuple. No SQL write, migration, grant or live
  configuration change occurred.
- **Positive disposable broker token:** a short-lived token was minted in
  protected process memory from the candidate's mounted broker-secret file,
  and the request was signed with the mounted HMAC file. A clarification-only
  request carrying all routing tools returned an SSE `200` stream with
  `start`, clarification text, `finish(stop)` and `[DONE]`; this proves the
  exact candidate accepted the broker credential without invoking a provider.
  Token, signature, request body and key values were not recorded.
- An earlier exploratory request with an empty tool set returned `start` then
  `cancelled` and is not acceptance evidence. No successful provider result or
  quota/usage write was observed; no further provider request was made.
- **Trusted Access boundary:** browser-copy Access headers remain negative
  evidence only. The required positive Cloudflare Access request through the
  production BFF was not run because `/api/chat/dark` requires a real NextAuth
  session and no session credential was available. No Access secret was
  recovered, forged or bypassed. `7.5F.1` therefore remains open; this
  candidate evidence is `DISPOSABLE ONLY` and does not certify production.
- **Scope/status:** this rerun updates exact-subject disposable image, broker
  token and tuple evidence only. The DB waiver remains
  `static=INCOMPLETE`, `baseline-forward=NOT RUN`; `7.5G`, cutover, Phase 8/9
  and paid-provider smoke remain unopened. Overall Phase 7.5 is still
  `BLOCKING / INCOMPLETE`.

### 7.5F.1 trusted Access attempt (2026-09-29)

- **Credential handling:** the user-provided frontend credential was read once
  from a mode-`0600` temporary handle in process memory and the handle was
  deleted in `finally` before the request flow completed. No username,
  password, CSRF value, cookie or session token was printed, persisted or
  committed.
- **NextAuth session:** production CSRF and credentials callback completed with
  HTTP `200`; a subsequent session read returned an authenticated user with an
  allowed `to_qltb` role and facility scope. This was one login attempt only;
  no retry or alternate credential was used.
- **Production BFF acceptance:** a clarification-only payload with the full
  routing tool set was sent once to `POST https://www.cvmems.vn/api/chat/dark`.
  The response was HTTP `403`, JSON `unauthorized`, with no SSE stream. No
  provider, RPC, quota or usage evidence was observed. This does not prove
  trusted Access acceptance; it is a production-BFF blocker after session
  establishment.
- **Boundary:** no Access secret was recovered or logged, no browser header was
  forged, and no authentication bypass or live DB write was used. Do not tick
  `7.5F.1`; the trusted positive Cloudflare Access lane remains
  `BLOCKING / INCOMPLETE` until the production BFF accepts the authenticated
  request and returns the clarification SSE response.

### 7.5F.1 403 layer attribution (read-only follow-up, 2026-09-29)

- **Recorded request result:** the single trusted-login script reached its
  `bff` stage after CSRF/callback/session checks. Its redacted result was
  `loginStatus=200`, `sessionStatus=200`, role `to_qltb`, `hasFacility=true`,
  then `status=403`, `contentType=application/json; charset=utf-8`,
  `clarificationMarker=false`, `finishStop=false`, `unauthorized=true` and
  `unavailable=false`. The script did not retain the response body, headers or
  request ID. The role is in the route's allowlist, and the script's `bff`
  stage is after its session/facility gate, so the route's local role 403 is
  ruled out for this attempt.
- **Application boundary:** the dark route's only local 403 before the fetch is
  the role guard (`isAllowedDarkChatRole`). Once it passes, `GoBffProxy` sends
  the signed request and server-only Cloudflare Access headers. Any upstream
  403, including a non-JSON Access denial, is normalized by the proxy to JSON
  `unauthorized` with HTTP 403. For this exact clarification payload, the Go
  runner authenticates the broker credential before `Prepare`; invalid HMAC or
  credential claims are HTTP 401, while the repair-plus-quota text is routed to
  `MixedClarification` and emitted as SSE before any tool/provider work. The
  Go origin therefore cannot account for this 403; the response was returned
  by the Cloudflare Access edge in the upstream fetch.
- **Oracle read-only correlation:** the active `qltbyt-ai-cloudflared-new`
  configuration logged route version 2 as hostname `ai-service.cdclims.cloud`,
  path `^/v1/chat$`, origin `http://127.0.0.1:18081`; its logs and the
  candidate container logs had no records during `2026-09-29T04:30:00Z`–
  `04:45:00Z`. Earlier unauthenticated probes to that hostname returned a
  non-JSON HTTP `403`, which is consistent with an Access-edge denial but is
  not the authenticated request itself.
- **Conclusion and missing condition:** the missing condition is successful
  Cloudflare Access service-token acceptance for the exact production BFF
  endpoint and `/v1/chat` policy. The available evidence cannot narrow that to
  a client-ID/secret mismatch, hostname/policy mismatch or Access policy
  revision because the response headers/body and Access request logs were not
  retained. No Access policy, secret, deployment, retry or runtime
  configuration was changed; `7.5F.1` remains `BLOCKING / INCOMPLETE`.

### 7.5F.1 access parity check (read-only, 2026-09-29)

- **Vercel metadata:** CLI `52.0.0` returned all six required production names
  (`AI_SERVICE_BFF_URL`, HMAC key ID/secret, broker secret and Access client
  ID/secret). Each targets `Production`; URL/key-ID metadata is `encrypted` and
  the four secret-bearing entries are `sensitive`. Creation/update metadata is
  `2026-09-28T23:30:19Z`–`23:36:56Z`. Values were not pulled, printed or
  compared, and no Vercel write or redeploy was performed during this check.
  The prior request deployment was `dpl_7Hhs8L9bwwj7cvbrDXFZDJidvgBV` (source
  `a3267b53`, `01:13:28Z`); the current alias is `dpl_8fUnWhGebwVxtEZLaSDJ6BPiQRQa`
  (source `20ac0f26`, `05:08:56Z`). Vercel logs returned no records for the
  prior request window and no dark-chat record in the current deployment.
- **Hostname boundary:** the `AI_SERVICE_BFF_URL` value itself remains unread,
  so Vercel-to-Tunnel hostname equality is not certified. The independent Oracle
  route and DNS lookup identify the intended hostname as
  `ai-service.cdclims.cloud` (DNS `104.21.12.188`); no request was sent to
  authenticate or smoke the provider.
- **Oracle route/config:** `/etc/cloudflared/ai-service/config.yml` is valid and
  maps `ai-service.cdclims.cloud` plus `^/v1/chat$` to
  `http://127.0.0.1:18081` (SHA-256
  `ad9d7ce53e4bc063440c689a940ed6ca3a81607afb95f9a93b832f7c4da6f783`). That
  file is not mounted into the active `qltbyt-ai-cloudflared-new` container,
  which runs a host-network `tunnel run --token` command. Its retained startup
  traffic shows the older remote origin `http://127.0.0.1:8080` only; no
  entries exist in the 04:30–05:20 UTC request window. The disposable candidate
  is instead bridge-networked at `10.0.7.2`, listens on container-local
  `127.0.0.1:18081`, and has no host port mapping; host port 8080 belongs to
  `coolify-proxy`. Therefore the candidate cannot be reached by the active
  host-network tunnel in this state. This is a concrete Oracle activation/config
  mismatch, not evidence of a live production provider call.
- **Cloudflare Access evidence:** no Cloudflare API/dashboard client, API token
  environment, Access application ID, policy revision, request-event export or
  Access log is available in this workspace. The repository policy only states
  the required hostname/path and service-token boundary; it does not prove the
  deployed client-ID/secret pair or policy revision. Maintainer inspection must
  match the Access application for `ai-service.cdclims.cloud`, path `/v1/chat`,
  service-token policy and the `2026-09-29T04:39Z` request before 7.5F.1 can
  close.
- **Boundary:** no secret/token value was read or recorded, no authentication
  retry or bypass was attempted, no provider smoke was run, and no live DB
  operation occurred. `7.5F.1` and overall Phase 7.5 remain
  `BLOCKING / INCOMPLETE`.

### 7.5F.1 candidate-only network experiment and rollback (2026-09-29)

- **Scope:** the coordinator temporarily recreated only the disposable
  `qltbyt-ai-service-candidate` with host networking to test the tunnel-facing
  topology, then rolled it back to the prior bridge-network Compose setup. The
  production BFF, Cloudflare policy/tunnel, Vercel variables and DQSS were not
  changed; no secret value, provider request or live DB operation was used.
- **Host-network trial:** private `/healthz` returned `200`, but `/readyz`
  returned `503`. This was a failed disposable readiness observation, not a
  route or Access fix. The candidate was reverted after the failed check.
- **Immediate rollback read-back:** the exact ARM64 image
  `sha256:c19c97cdad7fcd4415ad2fe69c19f1ab6d0a4bc239c2d455e320a263face56fc`
  was restored in bridge network `qltbyt-ai_default`; the container health
  indicator and private `/healthz` were `OK`, while the coordinator's immediate
  `/readyz` read-back remained `503` and the service emitted no application log
  lines. DQSS remained healthy with restart count `0`.
- **Later read-only state:** a subsequent check at `2026-09-29T07:30:27Z`,
  after the startup/quarantine window, returned `200` for both candidate
  `/healthz` and `/readyz`; the candidate stayed bridge-networked and DQSS
  stayed healthy with restart count `0`. This later recovery does not prove
  tunnel reachability, Access acceptance or production readiness, and does not
  reopen `7.5F.1`.
- **Boundary:** the active token-run cloudflared container and its remote
  configuration were not changed. The experiment therefore leaves the prior
  host/bridge route mismatch and the Cloudflare Access evidence gap unresolved;
  overall Phase 7.5 remains `BLOCKING / INCOMPLETE`.

### 7.5E/7.5F read-only pooler/catalog correlation (latest probe, 2026-09-29)

- **Pooler authentication:** a read-only transaction-pooler connection as
  `ai_query_tool` succeeded. On that connection, both
  `transaction_read_only` and `default_transaction_read_only` were `on`.
  The probe did not print or persist the pooler URL, password or any other
  credential value.
- **Approved catalog:** the five approved relations in `ai_readonly` —
  `equipment_search`, `maintenance_facts`, `repair_facts`, `usage_facts` and
  `quota_facts` — were confirmed as ordinary views (`relkind = 'v'`). The
  login had effective schema `USAGE` and `SELECT` on all five views. This is
  effective role/grant evidence through the pooler; it is not a provider smoke
  result and does not certify the application path.
- **Runtime correlation:** at the immediate candidate recreate checkpoint,
  private `/readyz` remained `503` after the host/bridge experiments while
  DQSS stayed `health=200`, `healthy`, restart count `0`. A later delayed
  read-only check after the startup/quarantine window returned candidate
  `/readyz=200` (recorded above); neither observation proves Tunnel reachability,
  Access acceptance or provider availability.
- **Interpretation/boundary:** the pooler login and catalog grants pass this
  read-only check, but the candidate readiness failure remains a separate
  blocker. No provider root cause is assigned from this evidence. No SQL write,
  migration, role/password change, runtime activation, authentication retry or
  live DB mutation occurred; 7.5E remains waived/incomplete and overall Phase
  7.5 remains `BLOCKING / INCOMPLETE`.

### 7.5F candidate host-network topology trial (2026-09-29 12:51–12:55 UTC)

- **Authorized disposable scope:** only `qltbyt-ai-service-candidate` was
  recreated with the exact ARM64 image digest
  `sha256:c19c97cdad7fcd4415ad2fe69c19f1ab6d0a4bc239c2d455e320a263face56fc`
  (OCI revision `a3267b539e9169342b12d7a127980b549217fb33`),
  `network_mode=host`, and `AI_SERVICE_LISTEN_ADDR=127.0.0.1:18081`.
  Compose used `--no-deps --force-recreate` for that service only. The
  cloudflared connector, DQSS, Coolify, DNS, Access policy, Vercel settings and
  database were not restarted or changed.
- **Host-network result:** after recreation at `12:51:16Z`, the first probe was
  during startup (`000/000`); from `12:51:26Z` through `12:53:18Z`, twelve
  consecutive probes returned candidate `/healthz=200` and `/readyz=503`.
  The container stayed healthy with restart count `0`. DQSS returned HTTP `200`,
  remained `healthy`, and stayed at restart count `0` on every probe. The
  readiness wait was therefore long enough to reject this topology trial.
- **Rollback:** the candidate was recreated at `12:53:49Z` with the prior bridge
  network `qltbyt-ai_default`, retaining the same image/listener. After startup,
  `/healthz=200` and `/readyz=503` were observed on seven consecutive successful
  probes through `12:55:02Z`; the candidate was healthy with restart count `0`.
  The final read-back at `12:55:19Z` showed cloudflared start time unchanged at
  `2026-09-27T07:11:21Z`, DQSS and Coolify healthy with restart count `0`, and
  zero candidate application log lines. No route fix was claimed.
- **Boundary:** because host-network readiness failed, no restored BFF trusted
  lane or clarification-only production request was attempted after this trial,
  and no paid-provider smoke ran. The result does not identify a provider root
  cause; it leaves candidate readiness, Tunnel reachability and trusted Access
  acceptance unresolved. Overall Phase 7.5 remains `BLOCKING / INCOMPLETE`.

### 7.5F candidate provider initialization diagnostic (2026-09-29)

- **Subject/image:** `a3267b539e9169342b12d7a127980b549217fb33`, digest
  `sha256:c19c97cdad7fcd4415ad2fe69c19f1ab6d0a4bc239c2d455e320a263face56fc`.
- **Diagnostic:** a disposable ARM64 test binary copied into the candidate ran
  `loadRuntimeConfig`, `provider.Open` for both configured chain entries and
  `provider.NewChain` without inference calls, database calls or secret output.
  Redacted output was `runtime_config=ok chain_config=ok`,
  `adapter_index=0 open=ok`, `adapter_index=1 open=ok`,
  `chain_open=ok inference_calls=0`.
- **Stability:** nine probes from 13:22:26Z through 13:24:28Z returned
  `/healthz=200` and `/readyz=200`. DQSS stayed `healthy`, restart `0` on every
  probe. Candidate restart count remained `0` and image digest matched.
- **Finding:** provider adapter initialization/configuration is not failing on
  the current candidate. Earlier `503` observations are consistent with the
  documented restart quarantine/readiness window; no provider, credential,
  tunnel, DNS, Vercel, Access or live-DB change was made.
- **Status:** disposable readiness evidence is now stable, but trusted Access
  positive acceptance remains uncertified. Keep `7.5F.1` and `7.5F.2` open and
  do not open 7.5G.

### 7.5F candidate origin alignment and Access boundary (2026-09-29)

- **Subject/image:** `a3267b539e9169342b12d7a127980b549217fb33`, digest
  `sha256:c19c97cdad7fcd4415ad2fe69c19f1ab6d0a4bc239c2d455e320a263face56fc`.
- **Finding and disposable change:** host port `8080` was occupied by the
  unused `coolify-proxy` Traefik container. Its host listener was stopped after
  read-only inspection; no DQSS, cloudflared, DNS, Access, Vercel or live DB
  change was made. The candidate was then recreated only in disposable scope
  with host networking and `AI_SERVICE_LISTEN_ADDR=127.0.0.1:8080`, matching the
  active tunnel origin recorded in the prior trial logs.
- **Readiness:** after the restart quarantine, private probes returned
  `/healthz=200` and `/readyz=200`; candidate restart count was `0`. DQSS stayed
  `healthy` with restart `0`. Web Push remained `running` (its historical
  restart count stayed `1`).
- **Tunnel probe:** a clarification-shaped unauthenticated `POST /v1/chat`
  still returned `HTTP 403` Cloudflare Access HTML. No candidate request was
  observed, so this probe does not certify origin delivery or trusted Access
  acceptance.
- **Status:** candidate-to-origin topology is corrected in disposable scope;
  the remaining 7.5F blocker is trusted Access acceptance. Keep `7.5F.1` and
  `7.5F.2` open; do not open 7.5G.

### 7.5F redacted provider-initialization diagnostic (2026-09-30)

- The candidate startup path now classifies `ChainConfigFromEnv` failures as
  `provider.configuration.chain`, `.model`, or `.credentials`, and classifies
  adapter-open failures as `provider.initialization.<provider>.<model>.<class>`.
  Only fixed classifications and sanitized provider/model labels are retained;
  wrapped SDK errors, secrets, URLs, and payloads are excluded from logs and
  the HTTP protocol.
- TDD evidence: provider diagnostic tests failed before the new symbols and
  classifications existed, then passed after implementation. Fresh focused and
  full checks passed with `cd services/ai-service && go test ./... -count=1`;
  `gofmt` and `git diff --check` are clean.
- This is instrumentation evidence only. The exact ARM64 candidate image has
  not been rebuilt or rerun from this patch yet, so no provider, credential, or
  adapter root cause is claimed. No provider request, DQSS restart, tunnel,
  DNS, Access, Vercel, or live DB change occurred. Keep `7.5F.1`/`7.5F.2`
  open and do not open 7.5G.

### 7.5F production-BFF Access probe and cookie gate (2026-09-30)

- **Label:** `DISPOSABLE ONLY`. Overall Phase 7.5 remains
  `BLOCKING / INCOMPLETE`. This checkpoint is not `PRODUCTION-CANDIDATE`.
- **Worktree:** `main` at `4b49a3b735ac618d92b7628d4867d176acc7b813`. The
  Access-cookie allowlist is an uncommitted ingress change. Diagnostic log
  lines were removed from that worktree after the successful probe, so the
  serving binary and the worktree are different subjects.
- **Probed candidate:** at the SSE `200`, `qltbyt-ai-service-candidate` was
  tag `qltbyt-ai-service:diag-75f-cookie`, manifest list
  `sha256:2f912b65f8226b546e0476b33c55e29f5216437a5f40cfbd739f62f796924d61`.
  Host network, listener `127.0.0.1:18081`, user `65532:65532`, read-only
  root. Its 20 environment values and 4 read-only mounts were copied from the
  previous candidate. Read-back at probe time: Docker `healthy`, restart `0`,
  `/healthz=200`, `/readyz=200`. The later swap section names the current
  serving image.
- **Stopped rollback containers at probe time:**
  `qltbyt-ai-service-candidate-prev` held image
  `sha256:c868ec93f1b529067140db3ad99300a1b0e0eff9115ced22424ae288f5b147ab`.
  `qltbyt-ai-service-candidate-diag` held tag `qltbyt-ai-service:diag-75f`.
  Both were removed after the cleaned image became healthy.
- **Clean image at probe time:** `qltbyt-ai-service:75f1-cookie`, manifest
  list
  `sha256:5b984f8fb0e2a7f782a0c2caf45110d12ab6eab957738080ae3d417de6bc9432`.
  The binary keeps the `cf_authorization` / `cf_appsession` allowlist and
  contains no `auth diagnostic=` strings. It had not replaced the probed
  candidate when these probe results were recorded. The swap section below is
  the later serving state.
- **Untouched runtime:** `dqss-issue-508` stayed `healthy` with restart `0`.
  `qltbyt-ai-cloudflared-new` stayed running with restart `0`. No DNS, tunnel
  route, Access policy, Vercel Production variable, secret file, or live DB
  change was made. Secrets were not rotated.
- **401 classification:** `probe-75f-1790753479879` and
  `probe-75f-1790755749509` returned HTTP `401` JSON `unauthorized` from
  `POST /api/chat/dark`. The Vercel warning for the second probe was
  `[ai-bff] upstream failure` with `contentType=application/json`,
  `cfRay=a431be719fb858bf-NRT`, and `class=go_protocol_json`. The candidate
  serving at that time emitted no HMAC diagnostic. Any `Cookie` header was
  rejected before HMAC. The BFF constructs its own headers and does not
  forward the browser cookie. Cloudflare Access adds `CF_Authorization` and
  `CF_AppSession` to the authenticated origin request.
- **Allowlist under test:** only those two names, compared case-insensitively,
  are removed before HMAC. A browser session cookie or a malformed cookie
  header still returns HTTP `401` and does not open a model session. After the
  log cleanup, `go test ./internal/ingress/ ./internal/qltbyt/ -count=1`
  passed. `TestCredentialRejectionsHappenBeforeExecutor` still rejects a
  browser-cookie broker token before the executor. Those tests belong to the
  cleaned worktree, not to the serving image.
- **Positive probe:** `probe-75f-1790757941136` at `2026-09-30T08:45:42.578Z`,
  from a facility-scoped session, `POST /api/chat/dark`. The browser result was
  HTTP `200`, `content-type=text/event-stream`, `finishReason=stop`, and
  `[DONE]`. The stream asks the user to choose repairs, quota, or equipment
  lookup. It contains no tool event. The serving candidate logged only
  `auth.access_cookie` for that request id.
- **Negative probes (same probed image, `2026-09-30T09:00:54Z`):** none
  returned `200` or `text/event-stream`. Sentinel values did not appear in
  response bodies.
  - `neg-75f1-broker`: valid HMAC and a rejected broker token. HTTP `401`
    `application/json` code `unauthorized`. Log only `auth.credential`.
  - `neg-75f1-access-cookie`: `CF_Authorization` and `CF_AppSession` without
    HMAC. HTTP `401` JSON `unauthorized`. Logs `auth.access_cookie`, then
    `auth.hmac`.
  - `neg-75f1-session-cookie`: a session cookie. HTTP `401`. Log `auth.cookie`
    with `cookie_names=session`, before HMAC.
  - `neg-75f1-access-header`: browser-supplied Access client headers without
    HMAC. HTTP `401`. Log `auth.hmac`.
  - Public `POST https://ai-service.cdclims.cloud/v1/chat` with only an Access
    cookie: HTTP `403` `text/html`, not an event stream.
- **Post-probe read-back:** that container stayed
  `qltbyt-ai-service:diag-75f-cookie`, `running`, `healthy`, restart `0`,
  `/healthz=200`, `/readyz=200`. DQSS stayed `healthy` with restart `0`.
- **Checkbox result:** `7.5F.1` is checked at `DISPOSABLE ONLY` for manifest
  list `sha256:2f912b65f8226b546e0476b33c55e29f5216437a5f40cfbd739f62f796924d61`.
  The positive production-BFF Access SSE and the negative broker-token and
  browser-supplied Access cases were observed on that one image. The image is
  not a committed git subject. The worktree at `4b49a3b7` plus the uncommitted
  cleaned ingress does not contain the diagnostic logs that this probed binary
  still has. `7.5F.2` is unchanged and remains the 2026-09-29 disposable tuple
  evidence for subject `a3267b53`. `7.5G`, `/api/chat` cutover, Phase 8/9, and
  paid-provider smoke stay unopened. No second model probe was sent.

### 7.5F cleaned image swap (2026-09-30)

- **Label:** operational cleanup after the `7.5F.1` tick. This swap does not
  move the `7.5F.1` subject onto the new digest and does not open `7.5G`.
- **Serving container:** `qltbyt-ai-service-candidate` now runs
  `qltbyt-ai-service:75f1-cookie`, manifest list
  `sha256:5b984f8fb0e2a7f782a0c2caf45110d12ab6eab957738080ae3d417de6bc9432`.
  The binary has the `cf_authorization` / `cf_appsession` allowlist once each
  and has zero `auth diagnostic=` strings. Private probes returned
  `/healthz=200` and `/readyz=200`; Docker health is `healthy`; restart count
  is `0`. Runtime comparison matched 20 environment values and 4 read-only
  mounts with the previous container. User, host network, read-only root,
  restart policy, memory, CPU, pids, capabilities, tmpfs, ulimits, and init
  were copied. An unsigned `POST /v1/chat` on loopback returned HTTP `401`
  and was not `text/event-stream`.
- **Removed after the clean container was healthy:** stopped containers
  `qltbyt-ai-service-candidate-prev`,
  `qltbyt-ai-service-candidate-diag`, and
  `qltbyt-ai-service-candidate-cookie75f`; tags `qltbyt-ai-service:diag-75f`,
  `qltbyt-ai-service:diag-75f-cookie`,
  `qltbyt-ai-service:current-candidate`,
  `qltbyt/ai-service:phase-7.5f-a0ae98b8-arm64`,
  `qltbyt/ai-service:phase-7.5f-50746976-arm64`, and
  `qltbyt/ai-service:phase-7.5f-a3267b539e-arm64`. No force removal was used.
  Unused build cache of about `3.1GB` was pruned. Root filesystem use moved
  from `51G` to `48G`. The probed digest
  `sha256:2f912b65f8226b546e0476b33c55e29f5216437a5f40cfbd739f62f796924d61`
  and the `7.5F.2` digest
  `sha256:c19c97cdad7fcd4415ad2fe69c19f1ab6d0a4bc239c2d455e320a263face56fc`
  remain the evidence record. The only remaining local AI service image is
  `qltbyt-ai-service:75f1-cookie`.
- **Untouched:** DQSS stayed `healthy` with restart `0`. Cloudflared stayed
  `running` with restart `0`. No DNS, tunnel route, Access policy, Vercel
  variable, secret, live DB, or production `/api/chat` change was made. No
  second model probe was sent.
