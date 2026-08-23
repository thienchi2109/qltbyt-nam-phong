import { runBaselineCatchUp, runBaselineHealthRecovery } from "./baseline-maintenance"
import { compareConfirmedMigrations } from "./baseline-state"
import { stableJsonStringify } from "./serialization"
import type { BaselineMaintenanceExecutor } from "./baseline-maintenance"
import type { BaselineState, ConfirmedLiveMigration } from "./baseline-state"

type MaintenanceInput = {
  checkedAt: string
  confirmedMigrations: ConfirmedLiveMigration[]
  executor: BaselineMaintenanceExecutor
  repositoryRoot: string
  runId: string
  sourceCommit: string
}

type MaintenanceResult = {
  outcome: "INCOMPLETE" | "PASS"
  state: BaselineState
}

type BaselineReconciliationDependencies = {
  runCatchUp?: (input: MaintenanceInput) => MaintenanceResult
  runHealthRecovery?: (input: Omit<MaintenanceInput, "repositoryRoot">) => MaintenanceResult
}

function confirmationsIncluded(
  state: BaselineState,
  confirmations: ConfirmedLiveMigration[]
): boolean {
  const current = new Set(
    state.confirmedMigrations.map((confirmation) => stableJsonStringify(confirmation))
  )
  return confirmations.every((confirmation) => current.has(stableJsonStringify(confirmation)))
}

/**
 * Selects the independent Oracle maintenance branch. The supplied maintenance
 * executor remains the only component allowed to mutate the isolated baseline.
 */
export function runBaselineReconciliation(
  input: MaintenanceInput,
  dependencies: BaselineReconciliationDependencies = {}
): MaintenanceResult {
  const current = input.executor.readState()
  const targetHighWater = [...input.confirmedMigrations]
    .sort(compareConfirmedMigrations)
    .at(-1)?.liveVersion
  if (
    current !== undefined &&
    current.healthy &&
    current.migrationHighWater === targetHighWater &&
    confirmationsIncluded(current, input.confirmedMigrations)
  ) {
    return { outcome: "PASS", state: current }
  }

  if (current?.healthy) {
    return (dependencies.runCatchUp ?? runBaselineCatchUp)(input)
  }

  const { repositoryRoot: _repositoryRoot, ...healthInput } = input
  return (dependencies.runHealthRecovery ?? runBaselineHealthRecovery)(healthInput)
}
