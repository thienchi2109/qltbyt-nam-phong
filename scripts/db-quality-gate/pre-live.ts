import { finalizeReport, serializeReport } from "./contract"
import {
  currentHeadCommit,
  firstParentCommit,
  refreshPublicOriginMain,
  resolveGitCommit,
} from "./git-evidence"
import { ORACLE_REPORT_ARTIFACT, type OracleEvidenceStore } from "./oracle-evidence-store"
import {
  loadReusableBaselineEvidence,
  type BaselineForwardInputHashReader,
} from "./pre-live-baseline-evidence"
import {
  evaluateLiveMigrationState,
  parseLiveMigrationObservation,
  readAppliedMigrationLockAtCommit,
  readLiveMigrationObservationFile,
} from "./pre-live-live-state"
import {
  incompleteReport,
  preLiveFinding,
  preLiveReport,
  validReusableReport,
} from "./pre-live-report"
import { runPreLiveReconciliationCheck } from "./pre-live-reconciliation"
import { runStaticLaneForLandedCommit, type LandedStaticLaneInput } from "./static-lane"
import type { GateReport } from "./types"
import type { PreLiveReconciliationDependencies } from "./pre-live-reconciliation"
import type { AppliedMigrationLock } from "./registries"

const EVIDENCE_NOT_LANDED_RULE = "prelive/evidence-not-landed"
const EVIDENCE_INVALID_RULE = "prelive/evidence-invalid"
const BASELINE_BEHIND_LIVE_RULE = "prelive/baseline-behind-live"
const EXPLICIT_PERMISSION_RULE = "prelive.permission.explicit-required"
const PRE_LIVE_INPUT_KEYS = new Set([
  "baselineForwardDigest",
  "baselineForwardRunId",
  "liveObservationPath",
  "repositoryRoot",
  "runId",
  "staticRunId",
  "subjectCommit",
])
export type PreLiveEvidenceInput = {
  baselineForwardDigest: string
  baselineForwardRunId: string
  liveObservationPath: string
  repositoryRoot: string
  runId: string
  staticRunId: string
  subjectCommit: string
}

type LandedStaticRunner = (input: LandedStaticLaneInput) => GateReport
type AppliedMigrationLockReader = (
  repositoryRoot: string,
  subjectCommit: string
) => AppliedMigrationLock | undefined
export type PreLiveEvidenceDependencies = PreLiveReconciliationDependencies & {
  clock: () => string
  evidenceStore: OracleEvidenceStore
  readAppliedMigrationLock?: AppliedMigrationLockReader
  readLiveObservation?: (filePath: string) => unknown | undefined
  recomputeBaselineForwardInputHashes?: BaselineForwardInputHashReader
  refreshOriginMain?: (repositoryRoot: string) => string | undefined
  runStatic?: LandedStaticRunner
}

function validPreLiveInput(input: PreLiveEvidenceInput): boolean {
  const entries = Object.entries(input)
  return (
    entries.length === PRE_LIVE_INPUT_KEYS.size &&
    entries.every(([key, value]) => PRE_LIVE_INPUT_KEYS.has(key) && typeof value === "string")
  )
}

/** Verifies exact landed static and baseline-forward evidence without performing a live write. */
export function runPreLiveEvidenceCheck(
  input: PreLiveEvidenceInput,
  dependencies: PreLiveEvidenceDependencies
): GateReport {
  const createdAt = dependencies.clock()
  if (!validPreLiveInput(input)) {
    return incompleteReport(
      input,
      createdAt,
      "unavailable",
      EVIDENCE_INVALID_RULE,
      "Pre-live input contains unknown or malformed properties"
    )
  }

  const resolvedSubject = resolveGitCommit(input.repositoryRoot, input.subjectCommit)
  const headCommit = currentHeadCommit(input.repositoryRoot)
  const refreshedOriginMain = (dependencies.refreshOriginMain ?? refreshPublicOriginMain)(
    input.repositoryRoot
  )
  const landed =
    resolvedSubject !== undefined &&
    resolvedSubject === input.subjectCommit &&
    headCommit === resolvedSubject &&
    refreshedOriginMain === resolvedSubject
  if (!landed) {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject ?? headCommit ?? "unavailable",
      EVIDENCE_NOT_LANDED_RULE,
      "subjectCommit, HEAD, and refreshed origin/main must identify the same landed commit"
    )
  }

  const landedParentCommit = firstParentCommit(input.repositoryRoot, resolvedSubject)
  if (landedParentCommit === undefined) {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      EVIDENCE_NOT_LANDED_RULE,
      "The landed commit first parent is unavailable"
    )
  }

  const staticReport = finalizeReport(
    (dependencies.runStatic ?? runStaticLaneForLandedCommit)({
      createdAt,
      landedParentCommit,
      repositoryRoot: input.repositoryRoot,
      runId: input.staticRunId,
      subjectCommit: resolvedSubject,
    })
  )
  if (
    !validReusableReport(staticReport, {
      digest: staticReport.digest,
      lane: "static",
      runId: input.staticRunId,
      subjectCommit: resolvedSubject,
    })
  ) {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      EVIDENCE_INVALID_RULE,
      "Fresh landed static evidence is incomplete or non-PASS"
    )
  }

  const persistedStatic = dependencies.evidenceStore.persistArtifact({
    artifactName: ORACLE_REPORT_ARTIFACT,
    content: serializeReport(staticReport),
    runId: input.staticRunId,
  })
  if (persistedStatic.status === "error") {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      EVIDENCE_INVALID_RULE,
      "Fresh landed static evidence could not be persisted to Oracle"
    )
  }

  const baselineEvidence = loadReusableBaselineEvidence({
    evidenceStore: dependencies.evidenceStore,
    preLiveInput: input,
    recomputeInputHashes: dependencies.recomputeBaselineForwardInputHashes,
    subjectCommit: resolvedSubject,
  })
  if (baselineEvidence.status === "error") {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      baselineEvidence.ruleId,
      baselineEvidence.reason
    )
  }
  const { baselineReport, baselineState } = baselineEvidence

  const reconciliation = runPreLiveReconciliationCheck(
    input,
    resolvedSubject,
    createdAt,
    dependencies
  )
  if (reconciliation.outcome !== "PASS") {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      "reconciliation/incomplete",
      "Applied-lock, Oracle baseline, and baseline-forward reconciliation must all complete"
    )
  }

  const rawLiveObservation = (dependencies.readLiveObservation ?? readLiveMigrationObservationFile)(
    input.liveObservationPath
  )
  const liveObservation = parseLiveMigrationObservation(rawLiveObservation, createdAt)
  const appliedLock = (dependencies.readAppliedMigrationLock ?? readAppliedMigrationLockAtCommit)(
    input.repositoryRoot,
    resolvedSubject
  )
  const liveState = evaluateLiveMigrationState({
    appliedLock,
    baselineState,
    observation: liveObservation,
  })
  if (liveState.status === "invalid") {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      EVIDENCE_INVALID_RULE,
      liveState.reason
    )
  }

  const inputHashes = {
    baselineForwardReport: baselineReport.digest,
    liveObservation: liveState.inputHash,
    staticReport: staticReport.digest,
  }
  if (liveState.status === "baseline-behind") {
    const finding = preLiveFinding("BLOCKING", BASELINE_BEHIND_LIVE_RULE, resolvedSubject, {
      baselineMigrationHighWater: baselineState.migrationHighWater,
      liveMigrationHighWater: liveState.liveMigrationHighWater,
    })
    return preLiveReport({
      baselineMigrationHighWater: baselineReport.baselineMigrationHighWater,
      createdAt,
      evidenceAvailable: true,
      findings: [finding],
      inputHashes,
      migrationIdentities: staticReport.migrationIdentities,
      outcome: "FAILED",
      runId: input.runId,
      subjectCommit: resolvedSubject,
    })
  }

  const permissionFinding = preLiveFinding("WARNING", EXPLICIT_PERMISSION_RULE, resolvedSubject, {
    nextAction: "request-explicit-permission",
  })
  return preLiveReport({
    baselineMigrationHighWater: baselineReport.baselineMigrationHighWater,
    createdAt,
    evidenceAvailable: true,
    findings: [permissionFinding],
    inputHashes,
    migrationIdentities: staticReport.migrationIdentities,
    outcome: "PASS",
    runId: input.runId,
    subjectCommit: resolvedSubject,
  })
}
