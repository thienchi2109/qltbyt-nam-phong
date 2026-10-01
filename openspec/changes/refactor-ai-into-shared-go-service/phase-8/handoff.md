# Phase 8 handoff

Ngày 2026-09-30 anh yêu cầu chuyển `/api/chat` sang Go và push `main` để tự test UI production. Rollback là git revert commit cutover nếu UI không ổn.

`8.3` đã chuyển route. `POST /api/chat` và `POST /api/chat/dark` cùng gọi `postGoBffChat`. UI vẫn dùng `/api/chat`. Orchestrator Next.js nằm ở `legacy-next-orchestrator.ts` và không được route sống import.

`8.1` đã chốt subject `7f758c6ce9bda05c16a0aee6b382d785a99cf420` / image `sha256:48a6478b15bd2c8bc4a13535302c0ffeb9e5820d14d33ed9a29a688d6aa86bb8`. Candidate đang phục vụ image đó. `/healthz` và `/readyz` cuối cùng đều 200. Tunnel không chứng thực trả 403. Không gọi model.

`8.2` đối soát ngày 2026-10-01 trên image đang chạy `sha256:48a6478b15bd2c8bc4a13535302c0ffeb9e5820d14d33ed9a29a688d6aa86bb8`: `BLOCKING / INCOMPLETE`. Không claim DONE. Thiếu smoke Tunnel đã ký, usage trên binary (`usage.NewMemory`), Phase 7 và `7.5F` cùng digest, cùng 8 assertion DOM fail. `8.4`, `8.5`, `8.6` vẫn mở. Image `gemini-first` digest `sha256:512d7992464c2de7eb97221e83aa3983095036f37b816d8e7424bea3d52fac3c` vẫn nằm ở container dừng `qltbyt-ai-service-candidate-gemini-first`.

Phase 9 không mở. DQSS, Web Push, tunnel, DNS và Access không đổi. Các ghi chú cũ nói Phase 8 chưa mở là checkpoint trước yêu cầu cutover này.
