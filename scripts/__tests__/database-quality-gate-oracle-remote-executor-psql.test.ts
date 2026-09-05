import { describe, expect, it } from "vitest"

import { commandRecorder, executorInput } from "./database-quality-gate-oracle-test-support"
import type { CommandInput, CommandResult } from "./database-quality-gate-oracle-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type OracleRemoteExecutorModule = {
  createOracleRemoteExecutor: (input: {
    command: (input: CommandInput) => CommandResult
    config: ReturnType<typeof executorInput>["config"]
  }) => {
    runSqlTest: (input: {
      content: string
      databaseName: string
      fixtureContract: "isolated-fixture"
      path: string
      runnerRequirements: string[]
      timeoutSeconds: number
      transactionContract: "rollback-required"
    }) => { kind?: string; status: string }
  }
}

function sqlTestInput(content: string) {
  return {
    content,
    databaseName: "dq_baseline_forward_phase4_run",
    fixtureContract: "isolated-fixture" as const,
    path: "supabase/tests/device_quota_unit_catalog_draft_phase_gate.sql",
    runnerRequirements: ["psql"],
    timeoutSeconds: 30,
    transactionContract: "rollback-required" as const,
  }
}

describe("database quality gate Oracle psql test handling", () => {
  it("removes a leading ON_ERROR_STOP directive before executing the rollback body", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    const result = executor.runSqlTest(
      sqlTestInput("\\set ON_ERROR_STOP on\n\nBEGIN;\nSELECT 1;\nROLLBACK;\n")
    )

    expect(result.status).toBe("ok")
    expect(recorder.commands.at(-1)?.input).toBe(
      "BEGIN;\nSET LOCAL statement_timeout = 30000;\nSELECT 1;\nROLLBACK;"
    )
    expect(recorder.commands.at(-1)?.arguments.at(-1)).toContain(
      "-v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate"
    )
  })

  it("still rejects every other psql meta command before remote execution", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    const result = executor.runSqlTest(
      sqlTestInput("\\set ON_ERROR_STOP on\n\\echo unsafe\nBEGIN;\nSELECT 1;\nROLLBACK;\n")
    )

    expect(result).toMatchObject({ kind: "stale-environment", status: "error" })
    expect(recorder.commands).toHaveLength(0)
  })

  it("preserves a balanced savepoint inside the executor-owned rollback envelope", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    const result = executor.runSqlTest(
      sqlTestInput(
        "BEGIN;\nSAVEPOINT fixture_failure;\nSELECT 1;\nROLLBACK TO SAVEPOINT fixture_failure;\nROLLBACK;\n"
      )
    )

    expect(result.status).toBe("ok")
    expect(recorder.commands.at(-1)?.input).toBe(
      "BEGIN;\nSET LOCAL statement_timeout = 30000;\nSAVEPOINT fixture_failure;\nSELECT 1;\nROLLBACK TO SAVEPOINT fixture_failure;\nROLLBACK;"
    )
  })

  it("rejects savepoint control that can escape the declared rollback contract", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const executor = source.createOracleRemoteExecutor(executorInput(recorder.command))

    const result = executor.runSqlTest(
      sqlTestInput("BEGIN;\nROLLBACK TO SAVEPOINT missing_fixture;\nROLLBACK;\n")
    )

    expect(result).toMatchObject({ kind: "stale-environment", status: "error" })
    expect(recorder.commands).toHaveLength(0)
  })
})
