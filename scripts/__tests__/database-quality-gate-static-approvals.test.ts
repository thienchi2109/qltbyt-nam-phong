import { writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import {
  canonicalTerminalNewline,
  cleanupFixtureRepositories,
  fixtureJson,
  loadDatabaseQualityGateModule,
  sha256,
} from "./database-quality-gate-test-support"
import {
  commitWorkflowApprovals,
  prepareApprovalWorkflow,
  runLandedWorkflow,
  workflowApproval,
} from "./database-quality-gate-static-approval-test-support"
import {
  dangerousApproval,
  commitWorkingTree,
  fixtureWithStaticMetadata,
  migration,
  repositoryHead,
  runStatic,
  SUBJECT_COMMIT,
  StaticLaneModule,
  WAIVERS_PATH,
} from "./database-quality-gate-static-test-support"

afterEach(cleanupFixtureRepositories)

describe("database quality gate static waiver attachment", () => {
  it("does not accept a waiver that exists only in the working tree", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      "-- migration\nBEGIN;\nDROP TABLE public.deprecated_table;\nCOMMIT;\n"
    )
    const unapprovedRepository = fixtureWithStaticMetadata(candidate)
    const unapproved = runStatic(source, unapprovedRepository.root, [candidate.path])
    const finding = unapproved.findings.find((entry) => entry.classification === "DANGEROUS")

    expect(finding).toBeDefined()

    const repository = fixtureWithStaticMetadata(candidate)
    const candidateCommit = repositoryHead(repository.root)
    writeFileSync(
      repository.path(WAIVERS_PATH),
      fixtureJson({
        approvals: [
          dangerousApproval({
            candidateCommit,
            findingFingerprint: finding?.fingerprint ?? "",
            migrationPath: candidate.path,
            migrationSha256: sha256(canonicalTerminalNewline(candidate.sql)),
          }),
        ],
        schemaVersion: 1,
      })
    )

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({
        approval: {
          acceptedForAggregate: true,
          id: "approval-dangerous-drop",
        },
        classification: "DANGEROUS",
        ruleId: "migration.dangerous-statement",
      })
    )
  })

  it("does not trust a caller-supplied subject commit for committed waiver evidence", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      "-- migration\nBEGIN;\nDROP TABLE public.deprecated_table;\nCOMMIT;\n"
    )
    const unapprovedRepository = fixtureWithStaticMetadata(candidate)
    const unapproved = runStatic(source, unapprovedRepository.root, [candidate.path])
    const finding = unapproved.findings.find((entry) => entry.classification === "DANGEROUS")

    expect(finding).toBeDefined()

    const repository = fixtureWithStaticMetadata(candidate)
    const candidateCommit = repositoryHead(repository.root)
    writeFileSync(
      repository.path(WAIVERS_PATH),
      fixtureJson({
        approvals: [
          dangerousApproval({
            candidateCommit,
            findingFingerprint: finding?.fingerprint ?? "",
            migrationPath: candidate.path,
            migrationSha256: sha256(canonicalTerminalNewline(candidate.sql)),
          }),
        ],
        schemaVersion: 1,
      })
    )
    commitWorkingTree(repository.root, "commit waiver evidence")

    const result = runStatic(source, repository.root, [candidate.path], undefined, SUBJECT_COMMIT)

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({
        approval: expect.objectContaining({ acceptedForAggregate: true }),
        classification: "DANGEROUS",
      })
    )
  })

  it("is incomplete when a matching waiver lacks independent candidate evidence", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      "-- migration\nBEGIN;\nDROP TABLE public.deprecated_table;\nCOMMIT;\n"
    )
    const unapprovedRepository = fixtureWithStaticMetadata(candidate)
    const unapproved = runStatic(source, unapprovedRepository.root, [candidate.path])
    const finding = unapproved.findings.find((entry) => entry.classification === "DANGEROUS")

    expect(finding).toBeDefined()

    const repository = fixtureWithStaticMetadata(candidate)
    writeFileSync(
      repository.path(WAIVERS_PATH),
      fixtureJson({
        approvals: [
          dangerousApproval({
            findingFingerprint: finding?.fingerprint ?? "",
            migrationPath: candidate.path,
            migrationSha256: sha256(canonicalTerminalNewline(candidate.sql)),
          }),
        ],
        schemaVersion: 1,
      })
    )

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
  })

  it("accepts exact committed candidate evidence on the approval-bearing child commit", async () => {
    const { source, workflow } = await prepareApprovalWorkflow()
    const approval = workflowApproval(workflow)
    const finalCommit = commitWorkflowApprovals(workflow, [approval])
    const result = runLandedWorkflow(source, workflow, finalCommit)

    expect(result.outcome).toBe("PASS")
    expect(result.subjectCommit).toBe(finalCommit)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        approval: {
          acceptedForAggregate: true,
          id: approval.id,
        },
        classification: "DANGEROUS",
        fingerprint: workflow.finding.fingerprint,
      })
    )
  })

  it("fails closed when candidate evidence is missing or stale", async () => {
    const missing = await prepareApprovalWorkflow({ persistEvidence: false })
    const missingCommit = commitWorkflowApprovals(missing.workflow, [
      workflowApproval(missing.workflow),
    ])
    const missingResult = runLandedWorkflow(missing.source, missing.workflow, missingCommit)

    expect(missingResult.outcome).toBe("INCOMPLETE")

    const stale = await prepareApprovalWorkflow()
    const staleCommit = commitWorkflowApprovals(stale.workflow, [
      workflowApproval(stale.workflow, {
        candidateReportDigest: "f".repeat(64),
      }),
    ])
    const staleResult = runLandedWorkflow(stale.source, stale.workflow, staleCommit)

    expect(staleResult.outcome).toBe("FAILED")
    expect(staleResult.findings).not.toContainEqual(
      expect.objectContaining({
        approval: expect.objectContaining({ acceptedForAggregate: true }),
      })
    )
  })

  it("fails closed when approved migration content changes after the candidate run", async () => {
    const { source, workflow } = await prepareApprovalWorkflow()
    writeFileSync(
      workflow.repository.path(workflow.candidate.path),
      `${workflow.candidate.sql}-- changed after review\n`
    )
    const finalCommit = commitWorkflowApprovals(workflow, [workflowApproval(workflow)])

    const result = runLandedWorkflow(source, workflow, finalCommit)

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({
        approval: expect.objectContaining({ acceptedForAggregate: true }),
      })
    )
  })

  it("rejects expired, revoked, and superseded approval chains", async () => {
    const expired = await prepareApprovalWorkflow()
    const expiredCommit = commitWorkflowApprovals(expired.workflow, [
      {
        ...workflowApproval(expired.workflow),
        expiresAt: "2026-08-16T15:09:59Z",
      },
    ])
    expect(runLandedWorkflow(expired.source, expired.workflow, expiredCommit).outcome).toBe(
      "FAILED"
    )

    for (const status of ["revoked", "superseded"] as const) {
      const prepared = await prepareApprovalWorkflow()
      const approval = workflowApproval(prepared.workflow)
      const invalidatingRecord = {
        ...approval,
        id: `${approval.id}-${status}`,
        status,
        supersedes: approval.id,
        ...(status === "revoked" ? { revokedAt: "2026-08-16T15:05:00Z" } : {}),
      }
      const finalCommit = commitWorkflowApprovals(prepared.workflow, [approval, invalidatingRecord])

      expect(runLandedWorkflow(prepared.source, prepared.workflow, finalCommit).outcome).toBe(
        "FAILED"
      )
    }
  })

  it("rejects dirty worktrees and later commits that are not the approval-bearing child", async () => {
    const dirty = await prepareApprovalWorkflow()
    const dirtyCommit = commitWorkflowApprovals(dirty.workflow, [workflowApproval(dirty.workflow)])
    writeFileSync(dirty.workflow.repository.path("README.md"), "dirty after approval\n")

    expect(runLandedWorkflow(dirty.source, dirty.workflow, dirtyCommit).outcome).toBe("INCOMPLETE")

    const wrongCommit = await prepareApprovalWorkflow()
    const approvedCommit = commitWorkflowApprovals(wrongCommit.workflow, [
      workflowApproval(wrongCommit.workflow),
    ])
    writeFileSync(wrongCommit.workflow.repository.path("README.md"), "later commit\n")
    const laterCommit = commitWorkingTree(
      wrongCommit.workflow.repository.root,
      "commit after approval"
    )
    const result = wrongCommit.source.runStaticLaneForLandedCommit({
      createdAt: "2026-08-16T15:10:00Z",
      landedParentCommit: approvedCommit,
      repositoryRoot: wrongCommit.workflow.repository.root,
      runId: "phase-2-static-wrong-final",
      subjectCommit: laterCommit,
    })

    expect(result.outcome).toBe("INCOMPLETE")
  })

  it("does not accept an approval superseded by a later waiver record", async () => {
    const source = await loadDatabaseQualityGateModule<StaticLaneModule>("static-lane")
    const candidate = migration(
      "-- migration\nBEGIN;\nDROP TABLE public.deprecated_table;\nCOMMIT;\n"
    )
    const unapprovedRepository = fixtureWithStaticMetadata(candidate)
    const unapproved = runStatic(source, unapprovedRepository.root, [candidate.path])
    const finding = unapproved.findings.find((entry) => entry.classification === "DANGEROUS")

    expect(finding).toBeDefined()

    const approval = dangerousApproval({
      findingFingerprint: finding?.fingerprint ?? "",
      migrationPath: candidate.path,
      migrationSha256: sha256(canonicalTerminalNewline(candidate.sql)),
    })
    const repository = fixtureWithStaticMetadata(candidate)
    writeFileSync(
      repository.path(WAIVERS_PATH),
      fixtureJson({
        approvals: [
          approval,
          {
            ...approval,
            id: "approval-dangerous-drop-revoked",
            revokedAt: "2026-08-16T15:05:00Z",
            status: "revoked",
            supersedes: approval.id,
          },
        ],
        schemaVersion: 1,
      })
    )

    const result = runStatic(source, repository.root, [candidate.path])

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({
        approval: expect.objectContaining({ acceptedForAggregate: true }),
        classification: "DANGEROUS",
      })
    )
  })
})
