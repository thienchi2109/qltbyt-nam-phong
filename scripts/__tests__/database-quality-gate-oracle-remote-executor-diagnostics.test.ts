import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"

import type { OracleDiagnosticCategory } from "../db-quality-gate/oracle-diagnostics"
import type { OracleExecutorResult } from "../db-quality-gate/dynamic-lane-types"
import { commandRecorder, executorInput } from "./database-quality-gate-oracle-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type OracleRemoteExecutorModule = typeof import("../db-quality-gate/oracle-remote-executor")
type OracleExecutor = ReturnType<OracleRemoteExecutorModule["createOracleRemoteExecutor"]>

function expectRedactedDiagnostic(
  result: OracleExecutorResult<unknown>,
  category: OracleDiagnosticCategory,
  stderr: string,
  kind?: string
) {
  expect(result).toMatchObject({
    diagnostic: {
      category,
      stderrSha256: createHash("sha256").update(stderr).digest("hex"),
    },
    ...(kind === undefined ? {} : { kind }),
    status: "error",
  })
  expect(JSON.stringify(result)).not.toContain("secret-diagnostic-token")
}

describe("database quality gate Oracle remote executor diagnostics", () => {
  it.each([
    {
      expectedCategory: "permission-denied",
      invoke: (executor: OracleExecutor) =>
        executor.createDatabase({ databaseName: "dq_baseline_forward_diagnostic" }),
      stderr: "ERROR:  permission denied to create database secret-diagnostic-token",
      trigger: "CREATE DATABASE",
    },
    {
      expectedCategory: "duplicate-object",
      invoke: (executor: OracleExecutor) =>
        executor.applyMigrations({
          databaseName: "dq_baseline_forward_diagnostic",
          migrations: [
            {
              content: "CREATE TABLE public.diagnostic_candidate (id bigint);",
              path: "supabase/migrations/20270201000000_diagnostic.sql",
              sha256: "a".repeat(64),
            },
          ],
        }),
      stderr: 'ERROR:  relation "diagnostic_candidate" already exists secret-diagnostic-token',
      trigger: "diagnostic_candidate",
    },
    {
      expectedCategory: "undefined-function",
      invoke: (executor: OracleExecutor) =>
        executor.runSqlTest({
          content: "BEGIN;\nSELECT public.diagnostic_function();\nROLLBACK;\n",
          databaseName: "dq_baseline_forward_diagnostic",
          fixtureContract: "isolated-fixture",
          path: "supabase/tests/diagnostic.sql",
          runnerRequirements: ["psql"],
          timeoutSeconds: 30,
          transactionContract: "rollback-required",
        }),
      stderr:
        "ERROR:  function public.diagnostic_function() does not exist secret-diagnostic-token",
      trigger: "diagnostic_function",
    },
    {
      expectedCategory: "undefined-relation",
      invoke: (executor: OracleExecutor) => executor.dropDatabase("dq_baseline_forward_diagnostic"),
      stderr: 'ERROR:  relation "diagnostic_database" does not exist secret-diagnostic-token',
      trigger: "DROP DATABASE",
    },
  ] satisfies Array<{
    expectedCategory: OracleDiagnosticCategory
    invoke: (executor: OracleExecutor) => OracleExecutorResult<undefined>
    stderr: string
    trigger: string
  }>)(
    "propagates a redacted $expectedCategory diagnostic through the executor",
    async ({ expectedCategory, invoke, stderr, trigger }) => {
      const source =
        await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
      const recorder = commandRecorder()
      const executor = source.createOracleRemoteExecutor(
        executorInput((input) => {
          if (input.input?.includes(trigger)) {
            return { exitCode: 1, stderr, stdout: "", timedOut: false }
          }
          return recorder.command(input)
        })
      )

      expectRedactedDiagnostic(invoke(executor), expectedCategory, stderr)
    }
  )

  it("classifies non-empty timeout stderr without changing the timeout kind", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const stderr = "ERROR: permission denied secret-diagnostic-token"
    const executor = source.createOracleRemoteExecutor(
      executorInput((input) =>
        input.input?.includes("CREATE DATABASE")
          ? { exitCode: 124, stderr, stdout: "", timedOut: true }
          : commandRecorder().command(input)
      )
    )

    const result = executor.createDatabase({
      databaseName: "dq_baseline_forward_timeout_diagnostic",
    })

    expectRedactedDiagnostic(result, "permission-denied", stderr, "timeout")
  })

  it("preserves the baseline-state read diagnostic through preflight", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const recorder = commandRecorder()
    const stderr = "ERROR: permission denied reading baseline state secret-diagnostic-token"
    const executor = source.createOracleRemoteExecutor(
      executorInput((input) =>
        input.arguments.at(-1)?.includes("/baseline/current.json")
          ? { exitCode: 1, stderr, stdout: "", timedOut: false }
          : recorder.command(input)
      )
    )

    const result = executor.preflight()

    expectRedactedDiagnostic(result, "permission-denied", stderr, "stale-environment")
  })

  it("preserves the remote diagnostic through lock acquisition", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const stderr = "ERROR: permission denied acquiring lock secret-diagnostic-token"
    const executor = source.createOracleRemoteExecutor(
      executorInput(() => ({ exitCode: 1, stderr, stdout: "", timedOut: false }))
    )

    const result = executor.acquireLock("diagnostic-run")

    expectRedactedDiagnostic(result, "permission-denied", stderr, "interrupted")
  })

  it("preserves the remote diagnostic through lock release", async () => {
    const source =
      await loadDatabaseQualityGateModule<OracleRemoteExecutorModule>("oracle-remote-executor")
    const stderr = "ERROR: permission denied releasing lock secret-diagnostic-token"
    const executor = source.createOracleRemoteExecutor(
      executorInput(() => ({ exitCode: 1, stderr, stdout: "", timedOut: false }))
    )

    const result = executor.releaseLock("diagnostic-run")

    expectRedactedDiagnostic(result, "permission-denied", stderr, "cleanup")
  })
})
