# Plan: Tách trạng thái đầu/cuối cho nhật ký sử dụng thiết bị

## Bối cảnh

Flow hiện tại chỉ có một cột `tinh_trang_thiet_bi` trong `public.nhat_ky_su_dung`, gây khó audit/điều tra vì không tách bạch được tình trạng lúc bắt đầu và lúc kết thúc của cùng một phiên sử dụng.

## Yêu cầu đã chốt

1. Tách rõ 2 cột mới:
   - `tinh_trang_ban_dau`
   - `tinh_trang_ket_thuc`
2. Khi bắt đầu sử dụng:
   - Bắt buộc nhập tình trạng ban đầu.
   - Cho phép nhập tự do hoặc chọn giá trị gợi ý (Hoạt động, Cần theo dõi, Chờ sửa chữa, ...).
3. Khi kết thúc sử dụng:
   - Dialog xác nhận bắt buộc nhập tình trạng kết thúc.
4. Cột cũ `tinh_trang_thiet_bi`:
   - Giữ lại để tương thích đọc dữ liệu cũ.
   - Flow mới không dùng làm nguồn ghi chính.
5. Cập nhật biểu mẫu in (print-template):
   - Hiển thị 2 cột: **Tình trạng ban đầu** / **Tình trạng kết thúc**.

## Thiết kế kỹ thuật đề xuất

### 1) Database

- Tạo migration idempotent thêm cột vào `public.nhat_ky_su_dung`:
  - `tinh_trang_ban_dau text`
  - `tinh_trang_ket_thuc text`
- Không xóa/sửa phá vỡ cột cũ để tránh ảnh hưởng dữ liệu lịch sử.

### 2) RPC

- `usage_session_start`
  - Nhận trạng thái đầu vào từ UI.
  - Ghi vào `tinh_trang_ban_dau`.
- `usage_session_end`
  - Bắt buộc có trạng thái kết thúc.
  - Ghi vào `tinh_trang_ket_thuc`.
- `usage_log_list`
  - Trả về cả `tinh_trang_ban_dau` và `tinh_trang_ket_thuc` để UI/print hiển thị đầy đủ.

### 3) Frontend

- `StartUsageDialog`
  - Chuyển input tình trạng sang kiểu free-text + gợi ý.
  - Validate bắt buộc trước submit.
- `EndUsageDialog`
  - Bắt buộc nhập tình trạng kết thúc trước submit.
- Hooks/types
  - Cập nhật `UsageLog` type và payload mutation tương ứng cột mới.
- Usage history + print template
  - Hiển thị rõ cặp trạng thái đầu/cuối theo từng phiên.

## Kế hoạch triển khai (todo)

1. **db-usage-status-columns**: migration thêm 2 cột mới.
2. **db-usage-rpcs-update**: cập nhật `usage_session_start`, `usage_session_end`, `usage_log_list`.
3. **frontend-start-dialog-update**: bắt buộc tình trạng ban đầu, free-text + gợi ý.
4. **frontend-end-dialog-update**: bắt buộc tình trạng kết thúc.
5. **frontend-data-and-history-update**: types/hooks/history + print-template.
6. **tests-and-verification**: cập nhật test và chạy các gate bắt buộc.

## Ghi chú tương thích

- Dữ liệu cũ không có 2 cột mới sẽ vẫn đọc được.
- UI có thể fallback hiển thị cột cũ cho bản ghi lịch sử chưa có dữ liệu đầu/cuối (nếu cần để tránh ô trống hoàn toàn).

## Trạng thái

Đang chờ review/duyệt trước khi implementation.
