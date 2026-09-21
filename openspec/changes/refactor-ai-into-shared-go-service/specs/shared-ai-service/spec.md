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

The system SHALL use Go + Eino as the target orchestration toolkit for model/tool loops, workflow steps, cancellation and capability execution. Provider integrations SHALL be isolated behind an adapter contract for model options, streaming, tool calls, structured extraction and usage. The implementation MUST use a maintained Eino/provider integration when it satisfies the required transport; an official provider Go SDK MAY be used behind the adapter when necessary. The Eino compatibility spike MUST prove streaming, tools, structured extraction, aggregated usage and cancellation before full migration work begins. Bifrost SHALL NOT be required by the MVP.

#### Scenario: Tool loop executes through Eino

- **WHEN** a capability requests a model response that requires one or more allowed tools
- **THEN** Eino controls the bounded model/tool loop and returns normalized events to the shared stream encoder
- **AND** the shared core does not implement a second parallel orchestration loop outside Eino

#### Scenario: Secondary structured extraction uses the provider contract

- **WHEN** the QLTBYT repair-draft capability performs its secondary structured extraction
- **THEN** it uses the same provider adapter usage and cancellation contract as the primary model call
- **AND** the extraction remains capability-owned rather than becoming a QLTBYT concept in shared core

### Requirement: Authenticated Chat API

The system SHALL expose `POST /v1/chat` for the trusted Next.js BFF. Its canonical JSON body SHALL contain `protocol_version`, `app_id`, `capability_id`, `capability_version`, `request_id`, `identity`, `messages`, `requested_tools` and `context`. The `identity` object SHALL contain generic `issuer`, `audience`, `subject`, `tenant`, `issued_at`, `expires_at` and trusted app/capability claims. `context` (including a selected facility) is request input and MUST NOT be treated as authority; QLTBYT role/facility claims are validated only by the QLTBYT adapter. The browser cookie MUST NOT be the Go service authentication mechanism.

#### Scenario: Authenticated request is accepted

- **WHEN** an authenticated BFF sends a schema-valid signed request through Cloudflare Tunnel
- **THEN** the Go service validates limits and identity before starting Eino or provider work
- **AND** the response is associated with the supplied request ID

#### Scenario: Unauthenticated browser request is attempted

- **WHEN** a browser attempts to call the Go service without the BFF envelope and service authentication
- **THEN** Cloudflare Access or the Go service rejects the request before model execution

### Requirement: Cloudflare and HMAC Request Authentication

The deployment SHALL use Cloudflare Tunnel and Cloudflare Access for the web-to-VM path. Cloudflare Access client credentials SHALL remain in the Next.js BFF and MUST NOT be a Go readiness dependency. The BFF SHALL sign the `ai-service-v1` canonical string `ai-service-v1\nPOST\n/v1/chat\n<timestamp>\n<request-id>\n<key-id>\n<sha256(raw-body)>`; the signature header SHALL be excluded from the raw-body digest and canonical input. The Go service MUST verify the identity object, issuer, audience, timestamp skew, body digest, signature key, key-to-app/capability binding, capability authorization and bounded replay protection before accepting the request. Signing-key identity MUST bind to the trusted service issuer; `app_id` alone MUST NOT permit caller impersonation.

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

- **WHEN** the single active instance restarts with no verified replay snapshot, its bounded atomic nonce guard is not initialized, or a key rotation leaves the key registry inconsistent
- **THEN** readiness remains false and the service rejects requests through the full maximum prior-request validity plus allowed clock-skew quarantine window, and thereafter until the replay guard and key-to-app/capability registry are valid
- **AND** the service does not introduce a new SQL replay table implicitly

#### Scenario: Future-skewed request crosses a restart

- **WHEN** a valid-looking request signed near the maximum accepted future clock skew arrives after process restart
- **THEN** the startup quarantine rejects it until the full prior-request validity and clock-skew window has elapsed or verified replay state has been restored

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

### Requirement: Cancellation and Usage Lifecycle

The system SHALL propagate BFF/browser abort through HTTP, Eino, provider calls and capability tool/RPC calls. The forwarded deadline SHALL preserve the remaining BFF budget and MUST NOT reset when the request reaches Go; Go work MUST finish within 55 seconds from the original request start, leaving up to 5 seconds for cleanup inside the existing 60-second BFF budget. Cleanup SHALL use a detached bounded context so quota finalization can complete after HTTP cancellation. The shared usage interface SHALL support reservation, observed usage, finalization status and reconciliation metadata. Finalization MUST be idempotent under retry, use bounded retry/reconciliation, and distinguish observed usage, error-with-usage and error-without-usage. Unknown provider usage MUST NOT be guessed as zero or silently refunded.

#### Scenario: User stops a running response

- **WHEN** the browser aborts an active chat request
- **THEN** the BFF cancels the Go request, Go cancels Eino and downstream calls, no new model/tool step starts, and usage finalization records the observed cancellation state

#### Scenario: Retry repeats finalization

- **WHEN** a network retry repeats a quota finalization request for the same reservation
- **THEN** the application-owned quota adapter produces one effective final state and returns reconciliation-safe success

#### Scenario: Provider usage is unavailable

- **WHEN** a stream ends with no trustworthy provider usage
- **THEN** the usage adapter records the unknown/error status required by its application policy without inventing token counts or refunding by assumption

#### Scenario: Repair extraction consumes additional usage

- **WHEN** the primary response and secondary repair-draft extraction both run
- **THEN** observed usage from every primary tool-loop step, attempted retry and the secondary extraction belongs once to the same request lifecycle before finalization, without double-counting cumulative usage

### Requirement: QLTBYT Capability Parity

The QLTBYT capability SHALL preserve the current assistant behavior before cutover, including intent routing, tool allowlist, read-only operational tools, tenant/facility policy, evidence envelopes, troubleshooting/report artifacts, repair-request draft session behavior and draft-only/no-submit semantics. QLTBYT Supabase/RPC access and `ai_quota_*` policy SHALL remain inside the QLTBYT adapter.

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

The system SHALL preserve the current role, tenant and facility authorization semantics at the QLTBYT capability boundary, including normalization of equivalent global/admin roles. QLTBYT adapters MUST use scoped authenticated claims for RPC/data access and MUST NOT replace RLS/policy checks with an unrestricted service credential. The QLTBYT `query_database` tool MUST use a dedicated `ai_query_tool` read-only connection/role or an already approved equivalent, an explicit SQL parser/statement allowlist, approved schema/catalog, tenant/facility scope checks, statement timeout, row/cell limits and a structured audit record through the existing approved audit RPC/function. The adapter MUST preserve existing audited-executor ordering: validate/execute, write the success/failure audit, then release a successful result. Audit failure MUST fail closed before releasing results to the model or client and MUST NOT become an empty successful result. The protected audit record may contain the approved subject identifier, request ID, capability, SQL shape/hash, scope and outcome; operational logs MUST omit raw identity, prompt, SQL and sensitive result data. It MUST reject DDL, DCL and write transactions. If that connection or audit path does not exist, enabling the tool requires a separate SQL change and database quality gate. The QLTBYT adapter SHALL preserve the environment/database kill-switch behavior, its short normal/error cache TTLs and fail-closed database errors, and SHALL compact read-only/RPC outputs under existing bounded input budgets while leaving clarification responses outside that model-execution budget gate. The service MUST redact sensitive prompts, messages, SQL, provider tokens, identity claims and secret headers from operational logs.

#### Scenario: Tenant mismatch is supplied

- **WHEN** the signed identity context and requested facility/tenant context do not satisfy QLTBYT policy
- **THEN** the capability refuses the tool call or returns safe guidance before retrieving cross-scope data

#### Scenario: Privileged user lacks required facility scope

- **WHEN** a privileged/global user requests a scoped operation without the facility context required by the current policy
- **THEN** the capability returns a guidance/error result and does not broaden the query to all facilities

#### Scenario: Sensitive failure is logged

- **WHEN** an authorization, provider or tool failure occurs
- **THEN** logs contain request/capability identifiers and sanitized classification only, without full prompt, SQL or token content

#### Scenario: QLTBYT SQL tool receives unsafe input

- **WHEN** `query_database` receives DDL, DCL, a write statement, an unapproved schema/table or a request without valid facility/tenant scope
- **THEN** the adapter rejects it before database execution
- **AND** the audit record stores only the request ID, SQL shape/hash, scope and outcome

#### Scenario: Kill switch or input compaction guard is active

- **WHEN** the environment kill switch is on, the database kill-switch lookup is active, or that lookup fails during its fail-closed TTL
- **THEN** no model or tool work begins
- **AND** read-only/RPC output is compacted before model execution without applying that gate to clarification responses

### Requirement: Oracle VM Deployment and Health

The Go service SHALL deploy as one active container on the Oracle VM with secrets outside the image, loopback/private binding and no publicly exposed raw service port. Cloudflare Tunnel SHALL provide chat ingress. `/healthz` and `/readyz` SHALL be available only to local/private operator probes and MUST NOT be published through the Tunnel hostname. `/healthz` SHALL report process health and `/readyz` SHALL report configuration, provider, capability and replay-guard readiness. The service SHALL enforce bounded concurrent admission, reject new requests rather than evict live replay entries when the nonce map is full, enforce resource limits, use a request deadline no greater than 55 seconds inside the existing 60-second BFF budget, and use a reservation TTL of at least 120 seconds.

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

On deploy or termination, the service SHALL mark readiness false, stop accepting new chat work, allow active streams to drain for a configured 60-90 second process grace period, cancel remaining work and run bounded usage reconciliation. The normal reserve-to-finalize budget SHALL remain at most 55 seconds plus up to 5 seconds cleanup inside the existing 60-second BFF budget; drain grace MUST NOT extend an already forwarded request deadline. Reservation TTL SHALL be at least 120 seconds, and deployment grace SHALL cover the selected drain period plus cleanup margin. Operators SHALL be able to roll back to a previously verified Go image/configuration by digest. The request path MUST NOT fall back to the legacy Next.js orchestrator.

#### Scenario: Deployment begins with active streams

- **WHEN** the operator starts a new Go image while chat streams are active
- **THEN** new requests are rejected or routed only to the ready instance, active streams receive the drain window, and remaining work is canceled with usage status recorded

#### Scenario: New Go image fails readiness

- **WHEN** the candidate image fails `/readyz` or Tunnel smoke checks and a previous verified Go image exists
- **THEN** the operator restores the previous verified Go image/configuration and no request is sent to the old Next.js orchestration as runtime fallback

#### Scenario: First Go deployment has no previous verified image

- **WHEN** the first candidate Go image fails readiness or Tunnel smoke and no previous verified Go image exists
- **THEN** the Go route remains unavailable and cutover is blocked
- **AND** the system does not claim a rollback path or invoke the legacy Next.js orchestrator as runtime fallback

### Requirement: Phased Implementation Gates

The implementation SHALL follow the ten phases `0` through `9` in `tasks.md` and the design migration plan. Each phase SHALL have a prerequisite, acceptance evidence and explicit stop/review gate. Phases `0` through `6` MUST NOT change production chat routing or imply live database writes; phase `7` SHALL be authorized dark VM/Tunnel smoke only; phase `8` SHALL be the sole direct cutover after exact-commit acceptance and explicit approval; phase `9` SHALL be cleanup after stable operation. Completing a phase MUST NOT automatically authorize the next phase.

#### Scenario: Phase gate is incomplete

- **WHEN** a phase lacks its required evidence, review, operator authorization or separate SQL approval where applicable
- **THEN** work pauses at that phase and no production routing, live database write or later phase is started

#### Scenario: Direct cutover is authorized

- **WHEN** phases `0` through `7` have passing evidence, the exact implementation commit passes phase `8` acceptance, and explicit cutover approval is recorded
- **THEN** `/api/chat` switches to Go as its sole runtime backend without a legacy fallback
- **AND** the previous verified Go image remains the operational rollback target when one exists

### Requirement: Direct Cutover Verification

The system SHALL block direct replacement until contract, parity, security, cancellation, usage, second-app boundary and Tunnel smoke tests pass for the same implementation commit. After cutover, `/api/chat` SHALL call the Go service directly and SHALL not invoke the legacy model/tool orchestration as a runtime fallback.

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
