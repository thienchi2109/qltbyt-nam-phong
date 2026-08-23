import { isBaselineForwardEvidenceReusable, parseBaselineState } from "./baseline-state"
import { ORACLE_REPORT_ARTIFACT } from "./oracle-evidence-store"
import { recomputeBaselineForwardInputHashes } from "./pre-live-inputs"
import { parseGateReport, validReusableReport } from "./pre-live-report"
import type { BaselineState } from "./baseline-state"
import type { OracleEvidenceStore } from "./oracle-evidence-store"
import type { GateReport } from "./types"

export type BaselineForwardInputHashReader = typeof recomputeBaselineForwardInputHashes

type BaselineEvidenceInput = {
  baselineForwardDigest: string
  baselineForwardRunId: string
  repositoryRoot: string
}

type BaselineEvidenceResult =
  | {
      baselineReport: GateReport
      baselineState: BaselineState
      status: "ok"
    }
  | {
      reason: string
      ruleId: "prelive/evidence-invalid" | "prelive/evidence-not-landed"
      status: "error"
    }

function parseJson(content: string): unknown | undefined {
  try {
    return JSON.parse(content) as unknown
  } catch {
    return undefined
  }
}

/** Loads baseline state and exact landed baseline-forward evidence without mutating Oracle. */
export function loadReusableBaselineEvidence(input: {
  evidenceStore: OracleEvidenceStore
  preLiveInput: BaselineEvidenceInput
  recomputeInputHashes?: BaselineForwardInputHashReader
  subjectCommit: string
}): BaselineEvidenceResult {
  const baselineStateArtifact = input.evidenceStore.readBaselineState()
  if (baselineStateArtifact.status === "error") {
    return {
      reason: "Published Oracle baseline state is unavailable",
      ruleId: "prelive/evidence-invalid",
      status: "error",
    }
  }
  const baselineState = parseBaselineState(parseJson(baselineStateArtifact.value))
  if (baselineState === undefined) {
    return {
      reason: "Published Oracle baseline state is malformed",
      ruleId: "prelive/evidence-invalid",
      status: "error",
    }
  }

  const baselineArtifact = input.evidenceStore.readArtifact({
    artifactName: ORACLE_REPORT_ARTIFACT,
    runId: input.preLiveInput.baselineForwardRunId,
  })
  if (baselineArtifact.status === "error") {
    return {
      reason: "Baseline-forward Oracle evidence is unavailable",
      ruleId: "prelive/evidence-invalid",
      status: "error",
    }
  }
  const baselineReport = parseGateReport(parseJson(baselineArtifact.value))
  if (
    baselineReport === undefined ||
    !validReusableReport(baselineReport, {
      digest: input.preLiveInput.baselineForwardDigest,
      lane: "baseline-forward",
      runId: input.preLiveInput.baselineForwardRunId,
      subjectCommit: input.subjectCommit,
    })
  ) {
    return {
      reason: "Baseline-forward Oracle evidence does not exactly match the landed commit",
      ruleId:
        baselineReport?.subjectCommit !== undefined &&
        baselineReport.subjectCommit !== input.subjectCommit
          ? "prelive/evidence-not-landed"
          : "prelive/evidence-invalid",
      status: "error",
    }
  }

  const expectedInputHashes = (input.recomputeInputHashes ?? recomputeBaselineForwardInputHashes)({
    repositoryRoot: input.preLiveInput.repositoryRoot,
    subjectCommit: input.subjectCommit,
  })
  const immutableInputsMatch =
    expectedInputHashes !== undefined &&
    Object.entries(expectedInputHashes).every(
      ([key, expectedHash]) => baselineReport.inputHashes[key] === expectedHash
    )
  if (
    !isBaselineForwardEvidenceReusable(
      {
        baselineMigrationHighWater: baselineReport.baselineMigrationHighWater,
        inputHashes: baselineReport.inputHashes,
        outcome: "PASS",
      },
      baselineState
    ) ||
    !immutableInputsMatch
  ) {
    return {
      reason: "Baseline-forward immutable inputs no longer match current Oracle and HEAD evidence",
      ruleId: "prelive/evidence-invalid",
      status: "error",
    }
  }

  return { baselineReport, baselineState, status: "ok" }
}
