import { afterEach, describe, expect, it } from "vitest"

import type { BaselineMaintenanceExecutor } from "../db-quality-gate/baseline-maintenance"
import type { BaselineState, ConfirmedLiveMigration } from "../db-quality-gate/baseline-state"
import {
  cleanupFixtureRepositories,
  createFixtureRepository,
  fixtureJson,
} from "./database-quality-gate-test-support"

type BaselineMaintenanceCliModule = {
  runBaselineMaintenanceCommand: (
    args: string[],
    repositoryRoot: string,
    dependencies?: {
      currentHeadCommit?: () => string | undefined
      executorFromEnvironment?: () => BaselineMaintenanceExecutor | undefined
    }
  ) => { exitCode: 0 | 2; stdout: string }
}

afterEach(cleanupFixtureRepositories)

describe("database quality gate baseline reconciliation CLI", () => {
  it("routes reconcile through the idempotent baseline selector without writing", async () => {
    const source =
      (await import("../db-quality-gate/baseline-maintenance-cli")) as BaselineMaintenanceCliModule
    const target: ConfirmedLiveMigration = {
      liveName: "candidate",
      liveVersion: "20260823070000",
      path: "supabase/migrations/20260823070000_candidate.sql",
      sha256: "2".repeat(64),
    }
    const state: BaselineState = {
      checkedAt: "2026-08-23T07:00:00.000Z",
      confirmedMigrations: [
        {
          liveName: "prior",
          liveVersion: "20260822070000",
          path: "supabase/migrations/20260822070000_prior.sql",
          sha256: "1".repeat(64),
        },
        target,
      ],
      generation: "current",
      healthy: true,
      migrationHighWater: target.liveVersion,
      schemaVersion: 1,
      sourceCommit: "a".repeat(40),
    }
    const operations: string[] = []
    const executor: BaselineMaintenanceExecutor = {
      acquireLock: () => operations.push("acquire") > 0,
      applyMigrations: () => operations.push("apply") > 0,
      createRefreshDatabase: () => operations.push("create") > 0,
      dropDatabase: () => operations.push("drop") > 0,
      inspectDatabase: () => undefined,
      publishState: () => operations.push("publish") > 0,
      readState: () => state,
      releaseLock: () => operations.push("release") > 0,
      restoreDump: () => operations.push("restore") > 0,
      swapBaseline: () => operations.push("swap") > 0,
    }
    const repository = createFixtureRepository({
      "confirmations.json": fixtureJson([target]),
    })

    const result = source.runBaselineMaintenanceCommand(
      [
        "--operation",
        "reconcile",
        "--run-id",
        "phase6-baseline-reconcile",
        "--checked-at",
        "2026-08-23T08:00:00.000Z",
        "--confirmations",
        repository.path("confirmations.json"),
        "--subject-commit",
        "b".repeat(40),
      ],
      repository.root,
      {
        currentHeadCommit: () => "b".repeat(40),
        executorFromEnvironment: () => executor,
      }
    )

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ outcome: "PASS", state })
    expect(operations).toEqual([])
  })
})
