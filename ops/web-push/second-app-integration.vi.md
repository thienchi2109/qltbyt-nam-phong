# Tích hợp nguồn Web Push thứ hai

WP-06 cung cấp **FIXTURE / DISPOSABLE ONLY**: hai nguồn HTTP v1 có subscription,
quyền người nhận, một job và state report riêng trong bộ nhớ. Chúng chạy qua
`NewAppBindings` → `HTTPBackend` → `Worker` → `Runtime` thật, dùng Sender giả;
không có push thật, browser hay chứng nhận một app thứ hai thực tế.

## Trách nhiệm của app mới

1. Giữ subscription, người nhận, quyền và outbox bền vững trong app. Tạo payload
   từ nghiệp vụ của app; không cần schema, role hay repair-request của QLTBYT.
   Claim chỉ lấy job đến hạn thuộc đúng chủ subscription, đang bật và đủ quyền.
2. Cung cấp HTTPS claim/report theo [contract v1](../../docs/architecture/web-push-hexagonal-assessment.md#4-contract-wire-v1-hiện-tại-và-nội-bộ-mục-tiêu).
   Dùng HMAC credential riêng, xác thực chữ ký, thời gian và nonce/replay tại
   nguồn theo contract auth hiện có. `app_id` không nằm trong wire v1.
3. Map ID của app sang delivery/subscription/attempt token **lowercase UUID**;
   revision là decimal string. Core hiện không nhận ID chuỗi tùy ý. ID local
   có thể trùng giữa app; mỗi lease cấp token mới, cùng revision đã claim.
   Cấp `server_time`, lease/deadline/TTL theo contract; snapshot thời gian send
   của worker vẫn cố định cho cả batch, chưa cộng elapsed time giữa delivery.
4. Report kiểm tra delivery/token/revision/ownership và lease trước khi đổi
   state. Replay đúng token/revision/outcome/status/retry-after đã commit trả
   `duplicate`, kể cả khi lease hết hoặc subscription đã renew. Replay khác
   kết quả hoặc attempt cũ sau reclaim trả `stale`; không revoke revision mới.
   Report retry dùng nguyên kết quả; không gửi provider lại trong cùng batch.
5. Source quyết định lịch retry/deadline/attempt cap, xử lý các outcome trong
   contract, và chỉ revoke revision đã fenced khi nhận `endpoint_gone`.
   Binding runtime không thay thế các kiểm tra tại source.
6. Operator thêm AppID ổn định, origin/credential và VAPID artifact/private key
   riêng vào [cấu hình nhiều app](app-configuration.vi.md). Giữ nguyên VAPID,
   subscription và credential QLTBYT hiện tại. Shared origin chưa được hỗ trợ;
   cần review riêng trước khi dùng chung endpoint/store.

Quyền được kiểm tra lúc claim. Thay đổi quyền sau claim không hủy được push đã
được provider nhận; runtime không reauthorize tại app giữa claim và send.
`accepted` chỉ là provider nhận push, không phải browser đã hiển thị/đọc.
Crash sau provider accept trước report có thể dẫn đến gửi lặp khi lease hết
và source reclaim. Attempt fencing bảo vệ state; không hứa exactly-once send.

## Example chạy được

- [second_app_source_test.go](../../services/web-push/second_app_source_test.go):
  một job kết quả xét nghiệm và subscription theo user local; hai instance
  có state/secret/key riêng. Chỉ dùng lại DTO v1 làm transport shape.
- [second_app_integration_test.go](../../services/web-push/second_app_integration_test.go):
  hai app send đồng thời với delivery/subscription/user ID trùng nhau, payload,
  endpoint, HMAC và VAPID khác nhau; credential/token chéo bị chặn. Provider
  `429` tạo lịch mới; source commit report rồi trả `503`, worker retry ra
  `duplicate` mà không send lại. Replay đổi outcome/status/retry-after bị chặn;
  exact replay muộn vẫn idempotent.
- [second_app_lifecycle_test.go](../../services/web-push/second_app_lifecycle_test.go):
  revoked/ineligible/sai owner chặn claim, đổi owner/revision chặn report cũ,
  `410` chỉ revoke revision hiện hành, và ranh giới revoke sau claim. Crash
  giả lập chặn HTTP report trước commit sau Sender `201` + accepted metric;
  restart đợi lease hết rồi gửi lại với token mới, report cũ trả `stale`.

```bash
cd services/web-push
go test ./... -run TestSecondApp -count=1
go test ./...
go test -race ./...
go vet ./...
```

Fixture một job/in-memory không thay thế durable store, transactional enqueue,
concurrent claim hoặc chính sách retry đầy đủ của app thật. Nó chỉ kiểm tra
HMAC signature/credential binding, không triển khai nonce store/time-window
hay auth server hoàn chỉnh. Subscription keys và provider đều giả; raw-wire,
HMAC vector, provider/security tests hiện có vẫn là các gate riêng. Browser,
QLTBYT lifecycle và cutover thuộc WP-07; packaging/rollout thuộc WP-08.
