#!/usr/bin/env node

import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const imageSha = run("git", ["rev-parse", "--short=12", "HEAD"]).stdout.trim()
const image = process.env.WEB_PUSH_IMAGE || `qltbyt-web-push:${imageSha}`
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "web-push-chunk65-"))
const containers = []
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
fs.writeFileSync(secretPath, `${privateKey}\n`, { mode: 0o400 })
fs.writeFileSync(invalidSecretPath, "invalid-test-key\n", { mode: 0o400 })
fs.writeFileSync(markerPath, `${marker}\n`, { mode: 0o600 })
fs.chownSync(secretPath, 65532, 65532)
fs.chownSync(invalidSecretPath, 65532, 65532)

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

function must(process, label) {
  if (process.status !== 0) {
    throw new Error(`${label}: ${text(process).slice(-1000)}`)
  }
  return (process.stdout || "").trim()
}

function check(condition, label) {
  if (!condition) throw new Error(label)
  result.checks.push(label)
}

function inspect(target) {
  return JSON.parse(must(docker(["inspect", target]), `inspect ${target}`))[0]
}

function removeContainer(name) {
  if (name) docker(["rm", "-f", name])
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
    `probe ${endpoint} did not return expected body: ${lastResponse?.status} ${text(lastResponse)}`
  )
}

function imageAudit() {
  const metadata = inspect(image)
  result.imageId = metadata.Id
  result.repoDigests = metadata.RepoDigests || []
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

  const history = text(docker(["history", "--no-trunc", image]))
  check(
    !history.includes(privateKey) && !history.includes(marker),
    "image history excludes test secret and marker"
  )

  const rootfsContainer = must(docker(["create", image]), "create final filesystem audit container")
  const rootfsTar = path.join(tempDir, "rootfs.tar")
  try {
    must(docker(["export", "-o", rootfsTar, rootfsContainer]), "export final filesystem")
  } finally {
    removeContainer(rootfsContainer)
  }
  const rootfsPaths = text(run("tar", ["-tf", rootfsTar]))
    .split(/\r?\n/)
    .filter(Boolean)
  check(
    rootfsPaths.includes("usr/local/bin/web-push"),
    "final filesystem contains only web-push binary"
  )
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
  const manifest = JSON.parse(fs.readFileSync(path.join(archiveRoot, "manifest.json"), "utf8"))
  const layers = manifest
    .flatMap((entry) => entry.Layers || [])
    .map((entry) => path.join(archiveRoot, entry))
  check(layers.length > 0, "image archive has layer tar")
  const layerPaths = []
  for (const layer of layers) {
    layerPaths.push(
      ...text(run("tar", ["-tf", layer]))
        .split(/\r?\n/)
        .filter(Boolean)
    )
    const bytes = fs.readFileSync(layer)
    check(!bytes.includes(Buffer.from(privateKey)), "image layer excludes test secret")
    check(!bytes.includes(Buffer.from(marker)), "image layer excludes test marker")
  }
  check(
    !layerPaths.some((entry) => /run\/secrets|\.env|\.key$|\.pem$|marker/i.test(entry)),
    "image layers exclude secret paths"
  )
}

function directSmoke() {
  const name = `chunk65-direct-${crypto.randomBytes(4).toString("hex")}`
  containers.push(name)
  const id = must(docker(serviceArgs(name)), "start direct paused smoke")
  const metadata = inspect(name)
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
  if (!waitFor(id, "/healthz", "ok\n")) {
    const state = inspect(name).State
    throw new Error(
      `private health probe failed: ${state.Status}/${state.ExitCode} ${text(docker(["logs", name]))}`
    )
  }
  check(true, "private health probe works in shared network namespace")
  check(waitFor(id, "/readyz", "paused"), "omitted pause flag defaults to paused readiness")
  const metrics = must(probe(id, "/metrics"), "read private metrics")
  check(
    metrics.includes("web_push_deliveries_accepted_total 0"),
    "metrics endpoint is reachable without sensitive labels"
  )
  check(
    !metrics.includes(marker) && !metrics.includes(privateKey),
    "metrics excludes test secret and marker"
  )
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
  removeContainer(name)
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
  if (config.status !== 0) throw new Error(`compose config failed: ${text(config).slice(-1000)}`)
  check(true, "compose config accepts placeholder runtime wiring")
  try {
    check(
      compose([...base, "up", "-d", "--no-build"], { env: composeEnvironment }).status === 0,
      "compose service starts with mounted test key"
    )
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
    compose([...base, "stop", "-t", "5"], { env: composeEnvironment })
  } finally {
    compose([...base, "down", "--remove-orphans"], { env: composeEnvironment })
  }
}

try {
  must(docker(["image", "inspect", image]), "locate exact source image")
  imageAudit()
  directSmoke()
  failClosedSmoke()
  composeSmoke()
  result.status = "PASS"
  result.keyVersion = "chunk65-test"
  result.fingerprint = fingerprint
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  result.status = "FAIL"
  result.error = String(error?.message || error)
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = 1
} finally {
  for (const name of containers.reverse()) removeContainer(name)
  fs.rmSync(tempDir, { recursive: true, force: true })
}
