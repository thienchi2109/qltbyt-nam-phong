import { QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi, type Mock } from "vitest"

import { TechnicalConfigurationOptionResponseEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponseEditor"
import { technicalConfigurationOptionResponsesQueryKey } from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { createTestQueryClient } from "@/test-utils/react-query"
import { dossier, option } from "./supplier-options-fixtures"
import {
  baselineVersion,
  comparisonSet,
  getRequest,
  jsonResponse,
  optionResponse,
} from "./supplier-option-response-cases"
import { deferred } from "./technical-configuration-baseline-tab-fixtures"

type ResponseAvailabilityTestMocks = {
  fetchMock: Mock
}

function renderEditor({
  dossierValue = dossier,
  queryClient = createTestQueryClient(),
  onRevisionChange,
}: {
  dossierValue?: TechnicalConfigurationDossierWire
  queryClient?: ReturnType<typeof createTestQueryClient>
  onRevisionChange?: (revision: number) => void
} = {}) {
  const baseline = baselineVersion()
  const currentOption = option({ id: "option-1" })
  const renderNode = (nextDossier: TechnicalConfigurationDossierWire) => (
    <QueryClientProvider client={queryClient}>
      <TechnicalConfigurationOptionResponseEditor
        dossier={nextDossier}
        option={currentOption}
        baselineVersion={baseline}
        onRevisionChange={onRevisionChange}
        requestDiscardConfirmation={() => undefined}
      />
    </QueryClientProvider>
  )
  const rendered = render(renderNode(dossierValue))
  return {
    ...rendered,
    baseline,
    currentOption,
    queryClient,
    rerenderDossier: (nextDossier: TechnicalConfigurationDossierWire) =>
      rendered.rerender(renderNode(nextDossier)),
  }
}

export function registerSupplierOptionResponseAvailabilityTests({
  fetchMock,
}: ResponseAvailabilityTestMocks) {
  describe("technical configuration option response availability", () => {
    it("keeps criterion response status neutral while the initial query is loading", async () => {
      const responseRequest = deferred<Response>()
      fetchMock.mockReturnValueOnce(responseRequest.promise)

      const { baseline } = renderEditor()

      expect(
        await screen.findByRole("button", { name: /TC-0001.*Đang tải phản hồi/i })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /TC-0001.*Chưa phản hồi/i })
      ).not.toBeInTheDocument()

      act(() => responseRequest.resolve(jsonResponse({ data: comparisonSet(baseline) })))
      await responseRequest.promise
      expect(await screen.findByLabelText("Phản hồi tiêu chí")).toBeInTheDocument()
    })

    it("keeps criterion statuses unavailable after an initial response read failure", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Không thể đọc phản hồi" }, 500))

      renderEditor()

      expect(await screen.findByText("Không thể tải phản hồi phương án")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /TC-0001.*Chưa xác định/i })).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /TC-0001.*Chưa phản hồi/i })
      ).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Phản hồi tiêu chí")).not.toBeInTheDocument()
    })

    it("renders warm cached response state before adoption effects run", () => {
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      const firstCriterionId = baseline.groups[0]?.criteria[0]?.id ?? ""
      const secondCriterionId = baseline.groups[0]?.criteria[1]?.id ?? ""
      const cachedComparisonSet = comparisonSet(baseline, [
        optionResponse(baseline, {
          criterion_id: firstCriterionId,
          response_text: "Phản hồi cache thứ nhất",
        }),
        optionResponse(baseline, {
          id: "response-2",
          criterion_id: secondCriterionId,
          response_text: "Phản hồi cache thứ hai",
        }),
      ])
      const queryClient = createTestQueryClient()
      queryClient.setQueryData(
        technicalConfigurationOptionResponsesQueryKey(currentOption.id, baseline.id),
        cachedComparisonSet
      )

      const html = renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <TechnicalConfigurationOptionResponseEditor
            dossier={dossier}
            option={currentOption}
            baselineVersion={baseline}
            requestDiscardConfirmation={() => undefined}
          />
        </QueryClientProvider>
      )

      expect(html).toContain("Phản hồi cache thứ nhất")
      expect(html.match(/Đã lưu/g)).toHaveLength(2)
      expect(html).not.toContain("Chưa phản hồi")
    })

    it("propagates and saves with a newer warm cached revision", async () => {
      const user = userEvent.setup()
      const cachedRevision = 8
      const onRevisionChange = vi.fn()
      const queryClient = createTestQueryClient()
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      const persisted = optionResponse(baseline, { revision: cachedRevision })
      const saved = optionResponse(baseline, {
        response_text: "Phản hồi sau cache",
        revision: cachedRevision + 1,
      })
      queryClient.setQueryData(
        technicalConfigurationOptionResponsesQueryKey(currentOption.id, baseline.id),
        comparisonSet(baseline, [persisted], cachedRevision)
      )
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: saved }))

      renderEditor({ queryClient, onRevisionChange })

      await waitFor(() => expect(onRevisionChange).toHaveBeenCalledWith(cachedRevision))
      const responseInput = screen.getByLabelText("Phản hồi tiêu chí")
      await user.clear(responseInput)
      await user.type(responseInput, saved.response_text)
      await user.click(screen.getByRole("button", { name: "Lưu" }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
      expect(getRequest(fetchMock, 0).body.p_expected_revision).toBe(cachedRevision)
    })

    it("closes overwrite confirmation when the dossier becomes archived", async () => {
      const user = userEvent.setup()
      const queryClient = createTestQueryClient()
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      queryClient.setQueryData(
        technicalConfigurationOptionResponsesQueryKey(currentOption.id, baseline.id),
        comparisonSet(baseline, [optionResponse(baseline)])
      )

      const { rerenderDossier } = renderEditor({ queryClient })

      await user.click(screen.getByRole("button", { name: "Sao chép từ cấu hình cơ bản" }))
      expect(await screen.findByText("Ghi đè phản hồi hiện tại?")).toBeInTheDocument()

      rerenderDossier({
        ...dossier,
        archived_at: "2026-07-25T00:00:00.000Z",
        archived_by: 9,
      })

      expect(screen.queryByText("Ghi đè phản hồi hiện tại?")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Sao chép từ cấu hình cơ bản" })).toBeDisabled()
    })
  })
}
