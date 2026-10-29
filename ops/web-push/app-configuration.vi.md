# Cấu hình app cho Web Push

WP-05 giữ chế độ một app bằng các biến `WEB_PUSH_*` hiện có khi không đặt
`WEB_PUSH_APPS_CONFIG_PATH`.
`WEB_PUSH_APP_ID` là tên ổn định do operator cấp, từ 1–64 ký tự chữ thường,
chữ số hoặc dấu `-`, bắt đầu bằng chữ/số. Cấu hình cũ không đặt biến này dùng
`qltbyt`; Compose template chuyển tiếp biến và cùng giá trị mặc định.

Khi chuẩn bị nâng cấp QLTBYT, có thể thêm `WEB_PUSH_APP_ID=qltbyt` vào env do
operator quản lý. Giữ nguyên origin, HMAC, file private key, VAPID version,
public key và fingerprint đang dùng. Không tạo VAPID mới hoặc đăng ký lại
subscription chỉ để thêm app identity. Pause mặc định vẫn bật; health vẫn
loopback. Tài liệu này không thực hiện deploy hoặc thay cấu hình production.

AppID khác tenant `don_vi`, worker ID và HMAC key ID. HMAC key ID là rotation
slot: đổi credential trong app/source rồi khởi động instance với cấu hình mới
không đổi AppID hay VAPID. Cửa sổ current/previous credential do source sở hữu;
service không fallback sang credential/key của app khác và chưa có hot reload.

`webpush.NewAppBindings` là seam composition Go nhận cấu hình tin cậy, kiểm tra
cả tập rồi mới trả worker/health riêng cho mỗi app. Chế độ nhiều app đọc file
JSON do operator cấp, rồi chạy một worker độc lập cho mỗi binding.
AppID không thêm vào wire v1 và không lấy từ payload, Origin hay `app_id` client.
Nếu có inbound API sau này, phải xác thực credential và bind app tại boundary.

Mỗi binding có backend origin HTTPS, HMAC secret và VAPID key riêng. Thiếu/sai
cấu hình, hostname rỗng, port ngoài 1–65535, AppID trùng, origin tương đương
(host casing, port 443 mặc định hoặc `0443`, trailing slash), HMAC cùng bytes
dù khác base64/key ID, hoặc VAPID cùng key
dù khác version đều bị từ chối trước claim. Version, public key, fingerprint
và private scalar phải khớp; version mỗi delivery cũng phải khớp app.

Shared origin chưa được phép: cần review riêng source có authenticated
credential-app filtering cho cả claim/report. Hai origin khác nhau cũng không
tự chứng minh storage phía source đã cô lập; operator phải cung cấp source
độc lập. Binding worker không thay thế quyền và fencing tại source.

Delivery/subscription ID, worker ID và version chỉ có phạm vi app. Report đi
về backend đã claim; không có global lookup bằng local ID. Log startup chỉ ghi
error code hữu hạn, không ghi raw config, secret, endpoint hay keys.

## File cấu hình nhiều app

Đặt `WEB_PUSH_APPS_CONFIG_PATH=/run/secrets/web_push_apps.json`. File là JSON
array 1–16 object, tối đa 1 MiB. Mỗi object nhận đúng các field bên dưới;
field lạ, field lặp, `null`, sai kiểu, JSON lỗi hoặc dữ liệu sau array bị từ chối.
`paused` mặc định `true`, `worker_id` mặc định `oracle-web-push-1`; các field
còn lại phải đủ để `NewAppBindings` kiểm tra. `worker_id` có thể trùng giữa app.

Ví dụ cấu trúc cho hai app, dùng placeholder cần thay bằng artifact/credential
đã được operator xác minh; không phải cấu hình có thể deploy ngay:

```json
[
  {
    "id": "qltbyt",
    "origin": "https://qltbyt.example",
    "worker_id": "oracle-web-push-1",
    "hmac_key_id": "current",
    "hmac_secret": "<existing QLTBYT base64 secret>",
    "vapid_version": "<existing QLTBYT version>",
    "vapid_public_key": "<existing QLTBYT public key>",
    "vapid_fingerprint": "<existing QLTBYT fingerprint>",
    "vapid_path": "/run/secrets/qltbyt_vapid_private_key",
    "vapid_subject": "mailto:operator@example.test",
    "paused": true
  },
  {
    "id": "second-app",
    "origin": "https://second-app.example",
    "hmac_key_id": "current",
    "hmac_secret": "<independent app base64 secret>",
    "vapid_version": "<independent app version>",
    "vapid_public_key": "<independent app public key>",
    "vapid_fingerprint": "<independent app fingerprint>",
    "vapid_path": "/run/secrets/second_app_vapid_private_key",
    "vapid_subject": "mailto:operator@example.test"
  }
]
```

File chứa HMAC secrets: lưu ngoài Git, quyền đọc tối thiểu, mount read-only như
secret cùng từng file VAPID riêng. Không ghi secrets vào Compose template hay
log. File thiếu/sai không fallback sang env cũ; file mode không kế thừa origin,
credential, VAPID hoặc pause từ env một app. `WEB_PUSH_HEALTH_ADDR` vẫn là cấu
hình chung, mặc định `127.0.0.1:8080`, chỉ cho loopback IP tại port 8080.
Không có hot reload; đổi cấu hình cần restart theo quy trình rollout được duyệt.

Compose template hiện tại vẫn dành cho chế độ env một app. Muốn đóng gói chế
độ JSON cần override environment và mount tất cả secret tương ứng; packaging,
app thứ hai thật và rollout thuộc WP-06/WP-08, chưa được thao tác tại đây.

## Capacity, fairness và lỗi riêng từng app

Mỗi app có một vòng polling, một batch tối đa 5 delivery, tối đa 5 provider call
đồng thời; không prefetch batch tiếp theo trong khi send/report batch hiện tại.
16 app tạo tối đa 16 vòng worker và 80 goroutine send đang xử lý delivery,
tối đa 80 provider call đồng thời. Claim/report tuần tự trong từng app, nên
tối đa 16 backend call đồng thời, không có hàng đợi trong bộ nhớ tăng vô hạn.
Các bound không tính goroutine nội bộ của HTTP transport.

Capacity được giữ riêng cho app, không có shared queue/semaphore để app backlog
chiếm hết slot của app khác. Nguồn timeout, credential sai hoặc pause của một
app không hủy worker khác. Lỗi retryable giữ backoff/Retry-After cũ; lỗi terminal
(ví dụ auth) dừng riêng worker đó, cần sửa cấu hình/source rồi restart để phục hồi.
Ngay cả khi mọi worker dừng terminal, runtime vẫn phục vụ health để operator
thấy `stopped`; không tự restart worker hoặc tuyên bố đã phục hồi.

Giới hạn 80 áp dụng cho delivery trong batch đang xử lý, không phải toàn bộ
lease tồn tại trong source. Report thất bại có thể để lease cũ chờ reclaim trong
khi worker tiếp tục polling. Durable queue, retry và attempt fencing thuộc app.

## Health, metrics và shutdown

Chỉ một listener health/metrics dùng chung port 8080, tránh xung đột cổng giữa
app. `GET /healthz` là liveness và trả `200 ok` khi HTTP server đang chạy.
Chế độ env cũ giữ `/readyz` dạng text, `200 paused` sau paused preflight và
metrics không có label để giữ tương thích.

Trong chế độ file, mọi app cấu hình đều bắt buộc. `GET /readyz` trả JSON
`{"ready":false,"apps":{"qltbyt":"ready","second-app":"paused"}}`; chỉ trả
200 khi mọi app `ready`, còn lại 503. `GET /readyz/<AppID>` trả text/status
riêng, AppID không cấu hình trả 404. Các trạng thái gồm `ready`, `not_ready`,
`paused`, `stale`, `stopped`; pause luôn trả 503 ở file mode. Thành công cũ quá
60 giây trở thành `stale`; poll thành công hiện chỉ chấp nhận interval 5 giây,
claim/report timeout 5 giây và provider timeout tối đa 10 giây.

Metrics file mode có label `app_id` chỉ lấy từ tập cấu hình đã kiểm tra, tối đa
16 giá trị; không lấy label từ delivery/subscription/tenant/endpoint. Mỗi TYPE
chỉ xuất hiện một lần. `web_push_deliveries_accepted_total` nghĩa là provider
đã accept, không chứng minh source đã nhận report hoặc browser hiển thị/đọc.

SIGINT/SIGTERM hủy polling, các backend/provider context và chờ worker kết thúc;
readiness bị hạ khi shutdown. Không report bằng background context sau khi đã
hủy. Nếu provider accept trước cancel nhưng report chưa hoàn tất, source có
thể reclaim sau lease và gửi lại; không hứa exactly-once. Report retry còn chạy
khi context sống vẫn giữ nguyên snapshot và kiểm tra lease như trước. Provider
hoặc report trả nil sau parent cancellation không được coi là thành công của
cycle; provider nil sau cancellation cũng không tăng accepted counter. Timeout
chờ worker shutdown được log bằng code hữu hạn và process thoát lỗi.
