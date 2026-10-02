import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = fs.realpathSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
)
const required = [
  "AI_SERVICE_IMAGE",
  "AI_SERVICE_HMAC_KEY_ID",
  "AI_SERVICE_HMAC_SECRET_FILE",
  "AI_SERVICE_BROKER_SECRET_FILE",
  "NVIDIA_API_KEY_FILE",
  "GOOGLE_GENERATIVE_AI_API_KEYS_FILE",
  "AI_SERVICE_USAGE_HOST_DIR",
  "AI_PROVIDER_CHAIN",
]

for (const name of required) {
  assert(process.env[name]?.trim(), `${name} is required`)
}

assert.match(process.env.AI_SERVICE_IMAGE, /^[^@\s]+@sha256:[0-9a-f]{64}$/)
if (process.env.AI_SERVICE_PREVIOUS_IMAGE?.trim()) {
  assert.match(process.env.AI_SERVICE_PREVIOUS_IMAGE, /^[^@\s]+@sha256:[0-9a-f]{64}$/)
}
assert.equal(
  process.env.AI_PROVIDER_CHAIN,
  "nvidia/google/gemma-4-31b-it,google/gemini-3.5-flash-lite"
)
assert.equal(process.env.AI_SERVICE_LISTEN_ADDR ?? "127.0.0.1:8080", "127.0.0.1:8080")
assert.equal(process.env.AI_SERVICE_DRAIN_GRACE ?? "60s", "60s")
assert.equal(process.env.AI_SERVICE_CLEANUP_GRACE ?? "5s", "5s")
assert.equal(
  process.env.AI_SERVICE_USAGE_DIR ?? "/var/lib/ai-service/usage",
  "/var/lib/ai-service/usage"
)
const maxConcurrent = Number(process.env.AI_SERVICE_MAX_CONCURRENT ?? 16)
assert(
  Number.isSafeInteger(maxConcurrent) && maxConcurrent > 0,
  "max concurrent must be a positive integer"
)
assert(
  parseDuration(process.env.AI_SERVICE_RESERVATION_TTL ?? "120s") >= 120,
  "reservation TTL must be at least 120s"
)

for (const name of required.slice(2, 6)) {
  const secretPath = fs.realpathSync(path.resolve(process.env[name]))
  const relative = path.relative(repoRoot, secretPath)
  assert(relative.startsWith(".."), `${name} must point outside the repository`)
  const stat = fs.statSync(secretPath)
  assert(stat.isFile(), `${name} must point to a regular file`)
  assert.equal(stat.mode & 0o077, 0, `${name} must not be group/world readable`)
}

const usageHostPath = path.resolve(process.env.AI_SERVICE_USAGE_HOST_DIR)
const usageRelative = path.relative(repoRoot, usageHostPath)
assert(
  usageRelative.startsWith(".."),
  "AI_SERVICE_USAGE_HOST_DIR must point outside the repository"
)
const usageLink = fs.lstatSync(usageHostPath)
assert(usageLink.isDirectory(), "AI_SERVICE_USAGE_HOST_DIR must point to a directory")
assert(!usageLink.isSymbolicLink(), "AI_SERVICE_USAGE_HOST_DIR must not be a symlink")
assert.equal(
  usageLink.mode & 0o077,
  0,
  "AI_SERVICE_USAGE_HOST_DIR must not be group/world accessible"
)
assert.equal(usageLink.uid, 65532, "AI_SERVICE_USAGE_HOST_DIR must be owned by UID 65532")
assert.equal(usageLink.gid, 65532, "AI_SERVICE_USAGE_HOST_DIR must be owned by GID 65532")

console.log("ai-service deployment config: PASS")

function parseDuration(value) {
  const match = /^(\d+)s$/.exec(value)
  assert(match, `duration must use whole seconds: ${value}`)
  return Number(match[1])
}
