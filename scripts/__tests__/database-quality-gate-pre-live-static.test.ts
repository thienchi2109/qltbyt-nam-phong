import { mkdirSync, writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { reportDigest } from "../db-quality-gate/contract"
import { ORACLE_REPORT_ARTIFACT } from "../db-quality-gate/oracle-evidence-store"
import { runPreLiveEvidenceCheck } from "../db-quality-gate/pre-live"
import { runStaticLaneForLandedCommit } from "../db-quality-gate/landed-static-lane"
import type { GateReport } from "../db-quality-gate/types"
import {
  BASELINE_RUN_ID,
  CREATED_AT,
  createLandedRepository,
  dependencies,
  FakeEvidenceStore,
  gateReport,
  git,
  preLiveInput as input,
  STATIC_RUN_ID,
  storeBaselineReport,
} from "./database-quality-gate-pre-live-test-support"
import { cleanupFixtureRepositories } from "./database-quality-gate-test-support"
import {
  commitWorkingTree,
  fixtureWithStaticMetadata,
  repositoryHead,
} from "./database-quality-gate-static-test-support"

function expectIncomplete(result: GateReport) {
  expect(result.outcome).toBe("INCOMPLETE")
  expect(result.requiredChecksComplete).toBe(false)
}

afterEach(cleanupFixtureRepositories)

describe("database quality gate pre-live landed static evidence", () => {
  it("accepts exact landed evidence and persists finalized static before reading baseline-forward", () => {
    const { headCommit, parentCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const baselineReport = gateReport("baseline-forward", headCommit)
    const staticReport = gateReport("static", headCommit, { digest: "caller-supplied" })
    storeBaselineReport(store, baselineReport)
    let receivedParent: string | undefined
    const request = {
      ...input(headCommit),
      baselineForwardDigest: baselineReport.digest,
      repositoryRoot: repository.root,
    }

    const result = runPreLiveEvidenceCheck(
      request,
      dependencies(store, headCommit, {
        runStatic: (staticInput) => {
          receivedParent = staticInput.landedParentCommit
          return staticReport
        },
      })
    )

    expect(result.outcome).toBe("PASS")
    expect(receivedParent).toBe(parentCommit)
    expect(store.operations).toEqual([
      `persist:${STATIC_RUN_ID}/${ORACLE_REPORT_ARTIFACT}`,
      "read:baseline-state",
      `read:${BASELINE_RUN_ID}/${ORACLE_REPORT_ARTIFACT}`,
    ])
    const persisted = JSON.parse(
      store.artifacts.get(`${STATIC_RUN_ID}/${ORACLE_REPORT_ARTIFACT}`) ?? "{}"
    ) as GateReport
    expect(persisted.digest).toBe(reportDigest(persisted))
    expect(result.inputHashes).toMatchObject({
      baselineForwardReport: baselineReport.digest,
      staticReport: persisted.digest,
    })
  })

  it("runs static over the exact first-parent diff after origin/main equals HEAD", () => {
    const repository = fixtureWithStaticMetadata()
    const parentCommit = repositoryHead(repository.root)
    const migrationPath = "supabase/migrations/20260823073000_unsafe_search.sql"
    mkdirSync(repository.path("supabase", "migrations"), { recursive: true })
    writeFileSync(
      repository.path(migrationPath),
      "SELECT * FROM public.items WHERE name ILIKE p_search || '%';\n"
    )
    const headCommit = commitWorkingTree(repository.root, "land unsafe migration")
    git(repository.root, "update-ref", "refs/remotes/origin/main", headCommit)

    const result = runStaticLaneForLandedCommit({
      createdAt: CREATED_AT,
      landedParentCommit: parentCommit,
      repositoryRoot: repository.root,
      runId: STATIC_RUN_ID,
      subjectCommit: headCommit,
    })

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.ilike-sanitization",
      })
    )
  })

  it("rejects an arbitrary trusted static base that is not the landed first parent", () => {
    const { headCommit, repository } = createLandedRepository()

    const result = runStaticLaneForLandedCommit({
      createdAt: CREATED_AT,
      landedParentCommit: headCommit,
      repositoryRoot: repository.root,
      runId: STATIC_RUN_ID,
      subjectCommit: headCommit,
    })

    expectIncomplete(result)
  })

  it("rejects a landed static run whose exact first-parent diff has no gate inputs", () => {
    const repository = fixtureWithStaticMetadata({
      path: "supabase/migrations/20260823070000_existing.sql",
      sql: "-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n",
    })
    const parentCommit = repositoryHead(repository.root)
    writeFileSync(repository.path("README.md"), "documentation-only landed commit\n")
    const headCommit = commitWorkingTree(repository.root, "land documentation only")

    const result = runStaticLaneForLandedCommit({
      createdAt: CREATED_AT,
      landedParentCommit: parentCommit,
      repositoryRoot: repository.root,
      runId: STATIC_RUN_ID,
      subjectCommit: headCommit,
    })

    expectIncomplete(result)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.changed-file-discovery",
      })
    )
  })
})
