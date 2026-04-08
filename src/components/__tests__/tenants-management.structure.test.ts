import { describe, expect, it } from "vitest"
import * as fs from "fs"
import * as path from "path"

const tenantsManagementPath = path.resolve(__dirname, "../tenants-management.tsx")
const tenantsManagementSource = fs.readFileSync(tenantsManagementPath, "utf-8")
const tenantsManagementLineCount = tenantsManagementSource.split(/\r?\n/).length

describe("TenantsManagement source", () => {
  it("uses extracted tenant card rendering and avoids raw img tags", () => {
    expect(tenantsManagementSource).toContain("TenantsManagementTenantCard")
    expect(tenantsManagementSource).not.toContain("<img")
  })

  it("stays below the giant-component threshold for the main module", () => {
    expect(tenantsManagementLineCount).toBeLessThan(350)
  })
})
