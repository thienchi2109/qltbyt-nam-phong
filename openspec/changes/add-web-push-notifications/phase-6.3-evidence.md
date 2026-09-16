# Phase 6.3 Evidence

Ngày 2026-09-16. Commit kiểm chứng: `bee0480473ec2a94aea1f8cc01cc1269e15e3ca4`, base `9cd8c549ef60c11e76d56dfd5468de36407cf540`.

## Phạm vi và coverage

Chỉ thêm `services/web-push/worker_failure_test.go` (301 dòng); không sửa runtime.

- Provider accepted nhưng report response mất: retry report giữ outcome `accepted` và attempt token, chỉ gọi sender một lần.
- Process exit được mô phỏng bằng cancellation sau provider acceptance, trước report; worker mới nhận claim sau 46 giây với attempt/token mới và gửi lại cùng subscription. Đây là at-least-once attempts, có thể gửi trùng.
- Backend mock trả `stale`: worker kết thúc mà không resend hoặc retry report trong lượt đó.
- Deadline đã qua: không gọi sender, report `not_sent_expired` và không có provider status.
- Ba subscription có kết quả `accepted`, `endpoint_gone`, `transient` được report riêng theo delivery ID.

`accepted` chỉ là provider acceptance, không chứng minh thiết bị đã nhận, hiển thị hoặc người dùng đã đọc.

## Verification và review

Main agent trực tiếp đọc diff và chạy từ `services/web-push`:

- `go test ./...`: PASS.
- `go test -race ./...`: PASS.
- `go vet ./...`: PASS.
- `gofmt -d .`: không có diff.
- `golangci-lint run ./...`: PASS, 0 issues.

Từ repository root:

- `node scripts/npm-run.js run verify:no-explicit-any`: SKIP, không có TypeScript thay đổi.
- `node scripts/npm-run.js run verify:dedupe`: SKIP, không có JavaScript/TypeScript thay đổi.
- `node scripts/npm-run.js run typecheck`: PASS.
- `git diff --check 9cd8c549..HEAD`: PASS tại commit kiểm chứng.

Lệnh thử ban đầu `go test ./services/web-push/...` từ repo root thất bại vì module nằm trong `services/web-push`; kết quả PASS ở trên đến từ đúng module directory.

## Giới hạn

Luna-max tạo commit local nhưng lỗi model capacity trước bàn giao cuối. Không có bằng chứng Red → Green được bàn giao; không chứng nhận đã hoàn thành quy trình TDD chỉ từ commit/test PASS.

Reclaim/fencing là hành vi backend được mô phỏng, không kiểm chứng SQL hoặc process crash thật. Test từng subscription kiểm tra một batch; không chứng minh toàn bộ vòng retry backend loại endpoint đã accepted khỏi claim tiếp theo. Không coi review/mock PASS là bằng chứng end-to-end.

Không chạy provider thật, browser, container smoke, SQL/live DB hoặc deploy. Không có TS/React diff nên không chạy React Doctor. Chunks 6.4–6.5 vẫn chưa thực hiện. Commit chưa push, chờ maintainer quyết định.
