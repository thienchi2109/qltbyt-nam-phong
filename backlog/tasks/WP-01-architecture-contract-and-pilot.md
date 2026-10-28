# WP-01 — Chốt boundary, contract và pilot Hexagonal cho Web Push

- Status: Done — assessment/contract đã được parent review; chưa triển khai WP-02
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: None
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi

Đối chiếu khảo sát với source hiện tại và nguyên tắc trong
`/root/docs/hexagonal-architect.md`. Ghi assessment/contract versioned về
dependency direction, port/adapter tái sử dụng, coupling thực tế, ownership
nghiệp vụ và pilot nhỏ giữ tương thích. Định hướng giữ queue/quyền tại app,
service dùng chung phần delivery; không mặc định tạo API/store trung tâm.

## Điểm chạm cần khảo sát

- `services/web-push/{types,worker,worker_helpers,client,provider,runtime}.go`
- `services/web-push/cmd/web-push/main.go`
- `src/lib/web-push/` và `src/app/api/web-push/`
- Các migration Web Push và `repair_request_create` đang có hiệu lực.

## Acceptance criteria

- [x] Kiến trúc giữ Go cho core, adapter phía service, runtime và entrypoint;
      tích hợp phía app giữ stack hiện tại. Ràng buộc này áp dụng WP-01–WP-08.
- [x] Assessment chỉ rõ coupling có bằng chứng file/symbol; giữ các thiết kế
      đã hợp lý, nhất là `Backend` và `Sender`.
- [x] Contract định nghĩa delivery, claim/lease/report, retry, revision,
      attempt token, payload, app context, VAPID selection và lỗi.
- [x] Phân định core không phụ thuộc NextAuth, schema QLTBYT hay HTTP DTO;
      app vẫn quyết định recipient và kiểm tra quyền trước khi giao.
- [x] Chọn pilot WP-02, ghi lợi ích, chi phí, test strategy và rollback;
      phân biệt phần giữ nguyên với thay đổi contract có chủ đích.
- [x] Chốt đường tích hợp app thứ hai và phạm vi runtime dùng chung; ghi rõ
      API publish/store trung tâm nằm ngoài scope hiện tại.
- [x] Tài liệu versioned chứa đủ nguyên tắc áp dụng từ reference ngoài repo;
      boundary và contract được review trước khi triển khai WP-02.

## Xác minh

Review tài liệu với luồng claim → send → report và register → revoke hiện có.
Task này chỉ khảo sát/tài liệu; không sửa runtime, SQL hoặc live.

## Artifact và evidence

- [Assessment, boundary, contract và pilot](../../docs/architecture/web-push-hexagonal-assessment.md)
  tại source baseline `9f2b9c4c7c84513ab765a80dc5e844f7a8d569ab`.
- AC 1/7: §1; AC 2: §2; AC 3: §4; AC 4: §3/4.3; AC 5: §5/7;
  AC 6: §4.4/6. Link file/symbol/dòng source nằm trong assessment.
- Parent đã đối chiếu source và review boundary/contract/pilot, kết hợp rà chéo
  của hai scout trước đó. Các điểm migration hiệu lực, clock snapshot, retry
  precedence và authorization từng stage đã sửa và kiểm tra lại.
  Không có runtime/SQL/deployment thay đổi; chưa triển khai WP-02.
- Validation cục bộ (2026-10-28): Prettier ba file Markdown —
  `All matched files use Prettier code style!`; whitespace — không có lỗi.
  Assert-based link/source-location check — 43 local links và 31 source line
  anchors hợp lệ; đúng baseline và đường dẫn/lệnh test. Kiểm tra anchor chỉ
  chứng minh vị trí tồn tại; parent đã review nội dung source độc lập.
- Không chạy Go/Vitest, DB gate hoặc browser/staging/live smoke trong WP-01;
  §7 liệt kê lệnh tái chạy cho pilot và compatibility, không phải kết quả đã chạy.
