# Phase 0 Evidence

Date: 2026-09-25
Base commit: `241efdf369bac7a59cf7ce15ea4b618597c05b27`
Subject: working tree on `chore/shared-ai-service-phase0`

Status: Phase 0 evidence and review are complete for tasks `0.1`-`0.9`.
Phase 1 and later phases remain unchecked and await explicit user approval.

This artifact records the current `/api/chat` contract and Phase 0 proofs. It
does not change production runtime code, the predecessor checklist, SQL, or
database state.

## Baseline characterization

The current route is `src/app/api/chat/route.ts`:

- `runtime = "nodejs"` and `maxDuration = 60` (`src/app/api/chat/route.ts:47-50`).
- `POST` authenticates the server session and role before JSON/schema validation,
  requested-tool validation and UI-message validation (`route.ts:137-176`).
- Intent routing returns clarification at `route.ts:178-183`, before compaction
  and `reserveUsage` (`route.ts:187-212`), so clarification consumes no quota.
- Scope resolution produces the validated `selectedFacilityId`, which is both
  `usageContext.tenantId` and the tool scope (`route.ts:195-212, :257-266`).
  `selectedFacilityName` is untrusted display/prompt context: it is accepted by
  `src/lib/ai/chat-request-schema.ts:27-28` and rendered by
  `src/lib/ai/prompts/system.ts:48-51`; it is not the quota tenant.
- Tool results are compacted before model execution. The registry and intent
  router retain the current allowlist, query-database separation, facility
  scope checks, and safe blocked-tool errors.
- `streamText` runs the bounded model/tool loop with provider options and a
  step limit (`route.ts:299-306`). Pre-stream provider quota errors rotate the
  Google key pool; an in-flight stream is not retried (`route.ts:323-339,
:393-427`). Finalization is guarded by one reservation promise and uses
  `onFinish`/error callbacks (`route.ts:217-243, :307-328`).
- `createChatUIStreamResponse` proxies the Vercel AI SDK UI stream. Its
  `onAfterBaseStream` callback runs the repair-draft builder and writes the
  synthetic draft tool events before the response is completed
  (`route.ts:353-391`).
- `maybeBuildRepairRequestDraftArtifact` requires an active draft session, one
  resolved equipment record, evidence, and a successful secondary extraction.
  It returns an advisory artifact only; the current writer emits
  `tool-input-available` followed by `tool-output-available`. No submit RPC is
  part of this path.
- Current failure semantics sanitize unexpected client errors. Quota responses
  preserve `error.code = ai_usage_limited`, a reason, a safe message and
  `retryAfterMs`.

The parity fixture is `phase-0/fixtures/ui-tool-parity.json`. It covers text,
mixed tool input/output envelopes, report/chart artifact shape, raw repair-draft
output, sanitized quota error and terminal completion. The repair fixture marks
`draft_only: true` and `submit: false`.

## Provider inventory

The inventory is read-only from `src/lib/ai/config.ts`, `provider.ts` and
`provider-options.ts`:

| Transport           | Current selection and options                                                                                                            | Behavior to preserve or explicitly retire                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gateway`           | Default transport; default model `google/gemini-3.1-flash-lite-preview`; `AI_GATEWAY_API_KEY`; provider-prefixed model IDs               | Gateway is the current default and has no Google key-pool rotation. Google Gemini model IDs receive the current medium thinking configuration.       |
| `google`            | Direct model; `GOOGLE_GENERATIVE_AI_API_KEY` or comma-separated `GOOGLE_GENERATIVE_AI_API_KEYS`; default `gemini-3.1-flash-lite-preview` | In-process round-robin key pool, quota-error rotation, exhausted-key tracking and hourly exhaustion reset (`provider.ts:21-48`, `:129-157`).         |
| `openai-compatible` | `AI_OPENAI_COMPATIBLE_BASE_URL`, `AI_OPENAI_COMPATIBLE_API_KEY`, explicit `AI_DEFAULT_CHAT_MODEL`/`AI_MODEL`                             | One configured endpoint/key; no Google rotation. The local stub proves OpenAI-compatible streaming request/response framing without a paid provider. |

The route uses `getKeyPoolSize()` for the number of pre-stream attempts and
passes the actual `keyIndex` to `handleProviderQuotaError`. Phase 0 review
retains all three paths in compatibility scope; it does not port every branch
or choose Bifrost. The source anchors are `src/lib/ai/config.ts:2,10-12,41-65,
68-119,128-147`, `src/lib/ai/provider.ts:72-116,120-169` and
`src/lib/ai/provider-options.ts:27-38`. Local compatibility coverage is
`phase-0/eino-proof/provider_key_pool_test.go:9-64` (Google rotation/reset) and
`phase-0/eino-proof/provider_stub_test.go:22-307` (Gateway, OpenAI-compatible
and Gemini stubs). Paid provider smoke tests are intentionally not run. Task
`0.4` is evidenced complete with the retained compatibility scope; implementation
remains gated by later phases.

## Existing characterization run

Command:

```text
node scripts/npm-run.js run test:run -- src/app/api/chat/__tests__ src/lib/ai/draft/__tests__ src/lib/ai/__tests__
```

Evidence from the rerun on the subject working tree: `Test Files 38 passed
(38)`, `Tests 354 passed (354)`.
This run covers route auth/schema, intent routing, tool allowlist and RPC
mapping, stream/draft output, repair-draft orchestration, quota/error handling,
kill switch, tenant policy, provider configuration/options, key rotation and
server-RPC claim behavior.

The Phase 0 proof module also passed `go test -count=1 ./...`,
`go test -race -count=1 ./...`, `go vet ./...` and `go mod verify`; `gofmt -l .`
reported no files. `openspec validate
refactor-ai-into-shared-go-service --strict` passed on 2026-09-25. These checks
cover the current working tree and do not authorize Phase 1, live DB work or
deployment.

## Eino and transport proof

The isolated proof module is `phase-0/eino-proof`, pinned to
Go `1.24` and
`github.com/cloudwego/eino v0.9.21`,
`github.com/cloudwego/eino-ext/components/model/openai v0.1.13` and
`github.com/cloudwego/eino-ext/components/model/gemini v0.1.36`. It has no
QLTBYT/runtime imports in Go import blocks and no production service package
(`phase-0/eino-proof/go.mod:1-11`; import scan returned no matches). The local
stub tests prove:

- Eino `schema.StreamReader` incremental output and cleanup.
- Eino ReAct model/tool loop with a real `ToolCallingChatModel` stub and typed
  `utils.InferTool` tool.
- Structured secondary extraction through Eino `Generate` plus typed JSON
  decoding.
- Primary loop plus secondary extraction usage aggregation without cumulative
  double counting.
- Provider stream cancellation and tool-loop cancellation through Go contexts.
- A cancelled provider stream is finalized as provider-started, unknown usage
  (`error_with_usage`) without refunding the reservation; the broker proof also
  propagates cancellation into an in-flight cleanup RPC with a bounded deadline.
- The maintained Eino OpenAI adapter for both the gateway-shaped and
  openai-compatible paths, including distinct base paths, model/options and
  SSE framing against an in-process `httptest.Server`.
- The maintained Eino Gemini adapter through the GenAI client and a local
  `generateContent` stub, with `generationConfig` options and response usage
  metadata.
- Google key-pool round-robin, quota exhaustion and hourly reset behavior.

Named proof coverage is `eino_compatibility_test.go:146,234`,
`eino_cancellation_test.go:16,41`, `provider_key_pool_test.go:44`,
`provider_stub_test.go:22`, `fixture_parity_test.go:27`,
`accounting_decisions_test.go:12-230`,
`accounting_recovery_test.go:10,35,49,76,100,114,128,144,165,202`,
`usage_mapping_test.go:67`, `auth_decision_test.go:208,228,245,257`,
`auth_decision_boundaries_test.go:12,55,83,111`,
`hmac_replay_test.go:186,253`, and
`hmac_replay_admission_test.go:11,44,92,114,136`.

The accounting proof was split into `accounting_decisions_test.go` and
`accounting_recovery_test.go`; both remain below the repository file-size
threshold. The final fixes normalize empty or invalid provider usage to
`unknown` while preserving explicit `knownZero`, and preserve the known token
dimension when the other dimension is absent under `partial`.

## Advisory triage (not proof)

An opt-in Jev advisory run on 2026-09-25 (`jev-1.13.0`) reviewed the local
usage boundary and crash decision. It recommended preserving explicit
`knownZero`, mapping empty/unrecognized usage to `unknown`, and retaining the
known dimension when the other dimension is missing (`partial`). The user
accepted the post-expiry crash boundary separately on 2026-09-25 after the
accounting consequence was explained. The advisory is not test evidence and
does not authorize runtime, SQL or deployment work; this evidence records only
its decision-support role and reported metadata.
The request/result reported `input_tokens: 2083` and `output_tokens: 143`.

Command:

```text
cd openspec/changes/refactor-ai-into-shared-go-service/phase-0/eino-proof && go test -count=1 ./...
cd openspec/changes/refactor-ai-into-shared-go-service/phase-0/eino-proof && go test -race -count=1 ./...
```

Both commands passed: `ok example.com/qltbyt/phase0-eino-proof 0.358s` and
`ok example.com/qltbyt/phase0-eino-proof 4.081s` (race). The focused HMAC
commands in `hmac-parameters.md` also passed. These are isolated local proofs,
not a production service or live-provider result.
No paid provider, VM, Tunnel or database was used.

## Decision 0.5: HMAC and replay

The exact parameters are recorded in `phase-0/hmac-parameters.md`: HMAC-SHA-256
with raw URL-safe base64, Unix seconds, 30 seconds of allowed clock skew, a
120-second validity/replay window, 4,096 live nonces and a 150-second restart
quarantine. MVP has no verified replay snapshot. The proof covers canonical raw
body digest including the serialized identity fields, key ID binding,
issuer/audience and capability registry, key rotation, malformed-field rejection,
bounded nonce capacity, expiry reclaim
without evicting live nonces, concurrent access and restart quarantine. The
values and resulting availability trade-off were reviewed and accepted for
Phase 0. Task `0.5` is checked; no runtime readiness or deployment claim is
made here.

## Decision 0.7: crash recovery and accounting

The evidence-backed proposal is an append-only usage-intent journal on a
host-persistent service volume with write-ahead ordering:

1. Reserve quota.
2. Append `provider_intent` and call `fsync`; provider work is forbidden when
   this write fails.
3. Run provider/tool work.
4. Append `usage_observed` and call `fsync` before attempting quota
   finalization. If that observation is lost, restart replay records unknown
   usage conservatively.
5. Finalize by reservation ID, then append a finalized marker.
6. On restart, replay pending intents before the reservation TTL. Finalization
   is idempotent by reservation ID.

The proof uses real file append, `Sync`, process-restart simulation, a
write-ahead failure check and an idempotent mock finalizer. It demonstrates
recovery before expiry, conservatively classifies a crash after provider intent
but before usage observation as unknown, and proves that provider work does not
start when the intent cannot be made durable. The remaining limits are
explicit: a process loss after quota reserve but before the write-ahead intent
must not start provider work, while a loss after provider work and before
`usage_observed` cannot recover measured numbers and is recorded as unknown;
after reservation expiry, the existing `ai_quota_finalize` ignores the row and
the proof records `reservation_expired_before_recovery` rather than claiming
recovery. The user explicitly accepted this post-expiry accounting-loss
boundary on 2026-09-25 after explanation; that acceptance does not include
pre-expiry loss. Any stronger reconciliation or SQL change remains a separate
gated change. No SQL table or migration is added in Phase 0.
Observed usage from separate provider attempts is aggregated once by attempt
ID during replay; a missing observation keeps the recovered record unknown.
Proof references are `accounting_recovery_test.go:10-47` (write-ahead ordering),
`:49-98` (pre-expiry replay and retry aggregation), `:100-128` (unknown
usage), `:130-149` (expiry boundary), `:151-186` (idempotent marker retry) and
`:188-201` (torn journal fail-closed). Task `0.7` is checked: the evidence and
the explicit user acceptance cover the pre-expiry guarantee and the bounded
post-expiry limitation. Graceful cleanup and TTL are not claimed as recovery.

## Decision 0.8: unknown and partial usage

The existing quota RPC accepts only `success`, `error_with_usage` and
`error_no_usage`; nullable numeric inputs are coerced to zero. The target
mapping recorded for review is:

| Observation                 | RPC status         | Numeric fields                                             | Uncertainty marker       | Refund reservation? |
| --------------------------- | ------------------ | ---------------------------------------------------------- | ------------------------ | ------------------- |
| Known zero                  | `success`          | `0, 0`                                                     | `measured`               | No                  |
| Known positive              | `success`          | Observed values                                            | `measured`               | No                  |
| Partial                     | `error_with_usage` | Observed values; zero sentinel only for missing dimensions | `partial`                | No                  |
| Unknown after provider work | `error_with_usage` | `0, 0` compatibility sentinel                              | `unknown`                | No                  |
| Provider did not start      | `error_no_usage`   | `0, 0`                                                     | `known-no-provider-work` | Yes                 |

The uncertainty marker lives in the durable usage/reconciliation record and is
not encoded by inventing a fourth RPC status or by DDL in this change. Consumers
must distinguish `measured` zero from `partial`/`unknown` zero. Unknown and
partial usage never silently refund the reservation. The mapping proof covers
all four required observations and asserts that unknown is not equal to measured
zero. Explicit `knownZero` remains measured zero; empty or invalid usage maps to
`unknown`; if one dimension is absent, the known dimension is retained under
`partial`. This decision is reviewed and normative before Phase 3; the proof
does not itself authorize a quota implementation or schema change.
The current route still reflects the old behavior at
`src/lib/ai/usage-metering.ts:62-75` and `route.ts:307-318`; this evidence does
not claim parity for accounting. Proof references:
`usage_mapping_test.go:73-115` and `accounting_recovery_test.go:100-126`.
Task `0.8` is checked; implementation remains gated by Phase 3.

## Decision 0.9: Go to Supabase/RPC authentication

The reviewed contract is an application-owned BFF RPC broker. The
Next.js BFF remains the only holder of `SUPABASE_JWT_SECRET`; the shared Go
service receives only a BFF-signed, short-lived request envelope and never
receives the project-wide signing secret or a browser cookie. The broker
verifies the envelope and performs the Supabase call with a deterministic
allowlist. The envelope has:

- issuer `nextjs-bff`, audience `qltbyt-rpc-broker-v1`, and at most 120 seconds
  lifetime;
- a numeric `user_id` claim and trusted effective facility scope derived by the
  BFF from the validated session, never from browser claims;
- an RPC name restricted to `ai_quota_reserve`, `ai_quota_finalize` or
  `assistant_query_database_audit_log`;
- cancellation propagation into the running RPC context and bounded finalize
  authorization for the same reservation, with a cleanup budget no greater than
  five seconds; no broad `service_role` authority;
- no forwarded browser cookie. The current cookie-forwarding implementation in
  `src/lib/ai/sql/audited-executor.ts:107-118` is evidence of what the broker
  must replace, not a Go authentication contract.

The existing audit RPC requires `p_sql_shape` nonempty and at most 1000
characters, exact `query_database` tool path, `success`/`failure` status,
nonnegative latency, `selected`/`session` facility source and a nonempty error
class for failures. It validates a numeric user claim in
`supabase/migrations/20260419023000_add_assistant_sql_audit_rpc.sql:55-114`.
Success ordering remains execute, audit, release; failure auditing is best
effort and the original SQL error is preserved. The broker contract proof
accepts the signed scoped envelope, derives the numeric user ID and facility
from trusted claims, rejects expiry, wrong audience, forged claims, browser
cookie, unallowlisted RPC, missing numeric user ID and out-of-scope cleanup,
rejects future-issued or boundary-expired credentials, and refuses new work
after cancellation. This is a local contract/design proof, not live Supabase
enforcement. New auth provisioning or schema work would be a separate
SQL-gated change.
The proof uses a local Ed25519 envelope model to test the trust boundary; it is
not a production Supabase credential or a live RPC call. Proof references are
`auth_decision_test.go:208-280` (trusted identity, allowlist and negative
claims), `auth_decision_boundaries_test.go:12-53` (lifetime boundaries),
`:55-109` (cancellation and bounded cleanup) and `:111-131` (audit fields).
Task `0.9` is checked for the Phase 0 contract decision. No secret was copied
and no live DB operation ran; production credential provisioning remains a
later implementation/deployment gate.

## Historical pre-implementation review reconciliation

The following F1-F11 rows preserve the original source-review history. They are
not the current post-implementation code-review finding count; the current
11-finding reconciliation is recorded below. Phase 0 completion still does not
authorize Phase 1, live DB work or deployment.

| ID  | Finding                                                                                          | File/test/evidence reference                                                                                                                                                                                                        | Status                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | SQL audit contract differs from the current RPC and cookie-forwarding path.                      | `supabase/migrations/20260419023000_add_assistant_sql_audit_rpc.sql:16-114`; `src/lib/ai/sql/audited-executor.ts:102-134,163-205`; `auth_decision_test.go:228-243`; `auth_decision_boundaries_test.go:111-131`; Decision 0.9 above. | Closed in Phase 0 docs: the named RPC, required fields, success ordering and failure best-effort behavior are recorded. Production credential provisioning remains a later implementation gate. |
| F2  | "Keep current behavior" conflicts with unknown/partial usage semantics.                          | `src/lib/ai/usage-metering.ts:62-75`; `route.ts:307-318,410-414`; `supabase/migrations/20260521154307_ai_quota_review_hardening.sql:271-327`; `usage_mapping_test.go:73-115`; Decisions 0.7/0.8.                                    | Closed in Phase 0 docs: the accounting change, expiry boundary, mapping and uncertainty marker are explicit and reviewed; implementation remains a Phase 3 gate.                                |
| F3  | Phase 0 exit wording could invert the Phase 1 gate.                                              | `tasks.md:23,31`; `design.md` Phase 0 gate; `specs/shared-ai-service/spec.md` phased-gate requirement; Scope gate below.                                                                                                            | Closed in Phase 0 docs: missing proof/review blocks Phase 1, and Phase 2/3 remain defense-in-depth gates. Phase 1 stays unchecked pending explicit user approval.                               |
| F4  | Canonical `POST /v1/chat` body omits request semantics and provider parity.                      | `src/app/api/chat/route.ts:178-212,245-266`; `src/lib/ai/chat-request-schema.ts:27-28`; `src/lib/ai/prompts/system.ts:48-51`; Provider inventory above.                                                                             | Closed in Phase 0 docs: display name, selected-facility quota tenant, no-reserve clarification and all three retained transports are explicit; `0.4` is checked.                                |
| F5  | Replay bounds and restart-snapshot exception were unspecified.                                   | `phase-0/hmac-parameters.md`; `hmac_replay_test.go:18-22,72-89,105-153,186-251,253-280`; `hmac_replay_admission_test.go:11-168`; focused HMAC commands below.                                                                       | Closed in Phase 0 docs: `0.5` records and accepts 30s skew, 120s window, 4,096 nonce cap and 150s no-snapshot quarantine.                                                                       |
| F6  | First Go release has no previous image to roll back to.                                          | `design.md` deployment/rollback sections; Scope gate below. No deploy or image was performed.                                                                                                                                       | Deferred to the Phase 6-8 operations gates; Phase 0 makes no rollback or deployment claim.                                                                                                      |
| F7  | One active instance combines drain time with replay quarantine.                                  | `design.md` deployment sections; `phase-0/hmac-parameters.md:20-21`; no VM/deploy evidence.                                                                                                                                         | Deferred to the Phase 6-8 operations gates; Phase 0 records the quarantine and performs no drain or deployment.                                                                                 |
| F8  | Oracle VM coexistence and credential/resource boundaries need direct acceptance.                 | `src/app/api/device-quota/mapping/suggest/suggestion-vm-client.ts`; historical review confirmation; Scope gate below.                                                                                                               | Deferred to the operations runbook and Phase 6-8 gates; chat HMAC remains separate from the static device-quota token and `qltbyt_test` credentials. No VM action was taken.                    |
| F9  | Kill-switch cache durations were only described as "short".                                      | `src/lib/ai/kill-switch.ts:5-6,59-81`; `src/app/api/chat/__tests__/route.kill-switch.test.ts`; focused characterization command.                                                                                                    | Closed in Phase 0 docs: 8s success-cache and 2s fail-closed cache are recorded in the normative plan; no runtime change was made.                                                               |
| F10 | The current route already runs repair-draft orchestration; predecessor text is not the baseline. | `src/app/api/chat/route.ts:353-391`; `phase-0/fixtures/ui-tool-parity.json`; `fixture_parity_test.go:27-70`; Baseline characterization above.                                                                                       | Resolved in evidence: current `/api/chat` is the baseline, draft remains advisory/draft-only/no-submit, and predecessor checklist is untouched.                                                 |
| F11 | The plan did not pin Go/toolchain or state CI/image/Vercel boundaries.                           | `phase-0/eino-proof/go.mod:1-11`; `tasks.md:35`; Eino proof section above.                                                                                                                                                          | Closed in Phase 0 docs: Go `1.24`, the Vercel boundary and no-new-CI-platform scope are explicit. Image/CI implementation remains a later phase.                                                |

## Post-implementation code-review reconciliation

The actual post-implementation code review recorded 11 findings. All 11 are
resolved in the current Phase 0 proof/docs; this count is independent of the
historical F1-F11 source-review rows above. The fixes are evidenced by the
following artifacts:

| Finding                            | Resolution evidence                                                                                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HMAC identity binding              | Serialized identity fields are covered by the raw-body digest; tampered `app_id` and key/app mismatches fail in `hmac_replay_test.go:186-253`.                                                      |
| Nonce expiry and concurrency       | Expired entries are reclaimed without evicting live entries, with bounded concurrent admission in `hmac_replay_admission_test.go:92-168`.                                                           |
| Restart quarantine                 | No-snapshot startup rejects requests until the full `150s` quarantine in `hmac_replay_test.go:253-280`.                                                                                             |
| BFF signed broker contract         | The proof derives trusted numeric identity/scope from the signed BFF envelope and rejects browser cookies, forged claims and unsafe RPCs in `auth_decision_test.go:208-280`.                        |
| Actual Eino provider adapters      | Gateway-shaped OpenAI, openai-compatible and Gemini adapters use local HTTP/client stubs in `provider_stub_test.go:22-307`.                                                                         |
| Streaming usage aggregation        | Primary tool-loop and secondary extraction usage aggregate once in `eino_compatibility_test.go:146-274`.                                                                                            |
| Missing usage normalization        | Empty/invalid usage becomes `unknown`, explicit `knownZero` stays measured, and partial dimensions retain known values in `usage_mapping_test.go:73-115` and `accounting_recovery_test.go:100-126`. |
| Retry attempt aggregation          | Replay aggregates distinct attempt IDs once in `accounting_recovery_test.go:76-98` and `accounting_decisions_test.go:119-173`.                                                                      |
| Finalize-before-marker idempotency | A failed finalized marker is retried without double-applying quota in `accounting_recovery_test.go:165-200`.                                                                                        |
| Torn-journal fail-closed behavior  | Invalid journal data aborts replay before finalization in `accounting_recovery_test.go:202-215`.                                                                                                    |
| Proof file extraction              | Accounting helpers and scenarios are split between `accounting_decisions_test.go` and `accounting_recovery_test.go`; both stay below the file-size threshold.                                       |

## Scope gate and task reconciliation

Implemented evidence is limited to Phase 0. Tasks `0.1`-`0.9` have clear
artifacts, fresh checks and reviewed decisions in this document and in
`tasks.md`. This completion records evidence and decisions only; it does not
start Phase 1 or authorize any later phase. Phase 1 and all later phases remain
untouched. No migration, live database write, deployment, production routing
change or paid provider smoke was performed.
