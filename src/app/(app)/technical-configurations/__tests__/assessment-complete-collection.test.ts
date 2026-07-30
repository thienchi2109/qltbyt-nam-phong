import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ASSESSMENT_RPC_FUNCTIONS } from "@/lib/technical-configuration-assessment-rpcs"
import type {
  TechnicalConfigurationAssessmentListRpcArgs,
  TechnicalConfigurationAssessmentListWireResponse,
  TechnicalConfigurationAssessmentWire,
} from "../assessment-types"
import {
  createAssessmentTestQueryClient,
  renderCompleteAssessmentsHook,
} from "./assessment-hook-test-support"
import { assessment, assessmentListResponse, comparisonSet } from "./assessment-test-fixtures"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  getOrCreateComparisonSet: vi.fn(),
  readComparisonSet: vi.fn(),
}))

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => mocks.callRpc(...args),
}))

vi.mock("../technical-configuration-option-response-operations", () => ({
  getOrCreateTechnicalConfigurationComparisonSet: (...args: unknown[]) =>
    mocks.getOrCreateComparisonSet(...args),
  readTechnicalConfigurationComparisonSet: (...args: unknown[]) => mocks.readComparisonSet(...args),
}))

function createAssessment(assessmentCriterionId: string, index: number) {
  return {
    ...assessment,
    id: `assessment-${index}`,
    criterion_id: assessmentCriterionId,
    revision: index + 1,
  } satisfies TechnicalConfigurationAssessmentWire
}

function createAssessmentPage({
  data,
  total,
  page,
}: {
  data: TechnicalConfigurationAssessmentWire[]
  total: number
  page: number
}): TechnicalConfigurationAssessmentListWireResponse {
  return { data, total, page, page_size: 100 }
}

function mockAssessmentPages(pages: TechnicalConfigurationAssessmentListWireResponse[]) {
  mocks.callRpc.mockImplementation((fn: string, rawArgs: unknown) => {
    if (fn !== ASSESSMENT_RPC_FUNCTIONS.listAssessments) {
      return Promise.reject(new Error(`Unexpected RPC: ${fn}`))
    }

    const args = rawArgs as TechnicalConfigurationAssessmentListRpcArgs
    if (args.p_page_size !== 100) {
      return Promise.resolve({ ...assessmentListResponse, page_size: args.p_page_size })
    }
    return Promise.resolve(
      pages[args.p_page - 1] ?? createAssessmentPage({ data: [], total: 0, page: args.p_page })
    )
  })
}

describe("P11D complete assessment collection", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
    mocks.getOrCreateComparisonSet.mockReset()
    mocks.readComparisonSet.mockReset()
  })

  it("keeps complete mode side-effect free when the nullable comparison set is absent", async () => {
    mocks.readComparisonSet.mockResolvedValue(null)

    const { result } = renderCompleteAssessmentsHook()

    await waitFor(() => expect(result.current.comparisonSetQuery.isSuccess).toBe(true))
    expect(result.current.completeAssessmentsQuery.fetchStatus).toBe("idle")
    expect(mocks.getOrCreateComparisonSet).not.toHaveBeenCalled()
    expect(mocks.callRpc).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: "zero rows",
      pages: [createAssessmentPage({ data: [], total: 0, page: 1 })],
      expectedCriterionIds: [],
    },
    {
      name: "sparse rows",
      pages: [
        createAssessmentPage({
          data: [createAssessment("criterion-1", 1), createAssessment("criterion-150", 2)],
          total: 2,
          page: 1,
        }),
      ],
      expectedCriterionIds: ["criterion-1", "criterion-150"],
    },
    {
      name: "more than one hundred rows without criterion-page alignment",
      pages: [
        createAssessmentPage({
          data: Array.from({ length: 100 }, (_, index) =>
            createAssessment(`criterion-${index + 1}`, index + 1)
          ),
          total: 101,
          page: 1,
        }),
        createAssessmentPage({
          data: [createAssessment("criterion-from-first-criterion-page", 101)],
          total: 101,
          page: 2,
        }),
      ],
      expectedCriterionIds: [
        ...Array.from({ length: 100 }, (_, index) => `criterion-${index + 1}`),
        "criterion-from-first-criterion-page",
      ],
    },
  ])("collects $name into one map keyed by criterion_id", async (testCase) => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mockAssessmentPages(testCase.pages)

    const { result } = renderCompleteAssessmentsHook()

    await waitFor(() => expect(result.current.completeAssessmentsQuery.isSuccess).toBe(true))
    expect(Object.keys(result.current.completeAssessmentsQuery.data ?? {})).toEqual(
      testCase.expectedCriterionIds
    )
    expect(
      mocks.callRpc.mock.calls.filter(([, rawArgs]) => {
        const args = rawArgs as TechnicalConfigurationAssessmentListRpcArgs
        return args.p_page_size === 100
      })
    ).toHaveLength(testCase.pages.length)
    expect(mocks.callRpc).toHaveBeenCalledTimes(testCase.pages.length)
  })

  it.each([
    {
      name: "duplicate rows",
      pages: [
        createAssessmentPage({
          data: [createAssessment("criterion-1", 1)],
          total: 2,
          page: 1,
        }),
        createAssessmentPage({
          data: [createAssessment("criterion-1", 2)],
          total: 2,
          page: 2,
        }),
      ],
    },
    {
      name: "incomplete rows",
      pages: [
        createAssessmentPage({
          data: [createAssessment("criterion-1", 1)],
          total: 2,
          page: 1,
        }),
        createAssessmentPage({ data: [], total: 2, page: 2 }),
      ],
    },
  ])("rejects $name instead of returning a partial map", async (testCase) => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mockAssessmentPages(testCase.pages)

    const { result } = renderCompleteAssessmentsHook()

    await waitFor(() => expect(result.current.completeAssessmentsQuery.isError).toBe(true))
    expect(result.current.completeAssessmentsQuery.error).toMatchObject({
      message: "Assessment pagination snapshot changed during load.",
    })
  })

  it.each([
    {
      name: "wrong page number",
      page: createAssessmentPage({
        data: [createAssessment("criterion-1", 1)],
        total: 1,
        page: 2,
      }),
    },
    {
      name: "wrong page size",
      page: {
        ...createAssessmentPage({
          data: [createAssessment("criterion-1", 1)],
          total: 1,
          page: 1,
        }),
        page_size: 25,
      },
    },
  ])("rejects a page with $name", async (testCase) => {
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mockAssessmentPages([testCase.page])

    const { result } = renderCompleteAssessmentsHook()

    await waitFor(() => expect(result.current.completeAssessmentsQuery.isError).toBe(true))
    expect(result.current.completeAssessmentsQuery.error).toMatchObject({
      message: "Assessment pagination snapshot changed during load.",
    })
  })

  it("preserves the exact RPC error from complete collection", async () => {
    const rpcError = Object.assign(new Error("assessment_list_forbidden"), {
      code: "42501",
      status: 403,
    })
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation((fn: string, rawArgs: unknown) => {
      const args = rawArgs as TechnicalConfigurationAssessmentListRpcArgs
      if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments && args.p_page_size === 100) {
        return Promise.reject(rpcError)
      }
      return Promise.resolve(assessmentListResponse)
    })

    const { result } = renderCompleteAssessmentsHook()

    await waitFor(() => expect(result.current.completeAssessmentsQuery.isError).toBe(true))
    expect(result.current.completeAssessmentsQuery.error).toBe(rpcError)
  })

  it("propagates cancellation to the active complete-collection RPC", async () => {
    let completeSignal: AbortSignal | undefined
    mocks.readComparisonSet.mockResolvedValue(comparisonSet)
    mocks.callRpc.mockImplementation(
      (
        fn: string,
        rawArgs: unknown,
        options: {
          signal?: AbortSignal
        }
      ) => {
        const args = rawArgs as TechnicalConfigurationAssessmentListRpcArgs
        if (fn === ASSESSMENT_RPC_FUNCTIONS.listAssessments && args.p_page_size === 100) {
          completeSignal = options.signal
          return new Promise((_resolve, reject) => {
            completeSignal?.addEventListener("abort", () => reject(completeSignal?.reason), {
              once: true,
            })
          })
        }
        return Promise.resolve(assessmentListResponse)
      }
    )
    const queryClient = createAssessmentTestQueryClient()
    const { result } = renderCompleteAssessmentsHook(queryClient)

    await waitFor(() => expect(completeSignal).toBeInstanceOf(AbortSignal))
    await act(async () => {
      await queryClient.cancelQueries({
        queryKey: result.current.completeQueryKey,
        exact: true,
      })
    })

    expect(completeSignal?.aborted).toBe(true)
  })
})
