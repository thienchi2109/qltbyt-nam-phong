# Web Push — Oracle rollout 2026-10-29

**PASS trong phạm vi nâng cấp runtime QLTBYT hiện có.** Người dùng đã cho phép
push/deploy Oracle và merge WP-08 vào main. Chỉ service `web-push` thuộc project
`web-push-live-canary` được thay; không deploy app thứ hai hoặc đổi wire/browser.

## Artifact và cutover

- Source commit đã push: `e56a89d7c18b23b3b861478abed4ad070e499c6d`.
- Oracle `149.118.148.179`, Linux ARM64. Build native trên Oracle; 41 file
  source/config đối chiếu SHA-256 khớp commit trước build.
- Image bất biến trong daemon Oracle:
  `sha256:19a2e099ffd1c891ea8f07f551bd0c3865d3b72fa23fe7b831c14ae1511e4277`.
  OCI revision khớp source; UID/GID `65532:65532`, scratch, SIGTERM.
  Build/tag local, không publish image lên registry.
- Container `web-push-live-canary-web-push-1`, ID `df871537a989`;
  started `2026-10-29T11:54:49.697737888Z`, ready `11:54:50.836466Z`.
- Giữ env mode một app, AppID ổn định `qltbyt`; origin/worker ID/HMAC/VAPID/
  paused=false giữ nguyên. Compose chuyển bridge sang Linux host networking;
  chỉ listener health `127.0.0.1:8080`, không public port.

Preflight image ARM64 paused trả `200 paused` và dừng exit 0; consumer cũ vẫn
phục vụ trong lúc build/preflight. Đã kiểm tra public VAPID tại QLTBYT khớp
env trước và sau cutover, private file không đổi. Backup Compose/env root-only
trước stop. Consumer cũ dừng sạch exit 0 trong 0.229s. Sau stop, Supabase MCP
read-only xác nhận **0 active lease, 0 delivery đến hạn** lúc `11:54:09.626059Z`;
không reset queue/token/attempt/deadline hoặc đổi runtime controls.

Chỉ chạy Compose `stop web-push` và
`up --detach --force-recreate --no-deps --no-build --pull never web-push`
với project hiện hữu; image trong env được pin bằng ID nêu trên.

## Hậu kiểm

- 12 cặp probe health/ready đều HTTP 200, trong hai đợt lấy mẫu cách 5s;
  cửa sổ tổng `11:56:24.201545Z`–`11:58:59.750896Z` (có khoảng cách giữa đợt).
  Không mô tả đây là lấy mẫu liên tục. Container restart count 0.
- Audit cuối `12:00:01.972855Z`: listener loopback-only, credential/key không
  đổi, public VAPID vẫn khớp; không thấy stable error code trong log đã kiểm tra.
- **22 container khác không đổi ID/image/StartedAt/RestartCount/running state**
  so snapshot ngay trước stop; mọi image của chúng và image rollback vẫn còn.
  Không prune, xóa image khác, down cả stack hay restart service khác.
- SQL read-only trước/sau: subscription 8, delivery accepted 3, active lease 0,
  due delivery 0; intents completed 3/cancelled 7/expired 14. Enqueue,
  registration, dispatch vẫn enabled, hai allowlist vẫn 28 đơn vị.
- Metrics process mới đều 0 vì không có delivery đến hạn; **không** coi đó là
  bằng chứng provider/browser đã nhận push sau deploy. Không tạo job hay gửi
  notification test tới người dùng, không ghi DB trực tiếp.

## Rollback và giới hạn

Giữ image cũ `sha256:fd50044094241dae43320b379418715121c8aa89d17745f6a3d075a555efc4d5`.
Bundle trên Oracle: `/opt/web-push-live-canary/rollback/wp08-e56a89d7c18b/`;
Compose/env và manifest có thông tin nhạy cảm được bảo vệ root-only, không vào
Git. `deployment-summary.json` và `observation.json` lưu evidence tại đó.

Nếu cần rollback: stop riêng consumer mới, kiểm tra lease tại nguồn qua MCP,
đợi drain/expiry, khôi phục Compose/env từ bundle và pin đúng image cũ;
recreate riêng service cùng project, không pull hoặc xóa image. Compose cũ
dùng bridge: probe health trong network namespace của container, không giả định
host 8080 còn reachable. Giữ nguyên file key, store, consent và outbox.

Rollback live chưa được kích hoạt vì hậu kiểm PASS. Rehearsal rollback local
đã có ở WP-08; không suy diễn nó thành live rollback/device proof. Browser/device,
provider acceptance mới và deployment nhiều app thực vẫn chưa kiểm chứng.
Các commit sau source trên chỉ ghi tài liệu; không relabel image thành build
từ commit evidence mới.
