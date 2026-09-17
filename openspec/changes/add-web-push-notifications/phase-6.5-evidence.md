# Phase 6.5 Evidence

Ngày 2026-09-17. Phạm vi chỉ gồm Go checks, local image audit và mock-only container smoke; không có provider thật, SQL/live DB, Oracle, browser hay deploy.

## Artifact được kiểm chứng

- Smoke harness và regression source: commit `6ca6c5c66687400321fad46f58de7be2a61bd822`.
- Source/runtime commit của image có sẵn: `280bbead03d0dcd3114687f6e3dee7a51296c6ca`.
- Build command của image:

  ```text
  docker build --pull=false --no-cache -f services/web-push/Dockerfile -t qltbyt-web-push:280bbead03d0 services/web-push
  ```

- Image: `qltbyt-web-push:280bbead03d0`.
- Image ID: `sha256:35fe490293289ad7d2f9c1882c0c08f81a013bfac78adb8873f2601b42717e91`.
- `docker image inspect`: entrypoint `/usr/local/bin/web-push`, user `65532:65532`, `RepoDigests=[]`; đây là local content ID, chưa publish registry.
- Smoke bắt buộc nhận `WEB_PUSH_EXPECTED_IMAGE_ID` và so sánh với `metadata.Id`; tên tag tự nó không được xem là provenance hay subject binding.
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
- Metrics và logs được kiểm tra không chứa các runtime secret values đã sinh; lỗi command/log được redaction trước khi đưa vào JSON failure.
- Mismatch public artifact và private key invalid đều exit `1` với error code `vapid_artifact_mismatch`/`vapid_unavailable`; Compose config/service smoke giữ user non-root, rootfs read-only, secret read-only, no published port và readiness `paused`.
- PASS chỉ được in sau khi direct container, Compose project/network và temp directory được cleanup/verify. Cleanup command failure làm run `FAIL`, kể cả retry sau đó đã xóa được resource.

## Fault-injection regression

Runnable regression:

```text
node ops/web-push/chunk-6.5-smoke-regression.mjs
```

RED trước correction: injected `docker history` failure bị script cũ bỏ qua và toàn run trả `PASS`. GREEN tại harness commit `6ca6c5c66687400321fad46f58de7be2a61bd822`: các fault `history`, layer `tar -tf`, `rm -f`, Compose `stop` và Compose `down` đều trả non-zero/JSON `FAIL`, không có `PASS`, không lộ marker; container và Compose network sau mỗi case bằng baseline trước test.

## Verification

- `node scripts/npm-run.js run format:check`: PASS sau Prettier.
- `node scripts/npm-run.js run verify:no-explicit-any`: PASS; không có changed TypeScript files.
- `node scripts/npm-run.js run verify:dedupe`: PASS, diff-only.
- `node scripts/npm-run.js run typecheck`: PASS.
- `node ops/web-push/chunk-6.5-smoke-regression.mjs`: PASS.
- `node scripts/npm-run.js run react-doctor`: PASS, score `100/100`, diff scan.
- `cd services/web-push && go test -count=1 ./...`: PASS.
- `cd services/web-push && go vet ./...`: PASS.
- `cd services/web-push && go build -trimpath -buildvcs=false ./cmd/web-push`: PASS; generated local binary was removed after verification.

## Giới hạn và review gate

- Không gửi provider thật, không gọi origin production, không mở outbound production network; Compose/direct smoke chỉ dùng local image, paused path và test key.
- Không thực hiện SQL/live DB write, Supabase MCP write, Oracle/production deploy, browser matrix hoặc Phase 7/8.
- Audit chỉ chứng minh absence của các generated test values và path/config patterns được nêu ở trên; không claim absence của mọi secret arbitrary hoặc mọi biến thể encoding.
- Image ID là local content ID; expected-ID check bảo vệ khỏi mutable tag đổi subject trong run nhưng không thay thế provenance/signature verification.
- Independent review của parent agent còn pending. Giữ checkbox 6.5 và các phase khác nguyên trạng cho tới khi review độc lập xác nhận evidence này.
