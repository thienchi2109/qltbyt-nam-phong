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
