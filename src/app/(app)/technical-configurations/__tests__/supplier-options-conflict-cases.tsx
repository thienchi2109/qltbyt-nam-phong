import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import {
  option,
  optionsResponse,
  renderSupplierOptionsHook,
  supplier,
  suppliersResponse,
  type SupplierOptionRpcMocks,
} from "./supplier-options-fixtures"

export function registerSupplierOptionConflictTests(rpc: SupplierOptionRpcMocks) {
  describe("technical configuration supplier option conflicts", () => {
    beforeEach(() => {
      Object.values(rpc).forEach((mock) => mock.mockReset())
    })

    it("preserves the local option draft after stale revision and reloads explicitly", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({ id: "option-1", model: "Model A" })
      const refreshedOption = option({ id: "option-1", model: "Model server", revision: 4 })
      const conflict = Object.assign(new Error("stale_revision"), {
        code: "PT409",
        status: 409,
      })
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([currentSupplier]))
        .mockResolvedValueOnce(
          suppliersResponse([supplier(currentSupplier.id, currentSupplier.name, 4)], 4)
        )
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([currentOption]))
        .mockResolvedValueOnce(optionsResponse([refreshedOption], 4))
      rpc.updateOption.mockRejectedValueOnce(conflict)

      const { result } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.options).toHaveLength(1))

      act(() => result.current.updateOptionDraft({ model: "Model local" }))
      await act(async () => {
        await result.current.saveOption()
      })

      expect(result.current.isConflict).toBe(true)
      expect(result.current.optionDraft.model).toBe("Model local")
      expect(result.current.isDirty).toBe(true)

      await act(async () => {
        await result.current.reload()
      })
      expect(result.current.isConflict).toBe(false)
      expect(result.current.optionDraft.model).toBe("Model server")
      expect(result.current.isDirty).toBe(false)
    })

    it("preserves validation input without issuing a mutation", async () => {
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([]))
      rpc.listOptions.mockResolvedValue(optionsResponse([]))
      const { result } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.suppliersQuery.isSuccess).toBe(true))

      act(() => {
        result.current.startSupplierCreate()
        result.current.updateSupplierDraft("   ")
      })
      await act(async () => {
        await result.current.saveSupplier()
      })

      expect(result.current.supplierDraft.name).toBe("   ")
      expect(result.current.validationError).toBe("Tên nhà cung cấp là bắt buộc.")
      expect(rpc.createSupplier).not.toHaveBeenCalled()
    })
  })
}
