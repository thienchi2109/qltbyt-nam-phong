# WP-08 — Đóng gói service chung, runbook rollout và rollback

- Status: In Progress — preparation/rehearsal LOCAL complete; STAGING/LIVE rollout pending
- Created: 2026-10-28
- Milestone: Shared Web Push / Hexagonal
- Dependencies: WP-07
- Parent: [Web Push Hexagonal](web-push-hexagonal-index.md)

## Phạm vi và ownership

Sở hữu packaging ở `services/web-push/Dockerfile`, config example và runbook
versioned được chọn sau khảo sát. Chuẩn bị artifact vận hành review được;
mọi thao tác deploy/cutover thực tế phải có phê duyệt riêng.

## Acceptance criteria

- [x] Build artifact chạy được một/nhiều app theo topology đã chốt; config
      example chỉ có placeholder, hướng dẫn cấp/rotate credential và VAPID.
- [x] Runbook nêu preflight, version/contract compatibility, consumer đang
      hoạt động, giới hạn tải, loopback health/metrics và tín hiệu theo từng app.
- [x] Rehearsal trên môi trường cô lập kiểm chứng bắt đầu/dừng/chuyển lại,
      lease đang chạy, backlog và lỗi từng app; không suy diễn thành live PASS.
- [x] Rollback giữ được subscription, consent và khả năng xử lý delivery;
      nếu có thay đổi dữ liệu/key phải có phương án khôi phục riêng đã review.
- [x] Có checklist hậu triển khai và tiêu chí dừng/rollback đo được; trạng
      thái local, staging và live được ghi riêng theo exact artifact/commit.
- [ ] Chỉ đánh dấu Done sau phạm vi rollout được chốt và đã thực hiện;
      nếu chưa được phép deploy, ghi phần chuẩn bị hoàn tất và rollout pending,
      không coi backlog này là quyền deploy hay quyền ghi DB.

## Xác minh

Build/smoke image với fixture từ WP-06, kiểm tra cấu hình mẫu và rehearsal
rollback. SQL nếu phát sinh tuân thủ Database Quality Gate. Giữ production
credentials, cron, VAPID và DB nguyên trạng cho đến thao tác được phê duyệt.

## Chuẩn bị và evidence LOCAL — 2026-10-29

Phạm vi đã làm: [runbook](../../ops/web-push/packaging-rollout-rollback.vi.md),
hai Compose độc lập env/JSON, placeholder config, image scratch nonroot,
host-loopback observation và grace15s. Reuse WP-06 source/DTO/fixtures; graph
stale không có source mới nên đã đối chiếu source trực tiếp, không thêm runtime
abstraction/dependency hay production bypass. Không đổi production Go/TS/SQL.

Development artifact (chưa phải exact landed commit certification):

- Base worktree `17486b8da0e063831beca33185dff275c606be0c` + WP08 uncommitted
  packaging. Candidate OCI revision ghi rõ `17486b8...+wp08-uncommitted`.
  Image ID `sha256:a2b79dcff7478168dd1ec3db1227307a357a50803911a9b385d1d34a32c8af1a`,
  7,509,019 bytes, UID/GID65532, SIGTERM, linux/amd64 trên host này.
  Sorted manifest20 production build input files (path + SHA256; JSON array)
  digest `89755e45da77e00ace515f2a806ca5470151007050c0160721e8c5574550cc2b`;
  local artifact `/tmp/wp08-source-manifest.json`.
- Prior-source image build từ `git archive`
  `9f2b9c4c7c84513ab765a80dc5e844f7a8d569ab` (pre-refactor, không checkout),
  ID `sha256:241af30736365f91b497a8f1de10cd87bb01b94b352dacbcb3317cf7cac6e522`,
  7,463,963 bytes. Đây là historical-source build cục bộ, **không** là digest
  deployed được chứng nhận. Cả hai là local image ID, chưa registry/publish.

Commands/results:

```bash
cd services/web-push
go test ./...
go test -race ./...
go vet ./...
WEB_PUSH_PACKAGING_IMAGE=wp08-rehearsal:candidate \
WEB_PUSH_ROLLBACK_IMAGE=wp08-rehearsal:prior-9f2b9c4 \
  go test -run '^TestPackagingImageHandoff$' -count=1 -v .
```

Full/race/vet PASS; Docker rehearsal PASS1.559s. Sequence: prior env claim/report
kẹt -> SIGTERM -> candidate multiapp (B auth terminal, A còn lease) -> stop,
credential B corrected/restart -> candidate B delivery/report commit, A vẫn
attempt1 -> stop -> fixture clock qua lease A -> prior reclaim attempt2/token
mới/report commit -> candidate env compatibility smoke. Source subscriptions
không đổi, B chỉ hoàn tất sau sửa credential, A không mất backlog khi stop.
5 container IDs lần lượt `5a96f2709d59`, `14b8afa2172a`, `ca1a9e9a1684`,
`1392a7d1f5c0`, `bc5b852e39ed`; exit0, stop91–104ms, cleanup toàn bộ containers
và temporary secret files. Chỉ hai task image giữ tạm cho independent rerun.
Rehearsal log local `/tmp/wp08-rehearsal-green.log`, không chứa secret.

Both standalone Compose `config --quiet` PASS với placeholder env. Real image
Sender giữ TLS/SSRF guards và trả `unsafe_endpoint` cho127 trước network;
không có provider thật. WP-06 injected fake Sender tests riêng chứng minh
accepted201/crash/retry/stale/idempotency, không gọi đó là image-provider proof.
Fixture chỉ kiểm tra HMAC signature, chưa nonce/time-window server thật.
Rollback chứng minh synthetic subscription state và outbox xử lý tiếp; không
đụng consent browser và không tự nhận đã kiểm chứng consent/device thật.

## Phạm vi còn pending ngay trong WP-08

Exact landed-commit artifact cần build/rerun sau review/commit. STAGING/LIVE,
inventory consumer thực tế, source backlog/lease metrics thật, browser/device
smoke và cutover/rollback deployed **chưa làm/chưa được phép**. Không mở task
follow-up để bỏ scope; WP-08 giữ In Progress đến khi rollout được chỉ định và
thực hiện. Không có production credential/cron/VAPID/DB write hay deploy.
