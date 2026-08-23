import { refreshPublicOriginMain } from "./git-evidence"
import { verifyProtectedMain } from "./protected-main"
import { evaluateReconciliation } from "./reconciliation"
import type { OracleEvidenceStore } from "./oracle-evidence-store"
import type { PreLiveEvidenceInput } from "./pre-live"
import type { ProtectedMainVerifier } from "./protected-main"
import type { ReconciliationDependencies, ReconciliationInput } from "./reconciliation"
import type { GateReport } from "./types"

type ReconciliationEvaluator = (
  input: ReconciliationInput,
  dependencies: ReconciliationDependencies
) => GateReport

export type PreLiveReconciliationDependencies = {
  evaluateReconciliation?: ReconciliationEvaluator
  verifyProtectedMain?: ProtectedMainVerifier
}

/** Evaluates the prior live migration interlock before the next pre-live review. */
export function runPreLiveReconciliationCheck(
  input: PreLiveEvidenceInput,
  subjectCommit: string,
  createdAt: string,
  dependencies: PreLiveReconciliationDependencies & {
    evidenceStore: OracleEvidenceStore
    refreshOriginMain?: (repositoryRoot: string) => string | undefined
  }
): GateReport {
  return (dependencies.evaluateReconciliation ?? evaluateReconciliation)(
    {
      baselineForwardDigest: input.baselineForwardDigest,
      baselineForwardRunId: input.baselineForwardRunId,
      repositoryRoot: input.repositoryRoot,
      runId: `${input.runId}-reconciliation`,
      subjectCommit,
    },
    {
      clock: () => createdAt,
      evidenceStore: dependencies.evidenceStore,
      refreshOriginMain: dependencies.refreshOriginMain ?? refreshPublicOriginMain,
      verifyProtectedMain: dependencies.verifyProtectedMain ?? verifyProtectedMain,
    }
  )
}
