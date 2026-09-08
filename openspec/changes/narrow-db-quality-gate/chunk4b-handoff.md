# Chunk 4b — Dashboard badges department scope

Base: `b6ae4031` (gồm Chunk 4a đã được user chấp nhận).
Chỉ xử lý `dashboard_badges_department_scope_smoke.sql` theo entry 2 của
`test-classification.md`. Không mở nhóm khác hoặc Chunk 5/6.

## TODO

- [x] Chốt ranh giới: count nghiệp vụ tách riêng; count chứng minh isolation,
      fail-closed và regional role giữ làm security witness.
- [x] Viết regression bảo toàn assertion, fixture và rollback; xác nhận RED
      bằng assertion có ý nghĩa trước khi tạo SQL tách.
- [x] Tách hai SQL companion, giữ test gốc và active registry nguyên trạng.
- [x] Xác nhận GREEN bằng harness hiện có và selected set 77 không đổi.
- [x] Chạy format, explicit-any, dedupe, typecheck, focused tests, React Doctor.
- [x] Kiểm tra diff, ghi evidence và giới hạn; dừng chờ user review 4b.

## Quyết định đã duyệt

Giữ setup độc lập trong mỗi file để không cần psql include hoặc helper mới.
Các count global/regional vừa kiểm chứng giá trị vừa làm isolation/role witness
được giữ nguyên trong cả hai phần; không làm yếu thành kiểm tra JSON tồn tại.
Đăng ký companion chỉ qua fixture harness, không thêm vào registry active
trước Chunk 6. Safety/fixture/runner/timeout/rollback kế thừa từ entry gốc.
Business historical intentional-unmapped; không backfill migration mapping.
Không chạy SQL động, Oracle hoặc live DB; semantic SQL validation thuộc Chunk 7.

## Evidence 2026-09-08

- RED trước khi tạo SQL: 1 failed, 2 passed; assertion scope separation phát hiện
  count business còn trong nguồn mixed. Không dùng ENOENT làm RED.
- GREEN: 4 focused files, 26/26 tests PASS (4a, 4b, registry, scope-metadata).
- Format, explicit-any, dedupe và typecheck PASS; React Doctor quét cả hai test
  staged/branch (4a và 4b), 100/100, không có findings. Diff check PASS.
- Review trực tiếp: chỉ 4b SQL companions, test và docs thay đổi; không có
  runtime/migration/registry diff. Reviewer subagent chưa khả dụng do lỗi
  credentials đã xác nhận; không tuyên bố có independent reviewer approval.
- Tái sử dụng rollback parser, registry validator và selector hiện có; registration
  của hai companion chỉ trong fixture. Không tạo shared SQL include hoặc parser mới.
- Source regression đối chiếu nguyên đoạn setup, denial, global/regional và
  search_path; hash test gốc giữ nguyên. Không thay active registry.
- SQL chưa chạy động: rollback parser chỉ certify envelope, không chứng minh
  PL/pgSQL/RPC semantic PASS. Oracle/live DB không được sử dụng.
- Chờ user review 4b; checklist tổng Chunk 4 vẫn chưa hoàn tất.
