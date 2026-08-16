import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

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

type ApprovalsModule = {
  evaluateDangerousApproval: (input: {
    approval?: Approval
    candidateEvidence: CandidateEvidence
    finding: DangerousFinding
    finalCommit: string
    now: string
  }) => ApprovalEvaluation
}

const FINDING: DangerousFinding = {
  classification: "DANGEROUS",
  fingerprint: "dangerous-fingerprint",
  migrationSha256: "1".repeat(64),
  ruleId: "sql.dangerous-statement",
}

const CANDIDATE_EVIDENCE: CandidateEvidence = {
  candidateCommit: "a".repeat(40),
  findingFingerprint: FINDING.fingerprint,
  migrationSha256: FINDING.migrationSha256,
  reportDigest: "candidate-report-digest",
}

function approval(overrides: Partial<Approval> = {}): Approval {
  return {
    approvalCommit: "b".repeat(40),
    candidateCommit: CANDIDATE_EVIDENCE.candidateCommit,
    findingFingerprint: FINDING.fingerprint,
    id: "approval-1",
    migrationSha256: FINDING.migrationSha256,
    reviewEvidence: "PR #936 reviewed by maintainer",
    ruleId: FINDING.ruleId,
    status: "active",
    ...overrides,
  }
}

describe("database quality gate DANGEROUS approval contract", () => {
  it("fails a DANGEROUS finding with no approval record", async () => {
    const approvals = await loadDatabaseQualityGateModule<ApprovalsModule>("approvals")

    const result = approvals.evaluateDangerousApproval({
      candidateEvidence: CANDIDATE_EVIDENCE,
      finding: FINDING,
      finalCommit: "b".repeat(40),
      now: "2026-08-16T09:29:20Z",
    })

    expect(result.outcome).toBe("FAILED")
    expect(result.accepted).toBe(false)
  })

  it("accepts only candidate evidence bound to the approval-bearing commit and retains DANGEROUS classification", async () => {
    const approvals = await loadDatabaseQualityGateModule<ApprovalsModule>("approvals")

    const result = approvals.evaluateDangerousApproval({
      approval: approval(),
      candidateEvidence: CANDIDATE_EVIDENCE,
      finding: FINDING,
      finalCommit: "b".repeat(40),
      now: "2026-08-16T09:29:20Z",
    })

    expect(result.outcome).toBe("PASS")
    expect(result.accepted).toBe(true)
    expect(result.finding.classification).toBe("DANGEROUS")
  })

  it("invalidates approval evidence when migration content or approval-bearing commit changes", async () => {
    const approvals = await loadDatabaseQualityGateModule<ApprovalsModule>("approvals")
    const changedFinding: DangerousFinding = {
      ...FINDING,
      migrationSha256: "2".repeat(64),
    }

    const contentChanged = approvals.evaluateDangerousApproval({
      approval: approval(),
      candidateEvidence: CANDIDATE_EVIDENCE,
      finding: changedFinding,
      finalCommit: "b".repeat(40),
      now: "2026-08-16T09:29:20Z",
    })
    const approvalCommitChanged = approvals.evaluateDangerousApproval({
      approval: approval(),
      candidateEvidence: CANDIDATE_EVIDENCE,
      finding: FINDING,
      finalCommit: "c".repeat(40),
      now: "2026-08-16T09:29:20Z",
    })

    expect(contentChanged).toMatchObject({ accepted: false, outcome: "FAILED" })
    expect(approvalCommitChanged).toMatchObject({ accepted: false, outcome: "FAILED" })
  })

  it("rejects expired, revoked, and unreviewed approvals", async () => {
    const approvals = await loadDatabaseQualityGateModule<ApprovalsModule>("approvals")
    const invalidApprovals = [
      approval({ expiresAt: "2026-08-16T09:29:19Z" }),
      approval({ revokedAt: "2026-08-16T09:00:00Z", status: "revoked" }),
      approval({ reviewEvidence: undefined }),
    ]

    for (const invalidApproval of invalidApprovals) {
      const result = approvals.evaluateDangerousApproval({
        approval: invalidApproval,
        candidateEvidence: CANDIDATE_EVIDENCE,
        finding: FINDING,
        finalCommit: "b".repeat(40),
        now: "2026-08-16T09:29:20Z",
      })

      expect(result).toMatchObject({ accepted: false, outcome: "FAILED" })
    }
  })
})
