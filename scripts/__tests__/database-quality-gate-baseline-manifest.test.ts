import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type TechnicalConfigurationRoutine = {
  definitionSha256: string
  executeGrantees: string[]
  executionMode: "definer" | "invoker"
  identity: string
  owner: string
  searchPath: string | null
}

type BaselineManifest = {
  catalogSha256: string
  migrations: Array<{
    liveName: string
    liveVersion: string
    path: string
    sha256: string
  }>
  schemaVersion: 1
  sourceCommit: string
  targetMigrationHighWater: string
  technicalConfigurationCatalog: TechnicalConfigurationRoutine[]
}

type BaselineManifestModule = {
  parseBaselineManifest: (value: unknown) => BaselineManifest | undefined
  technicalConfigurationCatalogSha256: (catalog: TechnicalConfigurationRoutine[]) => string
}

const routineA: TechnicalConfigurationRoutine = {
  definitionSha256: "a".repeat(64),
  executeGrantees: ["service_role", "authenticated"],
  executionMode: "definer",
  identity: "public.technical_configuration_list(uuid)",
  owner: "postgres",
  searchPath: "public, pg_temp",
}

const routineB: TechnicalConfigurationRoutine = {
  definitionSha256: "b".repeat(64),
  executeGrantees: ["authenticated"],
  executionMode: "invoker",
  identity: "public.technical_configuration_detail(bigint)",
  owner: "postgres",
  searchPath: null,
}

const migration = {
  liveName: "confirmed_live_change",
  liveVersion: "20260819062043",
  path: "supabase/migrations/20260819062043_confirmed_live_change.sql",
  sha256: "c".repeat(64),
}

describe("database quality gate Oracle baseline manifest", () => {
  it("normalizes and hash-binds the exact target catalog", async () => {
    const source = await loadDatabaseQualityGateModule<BaselineManifestModule>("baseline-manifest")
    const catalogSha256 = source.technicalConfigurationCatalogSha256([routineA, routineB])

    const manifest = source.parseBaselineManifest({
      catalogSha256,
      migrations: [migration],
      schemaVersion: 1,
      sourceCommit: "d".repeat(40),
      targetMigrationHighWater: migration.liveVersion,
      technicalConfigurationCatalog: [routineA, routineB],
    })

    expect(manifest).toMatchObject({
      catalogSha256,
      migrations: [migration],
      targetMigrationHighWater: migration.liveVersion,
    })
    expect(manifest?.technicalConfigurationCatalog.map((routine) => routine.identity)).toEqual([
      routineB.identity,
      routineA.identity,
    ])
    expect(manifest?.technicalConfigurationCatalog[1]?.executeGrantees).toEqual([
      "authenticated",
      "service_role",
    ])
  })

  it("rejects a stale catalog hash or a contradictory target high-water", async () => {
    const source = await loadDatabaseQualityGateModule<BaselineManifestModule>("baseline-manifest")
    const manifest = {
      catalogSha256: "0".repeat(64),
      migrations: [migration],
      schemaVersion: 1,
      sourceCommit: "d".repeat(40),
      targetMigrationHighWater: migration.liveVersion,
      technicalConfigurationCatalog: [routineA],
    }

    expect(source.parseBaselineManifest(manifest)).toBeUndefined()
    expect(
      source.parseBaselineManifest({
        ...manifest,
        catalogSha256: source.technicalConfigurationCatalogSha256([routineA]),
        targetMigrationHighWater: "20260819062044",
      })
    ).toBeUndefined()
  })
})
