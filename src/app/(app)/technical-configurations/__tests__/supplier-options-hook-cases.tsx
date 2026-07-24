import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  dossier,
  option,
  optionsResponse,
  renderSupplierOptionsHook,
  supplier,
  suppliersResponse,
  type SupplierOptionRpcMocks,
} from "./supplier-options-fixtures"

export function registerSupplierOptionHookTests(rpc: SupplierOptionRpcMocks) {
  describe("technical configuration supplier option hook", () => {
    beforeEach(() => {
      Object.values(rpc).forEach((mock) => mock.mockReset())
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([]))
      rpc.listOptions.mockResolvedValue(optionsResponse([]))
    })

    it("rejects a supplier pagination snapshot that changes revision mid-load", async () => {
      const firstSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const secondSupplier = supplier("supplier-2", "Công ty Thiết bị B", 4)
      rpc.listSuppliers
        .mockResolvedValueOnce({
          ...suppliersResponse([firstSupplier]),
          total: 2,
        })
        .mockResolvedValueOnce({
          ...suppliersResponse([secondSupplier], 4),
          total: 2,
          page: 2,
        })

      const { result } = renderSupplierOptionsHook()

      await waitFor(() => expect(result.current.suppliersQuery.isError).toBe(true))
      expect(result.current.suppliersQuery.data).toBeUndefined()
    })

    it("defers supplier and option writes until explicit saves and advances revisions", async () => {
      const savedSupplier = supplier("supplier-1", "Công ty Thiết bị A", 4)
      const savedOption = option({ id: "option-1", revision: 5 })
      rpc.createSupplier.mockResolvedValueOnce({ data: savedSupplier })
      rpc.createOption.mockResolvedValueOnce({ data: savedOption })
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([]))
        .mockResolvedValueOnce(suppliersResponse([savedSupplier], 4))
        .mockResolvedValueOnce(suppliersResponse([savedSupplier], 5))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([]))
        .mockResolvedValueOnce(optionsResponse([], 4))
        .mockResolvedValueOnce(optionsResponse([savedOption], 5))

      const { result, onRevisionChange } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.suppliersQuery.isSuccess).toBe(true))

      act(() => {
        result.current.startSupplierCreate()
        result.current.updateSupplierDraft("Công ty Thiết bị A")
      })
      expect(rpc.createSupplier).not.toHaveBeenCalled()

      await act(async () => {
        await result.current.saveSupplier()
      })
      expect(rpc.createSupplier).toHaveBeenCalledWith({
        p_dossier_id: dossier.id,
        p_name: "Công ty Thiết bị A",
        p_expected_revision: dossier.revision,
      })

      act(() => {
        result.current.startOptionCreate(savedSupplier.id)
        result.current.updateOptionDraft({ model: "Model A", manufacturer: "Hãng A" })
      })
      expect(rpc.createOption).not.toHaveBeenCalled()

      await act(async () => {
        await result.current.saveOption()
      })
      expect(rpc.createOption).toHaveBeenCalledWith({
        p_supplier_id: savedSupplier.id,
        p_model: "Model A",
        p_manufacturer: "Hãng A",
        p_option_name: null,
        p_notes: null,
        p_expected_revision: 4,
      })
      expect(onRevisionChange).toHaveBeenNthCalledWith(1, 4)
      expect(onRevisionChange).toHaveBeenNthCalledWith(2, 5)
    })

    it("keeps blank second-item creation modes active until the user acts", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({ id: "option-1" })
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.listOptions.mockResolvedValue(optionsResponse([currentOption]))

      const { result } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.options).toHaveLength(1))

      act(() => result.current.startSupplierCreate())
      await waitFor(() => expect(result.current.isCreatingSupplier).toBe(true))
      expect(result.current.selectedSupplierId).toBeNull()

      act(() => result.current.selectSupplier(currentSupplier.id))
      act(() => result.current.startOptionCreate(currentSupplier.id))
      await waitFor(() => expect(result.current.isCreatingOption).toBe(true))
      expect(result.current.selectedOptionId).toBeNull()
      expect(result.current.optionDraft.supplierId).toBe(currentSupplier.id)
    })

    it("updates existing supplier and option identities with consecutive revisions", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({ id: "option-1" })
      const renamedSupplier = supplier("supplier-1", "Công ty Thiết bị B", 4)
      const relabeledOption = option({
        id: "option-1",
        supplierName: renamedSupplier.name,
        revision: 4,
      })
      const updatedOption = option({
        id: "option-1",
        supplierName: renamedSupplier.name,
        model: "Model B",
        revision: 5,
      })
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([currentSupplier]))
        .mockResolvedValueOnce(suppliersResponse([renamedSupplier], 4))
        .mockResolvedValueOnce(suppliersResponse([renamedSupplier], 5))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([currentOption]))
        .mockResolvedValueOnce(optionsResponse([relabeledOption], 4))
        .mockResolvedValueOnce(optionsResponse([updatedOption], 5))
      rpc.updateSupplier.mockResolvedValueOnce({ data: renamedSupplier })
      rpc.updateOption.mockResolvedValueOnce({ data: updatedOption })

      const { result } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.options).toHaveLength(1))

      act(() => result.current.updateSupplierDraft(renamedSupplier.name))
      await act(async () => {
        await result.current.saveSupplier()
      })
      expect(rpc.updateSupplier).toHaveBeenCalledWith({
        p_supplier_id: currentSupplier.id,
        p_name: renamedSupplier.name,
        p_expected_revision: dossier.revision,
      })

      await waitFor(() => expect(result.current.supplierDraft.name).toBe(renamedSupplier.name))
      act(() => result.current.updateOptionDraft({ model: updatedOption.model ?? "" }))
      await act(async () => {
        await result.current.saveOption()
      })
      expect(rpc.updateOption).toHaveBeenCalledWith({
        p_option_id: currentOption.id,
        p_model: updatedOption.model,
        p_manufacturer: currentOption.manufacturer,
        p_option_name: null,
        p_notes: null,
        p_expected_revision: 4,
      })
    })

    it("warns when a successful save cannot refresh active identity queries", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const renamedSupplier = supplier("supplier-1", "Công ty Thiết bị B", 4)
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([currentSupplier]))
        .mockRejectedValueOnce(new Error("network unavailable"))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([]))
        .mockResolvedValueOnce(optionsResponse([], 4))
      rpc.updateSupplier.mockResolvedValueOnce({ data: renamedSupplier })

      const { result } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.suppliers).toHaveLength(1))

      act(() => result.current.updateSupplierDraft(renamedSupplier.name))
      await act(async () => {
        await result.current.saveSupplier()
      })

      expect(result.current.refreshWarning).toBe(
        "Đã lưu thay đổi nhưng không thể làm mới dữ liệu từ máy chủ."
      )
    })

    it("blocks writes across mismatched snapshots until an explicit coherent reload", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A", 7)
      const currentOption = option({ id: "option-1", revision: 7 })
      const freshSupplier = supplier("supplier-1", "Công ty Thiết bị server", 8)
      const freshOption = option({
        id: "option-1",
        supplierName: freshSupplier.name,
        revision: 8,
      })
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([currentSupplier], 7))
        .mockResolvedValueOnce(suppliersResponse([freshSupplier], 8))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([currentOption], 7))
        .mockResolvedValueOnce(optionsResponse([freshOption], 8))
        .mockResolvedValueOnce(optionsResponse([freshOption], 8))

      const { result } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.selectedSupplierId).toBe(currentSupplier.id))

      act(() => result.current.updateSupplierDraft("Công ty Thiết bị local"))
      await act(async () => {
        await result.current.optionsQuery.refetch({ throwOnError: true })
      })
      await waitFor(() => expect(result.current.isConflict).toBe(true))
      expect(result.current.supplierDraft.name).toBe("Công ty Thiết bị local")

      await act(async () => {
        await result.current.saveSupplier()
      })
      expect(rpc.updateSupplier).not.toHaveBeenCalled()

      await act(async () => {
        await result.current.reload()
      })
      expect(result.current.isConflict).toBe(false)
      expect(result.current.supplierDraft.name).toBe(freshSupplier.name)
    })

    it("adopts a coherent remote refresh when the local identity draft is clean", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A", 7)
      const currentOption = option({ id: "option-1", revision: 7 })
      const freshSupplier = supplier("supplier-1", "Công ty Thiết bị server", 8)
      const freshOption = option({
        id: "option-1",
        supplierName: freshSupplier.name,
        revision: 8,
      })
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([currentSupplier], 7))
        .mockResolvedValueOnce(suppliersResponse([freshSupplier], 8))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([currentOption], 7))
        .mockResolvedValueOnce(optionsResponse([freshOption], 8))

      const { result } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.supplierDraft.name).toBe(currentSupplier.name))

      await act(async () => {
        await Promise.all([
          result.current.suppliersQuery.refetch({ throwOnError: true }),
          result.current.optionsQuery.refetch({ throwOnError: true }),
        ])
      })

      await waitFor(() => expect(result.current.supplierDraft.name).toBe(freshSupplier.name))
      expect(result.current.optionDraft.model).toBe(freshOption.model)
      expect(result.current.isDirty).toBe(false)
    })

    it("keeps the original revision when a coherent remote refresh meets a dirty draft", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A", 7)
      const currentOption = option({ id: "option-1", revision: 7 })
      const freshSupplier = supplier("supplier-1", "Công ty Thiết bị server", 8)
      const freshOption = option({
        id: "option-1",
        supplierName: freshSupplier.name,
        revision: 8,
      })
      const conflict = Object.assign(new Error("stale_revision"), {
        code: "PT409",
        status: 409,
      })
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([currentSupplier], 7))
        .mockResolvedValueOnce(suppliersResponse([freshSupplier], 8))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([currentOption], 7))
        .mockResolvedValueOnce(optionsResponse([freshOption], 8))
      rpc.updateSupplier.mockRejectedValueOnce(conflict)

      const { result } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.supplierDraft.name).toBe(currentSupplier.name))
      act(() => result.current.updateSupplierDraft("Công ty Thiết bị local"))

      await act(async () => {
        await Promise.all([
          result.current.suppliersQuery.refetch({ throwOnError: true }),
          result.current.optionsQuery.refetch({ throwOnError: true }),
        ])
      })
      expect(result.current.supplierDraft.name).toBe("Công ty Thiết bị local")

      await act(async () => {
        await result.current.saveSupplier()
      })
      expect(rpc.updateSupplier).toHaveBeenCalledWith({
        p_supplier_id: currentSupplier.id,
        p_name: "Công ty Thiết bị local",
        p_expected_revision: 7,
      })
      expect(result.current.isConflict).toBe(true)
    })

    it("loads the filtered option total before supplier deletion", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([]))
        .mockResolvedValueOnce(optionsResponse([], dossier.revision, 7))

      const { result } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.suppliers).toHaveLength(1))

      let count = 0
      await act(async () => {
        count = await result.current.loadSupplierOptionCount(currentSupplier.id)
      })

      expect(count).toBe(7)
      expect(rpc.listOptions).toHaveBeenLastCalledWith({
        p_dossier_id: dossier.id,
        p_supplier_id: currentSupplier.id,
        p_page: 1,
        p_page_size: 1,
      })
    })

    it("uses the current revision for delete, selects the next option, and refreshes queries", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const first = option({ id: "option-1" })
      const second = option({ id: "option-2", model: "Model B" })
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([first, second]))
        .mockResolvedValueOnce(optionsResponse([second], 4))
      rpc.deleteOption.mockResolvedValueOnce({ data: { id: first.id, revision: 4 } })

      const { result, queryClient, onRevisionChange } = renderSupplierOptionsHook()
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
      await waitFor(() => expect(result.current.options).toHaveLength(2))

      act(() => result.current.selectOption(first.id))
      await act(async () => {
        await result.current.deleteSelectedOption()
      })

      expect(rpc.deleteOption).toHaveBeenCalledWith({
        p_option_id: first.id,
        p_expected_revision: dossier.revision,
      })
      expect(onRevisionChange).toHaveBeenCalledWith(4)
      await waitFor(() => expect(result.current.selectedOptionId).toBe(second.id))
      expect(invalidateQueries).toHaveBeenCalled()
    })

    it("blocks navigation for the full pending mutation window", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      let resolveSave: ((value: { data: ReturnType<typeof supplier> }) => void) | undefined
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.createSupplier.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve
          })
      )

      const { result, onNavigationBlockedChange } = renderSupplierOptionsHook()
      await waitFor(() => expect(result.current.suppliers).toHaveLength(1))

      act(() => {
        result.current.startSupplierCreate()
        result.current.updateSupplierDraft("Công ty Thiết bị B")
      })
      let savePromise: Promise<void> | undefined
      act(() => {
        savePromise = result.current.saveSupplier()
      })
      expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(true)

      await act(async () => {
        resolveSave?.({ data: supplier("supplier-2", "Công ty Thiết bị B", 4) })
        await savePromise
      })
      expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(false)
    })

    it("keeps archived dossiers read-only without supplier or option mutations", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      const archivedDossier = {
        ...dossier,
        archived_at: "2026-07-23T02:00:00.000Z",
        archived_by: 1,
      }
      const { result } = renderSupplierOptionsHook({ dossierValue: archivedDossier })
      await waitFor(() => expect(result.current.suppliers).toHaveLength(1))

      act(() => {
        result.current.startSupplierCreate()
        result.current.startOptionCreate(currentSupplier.id)
      })
      await act(async () => {
        await result.current.saveSupplier()
        await result.current.saveOption()
      })

      expect(result.current.isReadOnly).toBe(true)
      expect(rpc.createSupplier).not.toHaveBeenCalled()
      expect(rpc.createOption).not.toHaveBeenCalled()
    })
  })
}
