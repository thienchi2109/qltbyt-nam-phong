import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"

import {
  canonicalTerminalNewline,
  createFixtureRepository,
  fixtureJson,
  sha256,
} from "./database-quality-gate-test-support"

export type Finding = {
  approval?: {
    acceptedForAggregate: boolean
    id: string
  }
  classification: "BLOCKING" | "DANGEROUS" | "WARNING"
  evidence?: Record<string, unknown>
  fingerprint: string
  ruleId: string
}

export type CandidateEvidence = {
  candidateCommit: string
  findingFingerprint: string
  migrationSha256: string
  reportDigest: string
}

export type StaticLaneModule = {
  runStaticLane: (input: {
    baseRef?: string
    changedFiles?: string[]
    createdAt: string
    repositoryRoot: string
    runId: string
    subjectCommit: string
  }) => {
    findings: Finding[]
    outcome: "FAILED" | "INCOMPLETE" | "PASS"
  }
}

export const SUBJECT_COMMIT = "a".repeat(40)
export const BASELINE_PATH = "supabase/db-quality-gate-baseline.json"
export const INVARIANTS_PATH = "supabase/db-quality-gate-invariants.json"
export const SQL_TESTS_PATH = "supabase/db-quality-gate-tests.json"
export const WAIVERS_PATH = "supabase/db-quality-gate-waivers.json"

export function appliedLock(
  cutoverCommit = SUBJECT_COMMIT,
  legacy: Array<{ path: string; sha256: string }> = []
) {
  return {
    applied: [],
    cutover: {
      commit: cutoverCommit,
      legacyInventorySha256: sha256(JSON.stringify(legacy)),
      migrationRoot: "supabase/migrations",
    },
    legacy,
    schemaVersion: 1,
  }
}

export function migration(sql: string, path = "supabase/migrations/20270101000000_candidate.sql") {
  return {
    path,
    sql,
  }
}

export function identityBaseline(sourceCommit = SUBJECT_COMMIT) {
  return {
    evidence: "Fixture identity baseline reviewed during Phase 2.",
    findings: [],
    schemaVersion: 1,
    sourceCommit,
  }
}

export function invariantRegistry() {
  return {
    invariants: [
      {
        classification: "rpc-only",
        evidence: ["Wayfinder #935"],
        expected: {
          allowedDirectAccess: [],
          boundary: "guarded-rpc",
          policyIdentities: [],
          rls: {
            enabled: true,
            forced: false,
          },
        },
        id: "public.nhan_vien.access",
        objectIdentity: "public.nhan_vien",
        owner: "postgres",
        rule: "table-access-contract",
        scope: "table-security",
        status: "active",
      },
    ],
    schemaVersion: 1,
  }
}

export function sqlTestRegistry() {
  return {
    schemaVersion: 1,
    tests: [
      {
        evidence: ["Wayfinder #935"],
        fixtureContract: "isolated-fixture",
        path: "supabase/tests/example.sql",
        purpose: "smoke",
        runnerRequirements: ["psql"],
        safety: "default-safe",
        timeoutSeconds: 30,
        transactionContract: "rollback-required",
      },
    ],
  }
}

export function fixtureWithStaticMetadata(...migrations: Array<{ path: string; sql: string }>) {
  const repository = createFixtureRepository({
    [BASELINE_PATH]: fixtureJson(identityBaseline()),
    [INVARIANTS_PATH]: fixtureJson(invariantRegistry()),
    [SQL_TESTS_PATH]: fixtureJson(sqlTestRegistry()),
    [WAIVERS_PATH]: fixtureJson({ approvals: [], schemaVersion: 1 }),
    "supabase/tests/example.sql": "BEGIN;\nSELECT 1;\nROLLBACK;\n",
    "scripts/changed-files.js": "module.exports = { collectChangedFiles: () => ['tracked'] }\n",
    "scripts/db-quality-gate/static-lane.ts": "export const fixtureStaticHarness = true\n",
    ...Object.fromEntries(migrations.map((entry) => [entry.path, entry.sql])),
  })
  const cutoverCommit = commitFixtureRepository(repository.root)
  const legacy = migrations.map((entry) => ({
    path: entry.path,
    sha256: sha256(canonicalTerminalNewline(entry.sql)),
  }))
  writeFileSync(
    repository.path("supabase", "applied-migrations.lock.json"),
    fixtureJson(appliedLock(cutoverCommit, legacy))
  )
  writeFileSync(repository.path(BASELINE_PATH), fixtureJson(identityBaseline(cutoverCommit)))
  commitWorkingTree(repository.root, "commit static gate metadata")
  execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], {
    cwd: repository.root,
  })

  return repository
}

export function commitFixtureRepository(repositoryRoot: string): string {
  execFileSync("git", ["init", "--quiet"], { cwd: repositoryRoot })
  execFileSync("git", ["config", "user.email", "gate@example.test"], { cwd: repositoryRoot })
  execFileSync("git", ["config", "user.name", "Database Quality Gate"], { cwd: repositoryRoot })

  return commitWorkingTree(repositoryRoot, "fixture baseline")
}

export function commitWorkingTree(repositoryRoot: string, message: string): string {
  execFileSync("git", ["add", "--all"], { cwd: repositoryRoot })
  execFileSync("git", ["commit", "--quiet", "-m", message], { cwd: repositoryRoot })

  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim()
}

export function repositoryHead(repositoryRoot: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return SUBJECT_COMMIT
  }
}

export function runStatic(
  source: StaticLaneModule,
  repositoryRoot: string,
  changedFiles: string[],
  baseRef?: string,
  subjectCommit = repositoryHead(repositoryRoot)
) {
  return source.runStaticLane({
    baseRef,
    changedFiles,
    createdAt: "2026-08-16T15:00:00Z",
    repositoryRoot,
    runId: "phase-2-static",
    subjectCommit,
  })
}

export function dangerousApproval(overrides: Record<string, string> = {}) {
  return {
    approvedAt: "2026-08-16T15:00:00Z",
    approver: "database maintainer",
    approvalUrl: "https://github.com/thienchi2109/qltbyt-nam-phong/pull/940#pullrequestreview-1",
    candidateCommit: "b".repeat(40),
    candidateReportDigest: "c".repeat(64),
    classification: "DANGEROUS",
    compensatingControls: "Validate the exact statement in the disposable gate run.",
    findingFingerprint: "d".repeat(64),
    id: "approval-dangerous-drop",
    migrationPath: "supabase/migrations/20270101000000_candidate.sql",
    migrationSha256: "e".repeat(64),
    objectScope: "public.deprecated_table",
    rationale: "The table retirement was reviewed.",
    recoveryPlan: "Restore from the prior backup if needed.",
    rejectedAlternatives: "Keeping the table would preserve unused schema debt.",
    reviewEvidence: "Maintainer review on PR #940.",
    riskAndImpact: "The statement is destructive and requires explicit review.",
    ruleId: "migration.dangerous-statement",
    statementScope: "DROP TABLE public.deprecated_table",
    status: "active",
    validation: "Confirm the replacement schema exists after the gate run.",
    ...overrides,
  }
}

export function replaceWaivers(repositoryRoot: string, waivers: unknown): void {
  writeFileSync(`${repositoryRoot}/${WAIVERS_PATH}`, fixtureJson(waivers))
}
