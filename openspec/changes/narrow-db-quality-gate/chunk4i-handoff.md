# Chunk 4i — Historical reads sau soft-delete

Chỉ entry 17: `equipment_soft_delete_historical_reads_smoke.sql`.

- Core giữ nguyên fixture regional leader, count allowed=1, blocked=0 và
  assertion function-level `search_path` của usage_log_list.
- Business giữ nguyên historical reads, equipment_is_deleted và wildcard
  escaping cho repair/transfer/usage; giữ JWT global trước usage reads.
- Hai companion có fixture và rollback độc lập. Mixed gốc và active registry
  không đổi; selected set 77, đăng ký companions chỉ trong fixture harness.
- RED trước tạo companions: 1 failed/1 passed do block security còn ở business.
  GREEN: 11 files/39 tests PASS; format, explicit-any, dedupe, typecheck PASS.
  React Doctor scan 1 staged test: 100/100.
- Tái sử dụng registeredSqlTestBody, selectDefaultSafeSqlTests,
  validateExpectedStateRegistries và validRegistries; không thêm helper chung.
- Chưa thực thi SQL trên Oracle/live DB; không có aggregate DB PASS.
  Chunk 5/6 và nhóm tiếp theo chưa bắt đầu.

## Còn lại

- User review 4i; mapping/cutover và dynamic validation ở chunk sau.
- Nghi vấn sentinel false-pass của entry 16 không thuộc extraction này.
