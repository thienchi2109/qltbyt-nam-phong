import { afterEach, describe, expect, it, vi } from "vitest"

import { createFindingFingerprint } from "../db-quality-gate/contract"
import { runPreLiveEvidenceCheck } from "../db-quality-gate/pre-live"
import {
  BASELINE_RUN_ID,
  FakeEvidenceStore,
  createLandedRepository,
  dependencies,
  gateReport,
  preLiveInput,
  storeBaselineReport,
} from "./database-quality-gate-pre-live-test-support"
import { cleanupFixtureRepositories } from "./database-quality-gate-test-support"

afterEach(() => {
  cleanupFixtureRepositories()
  vi.restoreAllMocks()
})

describe("database quality gate pre-live reconciliation interlock", () => {
  it("blocks a later migration while either reconciliation branch is incomplete", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const baselineReport = gateReport("baseline-forward", headCommit)
    storeBaselineReport(store, baselineReport)
    const evidence = { reason: "lock branch has not landed" }
    const evaluateReconciliation = vi.fn(() =>
      gateReport("reconciliation", headCommit, {
        findings: [
          {
            classification: "BLOCKING",
            evidence,
            fingerprint: createFindingFingerprint({
              evidence,
              ruleId: "reconciliation/lock-incomplete",
              subject: headCommit,
            }),
            ruleId: "reconciliation/lock-incomplete",
          },
        ],
        outcome: "FAILED",
        runId: "phase-6-reconciliation",
      })
    )

    const report = runPreLiveEvidenceCheck(
      {
        ...preLiveInput(headCommit),
        baselineForwardDigest: baselineReport.digest,
        baselineForwardRunId: BASELINE_RUN_ID,
        repositoryRoot: repository.root,
      },
      dependencies(store, headCommit, { evaluateReconciliation })
    )

    expect(report.outcome).toBe("INCOMPLETE")
    expect(report.findings.map((finding) => finding.ruleId)).toContain("reconciliation/incomplete")
    expect(evaluateReconciliation).toHaveBeenCalledOnce()
  })

  it("continues pre-live only after reconciliation reports PASS", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const baselineReport = gateReport("baseline-forward", headCommit)
    storeBaselineReport(store, baselineReport)
    const evaluateReconciliation = vi.fn(() =>
      gateReport("reconciliation", headCommit, {
        runId: "phase-6-reconciliation",
      })
    )

    const report = runPreLiveEvidenceCheck(
      {
        ...preLiveInput(headCommit),
        baselineForwardDigest: baselineReport.digest,
        baselineForwardRunId: BASELINE_RUN_ID,
        repositoryRoot: repository.root,
      },
      dependencies(store, headCommit, { evaluateReconciliation })
    )

    expect(report.outcome).toBe("PASS")
    expect(evaluateReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        baselineForwardDigest: baselineReport.digest,
        baselineForwardRunId: BASELINE_RUN_ID,
        subjectCommit: headCommit,
      }),
      expect.objectContaining({
        evidenceStore: store,
      })
    )
  })
})
