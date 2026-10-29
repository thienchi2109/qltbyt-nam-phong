# WP-07 — QLTBYT compatibility và điều kiện cutover

Ngày 2026-10-29; base `91b6aba0fc412090b2cecd60fd7c88d3c9793d83`.
Diff WP-07 chỉ thêm regression tests/tài liệu, không sửa production adapter,
browser UI, Go core, wire v1, production SQL/migrations hoặc dependency. Không deploy, đổi VAPID,
chuyển subscription, gửi provider thật hay ghi live DB.

## Bằng chứng local

| Ranh giới                        | Bằng chứng chạy lại                                                                                                                        | Kết luận trong phạm vi local                                                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Register/revoke v1               | `src/app/api/web-push/__tests__/subscription-routes.test.ts`, 24 tests                                                                     | Same-origin trước session/RPC; thiếu/sai session bị chặn; owner lấy từ JWT session, `admin` → `global`; không nhận `user_id`/`app_id`; UUID/revision bigint nguyên vẹn; invalid metadata fail closed; conflict có envelope v1. Revoke không phụ thuộc runtime registration controls. |
| Public artifact và worker routes | `routes.test.ts`, `worker-routes.test.ts`, `candidates.test.ts` cùng thư mục                                                               | Public key chỉ công bố artifact công khai đã validate, không cần session; mutation mới cần session/same-origin. Disabled registration, HMAC/nonce/replay/fingerprint và response validation được giữ. Fetch Supabase được mock, không chứng minh DB authorization.                   |
| Permission/local/server state    | `src/lib/web-push/__tests__/browser-registration.test.ts`; `NotificationsPushOptIn.test.tsx`                                               | UI thực hiện qua tương tác người dùng: permission chỉ từ gesture, trạng thái pending/denied/disabled; native subscription và register POST được kiểm tra riêng. Matching local `enabled` **bỏ qua POST**, không chứng minh có row ở backend mới.                                     |
| Account và race                  | `NotificationsPushOptInLifecycle.test.tsx`, `browser-lifecycle.test.ts`, `auth-signout.test.ts`, `change-password-dialog.signout.test.tsx` | Resume account đã opt-in không xin quyền lại; cleanup account cũ chặn account mới nếu thất bại; consent theo owner; forced-password signout opt-out trước cleanup; cancel register/revoke và late response không khôi phục consent/metadata enabled.                                 |
| Payload/deep link                | `worker-payload.test.ts`, `worker-events.test.ts`, `wire.test.ts`                                                                          | Text/Unicode/byte limits, same-origin repair deep link, worker display/click handling. Đây là jsdom, chưa phải browser push thật.                                                                                                                                                    |
| Go adapter/delivery              | Full/race/vet `services/web-push`                                                                                                          | DTO v1, outcomes, app binding/key isolation, accepted-report retry không resend, stale fencing và crash/reclaim được kiểm tra bằng local HTTP/in-memory/provider fixtures. Fixture không chứng nhận quyền tại SQL QLTBYT.                                                            |

Ordered local gates: touched-file Prettier, `verify:no-explicit-any`,
`verify:dedupe`, `typecheck`, focused Vitest: **119 PASS, 1 SKIP**, 16 files PASS,
1 file SKIP khi không có `WEB_PUSH_PHASE4_DATABASE_URL`. Integration đó được chạy
riêng trên disposable clone và PASS như lane bên dưới.
Lượt focused cuối gồm thêm phase45 authorization/migration và guidance tests.
React Doctor diff-only trên staged diff: **100/100, 3 files**, gồm route test mới.
Đây không là full-repo score. Không có RED → GREEN
production fix: các regression mới đều PASS với implementation hiện có.
Go `go test ./... -count=1`, `go test -race ./... -count=1` (cả hai packages)
và `go vet ./...`: PASS.

Điều phối viên chạy lại ordered gates trên staged diff; reviewer độc lập
`post_implementation_reviewer` báo **Spec PASS, Standards PASS** so với base.
Final reread tài liệu sau cập nhật số liệu vẫn chờ trước commit.

Tái sử dụng `test-fixtures.ts`, runtime controls, browser lifecycle record và
validator hiện có; không thêm helper production. Code Review Graph stale tại
`4e308be7`; GitNexus và source hiện tại dùng để xác nhận reuse/callers.

Signed integration `phase4-worker.integration.test.ts` SHA-256
`119cd049c73d1713f8d9e10450b0a1ed35633e805b52c17ecdd6640a3f7b2591`:
**1 file / 1 test PASS** trên clone
`dq_webpush_phase4_wp07_1793246380379` cùng baseline bên dưới; create/drop exit 0,
tunnel đã dừng. URL chỉ qua process env, không lưu secret. Đây là Next handlers
thật + HMAC + SQL thật qua fetch SQL bridge mock, không là PostgREST/network,
provider hay browser thật. Phase45 kiểm tra authenticated privilege riêng.
Tổng hai lane: **120 tests đã thực thi PASS** (119 local + 1 disposable DB).

## SQL nguồn — DISPOSABLE ONLY, RED → GREEN 5/5

Điều phối viên chạy trên Oracle PostgreSQL 17, container `supabase-db`, clone
`wp07_green_1793246541898` từ restored baseline `qltbyt_test` có high-water
`20261023150839|fix_global_facility_options_dataset_alias`. `createdb`/`dropdb`
exit 0. Mỗi file chạy bằng `psql -X -U postgres -d CLONE -v ON_ERROR_STOP=1`;
cả năm kết thúc `ROLLBACK`, exit 0.
Không apply candidate/migration; không sửa restored baseline hoặc live.

| Test trong `supabase/tests/`      | SHA-256 source                                                     | Kết quả                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `web_push_phase2.sql`             | `171e53b551d7f7a52150763d13eaf18ce08ab1485426a872ba5163c7766c5268` | PASS: recipient/read matrix, account ownership, revision/epoch/revoke, retention/RLS.                                     |
| `web_push_phase3.sql`             | `0c05e7e4d933c4fb6f6134b46280bfedbb7a1b6950a2cfde11ba2ea6dc4c69e5` | PASS: enqueue tenant/subject, snapshot/dedupe, ZBS coexistence, atomic outbox/rollback, Unicode/null bounds.              |
| `web_push_phase4.sql`             | `d16a5d32fa181ddf2de3fefd3ab6dc7d456bca6e4db26fa32b76ccfb579b8876` | PASS: controls/VAPID/nonce, fan-out, lease/report fencing, epoch revocation.                                              |
| `web_push_phase45.sql`            | `fc69e438d8cf0cefecc73eb3ebade16b99ed3b817fa1bdf16bdb7f1f04d81c19` | PASS exit 0: direct authenticated boundary; scope/ownership/stale/atomic; enqueue/claim/retry eligibility/unit isolation. |
| `web_push_new_unit_allowlist.sql` | `b98ed00a23e196c9bb12122ac27cbb8d144de4d1d1b6c1e42d3543f68aa862fe` | PASS exit 0.                                                                                                              |

Lượt RED trên clone `wp07_20261029_1793246016230`: phase2
(`f5aa46778f1fa51f09a8be6768813f5959a757f1deab4fd163f7aa8adcae15fd`)
FAIL `invalid_recipients`; phase3
(`9fcc890826dcd2b9f71a1bff2bc9121393ffdd0eb27296d5f9336db6890d5522`)
FAIL `enabled create must enqueue recipient without subscription`; phase4
(`d6c45fdc5aa6948fc2c1c2b94ca587ae1c21925b1d061dbdf7c4b29240163bea`)
FAIL `claim fans out active subscriptions`. Phase45/allowlist đã PASS.

Sửa test-only: positive recipient dùng `to_qltb` theo policy phase45, kể cả reset
sau admin/global registration; giữ role=`user` negative config/read và toàn bộ
read-role matrix. Phase3 chạy tiếp làm lộ fault trigger không khớp dấu câu mới
và tên thiết bị bị scenario snapshot trước đổi: dùng content sentinel độc lập
punctuation để inject lỗi storage, reset tên trước scenario null department.
Các assertion về payload, quyền và rollback được giữ. Lượt GREEN thực thi toàn
bộ năm file như bảng; Unicode fixture dài có NOTICE từ text search, không lỗi.

Đây là scoped source regression trên restored baseline, **không là static +
baseline-forward gate trên exact landed commit**, không chứng minh parity live.
Không đổi migration, production SQL, registry hoặc waiver. Tests thực thi quyền,
epoch/revision/revoke tại SQL; SQL-text assertions và fixture Go không thay thế
lane này.

## Ranh giới cutover và rollback

1. Giữ nguyên subscription store QLTBYT, endpoint/keys/owner/revision và VAPID
   version/public key/fingerprint/private key. App binding QLTBYT do operator
   cấu hình; `don_vi` vẫn là tenant, không đưa `app_id` vào browser/wire v1.
   Đổi kho/key nằm ngoài đường mặc định: phải có import/mapping hoặc explicit
   reconciliation đã kiểm chứng. Local `enabled` và permission `granted`
   không đủ xác nhận đăng ký server, backend rỗng không được coi là đã chuyển.
2. Giữ SQL outbox nguyên tử và quyền chọn recipient tại nguồn: config, tenant,
   read permission và authorization epoch phải hợp lệ khi claim/retry. Report
   phải fence token/lease/owner/subscription revision, `404/410` chỉ revoke đúng
   revision. Thu hồi sau claim không thể recall push đã provider accept.
3. Trước thay runtime, dừng consumer cũ, đợi attempt đang chạy/report hoặc lease
   hết hạn; xác nhận không còn consumer ngoài lease contract rồi mới bật binding
   mới. Không xóa queue, reset attempt/token/revision hoặc chạy consumer thay
   thế song song để thử. Thao tác vận hành thuộc WP-08, cần phê duyệt riêng.
4. Rollback: dừng runtime mới, drain/wait lease theo cùng cách, khởi động artifact
   cũ với đúng backend/store/VAPID và credential còn hiệu lực. Giữ nguyên outbox,
   retry schedule và subscription; không restore DB hay đổi key để rollback code.
   Runbook/artifact cụ thể và rollback smoke vẫn thuộc WP-08.

`accepted` chỉ nghĩa provider nhận, không nghĩa delivered/read. Crash sau send
trước report có thể gửi lại sau reclaim; retry identical accepted report phải
idempotent, không resend provider trong cùng attempt. Browser tag không bảo đảm
exactly-once. Local fixture đã mô phỏng crash/restart; chưa stop/start service
được deploy hoặc chứng minh rollback trên thiết bị thật.

## Phần còn INCOMPLETE

[WP-07](../../backlog/tasks/WP-07-qltbyt-compatibility-and-cutover.md) giữ các điều
kiện nghiệm thu chưa có evidence. Chưa có Chrome/Firefox/Safari/iOS Home Screen
push thật, kiểm tra delivery chỉ account đang active, read/tenant/config revoke
giữa claim và retry, hoặc cutover/rollback trên môi trường triển khai. Các kết
quả local/disposable trên không cấp phép live write/cutover. WP-07 hoàn tất phạm
vi local/disposable regression; browser/device và thao tác WP-08 vẫn INCOMPLETE.
