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

type BaselineStateModule = {
  baselineStateHash: (state: Record<string, unknown>) => string
  observationMatches: (
    observation: Record<string, unknown>,
    expected: {
      catalogSha256: string
      confirmedMigrations: Array<Record<string, string>>
      technicalConfigurationCatalog: TechnicalConfigurationRoutine[]
    }
  ) => boolean
  parseBaselineState: (value: unknown) => Record<string, unknown> | undefined
  parsePersistedBaselineState: (value: unknown) => Record<string, unknown> | undefined
  technicalConfigurationCatalogSha256: (catalog: TechnicalConfigurationRoutine[]) => string
}

const migration = {
  liveName: "confirmed_live_change",
  liveVersion: "20260819062043",
  path: "supabase/migrations/20260819062043_confirmed_live_change.sql",
  sha256: "c".repeat(64),
}

const routine: TechnicalConfigurationRoutine = {
  definitionSha256: "a".repeat(64),
  executeGrantees: ["authenticated"],
  executionMode: "definer",
  identity: "public.technical_configuration_list(uuid)",
  owner: "postgres",
  searchPath: "public, pg_temp",
}

function stateV1() {
  return {
    checkedAt: "2026-08-27T00:00:00Z",
    confirmedMigrations: [migration],
    generation: "phase5-baseline",
    healthy: true,
    migrationHighWater: migration.liveVersion,
    schemaVersion: 1,
    sourceCommit: "d".repeat(40),
  }
}

describe("database quality gate Oracle baseline state v2", () => {
  it("reads v1 only for maintenance upgrade and trusts healthy state v2", async () => {
    const source = await loadDatabaseQualityGateModule<BaselineStateModule>("baseline-state")
    const catalogSha256 = source.technicalConfigurationCatalogSha256([routine])
    const stateV2 = {
      ...stateV1(),
      catalogSha256,
      schemaVersion: 2,
      technicalConfigurationCatalog: [routine],
    }

    expect(source.parsePersistedBaselineState(stateV1())).toMatchObject({ schemaVersion: 1 })
    expect(source.parseBaselineState(stateV1())).toBeUndefined()
    expect(source.parseBaselineState(stateV2)).toMatchObject({
      catalogSha256,
      healthy: true,
      schemaVersion: 2,
    })
    expect(source.baselineStateHash(stateV2)).not.toBe(
      source.baselineStateHash({
        ...stateV2,
        technicalConfigurationCatalog: [{ ...routine, owner: "supabase_admin" }],
      })
    )
  })

  it("requires exact catalog parity even when migration high-water matches", async () => {
    const source = await loadDatabaseQualityGateModule<BaselineStateModule>("baseline-state")
    const catalogSha256 = source.technicalConfigurationCatalogSha256([routine])
    const expected = {
      catalogSha256,
      confirmedMigrations: [migration],
      technicalConfigurationCatalog: [routine],
    }
    const observation = {
      catalogSha256,
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
      technicalConfigurationCatalog: [routine],
      unvalidatedConstraintCount: 0,
    }

    expect(source.observationMatches(observation, expected)).toBe(true)
    expect(
      source.observationMatches(
        {
          ...observation,
          catalogSha256: source.technicalConfigurationCatalogSha256([]),
          technicalConfigurationCatalog: [],
        },
        expected
      )
    ).toBe(false)
    expect(
      source.observationMatches(
        {
          ...observation,
          catalogSha256: source.technicalConfigurationCatalogSha256([
            { ...routine, definitionSha256: "b".repeat(64) },
          ]),
          technicalConfigurationCatalog: [{ ...routine, definitionSha256: "b".repeat(64) }],
        },
        expected
      )
    ).toBe(false)
    for (const changedRoutine of [
      { ...routine, owner: "supabase_admin" },
      { ...routine, executeGrantees: ["service_role"] },
      { ...routine, executionMode: "invoker" as const },
      { ...routine, searchPath: "public" },
      {
        ...routine,
        identity: "public.technical_configuration_extra()",
      },
    ]) {
      expect(
        source.observationMatches(
          {
            ...observation,
            catalogSha256: source.technicalConfigurationCatalogSha256([changedRoutine]),
            technicalConfigurationCatalog: [changedRoutine],
          },
          expected
        )
      ).toBe(false)
    }
    const extraRoutine = {
      ...routine,
      identity: "public.technical_configuration_extra()",
    }
    expect(
      source.observationMatches(
        {
          ...observation,
          catalogSha256: source.technicalConfigurationCatalogSha256([routine, extraRoutine]),
          technicalConfigurationCatalog: [routine, extraRoutine],
        },
        expected
      )
    ).toBe(false)
  })
})
