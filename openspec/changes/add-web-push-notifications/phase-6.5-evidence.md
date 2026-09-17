# Phase 6.5 Evidence

Ngày 2026-09-17. Phạm vi chỉ gồm Go checks, local image audit và mock-only container smoke; không có provider thật, SQL/live DB, Oracle, browser hay deploy.

## Artifact được kiểm chứng

- Main smoke source sau correction: commit `ac1289ec5e2569ac45d0d1a51dc9c9d4c0fc448e`; regression harness sửa stderr-success audit: commit `c035ce8c9bceafe9bc0e62c845ccd9acb2cf914c`.
- Source/runtime commit của image có sẵn: `280bbead03d0dcd3114687f6e3dee7a51296c6ca`.
- Build command của image:

  ```text
  docker build --pull=false --no-cache -f services/web-push/Dockerfile -t qltbyt-web-push:280bbead03d0 services/web-push
  ```

- Image: `qltbyt-web-push:280bbead03d0`.
- Image ID: `sha256:35fe490293289ad7d2f9c1882c0c08f81a013bfac78adb8873f2601b42717e91`.
- `docker image inspect`: entrypoint `/usr/local/bin/web-push`, user `65532:65532`, `RepoDigests=[]`; đây là local content ID, chưa publish registry.
- Smoke bắt buộc nhận `WEB_PUSH_EXPECTED_IMAGE_ID` và so sánh với `metadata.Id`; sau đó pin `metadata.Id` bất biến cho history, filesystem/archive, direct container và Compose, đồng thời ghi riêng requested tag. Tên tag tự nó không được xem là provenance.
- Marker và HMAC test được tạo ngẫu nhiên trong temp directory ngoài build context. Đây không phải bằng chứng riêng cho `.dockerignore` exclusion.

## Smoke và secret audit

Runnable normal check:

```text
WEB_PUSH_IMAGE=qltbyt-web-push:280bbead03d0 \
WEB_PUSH_EXPECTED_IMAGE_ID=sha256:35fe490293289ad7d2f9c1882c0c08f81a013bfac78adb8873f2601b42717e91 \
node ops/web-push/chunk-6.5-smoke.mjs
```

Kết quả: `PASS`, exit `0`; fingerprint public là `sha256:256b1be32745d1d1c9d49121cc87bc451c4f2dfa756d89b4c910afaeb6258ae0`. Script không in private key, HMAC hoặc marker.

Các assertion chính:

- Metadata, history và mọi layer tar trong `manifest.json` đều được đọc bằng command có kiểm tra exit status; raw layer bytes, final filesystem archive và path entries được quét cho private key, HMAC test và marker.
- Final filesystem được claim ở mức đã kiểm tra: có binary `/usr/local/bin/web-push`, có CA bundle và không có path dạng secret (`/run/secrets`, `.env`, key, PEM hoặc marker). Không claim filesystem chỉ chứa đúng hai file vì Docker export còn có runtime entries.
- Image environment không có secret configuration; `RepoDigests=[]` xác nhận chưa publish registry, không phải registry digest.
- Direct container chạy `65532:65532`, `--read-only`, secret bind mount read-only, không publish port; health/readiness probe qua BusyBox trong cùng network namespace.
- Direct container được stop rồi start lại bằng cùng name/ID và cùng mount source. Smoke so sánh secret bytes/hash trên host và hash của file mount trong container; health/readiness trở lại `ok`/`paused`, metrics vẫn `web_push_deliveries_accepted_total 0`, không có claim/send.
- Metrics, stdout và stderr của logs/fail-closed output đều được kiểm tra không chứa runtime secret values đã sinh; lỗi command/log được redaction trước khi đưa vào JSON failure. Regression còn inject một sentinel chỉ vào stderr để xác nhận audit fail closed mà không lộ sentinel.
- Mismatch public artifact và private key invalid đều exit `1` với error code `vapid_artifact_mismatch`/`vapid_unavailable` và output không chứa generated secrets; Compose config/service smoke giữ user non-root, rootfs read-only, secret read-only, no published port và readiness `paused`. Direct/Compose container đều assert `.Image` đúng immutable ID.
- PASS chỉ được in sau khi direct container, Compose project/network và temp directory được cleanup/verify. Cleanup command failure làm run `FAIL`, kể cả retry sau đó đã xóa được resource.

## Fault-injection regression

Runnable regression:

```text
node ops/web-push/chunk-6.5-smoke-regression.mjs
```

RED isolated trước correction: bản sao tạm với smoke mutant đổi `const logs = text(logsProcess)` thành chỉ đọc `stdout` làm regression harness exit `1` tại `fault unexpectedly passed`; bản sao smoke đúng full-output vẫn exit `0`/in `PASS`. Đây là bằng chứng regression bắt được việc bỏ qua stderr của successful `docker logs`; mỗi bản sao và resource Docker đều được dọn sau run.

GREEN tại harness commit `c035ce8c9bceafe9bc0e62c845ccd9acb2cf914c`: mode `logs-stderr-secret` ghi sentinel vào stderr rồi passthrough Docker với exit `0`, yêu cầu stage `direct logs exclude generated runtime secrets`, giữ fault marker và không yêu cầu `[REDACTED]` cho nhánh leak thành công. Các mode `history`, `layer-list`, `cleanup-rm`, `compose-stop`, `compose-down` vẫn fail đúng stage; child status là `FAIL` cho cả sáu mode, harness exit `0`/in `PASS`, không lộ sentinel.

Stage capture: `history` -> `read image history`; `layer-list` -> `list image layer`; `cleanup-rm` -> `cleanup command failed`; `compose-stop` -> `stop Compose service`; `compose-down` -> `compose ... cleanup command failed`; `logs-stderr-secret` -> `direct logs exclude generated runtime secrets`. Immutable-tag guard tiếp tục chứng minh không operation sau validation dùng requested tag.

## Verification

- `node scripts/npm-run.js run format:check`: PASS sau Prettier.
- `node scripts/npm-run.js run verify:no-explicit-any`: PASS; không có changed TypeScript files.
- `node scripts/npm-run.js run verify:dedupe`: PASS, diff-only.
- `node scripts/npm-run.js run typecheck`: PASS.
- `node ops/web-push/chunk-6.5-smoke-regression.mjs`: PASS.
- Một attempt đầu trong batch gate dừng `FAIL` ở `compose-stop` vì direct `/healthz` preflight trả `0 ok` trước khi fault marker được kích hoạt; harness không che preflight failure. Chạy lại cùng exact command sau đó PASS exit `0`, không đổi source/runtime.
- `node scripts/npm-run.js run react-doctor`: PASS, score `100/100`, diff scan.
- `WEB_PUSH_EXPECTED_IMAGE_ID=sha256:0000000000000000000000000000000000000000000000000000000000000000 node ops/web-push/chunk-6.5-smoke-regression.mjs`: expected `FAIL`, exit `1`, không in regression `PASS` (negative harness check).
- `cd services/web-push && go test -count=1 ./...`: PASS.
- `cd services/web-push && go vet ./...`: PASS.
- `cd services/web-push && go build -trimpath -buildvcs=false ./cmd/web-push`: PASS; generated local binary was removed after verification.

## Giới hạn và review gate

- Không gửi provider thật, không gọi origin production, không mở outbound production network; Compose/direct smoke chỉ dùng local image, paused path và test key.
- Không thực hiện SQL/live DB write, Supabase MCP write, Oracle/production deploy, browser matrix hoặc Phase 7/8.
- Audit chỉ chứng minh absence của các generated test values và path/config patterns được nêu ở trên; không claim absence của mọi secret arbitrary hoặc mọi biến thể encoding. Sentinel stderr là giá trị sinh riêng cho test, không phải secret thật.
- Image ID là local content ID; pin immutable ID ngăn tag đổi subject sau validation trong harness nhưng không thay thế provenance/signature verification.
- Normal smoke và fault regression là paused/mock-only; negative image check chỉ chứng minh regression harness fail closed khi prerequisite sai, không chứng minh image provenance.
- Independent review của parent agent còn pending. Giữ checkbox 6.5 và các phase khác nguyên trạng cho tới khi review độc lập xác nhận evidence này.
