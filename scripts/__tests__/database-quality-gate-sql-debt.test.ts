import { afterEach, describe, expect, it } from "vitest"
import { createDynamicRunState } from "../db-quality-gate/dynamic-lane-report"
import { reconcileSqlTestDebt } from "../db-quality-gate/sql-test-debt"
import { sha256Text } from "../db-quality-gate/serialization"
import type { GateFinding } from "../db-quality-gate/types"
import { cleanupFixtureRepositories } from "./database-quality-gate-test-support"

const testPath = "supabase/tests/example.sql"
const signature = "a".repeat(64)
const sourceHash = sha256Text("BEGIN; SELECT 1; ROLLBACK;")
const metadata = {
  path: testPath,
  baselineDebt: {
    sourceSha256: sourceHash,
    failureSignature: signature,
    sqlState: "P0001",
    protectedObjects: ["public.old_rpc"],
    reason: "Existing assertion failure in old_rpc, reproduced before candidate",
    evidence: "oracle:reviewed-baseline/report.json",
  },
}

function failure(operation = "run-sql-test"): GateFinding {
  return {
    classification: "BLOCKING",
    fingerprint: signature,
    ruleId: `dynamic.${operation}.failed`,
    evidence: {
      sqlTestPath: testPath,
      sqlTestSourceSha256: sourceHash,
      failureSignature: signature,
      sqlState: "P0001",
      kind: "failed",
    },
  }
}

afterEach(cleanupFixtureRepositories)

describe("reviewed SQL baseline debt", () => {
  it.each([
    "unchanged",
    "different error",
    "changed source",
    "unreviewed",
    "affected scope",
    "targeted test",
    "missing signature",
    "timeout",
  ])("handles %s without weakening candidate checks", (scenario) => {
    const state = createDynamicRunState()
    const baseline = failure("baseline-control.run-sql-test")
    const candidate = failure()
    state.baselineControlFindings = [baseline]
    state.findings = [candidate]
    state.sqlTestExecution = { selected: [testPath], attempted: [testPath], executed: [testPath] }
    if (scenario === "different error") candidate.evidence!.failureSignature = "b".repeat(64)
    if (scenario === "changed source") candidate.evidence!.sqlTestSourceSha256 = "b".repeat(64)
    if (scenario === "missing signature") delete candidate.evidence!.failureSignature
    if (scenario === "timeout") {
      candidate.ruleId = "dynamic.run-sql-test.timeout"
      candidate.evidence!.kind = "timeout"
    }
    reconcileSqlTestDebt({
      state,
      sqlTests: [
        {
          ...metadata,
          baselineDebt: scenario === "unreviewed" ? undefined : metadata.baselineDebt,
          requiredForMigrations:
            scenario === "targeted test"
              ? ["supabase/migrations/20260905000000_candidate.sql"]
              : [],
        },
      ],
      migrations: [
        {
          path: "supabase/migrations/20260905000000_candidate.sql",
          content:
            scenario === "affected scope"
              ? 'ALTER FUNCTION "public"."old_rpc"() OWNER TO postgres;'
              : "SELECT 1;",
        },
      ],
    })
    expect(state.findings.some((f) => f.classification === "BLOCKING")).toBe(
      scenario !== "unchanged"
    )
    expect(state.baselineControlFindings).toEqual([baseline])
  })

  it("does not hide a baseline failure when the candidate test was never executed", () => {
    const state = createDynamicRunState()
    state.baselineControlFindings = [failure("baseline-control.run-sql-test")]
    reconcileSqlTestDebt({ state, sqlTests: [metadata], migrations: [] })
    expect(state.incomplete).toBe(true)
  })

  it("records a repaired baseline failure without requiring a waiver", () => {
    const state = createDynamicRunState()
    state.baselineControlFindings = [failure("baseline-control.run-sql-test")]
    state.sqlTestExecution = { selected: [testPath], attempted: [testPath], executed: [testPath] }
    reconcileSqlTestDebt({ state, sqlTests: [{ path: testPath }], migrations: [] })
    expect(state.findings).toContainEqual(
      expect.objectContaining({
        classification: "WARNING",
        ruleId: "dynamic.sql-test.baseline-repaired",
      })
    )
  })
})
