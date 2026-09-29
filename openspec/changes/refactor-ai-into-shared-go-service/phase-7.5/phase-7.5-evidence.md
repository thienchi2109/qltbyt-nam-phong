# Phase 7.5 Evidence — Broker/query composition và readiness

**Status:** `BLOCKING / INCOMPLETE` for overall Phase 7.5. Tasks `7.5E.1`–`7.5E.3`
are accepted. `7.5E.2` is accepted with the recorded waiver: static remains
`INCOMPLETE` and baseline-forward remains `NOT RUN`. `7.5E.3` is accepted on
the live role/grant/config read-back. Pooler connection verification moves to
the next acceptance step, and Oracle credential parity is not required. This
is not a gate PASS, pooler/readiness certification, or acceptance of 7.5F-G.

**Subject commit/config:** `TBD` (every package must bind evidence to one
exact subject commit and configuration hash before it can be accepted).

**Latest candidate checkpoint (2026-09-28):** the authorized Oracle candidate
upgrade uses exact source `5ea42ef24b1decf5638ad009a17509b36d3909ab`.
Pooler login and catalog privilege read-back from Oracle pass. See the final
candidate deployment entry for the runtime result and BFF smoke blocker.
This does not reopen accepted 7.5E tasks or convert waived DB lanes to PASS.

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

| Package                      | Owner / dispatch boundary          | Required evidence                                                                                                                                                                                          | Status / blocker                                                                                                                                                                                     |
| ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `7.5A` Contract/ADR          | Architecture/spec owner; docs only | [Contract/ADR](phase-7.5a-contract.md): route, per-RPC schemas, scope/telemetry derivation, operation mapping, byte/row/field caps, allowlist, token TTL/claims, trusted credential source, negative cases | **READY FOR REVIEW** — docs recorded; exact landed subject commit/config binding still pending                                                                                                       |
| `7.5B` BFF broker endpoint   | Next.js/BFF owner                  | Server-only credential source, token mint/verify, scope/allowlist, cancellation, redaction and route tests                                                                                                 | **DISPOSABLE ONLY** — focused worktree tests pass; landed/Go/Access acceptance remains pending                                                                                                       |
| `7.5C` Go broker/capability  | Go runtime owner                   | Internal Broker composition, trusted token propagation, audit/quota calls, registry `qltbyt/assistant-chat/v1`                                                                                             | **DISPOSABLE ONLY** — local composition/transport/readiness evidence passes; landed and downstream acceptance remain pending                                                                         |
| `7.5D` QueryExecutor/pooler  | Go query/runtime owner             | External-pooler `AI_DATABASE_URL`, existing approved/disposable read-only executor, parser/catalog/scope/limits, readiness negative cases                                                                  | **BLOCKING / INCOMPLETE** — local Go contract proof passes; no disposable PostgreSQL role/connection evidence; production role/read-back is `7.5E`                                                   |
| `7.5E` SQL gate              | Database quality-gate owner        | Static and baseline-forward lanes (separate), role/grant/pooler/catalog read-back                                                                                                                          | **ACCEPTED WITH WAIVER** — `7.5E.1`–`7.5E.3` ticked; static `INCOMPLETE`; baseline-forward `NOT RUN`; live role/grant/config read-back accepted; pooler connection moves to the next acceptance step |
| `7.5F` Disposable acceptance | Integration acceptance owner       | Positive/negative token and Access tests, real-tuple readiness checks, redacted matrix labeled `DISPOSABLE ONLY`                                                                                           | **NOT RUN** — cannot certify production                                                                                                                                                              |
| `7.5G` Oracle activation     | Oracle/runtime operations owner    | Exact image/config hashes, private Tunnel/Access, trusted BFF lane, local health/readiness, redacted smoke and drain/rollback                                                                              | **NOT RUN** — requires `7.5A–F` and operation-specific authorization                                                                                                                                 |

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
  verification is the next acceptance step. Overall Phase 7.5 stays
  `BLOCKING / INCOMPLETE` until `7.5F`–`G`.
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
