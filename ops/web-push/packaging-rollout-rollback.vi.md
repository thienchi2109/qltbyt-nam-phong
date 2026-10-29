# WP-08 — Packaging, rollout và rollback

Chuẩn bị/rehearsal LOCAL hoàn tất; STAGING/LIVE rollout **PENDING**, chưa được
ủy quyền. Runbook không cấp quyền deploy, sửa credential/VAPID, cron hay DB.
Không thay subscription store, consent browser, atomic outbox hoặc quyền tại app.
Service Go dùng wire v1 claim/report; wire không thêm `app_id`.

## Artifact và topology

Build từ đúng commit đã review, context chỉ là `services/web-push`:

```bash
docker build --build-arg SOURCE_REVISION=<exact-commit> \
  --tag <registry>/web-push:<exact-commit> services/web-push
```

Sau publish được duyệt, ghi registry digest và dùng `image@sha256:...`, không
dùng tag mutable cho cutover/rollback. Local image ID không phải registry digest.
Image scratch có CA hệ thống, binary Go static, UID/GID 65532, SIGTERM; không
shell/package manager. Build theo platform Docker đã chọn, không ép amd64;
verify platform artifact khớp Oracle trước khi triển khai. Không copy secret
vào build context, kể cả tên file không bị `.dockerignore` bắt.

Hai Compose **độc lập**, chỉ chọn một, dùng cùng project name khi thay mode:

- [docker-compose.yml](docker-compose.yml): env một app, tương thích cũ.
- [docker-compose.apps.yml](docker-compose.apps.yml): JSON 1–16 app.
- [web-push.env.example](web-push.env.example), [apps.example.json](apps.example.json):
  placeholder cố ý không chạy được, bản đã điền phải nằm ngoài Git.

Topology này dành cho Linux/Oracle, `network_mode: host`, không publish port.
Runtime chỉ chấp nhận loopback IP port 8080; host probe trực tiếp
`http://127.0.0.1:8080/{healthz,readyz,metrics}` và `/readyz/<AppID>`.
Listener cũ trên bridge bind 127 trong container chỉ thấy trong network namespace
container; `ports: 127.0.0.1:8080:8080` không làm nó reachable. Khi đổi topology,
inventory namespace/host listener trước, không dừng dịch vụ khác để lấy port.
Host networking không cung cấp network isolation; không thêm public listener.
Không chạy hai project/consumer đồng thời. Scratch không có probe CLI nội bộ;
operator dùng HTTP client trên host. Chưa thêm Docker HEALTHCHECK nên
`docker ps` Running không thay readiness.

Command skeleton sau chỉ để operator thực hiện khi đã được duyệt, dùng cùng
project/service. Chọn **một** file cho mỗi lệnh, không thêm file override kia:

```bash
docker compose --project-name qltbyt-web-push \
  --env-file /absolute/operator-managed/web-push.env \
  -f ops/web-push/docker-compose.apps.yml config --quiet
docker compose --project-name qltbyt-web-push \
  --env-file /absolute/operator-managed/web-push.env \
  -f ops/web-push/docker-compose.apps.yml stop web-push
# Đợi lease/drain và preflight theo checklist trước bước up.
docker compose --project-name qltbyt-web-push \
  --env-file /absolute/operator-managed/web-push.env \
  -f ops/web-push/docker-compose.apps.yml up --detach --force-recreate --no-deps web-push
```

Env mode dùng `docker-compose.yml` thay file apps; khi chuyển mode giữ nguyên
project `qltbyt-web-push` và service `web-push`, stop consumer hiện hành trước
up consumer mới. Render chỉ dùng `config --quiet`, không in secret đã nội suy.

## Secret, identity và rotation

QLTBYT giữ nguyên origin/store/HMAC và VAPID version/public/fingerprint/private
đang dùng khi nâng cấp code; không tạo key hoặc resubscribe chỉ để thêm AppID.
AppID do operator cấu hình, khác tenant `don_vi`, worker ID và HMAC rotation slot.
Mỗi app có source/store/authorization/outbox, HMAC secret và VAPID riêng; shared
origin bị từ chối. Hai origin khác nhau vẫn cần operator chứng minh store tách.
Không fallback key/credential xuyên app.

File-mode mount một directory **chỉ chứa** `apps.json` và private keys của các
binding đó. JSON chứa HMAC nên cũng là secret. Trên Docker Compose local, uid,
gid, mode trong `secrets:` không remap bind source; provision file thực tế owner
65532:65532 mode 0400, directory do operator sở hữu và chỉ cho UID 65532 traverse
(ví dụ owner root, group 65532, mode 0710). Kiểm tra bằng chính paused container
UID 65532, không dùng `chmod 644`, không dump env/config để debug. Với userns/rootless,
map UID host tương ứng trước; không giả định numeric65532 luôn là host owner.
Env cũ chứa HMAC trong container env: chỉ operator được quyền Docker/inspect.

Provision app mới bằng kho secret vận hành: HMAC ngẫu nhiên đúng 32 bytes,
base64; private VAPID P-25632 bytes dạng base64url theo loader, derive và kiểm tra
public/fingerprint/version, backup có kiểm soát. Placeholder không phải key mẫu.
HMAC rotation dùng cửa sổ current/previous tại source, provision credential mới,
restart **toàn shared service** để nạp binding đã sửa, kiểm chứng claim/report,
chỉ retire slot cũ sau hết lease/
retry và rollback window đã duyệt. AppID/VAPID/subscriptions không đổi.
Không có API restart riêng binding; các app khác cũng phải qua stop/lease
contract khi shared service restart.
VAPID rotation khác code rollback, cần approval và kế hoạch resubscribe/recovery
riêng theo [rotation runbook](vapid-rotation-runbook.vi.md).
Config và private file chỉ đọc khi startup; không hot reload. File mode không
kế thừa origin/HMAC/VAPID/pause từ env cũ; thiếu/sai JSON fail trước claim.

## Preflight trước thao tác được duyệt

1. Ghi exact source commit, image platform/registry digest candidate và artifact
   rollback đã pull/kiểm tra, config mode, AppID, source origin, worker identity,
   credential slot, VAPID version và fingerprint đối chiếu (không ghi secret).
   Artifact rollback phải còn đọc config cũ và credential còn hiệu lực.
2. Inventory từng consumer thực tế: host/container/service name, image digest,
   mode, worker ID, AppID/source, paused/running, supervisor restart policy,
   cron/legacy dispatcher khác, owner và cách stop. Không suy ra inventory từ
   repo hoặc chỉ một lệnh `docker ps`; xác minh mọi nguồn xử lý cùng queue.
3. Read-only kiểm chứng wire v1, strict UUID/revision/report semantics, source
   permissions/atomic enqueue/fencing và artifact QLTBYT theo
   [WP-07](qltbyt-compatibility-cutover.vi.md). Ghi source backlog đến hạn,
   oldest age, active leases và **max actual lease expiry**, retry/deadline,
   subscription count/revision/VAPID distribution. Service không expose backlog
   hoặc tổng lease; cần probe read-only do từng source cung cấp.
4. Kiểm tra secret owner/readability, HTTPS trust/time sync/HMAC replay controls,
   DNS/provider egress, host loopback8080 trống, không public listener. Render
   Compose `config --quiet` với env file ngoài Git (không in rendered secrets).
5. Đặt ngưỡng trước cutover: default abort ngay nếu sai AppID/key/report routing,
   auth terminal, tăng revoke không được giải thích hoặc consumer trùng. Trong
   30s sau bật, mọi app phải ready; 2 probe lỗi cách5s liên tiếp => stop/rollback.
   Không chấp nhận `stale` (>60s không thành công). Source backlog phải giảm sau
   2 cửa sổ60s khi có due jobs; oldest age không tăng quá120s so baseline, không
   vượt deadline gần nhất. Nếu source không có các số đo này, chưa được bật.
   Đây là ngưỡng rehearsal mặc định, owner phải chốt theo tải/SLO thực tế.

Capacity: mỗi app claim tối đa5, tối đa5 send đồng thời, không prefetch;16 app
tối đa80 send slots và16 backend calls, không phải toàn bộ lease ở source.
Mỗi app có slot riêng; credential lỗi dừng riêng worker, worker khác tiếp tục.
Một worker `stopped` chỉ hồi phục sau sửa source/config và restart; process
vẫn sống kể cả mọi worker đã stopped. Chưa có throughput/capacity benchmark.

## Stop, cutover và hậu kiểm

1. Chốt baseline/consumer inventory và approval thao tác cụ thể. Pause dispatch
   tại control plane nếu được duyệt, stop consumer cũ qua supervisor sở hữu nó;
   ngăn supervisor tự start lại. Không reset token/attempt/revision/deadline.
2. SIGTERM hủy poll/provider/backend contexts, hạ readiness rồi chờ worker.
   Main có hai budget5s (HTTP shutdown + worker wait); Compose grace15s.
   Xác nhận process dừng exit0, không OOM/SIGKILL trong15s; quá ngưỡng thì dừng
   cutover, giữ dispatch tắt, kiểm tra source lease và crash window.
3. Đợi **tất cả** lease cũ drain/hết theo source expiry và time sync; QLTBYT
   thường45s, không áp45s cho app khác. Xác nhận không consumer khác claim rồi
   start candidate với config đã review ở paused mode, cùng source/key cũ.
4. Kiểm tra liveness200; env mode `/readyz`200 `paused` chỉ là local preflight.
   File mode mọi app bắt buộc: paused => per-app503, aggregate503 JSON; đây là
   kết quả đúng trước bật. Không dùng aggregate200 env-paused làm remote PASS.
5. Sau approval bật dispatch, provision config `paused:false`/env false và
   recreate/restart (không hot reload). Env active `/readyz`200 `ready`; file
   active aggregate200 chỉ khi tất cả ready, per-app200. Probe unknown AppID404.
6. Trong30s và mỗi5s ít nhất2 phút: ghi per-app readiness, source claim/report
   commits, due backlog/oldest age/leases/retries, metrics delta và stable error
   codes. File metrics label `app_id` hữu hạn≤16; env không label. Kiểm tra
   source/app độc lập và consumer cũ không restart, không report/key/revoke chéo.
   `accepted_total` là provider accept, không phải source commit/device display.
7. Browser/device thật với consent đã có phải chứng minh đăng ký server còn
   đúng, nhận repair notification và account/signout/renew lifecycle; không
   tự grant consent. Ghi staging/live evidence riêng exact artifact và giờ UTC.

## Rollback code

Khi chạm tiêu chí dừng: ghi thời điểm/reason/AppID, stop toàn shared process bằng
SIGTERM; app lỗi không được coi là thành công vì app khác ready. Lặp drain/
max lease expiry và kiểm tra consumer inventory, start **digest rollback đã
chốt** bằng config cũ/origin/credential/VAPID tương thích. Nếu prior chỉ một app,
QLTBYT quay về prior; app thứ hai giữ queue riêng pending/paused và owner biết
deadline của nó, không chuyển job sang QLTBYT. Hậu kiểm theo cùng ngưỡng trên.

Giữ store/subscription/revision/consent/outbox/retry/deadline nguyên trạng;
không delete queue, restore DB hoặc đổi key để rollback code. Provider có thể
đã accept trước cancellation nhưng report chưa commit: lease reclaim có thể
gửi lặp, không hứa exactly-once. Nếu data/key đã đổi, dừng tại đây cho đến khi
có recovery plan riêng được review/ủy quyền; artifact cũ đơn thuần không đủ.

## Rehearsal cô lập và evidence

[packaging_test.go](../../services/web-push/packaging_test.go) opt-in Linux Docker,
host8080 phải trống; test chạy bằng operator có thể provision owner65532 cho
secret giả. Không dùng credential hoặc endpoint thật. Ví dụ sau khi build cả
candidate và prior-source image từ archive commit bất biến, không checkout:

```bash
cd services/web-push
WEB_PUSH_PACKAGING_IMAGE=<candidate-image-ID> \
WEB_PUSH_ROLLBACK_IMAGE=<prior-source-image-ID> \
  go test -run '^TestPackagingImageHandoff$' -count=1 -v .
```

Test giữ hai source HTTPS WP-06 trong process độc lập với vòng đời container,
synthetic HMAC/VAPID, CA fixture qua `SSL_CERT_FILE`; source chỉ kiểm tra chữ ký,
chưa nonce/time-window production. Prior legacy process claim và kẹt report,
SIGTERM để lại lease/backlog; candidate multiapp giữ lease đó, app B auth lỗi
terminal không hủy app A, B giữ pending; stop candidate, sửa credential giả và
restart multiapp để B claim/report thành công trong khi A vẫn lease cũ; stop,
advance **fixture clock** quá lease A, restart prior reclaim token mới và commit,
giữ cả subscriptions và kết quả queue B đã commit.
Candidate còn smoke env mode. Mọi container prefix `wp08-rehearsal-`, label
`qltbyt.wp08=rehearsal`, read-only/nonroot/no caps, host loopback; cleanup từng
ID bằng test cleanup kể cả failure. Không prune/stop resource khác.

Production Sender chặn endpoint127 (`unsafe_endpoint`) trước network; image
rehearsal **không** chứng minh provider accepted. Existing `TestSecondApp*` dùng
injected fake Sender201/429/410 để kiểm tra accepted-before-report crash,
duplicate/stale fencing; đây là lớp proof khác, không phải image/provider thật.
Một job/source in-memory không chứng minh storage durability, throughput hay
device consent; test chỉ giữ synthetic subscription state không bị code đổi.

Evidence và digest ghi tại [WP-08 task](../../backlog/tasks/WP-08-packaging-rollout-and-rollback.md).
LOCAL/DISPOSABLE có thể PASS; STAGING/LIVE và device smoke vẫn PENDING, không
đóng Done trước phạm vi rollout được duyệt và thực hiện ngay trong task này.
