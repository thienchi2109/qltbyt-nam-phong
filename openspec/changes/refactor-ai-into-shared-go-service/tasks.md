# Kế hoạch triển khai

Kiến trúc đã duyệt là shared Go + Eino core app-neutral; QLTBYT capability adapter sở hữu `don_vi`, RPC, policy, prompt và domain tools; UI vẫn dùng Vercel AI SDK; chat đi qua Cloudflare Tunnel/Access + HMAC. MVP là một replica, không Bifrost, không platform onboarding, không server-side chat persistence. SQL/schema change không được ngầm thêm vào change này; nếu cần phải tách gated change riêng.

## Phase 0 - Baseline, fixture và compatibility proof

Phạm vi/sở hữu: Characterization của route hiện tại `/api/chat` và `src/lib/ai/**`. Route này đã gọi `maybeBuildRepairRequestDraftArtifact`. Predecessor `add-assistant-repair-request-draft-orchestration` là ngữ cảnh spec, không phải baseline duy nhất, và checklist của predecessor không được sửa.

Phụ thuộc: Route hiện tại và predecessor ở trên; không sửa checklist predecessor.

Bằng chứng nghiệm thu: Fixture cho request/auth/intent/tool/stream/draft/quota/error, compatibility report, provider adapter report và security report.

- [x] 0.1 Đóng băng fixture UI/tool cho cả mixed tool envelope và raw draft output, gồm text, tool, artifact, sanitized error và terminal stream. Fixture này không đóng băng accounting hiện tại, gồm `classifyStreamFailure` đang ép usage thiếu thành 0 và luôn trả `error_with_usage`.
- [x] 0.2 Ghi nhận parity draft của route hiện tại, nơi `maybeBuildRepairRequestDraftArtifact` đã chạy. Giữ draft-only/no-submit. Predecessor chỉ là ngữ cảnh; không đánh dấu checklist predecessor.
- [x] 0.3 Chạy Eino spike với provider giả cho stream, tool loop, structured extraction, tổng usage primary + secondary và cancellation thật. Secondary usage trong spike là accounting đích, không phải bằng chứng rằng route hiện tại đã cộng usage đó vào reservation.
- [x] 0.4 Lập inventory read-only các transport hiện có: `gateway` (default, default model `google/gemini-3.1-flash-lite-preview`), `google` và `openai-compatible`, cùng model options đã cấu hình. Ghi Google in-process key pool, rotation khi quota error, hourly exhaustion reset, và cách route dùng `getKeyPoolSize`. Phase 0 review giữ cả ba transport; không tự port mọi nhánh. Dùng stub HTTP chứng minh SDK/adapter compatibility cho các path; paid/provider smoke để gate riêng.
- [x] 0.5 Trước security proof, ghi và review tham số HMAC: thuật toán và encoding chữ ký, tên header, đơn vị timestamp, clock skew cho phép, cửa sổ validity/replay, và sức chứa nonce hữu hạn. Proof dùng đúng các giá trị đã ghi, chứng minh HMAC, issuer/audience, body digest, key registry, key rotation và nonce replay; replay qua restart/rotation fail-closed. MVP không có verified replay snapshot. Readiness false và từ chối request trong toàn bộ maximum prior-request validity cộng allowed clock-skew quarantine; sau đó chỉ nhận request khi nonce guard và key registry hợp lệ.
- [x] 0.6 Chứng minh abort dừng provider/tool work và finalize usage theo trạng thái quan sát được.
- [x] 0.7 Ghi quyết định recovery/accounting khi process bị SIGKILL/OOM sau khi provider đã phát sinh usage nhưng trước finalize. Append-only journal chứng minh recovery trước expiry và ghi nhận unknown khi quan sát bị mất. User chấp thuận ngày 2026-09-25 rằng crash recovery chỉ bắt đầu sau reservation expiry có thể để provider cost đã phát sinh nhưng DB quota/token accounting bị undercount vì `ai_quota_finalize` bỏ qua reservation hết hạn; chấp thuận này không bao gồm mất accounting trước expiry. Không dùng detached cleanup/TTL làm bằng chứng recovery; nếu cần SQL thì tách change có quality gates và approval riêng.
- [x] 0.8 Ghi bảng mapping usage known-zero/known-positive/partial/unknown sang quota status, numeric fields và nơi lưu dấu hiệu uncertainty. Đây là sửa accounting có chủ đích, không phải parity UI/tool. Đối chiếu `ai_quota_finalize` hiện chỉ có ba status và chuyển NULL thành 0. Giữ zero compatibility sentinel kèm uncertainty marker phân biệt được; missing/invalid usage là `unknown`, `knownZero` vẫn là measured zero, và missing một dimension giữ dimension còn biết dưới `partial`. Không bịa status mới và không DDL. Bảng đã review trở thành normative trước Phase 3.
- [x] 0.9 Chốt và review cơ chế QLTBYT Go → Supabase/RPC authentication bằng application-owned BFF RPC broker, và gọi tên `assistant_query_database_audit_log` trong quyết định credential đó. BFF giữ `SUPABASE_JWT_SECRET`, cấp envelope ngắn hạn với trusted numeric `user_id`, allowlist RPC, cancellation/audit propagation và bounded cleanup; Go không nhận project-wide signing secret hoặc browser cookie. DB auth mới cần SQL gate riêng.

Điểm dừng/review: Dừng trước khi scaffold full migration. Chưa sang Phase 1 khi thiếu một proof bắt buộc hoặc khi quyết định 0.7, 0.8 hoặc 0.9 chưa được review. Phase 0 hiện đã có evidence/review cho 0.1-0.9, nhưng việc hoàn tất Phase 0 không tự động cho phép Phase 1; cần user duyệt bước tiếp theo. Gate Phase 2 cho 0.9 và gate Phase 3 cho 0.7/0.8 là defense in depth. Quyết định thiết kế đạt không thay thế test implementation tại các phase sau.

Deploy/live DB: Chỉ local/mock/stub; không deploy, không ghi live DB, không migration/DDL.

## Phase 1 - Shared Go + Eino core và second-app fixture

Phạm vi/sở hữu: `services/ai-service/**` với request, registry, Eino execution, provider adapter, normalized events, usage interface, cancellation và sanitized errors.

Phụ thuộc: Phase 0 compatibility/security proof, bản ghi HMAC đã review, version Eino/provider đã pin, và quyết định 0.7/0.8/0.9 đã được review. Thiếu proof hoặc một trong ba quyết định chưa được review thì không bắt đầu Phase 1. Gate Phase 2 và Phase 3 phía dưới là defense in depth.

Bằng chứng nghiệm thu: Go unit/contract tests, provider mock tests, boundary test và second-app compile/run report.

- [x] 1.1 Tạo Go module tối thiểu, pin version Go toolchain và Eino, và chỉ thêm provider integration cho behavior Phase 0 quyết định giữ. Vercel không build module này. Change này không thêm CI platform mới.
- [x] 1.2 Định nghĩa protocol/version, request correlation, capability descriptor, normalized text/tool/artifact/error event và usage contract app-neutral.
- [x] 1.3 Implement Eino model/tool loop, workflow cancellation, tool-step/input/output limits và bounded retry policy; giữ nguyên user Eino code đã tương thích, chỉ bọc adapter tối thiểu, không rewrite vô cớ.
- [x] 1.4 Đặt model options, streaming, tool calls, structured extraction và usage sau provider adapter; không đưa provider SDK vào capability.
- [x] 1.5 Implement capability registry versioned lookup; core không import QLTBYT, `don_vi`, RPC, `ai_quota_*` hoặc Supabase global assumption.
- [x] 1.6 Thêm second-app fixture compile/run shared core mà không import package hoặc default identifier QLTBYT.

Điểm dừng/review: Review boundary shared core trước khi đưa prompt, authorization hoặc RPC QLTBYT vào service.

Deploy/live DB: Chỉ build/test local; chưa tạo release container, chưa gọi live DB, không SQL change.

## Phase 2 - QLTBYT RPC, query guardrail và prompt

Phạm vi/sở hữu: QLTBYT capability adapter trong `services/ai-service/**`, gồm prompt, intent, tools, artifacts, signed claims, tenant/facility policy và RPC/Supabase access.

Phụ thuộc: Phase 1 core/adapter contracts và quyết định authentication 0.9 đã review ở Phase 0, gồm credential cho `assistant_query_database_audit_log`. Gate này là defense in depth: 0.9 chưa review thì Phase 1 đã bị chặn, và Phase 2 vẫn không bắt đầu. Phải xác nhận các RPC/policy primitive hiện hữu.

Bằng chứng nghiệm thu: Authorization, parser/catalog, timeout/limit, audit redaction và prompt/compaction tests.

- [x] 2.1 Đưa prompt, intent routing, tool allowlist, evidence rules và artifact schemas vào QLTBYT adapter.
- [x] 2.2 Implement RPC/Supabase adapter với signed user claims, `admin` = `global`, tenant/facility scope và không cấp broad `service_role`.
- [x] 2.3 Giữ `query_database` QLTBYT-only, dùng `ai_query_tool` read-only role/connection, approved schema/catalog, statement allowlist, timeout, row/cell limit và cấm DDL/DCL/write.
- [x] 2.4 Gọi `assistant_query_database_audit_log` với các field RPC đang bắt buộc: `p_sql_shape` đã sanitize, nonempty, tối đa 1000 ký tự (hash không thay thế shape), `p_tool_path` đúng `query_database`, `p_status`, `p_latency_ms`, `p_effective_facility_id`, `p_facility_source` là `selected` hoặc `session`, và `p_error_class` khi failure. Credential mang numeric `user_id` claim. Tiếp tục gửi các field optional mà audited executor hiện gửi: `p_row_count`, `p_payload_bytes`, `p_requested_facility_id`, `p_session_facility_id`, `p_raw_role`. Success: execute, audit, rồi mới release; audit failure trên success chặn release. Failure: audit best-effort, nuốt lỗi audit, ném lại lỗi SQL gốc. Không trả kết quả success rỗng. Operational log không lưu raw prompt hoặc sensitive result.
- [x] 2.5 Compaction bounded cho tool/RPC results trước model; clarification không bị compaction hoặc model-execution budget gate loại bỏ. Clarification trả về trước reserve không tiêu thụ reservation.
- [x] 2.6 Viết test chứng minh thiếu role/connection hoặc DB audit path thì tool disabled; stdout/log redacted không thay thế audit DB, còn nhu cầu DDL/audit schema được ghi thành SQL change và quality gate riêng.
- [x] 2.7 Kiểm chứng cơ chế authentication đã chọn ở 0.9 bằng negative tests cho credential hết hạn/sai audience, claims giả từ browser, scope sai và secret thiếu; chứng minh cancellation/audit propagation và bounded quota cleanup không mở rộng quyền.

Điểm dừng/review: Không bật `query_database` khi guardrail hoặc audit path chưa đủ; mọi SQL provisioning là scope riêng, chưa được ủy quyền ở đây.

Deploy/live DB: Mock/local hoặc read-only boundary; không tự ý ghi live DB và không thêm migration.

## Phase 3 - Domain drafts, quota, kill-switch và full usage

Phạm vi/sở hữu: QLTBYT draft workflow, secondary extraction, quota lifecycle, kill-switch, compaction budget và usage metrics.

Phụ thuộc: Phase 2 QLTBYT RPC/policy, Phase 0 usage/cancellation proof và quyết định 0.7/0.8 đã được review. Đây là defense in depth: thiếu review thì Phase 1 đã bị chặn, và Phase 3 vẫn không bắt đầu. Mapping 0.8 phải đã nằm trong normative spec trước implementation Phase 3. Nếu quyết định cần SQL, dependency SQL phải hoàn tất gate phù hợp trước phần implementation phụ thuộc.

Bằng chứng nghiệm thu: Draft parity, quota idempotency/reconciliation, unknown-usage, kill-switch và TTL tests.

- [x] 3.1 Chuyển repair-request draft orchestration, secondary structured extraction và artifact mapping vào adapter; vẫn advisory draft-only/no-submit. Giữ parity UI/artifact; việc đưa secondary usage vào quota lifecycle là sửa accounting, không phải đóng băng hành vi `onFinish` hiện tại.
- [x] 3.2 Tích hợp `ai_quota_reserve` và `ai_quota_finalize` vào một lifecycle cho cả primary và secondary usage theo mapping 0.8.
- [x] 3.3 Làm finalize idempotent với bounded retry/reconciliation; phân biệt observed usage, error-with-usage và error-without-usage. Evidence của bounded cleanup, failure handling và reconciliation phải nằm trong allowance đề xuất ở 4.5; proof thất bại thì dừng để normative amendment đã review.
- [x] 3.4 Áp dụng mapping 0.8 đã trở thành normative. Không trình bày unknown/partial như measured-zero, không tự invent token count, không bịa status mới và không DDL. Nếu dùng 0 làm compatibility sentinel thì phải có uncertainty marker phân biệt được, và không dùng sentinel đó để refund hoặc đóng reservation giả.
- [x] 3.5 Giữ kill-switch: environment override thắng, cache 8 giây sau lần đọc database thành công, cache 2 giây sau lỗi đọc database, và fail closed trước model/tool work.
- [x] 3.6 Xác nhận `quotaTTL >= 120s` và đủ cho worst-case elapsed từ reserve tới finalize. Drain grace là trần 60-90 giây, không kéo dài request deadline và không phải khoảng gián đoạn cố định bắt buộc; không cộng máy móc deadline 55 giây với thời gian drain. Budget đề xuất 55 giây việc cộng tối đa 5 giây cleanup nằm trong 60 giây hiện có. Ghi metric usage classification.
- [x] 3.7 Kiểm chứng quyết định 0.7 bằng fault injection ở ranh giới reserve/provider/finalize và restart trước/sau reservation expiry; chứng minh recovery hoặc giới hạn đã được duyệt, không claim full recovery chỉ từ graceful shutdown.
- [x] 3.8 Kiểm chứng bảng mapping 0.8 với known-zero, partial, unknown và finalize lặp; chứng minh uncertainty vẫn phân biệt được với measured-zero tại nơi lưu đã chọn, không silently refund hoặc double-count.

Điểm dừng/review: Review domain safety và quota evidence; thiếu secondary usage, unknown semantics hoặc kill-switch fail-closed thì chưa sang transport.

Deploy/live DB: Chỉ mock/staging contract test; không thay schema, không live write, không migration.

## Phase 4 - Authenticated HTTP/SSE, replay, abort và deadlines

Phạm vi/sở hữu: Go transport `POST /v1/chat`, HMAC/replay verification, SSE encoder, request limits, cancellation và error contract.

Phụ thuộc: Phase 0 security proof, Phase 1 core, Phase 2 policy và Phase 3 usage/finalize.

Bằng chứng nghiệm thu: HTTP/SSE contract, event ordering, auth/replay, abort, deadline, admission và sanitized-error tests.

- [ ] 4.1 Implement `POST /v1/chat` với protocol/capability version, body/message/tool-step limits và request correlation.
- [ ] 4.2 Verify signed identity envelope bằng tham số HMAC đã ghi ở 0.5: issuer/audience, timestamp skew, body digest, key ID, nonce uniqueness và capability authorization. Dùng full validity cộng clock-skew quarantine. MVP không có verified-snapshot exception.
- [ ] 4.3 Encode Vercel AI SDK UI Message Stream v1, giữ text/tool/artifact/error parts và completion order draft trước terminal `finish`/`DONE`.
- [ ] 4.4 Propagate browser disconnect/abort qua HTTP, Eino, provider, tool và RPC; cancellation không tạo work mới.
- [ ] 4.5 Giữ BFF budget mặc định 60 giây, đúng `maxDuration` hiện tại. Budget đề xuất: Go làm việc tối đa 55 giây tính từ đầu request gốc, cleanup tối đa 5 giây trong cùng 60 giây đó. Go nhận phần deadline còn lại sau ingress/network margin và không reset mỗi request thành 55 giây khi vừa tới Go. Phải có evidence cho bounded cleanup, failure handling và reconciliation trong allowance này. Nếu proof thất bại, dừng để sửa normative đã được review; không kết luận 5 giây là không đủ khi chưa có evidence. Admission quá tải trả stable retryable error.
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

- [ ] 6.1 Tạo image digest-addressed cho Go service bằng Go toolchain đã pin ở Phase 1, secrets ngoài image, loopback/private bind và resource limits. Credential của container tách khỏi `qltbyt_test`. Vercel không build `services/ai-service`. Change này không thêm CI platform mới.
- [ ] 6.2 Cấu hình Tunnel + Access cho chat SSE; raw service port không public, Access client secret chỉ ở trusted BFF.
- [ ] 6.3 Đảm bảo `/healthz` và `/readyz` chỉ probe local/private; readiness gồm config/provider/capability/replay guard, không unsafe model call.
- [ ] 6.4 Implement readiness false, stop admission, graceful drain với trần 60-90 giây (trần tối đa, không phải khoảng gián đoạn cố định bắt buộc; process idle được thoát sớm). Timeout dừng của container/orchestrator phải bao selected drain period cộng bounded cleanup margin và không SIGKILL trước khi drain cùng cleanup hoàn tất. Grace này tách khỏi reservation TTL và deadline request 55+5. Giữ active-stream deadline, cancellation và bounded quota reconciliation.
- [ ] 6.5 Retain verified previous Go image/config khi đã có. Dark first deploy chưa có image trước đó mà thất bại thì để candidate unavailable và chặn cutover; việc đó không tự tắt chat production hiện tại. Sau cutover không tạo fallback về Next.js orchestrator.
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
- [ ] 7.4 Chạy cancel/abort, primary+secondary usage, idempotent finalize, unknown usage, drain grace tối đa 60-90 giây và `quotaTTL >= 120s`.
- [ ] 7.5 Kiểm tra secret không ở image/log. Sau cutover không có fallback old runtime. Dark smoke fail khi chưa có verified Go image trước đó thì chặn cutover và không tự tắt chat production hiện tại. Rollback image chỉ khi image Go trước đó tồn tại.
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
- [ ] 8.5 Sau cutover không có runtime fallback về Next.js model/tool orchestration. Rollback chỉ khôi phục Go image/config đã verify khi image trước đó tồn tại. Nếu sau cutover không còn image Go trước đó và candidate fail, route đã cutover ở trạng thái unavailable. Dark first deploy thất bại thì khác: nó chỉ chặn cutover và không tự tắt chat production hiện tại.
- [ ] 8.6 Xác nhận SSE qua Tunnel, health/readiness local only, budget đề xuất 55 giây việc cộng tối đa 5 giây cleanup trong BFF 60 giây, drain grace tối đa 60-90 giây, full primary+secondary usage và `openspec validate ... --strict`.

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
