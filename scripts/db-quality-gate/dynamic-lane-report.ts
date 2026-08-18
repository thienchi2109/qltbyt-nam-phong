import { aggregateOutcome, createFindingFingerprint, finalizeReport } from "./contract"
import { stableJsonSha256 } from "./serialization"
import { GATE_SCHEMA_VERSION } from "./types"
import type { GateFinding, GateReport, MigrationIdentity } from "./types"
import type { OracleDynamicLaneInput, OracleExecutorResult } from "./dynamic-lane-types"

/** Mutable facts accumulated by one dynamic validation run before its deterministic report is built. */
export type DynamicRunState = {
  baselineMigrationHighWater: string
  catalogInputHashes: Record<string, string>
  executorEnvironment: Record<string, string>
  findings: GateFinding[]
  incomplete: boolean
  preflightComplete: boolean
}

/** Creates the fail-closed state used before Oracle preflight supplies any trusted evidence. */
export function createDynamicRunState(): DynamicRunState {
  return {
    baselineMigrationHighWater: "unavailable",
    catalogInputHashes: {},
    executorEnvironment: {},
    findings: [],
    incomplete: false,
    preflightComplete: false,
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
  result: Extract<OracleExecutorResult<never>, { status: "error" }>
): void {
  const evidence = {
    kind: result.kind,
    operation,
  }
  const ruleId = `dynamic.${operation}.${result.kind}`
  state.findings.push({
    classification: "BLOCKING",
    evidence,
    fingerprint: createFindingFingerprint({
      evidence,
      ruleId,
      subject: operation,
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
    sqlTests: unknown
  }
): GateReport {
  const requiredChecksComplete = !state.incomplete
  const outcome = aggregateOutcome({
    evidenceAvailable,
    findings: state.findings,
    requiredChecksComplete,
  })

  return finalizeReport({
    baselineMigrationHighWater: state.baselineMigrationHighWater,
    createdAt: input.createdAt,
    digest: "",
    evidenceAvailable,
    executorEnvironment: state.executorEnvironment,
    findings: state.findings,
    inputHashes: {
      ...state.catalogInputHashes,
      harness: stableJsonSha256({ lane: input.lane, version: "phase-4" }),
      invariants: stableJsonSha256(artifacts.invariants ?? null),
      migration: stableJsonSha256(migrationIdentities),
      sqlTests: stableJsonSha256(artifacts.sqlTests ?? null),
    },
    lane: input.lane,
    migrationIdentities,
    outcome,
    requiredChecksComplete,
    runId: input.runId,
    schemaVersion: GATE_SCHEMA_VERSION,
    subjectCommit: input.subjectCommit,
  })
}
