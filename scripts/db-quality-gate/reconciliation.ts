import {
  baselineStateHash,
  isBaselineForwardEvidenceReusable,
  parseBaselineState,
} from "./baseline-state"
import { aggregateOutcome } from "./contract"
import { currentHeadCommit, readFileAtCommit, resolveGitCommit } from "./git-evidence"
import { ORACLE_REPORT_ARTIFACT } from "./oracle-evidence-store"
import { loadReadBackRecord } from "./read-back"
import { parseGateReport, validReusableReport } from "./pre-live-report"
import {
  incompleteReconciliationReport,
  reconciliationFinding,
  reconciliationReport,
} from "./reconciliation-report"
import { parseAppliedMigrationLock } from "./registries"
import { stableJsonSha256 } from "./serialization"
import type { BaselineState } from "./baseline-state"
import type { OracleEvidenceStore } from "./oracle-evidence-store"
import type { ProtectedMainVerifier } from "./protected-main"
import type { AppliedMigrationLock } from "./registries"
import type { GateFinding, GateReport } from "./types"

const APPLIED_LOCK_PATH = "supabase/applied-migrations.lock.json"
const RECONCILIATION_INPUT_KEYS = new Set([
  "baselineForwardDigest",
  "baselineForwardRunId",
  "repositoryRoot",
  "runId",
  "subjectCommit",
])

export type ReconciliationInput = {
  baselineForwardDigest: string
  baselineForwardRunId: string
  repositoryRoot: string
  runId: string
  subjectCommit: string
}

export type ReconciliationDependencies = {
  clock: () => string
  evidenceStore: OracleEvidenceStore
  refreshOriginMain: (repositoryRoot: string) => string | undefined
  verifyProtectedMain: ProtectedMainVerifier
}

function validInput(input: ReconciliationInput): boolean {
  const entries = Object.entries(input)
  return (
    entries.length === RECONCILIATION_INPUT_KEYS.size &&
    entries.every(([key, value]) => RECONCILIATION_INPUT_KEYS.has(key) && typeof value === "string")
  )
}

function parseJson(content: string): unknown | undefined {
  try {
    return JSON.parse(content) as unknown
  } catch {
    return undefined
  }
}

function readAppliedLock(
  repositoryRoot: string,
  subjectCommit: string
): AppliedMigrationLock | undefined {
  const content = readFileAtCommit(repositoryRoot, subjectCommit, APPLIED_LOCK_PATH)
  return content === undefined ? undefined : parseAppliedMigrationLock(parseJson(content))
}

function readBaselineState(evidenceStore: OracleEvidenceStore): BaselineState | undefined {
  const artifact = evidenceStore.readBaselineState()
  return artifact.status === "ok" ? parseBaselineState(parseJson(artifact.value)) : undefined
}

function readBaselineReport(
  evidenceStore: OracleEvidenceStore,
  runId: string
): GateReport | undefined {
  const artifact = evidenceStore.readArtifact({
    artifactName: ORACLE_REPORT_ARTIFACT,
    runId,
  })
  return artifact.status === "ok" ? parseGateReport(parseJson(artifact.value)) : undefined
}

function readBackRunId(evidenceId: string): string | undefined {
  return /^oracle:([a-z0-9][a-z0-9._-]*)\/read-back\.json$/u.exec(evidenceId)?.[1]
}

function baselineComplete(state: BaselineState, highWater: string): boolean {
  return state.healthy && state.recovery === undefined && state.migrationHighWater === highWater
}

function matchingConfirmation(
  state: BaselineState,
  entry: AppliedMigrationLock["applied"][number]
): boolean {
  return state.confirmedMigrations.some(
    (confirmation) =>
      confirmation.liveName === entry.liveName &&
      confirmation.liveVersion === entry.liveVersion &&
      confirmation.path === entry.path &&
      confirmation.sha256 === entry.sha256
  )
}

function legacyProtectsHighWater(
  lock: AppliedMigrationLock,
  state: BaselineState,
  highWater: string
): boolean {
  const confirmation = state.confirmedMigrations.find((entry) => entry.liveVersion === highWater)
  return (
    confirmation !== undefined &&
    lock.legacy.some(
      (entry) => entry.path === confirmation.path && entry.sha256 === confirmation.sha256
    )
  )
}

/** Evaluates both independent reconciliation branches without performing any write. */
export function evaluateReconciliation(
  input: ReconciliationInput,
  dependencies: ReconciliationDependencies
): GateReport {
  const createdAt = dependencies.clock()
  if (!validInput(input) || Number.isNaN(Date.parse(createdAt))) {
    return incompleteReconciliationReport(
      input,
      createdAt,
      "unavailable",
      "reconciliation/evidence-invalid",
      "Reconciliation input or trusted clock is invalid"
    )
  }

  const subjectCommit = resolveGitCommit(input.repositoryRoot, input.subjectCommit)
  const headCommit = currentHeadCommit(input.repositoryRoot)
  if (
    subjectCommit === undefined ||
    subjectCommit !== input.subjectCommit ||
    headCommit !== subjectCommit ||
    dependencies.refreshOriginMain(input.repositoryRoot) !== subjectCommit
  ) {
    return incompleteReconciliationReport(
      input,
      createdAt,
      subjectCommit ?? "unavailable",
      "reconciliation/evidence-not-landed",
      "Reconciliation requires exact refreshed origin/main at repository HEAD"
    )
  }

  const protectedMain = dependencies.verifyProtectedMain()
  if (protectedMain.status !== "active" || protectedMain.subjectCommit !== subjectCommit) {
    return incompleteReconciliationReport(
      input,
      createdAt,
      subjectCommit,
      "reconciliation/protected-main-unavailable",
      protectedMain.status === "active"
        ? "Protected main is not bound to the subject commit"
        : protectedMain.reason
    )
  }

  const baselineReport = readBaselineReport(dependencies.evidenceStore, input.baselineForwardRunId)
  const state = readBaselineState(dependencies.evidenceStore)
  const appliedLock = readAppliedLock(input.repositoryRoot, subjectCommit)
  if (
    baselineReport === undefined ||
    state === undefined ||
    appliedLock === undefined ||
    !validReusableReport(baselineReport, {
      digest: input.baselineForwardDigest,
      lane: "baseline-forward",
      runId: input.baselineForwardRunId,
      subjectCommit,
    })
  ) {
    return incompleteReconciliationReport(
      input,
      createdAt,
      subjectCommit,
      "reconciliation/evidence-invalid",
      "Reconciliation evidence is missing, malformed, or not bound to landed main"
    )
  }

  const findings: GateFinding[] = []
  let evidenceAvailable = true
  const appliedEntry = appliedLock.applied.at(-1)
  const highWater = appliedEntry?.liveVersion ?? baselineReport.baselineMigrationHighWater
  if (appliedEntry === undefined && !legacyProtectsHighWater(appliedLock, state, highWater)) {
    findings.push(
      reconciliationFinding(
        "reconciliation/lock-incomplete",
        subjectCommit,
        "Applied lock does not contain the confirmed-live high-water"
      )
    )
  }

  for (const entry of appliedLock.applied) {
    const runId = readBackRunId(entry.readBackEvidenceId)
    const readBack =
      runId === undefined
        ? undefined
        : loadReadBackRecord({ evidenceStore: dependencies.evidenceStore, runId })
    if (readBack === undefined || readBack.status === "error") {
      evidenceAvailable = false
      findings.push(
        reconciliationFinding(
          "reconciliation/lock-evidence-unavailable",
          subjectCommit,
          `Applied lock read-back evidence is unavailable for ${entry.liveVersion}`
        )
      )
      continue
    }
    const record = readBack.value
    if (
      record.digest !== entry.readBackDigest ||
      record.liveName !== entry.liveName ||
      record.liveVersion !== entry.liveVersion ||
      record.migrationPath !== entry.path ||
      record.sha256 !== entry.sha256
    ) {
      findings.push(
        reconciliationFinding(
          "reconciliation/lock-incomplete",
          subjectCommit,
          `Applied lock authority does not match immutable read-back evidence for ${entry.liveVersion}`
        )
      )
    }
  }

  if (!baselineComplete(state, highWater)) {
    findings.push(
      reconciliationFinding(
        "reconciliation/baseline-incomplete",
        subjectCommit,
        "Oracle baseline is unhealthy or has not reached confirmed-live high-water"
      )
    )
  } else if (
    appliedEntry !== undefined &&
    !appliedLock.applied.every((entry) => matchingConfirmation(state, entry))
  ) {
    findings.push(
      reconciliationFinding(
        "reconciliation/baseline-incomplete",
        subjectCommit,
        "Oracle baseline confirmations do not match complete applied lock authority"
      )
    )
  }

  if (
    baselineReport.baselineMigrationHighWater !== highWater ||
    !isBaselineForwardEvidenceReusable(
      {
        baselineMigrationHighWater: baselineReport.baselineMigrationHighWater,
        inputHashes: baselineReport.inputHashes,
        outcome: "PASS",
      },
      state
    )
  ) {
    findings.push(
      reconciliationFinding(
        "reconciliation/baseline-forward-rerun-required",
        subjectCommit,
        "Baseline-forward must rerun against the current healthy high-water"
      )
    )
  }

  const outcome = aggregateOutcome({
    evidenceAvailable,
    findings,
    requiredChecksComplete: true,
  })
  return reconciliationReport({
    baselineMigrationHighWater: highWater,
    createdAt,
    evidenceAvailable,
    findings,
    inputHashes: {
      appliedLock: stableJsonSha256(appliedLock),
      baselineForward: baselineReport.digest,
      baselineState: baselineStateHash(state),
    },
    migrationIdentities: baselineReport.migrationIdentities,
    outcome,
    runId: input.runId,
    subjectCommit,
  })
}

export { runBaselineReconciliation } from "./reconciliation-baseline"
