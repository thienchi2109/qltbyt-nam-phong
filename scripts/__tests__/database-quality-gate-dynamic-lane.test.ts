import { writeFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"
import {
  createDynamicFixture,
  DynamicLaneModule,
  FakeOracleDynamicExecutor,
} from "./database-quality-gate-dynamic-test-support"
import { defaultExpectedStateCatalogAccess } from "./database-quality-gate-expected-state-test-support"

type CommandModule = {
  runDatabaseQualityGateCommand: (
    args: string[],
    dependencies?: {
      dynamicExecutor?: () => FakeOracleDynamicExecutor | undefined
      repositoryRoot?: string
      subjectCommit?: string
    }
  ) => {
    exitCode: 0 | 1 | 2
    stdout: string
  }
}

function runLane(source: DynamicLaneModule, executor: FakeOracleDynamicExecutor) {
  const fixture = createDynamicFixture()

  return {
    executor,
    report: source.runOracleDynamicLane({
      createdAt: "2026-08-17T04:30:00Z",
      executor,
      lane: "baseline-forward",
      repositoryRoot: fixture.repository.root,
      runId: "phase4-contract",
      subjectCommit: fixture.subjectCommit,
    }),
  }
}

describe("database quality gate Phase 4 disposable Oracle execution", () => {
  it("derives a deterministic PostgreSQL-safe name for each disposable lane run", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")

    expect(
      source.createDisposableDatabaseName({
        lane: "baseline-forward",
        runId: "phase4-contract",
      })
    ).toBe("dq_baseline_forward_phase4_contract")
    const longRunId = `phase4-${"a".repeat(80)}`
    const firstLongName = source.createDisposableDatabaseName({
      lane: "baseline-forward",
      runId: longRunId,
    })
    const secondLongName = source.createDisposableDatabaseName({
      lane: "baseline-forward",
      runId: longRunId,
    })

    expect(firstLongName).toBe(secondLongName)
    expect(firstLongName).toMatch(/^dq_baseline_forward_[a-f0-9]+$/)
    expect(firstLongName).toHaveLength(63)
  })

  it("clones only qltbyt_test and applies only ordered pending migrations to the disposable clone", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const executor = new FakeOracleDynamicExecutor()
    const { report } = runLane(source, executor)

    expect(report.outcome).toBe("PASS")
    expect(report.requiredChecksComplete).toBe(true)
    expect(report.evidenceAvailable).toBe(true)
    expect(executor.createdDatabases).toEqual([
      {
        databaseName: "dq_baseline_forward_phase4_contract",
        template: "qltbyt_test",
      },
    ])
    expect(executor.appliedDatabases).toEqual(["dq_baseline_forward_phase4_contract"])
    expect(executor.operations).toContain(
      "apply-migrations:dq_baseline_forward_phase4_contract:supabase/migrations/20270201000000_candidate.sql"
    )
    expect(executor.appliedDatabases).not.toContain("qltbyt_test")
    expect(executor.runSqlTestPaths).toEqual(["supabase/tests/example.sql"])
    expect(executor.droppedDatabases).toEqual(["dq_baseline_forward_phase4_contract"])
    expect(executor.persistedReports).toHaveLength(1)
    expect(executor.operations).toContain("collect-catalogs:qltbyt_test")
    expect(executor.operations.indexOf("release-lock:phase4-contract")).toBeLessThan(
      executor.operations.indexOf("persist-report:phase4-contract")
    )
  })

  it("keeps unchanged routine search-path debt visible while blocking a new regression", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const historicalRoutine = {
      executionMode: "definer",
      extensionOwned: false,
      grants: [],
      identity: "public.historical_definer()",
      owner: "postgres",
      searchPath: null,
    }
    const executor = new FakeOracleDynamicExecutor()
    executor.baselineCatalogs.access = defaultExpectedStateCatalogAccess({
      routines: [historicalRoutine],
    })
    executor.catalogs.access = defaultExpectedStateCatalogAccess({
      routines: [historicalRoutine],
    })

    const historical = runLane(source, executor).report

    expect(historical.outcome).toBe("PASS")
    expect(historical.findings).toContainEqual(
      expect.objectContaining({
        classification: "WARNING",
        ruleId: "catalog.routine.search-path",
      })
    )
    expect(historical.sqlTestExecution).toEqual({
      attempted: ["supabase/tests/example.sql"],
      executed: ["supabase/tests/example.sql"],
      selected: ["supabase/tests/example.sql"],
    })
    expect(executor.runSqlTestPaths).toEqual(["supabase/tests/example.sql"])
    expect(executor.operations).toContain("collect-catalogs:dq_baseline_forward_phase4_contract")

    const regressedExecutor = new FakeOracleDynamicExecutor()
    regressedExecutor.baselineCatalogs.access = defaultExpectedStateCatalogAccess({
      routines: [historicalRoutine],
    })
    regressedExecutor.catalogs.access = defaultExpectedStateCatalogAccess({
      routines: [
        historicalRoutine,
        {
          ...historicalRoutine,
          identity: "public.new_unsafe_definer()",
        },
      ],
    })

    const regressed = runLane(source, regressedExecutor).report

    expect(regressed.outcome).toBe("FAILED")
    expect(
      regressed.findings.filter(
        (finding) =>
          finding.classification === "BLOCKING" && finding.ruleId === "catalog.routine.search-path"
      )
    ).toHaveLength(1)
    expect(regressed.sqlTestExecution).toEqual({
      attempted: [],
      executed: [],
      selected: ["supabase/tests/example.sql"],
    })
    expect(regressedExecutor.runSqlTestPaths).toEqual([])
  })

  it("does not infer a legacy filename mapping from unrelated Oracle migration versions", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const executor = new FakeOracleDynamicExecutor()
    executor.baselineMigrationVersions = ["19990101000000", "20270101000000"]
    const { report } = runLane(source, executor)

    expect(report.outcome).toBe("PASS")
    expect(executor.operations).toContain(
      "apply-migrations:dq_baseline_forward_phase4_contract:supabase/migrations/20270201000000_candidate.sql"
    )
  })

  it("runs baseline-forward without committed bootstrap artifacts", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const executor = new FakeOracleDynamicExecutor()
    const fixture = createDynamicFixture()

    const report = source.runOracleDynamicLane({
      createdAt: "2026-08-18T12:00:00Z",
      executor,
      lane: "baseline-forward",
      repositoryRoot: fixture.repository.root,
      runId: "phase4-no-bootstrap",
      subjectCommit: fixture.subjectCommit,
    })

    expect(report.outcome).toBe("PASS")
    expect(executor.createdDatabases).toEqual([
      {
        databaseName: "dq_baseline_forward_phase4_no_bootstrap",
        template: "qltbyt_test",
      },
    ])
    expect(executor.appliedDatabases).toEqual(["dq_baseline_forward_phase4_no_bootstrap"])
    expect(executor.droppedDatabases).toEqual(["dq_baseline_forward_phase4_no_bootstrap"])
  })

  it("returns INCOMPLETE without creating a database when the Oracle executor is unavailable", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const executor = new FakeOracleDynamicExecutor()
    executor.failure = {
      kind: "unavailable",
      operation: "preflight",
    }

    const { report } = runLane(source, executor)

    expect(report.outcome).toBe("INCOMPLETE")
    expect(report.requiredChecksComplete).toBe(false)
    expect(report.evidenceAvailable).toBe(false)
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "BLOCKING",
          ruleId: "dynamic.preflight.unavailable",
        }),
      ])
    )
    expect(executor.createdDatabases).toEqual([])
    expect(executor.persistedReports).toHaveLength(1)
    expect(executor.operations.indexOf("acquire-lock:phase4-contract")).toBeLessThan(
      executor.operations.indexOf("preflight")
    )
    expect(executor.operations.indexOf("preflight")).toBeLessThan(
      executor.operations.indexOf("release-lock:phase4-contract")
    )
    expect(executor.operations.indexOf("release-lock:phase4-contract")).toBeLessThan(
      executor.operations.indexOf("persist-report:phase4-contract")
    )
  })

  it("returns FAILED for a candidate migration failure and still cleans up the disposable database", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const executor = new FakeOracleDynamicExecutor()
    executor.failure = {
      kind: "failed",
      operation: "apply-migrations",
    }

    const { report } = runLane(source, executor)

    expect(report.outcome).toBe("FAILED")
    expect(executor.droppedDatabases).toEqual(["dq_baseline_forward_phase4_contract"])
    expect(executor.operations).toContain("release-lock:phase4-contract")
  })

  it("returns FAILED for a selected default-safe SQL test failure and still cleans up", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const executor = new FakeOracleDynamicExecutor()
    executor.failure = {
      kind: "failed",
      operation: "run-sql-test",
    }

    const { report } = runLane(source, executor)

    expect(report.outcome).toBe("FAILED")
    expect(report.sqlTestExecution).toEqual({
      attempted: ["supabase/tests/example.sql"],
      executed: ["supabase/tests/example.sql"],
      selected: ["supabase/tests/example.sql"],
    })
    expect(executor.runSqlTestPaths).toEqual(["supabase/tests/example.sql"])
    expect(JSON.parse(executor.persistedReports[0]).sqlTestExecution).toEqual(
      report.sqlTestExecution
    )
    expect(executor.droppedDatabases).toEqual(["dq_baseline_forward_phase4_contract"])
  })

  it("includes a lock-release failure after an interrupted run in the final INCOMPLETE report", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const executor = new FakeOracleDynamicExecutor()
    executor.failure = {
      kind: "unavailable",
      operation: "recover-orphans",
    }
    executor.additionalFailure = {
      kind: "cleanup",
      operation: "release-lock",
    }

    const { report } = runLane(source, executor)

    expect(report.outcome).toBe("INCOMPLETE")
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "dynamic.recover-orphans.unavailable" }),
        expect.objectContaining({ ruleId: "dynamic.release-lock.cleanup" }),
      ])
    )
  })

  it("keeps an immutable per-run evidence record before reporting PASS", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const executor = new FakeOracleDynamicExecutor()
    const { report } = runLane(source, executor)

    expect(report.outcome).toBe("PASS")
    expect(executor.persistedReports[0]).toContain('"outcome":"PASS"')
    expect(executor.persistedReports[0]).toContain('"runId":"phase4-contract"')
  })

  it("persists an INCOMPLETE report after an executor fault when Oracle evidence remains writable", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const executor = new FakeOracleDynamicExecutor()
    executor.failure = {
      kind: "timeout",
      operation: "run-sql-test",
    }

    const { report } = runLane(source, executor)

    expect(report.outcome).toBe("INCOMPLETE")
    expect(executor.persistedReports).toHaveLength(1)
    expect(JSON.parse(executor.persistedReports[0])).toMatchObject({
      outcome: "INCOMPLETE",
      requiredChecksComplete: false,
    })
  })

  it("binds migrations, registries, invariants, and SQL tests to subjectCommit", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const executor = new FakeOracleDynamicExecutor()

    writeFileSync(
      fixture.repository.path("supabase", "migrations", "20270201000000_candidate.sql"),
      "CREATE TABLE public.worktree_only (id bigint PRIMARY KEY);\n"
    )
    writeFileSync(fixture.repository.path("supabase", "db-quality-gate-tests.json"), "not JSON\n")
    writeFileSync(fixture.repository.path("supabase", "db-quality-gate-invariants.json"), "{}\n")
    writeFileSync(
      fixture.repository.path("supabase", "tests", "example.sql"),
      "BEGIN;\nSELECT 'worktree_only';\nROLLBACK;\n"
    )

    const report = source.runOracleDynamicLane({
      createdAt: "2026-08-17T04:30:00Z",
      executor,
      lane: "baseline-forward",
      repositoryRoot: fixture.repository.root,
      runId: "phase4-commit-bound",
      subjectCommit: fixture.subjectCommit,
    })

    expect(report.outcome).toBe("PASS")
    expect(executor.appliedMigrationContents.join("\n")).toContain("candidate_only")
    expect(executor.appliedMigrationContents.join("\n")).not.toContain("worktree_only")
    expect(executor.runSqlTestContents).toEqual(["BEGIN;\nSELECT 1;\nROLLBACK;\n"])
  })

  it("executes a configured dynamic lane through the injected Oracle executor only", async () => {
    const command = await loadDatabaseQualityGateModule<CommandModule>("cli")
    const fixture = createDynamicFixture()
    const executor = new FakeOracleDynamicExecutor()

    const result = command.runDatabaseQualityGateCommand(
      [
        "--created-at",
        "2026-08-17T04:30:00Z",
        "--lane",
        "baseline-forward",
        "--run-id",
        "phase4-cli",
        "--subject-commit",
        fixture.subjectCommit,
      ],
      {
        dynamicExecutor: () => executor,
        repositoryRoot: fixture.repository.root,
        subjectCommit: fixture.subjectCommit,
      }
    )

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      evidenceAvailable: true,
      lane: "baseline-forward",
      outcome: "PASS",
      requiredChecksComplete: true,
    })
    expect(executor.appliedDatabases).toEqual(["dq_baseline_forward_phase4_cli"])
  })

  it("requires an explicit immutable run ID before dispatching a dynamic Oracle lane", async () => {
    const command = await loadDatabaseQualityGateModule<CommandModule>("cli")
    const fixture = createDynamicFixture()
    const executor = new FakeOracleDynamicExecutor()

    const result = command.runDatabaseQualityGateCommand(
      [
        "--created-at",
        "2026-08-17T04:30:00Z",
        "--lane",
        "baseline-forward",
        "--subject-commit",
        fixture.subjectCommit,
      ],
      {
        dynamicExecutor: () => executor,
        repositoryRoot: fixture.repository.root,
        subjectCommit: fixture.subjectCommit,
      }
    )

    expect(result.exitCode).toBe(2)
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: "Dynamic Oracle lanes require an explicit --run-id",
      outcome: "INCOMPLETE",
    })
    expect(executor.operations).toEqual([])
  })

  it("keeps a dynamic lane INCOMPLETE when no Oracle executor is configured", async () => {
    const command = await loadDatabaseQualityGateModule<CommandModule>("cli")
    const fixture = createDynamicFixture()

    const result = command.runDatabaseQualityGateCommand(
      [
        "--created-at",
        "2026-08-17T04:30:00Z",
        "--lane",
        "baseline-forward",
        "--run-id",
        "phase4-cli-unavailable",
        "--subject-commit",
        fixture.subjectCommit,
      ],
      {
        dynamicExecutor: () => undefined,
        repositoryRoot: fixture.repository.root,
        subjectCommit: fixture.subjectCommit,
      }
    )

    expect(result.exitCode).toBe(2)
    expect(JSON.parse(result.stdout)).toMatchObject({
      evidenceAvailable: false,
      lane: "baseline-forward",
      outcome: "INCOMPLETE",
      requiredChecksComplete: false,
    })
  })
})
