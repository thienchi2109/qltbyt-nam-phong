import {
  aggregateOutcome,
  createFindingFingerprint,
  finalizeReport,
  reportDigest,
} from "./contract"
import { GATE_SCHEMA_VERSION } from "./types"
import type {
  FindingClassification,
  GateFinding,
  GateLane,
  GateOutcome,
  GateReport,
  MigrationIdentity,
} from "./types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string")
}

function isFindingClassification(value: unknown): value is FindingClassification {
  return value === "WARNING" || value === "DANGEROUS" || value === "BLOCKING"
}

function isGateLane(value: unknown): value is GateLane {
  return (
    value === "static" ||
    value === "baseline-forward" ||
    value === "pre-live" ||
    value === "reconciliation"
  )
}

function isGateOutcome(value: unknown): value is GateOutcome {
  return value === "PASS" || value === "FAILED" || value === "INCOMPLETE"
}

function isMigrationIdentity(value: unknown): value is MigrationIdentity {
  return isRecord(value) && typeof value.path === "string" && typeof value.sha256 === "string"
}

function isGateFinding(value: unknown): value is GateFinding {
  if (
    !isRecord(value) ||
    !isFindingClassification(value.classification) ||
    typeof value.fingerprint !== "string" ||
    typeof value.ruleId !== "string"
  ) {
    return false
  }
  if (
    value.evidence !== undefined &&
    (!isRecord(value.evidence) ||
      !Object.values(value.evidence).every(
        (entry) => typeof entry === "number" || typeof entry === "string"
      ))
  ) {
    return false
  }
  return (
    value.approval === undefined ||
    (isRecord(value.approval) &&
      typeof value.approval.acceptedForAggregate === "boolean" &&
      typeof value.approval.id === "string")
  )
}

/** Parses persisted gate evidence without trusting its JSON shape. */
export function parseGateReport(value: unknown): GateReport | undefined {
  if (
    !isRecord(value) ||
    typeof value.baselineMigrationHighWater !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.digest !== "string" ||
    !isStringRecord(value.executorEnvironment) ||
    !Array.isArray(value.findings) ||
    !value.findings.every(isGateFinding) ||
    !isStringRecord(value.inputHashes) ||
    !isGateLane(value.lane) ||
    !Array.isArray(value.migrationIdentities) ||
    !value.migrationIdentities.every(isMigrationIdentity) ||
    !isGateOutcome(value.outcome) ||
    typeof value.runId !== "string" ||
    value.schemaVersion !== GATE_SCHEMA_VERSION ||
    typeof value.subjectCommit !== "string"
  ) {
    return undefined
  }
  if (
    (value.evidenceAvailable !== undefined && typeof value.evidenceAvailable !== "boolean") ||
    (value.requiredChecksComplete !== undefined &&
      typeof value.requiredChecksComplete !== "boolean")
  ) {
    return undefined
  }

  return value as GateReport
}

/** Creates a deterministic pre-live finding bound to the landed subject commit. */
export function preLiveFinding(
  classification: FindingClassification,
  ruleId: string,
  subject: string,
  evidence: Record<string, number | string>
): GateFinding {
  return {
    classification,
    evidence,
    fingerprint: createFindingFingerprint({ evidence, ruleId, subject }),
    ruleId,
  }
}

/** Finalizes one deterministic report for the read-only pre-live lane. */
export function preLiveReport(input: {
  baselineMigrationHighWater?: string
  createdAt: string
  evidenceAvailable: boolean
  findings: GateFinding[]
  inputHashes?: Record<string, string>
  migrationIdentities?: MigrationIdentity[]
  outcome: GateOutcome
  runId: string
  subjectCommit: string
}): GateReport {
  const complete = input.outcome !== "INCOMPLETE"
  return finalizeReport({
    baselineMigrationHighWater: input.baselineMigrationHighWater ?? "unavailable",
    createdAt: input.createdAt,
    digest: "",
    evidenceAvailable: input.evidenceAvailable,
    executorEnvironment: { execution: "pre-live-local-oracle-evidence" },
    findings: input.findings,
    inputHashes: input.inputHashes ?? {},
    lane: "pre-live",
    migrationIdentities: input.migrationIdentities ?? [],
    outcome: input.outcome,
    requiredChecksComplete: complete,
    runId: input.runId,
    schemaVersion: GATE_SCHEMA_VERSION,
    subjectCommit: input.subjectCommit,
  })
}

/** Creates a fail-closed pre-live report for unavailable or invalid evidence. */
export function incompleteReport(
  input: { runId: string },
  createdAt: string,
  subjectCommit: string,
  ruleId: string,
  reason: string
): GateReport {
  return preLiveReport({
    createdAt,
    evidenceAvailable: false,
    findings: [preLiveFinding("BLOCKING", ruleId, subjectCommit, { reason })],
    outcome: "INCOMPLETE",
    runId: input.runId,
    subjectCommit,
  })
}

/** Verifies that persisted evidence is a complete PASS with an intact deterministic digest. */
export function validReusableReport(
  report: GateReport,
  expected: {
    digest: string
    lane: GateLane
    runId: string
    subjectCommit: string
  }
): boolean {
  const recomputedOutcome = aggregateOutcome({
    evidenceAvailable: report.evidenceAvailable === true,
    findings: report.findings,
    requiredChecksComplete: report.requiredChecksComplete === true,
  })

  return (
    report.runId === expected.runId &&
    report.lane === expected.lane &&
    report.outcome === "PASS" &&
    report.outcome === recomputedOutcome &&
    report.requiredChecksComplete === true &&
    report.evidenceAvailable === true &&
    report.subjectCommit === expected.subjectCommit &&
    report.digest === expected.digest &&
    report.digest === reportDigest(report)
  )
}
