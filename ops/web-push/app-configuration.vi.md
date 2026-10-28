# Cấu hình app cho Web Push

WP-04 giữ executable một app/process và các biến `WEB_PUSH_*` hiện có.
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
cả tập rồi mới trả worker/health riêng cho mỗi app. Chưa có cấu hình list/JSON
cho executable; vòng chạy nhiều app, fairness và global capacity thuộc WP-05.
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
về backend đã claim; không có global lookup bằng local ID. Metrics/health hiện
giữ riêng từng worker và không thêm label từ request hoặc local ID. Log startup
chỉ ghi error code hữu hạn, không ghi raw config, secret, endpoint hay keys.
