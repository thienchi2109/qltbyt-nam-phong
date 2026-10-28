# WP-04 — Định danh app và cô lập credential, VAPID, cấu hình

- Status: To Do
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-02
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu app context và composition/config ở
`services/web-push/cmd/web-push/main.go`, `vapid.go` và config seam được chốt
trong WP-01. Phối hợp ownership `types.go` với WP-02/WP-03.

## Acceptance criteria

- [ ] Mỗi app có định danh ổn định, backend origin, credential và VAPID
      riêng; kiểm tra cấu hình thiếu/trùng/mismatch và fail closed.
- [ ] Trong mô hình pull, app context lấy từ cấu hình tin cậy gắn với
      adapter/credential. Nếu xuất hiện inbound request, credential đã xác thực
      phải ràng buộc app; không tin `app_id` hay Origin do client tự khai.
- [ ] Phân biệt app với `don_vi`; ID delivery/recipient và khóa chống trùng
      không bị coi là duy nhất xuyên app nếu contract không bảo đảm điều đó.
- [ ] Credential rotation và chọn VAPID đúng theo app; không log secret,
      endpoint hoặc subscription keys. Metrics tránh label cardinality vô hạn.
- [ ] Cấu hình QLTBYT cũ có đường nâng cấp rõ ràng; giữ key/version hiện có
      và test hai app trùng local ID, dùng sai credential hoặc sai VAPID.

## Ngoài phạm vi và xác minh

Không thêm database trung tâm hoặc thay VAPID production. Chạy config/auth
tests và Go suite; nếu cần đổi wire, review tương thích cùng WP-03 trước.
