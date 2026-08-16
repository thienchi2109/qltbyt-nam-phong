import { compareStrings, sha256Text, stableJsonSha256, stableJsonStringify } from "./serialization"
import type {
  EvidenceInvalidationKeys,
  GateFinding,
  GateOutcome,
  GateReport,
  MigrationIdentity,
} from "./types"

type AggregateOutcomeInput = {
  evidenceAvailable: boolean
  findings: GateFinding[]
  requiredChecksComplete: boolean
}

type EvidenceInvalidationInput = {
  appliedLockHash: string
  baselineMigrationHighWater: string
  executorEnvironment: Record<string, string>
  harnessVersion: string
  migrationIdentities: MigrationIdentity[]
  registryHashes: Record<string, string>
}

type FindingFingerprintInput = {
  evidence: Record<string, unknown>
  ruleId: string
  subject: string
}

type RuleIdInput = {
  domain: string
  name: string
}

const FINDING_CLASSIFICATION_ORDER: Record<GateFinding["classification"], number> = {
  WARNING: 0,
  DANGEROUS: 1,
  BLOCKING: 2,
}

function normalizeRulePart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (normalized.length === 0) {
    throw new Error("Rule ID parts must contain an ASCII letter or number")
  }

  return normalized
}

function compareFindings(left: GateFinding, right: GateFinding): number {
  return (
    FINDING_CLASSIFICATION_ORDER[left.classification] -
      FINDING_CLASSIFICATION_ORDER[right.classification] ||
    compareStrings(left.ruleId, right.ruleId) ||
    compareStrings(left.fingerprint, right.fingerprint)
  )
}

function compareMigrationIdentities(left: MigrationIdentity, right: MigrationIdentity): number {
  return compareStrings(left.path, right.path) || compareStrings(left.sha256, right.sha256)
}

function normalizedReport(report: GateReport): GateReport {
  return {
    ...report,
    executorEnvironment: Object.fromEntries(
      Object.entries(report.executorEnvironment).sort(([left], [right]) =>
        compareStrings(left, right)
      )
    ),
    findings: [...report.findings].sort(compareFindings),
    inputHashes: Object.fromEntries(
      Object.entries(report.inputHashes).sort(([left], [right]) => compareStrings(left, right))
    ),
    migrationIdentities: [...report.migrationIdentities].sort(compareMigrationIdentities),
  }
}

/** Aggregates findings and evidence completeness into the fail-closed gate outcome. */
export function aggregateOutcome(input: AggregateOutcomeInput): GateOutcome {
  if (!input.evidenceAvailable || !input.requiredChecksComplete) {
    return "INCOMPLETE"
  }

  const hasUnresolvedFailure = input.findings.some(
    (finding) =>
      finding.classification === "BLOCKING" ||
      (finding.classification === "DANGEROUS" && !finding.approval?.acceptedForAggregate)
  )

  return hasUnresolvedFailure ? "FAILED" : "PASS"
}

/** Builds reusable-evidence keys for every input that can invalidate a gate result. */
export function createEvidenceInvalidationKeys(
  input: EvidenceInvalidationInput
): EvidenceInvalidationKeys {
  return {
    appliedLock: input.appliedLockHash,
    baselineMigrationHighWater: input.baselineMigrationHighWater,
    executorEnvironment: stableJsonSha256(input.executorEnvironment),
    harness: input.harnessVersion,
    migration: stableJsonSha256([...input.migrationIdentities].sort(compareMigrationIdentities)),
    registries: stableJsonSha256(input.registryHashes),
  }
}

/** Creates a deterministic finding identity from its rule, subject, and evidence. */
export function createFindingFingerprint(input: FindingFingerprintInput): string {
  return stableJsonSha256({
    evidence: input.evidence,
    ruleId: input.ruleId,
    subject: input.subject,
  })
}

/** Normalizes a rule domain and name into the stable dotted rule identifier. */
export function createRuleId(input: RuleIdInput): string {
  return `${normalizeRulePart(input.domain)}.${normalizeRulePart(input.name)}`
}

/** Maps a gate outcome to its documented process exit code. */
export function outcomeExitCode(outcome: GateOutcome): 0 | 1 | 2 {
  switch (outcome) {
    case "PASS":
      return 0
    case "FAILED":
      return 1
    case "INCOMPLETE":
      return 2
  }
}

/** Calculates the digest of a report with its self-referential digest field cleared. */
export function reportDigest(report: GateReport): string {
  return sha256Text(
    stableJsonStringify({
      ...normalizedReport(report),
      digest: "",
    })
  )
}

/** Normalizes a report and replaces any supplied digest with its calculated value. */
export function finalizeReport(report: GateReport): GateReport {
  const normalized = normalizedReport({
    ...report,
    digest: "",
  })

  return {
    ...normalized,
    digest: reportDigest(normalized),
  }
}

/** Renders a finalized report as deterministic human-readable Markdown. */
export function renderMarkdownReport(report: GateReport): string {
  const normalized = finalizeReport(report)
  const findings = normalized.findings.map(
    (finding) =>
      `| ${finding.classification} | ${finding.ruleId} | ${finding.fingerprint} | ${
        finding.approval?.id ?? ""
      } |`
  )

  return [
    "# Database Quality Gate Report",
    "",
    `- Run: ${normalized.runId}`,
    `- Lane: ${normalized.lane}`,
    `- Outcome: ${normalized.outcome}`,
    `- Subject commit: ${normalized.subjectCommit}`,
    `- Report digest: ${normalized.digest}`,
    "",
    "| Classification | Rule ID | Fingerprint | Approval |",
    "| --- | --- | --- | --- |",
    ...findings,
    "",
  ].join("\n")
}

/** Serializes a finalized report as newline-terminated deterministic JSON. */
export function serializeReport(report: GateReport): string {
  return `${stableJsonStringify(finalizeReport(report))}\n`
}
