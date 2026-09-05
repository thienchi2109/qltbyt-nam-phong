import { serializeReport } from "./contract"
import { reusableBaselineControlExecution } from "./baseline-control-evidence"
import {
  addDynamicFinding,
  createDynamicRunState,
  finalizeDynamicLaneReport,
  recordDynamicOperationError,
} from "./dynamic-lane-report"
import { ORACLE_BASELINE_DATABASE } from "./dynamic-lane-types"
import { runDynamicSqlTestSweep } from "./dynamic-sql-sweep"
import { runBaselineControl } from "./baseline-control-run"
import { reconcileSqlTestDebt } from "./sql-test-debt"
import {
  collectAccessFingerprint,
  collectApplicationFingerprint,
  collectEnvironmentFingerprint,
  evaluateCatalogContracts,
} from "./expected-state"
import { readCommittedMigrationInputs, readDynamicInputArtifacts } from "./dynamic-lane-inputs"
import { sha256Text } from "./serialization"
import type { GateReport, MigrationIdentity } from "./types"
import type { DynamicInputArtifacts } from "./dynamic-lane-inputs"
import type { OracleDynamicLaneInput } from "./dynamic-lane-types"

export type {
  DynamicFailureKind,
  OracleDynamicExecutor,
  OracleDynamicPreflight,
  OracleExecutorResult,
} from "./dynamic-lane-types"

const HISTORICAL_CATALOG_DEBT_RULES = new Set([
  "catalog.routine.search-path",
  "catalog.table-intent.missing",
])

function baselineMigrationHighWater(versions: string[]): string {
  return [...versions].sort().at(-1) ?? "unavailable"
}

function migrationVersion(identity: MigrationIdentity): string | undefined {
  return /^(\d{14})_/.exec(identity.path.split("/").at(-1) ?? "")?.[1]
}

function catalogFindingKey(finding: { fingerprint: string; ruleId: string }): string {
  return `${finding.ruleId}\u0000${finding.fingerprint}`
}

function pendingMigrations(
  state: ReturnType<typeof createDynamicRunState>,
  migrationIdentities: MigrationIdentity[],
  appliedMigrationIdentities: MigrationIdentity[],
  baselineMigrationIdentities: MigrationIdentity[],
  observedVersions: string[]
): MigrationIdentity[] | undefined {
  for (const identity of migrationIdentities) {
    const version = migrationVersion(identity)
    if (version === undefined) {
      addDynamicFinding(state, "dynamic.baseline.migration-version", identity.path, {
        path: identity.path,
      })
      state.incomplete = true
      return undefined
    }
  }

  const baselineIdentities = new Set(
    baselineMigrationIdentities.map((identity) => `${identity.path}\u0000${identity.sha256}`)
  )
  for (const identity of appliedMigrationIdentities) {
    const version = migrationVersion(identity)
    if (version === undefined) {
      addDynamicFinding(state, "dynamic.baseline.applied-migration-version", identity.path, {
        path: identity.path,
      })
      state.incomplete = true
      return undefined
    }
  }

  if (
    appliedMigrationIdentities.some((identity) => {
      const version = migrationVersion(identity)
      return (
        version !== undefined &&
        !observedVersions.includes(version) &&
        !baselineIdentities.has(`${identity.path}\u0000${identity.sha256}`)
      )
    })
  ) {
    addDynamicFinding(state, "dynamic.baseline.migration-evidence", ORACLE_BASELINE_DATABASE, {
      baseline: ORACLE_BASELINE_DATABASE,
    })
    state.incomplete = true
    return undefined
  }

  const observed = new Set(observedVersions)
  return migrationIdentities.filter((identity) => {
    const version = migrationVersion(identity)
    return (
      version !== undefined &&
      !observed.has(version) &&
      !baselineIdentities.has(`${identity.path}\u0000${identity.sha256}`)
    )
  })
}

/** Produces a deterministic, PostgreSQL-safe database name for one isolated run. */
export function createDisposableDatabaseName(input: {
  lane: "baseline-control" | "baseline-forward"
  runId: string
}): string {
  const normalizedRunId = input.runId.toLowerCase().replaceAll(/[^a-z0-9_]+/g, "_")
  if (!/^[a-z0-9][a-z0-9_]*$/.test(normalizedRunId)) {
    throw new Error("Run ID cannot produce a disposable database name")
  }

  const lane = input.lane.replaceAll("-", "_")
  const prefix = `dq_${lane}_`
  const name = `${prefix}${normalizedRunId}`
  if (name.length <= 63) {
    return name
  }

  return `${prefix}${sha256Text(normalizedRunId).slice(0, 63 - prefix.length)}`
}

function persistTerminalReport(
  input: OracleDynamicLaneInput,
  state: ReturnType<typeof createDynamicRunState>,
  artifacts: DynamicInputArtifacts | undefined
): GateReport {
  const migrationIdentities = artifacts?.migrationIdentities ?? []
  const reportArtifacts = {
    harnessHash: artifacts?.harnessHash,
    invariants: artifacts?.invariants,
    sqlTests: artifacts?.sqlTestRegistry,
    sqlTestSourcesHash: artifacts?.sqlTestSourcesHash,
  }
  const report = finalizeDynamicLaneReport(
    input,
    state,
    migrationIdentities,
    state.preflightComplete,
    reportArtifacts
  )
  const persisted = input.executor.persistReport({
    report: serializeReport(report),
    runId: input.runId,
  })
  if (persisted.status === "error") {
    recordDynamicOperationError(state, "persist-report", persisted)
    return finalizeDynamicLaneReport(input, state, migrationIdentities, false, reportArtifacts)
  }

  return report
}

/** Runs a disposable Oracle lane and returns INCOMPLETE whenever required execution evidence is absent. */
export function runOracleDynamicLane(input: OracleDynamicLaneInput): GateReport {
  const state = createDynamicRunState()
  const lock = input.executor.acquireLock(input.runId)
  if (lock.status === "error") {
    recordDynamicOperationError(state, "acquire-lock", lock)
    return finalizeDynamicLaneReport(input, state, [], false, {
      invariants: undefined,
      harnessHash: undefined,
      sqlTests: undefined,
      sqlTestSourcesHash: undefined,
    })
  }

  let artifacts: DynamicInputArtifacts | undefined
  let baselineHistoricalFindingKeys = new Set<string>()
  let databaseName: string | undefined
  let databaseCreated = false
  let report: GateReport
  try {
    artifacts = readDynamicInputArtifacts(input, state)
    if (artifacts !== undefined) {
      state.sqlTestExecution.selected = artifacts.sqlTests.map((sqlTest) => sqlTest.path)
      const preflight = input.executor.preflight()
      if (preflight.status === "error") {
        recordDynamicOperationError(state, "preflight", preflight)
      } else {
        state.preflightComplete = true
        state.executorEnvironment = preflight.value.executorEnvironment
        state.baselineMigrationHighWater =
          preflight.value.baseline.migrationHighWater ??
          baselineMigrationHighWater(preflight.value.baseline.migrationVersions)
        state.catalogInputHashes.baselineState = preflight.value.baseline.stateHash ?? "unavailable"
        databaseName = createDisposableDatabaseName({
          lane: input.lane,
          runId: input.runId,
        })

        let canContinue = true
        if (!preflight.value.baseline.healthy) {
          addDynamicFinding(state, "dynamic.baseline.stale-environment", ORACLE_BASELINE_DATABASE, {
            baseline: ORACLE_BASELINE_DATABASE,
          })
          state.incomplete = true
          canContinue = false
        }

        const recover = canContinue ? input.executor.recoverOrphans("dq_baseline_") : undefined
        if (recover?.status === "error") {
          recordDynamicOperationError(state, "recover-orphans", recover)
          canContinue = false
        }

        const migrations = canContinue
          ? pendingMigrations(
              state,
              artifacts.migrationIdentities,
              artifacts.appliedMigrationIdentities,
              preflight.value.baseline.migrationIdentities ?? [],
              preflight.value.baseline.migrationVersions
            )
          : undefined
        if (migrations === undefined) {
          canContinue = false
        }

        const migrationInputsForRun =
          migrations === undefined
            ? undefined
            : readCommittedMigrationInputs(input, migrations, state)
        if (migrationInputsForRun === undefined) {
          canContinue = false
        }

        if (canContinue) {
          const baselineCatalogs = input.executor.collectCatalogs({
            databaseName: ORACLE_BASELINE_DATABASE,
          })
          if (baselineCatalogs.status === "error") {
            recordDynamicOperationError(state, "collect-baseline-catalogs", baselineCatalogs)
            canContinue = false
          } else {
            state.catalogInputHashes = {
              baselineState: state.catalogInputHashes.baselineState,
              catalogBaselineAccess: collectAccessFingerprint(baselineCatalogs.value.access),
              catalogBaselineApplication: collectApplicationFingerprint(
                baselineCatalogs.value.application
              ),
              catalogBaselineEnvironment: collectEnvironmentFingerprint(
                baselineCatalogs.value.environment
              ),
            }
            baselineHistoricalFindingKeys = new Set(
              evaluateCatalogContracts({
                access: baselineCatalogs.value.access,
                application: baselineCatalogs.value.application,
                environment: baselineCatalogs.value.environment,
                invariants: artifacts.invariants,
              })
                .findings.filter((finding) => HISTORICAL_CATALOG_DEBT_RULES.has(finding.ruleId))
                .map(catalogFindingKey)
            )
          }
        }

        if (
          canContinue &&
          migrationInputsForRun !== undefined &&
          input.baselineControlReport !== undefined
        ) {
          const reusableControl = reusableBaselineControlExecution({
            artifacts,
            baselineMigrationHighWater: state.baselineMigrationHighWater,
            baselineInputHashes: state.catalogInputHashes,
            report: input.baselineControlReport,
          })
          if (reusableControl === undefined) {
            addDynamicFinding(state, "dynamic.baseline-control.evidence", "baseline-control", {
              runId: input.baselineControlReport.runId,
            })
            state.incomplete = true
            canContinue = false
          } else {
            state.baselineControlSqlTestExecution = reusableControl
            state.executorEnvironment.baselineControl = `reused:${input.baselineControlReport.runId}`
          }
        }

        if (
          canContinue &&
          migrationInputsForRun !== undefined &&
          input.baselineControlReport === undefined
        ) {
          state.executorEnvironment.baselineControl = "inline"
          canContinue = runBaselineControl({
            databaseName: createDisposableDatabaseName({
              lane: "baseline-control",
              runId: input.runId,
            }),
            input,
            artifacts,
            state,
          })
        }

        if (canContinue && migrationInputsForRun !== undefined) {
          const created = input.executor.createDatabase({
            databaseName,
            template: ORACLE_BASELINE_DATABASE,
          })
          if (created.status === "error") {
            recordDynamicOperationError(state, "create-database", created)
            canContinue = false
          } else {
            databaseCreated = true
          }
        }

        if (
          canContinue &&
          migrationInputsForRun !== undefined &&
          migrationInputsForRun.length > 0
        ) {
          const applied = input.executor.applyMigrations({
            databaseName,
            migrations: migrationInputsForRun,
          })
          if (applied.status === "error") {
            recordDynamicOperationError(state, "apply-migrations", applied, {
              pendingMigrations: migrationInputsForRun.map(({ path, sha256 }) => ({
                path,
                sha256,
              })),
            })
            canContinue = false
          }
        }

        if (canContinue && !state.incomplete) {
          const catalogs = input.executor.collectCatalogs({ databaseName })
          if (catalogs.status === "error") {
            recordDynamicOperationError(state, "collect-catalogs", catalogs)
            canContinue = false
          } else {
            state.catalogInputHashes = {
              ...state.catalogInputHashes,
              catalogAccess: collectAccessFingerprint(catalogs.value.access),
              catalogApplication: collectApplicationFingerprint(catalogs.value.application),
              catalogEnvironment: collectEnvironmentFingerprint(catalogs.value.environment),
            }
            const catalogFindings = evaluateCatalogContracts({
              access: catalogs.value.access,
              application: catalogs.value.application,
              environment: catalogs.value.environment,
              invariants: artifacts.invariants,
            }).findings
            for (const finding of catalogFindings) {
              const historicalDebt = baselineHistoricalFindingKeys.has(catalogFindingKey(finding))
              state.findings.push({
                classification: historicalDebt ? "WARNING" : "BLOCKING",
                fingerprint: finding.fingerprint,
                ruleId: finding.ruleId,
              })
              if (!historicalDebt) {
                canContinue = false
                if (finding.classification === "INCOMPLETE") {
                  state.incomplete = true
                }
              }
            }
          }
        }

        if (canContinue && !state.incomplete) {
          canContinue = runDynamicSqlTestSweep({
            databaseName,
            execution: state.sqlTestExecution,
            input,
            sqlTests: artifacts.sqlTests,
            state,
          })
          reconcileSqlTestDebt({
            state,
            sqlTests: artifacts.sqlTests,
            migrations: migrationInputsForRun ?? [],
          })
        }

        if (
          canContinue &&
          !state.incomplete &&
          (state.sqlTestExecution.selected.length !== state.sqlTestExecution.attempted.length ||
            state.sqlTestExecution.selected.some(
              (path, index) => state.sqlTestExecution.attempted[index] !== path
            ))
        ) {
          addDynamicFinding(state, "dynamic.sql-test.execution", "default-safe-sql-tests", {
            attempted: JSON.stringify(state.sqlTestExecution.attempted),
            executed: JSON.stringify(state.sqlTestExecution.executed),
            selected: JSON.stringify(state.sqlTestExecution.selected),
          })
          state.incomplete = true
        }
      }
    }
  } finally {
    if (databaseCreated && databaseName !== undefined) {
      const cleanup = input.executor.dropDatabase(databaseName)
      if (cleanup.status === "error") {
        recordDynamicOperationError(state, "drop-database", cleanup)
      }
    }
    const release = input.executor.releaseLock(input.runId)
    if (release.status === "error") {
      recordDynamicOperationError(state, "release-lock", release)
    }
    report = persistTerminalReport(input, state, artifacts)
  }

  return report
}
