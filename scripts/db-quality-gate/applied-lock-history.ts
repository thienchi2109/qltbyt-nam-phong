type AppliedLockEntry = {
  path: string
  sha256: string
}

type AppliedLockHistory = {
  applied: AppliedLockEntry[]
  cutover: {
    commit: string
    migrationRoot: string
  }
  legacy: AppliedLockEntry[]
}

function entriesMatch(
  previousEntries: AppliedLockEntry[],
  currentEntries: AppliedLockEntry[]
): boolean {
  return previousEntries.every(
    (entry, index) =>
      currentEntries[index]?.path === entry.path && currentEntries[index]?.sha256 === entry.sha256
  )
}

/** Preserves immutable cutover and legacy entries while allowing later applied entries. */
export function preservesAppliedLockHistory(
  previous: AppliedLockHistory,
  current: AppliedLockHistory
): boolean {
  return (
    previous.cutover.commit === current.cutover.commit &&
    previous.cutover.migrationRoot === current.cutover.migrationRoot &&
    previous.legacy.length === current.legacy.length &&
    entriesMatch(previous.legacy, current.legacy) &&
    entriesMatch(previous.applied, current.applied)
  )
}

/** Identifies a new applied migration that lacks an independent read-back authority. */
export function hasAppendedAppliedEntries(
  previous: AppliedLockHistory,
  current: AppliedLockHistory
): boolean {
  return current.applied.length > previous.applied.length
}
