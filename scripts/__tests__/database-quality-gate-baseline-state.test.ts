import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type BaselineStateModule = {
  parseBaselineState: (value: unknown) =>
    | {
        confirmedMigrations: Array<{ liveVersion: string }>
        healthy: boolean
        migrationHighWater: string
      }
    | undefined
}

const confirmation = {
  liveName: "confirmed_live_change",
  liveVersion: "20260819062043",
  path: "supabase/migrations/20260819031200_confirmed_live_change.sql",
  sha256: "a".repeat(64),
}

function healthyState() {
  return {
    catalogSha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    checkedAt: "2026-08-19T11:00:00Z",
    confirmedMigrations: [confirmation],
    generation: "phase5-baseline",
    healthy: true,
    migrationHighWater: confirmation.liveVersion,
    schemaVersion: 2,
    sourceCommit: "b".repeat(40),
    technicalConfigurationCatalog: [],
  }
}

describe("database quality gate Phase 5 atomic baseline state", () => {
  it("accepts one healthy snapshot whose high-water matches its confirmations", async () => {
    const source = await loadDatabaseQualityGateModule<BaselineStateModule>("baseline-state")

    expect(source.parseBaselineState(healthyState())).toMatchObject({
      confirmedMigrations: [confirmation],
      healthy: true,
      migrationHighWater: confirmation.liveVersion,
    })
  })

  it("rejects healthy state with stale high-water or an active recovery marker", async () => {
    const source = await loadDatabaseQualityGateModule<BaselineStateModule>("baseline-state")

    expect(
      source.parseBaselineState({
        ...healthyState(),
        migrationHighWater: "20260816044031",
      })
    ).toBeUndefined()
    expect(
      source.parseBaselineState({
        ...healthyState(),
        recovery: {
          kind: "catch-up",
          migration: confirmation,
          phase: "prepared",
          runId: "interrupted",
          targetMigrationHighWater: confirmation.liveVersion,
        },
      })
    ).toBeUndefined()
  })

  it("accepts an unhealthy recovery snapshot but rejects unexplained unhealthy state", async () => {
    const source = await loadDatabaseQualityGateModule<BaselineStateModule>("baseline-state")
    const recovery = {
      kind: "full-refresh",
      migration: confirmation,
      phase: "prepared",
      runId: "phase5-refresh",
      targetMigrationHighWater: confirmation.liveVersion,
    }

    expect(
      source.parseBaselineState({
        ...healthyState(),
        healthy: false,
        recovery,
      })
    ).toMatchObject({ healthy: false, recovery })
    expect(
      source.parseBaselineState({
        ...healthyState(),
        confirmedMigrations: [],
        healthy: false,
        migrationHighWater: "unavailable",
      })
    ).toBeUndefined()
  })
})
