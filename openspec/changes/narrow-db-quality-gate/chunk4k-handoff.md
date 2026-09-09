# Chunk 4k — Soft-delete workflow guards

Chỉ entry 20: `equipment_soft_delete_workflow_guards_smoke.sql`.

- Đối chiếu SQL thực tế: toàn bộ assertion là migration-specific business
  workflow; repair/transfer create, transfer update và usage-session start đều
  phải từ chối equipment đã soft-delete với SQLSTATE `P0002`.
- Biến thể `admin` chỉ xác nhận cùng business guard sau JWT fixture setup;
  fixture không tạo core-security extraction riêng.
- Không tạo companion core-security, không backfill `requiredForMigrations`,
  và không thay selected set 77 hay active registry.
- Giữ nguyên toàn bộ test để chờ mapping migration exact ở giai đoạn sau.
- Chỉ khảo sát/triển khai tài liệu; chưa chạy Oracle/live DB, chưa có aggregate
  DB PASS, và chưa bắt đầu Chunk 5/6.

## Còn lại

- User review 4k; mapping/cutover và dynamic validation ở chunk sau.
- Entry 16 sentinel false-pass và Entry 19 mixed reports vẫn ngoài scope.
