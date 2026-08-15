import { GITHUB_REPOSITORY } from "./collect-vitest-baseline-config.mjs"

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function escapeTable(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, " ")
}

export function renderMarkdown(inventory) {
  const lines = [
    `# Issue #${inventory.issue} Vitest Baseline Inventory`,
    "",
    `- Commit: \`${inventory.commit}\``,
    `- Collected: ${inventory.collectedAt || "unknown"}`,
    `- Environment: Node \`${inventory.environment.node}\`, Vitest \`${inventory.environment.vitest}\``,
    `- Raw reports: \`${inventory.rawReportDir}\` (not committed)`,
    "",
    "## Summary",
    "",
    `${plural(inventory.totals.failedFiles, "failed file")}, ` +
      `${plural(inventory.totals.failedTests, "failed test")}, and ` +
      `${plural(inventory.totals.suiteLoadFailures, "suite-load failure")}.`,
    "",
    "| Shard | Test files | Failed files | Tests | Failed tests | Pending tests |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...inventory.shards.map(
      (shard) =>
        `| ${shard.shard}/4 | ${shard.testFiles} | ${shard.failedFiles} | ` +
        `${shard.totalTests} | ${shard.failedTests} | ${shard.pendingTests} |`
    ),
    "",
    "## Historical Reproduction",
    "",
    inventory.historical.commit
      ? `${inventory.historical.reproducedCurrentFailedTests}/${inventory.totals.failedTests} ` +
        `current failed test signatures reproduce at \`${inventory.historical.commit}\`; ` +
        `${inventory.historical.currentTestsStillFail}/${inventory.totals.failedTests} ` +
        `tests still fail there, with ${inventory.historical.changedSignatureTests} changed ` +
        `signature. ${inventory.historical.failedFiles}/${inventory.historical.targetedFiles} ` +
        `current failed files fail there, including ` +
        `${inventory.historical.suiteLoadFailures} suite-load failures.`
      : "Historical reproduction was not checked.",
    "",
    "## Workstreams",
    "",
    "| Batch | Owner | Failed files | Failed tests | Suite loads | Classification | Scope |",
    "| --- | --- | ---: | ---: | ---: | --- | --- |",
    ...inventory.workstreams.map(
      (workstream) =>
        `| ${workstream.batch} | [#${workstream.ownerIssue}]` +
        `(https://github.com/${GITHUB_REPOSITORY}/issues/${workstream.ownerIssue}) | ` +
        `${workstream.failedFiles} | ${workstream.failedTests} | ` +
        `${workstream.suiteLoadFailures} | ${workstream.classification} | ` +
        `${escapeTable(workstream.title)} |`
    ),
    "",
    "## Reference Ranking",
    "",
    inventory.referenceRanking
      ? `${inventory.referenceRanking.standalonePasses}/` +
        `${inventory.referenceRanking.standaloneRuns?.length ?? inventory.referenceRanking.standalonePasses} ` +
        `retained standalone reports passed ` +
        `(${inventory.referenceRanking.testsPerRun} tests each); shard ` +
        `${inventory.referenceRanking.shard}/4 also ` +
        `${inventory.referenceRanking.shardPassed ? "passed" : "failed"}. Owner: ` +
        `[#922](https://github.com/${GITHUB_REPOSITORY}/issues/922).`
      : "No stability evidence was recorded.",
    "",
    "## Failures",
    "",
    "| Shard | File | Test | Signature | Historical | Owner |",
    "| --- | --- | --- | --- | --- | --- |",
    ...inventory.failures.map(
      (failure) =>
        `| ${failure.shard}/4 | \`${escapeTable(failure.file)}\` | ` +
        `${escapeTable(failure.test)} | \`${failure.signature.hash}\` ` +
        `${escapeTable(failure.signature.summary)} | ${failure.historical.status} | ` +
        `[#${failure.ownerIssue}](https://github.com/${GITHUB_REPOSITORY}/issues/${failure.ownerIssue}) |`
    ),
    "",
    inventory.unownedFailures.length === 0
      ? "All current failures have an owner issue."
      : `Unowned failures: ${inventory.unownedFailures.length}.`,
    "",
  ]

  return lines.join("\n")
}
