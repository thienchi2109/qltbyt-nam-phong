import { createFindingFingerprint } from "./contract"
import { addDynamicFinding, type DynamicRunState } from "./dynamic-lane-report"
import type { SqlTestRegistry } from "./expected-state-registry"
import type { GateFinding } from "./types"

type SqlTestDebtMetadata = Pick<
  SqlTestRegistry["tests"][number],
  "path" | "baselineDebt" | "requiredForMigrations"
>

function isExactDebtMatch(
  baseline: GateFinding,
  candidate: GateFinding,
  test: SqlTestDebtMetadata
): boolean {
  const debt = test.baselineDebt
  return (
    debt !== undefined &&
    [baseline, candidate].every(
      (finding) =>
        finding.evidence?.kind === "failed" &&
        finding.evidence.sqlState === debt.sqlState &&
        finding.evidence.failureSignature === debt.failureSignature &&
        finding.evidence.sqlTestSourceSha256 === debt.sourceSha256
    )
  )
}

function affectedDebt(
  test: SqlTestDebtMetadata,
  migrations: Array<{ path: string; content: string }>
): boolean {
  return migrations.some((migration) => {
    if (test.requiredForMigrations?.includes(migration.path)) return true
    // Conservative: comments and literals count as references too. No attempt to infer SQL intent.
    const sql = migration.content
      .toLowerCase()
      .replaceAll('"', "")
      .replaceAll(/\s*\.\s*/gu, ".")
    return (
      test.baselineDebt?.protectedObjects.some((identity) =>
        new RegExp(`(?<![a-z0-9_])${identity.replaceAll(".", "\\.")}(?![a-z0-9_])`, "u").test(sql)
      ) ?? false
    )
  })
}

function warning(baseline: GateFinding, ruleId: string): GateFinding {
  const evidence = baseline.evidence ?? {}
  return {
    classification: "WARNING",
    evidence,
    ruleId,
    fingerprint: createFindingFingerprint({
      evidence,
      ruleId,
      subject: String(evidence.sqlTestPath),
    }),
  }
}

/** Downgrades only reviewed, source-bound, identical failures outside the pending migration scope. */
export function reconcileSqlTestDebt(input: {
  state: DynamicRunState
  sqlTests: SqlTestDebtMetadata[]
  migrations: Array<{ path: string; content: string }>
}): void {
  for (const baseline of input.state.baselineControlFindings) {
    const testPath = baseline.evidence?.sqlTestPath
    if (typeof testPath !== "string" || !input.state.sqlTestExecution.executed.includes(testPath)) {
      addDynamicFinding(input.state, "dynamic.sql-test.comparison-incomplete", String(testPath), {
        path: String(testPath),
      })
      input.state.incomplete = true
      continue
    }
    const candidate = input.state.findings.find(
      (finding) => finding.evidence?.sqlTestPath === testPath
    )
    if (candidate === undefined) {
      input.state.findings.push(warning(baseline, "dynamic.sql-test.baseline-repaired"))
      continue
    }
    const test = input.sqlTests.find((entry) => entry.path === testPath)
    if (
      candidate.ruleId !== "dynamic.run-sql-test.failed" ||
      test === undefined ||
      !isExactDebtMatch(baseline, candidate, test) ||
      affectedDebt(test, input.migrations)
    )
      continue
    candidate.classification = "WARNING"
    candidate.ruleId = "dynamic.sql-test.baseline-debt"
    candidate.evidence = { ...candidate.evidence, debtEvidence: test.baselineDebt!.evidence }
    candidate.fingerprint = createFindingFingerprint({
      evidence: candidate.evidence,
      ruleId: candidate.ruleId,
      subject: testPath,
    })
  }
}
