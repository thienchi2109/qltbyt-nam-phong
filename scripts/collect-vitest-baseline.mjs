#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { DEFAULT_JSON_OUTPUT, DEFAULT_MARKDOWN_OUTPUT } from "./collect-vitest-baseline-config.mjs"
import {
  readReportManifest,
  readVitestReport,
  REPORT_MANIFEST_FILE,
  writeReportManifest,
} from "./collect-vitest-baseline-input.mjs"
import { buildInventory, normalizeFailureMessage } from "./collect-vitest-baseline-report.mjs"
import { renderMarkdown } from "./collect-vitest-baseline-render.mjs"

export { buildInventory, normalizeFailureMessage, renderMarkdown }

const REFERENCE_RANKING_FILE =
  "src/app/(app)/technical-configurations/__tests__/reference-ranking-hook.test.tsx"
const REFERENCE_RANKING_RUNS = 3
const REFERENCE_RANKING_TESTS = 16

function referenceRankingResult(report) {
  return report?.testResults?.find((entry) =>
    entry.name.replaceAll("\\", "/").endsWith("/reference-ranking-hook.test.tsx")
  )
}

function referenceRankingPassed(result) {
  const assertions = result?.assertionResults || []

  return (
    result?.status === "passed" &&
    referenceRankingComplete(result) &&
    assertions.every((assertion) => assertion.status === "passed")
  )
}

function referenceRankingComplete(result) {
  const assertions = result?.assertionResults || []

  return (
    assertions.length === REFERENCE_RANKING_TESTS &&
    assertions.every((assertion) => assertion.status === "passed" || assertion.status === "failed")
  )
}

export function getReferenceRankingShardStatus(currentReports, shard) {
  const shardReport = currentReports.find((entry) => entry.shard === shard)?.report
  return referenceRankingPassed(referenceRankingResult(shardReport))
}

function runVitestJson({ args, cwd, label, nodeExecutable, outputFile, spawnSyncImpl }) {
  rmSync(outputFile, { force: true })
  const result = spawnSyncImpl(
    nodeExecutable,
    [
      "scripts/npm-run.js",
      "npx",
      "vitest",
      "run",
      ...args,
      "--reporter=json",
      `--outputFile=${outputFile}`,
      "--no-color",
    ],
    { cwd, encoding: "utf8", env: { ...process.env, CI: "1" }, stdio: "inherit" }
  )

  if (result?.error) throw result.error
  if (!existsSync(outputFile)) throw new Error(`${label} did not write ${outputFile}`)
  return outputFile
}

export function runVitestShards({
  cwd = process.cwd(),
  nodeExecutable = process.execPath,
  reportDir,
  spawnSyncImpl = spawnSync,
}) {
  mkdirSync(reportDir, { recursive: true })
  const reportPaths = []

  for (let shard = 1; shard <= 4; shard += 1) {
    const outputFile = path.join(reportDir, `shard-${shard}.json`)
    reportPaths.push(
      runVitestJson({
        args: [`--shard=${shard}/4`],
        cwd,
        label: `Vitest shard ${shard}/4`,
        nodeExecutable,
        outputFile,
        spawnSyncImpl,
      })
    )
  }

  return reportPaths
}

export function runReferenceRankingChecks({
  cwd = process.cwd(),
  nodeExecutable = process.execPath,
  reportDir,
  spawnSyncImpl = spawnSync,
}) {
  mkdirSync(reportDir, { recursive: true })

  return Array.from({ length: REFERENCE_RANKING_RUNS }, (_, index) => {
    const run = index + 1
    const outputFile = path.join(reportDir, `reference-ranking-${run}.json`)

    return runVitestJson({
      args: [REFERENCE_RANKING_FILE],
      cwd,
      label: `Reference-ranking run ${run}`,
      nodeExecutable,
      outputFile,
      spawnSyncImpl,
    })
  })
}

export function collectReferenceRankingEvidence({ currentReports, reportDir }) {
  const shardEntry = currentReports.find(({ report }) => referenceRankingResult(report))
  const shardResult = referenceRankingResult(shardEntry?.report)
  const standaloneRuns = Array.from({ length: REFERENCE_RANKING_RUNS }, (_, index) => {
    const run = index + 1
    const reportPath = path.join(reportDir, `reference-ranking-${run}.json`)
    const report = readVitestReport(reportPath, `reference-ranking run ${run}`)
    const result = referenceRankingResult(report)
    const assertions = result?.assertionResults || []
    const tests = assertions.length
    const complete = referenceRankingComplete(result)
    const passed = referenceRankingPassed(result)

    return { complete, passed, reportPath, run, tests }
  })
  const passingRuns = standaloneRuns.filter((run) => run.passed)
  const testCounts = new Set(standaloneRuns.map((run) => run.tests))

  const evidence = {
    commands: standaloneRuns.map(
      ({ reportPath }) =>
        `CI=1 node scripts/npm-run.js npx vitest run '${REFERENCE_RANKING_FILE}' ` +
        `--reporter=json --outputFile=${reportPath} --no-color`
    ),
    shard: shardEntry?.shard ?? null,
    shardComplete: referenceRankingComplete(shardResult),
    shardPassed: shardEntry
      ? getReferenceRankingShardStatus(currentReports, shardEntry.shard)
      : false,
    standalonePasses: passingRuns.length,
    standaloneRuns,
    testsPerRun: testCounts.size === 1 ? standaloneRuns[0]?.tests || 0 : null,
  }

  if (
    evidence.shard !== 4 ||
    !evidence.shardComplete ||
    evidence.testsPerRun !== REFERENCE_RANKING_TESTS ||
    evidence.standaloneRuns.some((run) => !run.complete || run.tests !== REFERENCE_RANKING_TESTS)
  ) {
    throw new Error(
      `Incomplete reference-ranking evidence: expected shard 4 and ${REFERENCE_RANKING_RUNS} ` +
        `standalone runs with ${REFERENCE_RANKING_TESTS} completed tests each`
    )
  }

  return evidence
}

function parseArguments(argv) {
  const options = { skipRun: false }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === "--skip-run") {
      options.skipRun = true
      continue
    }
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`)

    const key = argument.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`)
    options[key] = value
    index += 1
  }

  return options
}

function inferReportRoot(report) {
  const name = report?.testResults?.[0]?.name
  if (!name) return null
  const normalized = name.replaceAll("\\", "/")
  const sourceIndex = normalized.indexOf("/src/")
  const scriptsIndex = normalized.indexOf("/scripts/")
  const index = [sourceIndex, scriptsIndex].filter((value) => value >= 0).sort((a, b) => a - b)[0]

  return index === undefined ? null : normalized.slice(0, index)
}

function readVitestVersion(repoRoot) {
  const packagePath = path.join(repoRoot, "node_modules", "vitest", "package.json")
  return JSON.parse(readFileSync(packagePath, "utf8")).version
}

function resolveGitCommit(repoRoot, revision, optionName) {
  try {
    return execFileSync("git", ["rev-parse", "--verify", `${revision}^{commit}`], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim()
  } catch {
    throw new Error(`${optionName} ${revision} does not resolve to a commit`)
  }
}

function formatOutputs(repoRoot, outputPaths) {
  const prettierBin = path.join(repoRoot, "node_modules", "prettier", "bin", "prettier.cjs")
  const prettierConfig = path.join(repoRoot, ".prettierrc.json")
  const prettierIgnore = path.join(repoRoot, ".prettierignore")
  execFileSync(
    process.execPath,
    [
      prettierBin,
      "--write",
      "--ignore-unknown",
      "--config",
      prettierConfig,
      "--ignore-path",
      prettierIgnore,
      "--",
      ...outputPaths,
    ],
    { cwd: repoRoot, stdio: "ignore" }
  )
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv)
  const repoRoot = path.resolve(options["repo-root"] || process.cwd())
  const commit = resolveGitCommit(repoRoot, "HEAD", "HEAD")
  if (options.commit && resolveGitCommit(repoRoot, options.commit, "--commit") !== commit) {
    throw new Error(`--commit ${options.commit} does not match current commit ${commit}`)
  }
  const reportDir = path.resolve(
    options["reports-dir"] || path.join("/tmp", `issue-898-${commit.slice(0, 8)}`)
  )

  if (!options.skipRun) {
    rmSync(path.join(reportDir, REPORT_MANIFEST_FILE), { force: true })
    runReferenceRankingChecks({ cwd: repoRoot, reportDir })
    runVitestShards({ cwd: repoRoot, reportDir })
  } else {
    readReportManifest(reportDir, commit, {
      expectedLabel: "current commit",
      label: "Current Vitest baseline",
    })
  }

  const currentReports = Array.from({ length: 4 }, (_, index) => {
    const reportPath = path.join(reportDir, `shard-${index + 1}.json`)
    const shard = index + 1
    return { report: readVitestReport(reportPath, `shard ${shard}/4`), shard }
  })
  const historicalReportPath = options["historical-report"]
    ? path.resolve(options["historical-report"])
    : null
  const historicalCommit = options["historical-commit"] || null
  if (historicalReportPath && !historicalCommit) {
    throw new Error("--historical-commit is required with --historical-report")
  }
  if (historicalCommit && !historicalReportPath) {
    throw new Error("--historical-report is required with --historical-commit")
  }
  if (historicalReportPath && historicalCommit) {
    readReportManifest(
      path.dirname(historicalReportPath),
      resolveGitCommit(repoRoot, historicalCommit, "--historical-commit"),
      {
        expectedLabel: "historical commit",
        label: "Historical Vitest baseline",
      }
    )
  }
  const historicalReport = historicalReportPath
    ? readVitestReport(historicalReportPath, "historical report")
    : null
  const referenceRanking = collectReferenceRankingEvidence({ currentReports, reportDir })
  if (!options.skipRun) {
    writeReportManifest(reportDir, commit)
  }
  const inventory = buildInventory({
    currentCommit: commit,
    currentReports,
    currentRoot: options["current-root"] || repoRoot,
    historicalCommit,
    historicalReport,
    historicalRoot: options["historical-root"] || inferReportRoot(historicalReport),
    nodeVersion: options["node-version"] || process.version,
    rawReportDir: reportDir,
    referenceRanking,
    vitestVersion: readVitestVersion(repoRoot),
  })
  const jsonOutput = path.resolve(repoRoot, options["output-json"] || DEFAULT_JSON_OUTPUT)
  const markdownOutput = path.resolve(
    repoRoot,
    options["output-markdown"] || DEFAULT_MARKDOWN_OUTPUT
  )

  mkdirSync(path.dirname(jsonOutput), { recursive: true })
  mkdirSync(path.dirname(markdownOutput), { recursive: true })
  writeFileSync(jsonOutput, `${JSON.stringify(inventory, null, 2)}\n`)
  writeFileSync(markdownOutput, renderMarkdown(inventory))
  formatOutputs(repoRoot, [jsonOutput, markdownOutput])

  if (inventory.unownedFailures.length > 0) {
    throw new Error(`${inventory.unownedFailures.length} failures do not have an owner issue`)
  }

  console.log(`Wrote ${jsonOutput}`)
  console.log(`Wrote ${markdownOutput}`)
  return 0
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ""
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
