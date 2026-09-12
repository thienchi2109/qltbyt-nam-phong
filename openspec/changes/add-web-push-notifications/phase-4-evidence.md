# Phase 4 evidence và handoff

## Phạm vi và baseline

Chỉ Phase 4: backend QLTBYT, worker claim/report và tests theo
[contract v1](phase-1-contract.md). Không UI/service worker, Go/provider,
deploy, bật enqueue, ghi live DB hoặc sửa Database Quality Gate.

Branch `feat/web-push-phase-4` tạo từ main đã sync tại
`48d09eab1f79bf18452db43b824b5c3964d10ed4`. Delta từ handoff `015fb3ab`
thuộc #998, không thay đổi runtime Web Push. Đã đọc proposal, design, spec,
tasks và evidence/handoff Phase 1–3, gồm
[live apply và Oracle catch-up](phase-2-3-live-apply-evidence.md).
Agentmemory recall/smart search theo tên change và ID cũ không trả entry phù hợp.

Tasks 2.4/3.4 giữ unchecked. Các kết quả static/baseline-forward FAILED
trước đây giữ nguyên; maintenance PASS không phải Quality Gate PASS.
Baseline đã đổi, không tái dùng chứng nhận trước đó. Quyền bypass live apply
Phase 2–3 không áp dụng cho Phase 4.

Baseline trước sửa, do controller chạy ngày 2026-09-12:

- `node openspec/changes/add-web-push-notifications/phase-1-baseline.check.mjs`:
  PASS source lock ZBS và HMAC vector; không chứng nhận DB rollback.
- `node scripts/npm-run.js run test:run -- src/lib/zbs/__tests__`:
  9 files/49 tests PASS.
- `openspec validate add-web-push-notifications --strict`: PASS.

Oracle read-only xác nhận `qltbyt_test` baseline v2 healthy, high-water
`20260911124043`, 343 migration records, 84 Technical Configurations routines,
không invalid index/unvalidated constraint và postgres không có CREATE trên
public. Chỉ tạo clone disposable `dq_webpush_phase4_dev_20260912` để kiểm thử;
không mutate restored baseline. Artifacts của lượt này lưu tại
`/root/Oracle/web-push-phase4-evidence/`.

Controller chạy SQL Phase 2 và Phase 3 trên clone này trước migration Phase 4:
cả hai exit 0, mỗi file có ba nhóm assertion PASS. Bao gồm recipient/tenant
authorization, subscription revision/epoch/revoke, default-off enqueue,
ZBS coexistence, rollback và payload bounds. Logs: `inherited-phase2.log`,
`inherited-phase3.log` trong thư mục artifacts. Đây là focused baseline,
không phải hai lane Quality Gate.

## Khảo sát và reuse

Luna scout đã đối chiếu source trước sửa. Code Review Graph hiện hành tại
base `48d09eab`, sau đó GitNexus xác nhận quan hệ caller cho
`getSessionClaims`, `assertSameOriginRequest` và signer ZBS. Session/origin/RBAC
có primitive dùng lại; không có strict bounded JSON duplicate-key parser
hoặc validator endpoint Web Push phù hợp. Signer ZBS không tương thích wire
Web Push vì canonical bytes và nonce store khác nhau; không dùng chung secret.
SQL được đối chiếu bằng source vì graph không index routine SQL đáng tin cậy.

## Implementation và verification

Phase 4 thêm browser config/public-key/register/revoke routes, signed worker
claim/report, strict wire validation, controls/VAPID chung từ DB, nonce/throttle
store, fan-out/lease/retry/report fencing và retention. Ba migration mới là
`20260912000100_web_push_controls_nonce.sql`,
`20260912000200_web_push_delivery_claim.sql`,
`20260912000300_web_push_delivery_report.sql`.
Không sửa migration lịch sử hoặc ZBS. Registry chỉ thêm Phase 4 regression
vào requiredForMigrations, không sửa gate engine/debt.

Controller xác minh sau sửa:

- Format, no-explicit-any, diff-only dedupe, typecheck: PASS.
- API/wire: 3 files/21 tests PASS.
- React Doctor: scan đủ 16 changed files, 100/100, không findings.
- Source/HMAC lock Phase 1, ZBS 9 files/49 tests, OpenSpec strict: PASS.
- Clone độc lập `dq_webpush_phase4_verify_20260912` từ restored baseline:
  ba migration lần lượt exit 0; SQL regression exit 0 và ROLLBACK.
- Fake-worker integration thật qua signed route và SQL: 1 test PASS;
  claim -> report -> duplicate/replay, không provider send, rollback bắt buộc,
  guard tên DB chỉ cho disposable `dq_webpush_phase4_*`.

Logs dưới `/root/Oracle/web-push-phase4-evidence/`: `fresh-controls.log`,
`fresh-claim.log`, `fresh-report.log`, `fresh-regression.log`, `integration.log`.
Đây là focused verification; không thay thế hai lane Quality Gate.

## Review

Luna implementation; controller review/verify và reviewer độc lập đối chiếu
contract. Đã sửa và scoped re-review xác nhận các Important findings:
parent/child deadline/counters, reclaim completion, zero-row fan-out,
endpoint-gone sibling lease/counters, parent lock khi concurrent final reports,
authorization cancellation completion, thống nhất controls API–DB và outcome
matrix trước nonce consume. Scoped re-review cuối không còn Important finding.

Các failure phát triển được giữ trong logs, không dùng làm PASS: fixture epoch,
SQL canary array/type, thiếu biến report và integration JSONB double-encoding.
Các lỗi này đã sửa; focused proof trên clone sạch thay thế các lần chạy thử.

## Gate và handoff

Static và baseline-forward phải chạy trên cùng exact commit. Báo cáo lưu theo
full SHA tại `/root/Oracle/web-push-phase4-evidence/<sha>/`, có digest và alias
`final-static.json`, `final-baseline-forward.json`; không tự chứng nhận từ
maintenance PASS hoặc quyền push `--no-verify`. Trạng thái cuối được ghi sau
khi chạy lanes. 2.4/3.4 không thay đổi bởi Phase 4.

Public test VAPID artifact ở
`src/app/api/web-push/__tests__/test-fixtures.ts`; chỉ public key/version/fingerprint,
không private credential. Phase 5 dùng public-key API sau provision riêng;
không cần Go deployment để dùng artifact test. Cấu hình worker dùng các biến
`WEB_PUSH_*` trong `worker-auth.ts`; secret môi trường riêng, previous key hết
hạn theo thời điểm rotation cố định. Không dùng secret ZBS/VAPID làm HMAC.

Registration/enqueue/dispatch mặc định false; canary rỗng không cấp việc mới.
Revoke vẫn hoạt động khi registration tắt. Không live write, enqueue enablement,
provider send, app/worker deploy, merge main hoặc Phase 5–8 trong lượt này.
