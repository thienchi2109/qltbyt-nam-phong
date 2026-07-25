import { beforeEach, describe, expect, it, type Mock } from "vitest"
import { act, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { TechnicalConfigurationOptionResponses } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationOptionResponses"
import { TechnicalConfigurationSuppliers } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
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
  jsonResponse,
  optionResponse,
} from "./supplier-option-response-cases"
import { deferred } from "./technical-configuration-baseline-tab-fixtures"

type ResponseUxTestMocks = {
  baselineRpc: { listVersions: Mock }
  fetchMock: Mock
  supplierOptionRpc: SupplierOptionRpcMocks
}

function setBaselineVersion(
  baselineRpc: ResponseUxTestMocks["baselineRpc"],
  baseline: TechnicalConfigurationBaselineDraftWire
) {
  baselineRpc.listVersions.mockResolvedValue({
    data: [baseline],
    total: 1,
    page: 1,
    page_size: 100,
  })
}

function renderResponses(
  baselineRpc: ResponseUxTestMocks["baselineRpc"],
  baseline: TechnicalConfigurationBaselineDraftWire,
  dossierValue = dossier
) {
  setBaselineVersion(baselineRpc, baseline)
  return renderWithQueryClient(
    <TechnicalConfigurationOptionResponses
      dossier={dossierValue}
      option={option({ id: "option-1" })}
    />
  )
}

export function registerSupplierOptionResponseUxTests({
  baselineRpc,
  fetchMock,
  supplierOptionRpc,
}: ResponseUxTestMocks) {
  describe("technical configuration option response desktop UX", () => {
    beforeEach(() => {
      Object.values(supplierOptionRpc).forEach((mock) => mock.mockReset())
      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([]))
    })

    it("keeps supplier identity above a full-width response workspace", async () => {
      const baseline = baselineVersion()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({ id: "option-1", supplierId: currentSupplier.id })
      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([currentOption]))
      setBaselineVersion(baselineRpc, baseline)
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline) }))

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)

      const responseWorkspace = await screen.findByTestId("option-response-workspace")
      const identityRegion = screen.getByTestId("supplier-option-identity-region")
      const responseRegion = screen.getByTestId("supplier-option-response-region")
      expect(identityRegion).not.toContainElement(responseWorkspace)
      expect(responseRegion).toHaveClass("w-full")
      expect(responseRegion.parentElement).toBe(identityRegion.parentElement)
      expect(responseRegion.previousElementSibling).toBe(identityRegion)
      expect(responseRegion.className).not.toMatch(/max-w-|w-\[/)
    })

    it("shows empty, persisted, and current dirty criterion states", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const secondCriterionId = baseline.groups[0]?.criteria[1]?.id ?? ""
      const persistedSecond = optionResponse(baseline, {
        id: "response-2",
        criterion_id: secondCriterionId,
        response_text: "Đã đáp ứng bằng pin 45 phút",
      })
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: comparisonSet(baseline, [persistedSecond]) })
      )

      renderResponses(baselineRpc, baseline)

      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      expect(screen.getByRole("button", { name: /TC-0001.*Chưa phản hồi/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /TC-0002.*Đã lưu/i })).toBeInTheDocument()

      await user.type(responseInput, "Bản nháp đang nhập")
      expect(screen.getByRole("button", { name: /TC-0001.*Đang chỉnh sửa/i })).toBeInTheDocument()
    })

    it("copies only the baseline requirement into an empty editable response", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline) }))

      renderResponses(baselineRpc, baseline)

      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      const supplementaryInput = screen.getByLabelText("Thông tin bổ sung")
      await user.type(supplementaryInput, "Giữ nguyên ghi chú này")
      await user.click(screen.getByRole("button", { name: "Sao chép từ cấu hình cơ bản" }))

      expect(responseInput).toHaveValue(baseline.groups[0]?.criteria[0]?.requirement_text)
      expect(supplementaryInput).toHaveValue("Giữ nguyên ghi chú này")
      expect(responseInput).toBeEnabled()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("confirms before replacing a non-empty response and preserves supplementary text", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const persisted = optionResponse(baseline, {
        response_text: "Phản hồi đang có",
        supplementary_information: "Thông tin bổ sung đang có",
      })
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline, [persisted]) }))

      renderResponses(baselineRpc, baseline)

      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      const supplementaryInput = screen.getByLabelText("Thông tin bổ sung")
      const copyButton = screen.getByRole("button", {
        name: "Sao chép từ cấu hình cơ bản",
      })

      await user.click(copyButton)
      expect(await screen.findByText("Ghi đè phản hồi hiện tại?")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Hủy" }))
      expect(responseInput).toHaveValue("Phản hồi đang có")
      expect(supplementaryInput).toHaveValue("Thông tin bổ sung đang có")

      await user.click(copyButton)
      await user.click(await screen.findByRole("button", { name: "Ghi đè phản hồi" }))
      expect(responseInput).toHaveValue(baseline.groups[0]?.criteria[0]?.requirement_text)
      expect(supplementaryInput).toHaveValue("Thông tin bổ sung đang có")
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("keeps the selected criterion after secondary save succeeds", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const persisted = optionResponse(baseline)
      const saved = optionResponse(baseline, { response_text: "Phản hồi vừa lưu", revision: 4 })
      const saveRequest = deferred<Response>()
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline, [persisted]) }))
        .mockImplementationOnce(() => saveRequest.promise)

      renderResponses(baselineRpc, baseline)

      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      await user.clear(responseInput)
      await user.type(responseInput, saved.response_text)
      await user.click(screen.getByRole("button", { name: "Lưu" }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      expect(screen.getByRole("button", { name: /TC-0001/ })).toHaveAttribute(
        "aria-current",
        "true"
      )
      expect(responseInput).toHaveValue(saved.response_text)
      expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()

      act(() => saveRequest.resolve(jsonResponse({ data: saved })))
      await saveRequest.promise

      expect(await screen.findByText("Đã lưu phản hồi phương án.")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /TC-0001.*Đã lưu/i })).toHaveAttribute(
        "aria-current",
        "true"
      )
      expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
    })

    it("saves then advances to the immediate next persisted criterion", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const firstCriterionId = baseline.groups[0]?.criteria[0]?.id ?? ""
      const secondCriterionId = baseline.groups[0]?.criteria[1]?.id ?? ""
      const persistedSecond = optionResponse(baseline, {
        id: "response-2",
        criterion_id: secondCriterionId,
        response_text: "Phản hồi tiêu chí thứ hai",
      })
      const savedFirst = optionResponse(baseline, {
        criterion_id: firstCriterionId,
        response_text: "Phản hồi tiêu chí thứ nhất",
        revision: 4,
      })
      const saveRequest = deferred<Response>()
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline, [persistedSecond]) }))
        .mockImplementationOnce(() => saveRequest.promise)

      renderResponses(baselineRpc, baseline)

      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      await user.type(responseInput, savedFirst.response_text)
      await user.click(screen.getByRole("button", { name: "Lưu & tiếp theo" }))

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      expect(screen.getByRole("button", { name: /TC-0001/ })).toHaveAttribute(
        "aria-current",
        "true"
      )
      expect(responseInput).toHaveValue(savedFirst.response_text)
      expect(screen.getByRole("button", { name: "Lưu & tiếp theo" })).toBeDisabled()

      act(() => saveRequest.resolve(jsonResponse({ data: savedFirst })))
      await saveRequest.promise

      await waitFor(() => expect(responseInput).toHaveValue(persistedSecond.response_text))
      expect(screen.getByRole("button", { name: /TC-0002/ })).toHaveAttribute(
        "aria-current",
        "true"
      )
      expect(screen.queryByRole("button", { name: "Lưu & tiếp theo" })).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Lưu" })).toBeInTheDocument()
    })

    it("does not advance when save-next fails without a conflict", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline) }))
        .mockRejectedValueOnce(new Error("network_down"))

      renderResponses(baselineRpc, baseline)

      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      await user.type(responseInput, "Giữ nguyên khi lưu lỗi")
      await user.click(screen.getByRole("button", { name: "Lưu & tiếp theo" }))

      expect(await screen.findByText("network_down")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /TC-0001/ })).toHaveAttribute(
        "aria-current",
        "true"
      )
      expect(responseInput).toHaveValue("Giữ nguyên khi lưu lỗi")
    })

    it("preserves the current criterion and unsaved response when save-next conflicts", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: comparisonSet(baseline) }))
        .mockResolvedValueOnce(jsonResponse({ code: "PT409", message: "stale_revision" }, 409))

      renderResponses(baselineRpc, baseline)

      const responseInput = await screen.findByLabelText("Phản hồi tiêu chí")
      await user.type(responseInput, "Giữ nguyên khi conflict")
      await user.click(screen.getByRole("button", { name: "Lưu & tiếp theo" }))

      expect(await screen.findByText("Dữ liệu đã thay đổi")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /TC-0001/ })).toHaveAttribute(
        "aria-current",
        "true"
      )
      expect(responseInput).toHaveValue("Giữ nguyên khi conflict")
    })

    it("keeps locked baselines editable and disables P8B3 actions for archived dossiers", async () => {
      const locked = baselineVersion({
        status: "locked",
        locked_at: "2026-07-23T00:00:00.000Z",
        locked_by: 9,
      })
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: comparisonSet(locked) }))

      const { rerender } = renderResponses(baselineRpc, locked)

      expect(await screen.findByLabelText("Phản hồi tiêu chí")).toBeEnabled()
      expect(screen.getByRole("button", { name: "Sao chép từ cấu hình cơ bản" })).toBeEnabled()

      rerender(
        <TechnicalConfigurationOptionResponses
          dossier={{
            ...dossier,
            archived_at: "2026-07-23T04:00:00.000Z",
            archived_by: 9,
          }}
          option={option({ id: "option-1" })}
        />
      )

      expect(await screen.findByText("Chế độ chỉ đọc")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Sao chép từ cấu hình cơ bản" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Lưu & tiếp theo" })).toBeDisabled()
    })
  })
}
