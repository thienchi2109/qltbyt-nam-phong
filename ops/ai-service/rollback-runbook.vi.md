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

Build **trực tiếp trên Oracle VM ARM64** (`uname -m` phải là `aarch64`), không
chạy lệnh build ARM64 trên VPS x86 hiện tại. Build từ thư mục
`services/ai-service` bằng Dockerfile đã pin Go `1.26.5` và base image bằng
digest. Source phải đúng clean commit cần triển khai. Publish image theo tag bất
biến, sau đó lấy digest registry và chỉ ghi giá trị `registry/name@sha256:<64 hex>` vào
`/etc/qltbyt-ai/ai-service.env`.

```sh
test "$(uname -m)" = aarch64
test -z "$(git status --short)"
test "$(git rev-parse HEAD)" = "<commit>"
docker build --platform linux/arm64 --pull=false --no-cache \
  --build-arg TARGETARCH=arm64 --build-arg VCS_REF=<commit> \
  -t registry.example/qltbyt/ai-service:<commit> services/ai-service
docker image inspect --format 'arch={{.Architecture}} os={{.Os}} revision={{index .Config.Labels "org.opencontainers.image.revision"}} id={{.Id}}' registry.example/qltbyt/ai-service:<commit>
docker push registry.example/qltbyt/ai-service:<commit>
docker image inspect --format '{{index .RepoDigests 0}}' registry.example/qltbyt/ai-service:<commit>
```

Oracle candidate là ARM64; nếu thiếu `TARGETARCH=arm64`, Docker có thể đóng gói
binary `x86-64` vào image ARM64 và container sẽ restart với lỗi entrypoint không
tồn tại. Kiểm tra kiến trúc binary trong image trước khi recreate candidate.

Giữ image digest đã verify trước đó trong bản sao cấu hình bảo mật. Ghi hash của
`docker-compose.yml`, Tunnel config và env không chứa secret vào deployment record.

## Deploy dark

Đặt bốn secret file ngoài Git, owner root, mode `0600`; Compose mount read-only
vào container. `AI_SERVICE_IMAGE` bắt buộc là digest, còn
`AI_SERVICE_PREVIOUS_IMAGE` chỉ được dùng khi đã có image trước đó. Kiểm tra cấu
hình trước khi start. Journal directory phải nằm ngoài repository, không là
symlink, owner `65532:65532`, mode `0700`; `AI_SERVICE_USAGE_DIR` luôn là
`/var/lib/ai-service/usage`:

```sh
docker compose --env-file /etc/qltbyt-ai/ai-service.env -f /opt/qltbyt-ai/docker-compose.yml config --quiet
test "$(stat -c '%u:%g:%a' "$AI_SERVICE_USAGE_HOST_DIR")" = "65532:65532:700"
systemctl start qltbyt-ai-service
curl --fail --silent http://127.0.0.1:8080/healthz
curl --fail --silent http://127.0.0.1:8080/readyz
```

`/healthz` và `/readyz` chỉ được gọi từ Oracle host/private path. Tunnel chỉ route
`POST /v1/chat`; Access service token chỉ nằm ở trusted BFF.

## Recreate dark candidate bằng Docker thủ công

Phần này chỉ dành cho candidate disposable trên Oracle VM khi Compose/systemd
không phải là đường chạy đang được dùng. Không thao tác trực tiếp lên
`qltbyt-ai-service` production. Luôn giữ container cũ để rollback; không dùng
`docker rm -f` trước khi container mới đã được tạo và kiểm tra.

Các biến `*_FILE` trong env của container phải trỏ tới đường dẫn **bên trong
container** (`/run/secrets/...`). Đường dẫn `/etc/qltbyt-ai/...` chỉ là đường dẫn
file secret trên host và không được đưa nguyên vào env của container. `AI_SERVICE_USAGE_HOST_DIR`
là đường dẫn journal trên host; target cố định trong container là
`/var/lib/ai-service/usage`.

```sh
set -eu
candidate=qltbyt-ai-service-candidate
previous="${candidate}-previous-<old-revision>"
image='qltbyt/ai-service:<verified-revision-or-digest>'
usage_host_dir="${AI_SERVICE_USAGE_HOST_DIR:?set journal host directory}"
tmp_env="/root/${candidate}.env.recreate"
rollback_ready=0

restore_previous() {
  status=$?
  if [ "$status" -ne 0 ] && [ "$rollback_ready" -eq 1 ]; then
    docker rm -f "$candidate" >/dev/null 2>&1 || true
    docker rename "$previous" "$candidate" >/dev/null 2>&1 || true
    docker start "$candidate" >/dev/null 2>&1 || true
  fi
  rm -f "$tmp_env" "${tmp_env}.new"
  exit "$status"
}
trap restore_previous EXIT

# Lưu env hiện tại mà không in secret ra terminal.
if docker container inspect "$previous" >/dev/null 2>&1; then
  echo "previous container name already exists; choose a new rollback name" >&2
  exit 1
fi
docker inspect "$candidate" --format '{{range .Config.Env}}{{println .}}{{end}}' > "$tmp_env"
chmod 600 "$tmp_env"
sed -i \
  -e 's#^AI_SERVICE_HMAC_SECRET_FILE=.*#AI_SERVICE_HMAC_SECRET_FILE=/run/secrets/ai_service_hmac_secret#' \
  -e 's#^AI_SERVICE_BROKER_SECRET_FILE=.*#AI_SERVICE_BROKER_SECRET_FILE=/run/secrets/ai_service_broker_secret#' \
  -e 's#^NVIDIA_API_KEY_FILE=.*#NVIDIA_API_KEY_FILE=/run/secrets/nvidia_api_key#' \
  -e 's#^GOOGLE_GENERATIVE_AI_API_KEYS_FILE=.*#GOOGLE_GENERATIVE_AI_API_KEYS_FILE=/run/secrets/google_generative_ai_api_keys#' \
  "$tmp_env"
grep -v '^AI_SERVICE_USAGE_DIR=' "$tmp_env" | grep -v '^AI_SERVICE_USAGE_HOST_DIR=' > "${tmp_env}.new"
printf '%s\n%s\n' \
  'AI_SERVICE_USAGE_DIR=/var/lib/ai-service/usage' \
  "AI_SERVICE_USAGE_HOST_DIR=$usage_host_dir" >> "${tmp_env}.new"
mv "${tmp_env}.new" "$tmp_env"
test -d "$usage_host_dir"
test ! -L "$usage_host_dir"
test "$(stat -c '%u:%g:%a' "$usage_host_dir")" = "65532:65532:700"

# Dừng và đổi tên container cũ để giữ nguyên rollback; không xóa nó.
docker stop --time 65 "$candidate"
docker rename "$candidate" "$previous"
rollback_ready=1

docker run -d --name "$candidate" --restart unless-stopped \
  --env-file "$tmp_env" --network host --user 65532:65532 \
  --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --stop-signal SIGTERM --stop-timeout 65 --memory 512m --cpus 1.0 --pids-limit 128 \
  --ulimit nofile=4096:4096 --tmpfs /tmp:rw,noexec,nosuid,size=16m --init \
  --mount type=bind,src="$usage_host_dir",dst=/var/lib/ai-service/usage \
  --mount type=bind,src=/etc/qltbyt-ai/runtime-secrets/nvidia.api-key,dst=/run/secrets/nvidia_api_key,readonly \
  --mount type=bind,src=/etc/qltbyt-ai/runtime-secrets/google.api-keys,dst=/run/secrets/google_generative_ai_api_keys,readonly \
  --mount type=bind,src=/etc/qltbyt-ai/runtime-secrets/hmac.secret,dst=/run/secrets/ai_service_hmac_secret,readonly \
  --mount type=bind,src=/etc/qltbyt-ai/runtime-secrets/broker.secret,dst=/run/secrets/ai_service_broker_secret,readonly \
  "$image"
rollback_ready=0
rm -f "$tmp_env"

curl --fail --silent http://127.0.0.1:18081/healthz
curl --fail --silent http://127.0.0.1:18081/readyz
```

Không truyền `--health-cmd` dạng chuỗi cho image distroless: Docker sẽ tạo
`CMD-SHELL` nhưng image không có `/bin/sh`. Dùng hai probe host ở trên, hoặc
healthcheck dạng mảng `CMD` trong Compose. Nếu probe thất bại, giữ log và khôi
phục container cũ:

```sh
docker rm -f qltbyt-ai-service-candidate
docker rename "${candidate}-previous-<old-revision>" qltbyt-ai-service-candidate
docker start qltbyt-ai-service-candidate
```

Chỉ xóa container previous sau khi candidate mới đã qua cả hai probe và đã có
release record ghi revision, digest, env/config hash và thời điểm kiểm tra.

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
