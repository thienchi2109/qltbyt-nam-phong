import { readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { selectDefaultSafeSqlTests } from "../db-quality-gate/expected-state"
import { parseSqlTestRegistry } from "../db-quality-gate/expected-state-registry"
import { validRegistries } from "./database-quality-gate-registry-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type ScopeModule = {
  validateSqlTestGateScope: (input: { sqlTests: unknown; canonicalMigrationPaths: string[] }) => {
    valid: boolean
    findings: Array<{ classification: string; ruleId: string }>
  }
}

const migrationPath = "supabase/migrations/20260908000000_scope.sql"

async function validate(sqlTests: unknown, canonicalMigrationPaths = [migrationPath]) {
  const module = await loadDatabaseQualityGateModule<ScopeModule>("expected-state-registry")
  return module.validateSqlTestGateScope({ sqlTests, canonicalMigrationPaths })
}

describe("Chunk 3 compatible SQL test scope metadata", () => {
  it.each(["core-security", "migration-specific"])(
    "accepts %s without narrowing selection",
    async (gateScope) => {
      const legacy = validRegistries().sqlTests
      const scoped = { ...legacy, tests: legacy.tests.map((test) => ({ ...test, gateScope })) }
      expect(parseSqlTestRegistry(scoped)).toBeDefined()
      expect(await validate(scoped)).toEqual({ findings: [], valid: true })
      expect(selectDefaultSafeSqlTests(scoped).map((test) => test.path)).toEqual(
        selectDefaultSafeSqlTests(legacy).map((test) => test.path)
      )
    }
  )

  it.each(["mixed", "", null, 1])("rejects invalid scope %s", (gateScope) => {
    const registry = validRegistries().sqlTests
    expect(
      parseSqlTestRegistry({
        ...registry,
        tests: registry.tests.map((test) => ({ ...test, gateScope })),
      })
    ).toBeUndefined()
  })

  it("keeps legacy parsing but rejects missing default-safe scope in the future completeness check", async () => {
    const registry = validRegistries().sqlTests
    expect(parseSqlTestRegistry(registry)).toBeDefined()
    expect(await validate(registry)).toEqual({
      valid: false,
      findings: [{ classification: "BLOCKING", ruleId: "registry.sql-tests.gate-scope" }],
    })
  })

  it("requires exact canonical membership for every declared mapping", async () => {
    const registry = validRegistries().sqlTests
    const scoped = {
      ...registry,
      tests: registry.tests.map((test) => ({
        ...test,
        gateScope: "migration-specific",
        requiredForMigrations: [migrationPath],
      })),
    }
    expect((await validate(scoped)).valid).toBe(true)
    expect(await validate(scoped, [migrationPath.replace("scope.sql", "scope_extra.sql")])).toEqual(
      {
        valid: false,
        findings: [
          { classification: "BLOCKING", ruleId: "registry.sql-tests.required-migration-path" },
        ],
      }
    )
  })

  it("matches all approved classifications and preserves the entire legacy selected set", async () => {
    const registry = JSON.parse(readFileSync("supabase/db-quality-gate-tests.json", "utf8"))
    const document = readFileSync(
      "openspec/changes/narrow-db-quality-gate/test-classification.md",
      "utf8"
    )
    const scopes = new Map<string, string>()
    for (const section of document.split(/^### \d+\. /m).slice(1)) {
      const name = section.match(/^`(?:supabase\/tests\/)?([^`]+)`/)?.[1]
      const scope = section.match(/Proposed scope: `([^`]+)`/)?.[1]
      expect(name && scope).toBeTruthy()
      scopes.set(`supabase/tests/${name}`, scope === "migration-specific" ? scope : "core-security")
    }
    expect(scopes.size).toBe(77)
    expect([...scopes.values()].filter((scope) => scope === "migration-specific")).toHaveLength(18)
    const parsed = parseSqlTestRegistry(registry)!
    expect(parsed).toBeDefined()
    const selected = selectDefaultSafeSqlTests(registry)
    expect(selected.map((test) => test.path)).toEqual([...scopes.keys()].sort())
    for (const test of selected) expect(test).toHaveProperty("gateScope", scopes.get(test.path))
    const legacy = { ...parsed, tests: parsed.tests.map(({ gateScope: _scope, ...test }) => test) }
    expect(selectDefaultSafeSqlTests(legacy).map((test) => test.path)).toEqual(
      selected.map((test) => test.path)
    )
    expect(
      await validate(
        registry,
        readdirSync("supabase/migrations").map((name) => `supabase/migrations/${name}`)
      )
    ).toEqual({ findings: [], valid: true })
  })
})
