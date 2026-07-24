import { act, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, type Mock } from "vitest"

import { TechnicalConfigurationSuppliers } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers"
import { useTechnicalConfigurationOptionResponses } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptionResponses"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { deferred } from "./technical-configuration-baseline-tab-fixtures"
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
} from "./supplier-option-response-cases"

type ResponseCoordinationTestMocks = {
  baselineRpc: { listVersions: Mock }
  fetchMock: Mock
  supplierOptionRpc: SupplierOptionRpcMocks
}

export function registerSupplierOptionResponseCoordinationTests({
  baselineRpc,
  fetchMock,
  supplierOptionRpc,
}: ResponseCoordinationTestMocks) {
  describe("technical configuration option response coordination", () => {
    beforeEach(() => {
      Object.values(supplierOptionRpc).forEach((mock) => mock.mockReset())
      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([]))
    })

    it("uses a newer dossier revision while the response draft remains dirty", async () => {
      const baseline = baselineVersion()
      const currentOption = option({ id: "option-1" })
      const createdSet = comparisonSet(baseline, [], 9)
      const savedResponse = optionResponse(baseline, {
        response_text: "Bản nháp dùng revision mới",
        revision: 10,
      })
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockResolvedValueOnce(jsonResponse({ data: createdSet }))
        .mockResolvedValueOnce(jsonResponse({ data: savedResponse }))
      const queryClient = createTestQueryClient()
      const { result, rerender } = renderHook(
        ({ revision }: { revision: number }) =>
          useTechnicalConfigurationOptionResponses({
            dossier: { ...dossier, revision },
            option: currentOption,
            baselineVersion: baseline,
          }),
        {
          initialProps: { revision: dossier.revision },
          wrapper: createReactQueryWrapper(queryClient),
        }
      )
      await waitFor(() => expect(result.current.responseQuery.isSuccess).toBe(true))
      act(() => result.current.updateDraft({ responseText: savedResponse.response_text }))
      expect(result.current.isDirty).toBe(true)

      rerender({ revision: 8 })
      await act(async () => result.current.save())

      expect(getRequest(fetchMock, 1).body.p_expected_revision).toBe(8)
    })

    it("blocks supplier mutations while a response save is pending", async () => {
      const user = userEvent.setup()
      const baseline = baselineVersion()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({ id: "option-1", supplier_id: currentSupplier.id })
      const createdSet = comparisonSet(baseline, [], 4)
      const savedResponse = optionResponse(baseline, {
        response_text: "Đang lưu phản hồi",
        revision: 5,
      })
      const createRequest = deferred<Response>()
      baselineRpc.listVersions.mockResolvedValue({
        data: [baseline],
        total: 1,
        page: 1,
        page_size: 100,
      })
      supplierOptionRpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      supplierOptionRpc.listOptions.mockResolvedValue(optionsResponse([currentOption]))
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: null }))
        .mockImplementationOnce(() => createRequest.promise)
        .mockResolvedValueOnce(jsonResponse({ data: savedResponse }))

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      await user.type(
        await screen.findByLabelText("Phản hồi tiêu chí"),
        savedResponse.response_text
      )
      await user.click(screen.getByRole("button", { name: "Lưu phản hồi" }))

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Lưu nhà cung cấp" })).toBeDisabled()
      )
      expect(screen.getByRole("button", { name: "Xóa nhà cung cấp" })).toBeDisabled()
      expect(supplierOptionRpc.updateSupplier).not.toHaveBeenCalled()

      act(() => createRequest.resolve(jsonResponse({ data: createdSet })))
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    })
  })
}
