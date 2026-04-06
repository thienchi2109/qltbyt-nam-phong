import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

function getLatestTransferRequestGetMigrationPath() {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations")
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.includes("transfer_request_get") && file.endsWith(".sql"))
    .sort()

  expect(migrationFiles.length).toBeGreaterThan(0)

  return path.join(migrationsDir, migrationFiles[migrationFiles.length - 1]!)
}

describe("transfer_request_get migration security", () => {
  it("does not require don_vi claims for regional_leader sessions", () => {
    const migrationPath = getLatestTransferRequestGetMigrationPath()
    const migrationSource = readFileSync(migrationPath, "utf8")

    expect(migrationSource).toContain("v_allowed := public.allowed_don_vi_for_session_safe();")
    expect(migrationSource).not.toContain("IF NOT v_is_global AND v_don_vi IS NULL THEN")
    expect(migrationSource).toContain("IF v_role <> 'regional_leader' AND v_don_vi IS NULL THEN")
  })
})
