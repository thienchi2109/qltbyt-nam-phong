import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const schedulerDir = path.resolve(process.cwd(), "ops/zbs-dispatch-scheduler")

function readSchedulerFile(fileName: string) {
  return fs.readFileSync(path.join(schedulerDir, fileName), "utf8")
}

describe("ZBS dispatch VM scheduler artifacts", () => {
  it("defines a Docker cron container that calls the guarded production endpoint safely", () => {
    expect(fs.existsSync(path.join(schedulerDir, "Dockerfile"))).toBe(true)
    expect(fs.existsSync(path.join(schedulerDir, "docker-compose.yml"))).toBe(true)
    expect(fs.existsSync(path.join(schedulerDir, "zbs-dispatch-cron.sh"))).toBe(true)
    expect(fs.existsSync(path.join(schedulerDir, ".env.example"))).toBe(true)

    const envExample = readSchedulerFile(".env.example")
    expect(envExample).toContain("ZBS_DISPATCH_URL=https://www.cvmems.vn/api/cron/zbs-dispatch")

    const compose = readSchedulerFile("docker-compose.yml")
    expect(compose).toContain("env_file:")
    expect(compose).toContain(".env")
    expect(compose).toContain("restart: unless-stopped")
    expect(compose).toContain('max-size: "10m"')
    expect(compose).not.toContain("CRON_SECRET=")

    const script = readSchedulerFile("zbs-dispatch-cron.sh")
    expect(script).toContain("flock -n")
    expect(script).toContain("curl --fail-with-body")
    expect(script).toContain("--connect-timeout 10")
    expect(script).toContain("--max-time 60")
    expect(script).toContain("Authorization: Bearer ${CRON_SECRET}")
    expect(script).not.toContain("set -x")
    expect(script).not.toContain("date -Iseconds")
    expect(script).toContain('date +"%Y-%m-%dT%H:%M:%S%z"')

    const dockerfile = readSchedulerFile("Dockerfile")
    expect(dockerfile).toContain("adduser")
    expect(dockerfile).toContain("supercronic")
    expect(dockerfile).toContain("-no-reap")
    expect(dockerfile).toContain("USER zbs")
    expect(dockerfile).toContain("COPY zbs-dispatch.cron /etc/crontabs/zbs")
    expect(dockerfile).not.toContain('CMD ["crond"')
  })
})
