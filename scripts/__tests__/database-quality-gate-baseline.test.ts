import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type FindingIdentity = {
  classification: "BLOCKING" | "DANGEROUS" | "WARNING"
  fingerprint: string
  ruleId: string
}

type BaselineComparison = {
  newFindings: FindingIdentity[]
  outcome: "FAILED" | "PASS"
  resolvedBaselineFindings: FindingIdentity[]
}

type BaselineModule = {
  compareFindingBaseline: (input: {
    baseline: FindingIdentity[]
    current: FindingIdentity[]
  }) => BaselineComparison
}

const LEGACY_FINDING: FindingIdentity = {
  classification: "BLOCKING",
  fingerprint: "legacy-fingerprint",
  ruleId: "migration.legacy-content",
}

const NEW_FINDING: FindingIdentity = {
  classification: "BLOCKING",
  fingerprint: "new-fingerprint",
  ruleId: "migration.legacy-content",
}

describe("database quality gate identity-based baseline comparison", () => {
  it("accepts unchanged historical baseline debt by stable finding identity", async () => {
    const baseline = await loadDatabaseQualityGateModule<BaselineModule>("baseline")

    const result = baseline.compareFindingBaseline({
      baseline: [LEGACY_FINDING],
      current: [LEGACY_FINDING],
    })

    expect(result.outcome).toBe("PASS")
    expect(result.newFindings).toEqual([])
    expect(result.resolvedBaselineFindings).toEqual([])
  })

  it("fails when a new finding replaces a resolved one even if counts are unchanged", async () => {
    const baseline = await loadDatabaseQualityGateModule<BaselineModule>("baseline")

    const result = baseline.compareFindingBaseline({
      baseline: [LEGACY_FINDING],
      current: [NEW_FINDING],
    })

    expect(result.outcome).toBe("FAILED")
    expect(result.newFindings).toEqual([NEW_FINDING])
    expect(result.resolvedBaselineFindings).toEqual([LEGACY_FINDING])
  })

  it("fails when an additional finding appears beside unchanged baseline debt", async () => {
    const baseline = await loadDatabaseQualityGateModule<BaselineModule>("baseline")

    const result = baseline.compareFindingBaseline({
      baseline: [LEGACY_FINDING],
      current: [LEGACY_FINDING, NEW_FINDING],
    })

    expect(result.outcome).toBe("FAILED")
    expect(result.newFindings).toEqual([NEW_FINDING])
  })
})
