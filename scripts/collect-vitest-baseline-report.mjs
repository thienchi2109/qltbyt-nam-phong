import { createHash } from "node:crypto"

import { ISSUE_NUMBER, WORKSTREAMS } from "./collect-vitest-baseline-config.mjs"

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g

function normalizeRoot(root) {
  return root ? root.replaceAll("\\", "/").replace(/\/+$/, "") : ""
}

function normalizeTestPath(filePath, roots = []) {
  let normalized = String(filePath || "").replaceAll("\\", "/")

  for (const root of roots.map(normalizeRoot).filter(Boolean)) {
    if (normalized === root) return "."
    if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1)
  }

  const sourceIndex = normalized.indexOf("/src/")
  const scriptsIndex = normalized.indexOf("/scripts/")
  const index = [sourceIndex, scriptsIndex].filter((value) => value >= 0).sort((a, b) => a - b)[0]

  return index === undefined ? normalized.replace(/^\/+/, "") : normalized.slice(index + 1)
}

export function normalizeFailureMessage(message, roots = []) {
  let normalized = String(message || "")
    .replace(ANSI_PATTERN, "")
    .replaceAll("\\", "/")

  for (const root of roots.map(normalizeRoot).filter(Boolean)) {
    normalized = normalized.replaceAll(root, "<repo>")
  }

  return normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(at\s|❯|\d+\s*\||Serialized Error:)/.test(line))
    .join(" | ")
    .replace(/\s+/g, " ")
    .slice(0, 500)
}

function createSignature(message, roots) {
  const summary = normalizeFailureMessage(message, roots) || "Unknown Vitest failure"
  const hash = createHash("sha256").update(summary).digest("hex").slice(0, 16)

  return { hash, summary }
}

function failedAssertions(result) {
  return (result.assertionResults || []).filter((assertion) => assertion.status === "failed")
}

function findWorkstream(file) {
  return WORKSTREAMS.find((workstream) => workstream.files.includes(file))
}

function historicalResultMap(report, root) {
  if (!report) return new Map()

  return new Map(
    (report.testResults || []).map((result) => [normalizeTestPath(result.name, [root]), result])
  )
}

function compareHistorical(failure, historicalResults, historicalRoot, historicalCommit) {
  if (!historicalCommit || historicalResults.size === 0) {
    return { commit: historicalCommit || null, status: "not-checked" }
  }

  const result = historicalResults.get(failure.file)
  if (!result) {
    return {
      commit: historicalCommit,
      signatureReproduced: false,
      status: "not-reproduced",
      testStillFails: false,
    }
  }

  if (failure.kind === "suite-load") {
    const suiteLoadStillFails = result.status === "failed" && failedAssertions(result).length === 0
    if (!suiteLoadStillFails) {
      return {
        commit: historicalCommit,
        signatureReproduced: false,
        status: "not-reproduced",
        testStillFails: false,
      }
    }

    const signature = createSignature(result.message || "", [historicalRoot])
    const signatureReproduced = signature.hash === failure.signature.hash

    return {
      commit: historicalCommit,
      signature,
      signatureReproduced,
      status: signatureReproduced ? "reproduced" : "changed-signature",
      testStillFails: true,
    }
  }

  const matchingAssertion = failedAssertions(result).find(
    (assertion) => (assertion.fullName || assertion.title) === failure.test
  )

  if (!matchingAssertion) {
    return {
      commit: historicalCommit,
      signatureReproduced: false,
      status: "not-reproduced",
      testStillFails: false,
    }
  }

  const signature = createSignature((matchingAssertion.failureMessages || []).join("\n"), [
    historicalRoot,
  ])
  const signatureReproduced = signature.hash === failure.signature.hash

  return {
    commit: historicalCommit,
    signature,
    signatureReproduced,
    status: signatureReproduced ? "reproduced" : "changed-signature",
    testStillFails: true,
  }
}

function shardSummary({ report, shard }) {
  const results = report.testResults || []

  return {
    failedFiles: results.filter((result) => result.status === "failed").length,
    failedTests: report.numFailedTests || 0,
    pendingTests: report.numPendingTests || 0,
    passedFiles: results.filter((result) => result.status === "passed").length,
    passedTests: report.numPassedTests || 0,
    shard,
    success: Boolean(report.success),
    testFiles: results.length,
    totalTests: report.numTotalTests || 0,
  }
}

function collectFailures(
  currentReports,
  currentRoot,
  historicalResults,
  historicalRoot,
  historicalCommit
) {
  const failures = []

  for (const { report, shard } of currentReports) {
    for (const result of (report.testResults || []).filter((item) => item.status === "failed")) {
      const file = normalizeTestPath(result.name, [currentRoot])
      const assertions = failedAssertions(result)
      const workstream = findWorkstream(file)
      const records =
        assertions.length > 0
          ? assertions.map((assertion) => ({
              kind: "test",
              message: (assertion.failureMessages || []).join("\n"),
              test: assertion.fullName || assertion.title,
            }))
          : [{ kind: "suite-load", message: result.message || "", test: "[suite load]" }]

      for (const record of records) {
        const failure = {
          classification: workstream?.classification || "unclassified",
          file,
          kind: record.kind,
          ownerIssue: workstream?.ownerIssue || null,
          rootCause: workstream?.rootCause || "No workstream matched this failure",
          shard,
          signature: createSignature(record.message, [currentRoot]),
          test: record.test,
        }

        failures.push({
          ...failure,
          historical: compareHistorical(
            failure,
            historicalResults,
            historicalRoot,
            historicalCommit
          ),
        })
      }
    }
  }

  return failures
}

function summarizeWorkstreams(failures) {
  return WORKSTREAMS.map((workstream) => {
    const owned = failures.filter((failure) => failure.ownerIssue === workstream.ownerIssue)

    return {
      ...workstream,
      failedFiles: new Set(owned.map((failure) => failure.file)).size,
      failedTests: owned.filter((failure) => failure.kind === "test").length,
      suiteLoadFailures: owned.filter((failure) => failure.kind === "suite-load").length,
    }
  })
}

function inferCollectedAt(currentReports) {
  const starts = currentReports
    .map(({ report }) => report.startTime)
    .filter((value) => Number.isFinite(value))

  return starts.length > 0 ? new Date(Math.min(...starts)).toISOString() : null
}

export function buildInventory({
  currentCommit,
  currentReports,
  currentRoot,
  historicalCommit = null,
  historicalReport = null,
  historicalRoot = null,
  nodeVersion,
  rawReportDir,
  referenceRanking,
  vitestVersion,
}) {
  const historicalResults = historicalResultMap(historicalReport, historicalRoot)
  const failures = collectFailures(
    currentReports,
    currentRoot,
    historicalResults,
    historicalRoot,
    historicalCommit
  )
  const shards = currentReports.map(shardSummary).sort((left, right) => left.shard - right.shard)
  const totals = shards.reduce(
    (summary, shard) => ({
      failedFiles: summary.failedFiles + shard.failedFiles,
      failedTests: summary.failedTests + shard.failedTests,
      pendingTests: summary.pendingTests + shard.pendingTests,
      passedFiles: summary.passedFiles + shard.passedFiles,
      passedTests: summary.passedTests + shard.passedTests,
      shards: summary.shards + 1,
      suiteLoadFailures: summary.suiteLoadFailures,
      testFiles: summary.testFiles + shard.testFiles,
      totalTests: summary.totalTests + shard.totalTests,
    }),
    {
      failedFiles: 0,
      failedTests: 0,
      pendingTests: 0,
      passedFiles: 0,
      passedTests: 0,
      shards: 0,
      suiteLoadFailures: failures.filter((failure) => failure.kind === "suite-load").length,
      testFiles: 0,
      totalTests: 0,
    }
  )
  const failedFiles = [...new Set(failures.map((failure) => failure.file))].sort()
  const historicalReproducedTests = failures.filter(
    (failure) => failure.kind === "test" && failure.historical.status === "reproduced"
  ).length
  const historicalTestsStillFail = failures.filter(
    (failure) => failure.kind === "test" && failure.historical.testStillFails
  ).length
  const historicalChangedSignatureTests = failures.filter(
    (failure) => failure.kind === "test" && failure.historical.status === "changed-signature"
  ).length
  const historicalTestResults = historicalReport?.testResults || []
  const historicalFailedResults = historicalTestResults.filter(
    (result) => result.status === "failed"
  )
  const historicalCommand = historicalReport
    ? `CI=1 node scripts/npm-run.js npx vitest run ${failedFiles
        .map((file) => `'${file.replaceAll("'", "'\\''")}'`)
        .join(
          " "
        )} --reporter=json --outputFile=/tmp/issue-898-${historicalCommit}/current-failing-files.json --no-color`
    : null

  return {
    collectedAt: inferCollectedAt(currentReports),
    commands: Array.from(
      { length: 4 },
      (_, index) =>
        `CI=1 node scripts/npm-run.js npx vitest run --shard=${index + 1}/4 ` +
        `--reporter=json --outputFile=${rawReportDir}/shard-${index + 1}.json --no-color`
    ),
    commit: currentCommit,
    environment: { node: nodeVersion, vitest: vitestVersion },
    failedFiles,
    failures,
    historical: {
      command: historicalCommand,
      changedSignatureTests: historicalChangedSignatureTests,
      commit: historicalCommit,
      currentTestsStillFail: historicalTestsStillFail,
      failedFiles: historicalFailedResults.length,
      failedTests: historicalReport?.numFailedTests ?? null,
      reproducedCurrentFailedTests: historicalReproducedTests,
      suiteLoadFailures: historicalFailedResults.filter(
        (result) => failedAssertions(result).length === 0
      ).length,
      targetedFiles: historicalReport ? failedFiles.length : 0,
      totalTests: historicalReport?.numTotalTests ?? null,
    },
    issue: ISSUE_NUMBER,
    rawReportDir,
    referenceRanking,
    schemaVersion: 1,
    shards,
    totals,
    unownedFailures: failures
      .filter((failure) => failure.ownerIssue === null)
      .map(({ file, shard, test }) => ({ file, shard, test })),
    workstreams: summarizeWorkstreams(failures),
  }
}
