import { isBaselineForwardEvidenceReusable, parseBaselineState } from "./baseline-state"
import { finalizeReport, serializeReport } from "./contract"
import {
  currentHeadCommit,
  firstParentCommit,
  readFileAtCommit,
  refreshPublicOriginMain,
  resolveGitCommit,
} from "./git-evidence"
import { ORACLE_REPORT_ARTIFACT, type OracleEvidenceStore } from "./oracle-evidence-store"
import {
  evaluateLiveMigrationState,
  parseLiveMigrationObservation,
  readLiveMigrationObservationFile,
} from "./pre-live-live-state"
import { recomputeBaselineForwardInputHashes as recomputeBaselineForwardInputHashesFromCommit } from "./pre-live-inputs"
import {
  incompleteReport,
  parseGateReport,
  preLiveFinding,
  preLiveReport,
  validReusableReport,
} from "./pre-live-report"
import { parseAppliedMigrationLock } from "./registries"
import { runStaticLaneForLandedCommit, type LandedStaticLaneInput } from "./static-lane"
import type { GateReport } from "./types"
import type { AppliedMigrationLock } from "./registries"

const EVIDENCE_NOT_LANDED_RULE = "prelive/evidence-not-landed"
const EVIDENCE_INVALID_RULE = "prelive/evidence-invalid"
const BASELINE_BEHIND_LIVE_RULE = "prelive/baseline-behind-live"
const EXPLICIT_PERMISSION_RULE = "prelive.permission.explicit-required"
const APPLIED_LOCK_PATH = "supabase/applied-migrations.lock.json"
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
type BaselineForwardInputHashReader = typeof recomputeBaselineForwardInputHashesFromCommit
type AppliedMigrationLockReader = (
  repositoryRoot: string,
  subjectCommit: string
) => AppliedMigrationLock | undefined

export type PreLiveEvidenceDependencies = {
  clock: () => string
  evidenceStore: OracleEvidenceStore
  readAppliedMigrationLock?: AppliedMigrationLockReader
  readLiveObservation?: (filePath: string) => unknown | undefined
  recomputeBaselineForwardInputHashes?: BaselineForwardInputHashReader
  refreshOriginMain?: (repositoryRoot: string) => string | undefined
  runStatic?: LandedStaticRunner
}

function readAppliedMigrationLockAtCommit(
  repositoryRoot: string,
  subjectCommit: string
): AppliedMigrationLock | undefined {
  const content = readFileAtCommit(repositoryRoot, subjectCommit, APPLIED_LOCK_PATH)
  if (content === undefined) {
    return undefined
  }
  try {
    return parseAppliedMigrationLock(JSON.parse(content) as unknown)
  } catch {
    return undefined
  }
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

  const baselineStateArtifact = dependencies.evidenceStore.readBaselineState()
  if (baselineStateArtifact.status === "error") {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      EVIDENCE_INVALID_RULE,
      "Published Oracle baseline state is unavailable"
    )
  }
  let baselineState
  try {
    baselineState = parseBaselineState(JSON.parse(baselineStateArtifact.value) as unknown)
  } catch {
    baselineState = undefined
  }
  if (baselineState === undefined) {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      EVIDENCE_INVALID_RULE,
      "Published Oracle baseline state is malformed"
    )
  }

  const baselineArtifact = dependencies.evidenceStore.readArtifact({
    artifactName: ORACLE_REPORT_ARTIFACT,
    runId: input.baselineForwardRunId,
  })
  if (baselineArtifact.status === "error") {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      EVIDENCE_INVALID_RULE,
      "Baseline-forward Oracle evidence is unavailable"
    )
  }

  let baselineReport: GateReport | undefined
  try {
    baselineReport = parseGateReport(JSON.parse(baselineArtifact.value) as unknown)
  } catch {
    baselineReport = undefined
  }
  if (
    baselineReport === undefined ||
    !validReusableReport(baselineReport, {
      digest: input.baselineForwardDigest,
      lane: "baseline-forward",
      runId: input.baselineForwardRunId,
      subjectCommit: resolvedSubject,
    })
  ) {
    const ruleId =
      baselineReport?.subjectCommit !== undefined &&
      baselineReport.subjectCommit !== resolvedSubject
        ? EVIDENCE_NOT_LANDED_RULE
        : EVIDENCE_INVALID_RULE
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      ruleId,
      "Baseline-forward Oracle evidence does not exactly match the landed commit"
    )
  }

  const baselineStateMatches = isBaselineForwardEvidenceReusable(
    {
      baselineMigrationHighWater: baselineReport.baselineMigrationHighWater,
      inputHashes: baselineReport.inputHashes,
      outcome: "PASS",
    },
    baselineState
  )
  const expectedBaselineForwardHashes = (
    dependencies.recomputeBaselineForwardInputHashes ??
    recomputeBaselineForwardInputHashesFromCommit
  )({
    repositoryRoot: input.repositoryRoot,
    subjectCommit: resolvedSubject,
  })
  const baselineForwardInputsMatch =
    expectedBaselineForwardHashes !== undefined &&
    Object.entries(expectedBaselineForwardHashes).every(
      ([key, expectedHash]) => baselineReport.inputHashes[key] === expectedHash
    )
  if (!baselineStateMatches || !baselineForwardInputsMatch) {
    return incompleteReport(
      input,
      createdAt,
      resolvedSubject,
      EVIDENCE_INVALID_RULE,
      "Baseline-forward immutable inputs no longer match current Oracle and HEAD evidence"
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
