import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export const REPORT_MANIFEST_FILE = "vitest-baseline-manifest.json"
const REPORT_MANIFEST_VERSION = 1
const COUNT_FIELDS = [
  "numFailedTestSuites",
  "numFailedTests",
  "numPassedTestSuites",
  "numPassedTests",
  "numPendingTestSuites",
  "numPendingTests",
  "numTodoTests",
  "numTotalTestSuites",
  "numTotalTests",
]

function inputError(label, message) {
  return new Error(`${label} is not a valid Vitest JSON report: ${message}`)
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${label} is not valid JSON: ${message}`)
  }
}

function requireNonNegativeInteger(report, field, label) {
  if (!Number.isInteger(report[field]) || report[field] < 0) {
    throw inputError(label, `${field} must be a non-negative integer`)
  }
}

function assertionCounts(testResults, label) {
  const counts = {
    failed: 0,
    failedResults: 0,
    passed: 0,
    passedResults: 0,
    pending: 0,
    todo: 0,
    total: 0,
  }

  testResults.forEach((result, resultIndex) => {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw inputError(label, `testResults[${resultIndex}] must be an object`)
    }
    if (typeof result.name !== "string" || result.name.length === 0) {
      throw inputError(label, `testResults[${resultIndex}].name must be a non-empty string`)
    }
    if (!Array.isArray(result.assertionResults)) {
      throw inputError(label, `testResults[${resultIndex}].assertionResults must be an array`)
    }
    if (result.status !== "failed" && result.status !== "passed") {
      throw inputError(label, `testResults[${resultIndex}].status must be failed or passed`)
    }
    counts[`${result.status}Results`] += 1

    let resultFailedAssertions = 0
    result.assertionResults.forEach((assertion, assertionIndex) => {
      if (!assertion || typeof assertion !== "object" || Array.isArray(assertion)) {
        throw inputError(
          label,
          `testResults[${resultIndex}].assertionResults[${assertionIndex}] must be an object`
        )
      }

      switch (assertion.status) {
        case "failed":
          counts.failed += 1
          resultFailedAssertions += 1
          break
        case "passed":
          counts.passed += 1
          break
        case "pending":
        case "skipped":
          counts.pending += 1
          break
        case "todo":
          counts.todo += 1
          break
        default:
          throw inputError(
            label,
            `testResults[${resultIndex}].assertionResults[${assertionIndex}].status is unsupported`
          )
      }
      counts.total += 1
    })
    if (result.status === "passed" && resultFailedAssertions > 0) {
      throw inputError(
        label,
        `testResults[${resultIndex}] is passed but contains ${resultFailedAssertions} failed assertions`
      )
    }
  })

  return counts
}

export function validateVitestReport(report, label) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw inputError(label, "top-level value must be an object")
  }

  for (const field of COUNT_FIELDS) {
    requireNonNegativeInteger(report, field, label)
  }
  if (typeof report.success !== "boolean") {
    throw inputError(label, "success must be a boolean")
  }
  if (!Array.isArray(report.testResults) || report.testResults.length === 0) {
    throw inputError(label, "testResults must be a non-empty array")
  }
  if (report.numTotalTests === 0) {
    throw inputError(label, "numTotalTests must be greater than zero")
  }
  const expectedSuccess = report.numFailedTests === 0 && report.numFailedTestSuites === 0
  if (report.success !== expectedSuccess) {
    throw inputError(label, `success ${report.success} does not match failed test and suite counts`)
  }

  const counts = assertionCounts(report.testResults, label)
  const expectedCounts = {
    failed: report.numFailedTests,
    passed: report.numPassedTests,
    pending: report.numPendingTests,
    todo: report.numTodoTests,
    total: report.numTotalTests,
  }

  for (const [kind, expected] of Object.entries(expectedCounts)) {
    if (counts[kind] !== expected) {
      throw inputError(label, `${kind} assertion count ${counts[kind]} does not match ${expected}`)
    }
  }

  const suiteTotal =
    report.numFailedTestSuites + report.numPassedTestSuites + report.numPendingTestSuites
  if (suiteTotal !== report.numTotalTestSuites) {
    throw inputError(
      label,
      `suite count ${suiteTotal} does not match numTotalTestSuites ${report.numTotalTestSuites}`
    )
  }
  if (report.testResults.length > report.numTotalTestSuites) {
    throw inputError(
      label,
      `test result count ${report.testResults.length} exceeds numTotalTestSuites ${report.numTotalTestSuites}`
    )
  }
  if (counts.failedResults > report.numFailedTestSuites) {
    throw inputError(
      label,
      `failed result count ${counts.failedResults} exceeds numFailedTestSuites ${report.numFailedTestSuites}`
    )
  }
  if (report.numFailedTestSuites > 0 && counts.failedResults === 0) {
    throw inputError(
      label,
      `report declares ${report.numFailedTestSuites} failed suites but has no failed results`
    )
  }
  if (counts.passedResults > report.numPassedTestSuites) {
    throw inputError(
      label,
      `passed result count ${counts.passedResults} exceeds numPassedTestSuites ${report.numPassedTestSuites}`
    )
  }

  return report
}

export function readVitestReport(filePath, label) {
  return validateVitestReport(readJson(filePath, label), label)
}

export function readReportManifest(
  reportDir,
  expectedCommit,
  { expectedLabel = "expected commit", label = "Vitest baseline" } = {}
) {
  const manifestPath = path.join(reportDir, REPORT_MANIFEST_FILE)
  const manifest = readJson(manifestPath, `${label} manifest`)

  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    manifest.version !== REPORT_MANIFEST_VERSION ||
    typeof manifest.commit !== "string"
  ) {
    throw new Error(`${label} manifest has an unsupported schema`)
  }
  if (manifest.commit !== expectedCommit) {
    throw new Error(
      `${label} manifest commit ${manifest.commit} does not match ${expectedLabel} ${expectedCommit}`
    )
  }

  return manifest
}

export function writeReportManifest(reportDir, commit) {
  const manifestPath = path.join(reportDir, REPORT_MANIFEST_FILE)
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ commit, version: REPORT_MANIFEST_VERSION }, null, 2)}\n`
  )
  return manifestPath
}
