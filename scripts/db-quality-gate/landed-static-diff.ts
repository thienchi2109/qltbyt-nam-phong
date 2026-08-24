import {
  currentHeadCommit,
  firstParentCommit,
  listChangedFilesBetween,
  resolveGitCommit,
  worktreeIsClean,
} from "./git-evidence"

export type TrustedStaticDiff = {
  baseRef: string
  candidateCommit?: string
  changedFiles: string[]
  unavailable: boolean
}

/** Binds a landed commit to its exact first parent before exposing changed paths. */
export function resolveLandedStaticDiff(input: {
  candidateCommit?: string
  landedParentCommit: string
  repositoryRoot: string
  subjectCommit: string
}): TrustedStaticDiff {
  const headCommit = currentHeadCommit(input.repositoryRoot)
  const resolvedSubject = resolveGitCommit(input.repositoryRoot, input.subjectCommit)
  const resolvedParent = resolveGitCommit(input.repositoryRoot, input.landedParentCommit)
  const actualParent =
    headCommit === undefined ? undefined : firstParentCommit(input.repositoryRoot, headCommit)
  const resolvedCandidate =
    input.candidateCommit === undefined
      ? undefined
      : resolveGitCommit(input.repositoryRoot, input.candidateCommit)
  const candidateParent =
    resolvedCandidate === undefined
      ? undefined
      : firstParentCommit(input.repositoryRoot, resolvedCandidate)
  const trustedBase = resolvedCandidate === undefined ? actualParent : candidateParent
  const commitsBound =
    headCommit !== undefined &&
    resolvedSubject === headCommit &&
    input.subjectCommit === headCommit &&
    resolvedParent === actualParent &&
    input.landedParentCommit === actualParent &&
    (input.candidateCommit === undefined ||
      (resolvedCandidate === actualParent && input.candidateCommit === actualParent)) &&
    worktreeIsClean(input.repositoryRoot)
  const changedFiles =
    commitsBound && trustedBase !== undefined
      ? listChangedFilesBetween(input.repositoryRoot, trustedBase, headCommit)
      : undefined

  return {
    baseRef: trustedBase ?? input.landedParentCommit,
    candidateCommit: resolvedCandidate,
    changedFiles: changedFiles ?? [],
    unavailable: !commitsBound || changedFiles === undefined,
  }
}
