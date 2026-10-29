# WP-06 — Chứng minh tích hợp app thứ hai qua contract chung

- Status: Done — merged main local tại `91b6aba0`; fixture/local gates và independent review PASS; chưa push
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-05
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu fixture/example adapter thứ hai và integration tests trong module
`services/web-push`. Dùng app thật khi có app được chỉ định và scope rõ;
trước mắt fixture độc lập đủ kiểm chứng khả năng tích hợp, không dựng thêm
một sản phẩm hay sửa repo khác.

## Acceptance criteria

- [x] Backend thứ hai cung cấp claim/report theo contract đã chốt mà không
      phụ thuộc schema, role hoặc repair-request payload của QLTBYT.
- [x] Hai app cùng chạy, có local delivery/user ID trùng nhau, nhưng không
      lẫn backend report, credential, VAPID hoặc nội dung.
- [x] Kiểm chứng retry, thu hồi/không còn đủ quyền tại nguồn và idempotency
      trong ranh giới cam kết; ghi rõ khả năng gửi lặp khi crash sau send.
- [x] Thêm adapter không cần nhánh điều kiện theo tên app trong core;
      chỉ sửa core nếu phát hiện contract thiếu và đã review thay đổi.
- [x] Có hướng dẫn tối thiểu để app mới tích hợp; evidence ghi rõ đây là
      fixture/disposable nếu chưa dùng app thật hay browser thật.

## Xác minh

Chạy fixture integration và Go suite bằng dữ liệu/key dùng cho test.
Không sử dụng subscription production hoặc gửi push thật tới người dùng.

## Evidence WP-06 — FIXTURE / DISPOSABLE ONLY

Base `main` đã merge WP-05 tại `3a9ef09a`; triển khai trên
`refactor/web-push-wp-06`, giữ Go, không sửa production core/wire/SQL/TypeScript.

Nguồn in-memory độc lập và hai nhóm scenario:

- `services/web-push/second_app_source_test.go`: HTTP v1 source sở hữu
  subscription/owner/eligibility, một queue job, lease/token/revision,
  due time, report idempotency và exact-revision revoke. Dùng lại DTO v1;
  không dùng fixture repair-request hoặc schema/role QLTBYT.
- `services/web-push/second_app_integration_test.go`: runtime thật chạy hai
  source đồng thời, trùng delivery/subscription/user ID, khác nội dung,
  endpoint/credential/VAPID. Report đúng source, credential/token chéo bị
  chặn; `429` → source schedule attempt mới; report accepted commit rồi `503`
  → worker retry identical report → duplicate, không resend provider.
- `services/web-push/second_app_lifecycle_test.go`: pre-claim revoked,
  ineligible, sai owner đều chặn và có positive control. Đổi owner/revision
  sau claim không cho report cũ revoke subscription mới. `410` revision hiện
  hành revoke đúng nguồn. Chặn HTTP report trước persistence sau provider
  `201` + accepted metric, cancel/restart, hết lease mới reclaim/send lần hai;
  report token cũ stale. Revoke sau claim không recall provider acceptance.
- [Hướng dẫn tích hợp](../../ops/web-push/second-app-integration.vi.md):
  mapping UUID local, source ownership/fencing, config và giới hạn fixture.

Hai assertion fixture fidelity đã chạy RED → GREEN: exact committed replay
sau lease expiry/renew vẫn duplicate; report không revoke subscription đã
đổi owner. Replay đổi outcome/status/retry-after trả stale.

Local gates ngày 2026-10-29 PASS trên diff chưa commit:

- `go test ./... -run TestSecondApp -count=1 -v`: 7 tests và 3 subtests PASS.
- `go test ./... -count=1`: cả hai Go packages PASS.
- `go test -race ./... -count=1`: cả hai Go packages PASS, không có race.
- `go vet ./...`, `gofmt` ba file test, touched Markdown Prettier và
  `git diff --check`: PASS.

Reuse: dùng lại `appTestConfig`, runtime test lifecycle helpers,
`uuidFor`, `reportItem`, signing primitive và DTO v1. Không dùng fixture
repair-request hay copy runtime; graph stale `4e308be7`, current source/tests
và GitNexus là fallback để kiểm tra capability hiện có.

Điều phối viên tự review toàn bộ fixture/tests và chạy lại full/race/vet,
gofmt, touched Markdown Prettier và whitespace: PASS. Reviewer độc lập
`post_implementation_reviewer` kiểm tra contract và chất lượng so với base
`3a9ef09a`: spec PASS, quality PASS, không có findings; reviewer không chạy lại
tests, bằng chứng thực chạy thuộc lane kiểm chứng riêng của điều phối viên.

Đã merge main local tại `91b6aba0`; chưa push/deploy, chưa gửi provider thật
hoặc kiểm chứng app/browser thật. Không thay dependency, TS/React hoặc SQL;
các gate TS/React/Database không áp dụng cho diff này.
