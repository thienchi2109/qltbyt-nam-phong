# Phase 8 evidence

Ngày: 2026-09-30

## Trạng thái

`8.3` được anh ủy quyền bằng yêu cầu chuyển backend AI sang Go, commit và push `main`, rồi test UI production. Rollback anh chọn là git revert nếu UI không ổn.

`8.1` đóng trên subject dưới đây. `8.2`, `8.4`, `8.5`, `8.6` chưa PASS. Aggregate Phase 8 vẫn `BLOCKING / INCOMPLETE`.

## Cutover code

- `src/app/api/chat/route.ts` export `runtime = "nodejs"`, `maxDuration = 60`, và `POST` gọi `postGoBffChat`.
- `src/app/api/chat/dark/route.ts` dùng cùng handler.
- `src/lib/ai/go-bff/GoBffChatPost.ts` kiểm tra session, role, cấu hình BFF, rồi ký và proxy. Thiếu cấu hình trả 503 `Tính năng trợ lý hiện không khả dụng.` Không có nhánh gọi orchestrator Next.js.
- Orchestrator cũ nằm ở `src/app/api/chat/legacy-next-orchestrator.ts`. File này không phải route handler. Route sống không import nó.
- `src/components/assistant/AssistantPanel.tsx` giữ `api: "/api/chat"`.

## 8.1 subject

Commit `7f758c6ce9bda05c16a0aee6b382d785a99cf420`. Image `qltbyt-ai-service:7f758c6c`, digest `sha256:48a6478b15bd2c8bc4a13535302c0ffeb9e5820d14d33ed9a29a688d6aa86bb8`, `linux/arm64`, tạo `2026-09-30T23:36:46Z`, nhãn `org.opencontainers.image.revision` đúng commit. Build trên Oracle với `--platform linux/arm64`, `TARGETARCH=arm64`, `VCS_REF` là commit đầy đủ.

Cây Git:

- `services/ai-service` `ce5def81347ffd23efc2ce30c18a0f7f92d44b5e`
- `src/lib/ai/go-bff` `0794a991c00c4c6f185ae4a12c7dd72251373908`
- `src/app/api/chat/route.ts` `7e009ed28c8b11870f518f9f140e869043c0566d`
- `src/app/api/chat/dark/route.ts` `2207a5bcb7771cb827f559bd0f4fca30d0bff04e`
- `ops/ai-service` `9a6ea95e851b9d9a66f8092f459ddf4b857b16dd`
- `services/ai-service/fixtures` `ee9fcfdeeadd5fe5a48bff057b1f69b0e305d220`

`git archive --format=tar HEAD <path>` rồi nối byte:

- source bốn path trên: 849920 byte, `sha256:d7c3e3371026e7e0698490a57f1611f5c13b899cb733736b574774f44aba4143`
- `ops/ai-service`: 30720 byte, `sha256:d842a84490206d92dd40e5d2bfee1f01e430e4ef2f3b421c11002499da9bd298`
- fixtures: 10240 byte, `sha256:e88189f378fd361ffed4344d1df06fb22e080dc291767172e1a6c328765d09e4`

Container `qltbyt-ai-service-candidate` đang chạy image này, healthy, restart 0. Env 20 biến được copy nguyên, không in giá trị. Bốn mount secret vẫn read-only tại `/run/secrets/nvidia_api_key`, `/run/secrets/google_generative_ai_api_keys`, `/run/secrets/ai_service_hmac_secret`, `/run/secrets/ai_service_broker_secret`. Host network, user `65532:65532`, root read-only, memory 536870912, swap 1073741824, NanoCpus 1000000000, pids 128, cap-drop ALL, no-new-privileges, init, tmpfs `/tmp`, restart `unless-stopped`. Listen `127.0.0.1:18081`. Nhãn provider-order vẫn `gemini-first`. Không đọc lại giá trị chain từ env.

Kiểm tra trên cùng subject:

- `gofmt -l` rỗng, `go vet ./...` pass, `go test ./... -count=1` pass, gồm `internal/usage`.
- Vitest `src/lib/ai/go-bff`, `src/app/api/chat`, `src/components/assistant`: 45 file pass, 3 file fail, 333 test pass, 8 test fail. Tám fail nằm ở `AssistantComposer`, `AssistantPanel` và `AssistantTriggerButton`: placeholder dùng `…` trong khi test tìm `...`, và class thực tế là `size-14` trong khi test tìm `h-14`/`w-14`. Các file route và BFF trong cùng lượt thì pass.
- Loopback `POST /v1/chat` không chữ ký: 401 `application/json`, không phải `text/event-stream`.
- `POST https://ai-service.cdclims.cloud/v1/chat` không chứng thực: 403 `text/plain`. Connector `qltbyt-ai-cloudflared-new` vẫn running. Không có SSE đã ký trên image này.
- `/healthz` 200 từ lần thăm thứ hai. `/readyz` 503 trong 28 lần cách 5 giây, lần thứ 30 thì 200. Một lần thăm sau đó vẫn 200 `application/json`.

Không gọi NVIDIA hay Gemini. Không ghi live DB. DQSS `127.0.0.1:18080`, Web Push, Coolify `0.0.0.0:8080`, tunnel, DNS và Access không đổi.

Rollback container dừng `qltbyt-ai-service-candidate-gemini-first` giữ digest `sha256:512d7992464c2de7eb97221e83aa3983095036f37b816d8e7424bea3d52fac3c`, revision `unknown`, build `2026-09-30T12:47:54Z`. Image `qltbyt-ai-service:75f1-cookie` digest `sha256:5b984f8fb0e2a7f782a0c2caf45110d12ab6eab957738080ae3d417de6bc9432` vẫn được giữ. Chain công khai đã ghi của cấu hình copy sang: `google/gemini-3.5-flash-lite`, rồi `nvidia/google/gemma-4-31b-it`.

## 8.4

Candidate chat dùng `usage.NewMemory`. `Memory.Reserve` không gọi `ai_quota_reserve` / `ai_quota_finalize`. `assistant_query_database_audit_log` chỉ được gọi từ tool `query_database`. `8.4` chưa đạt trên image đang phục vụ. Không tắt RPC để né test; image hiện tại chưa nối `QuotaBook`.

## Rollback

Không có fallback runtime về orchestrator Next.js. Nếu UI production lỗi, revert commit cutover để trả `src/app/api/chat/route.ts` về orchestrator cũ. Revert đó là thao tác git có chủ đích. `8.5` chưa tick vì điều khoản rollback trong task là khôi phục image Go đã verify, và việc đó chưa làm.

## Ngoài phạm vi

Phase 9 đóng. DQSS `127.0.0.1:18080`, Web Push, tunnel, DNS, Access và Cloudflare proxy không đổi. Không ghi live DB.
