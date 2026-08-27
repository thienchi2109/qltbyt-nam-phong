import { describe, expect, it } from "vitest"

import { executorInput } from "./database-quality-gate-oracle-test-support"
import type { CommandInput, CommandResult } from "./database-quality-gate-oracle-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

const migration = {
  liveName: "already_in_baseline",
  liveVersion: "20270101000000",
  path: "supabase/migrations/20270101000000_already_in_baseline.sql",
  sha256: "a".repeat(64),
}

const routine = {
  definitionSha256: "b".repeat(64),
  executeGrantees: ["authenticated"],
  executionMode: "definer" as const,
  identity: "public.technical_configuration_list()",
  owner: "postgres",
  searchPath: "public, pg_temp",
}

type RemoteExecutorModule = {
  createOracleRemoteExecutor: (input: {
    command: (input: CommandInput) => CommandResult
    config: ReturnType<typeof executorInput>["config"]
  }) => {
    preflight: () => { status: "error" | "ok" }
  }
}

type CatalogModule = {
  technicalConfigurationCatalogSha256: (catalog: (typeof routine)[]) => string
}

function result(stdout: string): CommandResult {
  return { exitCode: 0, stderr: "", stdout, timedOut: false }
}

function commandFor(state: Record<string, unknown>, observation: Record<string, unknown>) {
  return (input: CommandInput): CommandResult => {
    const remote = input.arguments.at(-1) ?? ""
    const sql = input.input ?? ""
    if (remote.includes("docker inspect")) {
      return result("true\n")
    }
    if (remote.includes("df -Pk")) {
      return result(
        "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vda1 100 10 90 10% /\n"
      )
    }
    if (sql.includes("baseline_exists")) {
      return result("true\n")
    }
    if (remote.includes("/baseline/current.json")) {
      return result(`${JSON.stringify(state)}\n`)
    }
    if (sql.includes("technicalConfigurationCatalog")) {
      return result(`${JSON.stringify(observation)}\n`)
    }
    return result("")
  }
}

describe("database quality gate Oracle dynamic preflight state v2", () => {
  it("rejects legacy state v1 even when its high-water is healthy", async () => {
    const source =
      await loadDatabaseQualityGateModule<RemoteExecutorModule>("oracle-remote-executor")
    const stateV1 = {
      checkedAt: "2026-08-27T00:00:00Z",
      confirmedMigrations: [migration],
      generation: "legacy-baseline",
      healthy: true,
      migrationHighWater: migration.liveVersion,
      schemaVersion: 1,
      sourceCommit: "c".repeat(40),
    }
    const executor = source.createOracleRemoteExecutor(executorInput(commandFor(stateV1, {})))

    expect(executor.preflight().status).toBe("error")
  })

  it("rejects equal high-water when the re-queried catalog differs from state", async () => {
    const source =
      await loadDatabaseQualityGateModule<RemoteExecutorModule>("oracle-remote-executor")
    const catalogSource = await loadDatabaseQualityGateModule<CatalogModule>("baseline-manifest")
    const catalogSha256 = catalogSource.technicalConfigurationCatalogSha256([routine])
    const stateV2 = {
      catalogSha256,
      checkedAt: "2026-08-27T00:00:00Z",
      confirmedMigrations: [migration],
      generation: "catalog-bound-baseline",
      healthy: true,
      migrationHighWater: migration.liveVersion,
      schemaVersion: 2,
      sourceCommit: "c".repeat(40),
      technicalConfigurationCatalog: [routine],
    }
    const observation = {
      healthy: true,
      invalidIndexCount: 0,
      migrationHighWater: migration.liveVersion,
      migrationRecords: [
        {
          liveName: migration.liveName,
          liveVersion: migration.liveVersion,
          sqlSha256: migration.sha256,
        },
      ],
      postgresHasCreateOnPublic: false,
      technicalConfigurationCatalog: [],
      unvalidatedConstraintCount: 0,
    }
    const executor = source.createOracleRemoteExecutor(
      executorInput(commandFor(stateV2, observation))
    )

    expect(executor.preflight().status).toBe("error")
  })
})
