# Phase 8 handoff

Ngày 2026-09-30 anh yêu cầu chuyển `/api/chat` sang Go và push `main` để tự test UI production. Rollback là git revert commit cutover nếu UI không ổn.

`8.3` đã chuyển route. `POST /api/chat` và `POST /api/chat/dark` cùng gọi `postGoBffChat`. UI vẫn dùng `/api/chat`. Orchestrator Next.js nằm ở `legacy-next-orchestrator.ts` và không được route sống import.

Chưa PASS: `8.1`, `8.2`, `8.4`, `8.5`, `8.6`. Image đang phục vụ là `qltbyt-ai-service:gemini-first` digest `sha256:512d7992464c2de7eb97221e83aa3983095036f37b816d8e7424bea3d52fac3c`, revision `unknown`, dùng `usage.NewMemory`. Chat chưa gọi `ai_quota_reserve` / `ai_quota_finalize`. Không build lại candidate và không gọi NVIDIA trong lần này.

Phase 9 không mở. DQSS, Web Push, tunnel, DNS và Access không đổi. Các ghi chú cũ nói Phase 8 chưa mở là checkpoint trước yêu cầu cutover này.
