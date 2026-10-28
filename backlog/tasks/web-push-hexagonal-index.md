# Web Push dùng chung — Hexagonal Backlog

- Status: In Progress — WP-01 Done; WP-02–WP-08 To Do
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Survey baseline: `af8002880066d04a47b3de8db4d1d3310d65d6a1`

## Mục tiêu và ranh giới

Tái sử dụng service Web Push cho nhiều app bằng Ports & Adapters, chuyển đổi
từng phần và giữ tương thích với QLTBYT. Chỉ Web Push, không gồm ZBS/Zalo.
Đợt này tạo backlog; chưa triển khai code, migration hay thao tác live.

Tham chiếu người dùng cung cấp: `/root/docs/hexagonal-architect.md` trên VPS.
Đây là hướng dẫn đánh giá kiến trúc cho LabOps; áp dụng các nguyên tắc tái sử
dụng thiết kế tốt, pilot nhỏ, Strangler Fig, Go idioms và tránh abstraction
không cần thiết cho Web Push. Không mở rộng phạm vi sang LabOps. WP-01 phải
ghi lại kết luận áp dụng trong tài liệu versioned để người tiếp quản không
phụ thuộc vào file ngoài repo.

WP-01 đã review: [Assessment, boundary, contract và pilot](../../docs/architecture/web-push-hexagonal-assessment.md),
source baseline `9f2b9c4c`; WP-01 hoàn tất, chưa triển khai WP-02.

## Quyết định định hướng

- Giữ ngôn ngữ Go cho service dùng chung, gồm delivery core, adapter phía
  service, runtime và entrypoint; tái sử dụng module `services/web-push`.
  Tích hợp phía app QLTBYT tiếp tục dùng stack Next.js/TypeScript hiện tại.
- Bắt đầu từ `Backend` và `Sender` sẵn có trong `services/web-push/types.go`;
  không mặc định viết lại worker hay đổi toàn bộ cấu trúc thư mục.
- Giữ outbox nguyên tử, chọn người nhận và kiểm tra quyền tại từng app.
  QLTBYT tiếp tục sở hữu nghiệp vụ sửa chữa và tenant `don_vi`.
- Service hiện kéo `claim/report` từ một origin; API publish và kho dữ liệu
  trung tâm là phạm vi mở rộng cần thiết kế riêng khi có nhu cầu đã xác minh.
- Trong runtime chung, credential/config đã xác thực xác định app; request
  không được tự chọn app ngoài phạm vi được cấp. `don_vi_id` không là `app_id`.
- Giữ VAPID và dữ liệu subscription QLTBYT trong lộ trình mặc định; nếu phải
  chuyển kho, cần đối chiếu dữ liệu/đăng ký lại trước khi cutover.

## Danh sách task

| ID                                                 | Task                                 | Depends on   | Kết quả                                               |
| -------------------------------------------------- | ------------------------------------ | ------------ | ----------------------------------------------------- |
| [WP-01](WP-01-architecture-contract-and-pilot.md)  | Chốt boundary, contract và pilot     | None         | Assessment và contract đủ để triển khai từng phần     |
| [WP-02](WP-02-delivery-core-pilot.md)              | Pilot tách delivery core             | WP-01        | Core dùng port hiện có, giữ hành vi một app           |
| [WP-03](WP-03-qltbyt-backend-adapter.md)           | Adapter QLTBYT                       | WP-02        | Adapter claim/report giữ contract và quyền hiện tại   |
| [WP-04](WP-04-app-identity-and-configuration.md)   | Định danh và cấu hình theo app       | WP-02        | App context tin cậy, credential và VAPID tách biệt    |
| [WP-05](WP-05-multi-app-runtime.md)                | Runtime nhiều app                    | WP-03, WP-04 | Điều phối, giới hạn tải và cô lập lỗi theo app        |
| [WP-06](WP-06-second-app-integration-proof.md)     | Chứng minh tích hợp app thứ hai      | WP-05        | Adapter/fixture độc lập chạy cùng QLTBYT              |
| [WP-07](WP-07-qltbyt-compatibility-and-cutover.md) | Kiểm chứng tương thích và chuyển đổi | WP-06        | Bằng chứng lifecycle, quyền và không mất subscription |
| [WP-08](WP-08-packaging-rollout-and-rollback.md)   | Đóng gói, runbook và rollout         | WP-07        | Artifact review được; rollout/rollback theo phê duyệt |

WP-03 và WP-04 có thể làm song song sau WP-02 nếu giao rõ ownership các file
dùng chung. Trước mỗi task, đối chiếu source hiện tại, cập nhật điểm chạm và
viết plan riêng trong đúng phạm vi; backlog này không thay thế plan chi tiết.

## Điều kiện hoàn tất milestone

- [ ] WP-01 đến WP-08 có evidence và trạng thái phản ánh đúng mức kiểm chứng.
- [ ] Hai app dùng chung core, không gửi/report/thu hồi chéo dữ liệu hoặc key.
- [ ] QLTBYT giữ nghiệp vụ, API và lifecycle đã chốt; rollback được kiểm chứng.
- [ ] Phân biệt PASS cục bộ, disposable, staging và live; chỉ đóng milestone
      khi đạt phạm vi nghiệm thu đã được chốt, không suy diễn từ test cục bộ.

## Quy tắc thực thi

Một agent chịu trách nhiệm chỉnh sửa chính cho mỗi slice; review độc lập
boundary và contract trước khi đóng task. Chỉ tạo port khi có ranh giới hoặc
test seam thực tế. Không thêm framework, broker hay database chỉ vì kiến trúc.

JS/TS thay đổi phải chạy các gate theo AGENTS.md. Nếu có SQL migration, dùng
migration mới và báo riêng static/baseline-forward trên cùng exact commit;
thiếu Oracle evidence là INCOMPLETE. Deploy, live DB write, thay VAPID hoặc
chuyển dữ liệu production cần phê duyệt riêng cho thao tác cụ thể.
