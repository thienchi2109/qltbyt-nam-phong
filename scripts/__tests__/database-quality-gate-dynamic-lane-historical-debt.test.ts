import { describe, expect, it } from "vitest"

import {
  createDynamicFixture,
  DynamicLaneModule,
  FakeOracleDynamicExecutor,
} from "./database-quality-gate-dynamic-test-support"
import { defaultExpectedStateCatalogAccess } from "./database-quality-gate-expected-state-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

const historicalTable = {
  grants: [],
  identity: "public.historical_table_without_intent",
  owner: "postgres",
  policies: [],
  rls: {
    enabled: true,
    forced: false,
  },
}

function accessWithHistoricalTable() {
  const access = defaultExpectedStateCatalogAccess()
  return {
    ...access,
    tables: [...access.tables, historicalTable],
  }
}

function runLane(source: DynamicLaneModule, executor: FakeOracleDynamicExecutor) {
  const fixture = createDynamicFixture()
  return source.runOracleDynamicLane({
    createdAt: "2026-09-04T16:05:00Z",
    executor,
    lane: "baseline-forward",
    repositoryRoot: fixture.repository.root,
    runId: "historical-table-intent",
    subjectCommit: fixture.subjectCommit,
  })
}

describe("database quality gate historical catalog debt", () => {
  it("warns for unchanged missing table intent while blocking a new omission", async () => {
    const source = await loadDatabaseQualityGateModule<DynamicLaneModule>("dynamic-lane")
    const historicalExecutor = new FakeOracleDynamicExecutor()
    historicalExecutor.baselineCatalogs.access = accessWithHistoricalTable()
    historicalExecutor.catalogs.access = accessWithHistoricalTable()

    const historical = runLane(source, historicalExecutor)

    expect(historical.outcome).toBe("PASS")
    expect(historical.findings).toContainEqual(
      expect.objectContaining({
        classification: "WARNING",
        ruleId: "catalog.table-intent.missing",
      })
    )
    expect(historicalExecutor.runSqlTestPaths).toEqual(["supabase/tests/example.sql"])

    const regressedExecutor = new FakeOracleDynamicExecutor()
    regressedExecutor.catalogs.access = accessWithHistoricalTable()

    const regressed = runLane(source, regressedExecutor)

    expect(regressed.outcome).toBe("INCOMPLETE")
    expect(regressed.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "catalog.table-intent.missing",
      })
    )
    expect(regressedExecutor.runSqlTestPaths).toEqual([])
  })
})
