import { writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { stableJsonSha256 } from "../db-quality-gate/serialization"
import { FakeEvidenceStore } from "./database-quality-gate-pre-live-test-support"
import { commitWorkingTree } from "./database-quality-gate-static-test-support"
import {
  canonicalTerminalNewline,
  cleanupFixtureRepositories,
  fixtureJson,
  loadDatabaseQualityGateModule,
  sha256,
} from "./database-quality-gate-test-support"
import {
  CAPTURED_AT,
  LIVE_NAME,
  LIVE_VERSION,
  MIGRATION_PATH,
  READ_BACK_RUN_ID,
  RECEIVED_AT,
  createMigrationRepository,
  observation,
} from "./database-quality-gate-read-back-test-support"
import type { ReadBackModule } from "./database-quality-gate-read-back-test-support"

afterEach(cleanupFixtureRepositories)

describe("database quality gate read-back ingestion", () => {
  it("persists computed authority and reloads the full digest-verified record by Oracle run ID", async () => {
    const readBack = await loadDatabaseQualityGateModule<ReadBackModule>("read-back")
    const canonicalSql = canonicalTerminalNewline("SELECT 1;\nSELECT 2;\n")
    const reviewedSha256 = sha256(canonicalSql)
    const rawObservation = observation()
    const { repository, subjectCommit } = createMigrationRepository("SELECT 1;\nSELECT 2;\n")
    const store = new FakeEvidenceStore()

    const result = readBack.ingestReadBackObservation(
      {
        observation: rawObservation,
        repositoryRoot: repository.root,
        runId: READ_BACK_RUN_ID,
        subjectCommit,
      },
      {
        evidenceStore: store,
        now: () => new Date(RECEIVED_AT),
      }
    )

    expect(result).toMatchObject({
      binding: {
        liveName: LIVE_NAME,
        liveVersion: LIVE_VERSION,
        migrationPath: MIGRATION_PATH,
        sha256: reviewedSha256,
      },
      evidenceId: `oracle:${READ_BACK_RUN_ID}/read-back.json`,
      outcome: "PASS",
      record: {
        canonicalBytes: Buffer.byteLength(canonicalSql, "utf8"),
        capturedAt: CAPTURED_AT,
        liveName: LIVE_NAME,
        liveVersion: LIVE_VERSION,
        migrationPath: MIGRATION_PATH,
        observedCanonicalSha256: reviewedSha256,
        projectRef: "cdthersvldpnlbvpufrr",
        rawObservationDigest: stableJsonSha256(rawObservation),
        receivedAt: RECEIVED_AT,
        schemaVersion: 1,
        sha256: reviewedSha256,
        source: "supabase-mcp",
        statementCount: 2,
        subjectCommit,
      },
      status: "verified",
    })
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/u)
    expect(result.record?.digest).toBe(result.digest)
    expect(store.operations).toEqual([`persist:${READ_BACK_RUN_ID}/read-back.json`])

    const loaded = readBack.loadReadBackRecord({
      evidenceStore: store,
      runId: READ_BACK_RUN_ID,
    })

    expect(loaded).toEqual({ status: "ok", value: result.record })

    const key = `${READ_BACK_RUN_ID}/read-back.json`
    const tampered = JSON.parse(store.artifacts.get(key) ?? "{}") as Record<string, unknown>
    tampered.canonicalBytes = 1
    store.artifacts.set(key, fixtureJson(tampered))

    expect(
      readBack.loadReadBackRecord({
        evidenceStore: store,
        runId: READ_BACK_RUN_ID,
      })
    ).toMatchObject({ status: "error" })
  })

  it("removes exactly one optional terminal newline from the joined live statements", async () => {
    const readBack = await loadDatabaseQualityGateModule<ReadBackModule>("read-back")
    const reviewedContent = "SELECT 1;\n\n"
    const reviewedSha256 = sha256(canonicalTerminalNewline(reviewedContent))
    const { repository, subjectCommit } = createMigrationRepository(reviewedContent)
    const store = new FakeEvidenceStore()

    const result = readBack.ingestReadBackObservation(
      {
        observation: observation({ statements: [reviewedContent] }),
        repositoryRoot: repository.root,
        runId: READ_BACK_RUN_ID,
        subjectCommit,
      },
      {
        evidenceStore: store,
        now: () => new Date(RECEIVED_AT),
      }
    )

    expect(result).toMatchObject({
      binding: { sha256: reviewedSha256 },
      outcome: "PASS",
      record: {
        canonicalBytes: Buffer.byteLength("SELECT 1;\n", "utf8"),
        observedCanonicalSha256: reviewedSha256,
      },
      status: "verified",
    })
  })

  it("anchors reviewed source to the exact subject commit after a later migration commit", async () => {
    const readBack = await loadDatabaseQualityGateModule<ReadBackModule>("read-back")
    const reviewedContent = "SELECT 1;\n"
    const { repository, subjectCommit } = createMigrationRepository(reviewedContent)
    writeFileSync(repository.path(MIGRATION_PATH), "SELECT 2;\n")
    commitWorkingTree(repository.root, "later migration content")
    const store = new FakeEvidenceStore()

    const result = readBack.ingestReadBackObservation(
      {
        observation: observation({ statements: [reviewedContent] }),
        repositoryRoot: repository.root,
        runId: READ_BACK_RUN_ID,
        subjectCommit,
      },
      {
        evidenceStore: store,
        now: () => new Date(RECEIVED_AT),
      }
    )

    expect(result).toMatchObject({
      binding: { sha256: sha256(canonicalTerminalNewline(reviewedContent)) },
      outcome: "PASS",
      record: { subjectCommit },
      status: "verified",
    })
  })

  it("accepts a live migration version that differs from the reviewed filename timestamp", async () => {
    const readBack = await loadDatabaseQualityGateModule<ReadBackModule>("read-back")
    const migrationPath =
      "supabase/migrations/20260819031200_technical_configuration_baseline_cross_dossier_copy.sql"
    const reviewedContent = "SELECT 1;\n"
    const { repository, subjectCommit } = createMigrationRepository(reviewedContent, migrationPath)
    const store = new FakeEvidenceStore()

    const result = readBack.ingestReadBackObservation(
      {
        observation: observation({
          liveName: "technical_configuration_baseline_cross_dossier_copy",
          liveVersion: "20260819062043",
          migrationPath,
          statements: [reviewedContent],
        }),
        repositoryRoot: repository.root,
        runId: READ_BACK_RUN_ID,
        subjectCommit,
      },
      {
        evidenceStore: store,
        now: () => new Date(RECEIVED_AT),
      }
    )

    expect(result).toMatchObject({
      binding: {
        liveName: "technical_configuration_baseline_cross_dossier_copy",
        liveVersion: "20260819062043",
        migrationPath,
      },
      outcome: "PASS",
      status: "verified",
    })
  })

  it("implements matrix row 8 by withholding Oracle authority when the live SQL hash differs", async () => {
    const readBack = await loadDatabaseQualityGateModule<ReadBackModule>("read-back")
    const { repository, subjectCommit } = createMigrationRepository("SELECT 1;\n")
    const store = new FakeEvidenceStore()

    const result = readBack.ingestReadBackObservation(
      {
        observation: observation({ statements: ["SELECT 2;\n"] }),
        repositoryRoot: repository.root,
        runId: READ_BACK_RUN_ID,
        subjectCommit,
      },
      {
        evidenceStore: store,
        now: () => new Date(RECEIVED_AT),
      }
    )

    expect(result).toMatchObject({
      outcome: "INCOMPLETE",
      status: "reconciliation-required",
    })
    expect(result.reason).toContain("canonical SQL hash")
    expect(result).not.toHaveProperty("record")
    expect(store.operations).toEqual([])
  })

  it.each([
    ["missing observation", undefined],
    ["wrong project", observation({ projectRef: "another-project" })],
    ["wrong live name", observation({ liveName: "other" })],
    [
      "wrong migration path",
      observation({
        migrationPath: `supabase/migrations/archive/${LIVE_VERSION}_${LIVE_NAME}.sql`,
      }),
    ],
    ["empty statements", observation({ statements: [] })],
    ["blank statement", observation({ statements: ["   "] })],
    ["malformed capture", observation({ capturedAt: "not-an-iso-date" })],
    ["stale capture", observation({ capturedAt: "2026-08-23T07:14:59.999Z" })],
    ["future capture", observation({ capturedAt: "2026-08-23T07:32:00.001Z" })],
    [
      "caller-supplied authority fields",
      observation({
        canonicalBytes: 1,
        expectedSha256: "a".repeat(64),
        statementCount: 1,
      }),
    ],
  ])("rejects %s without persisting authority", async (_name, rawObservation) => {
    const readBack = await loadDatabaseQualityGateModule<ReadBackModule>("read-back")
    const { repository, subjectCommit } = createMigrationRepository("SELECT 1;\n")
    const store = new FakeEvidenceStore()

    const result = readBack.ingestReadBackObservation(
      {
        observation: rawObservation,
        repositoryRoot: repository.root,
        runId: READ_BACK_RUN_ID,
        subjectCommit,
      },
      {
        evidenceStore: store,
        now: () => new Date(RECEIVED_AT),
      }
    )

    expect(result).toMatchObject({
      outcome: "INCOMPLETE",
      status: "reconciliation-required",
    })
    expect(store.operations).toEqual([])
  })
})
