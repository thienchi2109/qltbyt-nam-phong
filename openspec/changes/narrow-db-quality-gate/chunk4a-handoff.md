# Handoff Chunk 4a — AI kill switch

## Phạm vi và trạng thái

Base: `e8fecd97`; implementation: `dfa7e8ec`. Chỉ xử lý
`ai_kill_switch_smoke.sql`, chưa bắt đầu nhóm khác hoặc Chunk 5/6.
Test mixed gốc và registry active không đổi; selector vẫn chọn đủ 77 test.
Hai file tách được chuẩn bị theo đường dẫn trong classification, chưa đăng ký
vào registry active vì việc đó sẽ tăng selected set lên 79 trước cutover.

## Bảo toàn assertion

- Core: global/admin/service_role write/read acceptance dùng RPC thật và kiểm
  tra có row trả về; không kiểm tra giá trị enabled/reason. Giữ denial bodies
  missing app_role, claims, role, user_id và non-global write với SQLSTATE 42501.
  Non-global read kiểm tra `FOUND` thay vì trạng thái enabled.
- Business: giữ nguyên các block default state, global write/read state,
  admin/service_role state/reason, NULL p_enabled và blank/NULL reason.
  Test gốc không có successful disable case; lượt này không thêm coverage mới đó.
- Cả hai giữ cleanup hai internal_settings keys, JWT transaction-local,
  `BEGIN`/`ROLLBACK`. Business half historical intentional-unmapped; không
  backfill migration mapping. Fixture đăng ký kiểm tra default-safe, psql,
  isolated-fixture, rollback-required và timeout 30 giây như test gốc.
- Tái sử dụng `registeredSqlTestBody`, `validateExpectedStateRegistries`,
  `selectDefaultSafeSqlTests`, `validRegistries`; không thêm parser/harness mới.

## Evidence và giới hạn

Command: `node scripts/npm-run.js exec -- vitest run
scripts/__tests__/database-quality-gate-ai-kill-switch-split.test.ts`.

- RED có ý nghĩa trong vòng sửa bản nháp: assertion bảo toàn business block
  admin/service_role failed (1 failed, 2 passed); sau khi bổ sung các block bị
  bỏ sót, cùng contract test GREEN 3/3. Các lần ENOENT, lỗi môi trường và bản
  nháp trước đó không phải bằng chứng TDD test-first hoàn chỉnh của lượt này.
- Focused suite: split, registry và scope-metadata — 23/23 PASS.
- Format được sửa và pre-commit Prettier PASS; explicit-any, dedupe và typecheck
  PASS. Chưa dùng kết quả này để tuyên bố dynamic semantic SQL PASS.
- Post-commit DB gate SKIP: không có migration hoặc registry change. Đây không
  phải static/baseline-forward aggregate PASS. Không chạy Oracle/live DB.

Chờ user review 4a. Checklist tổng Chunk 4 còn mở. Cutover phải dùng metadata
hai file đã được kiểm tra trong fixture; không tự giảm coverage test mixed
trước boundary đã duyệt. SQL động vẫn thuộc Chunk 7.
