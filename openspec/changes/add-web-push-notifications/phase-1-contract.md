# Web Push contract v1

Ngày chốt: 2026-09-10. Phạm vi: tasks 1.1–1.4, tài liệu và regression baseline; chưa có implementation Web Push. Source khảo sát: `05f5cf5f5fe1b1daa0a70257dd8a0817344848b1`. [Evidence, giới hạn và requirement review](phase-1-evidence.md). Chính sách sản phẩm trong proposal/spec giữ nguyên.

## 1. Ownership, source và interface

QLTBYT sở hữu identity, authorization, recipient, subscription, payload, outbox, lease và retry schedule. Go chỉ poll, gửi provider và report. Source dự kiến trong repo này: `services/web-push/` (Go module, `cmd/web-push/main.go`, `Dockerfile`); binary `/usr/local/bin/web-push`; image `qltbyt-web-push:<git-sha>`, triển khai bằng digest. Compose/runbook thuộc `ops/web-push/`. Các đường dẫn là contract cho Phase 6, chưa tạo scaffold/repo/VM.

Owner vận hành là maintainer quản lý Oracle notification service; owner QLTBYT nhận public artifact, quản lý API và rollout controls. Không chia sẻ ZBS/DQSS credentials. Oracle chỉ outbound HTTPS tới origin QLTBYT cố định và push providers; health/readiness trên container port 8080, chỉ loopback/internal network. Không Go → Supabase, không ingress browser → Go, không DB/queue bền vững trong Go.

Tên DB dành riêng (Phase 2/4 mới tạo):

| Object                                  | Contract                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web_push_recipient_configs`            | Unique `(don_vi_id, user_id)`; user ID là bigint `nhan_vien.id`, không `auth.users` UUID                                                             |
| `web_push_subscriptions`                | UUID, endpoint unique, owner ID, keys, revision bigint, VAPID version, revoked_at, authorization epoch                                               |
| `web_push_notification_intents`         | UUID; unique `(event_type, request_id, recipient_user_id)`; snapshot, created_at, deadline, materialized_at, status                                  |
| `web_push_notification_deliveries`      | UUID; unique `(intent_id, subscription_identity)`; immutable subscription UUID snapshot, nullable subscription_id FK, revision, attempt/lease/result |
| `web_push_worker_nonces`                | Unique `(key_id, nonce)` và expires_at; shared replay store giữa mọi backend instance                                                                |
| `web_push_recipient_config_get/set`     | Session RPC: `p_don_vi`; set thêm `p_usernames text[]`; atomic resolve/replace, trả user ID/username trong scope                                     |
| `web_push_subscription_register/revoke` | Session RPC; owner lấy claims; register nhận subscription và key version; revoke nhận ID/revision, idempotent                                        |
| `web_push_subject_can_receive`          | Internal-only `(p_user_id bigint, p_don_vi bigint, p_request_id integer default null) → boolean`; profile từ DB, không worker claims                 |
| `web_push_worker_nonce_consume`         | Internal-only atomic insert nonce sau kiểm tra chữ ký; conflict từ chối replay                                                                       |
| `web_push_delivery_claim/report`        | Internal-only JSON v1 như wire dưới đây; transaction/fencing nằm ở DB                                                                                |

Không direct table access cho anon/authenticated. Session RPC kiểm tra caller; internal RPC chỉ server credential được phép, không thêm vào arbitrary browser RPC allowlist. Không đổi grant/allowlist ZBS. IDs bigint trên JSON là chuỗi thập phân dương để tránh JS precision loss; UUID lowercase; timestamps RFC3339 UTC; thời hạn do DB clock quyết định. Reject unknown fields, wrong types, duplicate JSON keys và version khác 1; không coercion identity.

Browser API (Phase 4):

| Method/path                                    | Request → response 200                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/web-push/config?don_vi_id=<decimal>` | `{version:1, don_vi_id, recipients:[{user_id, username}]}`; chỉ global/admin hoặc to_qltb đúng scope                         |
| `PUT /api/web-push/config`                     | `{version:1, don_vi_id, usernames:"a, b"}` → cùng response GET                                                               |
| `GET /api/web-push/public-key`                 | `{version:1, registration_enabled, vapid:{version, public_key, fingerprint}}`; vapid null khi chưa provision                 |
| `POST /api/web-push/subscriptions`             | `{version:1, vapid_key_version, subscription:{endpoint, keys:{p256dh, auth}}}` → `{version:1, subscription_id, revision}`    |
| `POST /api/web-push/subscriptions/revoke`      | `{version:1, subscription_id, revision}` → `{version:1, revoked:true}`; absent/already revoked owned subscription idempotent |

Các route private yêu cầu NextAuth server session, same-origin cho mutation và CSRF protection của route (không mặc định NextAuth bảo vệ custom route). Không nhận user_id/role/scope client cho registration. `Cache-Control: no-store` cho tất cả API kể cả public-key để tránh key/flag cũ. Config split dấu phẩy, trim, bỏ token rỗng, lowercase như `authenticate_user_dual_mode`, dedupe rồi resolve toàn bộ theo `lower(nhan_vien.username)`; ambiguity nhiều user cùng normalized username cũng reject. Chuỗi rỗng xóa config; max 100 recipients/tenant, input 8 KiB, username tối đa 256 UTF-8 bytes. Lỗi trả chung `invalid_recipients`, không tiết lộ tài khoản ngoài scope. Register lặp cùng owner/endpoint/keys/version đang active trả cùng ID/revision, không tạo delivery mới; thay keys/version hoặc re-enable tăng revision và hủy pending revision cũ. Revoke với revision cũ trả conflict, không thu hồi nhầm registration mới; không lộ subscription của owner khác.

## 2. Worker wire v1 và chống replay

Chỉ `POST /api/internal/web-push/v1/claim` và `POST /api/internal/web-push/v1/report`, HTTPS origin cấu hình cố định, không query/trailing slash/redirect. Content-Type `application/json`, UTF-8, không compression. Response JSON dùng version 1; lỗi `{version:1,error:{code,retry_after_seconds?}}`, không stack/SQL/provider raw body.

Headers bắt buộc: `X-Web-Push-Key-Id`, `X-Web-Push-Timestamp` (Unix seconds dạng decimal), `X-Web-Push-Nonce` (16 random bytes, 32 lowercase hex), `X-Web-Push-Signature` (64 lowercase hex). Key ID `[a-z0-9-]{1,64}`; secret HMAC riêng mỗi môi trường, 32 random bytes, lưu base64 rồi decode trước HMAC. Không dùng VAPID private key làm HMAC secret.

Canonical bytes, nối bằng LF, không LF cuối: `web-push-v1\n<key-id>\nPOST\n<exact-path>\n<timestamp>\n<nonce>\n<sha256-hex(raw-body)>`. HMAC-SHA256, compare constant-time sau kiểm tra encoding/length. Không parse/reserialize trước hash. Reject nếu lệch clock >60 giây; sau valid MAC, atomic consume nonce với TTL 180 giây theo server clock, trước claim/report mutation. Store lỗi thì 503/fail closed; in-memory replay cache không đủ trên Vercel. Retry HTTP phải tạo nonce/signature mới; attempt token giữ nguyên khi chỉ retry report.

Rotation HMAC: provision key mới cho server và worker, server chấp nhận current+previous đúng 24 giờ, worker chuyển signing key mới; hết overlap xóa previous. Key bị lộ revoke ngay không overlap. Key ID/environment ràng buộc secret riêng; không dùng ZBS signature nguyên trạng vì primitive đó ký source/fn/timestamp/body và không lưu nonce.

Test vector liên ngôn ngữ (chỉ bytes giả công khai, không credential; backend clock fixture = timestamp): key bytes `01` lặp 32 lần, key-id `test-key-1`, timestamp `1789056000`, nonce `000102030405060708090a0b0c0d0e0f`, path `/api/internal/web-push/v1/claim`. Raw body đúng một dòng dưới đây, không newline cuối:

<!-- prettier-ignore -->
```json
{"version":1,"worker_id":"oracle-web-push-1","limit":5,"vapid_key_version":"staging-20260910-01","vapid_fingerprint":"sha256:0000000000000000000000000000000000000000000000000000000000000000"}
```

Body SHA-256 `1495e63cd1255de20c6c4062a1eae98f1ff47743cca455a08dc43cd42600c3ce`; signature `fed0aa5536eec355be4295c446f3615e90e575315eb4a2abc0c24230e6992a28`. Đây chỉ là vector MAC, fingerprint dummy không vượt readiness production. Backend/Go Phase 4/6 dùng cùng vector; reserialize whitespace phải đổi digest/signature.

Claim request: `{version:1, worker_id:"oracle-web-push-1", limit:5, vapid_key_version:"staging-20260910-01", vapid_fingerprint:"sha256:<hex>"}`. Worker ID max 64 ASCII `[a-z0-9-]`, chỉ telemetry, không authorization. Server kiểm tra key metadata hiện hành khớp trước cấp việc.

Claim response: `{version:1, server_time, poll_after_seconds:5, deliveries:[...]}`. Mỗi delivery có đúng `{delivery_id, attempt_token, attempt, subscription_id, subscription_revision, lease_expires_at, deadline, ttl_seconds, vapid_key_version, endpoint, keys:{p256dh,auth}, payload_base64}`. Token UUID ngẫu nhiên mới mỗi claim; `payload_base64` là standard base64 của JSON UTF-8 đã giới hạn byte. Không gửi role, tenant claims, phone hoặc profile cho Go. Empty batch vẫn 200.

Report request: `{version:1, results:[{delivery_id, attempt_token, subscription_revision, outcome, provider_status, retry_after_seconds}]}`. `provider_status` là integer HTTP hoặc null khi chưa có HTTP; `retry_after_seconds` integer không âm hoặc null. Outcomes chỉ `accepted`, `endpoint_gone`, `transient`, `permanent`, `credential_error`, `not_sent_expired`, `not_sent_lease_expired`, `unsafe_endpoint`. Server validate outcome/status combination theo bảng §4, tự tính next_attempt_at, không tin worker cấp quyền/retry deadline.

Report response: `{version:1, results:[{delivery_id, result:"applied"|"duplicate"|"stale"}]}`. Toàn envelope invalid → 400/no writes; valid batch → per-item result. Exact repeat đã apply cùng token/result → duplicate/no write; token đã apply nhưng outcome khác, lease hết hạn/chuyển attempt hoặc revision đổi → stale/no write. Không có quyền report arbitrary delivery ID. Report không chứa endpoint/payload/provider response body. Accepted report bị mất có thể retry HTTP trong lease; hết lease không tự gửi lại provider, chờ backend reclaim.

API errors: 400 invalid_request, 401 unauthorized (missing/bad/expired signature), 403 forbidden (session scope), 409 replay/conflict hoặc key_version_mismatch, 413 body_too_large, 429 rate_limited + Retry-After, 503 disabled/unavailable + Retry-After. Unsupported version → 400 unsupported_version. Browser owner mismatch → 409 subscription_conflict, không trả owner cũ. Worker 400/401/403/409 key mismatch/413 dừng readiness và alert; 409 replay retry với nonce mới tối đa một lần; 429/503/transport backoff. Không thay đổi state khi auth/validation thất bại.

## 3. VAPID handoff

Owner Oracle notification service tạo P-256 key riêng staging/production bằng công cụ vận hành ở Phase 4/8; Phase 1 không tạo key thật. Public artifact `{version, public_key, fingerprint, subject}`: version `<environment>-<YYYYMMDD>-<sequence>`; public_key uncompressed P-256 point 65 bytes, base64url không padding; fingerprint `sha256:` + lowercase SHA-256 hex của 65 decoded bytes; subject mailto contact vận hành hợp lệ, được owner điền lúc provision. Không dùng fingerprint của chuỗi base64 hay private key.

Owner QLTBYT nhận chỉ public artifact, cung cấp qua public-key API; subscription lưu version và không register khi thiếu/mismatch. Private key là file secret read-only mount `/run/secrets/web_push_vapid_private_key`, không Git/image/env dump/QLTBYT/Supabase. Owner lưu bản backup có kiểm soát quyền; restart không regenerate. Go derive public key, so fingerprint/version với artifact app trước readiness và mỗi claim; mismatch không claim/send. Phase 5 dùng artifact test Phase 4, không chờ Go container.

Rotate VAPID: pause registration+dispatch, đợi lease cũ tối đa 45 giây, backup cặp cũ, provision public/private đồng bộ, mark version cũ cần resubscribe; readiness match mới bật lại registration rồi dispatch. Không chuyển key trên subscription cũ. Giữ key cũ tối thiểu 7 ngày cho rollback; rollback cũng pause, kiểm tra compatibility, chỉ version được chọn được claim. Pending deadline không reset; không cam kết rotation không gián đoạn.

## 4. Giới hạn vận hành và state

| Limit                | Giá trị v1                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Poll khi khỏe        | 5 giây; có backlog poll ngay sau batch hoàn tất; 1 worker mặc định                                                                                                            |
| Batch và concurrency | Claim/report tối đa 5 deliveries; Go gửi song song tối đa 5, không prefetch batch tiếp theo                                                                                   |
| Lease                | 45 giây, không heartbeat/renew; claim attempt token mới bằng atomic locking, SKIP LOCKED hoặc tương đương                                                                     |
| Timeout              | Claim/report 5 giây mỗi HTTP call; provider 10 giây tổng DNS/connect/TLS/body; không retry send bên trong worker                                                              |
| Report retry         | Tối đa 2 retry HTTP (1 giây, 2 giây), cùng result/token, nonce mới, chỉ trước lease expiry                                                                                    |
| API body/response    | Config/register 16 KiB; claim 2 KiB; report 8 KiB; claim response 48 KiB; reject streaming vượt cap kể cả thiếu Content-Length                                                |
| Subscription         | Endpoint 2048 UTF-8 bytes, HTTPS, không userinfo/fragment/custom port ngoài 443; p256dh decoded 65 bytes valid P-256, auth decoded 16 bytes; max 10 active subscriptions/user |
| Payload              | JSON plaintext tối đa 3072 bytes sau serialization UTF-8; một aes128gcm record, padding tối thiểu; encrypted body không quá 4096 bytes                                        |
| Deadline             | Intent created_at + 86400 giây; không reset khi retry/restart/enable; provider TTL = floor(min(86400, deadline − now))                                                        |
| Delivery retries     | Max 100 attempts tính cả lease reclaim; delay = min(3600, 5 × 2^(attempt−1)) giây, cộng jitter 0–20%, cap cuối 3600 giây                                                      |
| Retry-After          | Parse delta seconds hoặc HTTP date theo response time; dùng max(backoff, Retry-After), không rút ngắn; nếu vượt deadline → expired                                            |
| Worker API throttle  | 60 requests/phút/key; 429 có Retry-After; disabled pause 60 giây; transport backoff 5→10→20→40→60 giây với jitter 0–20%                                                       |
| Retention            | Terminal intent/delivery 7 ngày từ terminal_at; revoked subscription 7 ngày rồi xóa keys/endpoint/row; nonce 180 giây; purge theo lô 500 mỗi giờ ở backend, không Go          |

Các giới hạn đo từ lúc request commit: poll 5 + claim 5 + send 10 = 20 giây khi worker rảnh và backend/provider khỏe; còn margin tới mục tiêu 60 giây. Đây không phải SLA dưới backlog/rate limit. Alert khi oldest eligible backlog >60 giây, credential/readiness lỗi hoặc có expired; metrics accepted/failed/retried/cancelled/expired và latency riêng, không gọi accepted là delivered/read. Payload, endpoint, keys, HMAC và phone không vào log.

Provider mapping:

| Kết quả                           | Outcome / backend action                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| HTTP 2xx                          | accepted → terminal accepted cho đúng delivery                                                     |
| 404/410                           | endpoint_gone → revoke đúng subscription/revision, cancel pending cùng revision                    |
| 408/429/5xx, network timeout      | transient → retry bounded; không xóa subscription                                                  |
| 401/403                           | credential_error → terminal failed, worker pause/alert; không mass revoke                          |
| 400/413, 3xx hoặc HTTP khác       | permanent → terminal failed/inspectable, không follow redirect                                     |
| Unsafe DNS/IP/endpoint            | unsafe_endpoint, status null → terminal failed, không network send                                 |
| Deadline hết trước send           | not_sent_expired, status null → expired                                                            |
| Lease không đủ 10 giây trước send | not_sent_lease_expired, status null → release sang retry; next_attempt_at theo backoff, không send |

Backend lấy min(lease remaining, deadline remaining, provider timeout) làm hạn xử lý; Go kiểm tra lại deadline/lease trước send, bù clock từ server_time theo hướng bảo thủ. TTL <1 → không gửi. DNS tại registration chỉ là kiểm tra bổ sung; Go resolve từng lần, reject mọi non-public IPv4/IPv6 (loopback, private, link-local, multicast, unspecified, IPv4-mapped bypass), pin validated IP cho connection với TLS/SNI host gốc, không proxy môi trường/redirect/DNS re-resolution bypass. URL query của provider phải giữ nguyên, không log.

Intent: pending → materialized → completed; hoặc cancelled/expired. Lần đầu có subscription hợp lệ, snapshot fan-out atomically; retry chỉ delivery đã materialize, không thêm browser về sau. Chưa có subscription thì chờ và kiểm tra lại mỗi 60 giây trong 24 giờ (không tăng delivery attempt). Delivery: pending/retry → leased → accepted/failed/expired/cancelled hoặc retry. Intent completed khi mọi delivery terminal, kể cả mixed failure; lưu counters, không coi completed là tất cả accepted. Purge phải giữ endpoint tombstone đến khi không còn lease/pending tham chiếu và đã qua revoked_at + 7 ngày. Delivery lưu `subscription_identity` UUID bất biến không FK để unique `(intent_id, subscription_identity)` tồn tại sau purge; `subscription_id` nullable FK `ON DELETE SET NULL`, tuyệt đối không CASCADE xóa delivery khi purge subscription. Lúc materialize hai trường bằng nhau; claim yêu cầu FK còn trỏ subscription hợp lệ. Chỉ xóa subscription khi mọi delivery liên quan terminal; giữ identity/revision/result tới retention terminal của delivery, không cần keys/endpoint. Intent chỉ purge sau khi mọi child delivery đủ retention, xóa child rồi intent cùng transaction; không xóa sớm terminal history.

Enqueue snapshot recipient tại commit, request tenant lấy thiết bị; thêm config sau không backfill. Mỗi claim/retry recheck user tồn tại/profile hợp lệ, config hiện hành, request hiện tại vẫn cùng tenant intent, quyền subject, owner/revision và VAPID version; thiếu dữ liệu hoặc đổi tenant → cancel. Revoke/ownership revision tăng thì pending cancel và report cũ stale; không tự chuyển endpoint sang account khác. Account switch cần revoke bằng session cũ và local unsubscribe trước register account mới; conflict phải yêu cầu unsubscribe/resubscribe, không overwrite owner. Offline logout budget cleanup 3 giây, không chặn signout vô hạn; retry khi phiên hợp lệ cho phép, không mang credential cũ trong local storage. Subscription lưu password_changed_at tại registration (authorization epoch); epoch khác DB thì revoke và yêu cầu opt-in lại, giữ semantics invalidation mật khẩu hiện hành mà không yêu cầu user online. Race sau claim không thu hồi được provider acceptance.

Controls riêng registration/enqueue/dispatch mặc định false, canary allowlist tenant ở backend; enqueue check trong transaction, dispatch check mỗi claim, registration tắt vẫn cho revoke. Disabled response 503 + Retry-After 60; không cấp job mới. Enqueue DB error rollback cả transaction để giữ atomicity; network delivery sau commit không tác động request/ZBS. Giới hạn hiện tại không cần broker/autoscale; Phase 7 đo throughput trước mở rộng.

## 5. Authorization truth table

Subject là `nhan_vien.id` đọc tại thời điểm check, tuyệt đối không dùng worker JWT để gọi `repair_request_get` thay recipient. Profile role phải thuộc danh sách supported chính xác của profile RPC. Không có guard `nhan_vien.active` trong profile; `is_active` xuất hiện trong SQL fixture cũ cũng không chứng minh account lifecycle có guard này. Không thêm feature khóa account. Password epoch thuộc subscription lifecycle, không biến quyền recipient thành điều kiện đang đăng nhập.

Nguồn: `20260824070104_add_session_authorization_profile_for_jwt_rpc.sql`, `20260428132000_fix_repair_request_read_scope.sql`, `2025-10-04/20251004071000_fix_jwt_claim_reading_with_fallback.sql`, `20260515113000_reassert_department_scope_unicode_aliases.sql`; `src/auth/{types,next-auth-callbacks,server-claims}.ts`; `src/app/api/rpc/[fn]/{rpc-session-claims,route,allowed-functions}.ts`.

`D` = tenant thiết bị hiện tại; `H` = nv.don_vi; `C` = nv.current_don_vi; `R` = coalesce(nv.dia_ban_id, don_vi[coalesce(C,H)].dia_ban_id). Điều kiện tách theo stage: **config** cần subject/profile và tenant scope hợp lệ, không cần config cũ, request hay subscription; **enqueue** thêm config hiện hành và quyền trên request+equipment tồn tại, vẫn không cần subscription; **claim/retry** thêm active subscription/owner/revision/VAPID/epoch hợp lệ. Vì vậy người chưa bật browser vẫn được cấu hình và có intent chờ 24 giờ. `getSessionClaims` còn yêu cầu diaBan không null cho mọi role: fresh-profile parity vì vậy deny khi R null, kể cả global/admin, dù SQL get riêng lẻ có thể bypass tenant. Non-user department null chuyển thành chuỗi rỗng như fresh auth hydration, không thêm department restriction; riêng user vẫn deny. Role user phải có normalized khoa/phòng để có khả năng nhận.

| Subject/case                                             | Config recipient cho D                                             | Request-specific                                                             | Caller được sửa config? |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------- |
| global/admin                                             | Allow đơn vị tồn tại                                               | Allow mọi D, không department filter                                         | Có, đơn vị được chọn    |
| regional_leader                                          | D.active=true và D.dia_ban_id=R, R có giá trị                      | Cùng điều kiện, không department filter                                      | Không                   |
| to_qltb C có giá trị                                     | D=C                                                                | D=C                                                                          | Có, chỉ C               |
| to_qltb C null                                           | D=H                                                                | D=H                                                                          | Có, chỉ H               |
| to_qltb đổi C từ A sang B                                | A deny, B allow                                                    | Pending A cancel ở claim tiếp theo                                           | Chỉ B                   |
| technician/qltb_khoa                                     | D=coalesce(C,H)                                                    | D=coalesce(C,H), không department filter                                     | Không                   |
| user, khoa/phòng normalize không rỗng                    | D=coalesce(C,H)                                                    | D=coalesce(C,H) và normalize(tb.khoa_phong_quan_ly)=normalize(nv.khoa_phong) | Không                   |
| user khoa/phòng null/empty/whitespace                    | Deny                                                               | Deny, kể cả thiết bị cũng rỗng                                               | Không                   |
| user khoa/phòng khác thiết bị                            | Có thể config nếu D=coalesce(C,H) và profile department không rỗng | Deny cho request khác department                                             | Không                   |
| chuyen_gia                                               | Deny repair capability                                             | Deny: proxy expert allowlist và tenant guard không cho repair                | Không                   |
| User bị xóa, null/unsupported role, scope bắt buộc thiếu | Deny                                                               | Deny, không fallback theo worker                                             | Không                   |
| Worker admin/service-role, recipient bị deny             | Không làm thay đổi kết quả                                         | Deny                                                                         | Không là caller UI      |

Normalization dùng primitive DB: NFC, NBSP/CR/LF/tab thành space, hyphen thành space, gộp whitespace, lowercase, alias từ `ct` thành `chấn thương`; không tự viết bản JS gần giống. Table không thêm active filter cho scoped non-regional/global vì read guard không có; không nhầm `don_vi.active` với account active. `authenticate_user_dual_mode` có tenant/region active checks lúc login, nhưng profile refresh/read không áp lại toàn bộ; đây là giới hạn source, không tự sửa trong Web Push.

Parity test Phase 2 phải dựng claims từ cùng durable profile theo table rồi so repair read, cộng proxy deny của expert. **Không tuyên bố parity với session cũ:** `applyJwtProfileRefresh` hiện gán resolved C/H vào token.don_vi cho mọi role, giữ khoa_phong/dia_ban cũ khi profile rỗng, và current_don_vi token có thể cũ. Vì vậy không đọc tên biến assignedDonVi của proxy rồi kết luận non-manager luôn dùng H: durable reconstruction phải đi qua semantics refresh C/H. Theo yêu cầu đã chốt, background deny department mất, không kế thừa snapshot cũ; khác biệt session này phải có test case/ghi evidence riêng, không sửa auth runtime trong change này. Global bypass của `repair_request_get` xảy ra trước tenant helper nên không kế thừa helper chỉ liệt kê đơn vị active. Missing request, subject bị xóa hoặc expert không được diễn giải là allow chỉ vì role thuộc supported profile.

## 6. Payload, PWA và browser

Payload JSON v1 đúng shape `{version:1, notification_id, title, body, url, tag}`. `notification_id`=intent UUID, `tag`=`repair-request:<request-id>`, url từ `buildRepairRequestViewHref` (`/repair-requests?action=view&requestId=<id>`), relative same-origin only. Title=tên thiết bị (max 256 bytes); body=`<khoa/phòng>\n<mô tả>` (department max 256, issue max 1800 bytes), null field dùng `Chưa có thông tin`. Cắt từng Unicode code point, dùng ellipsis trong budget; kiểm lại serialized JSON 3072 bytes gồm escaping, giảm issue rồi department/title nếu cần, giữ tên trường và URL. Không thêm requester/phone/secret; render text, không HTML. Go kiểm encrypted bytes 4096 trước gửi, không tự format lại payload.

Chỉ service worker gọi showNotification; foreground không handler thứ hai. Click chỉ same-origin repair view hợp lệ; focus/navigate existing client hoặc openWindow, login/quyền hiện tại kiểm lại. Tag giảm duplicate chứ không exactly-once; không hứa thu hồi nội dung đã lên màn hình khóa.

Baseline: manifest name/start_url `/`/scope `/`/standalone và bốn PNG icon đã có; chưa explicit `id`, screenshots là placeholder. Layout link manifest; next.config Serwist `src/sw.ts`→`public/sw.js`, register=false, dev disabled; PWAInstallPrompt đăng ký production bằng Serwist hoặc `/sw.js`. Worker đã `precacheEntries` và `defaultCache`; không mô tả là network-only. Phase 5 dùng cùng worker/scope, thêm push/click; không thêm cache auth/API/key metadata, kiểm tra behavior hiện tại trước thay đổi, không tranh thủ redesign offline caching. Phase 7 kiểm manifest/icon thực tế, HTTPS, cài Home Screen và nhận push trên thiết bị; source inventory không chứng minh installability.

Matrix bắt buộc: Chrome/Edge desktop, Android Chrome/Edge, Firefox desktop, iOS/iPadOS Web Push hỗ trợ qua installed Home Screen app (iOS/iPadOS 16.4+ là mốc hỗ trợ tối thiểu, vẫn feature-detect). Mỗi platform ghi version, permission từ user gesture, foreground/background, click/login, revoke/logout/account switch. Không hỗ trợ/denied thì app vẫn dùng được, hướng dẫn tiếng Việt không prompt lặp; chưa có browser evidence trong Phase 1.
