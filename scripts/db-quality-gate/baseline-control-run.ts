import {
  createDynamicRunState,
  recordDynamicOperationError,
  type DynamicRunState,
} from "./dynamic-lane-report"
import { ORACLE_BASELINE_DATABASE, type OracleDynamicLaneInput } from "./dynamic-lane-types"
import type { DynamicInputArtifacts } from "./dynamic-lane-inputs"
import { runDynamicSqlTestSweep } from "./dynamic-sql-sweep"

/** Collects baseline failures independently; only execution/cleanup failures prevent candidate comparison. */
export function runBaselineControl(input: {
  databaseName: string
  input: OracleDynamicLaneInput
  artifacts: DynamicInputArtifacts
  state: DynamicRunState
}): boolean {
  const { executor } = input.input
  const created = executor.createDatabase({
    databaseName: input.databaseName,
    template: ORACLE_BASELINE_DATABASE,
  })
  if (created.status === "error") {
    recordDynamicOperationError(input.state, "baseline-control.create-database", created)
    return false
  }
  const control = createDynamicRunState()
  let complete = false
  try {
    runDynamicSqlTestSweep({
      databaseName: input.databaseName,
      input: input.input,
      state: control,
      execution: input.state.baselineControlSqlTestExecution,
      operationPrefix: "baseline-control",
      sqlTests: input.artifacts.sqlTests,
    })
    input.state.baselineControlFindings = control.findings.filter(
      (f) => f.ruleId === "dynamic.baseline-control.run-sql-test.failed"
    )
    input.state.findings.push(
      ...control.findings.filter((f) => f.ruleId !== "dynamic.baseline-control.run-sql-test.failed")
    )
    input.state.incomplete ||= control.incomplete
    complete =
      !control.incomplete &&
      input.state.baselineControlSqlTestExecution.executed.length ===
        input.artifacts.sqlTests.length
  } finally {
    const cleanup = executor.dropDatabase(input.databaseName)
    if (cleanup.status === "error") {
      recordDynamicOperationError(input.state, "baseline-control.drop-database", cleanup)
      input.state.incomplete = true
      complete = false
    }
  }
  return complete
}
