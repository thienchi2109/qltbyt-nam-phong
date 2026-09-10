import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const path = "supabase/tests/repair_request_active_for_equipment_smoke.sql"
const original = readFileSync(path, "utf8")
const marker =
  "  ---------------------------------------------------------------------------\n  -- Scenario "
const parts = original.split(marker)

it("preserves complete scenarios and independent claims in the two companions", () => {
  expect(parts).toHaveLength(7)
  for (const [scope, scenarios] of [
    ["core_security", [2, 4, 5]],
    ["migration_specific", [1, 3, 6]],
  ] as const) {
    const sql = readFileSync(path.replace(".sql", `_${scope}.sql`), "utf8")
    expect(sql).toContain(parts[0].slice(parts[0].indexOf("BEGIN;")))
    for (let scenario = 1; scenario <= 6; scenario++) {
      const block = marker + parts[scenario].split("  RAISE NOTICE")[0]
      if (scenarios.some((id) => id === scenario)) expect(sql).toContain(block)
      else expect(sql).not.toContain(`-- Scenario ${scenario}:`)
    }
    expect(sql.indexOf("PERFORM pg_temp._rrafe_set_claims('to_qltb'")).toBeLessThan(
      sql.indexOf("v_result := public.repair_request_active_for_equipment")
    )
    expect(sql).toMatch(/END;\s*\$\$;\s*ROLLBACK;\s*$/)
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
  }
})

it("validates staged metadata while leaving the legacy selected set unchanged", () => {
  const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
  const selected = selectDefaultSafeSqlTests(registry)
  expect(selected).toHaveLength(78)
  const legacy = selected.find((entry) => entry.path === path)
  expect(legacy).toBeDefined()
  const tests = ["core-security", "migration-specific"].map((gateScope) => ({
    ...legacy!,
    path: path.replace(".sql", `_${gateScope.replaceAll("-", "_")}.sql`),
    gateScope,
  }))
  expect(selected.some((entry) => tests.some((test) => test.path === entry.path))).toBe(false)
  expect(
    validateExpectedStateRegistries({
      ...validRegistries(),
      sqlTests: { schemaVersion: 1, tests },
    }).valid
  ).toBe(true)
})
