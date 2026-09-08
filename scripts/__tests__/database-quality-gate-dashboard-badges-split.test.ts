import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const originalPath = "supabase/tests/dashboard_badges_department_scope_smoke.sql"
const original = readFileSync(originalPath, "utf8")
const corePath = originalPath.replace(".sql", "_core_security.sql")
const businessPath = originalPath.replace(".sql", "_migration_specific.sql")
const countStart = original.indexOf("  v_dashboard := public.dashboard_kpi_summary();")
const denialStart = original.indexOf(
  "  v_header := public.header_notifications_summary(v_other_tenant);"
)
const globalStart = original.lastIndexOf(
  "  PERFORM set_config(",
  original.indexOf("'app_role', 'global'")
)
const catalogStart = original.indexOf("  FOR v_proconfig IN")
const end = original.indexOf("  RAISE NOTICE")

// Before extraction, assess the unsplit source so RED reports scope leakage, not ENOENT.
const core = existsSync(corePath) ? readFileSync(corePath, "utf8") : original
const business = existsSync(businessPath) ? readFileSync(businessPath, "utf8") : original

describe("Chunk 4b dashboard badges staged extraction", () => {
  it("separates ordinary counts from denial checks without losing complete SQL witnesses", () => {
    expect(
      [countStart, denialStart, globalStart, catalogStart, end].every((offset) => offset > 0)
    ).toBe(true)
    const setup = original.slice(original.indexOf("BEGIN;"), countStart)
    const counts = original.slice(countStart, denialStart)
    const denials = original.slice(denialStart, globalStart)
    const isolation = original.slice(globalStart, catalogStart)
    const catalog = original.slice(catalogStart, end)
    for (const sql of [core, business]) {
      expect(sql).toContain(setup)
      expect(sql).toContain(isolation)
    }
    expect(core).toContain(denials)
    expect(core).toContain(catalog)
    expect(core).not.toContain(counts)
    expect(business).toContain(counts)
    expect(business).not.toContain(denials)
    expect(business).not.toContain(catalog)
  })

  it("keeps active registry selection unchanged and validates staged registration with the harness", () => {
    const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
    const selected = selectDefaultSafeSqlTests(registry)
    expect(selected).toHaveLength(77)
    const legacy = selected.find((test) => test.path === originalPath)!
    expect(legacy).toBeDefined()
    expect(selected.some((test) => [corePath, businessPath].includes(test.path))).toBe(false)
    const staged = [
      { ...legacy, path: corePath, gateScope: "core-security" },
      { ...legacy, path: businessPath, gateScope: "migration-specific" },
    ]
    const fixture = { ...validRegistries(), sqlTests: { schemaVersion: 1, tests: staged } }
    expect(validateExpectedStateRegistries(fixture).valid).toBe(true)
    expect(selectDefaultSafeSqlTests(fixture.sqlTests)).toEqual(staged)
    for (const entry of staged)
      expect(entry).toMatchObject({
        safety: "default-safe",
        fixtureContract: "isolated-fixture",
        transactionContract: "rollback-required",
        runnerRequirements: ["psql"],
        timeoutSeconds: 30,
      })
    expect(createHash("sha256").update(original).digest("hex")).toBe(
      "efae955964fc1f7cc3f6c8932fb4deb07a1d3838586f8ae94d6f84a371e35241"
    )
  })

  it("uses the real rollback parser and rejects an escaping COMMIT", () => {
    for (const sql of [core, business]) {
      expect(registeredSqlTestBody(sql)).toBeDefined()
      expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
    }
  })
})
