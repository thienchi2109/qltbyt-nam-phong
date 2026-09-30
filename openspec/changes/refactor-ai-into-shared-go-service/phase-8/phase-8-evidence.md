# Phase 8 evidence

Ngày: 2026-09-30

## Trạng thái

`8.3` được anh ủy quyền bằng yêu cầu chuyển backend AI sang Go, commit và push `main`, rồi test UI production. Rollback anh chọn là git revert nếu UI không ổn.

`8.1`, `8.2`, `8.4`, `8.5`, `8.6` chưa PASS. Aggregate Phase 8 là `BLOCKING / INCOMPLETE`.

## Cutover code

- `src/app/api/chat/route.ts` export `runtime = "nodejs"`, `maxDuration = 60`, và `POST` gọi `postGoBffChat`.
- `src/app/api/chat/dark/route.ts` dùng cùng handler.
- `src/lib/ai/go-bff/GoBffChatPost.ts` kiểm tra session, role, cấu hình BFF, rồi ký và proxy. Thiếu cấu hình trả 503 `Tính năng trợ lý hiện không khả dụng.` Không có nhánh gọi orchestrator Next.js.
- Orchestrator cũ nằm ở `src/app/api/chat/legacy-next-orchestrator.ts`. File này không phải route handler. Route sống không import nó.
- `src/components/assistant/AssistantPanel.tsx` giữ `api: "/api/chat"`.

## Subject chưa khóa

Image đang phục vụ trên Oracle không phải bản build từ commit cutover:

- Container: `qltbyt-ai-service-candidate`
- Tag: `qltbyt-ai-service:gemini-first`
- Digest: `sha256:512d7992464c2de7eb97221e83aa3983095036f37b816d8e7424bea3d52fac3c`
- OCI revision: `unknown`
- Built: `2026-09-30T12:47:54Z`, trước commit code `b4a0ce89`
- Chain công khai đã ghi: `google/gemini-3.5-flash-lite`, rồi `nvidia/google/gemma-4-31b-it`

Image dừng được giữ, không xóa: `qltbyt-ai-service:75f1-cookie`, digest `sha256:5b984f8fb0e2a7f782a0c2caf45110d12ab6eab957738080ae3d417de6bc9432`.

Lần này không recreate container, không gọi NVIDIA, không probe model.

## 8.4

Candidate chat dùng `usage.NewMemory`. `Memory.Reserve` không gọi `ai_quota_reserve` / `ai_quota_finalize`. `assistant_query_database_audit_log` chỉ được gọi từ tool `query_database`. `8.4` chưa đạt trên image đang phục vụ. Không tắt RPC để né test; image hiện tại chưa nối `QuotaBook`.

## Rollback

Không có fallback runtime về orchestrator Next.js. Nếu UI production lỗi, revert commit cutover để trả `src/app/api/chat/route.ts` về orchestrator cũ. Revert đó là thao tác git có chủ đích. `8.5` chưa tick vì điều khoản rollback trong task là khôi phục image Go đã verify, và việc đó chưa làm.

## Ngoài phạm vi

Phase 9 đóng. DQSS `127.0.0.1:18080`, Web Push, tunnel, DNS, Access và Cloudflare proxy không đổi. Không ghi live DB.
