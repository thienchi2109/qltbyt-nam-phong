import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"

import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const path = "supabase/tests/equipment_department_distribution_smoke.sql"
const original = readFileSync(path, "utf8")
const corePath = path.replace(".sql", "_core_security.sql")
const businessPath = path.replace(".sql", "_migration_specific.sql")
const core = existsSync(corePath) ? readFileSync(corePath, "utf8") : original
const business = existsSync(businessPath) ? readFileSync(businessPath, "utf8") : original

it("separates distribution counts from the role-scoped isolation witness", () => {
  const businessStart = original.indexOf("  SELECT count\n")
  const securityStart = original.indexOf("  PERFORM set_config(", businessStart)
  const end = original.indexOf("  RAISE NOTICE", securityStart)
  expect(businessStart).toBeGreaterThan(0)
  expect(securityStart).toBeGreaterThan(businessStart)
  expect(end).toBeGreaterThan(securityStart)
  const setup = original.slice(original.indexOf("BEGIN;"), businessStart)
  const businessBlock = original.slice(businessStart, securityStart)
  const securityBlock = original.slice(securityStart, end)
  for (const sql of [core, business]) expect(sql).toContain(setup)
  expect(business).toContain(businessBlock)
  expect(business).not.toContain(securityBlock)
  expect(core).toContain(securityBlock)
  expect(core).not.toContain(businessBlock)
  for (const sql of [core, business]) {
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
  }
})

it("stages department-distribution registration without changing selected tests", () => {
  const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
  const selected = selectDefaultSafeSqlTests(registry)
  expect(selected).toHaveLength(77)
  const legacy = selected.find((entry) => entry.path === path)
  expect(legacy).toBeDefined()
  expect(selected.some((entry) => [corePath, businessPath].includes(entry.path))).toBe(false)
  const staged = [
    { ...legacy, path: corePath, gateScope: "core-security" },
    { ...legacy, path: businessPath, gateScope: "migration-specific" },
  ]
  expect(
    validateExpectedStateRegistries({
      ...validRegistries(),
      sqlTests: { schemaVersion: 1, tests: staged },
    }).valid
  ).toBe(true)
  expect(selectDefaultSafeSqlTests({ schemaVersion: 1, tests: staged })).toEqual(staged)
})
