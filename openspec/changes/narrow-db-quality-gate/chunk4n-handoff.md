# Chunk 4n — Repair cost and completion-report batch

Batch gồm Entry 24, 25 và 27:

- Entry 24: core giữ admin/global facility scope; migration-specific giữ
  completion-time payload, stats, buckets, monthly range và legacy keys.
- Entry 25: core giữ schema `chi_phi_sua_chua` và tenant exclusion; business
  giữ repair-cost/usage visualization payload, sorting và data-quality.
- Entry 27: core giữ schema cùng missing-claims/wrong-tenant `42501`; business
  giữ NULL/zero/positive cost, completion, reports và no-mutation contracts.

Đã tạo sáu companion SQL với fixture/rollback contracts và thêm regression
registry/split test. SQL gốc, active registry và selected set 77 không đổi.

Verification: format, no-explicit-any, dedupe, typecheck PASS; focused split
suite 10 files/21 tests PASS. Chưa chạy Oracle/live DB và chưa có aggregate DB
PASS. Chunk 5/6 chưa bắt đầu.

## Còn lại

Entry 16 sentinel false-pass và Entry 19 reports chưa xử lý; các mixed entry
khác còn trong inventory classification và cần batch theo domain.

# Chunk 4o — Entry 21 + 23

Đã tạo companion cho notification facility scope và maintenance write role guards:
core-security giữ scope/role/tenant authorization; migration-specific giữ payload
và workflow persistence assertions. SQL gốc và registry/selected set 77 giữ nguyên.
