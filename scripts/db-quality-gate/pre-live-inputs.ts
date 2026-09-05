import {
  dynamicImmutableInputHashes,
  type DynamicImmutableInputHashes,
} from "./dynamic-input-hashes"
import { readDynamicInputArtifacts } from "./dynamic-lane-inputs"
import { createDynamicRunState } from "./dynamic-lane-report"

/** Recomputes baseline-forward repository hashes from the immutable landed commit. */
export function recomputeBaselineForwardInputHashes(input: {
  repositoryRoot: string
  subjectCommit: string
}): DynamicImmutableInputHashes | undefined {
  const state = createDynamicRunState()
  const artifacts = readDynamicInputArtifacts(input, state)
  if (artifacts === undefined || state.incomplete) {
    return undefined
  }

  return dynamicImmutableInputHashes({
    harnessHash: artifacts.harnessHash,
    invariants: artifacts.invariants,
    migrationIdentities: artifacts.migrationIdentities,
    sqlTestRegistry: artifacts.sqlTestRegistry,
    sqlTestSourcesHash: artifacts.sqlTestSourcesHash,
  })
}
