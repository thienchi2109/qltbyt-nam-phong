import { describe, expect, it } from "vitest"

import { commandRecorder, executorInput } from "./database-quality-gate-oracle-test-support"
import type { CommandInput, CommandResult } from "./database-quality-gate-oracle-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type MaintenanceExecutorModule = {
  createOracleBaselineMaintenanceExecutor: (input: {
    command: (input: CommandInput) => CommandResult
    config: ReturnType<typeof executorInput>["config"]
  }) => {
    applyMigrations: (
      databaseName: string,
      migrations: Array<{
        content: string
        liveName: string
        liveVersion: string
        path: string
        sha256: string
      }>
    ) => boolean
    createRefreshDatabase: (databaseName: string) => boolean
    publishState: (state: {
      checkedAt: string
      confirmedMigrations: Array<{
        liveName: string
        liveVersion: string
        path: string
        sha256: string
      }>
      generation: string
      healthy: boolean
      migrationHighWater: string
      schemaVersion: 1
      sourceCommit: string
    }) => boolean
    restoreDump: (databaseName: string, dumpPath: string) => boolean
    swapBaseline: (databaseName: string, retiredDatabaseName: string) => boolean
  }
}

type BaselineSqlModule = {
  BASELINE_OBSERVATION_QUERY: string
}

const migration = {
  content: "SELECT 1;",
  liveName: "confirmed_live_change",
  liveVersion: "20260819062043",
  path: "supabase/migrations/20260819031200_confirmed_live_change.sql",
  sha256: "17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a",
}

describe("database quality gate Oracle baseline maintenance executor", () => {
  it("normalizes migration SQL and excludes Supabase-managed schemas from health debt", async () => {
    const source = await loadDatabaseQualityGateModule<BaselineSqlModule>("oracle-baseline-sql")

    expect(source.BASELINE_OBSERVATION_QUERY).toContain("regexp_replace")
    expect(source.BASELINE_OBSERVATION_QUERY).toContain("replace(COALESCE(statements[1], '')")
    expect(source.BASELINE_OBSERVATION_QUERY).toContain("'realtime'")
  })

  it("publishes one atomic state file without embedding credentials", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceExecutorModule>(
      "oracle-baseline-maintenance-executor"
    )
    const recorder = commandRecorder()
    const executor = source.createOracleBaselineMaintenanceExecutor(executorInput(recorder.command))

    expect(
      executor.publishState({
        checkedAt: "2026-08-19T11:00:00Z",
        confirmedMigrations: [migration],
        generation: "phase5-state",
        healthy: true,
        migrationHighWater: migration.liveVersion,
        schemaVersion: 1,
        sourceCommit: "a".repeat(40),
      })
    ).toBe(true)

    const command = recorder.commands.at(-1)
    expect(command?.arguments.at(-1)).toContain("mv -f")
    expect(command?.arguments.at(-1)).toContain("/baseline/current.json")
    expect(command?.arguments.at(-1)).not.toContain("password")
    expect(command?.input).toContain(`"migrationHighWater":"${migration.liveVersion}"`)
  })

  it("applies only exact confirmed content and records the live version separately", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceExecutorModule>(
      "oracle-baseline-maintenance-executor"
    )
    const commands: CommandInput[] = []
    let metadataRecorded = false
    const executor = source.createOracleBaselineMaintenanceExecutor(
      executorInput((input) => {
        commands.push(input)
        if (input.input?.includes("metadataStatus")) {
          return {
            exitCode: 0,
            stderr: "",
            stdout: JSON.stringify({
              metadataStatus: metadataRecorded ? "exact" : "missing",
            }),
            timedOut: false,
          }
        }
        if (input.input?.includes("INSERT INTO supabase_migrations.schema_migrations")) {
          metadataRecorded = true
        }
        if (input.input?.includes("has_schema_privilege('postgres', 'public', 'CREATE')")) {
          return { exitCode: 0, stderr: "", stdout: "false\n", timedOut: false }
        }
        return { exitCode: 0, stderr: "", stdout: "", timedOut: false }
      })
    )

    expect(executor.applyMigrations("qltbyt_test", [migration])).toBe(true)
    expect(
      executor.applyMigrations("qltbyt_test", [{ ...migration, sha256: "0".repeat(64) }])
    ).toBe(false)

    const stdin = commands.map((command) => command.input ?? "").join("\n")
    expect(stdin).toContain("SELECT 1;")
    expect(stdin).toContain(migration.liveVersion)
    expect(stdin).toContain(migration.liveName)
  })

  it("restores only into a fixed refresh database before an explicit swap", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceExecutorModule>(
      "oracle-baseline-maintenance-executor"
    )
    const recorder = commandRecorder()
    const executor = source.createOracleBaselineMaintenanceExecutor(executorInput(recorder.command))
    const refreshDatabase = "dq_baseline_refresh_phase5"
    const retiredDatabase = "dq_baseline_retired_phase5"

    expect(executor.createRefreshDatabase(refreshDatabase)).toBe(true)
    expect(
      executor.restoreDump(refreshDatabase, "/opt/supabase-test/backups/20260815T150001Z.dump")
    ).toBe(true)
    expect(executor.swapBaseline(refreshDatabase, retiredDatabase)).toBe(true)

    const commands = recorder.commands.map(
      (command) => `${command.arguments.at(-1) ?? ""}\n${command.input ?? ""}`
    )
    expect(commands.join("\n")).toContain("TEMPLATE template0")
    expect(commands.join("\n")).toContain("pg_restore --single-transaction --exit-on-error")
    expect(commands.join("\n")).toContain('ALTER DATABASE "qltbyt_test" RENAME TO')
    expect(commands.join("\n")).not.toContain("supabase db")
  })
})
