## Context

Assistant hiện chạy trong `/api/chat` bằng Vercel AI SDK. Route xác thực NextAuth, validate UI messages, route intent, build tool registry, gọi provider, stream UI messages, reserve/finalize quota và có thể chạy secondary structured extraction cho repair-request draft. Các tool lại đi qua RPC/Supabase và mang tenant/facility policy của QLTBYT.

Mục tiêu là tách backend AI thành một Go service dùng chung mà không biến service đó thành “QLTBYT repair service viết bằng Go”. QLTBYT là capability adapter đầu tiên; shared core chỉ biết contract trung lập. Browser vẫn nói chuyện với Next.js BFF và UI hiện tại.

Baseline Phase 0 là route hiện tại `src/app/api/chat/route.ts`, nơi `maybeBuildRepairRequestDraftArtifact` đã được gọi. Change `add-assistant-repair-request-draft-orchestration` là predecessor và ngữ cảnh spec cho draft, không phải baseline duy nhất. Khi change đó còn chưa được activation, ownership runtime của draft vẫn là route-owned như spec hiện tại; change này chỉ supersede ownership khi Go cutover được chấp nhận, đồng thời giữ nguyên safety behavior draft-only/no-submit và không sửa checklist của predecessor. Existing code có cả mixed tool envelopes và raw draft outputs; migration phải giữ cả hai trạng thái cho tới khi từng contract được chứng minh, không được giả định mọi output đã đồng nhất. Fixture parity UI/tool không đóng băng accounting quota hiện tại.

## Goals / Non-Goals

### Goals

- Chuyển toàn bộ backend orchestration hiện có vào một Go service, với Go + Eino là toolkit mục tiêu.
- Giữ Vercel AI SDK UI Message Stream và UI/tool behavior của assistant hiện tại. Accounting quota có các sửa có chủ đích, tách khỏi parity đó.
- Tách shared core, capability adapter và app BFF thành các boundary kiểm thử được.
- Cho phép một capability của app thứ hai compile/test mà không cần import QLTBYT.
- Có cancellation, usage và quota lifecycle đủ rõ để vận hành trên Oracle VM.
- Deploy qua Cloudflare Tunnel theo kỷ luật tương tự Web Push: không publish raw service port, secret ngoài image, health/readiness, graceful shutdown và image rollback.
- Chứng minh Eino compatibility spike (stream, tool loop, structured extraction, total usage và cancellation) trước khi scaffold full migration.

### Non-Goals

- Không xây platform onboarding hoặc public registry cho app khác trong MVP.
- Không thêm Bifrost, queue, vector store, server-side conversation store hay database riêng cho AI.
- Không đổi schema/database trong change này. Runtime adapters vẫn gọi các RPC/quota/audit contract đã được duyệt; change này không tự tạo migration hoặc ad-hoc live write.
- Không giữ legacy Next.js orchestrator làm runtime fallback sau cutover.

## Architecture

```text
Browser / React / Vercel AI SDK
        |
        v
Next.js /api/chat (session + input validation + signed envelope + stream proxy)
        |
        | Cloudflare Tunnel + Access service token
        v
Go shared AI service
  transport + auth/replay checks
  capability registry
  shared Eino orchestration
  provider/model adapters
  normalized event + UI stream encoder
  usage lifecycle + metrics
        |
        +--> QLTBYT capability adapter
        |      prompts, intent, tool allowlist, tenant/facility policy
        |      Supabase/RPC adapters, ai_quota_* adapter, draft workflow
        |
        +--> second-app test capability fixture
               no QLTBYT imports
```

### Shared core boundary

Shared core SHALL contain only app-neutral concepts:

- request envelope parsing and size/timeout limits;
- `app_id`, `capability_id`, capability version and request correlation;
- Eino workflow/agent execution and tool-loop control;
- provider selection through an adapter contract;
- normalized text/tool/artifact/error events;
- Vercel AI SDK UI Message Stream encoding;
- request cancellation, graceful drain and bounded retry policy;
- usage collection and quota lifecycle interfaces;
- metrics, trace/request IDs and sanitized error classification.

Shared core MUST NOT import QLTBYT packages, know QLTBYT RPC names, assume `don_vi`/`dia_ban_id`, use `ai_readonly` as a global database, or implement `ai_quota_*` calls directly.

### Capability adapter boundary

Phase 0 task 0.9 SHALL record and review the QLTBYT data-access authentication decision, and that decision MUST name `public.assistant_query_database_audit_log`: BFF-issued short-lived scoped credentials, adapter-held signing credentials, or an application-owned BFF RPC broker. The decision MUST define secret custody and blast radius, credential TTL/audience, claims derived only from trusted identity, rejection of browser-supplied credentials/claims, cancellation and audit propagation, and bounded quota cleanup authorization after abort. The current audit writer copies the browser cookie onto `POST /api/rpc/assistant_query_database_audit_log`; that cookie forward MUST NOT become Go service authentication. The caller credential for this RPC MUST carry a numeric `user_id` claim. The existing `src/lib/ai/server-rpc.ts` mints Supabase JWTs using `SUPABASE_JWT_SECRET` for other AI RPCs and is not the audit writer; signed BFF-to-Go identity alone does not replace that authentication. Copying this project-wide secret into shared core MUST NOT be an implicit implementation choice. New database authentication/provisioning requires a separate SQL gate. Phase 1 MUST NOT start while 0.9 is unreviewed. Phase 2 keeps the same gate as defense in depth and SHALL verify its negative cases before completion.

Each app capability SHALL provide a descriptor, context builder, prompt fragments, tool definitions/executors, authorization policy, artifact schemas and optional workflow hooks. The registry selects a capability by signed `app_id` + `capability_id` + version; those IDs are routing values, not permission by themselves.

The QLTBYT adapter SHALL own:

- current assistant tool allowlist and intent routing;
- equipment, maintenance, repair, reporting and troubleshooting tools;
- RPC/Supabase access and role/tenant/facility scope enforcement;
- QLTBYT `ai_quota_reserve`/`ai_quota_finalize` integration and its policy;
- evidence envelopes and current raw/mixed tool-output compatibility;
- repair-request draft session, secondary structured extraction and UI artifact mapping.

`query_database` SHALL remain a QLTBYT-only tool. Its adapter MUST execute through a dedicated `ai_query_tool` read-only connection/role (or an already approved equivalent), with an explicit SQL parser/statement allowlist, approved schema/catalog, tenant/facility scope checks, statement timeout, row/cell limits and no DDL/DCL/write transaction. Each attempt SHALL call `public.assistant_query_database_audit_log`. The call MUST send a sanitized nonempty `p_sql_shape` of at most 1000 characters; a hash MUST NOT replace that shape. It MUST send `p_tool_path` exactly `query_database`, `p_status` of `success` or `failure`, nonnegative `p_latency_ms`, `p_effective_facility_id`, and `p_facility_source` of `selected` or `session`. Failure status MUST include a nonempty `p_error_class`. The caller credential MUST carry a numeric `user_id` claim. The adapter MUST also send the optional fields the current audited executor sends when present: `p_row_count`, `p_payload_bytes`, `p_requested_facility_id`, `p_session_facility_id`, and `p_raw_role`. On success the order MUST be execute, then audit, then release; audit failure on that path blocks release. On failure the audit is best-effort: an audit failure is swallowed and the original SQL error is rethrown. The adapter MUST NOT return an empty successful result because the audit failed. Operational logs remain separate and MUST omit raw identity, prompt, SQL and sensitive result data. If the required dedicated connection/role or audit path is not already available, provisioning it MUST be a separate SQL change with the database quality gate before this tool is enabled.

The QLTBYT adapter SHALL preserve the current kill-switch contract: an environment emergency override wins, a successful database read is cached for 8 seconds, a database read error fails closed and is cached for 2 seconds, and the service does not start model/tool work while the switch is active. Read-only/RPC tool results SHALL be compacted before model execution using the existing bounded message/input budgets. A clarification returned before `reserveUsage`, as the current route does, SHALL NOT be compacted or rejected by the model-execution budget gate, and it MUST consume no quota reservation.

The shared usage interface SHALL expose reservation, observed usage, finalization status and reconciliation metadata. It MUST not prescribe a shared database implementation. UI/tool parity MUST NOT freeze today's accounting. Secondary extraction usage joining the same lifecycle, and unknown/partial usage no longer being presented as measured zero, are intentional accounting changes. The adapter MUST NOT invent a fourth quota status, a token count, or DDL. A numeric zero MAY remain only as the existing compatibility sentinel when the reviewed uncertainty marker stays distinguishable from measured zero. That sentinel MUST NOT silently refund the reservation. The Phase 0.8 mapping becomes the normative contract before Phase 3.

### Eino and provider boundary

Eino SHALL be the target orchestration toolkit for model/tool loops, workflow steps, cancellation and capability execution. The implementation MUST use maintained Eino/provider integrations when they satisfy the required transport and streaming contract. A small provider adapter MAY call an official Go SDK when that is the supported or necessary integration; it MUST normalize model options, stream events, tool calls, structured extraction and usage into the service contract.

Phase 0 SHALL inventory the current transports `gateway` (the default, with default model `google/gemini-3.1-flash-lite-preview`), `google`, and `openai-compatible`, including the Google in-process key pool, quota-error rotation, hourly exhaustion reset, and the route's use of `getKeyPoolSize`. The reviewed inventory SHALL retain each required supported behavior or explicitly retire unused paths. The migration MUST NOT automatically port every current branch. Bifrost is deliberately outside this boundary. Adding it later MUST happen behind the provider interface after a concrete multi-provider/fallback requirement exists.

## Service Contract

### Request

Next.js SHALL send `POST /v1/chat` over the Cloudflare Tunnel. The canonical JSON body SHALL contain these fields:

```json
{
  "protocol_version": "v1",
  "app_id": "qltbyt",
  "capability_id": "assistant-chat",
  "capability_version": "v1",
  "request_id": "uuid",
  "identity": {
    "issuer": "nextjs-bff",
    "audience": "ai-service-v1",
    "subject": "user-id",
    "tenant": "tenant-id",
    "issued_at": 0,
    "expires_at": 0,
    "trusted_app": {
      "app_id": "qltbyt",
      "capability_ids": ["assistant-chat"]
    },
    "capability_claims": {}
  },
  "messages": [],
  "requested_tools": [],
  "context": {
    "selected_facility_id": "requested-context-only",
    "selected_facility_name": "untrusted-display-only"
  }
}
```

The `identity` object is the signed trusted envelope. Its `subject`, `tenant`, issuer/audience, time bounds and `trusted_app` claims are checked against the signing-key registry. `context` is request input and is untrusted for authorization. `selected_facility_name` is untrusted display context only. `selected_facility_id` expresses the user's current selection and is not authority by itself. After current QLTBYT scope validation, that validated `selectedFacilityId` SHALL be the quota tenant passed to `ai_quota_reserve`. It MUST NOT be filled by assuming the session `don_vi` claim or the generic `identity.tenant`. When current scope resolution keeps the session facility for a non-privileged user, that resolved value remains the validated facility id used as the quota tenant. QLTBYT role and facility claims remain opaque capability claims validated by the QLTBYT adapter; the shared core MUST NOT hard-code those fields. The raw request body, including `identity`, SHALL be hashed after serialization. The canonical HMAC domain separator SHALL be `ai-service-v1`, and the canonical string SHALL be `ai-service-v1\nPOST\n/v1/chat\n<timestamp>\n<request-id>\n<key-id>\n<sha256(raw-body)>`; the signature header and signature value MUST be excluded from the body digest and canonical input.

The browser cookie SHALL never be forwarded as the service authentication mechanism. The BFF MUST reject an unauthenticated session before signing the envelope.

### Authentication and replay protection

Cloudflare Access service credentials protect the Tunnel ingress. Access client ID/secret remain BFF-only. Before the security proof and before Phase 1, Phase 0 SHALL record and review the MAC algorithm and signature encoding, header names, timestamp unit, allowed clock skew, request validity/replay window, and bounded nonce-map capacity. The BFF SHALL sign the `ai-service-v1` canonical string containing HTTP method, path, timestamp, request ID/nonce, key ID and SHA-256 of the raw body using that reviewed record; the signature header itself SHALL be excluded from the body digest and canonical input. The Go service MUST verify the generic trusted identity, timestamp skew, body digest, signature key validity, key-to-app/capability binding and request ID uniqueness within the replay window before starting a model call.

Signing-key identity SHALL bind to a trusted key registry entry containing issuer, allowed `app_id` values and allowed capability IDs; `app_id` alone MUST NOT be treated as proof that a caller may impersonate another app. The MVP SHALL run one active instance with an atomic, bounded in-memory nonce map. The MVP MUST NOT restore a verified replay snapshot. Because this map is not durable, startup SHALL keep readiness false and reject signed chat requests for the full maximum prior-request validity plus allowed clock-skew quarantine window. Comparing a request timestamp only with process boot time MUST NOT replace that quarantine. After quarantine, the map SHALL reject duplicate or expired-window nonces atomically and SHALL reject new requests when capacity is full rather than evicting a still-live nonce. Key rotation SHALL revoke the old key ID, activate the new key only after registry/config parity is ready, and fail closed if the key registry or replay guard cannot initialize. A durable replay store is out of scope; any later requirement for one MUST be a separate storage/SQL gate.

The MVP SHALL run as one active Go instance. Admission SHALL be bounded by a maximum concurrent request count, per-request input/output/tool-step limits and a provider timeout; excess work SHALL receive a stable retryable response before model execution. Active-active deployment, cross-instance nonce sharing and load balancing are out of scope until a separately approved replay/state design exists.

### Response and stream

For an accepted request, Go SHALL return the Vercel AI SDK UI Message Stream with the compatibility header `x-vercel-ai-ui-message-stream: v1`. The stream encoder SHALL preserve current text, tool-call, tool-result, artifact and sanitized error parts, including both existing mixed envelopes and raw draft outputs until parity evidence permits a later cleanup.

The HTTP response SHALL use `Content-Type: text/event-stream` for an accepted stream. The normalized internal event sequence SHALL contain `start`, zero or more `start-step`/`finish-step` pairs, content/tool/artifact events, and a terminal `finish`/`DONE` marker before the connection closes. Errors detected before stream start SHALL use a stable core error contract with `status`, `code`, a sanitized `message`, `retryable`, optional capability-defined safe `details` and `retry_after_ms`, and SHALL correlate through an `X-Request-ID` response header. The Next.js BFF SHALL map that neutral contract to the existing client contract: a quota limit maps to HTTP 429 with nested `error.code = ai_usage_limited`, `error.reason`, `error.message` and `error.retryAfterMs`, plus `Retry-After` as appropriate, so the current `parseAiUsageLimitError` behavior and countdown remain unchanged. Errors after stream start SHALL use only the installed Vercel AI SDK error part supported by captured fixtures, with correlation in the response/header and sanitized text/metadata rather than an invented custom UI chunk field.

### Cancellation and usage

The BFF SHALL propagate browser disconnect/abort to the Go request. The forwarded deadline SHALL preserve the remaining BFF budget and SHALL NOT reset to 55 seconds when the request reaches Go. The proposed budget inside the current route `maxDuration` of 60 seconds is at most 55 seconds of Go work from the original request start plus up to 5 seconds of cleanup. Acceptance MUST include evidence that bounded cleanup, failure handling, and reconciliation fit that cleanup allowance. If that proof fails, the budget changes only through a reviewed normative amendment. This design does not claim that 5 seconds is insufficient without that evidence. Go SHALL cancel the Eino context and propagate cancellation to provider, tool executor and app adapters. A cancellation MUST stop new model/tool work, then use a detached bounded cleanup context to finalize the reservation with observed status even after the HTTP request context is canceled.

Every observed provider call across primary tool-loop steps, attempted retries and secondary repair-draft extraction SHALL contribute once to one usage lifecycle; per-step usage MUST NOT be double-counted with provider cumulative totals. Bringing secondary extraction usage into that lifecycle is an intentional accounting change from the current route, where that call runs after primary finalization. Finalization MUST be idempotent under retry, use bounded retry/reconciliation, and distinguish observed usage, error-with-usage and error-without-usage. Unknown or partial usage MUST NOT be presented as measured zero. A zero compatibility sentinel is allowed only with the reviewed uncertainty marker, and it MUST NOT close or refund a reservation by assumption.

### Phase 0 quota decisions

Review bổ sung có Jev hỗ trợ đã xác định hai khoảng trống; kết luận dựa trên repository source, chưa phải xác minh live DB. Đây là đầu ra bắt buộc của Phase 0 (tasks 0.7/0.8), không phải hai cơ chế đã được triển khai.

1. **Hard crash recovery/accounting:** detached context không tồn tại sau SIGKILL/OOM. Trong `supabase/migrations/20260521154307_ai_quota_review_hardening.sql:106`, expiry giảm `reserved` và đặt `expired` mà không tăng `count`; tại dòng 302, finalize bỏ qua reservation không còn `reserved`. Vì vậy idempotency và TTL không tự phục hồi usage sau crash. Append-only journal MUST recover and finalize observations before reservation expiry. The accepted weaker guarantee is limited to a recovery that begins after expiry: provider cost may already have occurred while database quota/token accounting undercounts because `ai_quota_finalize` ignores the expired reservation. The user explicitly accepted that boundary on 2026-09-25; it does not waive pre-expiry recovery or permit pre-expiry accounting loss. Any stronger reconciliation or SQL change remains a separate gated change.
2. **Unknown/partial usage mapping:** cùng migration tại dòng 271 chuyển NULL token/cost thành 0; dòng 276 chỉ chấp nhận `success`, `error_with_usage`, `error_no_usage`. Quyết định MUST định nghĩa bảng known-zero/known-positive/partial/unknown, quota status, numeric fields, nơi lưu uncertainty và cách consumer phân biệt unknown với measured-zero. Nếu dùng số 0 làm compatibility sentinel, nó MUST có dấu hiệu uncertainty phân biệt được; không được trình bày như số đo thật hoặc tự refund request.

Thiếu proof Phase 0, hoặc 0.7, 0.8 hay 0.9 chưa được review, thì Phase 1 MUST NOT bắt đầu. Phase 3 MUST NOT bắt đầu trước khi cả hai quyết định quota được review; gate Phase 3, và gate Phase 2 cho 0.9, là defense in depth sau gate Phase 1. Bảng mapping 0.8 đã review trở thành normative trước implementation Phase 3. Phase 3 mới kiểm chứng chúng bằng fault injection và contract tests; không mặc định phải thêm queue/database/platform, status mới, hoặc DDL. Nếu cần đổi SQL, phải tách change với quality gates và live-write approval riêng, không nới scope ngầm. Giới hạn post-expiry đã được người dùng chấp nhận phải được giữ đúng phạm vi trong normative spec; acceptance đó không tự động cho phép Phase 1 hay bất kỳ live/SQL operation nào.

## Deployment and Operations

- The service SHALL run as a container on the Oracle VM, with signing/provider secrets mounted/provided outside the image. Cloudflare Access client ID/secret SHALL remain only in the Next.js BFF; Go SHALL verify the trusted ingress plus its own HMAC and MUST NOT require the Access client secret as a Go readiness dependency.
- Go SHALL bind only to loopback/private service interfaces. The raw port SHALL not be exposed publicly.
- Cloudflare Tunnel SHALL provide the chat route; Cloudflare Access service-token headers SHALL be injected only by the trusted BFF path.
- `/healthz` SHALL report process health and `/readyz` SHALL report configuration, provider and capability readiness without making an unsafe model call. Both endpoints SHALL bind to loopback/private probe access and MUST NOT be published through the Cloudflare Tunnel chat hostname.
- Before deploy or process termination, the service SHALL mark readiness false, stop accepting new chat requests, allow active streams to drain for at most the configured grace, cancel remaining work, and complete bounded usage reconciliation. That grace maximum is 60-90 seconds. It is a maximum, not a mandatory fixed outage, and an idle process MAY exit early. Deployment and process-termination grace MUST cover the selected drain period plus the bounded cleanup margin. The container or orchestrator stop timeout MUST NOT send SIGKILL before that drain plus cleanup can complete. This process grace is separate from the reservation TTL and from the proposed request budget of at most 55 seconds of work plus up to 5 seconds of cleanup inside the current 60-second route budget. Drain grace MUST NOT extend an already forwarded request deadline. Reservation TTL SHALL remain at least 120 seconds.
- Images SHALL be addressed by digest. The Go module and image SHALL pin one Go toolchain. Vercel MUST NOT build `services/ai-service`. This change MUST NOT add a new CI platform. The container MUST NOT use `qltbyt_test` credentials, and it keeps the resource limits already required for the image. After the first verified Go release, the operator SHALL retain a verified previous Go image for rollback. Rollback is an operator image/configuration action. After cutover, the request path SHALL NOT fall back to the old Next.js orchestrator. A failed candidate with no previous verified Go image then leaves the cut-over route unavailable. A failed dark first deploy, when no previous Go image exists, leaves that candidate unavailable and blocks cutover. It does not by itself disable the existing production chat path.
- Logs and metrics SHALL include request ID, app/capability ID, model/provider label, latency, outcome and usage classification while excluding sensitive content.

## Migration Plan

Implementation SHALL proceed through the ten reviewable phases represented by `tasks.md`. Each phase MUST stop at its review gate; completion MUST NOT imply approval to start the next phase, deploy to the VM, write live data or cut over traffic.

0. **Baseline + Eino proof:** characterize the current route, including the draft builder it already runs, UI/tool fixtures, and the provider inventory. Record HMAC parameters before the security proof. Record quota decisions 0.7 and 0.8 and the 0.9 credential decision for `assistant_query_database_audit_log`. Missing proofs, or 0.7/0.8/0.9 not yet reviewed, block Phase 1.
1. **Shared core/provider:** start only after that Phase 0 exit. Implement the app-neutral contracts, pin the Go toolchain, and add only the provider transports the inventory retained. Pause on provider/stream evidence.
2. **QLTBYT data/tools:** add the capability adapter, tenant/facility policy, RPC adapters, `ai_query_tool` guardrails/audit and second-app boundary fixture. The 0.9 gate remains defense in depth. Any missing DB role/audit function pauses for a separate SQL gate.
3. **Draft/quota/kill switch:** move draft orchestration and extraction. Apply the intentional accounting changes, with the 0.8 mapping already normative. Keep the 8 second / 2 second kill switch and compaction. The 0.7/0.8 gates remain defense in depth. Pause on UI/tool parity and accounting evidence.
4. **HTTP/auth/SSE/abort:** implement `ai-service-v1` signed HTTP with the reviewed HMAC parameters, full validity-plus-skew quarantine, bounded admission, Vercel UI stream and the proposed 55-second work plus up to 5-second cleanup budget. Pause if cleanup evidence fails; a failure requires a reviewed normative amendment.
5. **Dark BFF/UI integration:** wire a non-default BFF path and UI contract tests while the existing runtime remains active. No production traffic or fallback semantics change.
6. **Oracle operations artifacts:** prepare the digest-addressed image with the pinned Go toolchain, external secrets isolated from `qltbyt_test`, existing resource limits, local health probes, and a 60-90 second drain-grace maximum whose stop timeout covers the selected drain period plus bounded cleanup before SIGKILL. An idle process may exit early. This grace stays separate from reservation TTL and the 55+5 request budget. Include the rollback runbook and Tunnel/Access configuration. Vercel does not build the Go service, and this change adds no CI platform. No live apply is implied.
7. **Authorized dark VM smoke:** only after separate operator authorization, deploy one instance on Oracle and run local health probes plus BFF-to-chat Tunnel smoke. A failed dark first deploy blocks cutover and does not itself disable existing production chat. It is not a promised image rollback.
8. **Exact-commit acceptance + direct cutover:** run all parity, security, cancellation, usage, UI and operational gates on one commit; after explicit cutover approval, make Go the sole `/api/chat` backend with no legacy runtime fallback.
9. **Cleanup:** after stable operation, remove/deactivate unreachable old model/tool orchestration and update docs. Preserve a verified Go image rollback path; do not add a legacy runtime fallback.

## Risks / Trade-offs

- **Stream drift:** Vercel AI SDK parts and current mixed envelopes may differ from a Go encoder. Mitigate with captured stream fixtures and a UI contract test before switching traffic.
- **Authorization drift:** Moving tools across a process boundary can weaken tenant/facility rules. Keep authorization in the QLTBYT adapter, sign normalized claims, and test global/admin role normalization explicitly.
- **Usage uncertainty:** A provider may omit usage on cancellation or stream errors. Keep unknown or partial usage distinguishable from measured zero. A zero sentinel is allowed only with the reviewed uncertainty marker. Do not guess tokens or invent a status.
- **Over-generalization:** A generic registry can become a platform prematurely. Keep only internal capability registration and one real boundary fixture in MVP.
- **VM dependency:** Cloudflare or VM outage makes chat unavailable. Return a controlled error while unrelated web functions continue; use operator image rollback and health/readiness evidence.

## Open Questions

- Exact Cloudflare hostname, Access application IDs and Oracle operator command paths are deployment values to be recorded in the runbook during implementation.
- Whether durable replay protection is required beyond the bounded in-memory/process window is a later operational decision. The MVP does not restore a verified replay snapshot, and this change does not solve durability with a live schema change.
