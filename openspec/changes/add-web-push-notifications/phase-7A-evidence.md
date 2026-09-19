# Phase 7A - Evidence khảo sát readiness

Ngày 2026-09-17. Subject: `bcfbce97ca671e7c5284ad14cb69a90b26fc0e17` trên `main`.
Luna-max khảo sát read-only; main agent đối chiếu kết luận. Working tree sạch
trước/sau khảo sát, local ahead `origin/main` một commit; chưa push.

## Kết quả

| Hạng mục                   | Trạng thái              | Bằng chứng và giới hạn                                                                                                                                                                                                                                                      |
| -------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artifact local             | PASS cho identity local | Image `qltbyt-web-push:280bbead03d0`, ID `sha256:35fe490293289ad7d2f9c1882c0c08f81a013bfac78adb8873f2601b42717e91`, user `65532:65532`, entrypoint `/usr/local/bin/web-push`, `RepoDigests=[]`. Khớp evidence 6.5; không chứng minh publish/deploy hoặc provider readiness. |
| Staging app/HTTPS/auth     | UNKNOWN                 | Chưa xác minh được URL staging và tài khoản đăng nhập. Metadata Vercel/build-preview không chứng minh deployment staging hoạt động hoặc DB cách ly.                                                                                                                         |
| Worker staging             | UNKNOWN                 | Khảo sát local không thấy worker container đang chạy. Chưa kiểm chứng runtime từ xa hoặc đường chuyển image.                                                                                                                                                                |
| DB staging/disposable      | UNKNOWN                 | Chưa xác nhận database dành riêng cho Phase 7. `qltbyt_test` là restored baseline, không phải staging và không được dùng trực tiếp cho candidate/E2E.                                                                                                                       |
| VAPID/HMAC                 | UNKNOWN                 | Compose có contract biến cấu hình và private-key mount; chưa xác minh provisioning, public-artifact compatibility hoặc secret setup của staging. Không đọc/in secret.                                                                                                       |
| Tenant/account/device test | UNKNOWN                 | Chưa xác định fixture, owner và người đồng ý nhận provider test. UI/browser acceptance của maintainer không tự xác lập recipient scope cho lần gửi tiếp theo.                                                                                                               |

Main agent xác nhận `/root/Oracle/supabase-test.md` tồn tại, có hướng dẫn SSH và
baseline `qltbyt_test`; không có mô tả Web Push staging trong kiểm tra này.
Vì vậy không kết luận rằng không có Oracle host hay staging: chưa xác minh không
đồng nghĩa chưa tồn tại. Chưa kiểm chứng host qua SSH trong lượt khảo sát này.

## Kết luận và boundary

Chưa đủ bằng chứng readiness để chạy 7B; không ghi toàn bộ 7A là PASS.
Các kết quả trên là inventory, không phải lần chạy lại Go/browser/DB suites.
Không provision, sửa runtime, ghi DB, deploy, gửi provider hoặc truy cập nội dung secrets.

Giữ [waiver và acceptance của maintainer](reconciliation-handoff-2026-09-17.md):
DB Gate 2.4/3.4/4.5/4.5.6 được bypass cho việc tiếp tục chuẩn bị Phase 7,
không đổi kết quả lịch sử thành PASS; browser 7.3 đã được maintainer chấp thuận.
7.1/7.2/7.4/7.5 và Phase 8 vẫn mở. Xem [handoff 7A](phase-7A-handoff.md).

## Cập nhật sau authorization của maintainer

Luna-max báo cáo đã tạo clone riêng `dq_webpush_phase7b_20260917_a` bằng
`CREATE DATABASE dq_webpush_phase7b_20260917_a WITH TEMPLATE qltbyt_test OWNER postgres`.
Source không có session tại thời điểm clone; không sửa baseline. Read-back của
worker: PostgreSQL 17.6, clone khoảng 38,956,179 bytes, có bảng/RPC Web Push,
migration mới nhất `20260913094634_web_push_claim_recipient_eligibility_retry_20260913`.
Đây là evidence do worker báo cáo; main chưa chạy lại truy vấn remote độc lập.

DB clone đã tồn tại, thay cho trạng thái UNKNOWN trong inventory ban đầu.
Chưa tạo repair request, deploy, gửi provider hoặc chứng minh app/worker kết nối
clone. Maintainer chọn `ntchi2`/`admin`, đơn vị `17`, iPhone Home Screen tại
`cvmems.vn`; domain này redirect tới `www.cvmems.vn` đang được runbook production
sử dụng. Chưa đủ readiness để chạy luồng gửi thật.

## Cập nhật canary live sau readiness

- Oracle daemon image ID là `sha256:65face1895e2bbb8a2b42f47b24b07e28fe5704f28342ceea9d9c033f553f934`,
  container PID `1091186`, `restart_count=0`, `StartedAt=2026-09-17T10:49:12.500490794Z`.
  Image ARM64 được build từ commit `bcfbce97ca671e7c5284ad14cb69a90b26fc0e17` bằng
  Dockerfile tạm với điều chỉnh `GOARCH`; không sửa runtime trong repo và không
  kế thừa smoke AMD64 của Phase 6.5.
- Probe hiện tại trong đúng network namespace của worker trả `/healthz 200 ok` và
  `/readyz 200 paused`. Một probe sớm trả `ConnectionRefused`, nhưng kết quả đó
  không đủ xác lập worker failure; historical `vapid_unavailable` cũng không tái
  hiện trong fresh probe.
- Sau authorization của maintainer, guarded live mutation qua Supabase MCP chỉ
  bật `registration_enabled`; điều kiện trước update yêu cầu tenant array `{18}`,
  VAPID version `live-canary-20260917-v1`, và `enqueue_enabled=false`,
  `dispatch_enabled=false`. Read-back xác nhận đúng các giá trị này, VAPID
  fingerprint `sha256:05f3a9bf79afa252ee19620632cd18ab970e54814551a84ed30e4465fab1edc1`,
  và `subscriptions/intents/deliveries = 0/0/0`.
- `GET https://www.cvmems.vn/api/web-push/public-key` trả HTTP 200, `version=1`,
  `registration_enabled=true`, VAPID version/fingerprint khớp live DB và public
  key dài 87 ký tự.
- Vercel production deployment `dpl_6bt94r53gaKqswXyjmEyZizJ8mJz` từ source
  `c1d36f62` ở trạng thái READY, đã được main xác minh.
- Chưa tạo request, chưa enqueue/claim/dispatch, chưa gọi provider. Bước tiếp
  theo là người dùng đăng nhập `ntchi1` trên iPhone Home Screen tại
  `https://www.cvmems.vn` và opt in; giữ nguyên enqueue/dispatch tắt.

## Cập nhật HMAC production ngày 2026-09-18

- Nguyên nhân HTTP 401 đã được xác định ở biểu diễn secret: worker Go chấp nhận
  base64url không padding dài 43 ký tự và giải mã đúng 32 byte, còn verifier
  Node yêu cầu base64 chuẩn có padding và kiểm tra round-trip canonical trước khi
  tính chữ ký. Vì vậy hai phía có cùng bytes nhưng backend từ chối chữ ký trước
  khi tới nhánh `dispatch_enabled=false`.
- Đã giải mã secret hiện có rồi mã hóa lại cùng đúng 32 byte thành base64 chuẩn có
  padding dài 44 ký tự. Không rotate key, không in secret và không thay đổi
  `WEB_PUSH_HMAC_CURRENT_KEY_ID`.
- Đã cập nhật `WEB_PUSH_HMAC_CURRENT_SECRET` production trên Vercel và tạo
  deployment exact-source `dpl_5eFKaKiQyvhjY6qswBXb9HkHwxQ9` từ SHA
  `c1d36f629b4c67004f1b3854e0ab3c6029309dcd`. Deployment ở trạng thái READY và
  alias `www.cvmems.vn`/`cvmems.vn` đã trỏ vào deployment này.
- Signed claim probe với body hợp lệ và timestamp/nonce mới trả `HTTP 503`,
  `error=disabled`, `retry_after_seconds=60`; chữ ký bị sửa một byte vẫn trả
  `HTTP 401`, `error=unauthorized`. Đây là bằng chứng auth đã qua và route dừng
  đúng tại kill switch; không phải E2E dispatch/provider PASS.
- Giữ nguyên boundary canary: `registration_enabled=true`,
  `enqueue_enabled=false`, `dispatch_enabled=false`; request `532` vẫn pending,
  không reset deadline, deliveries/provider acceptance vẫn bằng `0`. Worker
  Oracle không bị mutate trong lượt sửa cấu hình này; Go worker vẫn giải mã được
  biểu diễn cũ và đang được main kiểm tra health/paused độc lập.

### Safe repeatable check

Chạy từ repo bằng `ctx_execute("javascript", ...)` một probe bounded tương đương
với lần trên: đọc secret local bằng `.trim()`, chuyển `-/_` sang `+/` rồi thêm
padding trước khi `Buffer.from(..., "base64")`, ký canonical
`web-push-v1/keyId/POST/path/timestamp/nonce/sha256(body)` bằng HMAC-SHA256, và
gửi đúng một claim với tenant controls vẫn tắt. Chỉ in HTTP status, error code,
retry-after và byte length; không in secret, signature, body hoặc response logs.
Kết quả mong đợi là valid `503/disabled/60`, invalid `401/unauthorized`.

Kết quả này chứng minh contract authentication/kill-switch; Phase 7A/7B và
provider/browser E2E vẫn chưa được tick PASS.

## Cập nhật retry canary live ngày 2026-09-18

- Sau authorization riêng của maintainer, chỉ retry request `532` của recipient
  `ntchi1`/đơn vị `18`; không tạo request mới, không reset TTL/deadline và không
  gửi provider retry thủ công. Pending intents/deliveries ngoài request này vẫn
  bằng `0`.
- Request `532` materialize lúc `2026-09-18T02:28:36.680506Z`; delivery
  `2bcb13db-2d3d-4489-9bdd-5cc30228f30a` kết thúc lúc
  `2026-09-18T02:28:37.939084Z`, attempt `1`, `failed`, outcome
  `credential_error`, provider HTTP `403`. Provider được phân loại là Apple Web
  Push, hostname `web.push.apple.com`; result lưu không có detailed/sanitized
  reason. Không có provider acceptance và kết quả này không chứng minh iPhone
  hiển thị.
- Cleanup đã read-back độc lập: `registration_enabled=true`,
  `enqueue_enabled=false`, `dispatch_enabled=false`; worker paused,
  `/readyz` `200 paused`, container PID `853374`, restart count `0`. Snapshot
  pending/deliveries `0` ở phần lịch sử phía trên được giữ nguyên, không bị
  overwrite bởi kết quả retry terminal này.
- Root cause của HTTP `403` chưa được xác định. Chẩn đoán VAPID JWT/key/
  audience/expiry hoặc retry tiếp theo phải được authorize riêng.

## Cập nhật canary thành công sau re-registration ngày 2026-09-18

- Sau khi maintainer đăng nhập lại trên iPhone, subscription mới được xác nhận
  active và chỉ request `535` được dispatch. Intent hoàn tất với
  `accepted_count=1`; delivery `901f08da-a1d1-41cd-b7c4-e4ac77627049`, attempt
  `1`, outcome `accepted`, provider HTTP `201`, terminal lúc
  `2026-09-18T11:55:50.050526Z`.
- Maintainer báo đã nhận notification trên iPhone. Đây là xác nhận vận hành của
  maintainer, không phải browser automation hoặc quan sát độc lập từ agent;
  provider acceptance cũng được ghi riêng khỏi bằng chứng hiển thị.
- Không claim SLA `60 seconds` từ lúc tạo request đến acceptance: request được
  tạo lúc `07:39:38Z` và chỉ được chạy lại sau thời gian worker/dispatch bị pause
  cùng thao tác đăng nhập lại thủ công.
- Cleanup sau acceptance đã read-back: `registration_enabled=true`,
  `enqueue_enabled=false`, `dispatch_enabled=false`, canary arrays `[18]`; worker
  fixed image paused, `/readyz` `200 paused`, restart count `0`. Không tick toàn
  bộ Phase 7/Phase 8 từ kết quả canary đơn lẻ.

## Cập nhật kiểm tra local VAPID subject ngày 2026-09-18

- Regression mới chạy RED trước fix: subject cấu hình
  `mailto:test@example.test` tạo VAPID `sub=mailto:mailto:test@example.test`.
- Fix tối thiểu local truyền `strings.TrimPrefix(s.Subject, "mailto:")` cho
  `webpush-go`; table-driven GREEN bao phủ `mailto:` canonical, `https:` giữ
  nguyên và raw email vẫn nhận đúng một prefix `mailto:`.
- Full Go checks local đều PASS: `gofmt`, focused test, `go test ./...`,
  `go test -race ./...`, `go vet ./...`, `go build ./...` và
  `golangci-lint run ./...` (`0 issues`); `git diff --check` cũng PASS.
- Đây chỉ là bằng chứng source/test local, chưa deploy code, chưa gọi provider
  và chưa retry provider. Không dùng kết quả này để tick readiness hoặc browser
  E2E PASS.

## Cập nhật deploy paused VAPID subject fix ngày 2026-09-18

- Artifact được build cho `linux/arm64` từ source commit
  `bcfbce97ca671e7c5284ad14cb69a90b26fc0e17`; SHA-256 của reviewed diff
  `provider.go`/`provider_test.go` là
  `b33fd1af9b82eff74ca3376b202cee4f88c49617c324e79728aa7efa21967b06`.
  Local image ID là `sha256:0066a20585f2208af148613a5bd10dee1044a8513af852e0e6befb6b4d72f61f`;
  image được build bằng Dockerfile tạm rồi file tạm đã được xoá. Không tuyên bố
  đây là clean-commit build: source tree còn reviewed diff và evidence untracked.
- Image đã được load trên Oracle với remote image ID
  `sha256:fd50044094241dae43320b379418715121c8aa89d17745f6a3d075a555efc4d5`,
  `linux/arm64`; `config/worker.env` được pin bằng digest này. Chỉ thay image pin
  và giữ `WEB_PUSH_PAUSED=true`; secrets và các biến cấu hình khác không bị in.
- Compose `web-push-live-canary` đã force-recreate service `web-push` trong
  `/opt/web-push-live-canary`. Container `6c929470eda87c03e803bce8af750e8613fbd2a292e6293d32b8e38bc46be053`
  chạy image ID mới, `restart_count=0`, PID `1979132`, không có host-published
  port. Probe trong đúng network namespace trả `/healthz 200 ok` và
  `/readyz 200 paused`.
- Runtime có các metadata env VAPID/HMAC cần thiết (`KEY_VERSION`, `PUBLIC_KEY`,
  `FINGERPRINT`, `SUBJECT`, `HMAC_KEY_ID`, `HMAC_SECRET` và private-key path),
  chỉ xác nhận presence/non-empty, không đọc hoặc ghi secret value. Không có DB
  write, request mới, enqueue/claim/dispatch hoặc provider call trong lượt này.

## Trạng thái authoritative sau closeout canary ngày 2026-09-18

- Canary live thành công được chốt ở request `535`: delivery
  `901f08da-a1d1-41cd-b7c4-e4ac77627049`, attempt `1`, outcome `accepted`, HTTP
  `201`, terminal lúc `2026-09-18T11:55:50.050526Z`. Maintainer xác nhận iPhone
  đã hiển thị notification; đây là user-reported receipt, không phải browser
  automation độc lập. Không dùng khoảng từ lúc tạo request `07:39:38Z` đến
  acceptance để claim SLA `60 seconds` vì có thời gian pause và thao tác đăng
  nhập lại thủ công.
- Cleanup cuối cùng đã được verify: `registration_enabled=true`,
  `enqueue_enabled=false`, `dispatch_enabled=false`, registration/dispatch
  canary arrays đều `[18]`; worker fixed image paused, `/readyz` `200 paused`,
  restart count `0`. Request `532` với HTTP `403` vẫn là historical failed
  canary; không overwrite bằng acceptance của request `535`.
- Provider subject normalization fix trong `services/web-push/provider.go` và
  regression của nó trong `services/web-push/provider_test.go` đã qua
  `go test ./...`, `go test -race ./...`, `go vet ./...` và `go build ./...`.
- Follow-up UX đã mở tại [Issue #1002](https://github.com/thienchi2109/qltbyt-nam-phong/issues/1002): khảo sát numeric app icon badge và lockscreen/banner UX trên
  iPhone. Issue tách `NotificationOptions.badge` (image resource) khỏi numeric
  Badging API, yêu cầu feature detection/clear/reconcile/accessibility fallback
  và evidence foreground/background/locked với iOS version/settings explicit.
  Không xem provider acceptance là guarantee native banner/lockscreen.
- Không tick toàn bộ Phase 7A/7B/Phase 8; các vấn đề session expiry/revoke và
  ZBS independence vẫn theo dõi ở boundary riêng.

## Evidence authoritative sau activation all-tenant ngày 2026-09-19

- Phạm vi đã được maintainer authorize một lần cho đúng snapshot `28` đơn vị
  đang active: mở cả registration/dispatch allowlist, bật enqueue/dispatch và
  unpause worker hiện hữu. Không tạo recipient, request kiểm thử, explicit test
  push, staging, image mới, build hoặc pull.
- Preflight Supabase MCP lúc `2026-09-19T05:21:15Z`: `28` active units, `0`
  inactive units; snapshot sắp xếp theo `public.don_vi.active` có SHA-256
  `6f1622f49d7399a2d08b7facbb43612db111819d94ad8c7d26d756d426e36949`.
  Hai allowlist cũ đều đúng `[18]`; intent/delivery backlog mở đều `0`.
- Guarded live write đã đặt `registration_canary_don_vi_ids` và
  `dispatch_canary_don_vi_ids` thành cùng snapshot `28` IDs; sau đó bật tuần tự
  `enqueue_enabled` rồi `dispatch_enabled`. Parent independent read-back lúc
  `2026-09-19T05:28:02.768758Z` xác nhận cả ba flags `TRUE`, hai arrays count
  `28`, cùng scope và khớp active-unit snapshot.
- Final read-back lúc `2026-09-19T05:27:01Z`: `registration_enabled=true`,
  `enqueue_enabled=true`, `dispatch_enabled=true`, VAPID ready; allowlists
  count `28`, equal và khớp snapshot. Backlog vẫn `0` open intents, `0` open
  deliveries, `0` pending-unmaterialized, `0` retry-due và `0` expired leases.
  Lịch sử terminal không đổi: `2 completed` intents, `1 accepted` delivery và
  `1 credential_error` delivery; không có event mới để claim provider acceptance.
- Inventory recipient toàn tenant: chỉ unit `18` có `1` ordinary config và `1`
  eligible recipient; `27` units còn lại không có config. Full subscription
  read-only inventory có `4` rows/`2` owned users: `2` active, `2` revoked,
  không orphan; cả `2` active rows khớp VAPID version và authorization epoch.
  Một active row thuộc configured/eligible user; một row ngoài recipient config
  nên không được enqueue/dispatch.
- Worker guard lúc `2026-09-19T05:24:48Z` chỉ thấy một Docker Web Push
  production container trên Oracle; đây là inventory giới hạn của host, không
  phải bằng chứng độc quyền toàn hệ thống. Worker ID là
  `oracle-web-push-live-canary-20260917`, image giữ nguyên
  `sha256:fd50044094241dae43320b379418715121c8aa89d17745f6a3d075a555efc4d5`,
  restart `0`, HMAC key ID presence được xác nhận mà không in secret.
- Chỉ thay `WEB_PUSH_PAUSED=true` thành `false` trong
  `/opt/web-push-live-canary/config/worker.env`; owner/mode không đổi. Compose
  recreate service `web-push` dùng `--pull never`, không build/pull. Sau đó
  `/healthz=200 ok`, `/readyz=200 ready`, `paused=false`, image không đổi,
  restart `0`; cửa sổ log ngắn không có error/claim/report. Không có provider
  acceptance mới vì không có event thực.
- Vercel production deployment vẫn `READY`, source SHA
  `a653bb2033f41964634213c48177683d79f66cba`, aliases `www.cvmems.vn` và
  `cvmems.vn`. SHA source ứng dụng và worker image digest là hai evidence
  riêng; không suy luận image được build từ commit Next này.

## Boundary sau activation

- Đây là rollout live đã được authorize, không phải bằng chứng browser E2E,
  SLA, native notification receipt hoặc toàn bộ Phase 7A/7B/Phase 8 hoàn tất.
  DB gate `FAILED/INCOMPLETE` vẫn là waiver đã được maintainer chấp thuận, không
  relabel thành `PASS`; browser E2E waiver cũng không thành `PASS`.
- Current snapshot không tự bao gồm unit mới trong tương lai. Auto-all/future
  unit design và implementation được deferred tại [Issue #1003](https://github.com/thienchi2109/qltbyt-nam-phong/issues/1003).
  Managers vẫn phải cấu hình recipient và user opt-in theo quy trình hiện hành;
  không đổi identity hoặc thêm recipient trong rollout này.
- Next step an toàn là quan sát read-only ngắn các event thật đầu tiên, chỉ
  aggregate status/deadline/outcome và health worker; không tạo test request,
  không provision staging và không chạy manual claim/report. Các kiểm tra fault
  rộng hơn và ZBS independence vẫn deferred, không coi là PASS.

## Evidence live timing test Phase 7.1 ngày 2026-09-19

- Sau authorization riêng cho đúng một mock fixture của đơn vị `18`, tạo request
  bình thường có marker `[TEST][PHASE7.1][LATENCY]` trên equipment `8392`; không
  đổi controls, recipient, subscription hoặc worker. Request `536` vẫn được giữ
  lại như historical repair record, không cleanup/delete/reset.
- Request tạo lúc `2026-09-19T08:00:33.476415Z`; intent materialize lúc
  `2026-09-19T08:00:36.341476Z`; delivery terminal lúc
  `2026-09-19T08:00:37.504832Z`, `accepted`, provider HTTP `201`, attempt `1`,
  `failed_count=0`. Terminal-minus-created là `4.028417s`; đây là upper bound
  theo provider report completion timestamp, không phải network-accept timestamp
  riêng vì timestamp đó không được lưu. Materialized-minus-terminal là
  `1.163356s`.
- Intent/delivery cùng giữ deadline `2026-09-20T08:00:33.476415Z`, đúng `86400`
  giây sau created time. Đây là evidence persisted deadline; không claim provider
  wire TTL, near-expiry behavior, retry behavior hoặc max-24-hour observation.
  Claim/send timestamps không còn trong read-back vì terminal completion đã clear
  lease fields.
- Final read-back giữ `registration=true`, `enqueue=true`, `dispatch=true`,
  allowlists count `28`; open intents/deliveries, pending-unmaterialized,
  retry-due và expired leases đều `0`. Maintainer báo iPhone đã nhận notification;
  đây là device receipt do maintainer báo, không phải browser E2E độc lập.
- Maintainer chấp thuận đóng checkbox 7.1 trên sample live được authorize. Giới
  hạn wire TTL và các lane chưa đo vẫn được ghi rõ ở đây, không relabel thành
  `PASS` và không mở rộng sang 7.2, 7.4, 7.5 hoặc Phase 8.
