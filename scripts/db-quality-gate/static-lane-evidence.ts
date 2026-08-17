import { isAncestorCommit, resolveGitCommit } from "./git-evidence"
import { artifactMatchesCommit } from "./static-artifacts"
import { staticBlockingFinding } from "./static-policy"
import type { GateFinding, MigrationIdentity } from "./types"

/** Converts repository inspection outcomes into deterministic static findings. */
export function repositoryFindings(findings: Array<{ ruleId: string }>): GateFinding[] {
  return findings.map((finding) =>
    staticBlockingFinding(finding.ruleId, finding.ruleId, { repository: "migration-source" })
  )
}

/** Confirms the committed waiver artifact is byte-for-byte available at HEAD. */
export function waiverArtifactMatchesHead(
  repositoryRoot: string,
  headCommit: string,
  waiverPath: string
): boolean {
  return artifactMatchesCommit(repositoryRoot, headCommit, waiverPath)
}

/** Trusts an identity baseline only when its source commit is an ancestor of the committed artifact. */
export function hasTrustedIdentityBaseline(
  repositoryRoot: string,
  headCommit: string | undefined,
  sourceCommit: string,
  baselinePath: string
): boolean {
  const resolvedSourceCommit = resolveGitCommit(repositoryRoot, sourceCommit)

  return (
    headCommit !== undefined &&
    resolvedSourceCommit !== undefined &&
    isAncestorCommit(repositoryRoot, resolvedSourceCommit, headCommit) &&
    artifactMatchesCommit(repositoryRoot, headCommit, baselinePath)
  )
}

/** Compares migration identities in source order and by content digest. */
export function migrationIdentitiesMatch(
  left: MigrationIdentity[],
  right: MigrationIdentity[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (migration, index) =>
        migration.path === right[index]?.path && migration.sha256 === right[index]?.sha256
    )
  )
}
