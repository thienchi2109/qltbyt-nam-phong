# Nội dung thông báo sửa chữa — #1002

## Phạm vi được duyệt ngày 19/09/2026

Chỉ cải thiện câu chữ để thông báo dễ đọc. Không triển khai badge số,
trạng thái chưa đọc hoặc đồng bộ trạng thái đọc giữa thiết bị.

**Tiêu đề:** Yêu cầu sửa chữa thiết bị mới

**Nội dung:**

> {Khoa/phòng} đề nghị sửa chữa thiết bị {Tên thiết bị}.
> Tình trạng hư hỏng: {Mô tả tình trạng hư hỏng}.

Bấm thông báo vẫn mở đúng yêu cầu sửa chữa. Khoa/phòng lấy từ khoa/phòng
quản lý thiết bị, như luồng hiện tại. iOS có thể rút gọn nội dung hiển thị.

## Thay đổi và kiểm chứng

- Migration mới chỉ thay hàm định dạng `web_push_payload_v1`; giữ URL, tag,
  định danh và giới hạn payload 3.072 byte. Không thay dispatch hoặc worker.
- Chỉ các payload tạo sau khi apply migration mới dùng câu chữ mới;
  không viết lại thông báo đã nằm trong hàng đợi.
- Kiểm tra riêng formatter trên PostgreSQL 17 tạm: hàm cũ thất bại với
  snapshot mới; hàm mới đạt kiểm tra câu chữ, NULL, UTF-8, JSON escaping,
  giới hạn kích thước và URL/tag. Chưa chạy toàn bộ integration test.
- Static gate phát hiện `migration.jwt-guards` trên hàm định dạng thuần
  `IMMUTABLE`, không đọc bảng, không `SECURITY DEFINER` và đã thu hồi quyền
  gọi của các role ứng dụng. Đây là finding được đánh giá false positive;
  trạng thái gate vẫn là `FAILED`, không đổi thành `PASS`.
- Baseline-forward chưa có executor được cấu hình trong phiên: `INCOMPLETE`.
- Chưa apply live hoặc gửi push thử. Live apply cần phê duyệt riêng;
  chưa có bằng chứng hiển thị câu chữ mới trên iPhone.
