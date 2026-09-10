import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"

import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const path = "supabase/tests/equipment_bulk_delete_smoke.sql"
const original = readFileSync(path, "utf8")
const corePath = path.replace(".sql", "_core_security.sql")
const businessPath = path.replace(".sql", "_migration_specific.sql")
// Assess the unsplit source before extraction: RED must identify scope leakage.
const core = existsSync(corePath) ? readFileSync(corePath, "utf8") : original
const business = existsSync(businessPath) ? readFileSync(businessPath, "utf8") : original

it("preserves complete bulk-delete witnesses and separates tenant atomicity from business atomicity", () => {
  const boundaries = [
    "BEGIN;",
    "  -- Happy path:",
    "  -- Non-global users",
    "  -- Max size guard.",
    "  RAISE NOTICE",
  ].map((marker) => original.indexOf(marker))
  expect(
    boundaries.every((offset, i) => offset >= 0 && (i === 0 || offset > boundaries[i - 1]))
  ).toBe(true)
  const [start, happy, security, max, end] = boundaries
  const setup = original.slice(start, happy)
  const businessBlocks = [original.slice(happy, security), original.slice(max, end)]
  const securityBlock = original.slice(security, max)
  for (const sql of [core, business]) expect(sql).toContain(setup)
  expect(core).toContain(securityBlock)
  expect(business).not.toContain(securityBlock)
  for (const block of businessBlocks) {
    expect(business).toContain(block)
    expect(core).not.toContain(block)
  }
  for (const sql of [core, business]) {
    expect(registeredSqlTestBody(sql)).toBeDefined()
    expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
  }
})

it("stages bulk-delete registration without altering the active selected set", () => {
  expect(createHash("sha256").update(original).digest("hex")).toBe(
    "2f7c74ce6af921449e91c8307394552c8f0e4a977e629bb8d5a6e13c1c265158"
  )
  const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
  const selected = selectDefaultSafeSqlTests(registry)
  expect(selected).toHaveLength(78)
  const legacy = selected.find((entry) => entry.path === path)
  expect(legacy).toMatchObject({
    safety: "default-safe",
    fixtureContract: "isolated-fixture",
    transactionContract: "rollback-required",
    runnerRequirements: ["psql"],
    timeoutSeconds: 30,
  })
  expect(selected.some((entry) => [corePath, businessPath].includes(entry.path))).toBe(false)
  const tests = [
    { ...legacy, path: corePath, gateScope: "core-security" },
    { ...legacy, path: businessPath, gateScope: "migration-specific" },
  ]
  const fixture = { ...validRegistries(), sqlTests: { schemaVersion: 1, tests } }
  expect(validateExpectedStateRegistries(fixture).valid).toBe(true)
  expect(selectDefaultSafeSqlTests(fixture.sqlTests)).toEqual(tests)
})
