import { execFileSync } from "node:child_process"

import type { OracleEvidenceStore } from "../db-quality-gate/oracle-evidence-store"
import { commitWorkingTree } from "./database-quality-gate-static-test-support"
import { createFixtureRepository } from "./database-quality-gate-test-support"

export const CAPTURED_AT = "2026-08-23T07:29:00.000Z"
export const RECEIVED_AT = "2026-08-23T07:30:00.000Z"
export const LIVE_NAME = "candidate"
export const LIVE_VERSION = "20260823070000"
export const MIGRATION_PATH = `supabase/migrations/${LIVE_VERSION}_${LIVE_NAME}.sql`
export const READ_BACK_RUN_ID = "phase-6a-read-back"

export type ReadBackResult = {
  binding?: {
    liveName: string
    liveVersion: string
    migrationPath: string
    sha256: string
  }
  digest?: string
  evidenceId?: string
  outcome: "INCOMPLETE" | "PASS"
  reason?: string
  record?: Record<string, unknown>
  status: "reconciliation-required" | "verified"
}

export type ReadBackModule = {
  ingestReadBackObservation: (
    input: {
      observation: unknown
      repositoryRoot: string
      runId: string
      subjectCommit: string
    },
    dependencies: {
      evidenceStore: OracleEvidenceStore
      now: () => Date
    }
  ) => ReadBackResult
  loadReadBackRecord: (input: {
    evidenceStore: OracleEvidenceStore
    runId: string
  }) =>
    | { status: "ok"; value: Record<string, unknown> }
    | { error: string; kind: string; status: "error" }
}

export type ReadBackCliModule = {
  runReadBackCommand: (
    args: string[],
    dependencies?: {
      evidenceStore?: () => OracleEvidenceStore | undefined
      now?: () => Date
      repositoryRoot?: string
    }
  ) => {
    exitCode: 0 | 2
    stdout: string
  }
}

function git(repositoryRoot: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim()
}

export function createMigrationRepository(content: string, migrationPath = MIGRATION_PATH) {
  const repository = createFixtureRepository({ [migrationPath]: content })
  git(repository.root, "init", "--quiet")
  git(repository.root, "config", "user.email", "gate@example.test")
  git(repository.root, "config", "user.name", "Database Quality Gate")
  const subjectCommit = commitWorkingTree(repository.root, "review migration")

  return { repository, subjectCommit }
}

export function observation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    capturedAt: CAPTURED_AT,
    liveName: LIVE_NAME,
    liveVersion: LIVE_VERSION,
    migrationPath: MIGRATION_PATH,
    projectRef: "cdthersvldpnlbvpufrr",
    schemaVersion: 1,
    source: "supabase-mcp",
    statements: ["SELECT 1;", "SELECT 2;\n"],
    ...overrides,
  }
}
