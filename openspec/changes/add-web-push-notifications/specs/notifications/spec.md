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

Hệ thống SHALL duy trì danh sách recipient riêng theo từng đơn vị và cung cấp searchable multi-select account hiện hữu theo caller scope. Màn hình recipient config chỉ dành cho `admin/global/to_qltb`; các role đã đăng nhập khác chỉ thấy hướng dẫn/trạng thái browser opt-in. `admin/global` được target bất kỳ đơn vị nào nhưng chỉ thêm recipient thường có role `to_qltb` và effective unit `coalesce(current_don_vi, don_vi)` trùng target; `to_qltb` chỉ target effective unit của chính mình. `admin/global` MAY tự add/remove protected self-enrollment ở bất kỳ đơn vị nào; caller khác SHALL thấy read-only và backend SHALL preserve entry đó trong atomic save. Option SHALL hiển thị `full_name` và `username`, hỗ trợ chọn/bỏ chọn bằng chuột hoặc bàn phím và trạng thái loading/error/empty; UI SHALL NOT nhận username nhập tự do hoặc chuỗi phân cách bằng dấu phẩy. Candidate SHALL chỉ đến từ server-authorized scope. Recipient SHALL active và đủ quyền xem yêu cầu tương ứng; cấu hình SHALL NOT cấp thêm quyền.

#### Scenario: Valid list

- **WHEN** người có quyền tìm và chọn danh sách account hợp lệ
- **THEN** UI giữ selected account identity để hiển thị, adapter gửi username serialization theo browser config contract, server trim, loại trùng, resolve username theo quy tắc hiện hành và lưu từng user ID ổn định
- **AND** danh sách actual rỗng tắt recipient Web Push của đơn vị; protected self-enrollment còn lại vẫn là recipient

#### Scenario: Candidate picker states

- **WHEN** candidate list đang tải, tải lỗi hoặc không có account trong scope
- **THEN** UI hiển thị trạng thái tương ứng, không cho lưu recipient ngoài scope và không làm mất selection hiện tại, kể cả stale entry, do lỗi tải lại
- **AND** lỗi lưu vẫn atomic, không lưu một phần
- **AND** UI SHALL giữ identity và selection từ full config GET khi candidate search/reload lỗi hoặc trả về trang khác, kể cả stale entry

#### Scenario: Scope target của caller và protected self

- **WHEN** `admin/global` chọn target bất kỳ hoặc `to_qltb` chọn target khác effective unit `coalesce(current_don_vi, don_vi)` của chính mình
- **THEN** server authorize target từ session và từ chối caller vượt scope; client không tự khai role, identity hoặc quyền
- **AND** `admin/global` tự add/remove protected self-enrollment bằng explicit self-action, còn caller khác không được sửa entry đó

#### Scenario: Recipient stale hoặc không còn đủ điều kiện

- **WHEN** config GET gặp recipient đã stale/ineligible hoặc không còn là normal `to_qltb` của effective unit
- **THEN** GET vẫn trả entry với trạng thái để UI flag; candidate lookup không trả entry đó như candidate mới; enqueue/claim bỏ qua và không tự chuyển đơn vị
- **AND** save từ chối nếu request thêm/giữ lựa chọn normal invalid, nhưng caller có quyền được explicit remove stale normal entry; protected self entry của caller khác chỉ read-only, mọi protected entry được giữ nếu không có self-action hợp lệ và invalid protected entry không chặn normal save

#### Scenario: Invalid or unauthorized list

- **WHEN** bất kỳ username không tồn tại, inactive, không đủ quyền hoặc caller vượt scope
- **THEN** server từ chối, không lưu một phần và UI báo lỗi phù hợp không lộ dữ liệu ngoài scope

#### Scenario: Configuration status and edit rights

- **WHEN** UI hiển thị cấu hình có protected self-entry, stale/ineligible entry hoặc trạng thái tải/lưu đang diễn ra
- **THEN** protected self-entry của caller khác SHALL read-only, stale/ineligible normal entry SHALL được flag và caller có quyền SHALL có thể explicit remove
- **AND** UI SHALL hiển thị trạng thái và quyền thao tác tương ứng, không làm mất entry khi search/reload hoặc tự fallback sang đơn vị khác

### Requirement: New Unit Web Push Allowlist Synchronization

Luồng tạo đơn vị được hỗ trợ qua RPC `don_vi_create` SHALL append ID đơn vị mới, đúng một lần, vào cả `registration_canary_don_vi_ids` và `dispatch_canary_don_vi_ids` trong cùng transaction. Luồng này SHALL giữ nguyên các ID đã có và mọi flag runtime; SHALL NOT backfill 28 active units của rollout lịch sử, thay đổi policy active/reactivate, thêm mode/UI/trigger/job hoặc sửa điều kiện recipient.

#### Scenario: Successful new unit creation

- **WHEN** `don_vi_create` tạo đơn vị thành công qua application RPC
- **THEN** ID mới xuất hiện trong cả hai allowlist sau commit, không bị nhân đôi, còn các ID và `registration_enabled`/`enqueue_enabled`/`dispatch_enabled` trước đó giữ nguyên
- **AND** canary có thể tăng theo từng lần tạo đơn vị mới mà không tự bật flag hoặc tạo backfill cho 28 ID lịch sử

#### Scenario: Recipient prerequisites remain required

- **WHEN** đơn vị mới đã nằm trong allowlist nhưng chưa có recipient config, browser opt-in hoặc authorization hiện hành phù hợp
- **THEN** không có delivery Web Push cho đơn vị đó; allowlist không cấp quyền, không thay thế cấu hình recipient và không fallback sang đơn vị/tài khoản khác

#### Scenario: Failed creation rolls back the append

- **WHEN** `don_vi_create` thất bại hoặc transaction rollback trước commit
- **THEN** không còn đơn vị mới và không có cập nhật một phần ở một trong hai allowlist
- **AND** các flag, arrays và pending state có sẵn được giữ nguyên

#### Scenario: Manual removal and emergency controls

- **WHEN** operator gỡ ID mới khỏi allowlist hoặc tắt registration/enqueue/dispatch bằng kill switch
- **THEN** lần tạo/cập nhật đơn vị khác không tự thêm lại ID đã gỡ, còn kill switch và canary hiện hành vẫn giới hạn gửi theo flag/config đã đặt
- **AND** pending intent đã tồn tại có thể resume trước deadline nếu ID được include lại; việc không backfill không hủy pending intent hiện có

### Requirement: In App Notification Registration

Hệ thống SHALL cho mọi người dùng đã đăng nhập tự bật/tắt thông báo trong app trên từng browser tại route authenticated `/notifications`. Server SHALL lấy identity từ NextAuth session, kiểm tra ownership và input subscription; quản trị viên SHALL NOT cấp browser permission thay người nhận.

#### Scenario: Explicit opt in

- **WHEN** người đã đăng nhập bấm bật và cấp quyền trên browser hỗ trợ
- **THEN** tạo Web Push subscription liên kết duy nhất với account hiện tại qua backend QLTBYT
- **AND** hiển thị giải thích nội dung có thể xuất hiện trên màn hình khóa

#### Scenario: Denied or unsupported

- **WHEN** quyền bị chặn/từ chối hoặc browser không hỗ trợ
- **THEN** không tạo subscription, không prompt lặp lại và app vẫn hoạt động
- **AND** UI hướng dẫn cài Home Screen app khi iOS/iPadOS yêu cầu

#### Scenario: Registration feedback and key version

- **WHEN** người dùng bắt đầu hoặc hủy thao tác đăng ký trên browser
- **THEN** UI SHALL hiển thị accessible loading/success/disabled/error/cancelled feedback, chỉ gọi permission/subscription sau user gesture và không prompt lặp khi denied/unsupported
- **AND** key version mismatch SHALL yêu cầu resubscribe; UI SHALL không tự khai identity hoặc quyền thay server

#### Scenario: Shared authenticated notification settings surface

- **WHEN** người dùng đã đăng nhập mở phần cài đặt nhận thông báo từ header bell
- **THEN** dialog thông báo hiện có SHALL vẫn giữ nguyên và có link với text chính xác `Cài đặt nhận thông báo` tới `/notifications`
- **AND** `/notifications` SHALL hiển thị hướng dẫn và trạng thái browser opt-in cho mọi role đã đăng nhập; recipient config chỉ hiển thị cho `to_qltb/admin/global` theo phạm vi đơn vị
- **AND** SHALL không có mục sidebar hoặc link trùng trong user menu, còn đổi mật khẩu/Đăng xuất SHALL giữ nguyên

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

#### Scenario: Browser operation status and reload

- **WHEN** thao tác đăng ký, revoke, logout cleanup hoặc refresh/reload gặp pending, cancel, lỗi mạng hay khôi phục thành công
- **THEN** UI SHALL hiển thị trạng thái local, cho phép retry bounded/cancel thao tác phù hợp và rehydrate state mà không mất lựa chọn hoặc owner hiện tại
- **AND** UI SHALL NOT suy diễn delivery/provider accepted thành delivered/read hoặc gọi retry delivery khi contract không có delivery-status API

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

### Requirement: Subject Based Recipient Authorization

Hệ thống SHALL kiểm tra recipient bằng user ID và profile quyền hiện hành từ DB, không dùng worker JWT hoặc claims snapshot cũ. “Active account” SHALL nghĩa là subject còn tồn tại và profile/role hợp lệ theo account lifecycle hiện có; SHALL NOT giả định cột `nhan_vien.active` hay thêm feature khóa account trong change này.

#### Scenario: Background permission check

- **WHEN** server lưu config, enqueue hoặc cấp claim/retry
- **THEN** kiểm tra quyền subject với đơn vị, và với request cụ thể tại enqueue/claim bằng đơn vị thiết bị và quy tắc khoa/phòng role user
- **AND** cấu hình nhận không cấp quyền; identity worker đặc quyền không làm recipient được bypass

#### Scenario: Current profile changes

- **WHEN** subject bị xóa, profile không hợp lệ, mất scope địa bàn/đơn vị/khoa phòng hoặc to_qltb đổi current_don_vi
- **THEN** lần claim tiếp theo đọc lại durable profile và từ chối delivery không còn quyền theo cùng quy tắc đọc tương tác
- **AND** không dùng session snapshot cũ hay tự coi account đang online là điều kiện nhận
