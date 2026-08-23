import { stableJsonSha256 } from "./serialization"
import type { MigrationIdentity } from "./types"

export type DynamicImmutableInputHashes = {
  invariants: string
  migration: string
  sqlTests: string
}

/** Hashes the immutable repository inputs with baseline-forward lane semantics. */
export function dynamicImmutableInputHashes(input: {
  invariants: unknown
  migrationIdentities: MigrationIdentity[]
  sqlTestRegistry: unknown
}): DynamicImmutableInputHashes {
  return {
    invariants: stableJsonSha256(input.invariants),
    migration: stableJsonSha256(input.migrationIdentities),
    sqlTests: stableJsonSha256(input.sqlTestRegistry),
  }
}
