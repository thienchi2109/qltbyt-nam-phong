# Phase 3 evidence

## Phạm vi và baseline

Chỉ Phase 3: atomic SQL enqueue song song ZBS và regression SQL. Bắt đầu từ
main đã sync tại `cd9da20c546cced1999874bd7ef409402bd8829e`, chứa `bdf0b8ec`, trên branch
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

## Hai lane cùng commit

Subject `9b5fc8af78c9131a14291aecee58ef54d2e080f3`, migration SHA-256
`85dda37d7d650c8f9decbf5c62b2f564b7edad2e4687216f1144ea5a6e54db79`.
Migration không sửa sau commit. Đây là branch evidence, không phải landed
main hoặc chứng nhận live apply.

| Lane                    | Kết quả thực tế                                                                       | Run / digest                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| static                  | **FAILED**, 3 BLOCKING, 1 DANGEROUS, 1542 WARNING                                     | `webpush-phase3-static-20260911` / `4de5b4c6cf0c999135ab36f338e8b8c57ac0cd10d5ed294e7343b3b556ae334e` |
| Oracle baseline-forward | **FAILED**, 80/80 selected/attempted/executed; Phase 2 và 3 Web Push PASS; 2 BLOCKING | `webpush-phase3-oracle-20260911` / `beb38a730481d1788b95bf73f01d514029e42f2b8041c9de1d6d93e77323e391` |

Hai report đều `requiredChecksComplete=true`, `evidenceAvailable=true`, đã
verify digest và subject. Local reports:
`/root/Oracle/web-push-phase3-evidence/9b5fc8af78c9131a14291aecee58ef54d2e080f3/`.
Oracle report persist tại
`/opt/supabase-test/quality-gate/evidence/webpush-phase3-oracle-20260911/report.json`.
Control và candidate dùng clone riêng, control chạy lại inline; không reuse
control có lỗi. Không có failure cleanup. Regression clone cũng đã drop và
read-back count=0. Post-commit hook lần đầu vượt thời hạn chờ; không dùng lần
đó làm evidence PASS, hai report chính thức trên thay thế kết quả thiếu đó.

### Phân loại finding

- **Fixture error đã sửa:** create không nhận issue NULL vì schema business
  NOT NULL; test điều chỉnh về input hợp lệ, không đổi runtime/constraint.
- **Ba JWT findings là giới hạn recognizer:** hai helper pure IMMUTABLE,
  invoker, không đọc bảng và đã revoke direct EXECUTE; recognizer phân loại
  public function theo tên. Create giữ nguyên claims extraction, role/user
  NULL guards và tenant/department guards; so sánh toàn definition sau khi bỏ
  riêng block enqueue mới bằng definition cũ trả equality=true. Canonical
  recognizer không chấp nhận role fallback hiện hữu của create. Không thêm
  guard giả hoặc cấp quyền browser cho helper.
- **DANGEROUS giữ nguyên:** statement GRANT authenticated lặp quyền đã có
  trong migration cũ và baseline ACL read-only (`authenticatedExecute=true`).
  Không có privilege expansion thực tế do statement này, nhưng không tự ghi
  approval/waiver hoặc đổi classification của report.
- **Inventory blocker #998:** control/candidate cùng `P0001`, test SHA
  `f6db0ff12fc3147d20be0ed9f618d018ddad04644f9fde36180a883c8a43e849` và signature
  `14531cbcc0868fcbebec3ef3d4fa3bbe5f8bd42344106383f3fcc4b6283ca693`.
  Không sửa Technical Configurations hoặc test inventory.
- **Affected baseline debt vẫn BLOCKING:**
  `repair_request_lifecycle_audit_smoke.sql` control/candidate cùng `42501`,
  source SHA `8dead11c7da6fc3a2dfc78b03c513008869ba901f61465680376e20eda822ba7`,
  signature `04bea141b259176648e96ff762a7594bba12810697093ea589f01e8dd1b84209`,
  stderr SHA `b05fc0ab4672c37f2387901963ab3e01869ae066d31100b7f5b23ebb39d4a03b`.
  Source thay `public.audit_log` ở phần fault injection, nhưng postgres không
  có CREATE public khi chạy tests. Dù lỗi giống baseline, protectedObjects
  chứa `repair_request_create` đã đổi, nên exemption cũ không áp dụng. Đây là
  giới hạn evidence còn phải giải quyết, không tự gọi là unrelated để hạ
  thành warning. Năm debt khác vẫn được registry hiện hữu nhận là WARNING.
- Web Push tests trên baseline thiếu function/table, candidate PASS; đó là
  `baseline-repaired` trong report, không phải evidence TDD. Red hành vi đã
  chạy riêng trên fixture có đủ Phase 2 như mô tả trên.

Aggregate acceptance: **BLOCKING / INCOMPLETE**. Tick 3.1–3.3 vì có source,
execution và review evidence; **3.4 chưa tick**, **2.4 giữ unchecked**. Theo
dõi acceptance còn lại ở [#999](https://github.com/thienchi2109/qltbyt-nam-phong/issues/999),
không sửa gate/#998 trong lượt này.

## Review và closeout

Review độc lập bằng `post_implementation_reviewer` không có Critical/Important
finding; standards và spec của năm file Phase 3 đạt focused review. Commit
`cd9da20c` của #997 đã có trên main trước khi bắt đầu, không phải diff Phase 3.
Formatting và OpenSpec strict PASS. Không đổi TS/TSX nên không mở rộng sang
React Doctor/browser/full suite.

Sau commit evidence, chạy lại hai lane trên exact HEAD cuối; report cuối lưu
theo full SHA trong `/root/Oracle/web-push-phase3-evidence/`, với alias
`final-static.json` và `final-baseline-forward.json` để tra cứu mà không tạo
vòng tự tham chiếu SHA trong commit. Báo kết quả cuối trong handoff; không
suy ra PASS từ report trước hoặc từ quyền push `--no-verify` của maintainer.
