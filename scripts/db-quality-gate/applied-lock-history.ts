import { stableJsonStringify } from "./serialization"

type LegacyLockEntry = {
  path: string
  sha256: string
}

type AppliedLockEntry = LegacyLockEntry & {
  liveName: string
  liveVersion: string
  readBackDigest: string
  readBackEvidenceId: string
}

type AppliedLockHistory = {
  applied: AppliedLockEntry[]
  cutover: {
    commit: string
    legacyInventorySha256: string
    migrationRoot: string
  }
  legacy: LegacyLockEntry[]
}

function entriesMatch<T>(previousEntries: T[], currentEntries: T[]): boolean {
  return (
    currentEntries.length >= previousEntries.length &&
    previousEntries.every(
      (entry, index) => stableJsonStringify(currentEntries[index]) === stableJsonStringify(entry)
    )
  )
}

/** Preserves immutable cutover and legacy entries while allowing later applied entries. */
export function preservesAppliedLockHistory(
  previous: AppliedLockHistory,
  current: AppliedLockHistory
): boolean {
  return (
    previous.cutover.commit === current.cutover.commit &&
    previous.cutover.legacyInventorySha256 === current.cutover.legacyInventorySha256 &&
    previous.cutover.migrationRoot === current.cutover.migrationRoot &&
    previous.legacy.length === current.legacy.length &&
    entriesMatch(previous.legacy, current.legacy) &&
    entriesMatch(previous.applied, current.applied)
  )
}
