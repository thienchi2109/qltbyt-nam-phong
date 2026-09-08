import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { registeredSqlTestBody } from "../db-quality-gate/oracle-remote-sql"
import { validateExpectedStateRegistries } from "../db-quality-gate/registries"
import { validRegistries } from "./database-quality-gate-registry-test-support"

const originalPath = "supabase/tests/ai_kill_switch_smoke.sql"
const files = [
  ["core-security", "supabase/tests/ai_kill_switch_smoke_core_security.sql"],
  ["migration-specific", "supabase/tests/ai_kill_switch_smoke_migration_specific.sql"],
] as const

const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
const original = readFileSync(originalPath, "utf8")

describe("Chunk 4a AI kill switch staged extraction", () => {
  it("keeps the active mixed test and all 77 default-safe paths selected", () => {
    const selected = selectDefaultSafeSqlTests(registry)
    expect(selected).toHaveLength(77)
    expect(selected.find((test) => test.path === originalPath)).toBeDefined()
    for (const [, path] of files)
      expect(selected.find((test) => test.path === path)).toBeUndefined()
    expect(createHash("sha256").update(original).digest("hex")).toBe(
      "0ee88b2c72e25cb12a8c89534fdb68ab0627cabf46d8b9c3a55eb4336fb95f57"
    )
  })

  it("validates staged scope registration and certifies rollback using the real harness", () => {
    const legacy = selectDefaultSafeSqlTests(registry).find((test) => test.path === originalPath)!
    const staged = files.map(([gateScope, path]) => ({ ...legacy, path, gateScope }))
    const fixture = { ...validRegistries(), sqlTests: { schemaVersion: 1, tests: staged } }
    expect(validateExpectedStateRegistries(fixture).valid).toBe(true)
    expect(selectDefaultSafeSqlTests(fixture.sqlTests)).toEqual(staged)
    for (const test of staged) {
      expect(test).toMatchObject({
        fixtureContract: "isolated-fixture",
        transactionContract: "rollback-required",
        runnerRequirements: ["psql"],
        safety: "default-safe",
        timeoutSeconds: 30,
      })
      const sql = readFileSync(test.path, "utf8")
      expect(registeredSqlTestBody(sql)).toBeDefined()
      expect(registeredSqlTestBody(sql.replace(/ROLLBACK;\s*$/, "COMMIT;"))).toBeUndefined()
    }
    const unsafe = {
      ...fixture,
      sqlTests: {
        schemaVersion: 1,
        tests: staged.map((test) => ({ ...test, transactionContract: "isolated-database" })),
      },
    }
    expect(validateExpectedStateRegistries(unsafe).valid).toBe(false)
  })

  it("preserves denial bodies and business effects while isolating authorization witnesses", () => {
    const core = readFileSync(files[0][1], "utf8")
    const business = readFileSync(files[1][1], "utf8")
    const blocks = original.match(/DO \$\$[\s\S]*?END \$\$;/g)!
    for (const index of [4, 6]) expect(core).toContain(blocks[index])
    expect(core).toContain(blocks[5].replace("v_status.enabled IS DISTINCT FROM TRUE", "NOT FOUND"))
    for (const index of [0, 1, 2, 3, 7, 8]) expect(business).toContain(blocks[index])
    const positiveBlocks = core.match(/DO \$\$[\s\S]*?END \$\$;/g)!.slice(0, 3)
    for (const [index, role] of ["global", "admin", "service_role"].entries()) {
      expect(positiveBlocks[index]).toContain(`'${role}'`)
      expect(positiveBlocks[index]).toContain("FROM public.ai_kill_switch_set(")
      expect(positiveBlocks[index]).toContain("IF NOT FOUND THEN")
      expect(positiveBlocks[index]).toContain("RAISE EXCEPTION")
    }
    expect(core).not.toMatch(/v_status\.(enabled|reason|updated_at)/)
    expect(business).not.toContain("42501")
  })
})
