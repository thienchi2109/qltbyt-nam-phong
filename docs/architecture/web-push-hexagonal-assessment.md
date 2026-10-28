# Web Push — assessment, boundary và contract WP-01

Ngày: 2026-10-28. Trạng thái: **Reviewed / WP-01 hoàn tất**; chưa triển khai WP-02.
Source baseline: `9f2b9c4c7c84513ab765a80dc5e844f7a8d569ab`.
Phạm vi: [WP-01](../../backlog/tasks/WP-01-architecture-contract-and-pilot.md),
khảo sát repository; không chứng nhận trạng thái DB/deployment live.

## 1. Quyết định và nguyên tắc áp dụng

Giữ **Go** cho delivery core, adapter phía service, runtime và entrypoint trong
`services/web-push`; QLTBYT giữ **Next.js/TypeScript**. Ràng buộc áp dụng WP-01–WP-08.
Từng app sở hữu subscription, queue/outbox, recipient rules và authorization;
service kéo delivery đã được app cho phép, gửi provider rồi report về đúng app.
Không tạo publish API, broker, database hay subscription store trung tâm.

Tài liệu người dùng `/root/docs/hexagonal-architect.md` là reference về LabOps;
chỉ áp dụng các nguyên tắc sau cho Web Push, không khảo sát/refactor LabOps:

- Chỉ kết luận coupling khi có dependency/bằng chứng source; giữ thiết kế tốt.
- Dùng Ports & Adapters theo từng vertical slice/Strangler Fig, ưu tiên tương
  thích API, DB và hành vi đang chạy; không đổi folder để đạt một sơ đồ lý tưởng.
- Port xuất hiện ở ranh giới thực hoặc test seam, Go interface nhỏ phía consumer;
  không thêm framework, repository chung hoặc interface có một implementation
  nếu seam hiện tại đủ dùng.
- Chọn pilot nhỏ, có test trước/sau, rollback và review độc lập; mỗi slice có
  một owner. Không triển khai WP-02 trước khi boundary/contract này được chấp nhận.
- Không hexagonal hóa UI đơn giản, SQL authorization nguyên tử hoặc code transport
  chỉ để tăng số lớp. Lợi ích cần lớn hơn mapping, wiring và chi phí bảo trì.

## 2. Source assessment và bằng chứng

Link source dưới đây là đường dẫn repository kèm dòng tại baseline trên; khi source
thay đổi cần tìm lại symbol. CRG broad discovery được dùng trước, nhưng graph ở
`4e308be7` không khớp HEAD; GitNexus ở `8859e3c3` không tìm thấy symbol claim đã
thử. Vì vậy các kết luận dựa trên đọc source hiện tại, không suy ra từ graph vắng node.

| Ranh giới / mức ưu tiên                  | Bằng chứng hiện tại                                                                                                                                                                                                                                                                                                                    | Kết luận                                                                                                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Giữ: port và core                        | [types.go](../../services/web-push/types.go#L73) `Backend.Claim/Report`, `Sender.Send`; [worker.go](../../services/web-push/worker.go#L25) `WorkerConfig` inject API/Sender/Clock/Sleep/Jitter                                                                                                                                         | Đã có seam fake-port; không tạo port cạnh tranh. Worker không import NextAuth, SQL hay code QLTBYT.                                                                                     |
| P1: backend error policy lệ thuộc HTTP   | [worker.go](../../services/web-push/worker.go#L140) `Run`, dòng 386 `reportWithRetry`; [worker_helpers.go](../../services/web-push/worker_helpers.go#L127) `isRetryableWorkerError/isDisabledError` đọc concrete `APIError`, status và code                                                                                            | Pilot WP-02 chuyển cách diễn giải lỗi backend về adapter, core chỉ quyết định retry/sleep từ lỗi có nghĩa.                                                                              |
| P2: giá trị contract dùng chung với JSON | [types.go](../../services/web-push/types.go#L8) `ClaimRequest/Delivery/ReportItem` có JSON tags, timestamp/revision dạng string                                                                                                                                                                                                        | Tags không tự là lỗi kiến trúc. Giữ Go values hiện có khi shape phù hợp; không copy toàn bộ DTO chỉ để bỏ tags. Strict wire parsing thuộc adapter; core giữ defensive lease/TTL guards. |
| Giữ, có giới hạn: provider outcome       | [provider.go](../../services/web-push/provider.go#L38) `WebPushSender.Send` kiểm tra endpoint/payload/DNS; [worker.go](../../services/web-push/worker.go#L347) fallback `outcomeForStatus`; [worker_helpers.go](../../services/web-push/worker_helpers.go#L79) mapping provider status                                                 | Delivery transport là trách nhiệm service. Pilot không tuyên bố loại bỏ mọi HTTP-related coupling: status fallback vẫn giữ để tương thích Sender hiện tại.                              |
| Giữ: app transport/auth adapter          | [client.go](../../services/web-push/client.go#L23) path claim/report, `HTTPBackend`, dòng 113 replay retry; [worker-auth.ts](../../src/lib/web-push/worker-auth.ts#L27) current/previous credentials, dòng 130 authenticate/nonce                                                                                                      | HTTPS/HMAC/nonce/strict JSON là adapter. HMAC key ID phục vụ rotation, chưa phải app identity.                                                                                          |
| Giữ: domain và outbox tại QLTBYT         | [schema](../../supabase/migrations/20260911030000_web_push_schema.sql#L4) FK `nhan_vien/don_vi`, endpoint unique ở dòng 15, intent repair-only ở dòng 29; [repair_request_create](../../supabase/migrations/20261009101400_repair_request_create_terminal_guard.sql#L193) enqueue trong cùng function                                  | Đây là ownership có chủ đích, không đem schema hay recipient policy vào delivery core. Endpoint uniqueness hiện có phạm vi bảng QLTBYT, không là cam kết xuyên app.                     |
| Giữ: fencing tại source                  | [claim](../../supabase/migrations/20260913020200_web_push_claim_recipient_eligibility.sql#L284) owner/revision/epoch/read access/eligibility; [report](../../supabase/migrations/20260912000300_web_push_delivery_report.sql#L102) duplicate/stale và dòng 121 recheck                                                                 | Authorization không kết thúc ở enqueue. Claim recheck trước mỗi lease/retry; report bảo vệ snapshot hiện hành.                                                                          |
| P1 trước multi-app: composition đơn app  | [main.go](../../services/web-push/cmd/web-push/main.go#L49) một VAPID, origin/HMAC, worker; [runtime.go](../../services/web-push/runtime.go#L12) pause mặc định và private health                                                                                                                                                      | Tái sử dụng wiring, chưa có app registry, fairness hay cô lập nhiều app trong process. WP-04/05 bổ sung khi cần.                                                                        |
| P1 trước cutover: browser giữ trạng thái | [readPreflight](<../../src/app/(app)/notifications/NotificationsPushOptInLifecycle.ts#L73>) enabled + cùng key version + matching local subscription có thể bỏ POST; [session-provider](../../src/providers/session-provider.tsx#L44) cleanup/restore owner; [consent](../../src/lib/web-push/browser-consent.ts#L1) per-owner consent | Giữ source storage/VAPID mặc định. Không coi local enabled là bằng chứng kho backend mới đã nhận registration.                                                                          |

Các migration **hiệu lực theo source đã sắp version**, không đọc riêng bản đầu:
schema `20260911030000`; recipients `20260911030100`; subscriptions
`20260911030200`; atomic enqueue/runtime controls `20260911030300`; nonce/controls
`20260912000100`; report `20260912000300`; recipient config/eligibility
`20260913020000`; `repair_request_create` cuối `20261009101400`; claim cuối
`20260913020200`; payload copy cuối `20260919120000`; `don_vi_create` auto-allowlist
`20260920100000`. Các bản claim/enqueue trước đó bị thay thế ở symbol tương ứng.
Đây là effective source, chưa đối chiếu catalog live.

## 3. Target boundary và dependency direction

```text
Go entrypoint/runtime -> core + adapter composition
HTTPBackend ----------> Backend port / Go contract <--- delivery worker
WebPushSender --------> Sender port / Go contract  <--- delivery worker
QLTBYT Next.js routes -> session/HMAC + SQL RPC (source-owned queue/policy)
```

Core sở hữu claim → bounded send → report, lease/deadline/TTL guards,
cancellation và worker-local retry policy. Contract là Go values và lỗi có nghĩa;
core không biết NextAuth, `nhan_vien`, `don_vi`, repair URL, HMAC headers hoặc HTTP
error envelopes. HTTP adapter validate/map wire; provider adapter giữ encryption,
SSRF/DNS/redirect protections và provider transport. Không đưa business rules vào
adapter service chỉ vì hiện chúng nằm trong SQL của app.

Không bắt buộc thêm package `domain/application/adapters`. Tiếp tục package hiện có
cho pilot; dependency trên là ownership của symbol, chưa là compile-time package
isolation. DTO và Go contract có thể dùng chung type khi không kéo HTTP dependency
vào core; chỉ thêm mapping nếu hai shape thực sự khác nhau.

## 4. Contract: wire v1 hiện tại và nội bộ mục tiêu

### 4.1 Delivery, claim, lease và report

Wire hiện có ở [types.go](../../services/web-push/types.go#L8),
[validation.ts](../../src/lib/web-push/validation.ts#L104). **Giữ nguyên wire v1**:

- Claim POST `/api/internal/web-push/v1/claim`: `version`, `worker_id`, `limit`,
  `vapid_key_version`, `vapid_fingerprint`. Response: `version`, `server_time`,
  `poll_after_seconds`, `deliveries`. Hiện limit tối đa 5, poll 5 giây.
- Delivery: `delivery_id`, `attempt_token`, `attempt`, `subscription_id`,
  `subscription_revision`, `lease_expires_at`, `deadline`, `ttl_seconds`,
  `vapid_key_version`, `endpoint`, `keys:{p256dh,auth}`, `payload_base64`.
  IDs opaque về ý nghĩa; hiện worker vẫn yêu cầu delivery/subscription/token là
  lowercase UUID, không nhận tùy ý ID từ adapter mới. Revision là decimal string
  để không mất bigint; nới định dạng phải review riêng.
- Source cấp attempt token mới mỗi lease, tối đa 100 attempts; lease không vượt
  `min(deadline, server_now + 45s)` ([claim](../../supabase/migrations/20260913020200_web_push_claim_recipient_eligibility.sql#L323)).
  Send hiện dùng snapshot `server_time` cố định cho cả batch, không cộng elapsed
  time khi gọi `sendOne` ([worker.go](../../services/web-push/worker.go#L187)). Tại
  snapshot đó, expired hoặc lease còn không đủ provider timeout 10s thì không gửi;
  TTL được clamp theo deadline/cấp phát/86400s. Đây chưa là bảo đảm chống expiry
  phát sinh do elapsed time trong batch; sửa giới hạn này cần test và review hành
  vi riêng, không gộp vào pilot error boundary. Giữ concurrency tối đa 5,
  backend timeout 5s ([worker.go](../../services/web-push/worker.go#L12)).
- Report POST `/api/internal/web-push/v1/report`: `version`, `results` gồm
  `delivery_id`, `attempt_token`, `subscription_revision`, `outcome`,
  `provider_status`, `retry_after_seconds` (hai field cuối có mặt, có thể null).
  Response `version`, `results:[{delivery_id,result}]`; result là
  `applied|duplicate|stale` ([worker_helpers.go](../../services/web-push/worker_helpers.go#L43)).
  Retry report phải dùng nguyên token/revision/result, không gửi provider lại.
  Source kiểm tra lease/token/revision/ownership trước update/revoke; report cũ
  không được thu hồi subscription revision mới. Duplicate cùng kết quả là idempotent.
- Nội bộ mục tiêu giữ cùng ý nghĩa delivery/lease/report và các port hiện có.
  App context nằm ở composition binding, **không thêm `app_id` vào v1**. Không
  bắt source app thứ hai đổi schema theo QLTBYT; adapter của nó trả Go contract này.

### 4.2 Retry và kết quả delivery

| Kết quả provider hiện tại              | Report / trách nhiệm                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- |
| 2xx                                    | `accepted`: provider nhận push, không chứng minh browser hiển thị/đọc.    |
| 404/410                                | `endpoint_gone`: source revoke đúng subscription revision sau fencing.    |
| 401/403                                | `credential_error`: terminal delivery, không tự rotate VAPID.             |
| 408/429/5xx hoặc lỗi send có thể retry | `transient`: source quyết định lịch lease mới.                            |
| Status còn lại / endpoint unsafe       | `permanent` / `unsafe_endpoint`; không retry provider trong cùng attempt. |
| Deadline/lease không đủ trước send     | `not_sent_expired` / `not_sent_lease_expired`.                            |

Source giữ durable rescheduling: exponential từ 5s, cap cơ sở 3600s, lấy max với
Retry-After rồi jitter tới 20%, không vượt deadline; expired/attempt cap do source
quyết định ([report](../../supabase/migrations/20260912000300_web_push_delivery_report.sql#L213),
[claim](../../supabase/migrations/20260913020200_web_push_claim_recipient_eligibility.sql#L124)).
Worker chỉ retry backend transport/report trong bộ nhớ: claim backoff 5s exponential
cap cơ sở 60s + jitter; report tối đa 2 retries, cơ sở 1s/2s, tôn trọng Retry-After
và earliest lease của batch theo clock đã hiệu chỉnh từ server time
([worker.go](../../services/web-push/worker.go#L358)). Ba logical report calls tối đa
vẫn có thể thêm physical HTTP retry cho replay nonce trong adapter.
Crash sau provider accept trước report có thể dẫn đến gửi lại khi reclaim; contract
không hứa exactly-once. Tag browser không thay thế attempt fencing.

### 4.3 Payload và quyền phía app

QLTBYT wire payload v1 có **đúng** `version`, `notification_id`, `title`, `body`,
`url`, `tag`; `version=1`, URL `/repair-requests?action=view&requestId=<id>`, tag
`repair-request:<id>` ([worker-payload.ts](../../src/lib/web-push/worker-payload.ts#L48),
[payload SQL](../../supabase/migrations/20260919120000_web_push_repair_message_copy.sql#L28)).
App tạo text/copy và validate click same-origin; service gửi opaque base64 payload
giới hạn 3072 decoded bytes, không parse repair route hoặc tự chọn recipient.
App thứ hai có payload/browser handler của nó; không mở rộng QLTBYT SW để nhận
payload app khác. Provider adapter vẫn validate endpoint/keys/size tại trust boundary.

Browser tiếp tục same-origin `/api/web-push/public-key`, `/subscriptions`,
`/subscriptions/revoke` dưới prefix `/api/web-push`. Mutation giữ session và
same-origin guard ([api.ts](../../src/lib/web-push/api.ts#L185)). App sở hữu opt-in,
recipient config, tenant policy, password/authorization epoch và quyền đọc request;
giữ kiểm tra riêng từng stage: enqueue membership/eligibility và quyền đọc; claim
thêm epoch/full eligibility; report owner/revision/epoch/read/config existence,
**không** gọi `web_push_recipient_is_eligible` như claim.

Consent true/false lưu riêng mỗi owner; A→B→A giữ lựa chọn từng account và chỉ
register owner đang đăng nhập. Restore chỉ khi native permission đã granted,
không gọi permission prompt từ effect. Session expiry/same-account relogin giữ
subscription; forced-password signout phải opt-out owner hiện tại. Giữ cleanup
đồng bộ trước restore owner mới và không xóa consent của owner khác.

### 4.4 Trusted app context và VAPID

Chọn một binding tin cậy cho mỗi app: **stable AppID → Backend instance, credential,
VAPID artifact/private key và worker/health state**. AppID do cấu hình operator
xác định; `don_vi` là tenant QLTBYT, HMAC key ID là rotation slot. Không lấy app
identity từ browser Origin, payload hay request `app_id` tự khai.

Worker hiện một binding/process. WP-04 bổ sung config binding; WP-05 chạy một worker
độc lập/binding trong runtime Go chung. Dùng key tra `(AppID, localID)` cho identity
trong runtime; không giả định UUID/endpoint/recipient duy nhất xuyên app. Report
đi đúng backend đã claim, không lookup lại theo delivery ID vào một global map.
Nếu nhiều app sau này dùng chung một source endpoint/store, source phải bind
credential với app và filter cả claim/report; worker binding đơn thuần không đủ.
Đó là mở rộng cần review riêng, không thêm field hay store ở WP-02.

Mỗi binding chọn đúng VAPID version/public key/fingerprint/private key, kiểm tra
artifact trước claim và key version mỗi delivery; mismatch fail closed. Giữ QLTBYT
VAPID hiện tại. Rotation credential không đổi AppID; hai app có credential/key
riêng, không fallback sang key của app khác. Inbound API nếu bổ sung sau phải có
authenticated credential binding; nằm ngoài thiết kế pull hiện tại.

### 4.5 Lỗi backend và pilot error boundary

Hiện `HTTPBackend` trả `APIError{Status,Code,RetryAfterSeconds,Err}` và unwrap được;
core đọc trực tiếp nó. Target chọn **một concrete `BackendError` core-owned** gồm
`Retryable`, `Disabled`, optional `RetryAfter` duration và wrapped cause. Không thêm
port mới. HTTP adapter map lỗi ở Claim/Report, giữ `APIError` qua `Unwrap` cho
diagnostics/`errors.As`; core không inspect HTTP status/code. Đây là thay đổi
Go error contract có chủ đích, **không đổi wire error envelope hoặc v1 fields**.

Mapping WP-02 phải giữ precedence đang có, kể cả edge cases:

- APIError có `Status == 0 || Status == 429 || Status >= 500` retryable; status
  khác terminal (predicate backend khác provider 500–599). Malformed 503 vẫn
  retryable dù cause có `ErrInvalidResponse`; malformed 2xx terminal.
- `disabled` chỉ tạo sleep 60s sau khi đã được phân loại retryable, không bỏ qua
  lỗi terminal chỉ vì code này. Poll disabled hiện luôn 60s, bỏ qua Retry-After
  kể cả hint lớn hơn 60s; poll retryable thông thường và report retry lấy max
  giữa delay cơ sở với hint. Tests phải giữ cả khác biệt này.
- Non-API `ErrInvalidResponse` terminal; unknown non-API errors giữ retryable
  như hiện tại. Cancellation và VAPID/not-ready giữ đường dừng hiện có.
- Adapter giữ strict size/version/JSON và một lần retry HTTP 409 `replay` bằng
  nonce mới; auth/config/version errors không trở thành provider outcomes.
- Không log secret/private key/endpoint/subscription keys hoặc raw error body.

Giữ default unknown-error retry hiện có cho pilot; thay đổi sang fail-closed mọi
unknown error cần review hành vi riêng, không gộp vào refactor này.

## 5. Pilot WP-02: tách backend error policy

**Slice được chọn:** claim/send/report một app qua Backend/Sender hiện có, chỉ
chuyển HTTP backend-error interpretation khỏi worker. Phạm vi là error contract,
adapter mapping, worker consumers và fake-port tests; không sửa DB, browser,
HMAC wire, VAPID, deployment hoặc đổi layout package. `APIError` vẫn thuộc adapter;
provider status fallback được giữ, không thêm Sender interface thứ hai.

Lợi ích: fake Backend có thể mô tả retry/disabled/fatal mà không dựng HTTP status;
adapter app thứ hai không phải giả lập `APIError`. Chi phí: một error type/mapping
và compatibility tests; cùng package vẫn chưa cưỡng chế import direction. Rủi ro
chính là sai precedence/retry, làm worker dừng hoặc gửi lại ngoài ý muốn; không có
lý do viết lại queue hay toàn bộ delivery models để đạt lợi ích này.

Acceptance pilot: core không nhắc `APIError`/HTTP backend status; mapping table ở
§4.5 có fake-port và HTTP-adapter coverage; existing success, TTL/server-clock,
concurrency/cancellation, accepted-report retry, stale report, 404/410/revision,
HMAC replay/strict response tests giữ xanh. Bổ sung test có giá trị cho malformed
503/2xx và disabled-terminal precedence trước sửa, không test chỉ chứng minh tên
type mới chưa tồn tại. Không đổi report resend semantics hay durable retry.

Rollback pilot: revert duy nhất code commit WP-02 và chạy lại suite; giữ artifact
runtime cũ để chọn lại ở bước rollout được duyệt riêng. Không migrate dữ liệu,
không rotate key, không cần browser re-enroll. Chỉ một active runtime binding cùng
scope khi chuyển phiên bản; tránh vô tình tăng worker/load. Live rollback vẫn cần
phê duyệt thao tác cụ thể, WP-01 không cấp quyền deploy.

## 6. Đường tới app thứ hai và runtime chung

WP-03 giữ QLTBYT HTTP adapter/wire cùng auth/fencing. WP-04 thêm trusted binding
và compatibility path cấu hình đơn app cũ. WP-05 compose các worker theo binding:
bounded concurrency/polling theo app, global bounded capacity, lỗi/paused/readiness
riêng; một app lỗi không dừng worker khác. Shutdown hủy mọi worker và drain/report
trong lease hợp lệ; metrics dùng app label từ config hữu hạn, không raw local IDs.
Không cần scheduler/broker/store mới; fairness tối thiểu bảo đảm mỗi app còn hoạt
động được poll và có capacity, kiểm chứng trong WP-05 trước bật nhiều app.

WP-06 dùng adapter/fixture app thứ hai với queue, recipient rules, auth và storage
độc lập; có thể implement cùng HTTP v1 hoặc map native queue qua Backend. Go core,
provider và runtime dùng chung; SDK/browser UI và SQL QLTBYT không là prerequisite.
Proof phải cho hai app trùng local ID, khác credentials/VAPID, lỗi riêng và report
không chéo. WP-07 kiểm chứng QLTBYT opt-in/account switch/forced-signout, register/
revoke và read links; WP-08 mới packaging/rollout/rollback có phê duyệt.

Default cutover chỉ đổi service delivery, giữ source queue/subscriptions và VAPID.
Nếu sau này chuyển store, cần reconciliation/registration evidence trước cutover:
local enabled có thể skip POST; session restoration có POST ở một số transition
không chứng minh mọi browser đã sync. Không chọn empty backend rồi chờ người dùng
tự đăng ký lại. Publish API/store trung tâm là thiết kế riêng khi có nhu cầu thật.

## 7. Verification và review gate

WP-01 chỉ sửa Markdown: format/link/source-location validation, không cần chạy
runtime tests để chứng nhận một refactor chưa thực hiện. Bằng chứng thực chạy được
ghi trong task WP-01; chưa có staging/live smoke hay DB gate ở task này.

Các lệnh cho WP-02/compatibility, chạy từ checkout đang review (không install):

```bash
# CWD: <checkout>/services/web-push — trước và sau pilot
go test ./...
go test -race ./...
# CWD: <checkout> — khi đối chiếu adapter/browser hiện có
node scripts/npm-run.js run test:run -- src/lib/web-push/__tests__ src/app/api/web-push/__tests__
# CWD: <checkout> — WP-01, chỉ ba file Markdown chạm tới
node scripts/npm-run.js exec -- prettier --check docs/architecture/web-push-hexagonal-assessment.md backlog/tasks/WP-01-architecture-contract-and-pilot.md backlog/tasks/web-push-hexagonal-index.md
```

Đây là chiến lược và lệnh tái chạy, không là claim rằng các suite trên đã chạy.
Nếu WP sau sửa TS/React/SQL, phải chạy đúng quality gates AGENTS.md tương ứng.
Parent đã review và chấp nhận §3–4 boundary/contract cùng §5 pilot cho WP-01;
không còn lựa chọn kiến trúc cốt lõi bị để ngỏ. Chi tiết capacity/config syntax
thuộc WP-04/05; app thứ hai thực tế và quyền rollout chưa được chọn ở WP-01.
