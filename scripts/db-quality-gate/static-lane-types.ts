export type ReviewedMigrationSelectorInput = {
  repositoryRoot: string
  subjectCommit: string
  selector: unknown
}

export type ReviewedMigrationSelector = {
  subjectCommit: string
  migrations: Array<{ path: string; sha256: string }>
}

export type SelectorResult =
  | { ok: true; selector: ReviewedMigrationSelector }
  | { ok: false; outcome: "INCOMPLETE"; reason: string }

export type StaticLaneInput = {
  baseRef?: string
  changedFiles?: string[]
  createdAt: string
  repositoryRoot: string
  runId: string
  reviewedMigrationSelector?: unknown
  subjectCommit: string
}

export type LandedStaticLaneInput = Omit<StaticLaneInput, "baseRef" | "changedFiles"> & {
  landedParentCommit: string
}
