import "@testing-library/jest-dom"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationOptionReferenceRanking } from "../_components/evaluation/TechnicalConfigurationOptionReferenceRanking"
import type {
  TechnicalConfigurationReferenceRankingItemWire,
  TechnicalConfigurationReferenceRankingListRpcArgs,
  TechnicalConfigurationReferenceRankingPageWireResponse,
} from "../reference-ranking-types"
import {
  createAssessmentQueryWrapper,
  createAssessmentTestQueryClient,
} from "./assessment-hook-test-support"
import { technicalConfigurationReferenceRankingQueryKey } from "../technical-configuration-query-keys"

const callRpcMock = vi.hoisted(() => vi.fn())

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => callRpcMock(...args),
}))

const dossierId = "00000000-0000-0000-0000-000000000001"
const baselineVersionId = "00000000-0000-0000-0000-000000000002"

function createRankingItem({
  optionId,
  displayLabel,
  rank,
  eligibility = "eligible",
  incompleteCriterionCount = 0,
  failedCount = 0,
  insufficientEvidenceCount = 0,
  exceedsCount = 0,
}: {
  optionId: string
  displayLabel: string
  rank: number | null
  eligibility?: TechnicalConfigurationReferenceRankingItemWire["eligibility"]
  incompleteCriterionCount?: number
  failedCount?: number
  insufficientEvidenceCount?: number
  exceedsCount?: number
}): TechnicalConfigurationReferenceRankingItemWire {
  return {
    option_id: optionId,
    supplier_id: `supplier-${optionId}`,
    supplier_name: displayLabel.split(" · ")[0] ?? displayLabel,
    display_label: displayLabel,
    eligibility,
    incomplete_criterion_count: incompleteCriterionCount,
    failed_count: failedCount,
    insufficient_evidence_count: insufficientEvidenceCount,
    exceeds_count: exceedsCount,
    rank,
  }
}

function createRankingPage({
  scopeDossierId = dossierId,
  scopeBaselineVersionId = baselineVersionId,
  data,
  total = data.length,
  page = 1,
}: {
  scopeDossierId?: string
  scopeBaselineVersionId?: string
  data: TechnicalConfigurationReferenceRankingItemWire[]
  total?: number
  page?: number
}): TechnicalConfigurationReferenceRankingPageWireResponse {
  return {
    data,
    dossier_id: scopeDossierId,
    baseline_version_id: scopeBaselineVersionId,
    snapshot_token: `${scopeDossierId}:${scopeBaselineVersionId}:snapshot`,
    total,
    page,
    page_size: 100,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function renderRanking(
  props: Readonly<{
    dossierId: string
    baselineVersionId: string
  }> = { dossierId, baselineVersionId }
) {
  const queryClient = createAssessmentTestQueryClient()
  const wrapper = createAssessmentQueryWrapper(queryClient)
  return {
    queryClient,
    ...render(<TechnicalConfigurationOptionReferenceRanking {...props} />, { wrapper }),
  }
}

describe("P12C2 optional reference ranking UI", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
  })

  it("waits for an explicit request and publishes only the complete collected ranking", async () => {
    const secondPage = createDeferred<TechnicalConfigurationReferenceRankingPageWireResponse>()
    const firstItem = createRankingItem({
      optionId: "option-1",
      displayLabel: "Nhà cung cấp A · Model A",
      rank: 1,
    })
    const secondItem = createRankingItem({
      optionId: "option-2",
      displayLabel: "Nhà cung cấp B · Model B",
      rank: 2,
    })
    callRpcMock.mockImplementation((_fn: string, rawArgs: unknown) => {
      const args = rawArgs as TechnicalConfigurationReferenceRankingListRpcArgs
      if (args.p_page === 1) {
        return Promise.resolve(createRankingPage({ data: [firstItem], total: 2 }))
      }
      return secondPage.promise
    })
    const user = userEvent.setup()

    renderRanking()

    expect(callRpcMock).not.toHaveBeenCalled()
    expect(screen.queryByText(firstItem.display_label)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Xem xếp hạng tham khảo" }))

    await waitFor(() => expect(callRpcMock).toHaveBeenCalledTimes(2))
    expect(screen.getByText("Đang tổng hợp xếp hạng...")).toBeInTheDocument()
    expect(screen.queryByText(firstItem.display_label)).not.toBeInTheDocument()

    await act(async () => {
      secondPage.resolve(createRankingPage({ data: [secondItem], total: 2, page: 2 }))
      await secondPage.promise
    })

    expect(await screen.findByText(firstItem.display_label)).toBeInTheDocument()
    expect(screen.getByText(secondItem.display_label)).toBeInTheDocument()
  })

  it("shows an actionable error and retries only after the user requests ranking", async () => {
    const rankedOption = createRankingItem({
      optionId: "option-1",
      displayLabel: "Nhà cung cấp A · Model A",
      rank: 1,
    })
    callRpcMock
      .mockRejectedValueOnce(new Error("ranking_failed"))
      .mockResolvedValueOnce(createRankingPage({ data: [rankedOption] }))
    const user = userEvent.setup()

    renderRanking()

    await user.click(screen.getByRole("button", { name: "Xem xếp hạng tham khảo" }))

    expect(await screen.findByText("Không thể tải xếp hạng tham khảo")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Thử lại" }))

    expect(await screen.findByText(rankedOption.display_label)).toBeInTheDocument()
    expect(callRpcMock).toHaveBeenCalledTimes(2)
  })

  it("does not republish a cached ranking when an active refresh fails", async () => {
    const rankedOption = createRankingItem({
      optionId: "option-1",
      displayLabel: "Nhà cung cấp A · Model A",
      rank: 1,
    })
    callRpcMock
      .mockResolvedValueOnce(createRankingPage({ data: [rankedOption] }))
      .mockRejectedValueOnce(new Error("ranking_refresh_failed"))
    const user = userEvent.setup()
    const { queryClient } = renderRanking()

    await user.click(screen.getByRole("button", { name: "Xem xếp hạng tham khảo" }))
    expect(await screen.findByText(rankedOption.display_label)).toBeInTheDocument()

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: technicalConfigurationReferenceRankingQueryKey({
          dossierId,
          baselineVersionId,
        }),
        exact: true,
      })
    })

    expect(await screen.findByText("Không thể tải xếp hạng tham khảo")).toBeInTheDocument()
    expect(screen.queryByText(rankedOption.display_label)).not.toBeInTheDocument()
  })

  it("resets the request latch and ignores an obsolete result when dossier scope changes", async () => {
    const obsoletePage = createDeferred<TechnicalConfigurationReferenceRankingPageWireResponse>()
    const obsoleteOption = createRankingItem({
      optionId: "old-option",
      displayLabel: "Nhà cung cấp cũ · Model cũ",
      rank: 1,
    })
    const nextDossierId = "00000000-0000-0000-0000-000000000010"
    const nextBaselineVersionId = "00000000-0000-0000-0000-000000000020"
    const currentOption = createRankingItem({
      optionId: "new-option",
      displayLabel: "Nhà cung cấp mới · Model mới",
      rank: 1,
    })
    callRpcMock.mockImplementation((_fn: string, rawArgs: unknown) => {
      const args = rawArgs as TechnicalConfigurationReferenceRankingListRpcArgs
      if (args.p_dossier_id === dossierId) return obsoletePage.promise
      return Promise.resolve(
        createRankingPage({
          scopeDossierId: nextDossierId,
          scopeBaselineVersionId: nextBaselineVersionId,
          data: [currentOption],
        })
      )
    })
    const user = userEvent.setup()
    const rendered = renderRanking()

    await user.click(screen.getByRole("button", { name: "Xem xếp hạng tham khảo" }))
    await waitFor(() => expect(callRpcMock).toHaveBeenCalledTimes(1))

    rendered.rerender(
      <TechnicalConfigurationOptionReferenceRanking
        dossierId={nextDossierId}
        baselineVersionId={nextBaselineVersionId}
      />
    )

    expect(screen.getByRole("button", { name: "Xem xếp hạng tham khảo" })).toBeInTheDocument()
    expect(screen.queryByText("Đang tổng hợp xếp hạng...")).not.toBeInTheDocument()

    await act(async () => {
      obsoletePage.resolve(createRankingPage({ data: [obsoleteOption] }))
      await obsoletePage.promise
    })

    expect(screen.queryByText(obsoleteOption.display_label)).not.toBeInTheDocument()
    expect(callRpcMock).toHaveBeenCalledTimes(1)

    rendered.rerender(
      <TechnicalConfigurationOptionReferenceRanking
        dossierId={dossierId}
        baselineVersionId={baselineVersionId}
      />
    )

    expect(screen.getByRole("button", { name: "Xem xếp hạng tham khảo" })).toBeInTheDocument()
    expect(screen.queryByText(obsoleteOption.display_label)).not.toBeInTheDocument()
    expect(callRpcMock).toHaveBeenCalledTimes(1)

    rendered.rerender(
      <TechnicalConfigurationOptionReferenceRanking
        dossierId={nextDossierId}
        baselineVersionId={nextBaselineVersionId}
      />
    )
    await user.click(screen.getByRole("button", { name: "Xem xếp hạng tham khảo" }))

    expect(await screen.findByText(currentOption.display_label)).toBeInTheDocument()
    expect(callRpcMock).toHaveBeenCalledTimes(2)
  })

  it("renders dense ties, precedence counters, incomplete reasons and the mandatory disclaimer", async () => {
    const rankedOptions = [
      createRankingItem({
        optionId: "option-a",
        displayLabel: "Nhà cung cấp A · Model A",
        rank: 1,
        failedCount: 0,
        insufficientEvidenceCount: 1,
        exceedsCount: 3,
      }),
      createRankingItem({
        optionId: "option-b",
        displayLabel: "Nhà cung cấp B · Model B",
        rank: 1,
        failedCount: 0,
        insufficientEvidenceCount: 1,
        exceedsCount: 3,
      }),
      createRankingItem({
        optionId: "option-c",
        displayLabel: "Nhà cung cấp C · Model C",
        rank: 2,
        failedCount: 1,
        insufficientEvidenceCount: 0,
        exceedsCount: 5,
      }),
      createRankingItem({
        optionId: "option-d",
        displayLabel: "Nhà cung cấp D · Model D",
        rank: null,
        eligibility: "incomplete",
        incompleteCriterionCount: 2,
      }),
    ]
    callRpcMock.mockResolvedValue(createRankingPage({ data: rankedOptions }))
    const user = userEvent.setup()

    renderRanking()
    await user.click(screen.getByRole("button", { name: "Xem xếp hạng tham khảo" }))

    const rows = await screen.findAllByTestId("reference-ranking-option")
    expect(rows.map((row) => row.getAttribute("data-option-id"))).toEqual([
      "option-a",
      "option-b",
      "option-c",
    ])
    expect(screen.getAllByText("Hạng 1")).toHaveLength(2)
    expect(screen.getByText("Hạng 2")).toBeInTheDocument()
    expect(screen.getByText("Không đạt: 1")).toBeInTheDocument()
    expect(screen.getAllByText("Chưa đủ bằng chứng: 1")).toHaveLength(2)
    expect(screen.getByText("Vượt yêu cầu: 5")).toBeInTheDocument()
    expect(screen.getByText("Chưa đủ dữ liệu để xếp hạng")).toBeInTheDocument()
    expect(screen.getByText("Còn thiếu đánh giá cho 2 tiêu chí áp dụng.")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Xếp hạng này chỉ để tham khảo, không phải quyết định lựa chọn nhà cung cấp."
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/sản phẩm tham chiếu/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/đã lỗi thời/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/%|điểm/i)).not.toBeInTheDocument()
  })

  it("renders empty and single-option results without inventing comparative meaning", async () => {
    const user = userEvent.setup()
    callRpcMock.mockResolvedValueOnce(createRankingPage({ data: [] }))
    const empty = renderRanking()

    await user.click(screen.getByRole("button", { name: "Xem xếp hạng tham khảo" }))
    expect(await screen.findByText("Chưa có phương án để xếp hạng.")).toBeInTheDocument()

    empty.unmount()
    callRpcMock.mockResolvedValueOnce(
      createRankingPage({
        data: [
          createRankingItem({
            optionId: "only-option",
            displayLabel: "Nhà cung cấp duy nhất · Model A",
            rank: 1,
          }),
        ],
      })
    )
    renderRanking()

    await user.click(screen.getByRole("button", { name: "Xem xếp hạng tham khảo" }))
    expect(await screen.findByText("Nhà cung cấp duy nhất · Model A")).toBeInTheDocument()
    expect(screen.getByText("Hạng 1")).toBeInTheDocument()
  })
})
