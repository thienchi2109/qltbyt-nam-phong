# Runbook Web Push cho Oracle

Tài liệu này mô tả quy trình tương lai cho notification service trên Oracle. Không chạy các lệnh trong tài liệu này trong Phase 6.4; chưa có provisioning, live write, provider thật hoặc production deploy.

## Nguyên tắc triển khai

- Build từ `services/web-push/Dockerfile`, gắn tag `qltbyt-web-push:<git-sha>` rồi publish và deploy bằng image digest. Không đưa key, `.env` hoặc file secret vào build context; `.dockerignore` đã loại các dạng file đó.
- Container chạy binary `/usr/local/bin/web-push` bằng UID/GID `65532`, filesystem chỉ đọc, không publish port ra host. Health server mặc định bind `127.0.0.1:8080`; chỉ dùng kênh loopback hoặc đường nội bộ được kiểm soát để probe.
- `WEB_PUSH_PAUSED` mặc định là `true`. Giá trị thiếu hoặc không phải boolean rõ ràng làm service dừng fail-closed; khi paused worker không claim và không dispatch.

## Provision và restart

1. Tạo một cặp P-256 theo từng môi trường bằng kho secret vận hành. Lưu private key bền vững bên ngoài image, Git, biến môi trường, QLTBYT và Supabase; backup phải có quyền truy cập được kiểm soát.
2. Mount private key read-only tại `/run/secrets/web_push_vapid_private_key`, owner đọc được bởi UID/GID `65532`, mode tối đa `0400` (hoặc quyền tương đương không cho container ghi).
3. Cấu hình public artifact gồm `WEB_PUSH_VAPID_KEY_VERSION`, `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_FINGERPRINT` và `WEB_PUSH_VAPID_SUBJECT`. Go derive public key/fingerprint từ file private và so khớp artifact trước readiness và trước mỗi claim.
4. Restart chỉ đọc lại file secret đã provision. Service không có nhánh tạo hoặc regenerate key. Thiếu file, key hỏng hoặc artifact lệch phải giữ readiness fail và không claim/send.

`/readyz` chỉ chứng minh process đã nạp được private key và artifact cấu hình khớp. Đây không phải bằng chứng QLTBYT runtime controls, subscription catalog, registration hoặc provider từ xa đã khớp. Trước khi bật production, operator phải thực hiện riêng các kiểm tra read-only của hệ thống sở hữu public artifact và ghi nhận version/fingerprint; không dùng một HTTP 200 local để tuyên bố remote compatibility.

## Controlled rotation

Thực hiện tuần tự, với cả registration và dispatch đều tắt:

1. Pause registration và dispatch tại control plane; giữ pending intent/delivery và deadline nguyên trạng.
2. Chờ các lease đang chạy tối đa 45 giây. Không kéo dài lease và không reset deadline.
3. Backup cặp key cũ cùng version/fingerprint, kiểm tra khả năng khôi phục trước khi thay đổi.
4. Provision cặp mới và public artifact tương ứng, đồng bộ version, public key, fingerprint và subject. Cập nhật secret mount bên ngoài container rồi restart/reload theo cơ chế được duyệt.
5. Đánh dấu subscription dùng version cũ cần resubscribe. Không gửi subscription cũ bằng key mới; user phải explicit unsubscribe/resubscribe để tạo revision mang version mới.
6. Kiểm tra `/readyz` và artifact local khớp, sau đó kiểm tra riêng public artifact từ QLTBYT bằng kênh read-only được duyệt. Chỉ khi hai kiểm tra này khớp mới bật registration, rồi bật dispatch.
7. Giữ cặp key cũ tối thiểu 7 ngày trong kho backup để rollback. Không xóa pending data hoặc làm lại mốc deadline trong thời gian này.

## Rollback

1. Pause registration và dispatch, chờ tối đa 45 giây cho lease cũ kết thúc.
2. Chọn đúng một version tương thích đã được xác minh; khôi phục private key và public artifact cùng cặp, không trộn private của version này với public của version khác.
3. Xác minh readiness local và kiểm tra read-only remote compatibility, sau đó bật registration và dispatch theo đúng thứ tự. Subscription đã tạo theo version mới vẫn cần resubscribe theo policy tương thích; không tự gửi bằng cặp không khớp.
4. Giữ nguyên pending deadline và lịch retry backend. Ghi lại version được chọn, thời điểm pause/resume và lý do rollback.

## Quan sát và xử lý sự cố

- Metrics chỉ có counter low-cardinality cho `accepted`, `failed`, `retried`, `cancelled`, `expired` và latency quan sát được. `accepted` là provider acceptance, không phải delivered hoặc read; backlog thuộc backend và không được worker tự bịa.
- Log chỉ dùng mã lỗi ổn định. Không ghi endpoint subscription, payload, p256dh/auth, private/public key, fingerprint đầy đủ, HMAC hoặc số điện thoại.
- Nếu readiness không khớp hoặc control plane trả disabled, giữ paused, không claim/send. Không sửa key trực tiếp trong container và không dump environment để chẩn đoán.
