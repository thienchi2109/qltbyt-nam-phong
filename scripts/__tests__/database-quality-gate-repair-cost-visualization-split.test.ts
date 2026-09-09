import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const entries = [
  "repair_completion_time_smoke.sql",
  "repair_cost_usage_visualizations_smoke.sql",
  "repair_request_cost_smoke.sql",
]

it("keeps the three repair report entries in the legacy selected set", () => {
  const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
  const selected = selectDefaultSafeSqlTests(registry)
  for (const path of entries)
    expect(selected.some((entry) => entry.path === `supabase/tests/${path}`)).toBe(true)
  expect(selected).toHaveLength(77)
})

it("registers core and migration-specific companions only in a fixture registry", () => {
  const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
  const selected = selectDefaultSafeSqlTests(registry)
  const staged = entries.flatMap((file) => {
    const legacy = selected.find((entry) => entry.path === `supabase/tests/${file}`)
    expect(legacy).toBeDefined()
    return [
      {
        ...legacy!,
        path: legacy!.path.replace(".sql", "_core_security.sql"),
        gateScope: "core-security",
      },
      {
        ...legacy!,
        path: legacy!.path.replace(".sql", "_migration_specific.sql"),
        gateScope: "migration-specific",
      },
    ]
  })
  expect(
    validateExpectedStateRegistries({
      ...validRegistries(),
      sqlTests: { schemaVersion: 1, tests: staged },
    }).valid
  ).toBe(true)
  for (const entry of staged) {
    expect(existsSync(entry.path)).toBe(true)
    const sql = readFileSync(entry.path, "utf8")
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(sql).toContain("ROLLBACK;")
  }
})
