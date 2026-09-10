import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"

import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

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
  const exclusionStart = original.indexOf("  IF EXISTS (", businessStart)
  const exclusionEnd = original.indexOf("  END IF;", exclusionStart) + "  END IF;\n\n".length
  const exclusion = original.slice(exclusionStart, exclusionEnd)
  const request = original.slice(
    businessStart,
    original.indexOf("  IF jsonb_typeof", businessStart)
  )
  expect(exclusion).toContain(
    "WHERE entry->>'name' IN ('Khoa Deleted ' || v_suffix, 'Khoa Other Tenant ' || v_suffix)"
  )
  const businessBlock = original.slice(businessStart, securityStart).replace(exclusion, "")
  const securityBlock = original.slice(securityStart, end)
  for (const sql of [core, business]) expect(sql).toContain(setup)
  expect(core).toContain(setup + request + exclusion)
  expect(business).toContain(businessBlock)
  expect(business).toContain(request)
  expect(business).not.toContain("role=user department bucket must keep JWT department scope")
  expect(core).toContain(securityBlock)
  expect(core).toContain(
    "equipment_filter_buckets leaked deleted or cross-tenant department bucket"
  )
  expect(business).not.toContain(
    "equipment_filter_buckets leaked deleted or cross-tenant department bucket"
  )
  expect(core).not.toContain("equipment_filter_buckets.department must be an array")
  for (const sql of [core, business]) {
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
  }
})

it("stages both companions without changing the active selected set", () => {
  const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
  const selected = selectDefaultSafeSqlTests(registry)
  expect(selected).toHaveLength(78)
  const legacy = selected.find((entry) => entry.path === path)
  expect(legacy).toBeDefined()
  expect(selected.some((entry) => [corePath, businessPath].includes(entry.path))).toBe(false)
  const staged = [
    { ...legacy!, path: corePath, gateScope: "core-security" },
    { ...legacy!, path: businessPath, gateScope: "migration-specific" },
  ]
  expect(
    validateExpectedStateRegistries({
      ...validRegistries(),
      sqlTests: { schemaVersion: 1, tests: staged },
    }).valid
  ).toBe(true)
  expect(selectDefaultSafeSqlTests({ schemaVersion: 1, tests: staged })).toEqual(staged)
  for (const entry of staged)
    expect(entry).toMatchObject({ safety: "default-safe", fixtureContract: "isolated-fixture" })
})
