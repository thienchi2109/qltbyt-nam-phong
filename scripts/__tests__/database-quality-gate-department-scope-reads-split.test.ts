import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"

import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"

const path = "supabase/tests/equipment_department_scope_reads_smoke.sql"
const original = readFileSync(path, "utf8")
const corePath = path.replace(".sql", "_core_security.sql")
const businessPath = path.replace(".sql", "_migration_specific.sql")
const core = existsSync(corePath) ? readFileSync(corePath, "utf8") : original
const business = existsSync(businessPath) ? readFileSync(businessPath, "utf8") : original

it("separates normalization equivalence from department authorization witnesses", () => {
  const normalizationEnd = original.indexOf("  INSERT INTO public.don_vi")
  const securityStart = original.indexOf("  PERFORM set_config(", normalizationEnd)
  const end = original.indexOf("  RAISE NOTICE", securityStart)
  expect(normalizationEnd).toBeGreaterThan(0)
  expect(securityStart).toBeGreaterThan(normalizationEnd)
  expect(end).toBeGreaterThan(securityStart)
  const setup = original.slice(
    original.indexOf("BEGIN;"),
    original.indexOf("  IF public._normalize")
  )
  const normalization = original.slice(
    original.indexOf("  IF public._normalize"),
    original.indexOf("  IF public._normalize_department_scope(NULL)")
  )
  const security = original.slice(securityStart, end)
  for (const sql of [core, business]) expect(sql).toContain(setup)
  expect(business).toContain(normalization)
  expect(business).not.toContain("role user access")
  expect(core).toContain(
    original.slice(
      original.indexOf("  IF public._normalize_department_scope(NULL)"),
      normalizationEnd
    )
  )
  expect(core).toContain(original.slice(normalizationEnd, securityStart))
  expect(core).toContain(security)
  expect(core).not.toContain(normalization)
  for (const sql of [core, business]) {
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
  }
})
