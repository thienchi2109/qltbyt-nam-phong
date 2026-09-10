import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const paths = [
  "supabase/tests/repair_request_lifecycle_audit_smoke.sql",
  "supabase/tests/repair_request_status_counts_overdue_summary_smoke.sql",
]

it("keeps both original tests selected and stages four companions without activation", () => {
  const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
  const selected = selectDefaultSafeSqlTests(registry)
  expect(selected).toHaveLength(78)
  const staged = paths.flatMap((path) => {
    const legacy = selected.find((entry) => entry.path === path)
    expect(legacy).toBeDefined()
    return [
      { ...legacy!, path: path.replace(".sql", "_core_security.sql"), gateScope: "core-security" },
      {
        ...legacy!,
        path: path.replace(".sql", "_migration_specific.sql"),
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
    expect(sql).toContain("DO $$")
    expect(sql).toMatch(/ROLLBACK;\s*$/)
  }
})

it("preserves lifecycle audit fail-closed and status-scope witnesses", () => {
  const lifecycle = paths[0]
  const status = paths[1]
  for (const suffix of ["_core_security", "_migration_specific"]) {
    expect(readFileSync(lifecycle.replace(".sql", `${suffix}.sql`), "utf8")).toContain("audit_log")
    expect(readFileSync(status.replace(".sql", `${suffix}.sql`), "utf8")).toContain(
      "_rr_counts_set_claims"
    )
  }
  const core = readFileSync(status.replace(".sql", "_core_security.sql"), "utf8")
  expect(core).toContain("regional")
  expect(core).toContain("departmentless")
  expect(core).toContain("_rr_counts_set_claims")
})
