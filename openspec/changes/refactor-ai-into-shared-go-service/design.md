## Context

Assistant hiện chạy trong `/api/chat` bằng Vercel AI SDK. Route xác thực NextAuth, validate UI messages, route intent, build tool registry, gọi provider, stream UI messages, reserve/finalize quota và có thể chạy secondary structured extraction cho repair-request draft. Các tool lại đi qua RPC/Supabase và mang tenant/facility policy của QLTBYT.

Mục tiêu là tách backend AI thành một Go service dùng chung mà không biến service đó thành “QLTBYT repair service viết bằng Go”. QLTBYT là capability adapter đầu tiên; shared core chỉ biết contract trung lập. Browser vẫn nói chuyện với Next.js BFF và UI hiện tại.

Change `add-assistant-repair-request-draft-orchestration` là predecessor cần dùng để characterization/parity cho draft. Khi change đó còn chưa được activation, ownership runtime của draft vẫn là route-owned như spec hiện tại; change này chỉ supersede ownership khi Go cutover được chấp nhận, đồng thời giữ nguyên safety behavior và không sửa checklist của predecessor. Existing code có cả mixed tool envelopes và raw draft outputs; migration phải giữ cả hai trạng thái cho tới khi từng contract được chứng minh, không được giả định mọi output đã đồng nhất.

## Goals / Non-Goals

### Goals

- Chuyển toàn bộ backend orchestration hiện có vào một Go service, với Go + Eino là toolkit mục tiêu.
- Giữ Vercel AI SDK UI Message Stream và behavior của assistant hiện tại.
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

Before Phase 2, Phase 0 SHALL record and review the QLTBYT data-access authentication decision: BFF-issued short-lived scoped credentials, adapter-held signing credentials, or an application-owned BFF RPC broker. The decision MUST define secret custody and blast radius, credential TTL/audience, claims derived only from trusted identity, rejection of browser-supplied credentials/claims, cancellation and audit propagation, and bounded quota cleanup authorization after abort. The existing `src/lib/ai/server-rpc.ts` mints Supabase JWTs using `SUPABASE_JWT_SECRET`; signed BFF-to-Go identity alone does not replace that authentication. Copying this project-wide secret into shared core MUST NOT be an implicit implementation choice. New database authentication/provisioning requires a separate SQL gate. Phase 2 remains blocked until this decision is reviewed and SHALL verify its negative cases before completion.

Each app capability SHALL provide a descriptor, context builder, prompt fragments, tool definitions/executors, authorization policy, artifact schemas and optional workflow hooks. The registry selects a capability by signed `app_id` + `capability_id` + version; those IDs are routing values, not permission by themselves.

The QLTBYT adapter SHALL own:

- current assistant tool allowlist and intent routing;
- equipment, maintenance, repair, reporting and troubleshooting tools;
- RPC/Supabase access and role/tenant/facility scope enforcement;
- QLTBYT `ai_quota_reserve`/`ai_quota_finalize` integration and its policy;
- evidence envelopes and current raw/mixed tool-output compatibility;
- repair-request draft session, secondary structured extraction and UI artifact mapping.

`query_database` SHALL remain a QLTBYT-only tool. Its adapter MUST execute through a dedicated `ai_query_tool` read-only connection/role (or an already approved equivalent), with an explicit SQL parser/statement allowlist, approved schema/catalog, tenant/facility scope checks, statement timeout, row/cell limits and no DDL/DCL/write transaction. Each attempt SHALL preserve the existing audited-executor ordering: validate/execute the read-only query, write its success/failure record through the approved audit RPC/function, and only then release a successful result; that protected audit record may contain the approved subject identifier, request ID, capability, SQL shape/hash, scope and outcome. Audit failure SHALL fail closed before releasing query results to the model or client; it MUST NOT be reinterpreted as an empty successful result. Operational logs remain separate and MUST omit raw identity, prompt, SQL and sensitive result data. If the required dedicated connection/role or audit path is not already available, provisioning it MUST be a separate SQL change with the database quality gate before this tool is enabled.

The QLTBYT adapter SHALL preserve the current kill-switch contract: an environment emergency override wins, the database status is cached only for the configured short TTL, database read errors fail closed for the shorter error TTL, and the service does not start model/tool work while the switch is active. Read-only/RPC tool results SHALL be compacted before model execution using the existing bounded message/input budgets; clarification responses SHALL not be accidentally compacted or rejected by the model-execution budget gate.

The shared usage interface SHALL expose reservation, observed usage, finalization status and reconciliation metadata. It MUST not prescribe a shared database implementation. If provider usage is unknown, the adapter MUST preserve the existing conservative database status semantics and MUST NOT invent a token count or silently refund the reservation.

### Eino and provider boundary

Eino SHALL be the target orchestration toolkit for model/tool loops, workflow steps, cancellation and capability execution. The implementation MUST use maintained Eino/provider integrations when they satisfy the required transport and streaming contract. A small provider adapter MAY call an official Go SDK when that is the supported or necessary integration; it MUST normalize model options, stream events, tool calls, structured extraction and usage into the service contract.

The MVP supports only the provider transports/models needed for current behavior. Bifrost is deliberately outside this boundary. Adding it later MUST happen behind the provider interface after a concrete multi-provider/fallback requirement exists.

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
    "selected_facility_id": "requested-context-only"
  }
}
```

The `identity` object is the signed trusted envelope. Its `subject`, `tenant`, issuer/audience, time bounds and `trusted_app` claims are checked against the signing-key registry. `context` is request input and is untrusted for authorization; for example, `selected_facility_id` expresses the user's current selection and is not authority. QLTBYT role and facility claims remain opaque capability claims validated by the QLTBYT adapter; the shared core MUST NOT hard-code those fields. The raw request body, including `identity`, SHALL be hashed after serialization. The canonical HMAC domain separator SHALL be `ai-service-v1`, and the canonical string SHALL be `ai-service-v1\nPOST\n/v1/chat\n<timestamp>\n<request-id>\n<key-id>\n<sha256(raw-body)>`; the signature header and signature value MUST be excluded from the body digest and canonical input.

The browser cookie SHALL never be forwarded as the service authentication mechanism. The BFF MUST reject an unauthenticated session before signing the envelope.

### Authentication and replay protection

Cloudflare Access service credentials protect the Tunnel ingress. Access client ID/secret remain BFF-only. The BFF SHALL sign the `ai-service-v1` canonical string containing HTTP method, path, timestamp, request ID/nonce, key ID and SHA-256 of the raw body; the signature header itself SHALL be excluded from the body digest and canonical input. The Go service MUST verify the generic trusted identity, timestamp skew, body digest, signature key validity, key-to-app/capability binding and request ID uniqueness within the replay window before starting a model call.

Signing-key identity SHALL bind to a trusted key registry entry containing issuer, allowed `app_id` values and allowed capability IDs; `app_id` alone MUST NOT be treated as proof that a caller may impersonate another app. The MVP SHALL run one active instance with an atomic, bounded in-memory nonce map. Because this map is not durable, startup SHALL keep readiness false and reject signed chat requests for the full maximum prior-request validity plus allowed clock-skew quarantine window, unless a verified replay state snapshot is restored. After quarantine, the map SHALL reject duplicate or expired-window nonces atomically and SHALL reject new requests when capacity is full rather than evicting a still-live nonce. Key rotation SHALL revoke the old key ID, activate the new key only after registry/config parity is ready, and fail closed if the key registry or replay guard cannot initialize. A durable replay store is out of scope; any later requirement for one MUST be a separate storage/SQL gate.

The MVP SHALL run as one active Go instance. Admission SHALL be bounded by a maximum concurrent request count, per-request input/output/tool-step limits and a provider timeout; excess work SHALL receive a stable retryable response before model execution. Active-active deployment, cross-instance nonce sharing and load balancing are out of scope until a separately approved replay/state design exists.

### Response and stream

For an accepted request, Go SHALL return the Vercel AI SDK UI Message Stream with the compatibility header `x-vercel-ai-ui-message-stream: v1`. The stream encoder SHALL preserve current text, tool-call, tool-result, artifact and sanitized error parts, including both existing mixed envelopes and raw draft outputs until parity evidence permits a later cleanup.

The HTTP response SHALL use `Content-Type: text/event-stream` for an accepted stream. The normalized internal event sequence SHALL contain `start`, zero or more `start-step`/`finish-step` pairs, content/tool/artifact events, and a terminal `finish`/`DONE` marker before the connection closes. Errors detected before stream start SHALL use a stable core error contract with `status`, `code`, a sanitized `message`, `retryable`, optional capability-defined safe `details` and `retry_after_ms`, and SHALL correlate through an `X-Request-ID` response header. The Next.js BFF SHALL map that neutral contract to the existing client contract: a quota limit maps to HTTP 429 with nested `error.code = ai_usage_limited`, `error.reason`, `error.message` and `error.retryAfterMs`, plus `Retry-After` as appropriate, so the current `parseAiUsageLimitError` behavior and countdown remain unchanged. Errors after stream start SHALL use only the installed Vercel AI SDK error part supported by captured fixtures, with correlation in the response/header and sanitized text/metadata rather than an invented custom UI chunk field.

### Cancellation and usage

The BFF SHALL propagate browser disconnect/abort to the Go request. The forwarded deadline SHALL preserve the remaining BFF budget and SHALL NOT reset to 55 seconds when the request reaches Go. Go SHALL cap its own work budget at 55 seconds from the original request start, leaving up to 5 seconds for cleanup inside the existing 60-second BFF route budget. Go SHALL cancel the Eino context and propagate cancellation to provider, tool executor and app adapters. A cancellation MUST stop new model/tool work, then use a detached bounded cleanup context to finalize the reservation with observed status even after the HTTP request context is canceled.

Every observed provider call across primary tool-loop steps, attempted retries and secondary repair-draft extraction SHALL contribute once to one usage lifecycle; per-step usage MUST NOT be double-counted with provider cumulative totals. Finalization MUST be idempotent under retry, use bounded retry/reconciliation, and distinguish observed usage, error-with-usage and error-without-usage. Unknown usage MUST remain unknown; it MUST NOT be converted to zero merely to close a reservation.

### Phase 0 quota decisions required before Phase 3

Review bổ sung có Jev hỗ trợ đã xác định hai khoảng trống; kết luận dựa trên repository source, chưa phải xác minh live DB. Đây là đầu ra bắt buộc của Phase 0 (tasks 0.7/0.8), không phải hai cơ chế đã được triển khai.

1. **Hard crash recovery/accounting:** detached context không tồn tại sau SIGKILL/OOM. Trong `supabase/migrations/20260521154307_ai_quota_review_hardening.sql:106`, expiry giảm `reserved` và đặt `expired` mà không tăng `count`; tại dòng 302, finalize bỏ qua reservation không còn `reserved`. Vì vậy idempotency và TTL không tự phục hồi usage sau crash. Quyết định MUST mô tả trạng thái phục hồi, nơi lưu, thời điểm ghi, cách khôi phục trước/sau expiry và tests; hoặc ghi rõ giới hạn mất accounting để người dùng phê duyệt. Không được tự coi giới hạn này là đã được chấp nhận.
2. **Unknown/partial usage mapping:** cùng migration tại dòng 271 chuyển NULL token/cost thành 0; dòng 276 chỉ chấp nhận `success`, `error_with_usage`, `error_no_usage`. Quyết định MUST định nghĩa bảng known-zero/known-positive/partial/unknown, quota status, numeric fields, nơi lưu uncertainty và cách consumer phân biệt unknown với measured-zero. Nếu dùng số 0 làm compatibility sentinel, nó MUST có dấu hiệu uncertainty phân biệt được; không được trình bày như số đo thật hoặc tự refund request.

Phase 3 MUST NOT bắt đầu trước khi cả hai quyết định được review. Phase 3 mới kiểm chứng chúng bằng fault injection và contract tests; không mặc định phải thêm queue/database/platform. Nếu cần đổi SQL, phải tách change với quality gates và live-write approval riêng, không nới scope ngầm. Một giới hạn được người dùng chấp nhận phải được phản ánh nhất quán trong normative spec trước implementation, không chỉ ghi trong ghi chú.

## Deployment and Operations

- The service SHALL run as a container on the Oracle VM, with signing/provider secrets mounted/provided outside the image. Cloudflare Access client ID/secret SHALL remain only in the Next.js BFF; Go SHALL verify the trusted ingress plus its own HMAC and MUST NOT require the Access client secret as a Go readiness dependency.
- Go SHALL bind only to loopback/private service interfaces. The raw port SHALL not be exposed publicly.
- Cloudflare Tunnel SHALL provide the chat route; Cloudflare Access service-token headers SHALL be injected only by the trusted BFF path.
- `/healthz` SHALL report process health and `/readyz` SHALL report configuration, provider and capability readiness without making an unsafe model call. Both endpoints SHALL bind to loopback/private probe access and MUST NOT be published through the Cloudflare Tunnel chat hostname.
- Before deploy, the service SHALL mark readiness false, stop accepting new chat requests, allow active streams to drain for 60-90 seconds, cancel remaining work, and complete bounded usage reconciliation. The normal reserve-to-finalize budget is at most 55 seconds plus up to 5 seconds of cleanup; the deployment drain window is a separate process grace period and does not extend a request deadline. Reservation TTL SHALL remain at least 120 seconds, while deployment grace SHALL be at least the selected drain window plus cleanup margin.
- Images SHALL be addressed by digest. After the first verified Go release, the operator SHALL retain a verified previous Go image for rollback. Rollback is an operator image/configuration action; the request path SHALL not fall back to the old Next.js orchestrator. Before a first verified Go release exists, a failed candidate leaves the Go route unavailable and blocks cutover rather than promising an impossible image rollback.
- Logs and metrics SHALL include request ID, app/capability ID, model/provider label, latency, outcome and usage classification while excluding sensitive content.

## Migration Plan

Implementation SHALL proceed through the ten reviewable phases represented by `tasks.md`. Each phase MUST stop at its review gate; completion MUST NOT imply approval to start the next phase, deploy to the VM, write live data or cut over traffic.

0. **Baseline + Eino proof:** characterize route/tool/stream/draft/quota behavior, then prove Eino stream events, tool loop, structured extraction, total usage, cancellation, HMAC canonicalization and future-skew replay handling. Pause for review before scaffolding the migration.
1. **Shared core/provider:** implement the app-neutral contracts, Eino orchestration and only the provider transport needed for parity. Pause on provider/stream evidence.
2. **QLTBYT data/tools:** add the capability adapter, tenant/facility policy, RPC adapters, `ai_query_tool` guardrails/audit and second-app boundary fixture. Any missing DB role/audit function pauses for a separate SQL gate.
3. **Draft/quota/kill switch:** move draft orchestration, extraction, usage lifecycle, conservative unknown-usage handling, compaction and fail-closed kill switch. Pause on parity evidence.
4. **HTTP/auth/SSE/abort:** implement `ai-service-v1` signed HTTP, key binding, replay quarantine, bounded admission, Vercel UI stream and cleanup context. Pause on contract/security review.
5. **Dark BFF/UI integration:** wire a non-default BFF path and UI contract tests while the existing runtime remains active. No production traffic or fallback semantics change.
6. **Oracle operations artifacts:** prepare image, external secrets, local health probes, readiness/drain/rollback runbook and Tunnel/Access configuration. No live apply is implied.
7. **Authorized dark VM smoke:** only after separate operator authorization, deploy one instance on Oracle and run local health probes plus BFF-to-chat Tunnel smoke. A missing previous Go image means fail-closed/unavailable, not a promised rollback.
8. **Exact-commit acceptance + direct cutover:** run all parity, security, cancellation, usage, UI and operational gates on one commit; after explicit cutover approval, make Go the sole `/api/chat` backend with no legacy runtime fallback.
9. **Cleanup:** after stable operation, remove/deactivate unreachable old model/tool orchestration and update docs. Preserve a verified Go image rollback path; do not add a legacy runtime fallback.

## Risks / Trade-offs

- **Stream drift:** Vercel AI SDK parts and current mixed envelopes may differ from a Go encoder. Mitigate with captured stream fixtures and a UI contract test before switching traffic.
- **Authorization drift:** Moving tools across a process boundary can weaken tenant/facility rules. Keep authorization in the QLTBYT adapter, sign normalized claims, and test global/admin role normalization explicitly.
- **Usage uncertainty:** A provider may omit usage on cancellation or stream errors. Preserve unknown status and reconciliation evidence instead of guessing tokens.
- **Over-generalization:** A generic registry can become a platform prematurely. Keep only internal capability registration and one real boundary fixture in MVP.
- **VM dependency:** Cloudflare or VM outage makes chat unavailable. Return a controlled error while unrelated web functions continue; use operator image rollback and health/readiness evidence.

## Open Questions

- Exact Cloudflare hostname, Access application IDs and Oracle operator command paths are deployment values to be recorded in the runbook during implementation.
- Whether durable replay protection is required beyond the bounded in-memory/process window is a later operational decision; it is not silently solved with a live schema change here.
