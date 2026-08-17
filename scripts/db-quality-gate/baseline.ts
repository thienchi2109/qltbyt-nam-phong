import { compareStrings } from "./serialization"

export type FindingIdentity = {
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

export type IdentityBaseline = {
  evidence: string
  findings: FindingIdentity[]
  schemaVersion: 1
  sourceCommit: string
}

function identityKey(finding: FindingIdentity): string {
  return [finding.classification, finding.ruleId, finding.fingerprint].join("\u0000")
}

function compareFindingIdentity(left: FindingIdentity, right: FindingIdentity): number {
  return compareStrings(identityKey(left), identityKey(right))
}

/** Creates a review-evidence-bound, deterministic identity baseline without treating it as a waiver. */
export function createIdentityBaseline(input: {
  evidence: string
  findings: FindingIdentity[]
  sourceCommit: string
}): IdentityBaseline {
  if (input.evidence.trim().length === 0) {
    throw new Error("Identity baseline evidence is required")
  }

  if (!/^[a-f0-9]{40}$/.test(input.sourceCommit)) {
    throw new Error("Identity baseline source commit must be a full SHA")
  }

  const uniqueFindings = new Map(input.findings.map((finding) => [identityKey(finding), finding]))

  return {
    evidence: input.evidence,
    findings: [...uniqueFindings.values()].sort(compareFindingIdentity),
    schemaVersion: 1,
    sourceCommit: input.sourceCommit,
  }
}

/** Parses deterministic committed baseline evidence without accepting malformed or reordered identities. */
export function parseIdentityBaseline(value: unknown): IdentityBaseline | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 4 ||
    !("evidence" in value) ||
    !("findings" in value) ||
    !("schemaVersion" in value) ||
    !("sourceCommit" in value) ||
    typeof value.evidence !== "string" ||
    !Array.isArray(value.findings) ||
    value.schemaVersion !== 1 ||
    typeof value.sourceCommit !== "string"
  ) {
    return undefined
  }

  const findings = value.findings
  if (
    findings.some(
      (finding) =>
        typeof finding !== "object" ||
        finding === null ||
        Array.isArray(finding) ||
        Object.keys(finding).length !== 3 ||
        !("classification" in finding) ||
        !("fingerprint" in finding) ||
        !("ruleId" in finding) ||
        (finding.classification !== "BLOCKING" &&
          finding.classification !== "DANGEROUS" &&
          finding.classification !== "WARNING") ||
        typeof finding.fingerprint !== "string" ||
        finding.fingerprint.length === 0 ||
        typeof finding.ruleId !== "string" ||
        finding.ruleId.length === 0
    )
  ) {
    return undefined
  }

  try {
    const baseline = createIdentityBaseline({
      evidence: value.evidence,
      findings: findings as FindingIdentity[],
      sourceCommit: value.sourceCommit,
    })

    return baseline.findings.every(
      (finding, index) => identityKey(finding) === identityKey(findings[index] as FindingIdentity)
    ) && baseline.findings.length === findings.length
      ? baseline
      : undefined
  } catch {
    return undefined
  }
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
