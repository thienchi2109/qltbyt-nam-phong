import { artifactMatchesCommit } from "./static-artifacts"
import { evaluateDangerousApproval } from "./approvals"
import { readCandidateStaticEvidence } from "./static-candidate-evidence"
import { currentHeadCommit } from "./git-evidence"
import { migrationIdentitiesMatch } from "./static-lane-evidence"
import type { WaiverRegistry } from "./registries"
import type { GateFinding, MigrationIdentity } from "./types"

const WAIVERS_PATH = "supabase/db-quality-gate-waivers.json"

type ApprovalAttachment = {
  evidenceUnavailable: boolean
  findings: GateFinding[]
}

function effectiveActiveApprovals(waivers: WaiverRegistry | undefined) {
  if (waivers === undefined) {
    return []
  }

  const supersededApprovalIds = new Set(
    waivers.approvals.flatMap((approval) =>
      approval.supersedes === undefined ? [] : [approval.supersedes]
    )
  )

  return waivers.approvals.filter(
    (approval) => approval.status === "active" && !supersededApprovalIds.has(approval.id)
  )
}

/** Attaches only immutable approval evidence; static-only execution remains fail-closed. */
export function attachDangerousApprovals(input: {
  approvalEvaluationAt: string
  candidateCommit?: string
  finalInputHashes: Record<string, string>
  findings: GateFinding[]
  migrationIdentities: MigrationIdentity[]
  repositoryRoot: string
  subjectCommit: string
  waivers: WaiverRegistry | undefined
}): ApprovalAttachment {
  const migrationsByPath = new Map(
    input.migrationIdentities.map((migration) => [migration.path, migration])
  )
  const headCommit = currentHeadCommit(input.repositoryRoot)
  const waiverAtHead =
    headCommit !== undefined &&
    artifactMatchesCommit(input.repositoryRoot, headCommit, WAIVERS_PATH)
  const candidateReport =
    input.candidateCommit === undefined || headCommit === undefined
      ? undefined
      : readCandidateStaticEvidence({
          candidateCommit: input.candidateCommit,
          finalCommit: headCommit,
          repositoryRoot: input.repositoryRoot,
        })
  let evidenceUnavailable =
    input.candidateCommit !== undefined &&
    (candidateReport === undefined ||
      !migrationIdentitiesMatch(candidateReport.migrationIdentities, input.migrationIdentities) ||
      !["appliedLock", "baseline", "harness", "invariants", "sqlTests"].every(
        (key) => candidateReport.inputHashes[key] === input.finalInputHashes[key]
      ))

  const findings = input.findings.map((finding) => {
    if (finding.classification !== "DANGEROUS") {
      return finding
    }

    const migrationPath = finding.evidence?.migration
    const migration =
      typeof migrationPath === "string" ? migrationsByPath.get(migrationPath) : undefined
    const approval = effectiveActiveApprovals(input.waivers).find(
      (entry) =>
        entry.findingFingerprint === finding.fingerprint &&
        entry.migrationPath === migrationPath &&
        entry.ruleId === finding.ruleId &&
        (input.candidateCommit === undefined || entry.candidateCommit === input.candidateCommit)
    )

    if (typeof migrationPath !== "string" || migration === undefined || approval === undefined) {
      return finding
    }

    if (approval.migrationSha256 !== migration.sha256) {
      evidenceUnavailable = true
      return finding
    }

    if (headCommit === undefined || !waiverAtHead || input.subjectCommit !== headCommit) {
      evidenceUnavailable = true
      return finding
    }

    if (input.candidateCommit === undefined || approval.candidateCommit !== input.candidateCommit) {
      evidenceUnavailable = true
      return finding
    }

    const candidateFinding = candidateReport?.findings.find(
      (entry) =>
        entry.classification === "DANGEROUS" &&
        entry.fingerprint === finding.fingerprint &&
        entry.ruleId === finding.ruleId &&
        entry.evidence?.migration === migrationPath
    )
    const candidateMigration = candidateReport?.migrationIdentities.find(
      (entry) => entry.path === migrationPath && entry.sha256 === migration.sha256
    )
    if (
      candidateReport === undefined ||
      candidateFinding === undefined ||
      candidateMigration === undefined ||
      candidateReport.outcome !== "FAILED"
    ) {
      evidenceUnavailable = true
      return finding
    }

    const evaluation = evaluateDangerousApproval({
      approval,
      candidateEvidence: {
        candidateCommit: candidateReport.subjectCommit,
        findingFingerprint: candidateFinding.fingerprint,
        migrationSha256: candidateMigration.sha256,
        reportDigest: candidateReport.digest,
      },
      finding: {
        classification: "DANGEROUS",
        fingerprint: finding.fingerprint,
        migrationSha256: migration.sha256,
        ruleId: finding.ruleId,
      },
      now: input.approvalEvaluationAt,
    })
    if (!evaluation.accepted) {
      return finding
    }

    return {
      ...finding,
      approval: {
        acceptedForAggregate: true,
        id: approval.id,
      },
    }
  })

  return { evidenceUnavailable, findings }
}
