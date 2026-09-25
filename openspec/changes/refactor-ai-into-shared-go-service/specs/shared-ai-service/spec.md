## ADDED Requirements

### Requirement: Shared AI Service Boundary

The system SHALL provide one Go AI service whose shared core is app-agnostic. The core MUST own request validation, capability routing, Eino orchestration, provider selection, normalized events, UI stream encoding, cancellation, usage lifecycle interfaces and observability. The core MUST NOT import QLTBYT packages, reference QLTBYT RPC names, assume QLTBYT tenant fields, or couple itself to a global `ai_readonly` database.

#### Scenario: QLTBYT request enters the shared service

- **WHEN** the BFF sends a valid request for a QLTBYT capability
- **THEN** the shared core routes by signed capability identifiers and delegates QLTBYT-specific prompts, tools, authorization and data access to the QLTBYT adapter
- **AND** no QLTBYT business rule is evaluated by a shared-core package

#### Scenario: Shared core is built without QLTBYT

- **WHEN** the service builds the shared core and a second-app fixture
- **THEN** compilation succeeds without importing QLTBYT code, QLTBYT default IDs, QLTBYT RPC names or QLTBYT database clients

### Requirement: Capability Adapter Contract

The system SHALL register versioned capabilities behind an internal contract containing a descriptor, context builder, prompt fragments, tool definitions/executors, authorization policy, artifact schemas and optional workflow hooks. `app_id`, `capability_id` and capability version SHALL route a request but MUST NOT, by themselves, grant authorization. A trusted signing-key registry SHALL bind each key ID to an issuer, allowed app IDs and allowed capability IDs.

#### Scenario: A second app registers a capability

- **WHEN** the second-app fixture registers a capability with its own context, tool and artifact definitions
- **THEN** the shared core can execute it through the same request and stream contracts
- **AND** the fixture has no dependency on QLTBYT adapter packages

#### Scenario: Unknown capability is requested

- **WHEN** a signed request names an unavailable or unsupported capability version
- **THEN** the service rejects it before a provider or tool call with a stable non-retryable capability error

### Requirement: Eino Orchestration and Provider Adapters

The system SHALL use Go + Eino as the target orchestration toolkit for model/tool loops, workflow steps, cancellation and capability execution. Provider integrations SHALL be isolated behind an adapter contract for model options, streaming, tool calls, structured extraction and usage. The implementation MUST use a maintained Eino/provider integration when it satisfies the required transport; an official provider Go SDK MAY be used behind the adapter when necessary. The Eino compatibility spike MUST prove streaming, tools, structured extraction, aggregated usage and cancellation before full migration work begins. Phase 0 SHALL inventory the current transports `gateway`, `google`, and `openai-compatible`, including the Google in-process key pool, quota-error rotation, and hourly exhaustion reset. The reviewed inventory SHALL retain each required supported behavior or explicitly retire unused paths. The migration MUST NOT automatically port every current branch. Bifrost SHALL NOT be required by the MVP.

#### Scenario: Tool loop executes through Eino

- **WHEN** a capability requests a model response that requires one or more allowed tools
- **THEN** Eino controls the bounded model/tool loop and returns normalized events to the shared stream encoder
- **AND** the shared core does not implement a second parallel orchestration loop outside Eino

#### Scenario: Secondary structured extraction uses the provider contract

- **WHEN** the QLTBYT repair-draft capability performs its secondary structured extraction
- **THEN** it uses the same provider adapter usage and cancellation contract as the primary model call
- **AND** the extraction remains capability-owned rather than becoming a QLTBYT concept in shared core

#### Scenario: Current provider transports are inventoried

- **WHEN** Phase 0 records `gateway`, `google`, and `openai-compatible`, including Google key-pool rotation and the hourly exhaustion reset
- **THEN** each path is either retained as required supported behavior or explicitly retired by review
- **AND** unused branches are not ported automatically

### Requirement: Authenticated Chat API

The system SHALL expose `POST /v1/chat` for the trusted Next.js BFF. Its canonical JSON body SHALL contain `protocol_version`, `app_id`, `capability_id`, `capability_version`, `request_id`, `identity`, `messages`, `requested_tools` and `context`. The `identity` object SHALL contain generic `issuer`, `audience`, `subject`, `tenant`, `issued_at`, `expires_at` and trusted app/capability claims. `context` is untrusted request input and MUST NOT be treated as authority. `context.selected_facility_name` is untrusted display context. The validated `selectedFacilityId` from current QLTBYT scope resolution SHALL be the QLTBYT quota tenant passed to quota reserve. That quota tenant MUST NOT be filled by assuming the session `don_vi` claim or the generic `identity.tenant`. When current scope resolution keeps the session facility for a non-privileged user, that resolved value remains the quota tenant. QLTBYT role/facility claims are validated only by the QLTBYT adapter. The browser cookie MUST NOT be the Go service authentication mechanism. A clarification returned before quota reserve MUST consume no reservation.

#### Scenario: Authenticated request is accepted

- **WHEN** an authenticated BFF sends a schema-valid signed request through Cloudflare Tunnel
- **THEN** the Go service validates limits and identity before starting Eino or provider work
- **AND** the response is associated with the supplied request ID

#### Scenario: Unauthenticated browser request is attempted

- **WHEN** a browser attempts to call the Go service without the BFF envelope and service authentication
- **THEN** Cloudflare Access or the Go service rejects the request before model execution

#### Scenario: Facility name is display context

- **WHEN** the BFF forwards a facility display name and a selected facility id
- **THEN** the display name is not used as authorization or as the quota tenant
- **AND** the quota tenant is the validated selected facility id, including a session facility that current scope resolution retained for a non-privileged user, rather than an assumed copy of session `don_vi` or generic `identity.tenant`

#### Scenario: Clarification precedes reserve

- **WHEN** intent routing returns a clarification before model execution, as the current route does before `reserveUsage`
- **THEN** the chat path returns that clarification without creating a quota reservation

### Requirement: Cloudflare and HMAC Request Authentication

The deployment SHALL use Cloudflare Tunnel and Cloudflare Access for the web-to-VM path. Cloudflare Access client credentials SHALL remain in the Next.js BFF and MUST NOT be a Go readiness dependency. Before the security proof and before Phase 1, Phase 0 SHALL record and review the MAC algorithm and signature encoding, header names, timestamp unit, allowed clock skew, request validity/replay window, and bounded nonce-map capacity. The BFF SHALL sign the `ai-service-v1` canonical string `ai-service-v1\nPOST\n/v1/chat\n<timestamp>\n<request-id>\n<key-id>\n<sha256(raw-body)>` using that reviewed record; the signature header SHALL be excluded from the raw-body digest and canonical input. The Go service MUST verify the identity object, issuer, audience, timestamp skew, body digest, signature key, key-to-app/capability binding, capability authorization and bounded replay protection before accepting the request. Signing-key identity MUST bind to the trusted service issuer; `app_id` alone MUST NOT permit caller impersonation. The MVP MUST NOT include a verified replay snapshot. After restart, readiness MUST stay false and chat requests MUST be rejected for the full maximum prior-request validity plus the allowed clock skew. Comparing a request timestamp only with process boot time MUST NOT replace that quarantine.

#### Scenario: Tampered request body is received

- **WHEN** a request body changes after the BFF computes its signature
- **THEN** the Go service rejects it without invoking a model or tool

#### Scenario: Replayed request is received within the replay window

- **WHEN** the same signed request ID/nonce is received again within the configured replay window
- **THEN** the service rejects the replay and records only sanitized request metadata

#### Scenario: Access credentials are missing

- **WHEN** the BFF lacks the required server-only Cloudflare Access credential
- **THEN** the request path fails closed and no secret is exposed to the browser or logs

#### Scenario: Replay guard restarts or key rotation is incomplete

- **WHEN** the single active instance restarts, its bounded atomic nonce guard is not initialized, or a key rotation leaves the key registry inconsistent
- **THEN** readiness remains false and the service rejects requests through the full maximum prior-request validity plus allowed clock-skew quarantine window, and thereafter until the replay guard and key-to-app/capability registry are valid
- **AND** the MVP does not restore a verified replay snapshot or introduce a new SQL replay table

#### Scenario: Future-skewed request crosses a restart

- **WHEN** a valid-looking request signed near the maximum accepted future clock skew arrives after process restart
- **THEN** the startup quarantine rejects it until the full prior-request validity and clock-skew window has elapsed

#### Scenario: Replay map capacity is full

- **WHEN** the bounded nonce map has no capacity for another live nonce
- **THEN** the service rejects the request with a stable retryable admission error and does not evict a still-live nonce

### Requirement: Vercel AI SDK UI Stream Compatibility

For an accepted request, the Go service SHALL return the Vercel AI SDK UI Message Stream with `x-vercel-ai-ui-message-stream: v1`. The encoder SHALL preserve the current text, tool-call, tool-result, artifact and sanitized error parts, including current mixed tool envelopes and raw draft outputs until a separate cleanup is approved. The accepted response SHALL use `Content-Type: text/event-stream`; its normalized event sequence SHALL contain `start`, zero or more `start-step`/`finish-step` pairs, content/tool/artifact events and a terminal `finish`/`DONE` marker. Before stream start, the neutral error contract SHALL use `status`, `code`, a sanitized `message`, `retryable`, optional capability-defined safe `details` and `retry_after_ms` with correlation in `X-Request-ID`; the BFF SHALL map quota errors to the existing client shape `error.code = ai_usage_limited`, `error.reason`, `error.message` and `error.retryAfterMs`, HTTP 429 and `Retry-After` so `parseAiUsageLimitError` and its countdown remain compatible. After stream start, only the installed Vercel AI SDK error part supported by captured fixtures SHALL be emitted; the service MUST NOT invent a custom request-ID UI chunk.

#### Scenario: Existing assistant renders a Go response

- **WHEN** the BFF proxies a successful Go stream to the existing React/Vercel AI SDK client
- **THEN** text, tool execution cards, report/chart artifacts and repair draft cards render through the current UI contracts

#### Scenario: Draft event ordering is preserved

- **WHEN** a repair-draft artifact is produced after the primary tool loop
- **THEN** the draft event is emitted before the base stream emits its terminal `finish`/`DONE` marker
- **AND** the client does not receive a completed message before it receives the draft artifact

#### Scenario: Post-stream failure is reported safely

- **WHEN** a provider or capability error occurs after stream output has begun
- **THEN** the service emits a sanitized UI error event correlated by the existing `X-Request-ID` response header and closes the stream without exposing prompt, SQL, token or secret content

### Requirement: QLTBYT Markdown Table Presentation

In Phase 5, the QLTBYT prompt SHALL instruct the model to default to Markdown tables for multiple items sharing comparable attributes, including equipment lists, maintenance schedules and comparisons. It SHALL prefer 3–5 concise columns, mark unavailable values as “Chưa có dữ liệu”, and prohibit inventing values to fill cells. Explanations, procedures and clarifications MAY use prose or lists. Existing tool/artifact cards SHALL retain their contracts. This enhancement SHALL remain on the dark path until separately authorized cutover.

#### Scenario: Tabular response crosses stream chunks

- **WHEN** a fixture streams a Markdown table through the dark BFF with chunk boundaries inside headers, delimiters and cells
- **THEN** the completed response renders all expected rows and columns using the existing Markdown renderer
- **AND** fixtures cover Unicode, escaped pipe characters and safe rendering of untrusted cell content
- **AND** wide tables scroll horizontally within their container on mobile without widening the page

#### Scenario: Presentation guidance preserves non-tabular behavior

- **WHEN** Phase 5 validates the QLTBYT prompt and UI fixtures
- **THEN** the prompt includes the table preference and missing-data rules while allowing prose/list explanations and preserving artifact cards
- **AND** deterministic prompt/renderer tests do not claim guaranteed provider compliance or require an unapproved paid provider call

### Requirement: Cancellation and Usage Lifecycle

The system SHALL propagate BFF/browser abort through HTTP, Eino, provider calls and capability tool/RPC calls. The forwarded deadline SHALL preserve the remaining BFF budget and MUST NOT reset when the request reaches Go. The proposed budget inside the current 60-second route `maxDuration` is at most 55 seconds of Go work from the original request start plus up to 5 seconds of cleanup. Acceptance MUST include evidence that bounded cleanup, failure handling, and reconciliation fit that cleanup allowance. If that proof fails, the budget changes only through a reviewed normative amendment; the requirement does not claim that 5 seconds is insufficient without that evidence. Cleanup SHALL use a detached bounded context so quota finalization can complete after HTTP cancellation. The shared usage interface SHALL support reservation, observed usage, finalization status and reconciliation metadata. Finalization MUST be idempotent under retry, use bounded retry/reconciliation, and distinguish observed usage, error-with-usage and error-without-usage. Unknown or partial provider usage MUST NOT be presented as measured zero or silently refunded. A numeric zero MAY remain only as the existing compatibility sentinel together with the reviewed uncertainty marker. The adapter MUST NOT invent a quota status or schema. A clarification returned before reserve consumes no reservation.

#### Scenario: User stops a running response

- **WHEN** the browser aborts an active chat request
- **THEN** the BFF cancels the Go request, Go cancels Eino and downstream calls, no new model/tool step starts, and usage finalization records the observed cancellation state

#### Scenario: Retry repeats finalization

- **WHEN** a network retry repeats a quota finalization request for the same reservation
- **THEN** the application-owned quota adapter produces one effective final state and returns reconciliation-safe success

#### Scenario: Provider usage is unavailable

- **WHEN** a stream ends with no trustworthy provider usage
- **THEN** the usage adapter keeps that usage distinguishable from measured zero, without inventing a quota status, inventing token counts, or refunding by assumption
- **AND** a zero compatibility sentinel remains identifiable through the reviewed uncertainty marker

#### Scenario: Repair extraction consumes additional usage

- **WHEN** the primary response and secondary repair-draft extraction both run
- **THEN** observed usage from every primary tool-loop step, attempted retry and the secondary extraction belongs once to the same request lifecycle before finalization, without double-counting cumulative usage
- **AND** this combined lifecycle is an intentional accounting change, not a freeze of the current primary-only finalization timing

### Requirement: Quota Recovery and Uncertainty Decision Gate

Phase 0 SHALL produce reviewed decisions for hard-crash recovery/accounting and the mapping of known-zero, known-positive, partial and unknown provider usage onto the existing three QLTBYT quota statuses. Missing Phase 0 proofs, or decisions 0.7, 0.8, or 0.9 not yet reviewed, MUST block Phase 1. Phase 3 MUST NOT begin until both quota decisions are reviewed; that Phase 3 gate, and the Phase 2 gate for decision 0.9, are defense in depth. The reviewed 0.8 mapping SHALL be normative before Phase 3 implementation. Detached cleanup and reservation expiry MUST NOT be treated as evidence of recovery after process loss. Decisions requiring SQL changes MUST name a separate gated dependency and MUST NOT silently expand this change's database scope. The mapping MUST NOT invent a quota status or DDL.

The crash decision SHALL identify recovery state, storage, write ordering, restart behavior before and after reservation expiry, and testable guarantees; alternatively, a weaker accounting guarantee MUST receive explicit user approval and be reflected in the normative spec before implementation. For this change, the accepted weaker guarantee is limited to post-expiry recovery: if a crash is recovered only after reservation expiry, provider cost may already have occurred while database quota/token accounting undercounts because `ai_quota_finalize` ignores the expired reservation. This acceptance does not permit pre-expiry accounting loss; journal replay and finalization before expiry remain required. The usage decision SHALL identify status mapping, numeric fields, the location of the uncertainty marker and how consumers distinguish unknown from measured-zero. A zero compatibility sentinel MUST retain that distinction and MUST NOT silently refund a request. UI and tool parity fixtures MUST NOT freeze the current coercion of missing usage to measured zero. Phase 3 SHALL verify both decisions using crash fault injection and mapping/idempotency tests.

#### Scenario: Quota decision is unresolved

- **WHEN** Phase 0 proofs are missing, or decision 0.7, 0.8, or 0.9 is not yet reviewed
- **THEN** Phase 1 does not begin
- **AND** the later Phase 2 authentication gate and Phase 3 quota gate remain defense in depth
- **AND** a passing graceful-cancellation test or a nonzero reservation TTL does not waive the gate

#### Scenario: Provider work precedes process loss

- **WHEN** fault injection kills the process after provider work but before quota finalization, including restart after reservation expiry
- **THEN** the Phase 3 evidence demonstrates the reviewed recovery behavior or the explicitly approved accounting limit
- **AND** it does not claim successful recovery from an expired reservation that the existing finalize RPC ignores

#### Scenario: Provider usage is partial or unknown

- **WHEN** the quota adapter records incomplete usage using the existing numeric RPC fields
- **THEN** the reviewed mapping retains an identifiable uncertainty marker at its designated storage boundary
- **AND** tests distinguish this record from trustworthy measured-zero without an implicit schema change

### Requirement: QLTBYT Capability Parity

The QLTBYT capability SHALL preserve current UI and tool behavior before cutover, including intent routing, tool allowlist, read-only operational tools, tenant/facility policy, evidence envelopes, troubleshooting/report artifacts, repair-request draft session behavior and draft-only/no-submit semantics. That parity MUST NOT freeze current quota accounting. Secondary extraction usage joining the primary reservation lifecycle, and unknown or partial usage no longer being presented as measured zero, are intentional accounting changes governed by the Phase 0.8 mapping. QLTBYT Supabase/RPC access and `ai_quota_*` policy SHALL remain inside the QLTBYT adapter. The Phase 0 baseline is the current `/api/chat` route, including the repair-draft builder it already runs. The predecessor change remains context, and its checklist stays unchanged.

#### Scenario: Current read-only operational question is migrated

- **WHEN** a user asks an existing equipment, maintenance, repair or reporting question through the Go path
- **THEN** the same allowed tool set, scope rules, evidence contract and UI output remain available as in the characterized current path

#### Scenario: Repair draft is migrated

- **WHEN** a user starts or continues the existing repair-request draft flow
- **THEN** the QLTBYT adapter collects the same evidence, asks for missing required fields, runs the secondary extraction when eligible and emits the existing draft artifact without submitting data

#### Scenario: Tool is outside the current allowlist

- **WHEN** a request names a known but blocked or unknown tool
- **THEN** the QLTBYT adapter rejects it before execution with the existing safe error semantics

### Requirement: Tenant and Data Security

The system SHALL preserve the current role, tenant and facility authorization semantics at the QLTBYT capability boundary, including normalization of equivalent global/admin roles. QLTBYT adapters MUST use scoped authenticated claims for RPC/data access and MUST NOT replace RLS/policy checks with an unrestricted service credential. The QLTBYT `query_database` tool MUST use a dedicated `ai_query_tool` read-only connection/role or an already approved equivalent, an explicit SQL parser/statement allowlist, approved schema/catalog, tenant/facility scope checks, statement timeout, row/cell limits, and `public.assistant_query_database_audit_log`. Phase 0.9 SHALL name that RPC in the caller-credential decision. The audit call MUST send a sanitized nonempty `p_sql_shape` of at most 1000 characters; a hash MUST NOT replace it. It MUST send `p_tool_path` exactly `query_database`, `p_status` of `success` or `failure`, nonnegative `p_latency_ms`, `p_effective_facility_id`, and `p_facility_source` of `selected` or `session`. A failure status MUST include a nonempty `p_error_class`. The caller credential MUST carry a numeric `user_id` claim. The adapter MUST also send the optional fields the current audited executor sends when it has them: `p_row_count`, `p_payload_bytes`, `p_requested_facility_id`, `p_session_facility_id`, and `p_raw_role`. On success the order MUST be execute, then audit, then release; audit failure on that path blocks release. On failure the audit is best-effort: an audit failure is swallowed and the original SQL error is rethrown. The adapter MUST NOT return an empty successful result because the audit failed. Operational logs MUST omit raw identity, prompt, SQL and sensitive result data. The tool MUST reject DDL, DCL and write transactions. If that connection or audit path does not exist, enabling the tool requires a separate SQL change and database quality gate. The QLTBYT adapter SHALL preserve the environment/database kill-switch behavior, an 8 second cache after a successful database read, a 2 second cache after a database read error, and fail-closed database errors. It SHALL compact read-only/RPC outputs under existing bounded input budgets while leaving clarification responses outside that model-execution budget gate and outside quota reserve. The service MUST redact sensitive prompts, messages, SQL, provider tokens, identity claims and secret headers from operational logs.

#### Scenario: Tenant mismatch is supplied

- **WHEN** the signed identity context and requested facility/tenant context do not satisfy QLTBYT policy
- **THEN** the capability refuses the tool call or returns safe guidance before retrieving cross-scope data

#### Scenario: Data-access authentication is not yet decided

- **WHEN** Phase 1 or Phase 2 is proposed while the Phase 0.9 QLTBYT Go-to-Supabase/RPC decision, including the caller credential for `assistant_query_database_audit_log`, is not yet reviewed
- **THEN** Phase 1 remains blocked, and the Phase 2 gate remains defense in depth, until the decision specifies the application-owned mechanism, secret custody and blast radius, TTL/audience, trusted claim derivation, rejection of browser-supplied credentials/claims, cancellation/audit propagation and bounded quota cleanup authorization; project-wide JWT signing authority MUST NOT be implicitly assigned to shared core
- **AND** Phase 2 acceptance SHALL require negative tests for expired/wrong-audience credentials, forged claims, invalid scope and missing secrets, plus cancellation/audit and cleanup evidence; new database authentication requires a separate SQL gate

#### Scenario: Privileged user lacks required facility scope

- **WHEN** a privileged/global user requests a scoped operation without the facility context required by the current policy
- **THEN** the capability returns a guidance/error result and does not broaden the query to all facilities

#### Scenario: Sensitive failure is logged

- **WHEN** an authorization, provider or tool failure occurs
- **THEN** logs contain request/capability identifiers and sanitized classification only, without full prompt, SQL or token content

#### Scenario: QLTBYT SQL tool receives unsafe input

- **WHEN** `query_database` receives DDL, DCL, a write statement, an unapproved schema/table or a request without valid facility/tenant scope
- **THEN** the adapter rejects it before database execution
- **AND** the failure audit, when written, uses the required `assistant_query_database_audit_log` fields, including a sanitized nonempty SQL shape rather than a hash
- **AND** an audit-write failure still returns the original rejection rather than an empty successful result

#### Scenario: Successful query releases rows only after audit

- **WHEN** `query_database` executes a permitted read-only query successfully
- **THEN** the adapter writes `assistant_query_database_audit_log` before releasing rows to the model or client
- **AND** an audit failure blocks that release and does not become an empty successful result

#### Scenario: Failed query preserves the original SQL error

- **WHEN** `query_database` fails during validation or execution
- **THEN** the adapter attempts the failure audit and rethrows the original SQL error
- **AND** an audit failure on this path does not replace that error or return an empty successful result

#### Scenario: Kill switch or input compaction guard is active

- **WHEN** the environment kill switch is on, the database kill-switch lookup is active, or that lookup fails during its 2 second fail-closed cache
- **THEN** no model or tool work begins
- **AND** a successful database read is cached for 8 seconds
- **AND** read-only/RPC output is compacted before model execution without applying that gate, or quota reserve, to clarification responses

### Requirement: Oracle VM Deployment and Health

The Go service SHALL deploy as one active container on the Oracle VM with secrets outside the image, loopback/private binding and no publicly exposed raw service port. The Go module and image SHALL pin one Go toolchain. Vercel MUST NOT build `services/ai-service`. This change MUST NOT add a new CI platform. The container MUST NOT use `qltbyt_test` credentials. Cloudflare Tunnel SHALL provide chat ingress. `/healthz` and `/readyz` SHALL be available only to local/private operator probes and MUST NOT be published through the Tunnel hostname. `/healthz` SHALL report process health and `/readyz` SHALL report configuration, provider, capability and replay-guard readiness. The service SHALL enforce bounded concurrent admission, reject new requests rather than evict live replay entries when the nonce map is full, enforce resource limits, use the proposed budget of at most 55 seconds of work plus up to 5 seconds of cleanup inside the existing 60-second BFF budget, and use a reservation TTL of at least 120 seconds. Acceptance of that budget MUST include bounded cleanup, failure, and reconciliation evidence; a failed proof requires a reviewed normative amendment and does not by itself declare 5 seconds insufficient.

#### Scenario: Service starts with valid configuration

- **WHEN** the container loads valid external secrets, provider configuration and the registered QLTBYT capability
- **THEN** `/healthz` succeeds and `/readyz` becomes ready without performing an unsafe model or database write

#### Scenario: Required secret is missing

- **WHEN** a required signing or provider secret is absent or invalid
- **THEN** readiness remains false and the service does not accept chat work

#### Scenario: Raw VM port is scanned

- **WHEN** a client outside the approved Tunnel/private path attempts to reach the Go listening port
- **THEN** the port is not publicly exposed and the client cannot bypass Access/HMAC checks

#### Scenario: Concurrent admission is exhausted

- **WHEN** the one active instance reaches its configured concurrent request or resource bound
- **THEN** the service returns a stable retryable response before provider execution
- **AND** it does not imply active-active replay safety or create a second instance automatically

### Requirement: Graceful Drain and Go Image Rollback

On deploy or termination, the service SHALL mark readiness false, stop accepting new chat work, allow active streams to drain for at most a configured grace whose maximum is 60-90 seconds, cancel remaining work and run bounded usage reconciliation. That grace is a maximum, not a mandatory fixed outage, and an idle process MAY exit early. Deployment and process-termination grace MUST cover the selected drain period plus the bounded cleanup margin, and the container or orchestrator stop timeout MUST NOT send SIGKILL before that drain plus cleanup can complete. This process grace is separate from the reservation TTL and from the proposed request budget of at most 55 seconds of work plus up to 5 seconds of cleanup inside the existing 60-second BFF budget. Drain grace MUST NOT extend an already forwarded request deadline. Reservation TTL SHALL remain at least 120 seconds. Operators SHALL be able to roll back to a previously verified Go image/configuration by digest. After cutover, the request path MUST NOT fall back to the legacy Next.js orchestrator. A failed dark candidate with no previous verified Go image remains unavailable and blocks cutover; the existing production `/api/chat` route remains active.

#### Scenario: Deployment begins with active streams

- **WHEN** the operator starts a new Go image while chat streams are active
- **THEN** new requests are rejected or routed only to the ready instance, active streams receive at most the configured drain maximum, and remaining work is canceled with usage status recorded
- **AND** the deploy does not impose that maximum as a fixed outage after no active stream remains

#### Scenario: Stop timeout covers drain and cleanup

- **WHEN** the container or orchestrator stops the service
- **THEN** the stop timeout covers the selected drain period plus the bounded cleanup margin and does not send SIGKILL before that work can complete
- **AND** an idle process may exit before the maximum
- **AND** the stop timeout does not change the reservation TTL or the 55-second work plus 5-second request cleanup deadline

#### Scenario: New Go image fails readiness

- **WHEN** the candidate image fails `/readyz` or Tunnel smoke checks and a previous verified Go image exists
- **THEN** the operator restores the previous verified Go image/configuration and no request is sent to the old Next.js orchestration as runtime fallback

#### Scenario: First dark deployment has no previous verified image

- **WHEN** the first dark candidate Go image fails readiness or Tunnel smoke and no previous verified Go image exists
- **THEN** cutover stays blocked and the existing production `/api/chat` path remains the current Next.js runtime
- **AND** the failure does not by itself disable that production chat path and does not create a post-cutover fallback to it

#### Scenario: Cut-over candidate has no previous verified image

- **WHEN** production chat has already been cut over to Go and the candidate fails with no previous verified Go image
- **THEN** the cut-over route remains unavailable
- **AND** the request path does not fall back to the legacy Next.js orchestrator

### Requirement: Phased Implementation Gates

The implementation SHALL follow the ten phases `0` through `9` in `tasks.md` and the design migration plan. Each phase SHALL have a prerequisite, acceptance evidence and explicit stop/review gate. Missing Phase 0 proofs, or decisions 0.7, 0.8, or 0.9 not yet reviewed, MUST block Phase 1. The Phase 2 gate for decision 0.9 and the Phase 3 gate for decisions 0.7 and 0.8 remain defense in depth. Phases `0` through `6` MUST NOT change production chat routing or imply live database writes; phase `7` SHALL be authorized dark VM/Tunnel smoke only; phase `8` SHALL be the sole direct cutover after exact-commit acceptance and explicit approval; phase `9` SHALL be cleanup after stable operation. Completing a phase MUST NOT automatically authorize the next phase.

#### Scenario: Phase gate is incomplete

- **WHEN** a phase lacks its required evidence, review, operator authorization or separate SQL approval where applicable
- **THEN** work pauses at that phase and no production routing, live database write or later phase is started

#### Scenario: Phase 0 review is incomplete

- **WHEN** Phase 0 proofs are missing, or decisions 0.7, 0.8, or 0.9 are not yet reviewed
- **THEN** Phase 1 does not start
- **AND** the later Phase 2 authentication gate and Phase 3 quota gates remain defense in depth for those same decisions

#### Scenario: Direct cutover is authorized

- **WHEN** phases `0` through `7` have passing evidence, the exact implementation commit passes phase `8` acceptance, and explicit cutover approval is recorded
- **THEN** `/api/chat` switches to Go as its sole runtime backend without a legacy fallback
- **AND** the previous verified Go image remains the operational rollback target when one exists

### Requirement: Direct Cutover Verification

The system SHALL block direct replacement until contract, UI/tool parity, security, cancellation, usage, second-app boundary and Tunnel smoke tests pass for the same implementation commit. After cutover, `/api/chat` SHALL call the Go service directly and SHALL not invoke the legacy model/tool orchestration as a runtime fallback. A failed candidate with no previous verified Go image then leaves the cut-over route unavailable. A failed dark first deployment blocks that cutover and MUST NOT by itself disable the existing production chat path.

#### Scenario: Acceptance gates pass

- **WHEN** all required gates pass, including UI stream fixtures, QLTBYT parity, second-app compile/test, HMAC/replay, authorization, abort, usage and health/readiness checks
- **THEN** the web BFF may switch the chat backend to Go as the sole runtime backend

#### Scenario: A required gate is missing or fails

- **WHEN** any required gate is missing, fails, or has incomplete usage/reconciliation evidence
- **THEN** cutover is blocked and the old runtime path is not silently declared equivalent

### Requirement: MVP Scope Boundary

The MVP SHALL exclude Bifrost, public app onboarding, self-service capability registration, billing, model marketplace, plugin loading, queue-based asynchronous jobs, vector storage, AI-specific database storage and server-side conversation persistence. Any future shared-platform feature MUST be proposed as a separate change after a concrete use case exists.

#### Scenario: A second production app is requested during MVP

- **WHEN** another app needs to use the service before the MVP boundary is proven
- **THEN** the team uses the second-app fixture and capability contract as the compatibility proof and creates a separate scope change for production onboarding

#### Scenario: Conversation is reopened on another device

- **WHEN** a user asks to restore server-side chat history
- **THEN** the MVP rejects or defers that behavior without inventing a persistence schema inside the AI service
