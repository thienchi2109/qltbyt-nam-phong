import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { reportDigest, serializeReport } from "./contract"
import { worktreeIsClean } from "./git-evidence"
import { parseGateReport } from "./pre-live-report"
import { artifactMatchesCommit, readJsonArtifact } from "./static-artifacts"
import type { GateReport } from "./types"

const SHA1_PATTERN = /^[0-9a-f]{40}$/

/** Canonical repository root for immutable candidate static reports. */
export const STATIC_CANDIDATE_EVIDENCE_ROOT = "supabase/db-quality-gate-static-evidence"

/** Returns the one canonical committed path for a candidate static report. */
export function candidateStaticEvidencePath(candidateCommit: string): string | undefined {
  return SHA1_PATTERN.test(candidateCommit)
    ? `${STATIC_CANDIDATE_EVIDENCE_ROOT}/${candidateCommit}.json`
    : undefined
}

/** Includes candidate static reports in local and landed static-gate triggers. */
export function isCandidateStaticEvidencePath(filePath: string): boolean {
  return filePath.startsWith(`${STATIC_CANDIDATE_EVIDENCE_ROOT}/`) && filePath.endsWith(".json")
}

/** Reads a complete candidate report only when it is immutable at the final commit. */
export function readCandidateStaticEvidence(input: {
  candidateCommit: string
  finalCommit: string
  repositoryRoot: string
}): GateReport | undefined {
  const evidencePath = candidateStaticEvidencePath(input.candidateCommit)
  if (
    evidencePath === undefined ||
    !artifactMatchesCommit(input.repositoryRoot, input.finalCommit, evidencePath)
  ) {
    return undefined
  }

  const report = parseGateReport(readJsonArtifact(input.repositoryRoot, evidencePath))
  if (
    report === undefined ||
    report.lane !== "static" ||
    report.subjectCommit !== input.candidateCommit ||
    report.requiredChecksComplete !== true ||
    report.evidenceAvailable !== true ||
    report.digest !== reportDigest(report) ||
    report.findings.some((finding) => finding.classification === "BLOCKING")
  ) {
    return undefined
  }

  return report
}

/** Persists one immutable candidate report for later maintainer approval. */
export function persistCandidateStaticEvidence(
  repositoryRoot: string,
  report: GateReport
): string | undefined {
  const evidencePath = candidateStaticEvidencePath(report.subjectCommit)
  if (
    !worktreeIsClean(repositoryRoot) ||
    evidencePath === undefined ||
    report.lane !== "static" ||
    report.outcome !== "FAILED" ||
    report.requiredChecksComplete !== true ||
    report.evidenceAvailable !== true ||
    report.digest !== reportDigest(report) ||
    !report.findings.some((finding) => finding.classification === "DANGEROUS") ||
    report.findings.some((finding) => finding.classification === "BLOCKING")
  ) {
    return undefined
  }

  const absolutePath = path.join(repositoryRoot, evidencePath)
  const content = serializeReport(report)
  if (existsSync(absolutePath)) {
    return readFileSync(absolutePath, "utf8") === content ? evidencePath : undefined
  }

  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content, { flag: "wx" })
  return evidencePath
}
