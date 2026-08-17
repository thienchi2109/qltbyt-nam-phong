import { artifactMatchesCommit } from "./static-artifacts"
import { currentHeadCommit } from "./git-evidence"
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
  let evidenceUnavailable = false

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
        entry.migrationSha256 === migration?.sha256 &&
        entry.ruleId === finding.ruleId
    )

    if (typeof migrationPath !== "string" || migration === undefined || approval === undefined) {
      return finding
    }

    if (headCommit === undefined || !waiverAtHead || input.subjectCommit !== headCommit) {
      evidenceUnavailable = true
      return finding
    }

    evidenceUnavailable = true
    return finding
  })

  return { evidenceUnavailable, findings }
}
