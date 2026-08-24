import { existsSync, mkdirSync, writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { runDatabaseQualityGateCommand } from "../db-quality-gate/cli"
import { candidateStaticEvidencePath } from "../db-quality-gate/static-candidate-evidence"
import { runStaticLane } from "../db-quality-gate/static-lane"
import type { GateReport } from "../db-quality-gate/types"
import {
  canonicalTerminalNewline,
  cleanupFixtureRepositories,
  fixtureJson,
  sha256,
} from "./database-quality-gate-test-support"
import {
  commitWorkingTree,
  dangerousApproval,
  fixtureWithStaticMetadata,
  migration,
  repositoryHead,
  WAIVERS_PATH,
} from "./database-quality-gate-static-test-support"

afterEach(cleanupFixtureRepositories)

describe("database quality gate static operator workflow", () => {
  it("persists candidate evidence and verifies the approval-bearing landed commit", () => {
    const candidate = migration(
      "-- migration\nBEGIN;\nDROP TABLE public.deprecated_table;\nCOMMIT;\n"
    )
    const repository = fixtureWithStaticMetadata()
    const candidateParent = repositoryHead(repository.root)
    mkdirSync(repository.path("supabase", "migrations"), { recursive: true })
    writeFileSync(repository.path(candidate.path), candidate.sql)
    const candidateCommit = commitWorkingTree(repository.root, "commit dangerous candidate")

    const candidateExecution = runDatabaseQualityGateCommand(
      [
        "--created-at",
        "2026-08-24T09:00:00Z",
        "--lane",
        "static",
        "--persist-candidate-report",
        "true",
        "--run-id",
        "issue-954-candidate",
        "--subject-commit",
        candidateCommit,
      ],
      {
        repositoryRoot: repository.root,
        runStatic: (input) =>
          runStaticLane({
            ...input,
            baseRef: candidateParent,
            changedFiles: [candidate.path],
          }),
      }
    )
    const candidateReport = JSON.parse(candidateExecution.stdout) as Partial<GateReport>
    expect(candidateReport).not.toHaveProperty("error")
    expect(candidateExecution.exitCode).toBe(1)
    expect(Array.isArray(candidateReport.findings)).toBe(true)
    const finding = candidateReport.findings?.find((entry) => entry.classification === "DANGEROUS")
    const evidencePath = candidateStaticEvidencePath(candidateCommit)

    expect(finding).toBeDefined()
    expect(evidencePath).toBeDefined()
    expect(existsSync(repository.path(evidencePath ?? "missing"))).toBe(true)

    const approval = dangerousApproval({
      candidateCommit,
      candidateReportDigest: candidateReport.digest ?? "",
      findingFingerprint: finding?.fingerprint ?? "",
      migrationPath: candidate.path,
      migrationSha256: sha256(canonicalTerminalNewline(candidate.sql)),
    })
    writeFileSync(
      repository.path(WAIVERS_PATH),
      fixtureJson({ approvals: [approval], schemaVersion: 1 })
    )
    const finalCommit = commitWorkingTree(repository.root, "commit dangerous approval")

    const finalExecution = runDatabaseQualityGateCommand(
      [
        "--landed-parent-commit",
        candidateCommit,
        "--lane",
        "static",
        "--run-id",
        "issue-954-final",
        "--subject-commit",
        finalCommit,
      ],
      {
        clock: () => "2026-08-24T09:05:00Z",
        repositoryRoot: repository.root,
      }
    )
    const finalReport = JSON.parse(finalExecution.stdout) as GateReport

    expect(finalExecution.exitCode).toBe(0)
    expect(finalReport.outcome).toBe("PASS")
    expect(finalReport.findings).toContainEqual(
      expect.objectContaining({
        approval: {
          acceptedForAggregate: true,
          id: approval.id,
        },
        classification: "DANGEROUS",
      })
    )
  })

  it("rejects an explicit landed run with no changed DB gate input", () => {
    const repository = fixtureWithStaticMetadata({
      path: "supabase/migrations/20260824085000_existing.sql",
      sql: "-- migration\nBEGIN;\nSELECT 1;\nCOMMIT;\n",
    })
    const parentCommit = repositoryHead(repository.root)
    writeFileSync(repository.path("README.md"), "documentation only\n")
    const finalCommit = commitWorkingTree(repository.root, "commit documentation only")

    const execution = runDatabaseQualityGateCommand(
      [
        "--landed-parent-commit",
        parentCommit,
        "--lane",
        "static",
        "--run-id",
        "issue-954-zero-diff",
        "--subject-commit",
        finalCommit,
      ],
      {
        clock: () => "2026-08-24T09:10:00Z",
        repositoryRoot: repository.root,
      }
    )
    const report = JSON.parse(execution.stdout) as GateReport

    expect(execution.exitCode).toBe(2)
    expect(report.outcome).toBe("INCOMPLETE")
    expect(report.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.changed-file-discovery" })
    )
  })

  it.each([
    ["tracked", "README.md"],
    ["untracked", "candidate-dirty.txt"],
  ])("does not persist candidate evidence from a %s dirty worktree", (_kind, dirtyPath) => {
    const candidate = migration(
      "-- migration\nBEGIN;\nDROP TABLE public.deprecated_table;\nCOMMIT;\n"
    )
    const repository = fixtureWithStaticMetadata()
    const candidateParent = repositoryHead(repository.root)
    mkdirSync(repository.path("supabase", "migrations"), { recursive: true })
    writeFileSync(repository.path(candidate.path), candidate.sql)
    const candidateCommit = commitWorkingTree(repository.root, "commit dirty candidate")
    writeFileSync(repository.path(dirtyPath), "dirty after candidate commit\n")

    const execution = runDatabaseQualityGateCommand(
      [
        "--created-at",
        "2026-08-24T09:00:00Z",
        "--lane",
        "static",
        "--persist-candidate-report",
        "true",
        "--run-id",
        `issue-954-dirty-${_kind}`,
        "--subject-commit",
        candidateCommit,
      ],
      {
        repositoryRoot: repository.root,
        runStatic: (input) =>
          runStaticLane({
            ...input,
            baseRef: candidateParent,
            changedFiles: [candidate.path],
          }),
      }
    )
    const evidencePath = candidateStaticEvidencePath(candidateCommit)

    expect(execution.exitCode).toBe(2)
    expect(existsSync(repository.path(evidencePath ?? "missing"))).toBe(false)
  })

  it("rejects a caller-supplied timestamp for landed approval verification", () => {
    const candidate = migration(
      "-- migration\nBEGIN;\nDROP TABLE public.deprecated_table;\nCOMMIT;\n"
    )
    const repository = fixtureWithStaticMetadata()
    const candidateParent = repositoryHead(repository.root)
    mkdirSync(repository.path("supabase", "migrations"), { recursive: true })
    writeFileSync(repository.path(candidate.path), candidate.sql)
    const candidateCommit = commitWorkingTree(repository.root, "commit expiring candidate")
    const candidateExecution = runDatabaseQualityGateCommand(
      [
        "--created-at",
        "2026-08-22T09:00:00Z",
        "--lane",
        "static",
        "--persist-candidate-report",
        "true",
        "--run-id",
        "issue-954-expiring-candidate",
        "--subject-commit",
        candidateCommit,
      ],
      {
        repositoryRoot: repository.root,
        runStatic: (input) =>
          runStaticLane({
            ...input,
            baseRef: candidateParent,
            changedFiles: [candidate.path],
          }),
      }
    )
    const candidateReport = JSON.parse(candidateExecution.stdout) as GateReport
    const finding = candidateReport.findings.find((entry) => entry.classification === "DANGEROUS")
    const approval = dangerousApproval({
      candidateCommit,
      candidateReportDigest: candidateReport.digest,
      expiresAt: "2026-08-23T09:00:00Z",
      findingFingerprint: finding?.fingerprint ?? "",
      migrationPath: candidate.path,
      migrationSha256: sha256(canonicalTerminalNewline(candidate.sql)),
    })
    writeFileSync(
      repository.path(WAIVERS_PATH),
      fixtureJson({ approvals: [approval], schemaVersion: 1 })
    )
    const finalCommit = commitWorkingTree(repository.root, "commit expiring approval")

    const execution = runDatabaseQualityGateCommand(
      [
        "--created-at",
        "2026-08-22T09:05:00Z",
        "--landed-parent-commit",
        candidateCommit,
        "--lane",
        "static",
        "--run-id",
        "issue-954-backdated-final",
        "--subject-commit",
        finalCommit,
      ],
      { repositoryRoot: repository.root }
    )

    expect(execution.exitCode).toBe(2)
  })
})
