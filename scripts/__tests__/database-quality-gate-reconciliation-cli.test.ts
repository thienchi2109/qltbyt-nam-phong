import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

import type { OracleEvidenceStore } from "../db-quality-gate/oracle-evidence-store"
import type { ProtectedMainVerifier } from "../db-quality-gate/protected-main"
import type { ReconciliationDependencies } from "../db-quality-gate/reconciliation"
import type { GateReport } from "../db-quality-gate/types"
import { git } from "./database-quality-gate-pre-live-test-support"
import {
  READ_BACK_RUN_ID,
  createReconciliationFixture,
} from "./database-quality-gate-reconciliation-test-support"
import {
  cleanupFixtureRepositories,
  loadDatabaseQualityGateModule,
} from "./database-quality-gate-test-support"

type GateCommandModule = {
  runDatabaseQualityGateCommand: (
    args: string[],
    dependencies?: {
      evidenceStore?: () => OracleEvidenceStore | undefined
      reconciliationDependencies?: Omit<ReconciliationDependencies, "evidenceStore">
      repositoryRoot?: string
    }
  ) => {
    exitCode: 0 | 1 | 2
    stdout: string
  }
}

type LockCommandModule = {
  runReconciliationLockCommand: (
    args: string[],
    dependencies?: {
      evidenceStore?: () => OracleEvidenceStore | undefined
      refreshOriginMain?: (repositoryRoot: string) => string | undefined
      repositoryRoot?: string
      verifyProtectedMain?: ProtectedMainVerifier
    }
  ) => {
    exitCode: 0 | 2
    stdout: string
  }
}

afterEach(cleanupFixtureRepositories)

describe("database quality gate reconciliation CLI", () => {
  it("dispatches exact landed evidence through the reconciliation lane", async () => {
    const command = await loadDatabaseQualityGateModule<GateCommandModule>("cli")
    const fixture = createReconciliationFixture()

    const result = command.runDatabaseQualityGateCommand(
      [
        "--lane",
        "reconciliation",
        "--run-id",
        "phase-6-reconciliation-cli",
        "--subject-commit",
        fixture.subjectCommit,
        "--baseline-forward-run-id",
        fixture.baselineReport.runId,
        "--baseline-forward-digest",
        fixture.baselineReport.digest,
      ],
      {
        evidenceStore: () => fixture.store,
        reconciliationDependencies: {
          clock: () => "2026-08-23T08:00:00.000Z",
          refreshOriginMain: () => fixture.subjectCommit,
          verifyProtectedMain: () => ({
            status: "active",
            subjectCommit: fixture.subjectCommit,
          }),
        },
        repositoryRoot: fixture.repository.root,
      }
    )
    const report = JSON.parse(result.stdout) as GateReport

    expect(result.exitCode).toBe(0)
    expect(report).toMatchObject({
      findings: [],
      lane: "reconciliation",
      outcome: "PASS",
      subjectCommit: fixture.subjectCommit,
    })
  })

  it.each(["--permission", "--permission-granted", "--approve", "--apply", "--write-live"])(
    "rejects unsupported reconciliation input %s",
    async (option) => {
      const command = await loadDatabaseQualityGateModule<GateCommandModule>("cli")

      const result = command.runDatabaseQualityGateCommand([
        "--lane",
        "reconciliation",
        "--run-id",
        "phase-6-no-permission",
        option,
        "true",
      ])

      expect(result.exitCode).toBe(2)
      expect(result.stdout).not.toContain("permissionGranted")
    }
  )

  it("rejects caller-supplied evaluation time for reconciliation", async () => {
    const command = await loadDatabaseQualityGateModule<GateCommandModule>("cli")

    const result = command.runDatabaseQualityGateCommand([
      "--lane",
      "reconciliation",
      "--run-id",
      "phase-6-trusted-clock",
      "--created-at",
      "2020-01-01T00:00:00.000Z",
    ])

    expect(result.exitCode).toBe(2)
    expect(result.stdout).not.toContain("2020-01-01")
  })
})

describe("database quality gate reconciliation lock command", () => {
  it("prepares locally and returns push/PR commands without pushing", async () => {
    const command = await loadDatabaseQualityGateModule<LockCommandModule>(
      "reconciliation-lock-pr-cli"
    )
    const fixture = createReconciliationFixture({ includeLockEntry: false })

    const result = command.runReconciliationLockCommand(
      [
        "--run-id",
        "phase-6-lock-cli",
        "--subject-commit",
        fixture.subjectCommit,
        "--read-back-run-id",
        READ_BACK_RUN_ID,
        "--read-back-digest",
        fixture.readBack.digest,
      ],
      {
        evidenceStore: () => fixture.store,
        refreshOriginMain: () => fixture.subjectCommit,
        repositoryRoot: fixture.repository.root,
        verifyProtectedMain: () => ({
          status: "active",
          subjectCommit: fixture.subjectCommit,
        }),
      }
    )
    const output = JSON.parse(result.stdout) as {
      commands: string[]
      status: string
    }

    expect(result.exitCode).toBe(0)
    expect(output.status).toBe("prepared")
    expect(output.commands).toEqual([
      "git push -u origin db-gate/reconcile-lock-20260823070000",
      "gh pr create --base main --head db-gate/reconcile-lock-20260823070000",
    ])
    expect(git(fixture.repository.root, "branch", "--show-current")).toBe(
      "db-gate/reconcile-lock-20260823070000"
    )
    expect(git(fixture.repository.root, "rev-parse", "origin/main")).toBe(fixture.subjectCommit)
  })

  it.each([
    ["missing read-back digest", ["--run-id", "phase-6-lock-cli"]],
    [
      "automatic push request",
      [
        "--run-id",
        "phase-6-lock-cli",
        "--subject-commit",
        "a".repeat(40),
        "--read-back-run-id",
        READ_BACK_RUN_ID,
        "--read-back-digest",
        "b".repeat(64),
        "--push",
        "true",
      ],
    ],
  ])("rejects %s", async (_name, args) => {
    const command = await loadDatabaseQualityGateModule<LockCommandModule>(
      "reconciliation-lock-pr-cli"
    )

    const result = command.runReconciliationLockCommand(args)

    expect(result.exitCode).toBe(2)
    expect(JSON.parse(result.stdout)).toMatchObject({ outcome: "INCOMPLETE" })
  })

  it("exposes the package command and executable launcher", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>
    }
    expect(packageJson.scripts["db:quality-gate:reconcile-lock"]).toBe(
      "node scripts/db-quality-gate/run-reconciliation-lock.cjs"
    )

    const result = spawnSync(
      process.execPath,
      ["scripts/db-quality-gate/run-reconciliation-lock.cjs", "--invalid", "true"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      }
    )
    expect(result.status).toBe(2)
    expect(JSON.parse(result.stdout)).toMatchObject({ outcome: "INCOMPLETE" })
  })
})
