import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest"

import { TechnicalConfigurationSuppliers } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers"
import {
  dossier,
  option,
  optionsResponse,
  renderWithQueryClient,
  supplier,
  suppliersResponse,
  type SupplierOptionRpcMocks,
} from "./supplier-options-fixtures"
import {
  baselineVersion,
  comparisonSet,
  getRequest,
  jsonResponse,
  optionResponse,
  renderResponseHook,
} from "./supplier-option-response-cases"

type ResponseConflictTestMocks = {
  baselineRpc: { listVersions: Mock }
  fetchMock: Mock
  supplierOptionRpc: SupplierOptionRpcMocks
}

function conflictResponse() {
  return jsonResponse({ code: "PT409", message: "stale_revision" }, 409)
}

export function registerSupplierOptionResponseConflictTests({
  baselineRpc,
  fetchMock,
  supplierOptionRpc,
}: ResponseConflictTestMocks) {
  const originalScrollIntoView = Element.prototype.scrollIntoView

  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterAll(() => {
    if (originalScrollIntoView) {
      Object.defineProperty(Element.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      })
      return
    }
    Reflect.deleteProperty(Element.prototype, "scrollIntoView")
  })

  describe("technical configuration option response conflicts and navigation", () => {
    beforeEach(() => {
      Object.values(supplierOptionRpc).forEach((mock) => mock.mockReset())
      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([]))
    })

    it("preserves the exact selection and local text when get-or-create conflicts", async () => {
      const baseline = baselineVersion()
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockResolvedValueOnce(conflictResponse())
      const { result } = renderResponseHook({ baseline })
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))

      act(() =>
        result.current.updateDraft({
          responseText: "Nội dung cục bộ",
          supplementaryInformation: "Ghi chú cục bộ",
        })
      )
      const selectedCriterionId = result.current.selectedCriterionId
      await act(async () => result.current.save())

      expect(result.current.isConflict).toBe(true)
      expect(result.current.selectedCriterionId).toBe(selectedCriterionId)
      expect(result.current.draft).toEqual({
        responseText: "Nội dung cục bộ",
        supplementaryInformation: "Ghi chú cục bộ",
      })
    })

    it("adopts the created revision after upsert failure and reloads without losing the draft", async () => {
      const onRevisionChange = vi.fn()
      const baseline = baselineVersion()
      const createdSet = comparisonSet(baseline, [], 4)
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockResolvedValueOnce(jsonResponse({ data: createdSet }))
        .mockResolvedValueOnce(conflictResponse())
        .mockResolvedValueOnce(jsonResponse({ data: createdSet }))

      const { result } = renderResponseHook({ baseline, onRevisionChange })
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))
      act(() => result.current.updateDraft({ responseText: "Giữ nội dung này" }))

      await act(async () => result.current.save())
      expect(onRevisionChange).toHaveBeenCalledWith(4)
      expect(result.current.isConflict).toBe(true)
      expect(result.current.draft.responseText).toBe("Giữ nội dung này")

      await act(async () => result.current.reload())
      expect(getRequest(fetchMock, 3).url).toBe(
        "/api/rpc/technical_configuration_comparison_set_get"
      )
      expect(result.current.isConflict).toBe(false)
      expect(result.current.draft.responseText).toBe("Giữ nội dung này")
    })

    it("guards dirty option, baseline, and criterion changes with the shared confirmation", async () => {
      const user = userEvent.setup()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const firstOption = option({ id: "option-1", model: "Model A" })
      const secondOption = option({ id: "option-2", model: "Model B" })
      const firstBaseline = baselineVersion()
      const secondBaseline = baselineVersion({
        id: "baseline-2",
        version_number: 2,
      })
      baselineRpc.listVersions.mockResolvedValue({
        data: [firstBaseline, secondBaseline],
        total: 2,
        page: 1,
        page_size: 100,
      })
      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([firstOption, secondOption]))
      fetchMock.mockResolvedValue(jsonResponse({ data: null }))

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      const firstOptionButton = screen.getByRole("button", {
        name: firstOption.display_label,
      })
      await user.type(responseInput, "Bản nháp chưa lưu")

      await user.click(screen.getByRole("button", { name: secondOption.display_label }))
      expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
      expect(firstOptionButton).toHaveAttribute("aria-pressed", "true")
      await user.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Hủy",
        })
      )

      act(() => screen.getByLabelText("Phiên bản cấu hình cơ sở").focus())
      await user.keyboard("{ArrowDown}")
      await user.click(await screen.findByRole("option", { name: /Phiên bản 1/ }))
      expect(await screen.findByRole("alertdialog")).toHaveTextContent("Chuyển phiên bản")
      await user.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Hủy",
        })
      )

      await user.click(screen.getByRole("button", { name: /TC-0002/ }))
      expect(await screen.findByRole("alertdialog")).toHaveTextContent("Chuyển tiêu chí")
      expect(screen.getByLabelText("Phản hồi tiêu chí")).toHaveValue("Bản nháp chưa lưu")
    })

    it("shows max option/response update time and keeps supplementary text outside scoring UI", async () => {
      const baseline = baselineVersion()
      const response = optionResponse(baseline, {
        updated_at: "2026-07-24T05:30:00.000Z",
      })
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({ id: "option-1" })
      baselineRpc.listVersions.mockResolvedValue({
        data: [baseline],
        total: 1,
        page: 1,
        page_size: 100,
      })
      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([currentOption]))
      fetchMock.mockResolvedValue(
        jsonResponse({ data: comparisonSet(baseline, [response], response.revision) })
      )

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)

      expect(await screen.findByText(/Cập nhật phản hồi gần nhất/)).toHaveTextContent("24")
      expect(screen.getByText("Thông tin bổ sung không dùng để chấm điểm.")).toBeInTheDocument()
      expect(screen.queryByText(/tuân thủ|xếp hạng|đánh giá/i)).not.toBeInTheDocument()
    })
  })
}
