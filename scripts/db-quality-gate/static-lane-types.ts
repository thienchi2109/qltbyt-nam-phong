export type StaticLaneInput = {
  baseRef?: string
  changedFiles?: string[]
  createdAt: string
  repositoryRoot: string
  runId: string
  subjectCommit: string
}

export type LandedStaticLaneInput = Omit<StaticLaneInput, "baseRef" | "changedFiles"> & {
  landedParentCommit: string
}
