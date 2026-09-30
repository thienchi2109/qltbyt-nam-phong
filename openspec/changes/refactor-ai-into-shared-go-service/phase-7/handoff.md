# Phase 7 Handoff

## 7.6 (2026-09-30)

Anh xác nhận Phase 7 đã xong ngày 2026-09-30. Checklist `7.1`–`7.6` được tick. `7.6` vẫn là mock/disposable: `usage.NewMemory` không gọi `ai_quota_reserve` / `ai_quota_finalize`, và read-only live ngày UTC `2026-09-30` không có reservation mới, rate event mới hay audit `assistant_query_database`. Ba RPC đó vẫn cần approval riêng trước một smoke live. Xác nhận này không mở Phase 8, Phase 9 hay cutover `/api/chat`.

Ngày: 2026-09-27

Target: `oracle-vps` (`ubuntu@149.118.148.179`)
Source: `a60898ba9ee82f1c6dd4f07ffbbfdbf85191cc2b`

Oracle dark artifacts và disposable candidate hiện đã chuẩn bị. Image phải
dùng ARM64 digest `sha256:6608456a8d43b2e53de543c90af845720bf4d439969b404d7a57d2a10bbd7c52`;
image đầu tiên build mặc định amd64 đã bị loại vì `exec format error`. Candidate
đang chạy non-root trên `127.0.0.1:18081`, còn service unit/production port
`127.0.0.1:8080` chưa start vì listener đó đang thuộc Coolify proxy.

Bốn source secret files giữ ở `/etc/qltbyt-ai/secrets/` (`root:root 0600`). Do
Docker Compose v5 trên Oracle không áp dụng `uid/gid/mode` cho file secrets,
`/etc/qltbyt-ai/runtime-secrets/` chứa runtime copies UID `65532` mode `0400`
và `/opt/qltbyt-ai/compose.oracle-secrets.yml` là override root-owned. Không ghi
secret value vào repo/evidence/log.

Cloudflare connector `qltbyt-ai-cloudflared-new` đang chạy host network bằng
digest `sha256:072c067d25ccbe61d46e18f0d0723255f2bb5304f7317caa95b27031520ff92c`.
Managed connector log version 2 xác nhận route:

```yaml
ingress:
  - hostname: ai-service.cdclims.cloud
    path: ^/v1/chat$
    service: http://127.0.0.1:18081
  - service: http_status:404
```

Public unauthenticated `POST /v1/chat` và `GET /v1/chat` đều bị Cloudflare
Access từ chối `403 Forbidden`; `/healthz`, `/readyz`, `/` và `/unrelated` đều
`404`. Không có `Location`, `WWW-Authenticate` hoặc Access-authenticated header,
nên Access denial và path scoping đã được chứng minh. Authenticated service-token
probe chưa chạy vì client ID/secret chỉ tồn tại trong trusted BFF environment,
không ở Oracle/repo; expected response sau khi chạy là `503` từ readiness mà
không gọi provider. Không có old cloudflared container để xoá.
`dqss-issue-508` không bị chạm.

Provider smoke chỉ có bằng chứng: Google `403` (~`0.096286s`); NVIDIA result
`transport-error` do collector lỗi, status/latency inconclusive và đã dừng retry.
Candidate `/healthz=200`, `/readyz=503` đúng fail-closed vì registry rỗng và
chưa có capability/broker composition. Adapter constants đã xác định tuple
`qltbyt` / `assistant-chat` / `v1`, nhưng `main.go` không đăng ký adapter; không
có production Broker transport, QueryExecutor/pool hoặc dedicated `ai_query_tool`
read-only DB wiring. Oracle env chưa có `AI_SERVICE_APP_ID`,
`AI_SERVICE_CAPABILITY_ID`, `AI_SERVICE_CAPABILITY_VERSION`. Không đăng ký
`Assistant` với dependency nil và không set IDs riêng lẻ vì sẽ làm readiness giả
thành công rồi fail ở broker/quota calls. Focused baseline
`go test -count=1 ./internal/qltbyt ./cmd/ai-service ./internal/registry` PASS.
Composition cần descriptor tuple, capability implementation, broker verifier,
dedicated query role, audit/quota wiring và signed BFF HMAC request; không tự
điền app/capability IDs.

Evidence đầy đủ ở `phase-7-evidence.md`. Đoạn này là checkpoint 2026-09-27.
Checklist Phase 7 được anh xác nhận đóng ngày 2026-09-30 ở đầu file. Cutover
`/api/chat` và live quota/audit write vẫn chưa xảy ra.
