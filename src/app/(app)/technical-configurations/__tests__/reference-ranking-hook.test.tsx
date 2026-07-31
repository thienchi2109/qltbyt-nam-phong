import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { REFERENCE_RANKING_RPC_FUNCTIONS } from "@/lib/technical-configuration-ranking-rpcs"
import type {
  TechnicalConfigurationReferenceRankingItemWire,
  TechnicalConfigurationReferenceRankingListRpcArgs,
  TechnicalConfigurationReferenceRankingPageWireResponse,
} from "../reference-ranking-types"
import { useTechnicalConfigurationReferenceRanking } from "../_hooks/useTechnicalConfigurationReferenceRanking"
import { technicalConfigurationReferenceRankingQueryKey } from "../technical-configuration-query-keys"
import {
  createAssessmentQueryWrapper,
  createAssessmentTestQueryClient,
} from "./assessment-hook-test-support"

const callRpcMock = vi.hoisted(() => vi.fn())

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => callRpcMock(...args),
}))

const dossierId = "00000000-0000-0000-0000-000000000001"
const baselineVersionId = "00000000-0000-0000-0000-000000000002"
const input = { dossierId, baselineVersionId }

function createItem(index: number): TechnicalConfigurationReferenceRankingItemWire {
  return {
    option_id: `option-${index}`,
    supplier_id: `supplier-${index}`,
    supplier_name: `Supplier ${index}`,
    display_label: `Supplier ${index} · Model ${index}`,
    eligibility: "eligible",
    incomplete_criterion_count: 0,
    failed_count: index % 3,
    insufficient_evidence_count: index % 2,
    exceeds_count: 10 - (index % 10),
    rank: index,
  }
}

function createPage({
  page,
  total,
  data,
  snapshotToken = "snapshot-1",
  scopeDossierId = dossierId,
  scopeBaselineVersionId = baselineVersionId,
  pageSize = 100,
}: {
  page: number
  total: number
  data: TechnicalConfigurationReferenceRankingItemWire[]
  snapshotToken?: string
  scopeDossierId?: string
  scopeBaselineVersionId?: string
  pageSize?: number
}): TechnicalConfigurationReferenceRankingPageWireResponse {
  return {
    data,
    dossier_id: scopeDossierId,
    baseline_version_id: scopeBaselineVersionId,
    snapshot_token: snapshotToken,
    total,
    page,
    page_size: pageSize,
  }
}

describe("P12C1 complete reference ranking collector hook", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
  })

  it("stays dormant until the consumer explicitly requests ranking", () => {
    const queryClient = createAssessmentTestQueryClient()

    renderHook(() => useTechnicalConfigurationReferenceRanking(), {
      wrapper: createAssessmentQueryWrapper(queryClient),
    })

    expect(callRpcMock).not.toHaveBeenCalled()
  })

  it("uses a dossier and exact-baseline cache identity", () => {
    expect(technicalConfigurationReferenceRankingQueryKey(input)).toEqual([
      "technical-configurations",
      "reference-ranking",
      dossierId,
      baselineVersionId,
    ])
  })

  it("collects every page with fixed page size 100 before publishing", async () => {
    const firstPageItems = Array.from({ length: 100 }, (_, index) => createItem(index + 1))
    const finalItem = createItem(101)
    const pages = [
      createPage({ page: 1, total: 101, data: firstPageItems }),
      createPage({ page: 2, total: 101, data: [finalItem] }),
    ]
    callRpcMock.mockImplementation((fn: string, rawArgs: unknown) => {
      expect(fn).toBe(REFERENCE_RANKING_RPC_FUNCTIONS.listReferenceRanking)
      const args = rawArgs as TechnicalConfigurationReferenceRankingListRpcArgs
      return Promise.resolve(pages[args.p_page - 1])
    })
    const queryClient = createAssessmentTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationReferenceRanking(), {
      wrapper: createAssessmentQueryWrapper(queryClient),
    })

    const ranking = await act(() => result.current.loadRanking(input))

    expect(ranking).toEqual({
      data: [...firstPageItems, finalItem],
      dossier_id: dossierId,
      baseline_version_id: baselineVersionId,
      snapshot_token: "snapshot-1",
      total: 101,
    })
    expect(callRpcMock).toHaveBeenCalledTimes(2)
    expect(callRpcMock).toHaveBeenNthCalledWith(
      1,
      REFERENCE_RANKING_RPC_FUNCTIONS.listReferenceRanking,
      {
        p_dossier_id: dossierId,
        p_baseline_version_id: baselineVersionId,
        p_page: 1,
        p_page_size: 100,
      },
      { signal: expect.any(AbortSignal) }
    )
    expect(callRpcMock).toHaveBeenNthCalledWith(
      2,
      REFERENCE_RANKING_RPC_FUNCTIONS.listReferenceRanking,
      {
        p_dossier_id: dossierId,
        p_baseline_version_id: baselineVersionId,
        p_page: 2,
        p_page_size: 100,
      },
      { signal: expect.any(AbortSignal) }
    )
    expect(queryClient.getQueryData(technicalConfigurationReferenceRankingQueryKey(input))).toEqual(
      ranking
    )
  })

  it("does not request a page after exact exhaustion", async () => {
    callRpcMock.mockResolvedValue(
      createPage({
        page: 1,
        total: 1,
        data: [createItem(1)],
      })
    )
    const queryClient = createAssessmentTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationReferenceRanking(), {
      wrapper: createAssessmentQueryWrapper(queryClient),
    })

    await act(() => result.current.loadRanking(input))

    expect(callRpcMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    {
      name: "snapshot changes",
      pages: [
        createPage({ page: 1, total: 2, data: [createItem(1)] }),
        createPage({
          page: 2,
          total: 2,
          data: [createItem(2)],
          snapshotToken: "snapshot-2",
        }),
      ],
    },
    {
      name: "scope metadata changes",
      pages: [
        createPage({ page: 1, total: 2, data: [createItem(1)] }),
        createPage({
          page: 2,
          total: 2,
          data: [createItem(2)],
          scopeDossierId: "other-dossier",
        }),
      ],
    },
    {
      name: "total changes",
      pages: [
        createPage({ page: 1, total: 2, data: [createItem(1)] }),
        createPage({ page: 2, total: 3, data: [createItem(2)] }),
      ],
    },
    {
      name: "an early page is empty",
      pages: [
        createPage({ page: 1, total: 2, data: [createItem(1)] }),
        createPage({ page: 2, total: 2, data: [] }),
      ],
    },
    {
      name: "an option key is duplicated",
      pages: [
        createPage({ page: 1, total: 2, data: [createItem(1)] }),
        createPage({ page: 2, total: 2, data: [createItem(1)] }),
      ],
    },
    {
      name: "server page size differs",
      pages: [
        createPage({
          page: 1,
          total: 1,
          data: [createItem(1)],
          pageSize: 99,
        }),
      ],
    },
    {
      name: "response root contains an unexpected field",
      pages: [
        {
          ...createPage({ page: 1, total: 1, data: [createItem(1)] }),
          hidden_score: 99,
        },
      ],
    },
    {
      name: "response root is missing a required field",
      pages: [
        (() => {
          const { snapshot_token: _snapshotToken, ...page } = createPage({
            page: 1,
            total: 1,
            data: [createItem(1)],
          })
          return page
        })(),
      ],
    },
    {
      name: "response item contains an unexpected field",
      pages: [
        createPage({
          page: 1,
          total: 1,
          data: [
            {
              ...createItem(1),
              hidden_score: 99,
            } as TechnicalConfigurationReferenceRankingItemWire,
          ],
        }),
      ],
    },
    {
      name: "response item is missing a required field",
      pages: [
        createPage({
          page: 1,
          total: 1,
          data: [
            (() => {
              const { rank: _rank, ...item } = createItem(1)
              return item as TechnicalConfigurationReferenceRankingItemWire
            })(),
          ],
        }),
      ],
    },
  ])("rejects the full collection when $name", async ({ pages }) => {
    callRpcMock.mockImplementation((_fn: string, rawArgs: unknown) => {
      const args = rawArgs as TechnicalConfigurationReferenceRankingListRpcArgs
      return Promise.resolve(pages[args.p_page - 1])
    })
    const queryClient = createAssessmentTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationReferenceRanking(), {
      wrapper: createAssessmentQueryWrapper(queryClient),
    })

    await expect(act(() => result.current.loadRanking(input))).rejects.toThrow(
      "Reference ranking pagination snapshot changed during load."
    )
    expect(
      queryClient.getQueryData(technicalConfigurationReferenceRankingQueryKey(input))
    ).toBeUndefined()
  })

  it("rejects invalid item invariants without publishing partial ranking", async () => {
    callRpcMock.mockResolvedValue(
      createPage({
        page: 1,
        total: 1,
        data: [
          {
            ...createItem(1),
            eligibility: "incomplete",
            incomplete_criterion_count: 1,
            rank: 1,
          },
        ],
      })
    )
    const queryClient = createAssessmentTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationReferenceRanking(), {
      wrapper: createAssessmentQueryWrapper(queryClient),
    })

    await expect(act(() => result.current.loadRanking(input))).rejects.toThrow(
      "Reference ranking pagination snapshot changed during load."
    )
    expect(
      queryClient.getQueryData(technicalConfigurationReferenceRankingQueryKey(input))
    ).toBeUndefined()
  })
})
