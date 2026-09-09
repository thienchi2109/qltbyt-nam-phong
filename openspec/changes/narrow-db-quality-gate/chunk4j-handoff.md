# Chunk 4j — Partial unique sau soft-delete

Chỉ entry 18: `equipment_soft_delete_partial_unique_smoke.sql`.

- Đối chiếu SQL thực tế: toàn bộ test là migration-integrity/core-security;
  giữ code reuse sau soft-delete, active duplicate rejection, restore conflict
  và partial unique index/old constraint contract.
- Không có business workflow assertion độc lập cần tách; không tạo companion,
  không backfill `requiredForMigrations`, và không thay selected set 77 hay
  active registry.
- Boundary đã chốt: core-security bao phủ toàn bộ test và invariant partial
  unique; migration-specific không có phần tách riêng trong lượt này.
- Chỉ khảo sát read-only; chưa chạy Oracle/live DB, chưa có aggregate DB PASS,
  và chưa bắt đầu Chunk 5/6.

## Còn lại

- User review 4j; mapping/cutover và dynamic validation ở chunk sau.
- Entry 16 sentinel false-pass vẫn ngoài scope.
