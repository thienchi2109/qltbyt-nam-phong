#!/usr/bin/env node

import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"
import { createCleanup } from "./chunk-6.5-cleanup.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const imageSha = run("git", ["rev-parse", "--short=12", "HEAD"]).stdout.trim()
const image = process.env.WEB_PUSH_IMAGE || `qltbyt-web-push:${imageSha}`
const expectedImageId = process.env.WEB_PUSH_EXPECTED_IMAGE_ID || ""
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "web-push-chunk65-"))
const containers = new Set()
const composeProjects = new Map()
const result = { image, checks: [] }
const rawPrivateKey = Buffer.alloc(32, 1)
const ecdh = crypto.createECDH("prime256v1")
ecdh.setPrivateKey(rawPrivateKey)
const publicBytes = ecdh.getPublicKey(null, "uncompressed")
const privateKey = rawPrivateKey.toString("base64url")
const publicKey = publicBytes.toString("base64url")
const fingerprint = `sha256:${crypto.createHash("sha256").update(publicBytes).digest("hex")}`
const hmacSecret = crypto.randomBytes(32).toString("base64url")
const marker = `CHUNK65_TEST_MARKER_${crypto.randomBytes(18).toString("hex")}`
const secretPath = path.join(tempDir, "vapid.key")
const invalidSecretPath = path.join(tempDir, "invalid.key")
const markerPath = path.join(tempDir, "marker.txt")
const secretNeedles = [privateKey, hmacSecret, marker]

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: root, encoding: "utf8", ...options })
}

function docker(args, options) {
  return run("docker", args, options)
}

function compose(args, options) {
  return docker(["compose", ...args], options)
}

function text(process) {
  return `${process.stdout || ""}\n${process.stderr || ""}`.trim()
}

function redactSecrets(value) {
  let redacted = String(value || "")
  for (const needle of secretNeedles) {
    if (needle) redacted = redacted.split(needle).join("[REDACTED]")
  }
  return redacted
}

function containsSecret(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value || ""))
  return secretNeedles.some((needle) => bytes.includes(Buffer.from(needle)))
}

function must(process, label) {
  if (process.status !== 0) {
    throw new Error(`${label}: ${redactSecrets(text(process)).slice(-1000)}`)
  }
  return (process.stdout || "").trim()
}

function parseJson(value, label) {
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${label}: invalid JSON`)
  }
}

function check(condition, label) {
  if (!condition) throw new Error(label)
  result.checks.push(label)
}

function inspect(target) {
  const parsed = parseJson(
    must(docker(["inspect", target]), `inspect ${target}`),
    `inspect ${target}`
  )
  if (!Array.isArray(parsed) || parsed.length === 0)
    throw new Error(`inspect ${target}: empty response`)
  return parsed[0]
}

function mountedSecretHash(container) {
  const output = must(
    docker([
      "run",
      "--rm",
      "--volumes-from",
      container,
      "busybox:1.36",
      "sha256sum",
      "/run/secrets/web_push_vapid_private_key",
    ]),
    "read mounted test key hash"
  )
  const hash = output.match(/^[0-9a-f]{64}/)?.[0]
  if (!hash) throw new Error("mounted test key hash: invalid output")
  return hash
}

function serviceArgs(name, secret = secretPath, extra = {}, detached = true, remove = false) {
  const args = ["run"]
  if (detached) args.push("-d")
  if (remove) args.push("--rm")
  args.push(
    "--name",
    name,
    "--network",
    "none",
    "--read-only",
    "--user",
    "65532:65532",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "--mount",
    `type=bind,src=${secret},dst=/run/secrets/web_push_vapid_private_key,readonly`
  )
  const environment = {
    WEB_PUSH_ORIGIN: "https://backend.invalid",
    WEB_PUSH_WORKER_ID: "chunk65-smoke",
    WEB_PUSH_VAPID_KEY_VERSION: "chunk65-test",
    WEB_PUSH_VAPID_PUBLIC_KEY: publicKey,
    WEB_PUSH_VAPID_FINGERPRINT: fingerprint,
    WEB_PUSH_VAPID_SUBJECT: "mailto:chunk65@example.invalid",
    WEB_PUSH_HMAC_KEY_ID: "chunk65-test-key",
    WEB_PUSH_HMAC_SECRET: hmacSecret,
    WEB_PUSH_VAPID_PRIVATE_KEY_PATH: "/run/secrets/web_push_vapid_private_key",
    ...extra,
  }
  for (const [key, value] of Object.entries(environment)) args.push("--env", `${key}=${value}`)
  args.push(image)
  return args
}

function probe(container, endpoint) {
  return docker([
    "run",
    "--rm",
    "--network",
    `container:${container}`,
    "busybox:1.36",
    "wget",
    "-q",
    "-O",
    "-",
    `http://127.0.0.1:8080${endpoint}`,
  ])
}

function waitFor(container, endpoint, expected) {
  let lastResponse
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = probe(container, endpoint)
    lastResponse = response
    if (response.status === 0 && text(response) === expected.trim()) return true
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
  }
  throw new Error(
    `probe ${endpoint} did not return expected body: ${lastResponse?.status} ${redactSecrets(text(lastResponse))}`
  )
}

function imageAudit() {
  check(Boolean(expectedImageId), "expected image ID is provided")
  check(/^sha256:[0-9a-f]{64}$/.test(expectedImageId), "expected image ID is a SHA-256 content ID")
  const metadata = inspect(image)
  result.imageId = metadata.Id
  result.expectedImageId = expectedImageId
  result.repoDigests = metadata.RepoDigests || []
  check(metadata.Id === expectedImageId, "image ID matches expected content ID")
  check(
    !containsSecret(JSON.stringify(metadata)),
    "image metadata excludes generated runtime secrets"
  )
  check(metadata.Config.User === "65532:65532", "image user is 65532:65532")
  check(
    JSON.stringify(metadata.Config.Entrypoint) === JSON.stringify(["/usr/local/bin/web-push"]),
    "image entrypoint is web-push"
  )
  check(
    (metadata.Config.Env || []).every(
      (entry) => !/(WEB_PUSH|HMAC|VAPID|SECRET|PRIVATE|MARKER)/i.test(entry)
    ),
    "image environment has no secret configuration"
  )
  check(result.repoDigests.length === 0, "image has no registry digest or publish")

  const history = must(docker(["history", "--no-trunc", image]), "read image history")
  check(!containsSecret(history), "image history excludes generated runtime secrets")

  const rootfsContainer = must(docker(["create", image]), "create final filesystem audit container")
  containers.add(rootfsContainer)
  const rootfsTar = path.join(tempDir, "rootfs.tar")
  try {
    must(docker(["export", "-o", rootfsTar, rootfsContainer]), "export final filesystem")
  } finally {
    removeContainer(rootfsContainer)
  }
  check(
    !containsSecret(fs.readFileSync(rootfsTar)),
    "final filesystem archive excludes generated runtime secrets"
  )
  const rootfsPaths = must(run("tar", ["-tf", rootfsTar]), "list final filesystem")
    .split(/\r?\n/)
    .filter(Boolean)
  check(rootfsPaths.includes("usr/local/bin/web-push"), "final filesystem contains web-push binary")
  check(
    rootfsPaths.includes("etc/ssl/certs/ca-certificates.crt"),
    "final filesystem contains CA bundle"
  )
  check(
    !rootfsPaths.some((entry) => /run\/secrets|\.env|\.key$|\.pem$|marker/i.test(entry)),
    "final filesystem excludes secret paths"
  )

  const archivePath = path.join(tempDir, "image.tar")
  must(docker(["save", "-o", archivePath, image]), "save image archive")
  const archiveRoot = path.join(tempDir, "saved")
  fs.mkdirSync(archiveRoot)
  must(run("tar", ["-xf", archivePath, "-C", archiveRoot]), "extract image archive")
  const manifest = parseJson(
    fs.readFileSync(path.join(archiveRoot, "manifest.json"), "utf8"),
    "image manifest"
  )
  if (!Array.isArray(manifest)) throw new Error("image manifest: expected an array")
  const layers = manifest
    .flatMap((entry) => entry.Layers || [])
    .map((entry) => path.join(archiveRoot, entry))
  check(layers.length > 0, "image archive has layer tar")
  const layerPaths = []
  for (const layer of layers) {
    const paths = must(run("tar", ["-tf", layer]), `list image layer ${path.basename(layer)}`)
      .split(/\r?\n/)
      .filter(Boolean)
    layerPaths.push(...paths)
    const bytes = fs.readFileSync(layer)
    check(!containsSecret(bytes), "image layer excludes generated runtime secrets")
  }
  check(
    !layerPaths.some((entry) => /run\/secrets|\.env|\.key$|\.pem$|marker/i.test(entry)),
    "image layers exclude secret paths"
  )
}

function directSmoke() {
  const name = `chunk65-direct-${crypto.randomBytes(4).toString("hex")}`
  containers.add(name)
  const id = must(docker(serviceArgs(name)), "start direct paused smoke")
  const metadata = inspect(name)
  const secretBytes = fs.readFileSync(secretPath)
  const secretHash = crypto.createHash("sha256").update(secretBytes).digest("hex")
  check(metadata.HostConfig.ReadonlyRootfs === true, "direct container has read-only rootfs")
  check(metadata.Config.User === "65532:65532", "direct container runs as nonroot")
  check(
    !metadata.HostConfig.PortBindings || Object.keys(metadata.HostConfig.PortBindings).length === 0,
    "direct container publishes no ports"
  )
  const mount = (metadata.Mounts || []).find(
    (entry) => entry.Destination === "/run/secrets/web_push_vapid_private_key"
  )
  check(Boolean(mount && mount.RW === false), "secret mount is read-only")
  const mountedHash = mountedSecretHash(id)
  check(mountedHash === secretHash, "direct container mounts expected test key bytes")
  if (!waitFor(id, "/healthz", "ok\n")) {
    const state = inspect(name).State
    throw new Error(
      `private health probe failed: ${state.Status}/${state.ExitCode} ${redactSecrets(text(docker(["logs", name])))}`
    )
  }
  check(true, "private health probe works in shared network namespace")
  check(waitFor(id, "/readyz", "paused"), "omitted pause flag defaults to paused readiness")
  const metrics = must(probe(id, "/metrics"), "read private metrics")
  check(
    metrics.includes("web_push_deliveries_accepted_total 0"),
    "metrics endpoint is reachable without sensitive labels"
  )
  check(!containsSecret(metrics), "metrics excludes generated runtime secrets")
  const diff = text(docker(["diff", name]))
    .split(/\r?\n/)
    .filter(Boolean)
  check(
    diff.every((entry) => /^A \/run(?:\/secrets(?:\/web_push_vapid_private_key)?)?$/.test(entry)),
    "read-only paused container has no application filesystem diff"
  )
  check(docker(["stop", "-t", "5", name]).status === 0, "direct SIGTERM shutdown returns zero")
  check(
    must(docker(["wait", name]), "wait direct shutdown") === "0",
    "direct shutdown exit code is zero"
  )
  must(docker(["start", name]), "restart direct paused smoke")
  const restartedMetadata = inspect(name)
  const restartedMount = (restartedMetadata.Mounts || []).find(
    (entry) => entry.Destination === "/run/secrets/web_push_vapid_private_key"
  )
  check(restartedMetadata.Id === id, "restart reuses the same direct container")
  check(
    Boolean(
      restartedMount && restartedMount.RW === false && restartedMount.Source === mount.Source
    ),
    "restart reuses the same read-only test key mount"
  )
  check(
    Buffer.compare(fs.readFileSync(secretPath), secretBytes) === 0,
    "restart leaves test key bytes unchanged"
  )
  check(
    crypto.createHash("sha256").update(fs.readFileSync(secretPath)).digest("hex") === secretHash,
    "restart leaves test key hash unchanged"
  )
  check(mountedSecretHash(id) === secretHash, "restart preserves mounted test key hash")
  check(waitFor(id, "/healthz", "ok\n"), "restarted private health probe works")
  check(waitFor(id, "/readyz", "paused"), "restarted private readiness remains paused")
  const restartedMetrics = must(probe(id, "/metrics"), "read private metrics after restart")
  check(
    restartedMetrics.includes("web_push_deliveries_accepted_total 0"),
    "restart performs no delivery"
  )
  check(!containsSecret(restartedMetrics), "restarted metrics exclude generated runtime secrets")
  must(docker(["stop", "-t", "5", name]), "stop restarted direct smoke")
  check(
    must(docker(["wait", name]), "wait restarted shutdown") === "0",
    "restarted shutdown exit code is zero"
  )
  const logs = must(docker(["logs", name]), "read direct smoke logs")
  check(!containsSecret(logs), "direct logs exclude generated runtime secrets")
}

function failClosedSmoke() {
  const mismatch = `chunk65-mismatch-${crypto.randomBytes(4).toString("hex")}`
  const mismatchProcess = docker(
    serviceArgs(mismatch, secretPath, { WEB_PUSH_VAPID_PUBLIC_KEY: "wrong" }, false, true)
  )
  check(
    mismatchProcess.status === 1 &&
      text(mismatchProcess).includes("web_push_error code=vapid_artifact_mismatch"),
    "mismatched public artifact fails closed"
  )

  const invalid = `chunk65-invalid-${crypto.randomBytes(4).toString("hex")}`
  const invalidProcess = docker(serviceArgs(invalid, invalidSecretPath, {}, false, true))
  check(
    invalidProcess.status === 1 &&
      text(invalidProcess).includes("web_push_error code=vapid_unavailable"),
    "invalid key fails closed"
  )
}

function composeSmoke() {
  const project = `web-push-chunk65-${crypto.randomBytes(4).toString("hex")}`
  const composeFile = path.join(root, "ops/web-push/docker-compose.yml")
  const composeEnvironment = {
    ...process.env,
    WEB_PUSH_IMAGE: image,
    WEB_PUSH_ORIGIN: "https://backend.invalid",
    WEB_PUSH_VAPID_KEY_VERSION: "chunk65-test",
    WEB_PUSH_VAPID_PUBLIC_KEY: publicKey,
    WEB_PUSH_VAPID_FINGERPRINT: fingerprint,
    WEB_PUSH_VAPID_PRIVATE_KEY_FILE: secretPath,
    WEB_PUSH_VAPID_SUBJECT: "mailto:chunk65@example.invalid",
    WEB_PUSH_HMAC_KEY_ID: "chunk65-test-key",
    WEB_PUSH_HMAC_SECRET: hmacSecret,
  }
  delete composeEnvironment.WEB_PUSH_PAUSED
  const base = ["-p", project, "-f", composeFile]
  const config = compose([...base, "config", "--quiet"], { env: composeEnvironment })
  must(config, "compose config")
  check(true, "compose config accepts placeholder runtime wiring")
  composeProjects.set(project, { base, env: composeEnvironment })
  try {
    must(
      compose([...base, "up", "-d", "--no-build"], { env: composeEnvironment }),
      "compose service start"
    )
    check(true, "compose service starts with mounted test key")
    const id = must(
      compose([...base, "ps", "-q", "web-push"], { env: composeEnvironment }),
      "compose container id"
    )
    const metadata = inspect(id)
    check(metadata.Config.User === "65532:65532", "compose container runs as nonroot")
    check(metadata.HostConfig.ReadonlyRootfs === true, "compose container rootfs is read-only")
    check(
      !metadata.HostConfig.PortBindings ||
        Object.keys(metadata.HostConfig.PortBindings).length === 0,
      "compose publishes no ports"
    )
    const mount = (metadata.Mounts || []).find(
      (entry) => entry.Destination === "/run/secrets/web_push_vapid_private_key"
    )
    check(Boolean(mount && mount.RW === false), "compose secret mount is read-only")
    check(waitFor(id, "/readyz", "paused"), "compose private readiness returns paused")
    must(compose([...base, "stop", "-t", "5"], { env: composeEnvironment }), "stop Compose service")
  } finally {
    cleanupComposeProject(project)
  }
}

const { cleanupComposeProject, cleanupResources, removeContainer } = createCleanup({
  check,
  compose,
  composeProjects,
  containers,
  docker,
  redactSecrets,
  tempDir,
})

try {
  fs.writeFileSync(secretPath, `${privateKey}\n`, { mode: 0o400 })
  fs.writeFileSync(invalidSecretPath, "invalid-test-key\n", { mode: 0o400 })
  fs.writeFileSync(markerPath, `${marker}\n`, { mode: 0o600 })
  fs.chownSync(secretPath, 65532, 65532)
  fs.chownSync(invalidSecretPath, 65532, 65532)
  must(docker(["image", "inspect", image]), "locate exact source image")
  imageAudit()
  directSmoke()
  failClosedSmoke()
  composeSmoke()
  result.status = "PASS"
  result.keyVersion = "chunk65-test"
  result.fingerprint = fingerprint
} catch (error) {
  result.status = "FAIL"
  result.error = redactSecrets(error?.message || error)
  process.exitCode = 1
}

try {
  cleanupResources()
} catch (error) {
  result.status = "FAIL"
  result.error = [result.error, redactSecrets(error?.message || error)].filter(Boolean).join("; ")
  process.exitCode = 1
}

console.log(JSON.stringify(result, null, 2))
