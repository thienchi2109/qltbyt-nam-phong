import { stableJsonSha256 } from "./serialization"
import type { MigrationIdentity } from "./types"

export type DynamicImmutableInputHashes = {
  harness: string
  invariants: string
  migration: string
  sqlTests: string
  sqlTestSources: string
}

/** Hashes the immutable repository inputs with baseline-forward lane semantics. */
export function dynamicImmutableInputHashes(input: {
  harnessHash: string
  invariants: unknown
  migrationIdentities: MigrationIdentity[]
  sqlTestRegistry: unknown
  sqlTestSourcesHash: string
}): DynamicImmutableInputHashes {
  return {
    harness: input.harnessHash,
    invariants: stableJsonSha256(input.invariants),
    migration: stableJsonSha256(input.migrationIdentities),
    sqlTests: stableJsonSha256(input.sqlTestRegistry),
    sqlTestSources: input.sqlTestSourcesHash,
  }
}
