import { writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { createFindingFingerprint, finalizeReport, reportDigest } from "../db-quality-gate/contract"
import { ORACLE_REPORT_ARTIFACT } from "../db-quality-gate/oracle-evidence-store"
import {
  runPreLiveEvidenceCheck,
  type PreLiveEvidenceDependencies,
} from "../db-quality-gate/pre-live"
import { refreshPublicOriginMain } from "../db-quality-gate/git-evidence"
import type { GateReport } from "../db-quality-gate/types"
import {
  BASELINE_RUN_ID,
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
import { commitWorkingTree } from "./database-quality-gate-static-test-support"

function expectIncomplete(result: GateReport) {
  expect(result.outcome).toBe("INCOMPLETE")
  expect(result.requiredChecksComplete).toBe(false)
}

afterEach(cleanupFixtureRepositories)

describe("database quality gate pre-live landed evidence", () => {
  it("rejects PR-head-only baseline-forward evidence after a squash merge", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const prHeadReport = gateReport("baseline-forward", "b".repeat(40))
    storeBaselineReport(store, prHeadReport)
    const request = {
      ...input(headCommit),
      baselineForwardDigest: prHeadReport.digest,
      repositoryRoot: repository.root,
    }

    const result = runPreLiveEvidenceCheck(request, dependencies(store, headCommit))

    expectIncomplete(result)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "prelive/evidence-not-landed",
      })
    )
  })

  it.each([
    ["feature-branch HEAD", "feature"],
    ["subject commit different from HEAD", "subject"],
    ["unavailable refreshed origin/main", "unavailable"],
    ["stale refreshed origin/main", "stale"],
  ] as const)("rejects %s", (_name, scenario) => {
    const { headCommit, parentCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const report = gateReport("baseline-forward", headCommit)
    storeBaselineReport(store, report)
    let subjectCommit = headCommit
    let refreshOriginMain: PreLiveEvidenceDependencies["refreshOriginMain"]

    if (scenario === "feature") {
      git(repository.root, "checkout", "--quiet", "-b", "feature")
      writeFileSync(repository.path("feature.txt"), "feature\n")
      subjectCommit = commitWorkingTree(repository.root, "feature commit")
    } else if (scenario === "subject") {
      subjectCommit = parentCommit
    } else if (scenario === "unavailable") {
      refreshOriginMain = () => undefined
    } else {
      refreshOriginMain = () => parentCommit
    }

    const request = {
      ...input(subjectCommit),
      baselineForwardDigest: report.digest,
      repositoryRoot: repository.root,
    }
    const result = runPreLiveEvidenceCheck(
      request,
      dependencies(store, headCommit, { refreshOriginMain })
    )

    expectIncomplete(result)
  })

  it("rejects a local origin instead of weakening the production public HTTPS boundary", () => {
    const { repository } = createLandedRepository()

    expect(refreshPublicOriginMain(repository.root)).toBeUndefined()
  })

  it.each([
    ["unknown run ID", () => undefined],
    ["unreadable report", () => "unreadable"],
    ["invalid JSON", () => "{not-json"],
    ["wrong lane", (headCommit: string) => gateReport("static", headCommit)],
    [
      "non-PASS outcome",
      (headCommit: string) => gateReport("baseline-forward", headCommit, { outcome: "FAILED" }),
    ],
    [
      "explicit INCOMPLETE outcome",
      (headCommit: string) => gateReport("baseline-forward", headCommit, { outcome: "INCOMPLETE" }),
    ],
    [
      "incomplete required checks",
      (headCommit: string) =>
        gateReport("baseline-forward", headCommit, { requiredChecksComplete: false }),
    ],
    [
      "unavailable evidence",
      (headCommit: string) =>
        gateReport("baseline-forward", headCommit, { evidenceAvailable: false }),
    ],
    [
      "recomputed digest mismatch",
      (headCommit: string) => {
        const report = gateReport("baseline-forward", headCommit)
        return { ...report, executorEnvironment: { oracle: "tampered" } }
      },
    ],
    [
      "wrong embedded run ID",
      (headCommit: string) =>
        gateReport("baseline-forward", headCommit, { runId: "different-oracle-run" }),
    ],
    [
      "structurally malformed report fields",
      (headCommit: string) => ({
        ...gateReport("baseline-forward", headCommit),
        findings: {},
      }),
    ],
  ])("rejects %s", (_name, reportFactory) => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const report = reportFactory(headCommit)
    if (report === "unreadable") {
      store.readFailures.add(`${BASELINE_RUN_ID}/${ORACLE_REPORT_ARTIFACT}`)
    } else if (report !== undefined) {
      store.artifacts.set(
        `${BASELINE_RUN_ID}/${ORACLE_REPORT_ARTIFACT}`,
        typeof report === "string" ? report : `${JSON.stringify(report)}\n`
      )
    }
    const expectedDigest =
      typeof report === "object" && report !== null ? report.digest : "a".repeat(64)
    const request = {
      ...input(headCommit),
      baselineForwardDigest: expectedDigest,
      repositoryRoot: repository.root,
    }

    const result = runPreLiveEvidenceCheck(request, dependencies(store, headCommit))

    expectIncomplete(result)
  })

  it("rejects a digest-valid PASS report with an unresolved blocking finding", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const evidence = { reason: "fabricated PASS" }
    const report = gateReport("baseline-forward", headCommit, {
      findings: [
        {
          classification: "BLOCKING",
          evidence,
          fingerprint: createFindingFingerprint({
            evidence,
            ruleId: "dynamic.fabricated-blocker",
            subject: headCommit,
          }),
          ruleId: "dynamic.fabricated-blocker",
        },
      ],
      outcome: "PASS",
    })
    storeBaselineReport(store, report)

    const result = runPreLiveEvidenceCheck(
      {
        ...input(headCommit),
        baselineForwardDigest: report.digest,
        repositoryRoot: repository.root,
      },
      dependencies(store, headCommit)
    )

    expectIncomplete(result)
  })

  it("rejects an expected digest mismatch on an otherwise self-consistent report", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const report = gateReport("baseline-forward", headCommit)
    storeBaselineReport(store, report)

    const result = runPreLiveEvidenceCheck(
      {
        ...input(headCommit),
        baselineForwardDigest: "b".repeat(64),
        repositoryRoot: repository.root,
      },
      dependencies(store, headCommit)
    )

    expectIncomplete(result)
  })

  it.each(["baselineState", "migration", "invariants", "sqlTests"] as const)(
    "rejects stale or fabricated %s immutable evidence",
    (hashName) => {
      const { headCommit, repository } = createLandedRepository()
      const store = new FakeEvidenceStore()
      const validReport = gateReport("baseline-forward", headCommit)
      const report = finalizeReport({
        ...validReport,
        inputHashes: {
          ...validReport.inputHashes,
          [hashName]: "stale-or-fabricated",
        },
      })
      storeBaselineReport(store, report)

      const result = runPreLiveEvidenceCheck(
        {
          ...input(headCommit),
          baselineForwardDigest: report.digest,
          repositoryRoot: repository.root,
        },
        dependencies(store, headCommit)
      )

      expectIncomplete(result)
    }
  )

  it("rejects arbitrary caller-supplied local report paths", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const report = gateReport("baseline-forward", headCommit)
    storeBaselineReport(store, report)
    const request = {
      ...input(headCommit),
      baselineForwardDigest: report.digest,
      baselineForwardReportPath: "/tmp/fabricated-report.json",
      repositoryRoot: repository.root,
    }

    const result = runPreLiveEvidenceCheck(request, dependencies(store, headCommit))

    expectIncomplete(result)
    expect(store.operations).not.toContain(`read:${BASELINE_RUN_ID}/${ORACLE_REPORT_ARTIFACT}`)
  })

  it("rejects every unknown input property rather than guessing report-path key names", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const report = gateReport("baseline-forward", headCommit)
    storeBaselineReport(store, report)
    const request = {
      ...input(headCommit),
      baselineForwardDigest: report.digest,
      baselineForwardReportFile: "/tmp/fabricated-report.json",
      repositoryRoot: repository.root,
    }

    const result = runPreLiveEvidenceCheck(request, dependencies(store, headCommit))

    expectIncomplete(result)
    expect(store.operations).toEqual([])
  })

  it("does not read baseline-forward evidence when fresh static is non-PASS", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()

    const result = runPreLiveEvidenceCheck(
      { ...input(headCommit), repositoryRoot: repository.root },
      dependencies(store, headCommit, {
        runStatic: () => gateReport("static", headCommit, { outcome: "FAILED" }),
      })
    )

    expectIncomplete(result)
    expect(store.operations).toEqual([])
  })

  it("does not read baseline-forward evidence when static Oracle persistence fails", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    store.persistFailure = true

    const result = runPreLiveEvidenceCheck(
      { ...input(headCommit), repositoryRoot: repository.root },
      dependencies(store, headCommit)
    )

    expectIncomplete(result)
    expect(store.operations).toEqual([`persist:${STATIC_RUN_ID}/${ORACLE_REPORT_ARTIFACT}`])
  })

  it("returns INCOMPLETE for a wrong-project live observation", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const report = gateReport("baseline-forward", headCommit)
    storeBaselineReport(store, report)

    const result = runPreLiveEvidenceCheck(
      {
        ...input(headCommit),
        baselineForwardDigest: report.digest,
        repositoryRoot: repository.root,
      },
      dependencies(store, headCommit, {
        readLiveObservation: () => ({
          capturedAt: "2026-08-23T07:29:00.000Z",
          migrations: [{ name: "candidate", version: "20260819062043" }],
          projectRef: "wrong-project",
          schemaVersion: 1,
          source: "supabase-mcp",
        }),
      })
    )

    expectIncomplete(result)
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "prelive/evidence-invalid" })
    )
  })

  it("returns a blocking failure when live migration high-water is ahead of Oracle", () => {
    const { headCommit, repository } = createLandedRepository()
    const store = new FakeEvidenceStore()
    const report = gateReport("baseline-forward", headCommit)
    storeBaselineReport(store, report)

    const result = runPreLiveEvidenceCheck(
      {
        ...input(headCommit),
        baselineForwardDigest: report.digest,
        repositoryRoot: repository.root,
      },
      dependencies(store, headCommit, {
        readLiveObservation: () => ({
          capturedAt: "2026-08-23T07:29:00.000Z",
          migrations: [
            { name: "candidate", version: "20260819062043" },
            { name: "newer", version: "20260820000000" },
          ],
          projectRef: "cdthersvldpnlbvpufrr",
          schemaVersion: 1,
          source: "supabase-mcp",
        }),
      })
    )

    expect(result.outcome).toBe("FAILED")
    expect(result.requiredChecksComplete).toBe(true)
    expect(result.inputHashes.liveObservation).toMatch(/^[a-f0-9]{64}$/u)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "prelive/baseline-behind-live",
      })
    )
  })
})
