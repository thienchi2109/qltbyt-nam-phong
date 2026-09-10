## ADDED Requirements

### Requirement: Independent Web Push Channel

Hệ thống SHALL thêm Web Push cho mọi `repair_request_created`, bảo toàn ZBS phone configuration, enqueue, dispatch và delivery state hiện có.

#### Scenario: Both channels configured

- **WHEN** tạo thành công yêu cầu sửa chữa ở bất kỳ mức ưu tiên nào
- **THEN** ZBS enqueue theo số điện thoại như trước và Web Push enqueue riêng theo tài khoản hợp lệ của đơn vị thiết bị
- **AND** một kênh lỗi delivery hoặc retry không chặn hay gửi lại kênh còn lại

#### Scenario: Web Push disabled

- **WHEN** Web Push chưa bật hoặc không có recipient
- **THEN** tạo yêu cầu và ZBS giữ nguyên hành vi, không fallback sang tài khoản/đơn vị khác

### Requirement: Tenant Scoped Account Configuration

Hệ thống SHALL cung cấp cấu hình username phân cách bằng dấu phẩy theo đơn vị; global/admin được chọn đơn vị, to_qltb chỉ cấu hình đơn vị được phép quản lý. Recipient SHALL active và đủ quyền xem yêu cầu tương ứng; cấu hình SHALL NOT cấp thêm quyền.

#### Scenario: Valid list

- **WHEN** người có quyền lưu danh sách username hợp lệ
- **THEN** server trim, loại trùng, resolve username theo quy tắc hiện hành và lưu từng user ID ổn định
- **AND** danh sách rỗng tắt recipient Web Push của đơn vị

#### Scenario: Invalid or unauthorized list

- **WHEN** bất kỳ username không tồn tại, inactive, không đủ quyền hoặc caller vượt scope
- **THEN** server từ chối, không lưu một phần và UI báo lỗi phù hợp không lộ dữ liệu ngoài scope

### Requirement: In App Notification Registration

Hệ thống SHALL cho người dùng tự bật/tắt thông báo trong app trên từng browser. Server SHALL lấy identity từ NextAuth session, kiểm tra ownership và input subscription; quản trị viên SHALL NOT cấp browser permission thay người nhận.

#### Scenario: Explicit opt in

- **WHEN** người đã đăng nhập bấm bật và cấp quyền trên browser hỗ trợ
- **THEN** tạo Web Push subscription liên kết duy nhất với account hiện tại qua backend QLTBYT
- **AND** hiển thị giải thích nội dung có thể xuất hiện trên màn hình khóa

#### Scenario: Denied or unsupported

- **WHEN** quyền bị chặn/từ chối hoặc browser không hỗ trợ
- **THEN** không tạo subscription, không prompt lặp lại và app vẫn hoạt động
- **AND** UI hướng dẫn cài Home Screen app khi iOS/iPadOS yêu cầu

#### Scenario: Forged ownership or unsafe endpoint

- **WHEN** client giả user/tenant, sửa subscription người khác hoặc gửi endpoint/key không hợp lệ
- **THEN** server từ chối và không có outbound request tới đích không an toàn

### Requirement: Subscription Lifecycle

Hệ thống SHALL hỗ trợ nhiều browser cho một account, thu hồi subscription khi tắt thông báo/đăng xuất và ngăn browser đổi account còn nhận dưới owner cũ.

#### Scenario: Multiple browsers

- **WHEN** account hợp lệ có nhiều subscription hoạt động
- **THEN** mỗi subscription có delivery/result riêng, lỗi một endpoint không gửi lại endpoint đã thành công

#### Scenario: Signout or account switch

- **WHEN** user đăng xuất/tắt thông báo khi backend reachable
- **THEN** gỡ liên kết nhận trên browser đó và không cấp pending delivery mới cho subscription đã thu hồi
- **AND** chuyển account không tái sử dụng ownership cũ

#### Scenario: Offline cleanup

- **WHEN** logout xảy ra lúc backend không reachable
- **THEN** không chặn logout vô hạn, thực hiện local unsubscribe và retry cleanup khi có thể
- **AND** không tuyên bố đã thu hồi server hoặc bản tin provider đã nhận khi chưa có bằng chứng

### Requirement: Transactional Notification Intent

Hệ thống SHALL lưu ý định gửi Web Push cùng transaction tạo repair request, snapshot recipient và payload, không gọi outbound HTTP trong transaction.

#### Scenario: Commit and rollback

- **WHEN** transaction commit
- **THEN** mỗi recipient hợp lệ có một ý định logic unique theo event/request/recipient
- **AND** nếu transaction rollback thì không còn Web Push intent hoặc ZBS event của request đó

#### Scenario: Configuration changes later

- **WHEN** thêm recipient sau khi request được tạo
- **THEN** không backfill sự kiện cũ cho recipient mới
- **AND** trước mọi claim/retry phải kiểm tra recipient snapshot còn trong cấu hình, active và còn quyền xem đúng đơn vị

#### Scenario: Recipient has no subscription yet

- **WHEN** recipient snapshot chưa có subscription
- **THEN** giữ intent chờ trong hạn 24 giờ và có thể giao khi đăng ký trong hạn
- **AND** không phát lại intent đã hoàn tất cho browser mới đăng ký sau đó

### Requirement: Authenticated Oracle Worker

Go service SHALL chạy Docker trên Oracle VM, chủ động claim/report qua HTTPS QLTBYT bằng credential riêng chống replay. QLTBYT SHALL giữ Supabase access, subscription và durable retry state; Go SHALL NOT có Supabase credentials hoặc queue/database bền vững riêng.

#### Scenario: Valid claim

- **WHEN** worker được xác thực claim batch có giới hạn
- **THEN** backend atomically cấp delivery hợp lệ với lease/attempt token và dữ liệu tối thiểu để gửi
- **AND** concurrent workers không cùng sở hữu một active lease

#### Scenario: Unauthorized or stale request

- **WHEN** chữ ký sai, request replay hoặc report thuộc lease đã hết hạn/bị thay thế
- **THEN** từ chối và không thay đổi state của attempt hiện tại

### Requirement: Bounded Delivery And Retry

Hệ thống SHALL hướng tới provider acceptance trong 60 giây khi khỏe, retry có giới hạn tới created_at + 24 giờ và lưu kết quả theo subscription. Provider acceptance SHALL NOT được diễn giải là thiết bị đã hiển thị hoặc user đã đọc.

#### Scenario: Service outage and recovery

- **WHEN** Oracle/backend/provider gián đoạn rồi phục hồi trước deadline
- **THEN** reclaim lease hết hạn và retry pending delivery với backoff, kiểm tra lại quyền/config/ownership
- **AND** không làm mất dữ liệu do worker restart hoặc phụ thuộc memory queue

#### Scenario: Expired or revoked

- **WHEN** đã quá 24 giờ, account mất quyền/bị khóa hoặc recipient bị gỡ
- **THEN** không cấp lần gửi mới; ghi expired/cancelled tương ứng
- **AND** TTL gửi provider không vượt thời gian còn lại

#### Scenario: Provider errors

- **WHEN** provider trả 404/410
- **THEN** revoke endpoint hỏng
- **AND** 429/lỗi tạm thời được retry bounded với Retry-After khi có; lỗi credential/payload được ghi nhận không retry nóng

#### Scenario: Lost acknowledgement

- **WHEN** provider nhận nhưng report bị mất
- **THEN** retry có thể tạo duplicate; hệ thống dùng logical delivery key và notification tag để hạn chế trùng, không cam kết exactly-once

### Requirement: Notification Content And Navigation

Thông báo SHALL chứa tên thiết bị, khoa/phòng quản lý và mô tả sự cố snapshot; SHALL giới hạn payload theo byte, cắt Unicode an toàn và không đưa thêm dữ liệu nhạy cảm ngoài scope đã chốt.

#### Scenario: Display and click

- **WHEN** push tới browser foreground hoặc background
- **THEN** service worker xử lý hiển thị tránh hai handler tạo notification trùng
- **AND** click mở deep link cùng origin bằng contract hiện có; login và quyền hiện tại quyết định mở chi tiết

#### Scenario: Long content or revoked access

- **WHEN** mô tả dài hoặc user mất quyền sau khi notification đã gửi
- **THEN** nội dung được cắt phù hợp giới hạn; click không bypass quyền
- **AND** không cam kết thu hồi notification đã được provider chấp nhận

### Requirement: Browser And Operational Readiness

MVP SHALL kiểm chứng Chrome/Edge desktop, Android Chrome/Edge, Firefox desktop và iOS/iPadOS hỗ trợ Web Push qua installed Home Screen app. Rollout SHALL có controls riêng cho registration/enqueue/dispatch, mặc định tắt, health và backlog/error metrics không log secrets hoặc raw subscription/payload.

#### Scenario: Controlled rollout and rollback

- **WHEN** bật canary hoặc tắt Web Push khi sự cố
- **THEN** chỉ scope được phép gửi; ZBS không thay đổi; pending jobs giữ deadline gốc
- **AND** registration tắt vẫn cho revoke/logout cleanup, Go không cần ingress công khai

#### Scenario: Platform verification

- **WHEN** nghiệm thu browser matrix
- **THEN** ghi rõ browser/OS/version và bằng chứng permission, foreground/background, click, logout; chưa kiểm chứng được platform nào thì báo incomplete cho platform đó

### Requirement: VAPID Key Compatibility

Hệ thống SHALL phân phối public key/version cho browser, lưu version của subscription và giữ private key trong secret store dành riêng cho Go. Worker SHALL chỉ gửi subscription tương thích với cặp key hiện tại; restart SHALL NOT tự thay key.

#### Scenario: Missing or mismatched key

- **WHEN** private key thiếu hoặc derived public key không khớp cấu hình app
- **THEN** worker không ready/claim/send và operator nhận lỗi không lộ secret
- **AND** registration không sử dụng key version thiếu hoặc không hỗ trợ

#### Scenario: Controlled rotation

- **WHEN** operator rotate VAPID key
- **THEN** pause registration/dispatch, cập nhật hai phía đồng bộ và yêu cầu subscription version cũ đăng ký lại
- **AND** không gửi subscription cũ bằng key mới; runbook có rollback key version

### Requirement: Home Screen Installability

Hệ thống SHALL cung cấp manifest, metadata, icons và service-worker registration/scope cần thiết để cài web app và bật Web Push trên iOS/iPadOS hỗ trợ. Phạm vi này SHALL NOT thêm offline caching dữ liệu có auth.

#### Scenario: Installed app opt in

- **WHEN** user thêm QLTBYT vào Home Screen và mở ở installed standalone mode trên iOS/iPadOS hỗ trợ
- **THEN** user có thể bấm bật, cấp quyền, đăng ký subscription và nhận push
- **AND** nghiệm thu kiểm tra luồng cài và nhận thực tế, không chỉ kiểm tra văn bản hướng dẫn
