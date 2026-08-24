import { mkdirSync, writeFileSync } from "node:fs"

import type { LandedStaticLaneInput } from "../db-quality-gate/static-lane-types"
import type { GateReport } from "../db-quality-gate/types"
import {
  canonicalTerminalNewline,
  fixtureJson,
  loadDatabaseQualityGateModule,
  sha256,
} from "./database-quality-gate-test-support"
import {
  commitWorkingTree,
  dangerousApproval,
  fixtureWithStaticMetadata,
  migration,
  repositoryHead,
  runStatic,
  type StaticLaneModule,
  WAIVERS_PATH,
} from "./database-quality-gate-static-test-support"

export type ApprovalStaticLaneModule = StaticLaneModule & {
  runStaticLaneForLandedCommit: (
    input: LandedStaticLaneInput,
    dependencies?: { now?: () => Date }
  ) => GateReport
}

export type ApprovalWorkflow = {
  candidate: ReturnType<typeof migration>
  candidateCommit: string
  candidateReport: GateReport
  evidencePath: string
  finding: GateReport["findings"][number]
  repository: ReturnType<typeof fixtureWithStaticMetadata>
}

export async function prepareApprovalWorkflow(
  options: {
    persistEvidence?: boolean
  } = {}
): Promise<{ source: ApprovalStaticLaneModule; workflow: ApprovalWorkflow }> {
  const [staticSource, landedSource] = await Promise.all([
    loadDatabaseQualityGateModule<StaticLaneModule>("static-lane"),
    loadDatabaseQualityGateModule<Pick<ApprovalStaticLaneModule, "runStaticLaneForLandedCommit">>(
      "landed-static-lane"
    ),
  ])
  const source = { ...staticSource, ...landedSource }
  const candidate = migration(
    "-- migration\nBEGIN;\nDROP TABLE public.deprecated_table;\nCOMMIT;\n"
  )
  const repository = fixtureWithStaticMetadata()
  const candidateParent = repositoryHead(repository.root)
  mkdirSync(repository.path("supabase", "migrations"), { recursive: true })
  writeFileSync(repository.path(candidate.path), candidate.sql)
  const candidateCommit = commitWorkingTree(repository.root, "commit dangerous candidate")
  const candidateReport = runStatic(
    source,
    repository.root,
    [candidate.path],
    candidateParent,
    candidateCommit
  ) as GateReport
  const finding = candidateReport.findings.find((entry) => entry.classification === "DANGEROUS")
  if (finding === undefined) {
    throw new Error("Dangerous candidate fixture did not produce a DANGEROUS finding")
  }

  const evidencePath = `supabase/db-quality-gate-static-evidence/${candidateCommit}.json`
  if (options.persistEvidence !== false) {
    mkdirSync(repository.path("supabase", "db-quality-gate-static-evidence"), {
      recursive: true,
    })
    writeFileSync(repository.path(evidencePath), fixtureJson(candidateReport))
  }

  return {
    source,
    workflow: {
      candidate,
      candidateCommit,
      candidateReport,
      evidencePath,
      finding,
      repository,
    },
  }
}

export function workflowApproval(
  workflow: ApprovalWorkflow,
  overrides: Record<string, string> = {}
) {
  return dangerousApproval({
    candidateCommit: workflow.candidateCommit,
    candidateReportDigest: workflow.candidateReport.digest,
    findingFingerprint: workflow.finding.fingerprint,
    migrationPath: workflow.candidate.path,
    migrationSha256: sha256(canonicalTerminalNewline(workflow.candidate.sql)),
    ...overrides,
  })
}

export function commitWorkflowApprovals(
  workflow: ApprovalWorkflow,
  approvals: Array<Record<string, unknown>>
): string {
  writeFileSync(
    workflow.repository.path(WAIVERS_PATH),
    fixtureJson({ approvals, schemaVersion: 1 })
  )
  return commitWorkingTree(workflow.repository.root, "commit dangerous approval evidence")
}

export function runLandedWorkflow(
  source: ApprovalStaticLaneModule,
  workflow: ApprovalWorkflow,
  finalCommit: string,
  createdAt = "2026-08-16T15:10:00Z"
) {
  return source.runStaticLaneForLandedCommit(
    {
      createdAt,
      landedParentCommit: workflow.candidateCommit,
      repositoryRoot: workflow.repository.root,
      runId: "phase-2-static-final",
      subjectCommit: finalCommit,
    },
    { now: () => new Date(createdAt) }
  )
}
