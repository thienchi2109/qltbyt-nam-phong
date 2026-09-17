#!/usr/bin/env node

import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync, spawnSync } from "node:child_process"

const root = path.resolve(new URL("../..", import.meta.url).pathname)
const smoke = path.join(root, "ops/web-push/chunk-6.5-smoke.mjs")
const docker = execFileSync("which", ["docker"], { encoding: "utf8" }).trim()
const tar = execFileSync("which", ["tar"], { encoding: "utf8" }).trim()
const image = process.env.WEB_PUSH_IMAGE || "qltbyt-web-push:280bbead03d0"
const expectedImageId =
  process.env.WEB_PUSH_EXPECTED_IMAGE_ID ||
  "sha256:35fe490293289ad7d2f9c1882c0c08f81a013bfac78adb8873f2601b42717e91"
const expectedFailureStages = {
  history: /read image history/,
  "layer-list": /list image layer/,
  "cleanup-rm": /cleanup command failed/,
  "compose-stop": /stop Compose service/,
  "compose-down": /compose .* cleanup command failed/,
  "logs-stderr-secret": /direct logs exclude generated runtime secrets/,
}

function writeExecutable(file, source) {
  fs.writeFileSync(file, `#!/usr/bin/env node\n${source}\n`, { mode: 0o700 })
}

function listTestResources() {
  const names = ["chunk65-direct-", "web-push-chunk65-"]
  const containers = names.flatMap((name) => {
    const process = spawnSync(docker, ["ps", "-aq", "--filter", `name=${name}`], {
      encoding: "utf8",
    })
    assert.equal(process.status, 0)
    return (process.stdout || "").trim().split(/\r?\n/).filter(Boolean)
  })
  const networks = spawnSync(
    docker,
    ["network", "ls", "-q", "--filter", "name=web-push-chunk65-"],
    {
      encoding: "utf8",
    }
  )
  assert.equal(networks.status, 0)
  return [...containers, ...(networks.stdout || "").trim().split(/\r?\n/).filter(Boolean)]
}

function assertBaselineImage() {
  const process = spawnSync(docker, ["image", "inspect", "--format", "{{.Id}}", image], {
    encoding: "utf8",
  })
  assert.equal(process.status, 0, "regression image prerequisite is available")
  assert.equal(
    (process.stdout || "").trim(),
    expectedImageId,
    "regression image prerequisite matches expected immutable ID"
  )
}

function runInjectedFailure(mode) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "web-push-chunk65-regression-"))
  const dockerShim = path.join(tempDir, "docker")
  const tarShim = path.join(tempDir, "tar")
  const state = path.join(tempDir, "fault-once")
  const faultMarker = path.join(tempDir, "fault-activated")
  const logSecret = `CHUNK65_STDERR_SECRET_${Math.random().toString(16).slice(2)}`
  writeExecutable(
    dockerShim,
    `import fs from "node:fs"
import { spawnSync } from "node:child_process"
const args = process.argv.slice(2)
const mode = process.env.CHUNK65_FAULT
const state = process.env.CHUNK65_FAULT_STATE
const faultMarker = process.env.CHUNK65_FAULT_MARKER
const shouldFail =
  (mode === "logs-stderr-secret" && args[0] === "logs") ||
  (mode === "history" && args[0] === "history") ||
  (mode === "cleanup-rm" && args[0] === "rm" && args[1] === "-f") ||
  (mode === "compose-stop" && args[0] === "compose" && args.includes("stop")) ||
  (mode === "compose-down" && args[0] === "compose" && args.includes("down"))
if (shouldFail && !fs.existsSync(state)) {
  fs.writeFileSync(state, "injected")
  fs.writeFileSync(faultMarker, process.env.CHUNK65_FAULT + "\\n")
  if (mode === "logs-stderr-secret") {
    process.stderr.write(process.env.CHUNK65_TEST_SECRET + "\\n")
  } else {
    process.exit(42)
  }
}
const result = spawnSync(${JSON.stringify(docker)}, args, { stdio: "inherit" })
if (result.error) process.exit(127)
process.exit(result.status ?? 1)`
  )
  writeExecutable(
    tarShim,
    `import fs from "node:fs"
import { spawnSync } from "node:child_process"
const args = process.argv.slice(2)
const state = process.env.CHUNK65_FAULT_STATE
const faultMarker = process.env.CHUNK65_FAULT_MARKER
const shouldFail =
  process.env.CHUNK65_FAULT === "layer-list" &&
  args.includes("-tf") &&
  args.some((entry) => entry.includes("/saved/"))
if (shouldFail && !fs.existsSync(state)) {
  fs.writeFileSync(state, "injected")
  fs.writeFileSync(faultMarker, process.env.CHUNK65_FAULT + "\\n")
  process.exit(42)
}
const result = spawnSync(${JSON.stringify(tar)}, args, { stdio: "inherit" })
if (result.error) process.exit(127)
process.exit(result.status ?? 1)`
  )

  const before = listTestResources()
  let childResult
  let output = ""
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      childResult = spawnSync(process.execPath, [smoke], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${tempDir}${path.delimiter}${process.env.PATH}`,
          WEB_PUSH_IMAGE: image,
          WEB_PUSH_EXPECTED_IMAGE_ID: expectedImageId,
          CHUNK65_FAULT: mode,
          CHUNK65_FAULT_STATE: state,
          CHUNK65_FAULT_MARKER: faultMarker,
          CHUNK65_TEST_SECRET: logSecret,
        },
      })
      output = `${childResult.stdout || ""}${childResult.stderr || ""}`
      if (childResult.status === 0 || fs.existsSync(faultMarker) || attempt === 2) break
      assert.deepEqual(listTestResources(), before, `${mode} retry left a resource behind`)
    }
    assert.notEqual(childResult.status, 0, `${mode} fault unexpectedly passed: ${output}`)
    assert.match(output, /"status": "FAIL"/)
    assert.doesNotMatch(output, /"status": "PASS"/)
    assert.match(output, expectedFailureStages[mode])
    assert.equal(fs.readFileSync(faultMarker, "utf8"), `${mode}\n`)
    assert.doesNotMatch(output, /CHUNK65_TEST_MARKER_/)
    if (mode === "logs-stderr-secret") {
      assert.doesNotMatch(output, new RegExp(logSecret))
    }
  } finally {
    assert.deepEqual(
      listTestResources(),
      before,
      `${mode} fault left a container behind: ${childResult?.stdout || ""}`
    )
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

function runImageSubjectGuard() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "web-push-chunk65-image-guard-"))
  const dockerShim = path.join(tempDir, "docker")
  const violation = path.join(tempDir, "tag-violation")
  writeExecutable(
    dockerShim,
    `import fs from "node:fs"
import { spawnSync } from "node:child_process"
const args = process.argv.slice(2)
const requested = process.env.CHUNK65_REQUESTED_IMAGE_TAG
const violation = process.env.CHUNK65_TAG_VIOLATION
const imageInspect =
  (args[0] === "image" && args[1] === "inspect") ||
  (args[0] === "inspect" && args[1] === requested)
const usesRequestedTag = args.includes(requested)
const composeUsesRequestedTag =
  args[0] === "compose" && process.env.WEB_PUSH_IMAGE === requested
if ((usesRequestedTag && !imageInspect) || composeUsesRequestedTag) {
  fs.writeFileSync(violation, JSON.stringify({ args, image: process.env.WEB_PUSH_IMAGE }))
  process.exit(43)
}
const result = spawnSync(${JSON.stringify(docker)}, args, { stdio: "inherit" })
if (result.error) process.exit(127)
process.exit(result.status ?? 1)`
  )
  const before = listTestResources()
  let childResult
  try {
    childResult = spawnSync(process.execPath, [smoke], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${tempDir}${path.delimiter}${process.env.PATH}`,
        WEB_PUSH_IMAGE: image,
        WEB_PUSH_EXPECTED_IMAGE_ID: expectedImageId,
        CHUNK65_REQUESTED_IMAGE_TAG: image,
        CHUNK65_TAG_VIOLATION: violation,
      },
    })
    const output = `${childResult.stdout || ""}${childResult.stderr || ""}`
    assert.equal(childResult.status, 0, `image subject guard failed: ${output}`)
    assert.match(output, /"status": "PASS"/)
    assert.equal(fs.existsSync(violation), false, "verified image ID prevents tag retargeting")
  } finally {
    assert.deepEqual(
      listTestResources(),
      before,
      `image subject guard left a resource: ${childResult?.stdout || ""}`
    )
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

assertBaselineImage()
for (const mode of [
  "history",
  "layer-list",
  "cleanup-rm",
  "compose-stop",
  "compose-down",
  "logs-stderr-secret",
]) {
  runInjectedFailure(mode)
}
runImageSubjectGuard()

console.log("chunk 6.5 smoke fault-injection regressions: PASS")
