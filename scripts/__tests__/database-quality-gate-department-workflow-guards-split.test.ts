import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"

import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const path = "supabase/tests/equipment_department_scope_workflow_guards_smoke.sql"
const original = readFileSync(path, "utf8")
const corePath = path.replace(".sql", "_core_security.sql")
const businessPath = path.replace(".sql", "_migration_specific.sql")
const core = existsSync(corePath) ? readFileSync(corePath, "utf8") : original
const business = existsSync(businessPath) ? readFileSync(businessPath, "utf8") : original

it("validates staged registration while retaining all 78 selected tests", () => {
  const selected = selectDefaultSafeSqlTests(
    JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
  )
  expect(selected).toHaveLength(78)
  const legacy = selected.find((entry) => entry.path === path)
  expect(legacy).toBeDefined()
  const tests = [corePath, path.replace(".sql", "_claims_core_security.sql"), businessPath].map(
    (entryPath) => ({
      ...legacy,
      path: entryPath,
      gateScope: entryPath === businessPath ? "migration-specific" : "core-security",
    })
  )
  expect(selected.some((entry) => tests.some((staged) => staged.path === entry.path))).toBe(false)
  expect(
    validateExpectedStateRegistries({ ...validRegistries(), sqlTests: { schemaVersion: 1, tests } })
      .valid
  ).toBe(true)
})

it("preserves complete workflow blocks in their approved scopes", () => {
  const lines = original.split("\n")
  const block = (start: number, end: number) => lines.slice(start - 1, end).join("\n")
  const claimsPath = path.replace(".sql", "_claims_core_security.sql")
  const claims = existsSync(claimsPath) ? readFileSync(claimsPath, "utf8") : original
  for (const sql of [core, claims, business]) {
    expect(sql).toContain(block(5, 146))
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
    expect(sql.trimEnd().split("\n").length).toBeLessThanOrEqual(450)
  }
  expect(core).toContain(block(195, 234))
  expect(core).toContain(block(300, 475))
  expect(claims).toContain(block(477, 734))
  expect(business).toContain(block(147, 194))
  expect(business).toContain(block(236, 299))
  for (const sql of [core, claims]) {
    expect(sql).not.toContain(block(147, 194))
    expect(sql).not.toContain(block(236, 299))
  }
  for (const chunk of [block(195, 234), block(300, 475), block(477, 734)])
    expect(business).not.toContain(chunk)
})
