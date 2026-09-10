# Chunk 4r — Entry 35 baseline documents

Chỉ xử lý `technical_configuration_baseline_documents_phase_gate.sql` trên
base `5a68276ad6c87e5ee01c782f9458366b8ad79c78`.

- Core giữ nguyên table RLS/ACL/service-role grants, routine existence,
  SECURITY DEFINER/search_path/EXECUTE và ba ca missing role, missing user,
  denied role. Raw-admin document-create có ID khác null làm positive witness.
- Business giữ nguyên chuỗi document/citation create, reuse, pagination,
  ownership/version validation, cascade, stale revision, archived/locked
  immutability, copy remap và copy-wrapper future-domain exclusion. Ownership
  `PT422` ở đây là quan hệ giữa version/document/criterion, không phải tenant
  authorization. Raw admin/global vẫn là claims của workflow gốc.
- Hai companion giữ transaction rollback, advisory lock và error helper bắt
  đúng SQLSTATE/message; bỏ fixture/declaration không cần cho core. Regression
  đối chiếu nguyên khối SQL, assertion ownership, rollback parser và metadata
  registration bằng harness hiện có, không thêm helper dùng chung.
- SQL mixed và active registry không đổi. Companions chỉ fixture-only, chưa
  active; exact migration mapping cho business vẫn chưa chốt. Chunk 4.2–4.4
  tổng chưa tick; Chunk 5/6 chưa bắt đầu.

## Bằng chứng

- RED: dùng bản mixed trong cả hai companion, test thất bại vì business còn
  chứa nguyên khối ACL; metadata/rollback test PASS. GREEN sau extraction: 2/2.
- Entry 35 và registry suite: 13/13 PASS. Format, no-explicit-any, diff-only
  dedupe và typecheck PASS. React Doctor sau staging: 100/100, 1 file.
- Scope-metadata suite: 8 PASS, 1 FAIL; cùng lỗi tái hiện trên main chưa sửa.
  Active selected set đã tăng từ 77 lên 78 sau specialty test. Lượt này giữ
  nguyên 78; follow-up [#994](https://github.com/thienchi2109/qltbyt-nam-phong/issues/994)
  xử lý snapshot/classification cũ. Không tuyên bố toàn bộ suite PASS.
- Tự review source/fixture và ranh giới assertion; reviewer subagent không
  khởi chạy được do lỗi model/provider credentials của môi trường.
- Không tạo migration, không chạy Oracle hoặc ghi live DB. Static migration
  lane: không áp dụng cho diff này; baseline-forward: chưa chạy. Không có
  aggregate Database Quality Gate PASS hay dynamic semantic PASS.

Theo yêu cầu người dùng, landing vào main, push và xóa worktree sau khi commit.
Entry tiếp theo chưa được giao.
