import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(import.meta.url))
const serviceRoot = path.resolve(root, "../../services/ai-service")
const entrypointPath = path.join(serviceRoot, "cmd/ai-service/main.go")
const read = (name) => fs.readFileSync(path.join(root, name), "utf8")
const dockerfile = read("../../services/ai-service/Dockerfile")
const compose = read("docker-compose.yml")
const env = read("ai-service.env.example")
const tunnel = read("cloudflared/config.yml.example")
const service = read("systemd/qltbyt-ai-service.service")
const access = read("cloudflared/access-policy.md")
const rollback = read("rollback-runbook.vi.md")
const validator = read("validate-config.mjs")
const ignore = read(".gitignore")

assert(fs.existsSync(entrypointPath), "services/ai-service/cmd/ai-service/main.go is required")
const entrypoint = fs.readFileSync(entrypointPath, "utf8")
assert.match(entrypoint, /^package main\b/m)
for (const name of [
  "AI_SERVICE_HMAC_SECRET_FILE",
  "AI_SERVICE_BROKER_SECRET_FILE",
  "NVIDIA_API_KEY_FILE",
  "GOOGLE_GENERATIVE_AI_API_KEYS_FILE",
]) {
  assert.match(entrypoint, new RegExp(name))
}
assert.match(entrypoint, /os\.ReadFile|readSecretFile/)
assert.match(entrypoint, /NVIDIA_API_KEY/)
assert.match(entrypoint, /GOOGLE_GENERATIVE_AI_API_KEYS/)
const buildDir = fs.mkdtempSync(path.join("/tmp", "qltbyt-ai-contract-"))
const build = spawnSync(
  "go",
  ["build", "-o", path.join(buildDir, "ai-service"), "./cmd/ai-service"],
  {
    cwd: serviceRoot,
    encoding: "utf8",
  }
)
fs.rmSync(buildDir, { recursive: true, force: true })
assert.equal(build.status, 0, `go build ./cmd/ai-service failed:\n${build.stderr || build.stdout}`)
const tests = spawnSync("go", ["test", "./cmd/ai-service"], {
  cwd: serviceRoot,
  encoding: "utf8",
})
assert.equal(tests.status, 0, `go test ./cmd/ai-service failed:\n${tests.stderr || tests.stdout}`)

assert.match(dockerfile, /golang:1\.26\.5-bookworm@sha256:[0-9a-f]{64}/)
assert.match(dockerfile, /busybox:1\.37\.0-musl@sha256:[0-9a-f]{64}/)
assert.match(dockerfile, /distroless\/static-debian12:nonroot@sha256:[0-9a-f]{64}/)
assert.match(dockerfile, /go env GOVERSION.*go1\.26\.5/s)
assert.match(dockerfile, /CGO_ENABLED=0/)
assert.match(dockerfile, /USER 65532:65532/)
assert.match(dockerfile, /org\.opencontainers\.image\.revision/)
assert.doesNotMatch(dockerfile, /qltbyt_test|API_KEY=|SECRET=/i)

assert.match(compose, /image: .*AI_SERVICE_IMAGE.*digest-pinned image/)
assert.match(compose, /network_mode: host/)
assert.match(compose, /AI_SERVICE_LISTEN_ADDR: "127\.0\.0\.1:8080"/)
assert.match(compose, /AI_SERVICE_DRAIN_GRACE: "60s"/)
assert.match(compose, /AI_SERVICE_CLEANUP_GRACE: "5s"/)
assert.match(compose, /AI_SERVICE_RESERVATION_TTL: "120s"/)
assert.match(compose, /AI_SERVICE_USAGE_DIR: "\/var\/lib\/ai-service\/usage"/)
assert.match(compose, /AI_SERVICE_USAGE_HOST_DIR/)
assert.match(compose, /target: \/var\/lib\/ai-service\/usage/)
assert.match(compose, /create_host_path: false/)
assert.match(compose, /read_only: true/)
assert.match(compose, /cap_drop:[\s\S]*- ALL/)
assert.match(compose, /no-new-privileges:true/)
assert.match(compose, /stop_grace_period: 65s/)
assert.match(compose, /mem_limit: "512m"/)
assert.match(compose, /cpus: "1\.0"/)
assert.match(compose, /pids_limit: 128/)
assert.match(compose, /\/run\/secrets\/nvidia_api_key/)
assert.match(compose, /\/run\/secrets\/google_generative_ai_api_keys/)
assert.doesNotMatch(compose, /NVIDIA_API_KEY:\s*['"]?[^$\s]/)
assert.doesNotMatch(compose, /GOOGLE_GENERATIVE_AI_API_KEY:\s*['"]?[^$\s]/)
assert.doesNotMatch(compose, /qltbyt_test/i)

assert.match(tunnel, /path: \^\/v1\/chat\$/)
assert.match(tunnel, /service: http:\/\/127\.0\.0\.1:8080/)
assert.doesNotMatch(tunnel, /healthz|readyz/)
assert.match(access, /AI_SERVICE_BFF_CF_ACCESS_CLIENT_SECRET/)
assert.match(access, /not published/i)

assert.match(service, /stop --timeout 65/)
assert.match(service, /TimeoutStopSec=90s/)
assert.match(rollback, /previous verified image/i)
assert.match(rollback, /digest/i)
assert.match(rollback, /no previous verified image/i)
assert.match(rollback, /không cutover/i)
assert.match(validator, /@sha256:\[0-9a-f\]\{64\}/)
assert.match(validator, /must point outside the repository/)
assert.match(validator, /must not be group\/world readable/)
assert.match(validator, /AI_SERVICE_PREVIOUS_IMAGE/)
assert.match(validator, /AI_SERVICE_USAGE_HOST_DIR/)
assert.match(validator, /UID 65532|UID 65532|uid, 65532/)
assert.match(ignore, /cloudflared\/credentials\.json/)
assert.match(ignore, /secrets\//)

for (const name of [
  "AI_SERVICE_HMAC_SECRET_FILE",
  "AI_SERVICE_BROKER_SECRET_FILE",
  "NVIDIA_API_KEY_FILE",
  "GOOGLE_GENERATIVE_AI_API_KEYS_FILE",
  "AI_SERVICE_USAGE_HOST_DIR",
]) {
  assert.match(env, new RegExp(`^${name}=`, "m"))
}
assert.doesNotMatch(env, /BEGIN (RSA|OPENSSH|PRIVATE) KEY/)

console.log("ai-service artifact contracts: PASS")
