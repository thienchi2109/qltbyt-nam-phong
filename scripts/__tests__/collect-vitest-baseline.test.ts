import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"

import {
  buildInventory,
  collectReferenceRankingEvidence,
  getReferenceRankingShardStatus,
  normalizeFailureMessage,
  renderMarkdown,
  runVitestShards,
} from "../collect-vitest-baseline.mjs"
import {
  CURRENT_ROOT,
  currentReports,
  HISTORICAL_ROOT,
  historicalReport,
} from "./collect-vitest-baseline-fixtures"

describe("collect-vitest-baseline", () => {
  it("builds a stable, fully owned inventory with historical reproduction status", () => {
    const inventory = buildInventory({
      currentCommit: "8221f73e5b36b0fc2f19fe929cb5412140aa538b",
      currentReports,
      currentRoot: CURRENT_ROOT,
      historicalCommit: "fe63808f",
      historicalReport,
      historicalRoot: HISTORICAL_ROOT,
      nodeVersion: "v20.20.2",
      rawReportDir: "/tmp/issue-898-8221f73e",
      referenceRanking: {
        shard: 4,
        shardPassed: true,
        standalonePasses: 3,
        testsPerRun: 16,
      },
      vitestVersion: "4.1.10",
    })

    expect(inventory.totals).toEqual({
      failedFiles: 3,
      failedTests: 2,
      pendingTests: 0,
      passedFiles: 1,
      passedTests: 1,
      shards: 4,
      suiteLoadFailures: 1,
      testFiles: 4,
      totalTests: 3,
    })
    expect(inventory.unownedFailures).toEqual([])
    expect(inventory.failures).toHaveLength(3)
    expect(inventory.failures.map((failure) => failure.ownerIssue)).toEqual([918, 916, 925])
    expect(inventory.failures.map((failure) => failure.historical.status)).toEqual([
      "reproduced",
      "changed-signature",
      "not-reproduced",
    ])
    expect(inventory.historical).toMatchObject({
      changedSignatureTests: 1,
      currentTestsStillFail: 1,
      reproducedCurrentFailedTests: 0,
      targetedFiles: 3,
    })
    expect(inventory.failures[0].signature.summary).not.toContain(CURRENT_ROOT)
    expect(inventory.failures[0].signature.summary).not.toContain("\u001b")
    expect(inventory.workstreams.find((workstream) => workstream.batch === "G")).toMatchObject({
      failedFiles: 0,
      failedTests: 0,
      ownerIssue: 922,
    })
  })

  it("normalizes equivalent messages to the same stable signature", () => {
    const current = normalizeFailureMessage(
      `AssertionError: expected ${CURRENT_ROOT}/src/app/page.tsx to contain value\n` +
        ` at ${CURRENT_ROOT}/src/app/page.tsx:10:2`,
      [CURRENT_ROOT]
    )
    const historical = normalizeFailureMessage(
      `AssertionError: expected ${HISTORICAL_ROOT}/src/app/page.tsx to contain value\n` +
        ` at ${HISTORICAL_ROOT}/src/app/page.tsx:99:8`,
      [HISTORICAL_ROOT]
    )

    expect(current).toEqual(historical)
  })

  it("assigns a reproduced reference-ranking failure to issue 922", () => {
    const referenceRankingReport = {
      numFailedTestSuites: 1,
      numFailedTests: 1,
      numPassedTestSuites: 0,
      numPassedTests: 15,
      numPendingTestSuites: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      numTotalTestSuites: 1,
      numTotalTests: 16,
      startTime: Date.UTC(2026, 7, 15, 2, 21, 0),
      success: false,
      testResults: [
        {
          assertionResults: [
            {
              ancestorTitles: ["reference ranking"],
              failureMessages: ["AssertionError: expected ranking order to remain stable"],
              fullName: "reference ranking remains stable",
              status: "failed",
              title: "remains stable",
            },
            ...Array.from({ length: 15 }, (_, index) => ({
              ancestorTitles: ["reference ranking"],
              failureMessages: [],
              fullName: `reference ranking passing case ${index + 1}`,
              status: "passed",
              title: `passing case ${index + 1}`,
            })),
          ],
          message: "",
          name:
            `${CURRENT_ROOT}/src/app/(app)/technical-configurations/__tests__/` +
            "reference-ranking-hook.test.tsx",
          status: "failed",
        },
      ],
    }
    const inventory = buildInventory({
      currentCommit: "8221f73e5b36b0fc2f19fe929cb5412140aa538b",
      currentReports: [{ report: referenceRankingReport, shard: 4 }],
      currentRoot: CURRENT_ROOT,
      historicalCommit: "fe63808f",
      historicalReport,
      historicalRoot: HISTORICAL_ROOT,
      nodeVersion: "v20.20.2",
      rawReportDir: "/tmp/issue-898-8221f73e",
      referenceRanking: null,
      vitestVersion: "4.1.10",
    })

    expect(inventory.failures).toHaveLength(1)
    expect(inventory.failures[0].ownerIssue).toBe(922)
    expect(inventory.historical.targetedFiles).toBe(1)
    expect(inventory.unownedFailures).toEqual([])
  })

  it("renders Markdown with totals, historical evidence, and child ownership", () => {
    const inventory = buildInventory({
      currentCommit: "8221f73e5b36b0fc2f19fe929cb5412140aa538b",
      currentReports,
      currentRoot: CURRENT_ROOT,
      historicalCommit: "fe63808f",
      historicalReport,
      historicalRoot: HISTORICAL_ROOT,
      nodeVersion: "v20.20.2",
      rawReportDir: "/tmp/issue-898-8221f73e",
      referenceRanking: {
        shard: 4,
        shardPassed: true,
        standalonePasses: 3,
        testsPerRun: 16,
      },
      vitestVersion: "4.1.10",
    })

    const markdown = renderMarkdown(inventory)

    expect(markdown).toContain("# Issue #898 Vitest Baseline Inventory")
    expect(markdown).toContain("3 failed files")
    expect(markdown).toContain("2 failed tests")
    expect(markdown).toContain("1 suite-load failure")
    expect(markdown).toContain("[#916]")
    expect(markdown).toContain("[#925]")
    expect(markdown).toContain("fe63808f")
    expect(markdown).toContain("## Reference Ranking")
  })

  it("runs all four shards and accepts nonzero Vitest exits only when JSON exists", () => {
    const reportDir = mkdtempSync(path.join(tmpdir(), "vitest-baseline-"))
    const spawnSyncImpl = vi.fn((_executable: string, args: string[]) => {
      const outputArgument = args.find((argument) => argument.startsWith("--outputFile="))

      if (!outputArgument) {
        throw new Error("missing outputFile argument")
      }

      writeFileSync(outputArgument.slice("--outputFile=".length), "{}\n")
      return { status: 1, stderr: "", stdout: "" }
    })

    try {
      const reportPaths = runVitestShards({
        cwd: "/workspace/current",
        nodeExecutable: "/usr/bin/node",
        reportDir,
        spawnSyncImpl,
      })

      expect(reportPaths).toHaveLength(4)
      expect(spawnSyncImpl).toHaveBeenCalledTimes(4)
      expect(spawnSyncImpl.mock.calls[0][1]).toContain("--shard=1/4")
      expect(spawnSyncImpl.mock.calls[3][1]).toContain("--shard=4/4")
    } finally {
      rmSync(reportDir, { force: true, recursive: true })
    }
  })

  it("rejects a stale shard report when Vitest does not rewrite it", () => {
    const reportDir = mkdtempSync(path.join(tmpdir(), "vitest-baseline-stale-"))
    writeFileSync(path.join(reportDir, "shard-1.json"), "{}\n")

    try {
      expect(() =>
        runVitestShards({
          cwd: "/workspace/current",
          nodeExecutable: "/usr/bin/node",
          reportDir,
          spawnSyncImpl: vi.fn(() => ({ status: 1, stderr: "", stdout: "" })),
        })
      ).toThrow("Vitest shard 1/4 did not write")
    } finally {
      rmSync(reportDir, { force: true, recursive: true })
    }
  })

  it("derives reference-ranking shard status from the matching test file", () => {
    const reports = [
      {
        report: {
          testResults: [
            {
              assertionResults: Array.from({ length: 16 }, (_, index) => ({
                fullName: `reference ranking test ${index + 1}`,
                status: "passed",
                title: `test ${index + 1}`,
              })),
              name:
                `${CURRENT_ROOT}/src/app/(app)/technical-configurations/__tests__/` +
                "reference-ranking-hook.test.tsx",
              status: "passed",
            },
          ],
        },
        shard: 4,
      },
    ]

    expect(getReferenceRankingShardStatus(reports, 4)).toBe(true)
    expect(getReferenceRankingShardStatus(reports, 3)).toBe(false)
    expect(getReferenceRankingShardStatus([], 4)).toBe(false)

    reports[0].report.testResults[0].assertionResults[15].status = "skipped"
    expect(getReferenceRankingShardStatus(reports, 4)).toBe(false)
  })

  it("derives reference-ranking evidence from retained standalone JSON reports", () => {
    const reportDir = mkdtempSync(path.join(tmpdir(), "reference-ranking-reports-"))
    const assertionResults = Array.from({ length: 16 }, (_, index) => ({
      fullName: `reference ranking test ${index + 1}`,
      status: "passed",
      title: `test ${index + 1}`,
    }))
    const report = {
      numFailedTestSuites: 0,
      numFailedTests: 0,
      numPassedTestSuites: 1,
      numPassedTests: 16,
      numPendingTestSuites: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      numTotalTestSuites: 1,
      numTotalTests: 16,
      success: true,
      testResults: [
        {
          assertionResults,
          name:
            `${CURRENT_ROOT}/src/app/(app)/technical-configurations/__tests__/` +
            "reference-ranking-hook.test.tsx",
          status: "passed",
        },
      ],
    }
    const currentReportsWithReferenceRanking = [{ report, shard: 4 }]

    for (let run = 1; run <= 3; run += 1) {
      writeFileSync(
        path.join(reportDir, `reference-ranking-${run}.json`),
        `${JSON.stringify(report)}\n`
      )
    }

    try {
      expect(
        collectReferenceRankingEvidence({
          currentReports: currentReportsWithReferenceRanking,
          reportDir,
        })
      ).toMatchObject({
        shard: 4,
        shardPassed: true,
        standalonePasses: 3,
        testsPerRun: 16,
      })

      const skippedReport = {
        ...report,
        numPassedTests: 15,
        numPendingTests: 1,
        testResults: [
          {
            ...report.testResults[0],
            assertionResults: report.testResults[0].assertionResults.map((assertion, index) =>
              index === 15 ? { ...assertion, status: "skipped" } : assertion
            ),
          },
        ],
      }
      writeFileSync(
        path.join(reportDir, "reference-ranking-2.json"),
        `${JSON.stringify(skippedReport)}\n`
      )

      expect(() =>
        collectReferenceRankingEvidence({
          currentReports: currentReportsWithReferenceRanking,
          reportDir,
        })
      ).toThrow("Incomplete reference-ranking evidence")
    } finally {
      rmSync(reportDir, { force: true, recursive: true })
    }
  })
})
