# WP-08 — Đóng gói service chung, runbook rollout và rollback

- Status: In Progress — LOCAL rehearsal and Oracle QLTBYT rollout PASS; browser/device acceptance pending
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
và temporary secret files. Ở lần chạy development, hai task image được giữ tạm
cho independent rerun.
Rehearsal log local `/tmp/wp08-rehearsal-green.log`, không chứa secret.

Both standalone Compose `config --quiet` PASS với placeholder env. Real image
Sender giữ TLS/SSRF guards và trả `unsafe_endpoint` cho127 trước network;
không có provider thật. WP-06 injected fake Sender tests riêng chứng minh
accepted201/crash/retry/stale/idempotency, không gọi đó là image-provider proof.
Fixture chỉ kiểm tra HMAC signature, chưa nonce/time-window server thật.
Rollback chứng minh synthetic subscription state và outbox xử lý tiếp; không
đụng consent browser và không tự nhận đã kiểm chứng consent/device thật.

## Independent verification trên artifact từ commit sạch

Điều phối viên đã chạy lại full Go tests, race, vet, cả hai Compose
`config --quiet`, Prettier và whitespace: PASS. Reviewer mới
`post_implementation_reviewer`: **Standards PASS, Spec PASS**, không có finding.

Sau commit implementation `15eaecdccb152ad6c4f301493d6da4a9a8951ecb`, xác nhận
worktree sạch và build lại với `SOURCE_REVISION` đúng SHA đó. Candidate cuối:

- Local image ID
  `sha256:aafa993d230ac7df3e532a79f7abaa1718961dc9df5c70464343506b159d8489`.
- OCI revision `15eaecdccb152ad6c4f301493d6da4a9a8951ecb`; linux/amd64,
  7,509,019 bytes, UID/GID `65532:65532`, entrypoint Go, SIGTERM.
- `RepoDigests` rỗng: chưa publish và không gọi local image ID là registry digest.

Ngày `2026-10-29T07:21:18Z`, điều phối viên dùng chính image ID này và
prior-source image ID đã ghi ở trên chạy lại
`go test -race -run '^TestPackagingImageHandoff$' -count=1 -v .`: **PASS**,
test 1.45s, toàn lệnh exit 0. Cả năm bước prior → candidate auth failure →
candidate credential recovery/delivery-report → prior rollback/reclaim →
candidate env smoke đều chạy thật. Container IDs lần lượt `869261e0f64a`,
`28d3a377c340`, `a51ecbe6dd9e`, `56e3d62664f5`, `56d0a3586e36`: exit 0,
stop 89–105ms, không OOM/SIGKILL; không còn container label
`qltbyt.wp08=rehearsal`. Temporary secrets được test cleanup xóa.

Test sources tại commit trên khớp file đã chạy, SHA-256:

- `packaging_test.go`: `00ceaa005ee7ce4257366661cc312462b40cff2355c85b771f9ecb4be9d32997`.
- `second_app_source_test.go`: `d4ad42f22527988d0b6d1500983cc8d3adad148dfca490d34547f295eba91673`.

Evidence commit sau chỉ cập nhật tài liệu; image vẫn gắn với commit
implementation nêu trên, không được relabel thành artifact build từ commit khác.

## Phạm vi còn pending ngay trong WP-08

Người dùng đã cho phép push/deploy Oracle và merge WP-08 vào main.
[Oracle rollout 2026-10-29](../../ops/web-push/oracle-rollout-2026-10-29.vi.md):
source `e56a89d7`, native ARM64 image, inventory/lease preflight, thay riêng
consumer QLTBYT, health/ready và kiểm tra 22 container khác đều PASS.
Giữ nguyên credential/VAPID/store và runtime controls; không ghi DB trực tiếp.

Browser/device smoke, provider acceptance mới, nhiều app thực và rollback live
chưa kiểm chứng. Không tạo notification test gửi người dùng trong phạm vi deploy.
Không mở task follow-up để bỏ scope; các giới hạn nghiệm thu này giữ ngay trong
WP-08. Không tự coi deployment health PASS là device delivery hoặc exactly-once.
