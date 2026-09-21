# Phase 7A - Handoff chuẩn bị 7B

Ngày 2026-09-17. [Evidence khảo sát](phase-7A-evidence.md) gắn với subject
`bcfbce97ca671e7c5284ad14cb69a90b26fc0e17`. Chưa đủ điều kiện chạy 7B.

## Quyết định maintainer sau khảo sát

- Dùng `qltbyt_test` làm nguồn clone sang DB riêng cho 7B; maintainer đã chọn
  phương án clone, không dùng trực tiếp restored baseline. Được tạo clone riêng
  có tên không trùng; chưa có evidence tạo thành công ở thời điểm ghi quyết định.
- Scope tài khoản test: `ntchi2` và `admin`, đơn vị `17`. Cần kiểm tra role và
  eligibility thực tế; tên tài khoản `admin` không tự chứng minh role.
- Maintainer chọn iPhone Home Screen, URL `https://cvmems.vn`, và yêu cầu agent
  tạo một repair request test. Scope vẫn là DB clone, đơn vị `17`; agent tự
  chọn thiết bị phù hợp, đánh dấu request test, chưa xác nhận đã tạo.
- Read-only HEAD xác nhận `https://cvmems.vn` trả 307 tới
  `https://www.cvmems.vn/` (Vercel); runbook ZBS production dùng domain `www`.
  Chưa chứng minh app trên origin này nối DB clone. Cần kiểm tra origin thực tế,
  subscription iPhone và cấu hình worker test trước khi gửi; không đổi DB app
  production hoặc tạo request live từ chỉ đạo test trên clone.
- Quyền clone không bao gồm sửa baseline, deploy app/worker, tạo secrets,
  bật controls hoặc gửi provider. Dữ liệu subscription sao chép không được coi
  là danh sách thiết bị đã đồng ý nhận test.

## Bước tiếp theo giao Luna-max

> Cập nhật scope sau khảo sát: maintainer đã chuyển sang live canary đơn vị `18`,
> recipient `ntchi1` và `admin`, iPhone Home Screen đăng nhập `ntchi1` tại
> `https://www.cvmems.vn`. Clone được giữ lại, chưa dùng để tạo request. Kế hoạch
> staging bên dưới là handoff lịch sử, không còn là bước triển khai đang được chọn.
> Maintainer đã duyệt chuẩn bị VAPID/HMAC, worker Oracle paused và cấu hình app/live
> registration cho canary; enqueue/dispatch giữ tắt trong lúc chuẩn bị. Một request
> test thuộc đơn vị `18` chỉ tạo sau readiness. Không lưu thông tin đăng nhập vào docs.

1. Tra cứu runbook Oracle, metadata triển khai và cấu hình hiện có bằng thao tác
   read-only để xác định staging URL/HTTPS/auth, host worker và DB cách ly cụ thể.
   Có thể kiểm tra SSH tới host đã được tài liệu hóa; không biến production hoặc
   restored baseline thành staging. Chỉ báo existence/permissions của secrets.
2. Đối chiếu image identity, network/health, public VAPID artifact và sự hiện diện
   của cấu hình HMAC; không gọi claim/report hoặc API có mutation để thử readiness.
3. Xác định tenant/account test, owner vận hành và scope thiết bị đồng ý nhận.
   Nếu không tìm thấy trong nguồn hiện có, ghi rõ thông tin cần maintainer cung cấp.
4. Với từng mục còn thiếu, đưa ra thao tác chuẩn bị cụ thể, môi trường đích,
   quyền cần thiết, tiêu chí read-back và cleanup. Chưa thực hiện provisioning,
   deploy, tạo secrets, ghi DB hoặc gửi provider khi chưa được duyệt đúng scope.

## Điều kiện chuyển 7B

- Xác định được app staging HTTPS/auth và DB test cách ly có schema/RPC tương thích.
- Có worker/image được xác định bất biến, cấu hình staging tương thích, health/network
  được kiểm chứng; không suy ra remote readiness từ local `200 paused`.
- Có tenant/account/device scope đã đồng ý, controls và kế hoạch cleanup rõ ràng.
- Có quyền cụ thể cho deploy/fixture/control mutation và provider test cần cho 7B.

DB gates đã được bypass không được đưa lại thành blocker; giữ nguyên lịch sử.
Không mở lại browser acceptance 7.3. Không tick 7.1/7.2/7.4/7.5 hoặc Phase 8 chỉ
vì inventory đầy đủ. Báo cáo PASS/BLOCKED/UNKNOWN theo bằng chứng thực tế, không
khẳng định môi trường chưa tồn tại chỉ vì chưa tìm được cấu hình.

## Handoff sau sửa HMAC production ngày 2026-09-18

- Root cause HTTP 401: secret worker là cùng 32 bytes nhưng đang ở base64url
  không padding; Go worker chấp nhận dạng này, trong khi Node backend chỉ chấp
  nhận base64 chuẩn có padding theo `signWebPushRequest`.
- Đã canonicalize cùng bytes thành giá trị base64 chuẩn 44 ký tự và cập nhật
  `WEB_PUSH_HMAC_CURRENT_SECRET` production. Không rotate key, không sửa runtime,
  không đổi `WEB_PUSH_HMAC_CURRENT_KEY_ID`.
- Deployment exact source đã READY: `dpl_5eFKaKiQyvhjY6qswBXb9HkHwxQ9`, SHA
  `c1d36f629b4c67004f1b3854e0ab3c6029309dcd`, alias production gồm
  `www.cvmems.vn` và `cvmems.vn`.
- Verification bounded: signed claim hợp lệ trả `503 disabled` với retry `60`;
  signature bị sửa trả `401 unauthorized`. Vì `dispatch_enabled=false`, probe
  không claim, không consume nonce, không gửi provider.
- Main phải giữ read-back `registration=true`, `enqueue=false`,
  `dispatch=false`, request `532` pending và deliveries `0`; không reset deadline,
  không enable controls, không tạo request mới. Worker Oracle vẫn paused; việc
  kiểm tra health/ready là read-only độc lập.
- Đây là auth/kill-switch contract PASS cho canary, không phải provider hoặc
  browser E2E PASS. Không tick Phase 7A/7B/Phase 8 hoàn tất từ kết quả này.

Safe check duy nhất cần lặp lại: dùng bounded signed-claim probe đọc secret local
không in nội dung, canonicalize base64 trước khi HMAC, rồi chỉ báo status/code/
retry-after/byte-length. Valid phải là `503/disabled/60`; invalid phải là
`401/unauthorized`; giữ enqueue/dispatch tắt trong toàn bộ lượt kiểm tra.

## Handoff sau retry live canary ngày 2026-09-18

- Retry bounded của đúng request `532` đã terminal: delivery
  `2bcb13db-2d3d-4489-9bdd-5cc30228f30a`, attempt `1`, `credential_error`,
  provider HTTP `403`; Apple Web Push, hostname `web.push.apple.com`. Không có
  detailed/sanitized provider reason và không có acceptance; chưa có bằng chứng
  iPhone hiển thị.
- Controls sau cleanup là `registration=true`, `enqueue=false`,
  `dispatch=false`; worker paused và readiness `200 paused` được verify độc lập
  (container PID `853374`, restart `0`). Không reset TTL/deadline, không tạo
  request mới và không xử lý backlog ngoài canary.
- Giữ Phase 7A/7B/browser E2E ở trạng thái chưa PASS. Mọi chẩn đoán nguyên nhân
  VAPID JWT/key/audience/expiry hoặc retry tương lai cần maintainer authorize
  riêng.

## Handoff sau acceptance và receipt của canary ngày 2026-09-18

- Request `535` đã được nhận bởi provider: delivery
  `901f08da-a1d1-41cd-b7c4-e4ac77627049`, attempt `1`, outcome `accepted`, HTTP
  `201`, terminal lúc `2026-09-18T11:55:50.050526Z`. Maintainer báo iPhone đã
  nhận notification; đây là maintainer-reported receipt, không phải browser E2E
  độc lập.
- Không dùng khoảng từ lúc tạo request `07:39:38Z` đến acceptance để claim
  ngưỡng `60 seconds`, vì canary chờ worker/dispatch pause và thao tác đăng nhập
  lại thủ công. Không tick toàn bộ Phase 7A/7B/Phase 8.
- Cleanup đã hoàn tất: `registration=true`, `enqueue=false`, `dispatch=false`,
  canary arrays `[18]`; worker fixed image paused và readiness `200 paused`.

## Handoff kiểm tra local VAPID subject ngày 2026-09-18

- RED xác nhận `mailto:` bị double-prefix trong VAPID `sub`; fix local dùng
  `strings.TrimPrefix` trước khi gọi `webpush-go`.
- GREEN table-driven bao phủ `mailto:`, `https:` preservation và raw email;
  full Go checks (`test`, `race`, `vet`, `build`, `gofmt`, `golangci-lint`) PASS.
- Source chưa deploy; chưa gọi hoặc retry provider. Giữ nguyên boundary
  readiness/7B/browser E2E chưa PASS và cần user-facing authorization trước
  mọi deploy/send.

## Handoff artifact VAPID subject fix paused ngày 2026-09-18

- Build artifact `linux/arm64` xuất phát từ commit
  `bcfbce97ca671e7c5284ad14cb69a90b26fc0e17`, reviewed diff SHA
  `b33fd1af9b82eff74ca3376b202cee4f88c49617c324e79728aa7efa21967b06`;
  local image `sha256:0066a20585f2208af148613a5bd10dee1044a8513af852e0e6befb6b4d72f61f`,
  remote Oracle image `sha256:fd50044094241dae43320b379418715121c8aa89d17745f6a3d075a555efc4d5`.
  Dockerfile tạm đã được xoá sau khi build; không coi source tree là clean commit.
- Oracle canary đã pin `WEB_PUSH_IMAGE` theo remote digest và recreate paused
  thành công: container ID `6c929470eda87c03e803bce8af750e8613fbd2a292e6293d32b8e38bc46be053`,
  `restart_count=0`, `/healthz 200 ok`, `/readyz 200 paused`, không published
  port. VAPID/HMAC metadata được kiểm tra presence mà không lộ giá trị.
- Giữ nguyên boundary 7A: không DB write, không tạo request/enqueue/claim/dispatch,
  không provider call; chưa có browser E2E hoặc provider acceptance. Không enable
  dispatch/ping user từ handoff này.

## Handoff authoritative sau closeout canary ngày 2026-09-18

- Request `535` là canary thành công: delivery
  `901f08da-a1d1-41cd-b7c4-e4ac77627049`, attempt `1`, outcome `accepted`, HTTP
  `201`, terminal `2026-09-18T11:55:50.050526Z`. Maintainer xác nhận iPhone
  hiển thị notification; đây là receipt do maintainer báo lại, không phải browser
  E2E độc lập. Không claim SLA `60 seconds` vì request tạo lúc `07:39:38Z` và
  acceptance xảy ra sau pause/login thủ công.
- Final read-back: `registration=true`, `enqueue=false`, `dispatch=false`,
  canary arrays `[18]`; worker fixed image paused và readiness `200 paused`.
  Request `532` `credential_error`/HTTP `403` được giữ là historical result.
- Provider fix và regression đã được verify bằng `go test ./...`,
  `go test -race ./...`, `go vet ./...` và `go build ./...`.
- UX follow-up [Issue #1002](https://github.com/thienchi2109/qltbyt-nam-phong/issues/1002)
  bao phủ numeric app icon badge và lockscreen/banner reproduction. Phạm vi
  phải tách `NotificationOptions.badge` là image khỏi numeric Badging API, có
  feature detection, accessibility fallback, clear/reconcile ownership và
  evidence theo iOS version/settings; không hứa native banner/lockscreen.
- Không đánh dấu toàn bộ Phase 7A/7B/Phase 8 hoàn tất; session expiry/revoke và
  ZBS independence còn ở các boundary điều tra riêng.

## Handoff authoritative sau activation all-tenant ngày 2026-09-19

### Current state

- Runtime live hiện là `registration=true`, `enqueue=true`, `dispatch=true`.
  Cả `registration_canary_don_vi_ids` và `dispatch_canary_don_vi_ids` cùng là
  snapshot `28` active units, SHA-256
  `6f1622f49d7399a2d08b7facbb43612db111819d94ad8c7d26d756d426e36949`.
- Worker hiện là container `web-push-live-canary-web-push-1`, worker ID
  `oracle-web-push-live-canary-20260917`, image digest
  `sha256:fd50044094241dae43320b379418715121c8aa89d17745f6a3d075a555efc4d5`,
  `WEB_PUSH_PAUSED=false`, restart `0`, `/healthz=200 ok`, `/readyz=200 ready`.
  Inventory chỉ chứng minh host Oracle đã thấy một worker; không claim global
  worker exclusivity.
- Final live read-back lúc `2026-09-19T05:27:01Z` có backlog mở bằng `0`; không
  có test request, test push, recipient mutation, image build/pull hoặc provider
  acceptance mới. Terminal `credential_error` cũ giữ nguyên để monitor.
- Earlier sections mô tả trạng thái canary paused `[18]`; đó là historical
  pre-activation state. Operator kế tiếp phải dùng section này làm current
  authoritative state, không tự pause hoặc restore `[18]` nếu không có rollback.

### Rollback đã được approve

Nếu có operational error, pause worker trước bằng env file hiện hữu và recreate
cùng image digest; sau đó guarded-update singleton controls về:

```text
registration_canary_don_vi_ids = [18]
dispatch_canary_don_vi_ids     = [18]
registration_enabled           = true
enqueue_enabled                = false
dispatch_enabled               = false
```

Read-back controls và health sau rollback. Không xoá history, không chạy
retention/cleanup và không reset deadline. Rollout approval này không phải blanket
authorization cho các live write khác; mỗi migration, recipient change, worker
config change hoặc provider test mới cần operation-specific permission.

### Next boundary

- Quan sát read-only các real events tương lai trong một cửa sổ ngắn; không tạo
  test request hoặc explicit test push chỉ để lấy evidence. `accepted=0` vẫn là
  kết quả hợp lệ khi chưa có event thật.
- Không tick `7.1`, `7.2`, `7.4`, `7.5`, `8` hoặc claim full Phase 7A/7B từ
  rollout này. Session lifecycle evidence và ZBS independence giữ boundary
  riêng; fault checks rộng hơn vẫn deferred.
- Snapshot 28 không auto-include future units. [Issue #1003](https://github.com/thienchi2109/qltbyt-nam-phong/issues/1003)
  giữ phần design/implementation đó cho approval riêng; không thêm UI/dashboard
  hoặc MCP auto-all trong rollout này.

## Handoff authoritative sau timing test 7.1 ngày 2026-09-19

- Request mock duy nhất `536` của equipment `8392` đã đi qua create → intent →
  worker/provider tự nhiên: created `08:00:33.476415Z`, materialized
  `08:00:36.341476Z`, terminal `08:00:37.504832Z`, `accepted`/HTTP `201`,
  attempt `1`, `failed_count=0`. Request-to-terminal `4.028417s` là upper bound
  theo completion timestamp; không có network-accept timestamp riêng.
- Deadline persisted là `2026-09-20T08:00:33.476415Z`, đúng `+86400s`. Chưa có
  wire-TTL, near-expiry, retry hoặc max-24-hour evidence; lease fields đã clear
  sau terminal nên không claim claim/send timestamp. Maintainer đã báo iPhone
  nhận notification thành công.
- Current live state sau read-back vẫn là `registration=true`, `enqueue=true`,
  `dispatch=true`, allowlists `28`, worker ready; backlog mở và retry/expired
  state đều `0`. Không pause worker và không quay lại historical `[18]` state.
- Các hướng dẫn pre-test ở `Next boundary` bên trên (`accepted=0`/không tick
  7.1) là historical; section này supersede riêng cho 7.1 và không thay đổi
  boundary chưa hoàn tất của 7.2, 7.4, 7.5 hoặc Phase 8.
- Đây là maintainer-accepted completion của 7.1 trên sample được authorize,
  không phải blanket PASS cho 7.2/7.4/7.5/Phase 8. Request `536` giữ nguyên như
  historical normal repair record; không cleanup/delete/reset hay tạo request khác.

## Handoff Issue #1003 - auto-allowlist đơn vị mới (Task 4, 2026-09-21)

Phần này bổ sung runbook cho migration #1003; các section rollout 28 đơn vị ở
trên vẫn là lịch sử và không bị rewrite.

- Luồng application RPC `don_vi_create` append ID đơn vị mới đúng một lần vào
  cả `registration_canary_don_vi_ids` và `dispatch_canary_don_vi_ids` trong cùng
  transaction. Các ID/flag hiện có được giữ nguyên; không backfill 28 active ID lịch sử,
  không đổi policy active/reactivate, không thêm mode/UI/trigger/job hay active
  rule mới.
- Canary vì vậy tăng theo các lần tạo đơn vị được hỗ trợ. Append allowlist không
  tự bật `registration_enabled`, `enqueue_enabled` hoặc `dispatch_enabled` và
  không tạo recipient/subscription/delivery. Recipient vẫn cần config đúng đơn
  vị, browser opt-in và authorization hiện hành; pending intent hiện có vẫn có
  thể resume trước deadline nếu ID được include lại.
- Nếu operator gỡ ID khỏi allowlist, các lần tạo/cập nhật đơn vị khác không tự
  thêm lại ID đó. Emergency off dùng các kill switch hiện hữu
  (`registration_enabled`, `enqueue_enabled`, `dispatch_enabled`); pause theo
  switch giữ nguyên deadline/state và không hứa thu hồi notification đã
  in-flight.

### Evidence tracked cho Task 4

- Implementation subject trước commit tài liệu: `680abc47ab35abdc5f14f1f552e170454b54d1f2`.
  Migration 97 dòng, SHA-256
  `d6c8b78df44dad8a189a43da91713cdd5f3c1e090b0b1322504a213904aae86e`; SQL test
  444 dòng, SHA-256
  `b98ed00a23e196c9bb12122ac27cbb8d144de4d1d1b6c1e42d3543f68aa862fe`.
- RED disposable run `/tmp/issue1003-red-888ec1d9-r6.stdout.log`: lock,
  preflight và clone thành công; test fail đúng `P0004`,
  `failureSignature=b7554f7fa940864414f7e42ceeb1f49cf6b152416892ea333898bc482f600747`,
  `stderrSha256=b14073b409e91caeb9ee0e2119e52dc5f98b289a46b113d21889227ccca7593c`;
  drop/unlock thành công.
- GREEN disposable run `/tmp/issue1003-green-888ec1d9-r6.stdout.log`: lock,
  preflight, clone, apply, test, drop và unlock đều thành công. Đây là focused
  disposable evidence, không phải formal Oracle baseline-forward PASS.
- Local static report `/tmp/issue1003-static-888ec1d9-r2.json` có run
  `issue1003-static-888ec1d9-r2`, subject
  `888ec1d941932ac7a48d532621e79c363b54f6a1`, digest
  `5629a563f6d67e07643e18719726e636fb8e89a12c61591961333d97055e0fbd`, outcome
  `FAILED`. Finding mới gồm `dangerous-statement` cho GRANT EXECUTE hiện hữu,
  `jwt-guards` kế thừa contract role-only và `security-definer-search-path` do
  parser chỉ nhận `public,pg_temp`; SQL dùng prefix `pg_catalog` tường minh ở
  phần cần thiết. Đây là giới hạn cần review logic, không sửa SQL để hợp parser,
  không thêm waiver và không hạ gate.
- Formal static và Oracle baseline-forward của exact documentation commit đều
  `NOT RUN at document commit`. Các report exact HEAD về sau phải nằm ngoài
  repository và ngoài handoff này trong external quality-gate storage; section
  này không tự chứng nhận hai lane PASS và không ghi SHA của chính commit tài liệu.

### Boundary vận hành

Không có live apply, recipient mutation, worker deploy hoặc provider test trong
Task 4. Issue #1003 chưa được đánh dấu deployed; việc áp dụng migration vẫn cần
quyền operation-specific qua Supabase MCP theo runbook hiện hành.
