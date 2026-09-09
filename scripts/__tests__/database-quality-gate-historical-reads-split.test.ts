import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const path = "supabase/tests/equipment_soft_delete_historical_reads_smoke.sql"
const original = readFileSync(path, "utf8")
const corePath = path.replace(".sql", "_core_security.sql")
const businessPath = path.replace(".sql", "_migration_specific.sql")
const core = existsSync(corePath) ? readFileSync(corePath, "utf8") : original
const business = existsSync(businessPath) ? readFileSync(businessPath, "utf8") : original

it("preserves complete regional scope and posture blocks separately from historical reads", () => {
  const reads = original.indexOf("  SELECT COUNT(*)")
  const region = original.indexOf("  INSERT INTO public.dia_ban")
  const usage = original.indexOf(
    "  PERFORM set_config(",
    original.indexOf("regional_leader scope leaked")
  )
  const posture = original.indexOf("  SELECT EXISTS (")
  const end = original.indexOf("  RAISE NOTICE")
  expect(reads).toBeGreaterThan(0)
  expect(region).toBeGreaterThan(reads)
  expect(usage).toBeGreaterThan(region)
  expect(posture).toBeGreaterThan(usage)
  expect(end).toBeGreaterThan(posture)
  const setup = original.slice(original.indexOf("BEGIN;"), reads)
  for (const sql of [core, business]) {
    expect(sql).toContain(setup)
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
  }
  for (const block of [original.slice(region, usage), original.slice(posture, end)]) {
    expect(core).toContain(block)
    expect(business).not.toContain(block)
  }
  for (const block of [original.slice(reads, region), original.slice(usage, posture)]) {
    expect(business).toContain(block)
    expect(core).not.toContain(block)
  }
})

it("validates fixture-only registration and leaves the 77 active tests selected", () => {
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
  const sqlTests = { schemaVersion: 1, tests: staged }
  expect(validateExpectedStateRegistries({ ...validRegistries(), sqlTests }).valid).toBe(true)
  expect(selectDefaultSafeSqlTests(sqlTests)).toEqual(staged)
  for (const entry of staged)
    expect(entry).toMatchObject({
      safety: "default-safe",
      fixtureContract: "isolated-fixture",
      transactionContract: "rollback-required",
      timeoutSeconds: 30,
    })
})
