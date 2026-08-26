import { createElement, type PropsWithChildren } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationMatrix } from "../_components/comparison/TechnicalConfigurationMatrix"
import { useTechnicalConfigurationComparisonMatrix } from "../_hooks/useTechnicalConfigurationComparisonMatrix"
import {
  technicalConfigurationComparisonQueryKey,
  technicalConfigurationOptionsQueryKey,
} from "../technical-configuration-query-keys"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"

import { createComparisonResult } from "./comparison-matrix-test-fixtures"

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

function createBaselineVersion(id: string) {
  return {
    id,
    dossier_id: "00000000-0000-0000-0000-000000000100",
    version_number: 2,
    status: "locked" as const,
    groups: [],
  }
}

function createManyOptionResult() {
  const result = createComparisonResult()
  const options = Array.from({ length: 8 }, (_, index) => ({
    id: `option-${index + 1}`,
    supplierId: `supplier-${index + 1}`,
    supplierName: `Nhà cung cấp ${index + 1}`,
    model: `Model ${index + 1}`,
    manufacturer: null,
    optionName: null,
    displayLabel: `Nhà cung cấp ${index + 1} · Model ${index + 1}`,
  }))

  return {
    ...result,
    page: 1,
    total: result.data.criteria.length,
    data: {
      ...result.data,
      options,
      criteria: result.data.criteria.map((row) => ({ ...row, optionValues: [] })),
    },
  }
}

describe("P10B2 comparison column view state", () => {
  const dossierId = "00000000-0000-0000-0000-000000000100"
  const baseline = createBaselineVersion("00000000-0000-0000-0000-000000000201")
  const options = Array.from({ length: 4 }, (_, index) => createOption(index + 1))

  beforeEach(() => {
    listAllOptionsMock.mockReset()
    listBaselineVersionsMock.mockReset()
    getComparisonMock.mockReset()
    listAllOptionsMock.mockResolvedValue({ options, revision: 4 })
    listBaselineVersionsMock.mockResolvedValue({
      data: [baseline],
      total: 1,
      page: 1,
      page_size: 50,
    })
    getComparisonMock.mockImplementation(
      async (request: {
        baselineVersionId: string
        optionIds: readonly string[]
        page: number
        pageSize: number
      }) => ({
        data: {
          dossier: {
            id: dossierId,
            deviceTypeName: "Máy siêu âm",
            name: "Cấu hình máy siêu âm",
            revision: 4,
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
      })
    )
  })

  it("hides and shows an option without changing request membership or the query key", async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationComparisonMatrix(dossierId), {
      wrapper: createQueryWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.optionsQuery.isSuccess).toBe(true))
    act(() => {
      result.current.selectBaselineVersion(baseline.id)
      result.current.addOption(options[2].id)
      result.current.addOption(options[0].id)
      result.current.addOption(options[1].id)
    })
    await waitFor(() => expect(getComparisonMock).toHaveBeenCalledTimes(1))
    const requestOptionIds = [options[2].id, options[0].id, options[1].id]
    const queryKeyBeforeVisibilityChange = result.current.comparison.queryKey

    act(() => result.current.toggleOptionVisibility(options[0].id))

    expect(result.current.selectedOptionIds).toEqual(requestOptionIds)
    expect(result.current.visibleOptionIds).toEqual([options[2].id, options[1].id])
    expect(result.current.comparison.queryKey).toEqual(queryKeyBeforeVisibilityChange)
    expect(result.current.comparison.queryKey).toEqual(
      technicalConfigurationComparisonQueryKey({
        baselineVersionId: baseline.id,
        optionIds: requestOptionIds,
        page: 1,
        pageSize: 50,
      })
    )
    expect(getComparisonMock).toHaveBeenCalledTimes(1)

    act(() => result.current.toggleOptionVisibility(options[0].id))

    expect(result.current.visibleOptionIds).toEqual(requestOptionIds)
    expect(result.current.selectedOptionIds).toEqual(requestOptionIds)
  })

  it("reconciles visible IDs as an ordered subset after option refresh and removal", async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationComparisonMatrix(dossierId), {
      wrapper: createQueryWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.optionsQuery.isSuccess).toBe(true))
    act(() => {
      result.current.addOption(options[2].id)
      result.current.addOption(options[0].id)
      result.current.addOption(options[1].id)
      result.current.toggleOptionVisibility(options[0].id)
    })
    expect(result.current.visibleOptionIds).toEqual([options[2].id, options[1].id])
    act(() => {
      queryClient.setQueryData(technicalConfigurationOptionsQueryKey(dossierId), {
        options: [options[0], options[1]],
        revision: 5,
      })
    })

    await waitFor(() => {
      expect(result.current.selectedOptionIds).toEqual([options[0].id, options[1].id])
      expect(result.current.visibleOptionIds).toEqual([options[1].id])
    })

    act(() => result.current.removeOption(options[1].id))

    expect(result.current.selectedOptionIds).toEqual([options[0].id])
    expect(result.current.visibleOptionIds).toEqual([])
  })

  it("pins at most two visible options in selected order and reconciles hidden pins", async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationComparisonMatrix(dossierId), {
      wrapper: createQueryWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.optionsQuery.isSuccess).toBe(true))
    act(() => {
      result.current.addOption(options[2].id)
      result.current.addOption(options[0].id)
      result.current.addOption(options[1].id)
      result.current.addOption(options[3].id)
      result.current.toggleOptionPin(options[1].id)
      result.current.toggleOptionPin(options[2].id)
      result.current.toggleOptionPin(options[0].id)
    })
    expect(result.current.pinnedOptionIds).toEqual([options[2].id, options[1].id])
    act(() => result.current.toggleOptionVisibility(options[2].id))

    expect(result.current.visibleOptionIds).toEqual([options[0].id, options[1].id, options[3].id])
    expect(result.current.pinnedOptionIds).toEqual([options[1].id])

    act(() => result.current.removeOption(options[1].id))

    expect(result.current.pinnedOptionIds).toEqual([])
    expect(result.current.visibleOptionIds).toEqual([options[0].id, options[3].id])
  })

  it("enters and exits focus mode without mutating visible or pinned state", async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useTechnicalConfigurationComparisonMatrix(dossierId), {
      wrapper: createQueryWrapper(queryClient),
    })
    await waitFor(() => expect(result.current.optionsQuery.isSuccess).toBe(true))

    act(() => {
      options.slice(0, 4).forEach((option) => result.current.addOption(option.id))
      result.current.toggleOptionVisibility(options[1].id)
      result.current.toggleOptionPin(options[0].id)
      result.current.focusOption(options[2].id)
    })

    expect(result.current.focusedOptionId).toBe(options[2].id)
    expect(result.current.visibleOptionIds).toEqual([options[0].id, options[2].id, options[3].id])
    expect(result.current.pinnedOptionIds).toEqual([options[0].id])

    act(() => result.current.exitFocusMode())

    expect(result.current.focusedOptionId).toBeNull()
    expect(result.current.visibleOptionIds).toEqual([options[0].id, options[2].id, options[3].id])
    expect(result.current.pinnedOptionIds).toEqual([options[0].id])
  })
})

describe("P10B2 pinned matrix columns", () => {
  it("renders pinned options first with deterministic sticky offsets", () => {
    const result = createManyOptionResult()
    const visibleOptionIds = result.data.options.map((option) => option.id)
    const pinnedOptionIds = [result.data.options[3].id, result.data.options[1].id]

    render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={result}
        visibleOptionIds={visibleOptionIds}
        pinnedOptionIds={pinnedOptionIds}
        focusedOptionId={null}
        onOpenDetail={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    const optionHeaders = screen.getAllByTestId("comparison-option-header")
    expect(optionHeaders.map((header) => header.dataset.optionId)).toEqual([
      result.data.options[1].id,
      result.data.options[3].id,
      result.data.options[0].id,
      result.data.options[2].id,
      result.data.options[4].id,
      result.data.options[5].id,
      result.data.options[6].id,
      result.data.options[7].id,
    ])

    const pinnedHeaders = optionHeaders.filter((header) => header.dataset.pinned === "true")
    expect(pinnedHeaders).toHaveLength(2)
    pinnedHeaders.forEach((header) => expect(header).toHaveClass("z-50"))
    expect(pinnedHeaders[0]).toHaveStyle({ left: "580px" })
    expect(pinnedHeaders[1]).toHaveStyle({ left: "900px" })

    const firstRowPinnedCells = screen
      .getAllByTestId("comparison-option-cell")
      .filter((cell) => cell.dataset.criterionId === "criterion-2")
      .filter((cell) => cell.dataset.pinned === "true")
    expect(firstRowPinnedCells[0]).toHaveStyle({ left: "580px" })
    expect(firstRowPinnedCells[1]).toHaveStyle({ left: "900px" })
  })

  it("keeps the sticky baseline visible when every option column is hidden", () => {
    render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={createManyOptionResult()}
        visibleOptionIds={[]}
        pinnedOptionIds={[]}
        focusedOptionId={null}
        onOpenDetail={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getByTestId("comparison-baseline-header")).toBeInTheDocument()
    expect(screen.queryAllByTestId("comparison-option-header")).toHaveLength(0)
  })

  it("passes the displayed fallback title to baseline and option details", async () => {
    const user = userEvent.setup()
    const result = createManyOptionResult()
    const onOpenDetail = vi.fn()
    render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={result}
        visibleOptionIds={result.data.options.map((option) => option.id)}
        pinnedOptionIds={[]}
        focusedOptionId={null}
        onOpenDetail={onOpenDetail}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "Xem chi tiết TS-01 · Yêu cầu cơ sở" }))
    expect(onOpenDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({ criterionTitle: "Chưa có tiêu đề" })
    )

    await user.click(
      screen.getByRole("button", {
        name: `Xem chi tiết TS-01 · ${result.data.options[0].displayLabel}`,
      })
    )
    expect(onOpenDetail).toHaveBeenLastCalledWith(
      expect.objectContaining({ criterionTitle: "Chưa có tiêu đề" })
    )
  })

  it("marks the active filtered criterion and exposes evaluation actions", () => {
    const result = createComparisonResult()

    render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={result}
        visibleOptionIds={result.data.options.map((option) => option.id)}
        pinnedOptionIds={[]}
        focusedOptionId={null}
        activeEvaluationOptionId="option-b"
        activeEvaluationCriterionId="criterion-2"
        assessmentStatusByCriterionId={new Map([["criterion-2", "meets"]])}
        matchingEvaluationCriterionIds={new Set(["criterion-2"])}
        onOpenDetail={vi.fn()}
        onOpenEvaluation={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    const evaluationCell = screen
      .getAllByTestId("comparison-option-cell")
      .find(
        (cell) => cell.dataset.optionId === "option-b" && cell.dataset.criterionId === "criterion-2"
      )
    expect(evaluationCell).toHaveAttribute("data-evaluation-active", "true")
    expect(evaluationCell).toHaveAttribute("data-filter-match", "true")
    expect(evaluationCell).toHaveTextContent("Đạt")

    const unmatchedEvaluationCell = screen
      .getAllByTestId("comparison-option-cell")
      .find(
        (cell) => cell.dataset.optionId === "option-b" && cell.dataset.criterionId === "criterion-1"
      )
    expect(unmatchedEvaluationCell).toHaveAttribute("data-filter-match", "false")
    expect(
      screen.getByRole("button", {
        name: "Đánh giá TS-01 · Nhà cung cấp B · Phương án B",
      })
    ).toBeEnabled()
  })

  it("applies a caller-specific matrix viewport height", () => {
    const result = createComparisonResult()
    render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={result}
        viewportHeightClassName="max-h-[calc(100dvh-12rem)]"
        onOpenDetail={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getByTestId("comparison-matrix-scroll")).toHaveClass("max-h-[calc(100dvh-12rem)]")
    expect(screen.getByTestId("comparison-matrix-scroll")).not.toHaveClass(
      "max-h-[calc(100vh-20rem)]"
    )
  })

  it("renders only the focused option while preserving stable desktop dimensions", () => {
    const result = createManyOptionResult()
    render(
      <TechnicalConfigurationMatrix
        hasRequest
        result={result}
        visibleOptionIds={result.data.options.map((option) => option.id)}
        pinnedOptionIds={[result.data.options[0].id, result.data.options[1].id]}
        focusedOptionId={result.data.options[6].id}
        onOpenDetail={vi.fn()}
        onPageChange={vi.fn()}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getAllByTestId("comparison-option-header")).toHaveLength(1)
    expect(screen.getByTestId("comparison-option-header")).toHaveTextContent(
      result.data.options[6].displayLabel
    )
    expect(screen.getByTestId("comparison-option-header")).toHaveClass(
      "w-[320px]",
      "min-w-[320px]",
      "max-w-[320px]"
    )
    expect(screen.getByTestId("comparison-matrix-scroll")).toHaveClass(
      "overflow-auto",
      "max-h-[calc(100vh-20rem)]"
    )
    expect(screen.getByRole("table")).toHaveClass("min-w-max")
  })
})
