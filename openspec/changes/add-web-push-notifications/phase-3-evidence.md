# Phase 3 evidence

## Phạm vi và baseline

Chỉ Phase 3: atomic SQL enqueue song song ZBS và regression SQL. Bắt đầu từ
main đã sync, chứa `bdf0b8ec`, trên branch
`feat/web-push-phase3-atomic-enqueue`. Không sửa migration cũ, Phase 4,
Go/API/UI, #997 hoặc gate/#998; không ghi live DB hay deploy.

Agentmemory recall `web push Phase 2 bdf0b8ec`, smart search
`add-web-push-notifications` và recall `#998` không trả entry. Đã đọc
proposal/design/spec/tasks, contract v1 và evidence Phase 1–2 trong repo.
Issue #998 vẫn OPEN; task 2.4 giữ unchecked.

Baseline trước sửa: ZBS 9 files/49 tests PASS; source lock Phase 1 và
`openspec validate add-web-push-notifications --strict` PASS. Không chạy lại
QR source-adoption test ngoài scope #997.

Oracle persisted baseline schema v2, healthy=true, high-water
`20260910064225`. Regression dùng clone riêng
`dq_webpush_phase3_dev_20260911`, đã áp ba migration Phase 2. Quyền CREATE
cho postgres chỉ cấp tạm trên clone để áp migration và đã thu hồi.
Không áp candidate lên restored baseline `qltbyt_test`.

## Verification

Red đã xác minh trên create-flow Phase 2, sau khi dựng riêng control table
trong disposable để test đi tới hành vi enqueue: SQLSTATE `P0004`, assertion
`enabled create must enqueue recipient without subscription`. Các assertion
default-off và ZBS trước đó đã qua; đây không phải lỗi thiếu function/table.
Scaffold chỉ chứa control table, không chứa code enqueue; đã xóa sau Red.
Log: `/root/Oracle/web-push-phase3-evidence/phase3-red.log`.

Regression `supabase/tests/web_push_phase3.sql` kiểm config/subject/tenant,
no-subscription, snapshot/dedupe/no-backfill, controls và ZBS coexistence;
fault injection sau ZBS/audit/history/equipment để kiểm rollback, caller
rollback, payload Unicode/JSON escaping và control ACL. API create không có
tham số priority; test mọi create hợp lệ, không thêm enum/API priority giả.

Green: cả ba nhóm assertion PASS (`phase3-green-v2.log`). Lần Green đầu có
lỗi fixture: `mo_ta_su_co` không cho NULL ở schema hiện hành. Đã dùng issue hợp
lệ cho create và kiểm null riêng ở formatter; không nới constraint business.
Hai notice `54000 word is too long to be indexed` do chuỗi dài trong fixture
đi qua search index hiện hữu, không phải test failure.

COMMIT thật chỉ chạy trên bản sao tạm của test tại thư mục evidence bên ngoài
repo, đổi đúng terminal ROLLBACK thành COMMIT. Fresh-session read-back PASS:
12 request, 11 intent và 11 ZBS event; request bị fault/caller rollback không
tồn tại. Hủy intent sau commit không ảnh hưởng request/ZBS. Registered test
vẫn chỉ BEGIN/ROLLBACK. Log `phase3-commit.log`, `phase3-commit-readback.log`.
SQL Phase 2 chạy cùng Phase 3 vẫn PASS cả ba nhóm (`phase2-coexistence.log`).

## Source, quyền và giới hạn

Migration mới `20260911030300_web_push_atomic_enqueue.sql` sort sau Phase 2
và định nghĩa create mới nhất trước đó `20260630100000`. Không sửa migration
cũ. Giữ nguyên signature và toàn bộ create/status/history/audit/ZBS; source
lock Phase 1 vẫn PASS với migration mới. ZBS regression 9 files/49 tests PASS.

Reuse `web_push_subject_can_receive`, schema intent và logical unique key
Phase 2. Source search không tìm thấy SQL helper tương đương để cắt UTF-8 theo
byte và giới hạn payload, nên thêm hai pure helper nội bộ, revoke direct
EXECUTE. GitNexus không index SQL function; dùng source-order/text search cho
SQL blast radius, không coi graph thiếu kết quả là không có caller.

Control singleton mặc định false, RLS bật, không policy hoặc direct grant cho
PUBLIC/anon/authenticated/service_role. Create đọc control từ DB; không nhận
cờ qua claims/GUC. No row cũng không enqueue. Không thêm worker/API/UI.

Create và hai helper chỉ thao tác SQL/payload, không outbound HTTP, không
catch/swallow lỗi enqueue. DB enqueue failure rollback toàn transaction;
delivery diễn ra sau commit ở phase sau, không nằm trong transaction tạo
request. Chưa kiểm provider delivery vì ngoài Phase 3.

Đang review và chạy gate; chưa có kết luận hai lane Phase 3 và chưa tick task.
