import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, "../..")
const INVARIANTS_PATH = path.join(REPOSITORY_ROOT, "supabase/db-quality-gate-invariants.json")
const SQL_TESTS_PATH = path.join(REPOSITORY_ROOT, "supabase/db-quality-gate-tests.json")

type RegistryModule = {
  parseInvariantRegistry: (value: unknown) =>
    | {
        invariants: Array<{
          classification?: string
          evidence: string[]
          expected?: {
            policyIdentities: string[]
          }
          objectIdentity: string
          status: string
        }>
      }
    | undefined
  parseSqlTestRegistry: (value: unknown) =>
    | {
        tests: Array<{
          path: string
          purpose: string
          safety: string
        }>
      }
    | undefined
}

type ExpectedStateModule = {
  selectDefaultSafeSqlTests: (value: unknown) => Array<{ path: string }>
}

function readJson(pathname: string): unknown {
  return JSON.parse(readFileSync(pathname, "utf8")) as unknown
}

function sqlTestPaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return sqlTestPaths(absolutePath)
    }

    return entry.isFile() && entry.name.endsWith(".sql")
      ? [path.relative(REPOSITORY_ROOT, absolutePath).split(path.sep).join("/")]
      : []
  })
}

function classificationCount(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
}

describe("database quality gate Phase 3 artifacts", () => {
  it("commits the reviewed initial rpc-only invariant with evidence", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const invariants = registry.parseInvariantRegistry(readJson(INVARIANTS_PATH))

    expect(invariants).toBeDefined()
    expect(invariants?.invariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "rpc-only",
          expected: expect.objectContaining({
            policyIdentities: [
              "nhan_vien_deny_delete",
              "nhan_vien_deny_insert",
              "nhan_vien_deny_select",
              "nhan_vien_deny_update",
            ],
          }),
          objectIdentity: "public.nhan_vien",
        }),
      ])
    )
  })

  it("records decision-backed unresolved authority for every other current public table", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const invariants = registry.parseInvariantRegistry(readJson(INVARIANTS_PATH))
    const unresolved = invariants?.invariants.filter(
      (invariant) => invariant.status === "unresolved"
    )

    expect(invariants?.invariants).toHaveLength(50)
    expect(unresolved).toHaveLength(49)
    expect(
      unresolved
        ?.filter((invariant) =>
          invariant.evidence.includes("Wayfinder #940 table-security decision")
        )
        .map((invariant) => invariant.objectIdentity)
        .sort()
    ).toEqual(["public.don_vi", "public.user_don_vi_memberships"])
    expect(
      unresolved?.filter((invariant) =>
        invariant.evidence.includes("Wayfinder #941 table-security decision")
      )
    ).toHaveLength(47)
  })

  it("classifies every current SQL test with the approved conservative inventory", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const sqlTests = registry.parseSqlTestRegistry(readJson(SQL_TESTS_PATH))
    const currentPaths = sqlTestPaths(path.join(REPOSITORY_ROOT, "supabase/tests")).sort()
    const registeredPaths = sqlTests?.tests.map((test) => test.path).sort()

    expect(sqlTests).toBeDefined()
    expect(registeredPaths).toEqual(currentPaths)
    expect(classificationCount(sqlTests?.tests.map((test) => test.purpose) ?? [])).toEqual({
      concurrency: 4,
      invariant: 6,
      "live-acceptance": 1,
      performance: 3,
      "phase-gate": 31,
      smoke: 47,
    })
    expect(classificationCount(sqlTests?.tests.map((test) => test.safety) ?? [])).toEqual({
      "default-safe": 66,
      "live-only": 1,
      "opt-in": 25,
    })
  })

  it("admits only reviewed rollback-isolated default-safe SQL tests", async () => {
    const expectedState = await loadDatabaseQualityGateModule<ExpectedStateModule>("expected-state")
    const selected = expectedState.selectDefaultSafeSqlTests(readJson(SQL_TESTS_PATH))

    expect(selected).toHaveLength(66)
    expect(selected.map((test) => test.path)).not.toEqual(
      expect.arrayContaining([
        "supabase/tests/technical_configuration_baseline_document_urls_phase_gate.sql",
        "supabase/tests/technical_configuration_dossier_delete_concurrency_phase_gate.sql",
        "supabase/tests/technical_configuration_baseline_hierarchy_p6c_live_acceptance.sql",
      ])
    )

    for (const test of selected) {
      const content = readFileSync(path.join(REPOSITORY_ROOT, test.path), "utf8")
      expect(content).toMatch(/\bBEGIN\s*;/i)
      expect(content).toMatch(/\bROLLBACK\s*;/i)
    }
  })
})
