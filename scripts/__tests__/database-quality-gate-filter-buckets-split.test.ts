import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"

import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"

const path = "supabase/tests/equipment_filter_buckets_smoke.sql"
const original = readFileSync(path, "utf8")
const corePath = path.replace(".sql", "_core_security.sql")
const businessPath = path.replace(".sql", "_migration_specific.sql")
const core = existsSync(corePath) ? readFileSync(corePath, "utf8") : original
const business = existsSync(businessPath) ? readFileSync(businessPath, "utf8") : original

it("separates bucket business behavior from tenant and department isolation witnesses", () => {
  const securityStart = original.lastIndexOf(
    "  PERFORM set_config(",
    original.indexOf("'app_role', 'user'")
  )
  const businessStart = original.indexOf("  v_payload := public.equipment_filter_buckets(")
  const end = original.indexOf("  RAISE NOTICE")
  expect(businessStart).toBeGreaterThan(0)
  expect(securityStart).toBeGreaterThan(businessStart)
  expect(end).toBeGreaterThan(securityStart)
  const setup = original.slice(original.indexOf("BEGIN;"), businessStart)
  const businessBlock = original.slice(businessStart, securityStart)
  const securityBlock = original.slice(securityStart, end)
  for (const sql of [core, business]) expect(sql).toContain(setup)
  expect(business).toContain(businessBlock)
  expect(business).not.toContain("role=user department bucket must keep JWT department scope")
  expect(core).toContain(securityBlock)
  expect(core).not.toContain("equipment_filter_buckets.department must be an array")
  for (const sql of [core, business]) {
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
  }
})
