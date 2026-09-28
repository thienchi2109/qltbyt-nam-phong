# Phase 7.5 Evidence — Broker/query composition và readiness

**Status:** `BLOCKING / INCOMPLETE` — 7.5C has local disposable-only Go
composition, transport and fail-closed readiness evidence. SQL quality-gate
lanes, real-tuple disposable acceptance and Oracle activation remain unrun.

**Subject commit/config:** `TBD` (every package must bind evidence to one
exact subject commit and configuration hash before it can be accepted).

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

| Package                      | Owner / dispatch boundary          | Required evidence                                                                                                                                                                                          | Status / blocker                                                                                                                                   |
| ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `7.5A` Contract/ADR          | Architecture/spec owner; docs only | [Contract/ADR](phase-7.5a-contract.md): route, per-RPC schemas, scope/telemetry derivation, operation mapping, byte/row/field caps, allowlist, token TTL/claims, trusted credential source, negative cases | **READY FOR REVIEW** — docs recorded; exact landed subject commit/config binding still pending                                                     |
| `7.5B` BFF broker endpoint   | Next.js/BFF owner                  | Server-only credential source, token mint/verify, scope/allowlist, cancellation, redaction and route tests                                                                                                 | **DISPOSABLE ONLY** — focused worktree tests pass; landed/Go/Access acceptance remains pending                                                     |
| `7.5C` Go broker/capability  | Go runtime owner                   | Internal Broker composition, trusted token propagation, audit/quota calls, registry `qltbyt/assistant-chat/v1`                                                                                             | **DISPOSABLE ONLY** — local composition/transport/readiness evidence passes; landed and downstream acceptance remain pending                       |
| `7.5D` QueryExecutor/pooler  | Go query/runtime owner             | External-pooler `AI_DATABASE_URL`, existing approved/disposable read-only executor, parser/catalog/scope/limits, readiness negative cases                                                                  | **BLOCKING / INCOMPLETE** — local Go contract proof passes; no disposable PostgreSQL role/connection evidence; production role/read-back is `7.5E` |
| `7.5E` SQL gate              | Database quality-gate owner        | Static and baseline-forward lanes (separate), role/grant/pooler/catalog read-back                                                                                                                          | **NOT RUN** — no live apply authorized; unavailable lane is blocking                                                                               |
| `7.5F` Disposable acceptance | Integration acceptance owner       | Positive/negative token and Access tests, real-tuple readiness checks, redacted matrix labeled `DISPOSABLE ONLY`                                                                                           | **NOT RUN** — cannot certify production                                                                                                            |
| `7.5G` Oracle activation     | Oracle/runtime operations owner    | Exact image/config hashes, private Tunnel/Access, trusted BFF lane, local health/readiness, redacted smoke and drain/rollback                                                                              | **NOT RUN** — requires `7.5A–F` and operation-specific authorization                                                                               |

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
- No SQL role/grant/password provisioning or catalog read-back has been run.
  `7.5E` must report static and baseline-forward separately; missing required
  lane evidence is `BLOCKING / INCOMPLETE`.
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

- **Post-review verification (2026-09-28):** primary agent independently reran `go test -count=1 ./...` and `go vet ./...` in `services/ai-service`; both PASS, and `gofmt -l cmd internal` returned no files. This verifies the current uncommitted worktree, not a landed commit or real database.
- **Review fixes:** regression coverage now rejects advisory-lock function calls and URL query overrides of connection fields. Only `sslmode` is accepted as a URL query key. The SQL function allowlist currently permits only `coalesce`; this deliberately narrow surface is not evidence of general PostgreSQL function compatibility. Startup diagnostics emit bounded stage/cause categories while public errors stay generic.
- **Remaining verification:** no disposable Oracle database/pooler integration has run. Earlier read-only inspection found no `ai_query_tool` role or `ai_readonly` schema in the Oracle baseline; live state has not been checked. The legacy `docs/ai/assistant-sql-foundation-runbook.md` already specifies this role and connection contract. Both SQL quality-gate lanes are reported broken by the maintainer and are not counted as PASS. Approved-catalog privilege/readiness behavior still requires resolution and real integration evidence. Overall status remains `BLOCKING / INCOMPLETE`.

- **Subject:** worktree based on `8bfa83bb0428459eb85ca75b134e2cc9a0ca9a27`; the 7.5D changes are uncommitted and are not an exact-landed-commit certification.
- **Owner/prerequisite:** Go query/runtime owner; 7.5A contract and 7.5C composition are the prerequisites. No SQL role provisioning, migration, live write, deployment, `/api/chat` cutover or paid-provider smoke was performed.
- **Implementation:** `AI_DATABASE_URL` is required and validated against the documented transaction-pooler shape (`postgresql`, `:6543`, `/postgres`, TLS `require`/`verify-*`, passworded `ai_query_tool` or pooler-qualified username). `internal/qltbyt/pooler.go` opens pgx in simple-protocol mode, bounds the pool, and closes it on shutdown. The existing `SQLExecutor` now exposes a read-only readiness probe that requires connected `ai_query_tool`, transaction `read_only=on`, and role `default_transaction_read_only=on`; query execution continues to apply the existing parser/schema allowlist, scope settings, five-second timeout, row/payload caps and read-only transaction.
- **Composition:** `cmd/ai-service/main.go` passes the concrete pooler executor through `internal/composition`, registers the capability only with the Broker + SQL executor + secret tuple, and probes the SQL executor before `/readyz=200`. Missing URL, invalid URL, unavailable connection, wrong role, writable connection, dummy executor, registry-only or partial tuples remain `/readyz=503`.
- **Focused evidence:** `go test ./internal/qltbyt ./internal/composition ./cmd/ai-service -run 'TestPooler|TestSQLExecutorReady|TestQueryExecutorReadiness|TestLoadRuntimeConfig|TestRuntimeHandler|TestRegisterAssistantWithEndpoint|TestRegisterQLTBYT' -count=1` — PASS (37 tests); `go test ./...` — PASS (331 tests); `go vet ./...` and `git diff --check` are required before landing.
- **Test boundary:** SQL executor readiness tests use an in-memory `database/sql` driver to exercise cancellation, connection failure, role/read-only checks and limits. No disposable PostgreSQL/pooler, approved `ai_query_tool` role, catalog read-back, static SQL gate or baseline-forward lane was available, so these tests are local contract evidence only and do not certify an external connection or production role.
- **Redaction review:** URL and driver errors are normalized and never include passwords, SQL, rows or upstream messages; `AI_DATABASE_URL` is removed from provider environment forwarding. Query results and SQL remain behind the existing bounded public error/audit path.
- **Status:** `BLOCKING / INCOMPLETE` — local composition and fail-closed behavior pass, but no disposable database or 7.5E role/grant/read-back evidence exists. The DB quality-gate static/baseline-forward state is not used to claim PASS.
- **Next-package boundary:** 7.5E must separately provide role/grant/catalog read-back and report static plus baseline-forward lanes; 7.5F may then run disposable end-to-end readiness. This report does not authorize live SQL, Oracle activation, deployment, cutover, Phase 9 cleanup or paid-provider smoke.
