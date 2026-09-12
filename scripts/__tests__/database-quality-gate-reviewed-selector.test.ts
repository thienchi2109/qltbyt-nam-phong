import { writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { runDatabaseQualityGateCommand } from "../db-quality-gate/cli"
import { parseGateReport } from "../db-quality-gate/pre-live-report"
import {
  cleanupFixtureRepositories,
  fixtureJson,
  sha256,
} from "./database-quality-gate-test-support"
import {
  commitWorkingTree,
  fixtureWithStaticMetadata,
  migration,
  repositoryHead,
} from "./database-quality-gate-static-test-support"

afterEach(cleanupFixtureRepositories)

function selectorFor(repositoryRoot: string, migrationPath: string, content: string) {
  return {
    subjectCommit: repositoryHead(repositoryRoot),
    migrations: [{ path: migrationPath, sha256: sha256(content) }],
  }
}

describe("database quality gate reviewed migration selector", () => {
  it("keeps ordinary static unchanged and supports zero-diff landed review evidence", () => {
    const candidate = migration("-- migration\nBEGIN;\nDROP TABLE public.historical;\nCOMMIT;\n")
    const repository = fixtureWithStaticMetadata(candidate)
    const subjectCommit = repositoryHead(repository.root)
    const ordinary = runDatabaseQualityGateCommand(
      ["--lane", "static", "--run-id", "ordinary-static", "--subject-commit", subjectCommit],
      { repositoryRoot: repository.root }
    )
    expect(ordinary.exitCode).toBe(0)
    expect(JSON.parse(ordinary.stdout)).toMatchObject({ outcome: "PASS" })

    const selectorPath = repository.path(".git", "reviewed-selector.json")
    for (const [runId, content] of [
      ["missing-reviewed-selector", undefined],
      ["malformed-reviewed-selector", "{malformed"],
    ] as const) {
      if (content !== undefined) writeFileSync(selectorPath, content)
      const invalid = runDatabaseQualityGateCommand(
        [
          "--lane",
          "static",
          "--run-id",
          runId,
          "--subject-commit",
          subjectCommit,
          "--reviewed-migration-selector",
          content === undefined ? repository.path(".git", "missing-selector.json") : selectorPath,
        ],
        { repositoryRoot: repository.root }
      )
      expect(invalid.exitCode).toBe(2)
      expect(JSON.parse(invalid.stdout)).toMatchObject({ outcome: "INCOMPLETE" })
    }

    writeFileSync(
      selectorPath,
      fixtureJson(selectorFor(repository.root, candidate.path, candidate.sql))
    )
    const reviewed = runDatabaseQualityGateCommand(
      [
        "--lane",
        "static",
        "--run-id",
        "reviewed-static",
        "--subject-commit",
        subjectCommit,
        "--reviewed-migration-selector",
        selectorPath,
      ],
      { repositoryRoot: repository.root }
    )
    const reviewedReport = JSON.parse(reviewed.stdout) as {
      findings: Array<{ evidence?: Record<string, unknown> }>
      reviewedMigrationIdentities?: Array<{ path: string; sha256: string }>
    }
    expect(reviewed.exitCode).toBe(1)
    expect(reviewedReport.reviewedMigrationIdentities).toEqual([
      { path: candidate.path, sha256: sha256(candidate.sql) },
    ])
    expect(parseGateReport(JSON.parse(reviewed.stdout))).toMatchObject({
      reviewedMigrationIdentities: reviewedReport.reviewedMigrationIdentities,
    })
    expect(reviewedReport.findings).toContainEqual(
      expect.objectContaining({ evidence: expect.objectContaining({ migration: candidate.path }) })
    )

    writeFileSync(repository.path("README.md"), "documentation-only landed commit\n")
    const landedCommit = commitWorkingTree(repository.root, "commit documentation only")
    writeFileSync(
      selectorPath,
      fixtureJson({
        ...selectorFor(repository.root, candidate.path, candidate.sql),
        subjectCommit: landedCommit,
      })
    )
    const landed = runDatabaseQualityGateCommand(
      [
        "--landed-parent-commit",
        subjectCommit,
        "--lane",
        "static",
        "--run-id",
        "reviewed-landed-static",
        "--subject-commit",
        landedCommit,
        "--reviewed-migration-selector",
        selectorPath,
      ],
      { repositoryRoot: repository.root }
    )
    expect(landed.exitCode, landed.stdout).toBe(1)
    expect(JSON.parse(landed.stdout)).toMatchObject({
      outcome: "FAILED",
      reviewedMigrationIdentities: [{ path: candidate.path, sha256: sha256(candidate.sql) }],
    })
  })

  it("adds reviewed migrations without replacing normal changed migration checks", () => {
    const reviewedMigration = migration(
      "-- migration\nBEGIN;\nDROP TABLE public.reviewed_history;\nCOMMIT;\n"
    )
    const repository = fixtureWithStaticMetadata(reviewedMigration)
    const landedParentCommit = repositoryHead(repository.root)
    const changedMigration = migration(
      "-- migration\nBEGIN;\nDROP TABLE public.changed_now;\nCOMMIT;\n",
      "supabase/migrations/20270101000001_changed.sql"
    )
    writeFileSync(repository.path(changedMigration.path), changedMigration.sql)
    const subjectCommit = commitWorkingTree(repository.root, "commit current migration")
    const selectorPath = repository.path(".git", "reviewed-selector.json")
    writeFileSync(
      selectorPath,
      fixtureJson(selectorFor(repository.root, reviewedMigration.path, reviewedMigration.sql))
    )

    const execution = runDatabaseQualityGateCommand(
      [
        "--landed-parent-commit",
        landedParentCommit,
        "--lane",
        "static",
        "--run-id",
        "changed-plus-reviewed",
        "--subject-commit",
        subjectCommit,
        "--reviewed-migration-selector",
        selectorPath,
      ],
      { repositoryRoot: repository.root }
    )
    const report = JSON.parse(execution.stdout) as {
      findings: Array<{ evidence?: { migration?: string } }>
    }
    const inspectedMigrations = report.findings.flatMap((finding) =>
      finding.evidence?.migration === undefined ? [] : [finding.evidence.migration]
    )

    expect(inspectedMigrations).toContain(reviewedMigration.path)
    expect(inspectedMigrations).toContain(changedMigration.path)
  })

  it("rejects the static-only selector option for dynamic lanes", () => {
    const result = runDatabaseQualityGateCommand([
      "--lane",
      "baseline-forward",
      "--reviewed-migration-selector",
      "selector.json",
      "--run-id",
      "invalid-dynamic-selector",
    ])

    expect(result.exitCode).toBe(2)
    expect(JSON.parse(result.stdout)).toMatchObject({ outcome: "INCOMPLETE" })
  })
})
