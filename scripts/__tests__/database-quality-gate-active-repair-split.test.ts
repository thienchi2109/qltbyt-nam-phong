import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const path = "supabase/tests/equipment_list_enhanced_active_repair_smoke.sql"
const original = readFileSync(path, "utf8")
const corePath = path.replace(".sql", "_core_security.sql")
const businessPath = path.replace(".sql", "_migration_specific.sql")
const core = readFileSync(corePath, "utf8")
const business = readFileSync(businessPath, "utf8")

it("keeps tenant isolation in core and active-repair semantics in business", () => {
  const setupEnd = original.indexOf("  v_row := (")
  for (const sql of [core, business])
    expect(sql).toContain(original.slice(original.indexOf("BEGIN;"), setupEnd))
  const fStart = original.lastIndexOf("  IF EXISTS (", original.indexOf("Scenario F failed"))
  const gStart = original.indexOf("  PERFORM pg_temp._ele_set_claims('global'")
  const end = original.indexOf("  RAISE NOTICE")
  expect(core).toContain(original.slice(fStart, gStart))
  expect(business).toContain(original.slice(setupEnd, fStart))
  expect(business).toContain(original.slice(gStart, end))
  expect(existsSync(corePath)).toBe(true)
  expect(core).toContain("Scenario F failed: cross-tenant equipment leaked")
  expect(core).toContain("IF v_row IS NULL OR (v_row->>'id')::bigint IS DISTINCT FROM v_eq_b THEN")
  expect(core).not.toContain("v_row->>'active_repair_request_id'")
  expect(business).toContain("Scenario A failed: no-history equipment not found")
  expect(business).toContain("Scenario D failed: expected latest active")
  expect(business).toContain("Scenario E failed: soft-deleted equipment should be excluded")
  expect(business).toContain("Scenario G failed: global expected tenant B active")
  expect(core).not.toContain("Scenario A failed")
  expect(business).not.toContain("Scenario F failed")
  for (const sql of [core, business]) {
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
  }
})

it("stages companions without changing selected tests", () => {
  const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
  const selected = selectDefaultSafeSqlTests(registry)
  expect(selected).toHaveLength(78)
  const legacy = selected.find((entry) => entry.path === path)
  expect(legacy).toBeDefined()
  const staged = [
    { ...legacy!, path: corePath, gateScope: "core-security" },
    { ...legacy!, path: businessPath, gateScope: "migration-specific" },
  ]
  expect(selected.some((entry) => [corePath, businessPath].includes(entry.path))).toBe(false)
  expect(
    validateExpectedStateRegistries({
      ...validRegistries(),
      sqlTests: { schemaVersion: 1, tests: staged },
    }).valid
  ).toBe(true)
})
