# Phase 8 handoff

Ngày 2026-09-30 anh yêu cầu chuyển `/api/chat` sang Go và push `main` để tự test UI production. Rollback là git revert commit cutover nếu UI không ổn.

`8.3` đã chuyển route. `POST /api/chat` và `POST /api/chat/dark` cùng gọi `postGoBffChat`. UI vẫn dùng `/api/chat`. Orchestrator Next.js nằm ở `legacy-next-orchestrator.ts` và không được route sống import.

`8.1` đã chốt subject `7f758c6ce9bda05c16a0aee6b382d785a99cf420` / image `sha256:48a6478b15bd2c8bc4a13535302c0ffeb9e5820d14d33ed9a29a688d6aa86bb8`. Candidate đang phục vụ image đó. `/healthz` và `/readyz` cuối cùng đều 200. Tunnel không chứng thực trả 403. Không gọi model.

`8.2` đối soát ngày 2026-10-01 trên image đang chạy `sha256:48a6478b15bd2c8bc4a13535302c0ffeb9e5820d14d33ed9a29a688d6aa86bb8`: `BLOCKING / INCOMPLETE`. Không claim DONE. Thiếu smoke Tunnel đã ký, usage trên binary (`usage.NewMemory`), Phase 7 và `7.5F` cùng digest, cùng 8 assertion DOM fail. `8.4`, `8.5`, `8.6` vẫn mở. Image `gemini-first` digest `sha256:512d7992464c2de7eb97221e83aa3983095036f37b816d8e7424bea3d52fac3c` vẫn nằm ở container dừng `qltbyt-ai-service-candidate-gemini-first`.

Phase 9 không mở. DQSS, Web Push, tunnel, DNS và Access không đổi. Các ghi chú cũ nói Phase 8 chưa mở là checkpoint trước yêu cầu cutover này.

## Cập nhật 2026-10-02

Candidate hiện chạy runtime subject `92a09f948d3608385c9475ee584684d1c447c65c`, image `qltbyt/ai-service:92a09f94`, digest `sha256:fd8dc48910d551adefc52b421671fe87b84d744624864939844143cab1bb6ff8`, ARM64 build trực tiếp trên Oracle. Runtime đã nối `QuotaBook` với caller theo request. Journal bind mount `/var/lib/qltbyt-ai/usage-candidate-92a09f94` → `/var/lib/ai-service/usage`, writable, owner `65532:65532`, mode `0700`. Read-back `2026-10-02T06:01:34Z`: container running, restart 0, health/readiness 200. Các đoạn image cũ phía trên là checkpoint lịch sử.

Runbook fix `a03c5b31` không đổi revision image. Rollback container `qltbyt-ai-service-candidate-previous-913e0665` đã xóa theo yêu cầu anh; không xóa image. Không nối restart quota recovery hay chạy agent smoke live. Provider order được giữ Gemini-first; validator hiện yêu cầu NVIDIA-first, nên chỉ fixture validator PASS. Chi tiết hashes, probes và giới hạn nằm trong `phase-8-evidence.md`, mục 8.4.

`8.4` và aggregate Phase 8 vẫn `BLOCKING / INCOMPLETE`. Bước còn thiếu là smoke sau cutover trên cùng subject/digest cho reserve/finalize và sanitized SQL audit, với ủy quyền đúng RPC operations. Không tick các mục 8.2/8.4/8.5/8.6 hoặc mở Phase 9 từ evidence candidate.

Smoke có ủy quyền ngày 2026-10-02 đã chạy hai lượt UI. Candidate ghi mã tổng quát `provider_failure` tại `06:52:15.763Z` (request `f949c012-852d-4e90-a3e7-de755a338a4d`) và `06:54:08.619Z` (request `3d4b124a-32f6-4608-aa48-9d7dd572637d`). Reservation rows tương ứng đã `status=success`, nhưng không có `assistant_query_database` audit row; Vercel broker có `502` gần hai thời điểm nhưng không log RPC/operation/request ID. Chưa có raw provider error; mã này cũng bao gồm lỗi broker/RPC. Đây là quota evidence một phần, chưa phải `8.4` PASS.
