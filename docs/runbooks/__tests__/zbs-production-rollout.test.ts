import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("ZBS production rollout runbook", () => {
  const runbookPath = path.resolve(process.cwd(), "docs/runbooks/zbs-production-rollout.md")

  it("covers the Phase 5 operator checklist from issue 622", () => {
    const runbook = fs.readFileSync(runbookPath, "utf8")

    expect(runbook).toContain("ZALO_ZBS_APP_ID")
    expect(runbook).toContain("ZALO_ZBS_APP_SECRET")
    expect(runbook).toContain("ZALO_ZBS_INITIAL_REFRESH_TOKEN")
    expect(runbook).toContain("ZALO_ZBS_DISPATCH_ENABLED")
    expect(runbook).toContain("ZBS_INTERNAL_RPC_SECRET")
    expect(runbook).toContain("CRON_SECRET")
    expect(runbook).toContain("pending")
    expect(runbook).toContain("sent")
    expect(runbook).toContain("failed")
    expect(runbook).toContain("retryable")
    expect(runbook).toContain("provider Success")
    expect(runbook).toContain("delivery webhook is deprecated")
    expect(runbook).toContain("ZALO_ZBS_DISPATCH_ENABLED=false")
    expect(runbook).toMatch(/Production enablement decision/i)
  })

  it("does not reintroduce static access-token env as production source of truth", () => {
    const runbook = fs.readFileSync(runbookPath, "utf8")

    expect(runbook).not.toMatch(/ZALO_ZBS_ACCESS_TOKEN=.*production/i)
  })
})
