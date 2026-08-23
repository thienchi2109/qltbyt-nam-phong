import { createFindingFingerprint, finalizeReport } from "./contract"
import { GATE_SCHEMA_VERSION } from "./types"
import type { ReconciliationInput } from "./reconciliation"
import type { GateFinding, GateOutcome, GateReport } from "./types"

/** Creates one deterministic reconciliation finding. */
export function reconciliationFinding(
  ruleId: string,
  subject: string,
  reason: string
): GateFinding {
  const evidence = { reason }
  return {
    classification: "BLOCKING",
    evidence,
    fingerprint: createFindingFingerprint({ evidence, ruleId, subject }),
    ruleId,
  }
}

/** Finalizes the read-only reconciliation lane report. */
export function reconciliationReport(input: {
  baselineMigrationHighWater?: string
  createdAt: string
  evidenceAvailable: boolean
  findings: GateFinding[]
  inputHashes?: Record<string, string>
  migrationIdentities?: GateReport["migrationIdentities"]
  outcome: GateOutcome
  runId: string
  subjectCommit: string
}): GateReport {
  return finalizeReport({
    baselineMigrationHighWater: input.baselineMigrationHighWater ?? "unavailable",
    createdAt: input.createdAt,
    digest: "",
    evidenceAvailable: input.evidenceAvailable,
    executorEnvironment: { execution: "reconciliation-read-only-oracle-evidence" },
    findings: input.findings,
    inputHashes: input.inputHashes ?? {},
    lane: "reconciliation",
    migrationIdentities: input.migrationIdentities ?? [],
    outcome: input.outcome,
    requiredChecksComplete: input.outcome !== "INCOMPLETE",
    runId: input.runId,
    schemaVersion: GATE_SCHEMA_VERSION,
    subjectCommit: input.subjectCommit,
  })
}

/** Creates a fail-closed reconciliation report before branch evaluation can begin. */
export function incompleteReconciliationReport(
  input: ReconciliationInput,
  createdAt: string,
  subjectCommit: string,
  ruleId: string,
  reason: string
): GateReport {
  return reconciliationReport({
    createdAt,
    evidenceAvailable: false,
    findings: [reconciliationFinding(ruleId, subjectCommit, reason)],
    outcome: "INCOMPLETE",
    runId: input.runId,
    subjectCommit,
  })
}
