# Runbook triển khai và rollback shared AI service

Phạm vi của runbook này là chuẩn bị và vận hành dark candidate trên Oracle VM.
Không chạy live DB migration, không cutover `/api/chat`, không tắt route sản xuất
hiện tại và không dùng credential của `qltbyt_test`.

Kiểm tra artefact trước khi đóng gói: `node ops/ai-service/artifact-contract.mjs`.
Trên Oracle VM, nạp env file rồi chạy `node ops/ai-service/validate-config.mjs`;
script fail closed nếu image không có digest hoặc secret nằm trong
repository/group-readable.

```sh
set -a
. /etc/qltbyt-ai/ai-service.env
set +a
node /opt/qltbyt-ai/validate-config.mjs
```

## Chuẩn bị image

Build từ thư mục `services/ai-service` bằng Dockerfile đã pin Go `1.26.5` và
base image bằng digest. Publish image theo tag bất biến, sau đó lấy digest registry
và chỉ ghi giá trị `registry/name@sha256:<64 hex>` vào
`/etc/qltbyt-ai/ai-service.env`.

```sh
docker build --pull=false --no-cache --build-arg VCS_REF=<commit> -t registry.example/qltbyt/ai-service:<commit> services/ai-service
docker push registry.example/qltbyt/ai-service:<commit>
docker inspect --format '{{index .RepoDigests 0}}' registry.example/qltbyt/ai-service:<commit>
```

Giữ image digest đã verify trước đó trong bản sao cấu hình bảo mật. Ghi hash của
`docker-compose.yml`, Tunnel config và env không chứa secret vào deployment record.

## Deploy dark

Đặt bốn secret file ngoài Git, owner root, mode `0600`; Compose mount read-only
vào container. `AI_SERVICE_IMAGE` bắt buộc là digest, còn
`AI_SERVICE_PREVIOUS_IMAGE` chỉ được dùng khi đã có image trước đó. Kiểm tra cấu
hình trước khi start:

```sh
docker compose --env-file /etc/qltbyt-ai/ai-service.env -f /opt/qltbyt-ai/docker-compose.yml config --quiet
systemctl start qltbyt-ai-service
curl --fail --silent http://127.0.0.1:8080/healthz
curl --fail --silent http://127.0.0.1:8080/readyz
```

`/healthz` và `/readyz` chỉ được gọi từ Oracle host/private path. Tunnel chỉ route
`POST /v1/chat`; Access service token chỉ nằm ở trusted BFF.

## Rollback

Rollback là thao tác image và cấu hình của operator. Dừng nhận request mới bằng
`systemctl stop qltbyt-ai-service`; stop timeout `65s` bao gồm drain `60s` và
cleanup margin `5s`, với systemd timeout `90s`. Khôi phục env và Tunnel config đã
verify cùng hash, thay `AI_SERVICE_IMAGE` bằng digest trước đó, rồi start lại và
kiểm tra hai probe local.

```sh
cp /etc/qltbyt-ai/releases/<verified>/ai-service.env /etc/qltbyt-ai/ai-service.env
cp /etc/qltbyt-ai/releases/<verified>/config.yml /etc/cloudflared/ai-service/config.yml
systemctl restart qltbyt-ai-service
systemctl restart cloudflared-ai-service
curl --fail --silent http://127.0.0.1:8080/readyz
```

Nếu dark first deploy thất bại và không có previous verified image (no previous verified image), giữ candidate
ở trạng thái unavailable và chặn cutover. Route `/api/chat` sản xuất hiện tại vẫn
hoạt động; không tạo fallback runtime về Next.js sau cutover.
