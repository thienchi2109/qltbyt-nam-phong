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

Root cause đã xác nhận: `ai_quota_finalize` là RPC `RETURNS void`, body HTTP thành `204/empty`; `callServerRpc` trả `""`, trong khi `BffBrokerResults` chỉ chấp nhận `{}` hoặc `null` cho finalize. Validator ném `502/result_too_large` sau khi DB đã finalize, Go surface thành `provider_failure`, khớp hai UI lỗi và journal usage measured. Đã viết regression test đỏ rồi sửa `callServerRpc` để body thành công rỗng trả `null`; nhóm helper/broker route hiện **32/32 PASS**, cùng format, no-explicit-any, dedupe, typecheck và React Doctor 100/100.

Commit `5c35715b` đã được build trực tiếp trên Oracle ARM64 và deploy candidate theo runbook. Image `qltbyt/ai-service:5c35715b` có digest `sha256:8e101d8ada99d013015f3a6f4dfcc06a35317542d2e4b7bd82d529231f3c307c`; container mới `450f90d39a5d96450061c204a32541cb9bde27ef5c9a165cddd1b80704d7e55a` chạy `restart=0`, `/healthz` và `/readyz` đều 200. Candidate cũ được giữ ở `qltbyt-ai-service-candidate-previous-5c35715b` để rollback. Chưa chạy lại UI smoke hoặc đối soát quota/audit trên digest mới; `8.4` vẫn `BLOCKING / INCOMPLETE`. `query_database` audit vẫn chưa có evidence.

### Smoke PASS cập nhật 2026-10-02T15:48Z

Candidate mới trên commit `5a5a75b9d936c0eb50b2ea02f69cedfdeb931dfe`, image digest `sha256:1039b18a17bc464aaeed226beae9799858433c79630305c674a8e7627e8d87b8`, đã được UI smoke với prompt `Tra cứu thông tin thiết bị monitor CMS8000` (tenant/account `17`). Người vận hành xác nhận `equipmentLookup` gọi 2 lần và UI trả lời không tìm thấy thiết bị trong đơn vị. Candidate request `87153163-ef93-4b0f-a6b4-ca7358d5b277` có `outcome=completed`, `usage_classification=known-positive`; reservation `c143ab4a-8217-4aa5-8fb0-f0ce0cb871c2` có `status=success` lúc `2026-10-02T15:48:11.973692Z`. `8.4` đã tick cho quota lifecycle và equipment-lookup smoke trên exact digest. Đây là read-only `ai_equipment_lookup`; `assistant_query_database` audit không phát sinh, nên nhánh SQL audit vẫn cần smoke riêng khi gọi `query_database`.

### `8.5` PASS — rollback artifact and no runtime fallback (2026-10-02T17:00Z)

`src/app/api/chat/route.ts` chỉ gọi `postGoBffChat`; route sống không import `legacy-next-orchestrator.ts` và không có fallback runtime. Rollback thật trên Oracle đã chuyển candidate sang Go image trước đó `136e3a9a` / digest `sha256:913e06656d4d4b4812d9044525649596f4a0b5d01dc7d7b553284d3c3b969135` (ARM64, revision `136e3a9a`), cùng env/mount/security config; health/readiness đều 200, restart `0`. Sau đó đã khôi phục candidate `5a5a75b9` / digest `sha256:1039b18a17bc464aaeed226beae9799858433c79630305c674a8e7627e8d87b8`, health/readiness đều 200, dọn previous container và env tạm. Không gọi model hoặc ghi live DB trong probe.

### `8.6` PASS — maintainer acceptance (2026-10-03)

Maintainer xác nhận đã tự kiểm tra PASS toàn bộ 8.6: signed SSE qua Tunnel, health/readiness local-only, budget BFF 60 giây (55 giây xử lý + tối đa 5 giây cleanup), drain grace 60–90 giây, full primary+secondary usage và strict OpenSpec validation. Đây là evidence do maintainer cung cấp; không phải agent tự tái chạy provider/live smoke trong lượt này.
