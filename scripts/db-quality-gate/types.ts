/** Schema version for every machine-readable database quality gate artifact. */
export const GATE_SCHEMA_VERSION = 1 as const

/** Supported execution lanes. Phase 1 exposes their shared contract only. */
export const GATE_LANES = ["static", "baseline-forward", "pre-live", "reconciliation"] as const

export type GateLane = (typeof GATE_LANES)[number]
export type FindingClassification = "WARNING" | "DANGEROUS" | "BLOCKING"
export type GateOutcome = "PASS" | "FAILED" | "INCOMPLETE"

export type FindingApproval = {
  acceptedForAggregate: boolean
  id: string
}

export type GateFinding = {
  approval?: FindingApproval
  classification: FindingClassification
  evidence?: Record<string, number | string>
  fingerprint: string
  ruleId: string
}

export type MigrationIdentity = {
  path: string
  sha256: string
}

export type SqlTestExecutionEvidence = {
  attempted: string[]
  executed: string[]
  selected: string[]
}

export type GateReport = {
  baselineMigrationHighWater: string
  baselineControlSqlTestExecution?: SqlTestExecutionEvidence
  createdAt: string
  digest: string
  evidenceAvailable?: boolean
  executorEnvironment: Record<string, string>
  findings: GateFinding[]
  inputHashes: Record<string, string>
  lane: GateLane
  migrationIdentities: MigrationIdentity[]
  outcome: GateOutcome
  requiredChecksComplete?: boolean
  runId: string
  schemaVersion: typeof GATE_SCHEMA_VERSION
  sqlTestExecution?: SqlTestExecutionEvidence
  subjectCommit: string
}

export type EvidenceInvalidationKeys = {
  appliedLock: string
  baselineMigrationHighWater: string
  executorEnvironment: string
  harness: string
  migration: string
  registries: string
}

export type ValidationFinding = {
  classification: "BLOCKING" | "INCOMPLETE"
  ruleId: string
}

export type RegistryValidation = {
  findings: ValidationFinding[]
  valid: boolean
}
