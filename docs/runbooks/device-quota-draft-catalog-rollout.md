# Device Quota draft-catalog rollout and rollback

Runbook này chỉ dành cho draft catalog Thông tư 10/2026. Draft là dữ liệu
đề xuất theo đơn vị; không có bước publish/activation và không được sửa các
contract category, decision, equipment, compliance, report hoặc Excel import
đang hoạt động.

## Preconditions

1. Chốt một landed commit duy nhất và ghi lại SHA đầy đủ.
2. Chạy strict OpenSpec validation và repository quality gates.
3. Ghi riêng kết quả database `static` và `baseline-forward`. Chỉ coi aggregate
   là PASS khi cả hai report đều PASS, có evidence/digest, và cùng
   `subjectCommit`.
4. Baseline-forward chỉ chạy trên Oracle disposable `dq_*`; không chạy
   migration candidate trực tiếp trên `qltbyt_test` và không dùng Supabase CLI.
5. Mọi live write qua Supabase MCP cần permission rõ ràng cho đúng operation;
   runbook này không tự cấp permission đó.

## Additive deployment order

Thực hiện từng lớp và kiểm tra read-only sau mỗi lớp:

1. **Migrations first.** Xác nhận migration regulatory catalog và draft
   persistence đã tồn tại đúng identity/SHA của landed commit. Hai migration
   chỉ tạo source/draft/audit tables, indexes, RLS, grants và guarded RPCs;
   không backfill hoặc ghi active tables.
2. **RPC contracts second.** Xác nhận năm RPC draft có
   `SECURITY DEFINER`, `search_path = public, pg_temp`, JWT user/role/unit
   guards, explicit `authenticated` execute grants, và direct table access bị
   từ chối. Chạy direct-RPC negative phase gate trước khi cho UI gọi RPC.
3. **UI enablement last.** Chỉ sau khi hai lớp trên PASS mới bật link/route
   draft catalog cho role được phép. Xác nhận category-management page và cả
   hai Excel import entry points vẫn dùng contract cũ.

## Rollback

Rollback là additive-safe và không có `down migration` cho các migration đã
áp dụng:

1. Tắt UI entry point/route draft trước; giữ nguyên category page, decision
   page và hai Excel import flows.
2. Giữ nguyên active tables, active RPCs và dữ liệu audit. Không xoá draft,
   regulatory source hoặc audit tables chỉ để rollback UI.
3. Nếu lỗi ở RPC/UI, khóa gọi draft bằng server role/unit guard và mở incident;
   không nới grant, bypass RLS, hoặc sửa trực tiếp migration immutable.
4. Chỉ xử lý migration/RPC corrective change bằng migration additive mới sau
   khi đã có evidence exact-commit và approval riêng. Sau rollback, chạy lại
   active-surface regression cùng direct-RPC negative gate.

## Evidence checklist

- [ ] landed SHA và hai database lane cùng subject commit
- [ ] RPC/table privilege read-back
- [ ] active category + decision + equipment/report checks
- [ ] category Excel import và quota-decision Excel import smoke checks
- [ ] UI draft disabled mà active/Excel flows vẫn hoạt động
