import { writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"
import { finalizeReport } from "../db-quality-gate/contract"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"
import { cleanupFixtureRepositories } from "./database-quality-gate-test-support"
import { commitWorkingTree } from "./database-quality-gate-static-test-support"
import {
  createDynamicFixture,
  DynamicLaneModule,
  FakeOracleDynamicExecutor,
} from "./database-quality-gate-dynamic-test-support"

type CommandModule = {
  runDatabaseQualityGateCommand: (
    args: string[],
    dependencies: {
      dynamicExecutor: () => FakeOracleDynamicExecutor
      evidenceStore: () => {
        readArtifact: () => { status: "ok"; value: string }
      }
      repositoryRoot: string
    }
  ) => { exitCode: number; stdout: string }
}

afterEach(cleanupFixtureRepositories)

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
    runId: "baseline-control-contract",
    subjectCommit,
  })
}

describe("database quality gate baseline control", () => {
  it.each([
    "baselineState",
    "harness",
    "invariants",
    "sqlTests",
    "sqlTestSources",
    "catalogBaselineAccess",
    "catalogBaselineApplication",
    "catalogBaselineEnvironment",
  ])("rejects stale %s evidence before candidate execution", async (key) => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const first = runLane(
      source,
      new FakeOracleDynamicExecutor(),
      fixture.repository.root,
      fixture.subjectCommit
    )
    first.inputHashes[key] = "0".repeat(64)
    const executor = new FakeOracleDynamicExecutor()
    const report = source.runOracleDynamicLane({
      baselineControlReport: finalizeReport(first),
      createdAt: "2026-08-17T04:31:00Z",
      executor,
      lane: "baseline-forward",
      repositoryRoot: fixture.repository.root,
      runId: "stale-control",
      subjectCommit: fixture.subjectCommit,
    })
    expect(report.outcome).toBe("INCOMPLETE")
    expect(executor.createdDatabases).toEqual([])
    expect(executor.appliedDatabases).toEqual([])
  })
  it("certifies SQL tests on a baseline clone before applying candidate migrations", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const executor = new FakeOracleDynamicExecutor()
    executor.baselineSqlTestFailures.set("supabase/tests/example.sql", {
      diagnostic: { category: "permission-denied", stderrSha256: "c".repeat(64) },
      kind: "failed",
      operation: "run-sql-test",
    })

    const report = runLane(source, executor, fixture.repository.root, fixture.subjectCommit)

    expect(report.outcome).toBe("FAILED")
    expect(report.baselineControlSqlTestExecution).toEqual({
      attempted: ["supabase/tests/example.sql"],
      executed: ["supabase/tests/example.sql"],
      selected: ["supabase/tests/example.sql"],
    })
    expect(report.sqlTestExecution).toEqual({
      attempted: [],
      executed: [],
      selected: ["supabase/tests/example.sql"],
    })
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ sqlTestPath: "supabase/tests/example.sql" }),
        ruleId: "dynamic.baseline-control.run-sql-test.failed",
      })
    )
    expect(executor.baselineCreatedDatabases).toEqual([
      {
        databaseName: "dq_baseline_control_baseline_control_contract",
        template: "qltbyt_test",
      },
    ])
    expect(executor.appliedDatabases).toEqual([])
    expect(executor.baselineDroppedDatabases).toEqual([
      "dq_baseline_control_baseline_control_contract",
    ])
  })

  it("binds reusable control evidence to committed SQL test contents", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const first = runLane(
      source,
      new FakeOracleDynamicExecutor(),
      fixture.repository.root,
      fixture.subjectCommit
    )
    writeFileSync(
      fixture.repository.path("supabase", "tests", "example.sql"),
      "BEGIN;\nSELECT 2;\nROLLBACK;\n"
    )
    const secondCommit = commitWorkingTree(fixture.repository.root, "change registered SQL test")
    const second = runLane(
      source,
      new FakeOracleDynamicExecutor(),
      fixture.repository.root,
      secondCommit
    )

    expect(first.inputHashes.sqlTestSources).toMatch(/^[a-f0-9]{64}$/u)
    expect(second.inputHashes.sqlTestSources).toMatch(/^[a-f0-9]{64}$/u)
    expect(second.inputHashes.sqlTestSources).not.toBe(first.inputHashes.sqlTestSources)
  })

  it("reuses a matching PASS control report without cloning the baseline again", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const first = runLane(
      source,
      new FakeOracleDynamicExecutor(),
      fixture.repository.root,
      fixture.subjectCommit
    )
    const executor = new FakeOracleDynamicExecutor()

    const report = source.runOracleDynamicLane({
      baselineControlReport: first,
      createdAt: "2026-08-17T04:31:00Z",
      executor,
      lane: "baseline-forward",
      repositoryRoot: fixture.repository.root,
      runId: "baseline-control-reuse",
      subjectCommit: fixture.subjectCommit,
    })

    expect(first.outcome).toBe("PASS")
    expect(report.outcome).toBe("PASS")
    expect(report.baselineControlSqlTestExecution).toEqual(first.baselineControlSqlTestExecution)
    expect(executor.baselineCreatedDatabases).toEqual([])
    expect(executor.baselineRunSqlTestPaths).toEqual([])
    expect(executor.runSqlTestPaths).toEqual(["supabase/tests/example.sql"])
  })

  it("loads reusable baseline-control evidence through the baseline-forward CLI", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const command = await loadDatabaseQualityGateModule<CommandModule>("cli")
    const fixture = createDynamicFixture()
    const control = runLane(
      source,
      new FakeOracleDynamicExecutor(),
      fixture.repository.root,
      fixture.subjectCommit
    )
    const executor = new FakeOracleDynamicExecutor()

    const result = command.runDatabaseQualityGateCommand(
      [
        "--baseline-control-digest",
        control.digest,
        "--baseline-control-run-id",
        "baseline-control-contract",
        "--created-at",
        "2026-08-17T04:32:00Z",
        "--lane",
        "baseline-forward",
        "--run-id",
        "baseline-control-cli-reuse",
        "--subject-commit",
        fixture.subjectCommit,
      ],
      {
        dynamicExecutor: () => executor,
        evidenceStore: () => ({
          readArtifact: () => ({ status: "ok", value: JSON.stringify(control) }),
        }),
        repositoryRoot: fixture.repository.root,
      }
    )

    expect(result.exitCode).toBe(0)
    expect(executor.baselineCreatedDatabases).toEqual([])
  })
})
