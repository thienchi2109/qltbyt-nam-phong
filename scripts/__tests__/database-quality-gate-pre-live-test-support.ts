import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"

import { baselineStateHash } from "../db-quality-gate/baseline-state"
import { finalizeReport } from "../db-quality-gate/contract"
import type { OracleExecutorResult } from "../db-quality-gate/dynamic-lane-types"
import { ORACLE_REPORT_ARTIFACT } from "../db-quality-gate/oracle-evidence-store"
import type { OracleEvidenceStore } from "../db-quality-gate/oracle-evidence-store"
import type { PreLiveEvidenceDependencies, PreLiveEvidenceInput } from "../db-quality-gate/pre-live"
import type { AppliedMigrationLock } from "../db-quality-gate/registries"
import { stableJsonStringify } from "../db-quality-gate/serialization"
import type { BaselineState } from "../db-quality-gate/baseline-state"
import type { GateReport, MigrationIdentity } from "../db-quality-gate/types"
import {
  createFixtureRepository,
  type FixtureRepository,
} from "./database-quality-gate-test-support"
import { commitWorkingTree } from "./database-quality-gate-static-test-support"

export const CREATED_AT = "2026-08-23T07:30:00Z"
export const PRE_LIVE_RUN_ID = "phase-6a-pre-live"
export const STATIC_RUN_ID = "phase-6a-static"
export const BASELINE_RUN_ID = "phase-5-baseline-forward"

const MIGRATION_IDENTITIES: MigrationIdentity[] = [
  {
    path: "supabase/migrations/20260819062043_candidate.sql",
    sha256: "a".repeat(64),
  },
]

const PUBLISHED_BASELINE_STATE: BaselineState = {
  checkedAt: CREATED_AT,
  confirmedMigrations: [
    {
      liveName: "candidate",
      liveVersion: "20260819062043",
      path: MIGRATION_IDENTITIES[0].path,
      sha256: MIGRATION_IDENTITIES[0].sha256,
    },
  ],
  generation: "phase5-baseline",
  healthy: true,
  migrationHighWater: "20260819062043",
  schemaVersion: 1,
  sourceCommit: "a".repeat(40),
}

const SHARED_INPUT_HASHES = {
  invariants: "invariants-hash",
  migration: "migration-hash",
  sqlTests: "sql-tests-hash",
}

const PUBLISHED_APPLIED_LOCK: AppliedMigrationLock = {
  applied: [
    {
      liveName: "candidate",
      liveVersion: "20260819062043",
      path: MIGRATION_IDENTITIES[0].path,
      readBackDigest: "d".repeat(64),
      readBackEvidenceId: "oracle:phase-6-read-back/read-back.json",
      sha256: MIGRATION_IDENTITIES[0].sha256,
    },
  ],
  cutover: {
    commit: "b".repeat(40),
    legacyInventorySha256: "c".repeat(64),
    migrationRoot: "supabase/migrations",
  },
  legacy: [],
  schemaVersion: 1,
}

const LIVE_OBSERVATION = {
  capturedAt: "2026-08-23T07:29:00.000Z",
  migrations: [{ name: "candidate", version: "20260819062043" }],
  projectRef: "cdthersvldpnlbvpufrr",
  schemaVersion: 1,
  source: "supabase-mcp",
}

type ArtifactInput = {
  artifactName: string
  runId: string
}

type PersistArtifactInput = ArtifactInput & {
  content: string
}

export class FakeEvidenceStore implements OracleEvidenceStore {
  readonly artifacts = new Map<string, string>()
  readonly operations: string[] = []
  readonly readFailures = new Set<string>()
  baselineStateContent = `${stableJsonStringify(PUBLISHED_BASELINE_STATE)}\n`
  persistFailure = false

  readBaselineState(): OracleExecutorResult<string> {
    this.operations.push("read:baseline-state")
    return { status: "ok", value: this.baselineStateContent }
  }

  readArtifact(input: ArtifactInput): OracleExecutorResult<string> {
    this.operations.push(`read:${input.runId}/${input.artifactName}`)
    const key = this.key(input)
    if (this.readFailures.has(key)) {
      return {
        error: "Oracle evidence is unreadable",
        kind: "unavailable",
        status: "error",
      }
    }
    const value = this.artifacts.get(key)
    return value === undefined
      ? {
          error: "Unknown immutable Oracle run ID",
          kind: "unavailable",
          status: "error",
        }
      : { status: "ok", value }
  }

  persistArtifact(input: PersistArtifactInput): OracleExecutorResult<{ evidenceId: string }> {
    this.operations.push(`persist:${input.runId}/${input.artifactName}`)
    if (this.persistFailure) {
      return {
        error: "Oracle evidence persistence failed",
        kind: "unavailable",
        status: "error",
      }
    }
    const key = this.key(input)
    if (this.artifacts.has(key)) {
      return {
        error: "Immutable Oracle evidence already exists",
        kind: "unavailable",
        status: "error",
      }
    }
    this.artifacts.set(key, input.content)
    return { status: "ok", value: { evidenceId: `oracle:${key}` } }
  }

  private key(input: ArtifactInput): string {
    return `${input.runId}/${input.artifactName}`
  }
}

export function git(repositoryRoot: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim()
}

export function createLandedRepository(): {
  headCommit: string
  parentCommit: string
  repository: FixtureRepository
} {
  const repository = createFixtureRepository({ "README.md": "parent\n" })
  git(repository.root, "init", "--quiet")
  git(repository.root, "config", "user.email", "gate@example.test")
  git(repository.root, "config", "user.name", "Database Quality Gate")
  const parentCommit = commitWorkingTree(repository.root, "parent")
  writeFileSync(repository.path("candidate.txt"), "landed\n")
  const headCommit = commitWorkingTree(repository.root, "landed squash commit")
  git(repository.root, "branch", "-M", "main")
  const origin = createFixtureRepository({})
  git(origin.root, "init", "--quiet", "--bare")
  git(repository.root, "remote", "add", "origin", origin.root)
  git(repository.root, "push", "--quiet", "--set-upstream", "origin", "main")

  return { headCommit, parentCommit, repository }
}

export function gateReport(
  lane: GateReport["lane"],
  subjectCommit: string,
  overrides: Partial<GateReport> = {}
): GateReport {
  return finalizeReport({
    baselineMigrationHighWater: "20260819062043",
    createdAt: CREATED_AT,
    digest: "",
    evidenceAvailable: true,
    executorEnvironment: { oracle: "fixture" },
    findings: [],
    inputHashes:
      lane === "baseline-forward"
        ? {
            baselineState: baselineStateHash(PUBLISHED_BASELINE_STATE),
            ...SHARED_INPUT_HASHES,
          }
        : SHARED_INPUT_HASHES,
    lane,
    migrationIdentities: MIGRATION_IDENTITIES,
    outcome: "PASS",
    requiredChecksComplete: true,
    runId: lane === "static" ? STATIC_RUN_ID : BASELINE_RUN_ID,
    schemaVersion: 1,
    subjectCommit,
    ...overrides,
  })
}

export function dependencies(
  store: FakeEvidenceStore,
  headCommit: string,
  overrides: Partial<PreLiveEvidenceDependencies> = {}
): PreLiveEvidenceDependencies {
  return {
    clock: () => CREATED_AT,
    evidenceStore: store,
    evaluateReconciliation:
      overrides.evaluateReconciliation ??
      ((input) =>
        gateReport("reconciliation", input.subjectCommit, {
          runId: `${input.runId}-fixture`,
        })),
    readAppliedMigrationLock: overrides.readAppliedMigrationLock ?? (() => PUBLISHED_APPLIED_LOCK),
    readLiveObservation: overrides.readLiveObservation ?? (() => LIVE_OBSERVATION),
    recomputeBaselineForwardInputHashes:
      overrides.recomputeBaselineForwardInputHashes ?? (() => SHARED_INPUT_HASHES),
    refreshOriginMain: overrides.refreshOriginMain ?? (() => headCommit),
    runStatic: overrides.runStatic ?? ((input) => gateReport("static", input.subjectCommit)),
    verifyProtectedMain:
      overrides.verifyProtectedMain ??
      (() => ({ status: "active" as const, subjectCommit: headCommit })),
  }
}

export function preLiveInput(headCommit: string): PreLiveEvidenceInput {
  return {
    baselineForwardDigest: "",
    baselineForwardRunId: BASELINE_RUN_ID,
    liveObservationPath: "fixture-live-observation.json",
    repositoryRoot: "",
    runId: PRE_LIVE_RUN_ID,
    staticRunId: STATIC_RUN_ID,
    subjectCommit: headCommit,
  }
}

export function storeBaselineReport(store: FakeEvidenceStore, report: GateReport) {
  store.artifacts.set(`${report.runId}/${ORACLE_REPORT_ARTIFACT}`, `${JSON.stringify(report)}\n`)
}
