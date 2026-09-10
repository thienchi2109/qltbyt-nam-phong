## Why

QLTBYT cần thêm Web Push tới các tài khoản được cấu hình để xử lý yêu cầu sửa chữa mới, song song với Zalo ZBS đang gửi tới số điện thoại. Hướng Firebase/FCM + Supabase Edge Functions cũ không còn phù hợp với runtime và identity hiện tại.

Giữ change ID `add-firebase-push-notifications` để bảo toàn tham chiếu; nội dung change này thay thế hướng Firebase bằng dedicated Go Web Push service trên Docker/Oracle VM. Quyết định kiến trúc và chính sách người nhận được maintainer xác nhận trong phiên thảo luận ngày 2026-09-10; không có Wayfinder map/ticket được cung cấp nên không tạo traceability giả.

## What Changes

- Thêm kênh Web Push cho `repair_request_created`, mọi mức ưu tiên; giữ nguyên ZBS phone recipients, outbox, dispatcher, credentials và hành vi gửi.
- Cấu hình recipient theo đơn vị: nhập username phân cách bằng dấu phẩy, trim, loại trùng, resolve thành user ID ổn định; lỗi bất kỳ tài khoản nào thì không lưu một phần.
- `global/admin` cấu hình theo đơn vị được chọn; `to_qltb` chỉ trong phạm vi đơn vị được phép quản lý. Cấu hình recipient không cấp quyền xem yêu cầu.
- Người dùng tự bấm bật/tắt thông báo ngay trong app trên từng trình duyệt. Identity lấy từ NextAuth server session; không dùng `auth.users` UUID hoặc user ID do client tự khai.
- Supabase giữ cấu hình, subscription và Web Push outbox riêng. Transaction tạo repair request ghi ý định gửi; không gọi mạng trong transaction.
- Go container trên Oracle chủ động lấy việc và báo kết quả qua HTTPS backend QLTBYT có xác thực riêng. Go giữ VAPID private key, gửi Web Push; không giữ Supabase credentials, database hoặc durable queue riêng.
- Mục tiêu bình thường: đưa tới dịch vụ push trong 60 giây. Gửi bù tối đa 24 giờ, kiểm tra lại recipient/quyền trước mỗi lần cấp việc; retry và kết quả theo từng subscription.
- Hiển thị tên thiết bị, khoa/phòng quản lý và mô tả sự cố, có thể xuất hiện trên màn hình khóa; cắt nội dung dài theo giới hạn payload. Click dùng deep link hiện có và kiểm tra quyền.
- Hỗ trợ Chrome/Edge desktop, Android Chrome/Edge, Firefox desktop và iOS/iPadOS hỗ trợ Web Push với web app thêm vào màn hình chính. Thiết bị không hỗ trợ vẫn dùng app bình thường.

## Non-Goals

- Không thay thế, tổng quát hóa hoặc chuyển recipient ZBS sang tài khoản.
- Không Firebase SDK/project/Edge delivery, broker, database riêng cho Go, notification inbox, email, nhắc bảo trì hoặc sự kiện khác.
- Không hứa exactly-once, bảo đảm thiết bị hiển thị hoặc thu hồi thông báo đã được provider chấp nhận.
- Không dọn/xóa migration, bảng, Edge Function Firebase lịch sử trong change này.
- Không triển khai code hoặc ghi live DB trong lượt sửa artifacts; từng phase implementation/deploy có điểm dừng riêng.

## Impact

- Affected spec: `notifications` (new capability); [spec](specs/notifications/spec.md), [design](design.md), [phased tasks](tasks.md).
- QLTBYT: session-authenticated configuration/subscription endpoints, UI quản trị và opt-in, service worker, private worker endpoints; tái sử dụng quyền và deep link hiện hành.
- Database: forward-only Web Push schema/RPC và cập nhật `repair_request_create` có giữ nguyên enqueue ZBS. Bắt buộc static + Oracle baseline-forward PASS cùng exact commit trước live review; live write cần quyền riêng qua Supabase MCP.
- Oracle: artifact Go/Docker riêng, secrets/health/rollout runbook; deployment đích là Oracle VM, không phải workspace Codex này.
- Related change: [ZBS phone notifications](../add-zalo-repair-request-zbs-phone-notifications/proposal.md). Không tick hoặc sửa tasks của change ZBS.
