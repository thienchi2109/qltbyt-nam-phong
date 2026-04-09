import { describe, expect, it } from "vitest"
import * as fs from "fs"
import * as path from "path"

const tenantsManagementPath = path.resolve(__dirname, "../tenants-management.tsx")
const tenantsManagementSource = fs.readFileSync(tenantsManagementPath, "utf-8")
const tenantsManagementLineCount = tenantsManagementSource.split(/\r?\n/).length
const tenantsManagementCardPath = path.resolve(__dirname, "../tenants-management-tenant-card.tsx")
const tenantsManagementCardSource = fs.readFileSync(tenantsManagementCardPath, "utf-8")

describe("TenantsManagement source", () => {
  it("uses extracted tenant card rendering and avoids raw img tags", () => {
    expect(tenantsManagementSource).toContain("TenantsManagementTenantCard")
    expect(tenantsManagementSource).not.toContain("<img")
  })

  it("stays below the giant-component threshold for the main module", () => {
    expect(tenantsManagementLineCount).toBeLessThan(350)
  })

  it("imports tenant role constants and types from a shared module", () => {
    expect(tenantsManagementSource).toContain('from "@/components/tenants-management-shared"')
    expect(tenantsManagementSource).not.toContain("const ROLE_LABELS = {")
    expect(tenantsManagementCardSource).toContain('from "@/components/tenants-management-shared"')
    expect(tenantsManagementCardSource).not.toContain("const ROLE_LABELS: Record<TenantUserRole, string> = {")
    expect(tenantsManagementCardSource).not.toContain("const LOWER_LEVEL_ORDER: TenantUserRole[] =")
  })
})
