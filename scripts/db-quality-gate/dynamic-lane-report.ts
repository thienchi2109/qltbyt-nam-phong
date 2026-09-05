import { aggregateOutcome, createFindingFingerprint, finalizeReport } from "./contract"
import { dynamicImmutableInputHashes } from "./dynamic-input-hashes"
import { stableJsonSha256 } from "./serialization"
import { GATE_SCHEMA_VERSION } from "./types"
import type { GateFinding, GateReport, MigrationIdentity } from "./types"
import type { OracleDynamicLaneInput, OracleExecutorResult } from "./dynamic-lane-types"

/** Mutable facts accumulated by one dynamic validation run before its deterministic report is built. */
export type DynamicRunState = {
  baselineMigrationHighWater: string
  baselineControlSqlTestExecution: {
    attempted: string[]
    executed: string[]
    selected: string[]
  }
  catalogInputHashes: Record<string, string>
  executorEnvironment: Record<string, string>
  findings: GateFinding[]
  incomplete: boolean
  preflightComplete: boolean
  sqlTestExecution: {
    attempted: string[]
    executed: string[]
    selected: string[]
  }
}

/** Creates the fail-closed state used before Oracle preflight supplies any trusted evidence. */
export function createDynamicRunState(): DynamicRunState {
  return {
    baselineMigrationHighWater: "unavailable",
    baselineControlSqlTestExecution: {
      attempted: [],
      executed: [],
      selected: [],
    },
    catalogInputHashes: {},
    executorEnvironment: {},
    findings: [],
    incomplete: false,
    preflightComplete: false,
    sqlTestExecution: {
      attempted: [],
      executed: [],
      selected: [],
    },
  }
}

/** Records a deterministic blocking finding for an explicit missing or invalid dynamic input. */
export function addDynamicFinding(
  state: DynamicRunState,
  ruleId: string,
  subject: string,
  evidence: Record<string, string>
): void {
  state.findings.push({
    classification: "BLOCKING",
    evidence,
    fingerprint: createFindingFingerprint({ evidence, ruleId, subject }),
    ruleId,
  })
}

/** Converts a structured executor failure into a report finding and preserves fail-closed semantics. */
export function recordDynamicOperationError(
  state: DynamicRunState,
  operation: string,
  result: Extract<OracleExecutorResult<never>, { status: "error" }>,
  safeContext?: {
    pendingMigrations?: readonly MigrationIdentity[]
    sqlTestPath?: string
  }
): void {
  const diagnosticEvidence: Record<string, string> =
    result.diagnostic === undefined
      ? {}
      : {
          diagnosticCategory: result.diagnostic.category,
          ...(result.diagnostic.sqlState === undefined
            ? {}
            : { sqlState: result.diagnostic.sqlState }),
          stderrSha256: result.diagnostic.stderrSha256,
        }
  const pendingMigrations =
    operation === "apply-migrations" && safeContext?.pendingMigrations !== undefined
      ? safeContext.pendingMigrations.map(({ path, sha256 }) => ({ path, sha256 }))
      : undefined
  const pendingMigrationEvidence: Record<string, number | string> =
    pendingMigrations === undefined
      ? {}
      : {
          pendingMigrationCount: pendingMigrations.length,
          pendingMigrationPaths: JSON.stringify(
            pendingMigrations.map((migration) => migration.path)
          ),
          pendingMigrationsSha256: stableJsonSha256(pendingMigrations),
        }
  const sqlTestPath =
    operation.endsWith("run-sql-test") && result.kind === "failed"
      ? safeContext?.sqlTestPath
      : undefined
  const sqlTestEvidence: Record<string, string> = sqlTestPath === undefined ? {} : { sqlTestPath }
  const evidence: Record<string, number | string> = {
    kind: result.kind,
    operation,
    ...diagnosticEvidence,
    ...pendingMigrationEvidence,
    ...sqlTestEvidence,
  }
  const ruleId = `dynamic.${operation}.${result.kind}`
  state.findings.push({
    classification: "BLOCKING",
    evidence,
    fingerprint: createFindingFingerprint({
      evidence,
      ruleId,
      subject: sqlTestPath === undefined ? operation : `${operation}:${sqlTestPath}`,
    }),
    ruleId,
  })
  if (result.kind !== "failed") {
    state.incomplete = true
  }
}

/** Builds the deterministic report and prevents unavailable dynamic evidence from aggregating to PASS. */
export function finalizeDynamicLaneReport(
  input: OracleDynamicLaneInput,
  state: DynamicRunState,
  migrationIdentities: MigrationIdentity[],
  evidenceAvailable: boolean,
  artifacts: {
    invariants: unknown
    harnessHash?: string
    sqlTests: unknown
    sqlTestSourcesHash?: string
  }
): GateReport {
  const requiredChecksComplete = !state.incomplete
  const outcome = aggregateOutcome({
    evidenceAvailable,
    findings: state.findings,
    requiredChecksComplete,
  })
  const immutableInputHashes = dynamicImmutableInputHashes({
    harnessHash: artifacts.harnessHash ?? "unavailable",
    invariants: artifacts.invariants ?? null,
    migrationIdentities,
    sqlTestRegistry: artifacts.sqlTests ?? null,
    sqlTestSourcesHash: artifacts.sqlTestSourcesHash ?? "unavailable",
  })

  return finalizeReport({
    baselineMigrationHighWater: state.baselineMigrationHighWater,
    baselineControlSqlTestExecution: state.baselineControlSqlTestExecution,
    createdAt: input.createdAt,
    digest: "",
    evidenceAvailable,
    executorEnvironment: state.executorEnvironment,
    findings: state.findings,
    inputHashes: {
      ...state.catalogInputHashes,
      ...immutableInputHashes,
    },
    lane: input.lane,
    migrationIdentities,
    outcome,
    requiredChecksComplete,
    runId: input.runId,
    schemaVersion: GATE_SCHEMA_VERSION,
    sqlTestExecution: state.sqlTestExecution,
    subjectCommit: input.subjectCommit,
  })
}
