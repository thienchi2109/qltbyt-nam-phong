# Bàn giao Issue #998 - Task 3

## Trạng thái

- Phạm vi: chỉ fixture `supabase/tests/technical_configuration_authorized_user_guard_phase_gate.sql`; không sửa migration, registry, waiver hoặc Task 4.
- Base SHA: `61fb61fbf5a4fb464b61365248bc3805072616d2` trên `main`.
- Candidate SHA: `e018f5cad2a993ec47c4b3a7636e564aeeccec48`, đã push lên `origin/main`.
- SHA-256 fixture: `b303fadfe7992b21e59611f95bba508213aa6dfcada09508282c44377a433c65`.
- Parent review: đã hoàn tất; đã sửa `END IF`, loại duplicate fixture/scaffolding và giữ file ở đúng 450 dòng.
- Task 3 đã chuẩn bị và landed, nhưng chưa được chấp nhận; Step 5 và completion vẫn unchecked. Issue #998 vẫn mở.

## Hành vi đã triển khai

- Tách graph `routines`, `starts`, `walk`, `target` thành helper `pg_temp` dùng lại trong test.
- Đổi snapshot `v_module_rpc_count = 79` thành điều kiện không rỗng `v_module_rpc_count > 0`; giữ nguyên kiểm tra missing guard và unrelated guard reachability.
- Thêm bốn mutation case có subtransaction rollback riêng: module RPC hợp lệ, module RPC thiếu guard, RPC unrelated gọi guard, và revoke toàn bộ module candidate.
- Expected failure yêu cầu đúng SQLSTATE `P0001` và đúng nhãn `assertion_failed`; sau rollback kiểm tra function không còn và chạy lại graph.
- Bốn specialty signature được graph/ACL discovery bao phủ động; không hardcode count, danh sách signature hoặc invariant module boundary mới.

## Bằng chứng local

- `git diff --check`: PASS.
- `format:check`: PASS; SQL không thuộc nhóm file Prettier hỗ trợ.
- `db:quality-gate:local`: SKIP vì không đổi migration hoặc gate registry.
- Pre-commit và pre-push hooks: PASS; `typecheck`: PASS.
- Fixture structure: 450 dòng, một `BEGIN;`/`ROLLBACK;` cấp cao nhất, dollar quote cân bằng.
- Checkout hiện sạch và đồng bộ với `origin/main`.

## Ranh giới runtime và bước tiếp theo

- Baseline-forward Oracle đã thực thi một lần với run `issue-998-task3-e018f5ca-20260912`, subject đúng candidate SHA; `evidenceAvailable=true`, `requiredChecksComplete=true`, kết quả `FAILED`.
- Report digest: `2dca94a578ca3d073569018f8f5b7d74aee37f47e03b245c54ebb8fb1e41fcd9`; control/candidate đều chạy `80/80`.
- Fixture Task3 thất bại với SQLSTATE `42501` và `permission-denied`; source hash khớp `b303fadfe7992b21e59611f95bba508213aa6dfcada09508282c44377a433c65`. Đây là failure runtime thực tế, không phải SQL PASS.
- `web_push_phase2` đã được attempted/executed/selected và không có failure finding trong control/candidate theo runner report contract; trạng thái pass chi tiết của entry không được report surface riêng.
- Các blocker baseline khác được giữ nguyên: `repair_cost_usage` với `P0001` và các technical-configuration debt signature `permission-denied`.
- Cleanup disposable clone đã được parent xác minh bằng read-only Oracle catalog (`exit=0`): `0` database `dq_*`, `0` activity trên `dq_*`, `0` advisory lock. Không có live DB write.
- Task3 vẫn chưa accepted vì fixture failure; không tạo run Oracle mới trong closeout này. Khi tiếp tục, kiểm tra run state hiện có trước và đối chiếu exact candidate SHA/source hash.
- Task 4, OpenSpec `2.4` và các waiver vẫn giữ nguyên trạng thái chưa hoàn tất.
