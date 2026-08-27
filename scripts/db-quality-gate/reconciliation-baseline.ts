import { runBaselineCatchUp, runBaselineHealthRecovery } from "./baseline-maintenance"
import { BASELINE_STATE_SCHEMA_VERSION } from "./baseline-state"
import { stableJsonStringify } from "./serialization"
import type { BaselineManifest } from "./baseline-manifest"
import type { BaselineMaintenanceExecutor } from "./baseline-maintenance"
import type { MaintenanceResult } from "./baseline-maintenance-recovery"
import type { BaselineState, ConfirmedLiveMigration } from "./baseline-state"

type MaintenanceInput = {
  checkedAt: string
  executor: BaselineMaintenanceExecutor
  manifest: BaselineManifest
  repositoryRoot: string
  runId: string
}

type BaselineReconciliationDependencies = {
  runCatchUp?: (input: MaintenanceInput) => MaintenanceResult
  runHealthRecovery?: (input: MaintenanceInput) => MaintenanceResult
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

/** Selects catch-up or metadata-only recovery without mutating live Supabase state. */
export function runBaselineReconciliation(
  input: MaintenanceInput,
  dependencies: BaselineReconciliationDependencies = {}
): MaintenanceResult {
  const current = input.executor.readState()
  if (
    current?.schemaVersion === BASELINE_STATE_SCHEMA_VERSION &&
    current.healthy &&
    current.migrationHighWater === input.manifest.targetMigrationHighWater &&
    current.catalogSha256 === input.manifest.catalogSha256 &&
    confirmationsIncluded(current, input.manifest.migrations)
  ) {
    return { outcome: "PASS", state: current }
  }

  if (current?.schemaVersion === BASELINE_STATE_SCHEMA_VERSION && current.healthy) {
    return (dependencies.runCatchUp ?? runBaselineCatchUp)(input)
  }
  return (dependencies.runHealthRecovery ?? runBaselineHealthRecovery)(input)
}
