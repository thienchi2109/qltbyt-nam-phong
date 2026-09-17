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

function runInjectedFailure(mode) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "web-push-chunk65-regression-"))
  const dockerShim = path.join(tempDir, "docker")
  const tarShim = path.join(tempDir, "tar")
  const state = path.join(tempDir, "fault-once")
  writeExecutable(
    dockerShim,
    `import fs from "node:fs"
import { spawnSync } from "node:child_process"
const args = process.argv.slice(2)
const mode = process.env.CHUNK65_FAULT
const state = process.env.CHUNK65_FAULT_STATE
const shouldFail =
  (mode === "history" && args[0] === "history") ||
  (mode === "cleanup-rm" && args[0] === "rm" && args[1] === "-f") ||
  (mode === "compose-stop" && args.includes("stop")) ||
  (mode === "compose-down" && args.includes("down"))
if (shouldFail && !fs.existsSync(state)) {
  fs.writeFileSync(state, "injected")
  process.exit(42)
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
const shouldFail =
  process.env.CHUNK65_FAULT === "layer-list" &&
  args.includes("-tf") &&
  args.some((entry) => entry.includes("/saved/"))
if (shouldFail && !fs.existsSync(state)) {
  fs.writeFileSync(state, "injected")
  process.exit(42)
}
const result = spawnSync(${JSON.stringify(tar)}, args, { stdio: "inherit" })
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
        CHUNK65_FAULT: mode,
        CHUNK65_FAULT_STATE: state,
      },
    })
    assert.notEqual(
      childResult.status,
      0,
      `${mode} fault unexpectedly passed: ${childResult.stdout || ""}`
    )
    assert.match(childResult.stdout || "", /"status": "FAIL"/)
    assert.doesNotMatch(childResult.stdout || "", /"status": "PASS"/)
    assert.doesNotMatch(
      `${childResult.stdout || ""}${childResult.stderr || ""}`,
      /CHUNK65_TEST_MARKER_/
    )
  } finally {
    assert.deepEqual(
      listTestResources(),
      before,
      `${mode} fault left a container behind: ${childResult?.stdout || ""}`
    )
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

for (const mode of ["history", "layer-list", "cleanup-rm", "compose-stop", "compose-down"]) {
  runInjectedFailure(mode)
}

console.log("chunk 6.5 smoke fault-injection regressions: PASS")
