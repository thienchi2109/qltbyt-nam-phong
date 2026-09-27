# Phase 6 Handoff

Ngày: 2026-09-27
Base commit: `683c4b2f`

Artefact ownership đã hoàn tất cho Phase 6.1/6.2/6.5 trên working tree: Dockerfile digest-pinned, Compose host-loopback hardening, external secret templates, Cloudflare path/Access boundary, systemd units, rollback runbook và fail-closed validators.

Ranh giới cấu hình provider: Phase 6 chỉ chuẩn bị chain, `*_FILE` contract,
secret mount và loader contract ngoài image. Không ghi key vào Oracle trong Phase 6. Sau khi Phase 6 PASS, Phase 7 mới ghi NVIDIA/Google secret files vào Oracle
dark runtime và validate `/healthz`, `/readyz` cùng Tunnel smoke; thao tác đó cần
operation-specific authorization riêng.

## Thời điểm cấu hình NVIDIA/Google

Các biến provider được cấu hình trong **Phase 7 dark VM smoke**, sau khi Phase 6
đã PASS artifact contract và full image digest:

```env
AI_PROVIDER_CHAIN=nvidia/google/gemma-4-31b-it,google/gemini-3.5-flash-lite
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_API_KEY_FILE=/etc/qltbyt-ai/secrets/nvidia.api-key
GOOGLE_GENERATIVE_AI_API_KEYS_FILE=/etc/qltbyt-ai/secrets/google.api-keys
```

Google là fallback bắt buộc của chain trên, nên Phase 7 phải cấu hình cả
`GOOGLE_GENERATIVE_AI_API_KEYS_FILE` và
`GOOGLE_GENERATIVE_AI_BASE_URL`; không được chỉ cấu hình NVIDIA rồi coi chain
đã sẵn sàng.

`NVIDIA_API_KEY` và Google fallback keys được ghi vào secret files ngoài
image/repository trên Oracle ở Phase 7; không đặt giá trị key trong env inline,
Dockerfile, Vercel hoặc artifact Phase 6. Phase 7 chỉ bắt đầu sau khi maintainer
cấp authorization cho dark deploy và provider validation cụ thể.

`docker build --check`, full local image build, Compose render, qltbyt systemd verify, positive/negative config validation, Prettier và diff checks đã chạy. Entrypoint `services/ai-service/cmd/ai-service/main.go` hiện đã được build/test và đọc bốn secret file qua loader fail-closed; `artifact-contract.mjs` PASS. Local image chưa publish registry (`RepoDigests=[]`), nên chưa có registry digest để đưa vào Oracle.

Local image evidence: `sha256:aab53071ed24e64ee75205604cd0186b7b5360706c87cf257ff9f90aa61bafb8`, entrypoint `/usr/local/bin/ai-service`, user `65532:65532`. This content ID is not a registry digest.

`go test ./...`, `go vet ./...` và gofmt hiện PASS; entrypoint không còn chuỗi app-specific bị boundary test cấm.

## Handoff cho runtime owner

Entrypoint contract đã được runtime owner triển khai và phải giữ các điều kiện:

1. Build từ `./cmd/ai-service` và bind cố định `127.0.0.1:8080`.
2. Đọc bốn `*_FILE` path do Compose mount, không log secret; map provider files thành `NVIDIA_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEYS` trước `provider.ChainConfigFromEnv`.
3. Nạp HMAC secret vào ingress key/guard; đọc và kiểm tra broker secret qua
   readiness gate (broker/query wiring thuộc composition/Phase 7); expose
   `/healthz` và `/readyz`, wire `Lifecycle` với drain `60s` + cleanup `5s`.
4. Trả lỗi startup/readiness fail-closed khi file thiếu, rỗng, không regular hoặc permission không an toàn.

Sau khi land, chạy lại `node ops/ai-service/artifact-contract.mjs` và full image build/digest publication cho exact commit. Phase 7 dark VM smoke và mọi live/cutover action vẫn là boundary riêng cần authorization.
