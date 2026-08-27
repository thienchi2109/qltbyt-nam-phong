import { readFileSync, writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { baselineStateHash, type BaselineState } from "../db-quality-gate/baseline-state"
import { readDynamicInputArtifacts } from "../db-quality-gate/dynamic-lane-inputs"
import {
  createDynamicRunState,
  finalizeDynamicLaneReport,
} from "../db-quality-gate/dynamic-lane-report"
import { recomputeBaselineForwardInputHashes } from "../db-quality-gate/pre-live-inputs"
import { runPreLiveEvidenceCheck } from "../db-quality-gate/pre-live"
import { stableJsonStringify } from "../db-quality-gate/serialization"
import { runStaticLaneForLandedCommit } from "../db-quality-gate/landed-static-lane"
import type { MigrationIdentity } from "../db-quality-gate/types"
import {
  createDynamicFixture,
  FakeOracleDynamicExecutor,
} from "./database-quality-gate-dynamic-test-support"
import {
  BASELINE_RUN_ID,
  CREATED_AT,
  dependencies,
  FakeEvidenceStore,
  git,
  preLiveInput,
  storeBaselineReport,
} from "./database-quality-gate-pre-live-test-support"
import { cleanupFixtureRepositories } from "./database-quality-gate-test-support"
import { commitWorkingTree } from "./database-quality-gate-static-test-support"

const CANDIDATE_PATH = "supabase/migrations/20270201000000_candidate.sql"

function baselineStateForFixture(repositoryRoot: string, sourceCommit: string): BaselineState {
  const lock = JSON.parse(
    readFileSync(`${repositoryRoot}/supabase/applied-migrations.lock.json`, "utf8")
  ) as { legacy: MigrationIdentity[] }
  const identity = lock.legacy[0]
  const match = /^supabase\/migrations\/(\d{14})_(.+)\.sql$/u.exec(identity?.path ?? "")
  if (identity === undefined || match === null) {
    throw new Error("Dynamic fixture baseline migration identity is unavailable")
  }

  return {
    catalogSha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    checkedAt: CREATED_AT,
    confirmedMigrations: [
      {
        ...identity,
        liveName: match[2],
        liveVersion: match[1],
      },
    ],
    generation: "phase6a-input-reconciliation",
    healthy: true,
    migrationHighWater: match[1],
    schemaVersion: 2,
    sourceCommit,
    technicalConfigurationCatalog: [],
  }
}

afterEach(cleanupFixtureRepositories)

describe("database quality gate pre-live landed input reconciliation", () => {
  it("accepts real static and baseline-forward producers with lane-specific hash semantics", () => {
    const fixture = createDynamicFixture()
    writeFileSync(
      fixture.repository.path(...CANDIDATE_PATH.split("/")),
      [
        "-- migration",
        "BEGIN;",
        "CREATE TABLE public.candidate_only (id bigint PRIMARY KEY);",
        "REVOKE ALL ON TABLE public.candidate_only FROM anon, authenticated, public;",
        "COMMIT;",
        "",
      ].join("\n")
    )
    const subjectCommit = commitWorkingTree(
      fixture.repository.root,
      "land safe baseline-forward candidate"
    )
    const baselineState = baselineStateForFixture(fixture.repository.root, subjectCommit)
    const staticReport = runStaticLaneForLandedCommit({
      createdAt: CREATED_AT,
      landedParentCommit: git(fixture.repository.root, "rev-parse", "HEAD^"),
      repositoryRoot: fixture.repository.root,
      runId: "phase-6a-static",
      subjectCommit,
    })
    const executor = new FakeOracleDynamicExecutor()
    const dynamicInput = {
      createdAt: CREATED_AT,
      executor,
      lane: "baseline-forward" as const,
      repositoryRoot: fixture.repository.root,
      runId: BASELINE_RUN_ID,
      subjectCommit,
    }
    const dynamicState = createDynamicRunState()
    const artifacts = readDynamicInputArtifacts(dynamicInput, dynamicState)
    if (artifacts === undefined) {
      throw new Error("Dynamic fixture inputs must be readable")
    }
    dynamicState.baselineMigrationHighWater = baselineState.migrationHighWater
    dynamicState.catalogInputHashes.baselineState = baselineStateHash(baselineState)
    const baselineReport = finalizeDynamicLaneReport(
      dynamicInput,
      dynamicState,
      artifacts.migrationIdentities,
      true,
      {
        invariants: artifacts.invariants,
        sqlTests: artifacts.sqlTestRegistry,
      }
    )
    const store = new FakeEvidenceStore()
    store.baselineStateContent = `${stableJsonStringify(baselineState)}\n`
    storeBaselineReport(store, baselineReport)

    const result = runPreLiveEvidenceCheck(
      {
        ...preLiveInput(subjectCommit),
        baselineForwardDigest: baselineReport.digest,
        repositoryRoot: fixture.repository.root,
      },
      dependencies(store, subjectCommit, {
        readAppliedMigrationLock: () =>
          JSON.parse(
            readFileSync(
              fixture.repository.path("supabase", "applied-migrations.lock.json"),
              "utf8"
            )
          ) as ReturnType<NonNullable<ReturnType<typeof dependencies>["readAppliedMigrationLock"]>>,
        readLiveObservation: () => ({
          capturedAt: "2026-08-23T07:29:00.000Z",
          migrations: [
            {
              name: baselineState.confirmedMigrations[0].liveName,
              version: baselineState.migrationHighWater,
            },
          ],
          projectRef: "cdthersvldpnlbvpufrr",
          schemaVersion: 1,
          source: "supabase-mcp",
        }),
        recomputeBaselineForwardInputHashes,
        runStatic: () => staticReport,
      })
    )

    expect(baselineReport.outcome).toBe("PASS")
    expect(staticReport.outcome, JSON.stringify(staticReport, null, 2)).toBe("PASS")
    expect(result.outcome, JSON.stringify(result, null, 2)).toBe("PASS")
  })
})
