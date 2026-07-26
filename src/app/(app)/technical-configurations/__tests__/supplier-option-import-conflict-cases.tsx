import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationSuppliers } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers"

import {
  confirmOptionImport,
  mockParsedWorkbook,
  renderImportResponses,
  setImportBaselineVersion,
  uploadOptionWorkbook,
  workbookPayload,
  type SupplierOptionImportTestMocks,
} from "./supplier-option-import-fixtures"
import {
  baselineVersion,
  comparisonSet,
  getRequest,
  jsonResponse,
  optionResponse,
} from "./supplier-option-response-cases"
import {
  dossier,
  option,
  optionsResponse,
  renderWithQueryClient,
  supplier,
  suppliersResponse,
} from "./supplier-options-fixtures"
import { deferred } from "./technical-configuration-baseline-tab-fixtures"

export function registerSupplierOptionImportConflictTests(mocks: SupplierOptionImportTestMocks) {
  const { fetchMock, supplierOptionRpc, workbookCodec } = mocks

  describe("technical configuration supplier option import coordination", () => {
    beforeEach(() => {
      Object.values(supplierOptionRpc).forEach((mock) => mock.mockReset())
      workbookCodec.readWorkbook.mockReset()
      workbookCodec.createParser.mockReset()
      workbookCodec.createWorkbook.mockReset()
      workbookCodec.downloadBlob.mockReset()

      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([]))
      workbookCodec.readWorkbook.mockResolvedValue({})
    })

    it("preserves file rows and preview while refreshing and re-previewing a stale apply", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      const payload = workbookPayload({ baseline, currentOption })
      const refreshedPayload = {
        ...payload,
        metadata: { ...payload.metadata, dossier_revision: 4 },
      }
      mockParsedWorkbook(workbookCodec, payload)
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockResolvedValueOnce(jsonResponse({ data: payload, errors: [] }))
        .mockResolvedValueOnce(jsonResponse({ code: "PT409", message: "stale_revision" }, 409))
        .mockResolvedValueOnce(jsonResponse({ data: { ...dossier, revision: 4 } }))
        .mockResolvedValueOnce(jsonResponse({ data: refreshedPayload, errors: [] }))
        .mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline, [], 4) }))

      renderImportResponses({ mocks, baseline, currentOption })
      await screen.findByLabelText("Phản hồi tiêu chí")
      await uploadOptionWorkbook(user, "stale-option.xlsx")
      await screen.findByText("stale-option.xlsx")
      await confirmOptionImport(user)

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
      expect(screen.getByText("stale-option.xlsx")).toBeInTheDocument()
      expect(getRequest(fetchMock, 4).body).toMatchObject({
        p_expected_revision: 4,
        p_template_metadata: expect.objectContaining({ dossier_revision: 4 }),
        p_rows: payload.rows,
      })

      await confirmOptionImport(user)
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
      expect(getRequest(fetchMock, 5).body.p_expected_revision).toBe(4)
    })

    it("adopts a successful import after a clean response conflict", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      const persisted = optionResponse(baseline, {
        response_text: "Phản hồi hiện tại",
      })
      const rows = workbookPayload({ baseline, currentOption }).rows.map((row, index) =>
        index === 0 ? { ...row, response_text: "Phản hồi import" } : row
      )
      const payload = workbookPayload({
        baseline,
        currentOption,
        rows,
      })
      const applied = comparisonSet(
        baseline,
        [
          optionResponse(baseline, {
            response_text: "Phản hồi import",
            revision: 4,
          }),
        ],
        4
      )
      mockParsedWorkbook(workbookCodec, payload)
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline, [persisted]) }))
        .mockResolvedValueOnce(jsonResponse({ code: "PT409", message: "stale_revision" }, 409))
        .mockResolvedValueOnce(jsonResponse({ data: payload, errors: [] }))
        .mockResolvedValueOnce(jsonResponse({ data: applied }))

      renderImportResponses({ mocks, baseline, currentOption })
      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      await user.clear(responseInput)
      await user.type(responseInput, "Phản hồi cục bộ")
      await user.click(screen.getByRole("button", { name: "Lưu" }))
      expect(await screen.findByText("Dữ liệu đã thay đổi")).toBeInTheDocument()

      await user.clear(responseInput)
      await user.type(responseInput, persisted.response_text)
      await uploadOptionWorkbook(user)
      await confirmOptionImport(user)

      await waitFor(() => expect(responseInput).toHaveValue("Phản hồi import"))
      expect(screen.queryByText("Dữ liệu đã thay đổi")).not.toBeInTheDocument()
    })

    it("focus-manages confirmation and clears it before the import dialog reopens", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      const payload = workbookPayload({ baseline, currentOption })
      mockParsedWorkbook(workbookCodec, payload)
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockResolvedValueOnce(jsonResponse({ data: payload, errors: [] }))

      renderImportResponses({ mocks, baseline, currentOption })
      await screen.findByLabelText("Phản hồi tiêu chí")
      await uploadOptionWorkbook(user)
      await user.click(screen.getByRole("button", { name: /Nhập 2 dòng/ }))

      const confirmation = await screen.findByRole("alertdialog", {
        name: "Ghi đè toàn bộ phản hồi phương án?",
      })
      const importDialog = screen.getByRole("dialog", {
        name: "Nhập phản hồi phương án từ Excel",
        hidden: true,
      })
      expect(confirmation).toContainElement(document.activeElement as HTMLElement)
      expect(
        within(importDialog).queryByRole("button", { name: "Đóng", hidden: true })
      ).not.toBeInTheDocument()
      expect(
        within(importDialog).getByRole("button", { name: "Đặt lại", hidden: true })
      ).toBeDisabled()

      await user.click(within(confirmation).getByRole("button", { name: "Hủy" }))
      await waitFor(() =>
        expect(
          screen.queryByRole("alertdialog", {
            name: "Ghi đè toàn bộ phản hồi phương án?",
          })
        ).not.toBeInTheDocument()
      )
      await waitFor(() =>
        expect(
          screen.getByRole("dialog", {
            name: "Nhập phản hồi phương án từ Excel",
          })
        ).toBeInTheDocument()
      )
      await user.click(
        within(
          screen.getByRole("dialog", {
            name: "Nhập phản hồi phương án từ Excel",
          })
        ).getByRole("button", { name: "Đóng" })
      )
      await waitFor(() =>
        expect(
          screen.queryByRole("dialog", {
            name: "Nhập phản hồi phương án từ Excel",
          })
        ).not.toBeInTheDocument()
      )
      await user.click(screen.getByRole("button", { name: "Nhập phản hồi từ Excel" }))

      expect(
        screen.queryByRole("alertdialog", {
          name: "Ghi đè toàn bộ phản hồi phương án?",
        })
      ).not.toBeInTheDocument()
      await user.click(
        within(
          screen.getByRole("dialog", {
            name: "Nhập phản hồi phương án từ Excel",
          })
        ).getByRole("button", { name: "Đóng" })
      )
    })

    it("blocks identity, option, response, baseline, and outer navigation while pending and dirty", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({
        id: "option-1",
        supplierId: currentSupplier.id,
        model: "Model A",
      })
      const otherOption = option({
        id: "option-2",
        supplierId: currentSupplier.id,
        model: "Model B",
      })
      const payload = workbookPayload({ baseline, currentOption })
      const previewRequest = deferred<Response>()
      const onNavigationBlockedChange = vi.fn()
      setImportBaselineVersion(mocks.baselineRpc, baseline)
      mockParsedWorkbook(workbookCodec, payload)
      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([currentOption, otherOption]))
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockImplementationOnce(() => previewRequest.promise)

      renderWithQueryClient(
        <TechnicalConfigurationSuppliers
          dossier={dossier}
          onNavigationBlockedChange={onNavigationBlockedChange}
        />
      )
      await user.click(await screen.findByRole("button", { name: /Model A/ }))
      await screen.findByLabelText("Phản hồi tiêu chí")
      const otherOptionButton = screen.getByRole("button", { name: /Model B/ })
      await uploadOptionWorkbook(user)

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      const addOptionButton = Array.from(
        screen.getByTestId("supplier-option-identity-region").querySelectorAll("button")
      ).find((button) => button.textContent?.includes("Thêm phương án"))
      expect(addOptionButton).toBeDisabled()
      expect(otherOptionButton).toBeDisabled()
      expect(document.getElementById("option-response-baseline-version")).toBeDisabled()
      expect(document.getElementById("technical-option-response-text")).toBeDisabled()
      expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(true)

      await act(async () => {
        previewRequest.resolve(jsonResponse({ data: payload, errors: [] }))
        await previewRequest.promise
      })
      await waitFor(() =>
        expect(screen.queryByText("Đang tạo bản xem trước từ máy chủ...")).not.toBeInTheDocument()
      )

      expect(addOptionButton).toBeDisabled()
      expect(otherOptionButton).toBeDisabled()
      expect(document.getElementById("option-response-baseline-version")).toBeDisabled()
      expect(document.getElementById("technical-option-response-text")).toBeDisabled()
      expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(true)
    })
  })
}
