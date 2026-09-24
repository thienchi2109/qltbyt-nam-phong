## Why

Assistant hiện bị phân tán giữa Next.js route, Vercel AI SDK, prompt và intent modules, tool registry, RPC adapters, quota functions và repair-draft orchestration. Cấu trúc này khó vận hành như một service độc lập, đồng thời dễ làm cho quy tắc riêng của QLTBYT trở thành contract ngầm của một AI platform.

Thay đổi này định nghĩa một Go AI service dùng chung, phục vụ QLTBYT trước và có thể phục vụ app khác về sau. Browser vẫn giữ React và Vercel AI SDK làm interaction layer. Next.js vẫn là BFF xác thực và stream proxy; Go service sở hữu model orchestration, capability execution và provider integration trong một shared core không phụ thuộc app.

Baseline draft là route hiện tại `/api/chat`, nơi repair-draft builder đã chạy. Change đang chờ `add-assistant-repair-request-draft-orchestration` vẫn là predecessor và ngữ cảnh spec, không phải baseline duy nhất. Change này chuyển orchestration đó vào QLTBYT capability adapter sau khi chứng minh parity UI/tool; không sửa hoặc tự ý đánh dấu hoàn thành checklist của change kia.

## What Changes

- Thêm shared Go AI service trên Oracle VM, để web app gọi qua Cloudflare Tunnel và Cloudflare Access.
- Chọn Go + Eino làm orchestration stack mục tiêu. Eino SHALL sở hữu model/tool loop và workflow execution; maintained Eino/provider integrations SHALL được ưu tiên, còn official Go SDK chỉ nằm sau provider adapter khi integration đó không đáp ứng transport hiện tại.
- Định nghĩa shared core không phụ thuộc app cho request validation, capability routing, Eino execution, normalized events, streaming, cancellation, policy hooks, usage lifecycle và observability.
- Định nghĩa capability adapter để tool, prompt, tenant/facility policy, Supabase/RPC access, `ai_quota_*` policy, evidence normalization và repair-draft orchestration của QLTBYT nằm ngoài shared core.
- Giữ Next.js `/api/chat` là authentication boundary phía browser và proxy Vercel AI SDK UI Message Stream từ Go tới assistant UI hiện tại.
- Giữ parity UI và tool behavior hiện có, gồm intent routing, tool allowlist, các mixed tool-output envelopes, read-only operational tools, troubleshooting/report artifacts, repair-request draft card và draft-only/no-submit. Phải chứng minh parity này trước khi direct replacement. Fixture parity không đóng băng accounting quota hiện tại thành contract đích.
- Accounting quota là sửa có chủ đích, tách khỏi parity UI/tool. Usage của secondary structured draft extraction phải vào cùng lifecycle. Usage unknown/partial không được trình bày như measured-zero để hoàn tiền. Giữ ba status hiện có và lựa chọn zero compatibility sentinel kèm dấu hiệu uncertainty phân biệt được. Không bịa status mới và không DDL. Bảng mapping Phase 0.8 trở thành requirement normative trước Phase 3.
- Yêu cầu request cancellation thật và quota finalization idempotent: retry không được tạo hiệu lực tính quota lặp, đồng thời có bounded retry/reconciliation khi process crash. Budget đề xuất là tối đa 55 giây việc Go cộng tối đa 5 giây cleanup trong `maxDuration` 60 giây hiện có. Phải có evidence cho bounded cleanup, failure handling và reconciliation; nếu proof thất bại thì chỉ sửa bằng normative amendment đã review, không kết luận 5 giây là không đủ khi chưa có evidence.
- Audit `query_database` gọi `assistant_query_database_audit_log`. Payload bắt buộc gồm SQL shape đã sanitize và nonempty; hash không thay thế shape. Caller credential mang numeric user claim, kèm facility/source, latency và error class khi failure. Success là execute, rồi audit, rồi release. Failure là audit best-effort rồi trả lỗi SQL gốc. Audit failure không thành kết quả success rỗng.
- `selectedFacilityName` là display context không tin cậy. Quota tenant của QLTBYT là `selectedFacilityId` đã được scope resolution hiện tại validate. Không điền tenant đó bằng cách giả định nó là session `don_vi` hoặc generic `identity.tenant`. Nếu scope resolution giữ facility của session cho user không privileged, giá trị đã resolve đó vẫn là quota tenant. Clarification trả về trước reserve không tiêu thụ reservation.
- Định nghĩa contract cho Cloudflare, HMAC, replay protection, Oracle VM health/readiness, graceful drain, image rollback, secret handling và acceptance tests. Phase 0 phải ghi thuật toán/encoding HMAC, header, đơn vị timestamp, clock skew, cửa sổ validity/replay và sức chứa nonce trước security proof và Phase 1. MVP không có verified-snapshot exception; quarantine là full validity cộng skew.
- Thêm second-app capability fixture làm boundary test. Fixture này SHALL compile và exercise shared core mà không import package QLTBYT.
- Phase 0 MUST chốt tham số HMAC, recovery sau hard crash (0.7), mapping usage unknown/partial (0.8) và credential decision (0.9) cho `assistant_query_database_audit_log`. Thiếu proof hoặc 0.7/0.8/0.9 chưa được review thì chặn Phase 1. Gate Phase 2 cho 0.9 và gate Phase 3 cho 0.7/0.8 là defense in depth. Mapping 0.8 trở thành normative trước Phase 3. Không coi detached cleanup hoặc reservation TTL là bằng chứng đã giải quyết crash recovery.

## Non-Goals

- MVP không tích hợp Bifrost.
- Không xây public multi-app self-service registry, billing platform, model marketplace, plugin loader, queue, vector database hoặc AI-specific database.
- MVP không lưu conversation ở server.
- Không tự động tạo hoặc submit repair request; draft vẫn là advisory artifact và do UI quyết định handoff.
- Proposal này không có agent-run live database migration, DDL, hoặc administrative/live-data write. Runtime chat vẫn phải gọi các application-owned `ai_quota_*` và `assistant_query_database_audit_log`. Accounting quota theo mapping đã review, không đóng băng việc ép usage thiếu thành measured-zero. Việc gọi các RPC đó không phải quyền tự ý thay đổi schema hay chạy ad-hoc SQL. Nếu sau này cần DDL cho durable nonce/replay state hoặc service-specific authorization, việc đó MUST là SQL change riêng với quality gates riêng và explicit live-write approval.
- Sau cutover không runtime fallback về Next.js orchestration cũ. Operational rollback là revert image/configuration của Go về một Go release đã verify. Dark first deploy thất bại chặn cutover và không tự tắt chat production hiện tại. Drain grace là trần tối đa, không phải khoảng gián đoạn cố định bắt buộc.

## Impact

- Affected specs: capability mới `shared-ai-service`.
- Affected application boundary: `src/app/api/chat/route.ts`, request/stream proxy helpers và `src/lib/ai/**` orchestration/QLTBYT adapter surface hiện tại.
- New service boundary: `services/ai-service/**` (Go + Eino), kèm deployment và operator documentation cho Oracle VM và Cloudflare Tunnel. Go toolchain được pin tại ranh giới module/image. Vercel không build service này. Change này không thêm CI platform mới. Credential runtime tách khỏi `qltbyt_test`.
- QLTBYT Supabase RPC, RLS, tenant/facility rules và `ai_quota_*` routines vẫn là application-owned dependencies của QLTBYT capability adapter.
- Implementation đầu tiên MUST có contract/parity tests trước khi web route chuyển sang Go backend.
