import { aggregateOutcome, reportDigest } from "./contract"
import type { DynamicInputArtifacts } from "./dynamic-lane-inputs"
import { stableJsonSha256 } from "./serialization"
import type { GateReport, SqlTestExecutionEvidence } from "./types"

function samePaths(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((path, index) => path === right[index])
}

function isSqlTestExecutionEvidence(value: unknown): value is SqlTestExecutionEvidence {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const execution = value as Partial<SqlTestExecutionEvidence>
  return [execution.attempted, execution.executed, execution.selected].every(
    (paths) => Array.isArray(paths) && paths.every((path) => typeof path === "string")
  )
}

/** Accepts only intact PASS evidence for the same baseline, harness, registry, and SQL sources. */
export function reusableBaselineControlExecution(input: {
  artifacts: DynamicInputArtifacts
  baselineMigrationHighWater: string
  baselineInputHashes: Record<string, string>
  report: GateReport
}): SqlTestExecutionEvidence | undefined {
  const execution = input.report.baselineControlSqlTestExecution
  const selectedPaths = input.artifacts.sqlTests.map((test) => test.path)
  const immutableHashesMatch =
    [
      "baselineState",
      "catalogBaselineAccess",
      "catalogBaselineApplication",
      "catalogBaselineEnvironment",
    ].every(
      (key) =>
        /^[a-f0-9]{64}$/u.test(input.baselineInputHashes[key] ?? "") &&
        input.report.inputHashes[key] === input.baselineInputHashes[key]
    ) &&
    input.report.inputHashes.harness === input.artifacts.harnessHash &&
    input.report.inputHashes.invariants === stableJsonSha256(input.artifacts.invariants) &&
    input.report.inputHashes.sqlTests === stableJsonSha256(input.artifacts.sqlTestRegistry) &&
    input.report.inputHashes.sqlTestSources === input.artifacts.sqlTestSourcesHash

  if (
    input.report.lane !== "baseline-forward" ||
    input.report.outcome !== "PASS" ||
    aggregateOutcome({
      evidenceAvailable: input.report.evidenceAvailable === true,
      findings: input.report.findings,
      requiredChecksComplete: input.report.requiredChecksComplete === true,
    }) !== "PASS" ||
    input.report.requiredChecksComplete !== true ||
    input.report.evidenceAvailable !== true ||
    input.report.baselineMigrationHighWater !== input.baselineMigrationHighWater ||
    input.report.digest !== reportDigest(input.report) ||
    !immutableHashesMatch ||
    !isSqlTestExecutionEvidence(execution) ||
    !samePaths(execution.selected, selectedPaths) ||
    !samePaths(execution.attempted, selectedPaths) ||
    !samePaths(execution.executed, selectedPaths)
  ) {
    return undefined
  }

  return structuredClone(execution)
}
