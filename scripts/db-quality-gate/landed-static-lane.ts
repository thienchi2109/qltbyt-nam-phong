import { resolveLandedStaticDiff } from "./landed-static-diff"
import { parseWaiverRegistry } from "./registries"
import {
  candidateStaticEvidencePath,
  isCandidateStaticEvidencePath,
} from "./static-candidate-evidence"
import { readJsonArtifactAtRef } from "./static-artifacts"
import { staticChangedFiles, WAIVERS_PATH } from "./static-changed-files"
import { runStaticLaneWithTrustedDiff } from "./static-lane"
import type { LandedStaticLaneInput } from "./static-lane-types"
import type { GateReport } from "./types"

type LandedStaticLaneDependencies = {
  now?: () => Date
}

type LandedApprovalCandidateInput = Pick<
  LandedStaticLaneInput,
  "landedParentCommit" | "repositoryRoot" | "subjectCommit"
>

function approvalCandidateAtDirectParent(input: {
  changedFiles: string[]
  directParent: string | undefined
  repositoryRoot: string
  subjectCommit: string
}): string | undefined {
  if (input.directParent === undefined) {
    return undefined
  }

  const evidencePath = candidateStaticEvidencePath(input.directParent)
  const subjectWaivers = readJsonArtifactAtRef(
    input.repositoryRoot,
    input.subjectCommit,
    WAIVERS_PATH
  )
  const waivers =
    subjectWaivers.status === "value" ? parseWaiverRegistry(subjectWaivers.value) : undefined
  const waiverReferencesParent = waivers?.approvals.some(
    (approval) => approval.candidateCommit === input.directParent
  )

  return evidencePath !== undefined &&
    input.changedFiles.includes(evidencePath) &&
    waiverReferencesParent
    ? input.directParent
    : undefined
}

function approvalWorkflowForDirectDiff(
  input: LandedApprovalCandidateInput,
  directDiff: ReturnType<typeof resolveLandedStaticDiff>
): {
  approvalWorkflow: boolean
  candidateCommit: string | undefined
} {
  const approvalWorkflow = directDiff.changedFiles.some(
    (filePath) => filePath === WAIVERS_PATH || isCandidateStaticEvidencePath(filePath)
  )
  const candidateCommit =
    approvalWorkflow && !directDiff.unavailable
      ? approvalCandidateAtDirectParent({
          changedFiles: directDiff.changedFiles,
          directParent: input.landedParentCommit,
          repositoryRoot: input.repositoryRoot,
          subjectCommit: input.subjectCommit,
        })
      : undefined

  return {
    approvalWorkflow,
    candidateCommit,
  }
}

/** Resolves the direct candidate parent only for a complete committed approval workflow. */
export function approvalCandidateForLandedCommit(
  input: LandedApprovalCandidateInput
): string | undefined {
  const directDiff = resolveLandedStaticDiff(input)

  return approvalWorkflowForDirectDiff(input, directDiff).candidateCommit
}

/**
 * Runs static checks over the exact landed first-parent diff after independently binding both SHAs.
 */
export function runStaticLaneForLandedCommit(
  input: LandedStaticLaneInput,
  dependencies: LandedStaticLaneDependencies = {}
): GateReport {
  const directDiff = resolveLandedStaticDiff(input)
  const { approvalWorkflow, candidateCommit } = approvalWorkflowForDirectDiff(input, directDiff)
  const trustedDiff =
    candidateCommit === undefined
      ? directDiff
      : resolveLandedStaticDiff({
          ...input,
          candidateCommit,
        })
  const changedFiles = staticChangedFiles(trustedDiff.changedFiles)

  return runStaticLaneWithTrustedDiff(
    {
      createdAt: input.createdAt,
      repositoryRoot: input.repositoryRoot,
      runId: input.runId,
      subjectCommit: input.subjectCommit,
    },
    {
      ...trustedDiff,
      candidateCommit,
      changedFiles,
      unavailable:
        trustedDiff.unavailable ||
        (approvalWorkflow && candidateCommit === undefined) ||
        changedFiles.length === 0,
    },
    (dependencies.now ?? (() => new Date()))().toISOString()
  )
}

export type { LandedStaticLaneDependencies, LandedStaticLaneInput }
