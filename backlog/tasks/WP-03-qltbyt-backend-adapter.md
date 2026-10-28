# WP-03 — Đưa kết nối QLTBYT vào backend adapter

- Status: Done — local reviewed/verified; chưa rollout
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-02
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu adapter từ `services/web-push/client.go`, wire mapping và test của nó.
Đối chiếu `src/lib/web-push/{wire,worker-auth}.ts`
và các route worker thực tế trước khi đổi; không mặc định sửa server/API.
Phối hợp WP-04 trước khi chạm wiring/config dùng chung.

## Acceptance criteria

- [x] Adapter thực hiện claim/report và ánh xạ DTO sang contract core,
      không đưa HTTP/HMAC hay schema QLTBYT vào core.
- [x] Bảo toàn ký HMAC trên đúng method/path/raw body, timestamp, nonce,
      key rotation, phiên bản wire và validation response hiện có.
- [x] Report giữ lease/attempt token, revision và xử lý kết quả cũ; lỗi
      backend không bị biến thành trạng thái gửi thành công.
- [x] Outbox tạo trong giao dịch nghiệp vụ và eligibility tại claim vẫn do
      QLTBYT sở hữu, gồm tenant, recipient config, revoked và password epoch.
- [x] Contract tests chạy với backend giả lập có phản hồi hợp lệ/sai,
      auth failure và timeout; chế độ QLTBYT một app tiếp tục hoạt động.

## Xác minh

Chạy Go tests từ `services/web-push`; chạy test wire/auth liên quan nếu có
đổi contract. Áp dụng đủ JS/TS gates khi có thay đổi tương ứng. Không cần
SQL migration nếu adapter giữ nguyên contract hiện tại.

## Implementation và evidence — 2026-10-28

- Base: `40d25fd3`, branch `refactor/web-push-wp-03`; phạm vi local, không push.
- `services/web-push/qltbyt_wire.go` giữ DTO v1 và mapping tường minh.
  `types.go` giữ contract Go semantic, bỏ JSON tags và envelope `Version`.
  `HTTPBackend` tự gắn version 1, kiểm tra wire và semantic response trước khi
  trả core; worker vẫn kiểm tra semantic contract với mọi `Backend`.
- Giữ nguyên HTTP/HMAC method/path/raw body, timestamp, nonce/replay, key ID,
  strict JSON/version/size limits và `BackendError`/`APIError` error chain.
  Giữ token, revision string lớn hơn JS safe integer, nullable report fields,
  acknowledgement `applied|duplicate|stale`, snapshot server time, adjusted
  report clock và earliest lease. Không thay config/wiring của WP-04.
- Đã đối chiếu `src/lib/web-push/{wire,worker-auth}.ts` và hai route
  `src/app/api/internal/web-push/v1/{claim,report}/route.ts`: auth/raw body,
  previous-key rotation và RPC claim/report vẫn do app QLTBYT sở hữu.
  Không đổi TS, SQL, transactional outbox hay claim eligibility
  (tenant/recipient config/revoked/password epoch); không thêm `app_id` v1.
- RED thực: `TestHTTPBackendMapsQLTBYTContract` thất bại vì core request
  không có version gửi `"version":0` và signature khác raw body v1;
  `TestHTTPBackendRejectsInvalidSemanticReplies` thất bại vì adapter trả nil
  error cho poll/UUID/revision/attempt/time/TTL hoặc report ID/result sai.
  Cả hai GREEN sau mapping/validation tại adapter.
- Contract tests bổ sung: signed claim/report bodies, ba acknowledgement,
  null/non-null provider/retry fields, auth 401 và context timeout cho cả hai
  operation với `errors.Is/As`, và worker một app dùng HTTP backend thật với
  fake provider: stale không gửi lại; report auth failure không thành success.
- Local PASS: `gofmt`, `go test ./... -count=1`,
  `go test -race ./... -count=1`, `go vet ./...` từ `services/web-push`.
  Prettier check hai file backlog và `git diff --check` PASS.
  Controller chạy độc lập lại full/race/vet, gofmt, Prettier và whitespace:
  PASS. Test QLTBYT wire/worker routes: 11 PASS; một integration test SKIP
  theo điều kiện môi trường, không tính là bằng chứng DB integration.
- Hai review độc lập (spec rồi quality) bằng `post_implementation_reviewer`
  không có finding cần sửa. Controller đối chiếu cả tám DTO với base:
  giữ nguyên field/order/type/JSON tags; core chỉ bỏ tags và wire version.
- Reuse: dùng lại port, strict JSON/HMAC và semantic validators hiện có;
  DTO tách riêng chỉ tại adapter. Code Review Graph/GitNexus đã thử discovery
  và impact; index cũ nên source/search/tests hiện tại là evidence chính.
- Giới hạn có sẵn: semantic validator chỉ yêu cầu revision khác rỗng, chưa
  ép định dạng decimal; WP-03 giữ nguyên validation hiện tại. Không có SQL
  thay đổi nên không chạy DB gate. Evidence chỉ cục bộ, chưa chứng minh
  staging/live/browser hay DB integration.
