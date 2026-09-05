import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"
import { createFindingFingerprint } from "../db-quality-gate/contract"
import { readFileAtCommit } from "../db-quality-gate/git-evidence"
import { migrationContentSha256 } from "../db-quality-gate/migration-source"
import { stableJsonSha256 } from "../db-quality-gate/serialization"
import { repositoryHead } from "./database-quality-gate-static-test-support"
import {
  addSqlTestsToDynamicFixture,
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
    const subjectCommit = addSqlTestsToDynamicFixture(
      fixture,
      ["supabase/tests/second-example.sql"],
      "add second SQL test to dynamic evidence fixture"
    )
    const executor = new FakeOracleDynamicExecutor()
    executor.failure = {
      kind: "unavailable",
      operation: "run-sql-test",
    }
    executor.sqlTestFailurePath = "supabase/tests/second-example.sql"

    const report = runLane(source, executor, fixture.repository.root, subjectCommit)
    const unavailableFinding = report.findings.find(
      (finding) => finding.ruleId === "dynamic.run-sql-test.unavailable"
    )

    expect(report.outcome).toBe("INCOMPLETE")
    expect(unavailableFinding).toMatchObject({
      evidence: {
        kind: "unavailable",
        operation: "run-sql-test",
      },
      fingerprint: createFindingFingerprint({
        evidence: {
          kind: "unavailable",
          operation: "run-sql-test",
        },
        ruleId: "dynamic.run-sql-test.unavailable",
        subject: "run-sql-test",
      }),
    })
    expect(unavailableFinding?.evidence).not.toHaveProperty("sqlTestPath")
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

  it("attempts every registered SQL test and records each deterministic failure by path", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const paths = [
      "supabase/tests/example.sql",
      "supabase/tests/second-example.sql",
      "supabase/tests/third-example.sql",
      "supabase/tests/zz-fourth-example.sql",
    ]
    const subjectCommit = addSqlTestsToDynamicFixture(
      fixture,
      paths.slice(1),
      "add exhaustive SQL test fixture"
    )
    const executor = new FakeOracleDynamicExecutor()
    const rawErrors = [
      "password=do-not-persist second failure",
      "token=do-not-persist third failure",
    ]
    executor.sqlTestFailures.set(paths[1], {
      diagnostic: { category: "undefined-function", stderrSha256: "d".repeat(64) },
      error: rawErrors[0],
      kind: "failed",
      operation: "run-sql-test",
    })
    executor.sqlTestFailures.set(paths[2], {
      diagnostic: { category: "unknown", stderrSha256: "e".repeat(64) },
      error: rawErrors[1],
      kind: "failed",
      operation: "run-sql-test",
    })

    const report = runLane(source, executor, fixture.repository.root, subjectCommit)
    const persistedReport = executor.persistedReports[0]
    const failedFindings = report.findings.filter(
      (finding) => finding.ruleId === "dynamic.run-sql-test.failed"
    )

    expect(report.outcome).toBe("FAILED")
    expect(report.sqlTestExecution).toEqual({ attempted: paths, executed: paths, selected: paths })
    expect(executor.runSqlTestPaths).toEqual(paths)
    expect(failedFindings).toHaveLength(2)
    expect(failedFindings.map((finding) => finding.evidence?.sqlTestPath)).toEqual([
      paths[1],
      paths[2],
    ])
    failedFindings.forEach((finding, index) => {
      const sqlTestPath = paths[index + 1]
      expect(finding.fingerprint).toBe(
        createFindingFingerprint({
          evidence: {
            diagnosticCategory: index === 0 ? "undefined-function" : "unknown",
            kind: "failed",
            operation: "run-sql-test",
            sqlTestPath,
            stderrSha256: (index === 0 ? "d" : "e").repeat(64),
          },
          ruleId: "dynamic.run-sql-test.failed",
          subject: `run-sql-test:${sqlTestPath}`,
        })
      )
    })
    rawErrors.forEach((rawError) => expect(persistedReport).not.toContain(rawError))
  })

  it("stops after unavailable SQL evidence while still attempting terminal cleanup and reporting", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const paths = [
      "supabase/tests/example.sql",
      "supabase/tests/second-example.sql",
      "supabase/tests/zz-final-example.sql",
    ]
    const subjectCommit = addSqlTestsToDynamicFixture(
      fixture,
      paths.slice(1),
      "add mixed SQL test fixture"
    )
    const executor = new FakeOracleDynamicExecutor()
    executor.sqlTestFailures.set(paths[0], {
      kind: "failed",
      operation: "run-sql-test",
    })
    executor.sqlTestFailures.set(paths[1], {
      kind: "unavailable",
      operation: "run-sql-test",
    })

    const report = runLane(source, executor, fixture.repository.root, subjectCommit)

    expect(report.outcome).toBe("INCOMPLETE")
    expect(report.sqlTestExecution).toEqual({
      attempted: paths.slice(0, 2),
      executed: [paths[0]],
      selected: paths,
    })
    expect(executor.runSqlTestPaths).toEqual(paths.slice(0, 2))
    expect(executor.droppedDatabases).toEqual(["dq_baseline_forward_phase4_sql_evidence"])
    expect(executor.operations).toContain("release-lock:phase4-sql-evidence")
    expect(executor.operations).toContain("persist-report:phase4-sql-evidence")
  })

  it("does not reapply a matching path and SHA after catch-up when the live timestamp differs", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const executor = new FakeOracleDynamicExecutor()
    const candidateIdentity = {
      path: fixture.candidatePath,
      sha256: migrationContentSha256(fixture.candidateSql),
    }
    executor.baselineMigrationIdentities = [candidateIdentity]
    executor.baselineMigrationVersions = ["20270101000000", "20270202000000"]

    const report = runLane(source, executor, fixture.repository.root, fixture.subjectCommit)

    expect(report.outcome).toBe("PASS")
    expect(report.migrationIdentities).toContainEqual(candidateIdentity)
    expect(
      executor.operations.filter((operation) => operation.startsWith("apply-migrations"))
    ).toEqual([])
    expect(executor.createdDatabases).toEqual([
      {
        databaseName: "dq_baseline_forward_phase4_sql_evidence",
        template: "qltbyt_test",
      },
    ])
    expect(executor.operations).toContain("collect-catalogs:qltbyt_test")
    expect(executor.operations).toContain(
      "collect-catalogs:dq_baseline_forward_phase4_sql_evidence"
    )
    expect(executor.runSqlTestPaths).toEqual(["supabase/tests/example.sql"])
    expect(executor.droppedDatabases).toEqual(["dq_baseline_forward_phase4_sql_evidence"])
  })

  it("persists redacted diagnostics and pending identities for a candidate apply failure", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const candidatePath =
      "supabase/migrations/20260830090000_technical_configuration_copy_reentrant_workspace.sql"
    const repositoryRoot = process.cwd()
    const candidateSql = readFileAtCommit(
      repositoryRoot,
      repositoryHead(repositoryRoot),
      candidatePath
    )
    expect(candidateSql).toBeDefined()
    if (candidateSql === undefined) {
      throw new Error(`Missing committed candidate migration: ${candidatePath}`)
    }
    const fixture = createDynamicFixture({ candidatePath, candidateSql })
    const executor = new FakeOracleDynamicExecutor()
    const rawExecutorError = "password=do-not-persist raw apply failure"
    executor.failure = {
      diagnostic: {
        category: "undefined-function",
        stderrSha256: "a".repeat(64),
      },
      error: rawExecutorError,
      kind: "failed",
      operation: "apply-migrations",
    }
    const candidateIdentity = {
      path: candidatePath,
      sha256: "90505dff1524ed2dbe33ff51534faa4768620d6fd4f8dd03195010998dcac5f4",
    }
    const pendingMigrationsSha256 = stableJsonSha256([candidateIdentity])

    const report = runLane(source, executor, fixture.repository.root, fixture.subjectCommit)

    expect(report.outcome).toBe("FAILED")
    expect(migrationContentSha256(candidateSql)).toBe(candidateIdentity.sha256)
    expect(pendingMigrationsSha256).toBe(
      "b98046e52be6f64b62f342b254e5dd8f7dab5e1297eb78b1b5bb1f7c0048f189"
    )
    expect(report.migrationIdentities).toContainEqual(candidateIdentity)
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        evidence: {
          diagnosticCategory: "undefined-function",
          kind: "failed",
          operation: "apply-migrations",
          pendingMigrationCount: 1,
          pendingMigrationPaths: JSON.stringify([candidatePath]),
          pendingMigrationsSha256,
          stderrSha256: "a".repeat(64),
        },
        ruleId: "dynamic.apply-migrations.failed",
      })
    )
    expect(report.sqlTestExecution).toEqual({
      attempted: [],
      executed: [],
      selected: ["supabase/tests/example.sql"],
    })
    expect(executor.droppedDatabases).toEqual(["dq_baseline_forward_phase4_sql_evidence"])
    expect(executor.persistedReports).toHaveLength(1)
    expect(JSON.parse(executor.persistedReports[0]).findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({
          diagnosticCategory: "undefined-function",
          pendingMigrationPaths: JSON.stringify([candidatePath]),
          stderrSha256: "a".repeat(64),
        }),
        ruleId: "dynamic.apply-migrations.failed",
      })
    )
    expect(executor.persistedReports[0]).not.toContain(rawExecutorError)
    expect(executor.persistedReports[0]).not.toContain(candidateSql.trim())
  })

  it("persists the release-lock failure in the terminal report", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const fixture = createDynamicFixture()
    const executor = new FakeOracleDynamicExecutor()
    executor.additionalFailure = {
      diagnostic: {
        category: "unknown",
        stderrSha256: "c".repeat(64),
      },
      kind: "cleanup",
      operation: "release-lock",
    }

    const report = runLane(source, executor, fixture.repository.root, fixture.subjectCommit)
    const persistedReport = JSON.parse(executor.persistedReports[0])

    expect(report.outcome).toBe("INCOMPLETE")
    expect(persistedReport).toMatchObject({
      outcome: "INCOMPLETE",
      requiredChecksComplete: false,
    })
    expect(persistedReport.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({
          diagnosticCategory: "unknown",
          stderrSha256: "c".repeat(64),
        }),
        ruleId: "dynamic.release-lock.cleanup",
      })
    )
    expect(executor.operations.indexOf("release-lock:phase4-sql-evidence")).toBeLessThan(
      executor.operations.indexOf("persist-report:phase4-sql-evidence")
    )
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
    const rawExecutorError = `secret-${kind}-${operation}`
    executor.failure = {
      diagnostic: {
        category: "unknown",
        stderrSha256: "b".repeat(64),
      },
      error: rawExecutorError,
      kind,
      operation,
    }

    const report = runLane(source, executor, fixture.repository.root, fixture.subjectCommit)

    expect(report.outcome).toBe("INCOMPLETE")
    expect(report.requiredChecksComplete).toBe(false)
    expect(report.evidenceAvailable).toBe(operation !== "preflight")
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({
          diagnosticCategory: "unknown",
          stderrSha256: "b".repeat(64),
        }),
        ruleId: `dynamic.${operation}.${kind}`,
      })
    )
    expect(JSON.parse(executor.persistedReports[0]).findings).toContainEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({
          diagnosticCategory: "unknown",
          stderrSha256: "b".repeat(64),
        }),
        ruleId: `dynamic.${operation}.${kind}`,
      })
    )
    expect(executor.persistedReports[0]).not.toContain(rawExecutorError)
    if (operation !== "preflight") {
      expect(executor.operations).toContain("release-lock:phase4-sql-evidence")
    }
  })
})
