# Phase 8 evidence

Ngày bắt đầu: 2026-09-30. Cập nhật gần nhất: 2026-10-02.

## Trạng thái

`8.3` được anh ủy quyền bằng yêu cầu chuyển backend AI sang Go, commit và push `main`, rồi test UI production. Rollback anh chọn là git revert nếu UI không ổn.

`8.1` đóng trên subject lịch sử dưới đây. Đối soát `8.2` ngày 2026-10-01 là `BLOCKING / INCOMPLETE`. Ngày 2026-10-02 candidate đã chuyển sang runtime commit `92a09f94`; chi tiết ở mục 8.4. `8.4`, `8.5`, `8.6` chưa PASS. Aggregate Phase 8 vẫn `BLOCKING / INCOMPLETE`. Không claim exact-commit PASS.

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

## 8.2

Ngày 2026-10-01, container đang phục vụ vẫn là `qltbyt-ai-service-candidate`, image `qltbyt-ai-service:7f758c6c`, digest `sha256:48a6478b15bd2c8bc4a13535302c0ffeb9e5820d14d33ed9a29a688d6aa86bb8`, revision `7f758c6ce9bda05c16a0aee6b382d785a99cf420`, healthy, restart 0. `/healthz` và `/readyz` đều 200. Cây `services/ai-service` của commit docs `942421bb` trùng `7f758c6c`: `ce5def81347ffd23efc2ce30c18a0f7f92d44b5e`. `gemini-first` và `75f1-cookie` vẫn là container đã dừng. Không gọi model, không đổi image, không ghi live DB.

PASS của Phase 8 cần đủ evidence trên cùng commit và cùng digest này. Evidence của commit hoặc image khác không được tính.

| Cổng                                             | Trên subject này                                                                                               | Kết quả                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Health/readiness                                 | `/healthz` 200, `/readyz` 200 khi đối soát                                                                     | Đạt ở trạng thái cuối                                                  |
| Contract, HMAC/replay, abort, parity, second-app | `go test ./...` của commit `7f758c6c` pass, gồm ingress, orchestration, protocol, qltbyt, `fixtures/secondapp` | Đạt ở source commit; không có probe replay/abort trên binary đang chạy |
| Usage                                            | `internal/usage` pass; process đang chạy dùng `usage.NewMemory`                                                | Thiếu đối soát usage trên image                                        |
| UI stream/route                                  | Vitest route và BFF pass; 8 assertion DOM composer/trigger fail                                                | Không đủ để ghi UI PASS                                                |
| Tunnel                                           | `POST` công khai không chứng thực trả 403; không có SSE đã ký                                                  | Thiếu smoke Tunnel                                                     |
| Phase 7 dark smoke                               | Hồ sơ cũ nằm ở commit/image khác                                                                               | Không cùng subject                                                     |
| `7.5F`                                           | `DISPOSABLE ONLY` trên digest `sha256:2f912b65…` và subject `a3267b53`                                         | Không cùng subject                                                     |
| Smoke sau cutover                                | Chưa có probe đã ký hoặc biên bản UI production gắn digest này                                                 | Thiếu                                                                  |
| Rollback image đã verify                         | Image dừng `gemini-first` có revision `unknown`                                                                | Chưa phải image Go đã verify                                           |

Vì các dòng thiếu ở trên, exact-commit PASS không thành lập. `8.2` không được tick. Phase 9 không mở.

## 8.4

Checkpoint trước 2026-10-02: candidate dùng `usage.NewMemory`, bỏ qua `ai_quota_reserve` / `ai_quota_finalize`. SQL audit chỉ được gọi từ `query_database`.

### Runtime và deployment ngày 2026-10-02

Anh duyệt implementation rồi yêu cầu commit, push, build và deploy candidate theo runbook. Runtime subject là `92a09f948d3608385c9475ee584684d1c447c65c`, commit `feat(ai): wire durable quota lifecycle`. Runbook được sửa riêng tại commit `a03c5b31`; commit docs đó không phải revision của image đang chạy.

- `newServiceRuntime` dùng `usage.NewQuotaBook(config.usageDir, time.Now, nil)` thay `usage.NewMemory` và truyền cùng book vào `Runner`.
- `Prepared.QuotaCaller` vẫn được truyền theo từng request; không thêm global caller hay persist broker credential.
- Cấu hình journal mặc định là `/var/lib/ai-service/usage`. Lỗi khởi tạo journal làm runtime fail closed, không dựng runner.
- QLTBYT quota caller và sanitized SQL audit adapter được giữ nguyên. Success SQL audit phải hoàn thành trước khi trả rows; failure audit không thay thế lỗi SQL ban đầu.
- Không nối `QuotaBook.Recover` vào startup. Persistence của journal không chứng minh khả năng tái tạo caller sau restart. Quarantine của ingress replay guard cũng không phải quota recovery.

Kiểm tra source trước commit: focused runtime/usage/QLTBYT tests PASS; `go test ./... -count=1`, `go vet ./...`, gofmt và `git diff --check` PASS. Prettier, diff-only dedupe và artifact contract PASS. `verify:no-explicit-any` không có TypeScript diff; pre-push typecheck PASS. Deployment validator và Compose `config --quiet` PASS với fixture disposable trong `/tmp`, không phải cấu hình live Oracle. Behavioral test `TestRunnerPassesPreparedCallerToQuotaBook` xác nhận reserve/finalize qua caller theo request khi provider chưa bắt đầu và usage được refund; không phải provider/live smoke.

Build đầu tiên chạy nhầm trên VPS x86, fail ở `go mod download` với `exec format error`. Build thành công sau đó chạy trực tiếp trên Oracle `aarch64`, context `/tmp/ai-service-92a09f94`, với `--platform linux/arm64 --pull=false --no-cache --build-arg TARGETARCH=arm64 --build-arg VCS_REF=92a09f948d3608385c9475ee584684d1c447c65c`.

Image tag `qltbyt/ai-service:92a09f94`, Docker read-back RepoDigest `qltbyt/ai-service@sha256:fd8dc48910d551adefc52b421671fe87b84d744624864939844143cab1bb6ff8`, architecture `arm64`, OS `linux`, revision label đúng runtime subject. Không có evidence registry publish riêng. Container `qltbyt-ai-service-candidate`, ID `92edae8e3672b17c499bfc1c2a9ed06a5a7feee3100ff0d26d44c38146d728a4`, bắt đầu `2026-10-02T03:50:19.22703508Z`.

Deployment đọc lại trực tiếp trên Oracle lúc `2026-10-02T06:01:34Z`:

- Container `running`, restart count `0`; không có Docker healthcheck trên đường chạy thủ công này.
- Host-loopback `/healthz=200`, `/readyz=200`, cùng body `{"status":"ok"}`. Lượt probe startup trước đó đạt cả hai 200 sau 21 lần cách 5 giây; không có signed SSE/provider probe.
- Host journal `/var/lib/qltbyt-ai/usage-candidate-92a09f94` mount tại `/var/lib/ai-service/usage`, `RW=true`, owner `65532:65532`, mode `0700`.
- Bốn secret mounts vẫn `RW=false`; user `65532:65532`, root read-only, host network, memory `536870912`, NanoCPUs `1000000000`, pids limit `128`.
- Listen `127.0.0.1:18081`; broker endpoint `https://www.cvmems.vn/api/internal/ai/broker/v1`; provider order được giữ từ candidate cũ: `google/gemini-3.5-flash-lite,nvidia/google/gemma-4-31b-it`.
- Live provider order khác NVIDIA-first mà operator validator hiện yêu cầu. Fixture validator PASS không chứng minh validator PASS trên cấu hình candidate này. Không đổi provider order trong lượt deploy.

Reference hashes được tính bằng `git archive --format=tar 92a09f948d3608385c9475ee584684d1c447c65c <path>`:

| Path                           |  Bytes | SHA-256                                                            |
| ------------------------------ | -----: | ------------------------------------------------------------------ |
| `services/ai-service`          | 778240 | `d17656f1c4e1788ddd0a8a56f29326333a3f5b64551ee809b4d2a6c9fc8771c6` |
| `ops/ai-service`               |  40960 | `b91dea7f1417c9b73379e30c1fd6d7bf7564ef7b4d97a20f377968d8dc4fe1c3` |
| `services/ai-service/fixtures` |  10240 | `0afab8f31979799ac06e61a8afe2efff15db4f42f97f56697ad36954eb983784` |

Đây là reference hashes của committed source, không phải attestation cho bytes build context trên Oracle. Read-back config hash `0cffa94e7c3b0bfb14a4f7d0001a0101663a0b981a0a72b6d45b5419559c870c`: SHA-256 của JSON với keys sorted, compact separators, gồm allowlisted non-secret env (listen/usage/app/capability/version/provider/concurrency/drain/cleanup/TTL/broker URL), mount source/destination/RW, user, read-only root, network, memory, CPU và pids. Hash không chứa secret values và không bao phủ toàn bộ deployment configuration.

Lần recreate đầu fail do cú pháp `--mount ...,rw`. Trap khôi phục container cũ và được read-back `running`; retry với mount writable mặc định thành công. Runbook `a03c5b31` đã sửa cú pháp và bổ sung trap. Container rollback `qltbyt-ai-service-candidate-previous-913e0665` sau đó bị xóa theo yêu cầu explicit của anh; read-back xác nhận container không tồn tại và candidate vẫn chạy. Không thực hiện xóa image cũ.

**Kết quả:** code/mock/disposable checks PASS và candidate deployment/health được xác minh. Production acceptance của `8.4` vẫn `BLOCKING / INCOMPLETE`: chưa có smoke sau cutover gắn cùng subject/digest chứng minh `ai_quota_reserve`, `ai_quota_finalize` và `assistant_query_database_audit_log`. Không gọi model hay chủ động thực hiện live quota/audit RPC trong lượt này; không suy ra production PASS từ tên candidate, test source hay probe health. Evidence 7/7.5F/8.1 cũ không được chuyển sang image mới. `8.4` không tick; Phase 9 không mở.

### Live smoke có ủy quyền ngày 2026-10-02

Anh đã ủy quyền smoke cho đúng ba operation quota/audit và gửi hai lượt tra cứu thiết bị trên UI bằng tài khoản đơn vị. Candidate vẫn là image digest `sha256:fd8dc48910d551adefc52b421671fe87b84d744624864939844143cab1bb6ff8`.

- Lượt `2026-10-02T06:52:15.763Z`, request ID `f949c012-852d-4e90-a3e7-de755a338a4d`: candidate ghi mã tổng quát `provider_failure`, provider `google`, model `gemini-3.5-flash-lite`, `usage_classification=unknown`.
- Lượt `2026-10-02T06:54:08.619Z`, request ID `3d4b124a-32f6-4608-aa48-9d7dd572637d`: candidate ghi cùng mã tổng quát và provider/model; UI hiển thị lỗi chung.
- Vercel production log của broker có các response `502` ngay trước hai kết quả trên (`06:52:15.588Z/06:52:15.691Z` và `06:54:08.264Z/06:54:08.542Z`). Log chỉ có request path/status, không có `request_id`, RPC hoặc operation; vì vậy không thể gán từng `502` chắc chắn cho reserve, finalize hay audit.
- Read-only Supabase read-back thấy reservation `status=success` lúc `06:52:03.649Z` (tenant `17`, usage `28881/2496`) và `06:54:03.198Z` (tenant `17`, usage `12676/775`). Đây là bằng chứng quota row đã được finalize, nhưng bảng reservation không lưu request ID nên chưa đủ chứng minh từng RPC trên cùng request.
- Không có dòng `audit_logs.action_type='assistant_query_database'` trong các cửa sổ `06:51:30–06:54:00Z` và `06:53:00–06:55:00Z`. Smoke này chưa chứng minh `query_database` gọi và hoàn tất audit; các `502` cho thấy còn lỗi broker/RPC cần truy tiếp.

**Kết luận smoke:** candidate có quota lifecycle evidence một phần, nhưng tool/audit chưa được chứng minh. Chưa có bằng chứng raw provider error; `provider_failure` cũng được dùng cho lỗi broker/RPC, và broker có `502` gần hai lượt. `8.4` tiếp tục `BLOCKING / INCOMPLETE`; không tick acceptance và không mở Phase 9. Không có live DB write thủ công ngoài các operation runtime đã được anh ủy quyền.

### Smoke PASS sau candidate fix — 2026-10-02T15:48Z

- UI smoke chạy trên exact candidate digest `sha256:1039b18a17bc464aaeed226beae9799858433c79630305c674a8e7627e8d87b8`, runtime commit `5a5a75b9d936c0eb50b2ea02f69cedfdeb931dfe`.
- Prompt `Tra cứu thông tin thiết bị monitor CMS8000`, account/tenant `17`; người vận hành xác nhận model gọi `equipmentLookup` 2 lần và UI trả lời không tìm thấy thiết bị CMS8000 ở đơn vị.
- Candidate log ghi request `87153163-ef93-4b0f-a6b4-ca7358d5b277`, provider `google`, model `gemini-3.5-flash-lite`, `outcome=completed`, `usage_classification=known-positive`, `latency_ms=6346`; không có `provider_failure`.
- Read-only Supabase read-back ghi reservation `c143ab4a-8217-4aa5-8fb0-f0ce0cb871c2`, tenant `17`, `status=success`, `reserved_at=2026-10-02 15:48:11.973692+00`, `tokens_in=21730`, `tokens_out=780`.
- Đây là capability `equipmentLookup` và RPC đọc `ai_equipment_lookup`; theo capability policy, `assistant_query_database` audit không phát sinh cho lượt này. SQL audit vẫn cần smoke `query_database` riêng nếu muốn chứng minh nhánh audit đó.

**Kết luận:** quota reserve/finalize và equipment-lookup response đã PASS trên exact candidate digest; không còn vòng lặp 5 lần hoặc lỗi chung `provider_failure`. Tick `8.4` cho capability smoke này. Không mở `Phase 9` từ kết quả này.

### Root cause đã xác nhận sau smoke

- Journal trên Oracle liên kết trực tiếp hai request ID với reservation tương ứng và ghi nhiều dòng `usage_observed` từ provider. Ví dụ request `f949c012-852d-4e90-a3e7-de755a338a4d` có bốn lượt usage measured; request `3d4b124a-32f6-4608-aa48-9d7dd572637d` có hai lượt. Đây không giống lỗi provider chết trước khi trả usage.
- `public.ai_quota_finalize` có return type `void`. Supabase/PostgREST trả response rỗng cho RPC này; `callServerRpc` biến body rỗng thành chuỗi `""` (`src/lib/ai/server-rpc.ts:108-115`).
- Broker lại yêu cầu kết quả `ai_quota_finalize` phải là object rỗng hoặc `null` (`src/lib/ai/bff-broker/BffBrokerResults.ts:345`), nên `validateBrokerResult` ném `BrokerRequestError(502, "result_too_large")` khi nhận `""` (`BffBrokerResults.ts:384-388`). Route trả 502 sau khi DB đã finalize, rồi Go surface cùng mã tổng quát `provider_failure`.
- Local executable reproduction với upstream HTTP `204` đã PASS: decoded result `""` → validator `502/result_too_large`. Điều này khớp với hai cặp Vercel `502`, reservation `status=success` và UI lỗi chung.

**Kết luận nguyên nhân:** lỗi UI là do broker làm hỏng thành công của `ai_quota_finalize` vì mismatch `void/204` với schema response, không phải bằng chứng Gemini không gọi được. `query_database`/audit vẫn là một câu hỏi riêng: chưa có audit row trong hai smoke nên chưa claim tool đã chạy.

### Local fix sau RED test

Đã sửa `src/lib/ai/server-rpc.ts` để response thành công có body rỗng (ví dụ HTTP 204 từ RPC `RETURNS void`) được chuẩn hóa thành `null`; response lỗi vẫn đi qua nhánh status/error hiện tại. Regression test dùng helper thật và validator broker thật: trước sửa **1 failed / 7 passed**, sau sửa **32/32 passed** trong nhóm helper/broker route, gồm cả test đảm bảo HTTP 500 rỗng vẫn ném lỗi. Các cổng local đã đạt: format, `verify:no-explicit-any`, dedupe diff-only, typecheck và React Doctor 100/100.

Đây mới là bằng chứng source-local cho việc loại bỏ `502/result_too_large`; chưa có build/deploy hoặc smoke lại trên candidate nên `8.4` vẫn **BLOCKING / INCOMPLETE**, không tick acceptance. Bản sửa chưa chứng minh `query_database`/audit path và không thay đổi kết luận tool/audit của hai smoke trước.

### Deploy candidate sau RED/GREEN

Theo runbook, commit `5c35715b` được build trực tiếp trên Oracle ARM64 với `--platform linux/arm64 --pull=false --no-cache --build-arg TARGETARCH=arm64`. Image `qltbyt/ai-service:5c35715b` có image ID/digest `sha256:8e101d8ada99d013015f3a6f4dfcc06a35317542d2e4b7bd82d529231f3c307c`, label revision `5c35715b`, architecture `arm64`, OS `linux`.

Candidate được recreate lúc `2026-10-02T12:46:30Z` bằng `sudo bash` trên Oracle sau khi preflight xác nhận host `aarch64`. Candidate cũ không bị xóa: `qltbyt-ai-service-candidate-previous-5c35715b` giữ image `92a09f94` ở trạng thái `exited`; candidate mới có container ID `450f90d39a5d96450061c204a32541cb9bde27ef5c9a165cddd1b80704d7e55a` và `restart_count=0`.

Read-back sau deploy xác nhận user `65532:65532`, root filesystem read-only, host network, memory `512MiB`, CPU `1`, pids `128`; bốn secret mounts read-only; journal `/var/lib/qltbyt-ai/usage-candidate-92a09f94` writable tại `/var/lib/ai-service/usage`, owner `65532:65532`, mode `0700`; env tạm đã xóa. Host-loopback `/healthz` và `/readyz` đều trả 200 với `{"status":"ok"}`.

Đây là deployment/health evidence của bản sửa, chưa phải production acceptance: chưa chạy lại UI smoke hoặc đối soát `ai_quota_reserve`, `ai_quota_finalize`, `assistant_query_database_audit_log` trên digest mới. `8.4` vẫn **BLOCKING / INCOMPLETE** và không tick acceptance.

## Rollback

Không có fallback runtime về orchestrator Next.js. Nếu UI production lỗi, revert commit cutover để trả `src/app/api/chat/route.ts` về orchestrator cũ. Revert đó là thao tác git có chủ đích. `8.5` chưa tick vì điều khoản rollback trong task là khôi phục image Go đã verify, và việc đó chưa làm.

Ngày 2026-10-02: rollback container `qltbyt-ai-service-candidate-previous-913e0665` đã được xóa theo yêu cầu maintainer. Không diễn giải việc giữ/xóa container đó là PASS của `8.5`.

## Ngoài phạm vi

Phase 9 đóng. DQSS `127.0.0.1:18080`, Web Push, tunnel, DNS, Access và Cloudflare proxy không đổi. Không ghi live DB.
