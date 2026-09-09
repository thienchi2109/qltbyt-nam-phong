# Chunk 4f — Department workflow guards

Base: `0154156dc11d399f793c0d2c5a7d2d00fc96961b`. Chỉ entry 11.

- Core-security: maintenance deny cùng khoa (195–234), cross-department và
  NULL-equipment denial/no-persistence (300–475).
- Claims core-security: blank/missing claims và helper source assertions
  (477–734). Hai core files có fixture và rollback độc lập để giữ trần 450 dòng.
- Business: repair/transfer thành công cùng khoa (147–194), compatibility
  `to_qltb` (236–299). Không gọi role này là global.
- Giữ nguyên fixture 5–146 và toàn bộ block assertion; test gốc/registry không
  thay đổi. Staged registration chỉ trong fixture harness; selected set 77.
- RED trước extraction; GREEN: suite 8 files/32 tests, sau bổ sung registration
  test thì riêng 4f 2/2 PASS. Format, explicit-any, dedupe, typecheck PASS;
  React Doctor quét file staged 100/100. Tái sử dụng parser và registry harness.
- Chỉ kiểm tra source/rollback envelope, chưa chứng minh SQL semantic PASS.
  Static migration lane không áp dụng vì không migration/registry diff;
  baseline-forward NOT RUN, không có aggregate DB PASS. Không Oracle/live DB.

## TODO

- [ ] User review 4f; chưa bắt đầu Chunk 5/6.
- [ ] Mapping migration và dynamic validation khi đến chunk được duyệt.

Lưu ý: các denial maintenance có thể đến từ role guard trước department guard;
không tuyên bố đã độc lập chứng minh từng nhánh authorization. Missing role/user
helper checks là source assertions, không phải dynamic JWT denial.
