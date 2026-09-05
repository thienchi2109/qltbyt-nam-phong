import {
  addDynamicFinding,
  recordDynamicOperationError,
  type DynamicRunState,
} from "./dynamic-lane-report"
import { readCommittedSqlTest } from "./dynamic-lane-inputs"
import type { OracleDynamicLaneInput } from "./dynamic-lane-types"
import type { SqlTestExecutionEvidence } from "./types"

type DynamicSqlTest = {
  fixtureContract: "isolated-fixture"
  path: string
  runnerRequirements: string[]
  timeoutSeconds: number
  transactionContract: "rollback-required"
}

type DynamicSqlSweepInput = {
  databaseName: string
  execution: SqlTestExecutionEvidence
  input: OracleDynamicLaneInput
  operationPrefix?: "baseline-control"
  sqlTests: DynamicSqlTest[]
  state: DynamicRunState
}

/** Runs every deterministic SQL check while stopping fail-closed on unavailable evidence. */
export function runDynamicSqlTestSweep(input: DynamicSqlSweepInput): boolean {
  const operation =
    input.operationPrefix === undefined ? "run-sql-test" : `${input.operationPrefix}.run-sql-test`
  const sourceRule =
    input.operationPrefix === undefined
      ? "dynamic.sql-test.source"
      : `dynamic.${input.operationPrefix}.sql-test.source`
  let deterministicFailure = false

  input.execution.selected = input.sqlTests.map((sqlTest) => sqlTest.path)
  for (const sqlTest of input.sqlTests) {
    const content = readCommittedSqlTest(input.input, sqlTest.path)
    if (content === undefined) {
      addDynamicFinding(input.state, sourceRule, sqlTest.path, { path: sqlTest.path })
      input.state.incomplete = true
      return false
    }

    input.execution.attempted.push(sqlTest.path)
    const checked = input.input.executor.runSqlTest({
      content,
      databaseName: input.databaseName,
      fixtureContract: sqlTest.fixtureContract,
      path: sqlTest.path,
      runnerRequirements: sqlTest.runnerRequirements,
      timeoutSeconds: sqlTest.timeoutSeconds,
      transactionContract: sqlTest.transactionContract,
    })
    if (checked.status === "error") {
      recordDynamicOperationError(input.state, operation, checked, {
        sqlTestPath: sqlTest.path,
      })
      if (checked.kind === "failed") {
        deterministicFailure = true
        input.execution.executed.push(sqlTest.path)
        continue
      }
      return false
    }
    input.execution.executed.push(sqlTest.path)
  }

  return !deterministicFailure
}
