import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, describe, expect, it } from "vitest"

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(TEST_DIR, "../..")
const COLLECTOR_PATH = path.join(REPO_ROOT, "scripts/collect-vitest-baseline.mjs")
const MANIFEST_FILE = "vitest-baseline-manifest.json"
const CURRENT_COMMIT = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
}).trim()
const temporaryDirectories: string[] = []

function createAssertion(index: number, status: "failed" | "passed" | "skipped" = "passed") {
  return {
    ancestorTitles: ["collector input validation"],
    failureMessages: status === "failed" ? ["AssertionError: deterministic failure"] : [],
    fullName: `collector input validation test ${index}`,
    status,
    title: `test ${index}`,
  }
}

function createReport({
  assertions,
  file,
}: {
  assertions: ReturnType<typeof createAssertion>[]
  file: string
}) {
  const failedTests = assertions.filter((assertion) => assertion.status === "failed").length
  const passedTests = assertions.filter((assertion) => assertion.status === "passed").length
  const pendingTests = assertions.filter((assertion) => assertion.status === "skipped").length

  return {
    numFailedTestSuites: failedTests > 0 ? 1 : 0,
    numFailedTests: failedTests,
    numPassedTestSuites: failedTests > 0 ? 0 : 1,
    numPassedTests: passedTests,
    numPendingTestSuites: 0,
    numPendingTests: pendingTests,
    numTodoTests: 0,
    numTotalTestSuites: 1,
    numTotalTests: assertions.length,
    snapshot: {},
    startTime: Date.UTC(2026, 7, 15, 2, 0, 0),
    success: failedTests === 0,
    testResults: [
      {
        assertionResults: assertions,
        message: "",
        name: file,
        status: failedTests > 0 ? "failed" : "passed",
      },
    ],
  }
}

function createReportDirectory() {
  const reportDir = mkdtempSync(path.join(tmpdir(), "vitest-baseline-input-"))
  temporaryDirectories.push(reportDir)
  return reportDir
}

function writeReportSet(
  reportDir: string,
  {
    malformedShard,
    failedReferenceRun,
    manifestCommit = CURRENT_COMMIT,
    skippedReferenceRun,
  }: {
    failedReferenceRun?: number
    malformedShard?: number
    manifestCommit?: string
    skippedReferenceRun?: number
  } = {}
) {
  for (let shard = 1; shard <= 4; shard += 1) {
    const isReferenceShard = shard === 4
    const report = isReferenceShard
      ? createReport({
          assertions: Array.from({ length: 16 }, (_, index) => createAssertion(index + 1)),
          file: path.join(
            REPO_ROOT,
            "src/app/(app)/technical-configurations/__tests__/reference-ranking-hook.test.tsx"
          ),
        })
      : createReport({
          assertions: [createAssertion(1)],
          file: path.join(REPO_ROOT, `src/__tests__/shard-${shard}.test.ts`),
        })

    writeFileSync(
      path.join(reportDir, `shard-${shard}.json`),
      malformedShard === shard ? "{}\n" : `${JSON.stringify(report)}\n`
    )
  }

  for (let run = 1; run <= 3; run += 1) {
    const assertions = Array.from({ length: 16 }, (_, index) =>
      createAssertion(
        index + 1,
        failedReferenceRun === run && index === 15
          ? "failed"
          : skippedReferenceRun === run && index === 15
            ? "skipped"
            : "passed"
      )
    )
    const report = createReport({
      assertions,
      file: path.join(
        REPO_ROOT,
        "src/app/(app)/technical-configurations/__tests__/reference-ranking-hook.test.tsx"
      ),
    })

    writeFileSync(
      path.join(reportDir, `reference-ranking-${run}.json`),
      `${JSON.stringify(report)}\n`
    )
  }

  writeFileSync(
    path.join(reportDir, MANIFEST_FILE),
    `${JSON.stringify({ commit: manifestCommit, version: 1 })}\n`
  )
}

function runCollector(reportDir: string, extraArguments: string[] = []) {
  return spawnSync(
    process.execPath,
    [
      COLLECTOR_PATH,
      "--skip-run",
      "--repo-root",
      REPO_ROOT,
      "--reports-dir",
      reportDir,
      "--output-json",
      path.join(reportDir, "inventory.json"),
      "--output-markdown",
      path.join(reportDir, "inventory.md"),
      ...extraArguments,
    ],
    { cwd: REPO_ROOT, encoding: "utf8" }
  )
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe("collect-vitest-baseline retained input validation", () => {
  it("rejects malformed shard JSON before writing an inventory", () => {
    const reportDir = createReportDirectory()
    writeReportSet(reportDir, { malformedShard: 1 })

    const result = runCollector(reportDir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("shard 1/4")
  })

  it("rejects contradictory success and result statuses", () => {
    const reportDir = createReportDirectory()
    writeReportSet(reportDir)
    const contradictoryReport = createReport({
      assertions: [createAssertion(1, "failed")],
      file: path.join(REPO_ROOT, "src/__tests__/contradictory.test.ts"),
    })
    contradictoryReport.testResults[0].status = "passed"
    writeFileSync(path.join(reportDir, "shard-1.json"), `${JSON.stringify(contradictoryReport)}\n`)

    const result = runCollector(reportDir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("failed assertions")
  })

  it("rejects result statuses that contradict suite counts", () => {
    const reportDir = createReportDirectory()
    writeReportSet(reportDir)
    const contradictoryReport = createReport({
      assertions: [createAssertion(1)],
      file: path.join(REPO_ROOT, "src/__tests__/contradictory-suite.test.ts"),
    })
    contradictoryReport.testResults[0].status = "failed"
    writeFileSync(path.join(reportDir, "shard-1.json"), `${JSON.stringify(contradictoryReport)}\n`)

    const result = runCollector(reportDir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("failed result count")
  })

  it("rejects failed suites without a failed result", () => {
    const reportDir = createReportDirectory()
    writeReportSet(reportDir)
    const contradictoryReport = createReport({
      assertions: [createAssertion(1)],
      file: path.join(REPO_ROOT, "src/__tests__/missing-failed-result.test.ts"),
    })
    contradictoryReport.numFailedTestSuites = 1
    contradictoryReport.numTotalTestSuites = 2
    contradictoryReport.success = false
    writeFileSync(path.join(reportDir, "shard-1.json"), `${JSON.stringify(contradictoryReport)}\n`)

    const result = runCollector(reportDir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("failed suites but has no failed results")
  })

  it("rejects retained reports attributed to another commit", () => {
    const reportDir = createReportDirectory()
    writeReportSet(reportDir, { manifestCommit: "deadbeef" })

    const result = runCollector(reportDir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("does not match current commit")
  })

  it("rejects an arbitrary requested commit", () => {
    const reportDir = createReportDirectory()
    writeReportSet(reportDir)

    const result = runCollector(reportDir, ["--commit", "deadbeef"])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("--commit")
  })

  it("rejects incomplete reference-ranking evidence", () => {
    const reportDir = createReportDirectory()
    writeReportSet(reportDir, { skippedReferenceRun: 2 })

    const result = runCollector(reportDir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("reference-ranking evidence")
  })

  it("rejects a historical report attributed to another commit", () => {
    const reportDir = createReportDirectory()
    const historicalDir = createReportDirectory()
    const historicalReport = path.join(historicalDir, "current-failing-files.json")
    writeReportSet(reportDir)
    writeFileSync(
      historicalReport,
      `${JSON.stringify(
        createReport({
          assertions: [createAssertion(1)],
          file: path.join(REPO_ROOT, "src/__tests__/historical.test.ts"),
        })
      )}\n`
    )
    writeFileSync(
      path.join(historicalDir, MANIFEST_FILE),
      `${JSON.stringify({ commit: "deadbeef", version: 1 })}\n`
    )

    const result = runCollector(reportDir, [
      "--historical-report",
      historicalReport,
      "--historical-commit",
      "fe63808f",
    ])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Historical Vitest baseline manifest")
  })

  it("retains complete failing reference-ranking evidence", () => {
    const reportDir = createReportDirectory()
    writeReportSet(reportDir, { failedReferenceRun: 1 })

    const result = runCollector(reportDir)
    const inventory = JSON.parse(readFileSync(path.join(reportDir, "inventory.json"), "utf8"))

    expect(result.status).toBe(0)
    expect(inventory.referenceRanking).toMatchObject({
      shardPassed: true,
      standalonePasses: 2,
      testsPerRun: 16,
    })
  })
})
