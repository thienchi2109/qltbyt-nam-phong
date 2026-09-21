## Why

Assistant hiện bị phân tán giữa Next.js route, Vercel AI SDK, prompt và intent modules, tool registry, RPC adapters, quota functions và repair-draft orchestration. Cấu trúc này khó vận hành như một service độc lập, đồng thời dễ làm cho quy tắc riêng của QLTBYT trở thành contract ngầm của một AI platform.

Thay đổi này định nghĩa một Go AI service dùng chung, phục vụ QLTBYT trước và có thể phục vụ app khác về sau. Browser vẫn giữ React và Vercel AI SDK làm interaction layer. Next.js vẫn là BFF xác thực và stream proxy; Go service sở hữu model orchestration, capability execution và provider integration trong một shared core không phụ thuộc app.

Change đang chờ `add-assistant-repair-request-draft-orchestration` vẫn là predecessor mô tả draft behavior hiện tại của QLTBYT. Change này chuyển orchestration đó vào QLTBYT capability adapter sau khi chứng minh parity; không sửa hoặc tự ý đánh dấu hoàn thành checklist của change kia.

## What Changes

- Thêm shared Go AI service trên Oracle VM, để web app gọi qua Cloudflare Tunnel và Cloudflare Access.
- Chọn Go + Eino làm orchestration stack mục tiêu. Eino SHALL sở hữu model/tool loop và workflow execution; maintained Eino/provider integrations SHALL được ưu tiên, còn official Go SDK chỉ nằm sau provider adapter khi integration đó không đáp ứng transport hiện tại.
- Định nghĩa shared core không phụ thuộc app cho request validation, capability routing, Eino execution, normalized events, streaming, cancellation, policy hooks, usage lifecycle và observability.
- Định nghĩa capability adapter để tool, prompt, tenant/facility policy, Supabase/RPC access, `ai_quota_*` policy, evidence normalization và repair-draft orchestration của QLTBYT nằm ngoài shared core.
- Giữ Next.js `/api/chat` là authentication boundary phía browser và proxy Vercel AI SDK UI Message Stream từ Go tới assistant UI hiện tại.
- Giữ nguyên hành vi assistant hiện có, gồm intent routing, tool allowlist, các mixed tool-output envelopes, read-only operational tools, troubleshooting/report artifacts và repair-request draft extraction. Phải chứng minh parity trước khi direct replacement.
- Yêu cầu request cancellation thật và quota finalization idempotent: retry không được tạo hiệu lực tính quota lặp, đồng thời có bounded retry/reconciliation khi process crash. Usage của secondary structured draft extraction phải được cộng vào lifecycle; provider usage không biết hoặc không đầy đủ SHALL không bị coi là zero để hoàn tiền.
- Định nghĩa contract cho Cloudflare, HMAC, replay protection, Oracle VM health/readiness, graceful drain, image rollback, secret handling và acceptance tests.
- Thêm second-app capability fixture làm boundary test. Fixture này SHALL compile và exercise shared core mà không import package QLTBYT.

## Non-Goals

- MVP không tích hợp Bifrost.
- Không xây public multi-app self-service registry, billing platform, model marketplace, plugin loader, queue, vector database hoặc AI-specific database.
- MVP không lưu conversation ở server.
- Không tự động tạo hoặc submit repair request; draft vẫn là advisory artifact và do UI quyết định handoff.
- Proposal này không có agent-run live database migration, DDL, hoặc administrative/live-data write. Runtime chat vẫn phải gọi các application-owned `ai_quota_*` và approved audit paths cần thiết để giữ hành vi hiện tại; đó không phải là quyền tự ý thay đổi schema hay chạy ad-hoc SQL. Nếu sau này cần DDL cho durable nonce/replay state hoặc service-specific authorization, việc đó MUST là SQL change riêng với quality gates riêng và explicit live-write approval.
- Sau cutover không runtime fallback về Next.js orchestration cũ. Operational rollback là revert image/configuration của Go về một Go release đã verify.

## Impact

- Affected specs: capability mới `shared-ai-service`.
- Affected application boundary: `src/app/api/chat/route.ts`, request/stream proxy helpers và `src/lib/ai/**` orchestration/QLTBYT adapter surface hiện tại.
- New service boundary: `services/ai-service/**` (Go + Eino), kèm deployment và operator documentation cho Oracle VM và Cloudflare Tunnel.
- QLTBYT Supabase RPC, RLS, tenant/facility rules và `ai_quota_*` routines vẫn là application-owned dependencies của QLTBYT capability adapter.
- Implementation đầu tiên MUST có contract/parity tests trước khi web route chuyển sang Go backend.
