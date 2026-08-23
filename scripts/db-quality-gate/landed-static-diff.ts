import {
  currentHeadCommit,
  firstParentCommit,
  listChangedFilesBetween,
  resolveGitCommit,
} from "./git-evidence"

export type TrustedStaticDiff = {
  baseRef: string
  changedFiles: string[]
  unavailable: boolean
}

/** Binds a landed commit to its exact first parent before exposing changed paths. */
export function resolveLandedStaticDiff(input: {
  landedParentCommit: string
  repositoryRoot: string
  subjectCommit: string
}): TrustedStaticDiff {
  const headCommit = currentHeadCommit(input.repositoryRoot)
  const resolvedSubject = resolveGitCommit(input.repositoryRoot, input.subjectCommit)
  const resolvedParent = resolveGitCommit(input.repositoryRoot, input.landedParentCommit)
  const actualParent =
    headCommit === undefined ? undefined : firstParentCommit(input.repositoryRoot, headCommit)
  const commitsBound =
    headCommit !== undefined &&
    resolvedSubject === headCommit &&
    input.subjectCommit === headCommit &&
    resolvedParent === actualParent &&
    input.landedParentCommit === actualParent
  const changedFiles =
    commitsBound && actualParent !== undefined
      ? listChangedFilesBetween(input.repositoryRoot, actualParent, headCommit)
      : undefined

  return {
    baseRef: actualParent ?? input.landedParentCommit,
    changedFiles: changedFiles ?? [],
    unavailable: !commitsBound || changedFiles === undefined,
  }
}
