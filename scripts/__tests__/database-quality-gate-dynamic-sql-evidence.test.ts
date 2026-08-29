import { writeFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { fixtureJson, loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"
import {
  commitWorkingTree,
  repositoryHead,
  sqlTestRegistry,
} from "./database-quality-gate-static-test-support"
import {
  createDynamicFixture,
  DynamicLaneModule,
  FakeOracleDynamicExecutor,
} from "./database-quality-gate-dynamic-test-support"

function runLane(
  source: DynamicLaneModule,
  executor: FakeOracleDynamicExecutor,
  repositoryRoot: string,
  subjectCommit: string
) {
  return source.runOracleDynamicLane({
    createdAt: "2026-08-17T04:30:00Z",
    executor,
    lane: "baseline-forward",
    repositoryRoot,
    runId: "phase4-sql-evidence",
    subjectCommit,
  })
}

describe("database quality gate dynamic SQL-test evidence", () => {
  it("does not claim SQL execution when the executor rejects input before running SQL", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const executor = new FakeOracleDynamicExecutor()
    executor.failure = {
      kind: "stale-environment",
      operation: "run-sql-test",
    }

    const report = runLane(source, executor, fixture.repository.root, fixture.subjectCommit)

    expect(report.outcome).toBe("INCOMPLETE")
    expect(report.sqlTestExecution).toEqual({
      attempted: ["supabase/tests/example.sql"],
      executed: [],
      selected: ["supabase/tests/example.sql"],
    })
    expect(JSON.parse(executor.persistedReports[0]).sqlTestExecution).toEqual(
      report.sqlTestExecution
    )
    expect(executor.droppedDatabases).toEqual(["dq_baseline_forward_phase4_sql_evidence"])
  })

  it("fails closed with selected and attempted prefixes when a later SQL test cannot run", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const registry = sqlTestRegistry()
    registry.tests.push({
      ...registry.tests[0],
      path: "supabase/tests/second-example.sql",
    })
    writeFileSync(
      fixture.repository.path("supabase", "db-quality-gate-tests.json"),
      fixtureJson(registry)
    )
    writeFileSync(
      fixture.repository.path("supabase", "tests", "second-example.sql"),
      "BEGIN;\nSELECT 2;\nROLLBACK;\n"
    )
    commitWorkingTree(fixture.repository.root, "add second SQL test to dynamic evidence fixture")
    const subjectCommit = repositoryHead(fixture.repository.root)
    const executor = new FakeOracleDynamicExecutor()
    executor.failure = {
      kind: "unavailable",
      operation: "run-sql-test",
    }
    executor.sqlTestFailurePath = "supabase/tests/second-example.sql"

    const report = runLane(source, executor, fixture.repository.root, subjectCommit)

    expect(report.outcome).toBe("INCOMPLETE")
    expect(report.sqlTestExecution).toEqual({
      attempted: ["supabase/tests/example.sql", "supabase/tests/second-example.sql"],
      executed: ["supabase/tests/example.sql"],
      selected: ["supabase/tests/example.sql", "supabase/tests/second-example.sql"],
    })
    expect(JSON.parse(executor.persistedReports[0]).sqlTestExecution).toEqual(
      report.sqlTestExecution
    )
    expect(executor.runSqlTestPaths).toEqual([
      "supabase/tests/example.sql",
      "supabase/tests/second-example.sql",
    ])
  })

  it.each([
    ["timeout", "apply-migrations"],
    ["interrupted", "run-sql-test"],
    ["cleanup", "drop-database"],
    ["disk-pressure", "preflight"],
    ["stale-environment", "preflight"],
  ] as const)("fails closed as INCOMPLETE for %s execution evidence", async (kind, operation) => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const executor = new FakeOracleDynamicExecutor()
    executor.failure = {
      kind,
      operation,
    }

    const report = runLane(source, executor, fixture.repository.root, fixture.subjectCommit)

    expect(report.outcome).toBe("INCOMPLETE")
    expect(report.requiredChecksComplete).toBe(false)
    expect(report.evidenceAvailable).toBe(operation !== "preflight")
    if (operation !== "preflight") {
      expect(executor.operations).toContain("release-lock:phase4-sql-evidence")
    }
  })
})
