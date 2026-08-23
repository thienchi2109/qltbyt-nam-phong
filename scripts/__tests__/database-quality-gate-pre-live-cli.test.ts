import { afterEach, describe, expect, it } from "vitest"

import type { OracleEvidenceStore } from "../db-quality-gate/oracle-evidence-store"
import type { PreLiveEvidenceDependencies } from "../db-quality-gate/pre-live"
import type { GateReport } from "../db-quality-gate/types"
import {
  BASELINE_RUN_ID,
  createLandedRepository,
  dependencies,
  FakeEvidenceStore,
  gateReport,
  STATIC_RUN_ID,
  storeBaselineReport,
} from "./database-quality-gate-pre-live-test-support"
import {
  cleanupFixtureRepositories,
  loadDatabaseQualityGateModule,
} from "./database-quality-gate-test-support"

type CommandModule = {
  runDatabaseQualityGateCommand: (
    args: string[],
    dependencies?: {
      evidenceStore?: () => OracleEvidenceStore | undefined
      preLiveDependencies?: Omit<PreLiveEvidenceDependencies, "evidenceStore">
      repositoryRoot?: string
    }
  ) => {
    exitCode: 0 | 1 | 2
    stdout: string
  }
}

afterEach(cleanupFixtureRepositories)

describe("database quality gate pre-live CLI", () => {
  it("dispatches exact landed evidence through the production pre-live command path", async () => {
    const command = await loadDatabaseQualityGateModule<CommandModule>("cli")
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const baselineReport = gateReport("baseline-forward", headCommit)
    storeBaselineReport(store, baselineReport)
    const injected = dependencies(store, headCommit)
    const { evidenceStore: _, ...preLiveDependencies } = injected

    const result = command.runDatabaseQualityGateCommand(
      [
        "--lane",
        "pre-live",
        "--run-id",
        "phase-6a-pre-live-cli",
        "--subject-commit",
        headCommit,
        "--baseline-forward-run-id",
        BASELINE_RUN_ID,
        "--baseline-forward-digest",
        baselineReport.digest,
        "--static-run-id",
        STATIC_RUN_ID,
        "--live-observation",
        "fixture-live-observation.json",
      ],
      {
        evidenceStore: () => store,
        preLiveDependencies,
        repositoryRoot: repository.root,
      }
    )
    const report = JSON.parse(result.stdout) as GateReport

    expect(result.exitCode).toBe(0)
    expect(report).toMatchObject({
      findings: [
        expect.objectContaining({
          classification: "WARNING",
          evidence: { nextAction: "request-explicit-permission" },
          ruleId: "prelive.permission.explicit-required",
        }),
      ],
      lane: "pre-live",
      outcome: "PASS",
      requiredChecksComplete: true,
      subjectCommit: headCommit,
    })
  })

  it.each(["--permission", "--permission-granted", "--approve", "--apply", "--write-live"])(
    "rejects the unsupported %s state input",
    async (option) => {
      const command = await loadDatabaseQualityGateModule<CommandModule>("cli")

      const result = command.runDatabaseQualityGateCommand([
        "--lane",
        "pre-live",
        "--run-id",
        "phase-6a-no-write",
        option,
        "true",
      ])

      expect(result.exitCode).toBe(2)
      expect(result.stdout).not.toContain("write")
      expect(result.stdout).not.toContain("permissionGranted")
    }
  )

  it("rejects caller-supplied evaluation time for pre-live", async () => {
    const command = await loadDatabaseQualityGateModule<CommandModule>("cli")

    const result = command.runDatabaseQualityGateCommand([
      "--lane",
      "pre-live",
      "--run-id",
      "phase-6a-trusted-clock",
      "--created-at",
      "2020-01-01T00:00:00.000Z",
    ])

    expect(result.exitCode).toBe(2)
    expect(result.stdout).not.toContain("2020-01-01")
  })
})
