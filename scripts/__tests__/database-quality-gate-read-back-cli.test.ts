import { rmSync, writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { FakeEvidenceStore } from "./database-quality-gate-pre-live-test-support"
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
import type {
  ReadBackCliModule,
  ReadBackModule,
  ReadBackResult,
} from "./database-quality-gate-read-back-test-support"
import {
  cleanupFixtureRepositories,
  fixtureJson,
  loadDatabaseQualityGateModule,
} from "./database-quality-gate-test-support"

afterEach(cleanupFixtureRepositories)

describe("database quality gate read-back command", () => {
  it("accepts only the dedicated key/value contract and survives deletion of the observation file", async () => {
    const command = await loadDatabaseQualityGateModule<ReadBackCliModule>("read-back-cli")
    const readBack = await loadDatabaseQualityGateModule<ReadBackModule>("read-back")
    const { repository, subjectCommit } = createMigrationRepository("SELECT 1;\nSELECT 2;\n")
    const observationPath = repository.path("read-back-observation.json")
    writeFileSync(observationPath, fixtureJson(observation()))
    const store = new FakeEvidenceStore()

    const result = command.runReadBackCommand(
      [
        "--run-id",
        READ_BACK_RUN_ID,
        "--subject-commit",
        subjectCommit,
        "--observation",
        observationPath,
      ],
      {
        evidenceStore: () => store,
        now: () => new Date(RECEIVED_AT),
        repositoryRoot: repository.root,
      }
    )
    const output = JSON.parse(result.stdout) as ReadBackResult

    expect(result.exitCode).toBe(0)
    expect(output).toMatchObject({
      binding: {
        liveName: LIVE_NAME,
        liveVersion: LIVE_VERSION,
        migrationPath: MIGRATION_PATH,
      },
      outcome: "PASS",
      status: "verified",
    })

    rmSync(observationPath)
    expect(
      readBack.loadReadBackRecord({
        evidenceStore: store,
        runId: READ_BACK_RUN_ID,
      })
    ).toMatchObject({ status: "ok" })
  })

  it.each([
    [
      "missing observation option",
      ["--run-id", READ_BACK_RUN_ID, "--subject-commit", "a".repeat(40)],
    ],
    [
      "caller-provided expected digest",
      [
        "--run-id",
        READ_BACK_RUN_ID,
        "--subject-commit",
        "a".repeat(40),
        "--observation",
        "observation.json",
        "--expected-digest",
        "b".repeat(64),
      ],
    ],
    [
      "caller-provided receipt time",
      [
        "--run-id",
        READ_BACK_RUN_ID,
        "--subject-commit",
        "a".repeat(40),
        "--observation",
        "observation.json",
        "--received-at",
        CAPTURED_AT,
      ],
    ],
  ])("rejects %s", async (_name, args) => {
    const command = await loadDatabaseQualityGateModule<ReadBackCliModule>("read-back-cli")
    const store = new FakeEvidenceStore()

    const result = command.runReadBackCommand(args, {
      evidenceStore: () => store,
      now: () => new Date(RECEIVED_AT),
    })

    expect(result.exitCode).toBe(2)
    expect(JSON.parse(result.stdout)).toMatchObject({ outcome: "INCOMPLETE" })
    expect(store.operations).toEqual([])
  })
})
