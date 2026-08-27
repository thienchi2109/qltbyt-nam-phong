import { describe, expect, it } from "vitest"

import { executorInput } from "./database-quality-gate-oracle-test-support"
import type { CommandInput, CommandResult } from "./database-quality-gate-oracle-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

const migration = {
  content: "SELECT 1;\n",
  liveName: "confirmed_live_change",
  liveVersion: "20260819062043",
  path: "supabase/migrations/20260819062043_confirmed_live_change.sql",
  sha256: "17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a",
}

type MaintenanceExecutorModule = {
  createOracleBaselineMaintenanceExecutor: (input: {
    command: (input: CommandInput) => CommandResult
    config: ReturnType<typeof executorInput>["config"]
  }) => {
    applyMigration: (databaseName: string, input: typeof migration) => boolean
    cleanupMigrationRole: (databaseName: string) => boolean
    inspectMigrationMetadata: (
      databaseName: string,
      input: typeof migration
    ) => "conflict" | "exact" | "missing" | undefined
    preflightRoles: (databaseName: string) => boolean
    recordMigrationMetadata: (databaseName: string, input: typeof migration) => boolean
  }
}

function commandResult(stdout = "", exitCode = 0): CommandResult {
  return {
    exitCode,
    stderr: exitCode === 0 ? "" : "forced failure",
    stdout,
    timedOut: false,
  }
}

describe("database quality gate Oracle baseline role safety", () => {
  it("fails role preflight before GRANT when metadata privilege is missing", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceExecutorModule>(
      "oracle-baseline-maintenance-executor"
    )
    const commands: CommandInput[] = []
    const executor = source.createOracleBaselineMaintenanceExecutor(
      executorInput((input) => {
        commands.push(input)
        return commandResult(
          JSON.stringify({
            adminCanManageSchema: true,
            adminCanSetRole: true,
            adminCanWriteMetadata: false,
            postgresHasCreateOnPublic: false,
            postgresHasUsageOnPublic: true,
          })
        )
      })
    )

    expect(executor.preflightRoles("qltbyt_test")).toBe(false)
    expect(
      commands.some((command) =>
        command.input?.includes("GRANT CREATE ON SCHEMA public TO postgres")
      )
    ).toBe(false)
  })

  it("grants CREATE temporarily, applies as postgres, and revokes on success", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceExecutorModule>(
      "oracle-baseline-maintenance-executor"
    )
    const commands: CommandInput[] = []
    const executor = source.createOracleBaselineMaintenanceExecutor(
      executorInput((input) => {
        commands.push(input)
        if (input.input?.includes("postgresHasCreateOnPublic")) {
          return commandResult(
            JSON.stringify({
              adminCanManageSchema: true,
              adminCanSetRole: true,
              adminCanWriteMetadata: true,
              postgresHasCreateOnPublic: false,
              postgresHasUsageOnPublic: true,
            })
          )
        }
        if (input.input?.includes("has_schema_privilege('postgres', 'public', 'CREATE')")) {
          return commandResult("false\n")
        }
        return commandResult()
      })
    )

    expect(executor.preflightRoles("qltbyt_test")).toBe(true)
    expect(executor.applyMigration("qltbyt_test", migration)).toBe(true)

    const calls = commands.map((command) => ({
      input: command.input ?? "",
      remote: command.arguments.at(-1) ?? "",
    }))
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: expect.stringContaining("GRANT CREATE ON SCHEMA public TO postgres"),
          remote: expect.stringContaining("-U supabase_admin"),
        }),
        expect.objectContaining({
          input: migration.content,
          remote: expect.stringContaining("-U postgres"),
        }),
        expect.objectContaining({
          input: expect.stringContaining("REVOKE CREATE ON SCHEMA public FROM postgres"),
          remote: expect.stringContaining("-U supabase_admin"),
        }),
      ])
    )
  })

  it("revokes and verifies CREATE after migration SQL fails", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceExecutorModule>(
      "oracle-baseline-maintenance-executor"
    )
    const commands: CommandInput[] = []
    const executor = source.createOracleBaselineMaintenanceExecutor(
      executorInput((input) => {
        commands.push(input)
        if (input.input === migration.content) {
          return commandResult("", 1)
        }
        if (input.input?.includes("has_schema_privilege('postgres', 'public', 'CREATE')")) {
          return commandResult("false\n")
        }
        return commandResult()
      })
    )

    expect(executor.applyMigration("qltbyt_test", migration)).toBe(false)
    expect(
      commands.some((command) =>
        command.input?.includes("REVOKE CREATE ON SCHEMA public FROM postgres")
      )
    ).toBe(true)
    expect(
      commands.some((command) =>
        command.input?.includes("has_schema_privilege('postgres', 'public', 'CREATE')")
      )
    ).toBe(true)
  })

  it("revokes and verifies CREATE when the temporary GRANT fails", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceExecutorModule>(
      "oracle-baseline-maintenance-executor"
    )
    const commands: CommandInput[] = []
    const executor = source.createOracleBaselineMaintenanceExecutor(
      executorInput((input) => {
        commands.push(input)
        if (input.input?.includes("GRANT CREATE ON SCHEMA public TO postgres")) {
          return commandResult("", 1)
        }
        if (input.input?.includes("has_schema_privilege('postgres', 'public', 'CREATE')")) {
          return commandResult("false\n")
        }
        return commandResult()
      })
    )

    expect(executor.applyMigration("qltbyt_test", migration)).toBe(false)
    expect(commands.some((command) => command.input === migration.content)).toBe(false)
    expect(
      commands.some((command) =>
        command.input?.includes("REVOKE CREATE ON SCHEMA public FROM postgres")
      )
    ).toBe(true)
    expect(
      commands.some((command) =>
        command.input?.includes("has_schema_privilege('postgres', 'public', 'CREATE')")
      )
    ).toBe(true)
  })

  it("records metadata as supabase_admin and classifies exact hash-bound read-back", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceExecutorModule>(
      "oracle-baseline-maintenance-executor"
    )
    const commands: CommandInput[] = []
    const executor = source.createOracleBaselineMaintenanceExecutor(
      executorInput((input) => {
        commands.push(input)
        if (input.input?.includes("metadataStatus")) {
          return commandResult(JSON.stringify({ metadataStatus: "exact" }))
        }
        return commandResult()
      })
    )

    expect(executor.recordMigrationMetadata("qltbyt_test", migration)).toBe(true)
    expect(executor.inspectMigrationMetadata("qltbyt_test", migration)).toBe("exact")
    expect(
      commands.some(
        (command) =>
          command.arguments.at(-1)?.includes("-U supabase_admin") &&
          command.input?.includes("INSERT INTO supabase_migrations.schema_migrations") &&
          command.input.includes(migration.content)
      )
    ).toBe(true)
  })
})
