import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type FindingClassification = "WARNING" | "DANGEROUS" | "BLOCKING"
type GateOutcome = "PASS" | "FAILED" | "INCOMPLETE"

type Finding = {
  approval?: {
    acceptedForAggregate: boolean
    id: string
  }
  classification: FindingClassification
  fingerprint: string
  ruleId: string
}

type GateReport = {
  baselineMigrationHighWater: string
  createdAt: string
  digest: string
  executorEnvironment: Record<string, string>
  findings: Finding[]
  inputHashes: Record<string, string>
  lane: "static"
  migrationIdentities: Array<{ path: string; sha256: string }>
  outcome: GateOutcome
  runId: string
  schemaVersion: 1
  subjectCommit: string
}

type ContractModule = {
  aggregateOutcome: (input: {
    evidenceAvailable: boolean
    findings: Finding[]
    requiredChecksComplete: boolean
  }) => GateOutcome
  finalizeReport: (report: GateReport) => GateReport
  outcomeExitCode: (outcome: GateOutcome) => 0 | 1 | 2
  renderMarkdownReport: (report: GateReport) => string
  serializeReport: (report: GateReport) => string
}

const WARNING_FINDING: Finding = {
  classification: "WARNING",
  fingerprint: "warning-fingerprint",
  ruleId: "test.warning",
}

const DANGEROUS_FINDING: Finding = {
  classification: "DANGEROUS",
  fingerprint: "dangerous-fingerprint",
  ruleId: "test.dangerous",
}

const APPROVED_DANGEROUS_FINDING: Finding = {
  ...DANGEROUS_FINDING,
  approval: {
    acceptedForAggregate: true,
    id: "approval-1",
  },
}

const BLOCKING_FINDING: Finding = {
  classification: "BLOCKING",
  fingerprint: "blocking-fingerprint",
  ruleId: "test.blocking",
}

function createReport(findings: Finding[], outcome: GateOutcome): GateReport {
  return {
    baselineMigrationHighWater: "20260816044031",
    createdAt: "2026-08-16T09:29:20Z",
    digest: "report-digest",
    executorEnvironment: {
      postgres: "17.6",
      supabase: "v1.26.08",
    },
    findings,
    inputHashes: {
      appliedLock: "lock-hash",
      invariants: "invariants-hash",
      sqlTests: "tests-hash",
      waivers: "waivers-hash",
    },
    lane: "static",
    migrationIdentities: [
      {
        path: "supabase/migrations/20270101000000_add_contract.sql",
        sha256: "migration-hash",
      },
    ],
    outcome,
    runId: "run-123",
    schemaVersion: 1,
    subjectCommit: "a".repeat(40),
  }
}

describe("database quality gate result contract", () => {
  it("returns PASS and exit code 0 only after complete checks with no unresolved dangerous finding", async () => {
    const contract = await loadDatabaseQualityGateModule<ContractModule>("contract")

    const outcome = contract.aggregateOutcome({
      evidenceAvailable: true,
      findings: [WARNING_FINDING],
      requiredChecksComplete: true,
    })

    expect(outcome).toBe("PASS")
    expect(contract.outcomeExitCode(outcome)).toBe(0)
  })

  it("returns FAILED and exit code 1 for an unresolved BLOCKING finding", async () => {
    const contract = await loadDatabaseQualityGateModule<ContractModule>("contract")

    const outcome = contract.aggregateOutcome({
      evidenceAvailable: true,
      findings: [BLOCKING_FINDING],
      requiredChecksComplete: true,
    })

    expect(outcome).toBe("FAILED")
    expect(contract.outcomeExitCode(outcome)).toBe(1)
  })

  it("returns FAILED and exit code 1 for an unresolved DANGEROUS finding", async () => {
    const contract = await loadDatabaseQualityGateModule<ContractModule>("contract")

    const outcome = contract.aggregateOutcome({
      evidenceAvailable: true,
      findings: [DANGEROUS_FINDING],
      requiredChecksComplete: true,
    })

    expect(outcome).toBe("FAILED")
    expect(contract.outcomeExitCode(outcome)).toBe(1)
  })

  it("accepts an approved DANGEROUS finding for aggregate PASS without changing its classification", async () => {
    const contract = await loadDatabaseQualityGateModule<ContractModule>("contract")

    const outcome = contract.aggregateOutcome({
      evidenceAvailable: true,
      findings: [APPROVED_DANGEROUS_FINDING],
      requiredChecksComplete: true,
    })

    expect(APPROVED_DANGEROUS_FINDING.classification).toBe("DANGEROUS")
    expect(outcome).toBe("PASS")
    expect(contract.outcomeExitCode(outcome)).toBe(0)
  })

  it("returns INCOMPLETE and exit code 2 when required evidence is unavailable", async () => {
    const contract = await loadDatabaseQualityGateModule<ContractModule>("contract")

    const outcome = contract.aggregateOutcome({
      evidenceAvailable: false,
      findings: [],
      requiredChecksComplete: false,
    })

    expect(outcome).toBe("INCOMPLETE")
    expect(contract.outcomeExitCode(outcome)).toBe(2)
  })

  it("serializes equivalent reports deterministically and renders Markdown from the JSON report", async () => {
    const contract = await loadDatabaseQualityGateModule<ContractModule>("contract")
    const report = createReport([WARNING_FINDING, BLOCKING_FINDING], "FAILED")
    const reorderedEquivalentReport: GateReport = {
      ...report,
      findings: [BLOCKING_FINDING, WARNING_FINDING],
      inputHashes: {
        waivers: "waivers-hash",
        sqlTests: "tests-hash",
        invariants: "invariants-hash",
        appliedLock: "lock-hash",
      },
    }

    const serializedReport = contract.serializeReport(report)
    const parsedReport = JSON.parse(serializedReport) as GateReport
    const markdown = contract.renderMarkdownReport(parsedReport)

    expect(contract.serializeReport(reorderedEquivalentReport)).toBe(serializedReport)
    expect(parsedReport).toEqual(contract.finalizeReport(report))
    expect(markdown).toContain("run-123")
    expect(markdown).toContain("FAILED")
    expect(markdown).toContain("test.warning")
    expect(markdown).toContain("test.blocking")
    expect(markdown).toContain(parsedReport.digest)
  })
})
