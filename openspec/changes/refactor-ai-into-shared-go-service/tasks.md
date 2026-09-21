# Kế hoạch triển khai

Kiến trúc đã duyệt là shared Go + Eino core app-neutral; QLTBYT capability adapter sở hữu `don_vi`, RPC, policy, prompt và domain tools; UI vẫn dùng Vercel AI SDK; chat đi qua Cloudflare Tunnel/Access + HMAC. MVP là một replica, không Bifrost, không platform onboarding, không server-side chat persistence. SQL/schema change không được ngầm thêm vào change này; nếu cần phải tách gated change riêng.

## Phase 0 - Baseline, fixture và compatibility proof

Phạm vi/sở hữu: Characterization của `/api/chat`, `src/lib/ai/**`, draft/quota/stream fixtures và Eino compatibility spike.

Phụ thuộc: Route hiện tại và predecessor `add-assistant-repair-request-draft-orchestration`; không sửa checklist predecessor.

Bằng chứng nghiệm thu: Fixture cho request/auth/intent/tool/stream/draft/quota/error, compatibility report, provider adapter report và security report.

- [ ] 0.1 Đóng băng fixture cho cả mixed tool envelope và raw draft output, gồm text, tool, artifact, sanitized error và terminal stream.
- [ ] 0.2 Ghi nhận parity của predecessor repair-request draft, giữ draft-only/no-submit và không đánh dấu checklist predecessor.
- [ ] 0.3 Chạy Eino spike với provider giả cho stream, tool loop, structured extraction, tổng usage primary + secondary và cancellation thật.
- [ ] 0.4 Ghi nhận transport/model options thực tế đã cấu hình ở chế độ read-only; dùng stub HTTP chứng minh SDK/adapter compatibility, còn paid/provider smoke để gate riêng.
- [ ] 0.5 Chứng minh HMAC, issuer/audience, body digest, key registry, key rotation và nonce replay; replay qua restart/rotation phải fail-closed, không dựa vào boot time đơn độc.
- [ ] 0.6 Chứng minh abort dừng provider/tool work và finalize usage theo trạng thái quan sát được.

Điểm dừng/review: Dừng trước khi scaffold full migration; thiếu stream, provider-options, cancellation, usage hoặc replay proof thì chưa sang Phase 1.

Deploy/live DB: Chỉ local/mock/stub; không deploy, không ghi live DB, không migration/DDL.

## Phase 1 - Shared Go + Eino core và second-app fixture

Phạm vi/sở hữu: `services/ai-service/**` với request, registry, Eino execution, provider adapter, normalized events, usage interface, cancellation và sanitized errors.

Phụ thuộc: Phase 0 compatibility proof và version Eino/provider đã pin.

Bằng chứng nghiệm thu: Go unit/contract tests, provider mock tests, boundary test và second-app compile/run report.

- [ ] 1.1 Tạo Go module tối thiểu, pin Eino và chỉ thêm provider integration cần cho behavior hiện tại.
- [ ] 1.2 Định nghĩa protocol/version, request correlation, capability descriptor, normalized text/tool/artifact/error event và usage contract app-neutral.
- [ ] 1.3 Implement Eino model/tool loop, workflow cancellation, tool-step/input/output limits và bounded retry policy; giữ nguyên user Eino code đã tương thích, chỉ bọc adapter tối thiểu, không rewrite vô cớ.
- [ ] 1.4 Đặt model options, streaming, tool calls, structured extraction và usage sau provider adapter; không đưa provider SDK vào capability.
- [ ] 1.5 Implement capability registry versioned lookup; core không import QLTBYT, `don_vi`, RPC, `ai_quota_*` hoặc Supabase global assumption.
- [ ] 1.6 Thêm second-app fixture compile/run shared core mà không import package hoặc default identifier QLTBYT.

Điểm dừng/review: Review boundary shared core trước khi đưa prompt, authorization hoặc RPC QLTBYT vào service.

Deploy/live DB: Chỉ build/test local; chưa tạo release container, chưa gọi live DB, không SQL change.

## Phase 2 - QLTBYT RPC, query guardrail và prompt

Phạm vi/sở hữu: QLTBYT capability adapter trong `services/ai-service/**`, gồm prompt, intent, tools, artifacts, signed claims, tenant/facility policy và RPC/Supabase access.

Phụ thuộc: Phase 1 core/adapter contracts; phải xác nhận các RPC/policy primitive hiện hữu.

Bằng chứng nghiệm thu: Authorization, parser/catalog, timeout/limit, audit redaction và prompt/compaction tests.

- [ ] 2.1 Đưa prompt, intent routing, tool allowlist, evidence rules và artifact schemas vào QLTBYT adapter.
- [ ] 2.2 Implement RPC/Supabase adapter với signed user claims, `admin` = `global`, tenant/facility scope và không cấp broad `service_role`.
- [ ] 2.3 Giữ `query_database` QLTBYT-only, dùng `ai_query_tool` read-only role/connection, approved schema/catalog, statement allowlist, timeout, row/cell limit và cấm DDL/DCL/write.
- [ ] 2.4 Emit audit query đã sanitize bằng request ID, capability, subject, SQL shape/hash, scope và outcome; không lưu raw prompt hoặc sensitive result.
- [ ] 2.5 Compaction bounded cho tool/RPC results trước model; clarification không bị compaction hoặc model-execution budget gate loại bỏ.
- [ ] 2.6 Viết test chứng minh thiếu role/connection hoặc DB audit path thì tool disabled; stdout/log redacted không thay thế audit DB, còn nhu cầu DDL/audit schema được ghi thành SQL change và quality gate riêng.

Điểm dừng/review: Không bật `query_database` khi guardrail hoặc audit path chưa đủ; mọi SQL provisioning là scope riêng, chưa được ủy quyền ở đây.

Deploy/live DB: Mock/local hoặc read-only boundary; không tự ý ghi live DB và không thêm migration.

## Phase 3 - Domain drafts, quota, kill-switch và full usage

Phạm vi/sở hữu: QLTBYT draft workflow, secondary extraction, quota lifecycle, kill-switch, compaction budget và usage metrics.

Phụ thuộc: Phase 2 QLTBYT RPC/policy và Phase 0 usage/cancellation proof.

Bằng chứng nghiệm thu: Draft parity, quota idempotency/reconciliation, unknown-usage, kill-switch và TTL tests.

- [ ] 3.1 Chuyển repair-request draft orchestration, secondary structured extraction và artifact mapping vào adapter; vẫn advisory draft-only/no-submit.
- [ ] 3.2 Tích hợp `ai_quota_reserve` và `ai_quota_finalize` vào một lifecycle cho cả primary và secondary usage.
- [ ] 3.3 Làm finalize idempotent với bounded retry/reconciliation; phân biệt observed usage, error-with-usage và error-without-usage.
- [ ] 3.4 Giữ unknown usage là unknown, không tự invent token count, không coi là zero để refund hoặc đóng reservation giả.
- [ ] 3.5 Giữ kill-switch: environment override thắng, DB status cache TTL ngắn, read error dùng error TTL ngắn và fail closed trước model/tool work.
- [ ] 3.6 Xác nhận `quotaTTL >= 120s` và đủ cho worst-case elapsed từ reserve tới finalize; drain 60-90s không kéo dài request deadline, không cộng máy móc deadline 55s với thời gian drain, và phải ghi metric usage classification.

Điểm dừng/review: Review domain safety và quota evidence; thiếu secondary usage, unknown semantics hoặc kill-switch fail-closed thì chưa sang transport.

Deploy/live DB: Chỉ mock/staging contract test; không thay schema, không live write, không migration.

## Phase 4 - Authenticated HTTP/SSE, replay, abort và deadlines

Phạm vi/sở hữu: Go transport `POST /v1/chat`, HMAC/replay verification, SSE encoder, request limits, cancellation và error contract.

Phụ thuộc: Phase 0 security proof, Phase 1 core, Phase 2 policy và Phase 3 usage/finalize.

Bằng chứng nghiệm thu: HTTP/SSE contract, event ordering, auth/replay, abort, deadline, admission và sanitized-error tests.

- [ ] 4.1 Implement `POST /v1/chat` với protocol/capability version, body/message/tool-step limits và request correlation.
- [ ] 4.2 Verify signed identity envelope gồm issuer/audience, timestamp skew, body digest, key ID, nonce uniqueness và capability authorization.
- [ ] 4.3 Encode Vercel AI SDK UI Message Stream v1, giữ text/tool/artifact/error parts và completion order draft trước terminal `finish`/`DONE`.
- [ ] 4.4 Propagate browser disconnect/abort qua HTTP, Eino, provider, tool và RPC; cancellation không tạo work mới.
- [ ] 4.5 Đặt BFF budget mặc định 60s; Go nhận phần deadline còn lại sau ingress/network margin và cleanup budget, có hard cap tối đa 55s nhưng không reset mỗi request thành 55s khi vừa tới Go; admission quá tải trả stable retryable error.
- [ ] 4.6 Giữ `/healthz`/`/readyz` local/private, pre-stream JSON và post-stream sanitized error, `X-Request-ID`, không log prompt/SQL/token/secret.

Điểm dừng/review: Dừng nếu auth/replay không fail closed, SSE drift, abort không xuyên suốt hoặc deadline không đủ cleanup budget.

Deploy/live DB: Local/container test only; chưa route production traffic, không live DB write, không SQL.

## Phase 5 - Dark Next BFF và UI fixtures

Phạm vi/sở hữu: Next.js BFF dark path cho session/signing/stream proxy và UI contract fixtures; current runtime path giữ nguyên.

Phụ thuộc: Phase 4 authenticated service và parity fixtures Phase 0-3.

Bằng chứng nghiệm thu: BFF contract, UI/user-event, stream passthrough, browser abort và configuration fail-closed tests.

- [ ] 5.1 Thêm dark BFF path validate session, shape canonical request, sign envelope và proxy Go stream.
- [ ] 5.2 Giữ browser request shape, Vercel AI SDK, current tool/artifact renderers và mixed/raw output compatibility; bảo toàn `error.code=ai_usage_limited`, `reason`, `retryAfterMs` và countdown bằng mapping từ generic Go error.
- [ ] 5.3 Đặt Cloudflare Access service-token headers và HMAC credentials trong server-only secrets; thiếu/invalid config fail closed.
- [ ] 5.4 Thêm UI fixtures cho text, tool card, report/chart, repair draft, sanitized error, stop/cancel và stream completion.
- [ ] 5.5 Chạy browser/user-event contract chứng minh abort truyền tới dark Go path và không đổi current UI behavior.
- [ ] 5.6 Ghi rõ dark path không phải fallback runtime; chỉ là đường kiểm thử trước cutover.

Điểm dừng/review: Review dark evidence với UI owner; chưa có cutover authorization thì không đổi current `/api/chat` traffic.

Deploy/live DB: Dark-only, không production routing, không live traffic, không live DB write.

## Phase 6 - Oracle container, Tunnel và vận hành

Phạm vi/sở hữu: Container/image artifacts, Cloudflare Tunnel/Access config, local health/readiness, secrets, drain, rollback và operator runbook.

Phụ thuộc: Phase 4 service contract và Phase 5 dark BFF; operator hostname/paths phải được ghi rõ.

Bằng chứng nghiệm thu: Image digest, secret/config scan, local health/readiness, Tunnel route, drain/rollback và redacted observability report.

- [ ] 6.1 Tạo image digest-addressed cho Go service, secrets ngoài image, loopback/private bind và resource limits.
- [ ] 6.2 Cấu hình Tunnel + Access cho chat SSE; raw service port không public, Access client secret chỉ ở trusted BFF.
- [ ] 6.3 Đảm bảo `/healthz` và `/readyz` chỉ probe local/private; readiness gồm config/provider/capability/replay guard, không unsafe model call.
- [ ] 6.4 Implement readiness false, stop admission, graceful drain 60-90s, active-stream deadline, cancellation và bounded quota reconciliation.
- [ ] 6.5 Retain verified previous Go image/config khi đã có; ở first deploy chưa có image trước đó thì rollback unavailable phải fail closed/giữ service unavailable, và không tạo fallback về old Next.js orchestrator.
- [ ] 6.6 Ghi logs/metrics chỉ gồm request ID, app/capability, provider/model, latency, outcome, usage classification; không có sensitive content.

Điểm dừng/review: Review ops artifacts trước khi chạm Oracle VM; thiếu local-only health hoặc raw-port isolation thì không deploy.

Deploy/live DB: Chỉ chuẩn bị artifacts/config; chưa deploy VM, chưa gửi chat qua Tunnel, không live DB write/migration.

## Phase 7 - Dark VM deployment và smoke có ủy quyền

Phạm vi/sở hữu: Một replica Go trên Oracle VM, Tunnel/Access dark route và smoke bằng test data/disposable dependencies.

Phụ thuộc: Phase 6 ops artifacts và explicit operation-specific authorization cho dark VM deploy/smoke.

Bằng chứng nghiệm thu: Exact image digest, redacted VM/Tunnel logs, smoke report, request IDs, usage/quota evidence và rollback/drain evidence.

- [ ] 7.1 Ghi authorization cụ thể trước khi deploy; readiness phải false cho tới khi config/provider/capability/replay guard khởi tạo xong.
- [ ] 7.2 Deploy đúng một Go replica theo image digest qua Tunnel/Access, không expose raw port.
- [ ] 7.3 Chạy smoke bằng test data: local health/readiness, chat SSE qua Tunnel, HMAC/replay, tool/RPC policy, draft, provider error và UI stream.
- [ ] 7.4 Chạy cancel/abort, primary+secondary usage, idempotent finalize, unknown usage, drain 60-90s và `quotaTTL >= 120s`.
- [ ] 7.5 Kiểm tra secret không ở image/log, không có fallback old runtime; khi smoke fail chỉ rollback nếu có verified Go image trước đó, còn first deploy không có image trước đó phải fail closed/giữ unavailable.
- [ ] 7.6 Nếu agent-run smoke chạm runtime quota/audit thật, liệt kê chính xác các operation và xin approval riêng; nếu không, chỉ dùng mock/disposable và không claim live PASS.

Điểm dừng/review: Dừng tại dark VM; thiếu evidence hoặc smoke failure block cutover và phải review trước lần thử lại.

Deploy/live DB: Được deploy dark VM sau authorization; mặc định dùng test data/read-only hoặc mocked DB path và không live DB write. Ngoại lệ duy nhất là smoke runtime quota/audit được ủy quyền riêng, phải liệt kê đúng operation ở 7.6; tuyệt đối không migration/DDL/schema change.

## Phase 8 - Exact-commit acceptance và direct cutover

Phạm vi/sở hữu: Acceptance manifest của cùng subject commit/image digest, direct `/api/chat` cutover, post-cutover evidence và no-fallback runtime.

Phụ thuộc: Phase 7 dark smoke PASS; không dùng evidence từ commit, image hoặc config khác.

Bằng chứng nghiệm thu: Subject commit + image digest, acceptance report, authorized cutover log, post-cutover smoke và no-fallback assertion.

- [ ] 8.1 Chốt subject commit, image digest, source/config/fixture hashes và chạy lại toàn bộ contract, parity, security, UI, cancellation, quota, Tunnel và operator checks trên cùng subject.
- [ ] 8.2 Xác nhận PASS cần đủ evidence bắt buộc trên cùng subject commit/digest; thiếu evidence là `BLOCKING / INCOMPLETE`, không claim DONE.
- [ ] 8.3 Chỉ sau explicit authorization direct cutover, chuyển `/api/chat` sang Go backend và giữ nguyên browser/Vercel AI SDK contract.
- [ ] 8.4 Sau cutover, production runtime phải thực hiện `ai_quota_reserve`/`ai_quota_finalize` và sanitized SQL audit theo capability policy; đây là behavior bắt buộc, không được tắt để né test.
- [ ] 8.5 Không có runtime fallback về Next.js model/tool orchestration; rollback chỉ khôi phục Go image/config đã verify khi image trước đó tồn tại, còn first deploy không có image trước đó phải fail closed/giữ unavailable.
- [ ] 8.6 Xác nhận SSE qua Tunnel, health/readiness local only, service deadline ngắn hơn BFF 60s, drain 60-90s, full primary+secondary usage và `openspec validate ... --strict`.

Điểm dừng/review: Nếu cần agent-run live smoke, phải có approval cho đúng các quota reserve/finalize và audit operations; nếu không thì smoke là mock/disposable và không được ghi live PASS.

Deploy/live DB: Direct deployment/cutover cần authorization. Runtime quota/audit writes là intended production behavior; không migration, DDL, administrative/manual live write. Schema/replay storage mới là SQL change gated riêng.

## Phase 9 - Dọn runtime AI cũ

Phạm vi/sở hữu: Legacy Next.js model/provider/tool orchestration và dead helpers; giữ UI shared imports, Vercel AI SDK types/renderers, fixtures và BFF contract còn dùng.

Phụ thuộc: Phase 8 exact-commit acceptance và post-cutover evidence; cleanup không bắt đầu trước direct path được chấp nhận.

Bằng chứng nghiệm thu: Không còn legacy runtime path/fallback, focused UI/API + Go tests, required checks và OpenSpec validation.

- [ ] 9.1 Liệt kê legacy runtime files/dependencies sau cutover và phân biệt rõ UI/shared imports còn sống.
- [ ] 9.2 Xóa old model/provider/tool orchestration và dead route helpers sau khi exact cutover đã ổn định.
- [ ] 9.3 Giữ lại UI shared imports, draft artifact renderer, request/stream types và fixtures nếu còn consumer; không xóa theo tên file.
- [ ] 9.4 Dùng `rg`/dependency graph chứng minh không còn runtime reference tới legacy orchestrator hoặc fallback.
- [ ] 9.5 Cập nhật runbook/OpenSpec evidence, rollback reference, ownership và follow-up cho Bifrost/platform/chat persistence/durable replay ngoài scope.
- [ ] 9.6 Chạy focused UI/API, Go, format/type/React checks và `openspec validate refactor-ai-into-shared-go-service --strict`; chỉ tick mục có evidence.

Điểm dừng/review: Final review kiểm tra rollback artifact vẫn dùng được và không có UI import bị xóa nhầm.

Deploy/live DB: Cleanup release sau review; không xóa UI shared imports, không migration/live DB write, không thêm Bifrost/platform/chat persistence.
