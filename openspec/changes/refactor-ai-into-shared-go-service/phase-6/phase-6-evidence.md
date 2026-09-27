# Phase 6 Evidence

Ngày: 2026-09-27
Base commit: `683c4b2f`
Phạm vi: chỉ artefact Phase 6.1, 6.2 và 6.5 trên working tree; không sửa Phase 5.1–5.9, không cutover, không DB/live write, không Phase 7 VM smoke và không paid-provider smoke.

Provider configuration boundary: Phase 6 prepares the approved provider chain,
external `*_FILE` paths, mounts and loader contract. Writing NVIDIA/Google key
files to the Oracle dark runtime and validating provider readiness/Tunnel smoke
is Phase 7 work and requires separate operation-specific authorization.

The approved Phase 7 chain requires both providers: NVIDIA is primary and Google
Gemini is the fallback. The runtime must configure
`NVIDIA_API_KEY_FILE=/etc/qltbyt-ai/secrets/nvidia.api-key`,
`GOOGLE_GENERATIVE_AI_API_KEYS_FILE=/etc/qltbyt-ai/secrets/google.api-keys`,
`NVIDIA_BASE_URL` and `GOOGLE_GENERATIVE_AI_BASE_URL`. Secret values are not
recorded in this evidence or any Phase 6 artifact.

Review-fix state: working tree chưa commit. Maintainer phải thay base/evidence identity bằng commit landed trước khi closeout; runtime entrypoint/loader checks hiện đã pass.

## Artefact đã chuẩn bị

- `services/ai-service/Dockerfile`: multi-stage image, Dockerfile frontend, Go builder `1.26.5` và runtime/probe base đều digest-pinned; `CGO_ENABLED=0`, non-root `65532:65532`, OCI revision label.
- `services/ai-service/.dockerignore`: loại `.env`, key/certificate, credentials, secrets và build output khỏi context.
- `ops/ai-service/docker-compose.yml`: một container host-network nhưng bind cố định `127.0.0.1:8080`; read-only root, non-root, `cap_drop: ALL`, `no-new-privileges`, `512m`/`1 CPU`/`128 PIDs`, `65s` stop grace và bốn secret mount read-only.
- `ops/ai-service/ai-service.env.example`: digest image, approved provider chain và path secret ngoài repository; không chứa secret value.
- `ops/ai-service/cloudflared/config.yml.example`: chỉ route hostname path `/v1/chat` tới `127.0.0.1:8080`, các path khác trả `404`.
- `ops/ai-service/cloudflared/access-policy.md`: Access service token chỉ ở trusted BFF (`AI_SERVICE_BFF_CF_ACCESS_CLIENT_ID` và `AI_SERVICE_BFF_CF_ACCESS_CLIENT_SECRET`); không đưa vào image/Tunnel/Oracle service env.
- `ops/ai-service/systemd/`: service cho Compose và Cloudflare Tunnel; Compose stop timeout `65s`, systemd stop timeout `90s`.
- `ops/ai-service/rollback-runbook.vi.md`: digest/config retention, rollback previous verified image/config, dark-first failure giữ candidate unavailable và không tắt production `/api/chat`.
- `ops/ai-service/artifact-contract.mjs`: contract fail-closed cho Dockerfile, Compose, Tunnel/Access, systemd, rollback, secret boundary và build entrypoint.
- `ops/ai-service/validate-config.mjs`: fail-closed image digest, approved chain, fixed loopback/drain/TTL, external secret paths và file mode.

## Contract evidence

| Check                                                                                     | Kết quả          | Ghi chú                                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docker build --check --pull=false -f services/ai-service/Dockerfile services/ai-service` | PASS             | Dockerfile parse/build metadata không warning; không phải full image build.                                                                            |
| `docker build --pull=false --no-cache --build-arg VCS_REF=683c4b2f ...`                   | PASS (local)     | Local image build passed for the landed commit; entrypoint `/usr/local/bin/ai-service`, user `65532:65532`; `RepoDigests=[]` vì chưa publish registry. |
| `docker compose ... config --quiet` với bốn secret file tạm mode `0600`                   | PASS             | Compose render được, không publish port và giữ secret ngoài image.                                                                                     |
| Local container smoke với fake external secret files, `--network host`, `--read-only`     | PASS             | `/healthz` trả `200 {"status":"ok"}`; `/readyz` trả `503 not_ready` trong replay quarantine; không gọi model/provider thật.                            |
| `go test ./...` trong `services/ai-service`                                               | PASS             | Full module suite pass sau khi entrypoint được giữ app-neutral.                                                                                        |
| `go vet ./...` trong `services/ai-service`                                                | PASS             | Không có output.                                                                                                                                       |
| `gofmt -l cmd internal`                                                                   | PASS             | Không có file chưa format.                                                                                                                             |
| `systemd-analyze verify qltbyt-ai-service.service`                                        | PASS             | Unit Compose hợp lệ.                                                                                                                                   |
| `systemd-analyze verify cloudflared-ai-service.service`                                   | INCOMPLETE       | Máy kiểm tra không có `/usr/bin/cloudflared`; không phải bằng chứng Tunnel đã deploy.                                                                  |
| `validate-config.mjs` với digest + secret files ngoài repo                                | PASS             | Không ghi secret vào output.                                                                                                                           |
| `validate-config.mjs` với image tag `:latest`                                             | PASS (rejection) | Mutable image bị từ chối.                                                                                                                              |
| `validate-config.mjs` với secret file mode `0644`                                         | PASS (rejection) | Group/world-readable secret bị từ chối.                                                                                                                |
| `npx prettier --check` cho ESM/Markdown artifacts                                         | PASS             |                                                                                                                                                        |
| `git diff --check`                                                                        | PASS             |                                                                                                                                                        |
| `node ops/ai-service/artifact-contract.mjs`                                               | PASS             | Kiểm tra entrypoint tồn tại, loader bốn `*_FILE`, real `go build ./cmd/ai-service` và `go test ./cmd/ai-service`, cùng các artifact contract.          |

## Build và secret boundary

Dockerfile chạy `go build ./cmd/ai-service`; entrypoint hiện đã build/test được. Compose cung cấp bốn file path:

- `AI_SERVICE_HMAC_SECRET_FILE`
- `AI_SERVICE_BROKER_SECRET_FILE`
- `NVIDIA_API_KEY_FILE`
- `GOOGLE_GENERATIVE_AI_API_KEYS_FILE`

Provider config đọc giá trị `NVIDIA_API_KEY` và `GOOGLE_GENERATIVE_AI_API_KEYS`; entrypoint hiện đọc bốn file, map provider values vào process memory và không log/ghi lại secret. HMAC được nạp vào `ingress.Key`; broker secret hiện chỉ được đọc và kiểm tra readiness, vì broker wiring vẫn thuộc composition/Phase 7. Không được đưa secret vào Dockerfile, image layer, Git, Vercel hoặc `qltbyt_test`.

## Deferred boundary

- Publish/record registry digest và giữ previous verified digest/config; local build hiện chỉ có `RepoDigests=[]`.
- Provision Cloudflare Tunnel/Access trên Oracle VM và chạy dark VM smoke ở Phase 7 sau operation-specific authorization.
- Không thực hiện live provider call, production cutover, rollback thực tế, migration hay DB write trong lượt này.
