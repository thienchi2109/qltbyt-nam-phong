import { mkdirSync, writeFileSync } from "node:fs"

import {
  defaultExpectedStateCatalogAccess,
  expectedStateInvariantRegistry,
} from "./database-quality-gate-expected-state-test-support"
import {
  commitWorkingTree,
  fixtureWithStaticMetadata,
  repositoryHead,
} from "./database-quality-gate-static-test-support"

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
      error: string
      kind: DynamicFailureKind
      status: "error"
    }

export type DynamicLaneInput = {
  createdAt: string
  executor: FakeOracleDynamicExecutor
  lane: "baseline-forward"
  repositoryRoot: string
  runId: string
  subjectCommit: string
}

export type DynamicLaneModule = {
  createDisposableDatabaseName: (input: { lane: "baseline-forward"; runId: string }) => string
  runOracleDynamicLane: (input: DynamicLaneInput) => {
    baselineMigrationHighWater: string
    evidenceAvailable?: boolean
    findings: Array<{
      classification: "BLOCKING" | "DANGEROUS" | "WARNING"
      ruleId: string
    }>
    inputHashes: Record<string, string>
    lane: "baseline-forward"
    migrationIdentities: Array<{ path: string; sha256: string }>
    outcome: "FAILED" | "INCOMPLETE" | "PASS"
    requiredChecksComplete?: boolean
  }
}

export function createDynamicFixture() {
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
  writeFileSync(
    repository.path("supabase", "migrations", "20270201000000_candidate.sql"),
    "CREATE TABLE public.candidate_only (id bigint PRIMARY KEY);\n"
  )
  commitWorkingTree(repository.root, "add baseline-forward dynamic lane fixture inputs")

  return {
    repository,
    subjectCommit: repositoryHead(repository.root),
  }
}

export class FakeOracleDynamicExecutor {
  appliedDatabases: string[] = []
  appliedMigrationContents: string[] = []
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

  failure?: {
    kind: DynamicFailureKind
    operation: DynamicOperation
  }

  additionalFailure?: {
    kind: DynamicFailureKind
    operation: DynamicOperation
  }

  baselineMigrationVersions = ["20270101000000"]

  preflight(): ExecutorResult<{
    baseline: {
      healthy: boolean
      migrationVersions: string[]
    }
    executorEnvironment: Record<string, string>
  }> {
    return this.result("preflight", {
      baseline: {
        healthy: true,
        migrationVersions: this.baselineMigrationVersions,
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

  collectCatalogs(): ExecutorResult<{
    access: unknown
    application: unknown
    environment: unknown
  }> {
    return this.result("collect-catalogs", this.catalogs)
  }

  runSqlTest(input: {
    content: string
    databaseName: string
    path: string
    timeoutSeconds: number
  }): ExecutorResult<undefined> {
    this.runSqlTestContents.push(input.content)
    this.runSqlTestPaths.push(input.path)
    return this.result("run-sql-test", undefined, `${input.databaseName}:${input.timeoutSeconds}`)
  }

  persistReport(input: { report: string; runId: string }): ExecutorResult<{ evidenceId: string }> {
    this.persistedReports.push(input.report)
    return this.result("persist-report", { evidenceId: `oracle:${input.runId}` }, input.runId)
  }

  dropDatabase(databaseName: string): ExecutorResult<undefined> {
    this.droppedDatabases.push(databaseName)
    return this.result("drop-database", undefined, databaseName)
  }

  private result<T>(operation: DynamicOperation, value: T, detail = ""): ExecutorResult<T> {
    this.operations.push(detail.length === 0 ? operation : `${operation}:${detail}`)
    const failure =
      this.failure?.operation === operation
        ? this.failure
        : this.additionalFailure?.operation === operation
          ? this.additionalFailure
          : undefined
    if (failure !== undefined) {
      return {
        error: `Simulated ${failure.kind} at ${operation}`,
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
