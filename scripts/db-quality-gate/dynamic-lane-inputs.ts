import path from "node:path"

import { addDynamicFinding } from "./dynamic-lane-report"
import { selectDefaultSafeSqlTests } from "./expected-state"
import { readFileAtCommit } from "./git-evidence"
import { inspectCanonicalMigrationSourceAtCommit } from "./migration-source"
import { parseAppliedMigrationLock } from "./registries"
import type { DynamicRunState } from "./dynamic-lane-report"
import type { OracleDynamicLaneInput } from "./dynamic-lane-types"
import type { MigrationIdentity } from "./types"

const INVARIANTS_PATH = "supabase/db-quality-gate-invariants.json"
const SQL_TESTS_PATH = "supabase/db-quality-gate-tests.json"
const APPLIED_LOCK_PATH = "supabase/applied-migrations.lock.json"

export type DynamicRepositoryInput = Pick<
  OracleDynamicLaneInput,
  "repositoryRoot" | "subjectCommit"
>

/** Immutable source artifacts selected from one resolved subject commit. */
export type DynamicInputArtifacts = {
  appliedMigrationIdentities: MigrationIdentity[]
  invariants: unknown
  migrationIdentities: MigrationIdentity[]
  sqlTestRegistry: unknown
  sqlTests: Array<{
    fixtureContract: "isolated-fixture"
    path: string
    runnerRequirements: string[]
    timeoutSeconds: number
    transactionContract: "rollback-required"
  }>
}

function committedRepositoryFile(
  input: DynamicRepositoryInput,
  relativePath: string,
  allowedPrefix: string
): string | undefined {
  if (
    !relativePath.startsWith(allowedPrefix) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath.split("/").includes("..")
  ) {
    return undefined
  }

  return readFileAtCommit(input.repositoryRoot, input.subjectCommit, relativePath)
}

function readCommittedJsonArtifact(
  input: DynamicRepositoryInput,
  relativePath: string
): unknown | undefined {
  const content = committedRepositoryFile(input, relativePath, "supabase/")
  if (content === undefined) {
    return undefined
  }

  try {
    return JSON.parse(content) as unknown
  } catch {
    return undefined
  }
}

function postCutoverMigrations(
  migrationIdentities: MigrationIdentity[],
  legacyPaths: Set<string>,
  state: DynamicRunState
): MigrationIdentity[] | undefined {
  const migrations = migrationIdentities.filter((identity) => !legacyPaths.has(identity.path))

  for (const migration of migrations) {
    if (!/^supabase\/migrations\/\d{14}_.+\.sql$/.test(migration.path)) {
      addDynamicFinding(state, "dynamic.baseline.post-cutover-version", migration.path, {
        path: migration.path,
      })
      state.incomplete = true
      return undefined
    }
  }

  return migrations
}

/** Loads validation registry inputs from Git objects without consulting the mutable worktree. */
export function readDynamicInputArtifacts(
  input: DynamicRepositoryInput,
  state: DynamicRunState
): DynamicInputArtifacts | undefined {
  const source = inspectCanonicalMigrationSourceAtCommit({
    commit: input.subjectCommit,
    repositoryRoot: input.repositoryRoot,
  })
  if (source.outcome !== "PASS") {
    for (const finding of source.findings) {
      addDynamicFinding(state, finding.ruleId, "supabase/migrations", {
        root: "supabase/migrations",
      })
    }
    state.incomplete = true
    return undefined
  }

  const appliedLock = parseAppliedMigrationLock(readCommittedJsonArtifact(input, APPLIED_LOCK_PATH))
  if (appliedLock === undefined) {
    addDynamicFinding(state, "dynamic.baseline.applied-lock", APPLIED_LOCK_PATH, {
      path: APPLIED_LOCK_PATH,
    })
    state.incomplete = true
    return undefined
  }

  const migrations = postCutoverMigrations(
    source.migrationIdentities,
    new Set(appliedLock.legacy.map((entry) => entry.path)),
    state
  )
  if (migrations === undefined) {
    return undefined
  }

  const sqlTests = readCommittedJsonArtifact(input, SQL_TESTS_PATH)
  const invariants = readCommittedJsonArtifact(input, INVARIANTS_PATH)
  if (sqlTests === undefined || invariants === undefined) {
    addDynamicFinding(state, "dynamic.registry.unavailable", "registries", {
      invariants: invariants === undefined ? "unavailable" : "available",
      sqlTests: sqlTests === undefined ? "unavailable" : "available",
    })
    state.incomplete = true
    return undefined
  }

  try {
    const selectedSqlTests = selectDefaultSafeSqlTests(sqlTests)
    if (
      selectedSqlTests.some(
        (test) =>
          test.fixtureContract !== "isolated-fixture" ||
          test.transactionContract !== "rollback-required" ||
          !test.runnerRequirements.includes("psql") ||
          test.runnerRequirements.includes("psql-meta-commands")
      )
    ) {
      addDynamicFinding(state, "dynamic.sql-tests.execution-contract", SQL_TESTS_PATH, {
        path: SQL_TESTS_PATH,
      })
      state.incomplete = true
      return undefined
    }

    return {
      appliedMigrationIdentities: appliedLock.applied,
      invariants,
      migrationIdentities: migrations,
      sqlTestRegistry: sqlTests,
      sqlTests: selectedSqlTests.map((test) => ({
        fixtureContract: test.fixtureContract as "isolated-fixture",
        path: test.path,
        runnerRequirements: test.runnerRequirements,
        timeoutSeconds: test.timeoutSeconds,
        transactionContract: test.transactionContract as "rollback-required",
      })),
    }
  } catch {
    addDynamicFinding(state, "dynamic.sql-tests.unavailable", SQL_TESTS_PATH, {
      path: SQL_TESTS_PATH,
    })
    state.incomplete = true
    return undefined
  }
}

/** Reads one registered SQL test body from the immutable subject commit. */
export function readCommittedSqlTest(
  input: DynamicRepositoryInput,
  relativePath: string
): string | undefined {
  return committedRepositoryFile(input, relativePath, "supabase/tests/")
}

/** Reads candidate migration contents from the immutable subject commit. */
export function readCommittedMigrationInputs(
  input: DynamicRepositoryInput,
  migrationIdentities: MigrationIdentity[],
  state: DynamicRunState
):
  | Array<
      MigrationIdentity & {
        content: string
      }
    >
  | undefined {
  const migrations: Array<
    MigrationIdentity & {
      content: string
    }
  > = []

  for (const identity of migrationIdentities) {
    const content = committedRepositoryFile(input, identity.path, "supabase/migrations/")
    if (content === undefined) {
      addDynamicFinding(state, "dynamic.migration.source", identity.path, {
        path: identity.path,
      })
      state.incomplete = true
      return undefined
    }
    migrations.push({
      ...identity,
      content,
    })
  }

  return migrations
}
