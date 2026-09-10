import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const path = "supabase/tests/technical_configuration_baseline_documents_phase_gate.sql"
const original = readFileSync(path, "utf8")
const lines = original.split("\n")
const core = readFileSync(path.replace(".sql", "_core_security.sql"), "utf8")
const business = readFileSync(path.replace(".sql", "_migration_specific.sql"), "utf8")

it("preserves complete authorization and workflow blocks in their own scope", () => {
  for (const [start, end] of [
    [71, 128],
    [172, 195],
  ]) {
    const block = lines.slice(start - 1, end).join("\n")
    expect(core).toContain(block)
    expect(business).not.toContain(block)
  }
  const workflow = lines.slice(196, 445).join("\n")
  expect(business).toContain(workflow)
  expect(core).not.toContain(workflow)
  // Every original assertion belongs to exactly one scope, including loop bodies.
  const security = lines.slice(70, 128).join("\n")
  for (const line of lines.slice(70, 445).filter((line) => /RAISE EXCEPTION/.test(line))) {
    if (line.includes("Setup failed")) continue
    const [owner, other] = security.includes(line) ? [core, business] : [business, core]
    expect(owner).toContain(line)
    expect(other).not.toContain(line)
  }
  expect(core).toContain(lines.slice(195, 200).join("\n"))
  expect(core).toContain("IF v_baseline_document_id IS NULL THEN")
  expect(core).not.toContain("'PT422'")
  expect(core).not.toContain("'PT409'")
  expect(business).not.toContain("'permission_denied'")
  expect(business).not.toContain("has_function_privilege")
  expect(business).not.toContain("has_table_privilege")
})

it("retains rollback, fail-closed error helpers, and inactive fixture registration", () => {
  const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
  const selected = selectDefaultSafeSqlTests(registry)
  expect(selected).toHaveLength(78)
  const legacy = selected.find((entry) => entry.path === path)
  expect(legacy).toMatchObject({
    purpose: "phase-gate",
    safety: "default-safe",
    fixtureContract: "isolated-fixture",
    transactionContract: "rollback-required",
    timeoutSeconds: 30,
  })
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
  for (const sql of [core, business]) {
    expect(sql).toContain(lines.slice(3, 38).join("\n"))
    expect(sql).toContain(lines[69])
    expect(sql).toMatch(/END;\s*\$gate\$;\s*ROLLBACK;\s*$/)
    expect(sql.split("\n").length).toBeLessThanOrEqual(450)
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
  }
})
