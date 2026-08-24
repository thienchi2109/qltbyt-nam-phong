import { rmSync, writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { firstParentCommit } from "../db-quality-gate/git-evidence"
import { cleanupFixtureRepositories } from "./database-quality-gate-test-support"
import {
  commitWorkflowApprovals,
  prepareApprovalWorkflow,
  runLandedWorkflow,
  workflowApproval,
} from "./database-quality-gate-static-approval-test-support"

afterEach(cleanupFixtureRepositories)

describe("database quality gate static approval-chain integrity", () => {
  it("fails closed when the approval commit adds another migration", async () => {
    const { source, workflow } = await prepareApprovalWorkflow()
    writeFileSync(
      workflow.repository.path("supabase/migrations/20270101000001_unreviewed.sql"),
      "-- migration\nBEGIN;\nSELECT 2;\nCOMMIT;\n"
    )
    const finalCommit = commitWorkflowApprovals(workflow, [workflowApproval(workflow)])

    expect(runLandedWorkflow(source, workflow, finalCommit).outcome).toBe("INCOMPLETE")
  })

  it("fails closed when the approval commit deletes the reviewed migration", async () => {
    const { source, workflow } = await prepareApprovalWorkflow()
    rmSync(workflow.repository.path(workflow.candidate.path))
    const finalCommit = commitWorkflowApprovals(workflow, [workflowApproval(workflow)])

    expect(runLandedWorkflow(source, workflow, finalCommit).outcome).toBe("INCOMPLETE")
  })

  it("fails closed when the committed waiver names a non-parent candidate", async () => {
    const { source, workflow } = await prepareApprovalWorkflow()
    const wrongCandidate = firstParentCommit(workflow.repository.root, workflow.candidateCommit)
    if (wrongCandidate === undefined) {
      throw new Error("Candidate fixture must have a first parent")
    }
    const finalCommit = commitWorkflowApprovals(workflow, [
      workflowApproval(workflow, { candidateCommit: wrongCandidate }),
    ])

    expect(runLandedWorkflow(source, workflow, finalCommit).outcome).toBe("INCOMPLETE")
  })
})
