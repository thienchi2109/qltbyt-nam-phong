import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ASSESSMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-assessment-rpcs"
import type {
  TechnicalConfigurationEvaluationCriterionListRpcArgs,
  TechnicalConfigurationEvaluationCriterionListWireResponse,
} from "../assessment-types"
import { useTechnicalConfigurationEvaluationCriteria } from "../_hooks/useTechnicalConfigurationEvaluationCriteria"
import {
  createAssessmentQueryWrapper,
  createAssessmentTestQueryClient,
} from "./assessment-hook-test-support"
import { baselineVersionId, optionId } from "./assessment-test-fixtures"

const callRpcMock = vi.hoisted(() => vi.fn())

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => callRpcMock(...args),
}))

function createPage(
  page: number,
  total: number,
  criterionIds: readonly string[]
): TechnicalConfigurationEvaluationCriterionListWireResponse {
  return {
    data: criterionIds.map((criterionId, index) => {
      const canonicalIndex = (page - 1) * 50 + index + 1
      return {
        criterion_id: criterionId,
        canonical_index: canonicalIndex,
        canonical_page: Math.ceil(canonicalIndex / 50),
      }
    }),
    total,
    page,
    page_size: 50,
  }
}

describe("P12B2 server-filtered evaluation criteria hook", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
  })

  it("collects every server-filtered page in exact canonical ID order", async () => {
    const firstPageIds = Array.from({ length: 50 }, (_, index) => `criterion-${index + 1}`)
    const pages = [createPage(1, 51, firstPageIds), createPage(2, 51, ["criterion-51"])]
    callRpcMock.mockImplementation((fn: string, rawArgs: unknown) => {
      expect(fn).toBe(ASSESSMENT_RPC_FUNCTIONS.listEvaluationCriteria)
      const args = rawArgs as TechnicalConfigurationEvaluationCriterionListRpcArgs
      return Promise.resolve(pages[args.p_page - 1])
    })
    const queryClient = createAssessmentTestQueryClient()
    const { result } = renderHook(
      () =>
        useTechnicalConfigurationEvaluationCriteria({
          optionId,
          baselineVersionId,
          statusFilter: "fails",
        }),
      { wrapper: createAssessmentQueryWrapper(queryClient) }
    )

    await waitFor(() => expect(result.current.criteriaQuery.isSuccess).toBe(true))

    expect(result.current.criteriaQuery.data?.map((item) => item.criterion_id)).toEqual([
      ...firstPageIds,
      "criterion-51",
    ])
    expect(callRpcMock).toHaveBeenNthCalledWith(
      1,
      ASSESSMENT_RPC_FUNCTIONS.listEvaluationCriteria,
      {
        p_option_id: optionId,
        p_baseline_version_id: baselineVersionId,
        p_status_filter: "fails",
        p_page: 1,
        p_page_size: 50,
      },
      { signal: expect.any(AbortSignal) }
    )
    expect(callRpcMock).toHaveBeenNthCalledWith(
      2,
      ASSESSMENT_RPC_FUNCTIONS.listEvaluationCriteria,
      {
        p_option_id: optionId,
        p_baseline_version_id: baselineVersionId,
        p_status_filter: "fails",
        p_page: 2,
        p_page_size: 50,
      },
      { signal: expect.any(AbortSignal) }
    )
  })
})
