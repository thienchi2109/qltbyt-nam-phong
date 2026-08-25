import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations")

type GlobalOnlyRpc = {
  adminHandling: "accept-raw" | "global-only" | "normalize"
  name: string
  roleVariable: string
}

const USER_MANAGEMENT_RPCS: GlobalOnlyRpc[] = [
  { adminHandling: "accept-raw", name: "user_create", roleVariable: "v_app_role" },
  { adminHandling: "normalize", name: "user_list_for_admin", roleVariable: "v_role" },
  { adminHandling: "accept-raw", name: "user_update_profile", roleVariable: "v_role" },
  { adminHandling: "normalize", name: "user_delete_by_admin", roleVariable: "v_role" },
  { adminHandling: "normalize", name: "reset_password_by_admin", roleVariable: "v_role" },
]

const TENANT_MANAGEMENT_RPCS: GlobalOnlyRpc[] = [
  { adminHandling: "normalize", name: "don_vi_create", roleVariable: "v_role" },
  { adminHandling: "normalize", name: "don_vi_update", roleVariable: "v_role" },
  { adminHandling: "normalize", name: "don_vi_set_active", roleVariable: "v_role" },
  {
    adminHandling: "global-only",
    name: "don_vi_user_hierarchy",
    roleVariable: "v_role",
  },
]

function listMigrationFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      return listMigrationFiles(entryPath)
    }

    return entry.name.endsWith(".sql") ? [entryPath] : []
  })
}

function extractLatestFunction(functionName: string): string {
  const definitionPattern = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${functionName}\\s*\\(`,
    "gi"
  )
  let latestDefinition: { filePath: string; offset: number } | null = null

  for (const filePath of listMigrationFiles(MIGRATIONS_DIR).sort()) {
    const source = readFileSync(filePath, "utf8")

    for (const match of source.matchAll(definitionPattern)) {
      latestDefinition = { filePath, offset: match.index }
    }
  }

  if (!latestDefinition) {
    throw new Error(`Missing migration definition for ${functionName}`)
  }

  const source = readFileSync(latestDefinition.filePath, "utf8")
  const remainingSource = source.slice(latestDefinition.offset)
  const nextDefinitionOffset = remainingSource
    .slice(1)
    .search(/\nCREATE\s+OR\s+REPLACE\s+FUNCTION\b/i)

  return nextDefinitionOffset === -1
    ? remainingSource
    : remainingSource.slice(0, nextDefinitionOffset + 1)
}

function expectGlobalOnlyGuard(rpc: GlobalOnlyRpc) {
  const source = extractLatestFunction(rpc.name)
  const escapedRoleVariable = rpc.roleVariable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const normalizationPattern = new RegExp(
    `IF\\s+${escapedRoleVariable}\\s*=\\s*'admin'\\s+THEN[\\s\\S]{0,120}${escapedRoleVariable}\\s*:=\\s*'global'`,
    "i"
  )

  if (rpc.adminHandling === "normalize") {
    expect(source).toMatch(normalizationPattern)
    expect(source).toMatch(
      new RegExp(
        `IF[\\s\\S]{0,240}${escapedRoleVariable}\\s*<>\\s*'global'[\\s\\S]{0,240}RAISE\\s+EXCEPTION`,
        "i"
      )
    )
    return
  }

  expect(source).not.toMatch(normalizationPattern)
  if (rpc.adminHandling === "global-only") {
    expect(source).toMatch(
      new RegExp(
        `IF[\\s\\S]{0,240}${escapedRoleVariable}\\s*<>\\s*'global'[\\s\\S]{0,240}RAISE\\s+EXCEPTION`,
        "i"
      )
    )
    return
  }

  expect(source).toMatch(
    new RegExp(
      `IF[\\s\\S]{0,240}${escapedRoleVariable}\\s+NOT\\s+IN\\s*\\(\\s*'admin'\\s*,\\s*'global'\\s*\\)[\\s\\S]{0,240}RAISE\\s+EXCEPTION`,
      "i"
    )
  )
}

describe("Users/Tenants management RBAC characterization", () => {
  it.each(USER_MANAGEMENT_RPCS)(
    "keeps $name global/admin-only so an expert remains denied",
    expectGlobalOnlyGuard
  )

  it.each(
    USER_MANAGEMENT_RPCS.filter(({ name }) => ["user_create", "user_update_profile"].includes(name))
  )("lets global/raw-admin callers assign the expert role through $name", (rpc) => {
    const source = extractLatestFunction(rpc.name)

    expectGlobalOnlyGuard(rpc)
    expect(source).toMatch(/NOT\s+IN\s*\([\s\S]{0,400}'chuyen_gia'[\s\S]{0,200}\)\s*THEN/i)
  })

  it.each(TENANT_MANAGEMENT_RPCS)(
    "keeps $name global-only so an expert remains denied",
    expectGlobalOnlyGuard
  )
})
