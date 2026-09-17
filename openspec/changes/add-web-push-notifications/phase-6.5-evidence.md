# Phase 6.5 Evidence

Ngày 2026-09-17. Phạm vi chỉ gồm Go checks, local image audit và mock-only container smoke; không có provider thật, SQL/live DB, Oracle, browser hay deploy.

## Artifact được kiểm chứng

- Commit source/runtime kiểm chứng: `bc9ddbe31497cf902b0f48c019fdf6d4132d72a0`.
- Build command:

  ```text
  docker build --pull=false --no-cache -f services/web-push/Dockerfile -t qltbyt-web-push:bc9ddbe31497 services/web-push
  ```

- Image: `qltbyt-web-push:bc9ddbe31497`.
- Image ID: `sha256:84c878f3a7ea5ebebcf9df3d0ff2dd72f999f2697d23dce471072e8f7832c1fe`.
- `docker image inspect`: entrypoint `/usr/local/bin/web-push`, user `65532:65532`, `RepoDigests=[]`; image chỉ là local artifact, chưa publish registry.
- Build context chỉ lấy `services/web-push/`; `.dockerignore` loại `.git`, `.env*`, `*.key`, `*.pem`, `coverage` và `tmp`.

## Smoke và secret audit

Runnable check:

```text
node ops/web-push/chunk-6.5-smoke.mjs
```

Kết quả: `PASS`, exit `0`. Script tạo VAPID test key và marker tạm ngoài Git, chỉ in fingerprint public và không in private key/HMAC/marker; mọi file tạm và container/project Compose được dọn trong `finally`.

Các assertion chính:

- Final filesystem chỉ có binary `/usr/local/bin/web-push` và CA bundle; không có `/run/secrets`, `.env`, key, PEM hoặc marker.
- Image history, OCI layer archive và image environment không chứa test private key, marker hoặc cấu hình `WEB_PUSH`/HMAC/VAPID/secret. `PATH` mặc định của image không phải secret.
- Direct container chạy `65532:65532`, `--read-only`, secret bind mount read-only, không publish port; health/readiness được probe bằng BusyBox trong cùng network namespace, không mở cổng ra host.
- Omitted `WEB_PUSH_PAUSED` trả `healthz=200 ok` và `readyz=200 paused`, metrics bounded không có secret/marker; restart với cùng mounted key vẫn ready.
- Mismatch public artifact và private key invalid đều exit `1` với stable error code `vapid_artifact_mismatch`/`vapid_unavailable`; không claim/send.
- SIGTERM dừng direct container với exit `0`; Compose config và service smoke cũng PASS với user non-root, rootfs read-only, secret read-only, không port publish và `readyz=paused`.

Smoke này cố ý chỉ chạy paused path trong container và dùng test-only key. Claim/report/provider enabled path vẫn được bảo vệ bởi 104 Go mock/unit tests; script không giả nhận đó là provider delivery hoặc browser evidence.

## Go và repository verification

Tại cùng source commit:

- `gofmt` check: PASS.
- `go test -count=1 ./...`: PASS, 104 tests / 2 packages.
- `go test -race -count=1 ./...`: PASS, 104 tests / 2 packages.
- `go vet ./...`: PASS.
- `golangci-lint run ./...`: PASS, 0 issues.
- `go build -trimpath -buildvcs=false ./cmd/web-push`: PASS.
- Focused Vitest `worker-routes.test.ts` + `wire.test.ts`: PASS, 11 tests.
- Repo `format:check`, `verify:no-explicit-any`, `verify:dedupe`, `typecheck`: PASS; diff-aware JS/TS gates reported no changed files where applicable.
- React Doctor diff scan: PASS with no changed source files.
- OpenSpec strict validation and Prettier check for the changed artifact/docs: PASS.

## Giới hạn và review gate

- Không gửi provider thật, không gọi origin production, không mở outbound production network; Compose smoke chỉ có service và test secret.
- Không thực hiện SQL/live DB write, Supabase MCP write, Oracle/production deploy, browser matrix hoặc Phase 7/8.
- Image ID là local content ID; `RepoDigests=[]` không phải registry digest.
- Independent review của parent agent còn pending. Giữ checkbox 6.5 và các phase khác nguyên trạng cho tới khi review độc lập xác nhận evidence này.
