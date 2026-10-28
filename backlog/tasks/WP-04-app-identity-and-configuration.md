# WP-04 — Định danh app và cô lập credential, VAPID, cấu hình

- Status: Done — local reviewed/verified; chưa rollout
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-02
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu app context và composition/config ở
`services/web-push/cmd/web-push/main.go`, `vapid.go` và config seam được chốt
trong WP-01. Phối hợp ownership `types.go` với WP-02/WP-03.

## Acceptance criteria

- [x] Mỗi app có định danh ổn định, backend origin, credential và VAPID
      riêng; kiểm tra cấu hình thiếu/trùng/mismatch và fail closed.
- [x] Trong mô hình pull, app context lấy từ cấu hình tin cậy gắn với
      adapter/credential. Nếu xuất hiện inbound request, credential đã xác thực
      phải ràng buộc app; không tin `app_id` hay Origin do client tự khai.
- [x] Phân biệt app với `don_vi`; ID delivery/recipient và khóa chống trùng
      không bị coi là duy nhất xuyên app nếu contract không bảo đảm điều đó.
- [x] Credential rotation và chọn VAPID đúng theo app; không log secret,
      endpoint hoặc subscription keys. Metrics tránh label cardinality vô hạn.
- [x] Cấu hình QLTBYT cũ có đường nâng cấp rõ ràng; giữ key/version hiện có
      và test hai app trùng local ID, dùng sai credential hoặc sai VAPID.

## Ngoài phạm vi và xác minh

Không thêm database trung tâm hoặc thay VAPID production. Chạy config/auth
tests và Go suite; nếu cần đổi wire, review tương thích cùng WP-03 trước.

## Implementation và evidence cục bộ (2026-10-28)

- Branch `refactor/web-push-wp-04`, fixed base `0747ee38`; phạm vi commit local,
  chưa merge, push hoặc rollout. Cả năm acceptance criteria đã được review.
- `services/web-push/app.go`: trusted AppConfig → Backend/VAPID/Worker/Health
  binding. AppID ổn định; cả tập thiếu/trùng/mismatch trả lỗi, không trả partial
  binding và không làm network work trong composition. Reuse `NewHTTPBackend`,
  `LoadVAPIDKey`, `NewWorker`/`checkReady`, Metrics và HealthState.
- Origin trùng được so theo hostname case, numeric port (default 443, `0443`)
  và trailing slash; reject hostname rỗng, port ngoài 1–65535.
  HMAC so decoded bytes, VAPID so public artifact đã derive từ private scalar.
  AppID/origin/credential/VAPID key phải riêng; worker ID, HMAC key ID và VAPID
  version cục bộ được phép giống nhau. Shared origin fail closed đến khi source
  có authenticated app filtering cho claim/report và được review riêng.
- Entrypoint giữ một binding/process, env cũ và key/version hiện có;
  `WEB_PUSH_APP_ID` mặc định `qltbyt`. Compose source template chuyển tiếp biến.
  [Đường nâng cấp và rotation](../../ops/web-push/app-configuration.vi.md).
  Go composition nhận nhiều binding để kiểm chứng; scheduler/runtime nhiều app
  thuộc WP-05. Không thêm wire field, global ID lookup, metric label hoặc store.
- RED → GREEN: loader từng chấp nhận AppID sai; constructor từng chấp nhận
  duplicate AppID/origin/decoded credential/VAPID và worker ID sai; blank subject
  từng qua validation; origin `https://:443`, port 65536/0 và duplicate `:0443`
  từng qua config boundary. Các behavioral assertions này hiện PASS.
- `app_isolation_test.go`: hai authenticated TLS sources có cùng local
  delivery/subscription/worker/credential-slot/version; key riêng và report về
  đúng claiming source, health/metrics riêng. Sai credential → 401, sai delivery
  key version → VAPID mismatch, đều không send/report. Sai private/public/
  fingerprint/scalar bị chặn trước claim. Rotation giữ AppID/VAPID và credential
  mới authenticate được claim/report.
- Local PASS: focused config/auth/isolation/startup-log tests;
  `go test ./... -count=1`; `go test -race ./... -count=1`; `go vet ./...`;
  `gofmt -l` sạch.
  Không có bằng chứng browser, staging, live hoặc shared runtime WP-05.
- Repo-only Compose fixture `docker compose config --quiet`, Prettier các file
  Markdown/YAML đổi và `git diff --check`: PASS. Không chạy container/deploy.
- Controller chạy độc lập full/race/vet, gofmt, Prettier và whitespace: PASS.
  Compose được parse bằng env giả lập với `--env-file /dev/null`; kiểm chứng
  AppID chuyển tiếp và default pause/health/worker ID, không dùng secret thật.
- Hai review độc lập bằng `post_implementation_reviewer` (spec rồi quality)
  không có finding cần sửa. Không đổi TS/SQL/wire/provider; không chạy DB gate
  hay tuyên bố bằng chứng staging/live.
- Reuse discovery: Code Review Graph stale ở `4e308be7`; GitNexus chỉ thấy seam
  cũ. Đối chiếu source/rg/tests, không sửa index; không thêm dependency.
