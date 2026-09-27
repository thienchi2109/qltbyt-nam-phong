# Phase 7.5 Evidence — Broker/query composition và readiness

**Status:** `BLOCKING / INCOMPLETE` — this artifact records the approved
contract and dispatch boundaries. Runtime packages, SQL quality-gate lanes,
disposable acceptance and Oracle activation have not been run by this
documentation update.

**Subject commit/config:** `TBD` (every package must bind evidence to one
exact subject commit and configuration hash before it can be accepted).

Phase 7.5 sits between Phase 7 dark smoke and Phase 8 exact-commit acceptance.
It is an orchestration gate with seven independently dispatchable packages;
completing one package does not tick or authorize another package.

## Approved contract

- `7.5A` chooses and records the concrete application-owned BFF broker route,
  schemas, allowlist, timeout/cancellation, redaction and trusted BFF
  credential source. The route remains symbolic in this proposal until that
  package records it.
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
  are negative evidence.

## Package acceptance matrix

| Package                      | Owner / dispatch boundary          | Required evidence                                                                                                                         | Status / blocker                                                     |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `7.5A` Contract/ADR          | Architecture/spec owner; docs only | Concrete broker route, schemas, allowlist, token TTL/claims, trusted credential source, negative cases                                    | **OPEN** — route and contract ADR still need package-level review    |
| `7.5B` BFF broker endpoint   | Next.js/BFF owner                  | Server-only credential source, token mint/verify, scope/allowlist, cancellation, redaction and route tests                                | **NOT RUN** — depends on `7.5A`                                      |
| `7.5C` Go broker/capability  | Go runtime owner                   | Internal Broker composition, trusted token propagation, audit/quota calls, registry `qltbyt/assistant-chat/v1`                            | **NOT RUN** — depends on `7.5A` and `7.5B` contract                  |
| `7.5D` QueryExecutor/pooler  | Go query/runtime owner             | External-pooler `AI_DATABASE_URL`, existing approved/disposable read-only executor, parser/catalog/scope/limits, readiness negative cases | **NOT RUN** — depends on `7.5C`; production role/read-back is `7.5E` |
| `7.5E` SQL gate              | Database quality-gate owner        | Static and baseline-forward lanes (separate), role/grant/pooler/catalog read-back                                                         | **NOT RUN** — no live apply authorized; unavailable lane is blocking |
| `7.5F` Disposable acceptance | Integration acceptance owner       | Positive/negative token and Access tests, real-tuple readiness checks, redacted matrix labeled `DISPOSABLE ONLY`                          | **NOT RUN** — cannot certify production                              |
| `7.5G` Oracle activation     | Oracle/runtime operations owner    | Exact image/config hashes, private Tunnel/Access, trusted BFF lane, local health/readiness, redacted smoke and drain/rollback             | **NOT RUN** — requires `7.5A–F` and operation-specific authorization |

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

- No concrete BFF broker route/ADR has been accepted yet; this blocks `7.5B`.
- No production Go composition has been certified; existing injected
  `Broker`/`QueryExecutor` interfaces are contract evidence only.
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
