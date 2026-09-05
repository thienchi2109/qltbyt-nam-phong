import { mkdirSync, writeFileSync } from "node:fs"

import {
  defaultExpectedStateCatalogAccess,
  expectedStateInvariantRegistry,
} from "./database-quality-gate-expected-state-test-support"
import {
  commitWorkingTree,
  fixtureWithStaticMetadata,
  repositoryHead,
  sqlTestRegistry,
} from "./database-quality-gate-static-test-support"
import { fixtureJson } from "./database-quality-gate-test-support"
import type { OracleDiagnostic } from "../db-quality-gate/oracle-diagnostics"

export type DynamicFailureKind =
  | "cleanup"
  | "disk-pressure"
  | "failed"
  | "interrupted"
  | "stale-environment"
  | "timeout"
  | "unavailable"

type DynamicOperation =
  | "acquire-lock"
  | "apply-migrations"
  | "clone-baseline"
  | "collect-catalogs"
  | "create-database"
  | "drop-database"
  | "persist-report"
  | "preflight"
  | "recover-orphans"
  | "release-lock"
  | "run-sql-test"

type ExecutorResult<T> =
  | {
      status: "ok"
      value: T
    }
  | {
      diagnostic?: OracleDiagnostic
      error: string
      kind: DynamicFailureKind
      status: "error"
    }

type SimulatedFailure = {
  diagnostic?: OracleDiagnostic
  error?: string
  kind: DynamicFailureKind
  operation: DynamicOperation
}

export type DynamicLaneInput = {
  baselineControlReport?: unknown
  createdAt: string
  executor: FakeOracleDynamicExecutor
  lane: "baseline-forward"
  repositoryRoot: string
  runId: string
  subjectCommit: string
}

export type DynamicLaneModule = {
  createDisposableDatabaseName: (input: {
    lane: "baseline-control" | "baseline-forward"
    runId: string
  }) => string
  runOracleDynamicLane: (input: DynamicLaneInput) => {
    baselineMigrationHighWater: string
    digest: string
    evidenceAvailable?: boolean
    findings: Array<{
      classification: "BLOCKING" | "DANGEROUS" | "WARNING"
      evidence?: Record<string, number | string>
      fingerprint: string
      ruleId: string
    }>
    inputHashes: Record<string, string>
    lane: "baseline-forward"
    migrationIdentities: Array<{ path: string; sha256: string }>
    outcome: "FAILED" | "INCOMPLETE" | "PASS"
    requiredChecksComplete?: boolean
    runId: string
    baselineControlSqlTestExecution?: {
      attempted: string[]
      executed: string[]
      selected: string[]
    }
    sqlTestExecution?: {
      attempted: string[]
      executed: string[]
      selected: string[]
    }
  }
}

export function createDynamicFixture(
  options: {
    candidatePath?: string
    candidateSql?: string
  } = {}
) {
  const candidatePath = options.candidatePath ?? "supabase/migrations/20270201000000_candidate.sql"
  const candidateSql =
    options.candidateSql ?? "CREATE TABLE public.candidate_only (id bigint PRIMARY KEY);\n"
  const repository = fixtureWithStaticMetadata({
    path: "supabase/migrations/20270101000000_already_in_baseline.sql",
    sql: "CREATE TABLE public.baseline_only (id bigint PRIMARY KEY);\n",
  })
  writeFileSync(
    repository.path("supabase", "db-quality-gate-invariants.json"),
    `${JSON.stringify(expectedStateInvariantRegistry(), null, 2)}\n`
  )
  mkdirSync(repository.path("supabase", "tests"), { recursive: true })
  writeFileSync(
    repository.path("supabase", "tests", "example.sql"),
    "BEGIN;\nSELECT 1;\nROLLBACK;\n"
  )
  writeFileSync(repository.path(...candidatePath.split("/")), candidateSql)
  commitWorkingTree(repository.root, "add baseline-forward dynamic lane fixture inputs")

  return {
    candidatePath,
    candidateSql,
    repository,
    subjectCommit: repositoryHead(repository.root),
  }
}

export function addSqlTestsToDynamicFixture(
  fixture: ReturnType<typeof createDynamicFixture>,
  additionalPaths: string[],
  commitMessage: string
): string {
  const registry = sqlTestRegistry()
  registry.tests.push(
    ...additionalPaths.map((path) => ({
      ...registry.tests[0],
      path,
    }))
  )
  writeFileSync(
    fixture.repository.path("supabase", "db-quality-gate-tests.json"),
    fixtureJson(registry)
  )
  additionalPaths.forEach((path, index) => {
    writeFileSync(
      fixture.repository.path(...path.split("/")),
      `BEGIN;\nSELECT ${index + 2};\nROLLBACK;\n`
    )
  })
  commitWorkingTree(fixture.repository.root, commitMessage)
  return repositoryHead(fixture.repository.root)
}

export class FakeOracleDynamicExecutor {
  appliedDatabases: string[] = []
  appliedMigrationContents: string[] = []
  baselineCreatedDatabases: Array<{ databaseName: string; template?: string }> = []
  baselineDroppedDatabases: string[] = []
  baselineRunSqlTestContents: string[] = []
  baselineRunSqlTestPaths: string[] = []
  createdDatabases: Array<{ databaseName: string; template?: string }> = []
  droppedDatabases: string[] = []
  operations: string[] = []
  persistedReports: string[] = []
  runSqlTestContents: string[] = []
  runSqlTestPaths: string[] = []
  catalogs = {
    access: defaultExpectedStateCatalogAccess(),
    application: {
      relations: [],
      routines: [],
    },
    environment: {
      extensions: [],
      postgresqlVersion: "17.6",
      supabaseVersion: "v1.26.08",
    },
  }
  baselineCatalogs = structuredClone(this.catalogs)

  failure?: SimulatedFailure

  sqlTestFailurePath?: string

  sqlTestFailures = new Map<string, SimulatedFailure>()

  baselineSqlTestFailures = new Map<string, SimulatedFailure>()

  additionalFailure?: SimulatedFailure

  baselineMigrationIdentities: Array<{ path: string; sha256: string }> = []
  baselineMigrationVersions = ["20270101000000"]

  preflight(): ExecutorResult<{
    baseline: {
      healthy: boolean
      migrationIdentities: Array<{ path: string; sha256: string }>
      migrationVersions: string[]
      stateHash: string
    }
    executorEnvironment: Record<string, string>
  }> {
    return this.result("preflight", {
      baseline: {
        healthy: true,
        migrationIdentities: this.baselineMigrationIdentities,
        migrationVersions: this.baselineMigrationVersions,
        stateHash: "b".repeat(64),
      },
      executorEnvironment: {
        execution: "oracle-disposable-test",
        postgres: "17.6",
      },
    })
  }

  acquireLock(runId: string): ExecutorResult<undefined> {
    return this.result("acquire-lock", undefined, runId)
  }

  releaseLock(runId: string): ExecutorResult<undefined> {
    return this.result("release-lock", undefined, runId)
  }

  recoverOrphans(prefix: string): ExecutorResult<undefined> {
    return this.result("recover-orphans", undefined, prefix)
  }

  createDatabase(input: { databaseName: string; template?: string }): ExecutorResult<undefined> {
    if (input.databaseName.startsWith("dq_baseline_control_")) {
      this.baselineCreatedDatabases.push(input)
      this.operations.push(`create-database:${input.databaseName}`)
      return { status: "ok", value: undefined }
    }
    this.createdDatabases.push(input)
    return this.result("create-database", undefined, input.databaseName)
  }

  applyMigrations(input: {
    databaseName: string
    migrations: Array<{ content: string; path: string; sha256: string }>
  }): ExecutorResult<undefined> {
    this.appliedDatabases.push(input.databaseName)
    this.appliedMigrationContents.push(...input.migrations.map((migration) => migration.content))
    return this.result(
      "apply-migrations",
      undefined,
      `${input.databaseName}:${input.migrations.map((migration) => migration.path).join(",")}`
    )
  }

  collectCatalogs(input: { databaseName: string }): ExecutorResult<{
    access: unknown
    application: unknown
    environment: unknown
  }> {
    return this.result(
      "collect-catalogs",
      input.databaseName === "qltbyt_test" ? this.baselineCatalogs : this.catalogs,
      input.databaseName
    )
  }

  runSqlTest(input: {
    content: string
    databaseName: string
    path: string
    timeoutSeconds: number
  }): ExecutorResult<undefined> {
    const baselineControl = input.databaseName.startsWith("dq_baseline_control_")
    if (baselineControl) {
      this.baselineRunSqlTestContents.push(input.content)
      this.baselineRunSqlTestPaths.push(input.path)
    } else {
      this.runSqlTestContents.push(input.content)
      this.runSqlTestPaths.push(input.path)
    }
    const pathFailure = baselineControl
      ? this.baselineSqlTestFailures.get(input.path)
      : this.sqlTestFailures.get(input.path)
    if (pathFailure !== undefined) {
      return this.result(
        "run-sql-test",
        undefined,
        `${input.databaseName}:${input.timeoutSeconds}`,
        pathFailure
      )
    }
    if (baselineControl) {
      this.operations.push(`run-sql-test:${input.databaseName}:${input.timeoutSeconds}`)
      return { status: "ok", value: undefined }
    }
    if (
      this.failure?.operation === "run-sql-test" &&
      this.sqlTestFailurePath !== undefined &&
      this.sqlTestFailurePath !== input.path
    ) {
      this.operations.push(`run-sql-test:${input.databaseName}:${input.timeoutSeconds}`)
      return {
        status: "ok",
        value: undefined,
      }
    }
    return this.result("run-sql-test", undefined, `${input.databaseName}:${input.timeoutSeconds}`)
  }

  persistReport(input: { report: string; runId: string }): ExecutorResult<{ evidenceId: string }> {
    this.persistedReports.push(input.report)
    return this.result("persist-report", { evidenceId: `oracle:${input.runId}` }, input.runId)
  }

  dropDatabase(databaseName: string): ExecutorResult<undefined> {
    if (databaseName.startsWith("dq_baseline_control_")) {
      this.baselineDroppedDatabases.push(databaseName)
      this.operations.push(`drop-database:${databaseName}`)
      return { status: "ok", value: undefined }
    }
    this.droppedDatabases.push(databaseName)
    return this.result("drop-database", undefined, databaseName)
  }

  private result<T>(
    operation: DynamicOperation,
    value: T,
    detail = "",
    pathFailure?: SimulatedFailure
  ): ExecutorResult<T> {
    this.operations.push(detail.length === 0 ? operation : `${operation}:${detail}`)
    const failure =
      pathFailure ??
      (this.failure?.operation === operation
        ? this.failure
        : this.additionalFailure?.operation === operation
          ? this.additionalFailure
          : undefined)
    if (failure !== undefined) {
      return {
        diagnostic: failure.diagnostic,
        error: failure.error ?? `Simulated ${failure.kind} at ${operation}`,
        kind: failure.kind,
        status: "error",
      }
    }

    return {
      status: "ok",
      value,
    }
  }
}
