import { createElement, type PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest"

import { COMPARISON_READ_RPC_FUNCTIONS } from "@/lib/technical-configuration-comparison-rpcs"
import { useTechnicalConfigurationComparison } from "../_hooks/useTechnicalConfigurationComparison"
import type {
  TechnicalConfigurationComparisonCriterion,
  TechnicalConfigurationComparisonCriterionWire,
  TechnicalConfigurationComparisonRequest,
  TechnicalConfigurationComparisonWireResponse,
} from "../comparison-types"
import { getTechnicalConfigurationComparison } from "../technical-configuration-comparison-rpc"
import { technicalConfigurationComparisonQueryKey } from "../technical-configuration-query-keys"

const callRpcMock = vi.fn()

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => callRpcMock(...args),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
}

function createQueryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("P10A2 comparison read adapter contract", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
  })

  it("keeps nullable criterion titles aligned with the baseline contract", () => {
    expectTypeOf<TechnicalConfigurationComparisonCriterionWire["title"]>().toEqualTypeOf<
      string | null
    >()
    expectTypeOf<TechnicalConfigurationComparisonCriterion["title"]>().toEqualTypeOf<
      string | null
    >()
  })

  it("forwards the ordered request once and normalizes the fixed response envelope", async () => {
    const request: TechnicalConfigurationComparisonRequest = {
      baselineVersionId: "00000000-0000-0000-0000-000000000005",
      optionIds: ["00000000-0000-0000-0000-000000000003", "00000000-0000-0000-0000-000000000002"],
      page: 2,
      pageSize: 25,
    }
    const signal = new AbortController().signal
    const wireResponse: TechnicalConfigurationComparisonWireResponse = {
      data: {
        dossier: {
          id: "00000000-0000-0000-0000-000000000001",
          device_type_name: "Máy siêu âm",
          name: "Cấu hình máy siêu âm",
          revision: 8,
          archived_at: null,
        },
        baseline_version: {
          id: request.baselineVersionId,
          dossier_id: "00000000-0000-0000-0000-000000000001",
          version_number: 4,
          status: "locked",
          revision: 6,
        },
        options: [
          {
            id: request.optionIds[0],
            supplier_id: "00000000-0000-0000-0000-000000000011",
            supplier_name: "Nhà cung cấp A",
            model: "A-100",
            manufacturer: "Hãng A",
            option_name: null,
            display_label: "Nhà cung cấp A · A-100",
          },
          {
            id: request.optionIds[1],
            supplier_id: "00000000-0000-0000-0000-000000000012",
            supplier_name: "Nhà cung cấp B",
            model: null,
            manufacturer: null,
            option_name: "Phương án B",
            display_label: "Nhà cung cấp B · Phương án B",
          },
        ],
        criteria: [
          {
            group: {
              id: "00000000-0000-0000-0000-000000000021",
              name: "Thông số chính",
              sort_order: 1,
            },
            criterion: {
              id: "00000000-0000-0000-0000-000000000022",
              criterion_code: "TS-01",
              title: null,
              requirement_text: "Tối thiểu 10 MHz",
              sort_order: 2,
            },
            baseline_evidence: {
              document_count: 2,
              citation_count: 3,
              has_evidence: true,
            },
            option_values: [
              {
                option_id: request.optionIds[0],
                comparison_set_id: "00000000-0000-0000-0000-000000000031",
                response: {
                  id: "00000000-0000-0000-0000-000000000032",
                  response_text: "12 MHz",
                  supplementary_information: "Đáp ứng",
                },
                evidence: {
                  document_count: 1,
                  citation_count: 1,
                  has_evidence: true,
                },
              },
              {
                option_id: request.optionIds[1],
                comparison_set_id: null,
                response: null,
                evidence: {
                  document_count: 0,
                  citation_count: 0,
                  has_evidence: false,
                },
              },
            ],
          },
        ],
      },
      total: 42,
      page: request.page,
      page_size: request.pageSize,
    }
    callRpcMock.mockResolvedValueOnce(wireResponse)

    await expect(getTechnicalConfigurationComparison(request, signal)).resolves.toEqual({
      data: {
        dossier: {
          id: wireResponse.data.dossier.id,
          deviceTypeName: "Máy siêu âm",
          name: "Cấu hình máy siêu âm",
          revision: 8,
          archivedAt: null,
        },
        baselineVersion: {
          id: request.baselineVersionId,
          dossierId: wireResponse.data.baseline_version.dossier_id,
          versionNumber: 4,
          status: "locked",
          revision: 6,
        },
        options: [
          {
            id: request.optionIds[0],
            supplierId: "00000000-0000-0000-0000-000000000011",
            supplierName: "Nhà cung cấp A",
            model: "A-100",
            manufacturer: "Hãng A",
            optionName: null,
            displayLabel: "Nhà cung cấp A · A-100",
          },
          {
            id: request.optionIds[1],
            supplierId: "00000000-0000-0000-0000-000000000012",
            supplierName: "Nhà cung cấp B",
            model: null,
            manufacturer: null,
            optionName: "Phương án B",
            displayLabel: "Nhà cung cấp B · Phương án B",
          },
        ],
        criteria: [
          {
            group: {
              id: "00000000-0000-0000-0000-000000000021",
              name: "Thông số chính",
              sortOrder: 1,
            },
            criterion: {
              id: "00000000-0000-0000-0000-000000000022",
              criterionCode: "TS-01",
              title: null,
              requirementText: "Tối thiểu 10 MHz",
              sortOrder: 2,
            },
            baselineEvidence: {
              documentCount: 2,
              citationCount: 3,
              hasEvidence: true,
            },
            optionValues: [
              {
                optionId: request.optionIds[0],
                comparisonSetId: "00000000-0000-0000-0000-000000000031",
                response: {
                  id: "00000000-0000-0000-0000-000000000032",
                  responseText: "12 MHz",
                  supplementaryInformation: "Đáp ứng",
                },
                evidence: {
                  documentCount: 1,
                  citationCount: 1,
                  hasEvidence: true,
                },
              },
              {
                optionId: request.optionIds[1],
                comparisonSetId: null,
                response: null,
                evidence: {
                  documentCount: 0,
                  citationCount: 0,
                  hasEvidence: false,
                },
              },
            ],
          },
        ],
      },
      total: 42,
      page: 2,
      pageSize: 25,
    })

    expect(callRpcMock).toHaveBeenCalledTimes(1)
    expect(callRpcMock).toHaveBeenCalledWith(
      COMPARISON_READ_RPC_FUNCTIONS.getComparison,
      {
        p_baseline_version_id: request.baselineVersionId,
        p_option_ids: request.optionIds,
        p_page: request.page,
        p_page_size: request.pageSize,
      },
      { signal }
    )
  })
})

describe("P10A2 ordered comparison query key", () => {
  it("preserves option order and snapshots every request dimension", () => {
    const optionIds = ["option-a", "option-b"]
    const key = technicalConfigurationComparisonQueryKey({
      baselineVersionId: "baseline-a",
      optionIds,
      page: 2,
      pageSize: 25,
    })

    optionIds.reverse()

    expect(key).toEqual([
      "technical-configurations",
      "comparison",
      "baseline-a",
      ["option-a", "option-b"],
      2,
      25,
    ])
    expect(
      technicalConfigurationComparisonQueryKey({
        baselineVersionId: "baseline-a",
        optionIds: ["option-b", "option-a"],
        page: 2,
        pageSize: 25,
      })
    ).not.toEqual(key)
  })

  it.each([
    ["baseline version", { baselineVersionId: "baseline-b" }],
    ["page", { page: 3 }],
    ["page size", { pageSize: 50 }],
  ])("changes when %s changes", (_dimension, overrides) => {
    const input = {
      baselineVersionId: "baseline-a",
      optionIds: ["option-a", "option-b"],
      page: 2,
      pageSize: 25,
    }

    expect(technicalConfigurationComparisonQueryKey({ ...input, ...overrides })).not.toEqual(
      technicalConfigurationComparisonQueryKey(input)
    )
  })
})

describe("P10A2 dormant comparison query hook", () => {
  const validInput: Parameters<typeof useTechnicalConfigurationComparison>[0] = {
    baselineVersionId: "00000000-0000-0000-0000-000000000005",
    optionIds: ["00000000-0000-0000-0000-000000000003", "00000000-0000-0000-0000-000000000002"],
    page: 1,
    pageSize: 25,
  }

  beforeEach(() => {
    callRpcMock.mockReset()
  })

  it.each<[string, Partial<typeof validInput>]>([
    ["missing baseline", { baselineVersionId: null }],
    ["zero options", { optionIds: [] }],
    ["duplicate options", { optionIds: ["option-a", "option-a"] }],
    [
      "more than eight options",
      { optionIds: Array.from({ length: 9 }, (_, index) => `option-${index}`) },
    ],
    ["page below one", { page: 0 }],
    ["fractional page", { page: 1.5 }],
    ["page size below one", { pageSize: 0 }],
    ["page size above 100", { pageSize: 101 }],
    ["fractional page size", { pageSize: 25.5 }],
  ])("does not fetch for %s", async (_name, overrides) => {
    const queryClient = createTestQueryClient()
    renderHook(() => useTechnicalConfigurationComparison({ ...validInput, ...overrides }), {
      wrapper: createQueryWrapper(queryClient),
    })

    await Promise.resolve()
    expect(callRpcMock).not.toHaveBeenCalled()
  })

  it("fetches once for valid inputs with fixed policy and forwards cancellation", async () => {
    const queryClient = createTestQueryClient()
    const wireResponse: TechnicalConfigurationComparisonWireResponse = {
      data: {
        dossier: {
          id: "00000000-0000-0000-0000-000000000001",
          device_type_name: "Máy siêu âm",
          name: "Cấu hình máy siêu âm",
          revision: 8,
          archived_at: null,
        },
        baseline_version: {
          id: validInput.baselineVersionId,
          dossier_id: "00000000-0000-0000-0000-000000000001",
          version_number: 4,
          status: "locked",
          revision: 6,
        },
        options: [],
        criteria: [],
      },
      total: 0,
      page: validInput.page,
      page_size: validInput.pageSize,
    }
    callRpcMock.mockResolvedValueOnce(wireResponse)

    const { result } = renderHook(() => useTechnicalConfigurationComparison(validInput), {
      wrapper: createQueryWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.comparisonQuery.isSuccess).toBe(true))
    expect(result.current.queryKey).toEqual([
      "technical-configurations",
      "comparison",
      validInput.baselineVersionId,
      validInput.optionIds,
      validInput.page,
      validInput.pageSize,
    ])
    expect(
      queryClient.getQueryCache().find({ queryKey: result.current.queryKey })?.options
    ).toMatchObject({
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    })
    expect(result.current.comparisonQuery.data).toMatchObject({
      total: 0,
      page: 1,
      pageSize: 25,
    })
    expect(callRpcMock).toHaveBeenCalledTimes(1)
    expect(callRpcMock).toHaveBeenCalledWith(
      COMPARISON_READ_RPC_FUNCTIONS.getComparison,
      {
        p_baseline_version_id: validInput.baselineVersionId,
        p_option_ids: validInput.optionIds,
        p_page: validInput.page,
        p_page_size: validInput.pageSize,
      },
      { signal: expect.any(AbortSignal) }
    )
    const forwardedArgs = callRpcMock.mock.calls[0]?.[1] as
      { p_option_ids: readonly string[] } | undefined
    expect(forwardedArgs?.p_option_ids).not.toBe(validInput.optionIds)
  })

  it("aborts the shared transport when the query is cancelled", async () => {
    const queryClient = createTestQueryClient()
    let forwardedSignal: AbortSignal | undefined
    callRpcMock.mockImplementationOnce(
      (_fn: unknown, _args: unknown, { signal }: { signal: AbortSignal }) => {
        forwardedSignal = signal
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
        })
      }
    )

    const { result } = renderHook(() => useTechnicalConfigurationComparison(validInput), {
      wrapper: createQueryWrapper(queryClient),
    })
    await waitFor(() => expect(forwardedSignal).toBeDefined())

    await queryClient.cancelQueries({ queryKey: result.current.queryKey })
    expect(forwardedSignal?.aborted).toBe(true)
  })
})
