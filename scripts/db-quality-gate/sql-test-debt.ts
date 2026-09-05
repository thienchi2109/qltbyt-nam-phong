import { createFindingFingerprint } from "./contract"
import { addDynamicFinding, type DynamicRunState } from "./dynamic-lane-report"
import type { SqlTestRegistry } from "./expected-state-registry"
import type { GateFinding } from "./types"
import { accessCatalogSchema, applicationCatalogSchema } from "./expected-state-catalog"
import { stableJsonSha256 } from "./serialization"

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

/** Hashes actual protected object structure/access, so merely calling an object is not a change. */
export function collectDebtObjectHashes(
  catalogs: { access: unknown; application: unknown },
  tests: SqlTestDebtMetadata[]
): Record<string, string> | undefined {
  const access = accessCatalogSchema.safeParse(catalogs.access)
  const application = applicationCatalogSchema.safeParse(catalogs.application)
  if (!access.success || !application.success) return undefined
  const identities = [
    ...new Set(tests.flatMap((test) => test.baselineDebt?.protectedObjects ?? [])),
  ]
  const objects = [
    ...access.data.routines,
    ...access.data.tables,
    ...application.data.relations,
    ...application.data.routines,
  ]
  return Object.fromEntries(
    identities.map((identity) => [
      identity,
      stableJsonSha256(
        objects.filter(
          (object) => object.identity === identity || object.identity.startsWith(`${identity}(`)
        )
      ),
    ])
  )
}

function affectedDebt(
  test: SqlTestDebtMetadata,
  migrations: Array<{ path: string }>,
  state: DynamicRunState
): boolean {
  return (
    migrations.some((migration) => test.requiredForMigrations?.includes(migration.path)) ||
    (test.baselineDebt?.protectedObjects.some(
      (identity) =>
        state.baselineObjectHashes?.[identity] === undefined ||
        state.candidateObjectHashes?.[identity] !== state.baselineObjectHashes[identity]
    ) ??
      true)
  )
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
      affectedDebt(test, input.migrations, input.state)
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
