# WP-06 — Chứng minh tích hợp app thứ hai qua contract chung

- Status: To Do
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-05
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu fixture/example adapter thứ hai và integration tests trong module
`services/web-push`. Dùng app thật khi có app được chỉ định và scope rõ;
trước mắt fixture độc lập đủ kiểm chứng khả năng tích hợp, không dựng thêm
một sản phẩm hay sửa repo khác.

## Acceptance criteria

- [ ] Backend thứ hai cung cấp claim/report theo contract đã chốt mà không
      phụ thuộc schema, role hoặc repair-request payload của QLTBYT.
- [ ] Hai app cùng chạy, có local delivery/user ID trùng nhau, nhưng không
      lẫn backend report, credential, VAPID hoặc nội dung.
- [ ] Kiểm chứng retry, thu hồi/không còn đủ quyền tại nguồn và idempotency
      trong ranh giới cam kết; ghi rõ khả năng gửi lặp khi crash sau send.
- [ ] Thêm adapter không cần nhánh điều kiện theo tên app trong core;
      chỉ sửa core nếu phát hiện contract thiếu và đã review thay đổi.
- [ ] Có hướng dẫn tối thiểu để app mới tích hợp; evidence ghi rõ đây là
      fixture/disposable nếu chưa dùng app thật hay browser thật.

## Xác minh

Chạy fixture integration và Go suite bằng dữ liệu/key dùng cho test.
Không sử dụng subscription production hoặc gửi push thật tới người dùng.
