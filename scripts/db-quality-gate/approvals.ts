type DangerousFinding = {
  classification: "DANGEROUS"
  fingerprint: string
  migrationSha256: string
  ruleId: string
}

type CandidateEvidence = {
  candidateCommit: string
  findingFingerprint: string
  migrationSha256: string
  reportDigest: string
}

type Approval = {
  approvalCommit: string
  candidateCommit: string
  candidateReportDigest: string
  expiresAt?: string
  findingFingerprint: string
  id: string
  migrationSha256: string
  reviewEvidence?: string
  revokedAt?: string
  ruleId: string
  status: "active" | "revoked" | "superseded"
}

type ApprovalEvaluation = {
  accepted: boolean
  finding: DangerousFinding
  outcome: "FAILED" | "PASS"
}

type ApprovalEvaluationInput = {
  approval?: Approval
  candidateEvidence: CandidateEvidence
  finalCommit: string
  finding: DangerousFinding
  now: string
}

function isCurrentApproval(input: ApprovalEvaluationInput): boolean {
  const { approval, candidateEvidence, finalCommit, finding, now } = input

  return (
    approval !== undefined &&
    approval.status === "active" &&
    approval.revokedAt === undefined &&
    approval.reviewEvidence !== undefined &&
    approval.reviewEvidence.trim().length > 0 &&
    (approval.expiresAt === undefined || approval.expiresAt > now) &&
    approval.approvalCommit === finalCommit &&
    approval.candidateCommit === candidateEvidence.candidateCommit &&
    approval.candidateReportDigest === candidateEvidence.reportDigest &&
    approval.findingFingerprint === candidateEvidence.findingFingerprint &&
    approval.migrationSha256 === candidateEvidence.migrationSha256 &&
    approval.findingFingerprint === finding.fingerprint &&
    approval.migrationSha256 === finding.migrationSha256 &&
    approval.ruleId === finding.ruleId
  )
}

/** Accepts a DANGEROUS finding only when all committed approval evidence still matches. */
export function evaluateDangerousApproval(input: ApprovalEvaluationInput): ApprovalEvaluation {
  const accepted = isCurrentApproval(input)

  return {
    accepted,
    finding: input.finding,
    outcome: accepted ? "PASS" : "FAILED",
  }
}
