import { serializeReport } from "./contract"
import {
  addDynamicFinding,
  createDynamicRunState,
  finalizeDynamicLaneReport,
  recordDynamicOperationError,
} from "./dynamic-lane-report"
import { ORACLE_BASELINE_DATABASE } from "./dynamic-lane-types"
import {
  collectAccessFingerprint,
  collectApplicationFingerprint,
  collectEnvironmentFingerprint,
  evaluateCatalogContracts,
} from "./expected-state"
import {
  readCommittedMigrationInputs,
  readCommittedSqlTest,
  readDynamicInputArtifacts,
} from "./dynamic-lane-inputs"
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

function baselineMigrationHighWater(versions: string[]): string {
  return [...versions].sort().at(-1) ?? "unavailable"
}

function migrationVersion(identity: MigrationIdentity): string | undefined {
  return /^(\d{14})_/.exec(identity.path.split("/").at(-1) ?? "")?.[1]
}

function pendingMigrations(
  state: ReturnType<typeof createDynamicRunState>,
  migrationIdentities: MigrationIdentity[],
  appliedMigrationIdentities: MigrationIdentity[],
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

  const appliedVersions = new Set<string>()
  for (const identity of appliedMigrationIdentities) {
    const version = migrationVersion(identity)
    if (version === undefined) {
      addDynamicFinding(state, "dynamic.baseline.applied-migration-version", identity.path, {
        path: identity.path,
      })
      state.incomplete = true
      return undefined
    }
    appliedVersions.add(version)
  }

  if ([...appliedVersions].some((version) => !observedVersions.includes(version))) {
    addDynamicFinding(state, "dynamic.baseline.migration-evidence", ORACLE_BASELINE_DATABASE, {
      baseline: ORACLE_BASELINE_DATABASE,
    })
    state.incomplete = true
    return undefined
  }

  const observed = new Set(observedVersions)
  return migrationIdentities.filter((identity) => {
    const version = migrationVersion(identity)
    return version !== undefined && !observed.has(version)
  })
}

/** Produces a deterministic, PostgreSQL-safe database name for one isolated run. */
export function createDisposableDatabaseName(input: {
  lane: "baseline-forward"
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
    invariants: artifacts?.invariants,
    sqlTests: artifacts?.sqlTestRegistry,
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
      sqlTests: undefined,
    })
  }

  let artifacts: DynamicInputArtifacts | undefined
  let databaseName: string | undefined
  let databaseCreated = false
  let report: GateReport
  try {
    artifacts = readDynamicInputArtifacts(input, state)
    if (artifacts !== undefined) {
      const preflight = input.executor.preflight()
      if (preflight.status === "error") {
        recordDynamicOperationError(state, "preflight", preflight)
      } else {
        state.preflightComplete = true
        state.executorEnvironment = preflight.value.executorEnvironment
        state.baselineMigrationHighWater = baselineMigrationHighWater(
          preflight.value.baseline.migrationVersions
        )
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

        const recover = canContinue
          ? input.executor.recoverOrphans("dq_baseline_forward_")
          : undefined
        if (recover?.status === "error") {
          recordDynamicOperationError(state, "recover-orphans", recover)
          canContinue = false
        }

        const migrations = canContinue
          ? pendingMigrations(
              state,
              artifacts.migrationIdentities,
              artifacts.appliedMigrationIdentities,
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

        if (canContinue && migrationInputsForRun !== undefined) {
          const applied = input.executor.applyMigrations({
            databaseName,
            migrations: migrationInputsForRun,
          })
          if (applied.status === "error") {
            recordDynamicOperationError(state, "apply-migrations", applied)
            canContinue = false
          }
        }

        if (canContinue && !state.incomplete && state.findings.length === 0) {
          const catalogs = input.executor.collectCatalogs({ databaseName })
          if (catalogs.status === "error") {
            recordDynamicOperationError(state, "collect-catalogs", catalogs)
            canContinue = false
          } else {
            state.catalogInputHashes = {
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
              state.findings.push({
                classification: "BLOCKING",
                fingerprint: finding.fingerprint,
                ruleId: finding.ruleId,
              })
              if (finding.classification === "INCOMPLETE") {
                state.incomplete = true
              }
            }
          }
        }

        if (canContinue && !state.incomplete && state.findings.length === 0) {
          for (const sqlTest of artifacts.sqlTests) {
            const content = readCommittedSqlTest(input, sqlTest.path)
            if (content === undefined) {
              addDynamicFinding(state, "dynamic.sql-test.source", sqlTest.path, {
                path: sqlTest.path,
              })
              state.incomplete = true
              canContinue = false
              break
            }
            const checked = input.executor.runSqlTest({
              content,
              databaseName,
              fixtureContract: sqlTest.fixtureContract,
              path: sqlTest.path,
              runnerRequirements: sqlTest.runnerRequirements,
              timeoutSeconds: sqlTest.timeoutSeconds,
              transactionContract: sqlTest.transactionContract,
            })
            if (checked.status === "error") {
              recordDynamicOperationError(state, "run-sql-test", checked)
              canContinue = false
              break
            }
          }
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
    report = persistTerminalReport(input, state, artifacts)
    const release = input.executor.releaseLock(input.runId)
    if (release.status === "error") {
      recordDynamicOperationError(state, "release-lock", release)
      report = finalizeDynamicLaneReport(
        input,
        state,
        artifacts?.migrationIdentities ?? [],
        false,
        {
          invariants: artifacts?.invariants,
          sqlTests: artifacts?.sqlTestRegistry,
        }
      )
    }
  }

  return report
}
