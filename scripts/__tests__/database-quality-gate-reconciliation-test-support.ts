import { mkdirSync, writeFileSync } from "node:fs"

import { baselineStateHash } from "../db-quality-gate/baseline-state"
import { finalizeReport } from "../db-quality-gate/contract"
import { migrationContentSha256 } from "../db-quality-gate/migration-source"
import { ORACLE_REPORT_ARTIFACT } from "../db-quality-gate/oracle-evidence-store"
import { ingestReadBackObservation } from "../db-quality-gate/read-back"
import { stableJsonStringify } from "../db-quality-gate/serialization"
import type { BaselineState } from "../db-quality-gate/baseline-state"
import type { AppliedMigrationLock } from "../db-quality-gate/registries"
import type { GateReport } from "../db-quality-gate/types"
import { FakeEvidenceStore, git } from "./database-quality-gate-pre-live-test-support"
import {
  CAPTURED_AT,
  RECEIVED_AT,
  observation,
} from "./database-quality-gate-read-back-test-support"
import { commitWorkingTree } from "./database-quality-gate-static-test-support"
import { createFixtureRepository, fixtureJson, sha256 } from "./database-quality-gate-test-support"

export const RECONCILIATION_RUN_ID = "phase-6-reconciliation"
export const BASELINE_FORWARD_RUN_ID = "phase-6-reconciliation-baseline"
export const READ_BACK_RUN_ID = "phase-6-reconciliation-read-back"
export const LIVE_VERSION = "20260823070000"
export const LIVE_NAME = "candidate"
export const MIGRATION_PATH = `supabase/migrations/${LIVE_VERSION}_${LIVE_NAME}.sql`
export const MIGRATION_SQL = "SELECT 1;\n"

type FixtureOptions = {
  baselineHealthy?: boolean
  includeLockEntry?: boolean
  legacyHighWater?: boolean
  readBackDigestOverride?: string
  readBackEvidenceIdOverride?: string
}

function baselineState(migrationSubjectCommit: string, healthy: boolean): BaselineState {
  if (healthy) {
    return {
      checkedAt: RECEIVED_AT,
      confirmedMigrations: [
        {
          liveName: LIVE_NAME,
          liveVersion: LIVE_VERSION,
          path: MIGRATION_PATH,
          sha256: migrationContentSha256(MIGRATION_SQL),
        },
      ],
      generation: "phase6-reconciliation",
      healthy: true,
      migrationHighWater: LIVE_VERSION,
      schemaVersion: 1,
      sourceCommit: migrationSubjectCommit,
    }
  }

  return {
    checkedAt: RECEIVED_AT,
    confirmedMigrations: [],
    generation: "phase6-reconciliation",
    healthy: false,
    migrationHighWater: "unavailable",
    recovery: {
      kind: "catch-up",
      runId: "phase6-reconciliation",
      targetMigrationHighWater: LIVE_VERSION,
    },
    schemaVersion: 1,
    sourceCommit: migrationSubjectCommit,
  }
}

export function createReconciliationFixture(options: FixtureOptions = {}) {
  const repository = createFixtureRepository({
    ".fixture": "database quality gate reconciliation fixture\n",
    ...(options.legacyHighWater ? { [MIGRATION_PATH]: MIGRATION_SQL } : {}),
  })
  git(repository.root, "init", "--quiet")
  git(repository.root, "config", "user.email", "db-quality-gate@example.test")
  git(repository.root, "config", "user.name", "Database Quality Gate")
  const cutoverCommit = commitWorkingTree(repository.root, "cutover source")

  if (!options.legacyHighWater) {
    mkdirSync(repository.path("supabase", "migrations"), { recursive: true })
    writeFileSync(repository.path(MIGRATION_PATH), MIGRATION_SQL)
  }
  const legacy = options.legacyHighWater
    ? [
        {
          path: MIGRATION_PATH,
          sha256: migrationContentSha256(MIGRATION_SQL),
        },
      ]
    : []
  const emptyLock: AppliedMigrationLock = {
    applied: [],
    cutover: {
      commit: cutoverCommit,
      legacyInventorySha256: sha256(stableJsonStringify(legacy)),
      migrationRoot: "supabase/migrations",
    },
    legacy,
    schemaVersion: 1,
  }
  writeFileSync(repository.path("supabase", "applied-migrations.lock.json"), fixtureJson(emptyLock))
  const migrationSubjectCommit = commitWorkingTree(repository.root, "land migration")

  const store = new FakeEvidenceStore()
  const readBack = ingestReadBackObservation(
    {
      observation: observation({
        capturedAt: CAPTURED_AT,
        liveName: LIVE_NAME,
        liveVersion: LIVE_VERSION,
        migrationPath: MIGRATION_PATH,
        statements: [MIGRATION_SQL],
      }),
      repositoryRoot: repository.root,
      runId: READ_BACK_RUN_ID,
      subjectCommit: migrationSubjectCommit,
    },
    {
      evidenceStore: store,
      now: () => new Date(RECEIVED_AT),
    }
  )
  if (readBack.status !== "verified") {
    throw new Error("Expected verified reconciliation read-back fixture")
  }

  if (options.includeLockEntry !== false && !options.legacyHighWater) {
    const appliedLock = {
      ...emptyLock,
      applied: [
        {
          liveName: LIVE_NAME,
          liveVersion: LIVE_VERSION,
          path: MIGRATION_PATH,
          readBackDigest: options.readBackDigestOverride ?? readBack.digest,
          readBackEvidenceId:
            options.readBackEvidenceIdOverride ?? `oracle:${READ_BACK_RUN_ID}/read-back.json`,
          sha256: migrationContentSha256(MIGRATION_SQL),
        },
      ],
    }
    writeFileSync(
      repository.path("supabase", "applied-migrations.lock.json"),
      fixtureJson(appliedLock)
    )
    commitWorkingTree(repository.root, "merge lock-only reconciliation")
  }

  git(repository.root, "branch", "-M", "main")
  const subjectCommit = git(repository.root, "rev-parse", "HEAD")
  git(repository.root, "update-ref", "refs/remotes/origin/main", subjectCommit)

  const state = baselineState(migrationSubjectCommit, options.baselineHealthy !== false)
  store.baselineStateContent = `${stableJsonStringify(state)}\n`
  const baselineReport: GateReport = finalizeReport({
    baselineMigrationHighWater: LIVE_VERSION,
    createdAt: RECEIVED_AT,
    digest: "",
    evidenceAvailable: true,
    executorEnvironment: { oracle: "fixture" },
    findings: [],
    inputHashes: { baselineState: baselineStateHash(state) },
    lane: "baseline-forward",
    migrationIdentities: [
      {
        path: MIGRATION_PATH,
        sha256: migrationContentSha256(MIGRATION_SQL),
      },
    ],
    outcome: "PASS",
    requiredChecksComplete: true,
    runId: BASELINE_FORWARD_RUN_ID,
    schemaVersion: 1,
    subjectCommit,
  })
  store.artifacts.set(
    `${BASELINE_FORWARD_RUN_ID}/${ORACLE_REPORT_ARTIFACT}`,
    `${stableJsonStringify(baselineReport)}\n`
  )

  return {
    baselineReport,
    migrationSubjectCommit,
    readBack,
    repository,
    state,
    store,
    subjectCommit,
  }
}

export function reconciliationInput(subjectCommit: string, baselineDigest: string) {
  return {
    baselineForwardDigest: baselineDigest,
    baselineForwardRunId: BASELINE_FORWARD_RUN_ID,
    repositoryRoot: "",
    runId: RECONCILIATION_RUN_ID,
    subjectCommit,
  }
}
