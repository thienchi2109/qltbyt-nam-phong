# Chunk 4c — Equipment bulk delete

Base: `1c7ce5e534263e45223dda40456b5c2a55190362`. User duyệt brief ngày
2026-09-08; chỉ xử lý entry 8 của `test-classification.md`.

## Ranh giới đã thực hiện

- Core-security giữ nguyên source block 182–315: thiếu claim `don_vi` và
  `42501`, batch khác tenant không đổi, che trạng thái soft-delete bằng `P0002`,
  mixed cross-tenant + missing ID. Count/unchanged-row ở đây là security witness.
- Migration-specific giữ block 56–181 và 316–334: thành công, IDs/count,
  batch audit, empty input, deduplication, already-deleted và max-size guard.
  Atomicity của batch cùng tenant có một row đã xóa là business; atomicity khi
  có ID khác tenant thuộc security, không tách khỏi denial assertion.
- Hai companion giữ setup, declarations, fixture và transaction/rollback từ
  nguồn. Giữ declarations dư để source-preservation check rõ ràng; chỉ dọn khi
  có scope riêng. Không tạo shared SQL include hoặc parser mới.
- Test gốc và active registry giữ nguyên; selected set vẫn 77. Registration hai
  companion chỉ trong fixture harness; chưa gán `requiredForMigrations` tùy tiện.

## Evidence và giới hạn

- RED: 1 failed/1 passed trước extraction, lỗi assertion scope leakage trên
  source mixed, không phải ENOENT. GREEN: 5 focused files, 28/28 tests PASS.
- Format, explicit-any, dedupe, typecheck PASS; React Doctor quét test mới
  sau staging, 100/100. Commit/push hooks đã chạy thành công.
- Review trực tiếp xác nhận chỉ năm file trong phạm vi thay đổi. Reviewer
  subagent lỗi provider credentials (404); không có independent review approval.
- Tái sử dụng `registeredSqlTestBody`, `validateExpectedStateRegistries`,
  `selectDefaultSafeSqlTests` và `validRegistries`; không thêm shared capability.
- Regression giữ nguyên toàn bộ block SQL, source SHA-256 và fixture registration;
  parser từ chối COMMIT thay ROLLBACK. Đây là source/envelope check, không phải
  chứng minh PL/pgSQL/RPC semantic PASS.
- Không sửa migration, runtime hoặc registry. Không chạy Oracle/live DB.
  Static migration gate không áp dụng cho diff này; baseline-forward NOT RUN;
  không có aggregate DB PASS. Chunk 5/6 chưa bắt đầu.
- Rủi ro có sẵn: empty/already-deleted/max-size và generic cross-tenant guard
  dùng `WHEN OTHERS` cùng sentinel chứa chuỗi kỳ vọng, có thể tự bắt sentinel.
  Bảo toàn nguyên trạng trong lượt extraction; cần harden riêng trước khi dùng
  các guard đó làm bằng chứng semantic. Không tuyên bố đã sửa hạn chế này.

## TODO

- [x] Chốt ranh giới security/business và giữ tenant atomicity trong security.
- [x] RED → GREEN, tạo hai companion và kiểm tra fixture harness.
- [x] Giữ source/registry/selected set 77 và rollback envelope.
- [ ] User review kết quả 4c; checklist tổng Chunk 4 vẫn mở.
- [ ] Scope riêng: harden sentinel guard theo issue #993; mapping migration
      trước cutover.
- [ ] Dynamic semantic validation ở Chunk 7 khi được giao.
