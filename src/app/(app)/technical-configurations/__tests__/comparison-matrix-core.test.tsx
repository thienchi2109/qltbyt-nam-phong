import { createElement, type PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationComparisonMatrix } from "../_hooks/useTechnicalConfigurationComparisonMatrix"
import { useTechnicalConfigurationOptionListQuery } from "../_hooks/useTechnicalConfigurationOptionListQuery"
import {
  technicalConfigurationComparisonQueryKey,
  technicalConfigurationOptionsQueryKey,
} from "../technical-configuration-query-keys"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"

import { registerComparisonMatrixRenderingTests } from "./comparison-matrix-rendering-cases"

const listAllOptionsMock = vi.fn()
const listBaselineVersionsMock = vi.fn()
const getComparisonMock = vi.fn()

vi.mock("../technical-configuration-supplier-option-operations", () => ({
  listAllTechnicalConfigurationOptions: (...args: unknown[]) => listAllOptionsMock(...args),
}))

vi.mock("../_hooks/useTechnicalConfigurationBaseline", () => ({
  useTechnicalConfigurationBaseline: () => ({
    listVersions: (...args: unknown[]) => listBaselineVersionsMock(...args),
  }),
}))

vi.mock("../technical-configuration-comparison-rpc", () => ({
  getTechnicalConfigurationComparison: (...args: unknown[]) => getComparisonMock(...args),
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

function createOption(index: number): TechnicalConfigurationOptionWire {
  const suffix = String(index).padStart(12, "0")
  return {
    id: `00000000-0000-0000-0000-${suffix}`,
    dossier_id: "00000000-0000-0000-0000-000000000100",
    supplier_id: `00000000-0000-0000-0001-${suffix}`,
    supplier_name: `Nhà cung cấp ${index}`,
    model: `Model ${index}`,
    manufacturer: null,
    option_name: null,
    notes: null,
    display_label: `Nhà cung cấp ${index} · Model ${index}`,
    created_at: "2026-07-28T00:00:00Z",
    created_by: 1,
    updated_at: "2026-07-28T00:00:00Z",
    updated_by: 1,
    revision: index,
  }
}

function createBaselineVersion(id: string, versionNumber: number) {
  return {
    id,
    dossier_id: "00000000-0000-0000-0000-000000000100",
    version_number: versionNumber,
    status: "locked" as const,
    source_baseline_version_id: null,
    source_version_number: null,
    next_criterion_number: 1,
    revision: versionNumber,
    locked_at: "2026-07-28T00:00:00Z",
    locked_by: 1,
    created_at: "2026-07-28T00:00:00Z",
    created_by: 1,
    updated_at: "2026-07-28T00:00:00Z",
    updated_by: 1,
    groups: [],
  }
}

describe("P10B1 shared option list query", () => {
  beforeEach(() => {
    listAllOptionsMock.mockReset()
  })

  it("uses the dossier option key and delegates once with an AbortSignal", async () => {
    const dossierId = "00000000-0000-0000-0000-000000000001"
    const snapshot = { options: [], revision: 4 }
    const queryClient = createTestQueryClient()
    listAllOptionsMock.mockResolvedValueOnce(snapshot)

    const { result } = renderHook(() => useTechnicalConfigurationOptionListQuery(dossierId), {
      wrapper: createQueryWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.optionsQuery.data).toEqual(snapshot))

    expect(listAllOptionsMock).toHaveBeenCalledTimes(1)
    expect(listAllOptionsMock).toHaveBeenCalledWith(dossierId, expect.any(AbortSignal))
    expect(result.current.queryKey).toEqual(technicalConfigurationOptionsQueryKey(dossierId))
    expect(queryClient.getQueryData(technicalConfigurationOptionsQueryKey(dossierId))).toEqual(
      snapshot
    )
  })

  it("keeps the shared read query stable and side-effect free", async () => {
    const dossierId = "00000000-0000-0000-0000-000000000002"
    const queryClient = createTestQueryClient()
    listAllOptionsMock.mockResolvedValueOnce({ options: [], revision: 2 })

    const { result } = renderHook(() => useTechnicalConfigurationOptionListQuery(dossierId), {
      wrapper: createQueryWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.optionsQuery.isSuccess).toBe(true))

    const query = queryClient
      .getQueryCache()
      .find({ queryKey: technicalConfigurationOptionsQueryKey(dossierId), exact: true })

    expect(query?.options.staleTime).toBe(30_000)
    expect(query?.options.retry).toBe(false)
    expect(query?.options.refetchOnWindowFocus).toBe(false)
  })
})

describe("P10B1 ordered comparison request state", () => {
  const dossierId = "00000000-0000-0000-0000-000000000100"
  const baselineOne = createBaselineVersion("00000000-0000-0000-0000-000000000201", 1)
  const baselineTwo = createBaselineVersion("00000000-0000-0000-0000-000000000202", 2)
  const options = Array.from({ length: 9 }, (_, index) => createOption(index + 1))

  beforeEach(() => {
    listAllOptionsMock.mockReset()
    listBaselineVersionsMock.mockReset()
    getComparisonMock.mockReset()
    listAllOptionsMock.mockResolvedValue({ options, revision: 9 })
    listBaselineVersionsMock.mockResolvedValue({
      data: [baselineTwo, baselineOne],
      total: 2,
      page: 1,
      page_size: 50,
    })
    getComparisonMock.mockImplementation(async (request) => ({
      data: {
        dossier: {
          id: dossierId,
          deviceTypeName: "Máy siêu âm",
          name: "Cấu hình máy siêu âm",
          revision: 9,
          archivedAt: null,
        },
        baselineVersion: {
          id: request.baselineVersionId,
          dossierId,
          versionNumber: 2,
          status: "locked",
          revision: 2,
        },
        options: [],
        criteria: [],
      },
      total: 0,
      page: request.page,
      pageSize: request.pageSize,
    }))
  })

  it("appends and removes options without sorting or accepting duplicates", async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationComparisonMatrix(dossierId), {
      wrapper: createQueryWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.optionsQuery.isSuccess).toBe(true))

    act(() => {
      result.current.addOption(options[2].id)
      result.current.addOption(options[0].id)
      result.current.addOption(options[1].id)
      result.current.addOption(options[0].id)
      result.current.removeOption(options[0].id)
    })

    expect(result.current.selectedOptionIds).toEqual([options[2].id, options[1].id])
  })

  it("blocks a ninth option while leaving it available for a later request", async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationComparisonMatrix(dossierId), {
      wrapper: createQueryWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.optionsQuery.isSuccess).toBe(true))

    act(() => {
      options.forEach((option) => result.current.addOption(option.id))
    })

    expect(result.current.selectedOptionIds).toEqual(options.slice(0, 8).map((option) => option.id))
    expect(result.current.isSelectionLimitReached).toBe(true)
    expect(result.current.options).toContainEqual(options[8])
  })

  it("filters stale option ids without changing the order of survivors", async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationComparisonMatrix(dossierId), {
      wrapper: createQueryWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.optionsQuery.isSuccess).toBe(true))

    act(() => {
      result.current.addOption(options[2].id)
      result.current.addOption(options[0].id)
      result.current.addOption(options[1].id)
    })
    act(() => {
      queryClient.setQueryData(technicalConfigurationOptionsQueryKey(dossierId), {
        options: [options[1], options[2]],
        revision: 10,
      })
    })

    await waitFor(() =>
      expect(result.current.selectedOptionIds).toEqual([options[2].id, options[1].id])
    )
  })

  it("resets page one and uses a fixed immutable comparison request", async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationComparisonMatrix(dossierId), {
      wrapper: createQueryWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.versionsQuery.isSuccess).toBe(true))
    expect(result.current.comparison.comparisonQuery.fetchStatus).toBe("idle")

    act(() => {
      result.current.selectBaselineVersion(baselineTwo.id)
      result.current.setPage(3)
    })
    expect(result.current.page).toBe(3)
    expect(result.current.comparison.comparisonQuery.fetchStatus).toBe("idle")

    act(() => result.current.addOption(options[2].id))
    expect(result.current.page).toBe(1)

    await waitFor(() => expect(getComparisonMock).toHaveBeenCalledTimes(1))
    const firstQueryKey = result.current.comparison.queryKey
    expect(firstQueryKey).toEqual(
      technicalConfigurationComparisonQueryKey({
        baselineVersionId: baselineTwo.id,
        optionIds: [options[2].id],
        page: 1,
        pageSize: 50,
      })
    )

    act(() => {
      result.current.setPage(4)
      result.current.selectBaselineVersion(baselineOne.id)
    })
    expect(result.current.page).toBe(1)
    expect(firstQueryKey[3]).toEqual([options[2].id])
  })
})

registerComparisonMatrixRenderingTests()
