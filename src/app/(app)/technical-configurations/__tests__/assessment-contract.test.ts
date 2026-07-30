import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ASSESSMENT_RPC_FUNCTIONS,
  ASSESSMENT_RPC_FUNCTION_NAMES,
} from "@/lib/technical-configuration-assessment-rpcs"
import {
  listTechnicalConfigurationAssessments,
  upsertTechnicalConfigurationAssessment,
} from "../technical-configuration-assessment-rpc"
import {
  technicalConfigurationAssessmentsQueryKey,
  technicalConfigurationAssessmentsQueryKeyPrefix,
} from "../technical-configuration-query-keys"
import {
  assessment,
  assessmentListResponse,
  comparisonSetId,
  criterionId,
} from "./assessment-test-fixtures"

const callRpcMock = vi.hoisted(() => vi.fn())

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => callRpcMock(...args),
}))

describe("P11C assessment RPC manifest and adapter", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
  })

  it("freezes the applied assessment and server-filtered navigation RPC names", () => {
    expect(ASSESSMENT_RPC_FUNCTIONS).toEqual({
      listAssessments: "technical_configuration_assessments_list",
      listEvaluationCriteria: "technical_configuration_evaluation_criteria_list",
      upsertAssessment: "technical_configuration_assessment_upsert",
    })
    expect(ASSESSMENT_RPC_FUNCTION_NAMES).toEqual(Object.values(ASSESSMENT_RPC_FUNCTIONS))
    expect(ASSESSMENT_RPC_FUNCTION_NAMES).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/rank|recommend|ai/i)])
    )
  })

  it("preserves the exact P11B assessment wire fields and canonical axes", () => {
    expect(Object.keys(assessment)).toEqual([
      "id",
      "comparison_set_id",
      "baseline_version_id",
      "criterion_id",
      "technical_axis",
      "evidence_axis",
      "notes",
      "revision",
      "created_by",
      "created_at",
      "updated_by",
      "updated_at",
    ])
  })

  it("forwards the bounded list request and AbortSignal unchanged", async () => {
    const signal = new AbortController().signal
    const args = {
      p_comparison_set_id: comparisonSetId,
      p_page: 1,
      p_page_size: 25,
    }
    callRpcMock.mockResolvedValue(assessmentListResponse)

    await expect(listTechnicalConfigurationAssessments(args, signal)).resolves.toEqual(
      assessmentListResponse
    )
    expect(callRpcMock).toHaveBeenCalledWith(ASSESSMENT_RPC_FUNCTIONS.listAssessments, args, {
      signal,
    })
  })

  it("preserves list adapter errors without remapping", async () => {
    const error = Object.assign(new Error("permission_denied"), {
      code: "42501",
      status: 403,
    })
    callRpcMock.mockRejectedValue(error)

    await expect(
      listTechnicalConfigurationAssessments({
        p_comparison_set_id: comparisonSetId,
        p_page: 1,
        p_page_size: 25,
      })
    ).rejects.toBe(error)
  })

  it("forwards exact nullable axes, notes and row revision on upsert", async () => {
    const args = {
      p_comparison_set_id: comparisonSetId,
      p_criterion_id: criterionId,
      p_technical_axis: null,
      p_evidence_axis: "missing" as const,
      p_notes: null,
      p_expected_revision: 0,
    }
    callRpcMock.mockResolvedValue({ data: assessment })

    await expect(upsertTechnicalConfigurationAssessment(args)).resolves.toEqual({
      data: assessment,
    })
    expect(callRpcMock).toHaveBeenCalledWith(ASSESSMENT_RPC_FUNCTIONS.upsertAssessment, args, {
      signal: undefined,
    })
  })

  it.each([
    ["validation", Object.assign(new Error("validation_error"), { code: "PT422", status: 422 })],
    [
      "authorization",
      Object.assign(new Error("permission_denied"), { code: "42501", status: 403 }),
    ],
    [
      "archived dossier",
      Object.assign(new Error("archived_dossier"), { code: "PT409", status: 409 }),
    ],
    ["stale revision", Object.assign(new Error("stale_revision"), { code: "PT409", status: 409 })],
  ])("preserves %s adapter errors without remapping", async (_label, error) => {
    callRpcMock.mockRejectedValue(error)

    await expect(
      upsertTechnicalConfigurationAssessment({
        p_comparison_set_id: comparisonSetId,
        p_criterion_id: criterionId,
        p_technical_axis: "meets",
        p_evidence_axis: "complete",
        p_notes: "",
        p_expected_revision: 1,
      })
    ).rejects.toBe(error)
  })
})

describe("P11C bounded assessment query key", () => {
  it("builds a comparison-set prefix for invalidating every cached page", () => {
    expect(technicalConfigurationAssessmentsQueryKeyPrefix(comparisonSetId)).toEqual([
      "technical-configurations",
      "assessments",
      comparisonSetId,
    ])
  })

  it("snapshots every bounded list dimension", () => {
    expect(
      technicalConfigurationAssessmentsQueryKey({
        comparisonSetId,
        page: 2,
        pageSize: 50,
      })
    ).toEqual(["technical-configurations", "assessments", comparisonSetId, 2, 50])
  })

  it.each([
    ["comparison set", { comparisonSetId: "other-set" }],
    ["page", { page: 3 }],
    ["page size", { pageSize: 100 }],
  ])("changes when %s changes", (_label, overrides) => {
    const input = {
      comparisonSetId,
      page: 2,
      pageSize: 50,
    }

    expect(technicalConfigurationAssessmentsQueryKey({ ...input, ...overrides })).not.toEqual(
      technicalConfigurationAssessmentsQueryKey(input)
    )
  })
})
