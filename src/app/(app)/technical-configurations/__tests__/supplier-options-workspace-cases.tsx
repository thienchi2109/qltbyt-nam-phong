import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import { TechnicalConfigurationSuppliers } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers"
import {
  technicalConfigurationOptionsQueryKey,
  technicalConfigurationSuppliersQueryKey,
} from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
import {
  dossier,
  option,
  optionsResponse,
  renderWithQueryClient,
  supplier,
  suppliersResponse,
  type SupplierOptionRpcMocks,
} from "./supplier-options-fixtures"

export function registerSupplierOptionWorkspaceTests(rpc: SupplierOptionRpcMocks) {
  describe("technical configuration supplier option workspace", () => {
    beforeEach(() => {
      Object.values(rpc).forEach((mock) => mock.mockReset())
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([]))
      rpc.listOptions.mockResolvedValue(optionsResponse([]))
    })

    it("renders the empty state and creates the first supplier explicitly", async () => {
      const user = userEvent.setup()
      const created = supplier("supplier-1", "Công ty Thiết bị A", 4)
      rpc.createSupplier.mockResolvedValueOnce({ data: created })
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([]))
        .mockResolvedValueOnce(suppliersResponse([created], 4))

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      expect(await screen.findByText("Chưa có nhà cung cấp.")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Thêm nhà cung cấp" }))
      await user.type(screen.getByLabelText("Tên nhà cung cấp"), "Công ty Thiết bị A")
      expect(rpc.createSupplier).not.toHaveBeenCalled()
      await user.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }))

      await waitFor(() =>
        expect(rpc.createSupplier).toHaveBeenCalledWith({
          p_dossier_id: dossier.id,
          p_name: "Công ty Thiết bị A",
          p_expected_revision: dossier.revision,
        })
      )
    })

    it("groups multiple options under one supplier with stable identity labels", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const first = option({ id: "option-1", model: "Model A" })
      const second = option({ id: "option-2", model: null, optionName: "Phương án B" })
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.listOptions.mockResolvedValue(optionsResponse([first, second]))

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)

      expect(
        await screen.findByRole("heading", {
          name: "Nhà cung cấp · Model hoặc tên phương án",
        })
      ).toBeInTheDocument()
      expect(screen.getByRole("button", { name: first.display_label })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: second.display_label })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: currentSupplier.name })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
      expect(screen.getByRole("button", { name: first.display_label })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
      expect(screen.getByRole("button", { name: second.display_label })).toHaveAttribute(
        "aria-pressed",
        "false"
      )
      expect(screen.getByText(/Cập nhật lần cuối/)).toBeInTheDocument()
      expect(screen.queryByText(/khóa phương án/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/phiên bản phương án/i)).not.toBeInTheDocument()
    })

    it("confirms option deletion with the dependent response warning", async () => {
      const user = userEvent.setup()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({ id: "option-1" })
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([currentOption]))
        .mockResolvedValueOnce(optionsResponse([], 4))
      rpc.deleteOption.mockResolvedValueOnce({
        data: { id: currentOption.id, revision: 4 },
      })

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      await screen.findByRole("button", { name: currentOption.display_label })

      await user.click(screen.getByRole("button", { name: "Xóa phương án" }))
      const dialog = await screen.findByRole("alertdialog")
      expect(dialog).toHaveTextContent(currentOption.display_label)
      expect(dialog).toHaveTextContent("response datasets phụ thuộc")

      await user.click(within(dialog).getByRole("button", { name: "Hủy" }))
      expect(rpc.deleteOption).not.toHaveBeenCalled()

      await user.click(screen.getByRole("button", { name: "Xóa phương án" }))
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", {
          name: "Xóa phương án",
        })
      )
      await waitFor(() =>
        expect(rpc.deleteOption).toHaveBeenCalledWith({
          p_option_id: currentOption.id,
          p_expected_revision: dossier.revision,
        })
      )
    })

    it("binds supplier cascade confirmation to the supplier whose total was loaded", async () => {
      const user = userEvent.setup()
      const firstSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const secondSupplier = supplier("supplier-2", "Công ty Thiết bị B")
      let resolveCount: ((value: ReturnType<typeof optionsResponse>) => void) | undefined
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([firstSupplier, secondSupplier]))
        .mockResolvedValueOnce(suppliersResponse([secondSupplier], 4))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([]))
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveCount = resolve
            })
        )
        .mockResolvedValueOnce(optionsResponse([], dossier.revision, 12))
        .mockResolvedValueOnce(optionsResponse([], 4))
      rpc.deleteSupplier.mockResolvedValueOnce({
        data: { id: firstSupplier.id, revision: 4 },
      })

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      await screen.findByText(firstSupplier.name)

      await user.click(screen.getByRole("button", { name: "Xóa nhà cung cấp" }))
      await user.click(screen.getByRole("button", { name: secondSupplier.name }))
      await act(async () => {
        resolveCount?.(optionsResponse([], dossier.revision, 12))
      })
      const dialog = await screen.findByRole("alertdialog")
      expect(dialog).toHaveTextContent(firstSupplier.name)
      expect(dialog).toHaveTextContent("12 phương án")
      expect(dialog).toHaveTextContent("xóa dây chuyền")
      expect(rpc.listOptions).toHaveBeenCalledWith({
        p_dossier_id: dossier.id,
        p_supplier_id: firstSupplier.id,
        p_page: 1,
        p_page_size: 1,
      })

      await user.click(within(dialog).getByRole("button", { name: "Hủy" }))
      expect(rpc.deleteSupplier).not.toHaveBeenCalled()
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Xóa nhà cung cấp" }))
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", {
          name: "Xóa nhà cung cấp",
        })
      )
      await waitFor(() =>
        expect(rpc.deleteSupplier).toHaveBeenCalledWith({
          p_supplier_id: firstSupplier.id,
          p_expected_revision: dossier.revision,
        })
      )
    })

    it("blocks option deletion while supplier cascade preflight is loading", async () => {
      const user = userEvent.setup()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({ id: "option-1" })
      let resolveCount: ((value: ReturnType<typeof optionsResponse>) => void) | undefined
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([currentOption]))
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveCount = resolve
            })
        )

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      await screen.findByRole("button", { name: currentOption.display_label })
      await user.click(screen.getByRole("button", { name: "Xóa nhà cung cấp" }))

      expect(screen.getByRole("button", { name: "Xóa phương án" })).toBeDisabled()
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

      await act(async () => {
        resolveCount?.(optionsResponse([], dossier.revision, 1))
      })
      const dialog = await screen.findByRole("alertdialog")
      expect(dialog).toHaveTextContent(currentSupplier.name)
      expect(dialog).toHaveTextContent("1 phương án")
    })

    it("preserves a dirty supplier draft after deleting one of its options", async () => {
      const user = userEvent.setup()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({ id: "option-1" })
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([currentSupplier]))
        .mockResolvedValueOnce(
          suppliersResponse([supplier(currentSupplier.id, currentSupplier.name, 4)], 4)
        )
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([currentOption]))
        .mockResolvedValueOnce(optionsResponse([], 4))
      rpc.deleteOption.mockResolvedValueOnce({
        data: { id: currentOption.id, revision: 4 },
      })

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      const supplierName = await screen.findByLabelText("Tên nhà cung cấp")
      await user.clear(supplierName)
      await user.type(supplierName, "Công ty Thiết bị B")

      await user.click(screen.getByRole("button", { name: "Xóa phương án" }))
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", {
          name: "Xóa phương án",
        })
      )

      await waitFor(() => expect(rpc.deleteOption).toHaveBeenCalled())
      expect(screen.getByLabelText("Tên nhà cung cấp")).toHaveValue("Công ty Thiết bị B")
    })

    it("shows a recoverable error when the supplier option count cannot be loaded", async () => {
      const user = userEvent.setup()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([]))
        .mockRejectedValueOnce(new Error("network unavailable"))

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      await screen.findByText(currentSupplier.name)
      await user.click(screen.getByRole("button", { name: "Xóa nhà cung cấp" }))

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Không thể tải số phương án của nhà cung cấp."
      )
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })

    it("shows supplier validation and conflict controls even without an option", async () => {
      const user = userEvent.setup()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const conflict = Object.assign(new Error("stale_revision"), {
        code: "PT409",
        status: 409,
      })
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.listOptions.mockResolvedValue(optionsResponse([]))
      rpc.updateSupplier.mockRejectedValueOnce(conflict)

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      const supplierName = await screen.findByLabelText("Tên nhà cung cấp")
      await user.clear(supplierName)
      await user.type(supplierName, "   ")
      await user.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }))
      expect(await screen.findByRole("alert")).toHaveTextContent("Tên nhà cung cấp là bắt buộc.")

      await user.clear(supplierName)
      await user.type(supplierName, "Công ty Thiết bị B")
      await user.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }))

      const conflictAlert = await screen.findByRole("alert")
      expect(conflictAlert).toHaveTextContent("Dữ liệu đã thay đổi trên máy chủ")
      expect(
        within(conflictAlert).getByRole("button", { name: "Tải lại dữ liệu" })
      ).toBeInTheDocument()
    })

    it("requires confirmation before switching away from a dirty option", async () => {
      const user = userEvent.setup()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const first = option({ id: "option-1", model: "Model A" })
      const second = option({ id: "option-2", model: "Model B" })
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.listOptions.mockResolvedValue(optionsResponse([first, second]))

      renderWithQueryClient(<TechnicalConfigurationSuppliers dossier={dossier} />)
      await screen.findByDisplayValue("Model A")
      await user.type(screen.getByLabelText("Model"), " chưa lưu")
      await user.click(screen.getByRole("button", { name: second.display_label }))

      const dialog = await screen.findByRole("alertdialog")
      expect(dialog).toHaveTextContent("Bỏ thay đổi chưa lưu?")
      await user.click(within(dialog).getByRole("button", { name: "Hủy" }))
      expect(screen.getByDisplayValue("Model A chưa lưu")).toBeInTheDocument()
    })

    it("keeps a dirty option visible when a coherent remote refresh deletes it", async () => {
      const user = userEvent.setup()
      const onDirtyChange = vi.fn()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A", 7)
      const currentOption = option({ id: "option-1", model: "Model A", revision: 7 })
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([currentSupplier], 7))
        .mockResolvedValueOnce(
          suppliersResponse([supplier(currentSupplier.id, currentSupplier.name, 8)], 8)
        )
        .mockResolvedValueOnce(
          suppliersResponse([supplier(currentSupplier.id, currentSupplier.name, 8)], 8)
        )
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([currentOption], 7))
        .mockResolvedValueOnce(optionsResponse([], 8))
        .mockResolvedValueOnce(optionsResponse([], 8))

      const { queryClient } = renderWithQueryClient(
        <TechnicalConfigurationSuppliers dossier={dossier} onDirtyChange={onDirtyChange} />
      )
      await user.type(await screen.findByLabelText("Model"), " local")
      await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))

      await act(async () => {
        await Promise.all([
          queryClient.invalidateQueries(
            { queryKey: technicalConfigurationSuppliersQueryKey(dossier.id), exact: true },
            { throwOnError: true }
          ),
          queryClient.invalidateQueries(
            { queryKey: technicalConfigurationOptionsQueryKey(dossier.id), exact: true },
            { throwOnError: true }
          ),
        ])
      })

      expect(await screen.findByRole("alert")).toHaveTextContent("Dữ liệu đã thay đổi trên máy chủ")
      expect(screen.getByDisplayValue("Model A local")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Lưu phương án" }))
      expect(rpc.updateOption).not.toHaveBeenCalled()

      onDirtyChange.mockClear()
      await user.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }))
      await waitFor(() =>
        expect(screen.queryByDisplayValue("Model A local")).not.toBeInTheDocument()
      )
      expect(screen.getByText("Chưa có phương án cho nhà cung cấp này.")).toBeInTheDocument()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    })

    it("keeps a dirty supplier visible when a coherent remote refresh deletes it", async () => {
      const user = userEvent.setup()
      const onDirtyChange = vi.fn()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A", 7)
      rpc.listSuppliers
        .mockResolvedValueOnce(suppliersResponse([currentSupplier], 7))
        .mockResolvedValueOnce(suppliersResponse([], 8))
        .mockResolvedValueOnce(suppliersResponse([], 8))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([], 7))
        .mockResolvedValueOnce(optionsResponse([], 8))
        .mockResolvedValueOnce(optionsResponse([], 8))

      const { queryClient } = renderWithQueryClient(
        <TechnicalConfigurationSuppliers dossier={dossier} onDirtyChange={onDirtyChange} />
      )
      const supplierName = await screen.findByLabelText("Tên nhà cung cấp")
      await user.clear(supplierName)
      await user.type(supplierName, "Công ty Thiết bị local")
      await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))

      await act(async () => {
        await Promise.all([
          queryClient.invalidateQueries(
            { queryKey: technicalConfigurationSuppliersQueryKey(dossier.id), exact: true },
            { throwOnError: true }
          ),
          queryClient.invalidateQueries(
            { queryKey: technicalConfigurationOptionsQueryKey(dossier.id), exact: true },
            { throwOnError: true }
          ),
        ])
      })

      expect(await screen.findByRole("alert")).toHaveTextContent("Dữ liệu đã thay đổi trên máy chủ")
      expect(screen.getByDisplayValue("Công ty Thiết bị local")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }))
      expect(rpc.updateSupplier).not.toHaveBeenCalled()

      onDirtyChange.mockClear()
      await user.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }))
      await waitFor(() =>
        expect(screen.queryByDisplayValue("Công ty Thiết bị local")).not.toBeInTheDocument()
      )
      expect(screen.getByText("Chưa có nhà cung cấp.")).toBeInTheDocument()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    })

    it("renders archived dossiers as read-only controls", async () => {
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      const currentOption = option({ id: "option-1" })
      rpc.listSuppliers.mockResolvedValue(suppliersResponse([currentSupplier]))
      rpc.listOptions.mockResolvedValue(optionsResponse([currentOption]))

      renderWithQueryClient(
        <TechnicalConfigurationSuppliers
          dossier={{
            ...dossier,
            archived_at: "2026-07-23T02:00:00.000Z",
            archived_by: 1,
          }}
        />
      )

      expect(await screen.findByDisplayValue("Model A")).toBeDisabled()
      expect(screen.getByRole("button", { name: "Thêm nhà cung cấp" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Lưu phương án" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Xóa phương án" })).toBeDisabled()
    })

    it("allows an archived dossier to retry failed read queries", async () => {
      const user = userEvent.setup()
      const currentSupplier = supplier("supplier-1", "Công ty Thiết bị A")
      rpc.listSuppliers
        .mockRejectedValueOnce(new Error("network unavailable"))
        .mockResolvedValueOnce(suppliersResponse([currentSupplier]))
      rpc.listOptions
        .mockResolvedValueOnce(optionsResponse([]))
        .mockResolvedValueOnce(optionsResponse([]))

      renderWithQueryClient(
        <TechnicalConfigurationSuppliers
          dossier={{
            ...dossier,
            archived_at: "2026-07-23T02:00:00.000Z",
            archived_by: 1,
          }}
        />
      )

      await user.click(await screen.findByRole("button", { name: "Thử lại" }))
      expect(await screen.findByText(currentSupplier.name)).toBeInTheDocument()
      expect(rpc.listSuppliers).toHaveBeenCalledTimes(2)
    })
  })
}
