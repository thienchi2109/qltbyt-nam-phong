import { aggregateOutcome, finalizeReport } from "./contract"
import { stableJsonSha256 } from "./serialization"
import { GATE_SCHEMA_VERSION } from "./types"
import type { GateFinding, GateReport, MigrationIdentity } from "./types"

type StaticLaneReportInput = {
  createdAt: string
  findings: GateFinding[]
  incomplete: boolean
  inputHashes: {
    appliedLock: string
    baseline: string
    harness: string
    invariants: string
    sqlTests: string
    waivers: string
  }
  migrationIdentities: MigrationIdentity[]
  runId: string
  subjectCommit: string
}

/** Builds the stable static-lane report after all repository-local checks have run. */
export function finalizeStaticLaneReport(input: StaticLaneReportInput): GateReport {
  const outcome = input.incomplete
    ? "INCOMPLETE"
    : aggregateOutcome({
        evidenceAvailable: true,
        findings: input.findings,
        requiredChecksComplete: true,
      })

  return finalizeReport({
    baselineMigrationHighWater: "unavailable",
    createdAt: input.createdAt,
    digest: "",
    evidenceAvailable: !input.incomplete,
    executorEnvironment: { execution: "local-static" },
    findings: input.findings,
    inputHashes: {
      ...input.inputHashes,
      migration: stableJsonSha256(input.migrationIdentities),
    },
    lane: "static",
    migrationIdentities: input.migrationIdentities,
    outcome,
    requiredChecksComplete: !input.incomplete,
    runId: input.runId,
    schemaVersion: GATE_SCHEMA_VERSION,
    subjectCommit: input.subjectCommit,
  })
}
