import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const registryPath = resolve(process.cwd(), "supabase/db-quality-gate-tests.json")
const registry = JSON.parse(readFileSync(registryPath, "utf8")) as {
  tests: Array<{
    path: string
    requiredForMigrations?: string[]
  }>
}

describe("device quota draft export Phase 3.5 SQL registry", () => {
  it("registers the coherence test as required for the forward-only migration", () => {
    const test = registry.tests.find(
      (entry) => entry.path === "supabase/tests/device_quota_draft_excel_export_phase35.sql"
    )

    expect(test).toMatchObject({
      requiredForMigrations: [
        "supabase/migrations/20260906090000_device_quota_draft_excel_export_coherence.sql",
      ],
    })
  })
})
