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

type BaselineComparisonInput = {
  baseline: FindingIdentity[]
  current: FindingIdentity[]
}

function identityKey(finding: FindingIdentity): string {
  return [finding.classification, finding.ruleId, finding.fingerprint].join("\u0000")
}

/** Compares current findings to identity-based baseline debt without count-only shortcuts. */
export function compareFindingBaseline(input: BaselineComparisonInput): BaselineComparison {
  const baselineKeys = new Set(input.baseline.map(identityKey))
  const currentKeys = new Set(input.current.map(identityKey))
  const newFindings = input.current.filter((finding) => !baselineKeys.has(identityKey(finding)))
  const resolvedBaselineFindings = input.baseline.filter(
    (finding) => !currentKeys.has(identityKey(finding))
  )

  return {
    newFindings,
    outcome: newFindings.length > 0 ? "FAILED" : "PASS",
    resolvedBaselineFindings,
  }
}
