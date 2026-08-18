import type { MigrationIdentity } from "./types"

/** Fixed persistent baseline that dynamic lanes may read or clone but never mutate. */
export const ORACLE_BASELINE_DATABASE = "qltbyt_test"

/** Failure categories that distinguish a deterministic candidate failure from unavailable evidence. */
export type DynamicFailureKind =
  | "cleanup"
  | "disk-pressure"
  | "failed"
  | "interrupted"
  | "stale-environment"
  | "timeout"
  | "unavailable"

/** Result returned by an Oracle operation without allowing uncaught executor errors into the gate. */
export type OracleExecutorResult<T> =
  | {
      status: "ok"
      value: T
    }
  | {
      error: string
      kind: DynamicFailureKind
      status: "error"
    }

/** Read-only Oracle facts required before a disposable validation run can begin. */
export type OracleDynamicPreflight = {
  baseline: {
    healthy: boolean
    migrationVersions: string[]
  }
  executorEnvironment: Record<string, string>
}

/** Oracle boundary used by the dynamic lane; implementations may only mutate named disposable databases. */
export type OracleDynamicExecutor = {
  acquireLock: (runId: string) => OracleExecutorResult<undefined>
  applyMigrations: (input: {
    databaseName: string
    migrations: Array<
      MigrationIdentity & {
        content: string
      }
    >
  }) => OracleExecutorResult<undefined>
  collectCatalogs: (input: { databaseName: string }) => OracleExecutorResult<{
    access: unknown
    application: unknown
    environment: unknown
  }>
  createDatabase: (input: {
    databaseName: string
    template?: typeof ORACLE_BASELINE_DATABASE
  }) => OracleExecutorResult<undefined>
  dropDatabase: (databaseName: string) => OracleExecutorResult<undefined>
  persistReport: (input: { report: string; runId: string }) => OracleExecutorResult<{
    evidenceId: string
  }>
  preflight: () => OracleExecutorResult<OracleDynamicPreflight>
  recoverOrphans: (prefix: string) => OracleExecutorResult<undefined>
  releaseLock: (runId: string) => OracleExecutorResult<undefined>
  runSqlTest: (input: {
    content: string
    databaseName: string
    fixtureContract: "isolated-fixture"
    path: string
    runnerRequirements: string[]
    timeoutSeconds: number
    transactionContract: "rollback-required"
  }) => OracleExecutorResult<undefined>
}

/** Inputs for one offline baseline-forward Oracle validation run. */
export type OracleDynamicLaneInput = {
  createdAt: string
  executor: OracleDynamicExecutor
  lane: "baseline-forward"
  repositoryRoot: string
  runId: string
  subjectCommit: string
}
