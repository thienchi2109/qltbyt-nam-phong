## Context

Evidence khảo sát repository, không phải xác nhận live deployment:

- `src/auth/config.ts`: NextAuth Credentials gọi `authenticate_user_dual_mode`; identity ứng dụng thuộc `nhan_vien`.
- `src/app/api/rpc/[fn]/rpc-session-claims.ts`: claims lấy từ server session và chuẩn hóa scope; ngoài proxy dùng `isGlobalRole()` cho cả admin/global.
- `supabase/migrations/20260630100000_add_zbs_recipient_config_and_outbox.sql`: `repair_request_create` ghi ZBS recipient/outbox trong transaction, recipient là phone theo `don_vi_id`.
- `supabase/migrations/20260630103000_disable_legacy_repair_request_push_trigger.sql`: bỏ trigger Firebase cũ. `src/lib/__tests__/firebase-runtime-audit.test.ts` bảo vệ việc xóa scaffold runtime.
- `src/app/api/device-quota/mapping/suggest/suggestion-vm-client.ts`: tiền lệ service VM qua HTTPS, Cloudflare Access/internal token và timeout. Không suy diễn mô tả HMAC trong tài liệu DQSS là code đã có.
- `src/lib/zbs/internal-rpc-signature.ts`: tiền lệ signed internal request; có thể tái sử dụng primitive thích hợp sau semantic dedupe, không tái sử dụng credential/quyền ZBS.
- `src/lib/repair-request-deep-link.ts` và `useRepairRequestsDeepLinkView.ts`: tái sử dụng deep link hiện hành, không khôi phục URL Firebase `?id=` cũ.

## Goals / Non-Goals

Thêm một kênh bền vững với trách nhiệm nhỏ, giữ nguyên ZBS. Scope/non-goals tại [proposal](proposal.md); hành vi bắt buộc tại [spec](specs/notifications/spec.md). Không tạo event bus hoặc framework đa kênh cho một event.

## Decisions

### 1. Ownership và kết nối

Browser -> QLTBYT server -> Supabase RPC. Go trên Docker/Oracle -> HTTPS QLTBYT claim/report -> Supabase RPC; Go -> browser push provider bằng HTTPS outbound.

QLTBYT sở hữu identity, quyền, cấu hình, subscription, payload nghiệp vụ, outbox và retry schedule. Go chỉ claim batch có giới hạn, mã hóa/gửi Web Push, báo kết quả; VAPID private key chỉ ở Go. Public key được phân phối cho browser qua cấu hình công khai của app.

Không Go -> Supabase trực tiếp, không Supabase service-role key trên Oracle, không browser -> Go. Worker chủ động kết nối nên không cần ingress công khai cho container; health endpoint chỉ nội bộ/loopback. Cloudflare Access của DQSS không cần sao chép vì chiều gọi khác. QLTBYT vẫn phụ thuộc Supabase Cloud qua đường RPC sẵn có.

Worker API dùng credential riêng, signed method/path/body/timestamp và nonce hoặc cơ chế chống replay tương đương, kiểm tra constant-time, cửa sổ thời gian hữu hạn và rotation có overlap. Chỉ endpoint claim/report được cấp quyền; không mở arbitrary RPC. Có giới hạn body/batch/timeouts và không log secrets/subscription endpoint/payload sự cố. Chốt wire format và nơi đặt source Go ở phase 1, trước khi hai phía implement; không cần thêm quyết định sản phẩm.

### VAPID provisioning và dependency

Owner vận hành notification service quản lý cặp key theo từng môi trường. Phase 1 chốt fingerprint/version và quy trình bàn giao; không tạo production secret trong phase contract. Phase 4 dùng key test riêng để cung cấp public key/version qua cấu hình app và ghi version vào subscription. Phase 5 chỉ cần artifact public key/version của Phase 4, không phụ thuộc container Phase 6 đang chạy.

Phase 6 kiểm tra public key suy ra từ private key khớp version/fingerprint của app trước readiness; thiếu hoặc lệch thì không claim/send. Private key lưu ở secret store vận hành dành riêng cho Go, không trong Git/image, QLTBYT hoặc Supabase; không tự tạo lại lúc container restart. Phase 8 owner tạo/provision cặp production, phân phối chỉ public key/version cho QLTBYT và kiểm tra khớp trước bật registration.

Rotation MVP là thao tác có kiểm soát: pause registration/dispatch, đổi cặp key đồng bộ, đánh dấu subscription version cũ cần đăng ký lại và hướng dẫn user resubscribe; không gửi subscription cũ bằng key mới. Giữ secret version cũ để rollback trong cửa sổ vận hành, không tuyên bố rotation không gián đoạn. Delivery chỉ dùng subscription version tương thích.

### 2. Recipient và subscription

UI cấu hình theo đơn vị của thiết bị, cho global/admin và to_qltb đúng scope. Parse username bằng dấu phẩy, trim, loại trùng, resolve theo semantics username hiện có; lưu quan hệ user ID riêng từng recipient. Reject toàn bộ nếu unknown/inactive/không đủ quyền. Danh sách rỗng là tắt recipient Web Push của đơn vị. Không tự thêm global fallback.

Subscription gồm endpoint, p256dh/auth keys, owner user ID và trạng thái/revision. Server tự lấy owner từ session; client không được chỉ định user/tenant khác. Endpoint unique, tránh subscription một browser đồng thời thuộc hai tài khoản. Bật thông báo bằng thao tác người dùng; chặn/không hỗ trợ có hướng dẫn, không prompt lặp lại. Một account nhận trên mọi subscription hoạt động.

Tắt/đăng xuất gỡ liên kết browser trước khi hoàn tất signout nếu server reachable; thu hồi local subscription và retry cleanup khi có thể nếu offline. Không chặn đăng xuất vô hạn vì mạng lỗi. Backend phải loại subscription đã thu hồi trước claim; account switch không được giữ owner cũ. Không hứa thu hồi bản tin đã provider nhận, hoặc thu hồi server tức thì khi thiết bị offline. Tests phải thể hiện giới hạn này thay vì khẳng định logout luôn thu hồi từ xa.

### Authorization theo recipient, không theo worker session

`repair_request_get` tại `20260428132000_fix_repair_request_read_scope.sql` dùng JWT, `allowed_don_vi_for_session()` và `_normalize_department_scope`; không gọi nguyên RPC này dưới identity worker để kết luận recipient được nhận. Predicate background nhận subject user ID + request ID, đọc lại `nhan_vien` và thiết bị của request từ DB, fail-closed khi thiếu/không hợp lệ; chỉ server-internal được invoke. Không nhận role/tenant/department từ browser hoặc worker payload.

Giữ parity với quyền tương tác: admin/global được normalize; regional_leader dùng địa bàn hiện hành và đơn vị active; to_qltb dùng `current_don_vi` hiện hành trong DB, fallback `don_vi` giống RPC claims (không dùng session snapshot cũ); role khác dùng đơn vị được profile hiện hành cho phép. Riêng role `user` phải khớp khoa/phòng đã normalize của thiết bị; khoa/phòng thiếu thì deny. Membership/config Web Push chỉ là điều kiện bổ sung, không mở rộng quyền. Khi to_qltb đổi current_don_vi, pending delivery ngoài scope mới phải bị loại; không mặc định gửi toàn bộ đơn vị từng được cấu hình.

Account eligibility bám `get_session_authorization_profile_for_jwt` trong `20260824070104_add_session_authorization_profile_for_jwt_rpc.sql`: subject còn tồn tại và role được hệ thống hỗ trợ, cùng các guard profile hiện hành. Schema khảo sát không có `nhan_vien.active`; migration `20251004074000_fix_column_references_final.sql` còn ghi nhận cột này không tồn tại. Từ “active account” trong change này nghĩa là profile còn hợp lệ theo account lifecycle hiện có, không phải một boolean mới. Không tạo account-disable feature trong scope này; nếu implementation phát hiện lifecycle guard mới thì áp dụng vào predicate và test, không bỏ qua hoặc tự bịa cột.

Phase 1 pin truth table từ định nghĩa source mới nhất của profile/tenant/read guards; Phase 2 implement subject predicate dùng primitive hiện có khi phù hợp. Configuration kiểm tra subject được phép với đơn vị, enqueue và mỗi claim/retry kiểm tra thêm request cụ thể; không yêu cầu một request đã tồn tại để lưu config. Test parity dùng claims dựng từ cùng durable profile để so với quyền đọc tương tác, cộng test worker đặc quyền không thể cấp quyền cho recipient bị từ chối.

### 3. Outbox và quyền hiện hành

Dùng Web Push tables/RPC riêng, không nhét user ID vào ZBS phone schema. Trong cùng transaction tạo request, snapshot recipient hợp lệ và ba trường nội dung; tenant lấy từ thiết bị, không từ input client. Rollback request thì không có outbox. Không có recipient thì không enqueue; thêm recipient sau này không backfill sự kiện cũ.

Giữ một ý định logic unique theo event/request/recipient. Materialize delivery theo subscription hiện hành ở lần dispatch đầu; retry theo delivery riêng, không gửi lại endpoint đã thành công chỉ vì endpoint khác lỗi. Recipient chưa có subscription được kiểm tra lại trong hạn 24 giờ; không phát lại lịch sử cho thiết bị mới sau khi ý định đã hoàn tất. Khóa duy nhất event/request/recipient/subscription ngăn fan-out trùng.

Claim atomically dùng lease có hạn và attempt token; stale worker không được overwrite kết quả attempt mới. Trước mỗi claim/retry, kiểm tra tài khoản còn active, còn trong config cùng đơn vị, có quyền xem request, subscription vẫn thuộc account. Thu hồi thì cancel pending deliveries. Mất quyền sau claim là race có giới hạn: lease ngắn, worker gửi ngay, không có queue riêng; không thể đảm bảo thu hồi sau khi provider chấp nhận.

Deadline = created_at + 24 giờ; TTL provider không vượt thời gian còn lại. Retry bounded exponential backoff/jitter cho timeout, 429 (tôn trọng Retry-After) và lỗi tạm thời; 404/410 revoke endpoint. Lỗi credential/payload vĩnh viễn có trạng thái inspectable, không retry nóng hoặc xóa hàng loạt subscription. Có counters/backlog age/expired/failed, không diễn giải provider accepted thành user received/read.

Transaction enqueue lỗi nội bộ sẽ rollback để giữ tính nguyên tử; lỗi mạng/provider/Go xảy ra sau commit và không tác động việc tạo request hay ZBS. Outbox không có nghĩa mọi lỗi DB đều được phép bỏ qua.

### 4. Payload và browser

Title/body chứa tên thiết bị, khoa/phòng quản lý, mô tả sự cố snapshot lúc tạo; Unicode-safe truncation và byte budget dưới giới hạn Web Push sau mã hóa. Không nhúng secret, dữ liệu quyền hoặc nội dung ngoài ba trường đã chốt. Click URL cùng origin qua helper deep link; đăng nhập và quyền hiện tại quyết định mở chi tiết.

Service worker xử lý push/background/click, tránh hai notification hiển thị cho cùng message do foreground và background cùng xử lý. Stable notification tag giảm trùng hiển thị nhưng không bảo đảm exactly-once. Push provider vẫn là hạ tầng browser vendor, có thể là Google trên Chromium dù không dùng Firebase project/SDK.

Baseline đã có `public/manifest.json`, manifest metadata tại `src/app/layout.tsx`, Serwist config tại `next.config.ts`, worker source `src/sw.ts` và production registration `/sw.js` tại `src/components/pwa-install-prompt.tsx`. Phase 5 mở rộng worker/registration này, không thêm worker thứ hai cùng scope. Phase 5 kiểm kê manifest/metadata/icon/service-worker registration hiện có và bổ sung phần thiếu để app cài được: manifest có identity, name, start_url/scope cùng origin, display standalone và icons phù hợp; metadata link manifest, HTTPS và service worker registration với scope tương thích. Không thêm offline caching hoặc cache dữ liệu có auth. Phase 7 kiểm chứng luồng thêm Home Screen, mở installed standalone, user-gesture permission, subscription và push thực tế trên iOS/iPadOS; chỉ có hướng dẫn UI không đủ nghiệm thu.

MVP hỗ trợ desktop Chrome/Edge/Firefox, Android Chrome/Edge và iOS/iPadOS hỗ trợ Web Push qua installed Home Screen web app. Feature detection và hướng dẫn tiếng Việt; không ép permission hay giả định browser đóng luôn nhận ngay.

### 5. Phương án đã loại

- Gọi HTTP sau RPC từ browser/server: có cửa sổ mất event, không đáp ứng gửi bù khi process chết.
- Trigger HTTP Firebase cũ: identity không phù hợp, coupling mạng, không dùng lại.
- Broker + Go DB/queue: hai nơi giữ retry/ownership, không cần cho một event.
- Go truy cập Supabase bằng service-role key: mở rộng đặc quyền và coupling dữ liệu; backend QLTBYT đã sở hữu authorization.

## Risks / Trade-offs

- Vercel/backend downtime làm chậm worker; outbox phục hồi trong 24 giờ, không cần queue thứ hai.
- Provider accepted nhưng report mất có thể gây duplicate khi retry; delivery semantics là at-least-once attempts, không đảm bảo hiển thị.
- Nội dung sự cố có thể hiện trên màn hình khóa theo quyết định maintainer; opt-in phải giải thích và preview nội dung. OS có thể cắt thêm nội dung.
- Polling mục tiêu 60 giây cần xác minh cron/worker cadence, rate budget và cold-start thực tế. Không gọi đây là SLA thiết bị.
- VAPID rotation có thể cần resubscribe; runbook giữ key ổn định qua container restart, backup/rotation an toàn.
- URL subscription là input không tin cậy: validate HTTPS/keys/size, chặn loopback/private/link-local và redirect/DNS-rebinding khi gửi để chống SSRF.

## Migration Plan

Các phase tại [tasks](tasks.md) là đơn vị review/deploy. Default tắt registration, enqueue và dispatch bằng controls riêng; chỉ bật theo thứ tự sau nghiệm thu. Schema additive, forward-only; không sửa migration applied, không xóa Firebase lịch sử.

Rollback vận hành: tắt Web Push dispatch/enqueue/registration theo sự cố, giữ subscription/outbox để điều tra; worker pause không chạm ZBS. Pending events vẫn hết hạn theo created_at, không reset deadline khi bật lại. Disable endpoint phải có response rõ để worker backoff. Khi registration tắt vẫn cho revoke/logout cleanup.

Live DB chỉ qua Supabase MCP với quyền cụ thể; static và Oracle baseline-forward cùng exact landed commit trước live review. Candidate SQL chạy disposable gate DB, không chạy vào restored baseline. Oracle app deploy riêng với Oracle DB gate; dùng container/network/secrets riêng, không đụng test DB stack.

## Implementation Decisions To Pin In Phase 1

Vị trí source/build artifact Go, tên bảng/RPC và wire contract, batch/lease/backoff constants, giới hạn payload và retention phải được ghi cụ thể trước implementation phụ thuộc. Đây là chi tiết kỹ thuật, không mở lại Q1-Q11. Không tự tạo repo ngoài hoặc provision production trong phase contract.
